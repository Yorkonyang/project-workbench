# 项目工作台 — 架构设计方案

> 版本：v2.0
> 日期：2026-08-15
> 状态：架构设计稿

---

## 一、架构概述

### 1.1 现有架构分析

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React + Vite)                    │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐       │
│  │  Zustand    │  │ Tailwind │  │ react-router-dom │       │
│  │  Store      │  │  CSS     │  │    Routing       │       │
│  └─────────────┘  └──────────┘  └──────────────────┘       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Pages: Dashboard, Tasks, Todos, Projects...     │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│                      后端 (Node.js http)                     │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐       │
│  │  simple-    │  │  qingflow│  │  db/             │       │
│  │  server.js  │  │  .js     │  │  index.js        │       │
│  └─────────────┘  └──────────┘  └──────────────────┘       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Routes: /api/projects, /api/tasks, /api/todos   │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                          ↓ JSON
┌─────────────────────────────────────────────────────────────┐
│                    数据存储 (JSON文件)                       │
│              data/workbench.db                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 架构改进目标

1. **数据一致性**：建立级联操作机制，确保项目归档/删除时关联数据同步
2. **性能优化**：修复 API 端点缺失问题，优化数据加载策略
3. **扩展性**：为新功能预留扩展点，保持向后兼容
4. **可维护性**：统一字段命名规范，消除技术债

---

## 二、数据库Schema变更方案

### 2.1 Projects 表变更

#### 现有Schema（参考functional_design.md）
```sql
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
```

#### 新增字段
```sql
ALTER TABLE projects ADD COLUMN archive_status TEXT DEFAULT 'none';
ALTER TABLE projects ADD COLUMN archive_reason TEXT;
ALTER TABLE projects ADD COLUMN archive_note TEXT;
ALTER TABLE projects ADD COLUMN archived_at TEXT;
ALTER TABLE projects ADD COLUMN start_date TEXT;
ALTER TABLE projects ADD COLUMN end_date TEXT;
ALTER TABLE projects ADD COLUMN manager TEXT;
ALTER TABLE projects ADD COLUMN phase TEXT;
ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0;
```

#### 字段说明
| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| archive_status | TEXT | 'none' | 归档审批状态：none/requested/approved/rejected |
| archive_reason | TEXT | NULL | 归档原因（已审批通过后填写） |
| archive_note | TEXT | NULL | 补充说明 |
| archived_at | TEXT | NULL | 归档时间（ISO 8601） |
| start_date | TEXT | NULL | 项目开始日期 |
| end_date | TEXT | NULL | 项目结束日期 |
| manager | TEXT | NULL | 项目负责人姓名 |
| phase | TEXT | NULL | 当前阶段 |
| progress | INTEGER | 0 | 总体进度百分比 |

#### 索引变更
```sql
CREATE INDEX idx_projects_archive_status ON projects(archive_status);
CREATE INDEX idx_projects_archived ON projects(archived);
```

---

### 2.2 Tasks 表变更

#### 现有Schema（参考functional_design.md）
```sql
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
```

#### 新增字段
```sql
ALTER TABLE tasks ADD COLUMN archived_at TEXT;
ALTER TABLE tasks ADD COLUMN progress_reports TEXT; -- JSON格式存储
```

#### 字段说明
| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| archived_at | TEXT | NULL | 任务归档时间 |
| progress_reports | TEXT | NULL | JSON数组，存储进度汇报记录 |

#### 索引变更
```sql
-- 已有索引保持不变
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

---

### 2.3 Todos 表变更

#### 现有Schema（参考functional_design.md）
```sql
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
```

#### 新增字段
```sql
ALTER TABLE todos ADD COLUMN task_id TEXT;
```

#### 字段说明
| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| task_id | TEXT | NULL | 关联的任务ID，NULL表示全局待办 |

#### 索引变更
```sql
-- 已有索引保持不变
CREATE INDEX idx_todos_project ON todos(project_id);
CREATE INDEX idx_todos_task ON todos(task_id);
CREATE INDEX idx_todos_completed ON todos(completed);
```

---

### 2.4 Milestones 表

#### 现有Schema（推测）
```sql
CREATE TABLE milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

#### 验证项
- 确认现有里程碑表结构
- 确保项目删除时级联删除关联里程碑

---

## 三、接口设计规范

### 3.1 项目管理API

