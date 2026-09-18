import { useState, useMemo } from 'react';
import { Edit2, Trash2, TrendingUp } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { useMemberStore } from '@/store/useMemberStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useOrgStore } from '@/store/useOrgStore';
import { AVATAR_COLORS } from '@/config/theme';
import { useAccess } from '@/hooks/useAccess';
import ProjectBreadcrumb from '@/components/projects/ProjectBreadcrumb';
import {
  getPriorityConfig,
  getTaskStatusConfig,
  getProjectColor,
  dueDateLabel,
  isOverdue,
  formatDate,
  cn,
} from '@/lib/utils';

export default function TaskList({ tasks, projects, onEdit, onDelete, onProgress, onRowClick }) {
  const members = useMemberStore((s) => s.members);
  const activeProjects = useProjectStore((s) => s.projects.filter((p) => !p.archived));
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));
  const departments = useOrgStore((s) => s.getAllDepartments());
  const { canManageTask, canReportTask } = useAccess();

  // 部门颜色映射
  const deptColorMap = useMemo(() => {
    const map = new Map();
    departments.forEach((d, i) => map.set(d.id, AVATAR_COLORS[i % AVATAR_COLORS.length]));
    return map;
  }, [departments]);

  if (tasks.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-8">暂无任务</div>;
  }

  // 阻止操作列点击触发行跳转
  const stopRow = (e) => e.stopPropagation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-2 px-3 font-medium">任务标题</th>
            <th className="py-2 px-3 font-medium">项目</th>
            <th className="py-2 px-3 font-medium hidden lg:table-cell">层级</th>
            <th className="py-2 px-3 font-medium hidden md:table-cell">负责人</th>
            <th className="py-2 px-3 font-medium">优先级</th>
            <th className="py-2 px-3 font-medium">状态</th>
            <th className="py-2 px-3 font-medium hidden sm:table-cell">截止日期</th>
            <th className="py-2 px-3 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const priConfig = getPriorityConfig(task.priority);
            const statusConfig = getTaskStatusConfig(task.status);
            const project = projects?.find((p) => p.id === task.projectId);
            const overdue = task.dueDate && isOverdue(task.dueDate) && task.status !== 'done';
            const isArchived = !activeProjectIds.has(task.projectId);
            const effectiveStatus = isArchived ? 'archived' : task.status;
            const effectiveStatusConfig = isArchived
              ? { label: '已归档', bgClass: 'bg-slate-100', textClass: 'text-slate-500' }
              : statusConfig;

            return (
              <tr
                key={task.id}
                onClick={onRowClick ? () => onRowClick(task) : undefined}
                className={cn(
                  "border-b hover:bg-slate-50",
                  isArchived && "opacity-60",
                  onRowClick && "cursor-pointer"
                )}
              >
                <td className="py-2.5 px-3">
                  <div className="font-medium text-slate-800">{task.title}</div>
                  {task.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {task.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs text-slate-400">{tag}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {project && (
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                      {project.code}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 hidden md:table-cell">
                  {(() => {
                    const assignees = task.assignees || (task.assignee ? [task.assignee] : []);
                    if (assignees.length === 0) return <span className="text-slate-400">-</span>;
                    return (
                      <div className="flex items-center gap-1 flex-wrap">
                        {assignees.map((aId) => {
                          const m = members.find((m) => m.id === aId);
                          if (!m) return null;
                          return (
                            <span
                              key={aId}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary-50 text-primary-700"
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                                style={{ backgroundColor: deptColorMap.get(m.departmentId) || m.avatarColor }}
                              >
                                {m.name.charAt(0)}
                              </span>
                              {m.name}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-2.5 px-3">
                  <span className={cn('text-xs font-medium', priConfig.textColor)}>{priConfig.label}</span>
                </td>
                <td className="py-2.5 px-3">
                  <Badge variant="default" className={cn(effectiveStatusConfig.bgClass, effectiveStatusConfig.textClass)}>
                    {effectiveStatusConfig.label}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 hidden sm:table-cell">
                  <span className={cn('text-xs', overdue ? 'text-red-500 font-medium' : 'text-slate-500')}>
                    {task.dueDate ? dueDateLabel(task.dueDate) : '-'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  {isArchived ? (
                    <span className="text-xs text-slate-400">已归档</span>
                  ) : (
                    <div className="flex justify-end gap-1">
                      {canReportTask(task) && (
                        <button
                          onClick={(e) => { stopRow(e); onProgress?.(task); }}
                          className="p-1.5 hover:bg-primary-50 rounded text-slate-400 hover:text-primary-600"
                          title="进度汇报"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canManageTask(task) && (
                        <button
                          onClick={(e) => { stopRow(e); onEdit?.(task); }}
                          className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canManageTask(task) && (
                        <button
                          onClick={(e) => { stopRow(e); onDelete?.(task); }}
                          className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
