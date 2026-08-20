/**
 * 探活引擎（M1 核心，架构第六章）
 * - 三类探活：http / tcp / db
 * - 判定规则见 6.1
 * - 状态变化联动：告警 → 工单 → 通知 → 轻流推送（含 30 分钟去重）
 */
const net = require('net');
const { db } = require('../db');
const config = require('../config');
const { now } = require('../utils/time');
const notification = require('./notification');
const qingflow = require('./qingflow');
const { computeSlaDue } = require('./sla');

const HTTP_TIMEOUT_MS = config.HEALTH.HTTP_TIMEOUT_MS;

/** ---------- 工具：查询 ---------- */

function getSystemById(id) {
  return db.prepare('SELECT * FROM systems WHERE id = ?').get(id) || null;
}

function getLastHealth(systemId) {
  return db.prepare(`
    SELECT * FROM health_checks WHERE system_id = ? ORDER BY id DESC LIMIT 1
  `).get(systemId) || null;
}

/** 连续 down 次数（含本次） */
function consecutiveDowns(systemId) {
  const rows = db.prepare(`
    SELECT status FROM health_checks WHERE system_id = ? ORDER BY id DESC LIMIT 10
  `).all(systemId);
  let count = 0;
  for (const r of rows) {
    if (r.status === 'down') count += 1;
    else break;
  }
  return count;
}

/** 查找系统未解决告警 */
function findOpenAlerts(systemId, level) {
  let sql = `SELECT * FROM alerts WHERE system_id = ? AND status != 'resolved'`;
  const params = [systemId];
  if (level) {
    sql += ` AND level = ?`;
    params.push(level);
  }
  return db.prepare(sql).all(...params);
}

function closeOpenAlerts(systemId) {
  return db.prepare(`
    UPDATE alerts SET status = 'resolved', resolved_at = ?
    WHERE system_id = ? AND status != 'resolved'
  `).run(now(), systemId);
}

/** 生成系统负责人/邮箱信息 */
function getOwner(system) {
  if (!system.owner_id) return { id: null, email: '' };
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(system.owner_id) || null;
  return u ? { id: u.id, email: u.email || '' } : { id: null, email: '' };
}

/** ---------- 三类探活 ---------- */

/**
 * HTTP 探活：GET {base_url}{health_path}
 * 判定：状态码=expected_status → ok；4xx/5xx → warning；超时/网络错误 → down
 */
async function checkHttp(system) {
  const url = `${(system.base_url || '').replace(/\/+$/, '')}${system.health_path || '/'}`;
  const expected = system.expected_status || 200;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const elapsed = Date.now() - started;
    if (resp.status === expected) {
      return { status: 'ok', response_time: elapsed, http_code: resp.status, message: `HTTP ${resp.status}` };
    }
    if (resp.status >= 400 && resp.status < 600) {
      return { status: 'warning', response_time: elapsed, http_code: resp.status, message: `HTTP ${resp.status}（期望 ${expected}）` };
    }
    return { status: 'warning', response_time: elapsed, http_code: resp.status, message: `HTTP ${resp.status}（期望 ${expected}）` };
  } catch (err) {
    const elapsed = Date.now() - started;
    return {
      status: 'down', response_time: elapsed, http_code: null,
      message: err.name === 'AbortError' ? `请求超时(>${HTTP_TIMEOUT_MS / 1000}s)` : `网络错误: ${err.message}`
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * TCP 探活：net.connect(host, port)
 * 连接成功 → ok；失败 → down
 */
function checkTcp(system) {
  const host = system.db_host || system.base_url || '127.0.0.1';
  const port = system.db_port || 80;
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (status, message, httpCode = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ status, response_time: Date.now() - started, http_code: httpCode, message });
    };
    const timer = setTimeout(() => done('down', `连接超时(>${config.HEALTH.TCP_TIMEOUT_MS / 1000}s)`), config.HEALTH.TCP_TIMEOUT_MS);
    socket.once('connect', () => done('ok', `端口 ${port} 可达`, 200));
    socket.once('error', (err) => done('down', `连接失败: ${err.message}`));
    socket.connect(port, host);
  });
}

/**
 * DB 探活：优先使用对应驱动执行 SELECT 1；未安装驱动时回退为端口连通性检查
 * 成功 → ok；失败 → down
 */
