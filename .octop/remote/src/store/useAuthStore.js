import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { hasPermission } from '@/config/permissions';
import { useMemberStore } from '@/store/useMemberStore';
import { apiClient } from '@/lib/apiClient';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUserId: null,
      isAuthenticated: false,
      loginError: null,

      // 邮箱+密码登录：后端校验成功后返回 userId 并种 HttpOnly 会话 cookie。
      // 直接使用后端返回的 userId 定位身份，不再依赖前端本地明文比对（H5 / 与 S1 配套）。
      login: async (email, password) => {
        try {
          const res = await apiClient.login(email, password);
          set({
            currentUserId: res.userId,
            isAuthenticated: true,
            loginError: null,
          });
          return true;
        } catch (err) {
          set({ loginError: err.message || '登录失败' });
          return false;
        }
      },

      logout: async () => {
        try {
          await apiClient.logout();
        } catch {
          // 登出接口失败不影响前端清会话
        }
        set({
          currentUserId: null,
          isAuthenticated: false,
          loginError: null,
        });
      },

      // S3：ssoTicket 不再持久化（凭证类令牌禁止落 localStorage），仅保留 email+时间戳审计字段
      ssoLogin: ({ userId, email }) => {
        set({
          currentUserId: userId,
          isAuthenticated: true,
          loginError: null,
          ssoEmail: email || null,
          ssoLoginAt: Date.now(),
        });
        return true;
      },

      clearSsoSession: () =>
        set({
          ssoEmail: null,
          ssoLoginAt: null,
        }),

      clearError: () => set({ loginError: null }),

      // 获取当前用户对象（需传入 members 数组）
      getCurrentUser: (members) => {
        const { currentUserId } = get();
        if (!currentUserId || !members) return null;
        return members.find((m) => m.id === currentUserId) || null;
      },

      // 获取当前用户（通过 members store）
      currentUser: () => {
        const { currentUserId } = get();
        if (!currentUserId) return null;
        const members = useMemberStore.getState().members;
        return members.find((m) => m.id === currentUserId) || null;
      },

      // 检查当前用户是否拥有某权限
      checkPermission: (members, permission) => {
        const user = get().getCurrentUser(members);
        if (!user) return false;
        return hasPermission(user.role, permission);
      },

      // 修改当前用户密码：交由后端 /auth/change-password 校验原密码 + 强制复杂度，
      // 前端不再持有/比对明文（S2）。返回 {success, error}。
      changePassword: async (oldPassword, newPassword) => {
        const { currentUserId } = get();
        if (!currentUserId) return { success: false, error: '未登录' };
        try {
          await apiClient.changePassword(oldPassword, newPassword);
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message || '修改失败' };
        }
      },

      // 管理员重置成员密码：调后端接口持久化（按 邮箱@前缀+Yj1018! 规则），成功后同步本地 store
      resetPassword: async (memberId) => {
        const members = useMemberStore.getState().members;
        const member = members.find((m) => m.id === memberId);
        if (!member || !member.email) return { success: false, error: '成员邮箱不存在' };

        try {
          // 调后端持久化（admin 鉴权），返回生成的新密码；本地不再缓存明文（由 fetchMembers 重新对齐）
          const res = await apiClient.resetMemberPassword(memberId);
          if (!res || !res.success) return { success: false, error: '重置失败' };
          return { success: true, password: res.password };
        } catch (err) {
          return { success: false, error: err.message || '重置失败' };
        }
      },
    }),
    {
      name: 'pw_auth',
      storage: createJSONStorage(() => localStorage),
      // S3：仅持久化身份态，剔除 ssoTicket（凭证类令牌，禁止落 localStorage）与 loginError（运行时态）
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        isAuthenticated: state.isAuthenticated,
        ssoEmail: state.ssoEmail,
        ssoLoginAt: state.ssoLoginAt,
      }),
    }
  )
);
