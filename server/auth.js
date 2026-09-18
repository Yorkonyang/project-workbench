/**
 * SSO 单点登录模块
 *
 * 用途：轻流通知中的任务链接带上签名参数，前端拿到后调用 /api/auth/sso 兑换
 *       一次性 ticket，再凭 ticket 自动登录项目工作台。
 *
 * 安全模型（方案 B：ticket 替代邮箱）：
 *  - 通知推送时预签 ticket + HMAC-SHA256(ticket|exp, SSO_SECRET)，并写入 ticketStore
 *  - URL 中只携带 ticket，不再含任何邮箱/userId
 *  - 点击链接时验证 HMAC 后查 ticketStore 还原 userId/email
 *  - 写 HttpOnly cookie 后 302 跳转；前端 /api/auth/me 消费 cookie 中的 ticket 一次
 *  - **多次有效、完成才失效**：ticket 关联具体待办/任务（ref），责任人可反复点击；
 *    待办/任务被标记完成（或删除）时由后端 invalidateByRef 主动失效。
 *  - 兜底 TTL（30 天）仅用于清理，避免 ticketStore 无限堆积，并非业务时限。
 *  - SSO_SECRET 优先级：环境变量 > pushConfig.ssoSecret > 内置 dev key
 *
 * 注意：内置 dev key 仅供本地开发，生产必须设置环境变量或 pushConfig.ssoSecret。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// SSO ticket 持久化文件（与 workbench.db 同目录，即项目根 /data）
const TICKETS_PATH = path.join(__dirname, '../data/sso-tickets.json');

// 默认 SSO 签名密钥（仅开发环境使用；生产必须替换）
const DEFAULT_SSO_SECRET = 'pw-dev-sso-secret-CHANGE-IN-PROD';

// ticket 兜底 TTL：30 天。仅作内部清理用，业务上靠「待办/任务完成即失效」回收，
// 不限制责任人几天内反复点击链接（任务可跨多天完成）。
const TICKET_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// URL 签名时间戳：仅作为签名 payload 一部分（不再做日期校验），防止重放改 exp
const SIGNATURE_TTL_S = 30 * 60;

// ticket 池：ticket → { userId, email, expiresAt, ref }。
// 持久化到 data/sso-tickets.json，后端重启后已签发的 ticket 仍有效（不再因重启失效）。
const ticketStore = loadTickets();

// 会话池：session token → { userId, email, expiresAt }。
// 邮箱密码登录 / SSO 登录成功后种 HttpOnly cookie，后端用该 token 识别身份，
// 不再信任客户端发来的裸 x-user-id 头。
const sessionStore = new Map();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 签发会话 token（返回 token 字符串，由调用方写入 HttpOnly cookie）
 */
function issueSession(userId, email) {
    const token = crypto.randomBytes(32).toString('hex');
    sessionStore.set(token, { userId, email, expiresAt: Date.now() + SESSION_TTL_MS });
    return { token, expiresAt: sessionStore.get(token).expiresAt };
}

/**
 * 从 session token 还原身份；过期/无效返回 null
 */
function getSession(token) {
    if (!token) return null;
    const entry = sessionStore.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        sessionStore.delete(token);
        return null;
    }
    return entry;
}

/**
 * 撤销会话（登出时调用）
 */
function destroySession(token) {
    if (token) sessionStore.delete(token);
}

