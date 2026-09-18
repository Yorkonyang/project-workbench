import { useMemo } from 'react';
import { useTodoStore } from '@/store/useTodoStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useProjectStore } from '@/store/useProjectStore';
import { isToday, isTomorrow, isPast, parseISO } from 'date-fns';

export function useReminders() {
  const todos = useTodoStore((s) => s.todos);
  const tasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);

  return useMemo(() => {
    // 过滤已归档项目
    const activeProjectIds = new Set(projects.filter((p) => !p.archived).map((p) => p.id));

    // 构建待办列表（带类型标识）
    const activeTodos = todos.filter(
      (t) =>
        !t.completed &&
        (!t.projectId || activeProjectIds.has(t.projectId))
    ).map((t) => ({ ...t, _type: 'todo' }));

    // 构建任务列表（带类型标识）
    const activeTasks = tasks.filter(
      (t) =>
        t.status !== 'done' && t.status !== 'blocked' &&
        (!t.projectId || activeProjectIds.has(t.projectId))
    ).map((t) => ({ ...t, _type: 'task' }));

    // 合并待办和任务，按到期时间排序
    const allItems = [...activeTodos, ...activeTasks];

    const todoDueToday = activeTodos.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)));
    const todoDueTomorrow = activeTodos.filter((t) => t.dueDate && isTomorrow(parseISO(t.dueDate)));
    const todoOverdue = activeTodos.filter(
      (t) => t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate))
    );

    const taskDueToday = activeTasks.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)));
    const taskDueTomorrow = activeTasks.filter((t) => t.dueDate && isTomorrow(parseISO(t.dueDate)));
    const taskOverdue = activeTasks.filter(
      (t) => t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate))
    );

    return {
      // 合并列表（用于 TodoList 组件）
      allItems,
      // Todo 相关
      todoDueToday,
      todoDueTomorrow,
      todoOverdue,
      // Task 相关
      taskDueToday,
      taskDueTomorrow,
      taskOverdue,
      // 合计
      totalReminders: todoDueToday.length + todoDueTomorrow.length + todoOverdue.length +
                      taskDueToday.length + taskDueTomorrow.length + taskOverdue.length,
    };
  }, [todos, tasks, projects]);
}
