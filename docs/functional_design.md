# 项目工作台功能设计文档

> 生成时间：2026-08-13
> 版本：v1.0
> 状态：功能分析 & 问题修复规划

---

## 一、系统概述

### 1.1 项目定位

项目工作台（Project Workbench）是一个轻量级项目管理系统，面向中小企业和团队协作场景，提供项目、任务、待办、成员、通知、里程碑等核心功能。

### 1.2 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (React + Vite)                 │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Zustand    │  │ Tailwind │  │ react-router-dom │   │
│  │  Store      │  │  CSS     │  │    Routing       │   │
│  └─────────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Pages: Dashboard, Tasks, Todos, Projects...     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────┐
│                      后端 (Node.js)                      │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  simple-    │  │  qingflow│  │  db/             │   │
│  │  server.js  │  │  .js     │  │  index.js        │   │
│  └─────────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Routes: /api/projects, /api/tasks, /api/todos   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓ JSON
┌─────────────────────────────────────────────────────────┐
│                    数据存储 (JSON)                       │
│              data/workbench.db                           │
└─────────────────────────────────────────────────────────┘
```

### 1.3 项目目录结构

```
project-workbench/
├── src/
│   ├── pages/              # 页面组件
│   │   ├── DashboardPage.jsx
│   │   ├── TasksPage.jsx
│   │   ├── TodosPage.jsx
│   │   ├── ProjectsPage.jsx
│   │   ├── MembersPage.jsx
│   │   ├── NotificationsPage.jsx
│   │   └── ...
│   ├── components/
│   │   ├── tasks/          # 任务组件
│   │   ├── todos/          # 待办组件
│   │   ├── projects/       # 项目组件
│   │   ├── notifications/  # 通知组件
│   │   └── layout/         # 布局组件
│   ├── store/              # Zustand 状态管理
│   │   ├── useTaskStore.js
│   │   ├── useTodoStore.js
│   │   ├── useProjectStore.js
│   │   ├── useNotificationStore.js
│   │   └── ...
│   ├── hooks/
│   │   ├── useReminderEngine.js  # 提醒引擎
│   │   └── ...
│   └── lib/
│       ├── apiClient.js    # API 客户端
│       └── seedData.js     # 种子数据
├── server/
│   ├── simple-server.js    # 简化服务器（当前使用）
│   ├── qingflow.js         # 轻流集成
│   ├── db/
│   │   ├── index.js        # 数据库辅助
│   │   └── mockDatabase.js # Mock 数据库
│   └── init-db.js          # 数据库初始化脚本
└── data/
    └── workbench.db        # JSON 数据库文件
```

---

## 二、核心功能模块

### 2.1 项目管理

#### 功能描述
- 创建、编辑、删除项目
- 项目状态管理（active/archived）
- 项目列表视图与筛选

#### 数据模型
```javascript
{
  id: string,           // UUID
  name: string,         // 项目名称
  code: string,         // 项目编号
  description: string,
  status: 'active' | 'archived',
  archived: number,     // 0/1
  color: string,        // 项目颜色标识
  created_at: ISOString,
  updated_at: ISOString
}
```

#### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 获取所有项目 |
| POST | `/api/projects` | 创建项目 |
| PUT | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目 |
| GET | `/api/projects/:id` | 获取项目详情 |

#### 已知问题
- ❌ 部分项目对象缺少 `name` 和 `code` 字段，导致前端渲染报错
- ⚠️ 归档功能未在后端实现（缺少 archive 相关 API）

---

### 2.2 任务管理

#### 功能描述
- 创建、编辑、删除任务
- 任务看板视图与列表视图
- 任务状态流转（todo → in_progress → review → done）
- 任务优先级管理
- 任务关联项目

#### 数据模型
```javascript
{
  id: string,
  projectId: string,        // 关联项目
  title: string,
  description: string,
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked',
  priority: 'high' | 'medium' | 'low',
  assignee: string,         // 负责人ID
  startDate: string,        // YYYY-MM-DD
  dueDate: string,          // YYYY-MM-DD
  tags: string[],
  created_at: ISOString,
  updated_at: ISOString
}
```

#### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:projectId/tasks` | 获取项目任务列表 |
| POST | `/api/projects/:projectId/tasks` | 创建任务 |
| PUT | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |

#### 已知问题
- 🔴 **严重**：前端 `TaskForm.jsx` 调用 `addTask(projectId, data)`，但 `useTaskStore.addTask` 只接收 `data` 一个参数
- 🔴 **严重**：后端缺少 `GET /api/tasks` 端点，所有任务无法在前端加载
- 🟡 **中**：`App.jsx` 启动时未调用 `fetchTasks()`，任务数据不会自动加载
- 🟢 **已修复**：任务字段名不一致（`project_id` vs `projectId`）需要统一

