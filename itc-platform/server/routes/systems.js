/**
 * M1 系统档案路由
 */
const express = require('express');
const { db } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const healthCheck = require('../services/healthCheck');
const { now } = require('../utils/time');

const router = express.Router();
router.use(authRequired);

/** 系统列表（含最新健康状态、负责人、未解决告警数） */
router.get('/', (req, res, next) => {
  try {
    const systems = db.prepare(`
      SELECT
        s.*,
        u.name AS owner_name,
        hc.status AS latest_status,
        hc.response_time AS last_response_time,
        hc.http_code AS last_http_code,
        hc.message AS last_message,
        hc.checked_at AS last_checked_at,
        (SELECT COUNT(*) FROM alerts a WHERE a.system_id = s.id AND a.status != 'resolved') AS open_alert_count
      FROM systems s
      LEFT JOIN users u ON s.owner_id = u.id
      LEFT JOIN health_checks hc ON hc.id = (
        SELECT h.id FROM health_checks h WHERE h.system_id = s.id ORDER BY h.id DESC LIMIT 1
      )
      ORDER BY
        CASE WHEN hc.status = 'down' THEN 0 WHEN hc.status = 'warning' THEN 1 ELSE 2 END,
        s.id ASC
    `).all();
    res.json({ success: true, data: { systems } });
  } catch (err) {
    next(err);
  }
});

/** 新增系统档案 */
router.post('/', (req, res, next) => {
  try {
    const b = req.body || {};
    const name = (b.name || '').trim();
    const code = (b.code || '').trim().toLowerCase();
    if (!name) throw AppError.validation('系统名称不能为空');
    if (!code) throw AppError.validation('系统编码不能为空');

    const exists = db.prepare('SELECT id FROM systems WHERE code = ?').get(code);
    if (exists) throw AppError.validation(`系统编码 ${code} 已存在`);

    const healthType = ['http', 'tcp', 'db'].includes(b.health_type) ? b.health_type : 'http';
    const info = db.prepare(`
      INSERT INTO systems (
        name, code, version, base_url, health_type, health_path,
        db_host, db_port, db_type, expected_status, check_interval,
        owner_id, vendor, description, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, code, b.version || '', b.base_url || '', healthType, b.health_path || '',
      b.db_host || null, b.db_port || null, b.db_type || null,
      b.expected_status || 200, Number(b.check_interval) || 5,
      b.owner_id || null, b.vendor || '', b.description || '',
      b.is_active === undefined ? 1 : (b.is_active ? 1 : 0), now()
    );
    const system = db.prepare('SELECT * FROM systems WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: { system } });
  } catch (err) {
    next(err);
  }
});

/** 系统详情 */
router.get('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const system = db.prepare(`
      SELECT s.*, u.name AS owner_name
      FROM systems s LEFT JOIN users u ON s.owner_id = u.id WHERE s.id = ?
    `).get(id);
    if (!system) throw AppError.notFound('SYSTEM_NOT_FOUND', '系统不存在');
    const last = healthCheck.getLastHealth(id);
    res.json({ success: true, data: { system, latest: last } });
  } catch (err) {
    next(err);
  }
});

/** 更新系统档案 */
router.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const existing = db.prepare('SELECT * FROM systems WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('SYSTEM_NOT_FOUND', '系统不存在');

    const code = (b.code || existing.code).trim().toLowerCase();
    const dup = db.prepare('SELECT id FROM systems WHERE code = ? AND id != ?').get(code, id);
    if (dup) throw AppError.validation(`系统编码 ${code} 已存在`);

    db.prepare(`
      UPDATE systems SET
        name = ?, code = ?, version = ?, base_url = ?, health_type = ?,
        health_path = ?, db_host = ?, db_port = ?, db_type = ?, expected_status = ?,
        check_interval = ?, owner_id = ?, vendor = ?, description = ?, is_active = ?
      WHERE id = ?
    `).run(
      (b.name || existing.name).trim(), code, b.version ?? existing.version,
      b.base_url ?? existing.base_url, b.health_type || existing.health_type,
      b.health_path ?? existing.health_path, b.db_host ?? existing.db_host,
      b.db_port ?? existing.db_port, b.db_type ?? existing.db_type,
      b.expected_status ?? existing.expected_status, Number(b.check_interval) || existing.check_interval,
      b.owner_id ?? existing.owner_id, b.vendor ?? existing.vendor,
      b.description ?? existing.description,
      b.is_active === undefined ? existing.is_active : (b.is_active ? 1 : 0),
      id
    );
    const system = db.prepare('SELECT * FROM systems WHERE id = ?').get(id);
    res.json({ success: true, data: { system } });
  } catch (err) {
    next(err);
  }
});

/** 删除系统（仅 admin，级联清理探活/告警/通知关联由外键约束处理） */
router.delete('/:id', adminRequired, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM systems WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('SYSTEM_NOT_FOUND', '系统不存在');
    const ticketCount = db.prepare('SELECT COUNT(*) AS c FROM tickets WHERE system_id = ?').get(id).c;
    if (ticketCount > 0) {
      throw AppError.validation(`该系统下存在 ${ticketCount} 张工单，无法删除（可改为停用）`);
    }
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM health_checks WHERE system_id = ?').run(id);
      db.prepare('DELETE FROM alerts WHERE system_id = ?').run(id);
      db.prepare('DELETE FROM systems WHERE id = ?').run(id);
    });
    tx();
    res.json({ success: true, data: { message: '系统已删除' } });
  } catch (err) {
    next(err);
  }
});

/** 手动触发单系统探活 */
router.post('/:id/check', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const system = db.prepare('SELECT * FROM systems WHERE id = ?').get(id);
    if (!system) throw AppError.notFound('SYSTEM_NOT_FOUND', '系统不存在');
    const result = await healthCheck.manualCheck(id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** 探活历史（最近 N 条，默认 20） */
router.get('/:id/history', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const existing = db.prepare('SELECT id FROM systems WHERE id = ?').get(id);
    if (!existing) throw AppError.notFound('SYSTEM_NOT_FOUND', '系统不存在');
    const history = db.prepare(`
      SELECT * FROM health_checks WHERE system_id = ? ORDER BY id DESC LIMIT ?
    `).all(id, limit);
    res.json({ success: true, data: { history: history.reverse() } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;