/**
 * Milestone Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

export const useMilestoneStore = create(
  persist(
    (set, get) => ({
      milestones: [],
      loading: false,

      fetchMilestones: async () => {
        set({ loading: true });
        try {
          const milestones = await apiClient.getMilestones();
          set({ milestones, loading: false });
        } catch (err) {
          console.error('Failed to fetch milestones:', err);
          set({ loading: false });
        }
      },

      addMilestone: async (milestone) => {
        try {
          const created = await apiClient.createMilestone(milestone);
          set((state) => ({
            milestones: [...state.milestones, created],
          }));
          return created;
        } catch (err) {
          console.error('Failed to add milestone:', err);
          const localId = `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newMs = {
            ...milestone,
            id: localId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            milestones: [...state.milestones, newMs],
          }));
          return newMs;
        }
      },

      updateMilestone: async (id, updates) => {
        set((state) => ({
          milestones: state.milestones.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
          ),
        }));
        try {
          await apiClient.updateMilestone(id, updates);
        } catch (err) {
          console.error('Failed to update milestone:', err);
        }
      },

      deleteMilestone: async (id) => {
        set((state) => ({
          milestones: state.milestones.filter((m) => m.id !== id),
        }));
        try {
          await apiClient.deleteMilestone(id);
        } catch (err) {
          console.error('Failed to delete milestone:', err);
        }
      },

      getMilestonesByProject: (projectId) => get().milestones.filter((m) => m.projectId === projectId),
    }),
    {
      name: 'pw_milestones',
      storage: createJSONStorage(() => localStorage),
    }
  )
);