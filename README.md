# 项目工作台 | Project Workbench

集中管理各类信息化项目的个人 / 团队工作台 Web 应用。整合**仪表盘、任务、时间线（甘特图）、文档、待办、风险、资源、组织架构与成员、通知**等核心模块，并支持与轻流（QingFlow）BPM 系统的流程数据同步。

---

## 技术架构

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite 5 + TailwindCSS 3，Zustand（状态管理 + localStorage 缓存），Recharts（图表），@hello-pangea/dnd（任务拖拽），date-fns（日期），lucide-react（图标） |
| 后端 | 纯 Node.js `http` 服务（`server/simple-server.js`，**不依赖 Express**），JSON 文件存储 |
| 存储 | `data/workbench.db`（JSON 文件，**首次启动自动注入种子数据**；已被 `.gitignore` 排除） |
| 鉴权 | 项目负责制权限模型，详见 [`升级说明.md`](./升级说明.md) |

### 目录结构

```
project-workbench/
├── server/                 # 纯 Node 后端
│   ├── simple-server.js    # HTTP 服务 + 路由 + CRUD
│   ├── accessControl.js    # 权限核心：项目负责制判定
│   └── qingflow.js         # 轻流 BPM 集成（企微通知推送）
├── src/                    # 前端源码
│   ├── lib/apiClient.js    # 统一请求封装（自动附加 x-user-id）
│   ├── lib/bootstrap.js    # 登录/登出后清空缓存并重新拉取数据
│   ├── hooks/useAccess.js  # 前端权限判定
│   ├── store/              # Zustand 数据 store（持久化到 localStorage）
│   ├── pages/              # 页面
│   └── components/         # 组件
├── data/                   # 运行时数据库（git 忽略）
├── deploy/                 # Nginx / Docker 部署配置
└── docs/                   # 设计文档
```

---

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 启动后端（默认端口 3000）
PORT=3000 DB_PATH=data/workbench.db node server/simple-server.js

# 3. 启动前端（默认端口 5173）
npm run dev
```

浏览器访问 **http://localhost:5173**。

> 首次启动后端时若 `data/workbench.db` 不存在，会自动从种子数据创建，无需手动初始化。

---

## 权限模型（项目负责制）

旧版基于角色的权限矩阵已作废，改为**项目负责制**：

| 角色 | 能力 |
|---|---|
| **所有人** | 可创建项目 / 任务 / 待办（平台人人可用） |
| **所有者 Owner** | `project.ownerId === 我` 或 `project.manager === 我`；可查/建/改/删**自己负责的项目**及其任务、待办、文档、里程碑；**看不到他人项目** |
| **成员 Member** | 被分配到某任务（`task.assignees` / `task.assignee` 含我）；可上报任务进度、在所属任务的范围内追加待办 / 文档；**不能改 / 删项目与任务** |
| **管理员 Admin** | 最高权限，可见并管理全部数据 |

**实现要点**
- 后端 `server/accessControl.js` 集中判定：GET 列表按 `userId` 过滤，写操作越权返回 **403**。
- 前端 `src/lib/apiClient.js` 在每个请求自动附加 `x-user-id` 请求头；store 数据为后端过滤后的结果（前端过滤仅作体验层）。
- 登录 / 登出通过 `src/lib/bootstrap.js` 清空数据 store 缓存并以当前用户重新拉取，避免跨账号数据残留。
- 兼容任务 `assignee`（单值 id）与 `assignees`（数组）两种写法；历史数据已补 `ownerId`。

---

## 功能模块

1. **仪表盘** — 项目进度总览、任务状态分布、里程碑时间线、风险概览、资源分配（统计仅基于当前用户可见项目）
2. **任务管理** — 看板拖拽 + 列表双视图，支持 CRUD、项目 / 优先级筛选
3. **时间线** — 自建 CSS Grid 甘特图（日 / 周 / 月视图）+ 里程碑列表
4. **文档管理** — 元数据登记模式，分类筛选 + 关键词搜索
5. **待办提醒** — 到期高亮 + 优先级排序 + Header 铃铛联动
6. **风险管理** — 概率 × 影响 3×3 矩阵 + 风险列表 CRUD
7. **项目详情** — 进度环 + 多标签页（概览 / 任务 / 里程碑 / 文档 / 风险 / 资源）
8. **组织架构与成员** — 部门树形管理 + 成员名册（成员管理 Tab 下的旧权限矩阵已移除）
9. **数据管理** — Header 齿轮图标，支持导出备份 / 导入恢复 / 重置数据

---

## 数据持久化

- **后端**：JSON 文件 `data/workbench.db`，作为唯一数据源（含权限隔离逻辑）。
- **前端**：Zustand 将各 store 持久化到 `localStorage`（key 前缀 `pw_`），但会在登录后重新从后端拉取，确保与后端一致。
- `data/` 目录已被 `.gitignore` 排除，**请勿将运行时数据库提交到仓库**（含真实成员邮箱与凭据）。

---

## 生产部署

### 方式一：Nginx 静态托管 + Node 后端

```bash
# 1. 构建前端
npm run build

# 2. 上传 dist/ 到服务器
scp -r dist/* root@<服务器IP>:/opt/project-workbench/

# 3. 复制 Nginx 配置
scp deploy/nginx.conf root@<服务器IP>:/etc/nginx/conf.d/workbench.conf

# 4. 远程重载 Nginx
ssh root@<服务器IP> "nginx -t && systemctl reload nginx"

# 5. 以守护进程方式启动后端（建议 pm2 / systemd）
PORT=3000 DB_PATH=data/workbench.db node server/simple-server.js
```

Nginx 关键配置：
- SPA 路由 fallback：`try_files $uri $uri/ /index.html`
- 静态资源长缓存：`/assets/` 目录 `expires 1y`
- gzip 压缩：JS/CSS/SVG 等

### 方式二：Docker 部署

```bash
cd deploy
docker-compose up -d --build
# 访问 http://localhost:8080
```

---

## 安全须知

- 仓库已通过 `.gitignore` 排除 `data/`（运行时数据库，含真实成员数据）、`Secret.txt`、`.workbuddy/` 等敏感 / 内部目录。
- 注意：这些文件在 **Git 历史** 中可能仍存在于早期提交（如初始提交）。如需彻底清除历史中的敏感数据，请使用 `git filter-repo` 重写历史后强推（破坏性操作，请慎重）。
- 默认鉴权为前端比对 + 后端 `x-user-id` 头隔离，适用于内网 / 受信任环境；公网部署建议增加 HTTPS 与更强的身份认证。
