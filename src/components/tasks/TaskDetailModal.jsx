import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useTodoStore } from '@/store/useTodoStore';
import { useTaskStore } from '@/store/useTaskStore';

export default function TaskDetailModal({ task, onClose }) {
  const todos = useTodoStore((s) => s.todos);
  const addTodo = useTodoStore((s) => s.addTodo);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const updateTask = useTaskStore((s) => s.updateTask);

  const [todoFormOpen, setTodoFormOpen] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [progressReports, setProgressReports] = useState(task?.progressReports || []);
  const [newReport, setNewReport] = useState({ content: '', progress: 0 });

  // 获取该任务的待办列表
  const taskTodos = todos.filter((t) => t.taskId === task.id);

  // 打开弹窗时刷新待办数据
  useEffect(() => {
    useTodoStore.getState().fetchTodos();
  }, [task?.id]);

  const handleToggleTodo = async (todoId) => {
    await toggleTodo(todoId);
  };

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    await addTodo({
      title: newTodoTitle,
      projectId: task.projectId,
      taskId: task.id,
      priority: 'medium',
      remindDays: 3,
    });
    setNewTodoTitle('');
    setTodoFormOpen(false);
    // 刷新待办列表
    useTodoStore.getState().fetchTodos();
  };

  const handleAddProgress = () => {
    if (!newReport.content.trim()) return;
    const report = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      content: newReport.content,
      progress: newReport.progress,
      reporter: '当前用户',
    };
    setProgressReports([...progressReports, report]);
    // 同步更新任务进度
    updateTask(task.id, { progressReports: [...progressReports, report] });
    setNewReport({ content: '', progress: 0 });
  };

  return (
    <Modal title={`任务详情：${task?.title}`} onClose={onClose} size="large">
      <div className="grid grid-cols-2 gap-6">
        {/* 左侧：待办列表 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-slate-700">关联待办</h4>
            <Button size="sm" onClick={() => setTodoFormOpen(!todoFormOpen)}>
              <Plus className="w-3 h-3" />
              新增待办
            </Button>
          </div>

          {/* 新增待办表单 */}
          {todoFormOpen && (
            <div className="flex gap-2">
              <Input
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="输入待办内容..."
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddTodo}>添加</Button>
            </div>
          )}

          {/* 待办列表 */}
          <div className="space-y-2">
            {taskTodos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">暂无待办事项</p>
            ) : (
              taskTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
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

        {/* 右侧：进度汇报 */}
        <div className="space-y-4">
          <h4 className="font-medium text-slate-700">进度汇报</h4>

          {/* 历史汇报记录 */}
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {progressReports.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">暂无汇报记录</p>
            ) : (
              progressReports.map((report) => (
                <div key={report.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">{report.date}</span>
                    <span className="text-xs font-medium text-primary-600">{report.progress}%</span>
                  </div>
                  <p className="text-sm text-slate-700">{report.content}</p>
                </div>
              ))
            )}
          </div>

          {/* 新增汇报表单 */}
          <div className="space-y-3 pt-3 border-t">
            <Input
              label="汇报内容"
              value={newReport.content}
              onChange={(e) => setNewReport({ ...newReport, content: e.target.value })}
              placeholder="输入汇报内容..."
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                进度：{newReport.progress}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={newReport.progress}
                onChange={(e) => setNewReport({ ...newReport, progress: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <Button onClick={handleAddProgress} className="w-full" disabled={!newReport.content.trim()}>
              添加汇报
            </Button>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>关闭</Button>
        <Button onClick={onClose}>保存并关闭</Button>
      </div>
    </Modal>
  );
}
