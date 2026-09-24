# 即时通讯增量设计 V2：单聊 + 渲染加固 + BPM 隔离

> 日期：2026-09-18 · 交付总监（Qi）基于 V1（docs/chat-feature-design.md）实地核实后编写
> 本文档是接口契约与实现清单，工程师须严格遵守，不得自行改设计。

---

## 0. 本轮需求与核实结论

| # | 用户需求 | 核实结论 / 方案 |
|---|---------|----------------|
| 1 | 群聊消息不要触发「项目任务信息给 BPM」，消息留在群聊功能范围内 | 已审计全部 qingflow 推送调用点（simple-server.js 仅在任务创建/待办创建/逾期催办/项目归档合并时推送），**群聊链路从未接入 BPM**。本轮：① 在代码中显式固化该约束（注释 + 单聊同样不接入）；② 交付时向用户说明，请其若在轻流端再次观察到异常则截图反馈 |
| 2 | 单人聊天：项目群聊左侧列表点击项目后，项目成员作为二级菜单展开成卡片；点成员卡片，右侧打开与该成员的单聊；消息只发给该成员 | 本设计主体，见下文 |
| 3 | 回复（返回）的消息没有发送人信息，大家不知道是谁在回复 | 加固：**非本人消息永远显示头像+姓名**，不再因「同发送者 5 分钟内连续消息」分组而隐藏（分组仅用于时间显示） |

---

## 1. 现状事实（已核实，勿重复勘察）

- 后端：`server/chat.js`（约 600 行）承载全部群聊逻辑；`server/simple-server.js` 末尾 404 前转发 `await chat.handle(req,res,ctx)`。零外部依赖。
- 数据：`data/workbench.db`（JSON），群聊集合 `chatMessages` / `chatReads`。
- SSE：`GET /api/chat/stream`，`Map<userId, Set<res>>` 连接管理，事件 `ready` / `message` / `recall`，25s 心跳（unref）。
- 鉴权：Cookie `workbench_session` → `ac.getUserId(req)`；POST/PUT/DELETE 全局校验 `X-Workbench: 1`。
- 前端：`useChatStore`（仅持久化 settings）、`useChatRealtime`（SSE + 15s 降级轮询 + 401 退避）、`MessagesPage`（左列表右聊天）、`ChatWindow`（仅群聊模式）、`MessageBubble`（showSender 由 5 分钟同发送者分组控制）。
- 成员数据前端已有全量（`useMemberStore`，1073 人），二级菜单成员卡片**无需新后端接口**，用群会话的 `memberIds` 过滤即可。
- **BPM（轻流）推送白名单**（全部在 simple-server.js/qingflow 调用链上）：notifyTaskCreated（任务创建）、notifyTodoCreated（待办创建）、notifyOverdue（overdue/escalation 通知）、notifyProjectMerged / notifyProjectArchived。**聊天模块（chat.js）零 qingflow 依赖，本轮必须保持。**

---

## 2. 数据模型（新增两个集合）

```js
// data/workbench.db 新增键（loadData 兼容补全，默认 []）
data.chatDirectMessages = [
  {
    id, fromId, toId,            // 发送者 / 接收者（成员 id）
    senderName,                  // 冗余，快照发送时姓名
    content,                     // ≤2000 字符
    replyTo: { id, senderName, content } | null,  // 引用快照，仅限双方之间的消息
    createdAt,                   // ISO
    recalled: false,
  },
];
data.chatDirectReads = [
  { id, userId, peerId, lastReadAt }   // 每人每对方一条游标
];
```

单聊**不建**显式会话表：会话列表由 `chatDirectMessages` 按「与我相关的对方 id」聚合推导。

## 3. 后端 API 契约（全部挂在 chat.js 内，`/api/chat` 前缀）

统一：未登录 401；写操作走全局 `X-Workbench: 1` 校验；内容 trim 非空（400）、超 2000 截断；一次请求只 `saveData` 一次；异常兜底 500。**严禁 require/调用 qingflow。**

