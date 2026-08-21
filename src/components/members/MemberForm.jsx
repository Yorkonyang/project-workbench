import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useMemberStore } from '@/store/useMemberStore';
import { useOrgStore } from '@/store/useOrgStore';
import { useProjectStore } from '@/store/useProjectStore';
import { ROLES } from '@/config/permissions';
import { AVATAR_COLORS } from '@/config/theme';

export default function MemberForm({ onClose, member = null }) {
  const projects = useProjectStore((s) => s.projects);
  const departments = useOrgStore((s) => s.departments);
  const allDepts = useOrgStore((s) => s.getAllDepartments());
  const addMember = useMemberStore((s) => s.addMember);
  const updateMember = useMemberStore((s) => s.updateMember);

  const [form, setForm] = useState(() => {
    // 新建成员：清空所有字段；编辑成员：带入现有数据
    if (!member) {
      return {
        name: '',
        role: 'member',
        departmentId: '',
        email: '',
        password: '',
        phone: '',
        title: '',
        projectIds: [],
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      };
    }
    return {
      name: member.name || '',
      role: member.role || 'member',
      departmentId: member.departmentId || '',
      email: member.email || '',
      password: member.password || '',
      phone: member.phone || '',
      title: member.title || '',
      projectIds: member.projectIds || [],
      avatarColor: member.avatarColor || AVATAR_COLORS[0],
    };
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (!form.email.trim()) return;
    if (!member && !form.password.trim()) return;
    const payload = {
      ...form,
      department: form.departmentId, // 兼容旧字段
    };
    if (member) {
      updateMember(member.id, payload);
    } else {
      addMember(payload);
    }
    onClose();
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleProject = (pid) => {
    setForm((f) => ({
      ...f,
      projectIds: f.projectIds.includes(pid)
        ? f.projectIds.filter((id) => id !== pid)
        : [...f.projectIds, pid],
    }));
  };

  return (
    <Modal
      title={member ? '编辑成员' : '添加成员'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.email.trim() || (!member && !form.password.trim())}>
            {member ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="姓名 *"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            placeholder="请输入成员姓名"
          />
          <Select
            label="角色"
            value={form.role}
            onChange={set('role')}
            options={Object.entries(ROLES).map(([key, val]) => ({
              value: key,
              label: val.label,
            }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="所属部门"
            value={form.departmentId}
            onChange={set('departmentId')}
            options={[
              { value: '', label: '未分配部门' },
              ...allDepts.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <Input
            label="职务"
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
            placeholder="如：开发工程师"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="邮箱 *"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            placeholder="name@company.com"
          />
          <Input
            label={member ? '密码（留空不修改）' : '密码 *'}
            type="password"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
            placeholder={member ? '输入新密码可修改' : '请设置登录密码'}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="手机号"
            value={form.phone}
            onChange={(e) => set('phone')(e.target.value)}
            placeholder="13800138000"
          />
        </div>

        {/* 参与项目 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">参与项目</label>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-400 italic">暂无项目，请先在「项目管理」中创建项目</p>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProject(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.projectIds.includes(p.id)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-primary-400'
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color || '#6366f1' }} />
                  {p.name || p.title || '未命名项目'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 头像颜色 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">头像颜色</label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => set('avatarColor')(color)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  form.avatarColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* 角色说明 */}
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">
            <span className="font-medium" style={{ color: ROLES[form.role]?.color }}>
              {ROLES[form.role]?.label}
            </span>
            ：{ROLES[form.role]?.description}
          </p>
        </div>
      </div>
    </Modal>
  );
}
