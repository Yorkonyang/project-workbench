import { Mail, Phone, Building2, Briefcase, KeyRound } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { ROLES } from '@/config/permissions';
import { useProjectStore } from '@/store/useProjectStore';
import { useAuthStore } from '@/store/useAuthStore';

export default function MemberCard({ member, onEdit, onDelete, onResetPassword, canManage, isAdmin, deptColor }) {
  const projects = useProjectStore((s) => s.projects);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const isCurrentUser = currentUserId === member.id;
  const roleConfig = ROLES[member.role] || ROLES.member;
  const memberProjects = projects.filter((p) => member.projectIds?.includes(p.id));
  const canReset = isAdmin && onResetPassword && !isCurrentUser;

  // 头像颜色：优先用部门颜色，其次用成员自己的颜色，最后灰色兜底
  const avatarBg = deptColor || member.avatarColor || '#6b7280';

  return (
    <div className={`bg-white rounded-lg border p-4 transition-all hover:shadow-md ${isCurrentUser ? 'border-primary-300 ring-1 ring-primary-200' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ backgroundColor: avatarBg }}
        >
          {member.name?.charAt(0) || '?'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-800">{member.name}</h4>
            {isCurrentUser && (
              <span className="text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">当前用户</span>
            )}
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${roleConfig.color}15`,
                color: roleConfig.color,
              }}
            >
              {roleConfig.label}
            </span>
          </div>

          <div className="mt-2 space-y-1">
            {member.department && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Building2 className="w-3 h-3" />
                {member.department}
                {member.title && <span>· {member.title}</span>}
              </div>
            )}
            {member.email && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Mail className="w-3 h-3" />
                {member.email}
              </div>
            )}
            {member.phone && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Phone className="w-3 h-3" />
                {member.phone}
              </div>
            )}
          </div>

          {/* 参与项目 */}
          {memberProjects.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {memberProjects.map((p) => (
                <span key={p.id} className="text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.code}
                </span>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          {canManage && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                onClick={() => onEdit(member)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                编辑
              </button>
              {canReset && (
                <>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => onResetPassword(member)}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    重置密码
                  </button>
                </>
              )}
              <span className="text-slate-300">|</span>
              <button
                onClick={() => onDelete(member)}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
