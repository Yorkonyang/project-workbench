import { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import GanttView from '@/components/timeline/GanttView';
import MilestoneList from '@/components/timeline/MilestoneList';
import MilestoneForm from '@/components/timeline/MilestoneForm';
import { useTaskStore } from '@/store/useTaskStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useAccess } from '@/hooks/useAccess';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDescendants } from '@/lib/hierarchy';

export default function TimelinePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tasks = useTaskStore((s) => s.tasks);
  const milestones = useMilestoneStore((s) => s.milestones);
  const addMilestone = useMilestoneStore((s) => s.addMilestone);
  const updateMilestone = useMilestoneStore((s) => s.updateMilestone);
  const deleteMilestone = useMilestoneStore((s) => s.deleteMilestone);
  const projects = useProjectStore((s) => s.projects);
  const { isAdmin, canManageProject, canViewProjectTasks, currentUserId } = useAccess();
  // 仅管理员或至少拥有一个可管理项目时可新建里程碑（成员后端会 403）
  const canCreateMilestone = isAdmin || projects.some((p) => canManageProject(p));
  // 仅向里程碑表单提供可管理的项目，避免成员误选他人项目
  const manageableProjects = isAdmin
    ? projects.filter((p) => !p.archived)
    : projects.filter((p) => !p.archived && canManageProject(p));

  // 读取 URL query 参数
  const projectIdFromUrl = searchParams.get('projectId');
  const [projectFilter, setProjectFilter] = useState(projectIdFromUrl || '');
  // 含子项目：选中项目扩展为其「自身 + 全部子孙」集合
  const [includeSub, setIncludeSub] = useState(false);

  // 如果来自 URL，锁定选择器
  const isLocked = !!projectIdFromUrl;

  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 仅显示成员可看任务时间线的项目（owner/admin 或 被分配任务的成员），排除纯待办成员
  const taskVisibleProjects = useMemo(
    () => projects.filter((p) => !p.archived && canViewProjectTasks(p)),
    [projects, canViewProjectTasks]
  );
  const activeProjectIds = new Set(taskVisibleProjects.map((p) => p.id));

  // 含子项目：选中项目扩展为其「自身 + 全部子孙」集合；未选项目或不含子项目时为 null（不过滤）
  const includedProjectIds = useMemo(() => {
    if (!projectFilter) return null;
    if (!includeSub) return new Set([projectFilter]);
    const ids = new Set([projectFilter, ...getDescendants(projects, projectFilter).map((d) => d.id)]);
    return ids;
  }, [projectFilter, includeSub, projects]);

  const inScope = (pid) => (includedProjectIds ? includedProjectIds.has(pid) : true);

  // 项目下拉选项：默认只列主项目（无 parentProjectId 的根项目），勾选「含子项目」后再列出全部子孙
  // 选项格式统一为「编号 名称」，让项目编号显示在名称前
  const dropdownProjects = useMemo(() => {
    const roots = taskVisibleProjects.filter((p) => !p.parentProjectId);
    if (!includeSub) return roots;
    return taskVisibleProjects;
  }, [taskVisibleProjects, includeSub]);
  const projectOptions = [
    { value: '', label: '全部项目' },
    ...dropdownProjects.map((p) => ({ value: p.id, label: `${p.code || ''} ${p.name || ''}`.trim() })),
  ];

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const pid = t.projectId || t.project_id;
      if (!inScope(pid)) return false;
      const proj = projects.find((p) => p.id === pid);
      if (!canViewProjectTasks(proj)) return false;
      if (canManageProject(proj)) return true;
      // 成员：仅自己被分配的任务时间线
      return Array.isArray(t.assignees)
        ? t.assignees.includes(currentUserId)
        : t.assignee === currentUserId;
    });
  }, [tasks, projects, includedProjectIds, canViewProjectTasks, canManageProject, currentUserId]);

  const filteredMilestones = useMemo(() => {
    return milestones.filter((m) => {
      if (!inScope(m.projectId)) return false;
      return activeProjectIds.has(m.projectId);
    });
  }, [milestones, includedProjectIds, activeProjectIds]);

  const filteredProjects = taskVisibleProjects;

  // 甘特图起点：取自选中项目的 startDate
  const selectedProject = projects.find((p) => p.id === projectFilter);
  const ganttStart = selectedProject?.startDate || '';

  const handleEdit = (milestone) => {
    setEditingMilestone(milestone);
    setShowForm(true);
  };

  const handleDelete = (milestone) => {
    setDeleteTarget(milestone);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMilestone(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleSave = (data) => {
    if (editingMilestone) {
      updateMilestone(editingMilestone.id, data);
    } else {
      addMilestone(data);
    }
    setShowForm(false);
    setEditingMilestone(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMilestone(null);
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={projectFilter}
            onChange={(v) => {
              setProjectFilter(v);
              // 切换项目后重置「含子项目」勾选，避免残留状态
              setIncludeSub(false);
            }}
            disabled={isLocked}
            options={projectOptions}
            className="w-72"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSub}
              disabled={!projectFilter || isLocked}
              onChange={(e) => setIncludeSub(e.target.checked)}
              className="accent-blue-500"
            />
            含子项目
          </label>
        </div>
        {canCreateMilestone && (
          <Button size="sm" onClick={() => { setEditingMilestone(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" />
            新建里程碑
          </Button>
        )}
      </div>

      <div className="mb-4">
        <GanttView
          tasks={filteredTasks}
          milestones={filteredMilestones}
          projects={filteredProjects}
          startDate={ganttStart}
        />
      </div>

      <MilestoneList
        milestones={filteredMilestones}
        projects={filteredProjects}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showForm && (
        <MilestoneForm
          key={editingMilestone ? `ms-${editingMilestone.id}` : 'ms-new'}
          milestone={editingMilestone}
          projects={manageableProjects}
          onClose={handleCloseForm}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除里程碑"
          message={`确定要删除里程碑「${deleteTarget.title}」吗？此操作不可恢复。`}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </PageContainer>
  );
}
