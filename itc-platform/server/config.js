/**
 * 全局配置
 * 端口、JWT密钥、SLA策略等集中管理
 */
const path = require('path');

module.exports = {
  /** 服务端口 */
  PORT: process.env.PORT || 3001,

  /** JWT 签名密钥（生产环境务必通过环境变量覆盖） */
  JWT_SECRET: process.env.JWT_SECRET || 'itc-platform-dev-secret-change-me',

  /** JWT 有效期（毫秒）12 小时 */
  JWT_EXPIRES_IN: '12h',

  /** 数据库文件路径（可通过环境变量覆盖） */
  DB_PATH: process.env.ITC_DB_PATH || path.join(__dirname, 'data', 'itc.db'),

  /** 探活相关默认配置 */
  HEALTH: {
    /** HTTP/TCP 探活超时（毫秒） */
    HTTP_TIMEOUT_MS: 10000,
    TCP_TIMEOUT_MS: 5000,
    DB_TIMEOUT_MS: 5000,
    /** 同系统 critical 告警推送轻流的去重间隔（毫秒）30 分钟 */
    QINGFLOW_DEDUP_MS: 30 * 60 * 1000,
    /** 连续 N 次 down 判定为严重并重复推送 */
    CONSECUTIVE_DOWN_LEVEL: 3
  },

  /** SLA 策略：按优先级设置响应/解决时限（小时） */
  SLA_POLICY: {
    urgent: { responseHours: 0.5, resolveHours: 4 },
    high: { responseHours: 1, resolveHours: 8 },
    medium: { responseHours: 4, resolveHours: 24 },
    low: { responseHours: 8, resolveHours: 72 }
  },

  /** 轻流推送字段名映射（Q-Source 约定） */
  QFLOW_FIELDS: {
    title: 'bt',
    desc: 'ms',
    assignee: 'zrr',
    priority: 'yxj',
    dueDate: 'jzrq',
    project: 'ssxm',
    status: 'zht'
  }
};