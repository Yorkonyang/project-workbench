import { format, parseISO, differenceInDays, isToday, isTomorrow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import clsx from 'clsx';
import {
  PRIORITY_CONFIG,
  TASK_STATUS_CONFIG,
  MILESTONE_STATUS_CONFIG,
  RISK_SEVERITY_CONFIG,
  PROJECT_STATUS_CONFIG,
} from '@/config/theme';

export function cn(...args) {
  return clsx(...args);
}

// Date formatting
export function formatDate(dateStr, fmt = 'yyyy-MM-dd') {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return '-';
  }
}

export function formatDateChinese(dateStr) {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'yyyy年MM月dd日', { locale: zhCN });
  } catch {
    return '-';
  }
}

export function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

// Days until due date
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch {
    return null;
  }
}

// Due date label
export function dueDateLabel(dateStr) {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return '今日到期';
    if (isTomorrow(date)) return '明日到期';
    const days = differenceInDays(date, new Date());
    if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
    if (days === 0) return '今日到期';
    return `还有 ${days} 天`;
  } catch {
    return '';
  }
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  try {
    return isPast(parseISO(dateStr));
  } catch {
    return false;
  }
}

// Get priority config
export function getPriorityConfig(priority) {
  return PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
}

// Get task status config
export function getTaskStatusConfig(status) {
  return TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.todo;
}

// Get milestone status config
export function getMilestoneStatusConfig(status) {
  return MILESTONE_STATUS_CONFIG[status] || MILESTONE_STATUS_CONFIG.upcoming;
}

// Get risk severity config
export function getRiskSeverityConfig(severity) {
  return RISK_SEVERITY_CONFIG[severity] || RISK_SEVERITY_CONFIG.medium;
}

// Get project status config
export function getProjectStatusConfig(status) {
  return PROJECT_STATUS_CONFIG[status] || PROJECT_STATUS_CONFIG.in_progress;
}

// Get project color by project ID
export function getProjectColor(projectId) {
  const colors = {
    proj_mom: '#3b82f6',
    proj_erp: '#14b8a6',
  };
  return colors[projectId] || '#6b7280';
}

// Get project name by project ID
export function getProjectName(projectId, projects) {
  const p = projects?.find((p) => p.id === projectId);
  return p ? p.name : '未关联';
}

// Export data to JSON file
export function exportToJSON(data, filename = 'workbench-data.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Calculate task progress based on status
export function calcTaskProgress(status) {
  const map = { done: 100, review: 75, in_progress: 50, todo: 0, blocked: 0 };
  return map[status] ?? 0;
}
