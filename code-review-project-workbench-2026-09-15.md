# 工程审查报告 — D:\AI\project-workbench（工作流 1 综合代码审查 + 架构评估 + 测试评估）

**日期**：2026-09-15
**工作流**：工作流 1（全面工程审查）+ 工作流 3（事故响应演练）
**参与成员**：Cody（代码审查师）、Archi（系统架构师）、Tessa（测试专家）、Rex（SRE 工程师）
**审查对象**：`D:\AI\project-workbench`（React 18 + Vite 5 + Zustand，前后端分离；Node/Express 后端代码不在仓库内）
**范围**：`src/` 全部 + `package.json` + `vite.config.js` + `index.html`；不含 `node_modules` / `dist` / `itc-platform`

---

## 📌 TL;DR（执行摘要）

- 整体结论：**Request Changes**。架构与身份链路整改方向正确（HttpOnly cookie 鉴权已落地、SSO 302+cookie 方案工程化好），但「明文密码全链路」问题成立：`pw_members` 明文密码持久化 localStorage + 前端明文比对/改密 + 内置 8 个弱口令种子账号 + 乐观更新吞错无回滚。
- 严重度分布：🔴 严重 6 项 / 🟠 高 7 项 / 🟡 中 6 项 / 🟢 低 4 项（Cody 与 Archi 产出去重合并后）
- 阻塞项：C1–C4 四项 Critical 必须在合入前修复；CSRF 防护未闭环（依赖后端确认）
- 测试现状：全仓 0 测试、0 测试框架、0 CI 门禁——测试债为全项目最高优先级结构债
- 事故演练（Rex）：「localStorage 明文缓存成员密码」场景定级 **SEV2**，P0 三项可在 60 分钟内止血闭环

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| 整体评级 | 🔴 不通过（Request Changes） |
| 阻塞项数量 | 4（C1 明文密码落盘 / C2 改密全链路明文 / C3 ssoTicket 落盘 / C4 弱口令种子） |
| 非阻塞高危 | CSRF 无防护（需后端确认 SameSite/Origin 校验现状）、乐观更新吞错（7 个 store 同模式）、dev server 0.0.0.0 无鉴权 |
| 关键行动项 | 14 条（见行动清单，P0 共 7 条） |
| 建议下一步 | P0 7 项 + P1 5 项（约 8.5 人日）完成后再复审；测试框架（vitest）与 CI 门禁同步启动 |

---

## 🔍 综合审查发现（按严重度排序，已去重）

### 🔴 严重（6 项）

| # | 类别 | 文件:行 | 问题描述 | 建议修复 | 来源 |
|---|------|---------|---------|---------|------|
| S1 | 安全 | `useMemberStore.js:60-64` + `App.jsx:69` | 明文密码持久化到 localStorage（`pw_members` 全量 persist，无字段过滤）。登录后 fetchMembers 拿到含 password 明文的数组落盘；XSS 一键全库窃密；共用浏览器场景下同机他人直接可读。注释还明确"不能清 pw_members 否则登录页无账号匹配"——业务设计依赖本地明文名册 | ① 后端 GET /members 剔除 password；② 前端删除本地 email+password 比对，仅认 /auth/login cookie 成功；③ persist 加 partialize 白名单 | Cody + Archi(R1a) |
| S2 | 安全/正确性 | `useAuthStore.js:98-112` + `useMemberStore.js:32-45` | changePassword 前端明文比对旧密码 + 新明文密码经乐观更新写回 `pw_members`。"验密"逻辑建立在本地可写数据上；本地明文已改但后端失败时仅 console.error，出现"本地改了、后端没改"漂移 | 改密走专用后端端点 /auth/change-password（后端校验+哈希落库），前端不再携带/存储明文 | Cody |
| S3 | 安全 | `useAuthStore.js:54-64` | ssoTicket 凭证类令牌写入 pw_auth localStorage（非 HttpOnly），可被 XSS 读取重放。ssoConsume 实际走 302+cookie 后 ticket 已无用途 | 删除 ssoTicket/ssoLoginAt 持久化，保留仅 email+时间戳审计字段并 partialize 排除 | Cody |
| S4 | 安全 | `seedData.js`（8 处）+ `initSeedData:772-774` | 代码库内置 8 个含弱明文密码种子账号（admin123 / wang123 / …，含 admin `cio@example.com/admin123`），成员列表为空时自动注入，形成可预测弱管理员入口 | 种子剥离 password；空库走"初始密码随机生成一次性展示"流程；CI 增加 secret-scan | Cody + Archi(R3b) |
| S5 | 安全 | `vite.config.js:13-23` + 全前端 | CSRF 防护缺位：同站 `/api` + `credentials:'include'` + 大量写端点（归档/合并/重置密码），前端 0 自定义头校验、未见 CSRF token；cookie SameSite 属性未确认。任何恶意网页可代持会话 cookie 发起写操作 | 后端 cookie `SameSite=Lax` + 校验 Origin 或自定义请求头（apiClient 统一加 `X-Workbench`）；先向后端确认现状 | Archi(R2) |
| S6 | 安全 | `usePermissions.js:14-18` | `can()` 在 currentUser 为空时返回 `true`（默认全权限），与 `useAccess.js` 的 fail-closed 语义直接矛盾。members 未拉取完成窗口内 UI 按全权限渲染，越权 UI 暴露（操作虽被后端拦截） | 改 fail-closed：`if (!currentUser) return false`，加载中用 loading 态；统一两个 hook 语义 | Cody(H2) |

