/**
 * 设置路由（轻流配置等）
 * GET  /api/settings
 * PUT  /api/settings
 * POST /api/settings/test-qingflow 测试轻流连接
 */
const express = require('express');
const { db } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const qingflow = require('../services/qingflow');
const { now } = require('../utils/time');

const router = express.Router();
router.use(authRequired);

function allSettings() {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const map = {};
  for (const r of rows) {
    // 去掉内部去重标记键，避免泄露
    if (r.key.startsWith('last_qingflow_push_')) continue;
    map[r.key] = r.value;
  }
  return map;
}

/** 获取设置 */
router.get('/', (req, res, next) => {
  try {
    res.json({ success: true, data: { settings: allSettings() } });
  } catch (err) {
    next(err);
  }
});

/** 更新设置（仅 admin，支持批量 {key: value}） */
router.put('/', adminRequired, (req, res, next) => {
  try {
    const body = req.body || {};
    const entries = body.settings || body;
    if (typeof entries !== 'object' || Array.isArray(entries)) {
      throw AppError.validation('设置格式错误');
    }
    const t = now();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        if (key.startsWith('last_qingflow_push_')) continue; // 内部键不可写
        stmt.run(key, value == null ? '' : String(value), t);
      }
    });
    tx();
    res.json({ success: true, data: { settings: allSettings() } });
  } catch (err) {
    next(err);
  }
});

/** 测试轻流连接（仅 admin） */
router.post('/test-qingflow', adminRequired, async (req, res, next) => {
  try {
    const result = await qingflow.testConnection();
    if (result.ok) {
      res.json({ success: true, data: { result } });
    } else {
      res.status(400).json({ success: false, error: { code: 'QINGFLOW_TEST_FAILED', message: result.message } });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;