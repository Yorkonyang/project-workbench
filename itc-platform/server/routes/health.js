/**
 * 健康路由
 * GET /api/health          —— 自探活接口（系统档案可指向此地址演示 ok）
 * GET /api/health/overview —— 健康总览（各状态数量，供看板/横幅使用）
 */
const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/** 自探活（无需登录，种子系统指向此地址） */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'itc-platform-server',
      status: 'ok',
      time: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

/** 健康总览（需登录） */
router.get('/overview', authRequired, (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT COALESCE(h.status, 'unknown') AS status, COUNT(*) AS count
      FROM systems s
      LEFT JOIN health_checks h ON h.id = (
        SELECT h2.id FROM health_checks h2 WHERE h2.system_id = s.id ORDER BY h2.id DESC LIMIT 1
      )
      GROUP BY status
    `).all();
    const summary = { ok: 0, warning: 0, down: 0, unknown: 0 };
    for (const r of rows) {
      if (summary[r.status] !== undefined) summary[r.status] = r.count;
    }
    res.json({ success: true, data: { summary } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;