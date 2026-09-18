# 项目群聊（即时通讯）增量设计说明

> 版本：v1.0 · 2026-09-18
> 类型：增量功能设计（在既有「项目工作台」上新增，不改变现有数据契约）
> 目标：按项目分群的简易即时通讯 —— 点开项目即可给项目成员发消息，成员有提醒，可回复。

---

## 1. 现状勘察结论（实现前必读）

| 项 | 事实 |
|---|---|
| 活跃前端 | `D:\AI\project-workbench\src\`（根目录）。`project-workbench/src` 是**过期副本，不要动** |
| 活跃后端 | `D:\AI\project-workbench\server\simple-server.js`（2445 行，纯 Node `http`，无外部依赖） |
| 数据存储 | JSON 文件 `data/workbench.db`，通过 `loadData()` / `saveData(data)` 读写整个对象 |
| 身份鉴权 | 服务端 `accessControl.getUserId(req)` 从 HttpOnly Cookie `workbench_session` 解析；前端 `apiClient` 用 `credentials: 'include'` 自动带 Cookie |
| CSRF | 所有 `POST/PUT/DELETE` 必须携带请求头 `X-Workbench: 1`（`apiClient.request` 已自动加） |
| 现有通知 | `data.notifications[]`，字段 `{id, user_id, title, message, type, read, relatedId, relatedType, link, created_at}`；Header 铃铛直接消费 |
| 项目成员关系 | `member.projectIds` 数组包含项目 id；任务上有 `assignee`/`assignees`；项目上有 `ownerId`（创建者）与 `manager`（负责人） |
| 权限模型 | `server/accessControl.js`：`canManageProject`（仅 owner/admin）、`canViewProject`（owner/admin/被分配任务的成员）、`visibleProjects` |
| 路由风格 | `if (pathname === '...' && method === '...') { ... sendResponse(res, code, data); return; }` 顺序匹配，末尾 `sendResponse(res, 404, ...)` |
| UI 技术栈 | React 18 + Vite + TailwindCSS + zustand + react-router-dom；图标用 `lucide-react`；工具函数 `cn()` 来自 `@/lib/utils` |

**重要**：`server/simple-server.js` 的 `loadData()` 中有一段「兼容旧数据库：补全缺失字段」，新增集合必须在此处补 `if (!parsed.xxx) parsed.xxx = []`，否则老库会报错。

---

## 2. 功能范围

### 必做（P0）
1. **按项目分群**：每个项目一个固定群，成员 = 项目 owner + manager + `projectIds` 含该项目的成员 + 该项目任务的 assignee。管理员可进入任意群。
2. **发消息**：文本消息，Enter 发送 / Shift+Enter 换行。
3. **回复消息**：支持引用回复（微信式「引用条」），支持 `@成员` 提及。
4. **提醒**：
   - 侧边栏「项目群聊」入口未读红点（总数）
   - 项目详情「群聊」Tab 未读角标
   - Header 铃铛通知中心生成聊天通知（同一项目 5 分钟内聚合，防刷屏）
   - 被 `@` 时通知标题加 `[有人@你]` 前缀
   - 浏览器桌面通知（Web Notification API）+ 提示音（Web Audio 合成，无需音频文件）
   - 提醒开关可在群聊页设置（音效 / 桌面通知）
5. **实时**：SSE（Server-Sent Events）推送新消息；断线自动重连；SSE 不可用时降级为 15s 轮询。
6. **已读**：进入会话自动标记已读；未读数 = 该群中「创建时间 > 我的 lastReadAt 且非我发送且未撤回」的消息数。

### 可选（P1，时间不足可跳过）
- 消息撤回（发送者本人 / 管理员，5 分钟内）
- 历史消息分页上拉加载（默认每页 50 条）—— **建议保留**，实现成本低

### 明确不做
- 富媒体（图片/语音/文件）、私聊、消息搜索、表情面板、消息编辑、群管理（建群/退群/改群名）

---

## 3. 数据模型（写入 `data/workbench.db`）

```jsonc
{
  // 新增集合①：消息
  "chatMessages": [
    {
      "id": "uuid",
      "projectId": "p-xxx",
      "senderId": "m-xxx",
      "senderName": "张三",          // 冗余快照，成员改名/删除后历史消息不串
      "content": "文本内容（已 trim，最长 2000 字符）",
      "mentions": ["m-yyy"],         // @到的成员 userId 数组（不含自己）
      "replyTo": {                   // 引用回复快照，可为 null
        "id": "被引用消息id",
        "senderName": "李四",
        "content": "被引用内容摘要（截断 60 字）"
      },
      "createdAt": "2026-09-18T01:23:45.678Z",
      "recalled": false              // 撤回标记；撤回后 content 置为 ""
    }
  ],

  // 新增集合②：已读游标（每人每群一条）
  "chatReads": [
    {
      "id": "uuid",
      "userId": "m-xxx",
      "projectId": "p-xxx",
      "lastReadAt": "2026-09-18T01:30:00.000Z"
    }
  ]
}
```

**排序约定**：`chatMessages` 按 `createdAt` 升序追加（即数组本身近似有序）。前端渲染时仍以 `createdAt` 升序排列。

---

## 4. 后端设计

### 4.1 新增文件 `server/chat.js`

单一文件承载全部群聊逻辑，避免继续膨胀 `simple-server.js`。导出：

```js
module.exports = {
  ensureCollections(data),  // 兼容旧库，补 chatMessages / chatReads
  isChatPath(pathname),     // 快速判定是否属于群聊路由，避免每请求都进 chat 模块
  handle(req, res, ctx),    // 处理请求；返回 true=已处理，false=未处理（交回 404）
};
```

`ctx` 由 `simple-server.js` 注入：`{ pathname, method, url, loadData, saveData, sendResponse, parseBody, generateId, ac }`。

### 4.2 `simple-server.js` 的三处改动（仅三处）

1. 顶部 require 区加：`const chat = require('./chat');`
2. `loadData()` 兼容旧库段加：
   ```js
   if (!parsed.chatMessages) parsed.chatMessages = [];
   if (!parsed.chatReads) parsed.chatReads = [];
   ```
3. 在末尾 `// 404` 之前插入：
   ```js
   // ==================== 项目群聊 API ====================
   if (chat.isChatPath(pathname)) {
       const handled = await chat.handle(req, res, {
           pathname, method, url, loadData, saveData, sendResponse, parseBody, generateId, ac,
       });
       if (handled) return;
   }
   ```

