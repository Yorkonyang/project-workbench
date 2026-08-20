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

export default function TimelinePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tasks = useTaskStore((s) => s.tasks);
  const milestones = useMilestoneStore((s) => s.milestones);
  const addMilestone = useMilestoneStore((s) => s.addMilestone);
  const updateMilestone = useMilestoneStore((s) => s.updateMilestone);
  const deleteMilestone = useMilestoneStore((s) => s.deleteMilestone);
  const projects = useProjectStore((s) => s.projects);
  const { isAdmin, canManageProject } = useAccess();
  // 仅管理员或至少拥有一个可管理项目时可新建里程碑（成员后端会 403）
  const canCreateMilestone = isAdmin || projects.some((p) => canManageProject(p));
  // 仅向里程碑表单提供可管理的项目，避免成员误选他人项目
  const manageableProjects = isAdmin
    ? projects.filter((p) => !p.archived)
    : projects.filter((p) => !p.archived && canManageProject(p));

  // 读取 URL query 参数
  const projectIdFromUrl = searchParams.get('projectId');
  const [projectFilter, setProjectFilter] = useState(projectIdFromUrl || '');

  // 如果来自 URL，锁定选择器
  const isLocked = !!projectIdFromUrl;

  const [showForm, setShowForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filter out archived projects
  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilter) {
        return (t.projectId === projectFilter || t.project_id === projectFilter);
      }
      return activeProjectIds.has(t.projectId);
    });
  }, [tasks, activeProjectIds, projectFilter]);

  const filteredMilestones = useMemo(() => {
    return milestones.filter((m) => {
      if (projectFilter) {
        return m.projectId === projectFilter;
      }
      return activeProjectIds.has(m.projectId);
    });
  }, [milestones, activeProjectIds, projectFilter]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => !p.archived);
  }, [projects]);

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
      <div className="flex items-center justify-between mb-4">
        <Select
          value={projectFilter}
          onChange={setProjectFilter}
          disabled={isLocked}
          options={[
            { value: '', label: '全部项目' },
            ...projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })),
          ]}
          className="w-40"
        />
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
