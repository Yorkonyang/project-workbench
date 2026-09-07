#!/usr/bin/env bash
# ============================================================================
# project-workbench 服务器一键部署 / 启动脚本
# 目标：让服务器上运行的效果与本地完全一致
#
# 运行原理（与本地一致）：
#   前端  = vite dev  (端口 5173, vite.config.js 已配 host:true → 局域网可访问)
#           并把 /api 反向代理到本机后端 3000（浏览器只连 5173，无 CORS）
#   后端  = server/simple-server.js （纯 Node 内置模块，端口 3000，无需 npm install）
#
# 关键点：
#   1) 后端只用 Node 内置模块 → 只需在前端根目录 npm install，server/ 不用装依赖
#      （server/package.json 里的 express/better-sqlite3 是给未使用的 index.js 的，
#         simple-server.js 不引用，装了反而要编译原生模块 better-sqlite3，没必要）
#   2) 真正决定“内容是否和本地一样”的是 data/workbench.db，不是 node_modules 或 .env
#      → 不拷贝它，服务器会用自带/空的库，就会出现“项目数量不一样”的情况（同之前 gitee 那次）
#   3) simple-server.js 不自动加载 .env（无 require('dotenv')），端口/DB 走默认值即可，
#      如需自定义用环境变量传入（见下方 PORT / DB_PATH）
# ============================================================================
set -e

cd "$(dirname "$0")/.."   # 切到项目根目录

# ---- 0. 先停掉可能仍占着 3000/5173 的旧服务进程 ----------------------------
# 若服务器上已有旧后端/前端在跑（端口被占），新进程会启动失败并静默退出，
# 旧进程（旧代码/旧权限逻辑）会继续对外服务 → 出现“数据有了、但任务列表不对”的现象。
# 启动前先复用 server-stop.sh 清理；首次全新部署没有进程时是安全的空操作。
echo "==> 清理可能残留的旧服务进程 ..."
bash "$(dirname "$0")/server-stop.sh" || true

# ---- 1. 【必须手动做】恢复本地数据，使内容与本地一致 -----------------------
# 把本地 data/workbench.db 拷到服务器 ./data/workbench.db 后再启动，
# 否则服务器使用自己的库（可能为空或内容不同）。示例：
#   scp 你本地机器:/d/AI/project-workbench/data/workbench.db ./data/workbench.db
# 也可用 .env 里的 DB_PATH 指定别的路径。
if [ ! -f ./data/workbench.db ]; then
  echo "⚠️  未找到 ./data/workbench.db，服务器将使用空库，内容与本地不一致！"
  echo "     请先拷贝本地 data/workbench.db 到当前目录 ./data/ 下，再运行本脚本。"
  echo "     若确实要空库启动，请删除此段判断后重试。"
  exit 1
fi

# ---- 2. 安装前端依赖（后端不需要）-----------------------------------------
echo "==> 安装前端依赖 (npm install) ..."
npm install

# ---- 2. 启动后端（端口 3000，纯 Node，无需外部依赖）-----------------------
echo "==> 启动后端 server/simple-server.js (PORT=${PORT:-3000}) ..."
PORT="${PORT:-3000}" \
DB_PATH="${DB_PATH:-./data/workbench.db}" \
nohup node server/simple-server.js > server.log 2>&1 &
echo $! > .pid-backend
echo "    后端 PID=$(cat .pid-backend)，日志 server.log"

# ---- 4. 启动前端（vite dev, host:true, 不自动开浏览器）--------------------
echo "==> 启动前端 vite dev (http://0.0.0.0:5173) ..."
BROWSER=none nohup npm run dev > vite.log 2>&1 &
echo $! > .pid-frontend
echo "    前端 PID=$(cat .pid-frontend)，日志 vite.log"

echo ""
echo "✅ 已启动。访问: http://<服务器IP>:5173  （后端 API 在 :3000，由前端代理，无需直连）"
echo "🛑 停止:  bash scripts/server-stop.sh"
