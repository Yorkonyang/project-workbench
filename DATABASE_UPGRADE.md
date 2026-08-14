# 项目工作台 - 数据库存储升级方案

## 概述

将项目工作台从 localStorage 存储升级到 SQLite 数据库存储，支持：
- 多设备数据同步
- 数据持久化
- 更好的数据安全
- 可扩展的 API 接口

## 技术栈

### 后端
- **运行时**: Node.js 22+
- **框架**: Express.js 4.x
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT + bcryptjs
- **CORS**: cors

### 前端
- **API 客户端**: 自定义 fetch 封装
- **状态管理**: Zustand (保持兼容)
- **适配器模式**: StorageAdapter 支持双模式

## 目录结构

```
project-workbench/
├── server/                    # 后端服务
│   ├── index.js              # 主入口
│   ├── package.json
│   ├── db/                   # 数据库配置
│   ├── routes/               # API 路由
│   ├── middleware/           # 中间件
│   └── scripts/
│       ├── init-db.js        # 数据库初始化
│       └── migrate.js        # 数据迁移
├── data/                     # 数据库文件目录
├── migration-data/           # 迁移数据临时目录
└── src/
    ├── lib/
    │   ├── apiClient.js      # API 客户端
    │   └── storageAdapter.js # 存储适配器
    └── store/                # Zustand stores (保持不变)
```

## 数据库表结构

### projects
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 项目名称 |
| description | TEXT | 项目描述 |
| status | TEXT | 状态 (active/archived) |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| archived | INTEGER | 是否归档 |

### tasks
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| project_id | TEXT | 关联项目 |
| title | TEXT | 任务标题 |
| description | TEXT | 任务描述 |
| status | TEXT | 状态 (todo/in_progress/review/done/blocked) |
| priority | TEXT | 优先级 |
| due_date | TEXT | 截止日期 |
| assignee | TEXT | 负责人 |
| progress_reports | TEXT | 进度汇报 (JSON) |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### todos
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| project_id | TEXT | 关联项目 |
| title | TEXT | 待办标题 |
| description | TEXT | 描述 |
| completed | INTEGER | 是否完成 |
| completed_at | TEXT | 完成时间 |
| priority | TEXT | 优先级 |
| due_date | TEXT | 截止日期 |
| assignee | TEXT | 负责人 |
| remind_days | INTEGER | 提前几天提醒 |
| remind_at | TEXT | 指定提醒时间 |
| enable_escalation | INTEGER | 是否启用催办 |

### members
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 姓名 |
| email | TEXT | 邮箱 |
| role | TEXT | 角色 |
| avatar_color | TEXT | 头像颜色 |
| created_at | TEXT | 创建时间 |

### documents
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| project_id | TEXT | 关联项目 |
| title | TEXT | 文档标题 |
| content | TEXT | 内容 |
| file_path | TEXT | 文件路径 |
| created_by | TEXT | 创建者 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### notifications
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| user_id | TEXT | 用户 ID |
| title | TEXT | 通知标题 |
| message | TEXT | 通知内容 |
| type | TEXT | 类型 |
| read | INTEGER | 是否已读 |
| created_at | TEXT | 创建时间 |

## API 接口

### Projects
```
GET    /api/projects              # 获取所有项目
POST   /api/projects              # 创建项目
PUT    /api/projects/:id          # 更新项目
DELETE /api/projects/:id          # 删除项目
```

### Tasks
```
GET    /api/projects/:projectId/tasks    # 获取项目任务
POST   /api/projects/:projectId/tasks    # 创建任务
PUT    /api/tasks/:id                    # 更新任务
DELETE /api/tasks/:id                    # 删除任务
```

### Todos
```
GET    /api/todos               # 获取所有待办
POST   /api/todos               # 创建待办
PUT    /api/todos/:id           # 更新待办
DELETE /api/todos/:id           # 删除待办
```

### Health
```
GET    /api/health              # 健康检查
```

## 部署步骤

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 初始化数据库

```bash
node scripts/init-db.js
```

### 3. 启动服务器

```bash
npm start
# 或开发模式
npm run dev
```

### 4. 前端配置

在 `.env` 文件中添加：
```
VITE_API_URL=http://localhost:3000/api
```

### 5. 数据迁移

```bash
# 1. 导出 localStorage 数据
# 在浏览器控制台运行:
exportAllData()

# 2. 将导出的文件重命名为表名.json
# projects.json, tasks.json, todos.json 等

# 3. 放入迁移目录
mv *.json ../migration-data/

# 4. 运行迁移脚本
node scripts/migrate.js
```

## 兼容性说明

### 前端适配器模式

`storageAdapter.js` 提供统一的存储接口，支持两种模式：
- **API 模式**: 所有操作通过 REST API
- **LocalStorage 模式**: 向后兼容，直接读写 localStorage

自动检测后端是否可用，如不可用则降级到 localStorage。

### Zustand Store 兼容性

现有 Zustand stores 保持不变，只需修改数据来源：
```javascript
// 原来
const projects = useProjectStore((s) => s.projects);

// 现在（可选）
import { storage } from '@/lib/storageAdapter';
const projects = await storage.getProjects();
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| DB_PATH | 数据库路径 | ./data/workbench.db |
| JWT_SECRET | JWT 密钥 | 开发环境默认值 |
| VITE_API_URL | 前端 API 地址 | http://localhost:3000/api |

## 安全建议

1. **生产环境**必须设置强 JWT_SECRET
2. **启用 HTTPS**
3. **限制 CORS 来源**
4. **定期备份数据库**
5. **设置数据库访问权限**

## 后续优化

- [ ] 添加用户认证系统
- [ ] 实现 RBAC 权限控制
- [ ] 添加数据备份/恢复功能
- [ ] 实现 WebSocket 实时同步
- [ ] 添加操作日志审计
- [ ] 支持 PostgreSQL/MySQL 切换

## 运维

### 查看日志
```bash
# 查看服务日志
tail -f server.log

# 查看数据库
sqlite3 data/workbench.db ".tables"
```

### 备份数据库
```bash
cp data/workbench.db backups/workbench-$(date +%Y%m%d).db
```

### 恢复数据库
```bash
cp backups/workbench-YYYYMMDD.db data/workbench.db
```
