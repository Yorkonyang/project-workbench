import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Check, Plus, X, Calendar, User, Flag, CheckCircle2 } from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useAuthStore } from '@/store/useAuthStore';
import TodoForm from '@/components/todos/TodoForm';

export default function TaskProgressModal({ task, onClose }) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const todos = useTodoStore((s) => s.todos);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const members = useMemberStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = members.find((m) => m.id === currentUserId);

  const [reports, setReports] = useState(task?.progressReports || []);
  const [newReport, setNewReport] = useState({
    content: '',
    progress: 0,
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todoFormOpen, setTodoFormOpen] = useState(false);

  const assignee = members.find((m) => m.id === task?.assignee);
  const taskTodos = todos.filter((t) => t.taskId === task?.id);

  // 打开弹窗时刷新关联待办
  useEffect(() => {
    useTodoStore.getState().fetchTodos();
  }, [task?.id]);

  const handleToggleTodo = async (todoId) => {
    await toggleTodo(todoId);
  };

  // Generate next report number
  const getNextReportNo = () => {
    const existingNos = reports.map((r) => r.no || 0);
    const maxNo = existingNos.length > 0 ? Math.max(...existingNos) : 0;
    return maxNo + 1;
  };

  const handleAddReport = () => {
    if (!newReport.content.trim()) return;
    const report = {
      id: Date.now(),
      no: getNextReportNo(),
      date: new Date().toISOString().split('T')[0],
      content: newReport.content,
      progress: newReport.progress || 0,
      reporter: currentUser?.name || '当前用户',
      reporterId: currentUserId,
    };
    setReports([...reports, report]);
    setNewReport({ content: '', progress: 0 });
    setShowForm(false);
  };

  const handleStartTask = () => {
    updateTask(task.id, { status: 'in_progress' });
    onClose();
  };

  const handleSubmitReport = () => {
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      updateTask(task.id, { progressReports: reports, updatedAt: new Date().toISOString() });
      setSubmitting(false);
      onClose();
    }, 500);
  };

  const handleFinishTask = () => {
    if (!reports.length) {
      alert('请先添加进度汇报');
      return;
    }
    updateTask(task.id, { status: 'review', progressReports: reports, updatedAt: new Date().toISOString() });
    onClose();
  };

  const handleTodoFormClose = () => {
    setTodoFormOpen(false);
    useTodoStore.getState().fetchTodos();
  };

  if (!task) return null;

  return (
    <Modal title={`任务进度汇报 - ${task.title}`} onClose={onClose} size="2xl" scrollable>
      <div className="space-y-4">
        {/* Task Info */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">截止日期: {task.dueDate || '未设置'}</span>
          </div>
          {assignee && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">负责人: {assignee.name}</span>
            </div>
          )}
        </div>

        {/* Main Content: Left Todo | Right Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Associated Todos */}
          <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">关联待办 ({taskTodos.length})</h4>
              <Button size="sm" variant="ghost" onClick={() => setTodoFormOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                新增待办
              </Button>
            </div>

            <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '360px' }}>
              {taskTodos.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">暂无关联待办</p>
              ) : (
                taskTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <button
                      onClick={() => handleToggleTodo(todo.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        todo.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-slate-300 hover:border-primary-500'
                      }`}
                    >
                      {todo.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                    <span className={`flex-1 text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {todo.title}
                    </span>
                    {todo.dueDate && (
                      <span className="text-xs text-slate-400">{todo.dueDate}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Progress Reports */}
          <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">进度汇报记录 ({reports.length})</h4>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)}>
                <Plus className="w-3.5 h-3.5" />
                新增进度汇报
              </Button>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: '360px' }}>
              {/* Progress Report Form */}
              {showForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      汇报内容 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={newReport.content}
                      onChange={(e) => setNewReport({ ...newReport, content: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-smooth resize-none"
                      placeholder="请描述本次工作进展..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      当前进度: {newReport.progress || 0}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={newReport.progress || 0}
                      onChange={(e) => setNewReport({ ...newReport, progress: parseInt(e.target.value) })}
                      className="w-full accent-primary-500"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddReport}
                      disabled={!newReport.content.trim()}
                    >
                      <Check className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>
              )}

              {/* Progress Reports Table */}
              {reports.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  暂无进度汇报记录
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500 w-10">编号</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">日期</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">汇报人</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">汇报内容</th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-slate-500 w-14">进度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-2 text-xs text-slate-400 font-mono">#{report.no}</td>
                        <td className="py-2 px-2 text-slate-600">{report.date}</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs">
                            {report.reporter}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-slate-700">{report.content}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 rounded-full"
                                style={{ width: `${report.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-8">{report.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Submit/Finish Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          {task.status === 'review' && (
            <Button variant="outline" onClick={() => updateTask(task.id, { status: 'in_progress' })}>
              撤回提交
            </Button>
          )}
          {task.status === 'todo' && (
            <Button size="sm" onClick={handleStartTask} className="flex-1">
              <Flag className="w-4 h-4" />
              启动任务
            </Button>
          )}
          <Button
            variant="success"
            onClick={handleSubmitReport}
            disabled={submitting || task.status === 'done'}
            className="flex-1"
          >
            <Check className="w-4 h-4" />
            {task.status === 'done' ? '已完成' : '保存进度汇报'}
          </Button>
          {task.status !== 'todo' && task.status !== 'done' && (
            <Button variant="outline" onClick={handleFinishTask} className="px-6">
              提交审核
            </Button>
          )}
        </div>
      </div>

      {todoFormOpen && (
        <TodoForm
          onClose={handleTodoFormClose}
          defaultProjectId={task.projectId}
          defaultTaskId={task.id}
        />
      )}
    </Modal>
  );
}
