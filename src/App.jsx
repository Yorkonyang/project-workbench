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
import ReminderSettingsPage from '@/pages/ReminderSettingsPage';
import DictionaryPage from '@/pages/DictionaryPage';
import LoginPage from '@/pages/LoginPage';
import { initSeedData } from '@/lib/seedData';
import { refreshAllData } from '@/lib/bootstrap';
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
import { useDictionaryStore } from '@/store/useDictionaryStore';
import { useOrgStore } from '@/store/useOrgStore';
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
  const fetchProjectTypes = useDictionaryStore((s) => s.fetchProjectTypes);
  const fetchProjectStages = useDictionaryStore((s) => s.fetchProjectStages);
  const fetchDepartments = useOrgStore((s) => s.fetchDepartments);

  useEffect(() => {
    // 注意：不要在这里清 pw_auth，保留登录态。
    // 只清"按用户隔离的数据 store"的缓存（projects/tasks/todos/...），避免上个会话的脏数据被前端渲染。
    // pw_members 是公共数据（成员名册 + 登录账号），不要清，否则登录页将无账号可匹配。
    const DATA_KEYS = [
      'pw_projects', 'pw_tasks', 'pw_milestones', 'pw_documents',
      'pw_todos', 'pw_risks', 'pw_resources',
      'pw_notifications', 'pw_reminder_config', 'pw_departments',
    ];
    DATA_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('pw_initialized');
    console.log('[App] Cleared user-scoped data store localStorage cache (kept pw_auth & pw_members)');

    // members 是公共数据，**无论登录与否**都需要拉取，否则 LoginPage 无法比对邮箱密码
    fetchMembers().catch(err => console.error('[App] fetchMembers failed:', err));

    // 等待 auth store hydration 完成，再做初始加载
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
      // 仅在已登录状态加载"按用户隔离的数据"；未登录则由 LoginPage 登录后的 bootstrapAfterLogin 负责拉数据
      const isAuth = useAuthStore.getState().isAuthenticated;
      const userId = useAuthStore.getState().currentUserId;
      console.log('[App] Auth rehydrated, isAuth:', isAuth, 'userId:', userId);
      if (isAuth && userId) {
        loadFromApi();
      }
      initSeedData();
    });
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      const isAuth = useAuthStore.getState().isAuthenticated;
      const userId = useAuthStore.getState().currentUserId;
      console.log('[App] Auth already hydrated, isAuth:', isAuth, 'userId:', userId);
      if (isAuth && userId) {
        loadFromApi();
      }
      initSeedData();
    }
    return () => unsub();
  }, []);

  // 监听登录态变化：登录后 / 切换账号后自动加载数据（防止 zustand persist 旧数据残留）
  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      // 用户已登录：清空再拉取，确保数据按当前 currentUserId 过滤
      refreshAllData().catch(err => console.error('[App] refreshAllData failed:', err));
    }
  }, [isAuthenticated, hydrated]);

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
        fetchProjectTypes(),
        fetchProjectStages(),
        fetchDepartments(),
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
          <Route path="/reminder-settings" element={<ReminderSettingsPage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
        </Route>

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
