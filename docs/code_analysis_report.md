# 项目工作台代码分析报告

## 一、项目概述

**项目工作台 (project-workbench)** 是一个基于 React + Node.js 的项目管理系统，支持：
- 项目管理（增删改查、归档）
- 任务管理（Tasks - 关联项目的结构化任务）
- 待办事项（Todos - 个人待办清单）
- 成员管理
- 通知中心
- 里程碑与甘特图
- 风险管理与资源分配

**技术栈：**
| 层 | 技术 |
|---|------|
| 前端框架 | React 18 + Vite |
| 状态管理 | Zustand (持久化到 localStorage) |
| UI样式 | Tailwind CSS |
| 后端运行 | Express.js |
| 数据库 | better-sqlite3 (生产) / JSON文件 (演示) |

---

## 二、任务(Tasks)创建流程

### 2.1 前端调用链

```
用户操作 → TaskForm.jsx → useTaskStore.addTask() → apiClient.createTask() → POST /api/projects/:projectId/tasks
```

**关键文件：**
- `src/components/tasks/TaskForm.jsx` — 任务表单（标题、描述、负责人、优先级、截止日期、标签）
- `src/store/useTaskStore.js` — 状态管理，调用 `apiClient.createTask(projectId, data)`
- `src/lib/apiClient.js` — HTTP客户端封装

**表单字段：**
```javascript
{
  projectId: string,
  title: string,
  description: string,
  assignee: string,      // 成员ID
  priority: 'high'|'medium'|'low',
  status: 'todo'|'in_progress'|'review'|'done',
  startDate: string,
  dueDate: string,
  tags: string[]         // 逗号分隔
}
```

### 2.2 后端API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/projects/:projectId/tasks` | 创建任务 |
| PUT | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/projects/:projectId/tasks` | 获取项目任务列表 |

**后端处理逻辑 (`server/db/mockDatabase.js`):**
```javascript
createTask(task) {
  const newTask = {
    ...task,
    id: uuid.v4(),
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    created_at: ISO时间戳,
    updated_at: ISO时间戳
  };
  this.data.tasks.push(newTask);
  this.save();  // 写入 JSON 文件
  return newTask;
}
```

---

## 三、待办(Todos)创建流程

### 3.1 前端调用链

```
用户操作 → TodoForm.jsx → useTodoStore.addTodo() → apiClient.createTodo() → POST /api/todos
```

**关键文件：**
- `src/components/todos/TodoForm.jsx` — 待办表单（支持提醒配置）
- `src/store/useTodoStore.js` — 状态管理
- `src/lib/apiClient.js` — API调用

**表单字段：**
```javascript
{
  title: string,
  description: string,
  dueDate: string,
  priority: 'urgent'|'high'|'medium'|'low',
  projectId: string|null,    // 关联项目
  assignee: string|null,     // 负责人姓名
  remindAt: string|null,     // 指定提醒时间 ISO格式
  remindDays: number,        // 提前几天提醒 (默认3)
  enableEscalation: boolean  // 逾期后是否自动催办
}
```

### 3.2 后端API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/todos` | 创建待办 |
| PUT | `/api/todos/:id` | 更新待办 |
| DELETE | `/api/todos/:id` | 删除待办 |
| GET | `/api/todos` | 获取所有待办 |

**后端处理逻辑:**
```javascript
createTodo(todo) {
  const newTodo = {
    ...todo,
    id: uuid.v4(),
    completed: todo.completed || 0,
    priority: todo.priority || 'medium',
    remind_days: todo.remind_days || 3,
    enable_escalation: todo.enable_escalation ? 1 : 0,
    created_at: ISO时间戳,
    updated_at: ISO时间戳
  };
  this.data.todos.push(newTodo);
  this.save();
  return newTodo;
}
```

---

## 四、通知机制(Notifications)

### 4.1 通知存储

**前端存储：** Zustand persist → localStorage (`pw_notifications`)
**后端存储：** SQLite 表 `notifications`

