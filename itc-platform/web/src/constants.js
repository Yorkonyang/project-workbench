// 共享状态枚举 —— 必须与 server/constants.js 保持一致
export const TICKET_STATUS = {
  open: '待处理',
  assigned: '已分派',
  in_progress: '处理中',
  pending_verify: '待验证',
  resolved: '已解决',
  closed: '已关闭'
};

export const SYSTEM_HEALTH = { ok: '正常', warning: '告警', down: '宕机' };

export const ALERT_LEVEL = { critical: '严重', warning: '警告', recovered: '已恢复' };

export const PRIORITY = { low: '低', medium: '中', high: '高', urgent: '紧急' };

export const ALERT_STATUS = { open: '待处理', acknowledged: '已确认', resolved: '已解决' };

export const VALID_TRANSITIONS = {
  open: ['assigned', 'in_progress', 'resolved', 'closed'],
  assigned: ['in_progress', 'open', 'resolved', 'closed'],
  in_progress: ['pending_verify', 'resolved', 'open', 'closed'],
  pending_verify: ['resolved', 'in_progress', 'open', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress']
};

export const TICKET_CATEGORIES = [
  'erp', 'plm', 'qms', 'mes', 'bpm', 'network', 'hardware', 'other'
];

export const CATEGORY_LABELS = {
  erp: 'ERP', plm: 'PLM', qms: 'QMS', mes: 'MES/MOM',
  bpm: 'BPM', network: '网络', hardware: '硬件', other: '其他'
};

// 状态颜色映射（Tailwind）
export const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-800',
  assigned: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-amber-100 text-amber-800',
  pending_verify: 'bg-cyan-100 text-cyan-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-700'
};

export const HEALTH_COLORS = {
  ok: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  down: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-200 text-gray-600'
};

export const LEVEL_COLORS = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  recovered: 'bg-green-100 text-green-800'
};