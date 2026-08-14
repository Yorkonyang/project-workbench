/**
 * Task Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

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
        const task = await apiClient.updateTask(id, data);
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? task : t)),
        }));
        return task;
      },

      deleteTask: async (id) => {
        await apiClient.deleteTask(id);
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
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