#### 3.1.1 获取所有项目
```http
GET /api/projects
```
**响应**：
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "项目名称",
      "code": "XM_001",
      "description": "项目描述",
      "status": "active",
      "archived": 0,
      "archiveStatus": "none",
      "archiveReason": null,
      "archiveNote": null,
      "archivedAt": null,
      "color": "#3b82f6",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "manager": "张三",
      "phase": "实施阶段",
      "progress": 65,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-06-15T10:30:00Z"
    }
  ]
}
```

#### 3.1.2 创建项目
```http
POST /api/projects
Content-Type: application/json

{
  "name": "项目名称",
  "code": "XM_002",
  "description": "项目描述",
  "color": "#10b981",
  "startDate": "2024-07-01",
  "endDate": "2024-12-31",
  "manager": "李四"
}
```
**响应**：`201 Created` + 项目对象

#### 3.1.3 更新项目
```http
PUT /api/projects/:id
Content-Type: application/json

{
  "name": "新名称",
  "description": "新描述",
  "status": "paused",
  "progress": 80
}
```
**响应**：`200 OK` + 更新后的项目对象

#### 3.1.4 提交归档申请
```http
POST /api/projects/:id/archive
Content-Type: application/json

{
  "reason": "项目已完成",
  "note": "补充说明"
}
```
**处理逻辑**：
1. 检查项目状态是否允许归档（非已归档、非驳回中）
2. 更新 `archive_status = 'requested'`
3. 更新 `archive_reason` 和 `archive_note`
4. 创建通知（类型：`archive_requested`）
5. 返回更新后的项目对象

**响应**：`200 OK` + 项目对象

#### 3.1.5 审批通过归档
```http
POST /api/projects/:id/approve-archive
```
**处理逻辑**：
1. 更新项目 `archive_status = 'approved'`, `archived = 1`, `archived_at = now`
2. 查找该项目下所有未归档任务
3. 批量更新任务 `status = 'archived'`, `archived_at = now`
4. 创建通知（类型：`archive_approved`）给申请人及项目成员
5. 创建通知（类型：`task_archived`）给各任务负责人

**响应**：`200 OK`

#### 3.1.6 驳回归档申请
```http
POST /api/projects/:id/reject-archive
```
**处理逻辑**：
1. 更新项目 `archive_status = 'rejected'`
2. 创建通知（类型：`archive_rejected`）给申请人

**响应**：`200 OK`

#### 3.1.7 恢复项目
```http
POST /api/projects/:id/restore
```
**处理逻辑**：
1. 更新项目 `archive_status = 'none'`, `archived = 0`, `archived_at = null`
2. 查找该项目下所有归档任务
3. 批量恢复任务 `status = 'todo'`, `archived_at = null`
4. 创建系统通知

**响应**：`200 OK`

#### 3.1.8 删除项目（级联）
```http
DELETE /api/projects/:id
```
**处理逻辑**：
1. 开始事务
2. 删除所有关联任务（`DELETE FROM tasks WHERE project_id = :id`）
3. 删除所有关联里程碑（`DELETE FROM milestones WHERE project_id = :id`）
4. 删除所有关联待办（`DELETE FROM todos WHERE project_id = :id`）
5. 删除项目本身
6. 提交事务
7. 创建通知（类型：`project_deleted`）给项目成员

**响应**：`200 OK`

---

### 3.2 任务管理API

#### 3.2.1 获取所有任务（新增端点）
```http
GET /api/tasks
```
**响应**：
```json
{
  "data": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "title": "任务标题",
      "description": "任务描述",
      "status": "in_progress",
      "priority": "high",
      "assignee": "user_id",
      "startDate": "2024-07-01",
      "dueDate": "2024-08-15",
      "tags": ["前端", "开发"],
      "progress": 45,
      "progressReports": [
        {
          "id": "report_id",
          "no": 1,
          "date": "2024-07-15",
          "content": "完成前端框架搭建",
          "progress": 30,
          "reporter": "张三",
          "reporterId": "user_id"
        }
      ],
      "archivedAt": null,
      "created_at": "2024-07-01T00:00:00Z",
      "updated_at": "2024-07-15T10:30:00Z"
    }
  ]
}
```

#### 3.2.2 获取项目任务
```http
GET /api/projects/:projectId/tasks
```
**响应**：任务数组

#### 3.2.3 创建任务
```http
POST /api/projects/:projectId/tasks
Content-Type: application/json