---

### 2.3 待办事项管理

#### 功能描述
- 创建、编辑、删除待办事项
- 待办提醒配置（提前几天提醒）
- 逾期催办机制
- 待办关联项目（可选）

#### 数据模型
```javascript
{
  id: string,
  title: string,
  description: string,
  completed: boolean,
  completed_at: ISOString | null,
  priority: 'urgent' | 'high' | 'medium' | 'low',
  dueDate: string,          // YYYY-MM-DD
  assignee: string,         // 负责人姓名
  projectId: string | null, // 关联项目（可选）
  remind_days: number,      // 提前提醒天数（默认3）
  enable_escalation: boolean, // 是否启用催办
  created_at: ISOString,
  updated_at: ISOString
}
```

#### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/todos` | 获取所有待办 |
| POST | `/api/todos` | 创建待办 |
| PUT | `/api/todos/:id` | 更新待办 |
| DELETE | `/api/todos/:id` | 删除待办 |

---

### 2.4 通知系统

#### 功能描述
- 站内通知中心
- 到期前提醒（pre_due）
- 到期当天提醒（due）
- 逾期提醒（overdue）
- 催办提醒（escalation）
- 里程碑提醒（milestone）
- 浏览器桌面通知（需授权）

#### 通知类型
| 类型 | 说明 | 触发条件 |
|------|------|----------|
| `pre_due` | 到期前提醒 | 提前 N 天（配置：7, 3, 1天） |
| `due` | 到期当天 | 当天到期 |
| `overdue` | 逾期提醒 | 逾期第1天 |
| `escalation` | 催办提醒 | 逾期超过阈值，按间隔催办 |
| `milestone` | 里程碑提醒 | 里程碑即将到达/已到达/逾期 |

#### 数据模型
```javascript
{
  id: string,
  user_id: string,        // 接收人ID
  title: string,
  message: string,
  type: string,           // 通知类型
  relatedId: string,      // 关联对象ID
  relatedType: string,    // 关联对象类型（task/todo/milestone）
  link: string,           // 跳转链接
  read: boolean,
  created_at: ISOString
}
```

#### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notifications?userId=:id` | 获取用户通知列表 |
| POST | `/api/notifications` | 创建通知 |

#### 提醒引擎配置
```javascript
{
  preDueDays: [7, 3, 1],        // 提前提醒天数
  enableDueDay: true,           // 启用到期当天提醒
  enableOverdue: true,          // 启用逾期提醒
  escalationDays: 3,            // 逾期几天后开始催办
  escalationInterval: 2,        // 催办间隔（天）
  checkIntervalSec: 60,         // 检查间隔（秒）
  enableBrowserNotif: false,    // 启用浏览器桌面通知
  enableSound: false,           // 启用声音提醒
  milestonePreDays: [14, 7, 3, 1], // 里程碑提前提醒
  dailyCheckHour: 8             // 每日检查时间（小时）
}
```

#### 去重机制
- 使用 `relatedId + relatedType` 作为唯一标识
- 未读通知才会重复生成
- 同一任务同类型通知只保留一条

---

### 2.5 成员管理

#### 功能描述
- 添加、编辑、删除团队成员
- 成员角色管理（admin/member）
- 成员头像与颜色标识

#### 数据模型
```javascript
{
  id: string,
  name: string,
  email: string,
  role: 'admin' | 'member',
  avatar_color: string,
  created_at: ISOString
}
```

#### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/members` | 获取所有成员 |
| POST | `/api/members` | 创建成员 |

---

### 2.6 轻流集成

#### 功能描述
- 创建任务时推送企微通知
- 创建待办时推送企微通知
- 轻流表单数据收集

#### API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/qingflow/config` | 获取轻流配置 |
| POST | `/api/qingflow/config` | 更新轻流配置 |
| GET | `/api/qingflow/test` | 测试轻流连接 |
| POST | `/api/qingflow/form-data` | 提交表单数据 |

---

## 三、问题汇总与修复优先级

### 🔴 严重问题（影响核心功能）

| ID | 问题描述 | 影响范围 | 状态 |
|----|----------|----------|------|
| P0-1 | 后端缺少 `GET /api/tasks` 端点 | 任务列表无法加载 | 🔴 待修复 |
| P0-2 | `TaskForm.jsx` 调用参数与 `addTask` 签名不匹配 | 新建任务失败 | 🔴 待修复 |
| P0-3 | `App.jsx` 启动时未调用 `fetchTasks()` | 任务数据不加载 | 🔴 待修复 |

### 🟡 中等问题（影响用户体验）

