/**
 * Task Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';
import { useProjectStore } from '@/store/useProjectStore';
import { autoCloseRelatedRisks } from '@/hooks/useAutoCloseRisks';

export const useTaskStore = create(
  persist(
    (set, get) => ({
      tasks: [],
      loading: false,

      // 从 API 加载任务
      fetchTasks: async (projectId) => {
        set({ loading: true });
        try {
          const tasks = projectId
            ? await apiClient.getTasks(projectId)
            : await apiClient.getAllTasks();
          set({ tasks, loading: false });
        } catch (err) {
          console.error('Failed to fetch tasks:', err);
          set({ loading: false });
        }
      },

      addTask: async (projectId, data) => {
        const task = await apiClient.createTask(projectId, data);
        set((state) => ({ tasks: [...state.tasks, task] }));
        return task;
      },

      updateTask: async (id, data) => {
        const oldTask = get().tasks.find((t) => t.id === id);
        const oldStatus = oldTask?.status || 'todo';
        const task = await apiClient.updateTask(id, data);
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        }));
        // 状态联动：任务从「待启动」变为「进行中」时，自动将所属项目同步为「进行中」
        const newStatus = task.status || oldStatus;
        if (oldStatus === 'todo' && newStatus === 'in_progress') {
          const pid = task.projectId || task.project_id;
          if (pid) {
            const projectStore = useProjectStore.getState();
            const proj = projectStore.projects.find((p) => p.id === pid);
            if (proj && proj.status !== 'in_progress') {
              await projectStore.updateProject(pid, { status: 'in_progress' });
            }
          }
        }
        // 任务完成或阻塞时，立即关闭关联风险
        if ((newStatus === 'done' || newStatus === 'blocked') && oldStatus !== newStatus) {
          autoCloseRelatedRisks(task.id, 'task', task.title);
        }
        return task;
      },

      deleteTask: async (id) => {
        await apiClient.deleteTask(id);
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
      },

      // 提交任务变更申请（修改计划/废止）：写入 pendingChange，乐观更新本地
      requestTaskChange: async (id, payload) => {
        const task = await apiClient.requestTaskChange(id, payload);
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        }));
        return task;
      },

      // 评审任务变更申请（通过/驳回）：apply 后乐观更新本地
      reviewTaskChange: async (id, payload) => {
        const task = await apiClient.reviewTaskChange(id, payload);
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        }));
        return task;
      },

      reorderTasks: (newTasks) => set({ tasks: newTasks }),

      getTasksByProject: (projectId) =>
        get().tasks.filter((t) => t.projectId === projectId || t.project_id === projectId),

      deleteTasksByProject: async (projectId) => {
        const tasks = get().getTasksByProject(projectId);
        await Promise.all(tasks.map(t => get().deleteTask(t.id)));
      },

      getTasksByStatus: (status) =>
        get().tasks.filter((t) => t.status === status),
    }),
    {
      name: 'pw_tasks',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