### 🟠 高（7 项）

| # | 类别 | 文件:行 | 问题描述 | 建议修复 | 来源 |
|---|------|---------|---------|---------|------|
| H1 | 正确性 | `useMemberStore.js:32-58` + 同模式波及 useDocument/useMilestone/useRisk/useResource/useNotification 共 7 个 store | 乐观更新吞错无回滚：先 set 本地，API 失败仅 console.error，不回滚不抛错不重新对齐。后端 403/409 时 UI 与数据永久漂移；deleteMember 失败后"复活"无提示 | catch 中回滚（保留 prev 快照）+ 返回 `{success:false,error}` + 失败后自动 fetch 对齐 | Cody(H1) |
| H2 | 架构 | `lib/storageAdapter.js`（全文件） | 死代码且逻辑损坏：全仓库无 import；local 分支里 `await this.getTasks()` 写成同步调用，一旦启用必抛 TypeError。API 化改造遗留雷 | 直接删除（dist 是产物，重 build 即可） | Archi(R3c) |
| H3 | 架构 | `lib/dataLayer.js` + `bootstrap.js` + `App.jsx` mount effect | 双源无对账：API 失败时仍写 localStorage（静默分叉），无冲突消解；`setIfEmpty` 在用户合法 0 数据时注入假种子进持久化层；App mount 手工 removeItem 10 个键（无 userId 命名空间，多 profile 互清） | 确立 API 为唯一事实源，localStorage 降级离线缓存；引入缓存命名空间 `pw_${userId}_*`；API 恢复后对账 | Archi(R3a/R3b) |
| H4 | 安全/运维 | `vite.config.js:13` `host:true` + `server.proxy` | dev server 绑定 0.0.0.0 无鉴权，作为团队日常入口使用；局域网任何设备可匿名直连 3000 后端（叠加 S1 可匿名取明文密码）。无进程守护、无健康检查、HTTP 明文 | dev 限 127.0.0.1；团队入口改 vite build + 静态/反代服务；pm2/nssm 守护 + /api/health 轮询告警 | Cody(H3) + Archi(R4) |
| H5 | 安全 | `useAuthStore.js:19-26` `login()` | 登录成功（cookie 已种）后仍依赖本地 members 明文比对定位 member.id；名册与后端不同步时用户被提示"刷新重试"，诱导二次输密。目录服务被做成客户端可写状态 | /auth/login 直接返回 `{userId}`，前端用返回值 set currentUserId，移除本地比对 | Cody(M2) + Archi(R1b) |
| H6 | 依赖 | `package.json` xlsx 0.18.5 | xlsx 2 个高危 CVE：CVE-2023-30533（原型污染 CVSS 7.8）+ CVE-2024-22363（ReDoS CVSS 7.5）。补丁版不在 npm 公共 registry（需 SheetJS CDN tarball）。本项目攻击面有限（本地 Excel 解析），但 ExcelImportModal 解析任意用户文件 | 换 `npm i https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` 或迁移 ExcelJS；导入前限制文件大小 | Cody（依赖扫描） |
| H7 | 架构 | `useProjectStore.js`（mergeProject/undoMerge） | "大炮式"刷新：合并/撤销成功后串行 await 8 次全量 fetch + 8 次全量 persist 写 localStorage，数据量增长后操作体验劣化且写放大叠加 H3 配额风险（QuotaExceededError 静默失效） | 合并/撤销改按 projectId 失效重取（后端已有 getProjectChildren/subtree）；entity store 工厂化 | Archi(R5) |

### 🟡 中（6 项）

