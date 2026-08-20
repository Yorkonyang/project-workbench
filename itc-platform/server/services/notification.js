/**
 * 通知服务：系统内通知的创建与推送协调
 */
const { db } = require('../db');
const { now } = require('../utils/time');

/**
 * 创建通知
 * @param {object} opts
 * @param {number} opts.userId  接收人
 * @param {string} opts.type    ticket_assigned | alert | ticket_status | system
 * @param {string} opts.title
 * @param {string} [opts.content]
 * @param {string} [opts.link]  前端跳转路径
 * @returns {object} notifications 行
 */
function createNotification({ userId, type, title, content = '', link = '' }) {
  if (!userId) return null;
  const info = db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, link, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(userId, type, title, content, link, now());
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * 工单分派通知（发给处理人）
 */
function notifyTicketAssigned(ticket, assignee) {
  if (!assignee) return null;
  return createNotification({
    userId: assignee.id,
    type: 'ticket_assigned',
    title: `新工单已分派给您: ${ticket.ticket_no}`,
    content: `${ticket.title}`,
    link: `/tickets/${ticket.id}`
  });
}

/**
 * 工单状态变更通知
 * 解决/关闭时通知提单人与处理人
 */
function notifyTicketStatus(ticket, toStatus, operator) {
  const recipients = [];
  if (ticket.reporter_id) recipients.push(ticket.reporter_id);
  if (ticket.assignee_id && ticket.assignee_id !== ticket.reporter_id) recipients.push(ticket.assignee_id);
  // 已解决/已关闭才推送
  if (toStatus !== 'resolved' && toStatus !== 'closed') return null;
  const label = toStatus === 'resolved' ? '已解决' : '已关闭';
  const created = [];
  for (const uid of recipients) {
    const n = createNotification({
      userId: uid,
      type: 'ticket_status',
      title: `工单${label}: ${ticket.ticket_no}`,
      content: `${ticket.title}${operator ? `\n操作人: ${operator.name || operator.username}` : ''}`,
      link: `/tickets/${ticket.id}`
    });
    if (n) created.push(n);
  }
  return created;
}

/**
 * 系统告警通知（发给系统负责人）
 */
function notifyAlert(alert, system, ownerId) {
  if (!ownerId) return null;
  return createNotification({
    userId: ownerId,
    type: 'alert',
    title: `【${alert.level === 'critical' ? '严重' : '警告'}】${alert.title}`,
    content: `${alert.content || ''}`,
    link: `/systems`
  });
}

/** 系统状态恢复通知 */
function notifyRecovered(system, ownerId) {
  if (!ownerId) return null;
  return createNotification({
    userId: ownerId,
    type: 'system',
    title: `【系统恢复】${system.name}`,
    content: `系统 ${system.name} 已恢复正常`,
    link: `/systems`
  });
}

/** 统计未读数 */
function countUnread(userId) {
  return db.prepare(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(userId).c;
}

module.exports = {
  createNotification,
  notifyTicketAssigned,
  notifyTicketStatus,
  notifyAlert,
  notifyRecovered,
  countUnread
};