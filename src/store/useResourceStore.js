/**
 * Resource Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

export const useResourceStore = create(
  persist(
    (set, get) => ({
      resources: [],
      loading: false,

      fetchResources: async () => {
        set({ loading: true });
        try {
          const resources = await apiClient.getResources();
          set({ resources, loading: false });
        } catch (err) {
          console.error('Failed to fetch resources:', err);
          set({ loading: false });
        }
      },

      addResource: async (resource) => {
        try {
          const created = await apiClient.createResource(resource);
          set((state) => ({
            resources: [...state.resources, created],
          }));
          return created;
        } catch (err) {
          console.error('Failed to add resource:', err);
          const localId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newRes = {
            ...resource,
            id: localId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            resources: [...state.resources, newRes],
          }));
          return newRes;
        }
      },

      updateResource: async (id, updates) => {
        set((state) => ({
          resources: state.resources.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        }));
        try {
          await apiClient.updateResource(id, updates);
        } catch (err) {
          console.error('Failed to update resource:', err);
        }
      },

      deleteResource: async (id) => {
        set((state) => ({
          resources: state.resources.filter((r) => r.id !== id),
        }));
        try {
          await apiClient.deleteResource(id);
        } catch (err) {
          console.error('Failed to delete resource:', err);
        }
      },

      getResourcesByProject: (projectId) => get().resources.filter((r) => r.projectId === projectId),
    }),
    {
      name: 'pw_resources',
      storage: createJSONStorage(() => localStorage),
    }
  )
);