> 注意：`chat.handle` 是 async（内部会 `await parseBody`），调用处已在 `async (req, res) => {}` 内，直接 `await`。

### 4.3 权限判定（chat.js 内部实现，不改 `accessControl.js`）

```js
function projectMemberIds(data, projectId) -> string[]   // 去重、非空
function canChat(data, userId, projectId) -> boolean
```

`canChat` 满足任一即通过：
- `ac.isAdmin(data, userId)`
- `ac.isProjectOwner(project, userId)`
- 该成员 `projectIds` 包含 `projectId`
- `ac.canViewProject(data, userId, projectId)`

无权限一律 `403 { error: '无权访问该项目群聊' }`；未登录 `401 { error: '未登录' }`。

### 4.4 API 契约

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/chat/conversations` | 当前用户的全部群（含未读、最后一条消息），按最后消息时间倒序 |
| GET | `/api/chat/projects/:projectId/messages?before=<ISO>&limit=50` | 分页拉历史；不传 `before` 取最近 `limit` 条；返回**按 createdAt 升序** |
| POST | `/api/chat/projects/:projectId/messages` | 发消息。body `{ content, mentions, replyToId }`；返回新消息对象 |
| PUT | `/api/chat/projects/:projectId/read` | 标记已读。body `{ lastReadAt }`（缺省用服务端当前时间） |
| GET | `/api/chat/unread` | `{ total, byProject: { "<projectId>": n }, mentionByProject: {...} }` |
| GET | `/api/chat/stream` | SSE 长连接，按当前登录用户订阅 |
| DELETE | `/api/chat/messages/:id` | 撤回（发送者本人或 admin，5 分钟内） |

#### `GET /api/chat/conversations` 响应元素

```jsonc
{
  "projectId": "p-xxx",
  "projectName": "XX 靶材产线改造",
  "projectCode": "XM_003",
  "projectColor": "#6366F1",
  "archived": false,
  "memberIds": ["m-1", "m-2"],
  "memberCount": 2,
  "lastMessage": { /* 消息对象 或 null */ },
  "lastMessageAt": "2026-09-18T01:23:45.678Z",   // 无消息时回退项目 updated_at
  "unreadCount": 3,
  "mentionCount": 1
}
```

`conversations` 的取群范围 = `ac.visibleProjects(data, userId)`（已含 admin 全量、成员可见项目），再过滤 `archived !== 1`（已归档项目不进列表；若已有消息则仍允许通过项目详情查看）。

#### 发消息时的副作用（提醒核心）

1. 落到 `data.chatMessages`。
2. 对**项目群内除发送者以外**的每个成员：
   - 生成/聚合一条 `notifications`：
     - `user_id` = 收件人
     - `type` = `'chat_mention'`（我被 @）或 `'chat'`
     - `title` = `${projectName} 项目群` 或 `[有人@你] ${projectName} 项目群`
     - `message` = `${senderName}：${content 截断 60 字}`
     - `relatedId` = `projectId`，`relatedType` = `'project_chat'`
     - `link` = `/messages?project=${projectId}`
     - `read` = 0
   - **聚合规则**：若该收件人在 5 分钟内、同一 `relatedId` 已有 `read === 0` 且 `type` 以 `chat` 开头的通知，则**更新**该条（`message` 改为 `${senderName} 等 N 条新消息`，`created_at` 刷新），不新增。
3. 通过 SSE 向这些成员的在线连接推送 `message` 事件。

> 通知刷写频率：一次请求只 `saveData` 一次（消息 + 通知 + 已读游标统一在一个 data 对象上改完再存）。

#### SSE 实现要点

- 响应头：
  ```
  Content-Type: text/event-stream; charset=utf-8
  Cache-Control: no-cache, no-transform
  Connection: keep-alive
  X-Accel-Buffering: no        // 关键：nginx 下禁止缓冲，否则事件会被攒着不发
  ```
  同时带上 CORS 头（复用 `chat.js` 自带的简化版即可，同源部署下无 Origin 头）。
- 首帧立即写 `retry: 3000\n\n` 与 `event: ready\ndata: {"ok":true}\n\n`。
- 心跳：模块级 `setInterval(25s)` 向所有连接写 `: ping\n\n`，`timer.unref()` 防止阻止进程退出。
- 连接管理：`Map<userId, Set<res>>`；`req.on('close')` / `res.on('close')` 时移除。写失败（`res.writableEnded`）也要移除。
- 广播函数 `broadcast(userIds, event, payload)`：只发给目标用户的连接，发送者不收到自己的消息。
- SSE 是 **GET**，不需要 `X-Workbench` 头；鉴权走 Cookie（`EventSource` 同源请求自动携带 Cookie）。

---

## 5. 前端设计

### 5.1 文件清单与依赖顺序

| 序 | 文件 | 动作 | 依赖 |
|---|---|---|---|
| 1 | `src/lib/apiClient.js` | 追加 7 个方法 | — |
| 2 | `src/store/useChatStore.js` | 新建 | 1 |
| 3 | `src/components/chat/MessageBubble.jsx` | 新建 | — |
| 4 | `src/components/chat/ChatWindow.jsx` | 新建 | 2,3 |
| 5 | `src/pages/MessagesPage.jsx` | 新建 | 2,4 |
| 6 | `src/hooks/useChatRealtime.js` | 新建 | 2 |
| 7 | `src/components/layout/Layout.jsx` | 修改：挂载 `useChatRealtime()` | 6 |
| 8 | `src/components/layout/Sidebar.jsx` | 修改：加入口 + 未读角标 | 2 |
| 9 | `src/App.jsx` | 修改：注册 `/messages` 路由 | 5 |
| 10 | `src/pages/ProjectDetailPage.jsx` | 修改：新增「群聊」Tab | 4 |

### 5.2 `apiClient.js` 追加方法

```js
getChatConversations()                                   // GET  /chat/conversations
getChatMessages(projectId, { before, limit } = {})       // GET  /chat/projects/:id/messages
sendChatMessage(projectId, { content, mentions, replyToId })
markChatRead(projectId, lastReadAt)                      // PUT  /chat/projects/:id/read
getChatUnread()                                          // GET  /chat/unread
recallChatMessage(messageId)                             // DELETE /chat/messages/:id
```
> SSE 不走 apiClient（EventSource 无法自定义头），直接在 store 里 `new EventSource('/api/chat/stream')`。注意要用 `import.meta.env.VITE_API_URL` 同源前缀，默认 `/api`。

### 5.3 `useChatStore.js`

```js
state:
  conversations: []
  conversationsLoading: false
  messagesByProject: {}      // projectId -> 消息数组（升序）
  hasMoreByProject: {}       // projectId -> boolean
  loadingMessages: {}        // projectId -> boolean
  activeProjectId: null
  unreadTotal: 0
  unreadByProject: {}
  mentionByProject: {}
  sseConnected: false
  settings: { sound: true, desktop: true }   // ← 唯一持久化字段

