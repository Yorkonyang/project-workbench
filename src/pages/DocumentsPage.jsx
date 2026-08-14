import { useState } from 'react';
import { Plus, Search, Download } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import DocumentGrid from '@/components/documents/DocumentGrid';
import DocumentForm from '@/components/documents/DocumentForm';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useProjectStore } from '@/store/useProjectStore';

export default function DocumentsPage() {
  const documents = useDocumentStore((s) => s.documents);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);
  const projects = useProjectStore((s) => s.projects);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // 只取活跃项目
  const activeProjects = projects.filter((p) => !p.archived);
  // 只筛选活跃项目的文档
  const activeProjectIds = new Set(activeProjects.map((p) => p.id));

  const categories = [...new Set(documents.map((d) => d.category).filter(Boolean))];

  const filteredDocs = documents.filter((doc) => {
    // 过滤已归档项目的文档
    if (doc.projectId && !activeProjectIds.has(doc.projectId)) return false;
    if (projectFilter && doc.projectId !== projectFilter) return false;
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
          <Button size="sm" onClick={() => { setEditingDoc(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" />
            添加文档
          </Button>
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
          className="w-36"
        />
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: '', label: '全部分类' },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
          className="w-32"
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
          projects={activeProjects}
          onClose={handleCloseForm}
        />
      )}
    </PageContainer>
  );
}
