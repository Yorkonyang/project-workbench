import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useReminderEngine } from '@/hooks/useReminderEngine';
import { useChatRealtime } from '@/hooks/useChatRealtime';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 初始化提醒引擎 — 定时检查任务/待办/里程碑到期情况
  useReminderEngine();

  // 群聊实时连接（SSE）— 全站挂载一次，接收新消息推送
  useChatRealtime();

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
