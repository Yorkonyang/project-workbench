/**
 * 纯 Node.js 实现的 API 服务器（无需外部依赖）
 * 使用 built-in 模块：http, fs, path
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const qingflow = require('./qingflow');
const ac = require('./accessControl');
const sso = require('./auth');
const hierarchy = require('./hierarchy');
const chat = require('./chat');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/workbench.db');
const DB_DIR = path.dirname(DB_PATH);

// 确保数据目录存在
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// 初始化数据库文件
if (!fs.existsSync(DB_PATH)) {
    const initialData = {
        projects: [],
        tasks: [],
        todos: [],
        members: [],
        documents: [],
        notifications: [],
        risks: [],
        resources: [],
        milestones: [],
        projectTypes: [
            { id: 'pt-software', name: '软件开发', description: '软件开发类项目', sortOrder: 1, created_at: new Date().toISOString() },
            { id: 'pt-hardware', name: '硬件研发', description: '硬件研发类项目', sortOrder: 2, created_at: new Date().toISOString() },
            { id: 'pt-infrastructure', name: '基础设施建设', description: '基础设施建设项目', sortOrder: 3, created_at: new Date().toISOString() },
            { id: 'pt-consulting', name: '管理咨询', description: '管理咨询类项目', sortOrder: 4, created_at: new Date().toISOString() },
            { id: 'pt-manufacturing', name: '生产制造', description: '生产制造类项目', sortOrder: 5, created_at: new Date().toISOString() },
            { id: 'pt-other', name: '其他', description: '其他类型项目', sortOrder: 99, created_at: new Date().toISOString() },
        ],
        projectStages: [
            // 软件开发
            { id: 'ps-sw-01', name: '需求调研', projectTypeId: 'pt-software', sortOrder: 1, created_at: new Date().toISOString() },
            { id: 'ps-sw-02', name: '方案设计', projectTypeId: 'pt-software', sortOrder: 2, created_at: new Date().toISOString() },
            { id: 'ps-sw-03', name: '一期开发', projectTypeId: 'pt-software', sortOrder: 3, created_at: new Date().toISOString() },
            { id: 'ps-sw-04', name: '二期开发', projectTypeId: 'pt-software', sortOrder: 4, created_at: new Date().toISOString() },
            { id: 'ps-sw-05', name: '测试上线', projectTypeId: 'pt-software', sortOrder: 5, created_at: new Date().toISOString() },
            { id: 'ps-sw-06', name: '运维优化', projectTypeId: 'pt-software', sortOrder: 6, created_at: new Date().toISOString() },
            // 硬件研发
            { id: 'ps-hw-01', name: '概念设计', projectTypeId: 'pt-hardware', sortOrder: 1, created_at: new Date().toISOString() },
            { id: 'ps-hw-02', name: '工程验证', projectTypeId: 'pt-hardware', sortOrder: 2, created_at: new Date().toISOString() },
            { id: 'ps-hw-03', name: '设计验证', projectTypeId: 'pt-hardware', sortOrder: 3, created_at: new Date().toISOString() },
            { id: 'ps-hw-04', name: '小批量试产', projectTypeId: 'pt-hardware', sortOrder: 4, created_at: new Date().toISOString() },
            { id: 'ps-hw-05', name: '量产验证', projectTypeId: 'pt-hardware', sortOrder: 5, created_at: new Date().toISOString() },
            // 基础设施建设
            { id: 'ps-in-01', name: '立项评估', projectTypeId: 'pt-infrastructure', sortOrder: 1, created_at: new Date().toISOString() },
            { id: 'ps-in-02', name: '规划设计', projectTypeId: 'pt-infrastructure', sortOrder: 2, created_at: new Date().toISOString() },
            { id: 'ps-in-03', name: '招标采购', projectTypeId: 'pt-infrastructure', sortOrder: 3, created_at: new Date().toISOString() },
            { id: 'ps-in-04', name: '施工建设', projectTypeId: 'pt-infrastructure', sortOrder: 4, created_at: new Date().toISOString() },
            { id: 'ps-in-05', name: '竣工验收', projectTypeId: 'pt-infrastructure', sortOrder: 5, created_at: new Date().toISOString() },
            // 管理咨询
            { id: 'ps-co-01', name: '现状诊断', projectTypeId: 'pt-consulting', sortOrder: 1, created_at: new Date().toISOString() },
            { id: 'ps-co-02', name: '方案设计', projectTypeId: 'pt-consulting', sortOrder: 2, created_at: new Date().toISOString() },
            { id: 'ps-co-03', name: '实施辅导', projectTypeId: 'pt-consulting', sortOrder: 3, created_at: new Date().toISOString() },
            { id: 'ps-co-04', name: '总结验收', projectTypeId: 'pt-consulting', sortOrder: 4, created_at: new Date().toISOString() },
            // 生产制造
            { id: 'ps-mf-01', name: '工艺规划', projectTypeId: 'pt-manufacturing', sortOrder: 1, created_at: new Date().toISOString() },
            { id: 'ps-mf-02', name: '设备采购', projectTypeId: 'pt-manufacturing', sortOrder: 2, created_at: new Date().toISOString() },
            { id: 'ps-mf-03', name: '安装调试', projectTypeId: 'pt-manufacturing', sortOrder: 3, created_at: new Date().toISOString() },
            { id: 'ps-mf-04', name: '试生产', projectTypeId: 'pt-manufacturing', sortOrder: 4, created_at: new Date().toISOString() },
            { id: 'ps-mf-05', name: '正式投产', projectTypeId: 'pt-manufacturing', sortOrder: 5, created_at: new Date().toISOString() },
            // 其他
            { id: 'ps-ot-01', name: '待启动', projectTypeId: 'pt-other', sortOrder: 1, created_at: new Date().toISOString() },
            { id: 'ps-ot-02', name: '进行中', projectTypeId: 'pt-other', sortOrder: 2, created_at: new Date().toISOString() },
            { id: 'ps-ot-03', name: '已完成', projectTypeId: 'pt-other', sortOrder: 3, created_at: new Date().toISOString() },
        ],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    console.log('数据库初始化完成:', DB_PATH);
}

// 加载数据
function loadData() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(data);
        // 兼容旧数据库：补全缺失字段
        if (!parsed.risks) parsed.risks = [];
        if (!parsed.resources) parsed.resources = [];
        if (!parsed.milestones) parsed.milestones = [];
        if (!parsed.projectTypes) parsed.projectTypes = [];
        if (!parsed.projectStages) parsed.projectStages = [];
        if (!parsed.projectMerges) parsed.projectMerges = [];
        if (!parsed.chatMessages) parsed.chatMessages = [];
        if (!parsed.chatReads) parsed.chatReads = [];
        // V2 单聊集合兼容补全（仅默认值，chat.js 内也有兜底）
        if (!parsed.chatDirectMessages) parsed.chatDirectMessages = [];
        if (!parsed.chatDirectReads) parsed.chatDirectReads = [];
        return parsed;
    } catch (err) {
        return { projects: [], tasks: [], todos: [], members: [], documents: [], notifications: [], risks: [], resources: [], milestones: [], projectMerges: [] };
    }
}

// 保存数据
function saveData(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// 生成唯一ID
function generateId() {
    return crypto.randomUUID();
}

/**
 * 计算下一个排序号：取当前最大排序号 + 1（新记录统一追加到末尾）
 * @param {Array} items 记录列表
 * @returns {number} 最大排序号 + 1
 */
function nextSortOrder(items) {
    const max = (items || []).reduce((m, i) => Math.max(m, i.sortOrder || 0), 0);
    return max + 1;
}

// 登录限流（修补④）：按 IP 滑动窗口，每分钟最多 5 次尝试
const LOGIN_RATE_LIMIT = { windowMs: 60 * 1000, max: 5 };
const loginAttempts = new Map(); // ip → { count, resetAt }
function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
}
function checkLoginRateLimit(ip) {
    const now = Date.now();
    let entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + LOGIN_RATE_LIMIT.windowMs };
        loginAttempts.set(ip, entry);
    }
    entry.count += 1;
    // 定期清理过期记录，避免 Map 无限增长
    if (loginAttempts.size > 1000) {
        for (const [k, v] of loginAttempts) if (now > v.resetAt) loginAttempts.delete(k);
    }
    return entry.count <= LOGIN_RATE_LIMIT.max;
}

// 解析请求体
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                resolve({ __tooLarge: true });
                req.destroy();
                return;
            }
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

// 修补⑥：CORS 收紧。
// 同源部署（vite 代理 /api）下无 Origin 头，浏览器默认放行；跨域部署时按 ALLOWED_ORIGIN
// 白名单（逗号分隔，可用环境变量配置）回显 Origin 并开启 credentials，否则拒绝。
// 不再用 '*' —— 与 HttpOnly 会话 cookie 配合时 '*' 会导致 cookie 不被发送。
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || process.env.VITE_API_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// 当前处理中的请求（Node 单线程事件循环内安全，便于 sendResponse 取 Origin 而无需改动 165 处调用）
let currentReq = null;

function corsHeadersFor(req) {
    const origin = req && req.headers ? req.headers.origin : null;
    const allowOrigin = origin && ALLOWED_ORIGINS.length > 0 ? (ALLOWED_ORIGINS.includes(origin) ? origin : null) : (origin || null);
    const headers = {
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, X-Workbench',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
    if (allowOrigin) {
        headers['Access-Control-Allow-Origin'] = allowOrigin;
        headers['Access-Control-Allow-Credentials'] = 'true';
    }
    return { headers, rejected: Boolean(origin) && !allowOrigin };
}

// 发送响应（CORS 头按 currentReq 的 Origin 动态计算）
function sendResponse(res, statusCode, data) {
    const { headers } = corsHeadersFor(currentReq);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...headers,
    });
    res.end(JSON.stringify(data));
}

