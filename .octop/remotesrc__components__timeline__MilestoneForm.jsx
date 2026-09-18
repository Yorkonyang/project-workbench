import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'pending', label: '待开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'blocked', label: '已阻塞' },
];

export default function MilestoneForm({ milestone, projects, onClose, onSave, defaultProjectId = '' }) {
  // 直接用 milestone 懒初始化，避免「先 false 再 useEffect 回填」在重开编辑时
  // 因时序/双挂载导致复选框等字段未正确还原
  const [title, setTitle] = useState(milestone?.title || '');
  const [projectId, setProjectId] = useState(milestone?.projectId || defaultProjectId || '');
  const [date, setDate] = useState(milestone?.date || '');
  const [status, setStatus] = useState(milestone?.status || 'pending');
  const [isCritical, setIsCritical] = useState(milestone?.isCritical || false);
  const [deliverables, setDeliverables] = useState(milestone?.deliverables || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !projectId || !date) {
      alert('请填写必填项：标题、项目、日期');
      return;
    }
    onSave({
      title: title.trim(),
      projectId,
      date,
      status,
      isCritical,
      deliverables: deliverables.trim(),
    });
  };

  return (
    <Modal
      title={milestone ? '编辑里程碑' : '新建里程碑'}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            里程碑标题 <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：系统上线、测试完成"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            所属项目 <span className="text-red-500">*</span>
          </label>
          <Select
            value={projectId}
            onChange={setProjectId}
            options={[
              { value: '', label: '请选择项目' },
              ...projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
            ]}
            placeholder="请选择项目"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            目标日期 <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            状态
          </label>
          <Select
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            交付物
          </label>
          <textarea
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            placeholder="描述交付物或验收标准（可选）"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isCritical"
            checked={isCritical}
            onChange={(e) => setIsCritical(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
          />
          <label htmlFor="isCritical" className="text-sm text-slate-700">
            标记为关键里程碑
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit">{milestone ? '保存修改' : '创建里程碑'}</Button>
        </div>
      </form>
    </Modal>
  );
}
