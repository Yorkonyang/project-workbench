/**
 * 通知中心路由
 * GET  /api/notifications             我的通知列表
 * POST /api/notifications/:id/read    标记已读
 * POST /api/notifications/read-all    全部已读
 */
const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const { AppError } = require('../utils/errors');

const router = express.Router();
router.use(authRequired);

/** 我的通知（未读优先） */
router.get('/', (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const notifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id = ?
      ORDER BY is_read ASC, id DESC LIMIT ?
    `).all(req.user.id, limit);
    const unread = db.prepare(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user.id).c;
    res.json({ success: true, data: { notifications, unreadCount: unread } });
  } catch (err) {
    next(err);
  }
});

/** 标记单条已读 */
router.post('/:id/read', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const n = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!n) throw AppError.notFound('NOTIFICATION_NOT_FOUND', '通知不存在');
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true, data: { notification: { ...n, is_read: 1 } } });
  } catch (err) {
    next(err);
  }
});

/** 全部已读 */
router.post('/read-all', (req, res, next) => {
  try {
    const info = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
    res.json({ success: true, data: { updated: info.changes } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;