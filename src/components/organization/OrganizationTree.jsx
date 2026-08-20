import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, Pencil, FileSpreadsheet } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ExcelImportModal from '@/components/organization/ExcelImportModal';
import { useOrgStore } from '@/store/useOrgStore';
import { cn } from '@/lib/utils';

export default function OrganizationTree({ onSelectDept, selectedDeptId = null }) {
  const departments = useOrgStore((s) => s.departments);
  const addDepartment = useOrgStore((s) => s.addDepartment);
  const updateDepartment = useOrgStore((s) => s.updateDepartment);
  const deleteDepartment = useOrgStore((s) => s.deleteDepartment);
  const fetchDepartments = useOrgStore((s) => s.fetchDepartments);
  const loading = useOrgStore((s) => s.loading);

  const [expanded, setExpanded] = useState(new Set());
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);

  const flatDepts = useOrgStore((s) => s.getAllDepartments());
  const allOptions = [{ value: '', label: '顶级部门（无上级）' }].concat(
    flatDepts.map((d) => ({ value: d.id, label: d.name }))
  );

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (dept) => {
    if (onSelectDept) onSelectDept(dept.id);
  };

  const handleAddRoot = () => {
    setNewParentId(null);
    setNewName('');
    setShowForm(true);
  };

  const handleAddChild = (parentId) => (e) => {
    e.stopPropagation();
    setNewParentId(parentId);
    setNewName('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!newName.trim()) return;
    const data = { name: newName.trim() };
    if (newParentId) data.parentId = newParentId;
    await addDepartment(data);
    setShowForm(false);
    setNewName('');
    setNewParentId(null);
  };

  const handleEdit = (dept) => (e) => {
    e.stopPropagation();
    setEditingDept(dept);
    setEditName(dept.name);
  };

  const handleSaveEdit = async (e) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    await updateDepartment(editingDept.id, { name: editName.trim() });
    setEditingDept(null);
    setEditName('');
  };

  const handleDelete = (dept) => (e) => {
    e.stopPropagation();
    setDeleteTarget(dept);
  };

  if (loading) {
    return <div className="text-center text-sm text-slate-400 py-8">加载中...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Header actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleAddRoot}>
            <Plus className="w-3.5 h-3.5" />
            新建部门
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowExcelImport(true)}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel导入
          </Button>
        </div>
      </div>

      {/* New department form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={newParentId || ''}
              onChange={(e) => setNewParentId(e.target.value || null)}
              className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            >
              {allOptions.map((opt) => (
                <option key={opt.value || 'root'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="部门名称"
              className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-md"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <Button size="sm" onClick={handleSave} disabled={!newName.trim()}>保存</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Tree */}
      {departments.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <Folder className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p>暂无组织架构</p>
          <p className="text-xs mt-1">点击「Excel导入」批量导入，或「新建部门」手动添加</p>
        </div>
      ) : (
        <div className="space-y-1">
          {departments.map((dept) => (
            <DeptNode
              key={dept.id}
              dept={dept}
              level={0}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedDeptId={selectedDeptId}
              onSelect={handleSelect}
              onAddChild={handleAddChild}
              onEdit={handleEdit}
              onDelete={handleDelete}
              editingDept={editingDept}
              editName={editName}
              setEditName={setEditName}
              onSaveEdit={handleSaveEdit}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="删除部门"
          message={`确定要删除部门「${deleteTarget.name}」吗？${deleteTarget.children?.length ? `将同时删除其 ${deleteTarget.children.length} 个子部门。` : ''}`}
          onConfirm={() => {
            deleteDepartment(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Excel 导入弹窗 */}
      {showExcelImport && (
        <ExcelImportModal
          onClose={() => setShowExcelImport(false)}
          onImported={() => {
            // 导入成功后刷新部门树和成员列表
            fetchDepartments();
            if (window.__refreshMembers) window.__refreshMembers();
          }}
        />
      )}
    </div>
  );
}

/**
 * 递归渲染部门节点
 */
function DeptNode({
  dept, hasChildren, level, expanded, toggleExpand,
  selectedDeptId, onSelect, onAddChild, onEdit, onDelete,
  editingDept, editName, setEditName, onSaveEdit,
}) {
  const children = dept.children || [];
  const isExpanded = expanded.has(dept.id);
  const isSelected = selectedDeptId === dept.id;
  const isEditing = editingDept?.id === dept.id;
  const hasKids = children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-smooth',
          isSelected
            ? 'bg-primary-50 border border-primary-200'
            : 'hover:bg-slate-50 border border-transparent'
        )}
        style={{ marginLeft: `${level * 20}px` }}
        onClick={() => onSelect(dept)}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleExpand(dept.id); }}
          className="p-0.5 hover:bg-slate-200 rounded"
        >
          {hasKids ? (
            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <span className="w-3.5 h-3.5 inline-block" />
          )}
        </button>

        {/* Icon */}
        {isEditing ? (
          <Pencil className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        ) : (
          <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
        )}

        {/* Name */}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { e.stopPropagation(); e.key === 'Enter' && onSaveEdit(e); }}
            className="flex-1 px-1.5 py-0.5 text-sm border border-primary-400 rounded outline-none"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-slate-700 font-medium">{dept.name}</span>
        )}

        {/* Member count hint */}
        <span className="text-xs text-slate-400">
          {dept.memberCount || ''}
        </span>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-smooth">
            <button
              onClick={onAddChild(dept.id)}
              className="p-1 hover:bg-green-50 rounded text-slate-400 hover:text-green-600"
              title="添加子部门"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={onEdit(dept)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
              title="重命名"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete(dept)}
              className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
        {isEditing && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={onSaveEdit}
              className="px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              保存
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); /* handled by parent */ }}
              className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && children.length > 0 && (
        <div className="space-y-1">
          {children.map((child) => (
            <DeptNode
              key={child.id}
              dept={child}
              level={level + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedDeptId={selectedDeptId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              editingDept={editingDept}
              editName={editName}
              setEditName={setEditName}
              onSaveEdit={onSaveEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}