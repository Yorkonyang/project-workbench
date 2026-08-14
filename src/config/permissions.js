// 权限角色配置
export const ROLES = {
  admin: {
    label: '管理员',
    description: '全部模块的完整操作权限',
    color: '#ef4444',
    permissions: [
      'project:view', 'project:create', 'project:edit', 'project:delete',
      'task:view', 'task:create', 'task:edit', 'task:delete', 'task:assign',
      'milestone:view', 'milestone:create', 'milestone:edit', 'milestone:delete',
      'document:view', 'document:create', 'document:edit', 'document:delete',
      'todo:view', 'todo:create', 'todo:edit', 'todo:delete',
      'risk:view', 'risk:create', 'risk:edit', 'risk:delete',
      'member:view', 'member:create', 'member:edit', 'member:delete',
      'reminder:config',
      'data:export', 'data:import', 'data:reset',
    ],
  },
  pm: {
    label: '项目经理',
    description: '管理所属项目的任务、里程碑、文档和风险',
    color: '#3b82f6',
    permissions: [
      'project:view', 'project:edit',
      'task:view', 'task:create', 'task:edit', 'task:delete', 'task:assign',
      'milestone:view', 'milestone:create', 'milestone:edit',
      'document:view', 'document:create', 'document:edit', 'document:delete',
      'todo:view', 'todo:create', 'todo:edit', 'todo:delete',
      'risk:view', 'risk:create', 'risk:edit',
      'member:view',
      'data:export',
    ],
  },
  member: {
    label: '项目成员',
    description: '查看项目信息，管理自己负责的任务和待办',
    color: '#14b8a6',
    permissions: [
      'project:view',
      'task:view', 'task:create', 'task:edit',
      'milestone:view',
      'document:view', 'document:create',
      'todo:view', 'todo:create', 'todo:edit', 'todo:delete',
      'risk:view',
      'member:view',
    ],
  },
  viewer: {
    label: '访客',
    description: '只读查看所有项目信息',
    color: '#6b7280',
    permissions: [
      'project:view',
      'task:view',
      'milestone:view',
      'document:view',
      'todo:view',
      'risk:view',
      'member:view',
    ],
  },
};

// 权限模块定义（用于权限矩阵展示）
export const PERMISSION_MODULES = [
  {
    key: 'project',
    label: '项目管理',
    permissions: [
      { key: 'view', label: '查看' },
      { key: 'create', label: '创建' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' },
    ],
  },
  {
    key: 'task',
    label: '任务管理',
    permissions: [
      { key: 'view', label: '查看' },
      { key: 'create', label: '创建' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' },
      { key: 'assign', label: '分配' },
    ],
  },
  {
    key: 'milestone',
    label: '里程碑',
    permissions: [
      { key: 'view', label: '查看' },
      { key: 'create', label: '创建' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' },
    ],
  },
  {
    key: 'document',
    label: '文档管理',
    permissions: [
      { key: 'view', label: '查看' },
      { key: 'create', label: '上传' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' },
    ],
  },
  {
    key: 'todo',
    label: '待办提醒',
    permissions: [
      { key: 'view', label: '查看' },
      { key: 'create', label: '创建' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' },
    ],
  },
  {
    key: 'risk',
    label: '风险管理',
    permissions: [
      { key: 'view', label: '查看' },
      { key: 'create', label: '创建' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' },
    ],
  },
  {
    key: 'member',
    label: '人员管理',
    permissions: [
      { key: 'view', label: '查看' },
      { key: 'create', label: '创建' },
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除' },
    ],
  },
  {
    key: 'data',
    label: '数据管理',
    permissions: [
      { key: 'export', label: '导出' },
      { key: 'import', label: '导入' },
      { key: 'reset', label: '重置' },
    ],
  },
  {
    key: 'reminder',
    label: '提醒配置',
    permissions: [
      { key: 'config', label: '配置' },
    ],
  },
];

// 检查角色是否拥有某权限
export function hasPermission(role, permission) {
  const roleConfig = ROLES[role];
  if (!roleConfig) return false;
  return roleConfig.permissions.includes(permission);
}