actions:
  fetchConversations()
  fetchUnread()
  openProject(projectId)         // 首次进入拉最近 50 条 → markRead
  closeProject()
  loadMore(projectId)            // 上拉加载更早
  sendMessage(projectId, content, mentions, replyTo)
  markRead(projectId)
  recallMessage(messageId)
  receiveMessage(message)        // SSE 到达时调用：入库 + 更新会话摘要 + 未读 +1（非当前会话时）
  refreshActiveUser()            // 切换账号时重置
  setSetting(key, value)
persist: { name: 'pw_chat', partialize: (s) => ({ settings: s.settings }) }
```

**去重**：`receiveMessage` 与 `sendMessage` 都要按 `id` 去重（发送方本地乐观插入 + SSE 回推可能重复）。

### 5.4 `ChatWindow.jsx`（核心组件）

Props：`{ projectId, className, height }`

结构：
- **头部**：群名（`项目编号 · 项目名`）+ 成员数 + 成员头像堆叠（最多 5 个 + `+N`）+ 提醒开关按钮（音效/桌面通知下拉）+ 刷新按钮
- **消息区**：`flex-1 overflow-y-auto`；顶部「加载更早消息」按钮（`hasMore` 为真时）；消息分组（同一发送者 5 分钟内连续消息合并显示，可选）
- **输入区**：
  - 引用条（有回复目标时显示，带 × 取消）
  - 提及下拉：输入框检测到 `@` 时弹出群成员列表（支持拼音/姓名过滤，可用 `@/lib/pinyinMatch`），选中后插入 `@姓名 ` 并把 userId 记入本次提及集合
  - `textarea`（自适应高度 1~5 行）
  - 发送按钮（内容为空时禁用）
- **交互**：`Enter` 发送、`Shift+Enter` 换行；发送后清空并滚到底部；新消息到达时若已在底部则跟随滚动，否则显示「有新消息 ↓」提示。

### 5.5 `MessageBubble.jsx`

Props：`{ message, isMine, showSender, members, onReply, onMentionClick }`
- 自己的消息靠右、`bg-primary-500 text-white`；他人靠左、白底 + 边框；头像取自成员 `avatarColor`，取不到用 `#6b7280`
- 引用块：浅灰背景 + 左侧竖线，显示被引用人姓名与内容摘要
- `@某某` 用正则 `/(@[^\s@]{1,20})/g` 高亮（`text-primary-600 font-medium`），点击可在成员中找到则触发 `onMentionClick(userId)`；`mentions` 含当前用户时，气泡左侧加一条橙色竖线标识「@我」
- 时间：同一分钟内连续消息只在最后一条显示时间；`title` 显示完整时间