**数据库表结构：**
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,           -- 接收人ID
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,              -- 通知类型
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
```

### 4.2 通知创建方式

**方式一：提醒引擎自动生成** (`src/hooks/useReminderEngine.js`)

定时检查（每60秒）任务和待办的到期情况，自动生成通知：

| 通知类型 | 触发条件 |
|---------|---------|
| `pre_due` | 到期前 N 天（配置：7, 3, 1天） |
| `due` | 到期当天 |
| `overdue` | 已逾期第1天 |
| `escalation` | 逾期超过3天，每2天催办一次 |
| `milestone` | 里程碑即将到达/已到达/逾期 |

**调用示例：**
```javascript
addNotification({
  type: 'pre_due',
  title: '任务即将到期',
  message: '「xxx」将于 1 天后到期',
  relatedId: taskId,
  relatedType: 'task',
  link: '/tasks'
});
```

**方式二：项目归档操作** (`src/components/projects/ProjectCard.jsx`)

项目归档时会创建归档申请通知发送给管理员。

### 4.3 通知管理API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/notifications?userId=:id` | 获取用户通知列表 |
| POST | `/api/notifications` | 创建通知 |

### 4.4 通知展示

- **通知中心页面**：`/notifications` → `NotificationsPage.jsx`
- **头部铃铛**：`Header.jsx` 显示未读数量角标
- **侧边栏**：`Sidebar.jsx` 显示未读数量角标
- **浏览器桌面通知**：需用户授权，在提醒设置页可开启

### 4.5 通知类型枚举

```javascript
const NOTIF_TYPES = {
  task_reminder: { label: '任务提醒', icon: '🔔', color: '#3b82f6' },
  project_update: { label: '项目更新', icon: '📊', color: '#8b5cf6' },
  milestone: { label: '里程碑', icon: '🏁', color: '#10b981' },
  risk_alert: { label: '风险预警', icon: '⚠️', color: '#ef4444' },
  system: { label: '系统通知', icon: 'ℹ️', color: '#64748b' },
};
```

> **注意**：实际生成的通知类型为 `pre_due`、`due`、`overdue`、`escalation`、`milestone`，但未在枚举中定义。

---

## 五、微信/企业微信集成

### ❌ 结论：当前无任何微信/企业微信集成

搜索以下关键词均无结果：
- `wechat`、`wecom`、`企业微信`、`weixin`、`微信`

**如需添加，可扩展方向：**
1. 后端添加企业微信 Webhook API 调用
2. 在通知创建后异步发送企业微信消息
3. 配置企业微信应用参数（CORP_ID、AGENT_ID、SECRET等）

---

## 六、后端架构

### 6.1 服务器实现

项目有两种后端实现：

| 文件 | 用途 | 数据库 |
|------|------|--------|
| `server/index.js` | 生产服务器 | better-sqlite3 |
| `server/app.js` | 演示服务器 | MockDatabase (JSON文件) |
| `server/simple-server.js` | 简化服务器 | JSON文件 |

### 6.2 完整API路由表

```
GET  /api/health              - 健康检查
GET  /api/stats               - 统计数据
GET  /api/projects            - 项目列表
POST /api/projects            - 创建项目
PUT  /api/projects/:id        - 更新项目
DEL  /api/projects/:id        - 删除项目

GET  /api/projects/:id/tasks  - 项目任务列表
POST /api/projects/:id/tasks  - 创建任务
PUT  /api/tasks/:id           - 更新任务

GET  /api/todos               - 待办列表
POST /api/todos               - 创建待办
PUT  /api/todos/:id           - 更新待办
DEL  /api/todos/:id           - 删除待办

GET  /api/members             - 成员列表
POST /api/members             - 创建成员

GET  /api/notifications       - 通知列表
POST /api/notifications       - 创建通知

POST /api/seed                - 初始化种子数据
```

### 6.3 数据模型 (SQLite)

