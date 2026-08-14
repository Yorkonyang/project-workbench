import { useMemberStore } from '@/store/useMemberStore';
import { useAuthStore } from '@/store/useAuthStore';
import { hasPermission } from '@/config/permissions';

/**
 * 权限检查 Hook
 * 基于当前登录用户的角色判断是否有权执行某操作
 */
export function usePermissions() {
  const members = useMemberStore((s) => s.members);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = members.find((m) => m.id === currentUserId) || null;

  const can = (permission) => {
    // 未设置当前用户时，默认管理员权限（单人使用模式）
    if (!currentUser) return true;
    return hasPermission(currentUser.role, permission);
  };

  const isAdmin = currentUser?.role === 'admin';
  const isPM = currentUser?.role === 'pm';
  const isMember = currentUser?.role === 'member';
  const isViewer = currentUser?.role === 'viewer';

  return {
    currentUser,
    can,
    isAdmin,
    isPM,
    isMember,
    isViewer,
    roleLabel: currentUser?.role || 'admin',
  };
}
