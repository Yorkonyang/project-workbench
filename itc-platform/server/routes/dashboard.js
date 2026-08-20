/**
 * M4 工作台路由
 * GET /api/dashboard/overview 个人待办聚合
 * GET /api/dashboard/workload 团队工作量（仅 admin）
 */
const express = require('express');
const { db } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { getMyTickets, getWorkload } = require('../services/stats');
const { countUnread } = require('../services/notification');
const { attachSla } = require('../services/sla');

const router = express.Router();
router.use(authRequired);

/** 个人仪表盘聚合 */
router.get('/overview', (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const myTickets = getMyTickets(userId);
    const myTodayTickets = myTickets.filter((t) => String(t.created_at || '').startsWith(String(today)));

    const openAlerts = db.prepare(`
      SELECT a.*, s.name AS system_name, s.code AS system_code, s.owner_id
      FROM alerts a LEFT JOIN systems s ON a.system_id = s.id
      WHERE a.status != 'resolved' ORDER BY a.id DESC LIMIT 20
    `).all();

    const mySystemAlerts = db.prepare(`
      SELECT a.*, s.name AS system_name, s.code AS system_code
      FROM alerts a JOIN systems s ON a.system_id = s.id
      WHERE s.owner_id = ? AND a.status != 'resolved'
      ORDER BY a.id DESC LIMIT 20
    `).all(userId);

    const unreadNotifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY id DESC LIMIT 10
    `).all(userId);

    const ticketsByStatus = db.prepare(`
      SELECT status, COUNT(*) AS count FROM tickets GROUP BY status
    `).all();

    const systemsSummary = db.prepare(`
      SELECT COALESCE(h.status, 'unknown') AS status, COUNT(*) AS count
      FROM systems s
      LEFT JOIN health_checks h ON h.id = (
        SELECT h2.id FROM health_checks h2 WHERE h2.system_id = s.id ORDER BY h2.id DESC LIMIT 1
      )
      GROUP BY status
    `).all();

    const summary = { ok: 0, warning: 0, down: 0, unknown: 0 };
    for (const r of systemsSummary) if (summary[r.status] !== undefined) summary[r.status] = r.count;

    const overdue = myTickets.filter((t) => t.slaStatus === 'overdue');

    res.json({
      success: true,
      data: {
        myTickets: attachSla(myTickets.slice(0, 20)),
        myTodayCount: myTodayTickets.length,
        myOpenCount: myTickets.filter((t) => ['open', 'assigned', 'in_progress', 'pending_verify'].includes(t.status)).length,
        overdueCount: overdue.length,
        openAlerts,
        mySystemAlerts,
        unreadCount: countUnread(userId),
        recentNotifications: unreadNotifications,
        ticketsByStatus,
        systemsSummary: summary
      }
    });
  } catch (err) {
    next(err);
  }
});

/** 团队工作量（admin） */
router.get('/workload', adminRequired, (req, res, next) => {
  try {
    res.json({ success: true, data: { rows: getWorkload() } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;