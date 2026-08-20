/**
 * Express 应用装配
 * - 统一 JSON、CORS、静态资源（生产模式托管前端 dist）
 * - 挂载所有路由
 * - 统一错误处理
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 简单请求日志
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[http] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// 健康自探活（无鉴权，供示例系统档案探测）
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'itc-platform-server',
      status: 'ok',
      time: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// 业务路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/auth')); // users 列表与 auth 同模块
app.use('/api/systems', require('./routes/systems'));
app.use('/api/health/overview', require('./routes/health')); // 需登录的总览（注意放在 /api/health 之后不冲突）
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));

// 生产模式：托管前端构建产物（Docker 部署 / npm run build 后）
const webDist = path.join(__dirname, '..', 'web', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// 404 与错误处理
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;