// 处理 OPTIONS 预检请求
function handleOptions(res) {
    const { headers, rejected } = corsHeadersFor(currentReq);
    res.writeHead(rejected ? 403 : 200, {
        ...(rejected ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
    });
    res.end(rejected ? '' : '{}');
}

// ==================== 路由处理 ====================

const server = http.createServer(async (req, res) => {
    currentReq = req; // 修补⑥：供 sendResponse/handleOptions 动态计算 CORS 头
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const method = req.method;

    // CORS 预检
    if (method === 'OPTIONS') {
        handleOptions(res);
        return;
    }

    // 修补（S5）：CSRF 纵深防御 —— 写请求必须携带自定义头 X-Workbench: 1。
    // 浏览器自动发起的跨站请求（<form>、<img>、无头 fetch）无法设置自定义请求头，
    // 因此缺少该头的 POST/PUT/DELETE 一律拒绝；配合 SameSite=Lax Cookie 形成双重防护。
    if (['POST', 'PUT', 'DELETE'].includes(method) && req.headers['x-workbench'] !== '1') {
        sendResponse(res, 403, { error: '请求缺少必要的校验头' });
        return;
    }

    // 健康检查
    if (pathname === '/api/health' && method === 'GET') {
        sendResponse(res, 200, {
            status: 'ok',
            timestamp: new Date().toISOString(),
            server: 'project-workbench-api',
            database: 'local'
        });
        return;
    }

    // SSO 兑换：GET /api/auth/sso?u=<email>&exp=<ts>&sig=<hmac>
    // 用签名 URL 兑换一次性登录票据（ticket），前端再凭 ticket 调 /api/auth/me 完成登录
    if (pathname === '/api/auth/sso' && method === 'GET') {
        const u = url.searchParams.get('u');
        const exp = url.searchParams.get('exp');
        const sig = url.searchParams.get('sig');

        const check = sso.verify(u, exp, sig);
        if (!check.ok) {
            sendResponse(res, 401, { error: `SSO 链接无效或已过期（${check.reason}）` });
            return;
        }

        const data = loadData();
        const member = data.members.find(m => (m.email || '').toLowerCase() === (u || '').toLowerCase());
        if (!member) {
            sendResponse(res, 404, { error: '责任人不存在' });
            return;
        }

        const { ticket, expiresAt } = sso.issueTicket(member.id, member.email);
        sendResponse(res, 200, {
            ticket,
            userId: member.id,
            email: member.email,
            name: member.name,
            role: member.role || 'member',
            expiresAt,
        });
        return;
    }

    // SSO 跳转入口（方案A/B）：GET /api/auth/sso-link?t=<ticket>&exp=<ts>&sig=<hmac>&redirect=<path>
    // 验证签名 → 签发登录态 ticket 写入 HttpOnly Cookie → 302 跳前端 /sso-callback
    // 方案 B 的预签 ticket 不在此处消费，可多次点击；待办/任务完成时由后端主动失效。
    // 前端地址栏不会出现明文邮箱 / 签名 / ticket；Cookie 为 HttpOnly，JS 不可读，SameSite=Lax 抵御 CSRF。
    if (pathname === '/api/auth/sso-link' && method === 'GET') {
        const t = url.searchParams.get('t');
        const exp = url.searchParams.get('exp');
        const sig = url.searchParams.get('sig');
        let redirect = url.searchParams.get('redirect') || '/';
        // 防开放重定向：仅允许站内相对路径（不以 // 或 @ 开头）
        if (!redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('@')) {
            redirect = '/';
        }

        let memberId, memberEmail;
        // 方案 B（推荐）：使用预签发的 ticket，URL 中不含邮箱
        if (t) {
            const check = sso.verifyTicket(t, exp, sig);
            if (!check.ok) {
                sendResponse(res, 401, { error: `SSO 链接无效（${check.reason}）` });
                return;
            }
            // 方案 B：不消费预签 ticket，责任人可多次点击；待办/任务完成时由后端主动失效
            memberId = check.entry.userId;
            memberEmail = check.entry.email;
        } else {
            // 方案 A（兼容旧通知）：基于 email 的签名
            const u = url.searchParams.get('u');
            const check = sso.verify(u, exp, sig);
            if (!check.ok) {
                sendResponse(res, 401, { error: `SSO 链接无效（${check.reason}）` });
                return;
            }
            const data = loadData();
            const member = data.members.find((m) => (m.email || '').toLowerCase() === (u || '').toLowerCase());
            if (!member) {
                sendResponse(res, 404, { error: '责任人不存在' });
                return;
            }
            memberId = member.id;
            memberEmail = member.email;
        }

        const { ticket, expiresAt } = sso.issueTicket(memberId, memberEmail);
        const maxAge = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
        res.setHeader('Set-Cookie', `sso_ticket=${ticket}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
        const frontendBase = (qingflow.getPushConfig().frontendBaseUrl || 'http://localhost:5173').replace(/\/+$/, '');
        res.writeHead(302, { Location: `${frontendBase}/sso-callback?redirect=${encodeURIComponent(redirect)}` });
        res.end();
        return;
    }

    // SSO 校验：GET /api/auth/me?ticket=<ticket> 或 读 cookie sso_ticket
    // 消费一次 SSO ticket → 建立工作区会话（workbench_session），后续请求凭 cookie 鉴权
    if (pathname === '/api/auth/me' && method === 'GET') {
        let ticket = url.searchParams.get('ticket');
        if (!ticket) {
            // 兼容 SSO 302 之后的前端调用：ticket 存于 HttpOnly cookie（方案A）
            const cookieHeader = req.headers.cookie || '';
            const m = cookieHeader.match(/(?:^|;\s*)sso_ticket=([^;]+)/);
            if (m) ticket = decodeURIComponent(m[1]);
        }
        if (!ticket) {
            sendResponse(res, 400, { error: '缺少 ticket' });
            return;
        }
        const entry = sso.consumeTicket(ticket);
        if (!entry) {
            sendResponse(res, 401, { error: 'ticket 无效或已使用' });
            return;
        }
        // 登录成功：种工作区会话 cookie（HttpOnly，客户端 JS 不可读）
        const session = sso.issueSession(entry.userId, entry.email);
        res.setHeader(
            'Set-Cookie',
            `workbench_session=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.max(
                1,
                Math.ceil((session.expiresAt - Date.now()) / 1000)
            )}`
        );
        sendResponse(res, 200, {
            userId: entry.userId,
            email: entry.email,
        });
        return;
    }

    // 登出：POST /api/auth/logout —— 清会话 cookie
    if (pathname === '/api/auth/logout' && method === 'POST') {
        const cookieHeader = req.headers.cookie || '';
        const m = cookieHeader.match(/(?:^|;\s*)workbench_session=([^;]+)/);
        if (m) sso.destroySession(decodeURIComponent(m[1]));
        res.setHeader('Set-Cookie', 'workbench_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
        sendResponse(res, 200, { success: true });
        return;
    }

    // 登录：POST /api/auth/login { email, password } → 校验成员名册 → 种会话 cookie
    if (pathname === '/api/auth/login' && method === 'POST') {
        // 修补④：按 IP 限流，每分钟最多 5 次，超限 429
        const clientIp = getClientIp(req);
        if (!checkLoginRateLimit(clientIp)) {
            sendResponse(res, 429, { error: '登录尝试过于频繁，请 1 分钟后再试' });
            return;
        }
        const body = await parseBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!email || !password) {
            sendResponse(res, 400, { error: '邮箱和密码不能为空' });
            return;
        }
        const data = loadData();
        const member = (data.members || []).find(
            (m) => (m.email || '').toLowerCase() === email && m.password === password
        );
        if (!member) {
            sendResponse(res, 401, { error: '邮箱或密码错误' });
            return;
        }
        const session = sso.issueSession(member.id, member.email);
        res.setHeader(
            'Set-Cookie',
            `workbench_session=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.max(
                1,
                Math.ceil((session.expiresAt - Date.now()) / 1000)
            )}`
        );
        sendResponse(res, 200, {
            success: true,
            userId: member.id,
            email: member.email,
            name: member.name,
            role: member.role || 'member',
        });
        return;
    }

    // 修改密码：POST /api/auth/change-password { oldPassword, newPassword }
    // 后端校验原密码 + 强制复杂度，前端不再持有/比对明文（S2）；写请求需 X-Workbench 头（S5）
    if (pathname === '/api/auth/change-password' && method === 'POST') {
        const userId = ac.getUserId(req);
        if (!userId) {
            sendResponse(res, 401, { error: '未登录' });
            return;
        }
        const body = await parseBody(req);
        const oldPassword = String(body.oldPassword || '');
        const newPassword = String(body.newPassword || '');
        // 复杂度：≥8 位，含大小写字母与数字（M4）
        if (
            newPassword.length < 8 ||
            !/[a-z]/.test(newPassword) ||
            !/[A-Z]/.test(newPassword) ||
            !/\d/.test(newPassword)
        ) {
            sendResponse(res, 400, { error: '新密码至少8位，且需包含大小写字母和数字' });
            return;
        }
        const data = loadData();
        const index = data.members.findIndex((m) => m.id === userId);
        if (index === -1) {
            sendResponse(res, 404, { error: '用户不存在' });
            return;
        }
        if (data.members[index].password !== oldPassword) {
            sendResponse(res, 401, { error: '原密码错误' });
            return;
        }
        data.members[index].password = newPassword;
        data.members[index].updated_at = new Date().toISOString();
        saveData(data);
        sendResponse(res, 200, { success: true });
        return;
    }

    // 统计数据
    if (pathname === '/api/stats' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, {
            projects: data.projects.length,
            tasks: data.tasks.length,
            todos: data.todos.length,
            members: data.members.length,
            notifications: data.notifications.length
        });
        return;
    }

    // 轻流推送配置（Q-Source）
    if (pathname === '/api/qingflow/config' && method === 'GET') {
        sendResponse(res, 200, qingflow.getPushConfig());
        return;
    }

    if (pathname === '/api/qingflow/config' && method === 'POST') {
        // P0 修复：修改轻流推送配置（含 secret 字段）仅 admin 可执行
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!ac.isAdmin(data, userId)) {
            sendResponse(res, 403, { error: '仅管理员可修改轻流推送配置' });
            return;
        }
        const body = await parseBody(req);
        qingflow.setPushConfig(body);
        sendResponse(res, 200, { success: true, message: '推送配置已更新' });
        return;
    }

    // 轻流连接测试（推送）
    if (pathname === '/api/qingflow/test' && method === 'GET') {
        // P0 修复：连接测试会实际调用第三方接口，仅 admin 可触发
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!ac.isAdmin(data, userId)) {
            sendResponse(res, 403, { error: '仅管理员可测试轻流连接' });
            return;
        }
        const result = await qingflow.testConnection();
        sendResponse(res, result.success ? 200 : 500, result);
        return;
    }

    // 轻流表单数据提交（调试用）
    if (pathname === '/api/qingflow/form-data' && method === 'POST') {
        // P0 修复：向轻流注入数据仅 admin 可执行
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!ac.isAdmin(data, userId)) {
            sendResponse(res, 403, { error: '仅管理员可提交轻流表单数据' });
            return;
        }
        const body = await parseBody(req);
        const result = await qingflow.addFormData(body);
        sendResponse(res, result.errCode === 0 ? 200 : 400, result);
        return;
    }

    // ===== 轻流同步配置（开放平台 OAuth） =====
    if (pathname === '/api/qingflow/sync-config' && method === 'GET') {
        sendResponse(res, 200, qingflow.getSyncConfig());
        return;
    }

    if (pathname === '/api/qingflow/sync-config' && method === 'POST') {
        // P0 修复：修改轻流同步配置（含 client_secret）仅 admin 可执行
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!ac.isAdmin(data, userId)) {
            sendResponse(res, 403, { error: '仅管理员可修改轻流同步配置' });
            return;
        }
        const body = await parseBody(req);
        qingflow.setSyncConfig(body);
        sendResponse(res, 200, { success: true, message: '同步配置已更新' });
        return;
    }

    // Projects API
    // 仅匹配 列表(GET /api/projects) 或 单项目详情(GET /api/projects/:id)（≤3 段）
    // 4 段子路径（/merge-preview、/merge、/subtree、/children 等）交给后面专门路由
    if ((pathname === '/api/projects' || pathname.match(/^\/api\/projects\/[\w-]+$/)) && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const projectId = pathname.match(/\/api\/projects\/([^\/]+)/)?.[1];
        if (projectId) {
            // 项目详情仅所有者/admin 可见（强隔离：成员看不到他人项目）
            if (!ac.canManageProject(data, userId, projectId)) {
                sendResponse(res, 403, { error: '无权访问该项目' });
                return;
            }
            const tasks = data.tasks.filter(t => t.projectId === projectId || t.project_id === projectId);
            sendResponse(res, 200, { project: data.projects.find(p => p.id === projectId), tasks });
        } else {
            // GET /api/projects?parentId=<pid|__root__>&includeMerged=0|1
            // parentId=__root__ 或省略 → 仅根项目；includeMerged=1 不过滤已合并项
            const parentId = url.searchParams.get('parentId');
            const includeMerged = url.searchParams.get('includeMerged') === '1';
            let list = ac.visibleProjects(data, userId);
            if (!includeMerged) {
                list = list.filter((p) => !p.mergedInto);
            }
            if (parentId !== null) {
                const wantRoot = parentId === '__root__' || parentId === '';
                list = list.filter((p) => {
                    const par = hierarchy.normalizeParent(p.parentProjectId);
                    if (wantRoot) return par === null;
                    return par === parentId;
                });
            }
            sendResponse(res, 200, list);
        }
        return;
    }

    // 创建项目 - POST /api/projects（严格匹配，不包括子路径）
    if (pathname === '/api/projects' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const project = {
            ...body,
            id: generateId(),
            ownerId: userId || body.ownerId || null,   // 创建者自动成为所有者（项目负责制）
            status: body.status || 'active',
            archived: body.archived ? 1 : 0,
            archiveStatus: body.archiveStatus || 'none',
            archiveReason: body.archiveReason || '',
            archiveNote: body.archiveNote || '',
            archivedAt: body.archivedAt || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.projects.push(project);
        saveData(data);
        sendResponse(res, 201, project);
        return;
    }

    // 归档申请 - POST /api/projects/:id/archive
    if (pathname.match(/\/api\/projects\/[\w-]+\/archive$/) && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archiveStatus = 'requested';
            data.projects[index].archiveReason = body.reason || '';
            data.projects[index].archiveNote = body.note || '';
            data.projects[index].updated_at = new Date().toISOString();
            saveData(data);
            sendResponse(res, 200, data.projects[index]);
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // 审批通过 - POST /api/projects/:id/approve-archive
    if (pathname.match(/\/api\/projects\/[\w-]+\/approve-archive$/) && method === 'POST') {
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archiveStatus = 'approved';
            data.projects[index].archived = 1;
            data.projects[index].status = 'archived';
            data.projects[index].archivedAt = new Date().toISOString();
            data.projects[index].updated_at = new Date().toISOString();
            // 级联更新任务状态
            let tasksUpdated = 0;
            data.tasks.forEach(t => {
                if (t.projectId === id || t.project_id === id) {
                    t.status = 'archived';
                    t.archivedAt = new Date().toISOString();
                    tasksUpdated++;
                }
            });
            saveData(data);
            // 推送轻流通知给项目所有者/负责人（不阻塞，失败仅记日志）
            qingflow.notifyProjectArchived({
                project: data.projects[index],
                tasksUpdated,
            }).catch((e) => console.warn('[轻流推送] 归档通知失败:', e.message));
            sendResponse(res, 200, { project: data.projects[index], tasksUpdated });
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // 直接归档（项目负责人一键归档，无需审批）- POST /api/projects/:id/archive-direct
    if (pathname.match(/\/api\/projects\/[\w-]+\/archive-direct$/) && method === 'POST') {
        const data = loadData();
        const id = pathname.split('/')[3];
        const userId = ac.getUserId(req, url);
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            if (!ac.canArchiveProject(data, userId, id)) {
                sendResponse(res, 403, { error: '无权归档该项目' });
                return;
            }
            data.projects[index].archiveStatus = 'approved';
            data.projects[index].archived = 1;
            data.projects[index].status = 'archived';
            data.projects[index].archivedAt = new Date().toISOString();
            data.projects[index].updated_at = new Date().toISOString();
            // 级联更新任务状态
            let tasksUpdated = 0;
            data.tasks.forEach(t => {
                if (t.projectId === id || t.project_id === id) {
                    t.status = 'archived';
                    t.archivedAt = new Date().toISOString();
                    tasksUpdated++;
                }
            });
            saveData(data);
            // 推送轻流通知给项目所有者/负责人（不阻塞，失败仅记日志）
            qingflow.notifyProjectArchived({
                project: data.projects[index],
                tasksUpdated,
            }).catch((e) => console.warn('[轻流推送] 归档通知失败:', e.message));
            sendResponse(res, 200, { project: data.projects[index], tasksUpdated });
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // 驳回申请 - POST /api/projects/:id/reject-archive
    if (pathname.match(/\/api\/projects\/[\w-]+\/reject-archive$/) && method === 'POST') {
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archiveStatus = 'rejected';
            data.projects[index].updated_at = new Date().toISOString();
            saveData(data);
            sendResponse(res, 200, data.projects[index]);
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // 恢复项目 - POST /api/projects/:id/restore
    if (pathname.match(/\/api\/projects\/[\w-]+\/restore$/) && method === 'POST') {
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archived = 0;
            data.projects[index].status = 'active';
            data.projects[index].archiveStatus = 'none';
            data.projects[index].updated_at = new Date().toISOString();
            // 级联恢复任务状态
            let tasksRestored = 0;
            data.tasks.forEach(t => {
                if ((t.projectId === id || t.project_id === id) && t.status === 'archived') {
                    t.status = 'todo';
                    t.archivedAt = null;
                    tasksRestored++;
                }
            });
            saveData(data);
            sendResponse(res, 200, { project: data.projects[index], tasksRestored });
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // ===== 合并预览（只读，不落库）GET /api/projects/:id/merge-preview?targetId=<tid> =====
    if (pathname.match(/^\/api\/projects\/[\w-]+\/merge-preview$/) && method === 'GET') {
        const id = pathname.split('/')[3];
        const targetId = url.searchParams.get('targetId');
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const respond = (status, payload) => {
            if (status >= 400) {
                sendResponse(res, status, { ok: false, error: payload.error || payload });
            } else {
                sendResponse(res, status, { ok: true, ...payload });
            }
            return true;
        };
        const source = data.projects.find(p => p.id === id);
        const target = data.projects.find(p => p.id === targetId);
        if (!source) return respond(404, { error: '源项目不存在' });
        if (!target) return respond(404, { error: '目标项目不存在' });
        if (!ac.canManageProject(data, userId, id)) return respond(403, { error: '无权操作源项目' });
        if (source.id === target.id) return respond(409, { error: '不能合并到自身' });
        if (source.archived === 1) return respond(409, { error: '源项目已归档，不能合并' });
        if (source.mergedInto) return respond(409, { error: '源项目已合并，不能再次合并' });
        if (target.archived === 1) return respond(409, { error: '目标项目已归档，不能合并到它' });
        // 防环：target 不能是 source（含其子项目）的后代
        if (hierarchy.wouldCreateCycle(data.projects, source.id, target.id)) {
            return respond(409, { error: '合并会形成环（目标为源的子项目）' });
        }
        const counts = {
            tasks: data.tasks.filter(t => (t.projectId || t.project_id) === source.id).length,
            todos: data.todos.filter(t => t.projectId === source.id).length,
            documents: data.documents.filter(d => d.projectId === source.id).length,
            milestones: data.milestones.filter(m => m.projectId === source.id).length,
            risks: data.risks.filter(r => r.projectId === source.id).length,
            resources: data.resources.filter(r => r.projectId === source.id).length,
            childProjects: hierarchy.getChildren(data.projects, source.id).length,
        };
        const childProjects = hierarchy.getChildren(data.projects, source.id)
            .map(p => ({ id: p.id, name: p.name, code: p.code }));
        // 深度超限判定：keep 策略下直属子项目改挂到 target 后是否 > MAX_DEPTH
        const targetLevel = hierarchy.getLevel(data.projects, target.id);
        const depthExceeded = hierarchy.getChildren(data.projects, source.id)
            .some(c => targetLevel + 1 > hierarchy.MAX_DEPTH);
        const codeCollision = !!source.code && (target.code === source.code || (target.subtreeCodes || []).includes(source.code));
        respond(200, {
            sourceId: source.id,
            targetId: target.id,
            counts,
            wouldCreateCycle: false,
            depthExceeded,
            codeCollision,
            childProjects,
        });
        return;
    }

    // ===== 执行合并（原子写）POST /api/projects/:id/merge =====
    if (pathname.match(/^\/api\/projects\/[\w-]+\/merge$/) && method === 'POST') {
        const id = pathname.split('/')[3];
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const respond = (status, payload) => {
            if (status >= 400) {
                sendResponse(res, status, { success: false, error: payload.error || payload });
            } else {
                sendResponse(res, status, { success: true, ...payload });
            }
            return true;
        };
        const source = data.projects.find(p => p.id === id);
        const targetId = body.targetId;
        const target = data.projects.find(p => p.id === targetId);
        if (!source) return respond(404, { error: '源项目不存在' });
        if (!target) return respond(404, { error: '目标项目不存在' });
        if (!ac.canManageProject(data, userId, id)) return respond(403, { error: '无权操作源项目' });
        if (source.id === target.id) return respond(409, { error: '不能合并到自身' });
        if (source.archived === 1) return respond(409, { error: '源项目已归档，不能合并' });
        if (source.mergedInto) return respond(409, { error: '源项目已合并，不能再次合并' });
        if (target.archived === 1) return respond(409, { error: '目标项目已归档，不能合并到它' });
        if (hierarchy.wouldCreateCycle(data.projects, source.id, target.id)) {
            return respond(409, { error: '合并会形成环（目标为源的子项目）' });
        }
        const strategy = body.strategy === 'flatten' ? 'flatten' : 'keep';

        // 0) 先统计源项目自身关联实体的数量（repoint 之后无法再按 source.id 统计）
        const sourceCounts = {
            tasks: data.tasks.filter(t => (t.projectId || t.project_id) === source.id).length,
            todos: data.todos.filter(t => t.projectId === source.id).length,
            documents: data.documents.filter(d => d.projectId === source.id).length,
            milestones: data.milestones.filter(m => m.projectId === source.id).length,
            risks: data.risks.filter(r => r.projectId === source.id).length,
            resources: data.resources.filter(r => r.projectId === source.id).length,
            childProjects: hierarchy.getChildren(data.projects, source.id).length,
        };

        // 1) 源自身关联实体 projectId → target（task 同时更新 project_id）
        //    记录被移动的实体 ID，供 T13 撤销时精确还原归属
        const movedEntityIds = { tasks: [], todos: [], documents: [], milestones: [], risks: [], resources: [] };
        const repointProjectId = (entity, bucket) => {
            if (entity.projectId === source.id) {
                entity.projectId = target.id;
                if (entity.id && movedEntityIds[bucket] && !movedEntityIds[bucket].includes(entity.id)) movedEntityIds[bucket].push(entity.id);
            }
            if (entity.project_id === source.id) entity.project_id = target.id;
        };
        data.tasks.forEach(t => repointProjectId(t, 'tasks'));
        data.todos.forEach(t => repointProjectId(t, 'todos'));
        data.documents.forEach(d => repointProjectId(d, 'documents'));
        data.milestones.forEach(m => repointProjectId(m, 'milestones'));
        data.risks.forEach(r => repointProjectId(r, 'risks'));
        data.resources.forEach(r => repointProjectId(r, 'resources'));

        // 2) 子项目改挂（keep：保留层级；flatten：整棵子树拍平到 target）
        //    同时记录 childOldParentMap：撤销时据此还原每个子项目的原 parentProjectId
        const reparented = new Set();
        const childOldParentMap = {};
        const reparentTo = (childId) => {
            const p = data.projects.find(x => x.id === childId);
            if (p) {
                childOldParentMap[childId] = hierarchy.normalizeParent(p.parentProjectId); // null 表示原为根
                p.parentProjectId = target.id;
                reparented.add(p.id);
            }
        };
        const directChildren = hierarchy.getChildren(data.projects, source.id);
        let flattened = strategy === 'flatten';
        if (strategy === 'flatten') {
            hierarchy.getDescendants(data.projects, source.id).forEach(desc => {
                reparentTo(desc.id);
            });
        } else {
            // keep：直属子项目 parentProjectId → target；若改挂后 level > MAX_DEPTH 则递归拍平整棵子树
            const targetLevel = hierarchy.getLevel(data.projects, target.id);
            const flattenDescendantsOf = (parentId) => {
                hierarchy.getDescendants(data.projects, parentId).forEach(desc => reparentTo(desc.id));
            };
            directChildren.forEach(child => {
                if (targetLevel + 1 > hierarchy.MAX_DEPTH) {
                    // 深度超限：把该子项目整棵子树拍平到 target
                    flattened = true;
                    reparentTo(child.id);
                    flattenDescendantsOf(child.id);
                } else {
                    reparentTo(child.id);
                }
            });
        }

        // 3) 源项目软隐藏
        source.mergedInto = target.id;
        source.mergedAt = new Date().toISOString();
        source.updated_at = new Date().toISOString();

        // 3.5) 写合并日志（供 T13 撤销）：记录被改挂子项目的原始父节点
        if (!Array.isArray(data.projectMerges)) data.projectMerges = [];
        const now = new Date().toISOString();
        const mergeLog = {
            id: generateId(),
            sourceId: source.id,
            targetId: target.id,
            sourceCode: source.code || '',
            targetCode: target.code || '',
            strategy,
            movedCounts: sourceCounts,
            childOldParentMap,
            movedEntityIds,
            timestamp: now,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            undone: false,
        };
        data.projectMerges.push(mergeLog);

        // 4) 原子写
        saveData(data);

        // 4.5) 推送轻流通知给目标项目负责人（不阻塞主流程，失败仅记日志）
        qingflow.notifyProjectMerged({
            source,
            target,
            movedCounts: sourceCounts,
            strategy,
        }).catch((e) => console.warn('[轻流推送] 合并通知失败:', e.message));

        respond(200, {
            sourceId: source.id,
            targetId: target.id,
            movedCounts: sourceCounts,
            flattened,
            mergeId: mergeLog.id,
            expiresAt: mergeLog.expiresAt,
        });
        return;
    }

    // ===== 合并日志查询 GET /api/merges?targetId=<tid>&sourceId=<sid>（T13 撤销）=====
    //    仅返回未撤销且未过期的可撤销项；可按 targetId / sourceId 过滤
    if (pathname === '/api/merges' && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const targetId = url.searchParams.get('targetId');
        const sourceId = url.searchParams.get('sourceId');
        const now = Date.now();
        let logs = (data.projectMerges || []).filter(m => m && !m.undone && new Date(m.expiresAt).getTime() > now);
        if (targetId) logs = logs.filter(m => m.targetId === targetId);
        if (sourceId) logs = logs.filter(m => m.sourceId === sourceId);
        // 仅返回有权限管理 target 或 source 的日志
        logs = logs.filter(m => ac.canManageProject(data, userId, m.targetId) || ac.canManageProject(data, userId, m.sourceId));
        // 附带项目名 / code 便于前端展示
        const projects = data.projects;
        const logsOut = logs.map(m => ({
            ...m,
            sourceName: projects.find(p => p.id === m.sourceId)?.name || m.sourceCode,
            targetName: projects.find(p => p.id === m.targetId)?.name || m.targetCode,
        }));
        sendResponse(res, 200, logsOut);
        return;
    }

    // ===== 撤销合并 POST /api/merges/:id/undo（T13，24h 限时回滚）=====
    if (pathname.match(/^\/api\/merges\/[\w-]+\/undo$/) && method === 'POST') {
        const mergeId = pathname.split('/')[3];
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const log = (data.projectMerges || []).find(m => m.id === mergeId);
        if (!log) { sendResponse(res, 404, { success: false, error: '合并日志不存在' }); return; }
        if (log.undone) { sendResponse(res, 409, { success: false, error: '该合并已被撤销' }); return; }
        if (new Date(log.expiresAt).getTime() <= Date.now()) {
            sendResponse(res, 409, { success: false, error: '撤销窗口（24h）已过期，无法撤销' }); return;
        }
        const source = data.projects.find(p => p.id === log.sourceId);
        const target = data.projects.find(p => p.id === log.targetId);
        if (!source || !target) { sendResponse(res, 409, { success: false, error: '源或目标项目已不存在' }); return; }
        if (!ac.canManageProject(data, userId, log.targetId) && !ac.canManageProject(data, userId, log.sourceId)) {
            sendResponse(res, 403, { success: false, error: '无权撤销该合并' }); return;
        }

        // 1) 还原被移动实体的归属（仅限日志记录的 movedEntityIds，避免误伤合并后新增的实体）
        const setBucket = (list, bucket) => {
            const ids = (log.movedEntityIds && log.movedEntityIds[bucket]) || [];
            if (!ids.length) return;
            list.forEach(e => {
                if (ids.includes(e.id)) {
                    e.projectId = log.sourceId;
                    if (e.project_id !== undefined) e.project_id = log.sourceId;
                }
            });
        };
        setBucket(data.tasks, 'tasks');
        setBucket(data.todos, 'todos');
        setBucket(data.documents, 'documents');
        setBucket(data.milestones, 'milestones');
        setBucket(data.risks, 'risks');
        setBucket(data.resources, 'resources');

        // 2) 还原子项目的 parentProjectId
        const oldParentMap = log.childOldParentMap || {};
        Object.keys(oldParentMap).forEach(childId => {
            const p = data.projects.find(x => x.id === childId);
            if (p) {
                const oldParent = oldParentMap[childId];
                if (oldParent === null) delete p.parentProjectId;
                else p.parentProjectId = oldParent;
            }
        });

        // 3) 清空源项目的合并标记
        delete source.mergedInto;
        delete source.mergedAt;
        source.updated_at = new Date().toISOString();

        // 4) 标记日志已撤销
        log.undone = true;
        log.undoneAt = new Date().toISOString();

        // 5) 原子写
        saveData(data);
        sendResponse(res, 200, {
            success: true,
            mergeId: log.id,
            sourceId: log.sourceId,
            targetId: log.targetId,
            restoredCounts: log.movedCounts,
        });
        return;
    }

    // ===== 子树查询 GET /api/projects/:id/subtree =====
    if (pathname.match(/^\/api\/projects\/[\w-]+\/subtree$/) && method === 'GET') {
        const id = pathname.split('/')[3];
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const project = data.projects.find(p => p.id === id);
        if (!project) {
            sendResponse(res, 404, { error: 'Project not found' });
            return;
        }
        if (!ac.canManageProject(data, userId, id)) {
            sendResponse(res, 403, { error: '无权访问该项目子树' });
            return;
        }
        const ids = hierarchy.collectSubtree(data.projects, id);
        const descendants = data.projects.filter(p => ids.has(p.id) && p.id !== id);
        sendResponse(res, 200, { project, descendants });
        return;
    }

    if (pathname.match(/\/api\/projects\/[\w-]+/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            if (!ac.canManageProject(data, userId, id)) {
                sendResponse(res, 403, { error: '无权编辑该项目' });
                return;
            }
            // T14：改挂（parentProjectId 变更）需过 3 道校验
            if ('parentProjectId' in body && body.parentProjectId !== data.projects[index].parentProjectId) {
                const newParent = hierarchy.normalizeParent(body.parentProjectId);
                // (a) 父存在性优先（资源不存在 → 404，先于 409）
                if (newParent) {
                    const par = data.projects.find(p => p.id === newParent);
                    if (!par) {
                        sendResponse(res, 404, { error: '父项目不存在' });
                        return;
                    }
                    if (par.archived === 1 || par.mergedInto) {
                        sendResponse(res, 409, { error: '父项目已归档或已合并' });
                        return;
                    }
                }
                // (b) 环检测：新父不能是自己或自己的子孙
                if (hierarchy.wouldCreateCycle(data.projects, id, newParent)) {
                    sendResponse(res, 409, { error: '不能挂到自身或其子项目下（形成环）' });
                    return;
                }
                // (c) 深度校验：改挂后 新父层级 + 1 + 自身子树深度 不得超过 MAX_DEPTH
                if (newParent) {
                    const targetLevel = hierarchy.getLevel(data.projects, newParent);
                    const subtreeDepth = hierarchy.maxSubtreeDepth(data.projects, id);
                    if (targetLevel + 1 + subtreeDepth > hierarchy.MAX_DEPTH) {
                        sendResponse(res, 409, {
                            error: `深度超限（改挂后最深 ${targetLevel + 1 + subtreeDepth} 层，最大 ${hierarchy.MAX_DEPTH} 层）`,
                        });
                        return;
                    }
                }
            }
            data.projects[index] = { ...data.projects[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.projects[index]);
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    if (pathname.match(/\/api\/projects\/[\w-]+/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            if (!ac.canManageProject(data, userId, id)) {
                sendResponse(res, 403, { error: '无权删除该项目' });
                return;
            }
            // 收集自身及所有后代项目（按 parentProjectId 递归）
            const toDelete = new Set([id]);
            let changed = true;
            while (changed) {
                changed = false;
                data.projects.forEach(p => {
                    if (p.parentProjectId && toDelete.has(p.parentProjectId) && !toDelete.has(p.id)) {
                        toDelete.add(p.id);
                        changed = true;
                    }
                });
            }
            // 级联删除关联任务（含子项目）
            const tasksToDelete = data.tasks.filter(t => toDelete.has(t.projectId) || toDelete.has(t.project_id));
            tasksToDelete.forEach(t => {
                const taskIndex = data.tasks.findIndex(task => task.id === t.id);
                if (taskIndex !== -1) {
                    data.tasks.splice(taskIndex, 1);
                }
            });
            const projectsDeleted = toDelete.size;
            data.projects = data.projects.filter(p => !toDelete.has(p.id));
            saveData(data);
            sendResponse(res, 200, { success: true, projectsDeleted, tasksDeleted: tasksToDelete.length });
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // Tasks API
    if (pathname.match(/\/api\/projects\/[\w-]+\/tasks/) && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const projectId = pathname.split('/')[3];
        if (!ac.canManageProject(data, userId, projectId)) {
            sendResponse(res, 403, { error: '无权访问该项目任务' });
            return;
        }
        const tasks = data.tasks.filter(t => t.projectId === projectId || t.project_id === projectId);
        sendResponse(res, 200, tasks);
        return;
    }

    // 新增：获取所有任务（修复 P0-1）
    if (pathname === '/api/tasks' && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        sendResponse(res, 200, ac.visibleTasks(data, userId));
        return;
    }

    if (pathname.match(/\/api\/projects\/[\w-]+\/tasks/) && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const projectId = pathname.split('/')[3];
        if (!ac.canCreateTask(data, userId, projectId)) {
            sendResponse(res, 403, { error: '无权在该项目创建任务' });
            return;
        }
        const task = {
            ...body,
            id: generateId(),
            projectId: projectId,        // 驼峰命名（前端 Store 用此名）
            project_id: projectId,        // 下划线命名（兼容旧数据）
            status: body.status || 'todo',
            priority: body.priority || 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.tasks.push(task);
        saveData(data);
        sendResponse(res, 201, task);

        // 异步发送轻流通知（仅任务已启动才推送，未启动的 todo 任务不推送；不阻塞响应，5秒超时保护）
        if ((body.assigneeId || body.assignee) && task.status !== 'todo') {
            qingflow.notifyTaskCreated(task).then(result => {
                if (!result.success) {
                    console.error('[轻流通知] 任务推送失败:', result.error || result.errMsg);
                }
            }).catch(err => {
                console.error('[轻流通知] 任务推送异常:', err.message);
            });
        }
        return;
    }

    if (pathname.match(/\/api\/tasks\/[\w-]+/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const index = data.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            // 所有者可编辑；任务责任人(成员)可更新自己任务的进度汇报
            if (!ac.canManageTask(data, userId, id) && !ac.taskAssigneeIncludes(data.tasks[index], userId)) {
                sendResponse(res, 403, { error: '无权修改该任务' });
                return;
            }
            const oldTask = { ...data.tasks[index] };
            const oldStatus = oldTask.status || 'todo';
            const newStatus = body.status || oldStatus;
            data.tasks[index] = { ...data.tasks[index], ...body, status: newStatus, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.tasks[index]);

            // 状态联动：任务从「待启动」变为「进行中」时，自动将所属项目同步为「进行中」
            if (oldStatus === 'todo' && newStatus === 'in_progress') {
              const pid = data.tasks[index].projectId || data.tasks[index].project_id;
              const pIndex = data.projects.findIndex(p => p.id === pid);
              if (pIndex !== -1 && data.projects[pIndex].status !== 'in_progress') {
                data.projects[pIndex].status = 'in_progress';
                data.projects[pIndex].updated_at = new Date().toISOString();
                saveData(data);
              }
            }

            // 任务启动推送：仅当任务从未启动(todo)变为已启动状态时，推送到轻流
            const launched = oldStatus === 'todo' && newStatus !== 'todo';
            if (launched && (data.tasks[index].assigneeId || data.tasks[index].assignee)) {
                qingflow.notifyTaskCreated(data.tasks[index]).then(result => {
                    if (!result.success) {
                        console.error('[轻流通知] 任务启动推送失败:', result.error || result.errMsg);
                    }
                }).catch(err => {
                    console.error('[轻流通知] 任务启动推送异常:', err.message);
                });
            }
        } else {
            sendResponse(res, 404, { error: 'Task not found' });
        }
        return;
    }

    // Todos API
    if (pathname === '/api/todos' && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        sendResponse(res, 200, ac.visibleTodos(data, userId));
        return;
    }

    if (pathname === '/api/todos' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        if (!ac.canCreateTodo(data, userId, body)) {
            sendResponse(res, 403, { error: '无权创建该待办（成员仅可在自己负责的任务下添加）' });
            return;
        }
        const todo = {
            ...body,
            id: generateId(),
            ownerId: userId || body.ownerId || null,
            completed: body.completed || 0,
            priority: body.priority || 'medium',
            remind_days: body.remind_days || 3,
            enable_escalation: body.enable_escalation ? 1 : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.todos.push(todo);
        saveData(data);
        sendResponse(res, 201, todo);

        // 异步发送轻流通知（不阻塞响应，5秒超时保护）
        if (body.assignee) {
            qingflow.notifyTodoCreated(todo).then(result => {
                if (!result.success) {
                    console.error('[轻流通知] 待办推送失败:', result.error || result.errMsg);
                }
            }).catch(err => {
                console.error('[轻流通知] 待办推送异常:', err.message);
            });
        }
        return;
    }

    if (pathname.match(/\/api\/todos\/[\w-]+/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const index = data.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            if (!ac.canManageTodo(data, userId, id)) {
                sendResponse(res, 403, { error: '无权编辑该待办' });
                return;
            }
            data.todos[index] = { ...data.todos[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            // 待办被标记完成 → 失效其 SSO ticket（方案 B：多次有效，完成才失效）
            const updatedTodo = data.todos[index];
            if (updatedTodo.completed || updatedTodo.status === 'done' || updatedTodo.status === 'completed' || updatedTodo.status === '已完成') {
                sso.invalidateByRef('todo', id);
            }
            sendResponse(res, 200, updatedTodo);
        } else {
            sendResponse(res, 404, { error: 'Todo not found' });
        }
        return;
    }

    if (pathname.match(/\/api\/todos\/[\w-]+/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const index = data.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            if (!ac.canManageTodo(data, userId, id)) {
                sendResponse(res, 403, { error: '无权删除该待办' });
                return;
            }
            data.todos.splice(index, 1);
            saveData(data);
            // 待办被删除 → 失效其 SSO ticket
            sso.invalidateByRef('todo', id);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Todo not found' });
        }
        return;
    }

    // ===== 组织架构（部门）API =====
    if (pathname === '/api/departments' && method === 'GET') {
        const data = loadData();
        const depts = data.departments || [];
        const map = {};
        depts.forEach(d => map[d.id] = { ...d, children: [] });
        const tree = [];
        depts.forEach(d => {
            if (d.parentId && map[d.parentId]) {
                map[d.parentId].children.push(map[d.id]);
            } else {
                tree.push(map[d.id]);
            }
        });
        sendResponse(res, 200, tree);
        return;
    }

    if (pathname === '/api/departments' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.departments) data.departments = [];
        const dept = {
            ...body,
            id: body.id || `dept_${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.departments.push(dept);
        saveData(data);
        sendResponse(res, 201, dept);
        return;
    }

    if (pathname.match(/^\/api\/departments\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.departments) data.departments = [];
        const index = data.departments.findIndex(d => d.id === id);
        if (index !== -1) {
            data.departments[index] = { ...data.departments[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.departments[index]);
        } else {
            sendResponse(res, 404, { error: 'Department not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/departments\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.departments) data.departments = [];
        const toDelete = new Set([id]);
        let changed = true;
        while (changed) {
            changed = false;
            data.departments.forEach(d => {
                if (d.parentId && toDelete.has(d.parentId) && !toDelete.has(d.id)) {
                    toDelete.add(d.id);
                    changed = true;
                }
            });
        }
        const before = data.departments.length;
        data.departments = data.departments.filter(d => !toDelete.has(d.id));
        saveData(data);
        sendResponse(res, 200, { success: true, deleted: before - data.departments.length });
        return;
    }

    // ===== 轻流组织架构同步 =====
    if (pathname === '/api/organization/sync' && method === 'POST') {
        // P0 修复：轻流组织架构同步（拉取远程用户并写入本地成员名册）仅 admin 可执行
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!ac.isAdmin(data, userId)) {
            sendResponse(res, 403, { error: '仅管理员可同步轻流组织架构' });
            return;
        }
        try {
            const result = await qingflow.syncOrganization(data);
            if (result.success) {
                saveData(data);
                sendResponse(res, 200, { success: true, message: '同步完成', ...result.results });
            } else {
                sendResponse(res, 400, { success: false, error: result.error });
            }
        } catch (err) {
            sendResponse(res, 500, { success: false, error: err.message });
        }
        return;
    }

    if (pathname === '/api/organization/qingflow-departments' && method === 'GET') {
        try {
            const result = await qingflow.getDepartments();
            if (result.success) {
                sendResponse(res, 200, { success: true, departments: result.departments });
            } else {
                sendResponse(res, 400, { success: false, error: result.error });
            }
        } catch (err) {
            sendResponse(res, 500, { success: false, error: err.message });
        }
        return;
    }

    if (pathname === '/api/organization/qingflow-users' && method === 'GET') {
        try {
            const result = await qingflow.getUsers();
            if (result.success) {
                sendResponse(res, 200, { success: true, users: result.users });
            } else {
                sendResponse(res, 400, { success: false, error: result.error });
            }
        } catch (err) {
            sendResponse(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // ===== Excel 导入合并组织架构和成员 =====
    // 前端解析 Excel 后提交 JSON: { departments: [...], members: [...] }
    // departments: [{ id, name, parentId }]  parentId 允许为父部门 name（前端已解析成 id）
    // members: [{ name, email, phone, departmentId }]
    if (pathname === '/api/organization/import' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.departments) data.departments = [];
        if (!data.members) data.members = [];
        const results = { syncedDepartments: 0, syncedMembers: 0, updatedMembers: 0, skipped: 0 };

        // ---- 1. 合并部门 ----
        if (Array.isArray(body.departments)) {
            const existingIds = new Set(data.departments.map(d => d.id));
            // 第一轮：先建立 id -> 部门 的映射（含导入的父部门 name -> id 解析）
            const idToName = {};
            data.departments.forEach(d => { idToName[d.id] = d.name; });
            const nameToId = {};
            data.departments.forEach(d => { if (d.name) nameToId[d.name] = d.id; });
            body.departments.forEach(d => { if (d.name) nameToId[d.name] = d.id; });
            // 收集导入部门自身的 name->id（用于父子引用）
            const importedById = {};
            body.departments.forEach(d => { importedById[d.id] = d; });

            const usedIds = new Set(existingIds);
            for (const d of body.departments) {
                if (!d.name || !d.name.trim()) { results.skipped++; continue; }
                // 解析 parentId：可能是 id、name 或缺失
                let parentId = null;
                if (d.parentId != null && d.parentId !== '' && d.parentId !== '无' && d.parentId !== '-') {
                    parentId = String(d.parentId);
                    // 如果 parentId 是父部门名称，先尝试用 name->id 映射
                    if (!usedIds.has(parentId) && nameToId[parentId]) {
                        parentId = nameToId[parentId];
                    }
                }
                // id 冲突处理：导入的 id 若已存在则更新，否则用 name 匹配更新，再否则新增
                if (usedIds.has(d.id)) {
                    const idx = data.departments.findIndex(x => x.id === d.id);
                    if (idx !== -1) data.departments[idx] = { ...data.departments[idx], name: d.name, parentId };
                    continue;
                }
                const byName = data.departments.find(x => x.name === d.name);
                if (byName) {
                    const idx = data.departments.findIndex(x => x.id === byName.id);
                    if (idx !== -1) data.departments[idx] = { ...data.departments[idx], parentId: parentId || data.departments[idx].parentId, updated_at: new Date().toISOString() };
                    continue;
                }
                const newDept = {
                    id: d.id || `dept_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    name: d.name.trim(),
                    parentId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                data.departments.push(newDept);
                usedIds.add(newDept.id);
                nameToId[newDept.name] = newDept.id;
                results.syncedDepartments++;
            }
        }

        // ---- 2. 合并成员 ----
        if (Array.isArray(body.members)) {
            const existingEmails = new Set(data.members.map(m => m.email).filter(Boolean));
            const deptNameToId = {};
            data.departments.forEach(d => { if (d.name) deptNameToId[d.name] = d.id; });
            const usedMemberIds = new Set(data.members.map(m => m.id).filter(Boolean));

            for (const u of body.members) {
                const name = (u.name || u.username || u.userName || '').trim();
                const email = (u.email || u.mail || '').trim();
                if (!name && !email) { results.skipped++; continue; }
                // 解析部门：departmentId 可能是 id 或部门名
                let deptId = u.departmentId || u.deptId || u.department || u.dept_name || null;
                if (deptId && !data.departments.find(d => d.id === deptId)) {
                    deptId = deptNameToId[String(deptId)] || null;
                }
                // 按 email 匹配更新，否则按 name 匹配，否则新增
                let existing = null;
                if (email && existingEmails.has(email)) {
                    existing = data.members.find(m => m.email === email);
                }
                if (!existing && name) {
                    existing = data.members.find(m => m.name === name);
                }
                if (existing) {
                    const idx = data.members.findIndex(m => m.id === existing.id);
                    data.members[idx] = {
                        ...data.members[idx],
                        name: name || data.members[idx].name,
                        email: email || data.members[idx].email,
                        phone: u.phone || u.mobile || data.members[idx].phone || '',
                        departmentId: deptId || data.members[idx].departmentId,
                        source: 'excel',
                        updated_at: new Date().toISOString()
                    };
                    results.updatedMembers++;
                } else {
                    const newMember = {
                        id: u.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        name: name || email.split('@')[0] || '未命名',
                        email,
                        password: email.split('@')[0] + 'Yj1018!', // 默认密码：邮箱@前部分 + Yj1018!（与重置密码规则一致）
                        phone: u.phone || u.mobile || '',
                        departmentId: deptId || null,
                        role: u.role || 'member',
                        avatarColor: u.avatarColor || '#3b82f6',
                        source: 'excel',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    data.members.push(newMember);
                    if (email) existingEmails.add(email);
                    results.syncedMembers++;
                }
            }
        }

        saveData(data);
        sendResponse(res, 200, { success: true, message: 'Excel 导入完成', ...results });
        return;
    }

    // 任务删除 - DELETE /api/tasks/:id
    if (pathname.match(/^\/api\/tasks\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const userId = ac.getUserId(req, url);
        const index = data.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            if (!ac.canManageTask(data, userId, id)) {
                sendResponse(res, 403, { error: '无权删除该任务' });
                return;
            }
            // 修补：仅「待启动(todo)」任务可删除；任务一旦启动（进行中/评审中/已完成/已阻塞）即锁定，
            // 防止误删进行中的任务数据（与前端删除按钮门控一致，后端为纵深防御）。
            const t = data.tasks[index];
            if (t.status && t.status !== 'todo') {
                sendResponse(res, 403, { error: '任务已开始执行，不能删除（仅「待启动」状态可删除）' });
                return;
            }
            data.tasks.splice(index, 1);
            saveData(data);
            // 任务被删除 → 失效其 SSO ticket
            sso.invalidateByRef('task', id);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Task not found' });
        }
        return;
    }

    // 任务更新 - PUT /api/tasks/:id
    if (pathname.match(/^\/api\/tasks\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const index = data.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            data.tasks[index] = { ...data.tasks[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            // 任务被标记完成 → 失效其 SSO ticket，并级联失效其下所有待办的 ticket
            // （方案 B：多次有效，完成才失效；待办链接常跳转到任务详情，故任务完成也应失效待办链接）
            const updatedTask = data.tasks[index];
            if (updatedTask.status === 'done' || updatedTask.status === 'completed' || updatedTask.status === '已完成') {
                sso.invalidateByRef('task', id);
                for (const td of (data.todos || [])) {
                    if (td.taskId === id) sso.invalidateByRef('todo', td.id);
                }
            }
            sendResponse(res, 200, updatedTask);
        } else {
            sendResponse(res, 404, { error: 'Task not found' });
        }
        return;
    }

    // 任务变更申请（修改计划/废止）- POST /api/tasks/:id/change-request
    // 「进行中」任务删除被禁止；任务负责人(assignee)或项目负责人可提交修改/废止申请，
    // 由项目负责人评审通过后生效。写入 task.pendingChange 并通知项目负责人。
    if (pathname.match(/^\/api\/tasks\/[\w-]+\/change-request$/) && method === 'POST') {
        const id = pathname.split('/')[3];
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!userId) { sendResponse(res, 401, { error: '未登录' }); return; }
        const index = data.tasks.findIndex(t => t.id === id);
        if (index === -1) { sendResponse(res, 404, { error: 'Task not found' }); return; }
        const task = data.tasks[index];
        if (task.status !== 'in_progress') {
            sendResponse(res, 400, { error: '仅「进行中」状态的任务可提交修改/废止申请' });
            return;
        }
        if (task.pendingChange) {
            sendResponse(res, 400, { error: '该任务已有待评审的变更申请' });
            return;
        }
        const type = body.type;
        if (type !== 'modify' && type !== 'abolish') {
            sendResponse(res, 400, { error: '无效的变更类型' });
            return;
        }
        // 权限：任务负责人(assignee)或项目负责人可提交
        const isAssignee = ac.taskAssigneeIncludes(task, userId);
        const isLead = ac.canManageTask(data, userId, id);
        if (!isAssignee && !isLead) {
            sendResponse(res, 403, { error: '仅任务负责人或项目负责人可提交变更申请' });
            return;
        }
        const reason = (body.reason || '').trim();
        if (!reason) { sendResponse(res, 400, { error: '请填写变更理由' }); return; }
        let newDueDate = null;
        if (type === 'modify') {
            newDueDate = (body.newDueDate || '').trim();
            if (!newDueDate) { sendResponse(res, 400, { error: '请填写新的计划完成日期' }); return; }
            // 校验日期格式 + 必须晚于原截止日期
            const d = new Date(newDueDate + 'T00:00:00');
            if (isNaN(d.getTime())) {
                sendResponse(res, 400, { error: '新的计划完成日期格式不正确（应为 YYYY-MM-DD）' });
                return;
            }
            if (task.dueDate) {
                const orig = new Date(task.dueDate + 'T00:00:00');
                if (!isNaN(orig.getTime()) && d.getTime() <= orig.getTime()) {
                    sendResponse(res, 400, { error: '新的计划完成日期应晚于原截止日期' });
                    return;
                }
            }
        }
        const userName = ac.getUserName(data, userId) || '当前用户';
        task.pendingChange = {
            type,
            reason,
            newDueDate,
            requestedBy: userId,
            requestedByName: userName,
            requestedAt: new Date().toISOString(),
        };
        // 通知项目负责人评审
        const project = (data.projects || []).find(p => p.id === (task.projectId || task.project_id));
        if (project) {
            const leadIds = new Set([project.ownerId, project.manager].filter(Boolean));
            leadIds.forEach((lid) => {
                if (lid === userId) return; // 不通知自己
                data.notifications.push({
                    id: generateId(),
                    user_id: lid,
                    type: 'task_change_request',
                    title: `任务变更申请待评审：${task.title}`,
                    message: `${userName} 申请${type === 'modify' ? '修改计划（延期）' : '废止'}任务，理由：${reason}`,
                    relatedId: task.id,
                    read: 0,
                    created_at: new Date().toISOString(),
                });
            });
        }
        saveData(data);
        sendResponse(res, 200, task);
        return;
    }

    // 任务变更评审（通过/驳回）- POST /api/tasks/:id/change-review
    // 仅项目负责人可评审。approve：modify 记录 modifications 并延后 dueDate；abolish 标记任务废止。
    if (pathname.match(/^\/api\/tasks\/[\w-]+\/change-review$/) && method === 'POST') {
        const id = pathname.split('/')[3];
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!userId) { sendResponse(res, 401, { error: '未登录' }); return; }
        if (!ac.canManageTask(data, userId, id)) {
            sendResponse(res, 403, { error: '仅项目负责人可评审变更申请' });
            return;
        }
        const index = data.tasks.findIndex(t => t.id === id);
        if (index === -1) { sendResponse(res, 404, { error: 'Task not found' }); return; }
        const task = data.tasks[index];
        if (!task.pendingChange) {
            sendResponse(res, 400, { error: '该任务没有待评审的变更申请' });
            return;
        }
        const decision = body.decision;
        if (decision !== 'approve' && decision !== 'reject') {
            sendResponse(res, 400, { error: '无效的评审决定' });
            return;
        }
        const reviewerName = ac.getUserName(data, userId) || '当前用户';
        const pc = task.pendingChange;
        if (decision === 'approve') {
            if (pc.type === 'modify') {
                task.modifications = task.modifications || [];
                task.modifications.push({
                    originalDueDate: task.dueDate,
                    newDueDate: pc.newDueDate,
                    reason: pc.reason,
                    requestedBy: pc.requestedBy,
                    requestedByName: pc.requestedByName,
                    approvedBy: userId,
                    approvedByName: reviewerName,
                    at: new Date().toISOString(),
                });
                // 计划完成时间延后到新截止日期
                task.dueDate = pc.newDueDate;
                task.lastModifiedReason = pc.reason;
            } else {
                task.abolished = true;
                task.abolishReason = pc.reason;
                task.abolishedBy = userId;
                task.abolishedByName = reviewerName;
                task.abolishedAt = new Date().toISOString();
                // 废止通过即视为终态：移出「进行中」栏，归入「已完成」栏
                task.status = 'done';
            }
            task.pendingChange = null;
            if (pc.requestedBy && pc.requestedBy !== userId) {
                data.notifications.push({
                    id: generateId(),
                    user_id: pc.requestedBy,
                    type: 'task_change_approved',
                    title: `任务变更已通过：${task.title}`,
                    message: `您的${pc.type === 'modify' ? '修改计划（延期）' : '废止'}申请已通过项目负责人评审。`,
                    relatedId: task.id,
                    read: 0,
                    created_at: new Date().toISOString(),
                });
            }
        } else {
            task.pendingChange = null;
            task.changeRejected = {
                type: pc.type,
                reason: pc.reason,
                reviewNote: (body.reviewNote || '').trim(),
                rejectedBy: userId,
                rejectedByName: reviewerName,
                at: new Date().toISOString(),
            };
            if (pc.requestedBy && pc.requestedBy !== userId) {
                data.notifications.push({
                    id: generateId(),
                    user_id: pc.requestedBy,
                    type: 'task_change_rejected',
                    title: `任务变更被驳回：${task.title}`,
                    message: `您的${pc.type === 'modify' ? '修改计划（延期）' : '废止'}申请未通过评审${body.reviewNote ? '：' + body.reviewNote : ''}。`,
                    relatedId: task.id,
                    read: 0,
                    created_at: new Date().toISOString(),
                });
            }
        }
        saveData(data);
        sendResponse(res, 200, task);
        return;
    }

    // Members API - 完整 CRUD
    if (pathname === '/api/members' && method === 'GET') {
        const data = loadData();
        // 修补①：成员名册脱敏 —— password 是登录凭证，不应下发到浏览器 localStorage
        const members = (data.members || []).map((m) => {
            const { password, ...rest } = m;
            return rest;
        });
        sendResponse(res, 200, members);
        return;
    }

    if (pathname === '/api/members' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const member = {
            ...body,
            id: body.id || generateId(),
            role: body.role || 'member',
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.members.push(member);
        saveData(data);
        sendResponse(res, 201, member);
        return;
    }

    // 成员更新 - PUT /api/members/:id
    if (pathname.match(/^\/api\/members\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const index = data.members.findIndex(m => m.id === id);
        if (index !== -1) {
            data.members[index] = { ...data.members[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.members[index]);
        } else {
            sendResponse(res, 404, { error: 'Member not found' });
        }
        return;
    }

    // 成员重置密码 - PUT /api/members/:id/reset-password
    // 修补③：管理员按 邮箱@前缀+Yj1018! 规则重置并持久化（与前端 useAuthStore.resetPassword 对齐）
    if (pathname.match(/^\/api\/members\/[\w-]+\/reset-password$/) && method === 'PUT') {
        const id = pathname.split('/')[3];
        const data = loadData();
        const userId = ac.getUserId(req);
        if (!ac.isAdmin(data, userId)) {
            sendResponse(res, 403, { error: '仅管理员可重置成员密码' });
            return;
        }
        const index = data.members.findIndex((m) => m.id === id);
        if (index === -1) {
            sendResponse(res, 404, { error: 'Member not found' });
            return;
        }
        const member = data.members[index];
        const prefix = (member.email || '').split('@')[0] || 'user';
        const newPwd = `${prefix}Yj1018!`;
        member.password = newPwd;
        member.updated_at = new Date().toISOString();
        saveData(data);
        sendResponse(res, 200, { success: true, password: newPwd });
        return;
    }

    // 成员删除 - DELETE /api/members/:id
    if (pathname.match(/^\/api\/members\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const index = data.members.findIndex(m => m.id === id);
        if (index !== -1) {
            data.members.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Member not found' });
        }
        return;
    }

    // Notifications API - 完整 CRUD
    if (pathname === '/api/notifications' && method === 'GET') {
        const data = loadData();
        // 修补②：按会话 cookie 身份过滤，不再信任 query userId（防伪造读他人通知）
        const userId = ac.getUserId(req);
        const notifications = userId
            ? data.notifications.filter((n) => n.user_id === userId)
            : [];
        sendResponse(res, 200, notifications);
        return;
    }

    if (pathname === '/api/notifications' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req);
        const notification = {
            ...body,
            id: generateId(),
            // 修补②：通知归属以会话 cookie 身份为准（body.user_id 不得伪造）
            user_id: userId || body.user_id,
            read: body.read || 0,
            created_at: new Date().toISOString()
        };
        data.notifications.push(notification);
        saveData(data);
        sendResponse(res, 201, notification);

        // 逾期/催办通知：异步推送到轻流 Q-Source（不阻塞响应）
        if (body.type === 'overdue' || body.type === 'escalation') {
            qingflow.notifyOverdue(notification)
                .then((result) => {
                    if (result && !result.success) {
                        console.warn('[轻流推送] 逾期通知推送失败:', result.error || result.errMsg);
                    }
                })
                .catch((err) => console.error('[轻流推送] 逾期通知推送异常:', err.message));
        }
        return;
    }

    // 标记已读 - PUT /api/notifications/:id/read
    if (pathname.match(/^\/api\/notifications\/[\w-]+\/read$/) && method === 'PUT') {
        const id = pathname.split('/')[3];
        const data = loadData();
        const index = data.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            data.notifications[index].read = 1;
            data.notifications[index].updated_at = new Date().toISOString();
            saveData(data);
            sendResponse(res, 200, data.notifications[index]);
        } else {
            sendResponse(res, 404, { error: 'Notification not found' });
        }
        return;
    }

    // 全部标记已读 - PUT /api/notifications/read-all
    if (pathname === '/api/notifications/read-all' && method === 'PUT') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = body.userId;
        let count = 0;
        data.notifications.forEach(n => {
            if ((!userId || n.user_id === userId) && !n.read) {
                n.read = 1;
                n.updated_at = new Date().toISOString();
                count++;
            }
        });
        saveData(data);
        sendResponse(res, 200, { success: true, markedCount: count });
        return;
    }

    // 清除已读 - DELETE /api/notifications/read
    // 路由顺序（Bug 修复）：本静态路由必须声明在动态路由 DELETE /api/notifications/:id 之前，
    // 否则会被 :id 分支抢先命中（原 :id 正则会匹配 'read'），导致返回 404 的"假成功"。
    if (pathname === '/api/notifications/read' && method === 'DELETE') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = body.userId;
        const before = data.notifications.length;
        // 按用户隔离清除已读（数据破坏性缺陷修复）：
        //  - 提供 userId 时：仅删除"属于该用户且已读"的通知，绝不动其他用户的任何通知；
        //  - 缺失 userId 时：保留原有全局语义（删除所有已读），以维持向后兼容。
        // （原实现 `if (n.read) return false;` 只要 read 就删，完全不看 user_id，
        //   会把全库所有用户的已读通知一并删除。）
        data.notifications = data.notifications.filter(n => {
            if (userId) return !(n.read && n.user_id === userId);
            return !n.read;
        });
        const removed = before - data.notifications.length;
        saveData(data);
        sendResponse(res, 200, { success: true, removedCount: removed });
        return;
    }

    // 清空全部 - DELETE /api/notifications/all
    // 路由顺序（同 Bug 修复）：同样必须声明在 DELETE /api/notifications/:id 之前，防被遮蔽。
    if (pathname === '/api/notifications/all' && method === 'DELETE') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = body.userId;
        const before = data.notifications.length;
        if (userId) {
            data.notifications = data.notifications.filter(n => n.user_id !== userId);
        } else {
            data.notifications = [];
        }
        const removed = before - data.notifications.length;
        saveData(data);
        sendResponse(res, 200, { success: true, removedCount: removed });
        return;
    }

    // 单个通知删除 - DELETE /api/notifications/:id
    // 负向断言 (?!read$|all$|read-all$) 作为双保险：保留字（read/all/read-all）永不作为通知 id，
    // 即使将来在别处插入新的静态路由，也不会被本动态路由抢先匹配而重蹈遮蔽覆辙。
    if (pathname.match(/^\/api\/notifications\/(?!read$|all$|read-all$)[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const index = data.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            data.notifications.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Notification not found' });
        }
        return;
    }

    // ==================== Risks API ====================
    if (pathname === '/api/risks' && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        sendResponse(res, 200, ac.visibleRisks(data, userId));
        return;
    }

    if (pathname === '/api/risks' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.risks) data.risks = [];
        const risk = {
            ...body,
            id: body.id || generateId(),
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.risks.push(risk);
        saveData(data);
        sendResponse(res, 201, risk);
        return;
    }

    if (pathname.match(/^\/api\/risks\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.risks) data.risks = [];
        const index = data.risks.findIndex(r => r.id === id);
        if (index !== -1) {
            data.risks[index] = { ...data.risks[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.risks[index]);
        } else {
            sendResponse(res, 404, { error: 'Risk not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/risks\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.risks) data.risks = [];
        const index = data.risks.findIndex(r => r.id === id);
        if (index !== -1) {
            data.risks.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Risk not found' });
        }
        return;
    }

    // ==================== Resources API ====================
    if (pathname === '/api/resources' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.resources || []);
        return;
    }

    if (pathname === '/api/resources' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.resources) data.resources = [];
        const resource = {
            ...body,
            id: body.id || generateId(),
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.resources.push(resource);
        saveData(data);
        sendResponse(res, 201, resource);
        return;
    }

    if (pathname.match(/^\/api\/resources\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.resources) data.resources = [];
        const index = data.resources.findIndex(r => r.id === id);
        if (index !== -1) {
            data.resources[index] = { ...data.resources[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.resources[index]);
        } else {
            sendResponse(res, 404, { error: 'Resource not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/resources\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.resources) data.resources = [];
        const index = data.resources.findIndex(r => r.id === id);
        if (index !== -1) {
            data.resources.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Resource not found' });
        }
        return;
    }

    // ==================== Milestones API ====================
    if (pathname === '/api/milestones' && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        sendResponse(res, 200, ac.visibleMilestones(data, userId));
        return;
    }

    if (pathname === '/api/milestones' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        if (!ac.canManageProject(data, userId, body.projectId)) {
            sendResponse(res, 403, { error: '无权在该项目创建里程碑' });
            return;
        }
        if (!data.milestones) data.milestones = [];
        const milestone = {
            ...body,
            id: body.id || generateId(),
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.milestones.push(milestone);
        saveData(data);
        sendResponse(res, 201, milestone);
        return;
    }

    if (pathname.match(/^\/api\/milestones\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        if (!data.milestones) data.milestones = [];
        const index = data.milestones.findIndex(m => m.id === id);
        if (index !== -1) {
            if (!ac.canManageMilestone(data, userId, id)) {
                sendResponse(res, 403, { error: '无权编辑该里程碑' });
                return;
            }
            data.milestones[index] = { ...data.milestones[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.milestones[index]);
        } else {
            sendResponse(res, 404, { error: 'Milestone not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/milestones\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const userId = ac.getUserId(req, url);
        if (!data.milestones) data.milestones = [];
        const index = data.milestones.findIndex(m => m.id === id);
        if (index !== -1) {
            if (!ac.canManageMilestone(data, userId, id)) {
                sendResponse(res, 403, { error: '无权删除该里程碑' });
                return;
            }
            data.milestones.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Milestone not found' });
        }
        return;
    }

    // ==================== Documents API ====================
    if (pathname === '/api/documents' && method === 'GET') {
        const data = loadData();
        const userId = ac.getUserId(req, url);
        sendResponse(res, 200, ac.visibleDocuments(data, userId));
        return;
    }

    if (pathname === '/api/documents' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        if (!ac.canCreateDocument(data, userId, body)) {
            sendResponse(res, 403, { error: '无权在该项目创建文档' });
            return;
        }
        if (!data.documents) data.documents = [];
        const doc = {
            ...body,
            id: body.id || generateId(),
            ownerId: userId || body.ownerId || null,
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.documents.push(doc);
        saveData(data);
        sendResponse(res, 201, doc);
        return;
    }

    if (pathname.match(/^\/api\/documents\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const userId = ac.getUserId(req, url);
        if (!data.documents) data.documents = [];
        const index = data.documents.findIndex(d => d.id === id);
        if (index !== -1) {
            if (!ac.canManageDocument(data, userId, id)) {
                sendResponse(res, 403, { error: '无权编辑该文档' });
                return;
            }
            data.documents[index] = { ...data.documents[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.documents[index]);
        } else {
            sendResponse(res, 404, { error: 'Document not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/documents\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const userId = ac.getUserId(req, url);
        if (!data.documents) data.documents = [];
        const index = data.documents.findIndex(d => d.id === id);
        if (index !== -1) {
            if (!ac.canManageDocument(data, userId, id)) {
                sendResponse(res, 403, { error: '无权删除该文档' });
                return;
            }
            data.documents.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Document not found' });
        }
        return;
    }

    // ==================== 项目类型 API (Project Types) ====================
    if (pathname === '/api/project-types' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.projectTypes || []);
        return;
    }

    if (pathname === '/api/project-types' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.projectTypes) data.projectTypes = [];
        // 新记录统一排在最下面：排序号取当前最大 + 1，不做顺延
        const pt = {
            ...body,
            id: body.id || generateId(),
            sortOrder: nextSortOrder(data.projectTypes),
            created_at: new Date().toISOString()
        };
        data.projectTypes.push(pt);
        saveData(data);
        sendResponse(res, 201, pt);
        return;
    }

    if (pathname.match(/^\/api\/project-types\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.projectTypes) data.projectTypes = [];
        const index = data.projectTypes.findIndex(t => t.id === id);
        if (index !== -1) {
            // 编辑项目类型：不调整排序号，保留原位置
            const updated = { ...data.projectTypes[index], ...body, sortOrder: data.projectTypes[index].sortOrder, updated_at: new Date().toISOString() };
            data.projectTypes[index] = updated;
            saveData(data);
            sendResponse(res, 200, updated);
        } else {
            sendResponse(res, 404, { error: 'Project type not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/project-types\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.projectTypes) data.projectTypes = [];
        const index = data.projectTypes.findIndex(t => t.id === id);
        if (index !== -1) {
            data.projectTypes.splice(index, 1);
            // 同时删除关联的项目阶段
            if (data.projectStages) {
                data.projectStages = data.projectStages.filter(s => s.projectTypeId !== id);
            }
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Project type not found' });
        }
        return;
    }

    // ==================== 项目阶段 API (Project Stages) ====================
    if (pathname === '/api/project-stages' && method === 'GET') {
        const data = loadData();
        const projectTypeId = url.searchParams.get('projectTypeId');
        let stages = data.projectStages || [];
        if (projectTypeId) {
            stages = stages.filter(s => s.projectTypeId === projectTypeId);
        }
        sendResponse(res, 200, stages);
        return;
    }

    if (pathname === '/api/project-stages' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.projectStages) data.projectStages = [];
        // 新记录统一排在该类型最下面：排序号取该类型当前最大 + 1，不做顺延
        const typeStages = data.projectStages.filter(s => s.projectTypeId === body.projectTypeId);
        const stage = {
            ...body,
            id: body.id || generateId(),
            sortOrder: nextSortOrder(typeStages),
            created_at: new Date().toISOString()
        };
        data.projectStages.push(stage);
        saveData(data);
        sendResponse(res, 201, stage);
        return;
    }

    if (pathname.match(/^\/api\/project-stages\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.projectStages) data.projectStages = [];
        const index = data.projectStages.findIndex(s => s.id === id);
        if (index !== -1) {
            // 编辑项目阶段：不调整排序号，保留原位置
            const updated = { ...data.projectStages[index], ...body, sortOrder: data.projectStages[index].sortOrder, updated_at: new Date().toISOString() };
            data.projectStages[index] = updated;
            saveData(data);
            sendResponse(res, 200, updated);
        } else {
            sendResponse(res, 404, { error: 'Project stage not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/project-stages\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.projectStages) data.projectStages = [];
        const index = data.projectStages.findIndex(s => s.id === id);
        if (index !== -1) {
            data.projectStages.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Project stage not found' });
        }
        return;
    }

    // ==================== 项目群聊 API ====================
    if (chat.isChatPath(pathname)) {
        const handled = await chat.handle(req, res, {
            pathname, method, url, loadData, saveData, sendResponse, parseBody, generateId, ac, dbDir: DB_DIR,
        });
        if (handled) return;
    }

    // 404
    sendResponse(res, 404, { error: 'Not found' });
});

// 启动服务器
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('Project Workbench API Server');
    console.log('='.repeat(50));
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📁 Database: ${DB_PATH}`);
    console.log('');
    console.log('API Endpoints:');
    console.log('  GET    /api/health       - 健康检查');
    console.log('  GET    /api/stats        - 统计数据');
    console.log('  GET    /api/projects     - 获取所有项目');
    console.log('  POST   /api/projects     - 创建项目');
    console.log('  PUT    /api/projects/:id - 更新项目');
    console.log('  DELETE /api/projects/:id - 删除项目');
    console.log('  GET    /api/projects/:id/tasks - 获取项目任务');
    console.log('  POST   /api/projects/:id/tasks - 创建任务');
    console.log('  GET    /api/tasks        - 获取所有任务');
    console.log('  PUT    /api/tasks/:id    - 更新任务');
    console.log('  DELETE /api/tasks/:id    - 删除任务（仅待启动可删）');
    console.log('  POST   /api/tasks/:id/change-request - 提交修改/废止申请');
    console.log('  POST   /api/tasks/:id/change-review - 评审变更申请');
    console.log('  GET    /api/todos        - 获取所有待办');
    console.log('  POST   /api/todos        - 创建待办');
    console.log('  PUT    /api/todos/:id    - 更新待办');
    console.log('  DELETE /api/todos/:id    - 删除待办');
    console.log('  GET    /api/members      - 获取所有成员');
    console.log('  POST   /api/members      - 创建成员');
    console.log('  PUT    /api/members/:id  - 更新成员');
    console.log('  DELETE /api/members/:id  - 删除成员');
    console.log('  GET    /api/notifications- 获取通知');
    console.log('  POST   /api/notifications- 创建通知');
    console.log('  PUT    /api/notifications/:id/read - 标记已读');
    console.log('  PUT    /api/notifications/read-all - 全部已读');
    console.log('  DELETE /api/notifications/:id - 删除通知');
    console.log('  DELETE /api/notifications/read - 清除已读');
    console.log('  DELETE /api/notifications/all - 清空全部');
    console.log('  GET/POST/PUT/DELETE /api/risks       - 风险 CRUD');
    console.log('  GET/POST/PUT/DELETE /api/resources   - 资源 CRUD');
    console.log('  GET/POST/PUT/DELETE /api/milestones  - 里程碑 CRUD');
    console.log('  GET/POST/PUT/DELETE /api/documents   - 文档 CRUD');
    console.log('  GET/POST/PUT/DELETE /api/project-types - 项目类型字典');
    console.log('  GET/POST/PUT/DELETE /api/project-stages - 项目阶段字典');
    console.log('='.repeat(50));
});

// 错误处理
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，请更换端口或关闭其他服务`);
    } else {
        console.error('❌ 服务器错误:', err.message);
    }
    process.exit(1);
});