{
  "title": "任务标题",
  "description": "任务描述",
  "priority": "high",
  "assignee": "user_id",
  "startDate": "2024-07-01",
  "dueDate": "2024-08-15",
  "tags": ["前端"]
}
```
**响应**：`201 Created` + 任务对象（包含 `projectId` 字段）

#### 3.2.4 更新任务
```http
PUT /api/tasks/:id
Content-Type: application/json

{
  "title": "新标题",
  "status": "review",
  "progress": 80,
  "dueDate": "2024-09-01"
}
```
**响应**：`200 OK` + 更新后的任务对象

#### 3.2.5 删除任务
```http
DELETE /api/tasks/:id
```
**响应**：`200 OK`

---

### 3.3 待办管理API

#### 3.3.1 创建待办（支持关联任务）
```http
POST /api/todos
Content-Type: application/json

{
  "title": "待办标题",
  "description": "待办描述",
  "priority": "high",
  "dueDate": "2024-07-20",
  "assignee": "张三",
  "projectId": "project_id",
  "taskId": "task_id",
  "remindDays": 3,
  "enableEscalation": false
}
```
**响应**：`201 Created` + 待办对象

#### 3.3.2 更新待办（含状态同步）
```http
PUT /api/todos/:id
Content-Type: application/json

{
  "completed": true,
  "completedAt": "2024-07-18T10:30:00Z"
}
```
**响应**：`200 OK` + 更新后的待办对象

---

## 四、前端组件重构计划

### 4.1 核心组件变更

#### 4.1.1 TaskForm.jsx（修复+增强）
**问题**：`addTask` 调用参数不匹配
**修复**：
```javascript
// 修改前
addTask({ ...form, tags: form.tags.split(',').map(...) });

// 修改后
addTask(form.projectId, { ...form, tags: form.tags.split(',').map(...) });
```

**增强**：集成待办双栏布局（需配合新组件 TaskDetailModal）

#### 4.1.2 TaskProgressModal.jsx → TaskDetailModal.jsx（重构）
**新布局**：
```
┌─────────────────────────────────────────────────────────┐
│  任务进度汇报 - {task.title}                              │
├──────────────────────────┬──────────────────────────────┤
│  【左栏】关联待办列表      │  【右栏】进度汇报记录          │
│  ┌────────────────────┐  │  ┌────────────────────────┐  │
│  │ ☐ 待办事项1         │  │  │ #1 2024-07-15 张三      │  │
│  │ ☑ 待办事项2         │  │  │ 完成前端框架搭建 30%    │  │
│  │ ☐ 待办事项3         │  │  ├────────────────────────┤  │
│  │                    │  │  │ #2 2024-07-20 张三      │  │
│  │ [+ 新增待办]        │  │  │ 完成接口开发 60%        │  │
│  └────────────────────┘  │  ├────────────────────────┤  │
│                          │  │ [新增汇报]               │  │
│  待办统计：2/3 完成       │  │ [保存并关闭]             │  │
│                          │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘
```

**状态管理**：
- 打开时主动调用 `fetchTodos()`
- 筛选 `todos.filter(t => t.taskId === task.id)`
- 待办状态变更实时反映到弹窗

#### 4.1.3 TodosPage.jsx（重构）
**新布局**：
```javascript
<>
  {/* 统计卡片 */}
  <div className="grid grid-cols-4 gap-3">...</div>
  
  {/* 提醒横幅 */}
  <ReminderBanner ... />
  
  {/* 工具栏 */}
  <div className="flex justify-between mb-4">
    <FilterTabs ... />
    <Button>+ 新建待办</Button>
  </div>
  
  {/* 待办列表区域（独立） */}
  <section>
    <h3>待办事项</h3>
    <TodoList items={filteredTodos} ... />
  </section>
  
  {/* 工作任务区域（独立） */}
  <section>
    <h3>工作任务</h3>
    <TaskList items={filteredTasks} ... />
  </section>
  
  {/* 弹窗 */}
  {showForm && <TodoForm ... />}
  {progressTask && <TaskDetailModal task={progressTask} ... />}
</>
```

**排序逻辑**：
```javascript
const sortedTodos = [...todos].sort((a, b) => {
  // 逾期项置顶
  const aOverdue = a.dueDate && isOverdue(a.dueDate) && !a.completed;
  const bOverdue = b.dueDate && isOverdue(b.dueDate) && !b.completed;
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
  
  // 有截止日期的优先
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  
  // 按截止日升序
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  
  // 同优先级按截止日期
  return 0;
});
```

#### 4.1.4 ProjectsPage.jsx（修改）
**卡片点击跳转**：
```javascript
// ProjectCard.jsx
const handleCardClick = () => {
  navigate(`/timeline?projectId=${project.id}`);
};

