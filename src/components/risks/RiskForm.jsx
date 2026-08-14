import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useRiskStore } from '@/store/useRiskStore';
import { useProjectStore } from '@/store/useProjectStore';

const SEVERITY_OPTIONS = [
  { value: 'critical', label: '灾难性' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const PROBABILITY_OPTIONS = [
  { value: 'high', label: '高概率' },
  { value: 'medium', label: '中概率' },
  { value: 'low', label: '低概率' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: '待处理' },
  { value: 'mitigating', label: '处理中' },
  { value: 'closed', label: '已关闭' },
];

export default function RiskForm({ onClose, risk = null }) {
  const projects = useProjectStore((s) => s.projects);
  const addRisk = useRiskStore((s) => s.addRisk);
  const updateRisk = useRiskStore((s) => s.updateRisk);

  const [form, setForm] = useState({
    projectId: risk?.projectId || projects[0]?.id || '',
    title: risk?.title || '',
    description: risk?.description || '',
    severity: risk?.severity || 'medium',
    probability: risk?.probability || 'medium',
    status: risk?.status || 'open',
    owner: risk?.owner || '',
    identifiedDate: risk?.identifiedDate || new Date().toISOString().split('T')[0],
    mitigation: risk?.mitigation || '',
  });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (risk) {
      setForm({
        projectId: risk.projectId || projects[0]?.id || '',
        title: risk.title || '',
        description: risk.description || '',
        severity: risk.severity || 'medium',
        probability: risk.probability || 'medium',
        status: risk.status || 'open',
        owner: risk.owner || '',
        identifiedDate: risk.identifiedDate || new Date().toISOString().split('T')[0],
        mitigation: risk.mitigation || '',
      });
    }
  }, [risk, projects]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    if (risk) {
      updateRisk(risk.id, { ...form, updatedAt: now });
    } else {
      addRisk({ ...form, createdAt: now, updatedAt: now });
    }
    onClose();
  };

  return (
    <Modal title={risk ? '编辑风险' : '新建风险'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="风险标题"
          value={form.title}
          onChange={(e) => set('title')(e.target.value)}
          placeholder="请输入风险标题"
          required
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth"
            placeholder="请输入风险描述"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="所属项目"
            value={form.projectId}
            onChange={set('projectId')}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label="责任人"
            value={form.owner}
            onChange={set('owner')}
            options={[
              { value: '', label: '未分配' },
              { value: '信息化中心', label: '信息化中心' },
              { value: '开发部', label: '开发部' },
              { value: '生产部', label: '生产部' },
              { value: '财务部', label: '财务部' },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Select
            label="严重程度"
            value={form.severity}
            onChange={set('severity')}
            options={SEVERITY_OPTIONS}
          />
          <Select
            label="发生概率"
            value={form.probability}
            onChange={set('probability')}
            options={PROBABILITY_OPTIONS}
          />
          <Select
            label="状态"
            value={form.status}
            onChange={set('status')}
            options={STATUS_OPTIONS}
          />
        </div>
        <Input
          label="识别日期"
          type="date"
          value={form.identifiedDate}
          onChange={(e) => set('identifiedDate')(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">应对措施</label>
          <textarea
            value={form.mitigation}
            onChange={(e) => set('mitigation')(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth"
            placeholder="请输入风险应对措施"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            取消
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!form.title.trim()}>
            {risk ? '保存修改' : '创建风险'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
