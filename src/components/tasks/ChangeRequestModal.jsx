import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useTaskStore } from '@/store/useTaskStore';

// 任务变更申请弹窗：任务负责人填写「修改计划（延期）」或「废止」理由（修改还需新截止日期），
// 提交后由项目负责人评审通过才生效。后端以会话身份记录申请人，本组件不传 requestedBy。
export default function ChangeRequestModal({ task, type, onClose, onSubmitted }) {
  const requestTaskChange = useTaskStore((s) => s.requestTaskChange);
  const [reason, setReason] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const isModify = type === 'modify';

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('请填写变更理由');
      return;
    }
    if (isModify && !newDueDate) {
      setError('请选择新的计划完成日期');
      return;
    }
    if (isModify && task.dueDate && newDueDate <= task.dueDate) {
      setError('新的计划完成日期应晚于原截止日期');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await requestTaskChange(task.id, {
        type,
        reason: reason.trim(),
        newDueDate: isModify ? newDueDate : undefined,
      });
      setDone(true);
      setTimeout(() => {
        onSubmitted && onSubmitted();
      }, 900);
    } catch (e) {
      setError(e?.message || '提交失败，请重试');
      setSubmitting(false);
    }
  };

  return (
    <Modal title={isModify ? '修改任务计划' : '废止任务'} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
          任务：<span className="font-medium text-slate-800">{task.title}</span>
          {task.dueDate && (
            <span className="ml-2 text-slate-400">原截止日期：{task.dueDate}</span>
          )}
        </div>

        {isModify && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              新的计划完成日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth"
            />
            <p className="mt-1 text-xs text-slate-400">
              提交后计划完成时间将延后到该日期，时间线原计划截止点会保留蓝色竖线标记与本次修改原因。
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {isModify ? '修改理由' : '废止理由'} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth resize-none"
            placeholder={isModify ? '请说明计划变更的原因（如工艺调整、资源变更等）…' : '请说明废止该任务的原因…'}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {done && (
          <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
            已提交{isModify ? '修改计划' : '废止'}申请，等待项目负责人评审通过后生效。
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
            取消
          </Button>
          {!done && (
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? '提交中…' : '提交申请'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
