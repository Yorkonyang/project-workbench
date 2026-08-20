/**
 * 轻流(QingFlow) 集成模块
 * 分为两套独立配置：
 *   1. pushConfig  - Q-Source 推送（推送待办/任务到轻流 BPM）
 *   2. syncConfig  - 开放平台 OAuth（同步组织架构和成员）
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

// 配置文件路径（使用绝对路径避免 __dirname 问题）
const CONFIG_PATH = path.resolve('D:/AI/project-workbench/data/qingflow-config.json');

// 加载持久化配置
function loadPushConfig() {
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { baseUrl: '', qsourceId: '' };
    }
}

// 保存配置到文件
function savePushConfig(config) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('[轻流配置] 保存失败:', e.message);
    }
}

// ===== 推送配置（Q-Source） =====
// 用于将任务/待办推送到轻流 Q-Source 被动数据源
let pushConfig = loadPushConfig();
// 确保结构完整
pushConfig.baseUrl = pushConfig.baseUrl || '';
pushConfig.qsourceId = pushConfig.qsourceId || '';

// ===== 同步配置（开放平台 OAuth） =====
// 用于通过开放平台 API 同步组织架构和成员
let syncConfig = {
    baseUrl: '',          // 开放平台地址（可能与 Q-Source 地址不同）
    appId: '',            // 开放平台应用 AppID
    secret: '',           // 开放平台应用 Secret
    accessToken: '',      // 当前有效的 OAuth Token
    tokenExpiry: 0,       // Token 过期时间戳
    tokenApiPath: '/api/v1/oauth/token',
    deptApiPath: '/api/v1/dept/list',
    userApiPath: '/api/v1/user/list',
};

// ===== 推送配置 CRUD =====
function getPushConfig() {
    return { ...pushConfig };
}

function setPushConfig(config) {
    pushConfig = { ...pushConfig, ...config };
    // 移除非推送字段
    delete pushConfig.appId;
    delete pushConfig.secret;
    delete pushConfig.accessToken;
    delete pushConfig.tokenExpiry;
    // 持久化保存
    savePushConfig(pushConfig);
}

// ===== 同步配置 CRUD =====
function getSyncConfig() {
    return {
        baseUrl: syncConfig.baseUrl,
        appId: syncConfig.appId,
        secret: '******', // 不返回 secret 明文
        tokenExpiry: syncConfig.tokenExpiry,
    };
}

function setSyncConfig(config) {
    syncConfig = { ...syncConfig, ...config };
    // 移除非同步字段
    delete syncConfig.qsourceId;
}

// ===== 通用 HTTP 请求 =====
function qingflowRequest(method, url, body = null) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + (parsedUrl.search || ''),
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ raw: data });
                    }
                });
            });

            req.setTimeout(5000, () => {
                req.destroy(new Error('请求超时(5s)'));
            });

            req.on('error', reject);
            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        } catch (e) {
            reject(new Error(`URL解析失败: ${e.message}`));
        }
    });
}

// ===== OAuth Token 获取（同步用） =====
async function getAccessToken() {
    const { baseUrl, appId, secret, tokenApiPath } = syncConfig;

    if (syncConfig.accessToken && Date.now() < syncConfig.tokenExpiry) {
        return syncConfig.accessToken;
    }

    if (!baseUrl || !appId || !secret) {
        console.error('[轻流OAuth] 缺少配置: baseUrl / appId / secret');
        return null;
    }

    const url = `${baseUrl}${tokenApiPath}`;
    console.log('[轻流OAuth] 请求 Token:', url);

    try {
        const result = await qingflowRequest('POST', url, {
            app_id: appId,
            secret: secret,
            grant_type: 'client_credentials'
        });

        let token = null;
        if (result && result.errCode === 0 && result.data) {
            token = result.data.access_token || result.data.token;
        } else if (result && result.access_token) {
            token = result.access_token;
        } else if (result && result.token) {
            token = result.token;
        }

        if (token) {
            const expiresIn = result.expires_in || 7200;
            syncConfig.accessToken = token;
            syncConfig.tokenExpiry = Date.now() + (expiresIn - 60) * 1000;
            console.log('[轻流OAuth] Token 获取成功');
        } else {
            console.error('[轻流OAuth] Token 响应格式异常:', result);
        }

        return token;
    } catch (error) {
        console.error('[轻流OAuth] Token 请求失败:', error.message);
        return null;
    }
}

// ===== 组织架构获取（同步用） =====
async function getDepartments() {
    const { baseUrl, deptApiPath } = syncConfig;

    if (!baseUrl) {
        return { success: false, error: '同步配置中轻流地址未配置' };
    }

    const token = await getAccessToken();
    if (!token) {
        return { success: false, error: 'OAuth Token 获取失败，请检查同步配置' };
    }

    const url = `${baseUrl}${deptApiPath}`;
    console.log('[轻流同步] 获取组织架构:', url);

    const parsedUrl = new URL(url);
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    return new Promise((resolve) => {
        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    let departments = [];
                    if (Array.isArray(parsed)) departments = parsed;
                    else if (parsed.data && Array.isArray(parsed.data)) departments = parsed.data;
                    else if (parsed.errCode === 0) departments = parsed.data?.list || parsed.data?.departments || [];
                    console.log(`[轻流同步] 组织架构获取成功，共 ${departments.length} 个部门`);
                    resolve({ success: true, departments });
                } catch (e) {
                    resolve({ success: false, error: `响应解析失败: ${data.slice(0, 200)}` });
                }
            });
        });
        req.setTimeout(10000, () => req.destroy(new Error('超时10s')));
        req.on('error', err => resolve({ success: false, error: err.message }));
        req.end();
    });
}

async function getUsers() {
    const { baseUrl, userApiPath } = syncConfig;

    if (!baseUrl) {
        return { success: false, error: '同步配置中轻流地址未配置' };
    }

    const token = await getAccessToken();
    if (!token) {
        return { success: false, error: 'OAuth Token 获取失败' };
    }

    const url = `${baseUrl}${userApiPath}`;
    console.log('[轻流同步] 获取用户列表:', url);

    const parsedUrl = new URL(url);
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    return new Promise((resolve) => {
        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    let users = [];
                    if (Array.isArray(parsed)) users = parsed;
                    else if (parsed.data && Array.isArray(parsed.data)) users = parsed.data;
                    else if (parsed.errCode === 0) users = parsed.data?.list || parsed.data?.users || [];
                    console.log(`[轻流同步] 用户获取成功，共 ${users.length} 个用户`);
                    resolve({ success: true, users });
                } catch (e) {
                    resolve({ success: false, error: `响应解析失败: ${data.slice(0, 200)}` });
                }
            });
        });
        req.setTimeout(10000, () => req.destroy(new Error('超时10s')));
        req.on('error', err => resolve({ success: false, error: err.message }));
        req.end();
    });
}

// ===== 组织架构同步（同步用） =====
async function syncOrganization(localData) {
    const { baseUrl } = syncConfig;

    if (!baseUrl) {
        return { success: false, error: '同步配置中轻流地址未配置' };
    }

    const results = { syncedDepartments: 0, syncedMembers: 0, updatedMembers: 0, errors: [] };

    // 1. 同步组织架构
    const deptResult = await getDepartments();
    if (!deptResult.success) {
        return { success: false, error: `获取组织架构失败: ${deptResult.error}`, results };
    }

    if (deptResult.departments.length > 0 && localData) {
        if (!localData.departments) localData.departments = [];
        const existingDeptIds = new Set(localData.departments.map(d => d.id));
        let added = 0;

        for (const dept of deptResult.departments) {
            const deptId = dept.id || dept.dept_id || dept.department_id;
            const deptName = dept.name || dept.dept_name || '';
            const parentId = dept.parent_id || dept.parentId || null;

            if (!deptName) continue;

            if (existingDeptIds.has(deptId)) {
                const idx = localData.departments.findIndex(d => d.id === deptId);
                if (idx !== -1) {
                    localData.departments[idx] = {
                        ...localData.departments[idx],
                        name: deptName,
                        parentId,
                        updated_at: new Date().toISOString()
                    };
                }
            } else {
                const newDept = {
                    id: deptId || `dept_${Date.now()}_${added}`,
                    name: deptName,
                    parentId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                localData.departments.push(newDept);
                existingDeptIds.add(newDept.id);
                added++;
            }
        }
        results.syncedDepartments = added;
    }

    // 2. 同步成员
    const userResult = await getUsers();
    if (!userResult.success) {
        results.errors.push(`获取用户失败: ${userResult.error}`);
    } else if (userResult.users.length > 0 && localData) {
        if (!localData.members) localData.members = [];
        const existingEmails = new Set(localData.members.map(m => m.email));
        let addedMembers = 0, updatedMembers = 0;

        for (const user of userResult.users) {
            const userId = user.id || user.user_id || user.userId;
            const userName = user.name || user.username || user.real_name || user.realName || '';
            const userEmail = user.email || user.mail || '';
            const phone = user.phone || user.mobile || '';
            const deptId = user.dept_id || user.deptId || user.department_id || user.departmentId;

            if (!userName && !userEmail) continue;

            if (userEmail && existingEmails.has(userEmail)) {
                const idx = localData.members.findIndex(m => m.email === userEmail);
                if (idx !== -1) {
                    localData.members[idx] = {
                        ...localData.members[idx],
                        name: userName || localData.members[idx].name,
                        email: userEmail,
                        phone: phone || localData.members[idx].phone,
                        departmentId: deptId,
                        source: 'qingflow',
                        updated_at: new Date().toISOString()
                    };
                    updatedMembers++;
                }
            } else {
                const newMember = {
                    id: userId || `mem_${Date.now()}_${addedMembers}`,
                    name: userName,
                    email: userEmail,
                    password: (userEmail || userName).split('@')[0] + '123', // 默认密码：邮箱@前部分+123
                    phone,
                    departmentId: deptId,
                    role: 'member',
                    avatarColor: '#3b82f6',
                    source: 'qingflow',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                localData.members.push(newMember);
                if (userEmail) existingEmails.add(userEmail);
                addedMembers++;
            }
        }
        results.syncedMembers = addedMembers;
        results.updatedMembers = updatedMembers;
    }

    console.log('[轻流同步] 同步完成:', results);
    return { success: true, results };
}

// ===== 字段中文翻译映射（轻流字段值 → 中文） =====
const STATUS_LABELS = {
    done: '已完成',
    in_progress: '进行中',
    todo: '待处理',
    planned: '待启动',
    pending: '待处理',
    achieved: '已达成',
    overdue: '逾期',
};
const PRIORITY_LABELS = {
    low: '低优先级',
    medium: '中优先级',
    high: '高优先级',
};
const REMINDER_TYPE_LABELS = {
    overdue: '逾期提醒',
    escalation: '催办提醒',
};
function translateStatus(v) {
    if (!v) return '未开始';
    return STATUS_LABELS[v] || v;
}
function translatePriority(v) {
    if (!v) return '中优先级';
    return PRIORITY_LABELS[v] || v;
}
function translateReminderType(v) {
    if (!v) return '';
    return REMINDER_TYPE_LABELS[v] || v;
}

// ===== 推送（Q-Source，保持不变） =====
async function notifyTaskCreated(task) {
    const assignee = db.getMemberById(task.assigneeId || task.assignee)
        || db.getMemberByName(task.assignee)
        || db.getMemberByEmail(task.assignee);
    const assigneeEmail = assignee?.email || '';

    const projectId = task.projectId || task.project_id;
    const project = db.getProjectById(projectId);
    const projectTitle = project?.name || '项目工作台';

    const payload = {
        bt: task.title || '',
        ms: task.description || '',
        zrr: assigneeEmail,
        yxj: translatePriority(task.priority || 'medium'),
        jzrq: task.dueDate || '',
        ssxm: projectTitle,
        zht: translateStatus(task.status || '未开始'),
    };

    console.log('[轻流推送] 任务通知:', payload);
    return await sendToQSource(payload);
}

async function notifyTodoCreated(todo) {
    const member = db.getMemberById(todo.assignee)
        || db.getMemberByName(todo.assignee)
        || db.getMemberByEmail(todo.assignee);
    const assigneeEmail = member?.email || '';

    const projectId = todo.projectId;
    const project = db.getProjectById(projectId);
    const projectTitle = project?.name || '项目工作台';

    const payload = {
        bt: todo.title || '',
        ms: todo.description || '',
        zrr: assigneeEmail,
        yxj: translatePriority(todo.priority || 'medium'),
        jzrq: todo.dueDate || '',
        ssxm: projectTitle,
        zht: translateStatus(todo.status || '未开始'),
    };

    console.log('[轻流推送] 待办通知:', payload);
    return await sendToQSource(payload);
}

/**
 * 逾期/催办通知推送到轻流 Q-Source
 * @param {Object} notification - 前端生成的逾期通知对象
 *   notification.relatedType: 'task' | 'todo' | 'milestone'
 *   notification.relatedId: 关联对象 ID
 *   notification.type: 'overdue' | 'escalation'（提醒类型）
 *   notification.overdueDays: 逾期天数（可选，缺省时由截止日期计算）
 */
