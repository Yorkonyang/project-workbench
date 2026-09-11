import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Flag, CheckSquare, FolderOpen, AlertTriangle, Users, Edit2, Plus, Archive, Bell, Clock, Trash2, GitMerge } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import TaskList from '@/components/tasks/TaskList';
import TaskForm from '@/components/tasks/TaskForm';
import MilestoneList from '@/components/timeline/MilestoneList';
import MilestoneForm from '@/components/timeline/MilestoneForm';
import DocumentGrid from '@/components/documents/DocumentGrid';
import DocumentForm from '@/components/documents/DocumentForm';
import RiskList from '@/components/risks/RiskList';
import TodoForm from '@/components/todos/TodoForm';
import ProjectForm from '@/components/projects/ProjectForm';
import MergeDialog from '@/components/projects/MergeDialog';
import { getProjectStatusConfig, getPriorityConfig, dueDateLabel, isOverdue, formatDate, cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { MAX_DEPTH } from '@/lib/hierarchy';
import { useOrgStore } from '@/store/useOrgStore';
import { AVATAR_COLORS } from '@/config/theme';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useRiskStore } from '@/store/useRiskStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useAccess } from '@/hooks/useAccess';
import { apiClient } from '@/lib/apiClient';
import { ROLES } from '@/config/permissions';

