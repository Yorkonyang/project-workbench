/**
 * Mock Database - 模拟 SQLite 数据库
 * 用于演示和测试 API 接口
 */

const fs = require('fs');
const path = require('path');

class MockDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.data = this.load();
        this.listeners = [];
    }

    load() {
        try {
            if (fs.existsSync(this.dbPath)) {
                return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            }
        } catch (err) {
            console.error('Failed to load database:', err);
        }
        return {
            projects: [],
            tasks: [],
            todos: [],
            members: [],
            documents: [],
            notifications: []
        };
    }

    save() {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error('Failed to save database:', err);
        }
    }

    // Generate unique ID
    generateId() {
        return require('uuid').v4();
    }

    // Projects
    getProjects() {
        return this.data.projects || [];
    }

    createProject(project) {
        const newProject = {
            ...project,
            id: this.generateId(),
            status: project.status || 'active',
            archived: project.archived ? 1 : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.data.projects.push(newProject);
        this.save();
        return newProject;
    }

    updateProject(id, updates) {
        const index = this.data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            this.data.projects[index] = {
                ...this.data.projects[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.save();
            return this.data.projects[index];
        }
        return null;
    }

    deleteProject(id) {
        const index = this.data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            this.data.projects.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    // Tasks
    getTasks(projectId) {
        if (projectId) {
            return (this.data.tasks || []).filter(t => t.project_id === projectId);
        }
        return this.data.tasks || [];
    }

    createTask(task) {
        const newTask = {
            ...task,
            id: this.generateId(),
            status: task.status || 'todo',
            priority: task.priority || 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.data.tasks.push(newTask);
        this.save();
        return newTask;
    }

    updateTask(id, updates) {
        const index = this.data.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.data.tasks[index] = {
                ...this.data.tasks[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.save();
            return this.data.tasks[index];
        }
        return null;
    }

    // Todos
    getTodos() {
        return this.data.todos || [];
    }

    createTodo(todo) {
        const newTodo = {
            ...todo,
            id: this.generateId(),
            completed: todo.completed || 0,
            priority: todo.priority || 'medium',
            remind_days: todo.remind_days || 3,
            enable_escalation: todo.enable_escalation ? 1 : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.data.todos.push(newTodo);
        this.save();
        return newTodo;
    }

    updateTodo(id, updates) {
        const index = this.data.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            this.data.todos[index] = {
                ...this.data.todos[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.save();
            return this.data.todos[index];
        }
        return null;
    }

    deleteTodo(id) {
        const index = this.data.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            this.data.todos.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    // Members
    getMembers() {
        return this.data.members || [];
    }

    createMember(member) {
        const newMember = {
            ...member,
            id: this.generateId(),
            role: member.role || 'member',
            created_at: new Date().toISOString()
        };
        this.data.members.push(newMember);
        this.save();
        return newMember;
    }

    // Notifications
    getNotifications(userId) {
        if (userId) {
            return (this.data.notifications || []).filter(n => n.user_id === userId);
        }
        return this.data.notifications || [];
    }

    createNotification(notification) {
        const newNotification = {
            ...notification,
            id: this.generateId(),
            read: notification.read || 0,
            created_at: new Date().toISOString()
        };
        this.data.notifications.push(newNotification);
        this.save();
        return newNotification;
    }

    // Statistics
    getStats() {
        return {
            projects: this.data.projects?.length || 0,
            tasks: this.data.tasks?.length || 0,
            todos: this.data.todos?.length || 0,
            members: this.data.members?.length || 0,
            notifications: this.data.notifications?.length || 0
        };
    }
}

module.exports = MockDatabase;
