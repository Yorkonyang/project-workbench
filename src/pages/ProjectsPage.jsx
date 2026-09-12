import { useState, useMemo, useEffect } from 'react';
import { Plus, Archive, RotateCcw, FileText, X, ChevronRight, ChevronDown, Edit2, Trash2, ExternalLink, Calendar, User, Search, GripVertical } from 'lucide-react';
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
import { getChildren, collectSubtree, getProjectLevel, getAncestors, MAX_DEPTH } from '@/lib/hierarchy';
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
  const [subParentId, setSubParentId] = useState('');
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

  // T14 折叠记忆：展开状态持久化到 localStorage，刷新后恢复
  // 语义保留：未记录的节点默认展开（=== false 才折叠）
  const EXPAND_KEY = 'projects_tree_expanded_v1';
  const loadExpanded = (k) => {
    try {
      const raw = localStorage.getItem(EXPAND_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      return saved?.[k] || {};
    } catch {
      return {};
    }
  };
  const [expandedProjects, setExpandedProjects] = useState(() => loadExpanded('projects'));
  const [expandedTasks, setExpandedTasks] = useState(() => loadExpanded('tasks'));
  useEffect(() => {
    try {
      localStorage.setItem(EXPAND_KEY, JSON.stringify({ projects: expandedProjects, tasks: expandedTasks }));
    } catch { /* 忽略配额/隐私模式错误 */ }
  }, [expandedProjects, expandedTasks]);
  const [editingTask, setEditingTask] = useState(null);
  // T14 跨层级全局搜索（带层级标注）
  const [globalSearch, setGlobalSearch] = useState('');
  const [dragProjectId, setDragProjectId] = useState(null);
  const [dragOverProjectId, setDragOverProjectId] = useState(null);

  const toggleTodo = useTodoStore((s) => s.toggleTodo);

  const isAdmin = members.some((m) => m.id === currentUserId && m.role === 'admin');

  // 权限门控：项目负责人（含系统管理员）可见「归档 / 删除」
  // canReportTask：仅任务 assignee 才能打开/汇报进度
  // canManageTodo：仅 todo 的 owner/assignee 才能勾选/取消
  const { canManageProject, canReportTask, canManageTodo } = useAccess();

  // 已合并项目软隐藏（mergedInto 非空），不出现在任何列表
  const activeProjects = projects.filter((p) => !p.archived && !p.mergedInto);
  const archivedProjects = projects.filter((p) => p.archived && !p.mergedInto);
  const pendingArchiveProjects = projects.filter((p) => p.archiveStatus === 'requested' && !p.mergedInto);

  // 下拉查询：列出所有活跃根项目（主项目），选中后连同其子树一起展示
  // 不限状态（planned/in_progress/completed 均可筛选），避免新建/非进行中的项目被漏掉
  const rootProjectsForDropdown = useMemo(
    () => activeProjects.filter((p) => !p.parentProjectId),
    [activeProjects]
  );

  // 选中项目后，连同其全部下级隶属项目（递归）一起展示（复用层级工具）
  const subtreeIds = queryProjectId ? collectSubtree(projects, queryProjectId) : null;

  const filteredActive = subtreeIds
    ? activeProjects.filter((p) => subtreeIds.has(p.id))
    : activeProjects;

  const filteredArchived = archivedProjects;

  // T14 跨层级全局搜索：按 名称/编号/负责人 模糊匹配（不限层级），
  // 命中的项目 + 其全部祖先 都纳入展示并强制展开，便于在树中定位
  const globalSearchTrim = globalSearch.trim().toLowerCase();
  const globalMatchIds = useMemo(() => {
    if (!globalSearchTrim) return null;
    const matched = activeProjects.filter((p) => {
      const ownerName = members.find((m) => m.id === p.ownerId)?.name?.toLowerCase() || '';
      return (
        p.name?.toLowerCase().includes(globalSearchTrim) ||
        p.code?.toLowerCase().includes(globalSearchTrim) ||
        (ownerName && ownerName.includes(globalSearchTrim))
      );
    });
    const ids = new Set();
    matched.forEach((p) => {
      ids.add(p.id);
      getAncestors(projects, p.id).forEach((a) => ids.add(a.id));
    });
    return ids;
  }, [globalSearchTrim, activeProjects, members, projects]);
  // 全局搜索命中时，命中项的祖先链默认展开（覆盖折叠记忆）
  const globalExpandIds = useMemo(() => {
    if (!globalMatchIds) return null;
    const expand = new Set();
    activeProjects.forEach((p) => {
      getAncestors(projects, p.id).forEach((a) => expand.add(a.id));
    });
    return expand;
  }, [globalMatchIds, activeProjects, projects]);

  // 有效展示集合：全局搜索 > 子树下拉 > 全部活跃
  const visibleProjects = globalMatchIds
    ? activeProjects.filter((p) => globalMatchIds.has(p.id))
    : filteredActive;

  // 拖拽改挂：把项目拖到另一项目上，改挂为其子项目（仅改 parentProjectId，实体归属不变）
  const handleDragStart = (e, project) => {
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragProjectId(project.id);
  };
  const handleDragOver = (e, project) => {
    e.preventDefault();
    if (dragProjectId && dragProjectId !== project.id) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverProjectId(project.id);
    }
  };
  const handleDragLeave = () => setDragOverProjectId(null);
  const handleDropOnProject = async (e, targetProject) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    setDragOverProjectId(null);
    setDragProjectId(null);
    if (!sourceId || sourceId === targetProject.id) return;
    // 目标不能是源自身或其子孙（防环），且需有管理目标权限
    if (collectSubtree(projects, sourceId).has(targetProject.id)) {
      window.alert('不能挂到自身或其子项目下');
      return;
    }
    if (!canManageProject(targetProject)) {
      window.alert('您没有该项目的管理权限，无法改挂');
      return;
    }
    const source = projects.find((p) => p.id === sourceId);
    if (!source) return;
    const ok = window.confirm(`把「${source.name}」挂到「${targetProject.name}」下？\n其任务/待办/文档等实体仍保留在源项目，仅调整父子关系。`);
    if (!ok) return;
    try {
      await updateProject(sourceId, { parentProjectId: targetProject.id });
      setGlobalSearch('');
    } catch (err) {
      window.alert(`改挂失败：${err.message}`);
    }
  };

  // 递归渲染单个项目节点（主→子→任务→待办 四级树）
  const renderProjectNode = (project, level = 0) => {
    const projectTasks = tasksByProject[project.id] || [];
    const rawChildren = getChildren(projects, project.id);
    // T14：全局搜索时裁掉非命中兄弟分支，树只保留命中路径
    const childProjects = globalMatchIds
      ? rawChildren.filter((c) => globalMatchIds.has(c.id))
      : rawChildren;
    // T14：全局搜索命中时，命中项的祖先链强制展开（覆盖折叠记忆）
    const isProjectExpanded = globalMatchIds
      ? (globalExpandIds?.has(project.id) || expandedProjects[project.id] !== false)
      : expandedProjects[project.id] !== false; // 默认展开
    const taskTotal = projectTasks.length;
    const taskDone = projectTasks.filter((t) => t.status === 'done').length;
    const progress = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
    const canAddSub = canManageProject(project) && level < MAX_DEPTH;
    const atMaxDepth = level >= MAX_DEPTH;
    const isDropTarget = dragOverProjectId === project.id && dragProjectId && dragProjectId !== project.id;
    const isDragSource = dragProjectId === project.id;
    // T14：全局搜索命中项高亮
    const isGlobalHit = globalMatchIds && globalMatchIds.has(project.id) && globalSearchTrim;

    return (
      <div
        key={project.id}
        draggable={canManageProject(project) && !globalMatchIds}
        onDragStart={(e) => handleDragStart(e, project)}
        onDragOver={(e) => handleDragOver(e, project)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropOnProject(e, project)}
        className={cn(
          'bg-white rounded-xl border overflow-hidden transition-colors',
          level > 0 && 'mt-2',
          isDropTarget ? 'border-primary-400 ring-2 ring-primary-300 bg-primary-50/40' : 'border-slate-200',
          isDragSource && 'opacity-50',
          isGlobalHit && 'border-amber-300 ring-1 ring-amber-200'
        )}
      >
        {/* ── 项目行（含缩进 + 连接线 + 层级徽标）── */}
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ paddingLeft: level > 0 ? 16 + level * 16 : undefined }}
        >
          {level > 0 && <span className="absolute" style={{ left: level * 16 - 4 }} />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedProjects((prev) => ({ ...prev, [project.id]: !isProjectExpanded }));
            }}
            className="text-slate-400 hover:text-slate-600 shrink-0 p-0.5 rounded hover:bg-slate-200 transition-smooth"
            title={isProjectExpanded ? '收起' : '展开'}
          >
            {isProjectExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* 层级徽标 */}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">L{level}</span>

          <button
            onClick={() => {
              if (!canManageProject(project)) {
                navigate(`/projects/${project.id}`);
                return;
              }
              setTaskFormProjectId(project.id);
              setShowTaskForm(true);
            }}
            className={cn(
              'flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-lg px-1 py-0.5 transition-smooth',
              canManageProject(project) ? 'group hover:bg-slate-50 cursor-pointer' : 'group-hover:text-slate-700'
            )}
            title={canManageProject(project) ? '点击为该项目新建任务' : '点击进入项目详情（成员无权在此新建任务）'}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            <span className="text-xs text-slate-400 font-mono shrink-0">{project.code}</span>
            <span className="font-medium text-slate-800 flex-1 truncate group-hover:text-primary-600">{project.name}</span>
            <StatusBadge status={project.status} />
            {taskTotal > 0 && <span className="text-xs text-slate-400 whitespace-nowrap">{taskDone}/{taskTotal} 任务</span>}
          </button>

          {project.ownerId && (
            <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
              <User className="w-3 h-3" />
              {members.find((m) => m.id === project.ownerId)?.name || project.ownerId}
            </span>
          )}
          {(project.startDate || project.endDate) && (
            <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(project.startDate)} ~ {formatDate(project.endDate)}
            </span>
          )}
          {taskTotal > 0 && (
            <span className="text-xs text-slate-600 font-medium whitespace-nowrap">总体进度：{progress}%</span>
          )}

          {/* 新建子项目入口（负责人/admin，且未达最大层级） */}
          {canAddSub && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingProject(null);
                setSubParentId(project.id);
                setShowForm(true);
              }}
              className="p-1.5 hover:bg-primary-100 rounded text-slate-400 hover:text-primary-600 shrink-0"
              title="新建子项目"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {atMaxDepth && canManageProject(project) && (
            <span className="text-[10px] text-amber-500 shrink-0" title="已达最大层级，无法再建子项目">已达上限</span>
          )}

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
          {canManageProject(project) && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); directArchive(project.id); }}
                className="p-1.5 hover:bg-amber-100 rounded text-slate-400 hover:text-amber-600 shrink-0"
                title="归档项目"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingDeleteProject(project); }}
                className="p-1.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 shrink-0"
                title="删除项目"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* ── 展开区：子项目 + 直属任务 ── */}
        {isProjectExpanded && (
          <div className={cn('border-t border-slate-100', level > 0 && 'border-l-2 border-slate-200')}>
            {/* 子项目分组 */}
            {childProjects.length > 0 && (
              <div className="px-4 py-2 bg-slate-50/60">
                <div className="text-xs font-medium text-slate-500 mb-2">子项目 {childProjects.length} 个</div>
                <div className="space-y-2">
                  {childProjects.map((child) => renderProjectNode(child, level + 1))}
                </div>
              </div>
            )}
            {/* 直属任务分组 */}
            <div className="px-4 py-2">
              <div className="text-xs font-medium text-slate-500 mb-2">直属任务 {projectTasks.length} 个</div>
              {projectTasks.length === 0 ? (
                <div className="pl-12 text-xs text-slate-400">暂无任务</div>
              ) : (
                projectTasks.map((task) => {
                  const taskTodos = todosByTask[task.id] || [];
                  const isTaskExpanded = !!expandedTasks[task.id];
                  const todoDone = taskTodos.filter((t) => t.done).length;
                  return (
                    <div key={task.id}>
                      <div className="flex items-stretch border-b border-slate-50 last:border-b-0">
                        <div
                          className="flex items-center pl-12 pr-1 cursor-pointer hover:bg-slate-50 transition-smooth shrink-0"
                          onClick={() => setExpandedTasks((prev) => ({ ...prev, [task.id]: !isTaskExpanded }))}
                        >
                          <button className="text-slate-400 hover:text-slate-600">
                            {isTaskExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        </div>
                        <div
                          className={cn(
                            'flex items-center gap-2.5 px-2 py-2.5 flex-1 min-w-0 transition-smooth',
                            canReportTask(task) ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default text-slate-400'
                          )}
                          onClick={() => { if (!canReportTask(task)) return; setEditingTask(task); }}
                          title={canReportTask(task) ? '点击查看/汇报进度' : '您没有参与该任务，无权查看详情'}
                        >
                          <span className="text-sm text-slate-700 flex-1 truncate" style={{ fontFamily: 'SimHei, "Microsoft YaHei", sans-serif' }}>{task.title}</span>
                          <StatusBadge status={task.status} kind="task" />
                          {task.assignedTo && <span className="text-xs text-slate-400 truncate max-w-[100px]">{task.assignedTo}</span>}
                          {taskTodos.length > 0 && <span className="text-xs text-slate-400 whitespace-nowrap">{todoDone}/{taskTodos.length} 待办</span>}
                        </div>
                      </div>
                      {isTaskExpanded && taskTodos.length > 0 && (
                        <div className="bg-slate-50">
                          {taskTodos.map((todo) => {
                            const overdue = todo.dueDate && !todo.completed && isOverdue(todo.dueDate);
                            return (
                              <div key={todo.id} className="flex items-center gap-2.5 px-4 py-2 pl-20 border-b border-slate-100 last:border-b-0">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); if (canManageTodo(todo)) toggleTodo(todo.id); }}
                                  disabled={!canManageTodo(todo)}
                                  aria-checked={todo.completed ? 'true' : 'false'}
                                  role="checkbox"
                                  className={cn(
                                    'relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors select-none',
                                    todo.completed
                                      ? 'bg-green-500 border-green-500'
                                      : canManageTodo(todo) ? 'border-slate-300 hover:border-primary-500' : 'border-slate-200 opacity-50 cursor-not-allowed'
                                  )}
                                >
                                  {todo.completed && (
                                    <svg viewBox="0 0 20 20" className="absolute inset-0 m-auto w-3 h-3 pointer-events-none" aria-hidden="true">
                                      <polyline points="5 10.5 9 14.5 15.5 7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </button>
                                <span className={cn('text-sm flex-1 truncate', todo.completed ? 'text-slate-400 line-through' : 'text-slate-600')}>{todo.title}</span>
                                {todo.dueDate && (
                                  <span className={cn('text-xs whitespace-nowrap', overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>{dueDateLabel(todo.dueDate)}</span>
                                )}
                                <span className={cn('text-xs px-1.5 py-0.5 rounded whitespace-nowrap', todo.completed ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50')}>
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
          </div>
        )}
      </div>
    );
  };

  const handleSave = (data) => {
    if (editingProject) {
      updateProject(editingProject.id, data);
    } else {
      addProject(data);
    }
    setShowForm(false);
    setEditingProject(null);
    setSubParentId('');
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
            {rootProjectsForDropdown.map((p) => (
              <option key={p.id} value={p.id}>{p.code} {p.name}</option>
            ))}
          </select>
        </div>
        {/* T14 跨层级全局搜索：按 名称/编号/负责人 模糊匹配，命中项+祖先链展开定位 */}
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="跨层级搜索项目（名称/编号/负责人）"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-smooth bg-white"
          />
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
              onAddSubProject={handleAddSubProject}
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
        /* 活跃项目 — 主→子→任务→待办 四级树（全局搜索时仅显示命中分支） */
        <div className="space-y-2">
          {visibleProjects
            .filter((p) => !p.parentProjectId)
            .map((project) => renderProjectNode(project, 0))}
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
          parentProjectId={subParentId}
          isSubProject={!!subParentId && !editingProject}
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
