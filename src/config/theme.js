// Theme constants
export const THEME = {
  colors: {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#6366f1',
    projectMom: '#3b82f6',
    projectErp: '#14b8a6',
  },
};

// Priority color mapping
export const PRIORITY_CONFIG = {
  urgent: { label: '紧急', color: '#ef4444', bgColor: '#fef2f2', textColor: 'text-red-600', bgClass: 'bg-red-50', borderClass: 'border-red-200' },
  high: { label: '高', color: '#f59e0b', bgColor: '#fffbeb', textColor: 'text-amber-600', bgClass: 'bg-amber-50', borderClass: 'border-amber-200' },
  medium: { label: '中', color: '#3b82f6', bgColor: '#eff6ff', textColor: 'text-blue-600', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
  low: { label: '低', color: '#6b7280', bgColor: '#f9fafb', textColor: 'text-gray-500', bgClass: 'bg-gray-50', borderClass: 'border-gray-200' },
};

// Task status mapping
export const TASK_STATUS_CONFIG = {
  todo: { label: '待办', color: '#6b7280', bgClass: 'bg-slate-100', textClass: 'text-slate-600', dotClass: 'bg-slate-400' },
  in_progress: { label: '进行中', color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-600', dotClass: 'bg-blue-500' },
  review: { label: '评审中', color: '#8b5cf6', bgClass: 'bg-purple-50', textClass: 'text-purple-600', dotClass: 'bg-purple-500' },
  done: { label: '已完成', color: '#10b981', bgClass: 'bg-green-50', textClass: 'text-green-600', dotClass: 'bg-green-500' },
  blocked: { label: '已阻塞', color: '#ef4444', bgClass: 'bg-red-50', textClass: 'text-red-600', dotClass: 'bg-red-500' },
};

export const TASK_STATUS_ORDER = ['todo', 'in_progress', 'review', 'done', 'blocked'];

// Milestone status mapping
// 兼容两种枚举：表单/新建使用的 pending/in_progress/done/blocked + 旧数据 upcoming/achieved/delayed/at_risk
export const MILESTONE_STATUS_CONFIG = {
  // 新枚举（表单选项）
  pending: { label: '待开始', color: '#6b7280', bgClass: 'bg-slate-100', textClass: 'text-slate-600' },
  in_progress: { label: '进行中', color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-600' },
  done: { label: '已完成', color: '#10b981', bgClass: 'bg-green-50', textClass: 'text-green-600' },
  blocked: { label: '已阻塞', color: '#ef4444', bgClass: 'bg-red-50', textClass: 'text-red-600' },
  // 旧枚举（兼容历史数据）
  upcoming: { label: '即将到来', color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-600' },
  achieved: { label: '已达成', color: '#10b981', bgClass: 'bg-green-50', textClass: 'text-green-600' },
  delayed: { label: '已延迟', color: '#ef4444', bgClass: 'bg-red-50', textClass: 'text-red-600' },
  at_risk: { label: '有风险', color: '#f59e0b', bgClass: 'bg-amber-50', textClass: 'text-amber-600' },
};

// 里程碑是否已完成（兼容两种枚举）
export function isMilestoneDone(milestone) {
  return milestone?.status === 'done' || milestone?.status === 'achieved';
}

// Risk severity mapping
export const RISK_SEVERITY_CONFIG = {
  critical: { label: '严重', color: '#ef4444', bgClass: 'bg-red-50', textClass: 'text-red-600' },
  high: { label: '高', color: '#f97316', bgClass: 'bg-orange-50', textClass: 'text-orange-600' },
  medium: { label: '中', color: '#f59e0b', bgClass: 'bg-amber-50', textClass: 'text-amber-600' },
  low: { label: '低', color: '#10b981', bgClass: 'bg-green-50', textClass: 'text-green-600' },
};

export const RISK_PROBABILITY_CONFIG = {
  high: { label: '高', color: '#ef4444' },
  medium: { label: '中', color: '#f59e0b' },
  low: { label: '低', color: '#10b981' },
};

// Project status mapping
export const PROJECT_STATUS_CONFIG = {
  planning: { label: '规划中', color: '#6b7280', bgClass: 'bg-slate-100', textClass: 'text-slate-600' },
  in_progress: { label: '进行中', color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-600' },
  on_hold: { label: '已暂停', color: '#f59e0b', bgClass: 'bg-amber-50', textClass: 'text-amber-600' },
  completed: { label: '已完成', color: '#10b981', bgClass: 'bg-green-50', textClass: 'text-green-600' },
};

// Document categories
export const DOC_CATEGORIES = ['需求文档', '设计文档', '会议纪要', '验收报告', '计划报告', '其他'];

// 缺省头像颜色（成员头像与部门头像共用）：第1蓝、第2翠绿、第3紫、第4橙、第5红、第6粉、第7青、第8黄绿
// 部门头像按「全局顺序」循环取色：第 N 个部门取 AVATAR_COLORS[N % length]，第 9 个回到第 1 个蓝色。
export const AVATAR_COLORS = [
  '#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
];
