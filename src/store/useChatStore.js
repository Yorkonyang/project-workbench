/**
 * 群聊 Store - 连接后端群聊 API + 管理本地消息/会话/未读状态
 *
 * 持久化策略：仅持久化 settings（音效 / 桌面通知开关）。
 * 消息与会话不落 localStorage，避免脏数据与隐私泄露（每次登录由 refreshActiveUser 重置）。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/useAuthStore';

const PAGE_SIZE = 50;

/** 按 createdAt 升序排序（不修改入参） */
function sortByTime(messages) {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/** 按 id 去重，保留后者（SSE 回推的新版本优先） */
function dedupeById(messages) {
  const map = new Map();
  messages.forEach((m) => { if (m && m.id) map.set(m.id, m); });
  return [...map.values()];
}

/**
 * 单聊复合 key：`${peerId}#${projectId}`（projectId 为空 → `${peerId}#`）。
 * projectId 是"在哪个项目下"，旧数据缺 projectId 归 null 桶。
 */
function peerKey(peerId, projectId) {
  return `${peerId}#${projectId == null ? '' : projectId}`;
}

export { peerKey };

export const useChatStore = create(
  persist(
    (set, get) => ({
      conversations: [],
      conversationsLoading: false,
      conversationsError: null,
      messagesByProject: {},   // projectId -> 消息数组（升序）
      hasMoreByProject: {},    // projectId -> boolean
      loadingMessages: {},     // projectId -> boolean
      activeProjectId: null,
      unreadTotal: 0,
      unreadByProject: {},
      mentionByProject: {},
      // 单聊未读的项目维度派生视图（供页面把"群未读 + 该项目单聊未读"合并到项目行红点）
      unreadByProjectDirect: {},   // projectId -> 该项目下单聊未读聚合
      orphanDirectUnread: 0,       // projectId=null 桶（旧数据）单聊未读总数
      // ---- V2 单聊状态（按项目隔离：复合 key `${peerId}#${projectId}`）----
      directConversations: [],     // 单聊会话列表（每项带 projectId）
      messagesByPeer: {},         // `${peerId}#${projectId}` -> 消息数组（升序）
      hasMoreByPeer: {},          // `${peerId}#${projectId}` -> boolean
      loadingByPeer: {},          // `${peerId}#${projectId}` -> boolean
      unreadByPeer: {},           // `${peerId}#${projectId}` -> 未读数（与群 unreadByProject 隔离）
      directTotal: 0,
      activePeerId: null,         // 对方成员 id
      activePeerProjectId: null,  // 当前单聊所在项目 id（与 activePeerId 成二元组）
      sseConnected: false,
      settings: { sound: true, desktop: true }, // ← 唯一持久化字段

      // ---- 基础 setter ----
      setSSEConnected: (value) => set({ sseConnected: Boolean(value) }),

      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

      // ---- 拉取会话列表 ----
      fetchConversations: async () => {
        set({ conversationsLoading: true, conversationsError: null });
        try {
          const list = await apiClient.getChatConversations();
          set({ conversations: Array.isArray(list) ? list : [], conversationsLoading: false });
        } catch (err) {
          set({ conversationsLoading: false, conversationsError: err.message || '加载会话失败' });
        }
      },

      // ---- 拉取未读汇总（群 + 单，total 以服务端为准覆盖）----
      fetchUnread: async () => {
        try {
          const res = await apiClient.getChatUnread();
          set({
            unreadTotal: (res && res.total) || 0,
            unreadByProject: (res && res.byProject) || {},
            mentionByProject: (res && res.mentionByProject) || {},
            directTotal: (res && res.directTotal) || 0,
            unreadByPeer: (res && res.byPeer) || {},
            // 单聊未读的项目维度派生视图（服务端 byProjectDirect/orphanDirect，total 未重复计数）
            unreadByProjectDirect: (res && res.byProjectDirect) || {},
            orphanDirectUnread: (res && res.orphanDirect) || 0,
          });
        } catch (err) {
          // 未读兜底轮询失败静默处理，不打扰用户
        }
      },

      // ---- 打开会话：无缓存则拉最近 50 条；有缓存则秒显 + 后台并行对齐并合并 ----
      openProject: async (projectId) => {
        if (!projectId) return;
        set({ activeProjectId: projectId });
        const cached = get().messagesByProject[projectId];
        if (!cached) {
          // 无缓存：显示 loading → 拉取 → 填充
          set((s) => ({ loadingMessages: { ...s.loadingMessages, [projectId]: true } }));
          try {
            const res = await apiClient.getChatMessages(projectId, { limit: PAGE_SIZE });
            const messages = Array.isArray(res) ? res : ((res && res.messages) || []);
            const hasMore = Array.isArray(res) ? messages.length >= PAGE_SIZE : Boolean(res && res.hasMore);
            set((s) => ({
              messagesByProject: { ...s.messagesByProject, [projectId]: sortByTime(messages) },
              hasMoreByProject: { ...s.hasMoreByProject, [projectId]: hasMore },
              loadingMessages: { ...s.loadingMessages, [projectId]: false },
            }));
          } catch (err) {
            set((s) => ({ loadingMessages: { ...s.loadingMessages, [projectId]: false } }));
          }
        } else {
          // 有缓存：先秒显缓存（不置 loading），后台并行对齐以补齐 SSE 断档期间的消息
          try {
            const res = await apiClient.getChatMessages(projectId, { limit: PAGE_SIZE });
            const serverList = sortByTime(Array.isArray(res) ? res : ((res && res.messages) || []));
            set((s) => {
              const local = s.messagesByProject[projectId] || [];
              const serverIds = new Set(serverList.map((m) => m.id));
              const firstServerTime = serverList.length
                ? new Date(serverList[0].createdAt).getTime()
                : Infinity;
              const lastServerTime = serverList.length
                ? new Date(serverList[serverList.length - 1].createdAt).getTime()
                : 0;

              // 服务端未返回的本地消息，按位置分两段保留：
              //  ① 比服务端末条更新 → 本次请求飞行途中 SSE 到达的新消息
              //  ② 比服务端首条更早 → 用户此前 loadMore 上拉出来的更早历史
              const inFlight = local.filter(
                (m) => m && m.id && !serverIds.has(m.id) && new Date(m.createdAt).getTime() > lastServerTime
              );
              const olderLocal = serverList.length
                ? local.filter(
                    (m) => m && m.id && !serverIds.has(m.id) && new Date(m.createdAt).getTime() < firstServerTime
                  )
                : [];

              const merged = sortByTime([...serverList, ...inFlight, ...olderLocal]);

              // 本地已有更早历史时，服务端仍可能有更早的 → hasMore 不能只看服务端这一页
              const serverHasMore = Array.isArray(res)
                ? serverList.length >= PAGE_SIZE
                : Boolean(res && res.hasMore);

              return {
                messagesByProject: { ...s.messagesByProject, [projectId]: merged },
                hasMoreByProject: { ...s.hasMoreByProject, [projectId]: serverHasMore || olderLocal.length > 0 },
              };
            });
          } catch (err) {
            // 后台对齐失败：保留缓存展示，不打断用户
          }
        }
        await get().markRead(projectId);
      },

      // 强制重新拉取某群最近消息（刷新按钮用）
      reloadMessages: async (projectId) => {
        if (!projectId) return;
        set((s) => ({ loadingMessages: { ...s.loadingMessages, [projectId]: true } }));
        try {
          const res = await apiClient.getChatMessages(projectId, { limit: PAGE_SIZE });
          const messages = Array.isArray(res) ? res : ((res && res.messages) || []);
          const hasMore = Array.isArray(res) ? messages.length >= PAGE_SIZE : Boolean(res && res.hasMore);
          set((s) => ({
            messagesByProject: { ...s.messagesByProject, [projectId]: sortByTime(messages) },
            hasMoreByProject: { ...s.hasMoreByProject, [projectId]: hasMore },
            loadingMessages: { ...s.loadingMessages, [projectId]: false },
          }));
        } catch (err) {
          set((s) => ({ loadingMessages: { ...s.loadingMessages, [projectId]: false } }));
        }
      },

      closeProject: () => set({ activeProjectId: null }),

      // ---- 上拉加载更早的消息 ----
      loadMore: async (projectId) => {
        if (!projectId) return;
        if (get().loadingMessages[projectId]) return;
        if (!get().hasMoreByProject[projectId]) return;
        const existing = get().messagesByProject[projectId] || [];
        const before = existing.length ? existing[0].createdAt : undefined;
        set((s) => ({ loadingMessages: { ...s.loadingMessages, [projectId]: true } }));
        try {
          const res = await apiClient.getChatMessages(projectId, { before, limit: PAGE_SIZE });
          const older = Array.isArray(res) ? res : ((res && res.messages) || []);
          const hasMore = Array.isArray(res) ? older.length >= PAGE_SIZE : Boolean(res && res.hasMore);
          set((s) => {
            const prev = s.messagesByProject[projectId] || [];
            const merged = sortByTime(dedupeById([...older, ...prev]));
            return {
              messagesByProject: { ...s.messagesByProject, [projectId]: merged },
              hasMoreByProject: { ...s.hasMoreByProject, [projectId]: hasMore },
              loadingMessages: { ...s.loadingMessages, [projectId]: false },
            };
          });
        } catch (err) {
          set((s) => ({ loadingMessages: { ...s.loadingMessages, [projectId]: false } }));
        }
      },

      // ---- 发送消息（乐观插入 + 服务端回执去重）----
      sendMessage: async (projectId, content, mentions = [], replyTo = null) => {
        const text = (content || '').trim();
        if (!text) return null;
        const message = await apiClient.sendChatMessage(projectId, {
          content: text,
          mentions,
          replyToId: replyTo ? replyTo.id : undefined,
        });
        set((s) => {
          const prev = s.messagesByProject[projectId] || [];
          if (prev.some((m) => m.id === message.id)) return {};
          return { messagesByProject: { ...s.messagesByProject, [projectId]: sortByTime([...prev, message]) } };
        });
        get().upsertConversationPreview(message);
        return message;
      },

      // ---- 标记已读：本地清零 + 通知后端 ----
      markRead: async (projectId) => {
        if (!projectId) return;
        const lastReadAt = new Date().toISOString();
        set((s) => {
          const unreadByProject = { ...s.unreadByProject };
          const cleared = unreadByProject[projectId] || 0;
          delete unreadByProject[projectId];
          const mentionByProject = { ...s.mentionByProject };
          delete mentionByProject[projectId];
          return {
            unreadByProject,
            mentionByProject,
            unreadTotal: Math.max(0, (s.unreadTotal || 0) - cleared),
          };
        });
        try {
          await apiClient.markChatRead(projectId, lastReadAt);
        } catch (err) {
          // 已读上报失败不影响前端显示，下次进入会话会再次标记
        }
      },

      // ---- V2 单聊：拉取会话列表 ----
      fetchDirectConversations: async () => {
        try {
          const list = await apiClient.getDirectConversations();
          set({ directConversations: Array.isArray(list) ? list : [] });
        } catch (err) {
          // 单聊列表加载失败静默处理
        }
      },

      // ---- V2 单聊：打开会话（复合 key；无缓存拉 50 条；有缓存秒显 + 后台对齐合并）----
      openPeer: async (peerId, projectId = null) => {
        if (!peerId) return;
        const key = peerKey(peerId, projectId);
        set({ activePeerId: peerId, activePeerProjectId: projectId });
        const cached = get().messagesByPeer[key];
        if (!cached) {
          set((s) => ({ loadingByPeer: { ...s.loadingByPeer, [key]: true } }));
          try {
            const res = await apiClient.getDirectMessages(peerId, { limit: PAGE_SIZE, project: projectId });
            const messages = Array.isArray(res) ? res : ((res && res.messages) || []);
            const hasMore = Array.isArray(res) ? messages.length >= PAGE_SIZE : Boolean(res && res.hasMore);
            set((s) => ({
              messagesByPeer: { ...s.messagesByPeer, [key]: sortByTime(messages) },
              hasMoreByPeer: { ...s.hasMoreByPeer, [key]: hasMore },
              loadingByPeer: { ...s.loadingByPeer, [key]: false },
            }));
          } catch (err) {
            set((s) => ({ loadingByPeer: { ...s.loadingByPeer, [key]: false } }));
          }
        } else {
          try {
            const res = await apiClient.getDirectMessages(peerId, { limit: PAGE_SIZE, project: projectId });
            const serverList = sortByTime(Array.isArray(res) ? res : ((res && res.messages) || []));
            set((s) => {
              const local = s.messagesByPeer[key] || [];
              const serverIds = new Set(serverList.map((m) => m.id));
              const firstServerTime = serverList.length ? new Date(serverList[0].createdAt).getTime() : Infinity;
              const lastServerTime = serverList.length ? new Date(serverList[serverList.length - 1].createdAt).getTime() : 0;

              const inFlight = local.filter(
                (m) => m && m.id && !serverIds.has(m.id) && new Date(m.createdAt).getTime() > lastServerTime
              );
              const olderLocal = serverList.length
                ? local.filter(
                    (m) => m && m.id && !serverIds.has(m.id) && new Date(m.createdAt).getTime() < firstServerTime
                  )
                : [];

              const merged = sortByTime([...serverList, ...inFlight, ...olderLocal]);

              const serverHasMore = Array.isArray(res)
                ? serverList.length >= PAGE_SIZE
                : Boolean(res && res.hasMore);

              return {
                messagesByPeer: { ...s.messagesByPeer, [key]: merged },
                hasMoreByPeer: { ...s.hasMoreByPeer, [key]: serverHasMore || olderLocal.length > 0 },
              };
            });
          } catch (err) {
            // 后台对齐失败：保留缓存展示，不打断用户
          }
        }
        await get().markDirectRead(peerId, projectId);
      },

      closePeer: () => set({ activePeerId: null, activePeerProjectId: null }),

      // ---- V2 单聊：上拉加载更早的消息（复合 key）----
      loadMoreDirect: async (peerId, projectId = null) => {
        if (!peerId) return;
        const key = peerKey(peerId, projectId);
        if (get().loadingByPeer[key]) return;
        if (!get().hasMoreByPeer[key]) return;
        const existing = get().messagesByPeer[key] || [];
        const before = existing.length ? existing[0].createdAt : undefined;
        set((s) => ({ loadingByPeer: { ...s.loadingByPeer, [key]: true } }));
        try {
          const res = await apiClient.getDirectMessages(peerId, { before, limit: PAGE_SIZE, project: projectId });
          const older = Array.isArray(res) ? res : ((res && res.messages) || []);
          const hasMore = Array.isArray(res) ? older.length >= PAGE_SIZE : Boolean(res && res.hasMore);
          set((s) => {
            const prev = s.messagesByPeer[key] || [];
            const merged = sortByTime(dedupeById([...older, ...prev]));
            return {
              messagesByPeer: { ...s.messagesByPeer, [key]: merged },
              hasMoreByPeer: { ...s.hasMoreByPeer, [key]: hasMore },
              loadingByPeer: { ...s.loadingByPeer, [key]: false },
            };
          });
        } catch (err) {
          set((s) => ({ loadingByPeer: { ...s.loadingByPeer, [key]: false } }));
        }
      },

      // ---- V2 单聊：发送（乐观插入 + 去重，带 projectId）----
      sendDirect: async (peerId, content, replyTo = null, projectId = null) => {
        const text = (content || '').trim();
        if (!text) return null;
        const message = await apiClient.sendDirectMessage(peerId, {
          content: text,
          replyToId: replyTo ? replyTo.id : undefined,
          projectId,
        });
        // 服务端返回的消息带 projectId；优先用消息自带维度定位复合 key
        const mProj = message && message.projectId != null ? message.projectId : projectId;
        const key = peerKey(peerId, mProj);
        set((s) => {
          const prev = s.messagesByPeer[key] || [];
          if (prev.some((m) => m.id === message.id)) return {};
          return { messagesByPeer: { ...s.messagesByPeer, [key]: sortByTime([...prev, message]) } };
        });
        get().upsertDirectPreview(message);
        return message;
      },

      // ---- V2 单聊：标记已读（本地清零 + 上报，游标按三元组；不动群维度）----
      markDirectRead: async (peerId, projectId = null) => {
        if (!peerId) return;
        const key = peerKey(peerId, projectId);
        const lastReadAt = new Date().toISOString();
        set((s) => {
          const unreadByPeer = { ...s.unreadByPeer };
          const cleared = unreadByPeer[key] || 0;
          delete unreadByPeer[key];
          // 同步扣减项目维度派生视图（项目内多 peer 时只扣本 peer 的 cleared）
          const unreadByProjectDirect = { ...s.unreadByProjectDirect };
          let orphanDirectUnread = s.orphanDirectUnread || 0;
          if (projectId != null) {
            const left = Math.max(0, (unreadByProjectDirect[projectId] || 0) - cleared);
            if (left > 0) unreadByProjectDirect[projectId] = left;
            else delete unreadByProjectDirect[projectId];
          } else {
            orphanDirectUnread = Math.max(0, orphanDirectUnread - cleared);
          }
          return {
            unreadByPeer,
            unreadByProjectDirect,
            orphanDirectUnread,
            directTotal: Math.max(0, (s.directTotal || 0) - cleared),
            unreadTotal: Math.max(0, (s.unreadTotal || 0) - cleared),
          };
        });
        try {
          await apiClient.markDirectRead(peerId, lastReadAt, projectId);
        } catch (err) {
          // 已读上报失败不影响前端显示
        }
      },

      // ---- V2 单聊：撤回（发送者本人或 admin）----
      recallDirect: async (messageId) => {
        const updated = await apiClient.recallDirectMessage(messageId);
        if (updated && updated.fromId) {
          const me = useAuthStore.getState().currentUserId;
          const peerId = String(updated.fromId) === String(me)
            ? updated.toId
            : updated.fromId;
          const pProj = updated.projectId == null ? null : updated.projectId;
          const key = peerKey(peerId, pProj);
          set((s) => {
            const prev = s.messagesByPeer[key] || [];
            return {
              messagesByPeer: {
                ...s.messagesByPeer,
                [key]: prev.map((m) => (m.id === updated.id ? updated : m)),
              },
            };
          });
          get().upsertDirectPreview(updated);
        }
        return updated;
      },

      // ---- V2 单聊：SSE 到达（入库 + 摘要 + 未读 +1，非当前会话且非自己发送；带 projectId）----
      receiveDirect: (message) => {
        if (!message || !message.id) return;
        const me = useAuthStore.getState().currentUserId;
        const peerId = String(message.fromId) === String(me) ? message.toId : message.fromId;
        const pProj = message.projectId == null ? null : message.projectId;
        const key = peerKey(peerId, pProj);
        set((s) => {
          const prev = s.messagesByPeer[key] || [];
          const already = prev.some((m) => m.id === message.id);
          const messagesByPeer = already
            ? s.messagesByPeer
            : { ...s.messagesByPeer, [key]: sortByTime([...prev, message]) };

          const isMine = String(message.fromId) === String(me);
          // 当前会话 = activePeerId + activePeerProjectId 二元组
          const isActive = s.activePeerId === peerId && s.activePeerProjectId === pProj;
          let unreadTotal = s.unreadTotal;
          let directTotal = s.directTotal;
          let unreadByPeer = s.unreadByPeer;
          let unreadByProjectDirect = s.unreadByProjectDirect;
          let orphanDirectUnread = s.orphanDirectUnread || 0;

          // me 为空（登录态未就绪）时无法判定"对方"，跳过未读计数：
          // 否则 fromId=me 的消息会被误挂到自身 key，产生消不掉的"自己"红点。
          if (me && !isMine && !isActive && !already) {
            unreadTotal = (unreadTotal || 0) + 1;
            directTotal = (directTotal || 0) + 1;
            unreadByPeer = { ...unreadByPeer, [key]: (unreadByPeer[key] || 0) + 1 };
            if (pProj != null) {
              unreadByProjectDirect = { ...unreadByProjectDirect, [pProj]: (unreadByProjectDirect[pProj] || 0) + 1 };
            } else {
              orphanDirectUnread += 1;
            }
          }
          return { messagesByPeer, unreadTotal, directTotal, unreadByPeer, unreadByProjectDirect, orphanDirectUnread };
        });
        get().upsertDirectPreview(message);
      },

      // ---- V2 单聊：本地应用撤回（来自 SSE drecall；旧事件无 projectId 容错归 null 桶）----
      applyDirectRecall: (payload) => {
        if (!payload || !payload.id) return;
        const me = useAuthStore.getState().currentUserId;
        const peerId = String(payload.fromId) === String(me) ? payload.toId : payload.fromId;
        const pProj = payload.projectId == null ? null : payload.projectId;
        const key = peerKey(peerId, pProj);
        set((s) => {
          const prev = s.messagesByPeer[key];
          if (!prev) return {};
          let changed = false;
          const next = prev.map((m) => {
            if (m.id !== payload.id || m.recalled) return m;
            changed = true;
            return { ...m, recalled: true, content: '' };
          });
          if (!changed) return {};
          return { messagesByPeer: { ...s.messagesByPeer, [key]: next } };
        });
      },

      // ---- V2 单聊：更新会话列表「最后一条消息」（按 peerId + projectId 复合定位）----
      upsertDirectPreview: (message) => {
        if (!message || !message.fromId || !message.toId) return;
        const me = useAuthStore.getState().currentUserId;
        const peerId = String(message.fromId) === String(me) ? message.toId : message.fromId;
        const pProj = message.projectId == null ? null : message.projectId;
        set((s) => {
          const idx = s.directConversations.findIndex(
            (c) => c.peerId === peerId && c.projectId === pProj
          );
          if (idx < 0) {
            // 列表尚未加载该会话：仅保证下次拉取会有，不在此造数据
            return {};
          }
          const list = [...s.directConversations];
          list[idx] = { ...list[idx], lastMessage: message, lastMessageAt: message.createdAt };
          list.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
          return { directConversations: list };
        });
      },

      // ---- 撤回消息 ----
      recallMessage: async (messageId) => {
        const updated = await apiClient.recallChatMessage(messageId);
        if (updated && updated.projectId) {
          set((s) => {
            const prev = s.messagesByProject[updated.projectId] || [];
            return {
              messagesByProject: {
                ...s.messagesByProject,
                [updated.projectId]: prev.map((m) => (m.id === updated.id ? updated : m)),
              },
            };
          });
          get().upsertConversationPreview(updated);
        }
        return updated;
      },

      // ---- 本地应用撤回（来自 SSE recall 事件）----
      applyRecallLocal: (projectId, messageId) => {
        set((s) => {
          const prev = s.messagesByProject[projectId];
          if (!prev) return {};
          let changed = false;
          const next = prev.map((m) => {
            if (m.id !== messageId || m.recalled) return m;
            changed = true;
            return { ...m, recalled: true, content: '', mentions: [] };
          });
          if (!changed) return {};
          return { messagesByProject: { ...s.messagesByProject, [projectId]: next } };
        });
      },

      // ---- SSE 到达：入库 + 更新会话摘要 + 未读 +1（非当前会话且非自己发送）----
      receiveMessage: (message) => {
        if (!message || !message.id) return;
        const me = useAuthStore.getState().currentUserId;
        const projectId = message.projectId;
        set((s) => {
          const prev = s.messagesByProject[projectId] || [];
          const already = prev.some((m) => m.id === message.id);
          const messagesByProject = already
            ? s.messagesByProject
            : { ...s.messagesByProject, [projectId]: sortByTime([...prev, message]) };

          const isMine = message.senderId === me;
          const isActive = s.activeProjectId === projectId;
          let unreadTotal = s.unreadTotal;
          let unreadByProject = s.unreadByProject;
          let mentionByProject = s.mentionByProject;

          if (!isMine && !isActive && !already) {
            unreadTotal = (unreadTotal || 0) + 1;
            unreadByProject = { ...unreadByProject, [projectId]: (unreadByProject[projectId] || 0) + 1 };
            const mentioned = Array.isArray(message.mentions) && message.mentions.includes(me);
            if (mentioned) {
              mentionByProject = { ...mentionByProject, [projectId]: (mentionByProject[projectId] || 0) + 1 };
            }
          }

          return { messagesByProject, unreadTotal, unreadByProject, mentionByProject };
        });
        get().upsertConversationPreview(message);
      },

      // ---- 更新会话列表中的「最后一条消息」并重排序 ----
      upsertConversationPreview: (message) => {
        if (!message || !message.projectId) return;
        set((s) => {
          const idx = s.conversations.findIndex((c) => c.projectId === message.projectId);
          if (idx < 0) return {};
          const list = [...s.conversations];
          list[idx] = { ...list[idx], lastMessage: message, lastMessageAt: message.createdAt };
          list.sort(
            (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
          );
          return { conversations: list };
        });
      },

      // ---- 切换账号 / 登出：清空运行时状态（保留 settings）----
      refreshActiveUser: () =>
        set({
          conversations: [],
          conversationsLoading: false,
          conversationsError: null,
          messagesByProject: {},
          hasMoreByProject: {},
          loadingMessages: {},
          activeProjectId: null,
          unreadTotal: 0,
          unreadByProject: {},
          mentionByProject: {},
          unreadByProjectDirect: {},
          orphanDirectUnread: 0,
          // V2 单聊字段全部重置
          directConversations: [],
          messagesByPeer: {},
          hasMoreByPeer: {},
          loadingByPeer: {},
          unreadByPeer: {},
          directTotal: 0,
          activePeerId: null,
          activePeerProjectId: null,
          sseConnected: false,
        }),
    }),
    {
      name: 'pw_chat',
      storage: createJSONStorage(() => localStorage),
      // 仅持久化设置项；消息与会话不落 localStorage
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
