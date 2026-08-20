# 信息化中心管理平台（ITC Platform）

面向公司信息化中心 4 人团队的管理平台：统一管理 ERP / PLM / QMS / MES(MOM) / BPM 等系统，涵盖**系统健康监控、IT 工单管理、团队工作台**三大核心模块（MVP/P0）。

## 功能一览

| 模块 | 说明 |
|------|------|
| **系统健康看板** | 系统档案管理 + 自建探活引擎（HTTP/TCP/DB 三类探活），异常自动生成工单并推送轻流 |
| **IT 工单管理** | 工单创建/分派/状态流转/评论，SLA 计时，看板视图，统计报表 |
| **团队工作台** | 个人待办聚合（我的工单/告警/通知），团队工作量视图（admin） |

## 技术栈

- **前端**：React 18 + Vite + MUI + Tailwind CSS
- **后端**：Node.js + Express + better-sqlite3 + node-cron
- **部署**：Docker Compose

## 快速启动（开发模式）

### 1. 启动后端（端口 3001）

```bash
cd server
npm install
npm start
```

启动后自动建表并写入种子数据（`admin / admin123`）。

### 2. 启动前端（端口 5174）

```bash
cd web
npm install
npm run dev
```

浏览器访问 http://localhost:5174 ，使用 `admin / admin123` 登录。

> Vite 开发代理已将 `/api` 转发到 `http://localhost:3001`。

## 生产部署（Docker）

```bash
# 在 itc-platform 根目录执行
docker compose up -d --build
```

访问 http://<服务器IP>:3001 。数据库文件通过 volume `itc-data` 持久化。

## 轻流（QingFlow）集成

在「设置」页配置：
- **轻流服务器地址**：如 `https://gkbpm.grinm.com:56555`
- **Q-Source ID**：轻流后台「数据源 → Q-Source」获取 UUID

配置后，系统宕机/异常告警将自动推送轻流 BPM（字段映射：bt/ms/zrr/yxj/jzrq/ssxm/zht），同一系统 critical 告警 30 分钟内最多推送 1 次。

## 目录结构

```
itc-platform/
├── docker-compose.yml     # 一键部署
├── Dockerfile             # 多阶段构建
├── server/                # Express 后端
│   ├── db/                # SQLite 建表与种子数据
│   ├── routes/            # API 路由
│   ├── services/          # 探活引擎 / 轻流推送 / SLA 计算
│   ├── jobs/              # node-cron 定时任务
│   └── middleware/        # JWT 认证与错误处理
└── web/                   # React 前端
    └── src/
        ├── pages/         # 看板 / 系统 / 工单 / 设置
        ├── layouts/       # 主布局
        └── api/           # axios 封装
```

## 默认账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 管理员（首次登录后请修改密码） |

## 文档

- 需求文档：`docs/itc-platform-prd.md`
- 架构设计：`docs/itc-platform-architecture.md`