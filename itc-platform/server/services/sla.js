/**
 * SLA 计时服务
 * 时限 = 工单创建时间 + 优先级对应的小时数（可从 settings 覆盖）
 */
const { db } = require('../db');
const { SLA_POLICY } = require('../config');
const { parseDateTime, addHours, formatDateTime } = require('../utils/time');

const DEFAULT_PRIORITY = 'medium';

/** 读取（可覆盖的）SLA 策略 */
function getSlaPolicy() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('sla_policy');
  if (row && row.value) {
    try {
      return JSON.parse(row.value);
    } catch (e) {
      // 解析失败回退默认
    }
  }
  return SLA_POLICY;
}

/**
 * 按优先级计算响应/解决时限
 * @param {string} priority low|medium|high|urgent
 * @param {string} createdAt 'YYYY-MM-DD HH:MM:SS'
 * @returns {{slaResponseDue:string|null, slaResolveDue:string|null}}
 */
function computeSlaDue(priority, createdAt) {
  const policy = getSlaPolicy();
  const conf = policy[priority] || policy[DEFAULT_PRIORITY];
  if (!conf) return { slaResponseDue: null, slaResolveDue: null };
  const base = parseDateTime(createdAt) || new Date();
  return {
    slaResponseDue: formatDateTime(addHours(base, conf.responseHours)),
    slaResolveDue: formatDateTime(addHours(base, conf.resolveHours))
  };
}

/**
 * 评估单个工单 SLA 状态
 * @param {object} ticket
 * @returns {{
 *   responseDue:string|null, resolveDue:string|null,
 *   responseOverdue:boolean, resolveOverdue:boolean,
 *   slaStatus:'ok'|'warning'|'overdue'|'na', label:string
 * }}
 */
function evaluateSla(ticket) {
  const now = new Date();
  const responseDue = parseDateTime(ticket.sla_response_due);
  const resolveDue = parseDateTime(ticket.sla_resolve_due);
  const responded = parseDateTime(ticket.response_at);
  const resolved = parseDateTime(ticket.resolved_at);

  const responseOverdue = !!(responseDue && !responded && !resolved && now > responseDue);
  const resolveOverdue = !!(resolveDue && !resolved && now > resolveDue &&
    (ticket.status === 'open' || ticket.status === 'assigned' || ticket.status === 'in_progress' || ticket.status === 'pending_verify'));

  let status = 'na';
  if (responseOverdue || resolveOverdue) {
    status = 'overdue';
  } else if (responseDue || resolveDue) {
    status = 'ok';
  }

  const label = status === 'overdue' ? '已超时'
    : status === 'ok' ? '时限内'
    : '不适用';

  return {
    responseDue: ticket.sla_response_due,
    resolveDue: ticket.sla_resolve_due,
    responseOverdue,
    resolveOverdue,
    slaStatus: status,
    label
  };
}

/**
 * 批量给工单列表附加 SLA 评估信息
 */
function attachSla(tickets) {
  return tickets.map((t) => ({ ...t, ...evaluateSla(t) }));
}

module.exports = { getSlaPolicy, computeSlaDue, evaluateSla, attachSla };