async function checkDb(system) {
  const host = system.db_host || '127.0.0.1';
  const port = system.db_port || (system.db_type === 'postgres' ? 5432 : 3306);
  const started = Date.now();
  const driver = system.db_type || 'mysql';

  // 尝试真实驱动（mysql2 / pg 为 optionalDependencies）
  try {
    if (driver === 'mysql' || driver === 'mariadb') {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        host, port, user: 'root', password: '', connectTimeout: config.HEALTH.DB_TIMEOUT_MS
      });
      await conn.query('SELECT 1');
      await conn.end();
      return { status: 'ok', response_time: Date.now() - started, http_code: null, message: 'DB SELECT 1 成功' };
    }
    if (driver === 'postgres') {
      const pg = require('pg');
      const client = new pg.Client({ host, port, user: 'postgres', password: '', connectionTimeoutMillis: config.HEALTH.DB_TIMEOUT_MS });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return { status: 'ok', response_time: Date.now() - started, http_code: null, message: 'DB SELECT 1 成功' };
    }
  } catch (err) {
    return { status: 'down', response_time: Date.now() - started, http_code: null, message: `DB连接失败: ${err.message}` };
  }

  // sqlserver/oracle 等暂未内置驱动 → 端口连通性回退
  return checkTcp({ db_host: host, db_port: port });
}

/** ---------- 核心：单系统探活 ---------- */

/**
 * 对单个系统执行探活并入库、触发联动
 * @param {object} system systems 行
 * @param {object} [opts] { persist?: boolean, manual?: boolean }
 * @returns {Promise<object>} { check, alert, ticket, prevStatus }
 */
