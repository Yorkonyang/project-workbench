/**
 * Project Workbench API Server
 * 使用 Express + SQLite 提供 REST API
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/workbench.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database schema
function initializeDatabase() {
    db.exec(`
        -- Projects table
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            archived INTEGER DEFAULT 0
        );

        -- Tasks table
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

        -- Todos table
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

        -- Members table
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            role TEXT DEFAULT 'member',
            avatar_color TEXT,
            created_at TEXT NOT NULL
        );

        -- Documents table
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

        -- Notifications table
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
}

initializeDatabase();

// Helper functions
function generateId() {
    return require('uuid').v4();
}

function getCurrentTime() {
    return new Date().toISOString();
}

// Projects API
app.get('/api/projects', (req, res) => {
    try {
        const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', (req, res) => {
    try {
        const { name, description } = req.body;
        const id = generateId();
        const now = getCurrentTime();
        db.prepare('INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, name, description, 'active', now, now);
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        res.status(201).json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/projects/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status, archived } = req.body;
        const now = getCurrentTime();
        db.prepare('UPDATE projects SET name = ?, description = ?, status = ?, archived = ?, updated_at = ? WHERE id = ?')
            .run(name, description, status, archived ? 1 : 0, now, id);
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/projects/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tasks API
app.get('/api/projects/:projectId/tasks', (req, res) => {
    try {
        const { projectId } = req.params;
        const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/:projectId/tasks', (req, res) => {
    try {
        const { projectId } = req.params;
        const { title, description, priority, dueDate, assignee } = req.body;
        const id = generateId();
        const now = getCurrentTime();
        db.prepare('INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, assignee, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, projectId, title, description, 'todo', priority, dueDate, assignee, now, now);
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const now = getCurrentTime();
        
        const fields = Object.keys(updates).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(now, id);
        
        db.prepare(`UPDATE tasks SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Todos API
app.get('/api/todos', (req, res) => {
    try {
        const todos = db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all();
        res.json(todos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/todos', (req, res) => {
    try {
        const { title, description, priority, dueDate, assignee, projectId, remindDays, remindAt, enableEscalation } = req.body;
        const id = generateId();
        const now = getCurrentTime();
        db.prepare(`INSERT INTO todos (id, project_id, title, description, completed, priority, due_date, assignee, remind_days, remind_at, enable_escalation, created_at, updated_at) 
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, projectId, title, description, priority, dueDate, assignee, remindDays, remindAt, enableEscalation ? 1 : 0, now, now);
        const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
        res.status(201).json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/todos/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const now = getCurrentTime();
        
        const fields = Object.keys(updates).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(now, id);
        
        db.prepare(`UPDATE todos SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
        const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/todos/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM todos WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);
});

module.exports = { app, db };
