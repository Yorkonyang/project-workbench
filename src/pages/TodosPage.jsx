import { useState } from 'react';
import { Plus, CheckCircle2, Clock, CalendarClock, CheckSquare, AlertTriangle } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import TodoList from '@/components/todos/TodoList';
import TaskList from '@/components/tasks/TaskList';
import TodoForm from '@/components/todos/TodoForm';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';
import ReminderBanner from '@/components/todos/ReminderBanner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTodoStore } from '@/store/useTodoStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useReminders } from '@/hooks/useReminders';
import { useProjectStore } from '@/store/useProjectStore';
import { isOverdue } from '@/lib/utils';

export default function TodosPage() {
  const todos = useTodoStore((s) => s.todos);
  const tasks = useTaskStore((s) => s.tasks);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const projects = useProjectStore((s) => s.projects);
  const { todoDueToday, todoDueTomorrow, todoOverdue, taskDueToday, taskDueTomorrow, taskOverdue } = useReminders();

  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [progressTask, setProgressTask] = useState(null);
  const [filter, setFilter] = useState('all'); // all | todo | task | active | completed

  // Filter out archived projects
  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const filteredTodos = todos.filter((t) => !t.projectId || activeProjectIds.has(t.projectId));
  const filteredTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'blocked' && (!t.projectId || activeProjectIds.has(t.projectId)));

  // 排序：逾期置顶，有截止日升序，无截止日排最后
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    const aOverdue = a.dueDate && isOverdue(a.dueDate) && !a.completed;
    const bOverdue = b.dueDate && isOverdue(b.dueDate) && !b.completed;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const todoActiveCount = sortedTodos.filter((t) => !t.completed).length;
  const taskActiveCount = filteredTasks.filter((t) => t.status !== 'done' && t.status !== 'blocked').length;
  const todoCompletedCount = sortedTodos.filter((t) => t.completed).length;

  const handleEdit = (todo) => {
    setEditingTodo(todo);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingTodo(null);
  };

  const handleProgressTask = (task) => {
    setProgressTask(task);
  };

  const handleCloseProgress = () => {
    setProgressTask(null);
  };

  // 根据筛选条件过滤
  let displayTodos = sortedTodos;
  let displayTasks = filteredTasks;

  if (filter === 'todo') {
    displayTodos = sortedTodos;
    displayTasks = [];
  } else if (filter === 'task') {
    displayTodos = [];
    displayTasks = filteredTasks;
  } else if (filter === 'active') {
    displayTodos = sortedTodos.filter((t) => !t.completed);
    displayTasks = filteredTasks.filter((t) => t.status !== 'done' && t.status !== 'blocked');
  } else if (filter === 'completed') {
    displayTodos = sortedTodos.filter((t) => t.completed);
    displayTasks = filteredTasks.filter((t) => t.status === 'done');
  }

  return (
    <PageContainer>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={AlertTriangle} label="待办逾期" value={todoOverdue.length} color="#ef4444" />
        <StatCard icon={Clock} label="待办今日到期" value={todoDueToday.length} color="#f59e0b" />
        <StatCard icon={CheckCircle2} label="任务进行中" value={taskActiveCount} color="#3b82f6" />
        <StatCard icon={CalendarClock} label="已完成待办" value={todoCompletedCount} color="#10b981" />
      </div>

      {/* Reminder Banner */}
      <ReminderBanner
        todoDueToday={todoDueToday}
        todoDueTomorrow={todoDueTomorrow}
        todoOverdue={todoOverdue}
        taskDueToday={taskDueToday}
        taskDueTomorrow={taskDueTomorrow}
        taskOverdue={taskOverdue}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {[
            { key: 'all', label: '全部' },
            { key: 'todo', label: '待办' },
            { key: 'task', label: '任务' },
            { key: 'active', label: '进行中' },
            { key: 'completed', label: '已完成' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f.key ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          新建待办
        </Button>
      </div>

      {/* 待办列表区域 */}
      {displayTodos.length > 0 && (
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
            待办事项
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{displayTodos.length}</span>
          </h2>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
            <TodoList
              items={displayTodos.map(t => ({ ...t, _type: 'todo' }))}
              onEditTodo={handleEdit}
              onDeleteTodo={setDeleteTarget}
              onToggleTodo={toggleTodo}
            />
          </div>
        </div>
      )}

      {/* 任务列表区域 */}
      {displayTasks.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
            <CheckSquare className="w-4 h-4 text-blue-500" />
            工作任务
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{displayTasks.length}</span>
          </h2>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
            <TaskList
              tasks={displayTasks}
              projects={projects}
              onEdit={() => {}}
              onDelete={() => {}}
              onProgress={handleProgressTask}
            />
          </div>
        </div>
      )}

      {showForm && <TodoForm todo={editingTodo} onClose={handleClose} />}

      {deleteTarget && (
        <ConfirmDialog
          title="删除待办"
          message={`确定要删除「${deleteTarget.title}」吗？`}
          onConfirm={() => deleteTodo(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {progressTask && (
        <TaskDetailModal
          task={progressTask}
          onClose={handleCloseProgress}
        />
      )}
    </PageContainer>
  );
}
