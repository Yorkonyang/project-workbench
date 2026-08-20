/**
 * better-sqlite3 连接与建表初始化
 * 表结构严格按架构文档 4.1 节 SQL 实现
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH } = require('../config');

// 确保数据目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  email TEXT,
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 系统档案表 (M1)
CREATE TABLE IF NOT EXISTS systems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  version TEXT,
  base_url TEXT,
  health_type TEXT DEFAULT 'http',
  health_path TEXT,
  db_host TEXT,
  db_port INTEGER,
  db_type TEXT,
  expected_status INTEGER DEFAULT 200,
  check_interval INTEGER DEFAULT 5,
  owner_id INTEGER REFERENCES users(id),
  vendor TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 健康检查记录表 (M1)
CREATE TABLE IF NOT EXISTS health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  system_id INTEGER NOT NULL REFERENCES systems(id),
  status TEXT NOT NULL,
  response_time INTEGER,
  http_code INTEGER,
  message TEXT,
  checked_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_health_system ON health_checks(system_id, checked_at DESC);

-- 系统告警表 (M1)
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  system_id INTEGER NOT NULL REFERENCES systems(id),
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'open',
  ticket_id INTEGER REFERENCES tickets(id),
  pushed_qingflow INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  resolved_at TEXT
);

-- 工单表 (M2)
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  system_id INTEGER REFERENCES systems(id),
  reporter_id INTEGER REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  source TEXT DEFAULT 'web',
  alert_id INTEGER REFERENCES alerts(id),
  sla_response_due TEXT,
  sla_resolve_due TEXT,
  response_at TEXT,
  resolved_at TEXT,
  closed_at TEXT,
  solution TEXT,
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_ticket_system ON tickets(system_id);

-- 工单操作记录表 (M2 审计)
CREATE TABLE IF NOT EXISTS ticket_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  action TEXT NOT NULL,
  operator_id INTEGER REFERENCES users(id),
  from_status TEXT,
  to_status TEXT,
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_actions_ticket ON ticket_actions(ticket_id);

-- 通知表 (M4)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- 轻流配置表 (单行配置)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
`;

/** 初始化建表（幂等） */
function initDb() {
  db.exec(SCHEMA);
  return db;
}

module.exports = { db, initDb, DB_PATH };