| # | 类别 | 文件:行 | 问题描述 | 建议修复 | 来源 |
|---|------|---------|---------|---------|------|
| M1 | 正确性 | `MembersPage.jsx:355` | 重置密码对话框文案写死"密码将变为 `${email.split('@')[0]}123`"，与实际规则（邮箱@前缀+Yj1018!）不一致，用户按提示设置的密码是错的 | 删除预告文案，改用 resetPassword 返回后动态展示（resetResult 已有） | Cody |
| M2 | 正确性 | `apiClient.js:141-145` | `getProjectChildren(null)` 静默返回全部项目（不带过滤参数），与函数名语义不符 | null 时传 `__root__` 或显式抛错 | Cody |
| M3 | 可维护性/正确性 | `App.jsx:59-66` | mount 时 removeItem 晚于 zustand persist hydration（hydration 在 module 初始化阶段），旧值闪现窗口存在；`pw_members` 保留策略与删除清单混在同一 effect，未来误加 key 即删掉登录依赖 | 数据 store 改 `skipHydration` + 显式按需 load；删掉 mount 手工 removeItem；pw_members 注释隔离 | Cody |
| M4 | 安全 | `ChangePasswordForm.jsx:23` | 新密码仅校验 ≥6 位，无复杂度/与用户名相关检查；叠加 S4 弱口令种子，账户强度策略缺失 | 前端复杂度提示 + 后端强制策略（≥8 含大小写数字）；弱口令登录强制改密 | Cody |
| M5 | 可维护性 | `lib/bootstrap.js` 注释 | 文档过期：注释仍写"apiClient 通过 x-user-id 头带后端过滤"，与现行 cookie 方案矛盾，误导维护者 | 同步更新注释 | Archi |
| M6 | 正确性 | `lib/apiClient.js:530` `ssoExchange`/`ssoValidate` | SSO 302+cookie 方案已落地，ssoExchange/ssoValidate 保留但无调用方（死代码），且 ssoExchange 把 u/exp/sig 放 URL query | grep 验证无调用后删除 | Cody |

### 🟢 低（4 项）

| # | 类别 | 文件:行 | 问题描述 | 建议修复 | 来源 |
|---|------|---------|---------|---------|------|
| L1 | 安全 | `RiskMatrix.jsx:108` | `dangerouslySetInnerHTML` 当前注入面可控（内部函数生成 HTML），但后续拼接用户字段即成 XSS（叠加 S1 可批量窃密） | 改 JSX 渲染，删 HTML 字符串 | Cody |
| L2 | 可维护性 | `useInitApp.js` 整文件 | 无调用方（grep 验证），死代码 | 删除 | Cody |
| L3 | 安全（纵深） | `index.html` / 部署层 | 无 CSP；生产静态托管加 `default-src 'self'` 可显著降低 S1 类 XSS 窃密影响面 | 部署层（nginx/CDN）加 CSP | Cody |
| L4 | 可维护性 | `useProjectStore.js` 等 13 个 store | 无基础模板、13 份复制粘贴样板；错误处理细节不一致（member 乐观吞错 vs project 严格抛出）；useProjectStore import 6 个 store 成环 | 抽 `createEntityStore` 工厂 + 单向依赖纪律（UI store 不 import 其他 entity store） | Archi(ADR-A4) |

---

## 🏗️ 架构影响评估（ADR 摘要）

| ADR | 决策 | 状态 | 关键后果 |
|-----|------|------|---------|
| A1 localStorage 双写 | API 为唯一事实源，localStorage 降级离线缓存；删 storageAdapter.js；引入 userId 命名空间 + 对账 | 现状 Proposed | 消除静默分叉；离线队列需显式设计 |
| A2 身份双轨 | 保留双轨但 localStorage 侧降级展示态；加全局 401 拦截 → logout；禁止凭证类数据进 localStorage | 现状 Proposed | 掉线体验从"满屏失败"变"回登录页" |
| A3 代理拓扑 | dev server 仅自用；团队入口改 vite build + 静态/反代；cookie SameSite=Lax + Origin 校验；SSO 回调 base URL 改 env 可配 | 现状 Proposed | 消掉 CSRF 敞口与单点入口 |
| A4 store 分层 | 按领域拆分合理但缺纪律；工厂化 + 聚合上移 hook 层 + 失效重取替代全量重载；二期评估 TanStack Query | 现状 Proposed | 新增实体 80 行 → 10 行 |

**架构方向判断（Archi）**：API 为真源、cookie 鉴权、相对路径代理方向都正确；问题集中在遗留双写路径未清理、无对账机制、防护层（CSRF/401/密码脱敏）缺位、dev 拓扑被当作使用拓扑。**P0 三项（密码脱敏 + CSRF + 移除本地校验）投入约 2.5 人日可消掉最重的两个风险。**

---

## 🧪 测试策略评估（Tessa）

