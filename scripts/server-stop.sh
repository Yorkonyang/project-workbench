#!/usr/bin/env bash
# 停止 project-workbench 的服务（前端 vite + 后端 simple-server）
cd "$(dirname "$0")/.."

stop_pid() {
  local f="$1" name="$2"
  if [ -f "$f" ]; then
    local pid
    pid="$(cat "$f")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "已停止 $name (PID=$pid)"
    else
      echo "$name (PID=$pid) 未运行"
    fi
    rm -f "$f"
  fi
}

# 先按记录 PID 停
stop_pid .pid-backend "后端(simple-server)"
stop_pid .pid-frontend "前端(vite/npm)"

# 兜底：清理可能残留的进程
pkill -f "server/simple-server.js" 2>/dev/null && echo "清理残留后端进程" || true
pkill -f "vite" 2>/dev/null && echo "清理残留前端进程" || true

echo "✅ 已全部停止"
