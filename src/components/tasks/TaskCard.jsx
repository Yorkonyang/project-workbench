import { useState, useMemo } from 'react';
import { Pencil, Trash2, Calendar, User, Archive, Ban } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useMemberStore } from '@/store/useMemberStore';
import { useOrgStore } from '@/store/useOrgStore';
import { AVATAR_COLORS } from '@/config/theme';
import { useAccess } from '@/hooks/useAccess';

const PRIORITY_CONFIG = {
  high: { label: '高', variant: 'danger' },
  medium: { label: '中', variant: 'warning' },
  low: { label: '低', variant: 'info' },
};

export default function TaskCard({ task, project, onEdit, onDelete, onProgress, onAbolish, isArchived = false, bgClass, borderClass }) {
  const members = useMemberStore((s) => s.members);
  const departments = useOrgStore((s) => s.getAllDepartments());
  const { canManageTask, canReportTask } = useAccess();
  // 编辑：仅项目所有者可改字段；且「评审中」任务已锁定，不允许再编辑
  const canEdit = canManageTask(task) && task.status !== 'review' && !task.abolished;
  const canReport = canReportTask(task); // 所有者或任务责任人(成员)可汇报
  // 进行中任务：项目负责人或任务责任人可发起「废止」申请（已有待审或已废止则不再显示）
  // 修改延期仍走「编辑」按钮（编辑表单可改截止日期），不再单独提供「修改计划」按钮
  const canAbolish =
    task.status === 'in_progress' && (canManageTask(task) || canReportTask(task)) && !task.pendingChange && !task.abolished;
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  // 部门颜色映射
  const deptColorMap = useMemo(() => {
    const map = new Map();
    departments.forEach((d, i) => map.set(d.id, AVATAR_COLORS[i % AVATAR_COLORS.length]));
    return map;
  }, [departments]);

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
        'border rounded-xl p-4 hover:shadow-md transition-smooth group relative',
        // 优先级：传入的 bgClass > 默认白底
        bgClass || 'bg-white',
        borderClass
          ? `${borderClass} hover:border-slate-300`
          : 'border-slate-200 hover:border-slate-300',
        isArchived
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer'
      )}
      onClick={handleCardClick}
    >
      {/* 右上角：优先级常驻 + 编辑/删除 hover 显示（紧贴优先级左侧） */}
      {!isArchived && (
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          {/* 编辑（项目负责人可改字段）：hover 显示 */}
          {canEdit && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(task);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary-600 transition-smooth"
                title="编辑任务"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {/* 删除：仅「待启动」任务可删（进行中及之后状态锁定，防误删） */}
              {task.status === 'todo' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(task);
                  }}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-smooth"
                  title="删除任务"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {/* 已废止徽标 */}
          {task.abolished && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-500">
              已废止
            </span>
          )}
          {/* 待评审徽标 */}
          {task.pendingChange && !task.abolished && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
              待评审
            </span>
          )}
          {/* 进行中：废止申请按钮（任务负责人或项目负责人可发起；修改延期走编辑按钮） */}
          {canAbolish && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAbolish?.(task);
              }}
              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-smooth"
              title="废止任务"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
          {/* 优先级常驻显示 */}
          <Badge variant={priorityConfig.variant} size="xs">
            {priorityConfig.label}
          </Badge>
        </div>
      )}

      {/* 项目名称（任务所属项目） */}
      {project && !isArchived && (
        <div
          className="text-xs text-slate-400 mb-1.5 truncate pr-12"
          title={project.name}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
            style={{ backgroundColor: project.color }}
          />
          {project.name}
        </div>
      )}
      {isArchived && (
        <div className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
          <Archive className="w-3 h-3" />已归档项目
        </div>
      )}

      {/* 标题：与描述同宽（去掉 pr-10，右上角已 absolute 不占布局空间） */}
      <h4 className={cn('text-sm font-semibold mb-1 break-words', task.abolished ? 'text-slate-400 line-through' : 'text-slate-800')}>{task.title}</h4>

      {/* 描述：现在右侧和左侧 padding 一致（编辑按钮已绝对定位） */}
      {task.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mt-1">{task.description}</p>
      )}

      {/* 进度（仅进行中且 > 0） */}
      {task.status === 'in_progress' && !isArchived && task.progress > 0 && (
        <div className="text-xs text-slate-500 mt-1.5">进度 {task.progress}%</div>
      )}

      {/* 底部：日期 + 责任人 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400 min-w-0">
          {task.dueDate && (
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3" />
              {task.dueDate}
            </span>
          )}
          {assigneeMembers.length > 0 && (
            <span className="flex items-center gap-1 min-w-0">
              <User className="w-3 h-3 shrink-0" />
              <div className="flex -space-x-1.5 shrink-0">
                {assigneeMembers.slice(0, 3).map((m, idx) => (
                  <div
                    key={m.id}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold border border-white relative"
                    style={{ backgroundColor: deptColorMap.get(m.departmentId) || m.avatarColor, zIndex: assigneeMembers.length - idx }}
                    title={m.name}
                  >
                    {m.name.charAt(0)}
                  </div>
                ))}
              </div>
              <span className="truncate">
                {assigneeMembers.map((m) => m.name).join('、')}
                {assigneeMembers.length > 3 && ` +${assigneeMembers.length - 3}`}
              </span>
            </span>
          )}
        </div>
        {/* 移除了右下角 TrendingUp 按钮（与整卡点击汇报功能重复） */}
      </div>
    </div>
  );
}