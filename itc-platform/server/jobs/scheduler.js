/**
 * 定时任务调度器：注册 node-cron 任务
 */
const cron = require('node-cron');
const { runHealthJob } = require('./healthJob');

let tasks = [];

/**
 * 启动所有定时任务
 * 探活调度：每分钟执行（内部再按 check_interval 判断是否到期）
 * @param {object} [options] { runInitial?: boolean }
 */
function startScheduler(options = {}) {
  const { runInitial = true } = options;

  // 每分钟探活调度
  const healthTask = cron.schedule('* * * * *', () => {
    runHealthJob().catch((err) => console.error('[scheduler] healthJob 异常:', err));
  }, { name: 'health-scan' });
  tasks.push(healthTask);
  console.log('[scheduler] 定时任务已启动: 探活扫描 (每分钟)');

  // 启动后延迟数秒执行一次首次巡检，便于演示联动
  if (runInitial) {
    setTimeout(() => {
      runHealthJob().catch((err) => console.error('[scheduler] 首次巡检异常:', err));
    }, 3000);
  }

  return tasks;
}

/** 停止所有定时任务 */
function stopScheduler() {
  for (const task of tasks) {
    try { task.stop(); } catch (e) { /* ignore */ }
  }
  tasks = [];
  console.log('[scheduler] 定时任务已停止');
}

module.exports = { startScheduler, stopScheduler };