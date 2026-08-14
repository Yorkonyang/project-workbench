import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Check, X } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemberStore } from '@/store/useMemberStore';
import Select from '@/components/ui/Select';

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
  { value: 'in_progress', label: '进行中' },
  { value: 'paused', label: '暂停' },
  { value: 'completed', label: '已完成' },
];

const PHASES = [
  '需求调研', '方案设计', '一期开发', '二期开发', '测试上线', '运维优化', '待启动', '其他',
];

export default function ProjectForm({ project, onClose, onSave }) {
  const generateProjectCode = useProjectStore((s) => s.generateProjectCode);
  const members = useMemberStore((s) => s.members);

  const [formData, setFormData] = useState({
    code: project?.code || generateProjectCode(),
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'in_progress',
    phase: '需求调研',
    color: COLORS[0].value,
    manager: '',
    ...project,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请填写项目名称');
      return;
    }
    onSave(formData);
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">当前阶段</label>
            <select
              name="phase"
              value={formData.phase}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth bg-white"
            >
              {PHASES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <Select
              label="项目负责人"
              value={formData.manager || ''}
              onChange={(value) => setFormData((prev) => ({ ...prev, manager: value }))}
              placeholder="请选择负责人"
              options={[
                { value: '', label: '未分配' },
                ...members.map((m) => ({ value: m.id, label: `${m.name} (${m.email})` })),
              ]}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">项目颜色</label>
          <div className="flex flex-wrap gap-2">
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
