import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useReminderEngine } from '@/hooks/useReminderEngine';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 初始化提醒引擎 — 定时检查任务/待办/里程碑到期情况
  useReminderEngine();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