const TABS = [
  { key: 'overview', label: '概览', icon: Calendar },
  { key: 'tasks', label: '任务', icon: CheckSquare },
  { key: 'milestones', label: '里程碑', icon: Flag },
  { key: 'todos', label: '待办', icon: Bell },
  { key: 'documents', label: '文档', icon: FolderOpen },
  { key: 'risks', label: '风险', icon: AlertTriangle },
  { key: 'members', label: '成员', icon: User },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === id));
  const allProjects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks.filter((t) => t.projectId === id));
  const allTodos = useTodoStore((s) => s.todos);
  const todos = useMemo(() => allTodos.filter((t) => t.projectId === id), [allTodos, id]);
  const milestones = useMilestoneStore((s) => s.milestones.filter((m) => m.projectId === id));
  const documents = useDocumentStore((s) => s.documents.filter((d) => d.projectId === id));
  const risks = useRiskStore((s) => s.risks.filter((r) => r.projectId === id));
  const allMembers = useMemberStore((s) => s.members);
  const projectMembers = useMemo(() => allMembers.filter((m) => m.projectIds?.includes(id)), [allMembers, id]);
  const departments = useOrgStore((s) => s.getAllDepartments());

  // 部门颜色映射
  const deptColorMap = useMemo(() => {
    const map = new Map();
    departments.forEach((d, i) => map.set(d.id, AVATAR_COLORS[i % AVATAR_COLORS.length]));
    return map;
  }, [departments]);
  const addMilestone = useMilestoneStore((s) => s.addMilestone);
  const updateMilestone = useMilestoneStore((s) => s.updateMilestone);
  const deleteMilestone = useMilestoneStore((s) => s.deleteMilestone);
  const addTodo = useTodoStore((s) => s.addTodo);
  const updateTodo = useTodoStore((s) => s.updateTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);
  const { canManageProject, canMergeProject } = useAccess();
  const getSubtreeStats = useProjectStore((s) => s.getSubtreeStats);
  const getProjectLevel = useProjectStore((s) => s.getProjectLevel);
  const mergeProject = useProjectStore((s) => s.mergeProject);

  const [activeTab, setActiveTab] = useState('overview');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [showDocumentForm, setShowDocumentForm] = useState(false);

  // 子项目表单
  const [showSubForm, setShowSubForm] = useState(false);
  const [subParentId, setSubParentId] = useState('');
  // 合并弹窗
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  // P1-6：进度环「含子项目」聚合开关（默认关，不重复计数）
  const [includeSubprojects, setIncludeSubprojects] = useState(false);

  // 已合并源项目兜底：本地 store 查不到该项目时（已被软隐藏），用 includeMerged=1 再拉一次全量
  // 命中且带 mergedInto → 展示"已合并到 X"横幅而非"项目不存在"
  const [mergedFallback, setMergedFallback] = useState(null);
  const [mergedFallbackLoading, setMergedFallbackLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function lookupMerged() {
      try {
        const all = await apiClient.getProjects(true);
        if (cancelled) return;
        const hit = (all || []).find((p) => p.id === id);
        if (hit && hit.mergedInto) setMergedFallback(hit);
      } catch (e) {
        /* 兜底失败不阻断，保持"项目不存在"兜底文案 */
      } finally {
        if (!cancelled) setMergedFallbackLoading(false);
      }
    }
    if (!project) {
      setMergedFallbackLoading(true);
      lookupMerged();
    } else {
      setMergedFallback(null);
      setMergedFallbackLoading(false);
    }
    return () => { cancelled = true; };
  }, [id, project]);

  // 编辑目标（用于打开 Form 时回填数据；null 表示新建）
  const [editingTask, setEditingTask] = useState(null);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [editingDocument, setEditingDocument] = useState(null);

  // 子项目保存
  const addProject = useProjectStore((s) => s.addProject);
  const handleSaveSub = async (data) => {
    await addProject(data);
    setShowSubForm(false);
    setSubParentId('');
  };

  // 合并执行
  const handleMerge = async (sourceId, targetId, strategy) => {
    await mergeProject(sourceId, targetId, strategy);
    setShowMergeDialog(false);
    // 跳转并刷新到目标项目详情
    navigate(`/projects/${targetId}`);
    window.location.reload();
  };

  // 通用删除（二次确认）
  const confirmDelete = (msg) => window.confirm(msg);

  // 任务：编辑/删除/进度汇报（项目详情里点击"汇报"直接进入任务详情页）
  const handleTaskEdit = (task) => { setEditingTask(task); setShowTaskForm(true); };
  const handleTaskDelete = (task) => {
    if (confirmDelete(`确定删除任务「${task.title}」吗？`)) deleteTask(task.id);
  };
  const handleTaskProgress = (task) => navigate(`/task/${task.id}`);
  const handleTaskRowClick = (task) => navigate(`/task/${task.id}`);
  const closeTaskForm = () => { setShowTaskForm(false); setEditingTask(null); };

  // 里程碑
  const handleMilestoneEdit = (ms) => { setEditingMilestone(ms); setShowMilestoneForm(true); };
  const handleMilestoneDelete = (ms) => {
    if (confirmDelete(`确定删除里程碑「${ms.title}」吗？`)) deleteMilestone(ms.id);
  };
  const closeMilestoneForm = () => { setShowMilestoneForm(false); setEditingMilestone(null); };
  const saveMilestone = async (data) => {
    if (editingMilestone) {
      await updateMilestone(editingMilestone.id, data);
    } else {
      await addMilestone(data);
    }
    closeMilestoneForm();
  };

  // 文档
  const handleDocumentEdit = (doc) => { setEditingDocument(doc); setShowDocumentForm(true); };
  const handleDocumentDelete = (doc) => {
    if (confirmDelete(`确定删除文档「${doc.title}」吗？`)) deleteDocument(doc.id);
  };
  const closeDocumentForm = () => { setShowDocumentForm(false); setEditingDocument(null); };

  // 待办
  const handleTodoEdit = (todo) => { setEditingTodo(todo); setShowTodoForm(true); };
  const handleTodoDelete = (todo) => {
    if (confirmDelete(`确定删除待办「${todo.title}」吗？`)) deleteTodo(todo.id);
  };
  const closeTodoForm = () => { setShowTodoForm(false); setEditingTodo(null); };

  if (!project) {
    // 兜底：被合并的源项目不在默认列表里，但 includeMerged=1 能查到 → 显示"已合并到 X"而非"项目不存在"
    if (mergedFallback) {
      const target = mergedFallback.mergedInto
        ? allProjects.find((p) => p.id === mergedFallback.mergedInto)
        : null;
      return (
        <PageContainer>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> 返回仪表盘
          </button>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
            <GitMerge className="w-4 h-4 shrink-0" />
            <span>
              该项目已合并到 <span className="font-medium">{target ? `${target.name}（${target.code}）` : '未知项目'}</span>
            </span>
            {target && (
              <button
                onClick={() => navigate(`/projects/${target.id}`)}
                className="ml-1 text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
              >
                前往目标项目 →
              </button>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-3">{mergedFallback.code} - {mergedFallback.name}</p>
        </PageContainer>
      );
    }
    if (mergedFallbackLoading) {
      return (
        <PageContainer>
          <EmptyState title="加载中" description="正在查找该项目" />
        </PageContainer>
      );
    }
    return (
      <PageContainer>
        <EmptyState title="项目不存在" description="该项目可能已被删除" actionLabel="返回仪表盘" onAction={() => navigate('/')} />
      </PageContainer>
    );
  }

  // 归档项目显示特殊提示
  if (project.archived) {
    return (
      <PageContainer>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回仪表盘
        </button>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">项目已归档</h2>
          <p className="text-slate-500 mb-4">该项目已归档，无法进行编辑操作</p>
          <p className="text-sm text-slate-400">{project.code} - {project.name}</p>
        </div>
      </PageContainer>
    );
  }

  const statusConfig = getProjectStatusConfig(project.status);
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const openRisks = risks.filter((r) => r.status !== 'closed').length;
  const openTodos = todos.filter((t) => !t.completed).length;
  const manager = allMembers.find((m) => m.id === project.manager);

  // 进度环数值：默认按自身进度；开启「含子项目进度」时按子孙任务完成率聚合（不重复计数）
  const detailProgress = includeSubprojects ? getSubtreeStats(project.id).progress : (project.progress || 0);

  // 已合并横幅：源项目已被合并到目标（仅 active 且 mergedInto 非空时显示）
  const mergedTarget = project.mergedInto
    ? allProjects.find((p) => p.id === project.mergedInto)
    : null;

  return (
    <PageContainer>
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        返回仪表盘
      </button>

      {/* 已合并横幅 */}
      {mergedTarget && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2.5 mb-4">
          <GitMerge className="w-4 h-4 shrink-0" />
          <span>
            该项目已合并到 <span className="font-medium">{mergedTarget.name}</span>（{mergedTarget.code}）
          </span>
          <button
            onClick={() => navigate(`/projects/${mergedTarget.id}`)}
            className="ml-1 text-primary-600 hover:text-primary-700 font-medium underline underline-offset-2"
          >
            前往目标项目 →
          </button>
        </div>
      )}

      {/* Project Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            {/* 第 1 行：单独的项目编号长色块 */}
            <div
              className="inline-flex items-center px-4 py-1.5 rounded-md mb-3"
              style={{ backgroundColor: `${project.color}15` }}
            >
              <span className="text-base font-bold tracking-wide" style={{ color: project.color }}>
                {project.code}
              </span>
            </div>

            {/* 第 2 行：项目名 + 状态 */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">{project.name}</h2>
              <Badge variant="default" className={statusConfig.bgClass + ' ' + statusConfig.textClass}>
                {statusConfig.label}
              </Badge>
            </div>

            {/* 第 3 行：项目描述 */}
            {project.description && (
              <p className="text-sm text-slate-500 mt-2">{project.description}</p>
            )}

            {/* 第 4 行：时间 / 责任人 / 阶段 */}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {manager ? manager.name : project.manager || '未分配'}
              </span>
              <span>当前阶段: {project.phase}</span>
            </div>
          </div>

          {/* 进度环（保持右侧不动） */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke={project.color}
                    strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 34 * detailProgress / 100} ${2 * Math.PI * 34}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color: project.color }}>{detailProgress}%</span>
                </div>
              </div>
              <span className="text-xs text-slate-400 mt-1">总体进度</span>
            </div>

            {/* 右侧操作区：新建子项目 / 合并到… */}
            <div className="flex flex-col gap-2 items-stretch">
              {canManageProject(project) && getProjectLevel(project.id) < MAX_DEPTH && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSubParentId(project.id); setShowSubForm(true); }}
                  className="whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> 新建子项目
                </Button>
              )}
              {canMergeProject(project) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMergeDialog(true)}
                  className="whitespace-nowrap"
                >
                  <GitMerge className="w-4 h-4" /> 合并到…
                </Button>
              )}
              {/* P1-6：含子项目进度聚合开关（默认关） */}
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSubprojects}
                  onChange={(e) => setIncludeSubprojects(e.target.checked)}
                  className="rounded border-slate-300"
                />
                含子项目进度
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <button
          onClick={() => setActiveTab('tasks')}
          className="text-left transition-transform hover:scale-[1.02]"
        >
          <StatCard icon={CheckSquare} label="任务" value={tasks.length} sublabel={`完成 ${doneTasks}`} color="#3b82f6" />
        </button>
        <button
          onClick={() => setActiveTab('milestones')}
          className="text-left transition-transform hover:scale-[1.02]"
        >
          <StatCard icon={Flag} label="里程碑" value={milestones.length} color="#8b5cf6" />
        </button>
        <button
          onClick={() => setActiveTab('todos')}
          className="text-left transition-transform hover:scale-[1.02]"
        >
          <StatCard icon={Bell} label="待办" value={todos.length} sublabel={`未完成 ${openTodos}`} color="#f59e0b" />
        </button>
        <button
          onClick={() => setActiveTab('risks')}
          className="text-left transition-transform hover:scale-[1.02]"
        >
          <StatCard icon={AlertTriangle} label="风险" value={risks.length} sublabel={`待处理 ${openRisks}`} color="#ef4444" />
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className="text-left transition-transform hover:scale-[1.02]"
        >
          <StatCard icon={User} label="成员" value={projectMembers.length} color="#14b8a6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="项目信息">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">项目代号</dt>
                  <dd className="font-medium text-slate-800">{project.code}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">当前阶段</dt>
                  <dd className="font-medium text-slate-800">{project.phase}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">项目负责人</dt>
                  <dd className="font-medium text-slate-800">{manager ? manager.name : project.manager || '未分配'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">开始日期</dt>
                  <dd className="font-medium text-slate-800">{formatDate(project.startDate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">结束日期</dt>
                  <dd className="font-medium text-slate-800">{formatDate(project.endDate)}</dd>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <dt className="text-slate-500">总体进度</dt>
                  <dd className="flex items-center gap-2">
                    <div className="w-32"><ProgressBar value={project.progress} color={project.color} /></div>
                    <span className="font-bold text-slate-800">{project.progress}%</span>
                  </dd>
                </div>
              </dl>
            </Card>

            <Card title="项目成员">
              <div className="space-y-3">
                {projectMembers.slice(0, 4).map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: deptColorMap.get(m.departmentId) || m.avatarColor || '#6b7280' }}
                    >
                      {m.name.charAt(0)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium text-slate-700 truncate">{m.name}</span>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">{m.role || '成员'}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{m.position || m.department || ''}</p>
                    </div>
                  </div>
                ))}
                {projectMembers.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-4">暂无项目成员</div>
                )}
                {projectMembers.length > 4 && (
                  <button onClick={() => setActiveTab('members')} className="text-xs text-primary-600 hover:text-primary-700">
                    查看全部 {projectMembers.length} 人 →
                  </button>
                )}
              </div>
            </Card>

            <Card title={`项目文档 (${documents.length})`}>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {documents.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-4">暂无文档</div>
                )}
                {documents.slice(0, 8).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 p-2 rounded border border-slate-100 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setActiveTab('documents')}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs text-slate-700 truncate" title={doc.title}>
                      {doc.title}
                    </span>
                    {doc.category && (
                      <span className="text-xs text-slate-400 shrink-0">{doc.category}</span>
                    )}
                    {doc.files && doc.files.length > 0 && (
                      <span className="text-xs text-slate-400 shrink-0">{doc.files.length} 个附件</span>
                    )}
                  </div>
                ))}
                {documents.length > 8 && (
                  <button onClick={() => setActiveTab('documents')} className="text-xs text-primary-600 hover:text-primary-700 w-full text-center pt-1">
                    查看全部 {documents.length} 项 →
                  </button>
                )}
              </div>
            </Card>
          </div>

          {/* 项目明细三栏：任务/里程碑/待办，每栏带"新建"按钮 + 简要列表 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 任务 */}
            <Card title={`任务 (${tasks.length})`}>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {tasks.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-4">暂无任务</div>
                )}
                {tasks.slice(0, 5).map((t) => {
                  const statusLabel = { todo: '待启动', in_progress: '进行中', review: '审核中', done: '已完成', blocked: '阻塞' }[t.status] || t.status;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded border border-slate-100 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setActiveTab('tasks')}
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="flex-1 min-w-0 text-xs text-slate-700 truncate" title={t.title}>{t.title}</span>
                      <span className="text-xs text-slate-400 shrink-0">{statusLabel}</span>
                    </div>
                  );
                })}
                {tasks.length > 5 && (
                  <button onClick={() => setActiveTab('tasks')} className="text-xs text-primary-600 hover:text-primary-700 w-full text-center pt-1">
                    查看全部 {tasks.length} 项 →
                  </button>
                )}
              </div>
            </Card>

            {/* 里程碑 */}
            <Card title={`里程碑 (${milestones.length})`}>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {milestones.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-4">暂无里程碑</div>
                )}
                {milestones.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded border border-slate-100 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setActiveTab('milestones')}
                  >
                    <Flag className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs text-slate-700 truncate" title={m.title}>{m.title}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatDate(m.date)}</span>
                  </div>
                ))}
                {milestones.length > 5 && (
                  <button onClick={() => setActiveTab('milestones')} className="text-xs text-primary-600 hover:text-primary-700 w-full text-center pt-1">
                    查看全部 {milestones.length} 项 →
                  </button>
                )}
              </div>
            </Card>

            {/* 待办 */}
            <Card title={`待办 (${todos.length})`}>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {todos.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-4">暂无待办</div>
                )}
                {todos.slice(0, 5).map((todo) => {
                  const overdue = todo.dueDate && isOverdue(todo.dueDate) && !todo.completed;
                  return (
                    <div
                      key={todo.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded border transition-colors cursor-pointer',
                        todo.completed
                          ? 'bg-slate-50 border-slate-100 opacity-60 cursor-default'
                          : overdue
                          ? 'bg-red-50 border-red-200 hover:bg-red-100'
                          : 'bg-amber-50/50 border-amber-100 hover:bg-amber-50'
                      )}
                      onClick={() => {
                        if (todo.completed) return;
                        navigate(`/todo/${todo.id}`);
                      }}
                      title={todo.completed ? '已完成' : '点击查看待办详情'}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleTodo(todo.id); }}
                        role="checkbox"
                        aria-checked={todo.completed ? 'true' : 'false'}
                        className={cn(
                          'relative w-4 h-4 rounded-full border-2 shrink-0 select-none',
                          todo.completed ? 'bg-green-500 border-green-500' : 'border-amber-400'
                        )}
                      >
                        {todo.completed ? (
                          <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-2.5 h-2.5 pointer-events-none" aria-hidden="true">
                            <polyline points="5 10.5 9 14.5 15.5 7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </button>
                      <span
                        className={cn('flex-1 min-w-0 text-xs truncate', todo.completed ? 'text-slate-400 line-through' : 'text-slate-700')}
                        title={todo.title}
                      >
                        {todo.title}
                      </span>
                      {todo.dueDate && (
                        <span className={cn('text-xs shrink-0', overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
                          {dueDateLabel(todo.dueDate)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {todos.length > 5 && (
                  <button onClick={() => setActiveTab('todos')} className="text-xs text-primary-600 hover:text-primary-700 w-full text-center pt-1">
                    查看全部 {todos.length} 项 →
                  </button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <Card
          title="项目任务"
          action={canManageProject(project) ? <Button size="sm" onClick={() => setShowTaskForm(true)}><Plus className="w-4 h-4" />新增</Button> : undefined}
        >
          <TaskList
            tasks={tasks}
            projects={allProjects}
            onEdit={handleTaskEdit}
            onDelete={handleTaskDelete}
            onProgress={handleTaskProgress}
            onRowClick={handleTaskRowClick}
          />
          {showTaskForm && (
            <TaskForm
              defaultProjectId={id}
              task={editingTask}
              onClose={closeTaskForm}
            />
          )}
        </Card>
      )}

      {activeTab === 'milestones' && (
        <Card
          title="项目里程碑"
          action={canManageProject(project) ? (
            <Button size="sm" onClick={() => setShowMilestoneForm(true)}><Plus className="w-4 h-4" />新增</Button>
          ) : undefined}
        >
          <MilestoneList
            milestones={milestones}
            projects={allProjects}
            onEdit={handleMilestoneEdit}
            onDelete={handleMilestoneDelete}
          />
          {showMilestoneForm && (
            <MilestoneForm
              defaultProjectId={id}
              projects={allProjects}
              milestone={editingMilestone}
              onSave={saveMilestone}
              onClose={closeMilestoneForm}
            />
          )}
        </Card>
      )}

      {activeTab === 'todos' && (
        <Card
          title="项目待办"
          action={canManageProject(project) ? (
            <Button size="sm" onClick={() => setShowTodoForm(true)}><Plus className="w-4 h-4" />新增</Button>
          ) : undefined}
        >
          <div className="space-y-1.5">
            {todos.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-8">暂无待办</div>
            )}
            {todos.map((todo) => {
              const priConfig = getPriorityConfig(todo.priority);
              const overdue = todo.dueDate && isOverdue(todo.dueDate) && !todo.completed;
              const assigneeMember = allMembers.find((m) => m.name === todo.assignee);
              return (
                <div
                  key={todo.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    todo.completed
                      ? 'bg-slate-50 border-slate-100 opacity-60 cursor-default'
                      : overdue
                      ? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100'
                      : 'bg-amber-50 border-amber-200 cursor-pointer hover:bg-amber-100'
                  )}
                  onClick={() => {
                    if (todo.completed) return;
                    navigate(`/todo/${todo.id}`);
                  }}
                  title={todo.completed ? '已完成' : '点击查看待办详情'}
                >
                  <button
                    type="button"
                    onClick={() => toggleTodo(todo.id)}
                    role="checkbox"
                    aria-checked={todo.completed ? 'true' : 'false'}
                    className={cn(
                      'relative w-5 h-5 rounded-full border-2 shrink-0 select-none',
                      todo.completed ? 'bg-green-500 border-green-500' : 'border-amber-400 hover:border-amber-500'
                    )}
                  >
                    {todo.completed ? (
                      <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 pointer-events-none" aria-hidden="true">
                        <polyline points="5 10.5 9 14.5 15.5 7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-medium', todo.completed ? 'text-slate-400 line-through' : 'text-slate-800')}>
                        {todo.title}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priConfig.color }} title={priConfig.label} />
                    </div>
                    {todo.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{todo.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {todo.dueDate && (
                        <span className={cn('text-xs flex items-center gap-1', overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
                          <Clock className="w-3 h-3" />
                          {dueDateLabel(todo.dueDate)}
                        </span>
                      )}
                      {assigneeMember && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                            style={{ backgroundColor: deptColorMap.get(assigneeMember.departmentId) || assigneeMember.avatarColor || '#6b7280' }}
                          >
                            {assigneeMember.name.charAt(0)}
                          </span>
                          {assigneeMember.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManageProject(project) && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTodoEdit(todo); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                        title="编辑待办"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTodoDelete(todo); }}
                        className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                        title="删除待办"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {showTodoForm && (
            <TodoForm
              defaultProjectId={id}
              todo={editingTodo}
              onClose={closeTodoForm}
            />
          )}
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card
          title="项目文档"
          action={canManageProject(project) ? (
            <Button size="sm" onClick={() => setShowDocumentForm(true)}>
              <Plus className="w-4 h-4" />添加文档
            </Button>
          ) : undefined}
        >
          <DocumentGrid
            documents={documents}
            projects={allProjects}
            onEdit={handleDocumentEdit}
            onDelete={handleDocumentDelete}
          />
        </Card>
      )}
      {showDocumentForm && (
        <DocumentForm
          defaultProjectId={id}
          projects={allProjects}
          document={editingDocument}
          onClose={closeDocumentForm}
        />
      )}

      {activeTab === 'risks' && (
        <RiskList risks={risks} projects={allProjects} />
      )}

      {activeTab === 'members' && (
        <Card title={`项目成员（${projectMembers.length}）`}>
          {projectMembers.length === 0 ? (
            <EmptyState title="暂无成员" description="请在人员管理页面添加成员并关联此项目" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projectMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                      style={{ backgroundColor: deptColorMap.get(member.departmentId) || member.avatarColor || '#6b7280' }}
                    >
                      {member.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{member.name}</span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${ROLES[member.role]?.color || '#6b7280'}15`,
                            color: ROLES[member.role]?.color || '#6b7280',
                          }}
                        >
                          {ROLES[member.role]?.label || '成员'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {member.department && <span>{member.department}</span>}
                        {member.title && <span> · {member.title}</span>}
                      </div>
                      {member.email && (
                        <div className="text-xs text-slate-400 mt-1">{member.email}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 子项目表单弹窗 */}
      {showSubForm && (
        <ProjectForm
          parentProjectId={subParentId}
          isSubProject={!!subParentId}
          onClose={() => { setShowSubForm(false); setSubParentId(''); }}
          onSave={handleSaveSub}
        />
      )}

      {/* 合并弹窗 */}
      {showMergeDialog && (
        <MergeDialog
          sourceProject={project}
          onClose={() => setShowMergeDialog(false)}
          onMerge={handleMerge}
        />
      )}
    </PageContainer>
  );
}
