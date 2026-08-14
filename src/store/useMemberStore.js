/**
 * Member Store - 连接后端 API
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/apiClient';

export const useMemberStore = create(
  persist(
    (set, get) => ({
      members: [],
      loading: false,

      // 从 API 加载成员
      fetchMembers: async () => {
        set({ loading: true });
        try {
          const members = await apiClient.getMembers();
          set({ members, loading: false });
        } catch (err) {
          console.error('Failed to fetch members:', err);
          set({ loading: false });
        }
      },

      addMember: async (data) => {
        const member = await apiClient.createMember(data);
        set((state) => ({ members: [...state.members, member] }));
        return member;
      },

      updateMember: async (id, data) => {
        // 先乐观更新本地
        set((state) => ({
          members: state.members.map((m) =>
            m.id === id ? { ...m, ...data } : m
          ),
        }));
        // 后端同步
        try {
          await apiClient.updateMember(id, data);
        } catch (err) {
          console.error('Failed to update member:', err);
        }
      },

      deleteMember: async (id) => {
        // 先乐观更新本地
        set((state) => ({
          members: state.members.filter((m) => m.id !== id),
        }));
        // 后端同步
        try {
          await apiClient.deleteMember(id);
        } catch (err) {
          console.error('Failed to delete member:', err);
        }
      },
    }),
    {
      name: 'pw_members',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
