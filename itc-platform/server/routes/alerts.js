/**
 * M1 告警路由
 * GET  /api/alerts                告警列表（filter: status/level/system_id）
 * POST /api/alerts/:id/acknowledge 确认告警
 * POST /api/alerts/:id/resolve     关闭告警（联动工单状态回写）
 */
const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { now } = require('../utils/time');

const router = express.Router();
router.use(authRequired);

/** 告警列表（开放告警在前） */
router.get('/', (req, res, next) => {
  try {
    const { status, level, system_id } = req.query;
    let sql = `
      SELECT a.*, s.name AS system_name, s.code AS system_code, s.owner_id,
             t.ticket_no AS linked_ticket_no
      FROM alerts a
      LEFT JOIN systems s ON a.system_id = s.id
      LEFT JOIN tickets t ON a.ticket_id = t.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (level) { sql += ' AND a.level = ?'; params.push(level); }
    if (system_id) { sql += ' AND a.system_id = ?'; params.push(Number(system_id)); }
    sql += ` ORDER BY CASE a.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END, a.id DESC LIMIT 200`;
    const alerts = db.prepare(sql).all(...params);
    res.json({ success: true, data: { alerts } });
  } catch (err) {
    next(err);
  }
});

/** 确认告警 */
router.post('/:id/acknowledge', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    if (!alert) throw AppError.notFound('ALERT_NOT_FOUND', '告警不存在');
    db.prepare("UPDATE alerts SET status = 'acknowledged' WHERE id = ?").run(id);
    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    res.json({ success: true, data: { alert: updated } });
  } catch (err) {
    next(err);
  }
});

/** 关闭告警（如有关联工单且工单未关闭，则自动将工单置为 resolved） */
router.post('/:id/resolve', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    if (!alert) throw AppError.notFound('ALERT_NOT_FOUND', '告警不存在');

    const tx = db.transaction(() => {
      db.prepare("UPDATE alerts SET status = 'resolved', resolved_at = ? WHERE id = ?")
        .run(now(), id);

      if (alert.ticket_id) {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(alert.ticket_id);
        if (ticket && ticket.status !== 'closed' && ticket.status !== 'resolved') {
          const tNow = now();
          db.prepare(`
            UPDATE tickets SET status = 'resolved', resolved_at = ?, updated_at = ?
            WHERE id = ?
          `).run(tNow, tNow, ticket.id);
          db.prepare(`
            INSERT INTO ticket_actions (ticket_id, action, operator_id, from_status, to_status, comment, created_at)
            VALUES (?, 'status_change', ?, ?, 'resolved', '告警关闭联动工单解决', ?)
          `).run(ticket.id, req.user.id, ticket.status, tNow);
        }
      }
    });
    tx();

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    res.json({ success: true, data: { alert: updated } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;