| 方法与路径 | 说明 |
|---|---|
| `GET /api/chat/directs` | 当前用户单聊会话列表：从 `chatDirectMessages` 中取与我相关（fromId=me 或 toId=me）的消息按对方分组，返回 `[{ peerId, peerName, peerAvatarColor, lastMessage, lastMessageAt, unreadCount }]`，按 lastMessageAt 倒序。对方已删除则跳过该组。`peerName/peerAvatarColor` 从 members 实时取 |
| `GET /api/chat/directs/:peerId/messages?before=&limit=` | 与某成员的历史消息（双向），升序、`{ messages, hasMore }`，limit≤200 默认 50，before=ISO 游标。peer 不存在 → 404 |
| `POST /api/chat/directs/:peerId/messages` | body `{ content, replyToId? }`。校验：peer 存在且 ≠ 自己（400/404）；replyToId 必须是双方之间（fromId/toId 覆盖双方）的已有消息，否则 replyTo=null。副作用：① push 消息；② 给 toId 发**站内通知**（type=`chat_direct`，relatedType=`chat_direct`，relatedId=fromId，title=`${senderName} 给你发来消息`，message=内容预览 ≤60 字，link=`/messages?peer=${fromId}`）；聚合：toId 对 fromId 已有未读 `chat_direct` 通知且 5 分钟内 → 更新 chatCount、`message=${senderName} 发来 ${chatCount} 条新消息`、刷新 created_at；③ `broadcast([toId], 'dmessage', message)`。**发送者本人不收自己的 dmessage。绝不调 qingflow。** |
| `PUT /api/chat/directs/:peerId/read` | body `{ lastReadAt? }`，更新 chatDirectReads 游标 |
| `DELETE /api/chat/directs/messages/:id` | 撤回：发送者本人或 admin，5 分钟内（同群聊规则）；`recalled=true, content='', replyTo 保留`；`broadcast([fromId, toId] 去重, 'drecall', { id, fromId, toId })`（含发送者，多端同步） |
| `GET /api/chat/unread`（扩展，向后兼容） | 返回增加 `directTotal` 与 `byPeer`；`total` 改为 **群聊 + 单聊之和**（Sidebar 总红点自动覆盖单聊）；`byProject` / `mentionByProject` 语义不变 |

SSE 新事件（复用现有 stream 连接与心跳，不动连接管理）：
- `event: dmessage`，data = 完整单聊消息对象（含 senderName）。
- `event: drecall`，data = `{ id, fromId, toId }`。

`handleUnread` 群聊部分逻辑不变；`ensureCollections` 增加 `chatDirectMessages` / `chatDirectReads` 兜底；`simple-server.js` 的 loadData 兼容段增加这两个键的默认值（仅这两行）。

## 4. 前端设计

### 4.1 `src/lib/apiClient.js`（只追加，不改已有）
`getDirectConversations()` / `getDirectMessages(peerId, {before, limit})` / `sendDirectMessage(peerId, {content, replyToId})` / `markDirectRead(peerId, lastReadAt)` / `recallDirectMessage(messageId)`。

### 4.2 `src/store/useChatStore.js`（扩展，保留既有动作语义）
新增 state：`directConversations: []`、`messagesByPeer: {}`、`hasMoreByPeer: {}`、`loadingByPeer: {}`、`unreadByPeer: {}`、`directTotal: 0`、`activePeerId: null`。
新增动作：`fetchDirectConversations` / `openPeer(peerId)`（语义同 openProject：无缓存拉 50 条，有缓存秒显+后台对齐合并，**合并逻辑必须复制群聊现版含 olderLocal/inFlight 与 hasMore 纠正**）/ `closePeer` / `loadMoreDirect(peerId)` / `sendDirect(peerId, content, replyTo)`（乐观插入+去重）/ `markDirectRead(peerId)`（本地清零+上报）/ `recallDirect(id)` / `receiveDirect(message)`（SSE 到达：入库+摘要+`unreadByPeer/directTotal +1`（非当前会话））/ `applyDirectRecall(payload)` / `fetchUnread` 扩展写 directTotal/unreadByPeer。
`refreshActiveUser` 必须重置以上全部新字段。
`markRead`（群聊）与 `markDirectRead` 都只清自己的维度，互不干扰 total：fetchUnread 以后端 total 为准覆盖。

### 4.3 `src/components/chat/ChatWindow.jsx`（改造为双模式）
Props 增加：`mode: 'project' | 'direct'`（默认 project）、`peerId`。
- direct 模式：消息源 `messagesByPeer[peerId]`；标题=成员姓名+单聊标识「单聊」，头像用成员 avatarColor；隐藏成员堆叠与 @提及下拉（提及相关代码路径不触发）；输入区/引用回复/撤回/滚动/加载更早逻辑与 project 模式共用，发送走 `sendDirect`，进入会话走 `openPeer`。
- project 模式行为完全不变。

### 4.4 `src/pages/MessagesPage.jsx`（左侧树形二级菜单）
- 项目行改造为两段式：**chevron 按钮**（展开/收起成员区，展开时旋转 90°）+ **主体**（点击打开群聊，保留现有选中态/搜索/时间/摘要/群未读红点）。
- 展开区：该项目 `conversation.memberIds` → memberStore 查详情 → 成员卡片列表（头像 + 姓名，最多展示后滚动，max-h 限制）；**过滤掉自己**；每张卡片右侧显示与该成员的单聊未读小圆点（`unreadByPeer[memberId] > 0`）。
- 点击成员卡片：右侧打开 `ChatWindow mode="direct" peerId={id}`；卡片高亮选中。选中的会话类型（群/单）互斥。
- 展开项目时懒加载成员（数据本地已有，无网络请求）。
- 移动端互斥显示规则沿用现有实现。

