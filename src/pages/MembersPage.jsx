import { useState, useMemo } from 'react';
import { Plus, Users, UserCircle, Shield } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MemberCard from '@/components/members/MemberCard';
import MemberForm from '@/components/members/MemberForm';
import PermissionMatrix from '@/components/members/PermissionMatrix';
import { useMemberStore } from '@/store/useMemberStore';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { ROLES } from '@/config/permissions';

export default function MembersPage() {
  const members = useMemberStore((s) => s.members);
  const deleteMember = useMemberStore((s) => s.deleteMember);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUserRole = useMemberStore((s) => s.members.find((m) => m.id === currentUserId)?.role);
  const { can } = usePermissions();

  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);

  const canManage = can('member:create') && can('member:edit');
  const isAdmin = currentUserRole === 'admin';

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter && m.role !== roleFilter) return false;
      return true;
    });
  }, [members, roleFilter]);

  const stats = useMemo(() => ({
    total: members.length,
    admin: members.filter((m) => m.role === 'admin').length,
    pm: members.filter((m) => m.role === 'pm').length,
    member: members.filter((m) => m.role === 'member').length,
    viewer: members.filter((m) => m.role === 'viewer').length,
  }), [members]);

  const handleEdit = (member) => {
    setEditingMember(member);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingMember(null);
  };

  const handleResetPassword = (member) => {
    setResetTarget(member);
  };

  const confirmResetPassword = () => {
    if (!resetTarget) return;
    const result = resetPassword(resetTarget.id);
    if (result.success) {
      setResetResult({ member: resetTarget, password: result.password });
    } else {
      alert(result.error || '重置失败');
    }
    setResetTarget(null);
  };

  return (
    <PageContainer>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger-children">
        <StatCard icon={Users} label="成员总数" value={stats.total} color="#6366F1" />
        <StatCard icon={Shield} label="管理员" value={stats.admin} color="#DC2626" />
        <StatCard icon={UserCircle} label="项目经理" value={stats.pm} color="#8B5CF6" />
        <StatCard icon={UserCircle} label="项目成员" value={stats.member + stats.viewer} color="#0D9488" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder="全部角色"
            options={[
              { value: '', label: '全部角色' },
              ...Object.entries(ROLES).map(([key, val]) => ({
                value: key,
                label: val.label,
              })),
            ]}
            className="w-36"
          />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            添加成员
          </Button>
        )}
      </div>

      {/* Member Grid */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          title="暂无成员"
          description={canManage ? '点击「添加成员」开始管理项目团队' : '请联系管理员添加成员'}
          actionLabel={canManage ? '添加成员' : undefined}
          onAction={canManage ? () => setShowForm(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 stagger-children">
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onResetPassword={handleResetPassword}
              canManage={canManage}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Permission Matrix */}
      <PermissionMatrix />

      {/* Forms */}
      {showForm && (
        <MemberForm
          key={editingMember ? `edit-${editingMember.id}` : 'add'}
          member={editingMember}
          onClose={handleCloseForm}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除成员"
          message={`确定要删除成员「${deleteTarget.name}」吗？此操作不可撤销。`}
          onConfirm={() => {
            deleteMember(deleteTarget.id);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {resetTarget && (
        <ConfirmDialog
          title="重置密码"
          message={`确定要重置成员「${resetTarget.name}」的密码吗？重置后密码将变为：${resetTarget.email.split('@')[0]}123`}
          onConfirm={confirmResetPassword}
          onClose={() => setResetTarget(null)}
        />
      )}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setResetResult(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-fade-in-up">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                <Users className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">密码重置成功</h3>
              <p className="text-xs text-slate-500 mb-3">
                成员「{resetResult.member.name}」的新密码为：
              </p>
              <div className="px-4 py-2.5 bg-slate-50 rounded-lg font-mono text-sm font-bold text-slate-800 border border-slate-200">
                {resetResult.password}
              </div>
              <p className="text-xs text-amber-600 mt-3">
                请将密码告知该成员，登录后可自行修改
              </p>
              <button
                onClick={() => setResetResult(null)}
                className="mt-4 w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-smooth"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
