import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  FolderOpen,
  Bell,
  AlertTriangle,
  Database,
  ChevronLeft,
  ChevronRight,
  Users,
  Settings,
  FolderKanban,
  BookOpen,
  Building2,
} from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/projects', label: '项目列表', icon: FolderKanban },
  { path: '/tasks', label: '任务管理', icon: CheckSquare },
  { path: '/timeline', label: '时间线', icon: Calendar },
  { path: '/documents', label: '文档管理', icon: FolderOpen },
  { path: '/todos', label: '待办提醒', icon: Bell },
  { path: '/risks', label: '风险管理', icon: AlertTriangle },
];

const ADMIN_ITEMS = [
  { path: '/members', label: '组织架构与成员', icon: Building2 },
  { path: '/dictionary', label: '数据字典', icon: BookOpen },
  { path: '/reminder-settings', label: '提醒设置', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const projects = useProjectStore((s) => s.projects);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleProjectClick = (id) => {
    navigate(`/projects/${id}`);
    if (window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 sidebar-scroll',
          collapsed ? 'w-16' : 'w-60',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Database className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-base tracking-wide whitespace-nowrap block">
                  项目工作台
                </span>
                <span className="text-[10px] text-slate-400 tracking-wider uppercase">
                  Project Hub
                </span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center mx-auto shadow-lg shadow-primary-500/30">
              <Database className="w-4 h-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-smooth"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {!collapsed && (
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">
              导航
            </div>
          )}
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => window.innerWidth < 1024 && onClose()}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-smooth relative',
                    isActive
                      ? 'bg-primary-500/20 text-primary-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white',
                    collapsed && 'justify-center'
                  )}
                >
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary-400"
                    />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>

          {/* Projects - 移除侧边栏项目列表，统一由项目列表页面管理 */}

          {/* Admin Section */}
          {!collapsed && (
            <div className="mt-6">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">
                管理
              </div>
            </div>
          )}
          <div className="space-y-0.5 mt-1">
            {ADMIN_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => window.innerWidth < 1024 && onClose()}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-smooth relative',
                    isActive
                      ? 'bg-primary-500/20 text-primary-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white',
                    collapsed && 'justify-center'
                  )}
                >
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary-400"
                    />
                  )}
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Footer info */}
        {!collapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="text-[10px] text-slate-500 text-center">
              项目工作台 · v2.0
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