### 5.6 `MessagesPage.jsx`（微信式两栏）

- 左栏（`w-72`）：搜索框（按项目名/编号过滤）+ 会话列表（头像色块、项目名、最后一条消息摘要、时间、未读红点/`99+`）
- 右栏：`ChatWindow`；未选中会话时显示空态
- 支持 URL 参数 `?project=<id>` 直接定位会话（来自通知 `link`）
- 移动端（`< lg`）：列表与聊天窗口互斥显示，带返回按钮

### 5.7 `Sidebar.jsx`

在 `NAV_ITEMS` 中「待办提醒」之后插入：
```js
{ path: '/messages', label: '项目群聊', icon: MessageSquare }
```
（`MessageSquare` 从 `lucide-react` 引入）
角标：`unreadTotal > 0` 时在右侧渲染红色圆点数字（折叠态时绝对定位在图标右上角）。角标数据来自 `useChatStore`。

### 5.8 `ProjectDetailPage.jsx`

- `TABS` 数组在「成员」之前插入 `{ key: 'chat', label: '群聊', icon: MessageSquare }`
- Tab 内容：`{activeTab === 'chat' && <ChatWindow projectId={id} height="560px" />}`
- Tab 标签右侧显示该群未读数小圆点

### 5.9 `useChatRealtime.js`

