import { useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Menu, Calendar as CalIcon, Settings, Download, Upload, RotateCcw,
  Clock, AlertCircle, Flag, Info, CheckCheck, ChevronRight, LogOut, UserCog,
  KeyRound,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useNotificationStore, NOTIF_TYPES } from '@/store/useNotificationStore';
import { useMemberStore } from '@/store/useMemberStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useProjectStore } from '@/store/useProjectStore';
import { ROLES } from '@/config/permissions';
import { exportAllData, importAllData, clearAllData } from '@/lib/dataManager';
import { cn } from '@/lib/utils';
import ChangePasswordForm from '@/components/members/ChangePasswordForm';
import { bootstrapAfterLogout } from '@/lib/bootstrap';

const ICON_MAP = { Clock, Calendar: CalIcon, AlertCircle, Bell, Flag, Info };

const PAGE_TITLES = {
  '/': '仪表盘总览',
  '/tasks': '任务管理',
  '/timeline': '项目时间线',
  '/documents': '文档管理',
  '/todos': '待办与提醒',
  '/risks': '风险管理',
  '/members': '人员管理',
  // /notifications 路由已移除，此处保留兼容
  '/reminder-settings': '提醒设置',
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();

  const notifications = useNotificationStore((s) => s.notifications);
  const projects = useProjectStore((s) => s.projects);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  // Filter out notifications from archived projects for badge count
  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const unreadCount = useMemo(() =>
    notifications.filter((n) => {
      if (!n.read) return false;
      if (!n.relatedId) return true;
      if (n.type === 'archive_requested' || n.type === 'archive_approved' || n.type === 'archive_rejected') return true;
      return activeProjectIds.has(n.relatedId);
    }).length
  , [notifications, activeProjectIds]);

  const members = useMemberStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const logout = useAuthStore((s) => s.logout);
  const currentUser = members.find((m) => m.id === currentUserId);
  const isAdmin = currentUser?.role === 'admin';

  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const fileInputRef = useRef(null);

  const pageTitle = location.pathname.startsWith('/projects/')
    ? '项目详情'
    : PAGE_TITLES[location.pathname] || '项目工作台';

  const today = new Date();
  const dateStr = format(today, 'yyyy年MM月dd日 EEEE', { locale: zhCN });

  const recentNotifs = notifications.slice(0, 6);

  const handleNotifClick = (notif) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
    setShowNotif(false);
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    // 先清数据缓存，防止上一个账号的项目/任务残留
    try {
      await bootstrapAfterLogout();
    } catch (e) {
      console.error('[Header] pre-logout cleanup failed:', e);
    }
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 z-20">
      {/* Left: Menu + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-smooth"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-800">{pageTitle}</h1>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" />
            在线
          </div>
        </div>
      </div>

      {/* Right: Date + Notifications + Quick Add + User */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 font-mono text-xs">
          <CalIcon className="w-3.5 h-3.5" />
          <span>{dateStr}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative p-2 hover:bg-slate-100 rounded-lg transition-smooth"
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
              <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-[480px] flex flex-col">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">
                    待办提醒
                    {unreadCount > 0 && (
                      <span className="ml-2 text-xs text-red-500 font-medium">({unreadCount} 条未读)</span>
                    )}
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 transition-smooth"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      全部已读
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {recentNotifs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      暂无通知
                    </div>
                  ) : (
                    <div className="p-1.5 space-y-0.5">
                      {recentNotifs.map((notif) => {
                        const typeConfig = NOTIF_TYPES[notif.type] || NOTIF_TYPES.system;
                        const Icon = ICON_MAP[typeConfig.icon] || Info;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotifClick(notif)}
                            className={cn(
                              'flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-smooth',
                              notif.read ? 'hover:bg-slate-50' : 'bg-primary-50/50 hover:bg-primary-50'
                            )}
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${typeConfig.color}15` }}
                            >
                              <Icon className="w-4 h-4" style={{ color: typeConfig.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />}
                                <span className="text-xs font-medium text-slate-700 truncate">{notif.title}</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(() => {
                                  try { return formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true, locale: zhCN }); }
                                  catch { return ''; }
                                })()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="p-2 border-t border-slate-100">
                  <button
                    onClick={() => { navigate('/todos'); setShowNotif(false); }}
                    className="w-full flex items-center justify-center gap-1 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg font-medium transition-smooth"
                  >
                    查看全部待办
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Current User */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-smooth"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ backgroundColor: currentUser?.avatarColor || '#6366F1' }}
            >
              {currentUser?.name?.charAt(0) || '?'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-700 leading-tight">
                {currentUser?.name || '未知用户'}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {ROLES[currentUser?.role]?.label || ''}
              </div>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50">
                {/* 当前用户信息 */}
                <div className="p-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm"
                      style={{ backgroundColor: currentUser?.avatarColor || '#6366F1' }}
                    >
                      {currentUser?.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{currentUser?.name}</div>
                      <div className="text-xs text-slate-400 truncate font-mono">{currentUser?.email}</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span
                      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${ROLES[currentUser?.role]?.color}15`,
                        color: ROLES[currentUser?.role]?.color,
                      }}
                    >
                      {ROLES[currentUser?.role]?.label}
                    </span>
                  </div>
                </div>

                {/* 菜单项 */}
                <div className="p-2 space-y-0.5">
                  <button
                    onClick={() => { navigate('/members'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-smooth"
                  >
                    <UserCog className="w-4 h-4 text-slate-400" />
                    人员管理
                  </button>
                  <button
                    onClick={() => { setShowChangePwd(true); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-smooth"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    修改密码
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => { navigate('/reminder-settings'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-smooth"
                    >
                      <Bell className="w-4 h-4 text-slate-400" />
                      提醒设置
                    </button>
                  )}
                </div>

                {/* 数据管理 */}
                <div className="border-t border-slate-100 p-2 space-y-0.5">
                  <button
                    onClick={() => { exportAllData(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-smooth"
                  >
                    <Download className="w-4 h-4 text-slate-400" />
                    导出备份
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-smooth"
                  >
                    <Upload className="w-4 h-4 text-slate-400" />
                    导入恢复
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('确定要清空所有数据并重置为初始状态吗？此操作不可撤销！')) {
                        clearAllData();
                        window.location.reload();
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-smooth"
                  >
                    <RotateCcw className="w-4 h-4 text-red-400" />
                    重置数据
                  </button>
                </div>

                {/* 退出登录 */}
                <div className="border-t border-slate-100 p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 font-medium transition-smooth"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              await importAllData(file);
              setShowUserMenu(false);
              window.location.reload();
            } catch (err) {
              alert(err.message);
            }
          }}
        />
      </div>

      {/* 修改密码弹窗 */}
      {showChangePwd && <ChangePasswordForm onClose={() => setShowChangePwd(false)} />}
    </header>
  );
}