async function checkSystem(system, opts = {}) {
  const persist = opts.persist !== false;
  let result;
  if (system.health_type === 'tcp') {
    result = await checkTcp(system);
  } else if (system.health_type === 'db') {
    result = await checkDb(system);
  } else {
    result = await checkHttp(system);
  }

  const prev = persist ? getLastHealth(system.id) : null;
  const prevStatus = prev ? prev.status : null;

  const check = {
    system_id: system.id,
    status: result.status,
    response_time: result.response_time || null,
    http_code: result.http_code || null,
    message: result.message || '',
    checked_at: now()
  };

  let alert = null;
  let ticket = null;
  if (persist) {
    db.prepare(`
      INSERT INTO health_checks (system_id, status, response_time, http_code, message, checked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(check.system_id, check.status, check.response_time, check.http_code, check.message, check.checked_at);

    // 状态变化联动
    const linked = handleStateChange(system, check, prevStatus);
    alert = linked.alert;
    ticket = linked.ticket;
  }

  return { check, alert, ticket, prevStatus };
}

/**
 * 状态变化处理（架构 6.2 规则）
 * - ok → down: critical 告警 + 自动工单 + 推送轻流
 * - warning → down: critical 告警 + 自动工单 + 推送轻流
 * - 连续 3 次 down: 重新推送轻流（30 分钟去重）
 * - ok/warning → ok: recovered 告警 + 自动解决旧告警
 */
function handleStateChange(system, check, prevStatus) {
  const owner = getOwner(system);
  const status = check.status;

  // —— 恢复正常 ——
  if (status === 'ok') {
    if (prevStatus && prevStatus !== 'ok') {
      const closed = closeOpenAlerts(system.id);
      insertRecoveredAlert(system, check);
      notification.notifyRecovered(system, owner.id);
      console.log(`[health] ${system.code} 已恢复 (${prevStatus}->ok), 关闭告警 ${closed.changes} 条`);
    }
    return { alert: null, ticket: null };
  }

  // —— warning ——
  if (status === 'warning') {
    const existing = findOpenAlerts(system.id, 'warning');
    if (!existing.length && prevStatus !== 'warning') {
      const alert = insertAlert(system, {
        level: 'warning',
        title: `${system.name} 服务异常`,
        content: `探测返回 ${check.message}（响应 ${check.response_time || '-'}ms）`
      });
      notification.notifyAlert(alert, system, owner.id);
      console.log(`[health] ${system.code} 异常(warning): ${check.message}`);
      return { alert, ticket: null };
    }
    return { alert: null, ticket: null };
  }

  // —— down ——
  const downs = consecutiveDowns(system.id);
  const existingCritical = findOpenAlerts(system.id, 'critical');
  let alert = existingCritical[0] || null;
  let ticket = null;
  let wasNew = false;

  if (!alert) {
    // 首次宕机：创建 critical 告警 + 自动工单 + 推送
    alert = insertAlert(system, {
      level: 'critical',
      title: `${system.name} 宕机`,
      content: check.message || '系统不可达'
    });
    wasNew = true;
    console.log(`[health] ${system.code} 宕机, 创建 critical 告警 #${alert.id}`);
  }

  // 自动创建工单（首次/未关联时）
  if (wasNew || !alert.ticket_id) {
    ticket = createTicketFromAlert(alert, system);
    db.prepare('UPDATE alerts SET ticket_id = ? WHERE id = ?').run(ticket.id, alert.id);
  } else {
    ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(alert.ticket_id) || null;
  }

  notification.notifyAlert(alert, system, owner.id);

  // 推送轻流：首次 + 连续 N 次 down 且距上次推送 >= 30 分钟
  const canPush = qingflow.canPush(system.id);
  if (wasNew && canPush) {
    qingflow.pushAlert(alert, system, owner.email).catch((e) => console.error('[health] qingflow push fail', e));
  } else if (!canPush) {
    // no-op，去重
  } else if (downs >= config.HEALTH.CONSECUTIVE_DOWN_LEVEL && canPush && alert.pushed_qingflow) {
    // 连续 down 提升：再次推送（30 分钟去重由 canPush 控制）
    qingflow.pushAlert(alert, system, owner.email).catch((e) => console.error('[health] qingflow re-push fail', e));
  }

  console.log(`[health] ${system.code} down x${downs}: ${check.message}`);
  return { alert, ticket };
}

/** 插入告警 */
function insertAlert(system, { level, title, content }) {
  const info = db.prepare(`
    INSERT INTO alerts (system_id, level, title, content, status, pushed_qingflow, created_at)
    VALUES (?, ?, ?, ?, 'open', 0, ?)
  `).run(system.id, level, title, content || '', now());
  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(info.lastInsertRowid);
}

/** 插入恢复告警 */
function insertRecoveredAlert(system, check) {
  const info = db.prepare(`
    INSERT INTO alerts (system_id, level, title, content, status, created_at, resolved_at)
    VALUES (?, 'recovered', ?, ?, 'resolved', ?, ?)
  `).run(system.id, `【已恢复】${system.name}`, check.message || '系统恢复正常', now(), now());
  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(info.lastInsertRowid);
}

/** 生成工单编号 TKT-YYYYMMDD-XXX */
function nextTicketNo() {
  const today = now().slice(0, 10).replace(/-/g, '');
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM tickets WHERE ticket_no LIKE ?
  `).get(`TKT-${today}-%`);
  const seq = row.c + 1;
  return `TKT-${today}-${String(seq).padStart(3, '0')}`;
}

/**
 * 告警自动生成工单（架构 6.3：source=alert）
 */
function createTicketFromAlert(alert, system) {
  const category = system.code && ['erp', 'plm', 'qms', 'bpm'].includes(system.code) ? system.code : 'other';
  const priority = alert.level === 'critical' ? 'urgent' : 'high';
  const ticketNo = nextTicketNo();
  const created = now();
  const due = computeSlaDue(priority, created);
  const info = db.prepare(`
    INSERT INTO tickets (
      ticket_no, title, description, category, priority, status,
      system_id, reporter_id, assignee_id, source, alert_id,
      sla_response_due, sla_resolve_due, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, 'alert', ?, ?, ?, ?, ?)
  `).run(
    ticketNo,
    `【系统告警】${system.name} 宕机`,
    `探活引擎自动创建：${alert.content || ''}\n告警时间: ${alert.created_at}`,
    category, priority,
    system.id, system.owner_id || null, system.owner_id || null,
    alert.id, due.slaResponseDue, due.slaResolveDue, created, created
  );
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid);

  db.prepare(`
    INSERT INTO ticket_actions (ticket_id, action, operator_id, from_status, to_status, comment, created_at)
    VALUES (?, 'create', ?, NULL, 'open', ?, ?)
  `).run(ticket.id, system.owner_id, `告警自动生成工单（alert #${alert.id}）`, created);

  const owner = getOwner(system);
  notification.notifyTicketAssigned(ticket, owner.id ? { id: owner.id, name: '系统负责人' } : null);

  return ticket;
}

/** ---------- 全量巡检 ---------- */

/**
 * 遍历所有启用系统，按 check_interval 判断是否到期并探活
 */
async function runHealthCycle() {
  const systems = db.prepare('SELECT * FROM systems WHERE is_active = 1').all();
  const results = [];
  for (const system of systems) {
    // 距上次检查时间 >= check_interval 分钟 → 执行
    const last = getLastHealth(system.id);
    if (last && last.checked_at) {
      const lastDate = new Date(String(last.checked_at).replace(/-/g, '/')).getTime();
      const intervalMs = (system.check_interval || 5) * 60 * 1000;
      if (Date.now() - lastDate < intervalMs) continue;
    }
    try {
      const r = await checkSystem(system, { persist: true, manual: false });
      results.push({ systemId: system.id, code: system.code, ...r.check });
    } catch (err) {
      console.error(`[health] ${system.code} 探活失败:`, err.message);
    }
  }
  return results;
}

/** 手动触发单个系统探活（同步等待结果） */
async function manualCheck(systemId) {
  const system = getSystemById(systemId);
  if (!system) return null;
  return checkSystem(system, { persist: true, manual: true });
}

module.exports = {
  checkSystem,
  checkHttp,
  checkTcp,
  checkDb,
  runHealthCycle,
  manualCheck,
  getLastHealth,
  consecutiveDowns,
  nextTicketNo,
  createTicketFromAlert
};