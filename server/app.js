/**
 * API Server - 使用 Mock Database 进行演示
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const MockDatabase = require('./db/mockDatabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = new MockDatabase(path.join(__dirname, '../data/workbench.db'));

// Add CORS headers for all responses
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'mock',
        server: 'project-workbench-api'
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    const stats = db.getStats();
    res.json(stats);
});

// ==================== Projects API ====================
app.get('/api/projects', (req, res) => {
    try {
        const projects = db.getProjects();
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', (req, res) => {
    try {
        const project = db.createProject(req.body);
        res.status(201).json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/projects/:id', (req, res) => {
    try {
        const project = db.updateProject(req.params.id, req.body);
        if (project) {
            res.json(project);
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/projects/:id', (req, res) => {
    try {
        const deleted = db.deleteProject(req.params.id);
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Tasks API ====================
app.get('/api/projects/:projectId/tasks', (req, res) => {
    try {
        const tasks = db.getTasks(req.params.projectId);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/:projectId/tasks', (req, res) => {
    try {
        const task = db.createTask({
            ...req.body,
            project_id: req.params.projectId
        });
        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tasks/:id', (req, res) => {
    try {
        const task = db.updateTask(req.params.id, req.body);
        if (task) {
            res.json(task);
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Todos API ====================
app.get('/api/todos', (req, res) => {
    try {
        const todos = db.getTodos();
        res.json(todos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/todos', (req, res) => {
    try {
        const todo = db.createTodo(req.body);
        res.status(201).json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/todos/:id', (req, res) => {
    try {
        const todo = db.updateTodo(req.params.id, req.body);
        if (todo) {
            res.json(todo);
        } else {
            res.status(404).json({ error: 'Todo not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/todos/:id', (req, res) => {
    try {
        const deleted = db.deleteTodo(req.params.id);
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Todo not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Members API ====================
app.get('/api/members', (req, res) => {
    try {
        const members = db.getMembers();
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/members', (req, res) => {
    try {
        const member = db.createMember(req.body);
        res.status(201).json(member);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Notifications API ====================
app.get('/api/notifications', (req, res) => {
    try {
        const userId = req.query.userId;
        const notifications = db.getNotifications(userId);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notifications', (req, res) => {
    try {
        const notification = db.createNotification(req.body);
        res.status(201).json(notification);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Seed Data ====================
app.post('/api/seed', (req, res) => {
    try {
        const seedData = {
            projects: [
                { name: 'QMS 系统升级', description: '质量管理系统升级改造', status: 'active' },
                { name: 'ERP 数据迁移', description: '用友 ERP 数据迁移项目', status: 'active' }
            ],
            members: [
                { name: '张三', email: 'zhangsan@grkin.com', role: 'admin' },
                { name: '李四', email: 'lisi@grkin.com', role: 'member' }
            ]
        };

        seedData.projects.forEach(p => db.createProject(p));
        seedData.members.forEach(m => db.createMember(m));

        res.json({ success: true, message: 'Seed data created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Project Workbench API Server running on http://localhost:${PORT}`);
    console.log(`📊 API Endpoints:`);
    console.log(`   GET    /api/health       - Health check`);
    console.log(`   GET    /api/projects     - Get all projects`);
    console.log(`   POST   /api/projects     - Create project`);
    console.log(`   PUT    /api/projects/:id - Update project`);
    console.log(`   DELETE /api/projects/:id - Delete project`);
    console.log(`   GET    /api/tasks        - Get all tasks`);
    console.log(`   POST   /api/todos        - Create todo`);
    console.log(`   GET    /api/notifications - Get notifications`);
    console.log(`\n📁 Database: ${path.join(__dirname, '../data/workbench.db')}`);
});

module.exports = app;
