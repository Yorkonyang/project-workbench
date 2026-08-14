# 项目工作台 — 需求规格说明书（完善版）

> 版本：v2.0
> 日期：2026-08-15
> 状态：功能增强需求规格

---

## 一、文档概述

本文档基于现有项目工作台（`D:/AI/project-workbench/`）的已有基础功能，针对四个重点功能模块提出需求规格。现有系统已具备项目管理、任务管理、待办管理、通知系统的雏形，本文档聚焦于增强和完善各模块的核心交互与数据联动。

### 1.1 现有系统问题回顾

| ID | 问题 | 影响范围 | 当前状态 |
|----|------|----------|----------|
| P0-1 | 后端缺少 `GET /api/tasks` 端点 | 任务列表无法加载 | 🔴 待修复 |
| P0-2 | `TaskForm.jsx` 调用参数与 `addTask` 签名不匹配（传1个参数 vs 期望2个） | 新建任务失败 | 🔴 待修复 |
| P0-3 | App.jsx 启动时未调用 `fetchTasks()` | 任务数据不加载 | 🟡 已部分修复 |
| P0-4 | 归档功能未在后端实现（缺少 archive 相关 API） | 项目归档无效 | 🔴 待修复 |
| P0-5 | `getTasksByProject` 使用 `project_id` 字段名，但前端任务对象存的是 `projectId` | 项目内任务查询返回空 | 🔴 待修复 |
| P1-1 | 点击项目卡片无跳转至时间线功能 | 用户体验缺失 | 🔴 新增需求 |
| P1-2 | 项目归档/删除时关联任务不同步 | 数据一致性差 | 🔴 新增需求 |
| P1-3 | 任务编辑弹窗无待办功能 | 核心交互缺失 | 🔴 新增需求 |
| P1-4 | 待办与任务混合显示在提醒页 | 视图混乱 | 🔴 新增需求 |

---

## 二、2.1 项目管理模块

### 2.1.1 功能目标

支持项目的完整生命周期管理，包括创建、编辑、归档、删除四项操作；新增归档审批流程，确保已完成项目可安全备查（供后续审计或类似项目参考）；点击项目卡片后可跳转至时间线界面，仅展示该项目记录。

### 2.1.2 功能清单

#### F-PROJ-001：创建项目

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 触发条件 | 点击"新建项目"按钮 |
| 交互流程 | 弹出 ProjectForm 弹窗 → 填写基本信息（名称、编号、描述、颜色、起止日期、负责人）→ 提交 → 存入 data/projects 列表 |
| 输入字段 | 项目名称（必填）、项目编号（必填，格式 XM_xxx）、描述、颜色标识、开始日期、结束日期（可选）、项目经理 |
| 校验规则 | 编号唯一；名称不为空 |
| 成功反馈 | Toast 提示"项目创建成功"，弹窗关闭，页面刷新 |

#### F-PROJ-002：编辑项目

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 触发条件 | 鼠标悬停项目卡片，点击铅笔图标 |
| 交互流程 | 弹出 ProjectForm 弹窗，预填当前项目信息 → 修改 → 提交 → 后端更新 |
| 可编辑字段 | 名称、描述、颜色、起止日期、负责人；编号和创建时间不可修改 |
| 成功反馈 | Toast 提示"项目已更新" |

#### F-PROJ-003：项目归档（含审批流程）★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 触发条件 | 鼠标悬停项目卡片，点击归档图标 |
| 交互流程 | ① 弹出归档原因选择弹窗（下拉选择：项目已完成/项目提前终止/负责人调动/预算调整/其他原因 + 补充说明文本框）→ ② 提交后，项目 `archiveStatus` 变为 `requested` → ③ 管理员收到通知，可在「待审批」标签页查看并审批 |
| 审批角色 | 仅 `role === 'admin'` 的成员可审批 |
| 状态流转 | `none → requested → approved(archived=1)` 或 `none → requested → rejected` |
| 归档后效果 | 项目移入「已归档」标签页；关联任务同步归档（status 变为 `archived`） |
| 恢复项目 | 归档后可通过「已归档」标签页内的"恢复"按钮还原（`archiveStatus → none, archived → 0`） |
| 成功反馈 | 审批通过后 Toast 提示"项目已归档" |

