# 项目工作台 | Project Workbench

集中管理各类信息化项目的个人工作台 Web 应用。

## 快速启动

```bash
cd D:\AI\project-workbench
npm install
npm run dev
```

浏览器访问 http://localhost:5173

## 技术栈

- React 18 + Vite 5 + TailwindCSS 3
- Zustand（状态管理 + localStorage 持久化）
- Recharts（图表）+ 自建 CSS Grid 甘特图
- @hello-pangea/dnd（任务拖拽）
- date-fns（日期处理）
- lucide-react（图标）

## 功能模块

1. **仪表盘** — 双项目进度总览、任务状态分布、里程碑时间线、风险概览、资源分配
2. **任务管理** — 看板拖拽 + 列表双视图，支持 CRUD、项目/优先级筛选
3. **时间线** — CSS Grid 自建甘特图（日/周/月视图）+ 里程碑列表
4. **文档管理** — 元数据登记模式，分类筛选 + 关键词搜索
5. **待办提醒** — 到期横幅 + 优先级排序 + Header 铃铛联动
6. **风险管理** — 概率×影响 3×3 矩阵 + 风险列表 CRUD
7. **项目详情** — 进度环 + 6 标签页（概览/任务/里程碑/文档/风险/资源）
8. **数据管理** — Header 齿轮图标，支持导出备份 / 导入恢复 / 重置数据

## 数据持久化

所有数据存储在浏览器 localStorage 中，key 前缀 `pw_`。首次加载自动注入种子数据（赛意 MOM + 用友 BIP）。

**限制说明**：
- localStorage 容量约 5-10MB（各浏览器不同），纯文本元数据占用极小
- 数据绑定浏览器，不跨设备同步，建议定期通过 Header 齿轮图标导出备份
- 文档管理为元数据登记模式（不上传文件二进制），实际文档存放于 PLM 等外部系统

## 生产部署

### 方式一：Nginx 静态托管（推荐）

```bash
# 1. 本地构建
npm run build

# 2. 上传 dist/ 到服务器
scp -r dist/* root@<服务器IP>:/opt/project-workbench/

# 3. 复制 Nginx 配置
scp deploy/nginx.conf root@<服务器IP>:/etc/nginx/conf.d/workbench.conf

# 4. 远程重载 Nginx
ssh root@<服务器IP> "nginx -t && systemctl reload nginx"
```

或直接使用一键部署脚本：
```bash
# 编辑 deploy/deploy.sh 中的 REMOTE_HOST 后执行
bash deploy/deploy.sh
```

### 方式二：Docker 部署

```bash
cd deploy
docker-compose up -d --build
# 访问 http://localhost:8080
```

### Nginx 关键配置

- SPA 路由 fallback：`try_files $uri $uri/ /index.html`
- 静态资源长缓存：`/assets/` 目录 `expires 1y`
- gzip 压缩：JS/CSS/SVG 等
