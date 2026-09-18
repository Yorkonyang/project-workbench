/**
 * 项目群聊（即时通讯）后端模块
 *
 * 设计目标：把「群聊」全部逻辑内聚到本文件，避免 simple-server.js 继续膨胀。
 * 依赖注入：simple-server.js 通过 ctx 传入 loadData/saveData/sendResponse/parseBody/generateId/ac，
 *          本模块不直接 require 数据库，便于测试与复用。
 *
 * 路由（均以 /api/chat 前缀）：
 *   GET    /api/chat/conversations
 *   GET    /api/chat/projects/:projectId/messages?before=&limit=
 *   POST   /api/chat/projects/:projectId/messages
 *   PUT    /api/chat/projects/:projectId/read
 *   GET    /api/chat/unread
 *   GET    /api/chat/stream          （SSE，GET 无需 X-Workbench 头）
 *   DELETE /api/chat/messages/:id    （撤回）
 *   GET    /api/chat/directs                       （V2 单聊会话列表；可选 ?project=<id> 按项目过滤）
 *   GET    /api/chat/directs/:peerId/messages       （V2 单聊历史；?project=<id> 按项目过滤，不传返回全量）
 *   POST   /api/chat/directs/:peerId/messages        （V2 单聊发送；body 必填 projectId）
 *   PUT    /api/chat/directs/:peerId/read            （V2 单聊标记已读；body 必填 projectId）
 *   DELETE /api/chat/directs/messages/:id            （V2 单聊撤回；drecall payload 带 projectId）
 *
 * 单聊「按项目隔离」：消息/游标以 (peerId, projectId) 复合 key 组织，projectId 表示「在哪个项目下」。
 * 存量无 projectId 的消息归入 null 桶，惰性兼容、不做破坏性迁移。
 */

/**
 * ============================================================================
 *  BPM（轻流）隔离约束（需求 1，强约束）
 * ----------------------------------------------------------------------------
 *  聊天模块（群聊 + 单聊）只会产生「站内通知」（data.notifications 集合），
 *  严禁 require 或调用 qingflow 模块，严禁触发任何 BPM（轻流）推送。
 *  单聊通知 type = 'chat_direct'，天然不匹配 POST /api/notifications 的
 *  'overdue' | 'escalation' 推送白名单，因此不会桥接到 BPM。
 *  任何聊天消息的副作用都不得触碰 qingflow.js 或任何既有推送调用点。
 * ============================================================================
 */

const CHAT_PREFIX = '/api/chat';
const MAX_CONTENT_LENGTH = 2000;      // 单条消息最大长度
const REPLY_SNIPPET_LENGTH = 60;      // 引用摘要长度
const NOTIFY_SNIPPET_LENGTH = 60;     // 通知正文摘要长度
const AGGREGATE_WINDOW_MS = 5 * 60 * 1000; // 同项目通知聚合窗口
const RECALL_WINDOW_MS = 5 * 60 * 1000;    // 撤回时限
const DEFAULT_PAGE_SIZE = 50;
const HEARTBEAT_MS = 25000;           // SSE 心跳间隔

// ==================== SSE 连接管理 ====================
// userId -> Set<res>。模块级单例，跨请求共享（Node 单进程单线程）。
const connections = new Map();
let heartbeatTimer = null;

/**
 * 注册一个 SSE 连接。
 * @param {string} userId
 * @param {import('http').ServerResponse} res
 */
function addConnection(userId, res) {
    const key = String(userId);
    if (!connections.has(key)) connections.set(key, new Set());
    connections.get(key).add(res);
    ensureHeartbeat();
}

/**
 * 移除一个 SSE 连接；连接集合为空时回收 Map 键，避免内存泄漏。
 * @param {string} userId
 * @param {import('http').ServerResponse} res
 */
function removeConnection(userId, res) {
    const key = String(userId);
    const set = connections.get(key);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) connections.delete(key);
}

/**
 * 回收所有空连接集合（userId -> 空 Set）的 Map 键。
 * 心跳与广播路径在删元素后调用，避免客户端异常断开（未触发 close）时残留空键。
 * 用 entries 快照遍历，避免边遍历边删除 Map 键。
 */
function pruneEmptyConnections() {
    for (const [key, set] of [...connections.entries()]) {
        if (set.size === 0) connections.delete(key);
    }
}

/**
 * 启动模块级心跳（仅一次）。定时向所有连接写注释帧，保活并透传探测。
 * timer.unref() 防止阻塞进程退出。
 */
function ensureHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
        for (const set of connections.values()) {
            for (const res of set) {
                try {
                    if (res.writableEnded) {
                        set.delete(res);
                        continue;
                    }
                    res.write(': ping\n\n');
                } catch (e) {
                    set.delete(res);
                }
            }
        }
        // 心跳结束后统一回收空键（写失败 / writableEnded 只删了元素）
        pruneEmptyConnections();
    }, HEARTBEAT_MS);
    if (heartbeatTimer.unref) heartbeatTimer.unref();
}

/**
 * 向指定用户的在线连接广播事件；发送者本人不在此列表内。
 * @param {string[]} userIds 目标用户 id 数组
 * @param {string} event SSE 事件名
 * @param {any} payload 事件数据（JSON 序列化）
 */
function broadcast(userIds, event, payload) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const uid of userIds) {
        const set = connections.get(String(uid));
        if (!set) continue;
        for (const res of set) {
            try {
                if (res.writableEnded) {
                    set.delete(res);
                    continue;
                }
                res.write(frame);
            } catch (e) {
                set.delete(res);
            }
        }
    }
    // 广播可能因写失败清空某个集合，统一回收空键
    pruneEmptyConnections();
}

// ==================== 数据与权限辅助 ====================

/**
 * 兼容旧库：补全群聊集合（simple-server.loadData 之外的兜底）。
 * @param {object} data
 * @returns {object} 同一 data 引用
 */
