/**
 * 统计报表聚合服务（M2 统计 + M4 工作量）
 */
const { db } = require('../db');
const { attachSla } = require('./sla');
const { diffMinutes } = require('../utils/time');

/** 按状态统计 */
function statsByStatus() {
  return db.prepare(`
    SELECT status, COUNT(*) AS count FROM tickets GROUP BY status
  `).all().map((r) => ({ status: r.status, count: r.count }));
}

/** 按系统统计（含名称） */
function statsBySystem() {
  return db.prepare(`
    SELECT t.system_id, COALESCE(s.name, '未关联') AS name, COUNT(*) AS count
    FROM tickets t LEFT JOIN systems s ON t.system_id = s.id
    GROUP BY t.system_id
  `).all();
}

/** 按处理人统计 */
function statsByAssignee() {
  return db.prepare(`
    SELECT t.assignee_id, COALESCE(u.name, u.username, '未分派') AS name, COUNT(*) AS count
    FROM tickets t LEFT JOIN users u ON t.assignee_id = u.id
    GROUP BY t.assignee_id
  `).all();
}

/** 按优先级统计 */
function statsByPriority() {
  return db.prepare(`
    SELECT priority, COUNT(*) AS count FROM tickets GROUP BY priority
  `).all();
}

/**
 * SLA 达标率：已解决工单中，解决时间 <= 解决时限 的比例
 */
function statsSla() {
  const resolved = db.prepare(`
    SELECT id, ticket_no, priority, sla_resolve_due, resolved_at, created_at
    FROM tickets WHERE resolved_at IS NOT NULL
  `).all();
  let met = 0;
  let total = 0;
  for (const t of resolved) {
    if (!t.sla_resolve_due) continue;
    total += 1;
    const due = new Date(String(t.sla_resolve_due).replace(/-/g, '/'));
    const res = new Date(String(t.resolved_at).replace(/-/g, '/'));
    if (res <= due) met += 1;
  }
  const avgMin = resolved.length
    ? Math.round(resolved.reduce((sum, t) => sum + diffMinutes(t.created_at, t.resolved_at), 0) / resolved.length)
    : 0;
  return {
    resolvedCount: resolved.length,
    slaMetCount: met,
    slaRate: total ? Math.round((met / total) * 100) : null,
    avgResolveMinutes: avgMin
  };
}

/** 近 7 日每日工单数 */
function statsTrend(days = 7) {
  const rows = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
    FROM tickets
    WHERE created_at >= datetime('now','localtime', ?)
    GROUP BY day ORDER BY day
  `).all(`-${days} days`);
  return rows;
}

/** 工单统计汇总（GET /api/tickets/stats） */
function getTicketStats() {
  return {
    byStatus: statsByStatus(),
    bySystem: statsBySystem(),
    byAssignee: statsByAssignee(),
    byPriority: statsByPriority(),
    sla: statsSla(),
    trend: statsTrend(7)
  };
}

/**
 * 团队工作量（admin）—— 按用户聚合
 * @returns {Array<{userId, name, total, open, inProgress, resolved, overdue}>}
 */
function getWorkload() {
  const users = db.prepare('SELECT id, name, username, role FROM users ORDER BY role DESC, name').all();
  const rows = users.map((u) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM tickets WHERE assignee_id = ?').get(u.id).c;
    const open = db.prepare(
      "SELECT COUNT(*) AS c FROM tickets WHERE assignee_id = ? AND status IN ('open','assigned')"
    ).get(u.id).c;
    const inProgress = db.prepare(
      "SELECT COUNT(*) AS c FROM tickets WHERE assignee_id = ? AND status IN ('in_progress','pending_verify')"
    ).get(u.id).c;
    const resolved = db.prepare(
      "SELECT COUNT(*) AS c FROM tickets WHERE assignee_id = ? AND status IN ('resolved','closed')"
    ).get(u.id).c;
    const overdueTickets = db.prepare(`
      SELECT * FROM tickets
      WHERE assignee_id = ? AND resolved_at IS NULL
        AND sla_resolve_due IS NOT NULL
        AND sla_resolve_due < datetime('now','localtime')
        AND status IN ('open','assigned','in_progress','pending_verify')
    `).all(u.id);
    const overdue = overdueTickets.length;
    return {
      userId: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      total,
      open,
      inProgress,
      resolved,
      overdue
    };
  });
  return rows;
}

/** 个人待办聚合（M4 工作台 overview 的工单部分） */
function getMyTickets(userId) {
  const tickets = db.prepare(`
    SELECT t.*, u.name AS assignee_name, s.name AS system_name
    FROM tickets t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN systems s ON t.system_id = s.id
    WHERE t.assignee_id = ? OR t.reporter_id = ?
    ORDER BY t.updated_at DESC
  `).all(userId, userId);
  return attachSla(tickets);
}

module.exports = {
  getTicketStats,
  getWorkload,
  getMyTickets,
  statsByStatus
};