async function notifyOverdue(notification) {
    const data = db.loadData();
    const { relatedType, relatedId, type } = notification || {};

    let item = null;
    let assigneeIds = [];
    let priority = 'medium';
    let dueDate = '';
    let title = '';
    let description = '';
    let projectId = '';
    let status = 'overdue';

    if (relatedType === 'task') {
        item = (data.tasks || []).find((t) => t.id === relatedId);
        if (item) {
            assigneeIds = item.assignees || (item.assignee ? [item.assignee] : []);
            priority = item.priority || 'medium';
            dueDate = item.dueDate || '';
            title = item.title || '';
            description = item.description || '';
            projectId = item.projectId || '';
            status = item.status || '未开始';
        }
    } else if (relatedType === 'todo') {
        item = (data.todos || []).find((t) => t.id === relatedId);
        if (item) {
            assigneeIds = item.assignee ? [item.assignee] : [];
            priority = item.priority || 'medium';
            dueDate = item.dueDate || '';
            title = item.title || '';
            description = item.description || '';
            projectId = item.projectId || '';
            status = item.status || '未开始';
        }
    } else if (relatedType === 'milestone') {
        item = (data.milestones || []).find((m) => m.id === relatedId);
        if (item) {
            assigneeIds = item.assignee ? [item.assignee] : (item.assignees || []);
            priority = 'high';
            dueDate = item.date || '';
            title = item.title || '';
            description = item.deliverables || '';
            projectId = item.projectId || '';
            status = 'overdue';
        }
    }

    if (!item) {
        console.warn('[轻流推送] 逾期通知关联对象不存在:', relatedType, relatedId);
        return { success: false, error: '关联对象不存在' };
    }

    // 逾期天数：优先用前端传入，否则按截止日期与今天计算
    let overdueDays = notification.overdueDays;
    if (!overdueDays && dueDate) {
        const due = new Date(dueDate);
        const diffTime = Date.now() - due.getTime();
        overdueDays = Math.max(1, Math.floor(diffTime / (24 * 60 * 60 * 1000)));
    }
    overdueDays = overdueDays || 1;

    // 负责人邮箱（兼容 id / 姓名 / 邮箱），多个用分号拼接
    const emails = assigneeIds
        .map((id) => {
            const m = db.getMemberById(id) || db.getMemberByName(id) || db.getMemberByEmail(id);
            return m?.email || '';
        })
        .filter(Boolean);
    const assigneeEmail = emails.join(';') || '';

    const project = db.getProjectById(projectId);
    const projectTitle = project?.name || '项目工作台';

    const payload = {
        bt: title,          // 标题
        ms: description,    // 描述
        zrr: assigneeEmail, // 责任人（邮箱，多值分号分隔）
        yxj: translatePriority(priority),      // 优先级（中文）
        jzrq: dueDate,      // 截止日期
        ssxm: projectTitle, // 所属项目
        zht: translateStatus(status),          // 状态（中文）
        yqts: overdueDays,  // 逾期天数（新增字段）
        txlx: translateReminderType(type),     // 提醒类型（中文）：逾期提醒 / 催办提醒
    };

    console.log('[轻流推送] 逾期通知:', payload);
    return await sendToQSource(payload);
}