// 只在全局导航时阻止（操作按钮区域不触发）
<div onClick={handleCardClick} className="cursor-pointer">
  {/* 按钮区域 */}
  <div onClick={(e) => e.stopPropagation()}>...</div>
</div>
```

#### 4.1.5 TimelinePage.jsx（修改）
**读取URL参数**：
```javascript
import { useSearchParams } from 'react-router-dom';

export default function TimelinePage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  // 自动选中项目
  const [projectFilter, setProjectFilter] = useState(projectId || '');
  
  // 禁用选择器（如果有URL参数）
  const isProjectLocked = !!projectId;
  
  // 时间轴起点设为项目启动日期
  const project = projects.find(p => p.id === projectId);
  const timelineStart = project?.startDate || getDefaultStartDate();
  
  return (
    <GanttView
      tasks={filteredTasks}
      milestones={filteredMilestones}
      projects={filteredProjects}
      startTime={timelineStart}
      lockedProject={projectId}
    />
  );
}
```

#### 4.1.6 App.jsx（修复）
**启动时加载任务**：
```javascript
async function loadFromApi() {
  try {
    const [projects, todos, members, tasks] = await Promise.all([
      fetchProjects(),
      fetchTodos(),
      fetchMembers(),
      useTaskStore.getState().fetchTasks(), // 新增
    ]);
    // ...
  } catch (err) {
    console.error('[App] Failed to load from API:', err);
  }
}
```

### 4.2 Store变更

#### 4.2.1 useProjectStore.js
```javascript
// 新增方法
archiveProject: async (id, reason, note) => {
  const project = await apiClient.post(`/projects/${id}/archive`, { reason, note });
  set((state) => ({
    projects: state.projects.map((p) => p.id === id ? project : p),
  }));
},

approveArchive: async (id) => {
  const project = await apiClient.post(`/projects/${id}/approve-archive`);
  set((state) => ({
    projects: state.projects.map((p) => p.id === id ? project : p),
  }));
},

rejectArchive: async (id) => {
  const project = await apiClient.post(`/projects/${id}/reject-archive`);
  set((state) => ({
    projects: state.projects.map((p) => p.id === id ? project : p),
  }));
},

restoreProject: async (id) => {
  const project = await apiClient.post(`/projects/${id}/restore`);
  set((state) => ({
    projects: state.projects.map((p) => p.id === id ? project : p),
  }));
},

deleteProject: async (id) => {
  await apiClient.delete(`/projects/${id}`);
  set((state) => ({
    projects: state.projects.filter((p) => p.id !== id),
  }));
},
```

#### 4.2.2 useTaskStore.js
```javascript
// 修复 fetchTasks 无参调用
fetchTasks: async () => {
  set({ loading: true });
  try {
    const tasks = await apiClient.getTasks(); // 不再传 projectId
    set({ tasks, loading: false });
  } catch (err) {
    console.error('Failed to fetch tasks:', err);
    set({ loading: false });
  }
},

// 新增级联删除方法
deleteTasksByProject: async (projectId) => {
  const tasks = get().tasks.filter(t => t.projectId === projectId);
  await Promise.all(tasks.map(t => apiClient.deleteTask(t.id)));
  set((state) => ({
    tasks: state.tasks.filter((t) => t.projectId !== projectId),
  }));
},
```

#### 4.2.3 useTodoStore.js
```javascript
// 确保 toggleTodo 字段名一致
toggleTodo: async (id) => {
  const todo = get().todos.find((t) => t.id === id);
  if (!todo) return;
  const updated = await get().updateTodo(id, {
    completed: !todo.completed,
    completedAt: !todo.completed ? new Date().toISOString() : null,
  });
  return updated;
},
```

---

## 五、数据迁移策略

### 5.1 向后兼容性

所有新增字段均为可选字段（nullable），不影响现有功能：
- 旧项目无 `archiveStatus` 字段 → 默认为 `none`
- 旧任务无 `archivedAt` 字段 → 默认为 `null`
- 旧待办无 `taskId` 字段 → 默认为 `null`（全局待办）

### 5.2 数据迁移脚本

```javascript
// server/scripts/migrate.js
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/workbench.db');

