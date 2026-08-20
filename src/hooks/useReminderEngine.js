import { useEffect, useRef, useCallback } from 'react';
import { differenceInCalendarDays, parseISO, isToday } from 'date-fns';
import { useTaskStore } from '@/store/useTaskStore';
import { useTodoStore } from '@/store/useTodoStore';
import { useMilestoneStore } from '@/store/useMilestoneStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useReminderConfigStore } from '@/store/useReminderConfigStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useMemberStore } from '@/store/useMemberStore';

/**
 * 提醒引擎 Hook
 * 定时检查任务、待办、里程碑，生成到期前/到期/逾期/催办通知
 * 支持浏览器桌面通知和站内通知中心
 */
export function useReminderEngine() {
  const tasks = useTaskStore((s) => s.tasks);
  const todos = useTodoStore((s) => s.todos);
  const milestones = useMilestoneStore((s) => s.milestones);
  const projects = useProjectStore((s) => s.projects);
  const members = useMemberStore((s) => s.members);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const notifications = useNotificationStore((s) => s.notifications);
  const config = useReminderConfigStore((s) => s.config);
  const configRef = useRef(config);
  configRef.current = config;

  // 解析任务责任人名称列表（兼容 assignee 字符串和 assignees 数组）
  const getAssigneeNames = (task) => {
    const ids = task.assignees || (task.assignee ? [task.assignee] : []);
    const names = ids
      .map((id) => members.find((m) => m.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) {
      // 回退：如果 seed data 使用名字而非 ID
      const raw = task.assignee || '';
      return raw ? [raw] : [];
    }
    return names;
  };

  // 去重：检查是否已存在相同的通知
  const hasNotification = useCallback((relatedId, type) => {
    return notifications.some(
      (n) => n.relatedId === relatedId && n.relatedType === type && !n.read
    );
  }, [notifications]);

  // 检查并生成通知
  const checkReminders = useCallback(() => {
    const cfg = configRef.current;
    const now = new Date();

    // === 任务提醒 ===
    tasks.forEach((task) => {
      if (task.status === 'done' || task.status === 'blocked') return;
      if (!task.dueDate) return;

      const dueDate = parseISO(task.dueDate);
      const daysDiff = differenceInCalendarDays(dueDate, now);
      const project = projects.find((p) => p.id === task.projectId);
      const projLabel = project ? `[${project.code}] ` : '';

      // 到期前提醒
      if (cfg.preDueDays.includes(daysDiff) && daysDiff > 0) {
        if (!hasNotification(task.id, 'task')) {
          addNotification({
            type: 'pre_due',
            title: `${projLabel}任务即将到期`,
            message: `「${task.title}」将于 ${daysDiff} 天后到期（${task.dueDate}）`,
            relatedId: task.id,
            relatedType: 'task',
            link: '/tasks',
          });
        }
      }

      // 到期当天提醒
      if (cfg.enableDueDay && isToday(dueDate)) {
        if (!hasNotification(task.id, 'task')) {
          addNotification({
            type: 'due',
            title: `${projLabel}任务今日到期`,
            message: `「${task.title}」今天到期，负责人：${getAssigneeNames(task).join('、') || '未分配'}`,
            relatedId: task.id,
            relatedType: 'task',
            link: '/tasks',
          });
        }
      }

      // 逾期提醒
      if (cfg.enableOverdue && daysDiff < 0) {
        const overdueDays = Math.abs(daysDiff);

        // 逾期首日提醒
        if (overdueDays === 1) {
          if (!hasNotification(task.id, 'task')) {
            addNotification({
              type: 'overdue',
              title: `${projLabel}任务已逾期`,
              message: `「${task.title}」已逾期 1 天，负责人：${getAssigneeNames(task).join('、') || '未分配'}`,
              relatedId: task.id,
              relatedType: 'task',
              overdueDays,
              link: '/tasks',
            });
          }
        }

        // 催办提醒（达到阈值后按间隔催办）
        if (overdueDays >= cfg.escalationDays) {
          const sinceEscalation = overdueDays - cfg.escalationDays;
          if (sinceEscalation % cfg.escalationInterval === 0) {
            if (!hasNotification(task.id, 'task')) {
              addNotification({
                type: 'escalation',
                title: `${projLabel}催办：任务逾期 ${overdueDays} 天`,
                message: `「${task.title}」已逾期 ${overdueDays} 天，请尽快处理！负责人：${getAssigneeNames(task).join('、') || '未分配'}`,
                relatedId: task.id,
                relatedType: 'task',
                overdueDays,
                link: '/tasks',
              });
            }
          }
        }
      }
    });

    // === 待办提醒 ===
    todos.forEach((todo) => {
      if (todo.completed) return;
      if (!todo.dueDate) return;

      const dueDate = parseISO(todo.dueDate);
      const daysDiff = differenceInCalendarDays(dueDate, now);
      const project = todo.projectId ? projects.find((p) => p.id === todo.projectId) : null;
      const projLabel = project ? `[${project.code}] ` : '';

      if (cfg.preDueDays.includes(daysDiff) && daysDiff > 0) {
        if (!hasNotification(todo.id, 'todo')) {
          addNotification({
            type: 'pre_due',
            title: `${projLabel}待办即将到期`,
            message: `「${todo.title}」将于 ${daysDiff} 天后到期`,
            relatedId: todo.id,
            relatedType: 'todo',
            link: '/todos',
          });
        }
      }

      if (cfg.enableDueDay && isToday(dueDate)) {
        if (!hasNotification(todo.id, 'todo')) {
          addNotification({
            type: 'due',
            title: `${projLabel}待办今日到期`,
            message: `「${todo.title}」今天到期`,
            relatedId: todo.id,
            relatedType: 'todo',
            link: '/todos',
          });
        }
      }

      if (cfg.enableOverdue && daysDiff < 0) {
        const overdueDays = Math.abs(daysDiff);
        if (overdueDays === 1) {
          if (!hasNotification(todo.id, 'todo')) {
            addNotification({
              type: 'overdue',
              title: `${projLabel}待办已逾期`,
              message: `「${todo.title}」已逾期 1 天`,
              relatedId: todo.id,
              relatedType: 'todo',
              overdueDays,
              link: '/todos',
            });
          }
        }

        if (overdueDays >= cfg.escalationDays) {
          const sinceEscalation = overdueDays - cfg.escalationDays;
          if (sinceEscalation % cfg.escalationInterval === 0) {
            if (!hasNotification(todo.id, 'todo')) {
              addNotification({
                type: 'escalation',
                title: `${projLabel}催办：待办逾期 ${overdueDays} 天`,
                message: `「${todo.title}」已逾期 ${overdueDays} 天，请尽快处理！`,
                relatedId: todo.id,
                relatedType: 'todo',
                overdueDays,
                link: '/todos',
              });
            }
          }
        }
      }
    });

    // === 里程碑提醒 ===
    milestones.forEach((ms) => {
      if (ms.status === 'achieved') return;
      if (!ms.date) return;

      const msDate = parseISO(ms.date);
      const daysDiff = differenceInCalendarDays(msDate, now);
      const project = projects.find((p) => p.id === ms.projectId);
      const projLabel = project ? `[${project.code}] ` : '';

      if (cfg.milestonePreDays.includes(daysDiff) && daysDiff > 0) {
        if (!hasNotification(ms.id, 'milestone')) {
          addNotification({
            type: 'milestone',
            title: `${projLabel}里程碑即将到达`,
            message: `里程碑「${ms.title}」将于 ${daysDiff} 天后到达（${ms.date}）${ms.isCritical ? ' [关键里程碑]' : ''}`,
            relatedId: ms.id,
            relatedType: 'milestone',
            link: '/timeline',
          });
        }
      }

      if (cfg.enableDueDay && isToday(msDate)) {
        if (!hasNotification(ms.id, 'milestone')) {
          addNotification({
            type: 'milestone',
            title: `${projLabel}里程碑今日到达`,
            message: `里程碑「${ms.title}」今天到达${ms.isCritical ? ' [关键里程碑]' : ''}`,
            relatedId: ms.id,
            relatedType: 'milestone',
            link: '/timeline',
          });
        }
      }

      if (cfg.enableOverdue && daysDiff < 0 && ms.status !== 'achieved') {
        const overdueDays = Math.abs(daysDiff);
        if (overdueDays === 1) {
          if (!hasNotification(ms.id, 'milestone')) {
            addNotification({
              type: 'overdue',
              title: `${projLabel}里程碑已逾期`,
              message: `里程碑「${ms.title}」已逾期 1 天${ms.isCritical ? ' [关键里程碑]' : ''}`,
              relatedId: ms.id,
              relatedType: 'milestone',
              overdueDays,
              link: '/timeline',
            });
          }
        }
      }
    });
  }, [tasks, todos, milestones, projects, addNotification, hasNotification]);

  // 发送浏览器桌面通知
  const sendBrowserNotification = useCallback((title, body) => {
    const cfg = configRef.current;
    if (!cfg.enableBrowserNotif) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        tag: title, // 避免重复通知
      });
    }
  }, []);

  // 主定时检查循环
  useEffect(() => {
    const intervalMs = Math.max(30, config.checkIntervalSec) * 1000;

    // 首次加载延迟3秒后执行一次
    const firstTimer = setTimeout(() => {
      checkReminders();
    }, 3000);

    // 定时检查
    const interval = setInterval(() => {
      checkReminders();
    }, intervalMs);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [checkReminders, config.checkIntervalSec]);

  // 请求浏览器通知权限
  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  return {
    checkReminders,
    requestNotificationPermission,
    sendBrowserNotification,
  };
}
