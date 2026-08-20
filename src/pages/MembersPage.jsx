import { useState, useMemo, useEffect } from 'react';
import { Plus, Users, UserCircle, Shield, Building2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MemberCard from '@/components/members/MemberCard';
import MemberForm from '@/components/members/MemberForm';
import OrganizationTree from '@/components/organization/OrganizationTree';
import { useMemberStore } from '@/store/useMemberStore';
import { useOrgStore } from '@/store/useOrgStore';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { ROLES } from '@/config/permissions';

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'organization'

  const members = useMemberStore((s) => s.members);
  const deleteMember = useMemberStore((s) => s.deleteMember);
  const departments = useOrgStore((s) => s.departments);
  const fetchDepartments = useOrgStore((s) => s.fetchDepartments);
  const allDepts = useOrgStore((s) => s.getAllDepartments());
  const getDeptName = useOrgStore((s) => s.getDeptName);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUserRole = useMemberStore((s) => s.members.find((m) => m.id === currentUserId)?.role);
  const { can } = usePermissions();

  // 注册全局刷新函数供 sync 调用
  useEffect(() => {
    window.__refreshMembers = () => useMemberStore.getState().fetchMembers();
    return () => { delete window.__refreshMembers; };
  }, []);

  // 加载组织架构数据
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  // 仅用于「组织架构 Tab」内部，与「成员管理 Tab」的 deptFilter 完全独立
  const [orgSelectedDeptId, setOrgSelectedDeptId] = useState(null);

  const canManage = can('member:create') && can('member:edit');
  const isAdmin = currentUserRole === 'admin';

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter && m.role !== roleFilter) return false;
      if (deptFilter && m.departmentId !== deptFilter) return false;
      return true;
    });
  }, [members, roleFilter, deptFilter]);

  // 收集指定部门及其所有子部门的 ID（含直属）
  const collectDeptIds = (rootId, allDepts) => {
    const ids = new Set([rootId]);
    const queue = [rootId];
    // 构建 parentId -> children 索引
    const byParent = new Map();
    allDepts.forEach((d) => {
      const key = d.parentId || '_root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(d);
    });
    while (queue.length) {
      const cur = queue.shift();
      const kids = byParent.get(cur) || [];
      kids.forEach((k) => {
        if (!ids.has(k.id)) {
          ids.add(k.id);
          queue.push(k.id);
        }
      });
    }
    return ids;
  };

  // 组织架构 Tab 选中部门时的成员汇总（含子部门）
  const orgSelectedMembers = useMemo(() => {
    if (!orgSelectedDeptId) return [];
    const ids = collectDeptIds(orgSelectedDeptId, allDepts);
    return members.filter((m) => ids.has(m.departmentId));
  }, [orgSelectedDeptId, allDepts, members]);

  const orgSelectedDeptInfo = useMemo(() => {
    if (!orgSelectedDeptId) return null;
    const target = allDepts.find((d) => d.id === orgSelectedDeptId);
    if (!target) return null;
    const ids = collectDeptIds(orgSelectedDeptId, allDepts);
    return {
      name: target.name,
      deptCount: ids.size,
      childIds: Array.from(ids).filter((id) => id !== orgSelectedDeptId),
    };
  }, [orgSelectedDeptId, allDepts]);

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
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 bg-slate-100 p-0.5 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-smooth flex items-center gap-2',
            activeTab === 'members'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Users className="w-4 h-4" />
          成员管理
        </button>
        <button
          onClick={() => setActiveTab('organization')}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-smooth flex items-center gap-2',
            activeTab === 'organization'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Building2 className="w-4 h-4" />
          组织架构
        </button>
      </div>

      {/* ===== 成员管理 Tab ===== */}
      {activeTab === 'members' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger-children">
            <StatCard icon={Users} label="成员总数" value={stats.total} color="#6366F1" />
            <StatCard icon={Shield} label="管理员" value={stats.admin} color="#DC2626" />
            <StatCard icon={UserCircle} label="项目经理" value={stats.pm} color="#8B5CF6" />
            <StatCard icon={UserCircle} label="项目成员" value={stats.member + stats.viewer} color="#0D9488" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: '', label: '全部角色' },
                  ...Object.entries(ROLES).map(([key, val]) => ({
                    value: key,
                    label: val.label,
                  })),
                ]}
                className="w-36"
              />
              <Select
                value={deptFilter}
                onChange={setDeptFilter}
                options={[
                  { value: '', label: '全部部门' },
                  ...allDepts.map((d) => ({ value: d.id, label: d.name })),
                ]}
                className="w-40"
              />
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" />
                添加成员
              </Button>
            )}
          </div>

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
                  member={{
                    ...member,
                    department: member.departmentId ? getDeptName(member.departmentId) : member.department,
                  }}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                  onResetPassword={handleResetPassword}
                  canManage={canManage}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== 组织架构 Tab ===== */}
      {activeTab === 'organization' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                组织架构
              </h3>
              <OrganizationTree
                onSelectDept={setOrgSelectedDeptId}
                selectedDeptId={orgSelectedDeptId}
              />
            </div>
            <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-green-500" />
                {orgSelectedDeptId ? `部门：${getDeptName(orgSelectedDeptId)}` : '所有成员'}
              </h3>
              {orgSelectedDeptId ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 flex items-center gap-2 px-1">
                    <span>直属 + 子部门成员合计 <span className="font-semibold text-slate-700">{orgSelectedMembers.length}</span> 人</span>
                    {orgSelectedDeptInfo && orgSelectedDeptInfo.childIds.length > 0 && (
                      <span className="text-slate-400">（含 {orgSelectedDeptInfo.childIds.length} 个子部门）</span>
                    )}
                  </div>
                  {orgSelectedMembers.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">该部门及子部门暂无成员</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
                      {orgSelectedMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: m.avatarColor || '#6366f1' }}
                          >
                            {m.name?.charAt(0) || '？'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                            <p className="text-xs text-slate-400 truncate">
                              {m.departmentId ? getDeptName(m.departmentId) : '未分配'}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">{m.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-500">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>点击左侧组织架构中的部门，查看该部门及其子部门所有成员</p>
                  <p className="text-xs mt-1 text-slate-400">也可在「成员管理」Tab中通过部门筛选</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