#### F-PROJ-004：删除项目

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 触发条件 | 弹出删除确认对话框 |
| 交互流程 | 二次确认弹窗（"确定删除项目？此操作不可恢复"）→ 确认后后端删除项目 |
| **级联删除规则** ★ 新增 | 项目删除后，该项目的**所有关联任务同步删除**（`DELETE /api/tasks/:taskId`），不再保留孤立任务 |
| 成功反馈 | Toast 提示"项目已删除，关联任务已同步清理" |

#### F-PROJ-005：状态管理与类别视图

| 属性 | 描述 |
|------|------|
| 优先级 | P1（Should have） |
| 现有功能 | 保留「进行中」/「已归档」两个标签页视图，搜索过滤功能不变 |
| 新增视图 | 「待审批归档」标签页（仅管理员可见，显示 `archiveStatus === 'requested'` 的项目） |
| 筛选方式 | 项目卡片按状态（active/archived/requested/rejected）分组展示 |

#### F-PROJ-006：项目卡片跳转时间线 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P1（Should have） |
| 触发条件 | 用户点击项目卡片主体区域（非操作按钮区域） |
| 交互流程 | ① 路由跳转至 `/timeline`，URL query 携带 `?projectId={id}` → ② TimelinePage 读取 query 参数，自动选中对应项目 → ③ GanttView 仅展示该项目关联的任务和里程碑 |
| 时间轴起点 | 甘特图起始日期为该项目的 `startDate`，而非全局最早日期 |
| 导航返回 | 点击浏览器返回或 Sidebar 项目导航可回到项目列表 |
| 实现要点 | TimelinePage 需读取 `window.location.search` 中的 `projectId` 参数；若参数存在，自动设置 `projectFilter` 状态并禁用选择器 |

### 2.1.3 数据模型变更

```javascript
// project 对象新增字段
{
  // 已有字段保持不变
  id: string,
  name: string,
  code: string,
  description: string,
  status: 'active' | 'paused' | 'completed' | 'archived',
  archived: number,         // 0/1
  color: string,
  startDate: string,        // YYYY-MM-DD
  endDate: string,          // YYYY-MM-DD
  manager: string,
  created_at: ISOString,
  updated_at: ISOString,

  // 新增字段（归档审批）
  archiveStatus: 'none' | 'requested' | 'approved' | 'rejected',
  archiveReason: string,    // 归档原因
  archiveNote: string,      // 补充说明
  archivedAt: ISOString | null,
}
```

### 2.1.4 后端 API 变更

| 方法 | 路径 | 说明 | 优先级 |
|------|------|------|--------|
| POST | `/api/projects/:id/archive` | 提交归档申请（设置 archiveStatus=requested） | P0 |
| POST | `/api/projects/:id/approve-archive` | 审批通过归档（设置 archived=1） | P0 |
| POST | `/api/projects/:id/reject-archive` | 驳回归档申请 | P0 |
| PUT | `/api/projects/:id` | 更新项目（含归档/恢复字段） | P0 |
| DELETE | `/api/projects/:id` | 删除项目（**级联删除关联任务**） | P0 |

### 2.1.5 Open Questions

- Q1：归档审批通知是否需推送企微？还是仅站内通知即可？
- Q2：项目删除时，关联的里程碑是否也同步删除？（建议：是，保持数据一致性）

---

## 三、2.2 任务管理模块

### 3.1 功能目标

任务需与项目建立稳固关联；项目状态变更时关联任务同步响应；任务编辑弹窗需集成待办管理功能，提升任务执行过程的可视化与管理效率。

### 3.2 功能清单

#### F-TASK-001：任务与项目关联（完善）

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 现有逻辑 | 新建任务时可选择所属项目；任务对象含 `projectId` 字段 |
| **问题** | `TaskForm.jsx` 调用 `addTask(data)`（1个参数），但 `useTaskStore.addTask(projectId, data)` 期望2个参数 → **导致创建任务失败** |
| **修复方案** | `TaskForm.handleSubmit` 中改为 `addTask(form.projectId, data)` |
| **后端修复** | 后端 `POST /api/projects/:projectId/tasks` 正确接收并存储 `project_id` |
| **查询修复** | `getTasksByProject` 方法中字段名从 `project_id` 改为 `projectId`（统一 camelCase） |
| **全局加载** | App.jsx 启动时需调用 `fetchTasks()` 获取所有任务（传 undefined 或不传参数） |

