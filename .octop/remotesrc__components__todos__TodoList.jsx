import { useState, useMemo } from 'react';
import { Edit2, Trash2, Calendar, Link2, Bell, User, CheckSquare, Flag } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useOrgStore } from '@/store/useOrgStore';
import { AVATAR_COLORS } from '@/config/theme';
import { getPriorityConfig, dueDateLabel, isOverdue, cn } from '@/lib/utils';
import { useAccess } from '@/hooks/useAccess';

export default function TodoList({ items, onEditTodo, onDeleteTodo, onToggleTodo, onProgressTask }) {
  const projects = useProjectStore((s) => s.projects);
  const members = useMemberStore((s) => s.members);
  const departments = useOrgStore((s) => s.getAllDepartments());
  const { canManageTodo } = useAccess();
  const [confirmTodo, setConfirmTodo] = useState(null);

  // 部门颜色映射
  const deptColorMap = useMemo(() => {
    const map = new Map();
    departments.forEach((d, i) => map.set(d.id, AVATAR_COLORS[i % AVATAR_COLORS.length]));
    return map;
  }, [departments]);

  // 按类型分别排序
  const sorted = [...items].sort((a, b) => {
    // 类型优先（待办在前，任务在后）
    if (a._type !== b._type) return a._type === 'todo' ? -1 : 1;

    // 未完成优先
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    // 逾期优先
    const aOverdue = a.dueDate && isOverdue(a.dueDate) && !a.completed;
    const bOverdue = b.dueDate && isOverdue(b.dueDate) && !b.completed;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    const priOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (priOrder[a.priority] !== priOrder[b.priority]) {
      return priOrder[a.priority] - priOrder[b.priority];
    }
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  // 按类型分组
  const todos = sorted.filter((item) => item._type === 'todo');
  const tasks = sorted.filter((item) => item._type === 'task');

  if (items.length === 0) {
    return <div className="text-center text-sm text-slate-400 py-8">暂无提醒事项</div>;
  }

  const handleRowClick = (item) => {
    if (item._type === 'todo' && !item.completed) {
      setConfirmTodo(item);
    } else if (item._type === 'task') {
      onProgressTask?.(item);
    }
  };

  const handleConfirmComplete = () => {
    if (confirmTodo) {
      onToggleTodo?.(confirmTodo.id);
      setConfirmTodo(null);
    }
  };

  return (
    <>
      <div className="space-y-1.5">
        {/* 待办标题 */}
        {todos.length > 0 && (
          <div className="flex items-center gap-2 pt-2 pb-1">
            <Bell className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">待办事项</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{todos.length}</span>
          </div>
        )}

        {todos.map((todo) => {
          const priConfig = getPriorityConfig(todo.priority);
          const overdue = todo.dueDate && isOverdue(todo.dueDate) && !todo.completed;
          const project = todo.projectId ? projects.find((p) => p.id === todo.projectId) : null;
          const assigneeMember = members.find((m) => m.name === todo.assignee);
          const hasReminder = todo.remindDays > 0 || todo.remindAt || todo.enableEscalation;

          return (
            <div
              key={todo.id}
              onClick={() => handleRowClick(todo)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-all-smooth cursor-pointer',
                todo.completed
                  ? 'bg-slate-50 border-slate-100 opacity-60'
                  : overdue
                  ? 'bg-red-50 border-red-200 hover:border-red-300'
                  : 'bg-amber-50 border-amber-200 hover:border-amber-300'
              )}
            >
              {/* Checkbox — 未完成时空心 ⭕️，完成后绿色带白勾。
                  注意：按钮内仅渲染勾选图标，禁止塞入任何文本，避免渲染 0 等异常字符 */}
              <button
                type="button"
                role="checkbox"
                aria-checked={todo.completed ? 'true' : 'false'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTodo?.(todo.id);
                }}
                className={cn(
                  'relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors select-none',
                  todo.completed
                    ? 'bg-green-500 border-green-500'
                    : 'border-amber-400 hover:border-amber-500'
                )}
              >
                {todo.completed ? (
                  <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 pointer-events-none" aria-hidden="true">
                    <polyline points="5 10.5 9 14.5 15.5 7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>

              {/* 待办标识 */}
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded shrink-0">
                待办
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      todo.completed ? 'text-slate-400 line-through' : 'text-slate-800'
                    )}
                  >
                    {todo.title}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: priConfig.color }}
                    title={priConfig.label}
                  />
                  {hasReminder && !todo.completed && (
                    <span title="已设置提醒" className="text-amber-500">
                      <Bell className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {todo.dueDate && (
                    <span className={cn('text-xs flex items-center gap-1', overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
                      <Calendar className="w-3 h-3" />
                      {dueDateLabel(todo.dueDate)}
                    </span>
                  )}
                  {project && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      {project.code}
                    </span>
                  )}
                  {todo.assignee && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      {assigneeMember ? (
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: deptColorMap.get(assigneeMember.departmentId) || assigneeMember.avatarColor || '#6b7280' }}
                        >
                          {todo.assignee.charAt(0)}
                        </span>
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      {todo.assignee}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {!todo.completed && canManageTodo(todo) && (
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEditTodo?.(todo)}
                    className="p-1.5 hover:bg-amber-100 rounded text-slate-400 hover:text-amber-600"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteTodo?.(todo)}
                    className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* 任务标题 */}
        {tasks.length > 0 && (
          <div className="flex items-center gap-2 pt-3 pb-1">
            <CheckSquare className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">工作任务</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
          </div>
        )}

        {tasks.map((task) => {
          const priConfig = getPriorityConfig(task.priority);
          const statusConfig = {
            todo: { label: '待启动', bgClass: 'bg-slate-100', textClass: 'text-slate-600' },
            in_progress: { label: '进行中', bgClass: 'bg-blue-100', textClass: 'text-blue-600' },
            review: { label: '审核中', bgClass: 'bg-purple-100', textClass: 'text-purple-600' },
            done: { label: '已完成', bgClass: 'bg-green-100', textClass: 'text-green-600' },
            blocked: { label: '阻塞', bgClass: 'bg-red-100', textClass: 'text-red-600' },
          }[task.status] || { label: task.status, bgClass: 'bg-slate-100', textClass: 'text-slate-600' };
          const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
          const assignees = task.assignees || (task.assignee ? [task.assignee] : []);
          const assigneeMembers = assignees.map((id) => members.find((m) => m.id === id)).filter(Boolean);
          const overdue = task.dueDate && isOverdue(task.dueDate) && task.status !== 'done';

          return (
            <div
              key={task.id}
              onClick={() => handleRowClick(task)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-all-smooth cursor-pointer',
                overdue
                  ? 'bg-red-50 border-red-200 hover:border-red-300'
                  : 'bg-white border-slate-200 hover:border-blue-200'
              )}
            >
              {/* 任务标识 */}
              <span className={`px-1.5 py-0.5 ${statusConfig.bgClass} ${statusConfig.textClass} text-xs font-medium rounded shrink-0`}>
                {statusConfig.label}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{task.title}</span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: priConfig.color }}
                    title={priConfig.label}
                  />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {task.dueDate && (
                    <span className={cn('text-xs flex items-center gap-1', overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
                      <Calendar className="w-3 h-3" />
                      {dueDateLabel(task.dueDate)}
                    </span>
                  )}
                  {project && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      {project.code}
                    </span>
                  )}
                  {assigneeMembers.length > 0 && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <div className="flex -space-x-1">
                        {assigneeMembers.slice(0, 3).map((m) => (
                          <span
                            key={m.id}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold border border-white shrink-0"
                            style={{ backgroundColor: deptColorMap.get(m.departmentId) || m.avatarColor || '#6b7280' }}
                            title={m.name}
                          >
                            {m.name.charAt(0)}
                          </span>
                        ))}
                      </div>
                      {assigneeMembers.map((m) => m.name).join('、')}
                      {assigneeMembers.length > 3 && ` +${assigneeMembers.length - 3}`}
                    </span>
                  )}
                </div>
              </div>

              {/* 进度汇报按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onProgressTask?.(task);
                }}
                className="p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 shrink-0"
                title="进度汇报"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 确认完成弹窗 */}
      {confirmTodo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmTodo(null)}>
          <div
            className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium text-slate-800 mb-2">确认完成？</h3>
            <p className="text-sm text-slate-500 mb-6">
              您确定要将「{confirmTodo.title}」标记为已完成吗？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTodo(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmComplete}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
