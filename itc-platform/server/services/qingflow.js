/**
 * 轻流 Q-Source 推送服务
 * 复用现有模式：POST {baseUrl}/api/qsource/{qsourceId}
 * 字段映射：bt/ms/zrr/yxj/jzrq/ssxm/zht
 * 约定（架构 10.7）：所有对外推送集中在 services/qingflow.js，业务代码不直接调 API
 */
const { db } = require('../db');
const { QFLOW_FIELDS } = require('../config');
const { now } = require('../utils/time');

const QFLOW_TIMEOUT_MS = 10000;

/** 读取轻流配置 */
function getQingflowConfig() {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all(
    'qingflow_base_url', 'qingflow_qsource_id'
  );
  const map = {};
  for (const r of rows) map[r.key] = r.value || '';
  return {
    baseUrl: (map.qingflow_base_url || '').trim().replace(/\/+$/, ''),
    qsourceId: (map.qingflow_qsource_id || '').trim()
  };
}

function isConfigured() {
  const { baseUrl, qsourceId } = getQingflowConfig();
  return Boolean(baseUrl && qsourceId);
}

/**
 * 底层请求（带超时，失败仅 log 不抛错，避免拖垮主流程）
 * @returns {{ok:boolean, skipped?:boolean, status?:number, data?:any, error?:string}}
 */
async function qingflowRequest(method, url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QFLOW_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    let body = null;
    try { body = await resp.json(); } catch (e) { body = null; }
    if (!resp.ok) {
      console.warn(`[qingflow] 请求失败 ${resp.status}: ${url}`);
      return { ok: false, status: resp.status, data: body, error: `HTTP ${resp.status}` };
    }
    return { ok: true, status: resp.status, data: body };
  } catch (err) {
    console.warn(`[qingflow] 推送异常: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** 标记告警已推送 */
function markAlertPushed(alertId) {
  db.prepare('UPDATE alerts SET pushed_qingflow = 1 WHERE id = ?').run(alertId);
}

/**
 * 记录“同系统 critical 最近一次推送时间”到 settings
 * @param {number} systemId
 */
function recordPushTime(systemId) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(`last_qingflow_push_${systemId}`, now(), now());
}

/**
 * 去重判断：同系统 critical 每 30 分钟最多推 1 次
 * @param {number} systemId
 * @returns {boolean} true=允许推送
 */
function canPush(systemId) {
  const cfg = require('../config');
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`last_qingflow_push_${systemId}`);
  if (!row || !row.value) return true;
  const last = require('../utils/time').parseDateTime(row.value);
  if (!last) return true;
  return Date.now() - last.getTime() >= cfg.HEALTH.QINGFLOW_DEDUP_MS;
}

/**
 * 推送系统告警（架构 7.1 pushAlert）
 * @param {object} alert   alerts 行
 * @param {object} system  systems 行
 * @param {string} ownerEmail 负责人邮箱（zrr）
 * @returns {Promise<{ok:boolean, skipped?:boolean, message?:string}>}
 */
async function pushAlert(alert, system, ownerEmail) {
  const config = getQingflowConfig();
  if (!config.baseUrl || !config.qsourceId) {
    console.log('[qingflow] 未配置轻流，跳过告警推送（alertId=%s system=%s）', alert.id, system.code);
    return { ok: true, skipped: true, message: '轻流未配置，已跳过' };
  }
  const payload = {
    [QFLOW_FIELDS.title]: `【系统告警】${system.name} ${alert.level === 'critical' ? '宕机' : '异常'}`,
    [QFLOW_FIELDS.desc]: `${alert.content || ''}\n系统: ${system.name}\n时间: ${alert.created_at}`,
    [QFLOW_FIELDS.assignee]: ownerEmail || '',
    [QFLOW_FIELDS.priority]: alert.level === 'critical' ? 'urgent' : 'high',
    [QFLOW_FIELDS.dueDate]: '',
    [QFLOW_FIELDS.project]: '信息化中心管理平台',
    [QFLOW_FIELDS.status]: '待处理'
  };
  const url = `${config.baseUrl}/api/qsource/${config.qsourceId}`;
  const result = await qingflowRequest('POST', url, payload);
  if (result.ok) {
    markAlertPushed(alert.id);
    recordPushTime(system.id);
    console.log('[qingflow] 告警推送成功 alertId=%s system=%s', alert.id, system.code);
    return { ok: true, message: '推送成功' };
  }
  return { ok: false, message: result.error || '推送失败' };
}

/**
 * 工单解决后的恢复推送（可选功能，架构 6.3 可选）
 */
async function pushRecovered(system, ownerEmail, content) {
  const config = getQingflowConfig();
  if (!config.baseUrl || !config.qsourceId) {
    console.log('[qingflow] 未配置轻流，跳过恢复推送');
    return { ok: true, skipped: true };
  }
  const payload = {
    [QFLOW_FIELDS.title]: `【系统恢复】${system.name}`,
    [QFLOW_FIELDS.desc]: `${content || '系统服务已恢复'}\n系统: ${system.name}\n时间: ${now()}`,
    [QFLOW_FIELDS.assignee]: ownerEmail || '',
    [QFLOW_FIELDS.priority]: 'normal',
    [QFLOW_FIELDS.dueDate]: '',
    [QFLOW_FIELDS.project]: '信息化中心管理平台',
    [QFLOW_FIELDS.status]: '已完成'
  };
  return qingflowRequest('POST', `${config.baseUrl}/api/qsource/${config.qsourceId}`, payload);
}

/**
 * 测试连接：推送一条测试消息
 * @returns {Promise<{ok:boolean, skipped?:boolean, message?:string}>}
 */
async function testConnection() {
  const config = getQingflowConfig();
  if (!config.baseUrl || !config.qsourceId) {
    return { ok: false, skipped: true, message: '请先填写并保存轻流地址与 Q-Source ID' };
  }
  const payload = {
    [QFLOW_FIELDS.title]: '【信息化平台测试】连接测试',
    [QFLOW_FIELDS.desc]: `这是一条来自信息化中心管理平台的测试消息。\n时间: ${now()}`,
    [QFLOW_FIELDS.assignee]: '',
    [QFLOW_FIELDS.priority]: 'normal',
    [QFLOW_FIELDS.dueDate]: '',
    [QFLOW_FIELDS.project]: '信息化中心管理平台',
    [QFLOW_FIELDS.status]: '待处理'
  };
  const result = await qingflowRequest('POST', `${config.baseUrl}/api/qsource/${config.qsourceId}`, payload);
  if (result.ok) {
    return { ok: true, message: '连接成功，测试消息已推送' };
  }
  return { ok: false, message: `连接失败: ${result.error || '未知错误'}` };
}

module.exports = {
  getQingflowConfig,
  isConfigured,
  qingflowRequest,
  pushAlert,
  pushRecovered,
  testConnection,
  markAlertPushed,
  recordPushTime,
  canPush
};