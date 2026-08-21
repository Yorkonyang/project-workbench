import { useState } from 'react';
import { Plus, Archive, RotateCcw, FileText, Check, X } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import ProjectForm from '@/components/projects/ProjectForm';
import ProjectCard from '@/components/projects/ProjectCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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

  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const archiveProject = useProjectStore((s) => s.archiveProject);
  const approveArchive = useProjectStore((s) => s.approveArchive);
  const rejectArchive = useProjectStore((s) => s.rejectArchive);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const members = useAuthStore((s) => s.members || []);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const isAdmin = members.some((m) => m.id === currentUserId && m.role === 'admin');

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

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {showPending
          ? pendingArchiveProjects.map((project) => (
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
            ))
          : (showArchived ? filteredArchived : filteredActive).map((project) => (
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
            ))
        }
      </div>

      {((showArchived ? filteredArchived : showPending ? pendingArchiveProjects : filteredActive).length === 0) && (
        <div className="text-center py-16 text-slate-400">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            {showPending ? '暂无待审批的归档申请' : showArchived ? '暂无已归档项目' : '暂无进行中的项目'}
          </p>
          {!showArchived && !showPending && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => { setEditingProject(null); setShowForm(true); }}
            >
              <Plus className="w-4 h-4" /> 新建第一个项目
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <ProjectForm
          project={editingProject}
          onClose={handleCloseForm}
          onSave={handleSave}
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
    </PageContainer>
  );
}
