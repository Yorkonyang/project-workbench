@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

title 项目工作台 - 启动器
echo ===================================================
echo   项目工作台  启动中（前端 + 后端 API）...
echo ===================================================
echo.
echo [1/2] 启动后端 API 服务  (端口 3000) ...
start "后端 API :3000" cmd /k "node server/simple-server.js"
echo [2/2] 启动前端开发服务器 (端口 5173) ...
start "前端 Vite :5173" cmd /k "npm run dev"
echo.
echo 启动完成！请在浏览器打开： http://localhost:5173
echo 验证群聊：开两个浏览器窗口分别登录同一项目的两名成员，
echo           用「项目群聊」或项目详情页「群聊」Tab 互发消息。
echo.
echo （直接关闭这两个弹出的窗口即可停止服务）
echo.
pause
