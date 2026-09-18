import { useEffect, useState, useRef } from 'react';
import { Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import DashboardPage from '@/pages/DashboardPage';
import TasksPage from '@/pages/TasksPage';
import TimelinePage from '@/pages/TimelinePage';
import DocumentsPage from '@/pages/DocumentsPage';
import TodosPage from '@/pages/TodosPage';
import RisksPage from '@/pages/RisksPage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import ProjectsPage from '@/pages/ProjectsPage';
import TaskDetailPage from '@/pages/TaskDetailPage';
import TodoDetailPage from '@/pages/TodoDetailPage';
import MembersPage from '@/pages/MembersPage';
import ReminderSettingsPage from '@/pages/ReminderSettingsPage';
import DictionaryPage from '@/pages/DictionaryPage';
import LoginPage from '@/pages/LoginPage';
import { initSeedData } from '@/lib/seedData';
import { refreshAllData, bootstrapAfterLogin } from '@/lib/bootstrap';
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
import apiClient from '@/lib/apiClient';

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [debugInfo, setDebugInfo] = useState({});

  // SSO 登录改由 /sso-callback 路由统一处理（后端写入 HttpOnly Cookie，前端地址栏不再暴露邮箱/签名）

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
          <Route path="/task/:taskId" element={<TaskDetailPage />} />
          <Route path="/todo/:todoId" element={<TodoDetailPage />} />
        </Route>

        {/* SSO 跳转回调（登录前可访问）：后端已写入 HttpOnly Cookie，这里消费并登录 */}
        <Route path="/sso-callback" element={<SsoCallback />} />

        {/*  * 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

// ===== SSO 回调组件（方案A）=====
// 轻流通知链接点击后，后端 /api/auth/sso-link 已把一次性 ticket 写入 HttpOnly Cookie 并 302 到此。
// 这里仅消费 Cookie 完成登录，URL 全程不含明文邮箱 / 签名 / ticket。
function SsoCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('正在登录…');
  // 防重入锁：StrictMode 下 effect 会双调用，或路由重渲染可能重复触发；
  // 一次性 ticket 只能消费一次，重复调用 ssoConsume 会 401 并报错跳登录，导致已登录用户被踢回仪表盘。
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    const redirect = searchParams.get('redirect') || '/';
    handledRef.current = true;
    (async () => {
      try {
        // ticket 由 HttpOnly Cookie 自动携带（不出现在 URL）
        const me = await apiClient.ssoConsume();
        if (!me || !me.userId) {
          navigate('/login', { replace: true });
          return;
        }
        useAuthStore.getState().ssoLogin({
          userId: me.userId,
          email: me.email,
        });
        try {
          await useMemberStore.getState().fetchMembers();
        } catch (e) {
          console.warn('[SSO] fetchMembers 失败:', e?.message);
        }
        try {
          await bootstrapAfterLogin();
        } catch (e) {
          console.warn('[SSO] bootstrapAfterLogin 失败:', e?.message);
        }
        navigate(redirect, { replace: true });
      } catch (err) {
        console.error('[SSO] 登录失败:', err);
        // 双保险：若此前已通过 SSO 登录成功（如 StrictMode 二次 ssoConsume 失败），不要强行跳登录
        if (useAuthStore.getState().isAuthenticated) {
          const fallback = searchParams.get('redirect') || '/';
          navigate(fallback, { replace: true });
          return;
        }
        setStatus('登录失败：' + (err?.message || '未知错误'));
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
      {status}
    </div>
  );
}
