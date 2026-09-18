/**
 * Notification Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from './useAuthStore';

// 通知类型配置
export const NOTIF_TYPES = {
  task_reminder: { label: '任务提醒', icon: '🔔', color: '#3b82f6' },
  project_update: { label: '项目更新', icon: '📊', color: '#8b5cf6' },
  milestone: { label: '里程碑', icon: '🏁', color: '#10b981' },
  risk_alert: { label: '风险预警', icon: '⚠️', color: '#ef4444' },
  system: { label: '系统通知', icon: 'ℹ️', color: '#64748b' },
  archive_requested: { label: '归档申请', icon: '📋', color: '#f59e0b' },
  archive_approved: { label: '归档通过', icon: '✅', color: '#10b981' },
  archive_rejected: { label: '归档驳回', icon: '❌', color: '#ef4444' },
  project_deleted: { label: '项目删除', icon: '🗑️', color: '#64748b' },
};

export const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: [],
      loading: false,

      // 从 API 加载通知
      fetchNotifications: async (userId) => {
        set({ loading: true });
        try {
          const notifications = await apiClient.getNotifications(userId);
          // 直接覆盖，不使用缓存合并
          set({ notifications, loading: false });
        } catch (err) {
          console.error('Failed to fetch notifications:', err);
          set({ loading: false });
        }
      },

      addNotification: async (data) => {
        // 添加当前用户ID，确保通知能被用户专属查看
        const currentUserId = useAuthStore.getState().currentUserId;
        if (currentUserId) {
          data.user_id = currentUserId;
        }
        const notification = await apiClient.createNotification(data);
        set((state) => ({ notifications: [...state.notifications, notification] }));
        return notification;
      },

      markAsRead: async (id) => {
        // 先乐观更新本地
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: 1 } : n
          ),
        }));
        // 后端同步
        try {
          await apiClient.markNotificationRead(id);
        } catch (err) {
          console.error('Failed to mark notification read:', err);
        }
      },

      markAllAsRead: async () => {
        const userId = useAuthStore.getState().currentUserId;
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: 1 })),
        }));
        try {
          await apiClient.markAllNotificationsRead(userId);
        } catch (err) {
          console.error('Failed to mark all notifications read:', err);
        }
      },

      getUnreadCount: () =>
        get().notifications.filter((n) => !n.read).length,

      // 删除单个通知
      deleteNotification: async (id) => {
        const userId = useAuthStore.getState().currentUserId;
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
        try {
          await apiClient.deleteNotification(id);
        } catch (err) {
          console.error('Failed to delete notification:', err);
          // 失败时以服务端为准重新拉取，避免"假成功"（本地已删但服务端仍在）
          await get().refreshNotifications(userId);
        }
      },

      // 清除已读
      clearRead: async () => {
        const userId = useAuthStore.getState().currentUserId;
        set((state) => ({
          notifications: state.notifications.filter((n) => !n.read),
        }));
        try {
          await apiClient.clearReadNotifications(userId);
        } catch (err) {
          console.error('Failed to clear read notifications:', err);
          // 失败时恢复为服务端真实状态，避免"假成功"（刷新后通知复活）
          await get().refreshNotifications(userId);
        }
      },

      // 清空全部
      clearAll: async () => {
        const userId = useAuthStore.getState().currentUserId;
        set({ notifications: [] });
        try {
          await apiClient.clearAllNotifications(userId);
        } catch (err) {
          console.error('Failed to clear all notifications:', err);
          // 失败时恢复为服务端真实状态，避免"假成功"
          await get().refreshNotifications(userId);
        }
      },

      // 强制刷新通知（从API重新加载，不使用缓存）
      refreshNotifications: async (userId) => {
        try {
          const notifications = await apiClient.getNotifications(userId);
          set({ notifications });
        } catch (err) {
          console.error('Failed to refresh notifications:', err);
        }
      },
    }),
    {
      name: 'pw_notifications',
      storage: createJSONStorage(() => localStorage),
      // 不持久化，每次启动从API加载
      partialize: () => ({}),
    }
  )
);
