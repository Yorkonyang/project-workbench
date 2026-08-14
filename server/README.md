# Project Workbench Server

基于 Node.js + SQLite 的后端服务

## 目录结构

```
server/
├── index.js          # 主入口文件
├── package.json      # 依赖配置
├── db/              # 数据库配置
├── routes/          # API 路由
├── middleware/      # 中间件
└── scripts/         # 脚本工具
    └── migrate.js   # 数据迁移脚本
```

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 初始化数据库

```bash
# 创建数据目录
mkdir -p ../data

# 运行服务器（会自动创建数据库）
npm start
```

### 3. 数据迁移

```bash
# 1. 在浏览器控制台导出数据
# 打开项目工作台，按 F12，在控制台运行:
exportAllData()

# 2. 将导出的 JSON 文件放入 migration-data 目录
# 文件命名为: projects.json, tasks.json, todos.json 等

# 3. 运行迁移脚本
node scripts/migrate.js
```

## API 接口

### Projects
- `GET /api/projects` - 获取所有项目
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### Tasks
- `GET /api/projects/:projectId/tasks` - 获取项目任务
- `POST /api/projects/:projectId/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### Todos
- `GET /api/todos` - 获取所有待办
- `POST /api/todos` - 创建待办
- `PUT /api/todos/:id` - 更新待办
- `DELETE /api/todos/:id` - 删除待办

### Health
- `GET /api/health` - 健康检查

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| DB_PATH | 数据库路径 | ./data/workbench.db |

## 技术栈

- **运行时**: Node.js 22+
- **框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT + bcryptjs

## 部署

### 开发环境
```bash
npm run dev
```

### 生产环境
```bash
npm start
```

建议使用 PM2 进行进程管理：
```bash
pm2 start server/index.js --name workbench-api
pm2 save
```
