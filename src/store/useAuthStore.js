import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { hasPermission } from '@/config/permissions';
import { useMemberStore } from '@/store/useMemberStore';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUserId: null,
      isAuthenticated: false,
      loginError: null,

      // 邮箱+密码登录
      login: (email, password) => {
        const members = useMemberStore.getState().members;
        const member = members.find(
          (m) => m.email === email && m.password === password
        );
        if (!member) {
          set({ loginError: '邮箱或密码错误' });
          return false;
        }
        set({
          currentUserId: member.id,
          isAuthenticated: true,
          loginError: null,
        });
        return true;
      },

      logout: () =>
        set({
          currentUserId: null,
          isAuthenticated: false,
          loginError: null,
        }),

      // SSO 单点登录：轻流通知链接（HMAC 签名）兑换 ticket 后直接登入，
      // 不走邮箱密码比对。ssoTicket 存 localStorage 仅用于审计/续期，正常请求仍走 x-user-id。
      ssoLogin: ({ userId, email, ssoTicket }) => {
        set({
          currentUserId: userId,
          isAuthenticated: true,
          loginError: null,
          ssoEmail: email || null,
          ssoTicket: ssoTicket || null,
          ssoLoginAt: Date.now(),
        });
        return true;
      },

      clearSsoSession: () =>
        set({
          ssoEmail: null,
          ssoTicket: null,
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

      // 修改当前用户密码：先验证原密码，正确后更新
      changePassword: (oldPassword, newPassword) => {
        const { currentUserId } = get();
        if (!currentUserId) return { success: false, error: '未登录' };

        const members = useMemberStore.getState().members;
        const member = members.find((m) => m.id === currentUserId);
        if (!member) return { success: false, error: '用户不存在' };

        if (member.password !== oldPassword) {
          return { success: false, error: '原密码错误' };
        }

        useMemberStore.getState().updateMember(currentUserId, { password: newPassword });
        return { success: true };
      },

      // 管理员重置成员密码：规则为邮箱@前字母+123
      resetPassword: (memberId) => {
        const members = useMemberStore.getState().members;
        const member = members.find((m) => m.id === memberId);
        if (!member || !member.email) return { success: false, error: '成员邮箱不存在' };

        const prefix = member.email.split('@')[0];
        const newPwd = `${prefix}123`;
        useMemberStore.getState().updateMember(memberId, { password: newPwd });
        return { success: true, password: newPwd };
      },
    }),
    {
      name: 'pw_auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
