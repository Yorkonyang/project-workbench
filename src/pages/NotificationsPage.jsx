import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Calendar, AlertCircle, Bell, Flag, Info,
  CheckCheck, Trash2, BellOff, Filter,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { useNotificationStore, NOTIF_TYPES } from '@/store/useNotificationStore';
import { useProjectStore } from '@/store/useProjectStore';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ICON_MAP = { Clock, Calendar, AlertCircle, Bell, Flag, Info };

const TYPE_FILTERS = [
  { key: '', label: '全部' },
  { key: 'pre_due', label: '即将到期' },
  { key: 'due', label: '今日到期' },
  { key: 'overdue', label: '已逾期' },
  { key: 'escalation', label: '催办' },
  { key: 'milestone', label: '里程碑' },
  { key: 'archive_requested', label: '归档申请' },
  { key: 'archive_approved', label: '归档审批' },
  { key: 'archive_rejected', label: '归档驳回' },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const clearRead = useNotificationStore((s) => s.clearRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const projects = useProjectStore((s) => s.projects);

  // Filter out notifications from archived projects
  const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const filteredNotifications = notifications.filter((n) => {
    // Keep notifications without related project
    if (!n.relatedId || n.type === 'archive_requested' || n.type === 'archive_approved' || n.type === 'archive_rejected') return true;
    return activeProjectIds.has(n.relatedId);
  });

  const [filter, setFilter] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (showUnreadOnly && n.read) return false;
      if (filter && n.type !== filter) return false;
      return true;
    });
  }, [notifications, filter, showUnreadOnly]);

  const stats = useMemo(() => ({
    total: filteredNotifications.length,
    unread: filteredNotifications.filter((n) => !n.read).length,
    overdue: filteredNotifications.filter((n) => n.type === 'overdue' || n.type === 'escalation').length,
    preDue: filteredNotifications.filter((n) => n.type === 'pre_due' || n.type === 'due').length,
  }), [filteredNotifications]);

  const handleNotifClick = (notif) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  return (
    <PageContainer>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Bell} label="通知总数" value={stats.total} color="#3b82f6" />
        <StatCard icon={AlertCircle} label="未读" value={stats.unread} color="#ef4444" />
        <StatCard icon={Clock} label="到期/即将到期" value={stats.preDue} color="#f59e0b" />
        <StatCard icon={AlertCircle} label="逾期/催办" value={stats.overdue} color="#dc2626" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 flex-wrap">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                  filter === f.key ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Unread Only Toggle */}
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              showUnreadOnly
                ? 'bg-primary-50 text-primary-600 border-primary-300'
                : 'bg-white text-slate-500 border-slate-300'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            仅未读
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={markAllAsRead} disabled={stats.unread === 0}>
          <CheckCheck className="w-4 h-4" />
          全部已读
        </Button>
        <Button size="sm" variant="secondary" onClick={clearRead} disabled={filteredNotifications.every((n) => !n.read)}>
          <Trash2 className="w-4 h-4" />
          清除已读
        </Button>
        <Button size="sm" variant="danger" onClick={() => { if (confirm('确定清空所有通知？')) clearAll(); }}>
          <BellOff className="w-4 h-4" />
          清空全部
        </Button>
        </div>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          title="暂无通知"
          description="系统会自动检查任务和待办的到期情况并生成提醒"
        />
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notif) => {
            const typeConfig = NOTIF_TYPES[notif.type] || NOTIF_TYPES.system;
            const Icon = ICON_MAP[typeConfig.icon] || Info;
            return (
              <div
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm',
                  notif.read ? 'bg-white border-slate-200' : 'bg-blue-50/50 border-blue-200'
                )}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${typeConfig.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${typeConfig.color}15`, color: typeConfig.color }}
                    >
                      {typeConfig.label}
                    </span>
                    <h4 className={cn('text-sm', notif.read ? 'text-slate-600' : 'text-slate-800 font-semibold')}>
                      {notif.title}
                    </h4>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{notif.message}</p>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {(() => {
                      try {
                        return formatDistanceToNow(parseISO(notif.createdAt), { addSuffix: true, locale: zhCN });
                      } catch { return ''; }
                    })()}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {!notif.read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                      title="标记已读"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                    className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
