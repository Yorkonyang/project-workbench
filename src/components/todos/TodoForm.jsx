import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import { useTodoStore } from '@/store/useTodoStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemberStore } from '@/store/useMemberStore';

export default function TodoForm({ onClose, todo = null, defaultProjectId = null, defaultTaskId = null }) {
  const projects = useProjectStore((s) => s.projects);
  const members = useMemberStore((s) => s.members);
  const addTodo = useTodoStore((s) => s.addTodo);
  const updateTodo = useTodoStore((s) => s.updateTodo);

  const [form, setForm] = useState({
    title: todo?.title || '',
    description: todo?.description || '',
    dueDate: todo?.dueDate || '',
    priority: todo?.priority || 'medium',
    projectId: todo?.projectId || defaultProjectId || '',
    taskId: todo?.taskId || defaultTaskId || '',
    assignee: todo?.assignee || '',
    remindAt: todo?.remindAt || '',
    remindDays: todo?.remindDays ?? 3,
    enableEscalation: todo?.enableEscalation ?? true,
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const data = {
      ...form,
      projectId: form.projectId || null,
      taskId: form.taskId || null,
      assignee: form.assignee || null,
      remindAt: form.remindAt ? `${form.remindAt}T09:00:00` : null,
      completed: todo?.completed || false,
    };
    if (todo) {
      updateTodo(todo.id, data);
    } else {
      addTodo(data);
    }
    onClose();
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Modal
      title={todo ? '编辑待办' : '新建待办'}
      onClose={onClose}
    >
      <div className="space-y-4">
        <Input
          label="待办标题 *"
          value={form.title}
          onChange={(e) => set('title')(e.target.value)}
          placeholder="请输入待办内容"
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
            rows={2}
            placeholder="补充说明（可选）"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="优先级"
            value={form.priority}
            onChange={set('priority')}
            options={[
              { value: 'urgent', label: '紧急' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' },
            ]}
          />
          <Select
            label="关联项目"
            value={form.projectId}
            onChange={set('projectId')}
            options={[
              { value: '', label: '不关联' },
              ...projects.filter(p => !p.archived).map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="负责人"
            value={form.assignee}
            onChange={set('assignee')}
            options={[
              { value: '', label: '未分配' },
              ...members.map((m) => ({ value: m.name, label: m.name })),
            ]}
          />
          <DatePicker label="截止日期" value={form.dueDate} onChange={set('dueDate')} />
        </div>

        {/* 提醒配置 */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 space-y-3">
          <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            提醒配置
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">提前几天提醒</label>
              <select
                value={form.remindDays}
                onChange={(e) => set('remindDays')(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={1}>提前 1 天</option>
                <option value={2}>提前 2 天</option>
                <option value={3}>提前 3 天</option>
                <option value={5}>提前 5 天</option>
                <option value={7}>提前 7 天</option>
                <option value={0}>不提前提醒</option>
              </select>
            </div>
            <DatePicker label="指定提醒日期" value={form.remindAt} onChange={set('remindAt')} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enableEscalation}
              onChange={(e) => set('enableEscalation')(e.target.checked)}
              className="w-4 h-4 rounded text-primary-500"
            />
            <span className="text-xs text-slate-600">逾期后自动催办提醒</span>
          </label>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
        <Button variant="secondary" onClick={onClose}>取消</Button>
        {todo && !todo.completed && (
          <Button variant="outline" onClick={() => {
            updateTodo(todo.id, { completed: true, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            onClose();
          }}>
            标记完成
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={!form.title.trim()}>
          {todo ? '保存' : '创建'}
        </Button>
      </div>
    </Modal>
  );
}
