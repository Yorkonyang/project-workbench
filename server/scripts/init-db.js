/**
 * 数据库初始化脚本
 * 创建 SQLite 数据库和表结构
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库路径
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/workbench.db');
const dbDir = path.dirname(dbPath);

// 确保数据目录存在
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`创建数据目录: ${dbDir}`);
}

console.log(`数据库路径: ${dbPath}`);

// 连接数据库
const db = new Database(dbPath);

// 启用 WAL 模式
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('初始化数据库表结构...\n');

// 创建 projects 表
db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived INTEGER DEFAULT 0
    );
`);
console.log('✓ 创建 projects 表');

// 创建 tasks 表
db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        due_date TEXT,
        assignee TEXT,
        progress_reports TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        actual_start_date TEXT,
        actual_end_date TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
`);
console.log('✓ 创建 tasks 表');

// 创建 todos 表
db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        completed_at TEXT,
        priority TEXT DEFAULT 'medium',
        due_date TEXT,
        assignee TEXT,
        remind_days INTEGER DEFAULT 3,
        remind_at TEXT,
        enable_escalation INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
`);
console.log('✓ 创建 todos 表');

// 创建 members 表
db.exec(`
    CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT DEFAULT 'member',
        avatar_color TEXT,
        created_at TEXT NOT NULL
    );
`);
console.log('✓ 创建 members 表');

// 创建 documents 表
db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT NOT NULL,
        content TEXT,
        file_path TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
`);
console.log('✓ 创建 documents 表');

// 创建 notifications 表
db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        message TEXT,
        type TEXT,
        read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE CASCADE
    );
`);
console.log('✓ 创建 notifications 表');

// 创建索引
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`);
console.log('✓ 创建索引');

// 插入示例数据（如果表为空）
const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
if (projectCount === 0) {
    console.log('\n插入示例数据...');
    
    const now = new Date().toISOString();
    const sampleProjects = [
        { id: 'proj_001', name: 'QMS 系统升级', description: '质量管理系统升级改造', status: 'active', createdAt: now, updatedAt: now },
        { id: 'proj_002', name: 'ERP 数据迁移', description: '用友 ERP 数据迁移项目', status: 'active', createdAt: now, updatedAt: now },
    ];
    
    const insertProject = db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, description, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    for (const p of sampleProjects) {
        insertProject.run(p.id, p.name, p.description, p.status, p.createdAt, p.updatedAt);
    }
    console.log('✓ 插入示例项目');
}

console.log('\n数据库初始化完成!');
console.log(`数据库位置: ${dbPath}`);

// 关闭数据库连接
db.close();
