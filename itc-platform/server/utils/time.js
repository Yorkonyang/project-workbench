/**
 * 时间工具：数据库统一 datetime('now','localtime') 字符串格式 YYYY-MM-DD HH:MM:SS
 */

/** 补零到两位数 */
function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Date → 本地时间字符串 'YYYY-MM-DD HH:MM:SS'
 * @param {Date} [date]
 * @returns {string}
 */
function formatDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 字符串 → Date（'YYYY-MM-DD HH:MM:SS' 按本地时间解析）
 * @param {string} dtStr
 * @returns {Date}
 */
function parseDateTime(dtStr) {
  if (!dtStr) return null;
  // SQLite 本地时间字符串兼容 'YYYY-MM-DD HH:MM:SS'
  const m = String(dtStr).replace('T', ' ').replace('Z', '').trim();
  return new Date(m.replace(/-/g, '/'));
}

/**
 * 在当前时间基础上增加小时数
 * @param {Date} base
 * @param {number} hours
 * @returns {Date}
 */
function addHours(base, hours) {
  return new Date(base.getTime() + hours * 3600 * 1000);
}

/**
 * 计算两个时间字符串相差分钟数
 * @param {string} start 'YYYY-MM-DD HH:MM:SS'
 * @param {string} end   'YYYY-MM-DD HH:MM:SS'
 * @returns {number}
 */
function diffMinutes(start, end) {
  const s = parseDateTime(start);
  const e = parseDateTime(end);
  if (!s || !e) return 0;
  return Math.round((e.getTime() - s.getTime()) / 60000);
}

/**
 * 当前时间字符串
 * @returns {string}
 */
function now() {
  return formatDateTime();
}

module.exports = { pad, formatDateTime, parseDateTime, addHours, diffMinutes, now };