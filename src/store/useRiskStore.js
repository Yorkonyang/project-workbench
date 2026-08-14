/**
 * Risk Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

export const useRiskStore = create(
  persist(
    (set, get) => ({
      risks: [],
      loading: false,

      fetchRisks: async () => {
        set({ loading: true });
        try {
          const risks = await apiClient.getRisks();
          set({ risks, loading: false });
        } catch (err) {
          console.error('Failed to fetch risks:', err);
          set({ loading: false });
        }
      },

      addRisk: async (risk) => {
        try {
          const created = await apiClient.createRisk(risk);
          set((state) => ({
            risks: [
              ...state.risks,
              { ...created, id: created.id },
            ],
          }));
          return created;
        } catch (err) {
          console.error('Failed to add risk:', err);
          // 降级到本地存储
          const localId = `risk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newRisk = {
            ...risk,
            id: localId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            risks: [...state.risks, newRisk],
          }));
          return newRisk;
        }
      },

      updateRisk: async (id, updates) => {
        set((state) => ({
          risks: state.risks.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        }));
        try {
          await apiClient.updateRisk(id, updates);
        } catch (err) {
          console.error('Failed to update risk:', err);
        }
      },

      deleteRisk: async (id) => {
        set((state) => ({
          risks: state.risks.filter((r) => r.id !== id),
        }));
        try {
          await apiClient.deleteRisk(id);
        } catch (err) {
          console.error('Failed to delete risk:', err);
        }
      },

      getRisksByProject: (projectId) => get().risks.filter((r) => r.projectId === projectId),
    }),
    {
      name: 'pw_risks',
      storage: createJSONStorage(() => localStorage),
    }
  )
);