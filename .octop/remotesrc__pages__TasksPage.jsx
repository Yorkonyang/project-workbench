import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
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
import { useAccess } from '@/hooks/useAccess';
import { getDescendants } from '@/lib/hierarchy';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'todo', label: '待启动' },
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
  const location = useLocation();
  const projects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const members = useMemberStore((s) => s.members);
  const currentUser = members.find((m) => m.id === currentUserId);
  const { isAdmin, canManageProject, canViewProjectTasks } = useAccess();
  // 仅当管理员或至少拥有一个可管理的项目时才允许新建任务（成员无自有项目时后端会 403）
  const canCreateTask = isAdmin || projects.some((p) => canManageProject(p));

  const [view, setView] = useState('kanban');
  const [projectFilter, setProjectFilter] = useState('');
  // 含子项目：按选中项目扩展为其全部子孙（含自身）
  const [includeSub, setIncludeSub] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [progressTask, setProgressTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Auto-open progress modal when URL has ?taskId=xxx
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('taskId');
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setProgressTask(task);
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('taskId');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [location.search, tasks]);

  // 任务可见项目：仅可被管理或被分配任务的项目（排除仅被分配待办的成员，防止其看到其他页面内容）
  const activeProjectIds = new Set(
    projects.filter((p) => !p.archived && canViewProjectTasks(p)).map((p) => p.id)
  );
  const activeTasks = tasks.filter((t) => activeProjectIds.has(t.projectId || t.project_id));

  // 含子项目：选中项目扩展为其「自身 + 全部子孙」集合（用 getDescendants + 自身）
  const includedProjectIds = useMemo(() => {
    if (!projectFilter) return null;
    if (!includeSub) return new Set([projectFilter]);
    const descendants = getDescendants(projects, projectFilter);
    const ids = new Set([projectFilter, ...descendants.map((d) => d.id)]);
    return ids;
  }, [projectFilter, includeSub, projects]);

  // 项目下拉选项：默认只列主项目（根项目）；勾选「含子项目」后扩展为选中项目的全部子孙
  // 项目下拉选项：默认只列主项目（根项目）；勾选「含子项目」后扩展为选中项目的全部子孙
  const dropdownProjects = useMemo(() => {
    const base = projects.filter((p) => !p.archived && canViewProjectTasks(p));
    if (!includeSub || !projectFilter) return base;
    const ids = new Set([projectFilter, ...getDescendants(projects, projectFilter).map((d) => d.id)]);
    return base.filter((p) => ids.has(p.id));
  }, [projects, canViewProjectTasks, includeSub, projectFilter]);
  const projectOptions = [
    { value: '', label: '全部项目' },
    ...dropdownProjects.map((p) => ({ value: p.id, label: `${p.code || ''} ${p.name || ''}`.trim() })),
  ];

  const filteredTasks = activeTasks.filter((t) => {
    const pid = t.projectId || t.project_id;
    if (includedProjectIds && !includedProjectIds.has(pid)) return false;
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

  // progressTask 存快照会导致关联文档后 UI 不刷新，改为实时从 store 查找最新任务
  const liveProgressTask = progressTask
    ? tasks.find((t) => t.id === progressTask.id) || progressTask
    : null;

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
        canCreateTask ? (
          <Button size="sm" onClick={handleQuickAdd}>
            <Plus className="w-4 h-4" />
            新建任务
          </Button>
        ) : undefined
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select
            value={projectFilter}
            onChange={setProjectFilter}
            options={projectOptions}
            className="w-72"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSub}
              disabled={!projectFilter}
              onChange={(e) => setIncludeSub(e.target.checked)}
              className="accent-blue-500"
            />
            含子项目
          </label>
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

      {liveProgressTask && (
        <TaskProgressModal
          task={liveProgressTask}
          onClose={handleCloseProgress}
          projects={projects}
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
