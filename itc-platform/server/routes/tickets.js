/**
 * M2 工单路由
 * GET    /api/tickets                列表（filter: status/assignee/category/priority/keyword）
 * POST   /api/tickets                创建
 * GET    /api/tickets/stats          统计
 * GET    /api/tickets/:id            详情
 * PUT    /api/tickets/:id            更新（标题/描述/优先级/分类）
 * POST   /api/tickets/:id/assign     分派
 * POST   /api/tickets/:id/status     状态流转
 * POST   /api/tickets/:id/comment    添加评论
 * DELETE /api/tickets/:id            删除（仅 admin）
 */
const express = require('express');
const { db } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { computeSlaDue, attachSla } = require('../services/sla');
const { getTicketStats } = require('../services/stats');
const { notifyTicketAssigned, notifyTicketStatus } = require('../services/notification');
const { VALID_TRANSITIONS, TICKET_CATEGORIES } = require('../constants');
const { now } = require('../utils/time');

const router = express.Router();
router.use(authRequired);

/** 生成工单编号 TKT-YYYYMMDD-XXX */
function nextTicketNo() {
  const today = now().slice(0, 10).replace(/-/g, '');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE ticket_no LIKE ?`).get(`TKT-${today}-%`);
  return `TKT-${today}-${String(row.c + 1).padStart(3, '0')}`;
}

/** 工单基础查询（含关联名称） */
const TICKET_SELECT = `
  SELECT t.*, u.name AS assignee_name, r.name AS reporter_name, s.name AS system_name,
         s.code AS system_code
  FROM tickets t
  LEFT JOIN users u ON t.assignee_id = u.id
  LEFT JOIN users r ON t.reporter_id = r.id
  LEFT JOIN systems s ON t.system_id = s.id
`;

/** 组装工单列表（附加 SLA 评估） */
function listTickets({ status, assignee, category, priority, keyword, system_id }) {
  let sql = TICKET_SELECT + ' WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (assignee) { sql += ' AND t.assignee_id = ?'; params.push(Number(assignee)); }
  if (category) { sql += ' AND t.category = ?'; params.push(category); }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
  if (system_id) { sql += ' AND t.system_id = ?'; params.push(Number(system_id)); }
  if (keyword) {
    sql += ' AND (t.title LIKE ? OR t.ticket_no LIKE ? OR t.description LIKE ? OR t.tags LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }
  sql += ' ORDER BY t.id DESC LIMIT 500';
  return attachSla(db.prepare(sql).all(...params));
}

/** 工单列表 */
router.get('/', (req, res, next) => {
  try {
    const q = req.query;
    const tickets = listTickets({
      status: q.status, assignee: q.assignee, category: q.category,
      priority: q.priority, keyword: q.keyword, system_id: q.system_id
    });
    res.json({ success: true, data: { tickets } });
  } catch (err) {
    next(err);
  }
});

/** 统计 */
router.get('/stats', (req, res, next) => {
  try {
    res.json({ success: true, data: getTicketStats() });
  } catch (err) {
    next(err);
  }
});

/** 创建工单 */
router.post('/', (req, res, next) => {
  try {
    const b = req.body || {};
    const title = (b.title || '').trim();
    if (!title) throw AppError.validation('工单标题不能为空');
    const category = TICKET_CATEGORIES.includes(b.category) ? b.category : 'other';
    const priority = ['low', 'medium', 'high', 'urgent'].includes(b.priority) ? b.priority : 'medium';
    const status = b.status && VALID_TRANSITIONS.open.includes(b.status) ? b.status : 'open';
    const ticketNo = nextTicketNo();
    const created = now();
    const due = computeSlaDue(priority, created);

    let alertId = null;
    if (b.alert_id) {
      const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(Number(b.alert_id));
      if (alert) alertId = alert.id;
    }

    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO tickets (
          ticket_no, title, description, category, priority, status,
          system_id, reporter_id, assignee_id, source, alert_id,
          sla_response_due, sla_resolve_due, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticketNo, title, b.description || '', category, priority, status,
        b.system_id || null, req.user.id, b.assignee_id || null, b.source || 'web',
        alertId, due.slaResponseDue, due.slaResolveDue, b.tags || '', created, created
      );
      const id = info.lastInsertRowid;
      db.prepare(`
        INSERT INTO ticket_actions (ticket_id, action, operator_id, from_status, to_status, comment, created_at)
        VALUES (?, 'create', ?, NULL, ?, ?, ?)
      `).run(id, req.user.id, status, b.description ? `创建工单: ${title}` : `创建工单: ${title}`, created);
      return db.prepare(TICKET_SELECT + ' WHERE t.id = ?').get(id);
    });
    const ticket = tx();

    if (ticket.assignee_id) {
      const assignee = db.prepare('SELECT * FROM users WHERE id = ?').get(ticket.assignee_id);
      notifyTicketAssigned(ticket, assignee || null);
    }
    res.status(201).json({ success: true, data: { ticket } });
  } catch (err) {
    next(err);
  }
});

/** 工单详情（含操作记录） */
router.get('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ticket = db.prepare(TICKET_SELECT + ' WHERE t.id = ?').get(id);
    if (!ticket) throw AppError.notFound('TICKET_NOT_FOUND', '工单不存在');
    const actions = db.prepare(`
      SELECT a.*, u.name AS operator_name
      FROM ticket_actions a LEFT JOIN users u ON a.operator_id = u.id
      WHERE a.ticket_id = ? ORDER BY a.id DESC
    `).all(id);
    const alert = ticket.alert_id ? db.prepare('SELECT * FROM alerts WHERE id = ?').get(ticket.alert_id) : null;
    const system = ticket.system_id ? db.prepare('SELECT * FROM systems WHERE id = ?').get(ticket.system_id) : null;
    res.json({
      success: true,
      data: { ticket: { ...attachSla([ticket])[0] }, actions, alert, system }
    });
  } catch (err) {
    next(err);
  }
});

/** 更新工单（标题/描述/优先级/分类/系统等） */
router.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('TICKET_NOT_FOUND', '工单不存在');

    const title = b.title !== undefined ? (b.title || '').trim() : existing.title;
    if (!title) throw AppError.validation('工单标题不能为空');
    const priority = b.priority !== undefined
      ? (['low', 'medium', 'high', 'urgent'].includes(b.priority) ? b.priority : existing.priority)
      : existing.priority;

    db.prepare(`
      UPDATE tickets SET
        title = ?, description = ?, priority = ?, category = ?,
        system_id = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      b.description !== undefined ? b.description : existing.description,
      priority,
      b.category !== undefined ? (TICKET_CATEGORIES.includes(b.category) ? b.category : existing.category) : existing.category,
      b.system_id !== undefined ? (b.system_id || null) : existing.system_id,
      b.tags !== undefined ? b.tags : existing.tags,
      now(), id
    );
    const ticket = db.prepare(TICKET_SELECT + ' WHERE t.id = ?').get(id);
    res.json({ success: true, data: { ticket } });
  } catch (err) {
    next(err);
  }
});

