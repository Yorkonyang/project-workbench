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
import { useNavigate } from 'react-router-dom';
import { useAccess } from '@/hooks/useAccess';

export default function DashboardPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks);
  const milestones = useMilestoneStore((s) => s.milestones);
  const risks = useRiskStore((s) => s.risks);
  const resources = useResourceStore((s) => s.resources);
  const members = useMemberStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const todos = useTodoStore((s) => s.todos);

  // Filter out archived projects and their related data
  const activeProjects = projects.filter((p) => !p.archived);
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));
  const activeTasks = tasks.filter((t) => activeProjectIds.has(t.projectId));
  const activeMilestones = milestones.filter((m) => activeProjectIds.has(m.projectId));
  const activeRisks = risks.filter((r) => activeProjectIds.has(r.projectId));
  const activeResources = resources.filter((r) => activeProjectIds.has(r.projectId));

  const totalTasks = activeTasks.length;
  const doneTasks = activeTasks.filter((t) => t.status === 'done').length;
  const openRisks = activeRisks.filter((r) => r.status !== 'closed').length;
  const upcomingMilestones = activeMilestones.filter((m) => m.status === 'upcoming' || m.status === 'at_risk').length;
  const totalResources = activeResources.length;

  // 未完成事项 = 进行中任务 + 待启动任务 + 未完成待办（均为当前用户）
  const inProgressTasks = activeTasks.filter((t) => (t.assignees?.includes(currentUserId) || t.assignee === currentUserId) && t.status === 'in_progress').length;
  const todoTasks = activeTasks.filter((t) => (t.assignees?.includes(currentUserId) || t.assignee === currentUserId) && t.status === 'todo').length;
  const incompleteTodos = todos.filter((t) => t.assignee === currentUserId && !t.completed).length;
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <ProjectStats projects={activeProjects} />
        </div>
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <TaskStatusChart tasks={activeTasks} />
        </div>
        <div className="lg:col-span-1 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <ProgressComparison projects={activeProjects} tasks={activeTasks} />
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