```js
export function useChatRealtime() {
  // 1. isAuthenticated 时 connectSSE()，登出时 disconnectSSE()
  // 2. 收到 message 事件 → store.receiveMessage(msg)
  //     若 (document.hidden || activeProjectId !== msg.projectId)：
  //        - settings.desktop && Notification.permission === 'granted' → new Notification(...)
  //        - settings.sound → playDing()
  // 3. 首次进入时若 Notification.permission === 'default'，在用户首次点击时请求授权（不要自动弹）
  // 4. SSE onerror → sseConnected=false，并启动 15s 轮询 fetchUnread() 兜底；onopen → 恢复
  // 5. 页面 visibilitychange 回到前台时 → fetchUnread() 对齐一次
}
```

**提示音**（无需音频文件）：
```js
function playDing() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.36);
  setTimeout(() => ctx.close(), 500);
}
```

---

## 6. 验收标准

1. `npm run build` 零错误、零新增警告。
2. 启动 `node server/simple-server.js` 后：
   - 未登录访问 `/api/chat/conversations` → 401
   - 登录后 `GET /api/chat/conversations` 返回项目群列表
   - `POST /api/chat/projects/:id/messages`（带 `X-Workbench: 1`）成功；不带该头 → 403
   - 群内其他成员的 `notifications` 出现对应通知
   - `PUT /api/chat/projects/:id/read` 后 `GET /api/chat/unread` 该群计数归零
   - `GET /api/chat/stream` 返回 `text/event-stream` 并立即收到 `ready` 事件
3. 前端：两个浏览器（或两个账号）同时登录，A 发消息 → B 侧边栏红点 +1、桌面通知弹出、进入会话后红点消失。
4. 回归：仪表盘 / 项目列表 / 任务 / 待办 / 通知中心 / 登录登出 均正常。

---

## 7. 风险与规避

| 风险 | 规避 |
|---|---|
| 老库缺字段导致 500 | `loadData()` 补默认值 + `chat.js` 内部再做一次 `ensureCollections` 兜底 |
| SSE 被代理缓冲 | 响应头带 `X-Accel-Buffering: no`；`deploy/nginx.conf` 若已有 `/api` 段，补 `proxy_buffering off; proxy_read_timeout 3600s;` |
| 通知表膨胀 | 同项目 5 分钟聚合 + 每成员每群仅保留未读聚合条 |
| 动 `simple-server.js` 引入回归 | 仅三处增量改动，不改任何既有路由逻辑 |
| 角色/权限判定与既有不一致 | 只读复用 `accessControl.js` 的导出函数，不修改该文件 |
| `project-workbench/src` 误改 | 所有改动限定在根目录 `src/` 与 `server/` |
