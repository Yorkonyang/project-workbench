/**
 * 共享状态枚举（4.2 节）—— 前后端唯一权威
 * 注意：web/src/constants.js 与此保持一致
 */
const TICKET_STATUS = {
  open: '待处理',
  assigned: '已分派',
  in_progress: '处理中',
  pending_verify: '待验证',
  resolved: '已解决',
  closed: '已关闭'
};

const SYSTEM_HEALTH = { ok: '正常', warning: '告警', down: '宕机' };

const ALERT_LEVEL = { critical: '严重', warning: '警告', recovered: '已恢复' };

const PRIORITY = { low: '低', medium: '中', high: '高', urgent: '紧急' };

const ALERT_STATUS = { open: '待处理', acknowledged: '已确认', resolved: '已解决' };

/** 工单状态机合法流转 */
const VALID_TRANSITIONS = {
  open: ['assigned', 'in_progress', 'resolved', 'closed'],
  assigned: ['in_progress', 'open', 'resolved', 'closed'],
  in_progress: ['pending_verify', 'resolved', 'open', 'closed'],
  pending_verify: ['resolved', 'in_progress', 'open', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress']
};

/** 工单分类 */
const TICKET_CATEGORIES = [
  'erp', 'plm', 'qms', 'mes', 'bpm', 'network', 'hardware', 'other'
];

const CATEGORY_LABELS = {
  erp: 'ERP', plm: 'PLM', qms: 'QMS', mes: 'MES/MOM',
  bpm: 'BPM', network: '网络', hardware: '硬件', other: '其他'
};

module.exports = {
  TICKET_STATUS,
  SYSTEM_HEALTH,
  ALERT_LEVEL,
  PRIORITY,
  ALERT_STATUS,
  VALID_TRANSITIONS,
  TICKET_CATEGORIES,
  CATEGORY_LABELS
};