**现状**：全仓 0 测试文件、0 测试框架依赖（无 vitest/jest/playwright）、package.json 仅 dev/build/preview 三个 script、0 CI 门禁。

**分阶段策略**：
- **P0（阻断发布）**：vitest + @testing-library/react + MSW node 模式 mock 后端（fixture 快照化 + `vi.useFakeTimers` 处理 24h 边界）；P0 路径对应文件语句/分支 ≥90% 硬门禁
- **P1（P0 后 1 周）**：乐观更新四象限（成功/网络失败/409/竞态）、SSO ticket 过期与重放、合并撤销 24:00:00 三档边界 + 时区组、归档审批状态机合法/非法迁移 + 并发幂等
- **P2（暂缓 1 迭代）**：Playwright E2E 本期不引入——0 基线下 E2E 维护成本最高、信号最噪；触发条件 = P1 完成 + CI 稳定 2 周 + test SSO 桩环境就绪，届时仅覆盖 3 条黄金路径（登录→查看、乐观提交→回滚可见、归档审批全链），预算 ≤50 条

**Top 10 必测用例**：

| # | 模块 | 用例 | 优先级 |
|---|------|------|--------|
| 1 | 归档审批 | 非法状态迁移（已归档→编辑）必须被拒绝并保留原状态 | P0 |
| 2 | 归档审批 | 驳回后可回退编辑并重新提交，审计记录完整 | P0 |
| 3 | 合并/撤销 | 恰好 24:00:00 撤销被拒绝，23:59:59 允许 | P0 |
| 4 | 合并/撤销 | 撤销为合并的严格逆操作：任意 fixture merge→undo 后快照与原始一致 | P0 |
| 5 | 乐观更新 | 网络失败后 UI 回滚至服务端数据，无脏状态残留 | P0 |
| 6 | SSO | ticket 过期 1s 兑换返回 401，前端清空本地半成品会话 | P0 |
| 7 | 乐观更新 | 连续双击提交仅产生一次有效写入（幂等/去重） | P0 |
| 8 | SSO | 同 ticket 重放第二次兑换被拒绝 | P1 |
| 9 | 归档审批 | 双审批人并发操作，最终态唯一且幂等 | P1 |
| 10 | 24h 边界 | 服务器时区与浏览器时区不一致时以服务器时间为准 | P1 |

**覆盖率基线**：起步全仓语句 60%/分支 50% 软提示，P0 文件 90%/90% 硬门禁；状态机与日期边界函数分支 100% 单独门禁；每迭代 +10%，3 迭代后全仓 75%。

---

## 🚨 事故响应演练（Rex，Tabletop Exercise）

**场景**：「项目工作台成员敏感数据泄露 —— localStorage 明文缓存成员密码」（场景编号 EX-SENS-LEAK-001）

| 维度 | 结论 |
|------|------|
| SEV 评级 | **SEV2**（凭证泄露类安全事件，未达全站宕机；若确认密码跨系统复用或存在实际被读取证据 → 升级 SEV1） |
| 影响范围 | 所有曾加载过成员列表或执行过 changePassword 的浏览器 profile；共享/公共终端风险最高；`.gitignore` 已排除 `data/` 与 `Secret.txt`（需复盘时验证 git history） |
| 角色分配 | IC=工程总监 / Comms=Rex / 缓解执行=code-reviewer+architect / 根因=testing-expert+architect |
| 止血节奏 | T+15m 前端 patch（persist partialize 剔除 password）→ T+30m 通知成员走 /members/:id/reset-password 批量重置 → T+45m changePassword 改后端校验 → T+60m 确认恢复 → T+90m 关进复盘 |
| 5 Why 根因 | 密码进 localStorage（persist 无过滤）→ 无字段级审视（默认"持久化=安全"）→ changePassword 本地明文设计（密码被当作可本地持有数据）→ 无"敏感数据分级 + 前端不落盘"红线 → **安全评审未覆盖前端状态层，测试只验功能不验数据落地形态（系统性缺口，非个人失误）** |
| 演练结论 | 流程跑通；P0 三项 60 分钟可闭环；核心系统性缺口 = 前端敏感字段不落盘红线缺失 + 测试未覆盖数据落地形态 |

**预防措施**：persist 强制 partialize 白名单（CI 黑名单 lint 拦截密码类字段）；凭证操作一律后端处理；敏感数据分级规范文档；"localStorage 中不存在 password/secret 键"断言纳入回归；XSS 防护（CSP）演练。

---

## ✅ 行动清单（按优先级排序）