async function sendToQSource(payload) {
    const { baseUrl, qsourceId } = pushConfig;

    if (!qsourceId) {
        console.warn('[轻流推送] Q-Source ID 未配置');
        return { success: false, errCode: -1, errMsg: 'Q-Source ID 未配置' };
    }

    const url = `${baseUrl}/api/qsource/${qsourceId}`;

    try {
        const result = await qingflowRequest('POST', url, payload);

        if (result.errCode === 0 || result.errCode === undefined) {
            console.log('[轻流推送] 推送成功');
            return { success: true, data: result };
        }

        console.error('[轻流推送] 推送失败:', result);
        return {
            success: false,
            errCode: result.errCode,
            error: `轻流Q-Source错误 [${result.errCode}]: ${result.errMsg || '未知错误'}`,
            rawData: result
        };
    } catch (error) {
        console.error('[轻流推送] 网络错误:', error.message);
        return { success: false, errCode: -2, error: `网络错误: ${error.message}` };
    }
}

async function testConnection() {
    const testPayload = {
        bt: '[系统测试] 项目工作台集成验证',
        ms: '这是一条测试消息，用于验证 Q-Source 接口是否正常连接。',
        zrr: 'user@example.com',
        yxj: translatePriority('low'),
        jzrq: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ssxm: '项目工作台',
    };

    console.log('[轻流推送] 测试消息:', testPayload);
    return await sendToQSource(testPayload);
}

async function addFormData(formData) {
    console.log('[轻流推送] 表单数据:', formData);
    return await sendToQSource(formData);
}

module.exports = {
    getPushConfig,
    setPushConfig,
    getSyncConfig,
    setSyncConfig,
    getAccessToken,
    getDepartments,
    getUsers,
    syncOrganization,
    notifyTaskCreated,
    notifyTodoCreated,
    notifyOverdue,
    addFormData,
    testConnection,
};