| ID | 问题描述 | 影响范围 | 状态 |
|----|----------|----------|------|
| P1-1 | 部分项目缺少 `name`/`code` 字段 | 左侧导航报错 | ✅ 已修复 |
| P1-2 | 通知无 `user_id` 字段 | 通知中心为空 | ✅ 已修复 |
| P1-3 | Vite 仅监听 IPv6 | 前端页面无法访问 | ✅ 已修复 |
| P1-4 | Modal 缺少提交按钮 | 表单无法提交 | ✅ 已修复 |

### 🟢 待优化项

| ID | 问题描述 | 建议 |
|----|----------|------|
| P2-1 | 任务字段名不一致（`project_id` vs `projectId`） | 统一使用 `projectId` |
| P2-2 | 归档功能未实现 | 添加 `POST /api/projects/:id/archive` |
| P2-3 | 缺少 `GET /api/tasks` 端点 | 添加获取所有任务的接口 |
| P2-4 | 通知类型枚举不完整 | 补充 `pre_due`, `due`, `overdue`, `escalation` |

---

## 四、修复计划

### 第一阶段：核心功能修复

#### 4.1 后端 API 修复

**文件：** `server/simple-server.js`

```javascript
// 添加任务列表端点
if (pathname === '/api/tasks' && method === 'GET') {
    const data = loadData();
    sendResponse(res, 200, data.tasks);
    return;
}

// 添加项目归档端点
if (pathname.match(/\/api\/projects\/[\w-]+\/archive/) && method === 'POST') {
    const id = pathname.split('/')[3];
    const data = loadData();
    const index = data.projects.findIndex(p => p.id === id);
    if (index !== -1) {
        data.projects[index].archived = 1;
        data.projects[index].status = 'archived';
        data.projects[index].updated_at = new Date().toISOString();
        saveData(data);
        sendResponse(res, 200, data.projects[index]);
    } else {
        sendResponse(res, 404, { error: 'Project not found' });
    }
    return;
}
```

#### 4.2 前端任务创建修复

**文件：** `src/components/tasks/TaskForm.jsx`

```javascript
const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    if (task) {
        updateTask(task.id, { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean), updatedAt: now });
    } else {
        // 修复：传递 projectId 参数
        addTask(form.projectId, { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean), createdAt: now, updatedAt: now });
    }
    onClose();
};
```

#### 4.3 前端启动加载修复

**文件：** `src/App.jsx`

```javascript
async function loadFromApi() {
    try {
        const [projects, todos, members, tasks] = await Promise.all([
            fetchProjects(),
            fetchTodos(),
            fetchMembers(),
            useTaskStore.getState().fetchTasks(), // 添加任务加载
        ]);
        // ...
    } catch (err) {
        console.error('[App] Failed to load from API:', err);
    }
}
```

---

## 五、后续规划

### 5.1 短期优化（1-2周）

- [ ] 修复所有 P0 级别问题
- [ ] 统一字段命名规范（`project_id` → `projectId`）
- [ ] 完善通知类型枚举
- [ ] 添加项目归档功能
- [ ] 后端单元测试

### 5.2 中期功能（1个月）

- [ ] 添加里程碑管理
- [ ] 添加风险管理
- [ ] 添加资源分配
- [ ] 添加甘特图视图
- [ ] 添加文档管理
- [ ] 用户权限管理

### 5.3 长期规划（3个月）

- [ ] 数据库迁移到 SQLite/PostgreSQL
- [ ] WebSocket 实时通知
- [ ] 企业微信/钉钉集成
- [ ] 移动端适配
- [ ] 数据导出功能

---

## 六、附录

### 6.1 环境变量

```bash
# .env
PORT=3000
VITE_API_URL=http://localhost:3000/api
DB_PATH=data/workbench.db

# 轻流配置（可选）
QINGFLOW_APP_TOKEN=your_token
QINGFLOW_FORM_ID=your_form_id
QINGFLOW_FORM_URL=https://your-subdomain.qingflow.com/fill/xxx
```

### 6.2 依赖清单

**前端：**
- React 18
- Vite
- Zustand
- Tailwind CSS
- React Router DOM
- date-fns
- Lucide React

**后端：**
- Node.js built-in (http, fs, path, crypto)
- Express (可选，当前使用原生 http)

### 6.3 数据库 Schema

```sql
-- 项目表
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    archived INTEGER DEFAULT 0,
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 任务表
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assignee TEXT,
    start_date TEXT,
    due_date TEXT,
    tags TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 待办表
CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    assignee TEXT,
    project_id TEXT,
    remind_days INTEGER DEFAULT 3,
    enable_escalation INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 成员表
CREATE TABLE members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'member',
    avatar_color TEXT,
    created_at TEXT NOT NULL
);

-- 通知表
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT NOT NULL,
    related_id TEXT,
    related_type TEXT,
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_todos_project ON todos(project_id);
```

---

*文档结束*
