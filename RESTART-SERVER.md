# 重启后端 Node 服务

修改了 `server/*.js`（包括 `accessControl.js`、`simple-server.js` 等被 require 的模块）后，**必须重启 Node 进程**才能让 Node 模块缓存加载新代码 —— Vite HMR 只对前端有效，Node `require()` 缓存一旦锁定，文件改了也不会重读。

## 一键重启（PowerShell / Git Bash）

### 方案 A：如果只跑 simple-server.js 一个后端

```bash
# 1. 找到占用 3000 端口的进程 PID
netstat -ano | grep ":3000 " | grep LISTENING

# 2. 杀掉
taskkill /F /PID <PID>

# 3. 重新启动
cd D:\AI\project-workbench
node server/simple-server.js
```

### 方案 B：用脚本一键完成（推荐）

在项目根目录创建 `restart-server.bat`：

```bat
@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  echo Killing old server PID %%a ...
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
cd /d D:\AI\project-workbench
start "Project Workbench Backend" /min node server/simple-server.js
echo Server restarted on 3000.
pause
```

之后每次改了 `server/**/*.js` 双击运行即可。

### 方案 C（无需重启）：把 require 改成 require 缓存清除

仅作了解，正常开发流程不推荐。改完 Node 文件后让所有进程优雅退出再重启是唯一可靠方式。

## 现象速查

| 现象 | 根因 | 解决 |
|---|---|---|
| 前端代码改了，浏览器刷新后行为还是老样子 | Vite HMR 没生效 / 浏览器缓存 | 硬刷新 Ctrl+Shift+R |
| 后端改了 `server/accessControl.js` 或路由，但 API 行为未变 | **Node `require()` 模块缓存** | **重启 Node 进程（上方操作）** |
| 改 `vite.config.js` 后端口/proxy 行为未变 | Vite 配置改动需重启 vite | 终止 `npm run dev` 重启 |
| 改了 `.env`，新环境变量不生效 | 系统级 `process.env` 也要重启 | 重启 Node 进程 |

## 提示

- Vite dev server（5173）：改前端 .jsx/.js/.css → HMR 自动；改 `vite.config.js` / `.env` → 重启 npm run dev
- Node 后端（3000）：改任何 `server/**` 下文件 → **一律重启 Node**
- 数据库文件（`data/workbench.db`）：改完无需重启，但所有 Node 内存里的缓存状态要等下次刷新才生效