function ensureCollections(data) {
    if (!data) return data;
    if (!Array.isArray(data.chatMessages)) data.chatMessages = [];
    if (!Array.isArray(data.chatReads)) data.chatReads = [];
    // V2 单聊集合兜底（simple-server.loadData 之外再保一道）
    if (!Array.isArray(data.chatDirectMessages)) data.chatDirectMessages = [];
    if (!Array.isArray(data.chatDirectReads)) data.chatDirectReads = [];
    return data;
}

/**
 * 取成员详情；返回 { id, name, avatarColor } 或 null（已删除的成员视为不存在）。
 * @param {object} data
 * @param {string} id
 * @returns {object|null}
 */
function memberById(data, id) {
    const m = (data.members || []).find((x) => String(x.id) === String(id));
    if (!m) return null;
    return { id: String(m.id), name: m.name || '成员', avatarColor: m.avatarColor || '#6b7280' };
}

/**
 * 取与某成员双向的单聊消息，按 createdAt 升序（不修改入参）。
 * @param {object} data
 * @param {string} me 当前用户 id
 * @param {string} peerId 对方 id
 * @param {string|null} projectId 项目维度；null=全部（不区分项目），否则仅取该项目下的消息
 * @returns {object[]}
 */
function directMessagesBetween(data, me, peerId, projectId = null) {
    return (data.chatDirectMessages || [])
        .filter(
            (m) =>
                (String(m.fromId) === String(me) && String(m.toId) === String(peerId)) ||
                (String(m.fromId) === String(peerId) && String(m.toId) === String(me))
        )
        // projectId 维度过滤：传了只留该项目下；不传全部（含存量无 projectId 的旧消息）
        .filter(
            (m) => projectId == null || String(m.projectId || null) === String(projectId)
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * 计算某用户对某成员（在指定项目下）的单聊未读数：
 * 双方对话中「对方发送 + 未撤回 + 晚于已读游标 + 项目匹配」的消息数。
 * @param {object} data
 * @param {string} userId
 * @param {string} peerId
 * @param {string|null} projectId null=不限定项目（兜底全量），否则仅该项目
 * @returns {number}
 */
function countDirectUnread(data, userId, peerId, projectId = null) {
    const reads = data.chatDirectReads || [];
    const cursor = reads.find(
        (r) =>
            String(r.userId) === String(userId) &&
            String(r.peerId) === String(peerId) &&
            (projectId == null ? (r.projectId == null) : String(r.projectId || null) === String(projectId))
    );
    const since = cursor && cursor.lastReadAt ? new Date(cursor.lastReadAt).getTime() : 0;
    return (data.chatDirectMessages || []).filter(
        (m) =>
            String(m.fromId) === String(peerId) &&
            String(m.toId) === String(userId) &&
            !m.recalled &&
            (projectId == null || String(m.projectId || null) === String(projectId)) &&
            new Date(m.createdAt).getTime() > since
    ).length;
}

/**
 * 计算全部单聊未读之和（用于 unread.total）。
 * 仅统计「对方发给我（toId=我 且 fromId≠我）且未撤回且晚于已读游标」的消息，
 * 按 (fromId, projectId) 维度聚合：游标三元组 (userId, peerId, projectId)，与消息 projectId 对齐。
 */
function countAllDirectUnread(data, userId) {
    // key: `${fromId}#${projectIdOrEmpty}` -> cursor ms
    const cursorBy = {};
    for (const r of (data.chatDirectReads || [])) {
        if (String(r.userId) === String(userId)) {
            const k = `${String(r.peerId)}#${r.projectId == null ? '' : String(r.projectId)}`;
            const t = new Date(r.lastReadAt || 0).getTime();
            const existing = cursorBy[k];
            cursorBy[k] = existing == null ? t : Math.max(existing, t);
        }
    }
    let total = 0;
    for (const m of (data.chatDirectMessages || [])) {
        if (String(m.toId) !== String(userId) || String(m.fromId) === String(userId) || m.recalled) continue;
        const k = `${String(m.fromId)}#${m.projectId == null ? '' : String(m.projectId)}`;
        const since = cursorBy[k] || 0;
        if (new Date(m.createdAt).getTime() > since) total += 1;
    }
    return total;
}

/**
 * 按当前用户推导单聊会话列表：取与我相关（fromId=me 或 toId=me）的消息，
 * 按 (peerId, projectId) 复合 key 分组，返回
 * [{ peerId, peerName, peerAvatarColor, projectId, lastMessage, lastMessageAt, unreadCount }]，倒序。
 * 对方已删除则跳过该组。peerName/peerAvatarColor 从 members 实时取。
 * @param {object} data
 * @param {string} userId
 * @param {string|null} projectId 可选项目过滤：传了仅返回该项目下会话（旧消息缺 projectId 归 null 桶，不命中）；不传返回全部
 * @returns {object[]}
 */
function buildDirectConversations(data, userId, projectId = null) {
    const byPeer = new Map(); // key: `${peerId}#${projectIdOrEmpty}`
    for (const m of (data.chatDirectMessages || [])) {
        const mProj = m.projectId == null ? null : String(m.projectId);
        // 项目维度过滤：传了 project 只留该项目；不传全量（含 null 桶旧数据）
        if (projectId != null && mProj !== String(projectId)) continue;
        let peerId = null;
        if (String(m.fromId) === String(userId)) peerId = m.toId;
        else if (String(m.toId) === String(userId)) peerId = m.fromId;
        if (!peerId) continue;
        const key = `${String(peerId)}#${mProj == null ? '' : mProj}`;
        const prev = byPeer.get(key);
        if (!prev || new Date(m.createdAt).getTime() > new Date(prev.lastMessageAt || 0).getTime()) {
            byPeer.set(key, { peerId: String(peerId), projectId: mProj, lastMessage: m, lastMessageAt: m.createdAt });
        }
    }
    const list = [];
    for (const { peerId, projectId: pProj, lastMessage, lastMessageAt } of byPeer.values()) {
        const peer = memberById(data, peerId);
        if (!peer) continue; // 对方已删除则跳过该组
        list.push({
            peerId: peer.id,
            peerName: peer.name,
            peerAvatarColor: peer.avatarColor,
            projectId: pProj, // 旧消息缺 projectId 归 null 桶
            lastMessage,
            lastMessageAt,
            unreadCount: countDirectUnread(data, userId, peerId, pProj),
        });
    }
    list.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
    return list;
}

/**
 * 判定是否为本模块处理的路由前缀。
 * @param {string} pathname
 * @returns {boolean}
 */
function isChatPath(pathname) {
    return pathname === CHAT_PREFIX || pathname.startsWith(CHAT_PREFIX + '/');
}

/**
 * 计算项目群成员 id 集合（**只增不减**，保持向后兼容）。
 *
 * 来源（并集，去重）：
 *   1. project.ownerId / project.manager
 *   2. member.projectIds 命中该项目者
 *   3. 该项目任务的 assignee / assignees
 *   4. 项目记录上的显式成员字段（project.members / project.memberIds / project.team，
 *      元素兼容 id 字符串与 { id } 对象）—— 当前数据为空，为将来预留且无副作用
 *   5. 该项目群聊里「发过言的人」（data.chatMessages 中 projectId 命中者的 senderId）——
 *      在项目群里说过话的人即事实上的参与者，必须能被找到（根治"有未读却无入口"）
 *
 * @param {object} data
 * @param {string} projectId
 * @returns {string[]} 去重后的用户 id 数组
 */
function projectMemberIds(data, projectId) {
    const project = (data.projects || []).find((p) => p.id === projectId);
    if (!project) return [];
    const ids = new Set();
    if (project.ownerId) ids.add(String(project.ownerId));
    if (project.manager) ids.add(String(project.manager));
    for (const m of (data.members || [])) {
        if (Array.isArray(m.projectIds) && m.projectIds.includes(projectId)) ids.add(String(m.id));
    }
    for (const t of (data.tasks || [])) {
        if ((t.projectId || t.project_id) !== projectId) continue;
        if (Array.isArray(t.assignees)) {
            t.assignees.forEach((a) => { if (a) ids.add(String(a)); });
        } else if (t.assignee) {
            ids.add(String(t.assignee));
        }
    }
    // 4. 显式成员字段（members / memberIds / team，任一为数组则并入；元素兼容 id 或 { id }）
    for (const field of ['members', 'memberIds', 'team']) {
        if (!Array.isArray(project[field])) continue;
        for (const x of project[field]) {
            if (x == null) continue;
            const id = typeof x === 'object' ? (x.id != null ? x.id : null) : x;
            if (id != null && id !== '') ids.add(String(id));
        }
    }
    // 5. 项目群聊里发过言的人 = 事实上的项目参与者
    for (const msg of (data.chatMessages || [])) {
        if (msg.projectId === projectId && msg.senderId) ids.add(String(msg.senderId));
    }
    return [...ids].filter(Boolean);
}

/**
 * 取某项目下「与指定用户有过单聊往来」的对方 id 列表（去重，剔除自己）。
 * 判定：chatDirectMessages 中 projectId 命中该项目，且 fromId/toId 之一为当前用户，
 * 取另一方 id。用于前端在成员卡片列表里补齐"有往来但非项目成员"的入口。
 * @param {object} data
 * @param {string} userId
 * @param {string} projectId
 * @returns {string[]} 对方 id 数组
 */
function directPeersInProject(data, userId, projectId) {
    const set = new Set();
    for (const m of (data.chatDirectMessages || [])) {
        const mProj = m.projectId == null ? null : String(m.projectId);
        if (mProj !== String(projectId)) continue;
        const fromMe = String(m.fromId) === String(userId);
        const toMe = String(m.toId) === String(userId);
        if (!fromMe && !toMe) continue;
        const peer = fromMe ? m.toId : m.fromId;
        if (peer && String(peer) !== String(userId)) set.add(String(peer));
    }
    return [...set];
}

/**
 * 计算当前用户在某项目下的单聊未读总数（对所有往来 peer 求和）。
 * 复用 countDirectUnread 的 (userId, peerId, projectId) 游标口径。
 * @param {object} data
 * @param {string} userId
 * @param {string} projectId
 * @returns {number}
 */
function directUnreadInProject(data, userId, projectId) {
    let total = 0;
    for (const peer of directPeersInProject(data, userId, projectId)) {
        total += countDirectUnread(data, userId, peer, projectId);
    }
    return total;
}

/**
 * 当前用户能否访问某项目群聊：admin / 项目 owner(ownerId|manager) / projectIds 命中 / canViewProject。
 * @param {object} data
 * @param {string} userId
 * @param {string} projectId
 * @param {object} ac accessControl 模块
 * @returns {boolean}
 */
function canChat(data, userId, projectId, ac) {
    if (!userId) return false;
    if (ac.isAdmin(data, userId)) return true;
    const project = (data.projects || []).find((p) => p.id === projectId);
    if (!project) return false;
    if (ac.isProjectOwner(project, userId)) return true;
    const me = (data.members || []).find((m) => m.id === userId);
    if (me && Array.isArray(me.projectIds) && me.projectIds.includes(projectId)) return true;
    if (ac.canViewProject(data, userId, projectId)) return true;
    return false;
}

/**
 * 取某用户在某群的已读游标时间（毫秒）。
 * @returns {number} 无游标返回 0
 */
function getLastReadMs(data, userId, projectId) {
    const r = (data.chatReads || []).find((x) => x.userId === userId && x.projectId === projectId);
    if (!r || !r.lastReadAt) return 0;
    const t = new Date(r.lastReadAt).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/**
 * 计算未读消息数：该群中「createdAt > lastReadAt 且非我发送且未撤回」的消息数。
 */
function countUnread(data, userId, projectId) {
    const since = getLastReadMs(data, userId, projectId);
    return (data.chatMessages || []).filter(
        (m) =>
            m.projectId === projectId &&
            m.senderId !== userId &&
            !m.recalled &&
            new Date(m.createdAt).getTime() > since
    ).length;
}

/**
 * 计算未读且被 @ 的消息数。
 */
function countMentionUnread(data, userId, projectId) {
    const since = getLastReadMs(data, userId, projectId);
    return (data.chatMessages || []).filter(
        (m) =>
            m.projectId === projectId &&
            m.senderId !== userId &&
            !m.recalled &&
            Array.isArray(m.mentions) &&
            m.mentions.includes(userId) &&
            new Date(m.createdAt).getTime() > since
    ).length;
}

/**
 * 取某群最后一条消息（按 createdAt 最大者）。
 * @returns {object|null}
 */
function lastMessageOf(data, projectId) {
    let latest = null;
    for (const m of (data.chatMessages || [])) {
        if (m.projectId !== projectId) continue;
        if (!latest || new Date(m.createdAt).getTime() >= new Date(latest.createdAt).getTime()) {
            latest = m;
        }
    }
    return latest;
}

// ==================== 各接口实现 ====================

/**
 * GET /api/chat/conversations —— 当前用户可见项目群列表（含未读与最后一条消息）。
 * 每项额外带两个 **per-viewer** 字段（依赖 userId，非全局）：
 *   - dmPeers:      该项目下与当前用户有过单聊往来的对方 id 列表
 *   - directUnread: 该项目下当前用户的单聊未读总数
 */
function handleConversations(res, ctx, userId) {
    const data = ensureCollections(ctx.loadData());
    const { ac, sendResponse } = ctx;
    const projects = ac.visibleProjects(data, userId).filter((p) => p.archived !== 1);
    const list = projects.map((p) => {
        const memberIds = projectMemberIds(data, p.id);
        const lastMessage = lastMessageOf(data, p.id);
        return {
            projectId: p.id,
            projectName: p.name || '',
            projectCode: p.code || '',
            projectColor: p.color || '#6366F1',
            archived: p.archived === 1,
            memberIds,
            memberCount: memberIds.length,
            lastMessage,
            lastMessageAt: lastMessage ? lastMessage.createdAt : (p.updated_at || p.created_at || null),
            unreadCount: countUnread(data, userId, p.id),
            mentionCount: countMentionUnread(data, userId, p.id),
            // per-viewer：单聊入口补齐（与当前用户有往来者，即使不是派生成员也能找到）
            dmPeers: directPeersInProject(data, userId, p.id),
            directUnread: directUnreadInProject(data, userId, p.id),
        };
    });
    // 按最后消息时间倒序（无消息的用 updated_at 回退，仍参与排序）
    list.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
    sendResponse(res, 200, list);
}

/**
 * GET /api/chat/projects/:projectId/messages —— 分页拉历史，返回 { messages, hasMore }，升序。
 */
function handleGetMessages(res, ctx, userId, projectId, url) {
    const data = ensureCollections(ctx.loadData());
    const { ac, sendResponse } = ctx;
    const project = (data.projects || []).find((p) => p.id === projectId);
    if (!project) { sendResponse(res, 404, { error: '项目不存在' }); return; }
    if (!canChat(data, userId, projectId, ac)) { sendResponse(res, 403, { error: '无权访问该项目群聊' }); return; }

    const rawLimit = parseInt(url.searchParams.get('limit'), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : DEFAULT_PAGE_SIZE;
    const before = url.searchParams.get('before');

    let all = (data.chatMessages || []).filter((m) => m.projectId === projectId);
    all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let slice;
    if (before) {
        const beforeMs = new Date(before).getTime();
        const eligible = Number.isNaN(beforeMs) ? all : all.filter((m) => new Date(m.createdAt).getTime() < beforeMs);
        slice = eligible.slice(Math.max(0, eligible.length - limit));
    } else {
        slice = all.slice(Math.max(0, all.length - limit));
    }

    const first = slice[0];
    const hasMore = first
        ? all.some((m) => new Date(m.createdAt).getTime() < new Date(first.createdAt).getTime())
        : false;

    sendResponse(res, 200, { messages: slice, hasMore });
}

/**
 * POST /api/chat/projects/:projectId/messages —— 发消息（含通知聚合副作用 + SSE 广播）。
 */
async function handlePostMessage(req, res, ctx, userId, projectId) {
    const data = ensureCollections(ctx.loadData());
    const { ac, sendResponse, parseBody, generateId, saveData } = ctx;
    const project = (data.projects || []).find((p) => p.id === projectId);
    if (!project) { sendResponse(res, 404, { error: '项目不存在' }); return; }
    if (!canChat(data, userId, projectId, ac)) { sendResponse(res, 403, { error: '无权访问该项目群聊' }); return; }

    const body = await parseBody(req);
    if (body && body.__tooLarge) { sendResponse(res, 413, { error: '消息体过大' }); return; }

    // 内容校验：trim、去空、超长截断
    let content = String((body && body.content) || '').trim();
    if (!content) { sendResponse(res, 400, { error: '消息内容不能为空' }); return; }
    if (content.length > MAX_CONTENT_LENGTH) content = content.slice(0, MAX_CONTENT_LENGTH);

    const memberIds = projectMemberIds(data, projectId);

    // mentions：仅保留合法项目成员 id，且不含自己
    let mentions = [];
    if (Array.isArray(body && body.mentions)) {
        mentions = [...new Set(
            body.mentions
                .map((x) => String(x))
                .filter((id) => id && id !== userId && memberIds.includes(id))
        )];
    }

    // 引用回复快照
    let replyTo = null;
    const replyToId = body && body.replyToId;
    if (replyToId) {
        const target = (data.chatMessages || []).find((m) => m.id === replyToId && m.projectId === projectId);
        if (target) {
            replyTo = {
                id: target.id,
                senderName: target.senderName || '成员',
                content: (target.recalled ? '' : String(target.content || '')).slice(0, REPLY_SNIPPET_LENGTH),
            };
        }
    }

    const senderName = ac.getUserName(data, userId) || '成员';
    const nowIso = new Date().toISOString();
    const message = {
        id: generateId(),
        projectId,
        senderId: userId,
        senderName,
        content,
        mentions,
        replyTo,
        createdAt: nowIso,
        recalled: false,
    };
    data.chatMessages.push(message);

    // 副作用：对项目群内除发送者外的每个成员发通知（同项目 5 分钟聚合）
    const projectName = project.name || '项目';
    const recipients = memberIds.filter((id) => id !== userId);
    const now = Date.now();
    const previewText = content.slice(0, NOTIFY_SNIPPET_LENGTH);

    for (const rid of recipients) {
        const isMention = mentions.includes(rid);
        const aggIdx = (data.notifications || []).findIndex(
            (n) =>
                n.user_id === rid &&
                n.relatedId === projectId &&
                Number(n.read) === 0 &&
                typeof n.type === 'string' && n.type.startsWith('chat') &&
                (now - new Date(n.created_at).getTime()) < AGGREGATE_WINDOW_MS
        );

        if (aggIdx >= 0) {
            // 命中聚合：更新既有未读通知，避免刷屏
            const n = data.notifications[aggIdx];
            n.chatCount = (n.chatCount || 1) + 1;
            n.message = `${senderName} 等 ${n.chatCount} 条新消息`;
            n.created_at = nowIso;
            if (isMention) {
                n.type = 'chat_mention';
                n.title = `[有人@你] ${projectName} 项目群`;
            }
        } else {
            data.notifications.push({
                id: generateId(),
                user_id: rid,
                title: isMention ? `[有人@你] ${projectName} 项目群` : `${projectName} 项目群`,
                message: `${senderName}：${previewText}`,
                type: isMention ? 'chat_mention' : 'chat',
                read: 0,
                relatedId: projectId,
                relatedType: 'project_chat',
                link: `/messages?project=${projectId}`,
                created_at: nowIso,
                chatCount: 1,
            });
        }
    }

    // 一次请求只写一次磁盘
    saveData(data);

    // SSE 推送：仅发给收件人，发送者本人不收取自己的消息
    broadcast(recipients, 'message', message);

    sendResponse(res, 200, message);
}

/**
 * PUT /api/chat/projects/:projectId/read —— 标记已读（更新游标）。
 */
async function handleMarkRead(req, res, ctx, userId, projectId) {
    const data = ensureCollections(ctx.loadData());
    const { ac, sendResponse, parseBody, generateId, saveData } = ctx;
    const project = (data.projects || []).find((p) => p.id === projectId);
    if (!project) { sendResponse(res, 404, { error: '项目不存在' }); return; }
    if (!canChat(data, userId, projectId, ac)) { sendResponse(res, 403, { error: '无权访问该项目群聊' }); return; }

    const body = await parseBody(req);
    let lastReadAt;
    if (body && body.lastReadAt) {
        const t = new Date(body.lastReadAt);
        lastReadAt = Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
    } else {
        lastReadAt = new Date().toISOString();
    }

    const rec = (data.chatReads || []).find((r) => r.userId === userId && r.projectId === projectId);
    if (rec) {
        rec.lastReadAt = lastReadAt;
    } else {
        data.chatReads.push({ id: generateId(), userId, projectId, lastReadAt });
    }
    saveData(data);
    sendResponse(res, 200, { success: true, lastReadAt });
}

/**
 * GET /api/chat/unread —— 未读汇总。
 * 返回 { total, byProject, mentionByProject, directTotal, byPeer, byProjectDirect, orphanDirect }。
 * 新增（V2 单聊入口闭环）：
 *   - byProjectDirect: { [projectId]: number } 每个项目下的单聊未读聚合（由 byPeer 的 `peer#projectId` 键聚合）
 *   - orphanDirect:    number projectId=null 桶（旧数据）的单聊未读总数
 * 二者是 byPeer 的派生视图，**不重复计入 total**（total 仍 = projectTotal + directTotal）。
 */
function handleUnread(res, ctx, userId) {
    const data = ensureCollections(ctx.loadData());
    const { ac, sendResponse } = ctx;
    const projects = ac.visibleProjects(data, userId).filter((p) => p.archived !== 1);
    const byProject = {};
    const mentionByProject = {};
    const byPeer = {}; // V2：单聊未读，flat key `${peerId}#${projectId}`（旧消息缺 projectId 归 `${peerId}#`）
    let projectTotal = 0;
    for (const p of projects) {
        const u = countUnread(data, userId, p.id);
        if (u > 0) { byProject[p.id] = u; projectTotal += u; }
        const mc = countMentionUnread(data, userId, p.id);
        if (mc > 0) mentionByProject[p.id] = mc;
    }
    // V2 单聊未读：按 (peerId, projectId) 复合维度聚合，并累计到 total
    let directTotal = 0;
    const seenFrom = new Set();
    for (const m of (data.chatDirectMessages || [])) {
        if (String(m.toId) !== String(userId) || String(m.fromId) === String(userId) || m.recalled) continue;
        const pProj = m.projectId == null ? null : String(m.projectId);
        const key = `${String(m.fromId)}#${pProj == null ? '' : pProj}`;
        // 同 (fromId, projectId) 多消息只计一次未读游标
        if (seenFrom.has(key)) continue;
        seenFrom.add(key);
        const u = countDirectUnread(data, userId, m.fromId, pProj);
        if (u > 0) { byPeer[key] = u; }
    }
    // 去重累计：byPeer 已按复合 key 去重，直接求和
    directTotal = Object.values(byPeer).reduce((a, b) => a + b, 0);
    // 派生视图：按项目聚合单聊未读 + 无归属（projectId=null）桶未读（peerId 为 UUID，不含 '#'）
    const byProjectDirect = {};
    let orphanDirect = 0;
    for (const [key, u] of Object.entries(byPeer)) {
        const hashIdx = key.lastIndexOf('#');
        const projPart = hashIdx >= 0 ? key.slice(hashIdx + 1) : '';
        if (projPart) {
            byProjectDirect[projPart] = (byProjectDirect[projPart] || 0) + u;
        } else {
            orphanDirect += u;
        }
    }
    const total = projectTotal + directTotal;
    sendResponse(res, 200, {
        total,
        byProject,
        mentionByProject,
        directTotal,
        byPeer,
        byProjectDirect,
        orphanDirect,
    });
}

/**
 * GET /api/chat/stream —— SSE 长连接。
 */
function handleStream(req, res, ctx, userId) {
    const { ac, sendResponse } = ctx;
    if (!userId) { sendResponse(res, 401, { error: '未登录' }); return; }

    const headers = {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        // 关键：nginx 下禁止缓冲，否则事件会被攒着不发
        'X-Accel-Buffering': 'no',
    };
    // 同源部署无 Origin 头；跨域时回显 Origin 以支持带凭据
    const origin = req.headers.origin;
    if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
    }
    res.writeHead(200, headers);
    // 首帧：重连间隔 + ready 事件
    res.write('retry: 3000\n\n');
    res.write('event: ready\ndata: {"ok":true}\n\n');

    addConnection(userId, res);

    const cleanup = () => removeConnection(userId, res);
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    // 不调用 res.end()，保持长连接
}

/**
 * DELETE /api/chat/messages/:id —— 撤回（发送者本人或 admin，5 分钟内）。
 */
function handleRecall(res, ctx, userId, messageId) {
    const data = ensureCollections(ctx.loadData());
    const { ac, sendResponse, saveData } = ctx;
    const msg = (data.chatMessages || []).find((m) => m.id === messageId);
    if (!msg) { sendResponse(res, 404, { error: '消息不存在' }); return; }
    if (!canChat(data, userId, msg.projectId, ac)) { sendResponse(res, 403, { error: '无权访问该项目群聊' }); return; }

    const isSender = msg.senderId === userId;
    const isAdminUser = ac.isAdmin(data, userId);
    if (!isSender && !isAdminUser) { sendResponse(res, 403, { error: '无权撤回该消息' }); return; }

    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age > RECALL_WINDOW_MS) { sendResponse(res, 403, { error: '超过 5 分钟无法撤回' }); return; }

    msg.recalled = true;
    msg.content = '';
    msg.mentions = [];
    saveData(data);

    // 广播撤回事件给群成员（含发送者，便于多端同步）
    broadcast(projectMemberIds(data, msg.projectId), 'recall', { id: msg.id, projectId: msg.projectId });
    sendResponse(res, 200, msg);
}

// ==================== V2 单聊接口 ====================

/**
 * GET /api/chat/directs —— 当前用户单聊会话列表（含未读与最后一条消息）。
 * 可选 ?project=<id>：传了仅返回该项目下的单聊会话，不传返回全部（含旧数据 null 桶）。
 */
function handleDirectConversations(res, ctx, userId, url) {
    const data = ensureCollections(ctx.loadData());
    const { sendResponse } = ctx;
    const projectParam = url.searchParams.get('project');
    let projectId = null;
    if (projectParam) {
        // 校验项目存在（非法 → 400）；不存在项目时返回空列表而非 404，保持旧 URL 兼容
        const project = (data.projects || []).find((p) => p.id === projectParam);
        if (!project) { projectId = null; }
        else { projectId = projectParam; }
    }
    const list = buildDirectConversations(data, userId, projectId);
    sendResponse(res, 200, list);
}

/**
 * GET /api/chat/directs/:peerId/messages —— 与某成员的历史消息（双向），升序 { messages, hasMore }。
 * 可选 ?project=<id>：传了按项目过滤，不传返回该 peer 全量（旧数据兜底，不 404）。
 */
function handleGetDirectMessages(res, ctx, userId, peerId, url) {
    const data = ensureCollections(ctx.loadData());
    const { sendResponse } = ctx;
    const peer = memberById(data, peerId);
    if (!peer) { sendResponse(res, 404, { error: '成员不存在' }); return; }

    const rawLimit = parseInt(url.searchParams.get('limit'), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : DEFAULT_PAGE_SIZE;
    const before = url.searchParams.get('before');
    // ?project= 维度：传了按项目过滤；不传返回全量（含旧数据）
    const projectParam = url.searchParams.get('project');
    const projectId = projectParam ? projectParam : null;

    const all = directMessagesBetween(data, userId, peerId, projectId);

    let slice;
    if (before) {
        const beforeMs = new Date(before).getTime();
        const eligible = Number.isNaN(beforeMs) ? all : all.filter((m) => new Date(m.createdAt).getTime() < beforeMs);
        slice = eligible.slice(Math.max(0, eligible.length - limit));
    } else {
        slice = all.slice(Math.max(0, all.length - limit));
    }

    const first = slice[0];
    const hasMore = first
        ? all.some((m) => new Date(m.createdAt).getTime() < new Date(first.createdAt).getTime())
        : false;

    sendResponse(res, 200, { messages: slice, hasMore });
}

/**
 * POST /api/chat/directs/:peerId/messages —— 发单聊消息（按项目隔离）。
 * 校验：body 必填 projectId；项目必须存在（非法 → 400）；canChat 当前用户对该项目有访问权（→ 403）；
 *      peer 必须 ∈ 该项目成员集合（复用群聊那套 canChat + projectMemberIds，否则 → 403）。
 * 副作用：站内通知（chat_direct，含 5 分钟聚合）+ SSE 'dmessage'（完整 message 自动带 projectId）。
 * 严禁调用 qingflow / BPM。
 */
async function handlePostDirectMessage(req, res, ctx, userId, peerId) {
    // BPM 隔离：本函数只产生站内通知，绝不调用 qingflow。
    const data = ensureCollections(ctx.loadData());
    const { sendResponse, parseBody, generateId, saveData, ac } = ctx;

    const peer = memberById(data, peerId);
    if (!peer) { sendResponse(res, 404, { error: '成员不存在' }); return; }
    if (String(peerId) === String(userId)) { sendResponse(res, 400, { error: '不能给自己发送单聊消息' }); return; }

    const body = await parseBody(req);
    if (body && body.__tooLarge) { sendResponse(res, 413, { error: '消息体过大' }); return; }

    // projectId 必填（项目隔离维度）
    const projectId = body && body.projectId ? String(body.projectId) : '';
    if (!projectId) { sendResponse(res, 400, { error: '缺少 projectId，无法按项目发送单聊' }); return; }
    const project = (data.projects || []).find((p) => p.id === projectId);
    if (!project) { sendResponse(res, 400, { error: '项目不存在' }); return; }
    // 当前用户须能访问该项目（群聊那套 canChat）
    if (!canChat(data, userId, projectId, ac)) { sendResponse(res, 403, { error: '无权访问该项目群聊' }); return; }
    // peer 必须 ∈ 该项目成员集合（复用 projectMemberIds）
    const memberIds = projectMemberIds(data, projectId);
    if (!memberIds.includes(String(peerId))) { sendResponse(res, 403, { error: '对方不是该项目成员' }); return; }

    let content = String((body && body.content) || '').trim();
    if (!content) { sendResponse(res, 400, { error: '消息内容不能为空' }); return; }
    if (content.length > MAX_CONTENT_LENGTH) content = content.slice(0, MAX_CONTENT_LENGTH);

    const senderName = ac.getUserName(data, userId) || '成员';
    const nowIso = new Date().toISOString();
    const toId = String(peerId);

    // 引用回复快照：replyToId 必须是双方之间（fromId/toId 覆盖双方）且同项目已有消息
    let replyTo = null;
    const replyToId = body && body.replyToId;
    if (replyToId) {
        const target = (data.chatDirectMessages || []).find(
            (m) =>
                m.id === replyToId &&
                String(m.projectId) === String(projectId) &&
                ((String(m.fromId) === String(userId) && String(m.toId) === toId) ||
                    (String(m.fromId) === toId && String(m.toId) === String(userId)))
        );
        if (target) {
            replyTo = {
                id: target.id,
                senderName: target.senderName || '成员',
                content: (target.recalled ? '' : String(target.content || '')).slice(0, REPLY_SNIPPET_LENGTH),
            };
        }
    }

    const message = {
        id: generateId(),
        fromId: String(userId),
        toId,
        projectId,
        senderName,
        content,
        replyTo,
        createdAt: nowIso,
        recalled: false,
    };
    data.chatDirectMessages.push(message);

    // 副作用：给接收方发站内通知（type=chat_direct，不匹配 BPM 白名单）
    const previewText = content.slice(0, NOTIFY_SNIPPET_LENGTH);
    const now = Date.now();
    const aggIdx = (data.notifications || []).findIndex(
        (n) =>
            n.user_id === toId &&
            n.relatedId === String(userId) &&
            n.relatedType === 'chat_direct' &&
            Number(n.read) === 0 &&
            typeof n.type === 'string' && n.type === 'chat_direct' &&
            (now - new Date(n.created_at).getTime()) < AGGREGATE_WINDOW_MS
    );
    if (aggIdx >= 0) {
        const n = data.notifications[aggIdx];
        n.chatCount = (n.chatCount || 1) + 1;
        n.message = `${senderName} 发来 ${n.chatCount} 条新消息`;
        n.created_at = nowIso;
    } else {
        data.notifications.push({
            id: generateId(),
            user_id: toId,
            title: `${senderName} 给你发来消息`,
            message: previewText,
            type: 'chat_direct',
            read: 0,
            relatedId: String(userId),
            relatedType: 'chat_direct',
            link: `/messages?peer=${String(userId)}&project=${encodeURIComponent(projectId)}`,
            created_at: nowIso,
            chatCount: 1,
        });
    }

    // 一次请求只写一次磁盘
    saveData(data);

    // SSE 推送：仅发给接收方，发送者本人不收自己的 dmessage
    broadcast([toId], 'dmessage', message);

    sendResponse(res, 200, message);
}

/**
 * PUT /api/chat/directs/:peerId/read —— 标记单聊已读（游标按 (userId, peerId, projectId) 三元组写）。
 * body 需带 projectId；旧前端不带时按 null 桶写（兼容，不报错）。
 */
async function handleMarkDirectRead(req, res, ctx, userId, peerId) {
    const data = ensureCollections(ctx.loadData());
    const { sendResponse, parseBody, generateId, saveData } = ctx;
    const peer = memberById(data, peerId);
    if (!peer) { sendResponse(res, 404, { error: '成员不存在' }); return; }

    const body = await parseBody(req);
    let lastReadAt;
    if (body && body.lastReadAt) {
        const t = new Date(body.lastReadAt);
        lastReadAt = Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
    } else {
        lastReadAt = new Date().toISOString();
    }
    // 游标项目维度：新前端带 projectId；旧前端不带则归 null 桶（兼容）
    const readProjectId = body && body.projectId != null && String(body.projectId) !== ''
        ? String(body.projectId)
        : null;

    const rec = (data.chatDirectReads || []).find(
        (r) =>
            String(r.userId) === String(userId) &&
            String(r.peerId) === String(peerId) &&
            (readProjectId == null
                ? (r.projectId == null)
                : String(r.projectId || null) === readProjectId)
    );
    if (rec) {
        rec.lastReadAt = lastReadAt;
    } else {
        data.chatDirectReads.push({
            id: generateId(),
            userId: String(userId),
            peerId: String(peerId),
            projectId: readProjectId,
            lastReadAt,
        });
    }
    saveData(data);
    sendResponse(res, 200, { success: true, lastReadAt });
}

/**
 * DELETE /api/chat/directs/messages/:id —— 撤回单聊消息（发送者本人或 admin，5 分钟内）。
 * 广播 'drecall' 给双方（含发送者，多端同步），payload 带该消息 projectId。
 */
function handleRecallDirect(res, ctx, userId, messageId) {
    const data = ensureCollections(ctx.loadData());
    const { ac, sendResponse, saveData } = ctx;
    const msg = (data.chatDirectMessages || []).find((m) => m.id === messageId);
    if (!msg) { sendResponse(res, 404, { error: '消息不存在' }); return; }

    const isSender = String(msg.fromId) === String(userId);
    const isAdminUser = ac.isAdmin(data, userId);
    if (!isSender && !isAdminUser) { sendResponse(res, 403, { error: '无权撤回该消息' }); return; }

    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age > RECALL_WINDOW_MS) { sendResponse(res, 403, { error: '超过 5 分钟无法撤回' }); return; }

    msg.recalled = true;
    msg.content = '';
    // replyTo 保留（设计：撤回仅清空内容，引用快照保留）
    saveData(data);

    // 广播给双方（去重），含发送者便于多端同步；payload 带 projectId 供前端按项目定位
    const targets = [...new Set([String(msg.fromId), String(msg.toId)])];
    broadcast(targets, 'drecall', {
        id: msg.id,
        fromId: String(msg.fromId),
        toId: String(msg.toId),
        projectId: msg.projectId == null ? null : String(msg.projectId),
    });
    sendResponse(res, 200, msg);
}

// ==================== 入口 ====================

/**
 * 处理群聊请求。
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} ctx { pathname, method, url, loadData, saveData, sendResponse, parseBody, generateId, ac }
 * @returns {Promise<boolean>} true=已处理；false=未匹配，交给后续路由（404）
 */
async function handle(req, res, ctx) {
    try {
        const { pathname, method, url, ac } = ctx;
        const userId = ac.getUserId(req);
        let m;

        // SSE 为 GET，单独提前处理（auth 在内部判定）
        if (pathname === `${CHAT_PREFIX}/stream` && method === 'GET') {
            handleStream(req, res, ctx, userId);
            return true;
        }

        // 其余接口均需登录
        if (!userId) {
            ctx.sendResponse(res, 401, { error: '未登录' });
            return true;
        }

        if (pathname === `${CHAT_PREFIX}/conversations` && method === 'GET') {
            handleConversations(res, ctx, userId);
            return true;
        }

        if (pathname === `${CHAT_PREFIX}/unread` && method === 'GET') {
            handleUnread(res, ctx, userId);
            return true;
        }

        // ---- V2 单聊路由 ----
        if (pathname === `${CHAT_PREFIX}/directs` && method === 'GET') {
            handleDirectConversations(res, ctx, userId, url);
            return true;
        }

        m = pathname.match(/^\/api\/chat\/directs\/([^/]+)\/messages$/);
        if (m) {
            const peerId = decodeURIComponent(m[1]);
            if (method === 'GET') { handleGetDirectMessages(res, ctx, userId, peerId, url); return true; }
            if (method === 'POST') { await handlePostDirectMessage(req, res, ctx, userId, peerId); return true; }
        }

        m = pathname.match(/^\/api\/chat\/directs\/([^/]+)\/read$/);
        if (m && method === 'PUT') {
            const peerId = decodeURIComponent(m[1]);
            await handleMarkDirectRead(req, res, ctx, userId, peerId);
            return true;
        }

        m = pathname.match(/^\/api\/chat\/directs\/messages\/([^/]+)$/);
        if (m && method === 'DELETE') {
            const messageId = decodeURIComponent(m[1]);
            handleRecallDirect(res, ctx, userId, messageId);
            return true;
        }

        m = pathname.match(/^\/api\/chat\/projects\/([^/]+)\/messages$/);
        if (m) {
            const projectId = decodeURIComponent(m[1]);
            if (method === 'GET') { handleGetMessages(res, ctx, userId, projectId, url); return true; }
            if (method === 'POST') { await handlePostMessage(req, res, ctx, userId, projectId); return true; }
        }

        m = pathname.match(/^\/api\/chat\/projects\/([^/]+)\/read$/);
        if (m && method === 'PUT') {
            const projectId = decodeURIComponent(m[1]);
            await handleMarkRead(req, res, ctx, userId, projectId);
            return true;
        }

        m = pathname.match(/^\/api\/chat\/messages\/([^/]+)$/);
        if (m && method === 'DELETE') {
            const messageId = decodeURIComponent(m[1]);
            handleRecall(res, ctx, userId, messageId);
            return true;
        }

        return false;
    } catch (err) {
        // 兜底：任何异常都不允许冒泡导致进程崩溃
        try {
            ctx.sendResponse(res, 500, { error: (err && err.message) || '服务器内部错误' });
        } catch (e) { /* 响应可能已中断，忽略 */ }
        return true;
    }
}

module.exports = {
    ensureCollections,
    isChatPath,
    handle,
};