#### F-TASK-002：项目状态变更时任务同步响应 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 场景A：项目归档 | ① 用户/管理员审批通过项目归档 → ② 后端查找该项目下所有未归档任务 → ③ 批量更新这些任务的 `status` 为 `archived` → ④ 通知相关成员 |
| 场景B：项目恢复 | ① 管理员从已归档列表恢复项目 → ② 恢复对应任务的 `status` 为原状态（`todo`/`in_progress`/`review`） |
| 场景C：项目删除 | ① 用户确认删除项目 → ② 后端先删除所有关联任务（`DELETE /api/tasks/:id`）→ ③ 再删除项目本身 |
| 实现方式 | 后端在归档/删除项目接口中，查询并批量处理关联任务 |

#### F-TASK-003：任务编辑弹窗集成待办功能 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 触发条件 | 点击任务卡片或列表项 → 打开编辑弹窗（复用/扩展 TaskForm 或新建 TaskDetailModal） |
| 弹窗布局 | **左右两栏布局**：<br>• 左半部分（60%宽）：该任务关联的所有待办事项列表（含多选框）<br>• 右半部分（40%宽）：进度汇报区域 |
| 左半部分 — 待办列表 | ① 显示该任务下所有待办（`todo.projectId === task.projectId && todo.taskId === task.id`）；② 每个待办前有多选框，勾选即标记完成（调用 `toggleTodo`）；③ 提供"新增待办"按钮 |
| 新增待办弹窗 | 点击"新增待办"后弹出 TodoForm，**自动继承当前任务的 `projectId`** 和 `taskId`，用户无需手动选择 |
| 右半部分 — 进度汇报 | 现有 TaskProgressModal 的进度汇报功能保留；展示历史汇报记录表格（编号、日期、汇报人、内容、进度%）；支持新增汇报（内容与进度滑块） |
| 保存按钮 | 右下角"保存并关闭"按钮，同时将进度汇报写入后端 |

#### F-TASK-004：同一任务下多条待办支持

| 属性 | 描述 |
|------|------|
| 优先级 | P1（Should have） |
| 数据模型变更 | 待办对象新增 `taskId: string | null` 字段，用于关联到具体任务 |
| 展示逻辑 | 待办列表按 `taskId` 分组，同一任务下的待办集中展示 |
| 过滤逻辑 | 筛选待办时，同时支持按项目过滤和按任务过滤 |

#### F-TASK-005：待办完成状态双向同步 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 场景描述 | 用户在待办提醒页勾选待办完成 → 再次打开该任务弹窗时，对应待办应已标记为完成 |
| 实现原理 | ① `toggleTodo` 调用后端 API 更新 `completed` 状态并持久化 → ② TaskDetailModal 中的待办列表实时从 Store 读取最新状态 → ③ Zustand store 使用 `persist` 中间件，关闭弹窗后重新打开仍保持最新状态 |
| 额外保障 | 打开 TaskDetailModal 时，主动触发 `useTodoStore.getState().fetchTodos()` 确保数据最新 |

### 3.3 数据模型变更

```javascript
// task 对象新增字段
{
  // 已有字段保持不变
  id: string,
  projectId: string,
  title: string,
  description: string,
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked' | 'archived',
  priority: 'high' | 'medium' | 'low',
  assignee: string,
  startDate: string,
  dueDate: string,
  tags: string[],
  progressReports: Array<{id, no, date, content, progress, reporter, reporterId}>,
  created_at: ISOString,
  updated_at: ISOString,

  // 新增字段（归档同步）
  archivedAt: ISOString | null,
}

// todo 对象新增字段
{
  // 已有字段保持不变
  id: string,
  title: string,
  description: string,
  completed: boolean,
  completedAt: ISOString | null,
  priority: 'urgent' | 'high' | 'medium' | 'low',
  dueDate: string,
  assignee: string,
  projectId: string | null,
  remindDays: number,
  remindAt: string | null,
  enableEscalation: boolean,
  created_at: ISOString,
  updated_at: ISOString,

  // 新增字段
  taskId: string | null,   // 关联的任务 ID（为空表示全局待办）
}
```

