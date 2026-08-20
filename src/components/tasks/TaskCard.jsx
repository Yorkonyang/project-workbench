import { useState } from 'react';
import { Pencil, Trash2, Calendar, User, TrendingUp, Archive } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useMemberStore } from '@/store/useMemberStore';
import { useAccess } from '@/hooks/useAccess';

const PRIORITY_CONFIG = {
  high: { label: '高', variant: 'danger' },
  medium: { label: '中', variant: 'warning' },
  low: { label: '低', variant: 'info' },
};

const STATUS_CONFIG = {
  todo: { label: '待开始', variant: 'default' },
  in_progress: { label: '进行中', variant: 'primary' },
  review: { label: '审核中', variant: 'purple' },
  done: { label: '已完成', variant: 'success' },
  blocked: { label: '已阻塞', variant: 'danger' },
  archived: { label: '已归档', variant: 'default' },
};

export default function TaskCard({ task, project, onEdit, onDelete, onProgress, isArchived = false }) {
  const members = useMemberStore((s) => s.members);
  const { canManageTask, canReportTask } = useAccess();
  const canEdit = canManageTask(task);   // 仅项目所有者可编辑/删除任务
  const canReport = canReportTask(task); // 所有者或任务责任人(成员)可汇报
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const statusConfig = isArchived
    ? { label: '已归档', variant: 'default' }
    : (STATUS_CONFIG[task.status] || STATUS_CONFIG.todo);

  // 兼容旧数据
  const assignees = task.assignees || (task.assignee ? [task.assignee] : []);
  const assigneeMembers = assignees
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);

  const handleCardClick = () => {
    if (isArchived || !onProgress) return;
    onProgress(task);
  };

  return (
    <div
      className={cn(
        'bg-white border rounded-xl p-4 hover:shadow-md transition-smooth group',
        isArchived
          ? 'border-slate-200 opacity-60 cursor-not-allowed'
          : 'border-slate-200 cursor-pointer hover:border-slate-300'
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {project && !isArchived && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
            )}
            {isArchived && <Archive className="w-3 h-3 text-slate-400 shrink-0" />}
            <h4 className="text-sm font-semibold text-slate-800 truncate">{task.title}</h4>
          </div>
          {task.description && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-1">{task.description}</p>
          )}
        </div>
        {!isArchived && canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(task);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary-600 transition-smooth"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(task);
              }}
              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-smooth"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        {!isArchived && <Badge variant={priorityConfig.variant}>{priorityConfig.label}</Badge>}
        {task.status === 'in_progress' && !isArchived && task.progress > 0 && (
          <span className="text-xs text-slate-500">{task.progress}%</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {task.dueDate}
            </span>
          )}
          {assigneeMembers.length > 0 && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <div className="flex -space-x-1.5">
                {assigneeMembers.slice(0, 3).map((m, idx) => (
                  <div
                    key={m.id}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold border border-white relative"
                    style={{ backgroundColor: m.avatarColor, zIndex: assigneeMembers.length - idx }}
                    title={m.name}
                  >
                    {m.name.charAt(0)}
                  </div>
                ))}
              </div>
              {assigneeMembers.map((m) => m.name).join('、')}
              {assigneeMembers.length > 3 && ` +${assigneeMembers.length - 3}`}
            </span>
          )}
        </div>
        {!isArchived && canReport && task.status === 'in_progress' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onProgress?.(task);
            }}
            className="p-1.5 hover:bg-primary-50 rounded-lg text-slate-400 hover:text-primary-600 transition-smooth"
            title="进度汇报"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
