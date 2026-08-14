import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import TaskForm from '@/components/tasks/TaskForm';
import TodoForm from '@/components/todos/TodoForm';
import { useReminderEngine } from '@/hooks/useReminderEngine';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState(null);

  // 初始化提醒引擎 — 定时检查任务/待办/里程碑到期情况
  useReminderEngine();

  const handleQuickAdd = () => {
    const choice = prompt('选择新建类型：\n1. 任务\n2. 待办\n\n请输入 1 或 2：');
    if (choice === '1') setQuickAddType('task');
    else if (choice === '2') setQuickAddType('todo');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} onQuickAdd={handleQuickAdd} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Quick Add Modals */}
      {quickAddType === 'task' && (
        <TaskForm onClose={() => setQuickAddType(null)} />
      )}
      {quickAddType === 'todo' && (
        <TodoForm onClose={() => setQuickAddType(null)} />
      )}
    </div>
  );
}
