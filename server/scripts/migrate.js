/**
 * 数据迁移脚本
 * 将 localStorage 中的数据迁移到 SQLite 数据库
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 数据库路径
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/workbench.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// localStorage 键名映射
const STORAGE_KEYS = [
    { key: 'pw_projects', table: 'projects' },
    { key: 'pw_tasks', table: 'tasks' },
    { key: 'pw_todos', table: 'todos' },
    { key: 'pw_members', table: 'members' },
    { key: 'pw_documents', table: 'documents' },
    { key: 'pw_notifications', table: 'notifications' },
];

/**
 * 初始化数据库表结构
 */
function initTables() {
    console.log('初始化数据库表结构...');
    
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
            actual_end_date TEXT
        );

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
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'member',
            avatar_color TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            title TEXT NOT NULL,
            content TEXT,
            file_path TEXT,
            created_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT NOT NULL,
            message TEXT,
            type TEXT,
            read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
    `);
    console.log('数据库表结构初始化完成');
}

/**
 * 从 localStorage 导出数据（通过读取已导出的 JSON 文件）
 */
function exportLocalStorageData() {
    console.log('\n请确保已导出 localStorage 数据文件...');
    console.log('在浏览器控制台中运行: exportAllData()');
    console.log('并将导出的文件放置在此目录: migration-data/');
    
    const dataDir = path.join(__dirname, '../migration-data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    return dataDir;
}

/**
 * 迁移单个表的数据
 */
function migrateTable(localStorageKey, tableName) {
    console.log(`\n迁移表: ${tableName} (key: ${localStorageKey})`);
    
    const dataFile = path.join(__dirname, '../migration-data', `${tableName}.json`);
    if (!fs.existsSync(dataFile)) {
        console.log(`  跳过: 未找到数据文件 ${dataFile}`);
        return 0;
    }
    
    const rawData = fs.readFileSync(dataFile, 'utf8');
    let items;
    try {
        const parsed = JSON.parse(rawData);
        // 兼容不同的数据格式
        items = parsed.data?.[localStorageKey] || parsed[localStorageKey] || parsed;
        if (!Array.isArray(items)) {
            items = Object.values(items);
        }
    } catch (err) {
        console.log(`  错误: 无法解析数据文件 - ${err.message}`);
        return 0;
    }
    
    if (!items || items.length === 0) {
        console.log('  跳过: 数据为空');
        return 0;
    }
    
    let inserted = 0;
    const tableColumns = getColumnNames(tableName);
    
    // 根据表结构调整插入语句
    const insertSql = getInsertSql(tableName, tableColumns);
    const stmt = db.prepare(insertSql);
    
    for (const item of items) {
        try {
            const values = tableColumns.map(col => item[col] ?? null);
            stmt.run(...values);
            inserted++;
        } catch (err) {
            console.log(`  警告: 插入记录失败 - ${err.message}`);
        }
    }
    
    console.log(`  已插入 ${inserted} 条记录`);
    return inserted;
}

/**
 * 获取表的列名
 */
function getColumnNames(tableName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.map(c => c.name);
}

/**
 * 生成插入 SQL
 */
function getInsertSql(tableName, columns) {
    const cols = columns.filter(c => !c.includes('_id') && c !== 'rowid');
    const placeholders = cols.map(() => '?').join(', ');
    return `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;
}

/**
 * 主迁移函数
 */
function migrate() {
    console.log('='.repeat(50));
    console.log('项目工作台数据迁移工具');
    console.log('='.repeat(50));
    
    // 初始化数据库
    initTables();
    
    // 导出 localStorage 数据目录
    const dataDir = exportLocalStorageData();
    
    // 迁移数据
    let totalInserted = 0;
    for (const { key, table } of STORAGE_KEYS) {
        totalInserted += migrateTable(key, table);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`迁移完成! 共插入 ${totalInserted} 条记录`);
    console.log(`数据库位置: ${dbPath}`);
    console.log('='.repeat(50));
    
    db.close();
}

// 运行迁移
migrate();