| # | 行动 | 负责角色 | 紧急度 | 预期完成 |
|---|------|---------|--------|---------|
| 1 | 后端 GET /members 响应剔除 password 字段 + 前端 persist 加 partialize 白名单（S1） | 后端 + Cody | P0 | 1 人日 |
| 2 | 删除 login() 本地 members 明文比对，/auth/login 返回 userId 直接定位身份（S6/H5） | Cody | P0 | 0.5 人日 |
| 3 | changePassword 改走后端 /auth/change-password，前端不再持有明文（S2） | Cody + 后端 | P0 | 1 人日 |
| 4 | 删除 ssoTicket/ssoLoginAt 持久化，仅留 email+时间戳（S3） | Cody | P0 | 0.2 人日 |
| 5 | 种子数据剥离 password + 空库走随机初始密码流程 + CI secret-scan（S4） | Cody | P0 | 1 人日 |
| 6 | CSRF 闭环：cookie SameSite=Lax + apiClient 统一加 `X-Workbench` 头 + 后端校验 Origin/头（先确认现状）（S5） | Archi + 后端 | P0 | 1 人日 |
| 7 | `usePermissions.can()` 改 fail-closed，统一与 useAccess 语义（S6） | Cody | P0 | 0.2 人日 |
| 8 | 7 个 store 乐观更新加回滚 + 返回 `{success,error}` + 失败自动 fetch 对齐（H1） | Cody | P1 | 2 人日 |
| 9 | 删除 storageAdapter.js（H2）、useInitApp.js、ssoExchange/ssoValidate 死代码（L2/M6） | Cody | P1 | 0.3 人日 |
| 10 | 引入 vitest + @testing-library/react + MSW，P0 用例 7 条 + CI 覆盖率硬门禁（P0 文件 90%） | Tessa | P1 | 3 人日 |
| 11 | xlsx 换 CDN tarball 或迁移 ExcelJS + 导入前限制文件大小（H6） | Cody | P1 | 0.5 人日 |
| 12 | 团队入口改 vite build + 静态/反代服务 + 进程守护 + /api/health 告警（H4） | Archi + Rex | P1 | 1 人日 |
| 13 | 存量成员走 /members/:id/reset-password 批量重置 + git history 凭证泄露验证 | Rex + Archi | P1（演练 P0） | 0.5 人日 |
| 14 | 部署层加 CSP `default-src 'self'`（L3）；RiskMatrix 删 dangerouslySetInnerHTML（L1） | Rex + Cody | P2 | 0.5 人日 |

**P0 小计 ≈ 5.5 人日，P1 小计 ≈ 7.8 人日，P2 见 #14。**

---

## ⚠️ 待完善 / 已知局限

1. **后端代码不在仓库内**：CSRF 校验现状（SameSite/Origin）、members 是否回传 password、SSO 回调 base URL 配置方式、/auth/login 是否已返回 userId——4 项需后端同学交叉确认后回填本报告
2. 泰莎的测试策略基于上游描述的功能面制定（其沙箱未实际读到源码），P0/P1 用例落地时需结合实际 store 结构微调 mock 点
3. 科迪的依赖扫描基于 package-lock 锁定版本 + 公开公告交叉核对，未实际执行 `npm audit`（本地环境限制）；xlsx 的 CVE 修复需换 CDN 源，存在 lockfile 更新成本
4. 事故响应为**演练（Tabletop）**，非真实事件；时间线为模板留空，待真实事故填入
5. `itc-platform` 子项目与 `data/workbench.db` 实际运行数据均未在本次审查范围内

---

## 📚 数据来源 & 成员产出索引

- **Cody（代码审查师）**：完整发现表（4C/3H/5M/4L）+ 依赖安全扫描 + "做得好的地方" 6 条（apiClient cookie 化、SSO 302+handledRef、MemberForm 编辑态不回填、seedData 空才兜底保护、useAccess fail-closed、manualChunks 分包）
- **Archi（系统架构师）**：4 条 ADR + 4 个架构高风险点 + 风险→缓解映射（含工作量估计）+ 4 项后端待确认清单
- **Tessa（测试专家）**：现状验证（0 测试文件）+ P0/P1/P2 分阶段策略 + Top 10 必测用例 + 覆盖率基线
- **Rex（SRE 工程师）**：SEV2 评级 + 9 章演练报告（时间线/状态更新模板/5 Why/行动项/预防措施/复盘结构）

---

> 本报告由工程保障团队 AI 协作生成（甄宇航编排，Cody/Archi/Tessa/Rex 产出），关键决策请由人类工程负责人复核。后端侧 4 项待确认事项（CSRF 现状、members password 回传、SSO 回调配置、/auth/login 返回结构）闭环后请安排复审。
