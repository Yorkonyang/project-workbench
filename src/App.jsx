import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import DashboardPage from '@/pages/DashboardPage';
import TasksPage from '@/pages/TasksPage';
import TimelinePage from '@/pages/TimelinePage';
import DocumentsPage from '@/pages/DocumentsPage';
import TodosPage from '@/pages/TodosPage';
import RisksPage from '@/pages/RisksPage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import ProjectsPage from '@/pages/ProjectsPage';
import MembersPage from '@/pages/MembersPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ReminderSettingsPage from '@/pages/ReminderSettingsPage';
import LoginPage from '@/pages/LoginPage';
import { initSeedData } from '@/lib/seedData';
import { useAuthStore } from '@/store/useAuthStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useRiskStore } from '@/store/useRiskStore';
import { useResourceStore } from '@/store/useResourceStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [debugInfo, setDebugInfo] = useState({});

  // Initialize stores from API
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const fetchTodos = useTodoStore((s) => s.fetchTodos);
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchMilestones = useMilestoneStore((s) => s.fetchMilestones);
  const fetchRisks = useRiskStore((s) => s.fetchRisks);
  const fetchResources = useResourceStore((s) => s.fetchResources);
  const fetchDocuments = useDocumentStore((s) => s.fetchDocuments);

  useEffect(() => {
    // 调试日志
    // 启动时清除旧的localStorage缓存，强制从API加载最新数据
    const STORAGE_KEYS = [
      'pw_projects', 'pw_tasks', 'pw_milestones', 'pw_documents',
      'pw_todos', 'pw_risks', 'pw_resources', 'pw_members',
      'pw_notifications', 'pw_reminder_config', 'pw_auth',
    ];
    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('pw_initialized');
    console.log('[App] Cleared localStorage cache');
    console.log('[App] Auth store hydrated:', useAuthStore.persist.hasHydrated());
    console.log('[App] Auth state:', useAuthStore.getState());

    // 设置超时：如果3秒后还没hydrated，强制显示页面
    const timeout = setTimeout(() => {
      console.warn('[App] Timeout waiting for hydration, forcing display');
      setHydrated(true);
    }, 3000);

    // 等待 persist rehydration 完成
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      console.log('[App] Auth rehydration complete');
      clearTimeout(timeout);
      setHydrated(true);
      setDebugInfo(prev => ({ ...prev, hydrated: true }));
      // 从 API 加载数据
      loadFromApi();
      // rehydration 完成后再次初始化种子数据
      initSeedData();
    });
    if (useAuthStore.persist.hasHydrated()) {
      console.log('[App] Auth already hydrated');
      clearTimeout(timeout);
      setHydrated(true);
      setDebugInfo(prev => ({ ...prev, hydrated: true }));
      loadFromApi();
      initSeedData();
    }

    console.log('[App] useEffect cleanup');
    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  async function loadFromApi() {
    try {
      const [projects, todos, members, tasks] = await Promise.all([
        fetchProjects(),
        fetchTodos(),
        fetchMembers(),
        useTaskStore.getState().fetchTasks(),
      ]);
      // 并行加载扩展数据
      await Promise.all([
        fetchMilestones(),
        fetchRisks(),
        fetchResources(),
        fetchDocuments(),
      ]);
      // 同时加载当前用户的通知
      const userId = useAuthStore.getState().currentUserId;
      if (userId) {
        await fetchNotifications(userId);
      }
      setDebugInfo(prev => ({ ...prev, apiLoaded: true, projects: projects?.length || 0 }));
      console.log('[App] Data loaded from API:', { projects: projects?.length, todos: todos?.length, members: members?.length });
    } catch (err) {
      console.error('[App] Failed to load from API:', err);
      setDebugInfo(prev => ({ ...prev, apiError: err.message }));
    }
  }

  console.log('[App] render - hydrated:', hydrated, 'isAuthenticated:', isAuthenticated);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">加载中...</p>
          {Object.keys(debugInfo).length > 0 && (
            <p className="text-xs text-slate-400 mt-2">调试: {JSON.stringify(debugInfo)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        {/* 登录页 */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* 受保护路由 — 未登录跳转登录页 */}
        <Route
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/reminder-settings" element={<ReminderSettingsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
        </Route>

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
