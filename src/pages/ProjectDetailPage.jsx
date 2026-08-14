import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Flag, CheckSquare, FolderOpen, AlertTriangle, Users, Edit2, Plus, Archive } from 'lucide-react';
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
import DocumentGrid from '@/components/documents/DocumentGrid';
import RiskList from '@/components/risks/RiskList';
import MemberCard from '@/components/members/MemberCard';
import {
  getProjectStatusConfig,
  formatDate,
  cn,
} from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useRiskStore } from '@/store/useRiskStore';
import { useResourceStore } from '@/store/useResourceStore';
import { useMemberStore } from '@/store/useMemberStore';
import { ROLES } from '@/config/permissions';

const TABS = [
  { key: 'overview', label: '概览', icon: Calendar },
  { key: 'tasks', label: '任务', icon: CheckSquare },
  { key: 'milestones', label: '里程碑', icon: Flag },
  { key: 'documents', label: '文档', icon: FolderOpen },
  { key: 'risks', label: '风险', icon: AlertTriangle },
  { key: 'resources', label: '资源', icon: Users },
  { key: 'members', label: '成员', icon: User },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const project = useProjectStore((s) => s.projects.find((p) => p.id === id));
  const allProjects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks.filter((t) => t.projectId === id));
  const milestones = useMilestoneStore((s) => s.milestones.filter((m) => m.projectId === id));
  const documents = useDocumentStore((s) => s.documents.filter((d) => d.projectId === id));
  const risks = useRiskStore((s) => s.risks.filter((r) => r.projectId === id));
  const resources = useResourceStore((s) => s.resources.filter((r) => r.projectId === id));
  const allMembers = useMemberStore((s) => s.members);
  const projectMembers = useMemo(() => allMembers.filter((m) => m.projectIds?.includes(id)), [allMembers, id]);

  const [activeTab, setActiveTab] = useState('overview');
  const [showTaskForm, setShowTaskForm] = useState(false);

  if (!project) {
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
  const manager = allMembers.find((m) => m.id === project.manager);

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

      {/* Project Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${project.color}15` }}
            >
              <span className="text-lg font-bold" style={{ color: project.color }}>{project.code}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">{project.name}</h2>
                <Badge variant="default" className={statusConfig.bgClass + ' ' + statusConfig.textClass}>
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">{project.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
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
          </div>

          {/* Progress ring */}
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
                    strokeDasharray={`${2 * Math.PI * 34 * project.progress / 100} ${2 * Math.PI * 34}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color: project.color }}>{project.progress}%</span>
                </div>
              </div>
              <span className="text-xs text-slate-400 mt-1">总体进度</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon={CheckSquare} label="任务" value={tasks.length} sublabel={`完成 ${doneTasks}`} color="#3b82f6" />
        <StatCard icon={Flag} label="里程碑" value={milestones.length} color="#8b5cf6" />
        <StatCard icon={AlertTriangle} label="风险" value={risks.length} sublabel={`待处理 ${openRisks}`} color="#ef4444" />
        <StatCard icon={Users} label="资源" value={resources.length} color="#14b8a6" />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            <Card title="资源分配">
              <div className="space-y-3">
                {resources.map((res) => (
                  <div key={res.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{res.name}</span>
                        <span className="text-xs text-slate-400">{res.role}</span>
                      </div>
                      <ProgressBar value={res.allocation} color={project.color} height="h-1.5" />
                      <div className="flex items-center gap-2 mt-1">
                        {res.skills?.slice(0, 3).map((s) => (
                          <span key={s} className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {resources.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-4">暂无资源分配</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <Card
          title="项目任务"
          actions={<Button size="sm" onClick={() => setShowTaskForm(true)}><Plus className="w-4 h-4" />新建</Button>}
        >
          <TaskList tasks={tasks} projects={allProjects} />
          {showTaskForm && <TaskForm defaultProjectId={id} onClose={() => setShowTaskForm(false)} />}
        </Card>
      )}

      {activeTab === 'milestones' && (
        <MilestoneList milestones={milestones} projects={allProjects} />
      )}

      {activeTab === 'documents' && (
        <DocumentGrid documents={documents} projects={allProjects} />
      )}

      {activeTab === 'risks' && (
        <RiskList risks={risks} projects={allProjects} />
      )}

      {activeTab === 'resources' && (
        <Card title="资源列表">
          <div className="space-y-3">
            {resources.map((res) => (
              <div key={res.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{res.name}</span>
                    <Badge variant="default">{res.role}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{res.notes}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {res.skills?.map((s) => (
                      <span key={s} className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: project.color }}>{res.allocation}%</div>
                  <div className="text-xs text-slate-400">{res.availability === 'full' ? '全职' : res.availability === 'shared' ? '共享' : '兼职'}</div>
                </div>
              </div>
            ))}
            {resources.length === 0 && (
              <EmptyState title="暂无资源" />
            )}
          </div>
        </Card>
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
                      style={{ backgroundColor: member.avatarColor || '#6b7280' }}
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
    </PageContainer>
  );
}
