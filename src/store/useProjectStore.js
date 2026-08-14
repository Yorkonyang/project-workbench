/**
 * Project Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: [],
      loading: false,

      // 从 API 加载项目
      fetchProjects: async () => {
        set({ loading: true });
        try {
          const projects = await apiClient.getProjects();
          set({ projects, loading: false });
        } catch (err) {
          console.error('Failed to fetch projects:', err);
          set({ loading: false });
        }
      },

      addProject: async (data) => {
        const project = await apiClient.createProject(data);
        set((state) => ({ projects: [...state.projects, project] }));
        return project;
      },

      // 生成下一个项目编号 XM_001 / XM_002 ...
      generateProjectCode: () => {
        const prefix = 'XM_';
        const existing = get().projects || [];
        const maxNum = existing.reduce((max, p) => {
          const m = (p.code || '').match(/^XM_(\d+)$/);
          if (m) {
            const n = parseInt(m[1], 10);
            return n > max ? n : max;
          }
          return max;
        }, 0);
        return prefix + String(maxNum + 1).padStart(3, '0');
      },

      updateProject: async (id, data) => {
        const project = await apiClient.updateProject(id, data);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
        }));
        return project;
      },

      deleteProject: async (id) => {
        await apiClient.deleteProject(id);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
      },

      getActiveProjects: () => get().projects.filter((p) => !p.archived),
      getArchivedProjects: () => get().projects.filter((p) => p.archived),
      getRequestedProjects: () => get().projects.filter((p) => p.archiveStatus === 'requested'),

      // 提交归档申请（ProjectCard 调用此方法）
      requestArchive: async (id, reason, note) => {
        const project = await apiClient.archiveProject(id, reason, note);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
        }));
        return project;
      },

      // 兼容旧调用名
      archiveProject: async (id, reason, note) => {
        return get().requestArchive(id, reason, note);
      },

      approveArchive: async (id) => {
        const result = await apiClient.approveArchive(id);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? result.project : p)),
        }));
        return result;
      },

      rejectArchive: async (id) => {
        const project = await apiClient.rejectArchive(id);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? project : p)),
        }));
        return project;
      },

      restoreProject: async (id) => {
        const result = await apiClient.restoreProject(id);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? result.project : p)),
        }));
        return result;
      },
    }),
    {
      name: 'pw_projects',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
