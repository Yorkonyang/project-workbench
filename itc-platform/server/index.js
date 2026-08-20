/**
 * 服务入口：初始化 DB → 种子数据 → 启动 HTTP 服务 → 启动定时任务
 */
const app = require('./app');
const { initDb } = require('./db');
const { seedIfEmpty } = require('./db/seed');
const { startScheduler } = require('./jobs/scheduler');
const { PORT } = require('./config');

// 1. 初始化数据库（建表）
initDb();
console.log('[init] 数据库已初始化');

// 2. 种子数据（幂等）
try {
  const seedResult = seedIfEmpty();
  if (seedResult.seeded) {
    console.log('[init] 种子数据已写入（admin/admin123）');
  } else {
    console.log('[init] 种子数据跳过:', seedResult.reason);
  }
} catch (err) {
  console.error('[init] 种子数据写入失败:', err.message);
  process.exit(1);
}

// 3. 启动 HTTP 服务
const server = app.listen(PORT, () => {
  console.log(`[init] ITC 平台后端已启动: http://localhost:${PORT}`);
});

// 4. 启动定时任务（探活每分钟）
let schedulerRunning = false;
try {
  startScheduler({ runInitial: true });
  schedulerRunning = true;
} catch (err) {
  console.error('[init] 定时任务启动失败:', err.message);
}

// 优雅退出
function shutdown(signal) {
  console.log(`[init] 收到 ${signal}，正在关闭...`);
  const { stopScheduler } = require('./jobs/scheduler');
  stopScheduler();
  server.close(() => {
    console.log('[init] 服务已关闭');
    process.exit(0);
  });
  // 兜底：5 秒后强制退出
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));