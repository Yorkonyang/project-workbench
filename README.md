# 项目工作台

> 企业内部项目工作台 —— 项目管理、任务协作、待办跟踪与轻流 BPM 集成门户

---

## 特性

- 项目 CRUD、归档审批工作流
- 任务看板（Kanban）与甘特图视图
- 待办管理（支持关联任务、逾期提醒）
- 文档管理（关联已有文档或新建上传）
- 轻流 BPM 推送集成（任务/待办直达链接）
- SSO 免登录直达（HMAC 签名，HMAC-SHA256 防篡改）
- 多责任人支持（assignees 数组）
- 部门头像颜色继承（成员头像跟随所属部门颜色循环）
- 组织架构管理（树形部门 + Excel 导入）
- 数据字典（项目类型 / 项目阶段级联）
- 权限管控（管理员 / 项目负责人 / 普通成员）
- 通知中心 + 待办待处理提示（useReminderEngine）

---

## 技术栈

- 前端：React 18 + Vite + TailwindCSS + zustand + react-router-dom
- 后端：纯 Node.js（简单 HTTP Server）+ SQLite（通过 better-sqlite3，已改为 JSON 文件存储避免生产环境安装问题）
- 部署：`dist/` 静态文件，可由 Nginx / CloudStudio 托管

---

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（前端 5173 + 后端 3000）
npm run dev

# 生产构建
npm run build
```

访问 http://localhost:5173

---

## 环境变量

```bash
# .env
VITE_API_URL=/api   # 相对路径，由 vite.config.js proxy 转发到后端
PORT=3000           # 后端端口
SSO_SECRET=<strong-random-string>  # SSO 签名密钥（生产必须替换）
```

---

## SSO 跳转集成

轻流推送链接格式：`https://host/task/:id?&t=&exp=&sig=`

详见：[docs/qingflow-integration.md](./docs/qingflow-integration.md)

---

## 架构

- [architecture_design.md](./docs/architecture_design.md)
- [requirements_spec_v2.md](./docs/requirements_spec_v2.md)
- [操作指南.md](./docs/操作指南.md)

---

## 许可

MIT