### 3.4 后端 API 变更

| 方法 | 路径 | 说明 | 优先级 |
|------|------|------|--------|
| GET | `/api/tasks` | 获取所有任务（无 projectId 参数） | P0 |
| PUT | `/api/tasks/:id` | 更新任务（含 status: archived） | P0 |
| DELETE | `/api/tasks/:id` | 删除单个任务 | P0 |
| POST | `/api/projects/:id/archive` | 项目归档（级联更新任务状态） | P0 |
| POST | `/api/projects/:id/restore` | 项目恢复（级联恢复任务状态） | P1 |
| POST | `/api/projects/:id/delete` | 删除项目（级联删除任务） | P0 |
| PUT | `/api/todos/:id` | 更新待办（含 taskId 字段） | P1 |

---

## 四、2.3 待办事项管理模块

### 4.1 功能目标

待办列表独立展示，不再与任务混排；按截止时间升序排列（越早截止的越靠前）；逾期项高亮警示，提升用户紧迫感。

### 4.2 功能清单

#### F-TODO-001：待办独立列表视图 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 现状问题 | 当前 `TodosPage.jsx` 将待办和任务混合在同一个列表中，共用 `TodoList` 组件，通过 `_type` 字段区分 |
| 改进方案 | 将待办和任务**物理分离**为两个独立列表区域，互不嵌套： |
| 页面布局 | ```<div class="space-y-6">  <section>    <h2>待办事项</h2>    <TodoList items={todos} />  </section>  <section>    <h2>工作任务</h2>    <TaskList items={tasks} />  </section></div>``` |
| 导航优化 | 顶部工具栏保留筛选按钮（全部/待办/任务/进行中/已完成），切换时仅显示对应类型列表，不互相嵌套 |
| 图标区分 | 待办使用 🔔 铃铛图标（琥珀色），任务使用 ✅ 复选框图标（蓝色），视觉上清晰区分 |

#### F-TODO-002：按截止时间升序排列 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 排序规则 | ① 有截止日期且未完成的优先于无截止日期；② 有截止日期的按 `dueDate` 升序（越早截止越靠前）；③ 同一天截止的按优先级排序（urgent > high > medium > low）；④ 逾期项置顶 |
| 排序实现 | 在 `useReminders` hook 中对 `allItems` 进行排序，或直接在前端 TodoList 组件中 sort |
| 例外处理 | 无截止日期的待办排在最后（`dueDate` 为空时视为无穷远） |

#### F-TODO-003：逾期高亮显示 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P0（Must have） |
| 判断条件 | `dueDate < today && !completed` |
| 视觉样式 | ① 背景色：`bg-red-50`；② 边框：`border-red-200`；③ 截止日期文字：红色加粗；④ 逾期天数标签：右侧显示"逾期 N 天"红色 badge |
| 交互 | 逾期待办点击仍可完成，完成后移除高亮样式 |
| 排序优先级 | 逾期项始终排在最前面，不论截止时间远近 |

#### F-TODO-004：待办 CRUD 功能（完善）

| 属性 | 描述 |
|------|------|
| 优先级 | P1（Should have） |
| 创建待办 | 点击"新建待办"按钮，弹出 TodoForm，可选择关联项目和关联任务 |
| 编辑待办 | 点击铅笔图标，弹出 TodoForm 预填信息，修改后保存 |
| 删除待办 | 点击删除图标，弹出确认对话框，确认后删除 |
| 完成待办 | 点击圆形勾选框（或点击行触发确认弹窗），调用 `toggleTodo` |
| 批量操作 | 可选：支持全选/取消全选，批量完成或批量删除 |

### 4.3 页面结构变更

