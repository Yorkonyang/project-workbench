import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import MultiSelect from '@/components/ui/MultiSelect';
import DatePicker from '@/components/ui/DatePicker';
import { useTaskStore } from '@/store/useTaskStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemberStore } from '@/store/useMemberStore';
import { buildMemberOptions, getPinnedValueSet, pinMemberIds } from '@/lib/pinnedMembers';

export default function TaskForm({ onClose, task = null, defaultProjectId = null }) {
  const projects = useProjectStore((s) => s.projects);
  const members = useMemberStore((s) => s.members);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  // 兼容旧数据：将 assignee 转为 assignees[]
  const initAssignees = task
    ? (Array.isArray(task.assignees) ? task.assignees : (task.assignee ? [task.assignee] : []))
    : [];

  const [form, setForm] = useState({
    projectId: task?.projectId || defaultProjectId || projects[0]?.id || '',
    title: task?.title || '',
    description: task?.description || '',
    assignees: initAssignees,
    priority: task?.priority || 'medium',
    status: task?.status || 'todo',
    startDate: task?.startDate || new Date().toISOString().split('T')[0],
    dueDate: task?.dueDate || '',
    tags: task?.tags?.join(', ') || '',
  });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    pinMemberIds(form.assignees);
    const now = new Date().toISOString();
    // 保存时同时写入 assignees（新）和 assignee（旧兼容）
    const payload = {
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      assignees: form.assignees || [],
      assignee: form.assignees?.[0] || '', // 保留首个作为主负责人
    };
    if (task) {
      updateTask(task.id, { ...payload, updatedAt: now });
    } else {
      addTask(form.projectId, { ...payload, createdAt: now, updatedAt: now });
    }
    onClose();
  };

  return (
    <Modal title={task ? '编辑任务' : '新建任务'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="任务标题"
          value={form.title}
          onChange={(e) => set('title')(e.target.value)}
          placeholder="请输入任务标题"
          required
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth"
            placeholder="请输入任务描述"
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
            label="优先级"
            value={form.priority}
            onChange={set('priority')}
            options={[
              { value: 'high', label: '高优先级' },
              { value: 'medium', label: '中优先级' },
              { value: 'low', label: '低优先级' },
            ]}
          />
        </div>
        <MultiSelect
          label="责任人（可多选）"
          value={form.assignees}
          onChange={(val) => set('assignees')(val)}
          options={buildMemberOptions(members, { valueKey: 'id' })}
          pinnedValues={getPinnedValueSet(members, 'id')}
          placeholder="选择责任人"
          searchable
        />
        <Select
          label="状态"
          value={form.status}
          onChange={set('status')}
          options={[
            { value: 'todo', label: '待启动' },
            { value: 'in_progress', label: '进行中' },
            { value: 'review', label: '审核中' },
            { value: 'done', label: '已完成' },
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <DatePicker
            label="开始日期"
            value={form.startDate}
            onChange={(v) => set('startDate')(v)}
          />
          <DatePicker
            label="截止日期"
            value={form.dueDate}
            onChange={(v) => set('dueDate')(v)}
          />
        </div>
        <Input
          label="标签（逗号分隔）"
          value={form.tags}
          onChange={(e) => set('tags')(e.target.value)}
          placeholder="前端, 后端, 测试"
        />
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            取消
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!form.title.trim()}>
            {task ? '保存修改' : '创建任务'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
