# 安全加固 P0 + P1 修复说明

> 实施日期：2026-09-14
> 对应漏洞清单：S1 身份伪造 / S2 轻流接口无鉴权 / S3 SSO dev 弱密钥 / S4 默认弱密码 / S5 请求体无大小限制

## 二次加固（P2 批次，2026-09-15）

补漏 6 项：

### ① 成员名册脱敏（严重）
`GET /api/members` 不再下发 `password` 字段（登录凭证不应进浏览器 localStorage）。
登录页靠 `POST /api/auth/login` 后端校验，不再依赖本地名册比对密码，故不影响登录。

### ② 通知路由去重 + 改 cookie 身份（严重）
删除 1469-1524 行 legacy 重复段（含 `members` legacy GET/POST、`notifications` legacy GET/POST，
后段 1516/1570+ 已覆盖）；统一后段通知路由：
- `GET /api/notifications` 按 `ac.getUserId(req)`（cookie 身份）过滤，不再信 query `userId`
- `POST /api/notifications` 归属 `user_id` 以会话身份为准，`body.user_id` 不得伪造

### ③ 成员重置密码持久化
新增 `PUT /api/members/:id/reset-password`（admin 鉴权，规则 邮箱@前缀+Yj1018!）；
前端 `useAuthStore.resetPassword` 改为调该接口并 `fetchMembers()` 刷新，不再只改本地 store。
`apiClient` 新增 `resetMemberPassword(id)`，`MembersPage.confirmResetPassword` 改 await。

### ④ 登录限流
`POST /api/auth/login` 按 IP 滑动窗口（60s / 5 次），超限返回 429。
`getClientIp` 支持 `x-forwarded-for`，`loginAttempts` Map 定期清理防泄漏。

### ⑤ SSO ticket 失败限次
`verifyTicket` 签名失败计数，单 ticket 连续 5 次失败即删除该 ticket 并返回 `ticket_blocked`，
防暴力签名枚举；校验通过则清除计数。

### ⑥ CORS 收紧
去掉 `Access-Control-Allow-Origin: '*'`，改为按 `ALLOWED_ORIGIN`（或 `VITE_API_ORIGIN`，逗号分隔）白名单
动态回显 Origin + `Access-Control-Allow-Credentials: true`。
本地同源（vite 代理）无 Origin 头，行为不变；跨域部署需配白名单，否则拒绝。
通过模块级 `currentReq` 在请求入口赋值，165 处 `sendResponse` 调用无需改动。

#### 部署提示
跨域部署时启动命令需：`ALLOWED_ORIGIN=https://workbench.yourcorp.com SSO_SECRET=... NODE_ENV=production node server/simple-server.js`

## 核心变更

### 1. 身份传递模型变更（P0-S1）

**之前**：前端在 localStorage 存 `currentUserId`，每个 API 请求通过 `x-user-id` 头手动附加，后端 `ac.getUserId` 直接信任该头。攻击者可伪造任意用户 ID。

**现在**：
- 后端登录（邮箱密码 `POST /api/auth/login` / SSO 兑换 `GET /api/auth/me`）成功后，签发 **`workbench_session`** HttpOnly Cookie（session token，TTL 7 天，存于后端内存 `sessionStore`）
- 后续 API 请求由浏览器自动携带该 cookie，`ac.getUserId` 仅从 cookie 解析 session token 还原身份，**不再接受 `x-user-id` 头或 query `userId`**
- 登出调用 `POST /api/auth/logout` 撤销会话并清 cookie

#### 受影响文件

| 文件 | 变更 |
|---|---|
| `server/auth.js` | 新增 `issueSession` / `getSession` / `destroySession`，`sessionStore`（内存 Map） |
| `server/accessControl.js` | `getUserId(req)` 只读 `workbench_session` cookie，拒绝裸头 |
| `server/simple-server.js` | 新增 `POST /api/auth/login`、`POST /api/auth/logout`；`GET /api/auth/me` 成功后种会话 cookie；CORS 头去除 `x-user-id` |
| `src/lib/apiClient.js` | `request()` 不再加 `x-user-id` 头，全部请求加 `credentials: 'include'`；新增 `login(email,password)`、`logout()` |
| `src/store/useAuthStore.js` | `login` 改为调 `apiClient.login` 后端校验后种 cookie；`logout` 调 `apiClient.logout` |
| `src/pages/LoginPage.jsx` | `handleSubmit` 中 `login(email, password)` 加 `await`（变 async） |

#### 功能影响

- 首次打开系统后**必须重新登录一次**（旧 cookie 模型下浏览器里残留的 `x-user-id` 头不再被信任）
- 局域网/浏览器同源访问（vite 代理 `/api` → `localhost:3000`）下 `credentials: 'include'` 与 HttpOnly cookie 配合即可，**不影响 SSO 跳转流程**
- 若生产环境前端与后端跨域部署（`VITE_API_URL` 指向不同 host），需确保 CORS `Access-Control-Allow-Credentials: true` 且 `Access-Control-Allow-Origin` 不能是 `*`（需指定具体 origin）——这是后续 P2 部署时再处理的项

### 2. 轻流接口 admin 鉴权（P0-S2）

以下 5 个路由新增 `if (!ac.isAdmin(data, userId)) return 403` 守卫：

| 路由 | 说明 |
|---|---|
| `POST /api/qingflow/config` | 修改轻流推送配置（含 secret） |
| `GET  /api/qingflow/test` | 连接测试（会实际调第三方接口） |
| `POST /api/qingflow/form-data` | 向轻流注入数据 |
| `POST /api/qingflow/sync-config` | 修改同步配置（含 client_secret） |
| `POST /api/organization/sync` | 轻流组织架构同步 |

普通成员访问将收到 403，仅 admin 可操作。`ReminderSettingsPage` 已限定 admin 访问，无 UI 影响。

### 3. SSO 密钥生产强制（P1-S3）

`server/auth.js` `getSecret()`：
- 优先级：`SSO_SECRET` env > `pushConfig.ssoSecret` > 内置 dev key
- **生产（`NODE_ENV === 'production'`）下若未配置前两者，直接抛错拒绝启动**
- 非生产环境打印警告，允许 dev key

部署说明：生产启动命令需 `NODE_ENV=production SSO_SECRET=<32+ 字节随机>`。

### 4. 同步成员默认密码规则（P1-S4）

`server/qingflow.js` 新增 `buildDefaultPassword(email)`：默认密码 = **邮箱 @ 前缀 + 固定后缀 `Yj1018!`**（例：`zhangsan@corp.com` → `zhangsanYj1018!`）。同步新成员使用此规则，便于成员首次登录（可登录后再改密）。

> 注：`useAuthStore.resetPassword`（管理员重置成员密码）同步使用相同规则，保持前后端一致。

### 5. 请求体大小限制（P0-S5）

`parseBody` 加入 1 MB 上限，超出返回 `{ __tooLarge: true }` 并 `req.destroy()`。各路由若需严格 413 响应可在后续扩展。

## 未改动项（P2）

- CORS 仍为 `Access-Control-Allow-Origin: '*'`，跨域部署前需收紧
- DB 写文件无并发锁（`saveData` 串行化）
- SSO ticket 仍为多次有效（30 天 TTL）

## 验证清单

- [ ] `node -c` 四个后端文件语法 OK
- [ ] `vite build` 前端 3332 模块编译通过
- [ ] 本地登录后调用 `/api/projects` 返回按 cookie 身份过滤的数据
- [ ] 非 admin 调 `POST /api/qingflow/config` 返回 403
- [ ] 生产 `NODE_ENV=production` 且无 `SSO_SECRET` 时启动报错