// 从磁盘加载已持久化的 ticket（跳过过期项，避免无限堆积）
function loadTickets() {
  try {
    const raw = fs.readFileSync(TICKETS_PATH, 'utf8');
    const arr = JSON.parse(raw);
    const m = new Map();
    const now = Date.now();
    if (Array.isArray(arr)) {
      for (const [t, e] of arr) {
        if (e && e.expiresAt && now <= e.expiresAt) m.set(t, e);
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

// 将 ticket 池全量写入磁盘（ticket 数量少、变更低频，同步写即可）
function persistTickets() {
  try {
    fs.writeFileSync(TICKETS_PATH, JSON.stringify(Array.from(ticketStore.entries())));
  } catch (e) {
    console.warn('[auth] 持久化 SSO ticket 失败:', e.message);
  }
}

/**
 * 获取当前生效的 SSO 密钥
 * 优先级：环境变量 > pushConfig.ssoSecret > 内置 dev key
 *
 * 安全策略（P1）：
 *  - 生产（NODE_ENV === 'production'）若未配置 SSO_SECRET 或 pushConfig.ssoSecret，
 *    直接抛错拒绝启动，防止使用内置 dev key 导致签名可被伪造。
 *  - 非生产环境仅打印警告，允许使用内置 dev key。
 */
function getSecret() {
    const envSecret = process.env.SSO_SECRET;
    const cfgSecret = require('./qingflow').getPushConfig().ssoSecret;
    if (envSecret) return envSecret;
    if (cfgSecret) return cfgSecret;
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            '[auth] 生产环境必须配置 SSO_SECRET 环境变量或 pushConfig.ssoSecret，' +
            '禁止使用内置 dev key 启动'
        );
    }
    console.warn('[auth] 警告：正在使用内置 dev SSO 密钥（仅开发环境允许），生产部署请设置 SSO_SECRET 或 pushConfig.ssoSecret');
    return DEFAULT_SSO_SECRET;
}

/**
 * 计算 HMAC 签名（payload = email|exp，仅供方案 A 向后兼容使用）
 */
function sign(email, exp) {
    const payload = `${email}|${exp}`;
    return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/**
 * 验证 email|exp 签名（不校验过期时间）
 */
function verify(email, exp, sig) {
    if (!email || !exp || !sig) {
        return { ok: false, reason: 'missing_params' };
    }
    const expected = sign(email, exp);
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, reason: 'bad_sig' };
    }
    return { ok: true };
}

/**
 * 签发一次性 ticket（登录时 /api/auth/sso-link 路由调用）
 */
function issueTicket(userId, email) {
    const ticket = crypto.randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + TICKET_TTL_MS;
    ticketStore.set(ticket, { userId, email, expiresAt });
    persistTickets();
    sweepExpired();
    return { ticket, expiresAt };
}

/**
 * 校验并消费 ticket（一次性）
 */
function consumeTicket(ticket) {
    const entry = ticketStore.get(ticket);
    if (!entry) return null;
    ticketStore.delete(ticket);
    persistTickets();
    if (Date.now() > entry.expiresAt) return null;
    return entry;
}

function sweepExpired() {
    const now = Date.now();
    for (const [t, e] of ticketStore.entries()) {
        if (now > e.expiresAt) ticketStore.delete(t);
    }
    persistTickets();
}

/**
 * 生成带 SSO 签名的链接（方案 A 向后兼容，仅用于已发出的老通知）
 */
function buildSignedUrl(baseUrl, path, email) {
    const exp = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_S;
    const sig = sign(email, exp);
    const u = encodeURIComponent(email);
    const sep = path.includes('?') ? '&' : '?';
    return `${baseUrl}${path}${sep}u=${u}&exp=${exp}&sig=${sig}`;
}

// ========== 方案 B：多次有效 ticket 替代邮箱 ==========
// 推送时刻预签 ticket，并把 ticket 写入 ticketStore；URL 中只携带 ticket。
// ticket 关联待办/任务（ref），待办/任务完成时由后端 invalidateByRef 主动失效。

/**
 * 预签发 ticket（推送通知时用），会立即存入 ticketStore。
 * @param {string} userId
 * @param {string} email
 * @param {{type:'todo'|'task'|'milestone', id:string} | null} ref 关联的待办/任务
 */
function issuePreTicket(userId, email, ref = null) {
    const ticket = crypto.randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + TICKET_TTL_MS;
    ticketStore.set(ticket, { userId, email, expiresAt, ref });
    persistTickets();
    sweepExpired();
    return { ticket, expiresAt };
}

/**
 * 计算 ticket + exp 的 HMAC 签名
 */
function signTicket(ticket, exp) {
    const payload = `${ticket}|${exp}`;
    return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/**
 * 验证 ticket + exp 的签名；通过后从 ticketStore 读取 userId/email。
 * 同时校验兜底过期（过期则删除并返回 expired）。本函数不消费 ticket，可多次有效。
 *
 * 修补⑤：签名校验失败的 ticket 记录失败次数，连续 5 次失败后删除该 ticket，
 * 防止攻击者拿到 ticket 后用暴力签名枚举绕过。
 */
const ticketFailCounts = new Map(); // ticket → 连续失败次数
const TICKET_MAX_FAILS = 5;

function verifyTicket(ticket, exp, sig) {
    if (!ticket || !exp || !sig) return { ok: false, reason: 'missing_params' };
    const secret = getSecret();
    const expected = crypto.createHmac('sha256', secret).update(`${ticket}|${exp}`).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        // 修补⑤：签名失败计数，超限删除 ticket
        const fails = (ticketFailCounts.get(ticket) || 0) + 1;
        ticketFailCounts.set(ticket, fails);
        if (fails >= TICKET_MAX_FAILS) {
            ticketStore.delete(ticket);
            ticketFailCounts.delete(ticket);
            persistTickets();
            return { ok: false, reason: 'ticket_blocked' };
        }
        return { ok: false, reason: 'bad_sig' };
    }
    // 校验通过，清除失败计数
    ticketFailCounts.delete(ticket);
    const entry = ticketStore.get(ticket);
    if (!entry) return { ok: false, reason: 'unknown_ticket' };
    if (Date.now() > entry.expiresAt) {
        ticketStore.delete(ticket);
        persistTickets();
        return { ok: false, reason: 'expired' };
    }
    return { ok: true, entry };
}

/**
 * 按关联对象（ref）批量失效 ticket。
 * 待办/任务被标记完成或删除时调用，使该对象对应的所有 SSO 链接立即失效。
 * @param {'todo'|'task'|'milestone'} type
 * @param {string|number} id
 * @returns {number} 被失效的 ticket 数量
 */
function invalidateByRef(type, id) {
    const sid = String(id);
    let removed = 0;
    for (const [t, e] of ticketStore.entries()) {
        if (e.ref && e.ref.type === type && String(e.ref.id) === sid) {
            ticketStore.delete(t);
            removed++;
        }
    }
    persistTickets();
    return removed;
}

/**
 * 生成基于 ticket 的 SSO 链接（方案 B）。
 * URL 中**不包含**任何邮箱/userId 字段。
 *
 * @param {string} baseUrl   前端 host（用于拼接跳转目标）
 * @param {string} ssoLinkPath 后端入口路径（形如 /api/auth/sso-link）
 * @param {string} ticket    预签发的一次性 ticket（已写入 ticketStore）
 * @param {number} exp       过期时间戳（秒），将作为签名 payload 的一部分
 * @param {string} [redirect] 要跳转到的目标路径（可选）
 * @returns {string} 完整链接
 */
function buildTicketUrl(baseUrl, ssoLinkPath, ticket, exp, redirect) {
    const sig = signTicket(ticket, exp);
    const params = new URLSearchParams({ t: ticket, exp: String(exp), sig });
    if (redirect) params.set('redirect', redirect);
    const sep = ssoLinkPath.includes('?') ? '&' : '?';
    return `${baseUrl}${ssoLinkPath}${sep}${params.toString()}`;
}

module.exports = {
    sign,
    verify,
    signTicket,
    verifyTicket,
    issueTicket,
    issuePreTicket,
    invalidateByRef,
    consumeTicket,
    buildSignedUrl,
    buildTicketUrl,
    getSecret,
    _ticketStoreSize: () => ticketStore.size,
    // 会话（session token）能力
    issueSession,
    getSession,
    destroySession,
};