```
TodosPage
├── 统计卡片（待办逾期 / 待办今日到期 / 任务进行中 / 已完成待办）
├── 提醒横幅（ReminderBanner）
├── 工具栏
│   ├── 筛选标签（全部 / 待办 / 任务 / 进行中 / 已完成）
│   └── 新建待办按钮
├── 【待办列表区域】（独立 section）
│   └── TodoList items={todos} onToggleTodo={toggleTodo}
├── 【任务列表区域】（独立 section）
│   └── TaskList items={tasks} onProgressTask={handleProgressTask}
├── TodoForm（新建/编辑弹窗）
├── TaskProgressModal（进度汇报弹窗，含待办列表）
└── ConfirmDialog（删除确认）
```

---

## 五、2.4 通知系统（关联增强）

### 5.1 功能目标

通知系统需覆盖新增的归档审批、任务同步、待办关联等场景，确保关键事件及时触达用户。

### 5.2 功能清单

#### F-NOTIF-001：归档审批通知 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P1（Should have） |
| 触发时机 | 项目提交归档申请时 |
| 通知内容 | 标题："新项目归档申请"；消息："「{项目名称}」提交归档申请，等待审批" |
| 接收人 | 所有 `role === 'admin'` 的成员 |
| 通知类型 | `archive_requested` |

#### F-NOTIF-002：归档审批结果通知 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P1（Should have） |
| 审批通过时 | 标题："项目归档审批通过"；消息："「{项目名称}」已审批通过归档"；接收人：申请人 + 项目成员 |
| 审批驳回时 | 标题："项目归档申请被驳回"；消息："「{项目名称}」归档申请已被驳回"；接收人：申请人 |
| 通知类型 | `archive_approved` / `archive_rejected` |

#### F-NOTIF-003：项目删除通知 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P1（Should have） |
| 触发时机 | 项目被删除时 |
| 通知内容 | 标题："项目已删除"；消息："「{项目名称}」及关联的 {N} 个任务已被删除" |
| 接收人 | 项目所有成员 |
| 通知类型 | `project_deleted` |

#### F-NOTIF-004：项目归档时任务状态变更通知 ★ 新增

| 属性 | 描述 |
|------|------|
| 优先级 | P2（Nice to have） |
| 触发时机 | 项目归档审批通过后 |
| 通知内容 | 标题："项目已归档，关联任务已同步"；消息："「{项目名称}」已归档，{N} 个关联任务已标记为已归档" |
| 接收人 | 任务负责人 |
| 通知类型 | `task_archived` |

---

## 六、技术实施要点

### 6.1 前端改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/components/tasks/TaskForm.jsx` | 修复 | `addTask` 调用改为传递 `projectId` 参数；弹窗内集成待办列表和进度汇报两栏布局 |
| `src/components/tasks/TaskProgressModal.jsx` | 重构 | 重命名为 `TaskDetailModal.jsx`，左右分栏：左侧待办列表 + 右侧进度汇报 |
| `src/pages/TodosPage.jsx` | 重构 | 待办和任务列表物理分离为两个独立 section，不再混排 |
| `src/components/todos/TodoList.jsx` | 修改 | 移除任务列表渲染逻辑，仅保留待办；逾期高亮样式增强 |
| `src/pages/ProjectsPage.jsx` | 修改 | 项目卡片点击跳转时间线（`onClick` 触发 router navigate） |
| `src/pages/TimelinePage.jsx` | 修改 | 读取 URL query 参数 `projectId`，自动选中项目；时间轴起点设为项目启动日期 |
| `src/store/useProjectStore.js` | 新增方法 | `archiveProject(id)`, `approveArchive(id)`, `rejectArchive(id)`, `restoreProject(id)` |
| `src/store/useTaskStore.js` | 修复+新增 | `fetchTasks()` 支持无参调用；`deleteTasksByProject(id)` 级联删除 |
| `src/store/useTodoStore.js` | 修改 | `toggleTodo` 更新字段名兼容（`completedAt` vs `completed_at`） |
| `src/App.jsx` | 修复 | 启动时并行调用 `fetchTasks()` |