### 4.5 `src/hooks/useChatRealtime.js`
- 新增监听 `dmessage`：`receiveDirect(msg)` + 桌面通知/提示音（标题 `${senderName} 给你发来消息`，body=内容预览；沿用 settings 开关与 document.hidden/activePeerId 判断）。
- 新增监听 `drecall`：`applyDirectRecall(payload)`。
- 降级轮询扩展：fetchUnread 已含 directTotal（后端合并），无需额外轮询单聊列表。

### 4.6 `src/components/chat/MessageBubble.jsx`（需求 3 加固）
- **非本人（!isMine）消息永远显示头像与姓名**：删除「分组首条才显示」的隐藏行为（`showSender` prop 保留签名但仅对 !isMine 恒生效为 true）。
- `ChatWindow.buildGroups` 只再控制 `showTime`（同发送者 5 分钟内末条显示时间），不再影响姓名/头像。
- 引用条保持显示 `replyTo.senderName`（已实现）。

## 5. BPM 隔离（需求 1+2，2026-09-24 修订）

> **修订（2026-09-24，第二轮）**：在首轮「群聊经轻流触达企微、链接直达项目群聊页」基础上，
> 新增**单聊推送**——项目下成员给同项目另一成员发单聊，经轻流推送给**接收方本人**，
> 链接直达接收方在该项目下与发送方的单聊界面（`/messages?peer=<senderId>&project=<id>`，
> **peer=发送方**），接收方点开即可直接回复。两项推送均经 SSO 免登，与任务推送（`/task/:id`）严格区分。
>
> **实现方式（chat.js 始终零 qingflow 依赖）**：
> - `server/qingflow.js` 新增 `notifyChatMessage()`（群聊，`[项目群聊]` 前缀、zrr=所有项目成员并集、链接 `/messages?project=<id>`）
>   与 `notifyDirectMessage()`（单聊，`[项目私信]` 前缀、zrr=仅接收方、链接 `/messages?peer=<senderId>&project=<id>`，
>   **peer 用发送方 id**——链接由接收方点开，从其视角单聊对象是发送方；误用 receiverId 会落成「和自己的单聊」而落到空的项目级视图（2026-09-24 实测修正））；
>   二者均支持可选 `chatQsourceId` 独立 Q-Source（未配置则回退共用任务 Q-Source）。
> - `simple-server.js` 构造 ctx 时注入 `onGroupMessage` / `onDirectMessage` 两个钩子桥接：
>   群聊推所有项目成员（接收人=项目成员并集，排除发送者），单聊仅推接收方一人。
> - 均为 fire-and-forget，失败不影响消息收发本身（仅 warn/catch 日志）。
> - `QINGFLOW_CONFIG_PATH` 环境变量可覆盖推送配置文件路径（隔离测试/部署用）。

历史约束（原实现，部分已被上述修订取代）：
1. chat.js 本体仍不 require/call qingflow；推送经 ctx 钩子触发（分层保留）。
2. 单聊通知 type=`chat_direct`，不匹配 POST /api/notifications 的 `overdue|escalation` 推送白名单；单聊的轻流推送走独立的 `onDirectMessage` 钩子（与群聊的 `onGroupMessage` 分离）。
3. 既有任务/待办/逾期/项目推送调用点未改动，taskUrl 语义不变。

## 6. 验收标准

1. `npm run build` 零错误（既有 chunk 警告允许）。
2. 群聊回归：V1 全部行为不回退（会话/未读/SSE/撤回/聚合/红点）。
3. 单聊：A 点开项目 → 展开成员卡片 → 点 B → 发消息 → B 红点 +1（Sidebar 总数含单聊）、铃铛出现「XX 给你发来消息」、桌面通知+提示音；B 回复仅 A 可见；双方互看历史一致升序；撤回双端同步。
4. 未读：`GET /api/chat/unread` 的 total=群+单；进入单聊后该 peer 归零、群未读不受影响。
5. 渲染：接收方视角所有他人消息均显示头像+姓名；引用条显示原发送人。
6. **BPM 隔离审计**：`server/chat.js` 中 qingflow 零引用（推送经 ctx 钩子触发，不直接调用）；群聊/单聊消息均经 `onGroupMessage`/`onDirectMessage` 钩子桥接轻流，链接分别指向群聊页（`/messages?project=<id>`）与单聊界面（`/messages?peer=<senderId>&project=<id>`，peer=发送方），与任务推送（`/task/:id`）区分。
7. 权限：未登录 401；peer 不存在 404；给自己发消息 400；撤回他人消息（非 admin）403。
8. 生产库 `data/workbench.db` 测试期间零写入（QA 用副本）。

## 7. 边界与说明

- 单聊不依赖项目：同一成员可从多个项目入口进入同一单聊，消息唯一（按二人对话聚合），不会因项目不同而分叉。
- 单聊通知也走站内铃铛（用户已认可红点/铃铛体验），这不属于 BPM。
- 成员被删除后：历史消息保留，会话列表跳过已删除对方。
