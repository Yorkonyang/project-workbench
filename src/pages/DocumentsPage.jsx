import { useState, useMemo } from 'react';
import { Plus, Search, Download } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import DocumentGrid from '@/components/documents/DocumentGrid';
import DocumentForm from '@/components/documents/DocumentForm';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useAccess } from '@/hooks/useAccess';
import { getDescendants } from '@/lib/hierarchy';

export default function DocumentsPage() {
  const documents = useDocumentStore((s) => s.documents);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);
  const projects = useProjectStore((s) => s.projects);
  const tasks = useTaskStore((s) => s.tasks);
  const { isAdmin, canManageProject, canViewDocument, canViewProjectTasks, currentUserId } = useAccess();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  // 含子项目：选中项目扩展为其「自身 + 全部子孙」集合
  const [includeSub, setIncludeSub] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // 只取活跃且成员可看文档的项目（owner/admin 或 被分配任务的成员；纯待办成员不可看文档页）
  const activeProjects = projects.filter((p) => !p.archived && canViewProjectTasks(p));
  // 只筛选活跃项目的文档
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));

  // 可添加文档的项目：管理员全部；成员仅自己可管理的项目 或 自己被分配任务的项目
  const taskAssignedToMe = (t) =>
    Array.isArray(t.assignees) ? t.assignees.includes(currentUserId) : t.assignee === currentUserId;
  const allowedDocProjects = isAdmin
    ? activeProjects
    : activeProjects.filter(
        (p) =>
          canManageProject(p) ||
          tasks.some((t) => (t.projectId || t.project_id) === p.id && taskAssignedToMe(t))
      );
  const canCreateDoc = isAdmin || allowedDocProjects.length > 0;

  const categories = [...new Set(documents.map((d) => d.category).filter(Boolean))];

  // 含子项目：选中项目扩展为其「自身 + 全部子孙」集合；未选或不含子项目时为 null（不过滤）
  const includedProjectIds = useMemo(() => {
    if (!projectFilter) return null;
    if (!includeSub) return new Set([projectFilter]);
    const ids = new Set([projectFilter, ...getDescendants(projects, projectFilter).map((d) => d.id)]);
    return ids;
  }, [projectFilter, includeSub, projects]);
  const inScope = (pid) => (includedProjectIds ? includedProjectIds.has(pid) : true);

  const filteredDocs = documents.filter((doc) => {
    // 权限：成员仅可看自己添加的文档；owner/admin 可见项目全部
    if (!canViewDocument(doc)) return false;
    // 过滤已归档项目的文档
    if (doc.projectId && !activeProjectIds.has(doc.projectId)) return false;
    if (!inScope(doc.projectId)) return false;
    if (categoryFilter && doc.category !== categoryFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (doc.title || '').toLowerCase().includes(s) ||
        doc.description?.toLowerCase().includes(s) ||
        (doc.fileName || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingDoc(null);
  };

  const handleExport = () => {
    const data = JSON.stringify(documents, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer
      title="文档管理"
      subtitle={`${filteredDocs.length} 份文档`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4" />
            导出
          </Button>
          {canCreateDoc && (
            <Button size="sm" onClick={() => { setEditingDoc(null); setShowForm(true); }}>
              <Plus className="w-4 h-4" />
              添加文档
            </Button>
          )}
        </div>
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文档..."
            className="w-full"
          />
        </div>
        <Select
          value={projectFilter}
          onChange={setProjectFilter}
          options={[
            { value: '', label: '全部项目' },
            ...activeProjects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          className="w-full sm:w-36"
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
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: '', label: '全部项目阶段' },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
          className="w-full sm:w-32"
        />
      </div>

      {/* Document Grid */}
      <DocumentGrid
        documents={filteredDocs}
        projects={activeProjects}
        onEdit={handleEdit}
        onDelete={(doc) => {
          if (confirm(`确定要删除文档「${doc.title}」吗？`)) {
            deleteDocument(doc.id);
          }
        }}
      />

      {/* Form */}
      {showForm && (
        <DocumentForm
          document={editingDoc}
          projects={allowedDocProjects}
          onClose={handleCloseForm}
        />
      )}
    </PageContainer>
  );
}
