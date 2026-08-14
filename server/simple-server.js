/**
 * 纯 Node.js 实现的 API 服务器（无需外部依赖）
 * 使用 built-in 模块：http, fs, path
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const qingflow = require('./qingflow');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/workbench.db');
const DB_DIR = path.dirname(DB_PATH);

// 确保数据目录存在
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// 初始化数据库文件
if (!fs.existsSync(DB_PATH)) {
    const initialData = {
        projects: [],
        tasks: [],
        todos: [],
        members: [],
        documents: [],
        notifications: [],
        risks: [],
        resources: [],
        milestones: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    console.log('数据库初始化完成:', DB_PATH);
}

// 加载数据
function loadData() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(data);
        // 兼容旧数据库：补全缺失字段
        if (!parsed.risks) parsed.risks = [];
        if (!parsed.resources) parsed.resources = [];
        if (!parsed.milestones) parsed.milestones = [];
        return parsed;
    } catch (err) {
        return { projects: [], tasks: [], todos: [], members: [], documents: [], notifications: [], risks: [], resources: [], milestones: [] };
    }
}

// 保存数据
function saveData(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// 生成唯一ID
function generateId() {
    return crypto.randomUUID();
}

// 解析请求体
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

// 发送响应
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end(JSON.stringify(data));
}

// 处理 OPTIONS 预检请求
function handleOptions(res) {
    sendResponse(res, 200, {});
}

// ==================== 路由处理 ====================

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const method = req.method;

    // CORS 预检
    if (method === 'OPTIONS') {
        handleOptions(res);
        return;
    }

    // 健康检查
    if (pathname === '/api/health' && method === 'GET') {
        sendResponse(res, 200, {
            status: 'ok',
            timestamp: new Date().toISOString(),
            server: 'project-workbench-api',
            database: 'local'
        });
        return;
    }

    // 统计数据
    if (pathname === '/api/stats' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, {
            projects: data.projects.length,
            tasks: data.tasks.length,
            todos: data.todos.length,
            members: data.members.length,
            notifications: data.notifications.length
        });
        return;
    }

    // 轻流配置管理
    if (pathname === '/api/qingflow/config' && method === 'GET') {
        sendResponse(res, 200, qingflow.getConfig());
        return;
    }

    if (pathname === '/api/qingflow/config' && method === 'POST') {
        const body = await parseBody(req);
        qingflow.setConfig(body);
        sendResponse(res, 200, { success: true, message: '配置已更新' });
        return;
    }

    // 轻流连接测试
    if (pathname === '/api/qingflow/test' && method === 'GET') {
        const result = await qingflow.testConnection();
        sendResponse(res, result.success ? 200 : 500, result);
        return;
    }

    // 轻流表单数据提交（调试用）
    if (pathname === '/api/qingflow/form-data' && method === 'POST') {
        const body = await parseBody(req);
        const result = await qingflow.addFormData(body);
        sendResponse(res, result.errCode === 0 ? 200 : 400, result);
        return;
    }

    // Projects API
    if (pathname.startsWith('/api/projects') && method === 'GET') {
        const data = loadData();
        const projectId = pathname.match(/\/api\/projects\/([^\/]+)/)?.[1];
        if (projectId) {
            const tasks = data.tasks.filter(t => t.projectId === projectId || t.project_id === projectId);
            sendResponse(res, 200, { project: data.projects.find(p => p.id === projectId), tasks });
        } else {
            sendResponse(res, 200, data.projects);
        }
        return;
    }

    // 创建项目 - POST /api/projects（严格匹配，不包括子路径）
    if (pathname === '/api/projects' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const project = {
            ...body,
            id: generateId(),
            status: body.status || 'active',
            archived: body.archived ? 1 : 0,
            archiveStatus: body.archiveStatus || 'none',
            archiveReason: body.archiveReason || '',
            archiveNote: body.archiveNote || '',
            archivedAt: body.archivedAt || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.projects.push(project);
        saveData(data);
        sendResponse(res, 201, project);
        return;
    }

    // 归档申请 - POST /api/projects/:id/archive
    if (pathname.match(/\/api\/projects\/[\w-]+\/archive$/) && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archiveStatus = 'requested';
            data.projects[index].archiveReason = body.reason || '';
            data.projects[index].archiveNote = body.note || '';
            data.projects[index].updated_at = new Date().toISOString();
            saveData(data);
            sendResponse(res, 200, data.projects[index]);
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // 审批通过 - POST /api/projects/:id/approve-archive
    if (pathname.match(/\/api\/projects\/[\w-]+\/approve-archive$/) && method === 'POST') {
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archiveStatus = 'approved';
            data.projects[index].archived = 1;
            data.projects[index].status = 'archived';
            data.projects[index].archivedAt = new Date().toISOString();
            data.projects[index].updated_at = new Date().toISOString();
            // 级联更新任务状态
            let tasksUpdated = 0;
            data.tasks.forEach(t => {
                if (t.projectId === id || t.project_id === id) {
                    t.status = 'archived';
                    t.archivedAt = new Date().toISOString();
                    tasksUpdated++;
                }
            });
            saveData(data);
            sendResponse(res, 200, { project: data.projects[index], tasksUpdated });
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // 驳回申请 - POST /api/projects/:id/reject-archive
    if (pathname.match(/\/api\/projects\/[\w-]+\/reject-archive$/) && method === 'POST') {
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archiveStatus = 'rejected';
            data.projects[index].updated_at = new Date().toISOString();
            saveData(data);
            sendResponse(res, 200, data.projects[index]);
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // 恢复项目 - POST /api/projects/:id/restore
    if (pathname.match(/\/api\/projects\/[\w-]+\/restore$/) && method === 'POST') {
        const data = loadData();
        const id = pathname.split('/')[3];
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index].archived = 0;
            data.projects[index].status = 'active';
            data.projects[index].archiveStatus = 'none';
            data.projects[index].updated_at = new Date().toISOString();
            // 级联恢复任务状态
            let tasksRestored = 0;
            data.tasks.forEach(t => {
                if ((t.projectId === id || t.project_id === id) && t.status === 'archived') {
                    t.status = 'todo';
                    t.archivedAt = null;
                    tasksRestored++;
                }
            });
            saveData(data);
            sendResponse(res, 200, { project: data.projects[index], tasksRestored });
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    if (pathname.match(/\/api\/projects\/[\w-]+/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            data.projects[index] = { ...data.projects[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.projects[index]);
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    if (pathname.match(/\/api\/projects\/[\w-]+/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const index = data.projects.findIndex(p => p.id === id);
        if (index !== -1) {
            // 级联删除关联任务
            const tasksToDelete = data.tasks.filter(t => t.projectId === id || t.project_id === id);
            tasksToDelete.forEach(t => {
                const taskIndex = data.tasks.findIndex(task => task.id === t.id);
                if (taskIndex !== -1) {
                    data.tasks.splice(taskIndex, 1);
                }
            });
            data.projects.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true, tasksDeleted: tasksToDelete.length });
        } else {
            sendResponse(res, 404, { error: 'Project not found' });
        }
        return;
    }

    // Tasks API
    if (pathname.match(/\/api\/projects\/[\w-]+\/tasks/) && method === 'GET') {
        const data = loadData();
        const projectId = pathname.split('/')[3];
        const tasks = data.tasks.filter(t => t.projectId === projectId || t.project_id === projectId);
        sendResponse(res, 200, tasks);
        return;
    }

    // 新增：获取所有任务（修复 P0-1）
    if (pathname === '/api/tasks' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.tasks);
        return;
    }

    if (pathname.match(/\/api\/projects\/[\w-]+\/tasks/) && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const projectId = pathname.split('/')[3];
        const task = {
            ...body,
            id: generateId(),
            projectId: projectId,        // 驼峰命名（前端 Store 用此名）
            project_id: projectId,        // 下划线命名（兼容旧数据）
            status: body.status || 'todo',
            priority: body.priority || 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.tasks.push(task);
        saveData(data);
        sendResponse(res, 201, task);

        // 异步发送轻流通知（不阻塞响应，5秒超时保护）
        if (body.assigneeId || body.assignee) {
            qingflow.notifyTaskCreated(task).then(result => {
                if (!result.success) {
                    console.error('[轻流通知] 任务推送失败:', result.error || result.errMsg);
                }
            }).catch(err => {
                console.error('[轻流通知] 任务推送异常:', err.message);
            });
        }
        return;
    }

    if (pathname.match(/\/api\/tasks\/[\w-]+/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const index = data.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            data.tasks[index] = { ...data.tasks[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.tasks[index]);
        } else {
            sendResponse(res, 404, { error: 'Task not found' });
        }
        return;
    }

    // Todos API
    if (pathname === '/api/todos' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.todos);
        return;
    }

    if (pathname === '/api/todos' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const todo = {
            ...body,
            id: generateId(),
            completed: body.completed || 0,
            priority: body.priority || 'medium',
            remind_days: body.remind_days || 3,
            enable_escalation: body.enable_escalation ? 1 : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.todos.push(todo);
        saveData(data);
        sendResponse(res, 201, todo);

        // 异步发送轻流通知（不阻塞响应，5秒超时保护）
        if (body.assignee) {
            qingflow.notifyTodoCreated(todo).then(result => {
                if (!result.success) {
                    console.error('[轻流通知] 待办推送失败:', result.error || result.errMsg);
                }
            }).catch(err => {
                console.error('[轻流通知] 待办推送异常:', err.message);
            });
        }
        return;
    }

    if (pathname.match(/\/api\/todos\/[\w-]+/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const index = data.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            data.todos[index] = { ...data.todos[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.todos[index]);
        } else {
            sendResponse(res, 404, { error: 'Todo not found' });
        }
        return;
    }

    if (pathname.match(/\/api\/todos\/[\w-]+/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const index = data.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            data.todos.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Todo not found' });
        }
        return;
    }

    // Members API
    if (pathname === '/api/members' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.members);
        return;
    }

    if (pathname === '/api/members' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const member = {
            ...body,
            id: generateId(),
            role: body.role || 'member',
            created_at: new Date().toISOString()
        };
        data.members.push(member);
        saveData(data);
        sendResponse(res, 201, member);
        return;
    }

    // Notifications API
    if (pathname === '/api/notifications' && method === 'GET') {
        const data = loadData();
        const userId = url.searchParams.get('userId');
        const notifications = userId ? data.notifications.filter(n => n.user_id === userId) : data.notifications;
        sendResponse(res, 200, notifications);
        return;
    }

    if (pathname === '/api/notifications' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const notification = {
            ...body,
            id: generateId(),
            read: body.read || 0,
            created_at: new Date().toISOString()
        };
        data.notifications.push(notification);
        saveData(data);
        sendResponse(res, 201, notification);
        return;
    }

    // 任务删除 - DELETE /api/tasks/:id
    if (pathname.match(/^\/api\/tasks\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const index = data.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            data.tasks.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Task not found' });
        }
        return;
    }

    // 任务更新 - PUT /api/tasks/:id
    if (pathname.match(/^\/api\/tasks\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const index = data.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            data.tasks[index] = { ...data.tasks[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.tasks[index]);
        } else {
            sendResponse(res, 404, { error: 'Task not found' });
        }
        return;
    }

    // Members API - 完整 CRUD
    if (pathname === '/api/members' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.members);
        return;
    }

    if (pathname === '/api/members' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const member = {
            ...body,
            id: body.id || generateId(),
            role: body.role || 'member',
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.members.push(member);
        saveData(data);
        sendResponse(res, 201, member);
        return;
    }

    // 成员更新 - PUT /api/members/:id
    if (pathname.match(/^\/api\/members\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        const index = data.members.findIndex(m => m.id === id);
        if (index !== -1) {
            data.members[index] = { ...data.members[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.members[index]);
        } else {
            sendResponse(res, 404, { error: 'Member not found' });
        }
        return;
    }

    // 成员删除 - DELETE /api/members/:id
    if (pathname.match(/^\/api\/members\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const index = data.members.findIndex(m => m.id === id);
        if (index !== -1) {
            data.members.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Member not found' });
        }
        return;
    }

    // Notifications API - 完整 CRUD
    if (pathname === '/api/notifications' && method === 'GET') {
        const data = loadData();
        const userId = url.searchParams.get('userId');
        const notifications = userId ? data.notifications.filter(n => n.user_id === userId) : data.notifications;
        sendResponse(res, 200, notifications);
        return;
    }

    if (pathname === '/api/notifications' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        const notification = {
            ...body,
            id: generateId(),
            read: body.read || 0,
            created_at: new Date().toISOString()
        };
        data.notifications.push(notification);
        saveData(data);
        sendResponse(res, 201, notification);
        return;
    }

    // 标记已读 - PUT /api/notifications/:id/read
    if (pathname.match(/^\/api\/notifications\/[\w-]+\/read$/) && method === 'PUT') {
        const id = pathname.split('/')[3];
        const data = loadData();
        const index = data.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            data.notifications[index].read = 1;
            data.notifications[index].updated_at = new Date().toISOString();
            saveData(data);
            sendResponse(res, 200, data.notifications[index]);
        } else {
            sendResponse(res, 404, { error: 'Notification not found' });
        }
        return;
    }

    // 全部标记已读 - PUT /api/notifications/read-all
    if (pathname === '/api/notifications/read-all' && method === 'PUT') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = body.userId;
        let count = 0;
        data.notifications.forEach(n => {
            if ((!userId || n.user_id === userId) && !n.read) {
                n.read = 1;
                n.updated_at = new Date().toISOString();
                count++;
            }
        });
        saveData(data);
        sendResponse(res, 200, { success: true, markedCount: count });
        return;
    }

    // 单个通知删除 - DELETE /api/notifications/:id
    if (pathname.match(/^\/api\/notifications\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        const index = data.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            data.notifications.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Notification not found' });
        }
        return;
    }

    // 清除已读 - DELETE /api/notifications/read
    if (pathname === '/api/notifications/read' && method === 'DELETE') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = body.userId;
        const before = data.notifications.length;
        data.notifications = data.notifications.filter(n => {
            if (n.read) return false;
            if (userId && n.user_id !== userId) return true;
            return true;
        });
        const removed = before - data.notifications.length;
        saveData(data);
        sendResponse(res, 200, { success: true, removedCount: removed });
        return;
    }

    // 清空全部 - DELETE /api/notifications/all
    if (pathname === '/api/notifications/all' && method === 'DELETE') {
        const body = await parseBody(req);
        const data = loadData();
        const userId = body.userId;
        const before = data.notifications.length;
        if (userId) {
            data.notifications = data.notifications.filter(n => n.user_id !== userId);
        } else {
            data.notifications = [];
        }
        const removed = before - data.notifications.length;
        saveData(data);
        sendResponse(res, 200, { success: true, removedCount: removed });
        return;
    }

    // ==================== Risks API ====================
    if (pathname === '/api/risks' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.risks || []);
        return;
    }

    if (pathname === '/api/risks' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.risks) data.risks = [];
        const risk = {
            ...body,
            id: body.id || generateId(),
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.risks.push(risk);
        saveData(data);
        sendResponse(res, 201, risk);
        return;
    }

    if (pathname.match(/^\/api\/risks\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.risks) data.risks = [];
        const index = data.risks.findIndex(r => r.id === id);
        if (index !== -1) {
            data.risks[index] = { ...data.risks[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.risks[index]);
        } else {
            sendResponse(res, 404, { error: 'Risk not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/risks\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.risks) data.risks = [];
        const index = data.risks.findIndex(r => r.id === id);
        if (index !== -1) {
            data.risks.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Risk not found' });
        }
        return;
    }

    // ==================== Resources API ====================
    if (pathname === '/api/resources' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.resources || []);
        return;
    }

    if (pathname === '/api/resources' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.resources) data.resources = [];
        const resource = {
            ...body,
            id: body.id || generateId(),
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.resources.push(resource);
        saveData(data);
        sendResponse(res, 201, resource);
        return;
    }

    if (pathname.match(/^\/api\/resources\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.resources) data.resources = [];
        const index = data.resources.findIndex(r => r.id === id);
        if (index !== -1) {
            data.resources[index] = { ...data.resources[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.resources[index]);
        } else {
            sendResponse(res, 404, { error: 'Resource not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/resources\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.resources) data.resources = [];
        const index = data.resources.findIndex(r => r.id === id);
        if (index !== -1) {
            data.resources.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Resource not found' });
        }
        return;
    }

    // ==================== Milestones API ====================
    if (pathname === '/api/milestones' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.milestones || []);
        return;
    }

    if (pathname === '/api/milestones' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.milestones) data.milestones = [];
        const milestone = {
            ...body,
            id: body.id || generateId(),
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.milestones.push(milestone);
        saveData(data);
        sendResponse(res, 201, milestone);
        return;
    }

    if (pathname.match(/^\/api\/milestones\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.milestones) data.milestones = [];
        const index = data.milestones.findIndex(m => m.id === id);
        if (index !== -1) {
            data.milestones[index] = { ...data.milestones[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.milestones[index]);
        } else {
            sendResponse(res, 404, { error: 'Milestone not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/milestones\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.milestones) data.milestones = [];
        const index = data.milestones.findIndex(m => m.id === id);
        if (index !== -1) {
            data.milestones.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Milestone not found' });
        }
        return;
    }

    // ==================== Documents API ====================
    if (pathname === '/api/documents' && method === 'GET') {
        const data = loadData();
        sendResponse(res, 200, data.documents || []);
        return;
    }

    if (pathname === '/api/documents' && method === 'POST') {
        const body = await parseBody(req);
        const data = loadData();
        if (!data.documents) data.documents = [];
        const doc = {
            ...body,
            id: body.id || generateId(),
            created_at: body.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        data.documents.push(doc);
        saveData(data);
        sendResponse(res, 201, doc);
        return;
    }

    if (pathname.match(/^\/api\/documents\/[\w-]+$/) && method === 'PUT') {
        const id = pathname.split('/').pop();
        const body = await parseBody(req);
        const data = loadData();
        if (!data.documents) data.documents = [];
        const index = data.documents.findIndex(d => d.id === id);
        if (index !== -1) {
            data.documents[index] = { ...data.documents[index], ...body, updated_at: new Date().toISOString() };
            saveData(data);
            sendResponse(res, 200, data.documents[index]);
        } else {
            sendResponse(res, 404, { error: 'Document not found' });
        }
        return;
    }

    if (pathname.match(/^\/api\/documents\/[\w-]+$/) && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const data = loadData();
        if (!data.documents) data.documents = [];
        const index = data.documents.findIndex(d => d.id === id);
        if (index !== -1) {
            data.documents.splice(index, 1);
            saveData(data);
            sendResponse(res, 200, { success: true });
        } else {
            sendResponse(res, 404, { error: 'Document not found' });
        }
        return;
    }

    // 404
    sendResponse(res, 404, { error: 'Not found' });
});

// 启动服务器
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('Project Workbench API Server');
    console.log('='.repeat(50));
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📁 Database: ${DB_PATH}`);
    console.log('');
    console.log('API Endpoints:');
    console.log('  GET    /api/health       - 健康检查');
    console.log('  GET    /api/stats        - 统计数据');
    console.log('  GET    /api/projects     - 获取所有项目');
    console.log('  POST   /api/projects     - 创建项目');
    console.log('  PUT    /api/projects/:id - 更新项目');
    console.log('  DELETE /api/projects/:id - 删除项目');
    console.log('  GET    /api/projects/:id/tasks - 获取项目任务');
    console.log('  POST   /api/projects/:id/tasks - 创建任务');
    console.log('  GET    /api/tasks        - 获取所有任务');
    console.log('  PUT    /api/tasks/:id    - 更新任务');
    console.log('  DELETE /api/tasks/:id    - 删除任务');
    console.log('  GET    /api/todos        - 获取所有待办');
    console.log('  POST   /api/todos        - 创建待办');
    console.log('  PUT    /api/todos/:id    - 更新待办');
    console.log('  DELETE /api/todos/:id    - 删除待办');
    console.log('  GET    /api/members      - 获取所有成员');
    console.log('  POST   /api/members      - 创建成员');
    console.log('  PUT    /api/members/:id  - 更新成员');
    console.log('  DELETE /api/members/:id  - 删除成员');
    console.log('  GET    /api/notifications- 获取通知');
    console.log('  POST   /api/notifications- 创建通知');
    console.log('  PUT    /api/notifications/:id/read - 标记已读');
    console.log('  PUT    /api/notifications/read-all - 全部已读');
    console.log('  DELETE /api/notifications/:id - 删除通知');
    console.log('  DELETE /api/notifications/read - 清除已读');
    console.log('  DELETE /api/notifications/all - 清空全部');
    console.log('  GET/POST/PUT/DELETE /api/risks       - 风险 CRUD');
    console.log('  GET/POST/PUT/DELETE /api/resources   - 资源 CRUD');
    console.log('  GET/POST/PUT/DELETE /api/milestones  - 里程碑 CRUD');
    console.log('  GET/POST/PUT/DELETE /api/documents   - 文档 CRUD');
    console.log('='.repeat(50));
});

// 错误处理
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ 端口 ${PORT} 已被占用，请更换端口或关闭其他服务`);
    } else {
        console.error('❌ 服务器错误:', err.message);
    }
    process.exit(1);
});
