import { useState, useMemo } from 'react';
import { Plus, Archive, RotateCcw, FileText, X, ChevronRight, ChevronDown, Edit2, Trash2, ExternalLink, Calendar, User } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import ProjectForm from '@/components/projects/ProjectForm';
import ProjectCard from '@/components/projects/ProjectCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useProjectStore } from '@/store/useProjectStore';
import { useAccess } from '@/hooks/useAccess';
import { useAuthStore } from '@/store/useAuthStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { cn, isOverdue, dueDateLabel, getProjectStatusConfig, formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import TaskProgressModal from '@/components/tasks/TaskProgressModal';
import TaskForm from '@/components/tasks/TaskForm';

const TASK_STATUS_LABEL = { todo: '待启动', in_progress: '进行中', review: '审核中', done: '已完成', blocked: '阻塞' };
const TASK_STATUS_COLOR = { todo: '#9ca3af', in_progress: '#378ADD', review: '#8b5cf6', done: '#1D9E75', blocked: '#ef4444' };

function StatusBadge({ status, kind = 'project' }) {
  if (kind === 'project') {
    const cfg = getProjectStatusConfig(status);
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bgClass} ${cfg.textClass}`}>{cfg.label}</span>;
  }
  const label = TASK_STATUS_LABEL[status] || status;
  const color = TASK_STATUS_COLOR[status] || '#9ca3af';
  return <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}1a`, color }}>{label}</span>;
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [queryProjectId, setQueryProjectId] = useState('');
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveNote, setArchiveNote] = useState('');
  const [pendingArchiveProject, setPendingArchiveProject] = useState(null);
  const [showArchiveForm, setShowArchiveForm] = useState(false);
  // 新建任务弹窗：绑定项目（点击项目标题区域打开，自动关联该项目）
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormProjectId, setTaskFormProjectId] = useState('');
  // 删除确认：待删除项目
  const [pendingDeleteProject, setPendingDeleteProject] = useState(null);

  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const archiveProject = useProjectStore((s) => s.archiveProject);
  const approveArchive = useProjectStore((s) => s.approveArchive);
  const rejectArchive = useProjectStore((s) => s.rejectArchive);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const directArchive = useProjectStore((s) => s.directArchive);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const members = useMemberStore((s) => s.members || []);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const tasks = useTaskStore((s) => s.tasks);
  const todos = useTodoStore((s) => s.todos);

  // 按 projectId 分组 tasks
  const tasksByProject = useMemo(() => {
    const map = {};
    (tasks || []).forEach((t) => {
      if (!map[t.projectId]) map[t.projectId] = [];
      map[t.projectId].push(t);
    });
    return map;
  }, [tasks]);

  // 按 taskId 分组 todos
  const todosByTask = useMemo(() => {
    const map = {};
    (todos || []).forEach((t) => {
      if (t.taskId) {
        if (!map[t.taskId]) map[t.taskId] = [];
        map[t.taskId].push(t);
      }
    });
    return map;
  }, [todos]);

  // 默认展开所有项目（任务层可见），待办层默认收起
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});
  const [editingTask, setEditingTask] = useState(null);

  const toggleTodo = useTodoStore((s) => s.toggleTodo);

  const isAdmin = members.some((m) => m.id === currentUserId && m.role === 'admin');

  // 权限门控：项目负责人（含系统管理员）可见「归档 / 删除」
  // canReportTask：仅任务 assignee 才能打开/汇报进度
  // canManageTodo：仅 todo 的 owner/assignee 才能勾选/取消
  const { canManageProject, canReportTask, canManageTodo } = useAccess();

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);
  const pendingArchiveProjects = projects.filter((p) => p.archiveStatus === 'requested');

  // 下拉查询：仅列出「进行中」项目
  const inProgressProjects = projects.filter((p) => !p.archived && p.status === 'in_progress');

  // 选中项目后，连同其全部下级隶属项目（递归）一起展示
  const collectSubtree = (rootId) => {
    const ids = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      projects.forEach((p) => {
        if (p.parentProjectId && ids.has(p.parentProjectId) && !ids.has(p.id)) {
          ids.add(p.id);
          changed = true;
        }
      });
    }
    return ids;
  };
  const subtreeIds = queryProjectId ? collectSubtree(queryProjectId) : null;

  const filteredActive = subtreeIds
    ? activeProjects.filter((p) => subtreeIds.has(p.id))
    : activeProjects;

  const filteredArchived = archivedProjects;

  const handleSave = (data) => {
    if (editingProject) {
      updateProject(editingProject.id, data);
    } else {
      addProject(data);
    }
    setShowForm(false);
    setEditingProject(null);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  // 点击项目卡片跳转项目详情页（与任务管理入口保持一致）
  const handleCardClick = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  // 申请归档
  const handleArchiveRequest = (project) => {
    setPendingArchiveProject(project);
    setShowArchiveForm(true);
  };

  const submitArchiveRequest = async () => {
    if (!pendingArchiveProject) return;
    try {
      await archiveProject(pendingArchiveProject.id, archiveReason, archiveNote);
      // 通知管理员
      const adminMembers = members.filter((m) => m.role === 'admin');
      adminMembers.forEach((admin) => {
        addNotification({
          type: 'archive_requested',
          title: '新项目归档申请',
          message: `「${pendingArchiveProject.name}」提交归档申请，等待审批`,
          user_id: admin.id,
          relatedId: pendingArchiveProject.id,
          relatedType: 'project',
          link: '/projects',
        });
      });
      setShowArchiveForm(false);
      setPendingArchiveProject(null);
      setArchiveReason('');
      setArchiveNote('');
    } catch (err) {
      console.error('归档申请失败:', err);
    }
  };

  // 审批通过
  const handleApprove = async (project) => {
    try {
      const result = await approveArchive(project.id);
      // 通知项目成员
      members.forEach((member) => {
        addNotification({
          type: 'archive_approved',
          title: '项目归档审批通过',
          message: `「${project.name}」已审批通过归档`,
          user_id: member.id,
          relatedId: project.id,
          relatedType: 'project',
          link: '/projects',
        });
      });
    } catch (err) {
      console.error('审批失败:', err);
    }
  };

  // 驳回
  const handleReject = async (project) => {
    try {
      await rejectArchive(project.id);
      // 通知申请人
      const applicant = members.find((m) => m.id === project.createdBy);
      if (applicant) {
        addNotification({
          type: 'archive_rejected',
          title: '项目归档申请被驳回',
          message: `「${project.name}」归档申请已被驳回`,
          user_id: applicant.id,
          relatedId: project.id,
          relatedType: 'project',
          link: '/projects',
        });
      }
    } catch (err) {
      console.error('驳回失败:', err);
    }
  };

  // 恢复项目
  const handleRestore = async (project) => {
    try {
      await restoreProject(project.id);
    } catch (err) {
      console.error('恢复失败:', err);
    }
  };

  // 删除项目（ProjectCard 已通过 store 处理，这里仅作为回调通知）
  const handleDelete = (projectId) => {
    // 通知已由 ProjectCard 内部处理
  };

  return (
    <PageContainer
      title="项目管理"
      subtitle={`${activeProjects.length} 个活跃项目`}
      action={
        <Button size="sm" onClick={() => { setEditingProject(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" />
          新建项目
        </Button>
      }
    >
      {/* 下拉查询：仅列出进行中项目，选中后展示其全部子项目 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 max-w-xs relative">
          <select
            value={queryProjectId}
            onChange={(e) => setQueryProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth bg-white"
          >
            <option value="">全部项目</option>
            {inProgressProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}（{p.code}）</option>
            ))}
          </select>
        </div>
        {queryProjectId && (
          <button
            onClick={() => setQueryProjectId('')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-smooth bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            ← 返回全部项目
          </button>
        )}
        {showPending && (
          <button
            onClick={() => { setShowPending(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-smooth bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            ← 返回全部项目
          </button>
        )}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-smooth',
            showArchived
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          {showArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          {showArchived ? '显示进行中' : '已归档'}
          <span className="text-xs opacity-70">{archivedProjects.length}</span>
        </button>
        {/* 待审批归档按钮（仅管理员可见） */}
        {isAdmin && pendingArchiveProjects.length > 0 && (
          <button
            onClick={() => {
              setShowPending(true);
              setShowArchived(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-smooth bg-amber-100 text-amber-700 hover:bg-amber-200'
            )}
          >
            <FileText className="w-4 h-4" />
            待审批
            <span className="text-xs font-bold">{pendingArchiveProjects.length}</span>
          </button>
        )}
      </div>

      {/* 三级层级：项目→任务→待办 */}
      {showPending ? (
        /* 待审批 — 卡片网格 */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pendingArchiveProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={handleEdit}
              showArchive={false}
              onArchiveRequest={() => handleArchiveRequest(project)}
              onApprove={() => handleApprove(project)}
              onReject={() => handleReject(project)}
              onCardClick={() => handleCardClick(project.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : showArchived ? (
        /* 归档 — 卡片网格 */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredArchived.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={handleEdit}
              onArchive={() => setShowArchived(false)}
              onRestore={() => handleRestore(project)}
              showArchive={!project.archived}
              onCardClick={() => handleCardClick(project.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        /* 活跃项目 — 三级层级视图 */
        <div className="space-y-2">
          {filteredActive.map((project) => {
            const projectTasks = tasksByProject[project.id] || [];
            const isProjectExpanded = expandedProjects[project.id] !== false; // 默认展开
            const taskTotal = projectTasks.length;
            const taskDone = projectTasks.filter((t) => t.status === 'done').length;
            // 计算项目总体进度（基于任务完成率）
            const progress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
            // 获取项目负责人
            const owner = members.find((m) => m.id === project.ownerId);
            const ownerName = owner?.name || project.ownerId || '未设置';

            return (
              <div key={project.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* ── 第一层：项目行 ── */}
                <div className="flex items-center gap-2.5 px-4 py-3">
                  {/* 左端展开/折叠按钮：只控制任务列表显隐 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedProjects((prev) => ({ ...prev, [project.id]: !isProjectExpanded }));
                    }}
                    className="text-slate-400 hover:text-slate-600 shrink-0 p-0.5 rounded hover:bg-slate-200 transition-smooth"
                    title={isProjectExpanded ? '收起任务' : '展开任务'}
                  >
                    {isProjectExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {/* 项目圆点 + 标题区域：项目负责人点击打开新建任务弹窗；成员点击进入项目详情（无权新建任务） */}
                  <button
                    onClick={() => {
                      // 权限矩阵：被分配任务的成员不能在没有负责的项目中新建任务
                      // - 负责人/admin：点击弹新建任务（绑该项目）
                      // - 成员：跳项目详情页（不做"新建任务"入口）
                      if (!canManageProject(project)) {
                        navigate(`/projects/${project.id}`);
                        return;
                      }
                      setTaskFormProjectId(project.id);
                      setShowTaskForm(true);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-lg px-1 py-0.5 transition-smooth",
                      canManageProject(project)
                        ? "group hover:bg-slate-50 cursor-pointer"
                        : "group-hover:text-slate-700"
                    )}
                    title={canManageProject(project) ? '点击为该项目新建任务' : '点击进入项目详情（成员无权在此新建任务）'}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="text-xs text-slate-400 font-mono shrink-0">{project.code}</span>
                    <span className="font-medium text-slate-800 flex-1 truncate group-hover:text-primary-600">
                      {project.name}
                    </span>
                    <StatusBadge status={project.status} />
                    {taskTotal > 0 && (
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {taskDone}/{taskTotal} 任务
                      </span>
                    )}
                  </button>
                  {/* 新增：项目负责人信息 */}
                  {project.ownerId && (
                    <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {members.find(m => m.id === project.ownerId)?.name || project.ownerId}
                    </span>
                  )}
                  {/* 新增：日期范围信息（开始时间 ~ 结束时间） */}
                  {(project.startDate || project.endDate) && (
                    <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
                    </span>
                  )}
                  {/* 新增：总体进度信息 */}
                  {taskTotal > 0 && (
                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                      总体进度：{Math.round((taskDone / taskTotal) * 100)}%
                    </span>
                  )}
                  {/* 最右端：进入项目详情 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id}`);
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 shrink-0"
                    title="进入项目详情"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  {/* 归档 / 删除：仅项目负责人可见（普通成员不显示） */}
                  {canManageProject(project) && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          directArchive(project.id);
                        }}
                        className="p-1.5 hover:bg-amber-100 rounded text-slate-400 hover:text-amber-600 shrink-0"
                        title="归档项目（完成后清理列表）"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteProject(project);
                        }}
                        className="p-1.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 shrink-0"
                        title="删除项目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                {/* ── 第二层：任务列表 ── */}
                {isProjectExpanded && (
                  <div className="border-t border-slate-100">
                    {projectTasks.length === 0 ? (
                      <div className="px-4 py-3 pl-12 text-xs text-slate-400">暂无任务</div>
                    ) : (
                      projectTasks.map((task) => {
                        const taskTodos = todosByTask[task.id] || [];
                        const isTaskExpanded = !!expandedTasks[task.id]; // 默认收起
                        const todoDone = taskTodos.filter((t) => t.done).length;

                        return (
                          <div key={task.id}>
                            {/* 任务行：点击箭头展开/折叠待办，点击主体弹出进度汇报 */}
                            <div className="flex items-stretch border-b border-slate-50 last:border-b-0">
                              {/* 展开/折叠箭头 */}
                              <div
                                className="flex items-center pl-12 pr-1 cursor-pointer hover:bg-slate-50 transition-smooth shrink-0"
                                onClick={() =>
                                  setExpandedTasks((prev) => ({
                                    ...prev,
                                    [task.id]: !isTaskExpanded,
                                  }))
                                }
                              >
                                <button className="text-slate-400 hover:text-slate-600">
                                  {isTaskExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              {/* 任务主体：仅任务负责人（assignee）才能点击弹出进度汇报；其他人不可打开（权限矩阵） */}
                              <div
                                className={cn(
                                  "flex items-center gap-2.5 px-2 py-2.5 flex-1 min-w-0 transition-smooth",
                                  canReportTask(task) ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default text-slate-400'
                                )}
                                onClick={() => {
                                  if (!canReportTask(task)) return; // 非任务责任人不可打开
                                  setEditingTask(task);
                                }}
                                title={canReportTask(task) ? '点击查看/汇报进度' : '您没有参与该任务，无权查看详情'}
                              >
                                <span className="text-sm text-slate-700 flex-1 truncate" style={{ fontFamily: 'SimHei, "Microsoft YaHei", sans-serif' }}>
                                  {task.title}
                                </span>
                                <StatusBadge status={task.status} kind="task" />
                                {task.assignedTo && (
                                  <span className="text-xs text-slate-400 truncate max-w-[100px]">
                                    {task.assignedTo}
                                  </span>
                                )}
                                {taskTodos.length > 0 && (
                                  <span className="text-xs text-slate-400 whitespace-nowrap">
                                    {todoDone}/{taskTodos.length} 待办
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* ── 第三层：待办列表 ── */}
                            {isTaskExpanded && taskTodos.length > 0 && (
                              <div className="bg-slate-50">
                                {taskTodos.map((todo) => {
                                  const overdue = todo.dueDate && !todo.completed && isOverdue(todo.dueDate);
                                  return (
                                    <div
                                      key={todo.id}
                                      className="flex items-center gap-2.5 px-4 py-2 pl-20 border-b border-slate-100 last:border-b-0"
                                    >
                                      {/* 圆形 checkbox：未完成时空心 ⭕️，完成后绿色圆带白勾
                                          注意：内部只能渲染勾选图标，禁止塞入任何文本，避免渲染 0 等异常字符 */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // 仅项目的 owner/admin 或 自己创建/被分配的待办 可切换状态
                                          if (canManageTodo(todo)) toggleTodo(todo.id);
                                        }}
                                        disabled={!canManageTodo(todo)}
                                        aria-checked={todo.completed ? 'true' : 'false'}
                                        role="checkbox"
                                        className={cn(
                                          "relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors select-none",
                                          todo.completed
                                            ? 'bg-green-500 border-green-500'
                                            : canManageTodo(todo)
                                              ? 'border-slate-300 hover:border-primary-500'
                                              : 'border-slate-200 opacity-50 cursor-not-allowed'
                                        )}
                                      >
                                        {todo.completed ? (
                                          <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 pointer-events-none" aria-hidden="true">
                                            <polyline points="5 10.5 9 14.5 15.5 7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        ) : null}
                                      </button>
                                      <span
                                        className={`text-sm flex-1 truncate ${
                                          todo.completed
                                            ? 'text-slate-400 line-through'
                                            : 'text-slate-600'
                                        }`}
                                      >
                                        {todo.title}
                                      </span>
                                      {todo.dueDate && (
                                        <span
                                          className={`text-xs whitespace-nowrap ${
                                            overdue
                                              ? 'text-red-500 font-medium'
                                              : 'text-slate-400'
                                          }`}
                                        >
                                          {dueDateLabel(todo.dueDate)}
                                        </span>
                                      )}
                                      <span
                                        className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                                          todo.completed
                                            ? 'text-green-600 bg-green-50'
                                            : 'text-amber-600 bg-amber-50'
                                        }`}
                                      >
                                        {todo.completed ? '已完成' : '待办'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 空状态 */}
      {showPending && pendingArchiveProjects.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无待审批的归档申请</p>
        </div>
      )}
      {showArchived && filteredArchived.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无已归档项目</p>
        </div>
      )}
      {!showPending && !showArchived && filteredActive.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无进行中的项目</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => { setEditingProject(null); setShowForm(true); }}
          >
            <Plus className="w-4 h-4" /> 新建第一个项目
          </Button>
        </div>
      )}

      {showForm && (
        <ProjectForm
          project={editingProject}
          onClose={handleCloseForm}
          onSave={handleSave}
        />
      )}

      {/* 新建任务弹窗：点击项目标题区域打开，自动关联该项目 */}
      {showTaskForm && (
        <TaskForm
          defaultProjectId={taskFormProjectId}
          onClose={() => setShowTaskForm(false)}
        />
      )}

      {/* 归档原因弹窗 */}
      {showArchiveForm && pendingArchiveProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">申请归档「{pendingArchiveProject.name}」</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">归档原因</label>
                <select
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  <option value="">请选择原因</option>
                  <option value="项目已完成">项目已完成</option>
                  <option value="项目提前终止">项目提前终止</option>
                  <option value="负责人调动">负责人调动</option>
                  <option value="预算调整">预算调整</option>
                  <option value="其他原因">其他原因</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">补充说明</label>
                <textarea
                  value={archiveNote}
                  onChange={(e) => setArchiveNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  placeholder="请输入补充说明（可选）"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowArchiveForm(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={submitArchiveRequest} className="flex-1" disabled={!archiveReason}>
                提交申请
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 任务进度汇报弹窗 */}
      {editingTask && (
        <TaskProgressModal
          task={editingTask}
          projects={projects}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* 删除项目确认对话框（防误操作） */}
      {pendingDeleteProject && (
        <ConfirmDialog
          title="删除项目"
          message={`确定要删除「${pendingDeleteProject.name}」吗？该操作将同时删除其下所有任务（含子项目），且不可恢复。`}
          confirmLabel="删除"
          onConfirm={async () => {
            try {
              await deleteProject(pendingDeleteProject.id);
            } catch (err) {
              console.error('删除项目失败:', err);
            } finally {
              setPendingDeleteProject(null);
            }
          }}
          onClose={() => setPendingDeleteProject(null)}
        />
      )}
    </PageContainer>
  );
}