/** 分派 */
router.post('/:id/assign', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const assigneeId = Number(req.body && req.body.assigneeId);
    if (!assigneeId) throw AppError.validation('请选择处理人');
    const assignee = db.prepare('SELECT * FROM users WHERE id = ?').get(assigneeId);
    if (!assignee) throw AppError.validation('处理人不存在');

    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('TICKET_NOT_FOUND', '工单不存在');

    const tx = db.transaction(() => {
      db.prepare('UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?').run(assigneeId, now(), id);
      db.prepare(`
        INSERT INTO ticket_actions (ticket_id, action, operator_id, from_status, to_status, comment, created_at)
        VALUES (?, 'assign', ?, ?, ?, ?, ?)
      `).run(id, req.user.id, existing.status,
        existing.assignee_id ? 'assigned' : existing.status,
        `分派给 ${assignee.name}`, now());
      // 待处理 → 已分派
      if (existing.status === 'open') {
        db.prepare("UPDATE tickets SET status = 'assigned', updated_at = ? WHERE id = ?").run(now(), id);
      }
    });
    tx();

    const ticket = db.prepare(TICKET_SELECT + ' WHERE t.id = ?').get(id);
    notifyTicketAssigned(ticket, assignee);
    res.json({ success: true, data: { ticket } });
  } catch (err) {
    next(err);
  }
});