```sql
-- 项目表
projects: id, name, description, status, archived, created_at, updated_at

-- 任务表
tasks: id, project_id, title, description, status, priority, due_date,
       assignee, progress_reports, actual_start_date, actual_end_date,
       created_at, updated_at

-- 待办表
todos: id, project_id, title, description, completed, completed_at,
       priority, due_date, assignee, remind_days, remind_at,
       enable_escalation, created_at, updated_at

-- 成员表
members: id, name, email, role, avatar_color, created_at

-- 文档表
documents: id, project_id, title, content, file_path, created_by, created_at, updated_at

-- 通知表
notifications: id, user_id, title, message, type, read, created_at
```

---

## 七、环境变量与配置

### 7.1 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_URL` | `http://localhost:3000/api` | 前端API地址 |
| `PORT` | `3000` | 后端端口 |
| `DB_PATH` | `data/workbench.db` | SQLite数据库路径 |

### 7.2 提醒配置

存储在浏览器 localStorage (`pw_reminder_config`)：

```javascript
{
  preDueDays: [7, 3, 1],       // 提前提醒天数
  enableDueDay: true,          // 启用到期当天提醒
  enableOverdue: true,         // 启用逾期提醒
  escalationDays: 3,           // 逾期几天后开始催办
  escalationInterval: 2,       // 催办间隔（天）
  checkIntervalSec: 60,        // 检查间隔（秒）
  enableBrowserNotif: false,   // 启用浏览器桌面通知
  enableSound: false,          // 启用声音提醒
  milestonePreDays: [14, 7, 3, 1],  // 里程碑提前提醒
  dailyCheckHour: 8,           // 每日检查时间（小时）
}
```

### 7.3 依赖包

**前端 (package.json):**
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.0",
  "zustand": "^4.5.4",
  "recharts": "^2.12.7",
  "date-fns": "^3.6.0",
  "lucide-react": "^0.408.0",
  "@hello-pangea/dnd": "^16.6.0",
  "clsx": "^2.1.1",
  "nanoid": "^5.0.7"
}
```

**后端 (server/package.json):**
```json
{
  "express": "^4.18.2",
  "better-sqlite3": "^9.4.3",
  "cors": "^2.8.5",
  "uuid": "^9.0.0",
  "dotenv": "^16.3.1"
}
```

---

## 八、关键文件索引

| 类别 | 文件路径 |
|------|----------|
| **任务创建** | `src/components/tasks/TaskForm.jsx` |
| **任务状态** | `src/store/useTaskStore.js` |
| **待办创建** | `src/components/todos/TodoForm.jsx` |
| **待办状态** | `src/store/useTodoStore.js` |
| **通知状态** | `src/store/useNotificationStore.js` |
| **通知页面** | `src/pages/NotificationsPage.jsx` |
| **提醒引擎** | `src/hooks/useReminderEngine.js` |
| **API客户端** | `src/lib/apiClient.js` |
| **数据层** | `src/lib/dataLayer.js` |
| **提醒配置** | `src/store/useReminderConfigStore.js` |
| **后端入口** | `server/index.js` (生产) / `server/app.js` (演示) |
| **数据库模拟** | `server/db/mockDatabase.js` |
| **数据库初始化** | `server/scripts/init-db.js` |
| **环境变量** | `.env` |

---

## 九、扩展建议

### 如需添加微信/企业微信通知

1. **后端新增接口**：
   ```javascript
   // server/index.js
   app.post('/api/notify/wechat', async (req, res) => {
     // 调用企业微信API发送消息
   });
   ```

2. **修改通知创建逻辑**：
   - 在 `useReminderEngine.js` 的 `addNotification()` 后
   - 添加异步调用企业微信 Webhook

3. **配置参数**（添加到 `.env`）：
   ```
   WECHAT_CORP_ID=your_corp_id
   WECHAT_AGENT_ID=your_agent_id
   WECHAT_SECRET=your_secret
   WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
   ```

4. **前端提醒设置页**添加企业微信开关：
   - `src/pages/ReminderSettingsPage.jsx`

---

*报告生成时间：2025年*
