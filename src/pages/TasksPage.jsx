import { useState } from 'react';
import { Plus, Filter, Search, Calendar, User, Flag, Clock, TrendingUp } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import TaskKanban from '@/components/tasks/TaskKanban';
import TaskList from '@/components/tasks/TaskList';
import TaskForm from '@/components/tasks/TaskForm';
import TaskProgressModal from '@/components/tasks/TaskProgressModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useMemberStore } from '@/store/useMemberStore';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'todo', label: '待开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'review', label: '审核中' },
  { value: 'done', label: '已完成' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: '全部优先级' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

export default function TasksPage() {
  const projects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const members = useMemberStore((s) => s.members);
  const currentUser = members.find((m) => m.id === currentUserId);

  const [view, setView] = useState('kanban');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [progressTask, setProgressTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const activeTasks = tasks.filter((t) => activeProjectIds.has(t.projectId));

  const filteredTasks = activeTasks.filter((t) => {
    if (projectFilter && t.projectId !== projectFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  const handleQuickAdd = () => {
    setEditingTask(null);
    setShowForm(true);
  };

  const handleProgress = (task) => {
    setProgressTask(task);
  };

  const handleCloseProgress = () => {
    setProgressTask(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteTask(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <PageContainer
      title="任务管理"
      subtitle={`${activeTasks.length} 项任务`}
      action={
        <Button size="sm" onClick={handleQuickAdd}>
          <Plus className="w-4 h-4" />
          新建任务
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select
            value={projectFilter}
            onChange={setProjectFilter}
            options={[
              { value: '', label: '全部项目' },
              ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
            ]}
            className="w-36"
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            className="w-32"
          />
          <Select
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={PRIORITY_OPTIONS}
            className="w-28"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务..."
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-smooth ${
              view === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            看板
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-smooth ${
              view === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            列表
          </button>
        </div>
      </div>

      {/* Task View */}
      {view === 'kanban' ? (
        <TaskKanban
          tasks={filteredTasks}
          projects={projects}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
          onProgress={handleProgress}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          projects={projects}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
          onProgress={handleProgress}
        />
      )}

      {/* Forms */}
      {showForm && (
        <TaskForm
          task={editingTask}
          defaultProjectId={projectFilter}
          onClose={handleCloseForm}
        />
      )}

      {progressTask && (
        <TaskProgressModal
          task={progressTask}
          onClose={handleCloseProgress}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除任务"
          message={`确定要删除任务「${deleteTarget.title}」吗？此操作不可恢复。`}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </PageContainer>
  );
}
