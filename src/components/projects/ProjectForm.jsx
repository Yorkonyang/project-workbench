import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Check, X } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useDictionaryStore } from '@/store/useDictionaryStore';
import MultiSelect from '@/components/ui/MultiSelect';
import { buildMemberOptions, getPinnedValueSet, pinMemberId } from '@/lib/pinnedMembers';

const COLORS = [
  { value: '#3b82f6', label: '蓝色' },
  { value: '#14b8a6', label: '青色' },
  { value: '#8b5cf6', label: '紫色' },
  { value: '#f59e0b', label: '琥珀色' },
  { value: '#ef4444', label: '红色' },
  { value: '#10b981', label: '绿色' },
  { value: '#ec4899', label: '粉色' },
  { value: '#6366F1', label: '靛蓝' },
];

const STATUSES = [
  { value: 'planned', label: '待启动' },
  { value: 'in_progress', label: '进行中' },
  { value: 'paused', label: '暂停' },
  { value: 'completed', label: '已完成' },
];

export default function ProjectForm({ project, onClose, onSave, parentProjectId = '', isSubProject = false }) {
  const generateProjectCode = useProjectStore((s) => s.generateProjectCode);
  const getProjectLevel = useProjectStore((s) => s.getProjectLevel);
  const members = useMemberStore((s) => s.members);
  const allProjects = useProjectStore((s) => s.projects);
  const projectTypes = useDictionaryStore((s) => s.projectTypes);
  const projectStages = useDictionaryStore((s) => s.projectStages);

  // 编辑时：如果项目已有 projectTypeId 则直接使用，否则尝试从 phase 反查
  const initialTypeId = project?.projectTypeId || project?.project_type_id || '';
  const [typeId, setTypeId] = useState(initialTypeId);

  // 新建子项目时，预置 parentProjectId；其余情况沿用已有（或空=根项目）
  const [formData, setFormData] = useState(() => {
    const base = {
      code: project?.code || generateProjectCode(),
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: project?.status === 'active' ? 'in_progress' : (project?.status || 'planned'),
      parentProjectId: project?.parentProjectId || '',
      color: COLORS[0].value,
      manager: '',
      ...project,
    };
    if (isSubProject && parentProjectId) {
      const parent = allProjects.find((p) => p.id === parentProjectId);
      if (parent) {
        base.parentProjectId = parent.id;
        // 子项目继承父项目的负责人、所有者、颜色、起止区间（§8#7 权限继承）
        base.manager = parent.manager || '';
        base.ownerId = parent.ownerId || '';
        base.color = parent.color || COLORS[0].value;
        if (parent.startDate) base.startDate = parent.startDate;
        if (parent.endDate) base.endDate = parent.endDate;
      }
    }
    return base;
  });

  const handleTypeChange = (e) => {
    const nextTypeId = e.target.value;
    setTypeId(nextTypeId);
    // 切换项目类型时，重置类型为当前类型
    setFormData((prev) => ({ ...prev, projectTypeId: nextTypeId }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 隶属项目选项：排除自身及其所有后代，避免层级关系形成环
  const parentOptions = (() => {
    const excluded = new Set();
    const selfId = project?.id || (isSubProject ? parentProjectId : null);
    if (selfId) {
      const byParent = {};
      allProjects.forEach((p) => {
        const k = p.parentProjectId || '_root';
        (byParent[k] = byParent[k] || []).push(p.id);
      });
      const stack = [selfId];
      while (stack.length) {
        const cur = stack.pop();
        (byParent[cur] || []).forEach((childId) => {
          if (!excluded.has(childId)) { excluded.add(childId); stack.push(childId); }
        });
      }
    }
    return allProjects.filter((p) => p.id !== selfId && !excluded.has(p.id) && !p.archived);
  })();

  // 深度校验：父项目层级 >= MAX_DEPTH 时禁止再建子项目
  const parentLevel = formData.parentProjectId ? getProjectLevel(formData.parentProjectId) : -1;
  const depthExceeded = formData.parentProjectId && parentLevel >= MAX_DEPTH;
  useEffect(() => {
    if (depthExceeded) {
      // 仅做禁用态提示，不阻断已有编辑流程
    }
  }, [depthExceeded]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请填写项目名称');
      return;
    }
    if (depthExceeded) {
      alert(`已达最大层级（${MAX_DEPTH} 级），无法在此项目下创建子项目`);
      return;
    }
    if (formData.manager) pinMemberId(formData.manager);
    onSave({
      ...formData,
      // 根项目统一用 null 表示（与后端归一化约定一致）
      parentProjectId: formData.parentProjectId || null,
      projectTypeId: typeId || '',
    });
  };

  return (
    <Modal title={project ? '编辑项目' : '新建项目'} onClose={onClose} size="xl" scrollable>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              项目编号 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                name="code"
                value={formData.code}
                onChange={handleChange}
                readOnly
                className="bg-slate-50 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="如：MOM 系统建设"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">项目描述</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth resize-none"
            placeholder="简述项目目标和范围..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            项目类型 <span className="text-primary-500 text-xs">(来自数据字典)</span>
          </label>
          <select
            name="typeId"
            value={typeId}
            onChange={handleTypeChange}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth bg-white"
          >
            <option value="">请选择项目类型</option>
            {projectTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {!project && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">隶属项目</label>
            <select
              name="parentProjectId"
              value={formData.parentProjectId || ''}
              onChange={handleChange}
              disabled={depthExceeded && !!formData.parentProjectId}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth bg-white disabled:bg-slate-100"
            >
              <option value="">（无）主项目</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {'  '.repeat(getProjectLevel(p.id))}{p.name}（{p.code || '无编号'}）
                </option>
              ))}
            </select>
            {depthExceeded && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                已达最大层级（{MAX_DEPTH} 级），无法在此项目下创建子项目
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">开始日期</label>
            <Input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">结束日期</label>
            <Input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">项目状态</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <MultiSelect
              label="项目负责人"
              single
              value={formData.manager ? [formData.manager] : []}
              onChange={(vals) => setFormData((prev) => ({ ...prev, manager: vals[vals.length - 1] ?? '' }))}
              options={[
                { value: '', label: '未分配' },
                ...buildMemberOptions(members, { valueKey: 'id' }),
              ]}
              pinnedValues={getPinnedValueSet(members, 'id')}
              placeholder="搜索并选择负责人"
              searchable
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">项目颜色</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, color: c.value }))}
                  className={`w-8 h-8 rounded-lg transition-smooth ${
                    formData.color === c.value ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" /> 取消
          </Button>
          <Button type="submit" variant="primary">
            <Check className="w-4 h-4" /> 保存
          </Button>
        </div>
      </form>
    </Modal>
  );
}