### 6.2 后端改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `server/simple-server.js` | 新增端点 | `GET /api/tasks`、`POST /api/projects/:id/archive`、`POST /api/projects/:id/approve-archive`、`POST /api/projects/:id/reject-archive`、`POST /api/projects/:id/restore` |
| `server/simple-server.js` | 修改 | `DELETE /api/projects/:id` 增加级联删除关联任务逻辑 |
| `server/simple-server.js` | 修改 | 归档审批通过后，批量更新关联任务的 `status` 为 `archived` |
| `server/db/index.js` | 检查 | 确保数据库 schema 支持 `taskId`、`archiveStatus` 等新字段 |

### 6.3 关键实现细节

1. **项目卡片跳转时间线**：使用 `react-router-dom` 的 `useNavigate`，点击卡片主体时 `navigate(`/timeline?projectId=${project.id}`)`
2. **时间线项目过滤**：TimelinePage 读取 `new URLSearchParams(window.location.search).get('projectId')`
3. **任务弹窗待办数据**：`TaskDetailModal` 打开时调用 `fetchTodos()`，本地筛选 `todos.filter(t => t.taskId === task.id)`
4. **双向同步保障**：`TodosPage` 和 `TaskDetailModal` 共享同一个 `useTodoStore`，任一处的状态变更立即反映到另一处
5. **字段名统一**：前端统一使用 camelCase（`projectId`、`taskId`、`dueDate`），后端 API 返回时也转换为 camelCase

---

## 七、验收标准

### 7.1 项目管理模块

- [ ] 可成功创建/编辑/删除项目，项目编号唯一
- [ ] 项目归档申请提交后，管理员可在「待审批」标签页看到并审批
- [ ] 审批通过后项目移入已归档列表，关联任务状态变为 archived
- [ ] 恢复项目后，关联任务状态还原
- [ ] 删除项目后，关联任务全部删除（数据库和前端列表均无残留）
- [ ] 点击项目卡片跳转至时间线，且仅显示该项目任务

### 7.2 任务管理模块

- [ ] 新建任务时可选择所属项目，任务创建成功后后端正确存储
- [ ] 项目归档时，关联任务自动变为 archived 状态
- [ ] 项目删除时，关联任务同步删除
- [ ] 点击任务卡片/列表项打开编辑弹窗，弹窗内左侧展示待办列表，右侧展示进度汇报
- [ ] 弹窗内点击"新增待办"，弹出表单且项目自动继承当前任务所属项目
- [ ] 支持在同一任务下创建多条待办

### 7.3 待办管理模块

- [ ] 待办列表独立展示，不与任务混排
- [ ] 待办按截止时间升序排列，逾期项置顶
- [ ] 逾期待办红色高亮显示，包含"逾期 N 天"标识
- [ ] 在待办提醒页勾选完成待办后，再次打开对应任务弹窗，该待办已标记为完成
- [ ] 待办可关联到具体任务，任务弹窗内可见关联待办

### 7.4 通知系统

- [ ] 提交归档申请后，管理员收到站内通知
- [ ] 审批通过后，项目成员收到归档通知
- [ ] 项目删除后，成员收到删除通知

---

## 八、优先级总览

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 项目管理 | 创建/编辑项目 | P0 |
| 项目管理 | 归档审批流程（申请→审批→归档） | P0 |
| 项目管理 | 删除项目（级联删除任务） | P0 |
| 项目管理 | 项目卡片跳转时间线 | P1 |
| 项目管理 | 已归档列表 / 待审批列表视图 | P1 |
| 任务管理 | 修复 TaskForm 参数问题（P0-2） | P0 |
| 任务管理 | 修复后端 GET /api/tasks（P0-1） | P0 |
| 任务管理 | 项目归档时任务状态同步 | P0 |
| 任务管理 | 项目删除时任务级联删除 | P0 |
| 任务管理 | 任务编辑弹窗集成待办+进度汇报双栏 | P0 |
| 任务管理 | 新增待办自动继承项目 | P1 |
| 任务管理 | 同一任务下多条待办 | P1 |
| 待办管理 | 待办列表独立展示（与任务分离） | P0 |
| 待办管理 | 按截止时间升序排列 | P0 |
| 待办管理 | 逾期红色高亮 | P0 |
| 待办管理 | 待办完成状态双向同步 | P0 |
| 通知系统 | 归档审批通知 | P1 |
| 通知系统 | 项目删除通知 | P1 |

---

*文档结束*
