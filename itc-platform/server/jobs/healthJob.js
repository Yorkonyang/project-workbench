/**
 * 定时探活任务：一次完整巡检
 * 由 scheduler 每分钟触发；内部按各系统 check_interval 判断
 */
const { runHealthCycle } = require('../services/healthCheck');

/**
 * 执行一次探活巡检
 * @returns {Promise<Array>} 探活结果列表
 */
async function runHealthJob() {
  const startedAt = new Date();
  const results = await runHealthCycle();
  if (results.length) {
    console.log(`[healthJob] ${new Date().toLocaleString()} 巡检 ${results.length} 个系统:`,
      results.map((r) => `${r.code}=${r.status}`).join(', '));
  }
  return { results, elapsedMs: Date.now() - startedAt.getTime() };
}

module.exports = { runHealthJob };