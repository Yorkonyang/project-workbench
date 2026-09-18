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
    // 未设置当前用户（成员未加载完成 / 未登录）时默认拒绝（fail-closed），
    // 与 useAccess.js 语义一致；加载期间由调用方用 loading 态兜底，避免越权 UI 暴露。
    if (!currentUser) return false;
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
