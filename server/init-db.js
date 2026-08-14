/**
 * Initialize backend database with seed data
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/workbench.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Read or create database
let db = {};
if (fs.existsSync(DB_PATH)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    console.error('Failed to read database:', e.message);
    db = {};
  }
}

// Seed data
const now = new Date().toISOString();
const today = new Date();
const todayISO = today.toISOString().split('T')[0];
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowISO = tomorrow.toISOString().split('T')[0];
const nextWeek = new Date(today);
nextWeek.setDate(nextWeek.getDate() + 7);
const nextWeekISO = nextWeek.toISOString().split('T')[0];

const SEED_DATA = {
  members: [
    {
      id: 'mem_1',
      name: '信息化总监',
      role: 'admin',
      department: '信息化中心',
      title: '信息化总监',
      email: 'cio@example.com',
      password: 'admin123',
      phone: '',
      projectIds: ['proj_mom', 'proj_erp'],
      avatarColor: '#ef4444',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem_2',
      name: '王工',
      role: 'pm',
      department: '信息化中心',
      title: 'MOM 项目经理',
      email: 'wang@example.com',
      password: 'wang123',
      phone: '',
      projectIds: ['proj_mom'],
      avatarColor: '#3b82f6',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem_3',
      name: '吴工',
      role: 'pm',
      department: '信息化中心',
      title: 'ERP 项目经理',
      email: 'wu@example.com',
      password: 'wu123',
      phone: '',
      projectIds: ['proj_erp'],
      avatarColor: '#14b8a6',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem_4',
      name: '李工',
      role: 'member',
      department: '开发部',
      title: '后端开发工程师',
      email: 'li@example.com',
      password: 'li123',
      phone: '',
      projectIds: ['proj_mom'],
      avatarColor: '#8b5cf6',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem_5',
      name: '张工',
      role: 'member',
      department: '开发部',
      title: '系统设计工程师',
      email: 'zhang@example.com',
      password: 'zhang123',
      phone: '',
      projectIds: ['proj_mom'],
      avatarColor: '#f59e0b',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem_6',
      name: '郑工',
      role: 'member',
      department: '财务部',
      title: '成本核算专员',
      email: 'zheng@example.com',
      password: 'zheng123',
      phone: '',
      projectIds: ['proj_erp'],
      avatarColor: '#ec4899',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem_7',
      name: '赵工',
      role: 'member',
      department: '开发部',
      title: '前端开发工程师',
      email: 'zhao@example.com',
      password: 'zhao123',
      phone: '',
      projectIds: ['proj_mom', 'proj_erp'],
      avatarColor: '#06b6d4',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'mem_8',
      name: '孙工',
      role: 'viewer',
      department: '生产部',
      title: '关键用户',
      email: 'sun@example.com',
      password: 'sun123',
      phone: '',
      projectIds: ['proj_mom'],
      avatarColor: '#84cc16',
      createdAt: now,
      updatedAt: now,
    },
  ],
  todos: [
    {
      id: 'todo_1',
      title: '审批 MOM 二期开发计划',
      description: '需要在今日完成审批并反馈给开发团队',
      dueDate: todayISO,
      priority: 'urgent',
      completed: false,
      completedAt: null,
      projectId: 'proj_mom',
      remindAt: `${todayISO}T09:00:00`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'todo_2',
      title: '确认 ERP 数据迁移范围',
      description: '与各业务部门确认历史数据迁移范围和截止时间',
      dueDate: todayISO,
      priority: 'high',
      completed: false,
      completedAt: null,
      projectId: 'proj_erp',
      remindAt: `${todayISO}T14:00:00`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'todo_3',
      title: '审核 MOM-ERP 接口规范文档',
      description: '审核接口规范文档，重点关注数据一致性和异常处理',
      dueDate: tomorrowISO,
      priority: 'high',
      completed: false,
      completedAt: null,
      projectId: 'proj_mom',
      remindAt: `${tomorrowISO}T09:00:00`,
      createdAt: now,
      updatedAt: now,
    },
  ],
  notifications: [
    {
      id: 'notif_1',
      userId: 'mem_1',
      type: 'task_reminder',
      title: '任务提醒',
      message: '您有 3 个任务即将到期',
      read: false,
      createdAt: now,
    },
    {
      id: 'notif_2',
      userId: 'mem_1',
      type: 'project_update',
      title: '项目更新',
      message: 'MOM 项目状态已更新',
      read: true,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  projects: [
    {
      name: '测试项目A',
      description: '这是测试项目',
      id: '9d1ae1fd-e76d-40e7-acb1-7a010a477748',
      status: 'active',
      archived: 0,
      created_at: now,
      updated_at: now,
    },
  ],
  tasks: [],
  documents: [],
  risks: [],
  resources: [],
  milestones: [],
};

// Update database
db.members = SEED_DATA.members;
db.todos = SEED_DATA.todos;
db.notifications = SEED_DATA.notifications;

// Keep existing projects if they exist
if (!db.projects || db.projects.length === 0) {
  db.projects = SEED_DATA.projects;
}

// Write to database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

console.log('✅ Database initialized successfully!');
console.log('📊 Database stats:');
console.log('  - Members:', db.members.length);
console.log('  - Projects:', db.projects.length);
console.log('  - Todos:', db.todos.length);
console.log('  - Notifications:', db.notifications.length);
console.log('\n🔐 Default login credentials:');
console.log('  Email: cio@example.com');
console.log('  Password: admin123');
