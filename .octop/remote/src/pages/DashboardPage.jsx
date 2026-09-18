import PageContainer from '@/components/layout/PageContainer';
import StatCard from '@/components/ui/StatCard';
import ProjectStats from '@/components/dashboard/ProjectStats';
import TaskStatusChart from '@/components/dashboard/TaskStatusChart';
import ProgressComparison from '@/components/dashboard/ProgressComparison';
import MilestoneTimeline from '@/components/dashboard/MilestoneTimeline';
import RiskSummary from '@/components/dashboard/RiskSummary';
import ResourceAllocation from '@/components/dashboard/ResourceAllocation';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useRiskStore } from '@/store/useRiskStore';
import { useResourceStore } from '@/store/useResourceStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useAuthStore } from '@/store/useAuthStore';
import { CheckSquare, AlertTriangle, Flag, Users, Bell } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccess } from '@/hooks/useAccess';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { canViewProjectTasks, canViewTodo } = useAccess();
  const projects = useProjectStore((s) => s.projects);
  const getSubtreeStats = useProjectStore((s) => s.getSubtreeStats);
  const tasks = useTaskStore((s) => s.tasks);
  const milestones = useMilestoneStore((s) => s.milestones);
  const risks = useRiskStore((s) => s.risks);
  const resources = useResourceStore((s) => s.resources);
  const members = useMemberStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const todos = useTodoStore((s) => s.todos);

  // Filter out archived projects and their related data
  const activeProjects = projects.filter((p) => !p.archived && !p.mergedInto);
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));
  const activeTasks = tasks.filter((t) => {
    const proj = projects.find((p) => p.id === t.projectId);
    return activeProjectIds.has(t.projectId) && canViewProjectTasks(proj);
  });
  const activeMilestones = milestones.filter((m) => activeProjectIds.has(m.projectId));
  const activeRisks = risks.filter((r) => activeProjectIds.has(r.projectId));
  const activeResources = resources.filter((r) => activeProjectIds.has(r.projectId));

  // 「按层级汇总」开关（默认关，扁平口径不重复计数）
  const [includeSubprojects, setIncludeSubprojects] = useState(false);
  // 仪表盘卡片仅展示根项目；开启“按层级汇总”时把子树子项目数注入用于角标
  const rootProjects = activeProjects.filter((p) => !p.parentProjectId);
  const dashboardProjects = useMemo(
    () =>
      includeSubprojects
        ? rootProjects.map((p) => ({ ...p, _subtreeChildCount: getSubtreeStats(p.id).childProjectCount }))
        : rootProjects,
    [includeSubprojects, rootProjects, getSubtreeStats]
  );

  const totalTasks = activeTasks.length;
  const doneTasks = activeTasks.filter((t) => t.status === 'done').length;
  const openRisks = activeRisks.filter((r) => r.status !== 'closed').length;
  const upcomingMilestones = activeMilestones.filter((m) => m.status === 'upcoming' || m.status === 'at_risk').length;
  const totalResources = activeResources.length;

  // 未完成事项 = 进行中任务 + 待启动任务 + 未完成待办（均使用 TodosPage 的可见性逻辑）
  const inProgressTasks = activeTasks.filter((t) => t.status === 'in_progress').length;
  const todoTasks = activeTasks.filter((t) => t.status === 'todo').length;
  const incompleteTodos = todos.filter((t) => !t.completed && canViewTodo(t)).length;
  const pendingItems = inProgressTasks + todoTasks + incompleteTodos;

  // 团队成员 = 被分配任务或待办的人员去重计数（排除纯企微同步的虚高人数）
  const assignedAssigneeIds = new Set();
  activeTasks.forEach((t) => {
    if (t.assignees) t.assignees.forEach((id) => assignedAssigneeIds.add(id));
    if (t.assignee) assignedAssigneeIds.add(t.assignee);
  });
  todos.forEach((t) => {
    if (t.assignee) assignedAssigneeIds.add(t.assignee);
  });
  const assignedMemberCount = assignedAssigneeIds.size;

  return (
    <PageContainer>
      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6 stagger-children">
        <StatCard
          icon={CheckSquare}
          label="任务总数"
          value={totalTasks}
          sublabel={`完成 ${doneTasks}`}
          color="#6366F1"
        />
        <StatCard
          icon={Flag}
          label="待达成里程碑"
          value={upcomingMilestones}
          sublabel={`共 ${activeMilestones.length} 个`}
          color="#8B5CF6"
        />
        <StatCard
          icon={AlertTriangle}
          label="待处理风险"
          value={openRisks}
          sublabel={`共 ${activeRisks.length} 个`}
          color="#DC2626"
        />
        <StatCard
          icon={Users}
          label="团队成员"
          value={assignedMemberCount}
          sublabel="个项目人员"
          color="#0D9488"
          onClick={() => navigate('/members')}
        />
        <StatCard
          icon={Bell}
          label="未完成事项"
          value={pendingItems}
          sublabel={`进行中 ${inProgressTasks} + 待启动 ${todoTasks} + 待办 ${incompleteTodos}`}
          color="#D97706"
          onClick={() => navigate('/todos')}
        />
      </div>

      {/* 层级汇总开关（默认关，开启时进度对比按子树聚合） */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">按层级汇总（含子项目进度）</span>
        <button
          type="button"
          onClick={() => setIncludeSubprojects((v) => !v)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
            includeSubprojects ? 'bg-blue-500' : 'bg-slate-300'
          }`}
          aria-pressed={includeSubprojects}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              includeSubprojects ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <ProjectStats projects={activeProjects} />
        </div>
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <TaskStatusChart tasks={activeTasks} />
        </div>
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <ProgressComparison projects={dashboardProjects} tasks={activeTasks} includeSubprojects={includeSubprojects} />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <MilestoneTimeline milestones={activeMilestones} projects={activeProjects} />
        </div>
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <RiskSummary risks={activeRisks} projects={activeProjects} />
        </div>
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <ResourceAllocation resources={activeResources} projects={activeProjects} />
        </div>
      </div>
    </PageContainer>
  );
}
