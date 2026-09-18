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
        const prev = get().members;
        // 乐观更新本地
        set((state) => ({
          members: state.members.map((m) =>
            m.id === id ? { ...m, ...data } : m
          ),
        }));
        try {
          await apiClient.updateMember(id, data);
          return { success: true };
        } catch (err) {
          // 失败回滚到更新前快照，避免 UI 与后端永久漂移（H1）
          set({ members: prev });
          console.error('Failed to update member:', err);
          return { success: false, error: err.message || '更新失败' };
        }
      },

      deleteMember: async (id) => {
        const prev = get().members;
        // 乐观更新本地
        set((state) => ({
          members: state.members.filter((m) => m.id !== id),
        }));
        try {
          await apiClient.deleteMember(id);
          return { success: true };
        } catch (err) {
          // 失败回滚，避免"已删除"的成员在前端"复活"（H1）
          set({ members: prev });
          console.error('Failed to delete member:', err);
          return { success: false, error: err.message || '删除失败' };
        }
      },
    }),
    {
      name: 'pw_members',
      storage: createJSONStorage(() => localStorage),
      // S1：持久化时剔除 password 字段，禁止明文密码落 localStorage；
      // 同时对 rehydrate 的旧数据进行清洗，移除可能已存在的 password（存量修复）
      partialize: (state) => ({
        members: (state.members || []).map(({ password, ...rest }) => rest),
        loading: state.loading,
      }),
      merge: (persisted, current) => {
        const base = { ...current, ...persisted };
        if (Array.isArray(base.members)) {
          base.members = base.members.map(({ password, ...rest }) => rest);
        }
        return base;
      },
    }
  )
);