function migrate() {
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  
  // 迁移 projects
  data.projects.forEach(p => {
    p.archiveStatus = p.archiveStatus || 'none';
    p.archiveReason = p.archiveReason || null;
    p.archiveNote = p.archiveNote || null;
    p.archivedAt = p.archivedAt || null;
    p.startDate = p.startDate || null;
    p.endDate = p.endDate || null;
    p.manager = p.manager || null;
    p.phase = p.phase || null;
    p.progress = p.progress || 0;
  });
  
  // 迁移 tasks
  data.tasks.forEach(t => {
    t.archivedAt = t.archivedAt || null;
    t.progressReports = t.progressReports || [];
  });
  
  // 迁移 todos
  data.todos.forEach(t => {
    t.taskId = t.taskId || null;
  });
  
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  console.log('Migration completed successfully');
}

migrate();
```

### 5.3 迁移执行步骤

1. 备份当前数据库
2. 停止服务
3. 执行迁移脚本
4. 验证数据完整性
5. 重启服务

---

## 六、测试验证方案

### 6.1 单元测试

| 模块 | 测试用例 | 验证点 |
|------|----------|--------|
| ProjectStore | archiveProject | archiveStatus 更新为 requested |
| ProjectStore | approveArchive | archived=1, 关联任务 status=archived |
| ProjectStore | rejectArchive | archiveStatus 更新为 rejected |
| ProjectStore | deleteProject | 关联任务、里程碑、待办全部删除 |
| TaskStore | fetchTasks | 无参调用成功，返回所有任务 |
| TodoStore | toggleTodo | completed 状态正确切换 |

### 6.2 集成测试

| 场景 | 操作步骤 | 预期结果 |
|------|----------|----------|
| 项目归档流程 | 创建项目→申请归档→审批通过 | 项目状态变为 archived，任务同步归档 |
| 项目删除级联 | 创建项目→创建任务→删除项目 | 项目与任务均被删除 |
| 任务弹窗待办 | 创建任务→创建待办→打开任务弹窗 | 待办列表显示正确 |
| 待办双向同步 | 待办页勾选完成→打开任务弹窗 | 待办状态已更新 |
| 时间线跳转 | 点击项目卡片→跳转时间线 | URL参数正确，时间轴起点正确 |
| 待办独立列表 | 访问待办页 | 待办与任务分开展示 |

### 6.3 接口测试

```bash
# 测试归档申请
curl -X POST http://localhost:3000/api/projects/{id}/archive \
  -H "Content-Type: application/json" \
  -d '{"reason":"项目已完成","note":"补充说明"}'

# 测试审批通过
curl -X POST http://localhost:3000/api/projects/{id}/approve-archive

# 测试获取所有任务
curl http://localhost:3000/api/tasks

# 测试删除项目（级联）
curl -X DELETE http://localhost:3000/api/projects/{id}
```

---

## 七、实施路线图

### Phase 1：核心修复（P0）

- [x] 需求规格文档
- [ ] 修复 GET /api/tasks 端点
- [ ] 修复 TaskForm 参数问题
- [ ] 修复 App.jsx 启动加载
- [ ] 实现归档API端点
- [ ] 实现级联删除逻辑
- [ ] 统一字段命名规范

### Phase 2：功能增强（P1）

- [ ] 实现归档审批流程UI
- [ ] 重构 TaskProgressModal → TaskDetailModal
- [ ] 重构 TodosPage 独立列表
- [ ] 实现待办排序逻辑
- [ ] 实现逾期高亮样式
- [ ] 项目卡片跳转时间线
- [ ] TimelinePage URL参数处理

### Phase 3：体验优化（P2）

- [ ] 企微推送集成（归档审批）
- [ ] 批量操作支持
- [ ] 性能优化（大数据量）
- [ ] 移动端适配

### Phase 4：测试验证

- [ ] 单元测试覆盖
- [ ] 集成测试验证
- [ ] 用户验收测试
- [ ] 文档完善

---

## 八、风险提示

1. **数据一致性风险**：级联删除需确保事务完整性，避免部分删除失败
2. **向后兼容风险**：新增字段需做好默认值处理，避免旧数据报错
3. **性能风险**：大数据量下的排序和过滤需优化，考虑分页加载
4. **安全风险**：归档审批需校验用户权限，防止越权操作

---

*文档结束*