/** 状态流转 */
router.post('/:id/status', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { toStatus, comment } = req.body || {};
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('TICKET_NOT_FOUND', '工单不存在');
    if (!toStatus) throw AppError.validation('缺少目标状态');

    const allowed = VALID_TRANSITIONS[existing.status] || [];
    const isReopen = existing.status === 'closed' && toStatus === 'in_progress';
    if (!allowed.includes(toStatus) && !(toStatus === 'in_progress' && isReopen)) {
      throw AppError.validation(
        `不允许从“${existing.status}”流转到“${toStatus}”（合法: ${allowed.join(', ')}）`, 'INVALID_STATUS_TRANSITION'
      );
    }

    const tNow = now();
    let responseAt = existing.response_at;
    let resolvedAt = existing.resolved_at;
    let closedAt = existing.closed_at;
    if (toStatus === 'in_progress' && !responseAt) responseAt = tNow;
    if (toStatus === 'resolved') resolvedAt = tNow;
    if (toStatus === 'closed') { resolvedAt = resolvedAt || tNow; closedAt = tNow; }
    if (toStatus === 'open') closedAt = null;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE tickets SET status = ?, response_at = ?, resolved_at = ?, closed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(toStatus, responseAt, resolvedAt, closedAt, tNow, id);
      db.prepare(`
        INSERT INTO ticket_actions (ticket_id, action, operator_id, from_status, to_status, comment, created_at)
        VALUES (?, 'status_change', ?, ?, ?, ?, ?)
      `).run(id, req.user.id, existing.status, toStatus, comment || '', tNow);

      // 工单解决 → 联动关闭关联告警
      if (toStatus === 'resolved' && existing.alert_id) {
        db.prepare("UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE id = ? AND status != 'resolved'")
          .run(tNow, existing.alert_id);
      }
    });
    tx();

    const ticket = db.prepare(TICKET_SELECT + ' WHERE t.id = ?').get(id);
    notifyTicketStatus(ticket, toStatus, { name: req.user.name, username: req.user.username });
    if (toStatus === 'resolved' || toStatus === 'closed') {
      // 可选：轻流恢复推送（架构 6.3 可选）
      const qingflow = require('../services/qingflow');
      const system = ticket.system_id ? db.prepare('SELECT * FROM systems WHERE id = ?').get(ticket.system_id) : null;
      if (system && ticket.assignee_id) {
        const assignee = db.prepare('SELECT * FROM users WHERE id = ?').get(ticket.assignee_id);
        qingflow.pushRecovered(system, assignee ? assignee.email : '', ticket.solution || ticket.title)
          .catch((e) => console.error('[tickets] 恢复推送失败', e.message));
      }
    }
    res.json({ success: true, data: { ticket } });
  } catch (err) {
    next(err);
  }
});

/** 添加评论 */
router.post('/:id/comment', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const text = (req.body && req.body.comment || '').trim();
    if (!text) throw AppError.validation('评论内容不能为空');
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('TICKET_NOT_FOUND', '工单不存在');
    const info = db.prepare(`
      INSERT INTO ticket_actions (ticket_id, action, operator_id, from_status, to_status, comment, created_at)
      VALUES (?, 'comment', ?, ?, ?, ?, ?)
    `).run(id, req.user.id, existing.status, existing.status, text, now());
    db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(now(), id);
    const action = db.prepare(`
      SELECT a.*, u.name AS operator_name FROM ticket_actions a
      LEFT JOIN users u ON a.operator_id = u.id WHERE a.id = ?
    `).get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: { action } });
  } catch (err) {
    next(err);
  }
});

/** 删除（仅 admin） */
router.delete('/:id', adminRequired, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('TICKET_NOT_FOUND', '工单不存在');
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM ticket_actions WHERE ticket_id = ?').run(id);
      db.prepare('UPDATE alerts SET ticket_id = NULL WHERE ticket_id = ?').run(id);
      db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    });
    tx();
    res.json({ success: true, data: { message: '工单已删除' } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;