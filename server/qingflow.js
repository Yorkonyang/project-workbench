/**
 * 轻流(QingFlow) Q-Source 集成模块
 * 用于将任务/待办推送到轻流 Q-Source 被动数据源
 */

const https = require('https');
const http = require('http');
const db = require('./db');

// 轻流 Q-Source 配置（默认值，可通过 API 覆盖）
let qingflowConfig = {
    baseUrl: 'https://gkbpm.grinm.com:56555',
    qsourceId: '3b3d042e-c032-46fe-994f-19cee0c36474',  // Q-Source 接口 UUID
};

/**
 * 更新配置
 */
function setConfig(config) {
    qingflowConfig = { ...qingflowConfig, ...config };
}

/**
 * 获取当前配置
 */
function getConfig() {
    return { ...qingflowConfig };
}

/**
 * 发送HTTP/HTTPS请求
 */
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

            // 5秒超时，防止网络不通时阻塞服务器
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

/**
 * 发送任务通知到 Q-Source
 * 字段映射（与轻流 Q-Source 配置一致）：
 *   bt   - 任务标题
 *   ms   - 任务描述
 *   zrr  - 责任人（邮箱地址）
 *   yxj  - 优先级
 *   jzrq - 截止日期
 *   ssxm - 所属项目
 *   zht  - 状态
 */
async function notifyTaskCreated(task) {
    // 按 ID → 姓名 → 邮箱 顺序查找成员
    const assignee = db.getMemberById(task.assigneeId || task.assignee)
        || db.getMemberByName(task.assignee)
        || db.getMemberByEmail(task.assignee);
    const assigneeEmail = assignee?.email || '';

    // 获取项目名称（ssxm）
    const projectId = task.projectId || task.project_id;
    const project = db.getProjectById(projectId);
    const projectTitle = project?.name || '项目工作台';

    const payload = {
        bt: task.title || '',           // 任务标题
        ms: task.description || '',     // 任务描述
        zrr: assigneeEmail,             // 责任人（邮箱）
        yxj: task.priority || 'medium', // 优先级
        jzrq: task.dueDate || '',       // 截止日期
        ssxm: projectTitle,             // 所属项目（使用真实项目名称）
        zht: task.status || '未开始',    // 状态
    };

    console.log('[轻流推送] 任务通知:', payload);
    return await sendToQSource(payload);
}

/**
 * 发送待办通知到 Q-Source
 * 解析负责人：assignee 字段可能是成员 ID、姓名或邮箱
 */
async function notifyTodoCreated(todo) {
    // 按 ID → 姓名 → 邮箱 顺序查找成员，最终取 email
    const member = db.getMemberById(todo.assignee)
        || db.getMemberByName(todo.assignee)
        || db.getMemberByEmail(todo.assignee);
    const assigneeEmail = member?.email || '';

    // 获取项目名称（ssxm）
    const projectId = todo.projectId;
    const project = db.getProjectById(projectId);
    const projectTitle = project?.name || '项目工作台';

    const payload = {
        bt: todo.title || '',           // 待办标题
        ms: todo.description || '',     // 待办描述
        zrr: assigneeEmail,             // 责任人（邮箱）
        yxj: todo.priority || 'medium', // 优先级
        jzrq: todo.dueDate || '',       // 截止日期
        ssxm: projectTitle,             // 所属项目（使用真实项目名称）
        zht: todo.status || '未开始',    // 状态
    };

    console.log('[轻流推送] 待办通知:', payload);
    return await sendToQSource(payload);
}

/**
 * 发送数据到 Q-Source
 */
async function sendToQSource(payload) {
    const { baseUrl, qsourceId } = qingflowConfig;

    if (!qsourceId) {
        console.warn('[轻流推送] Q-Source ID 未配置，跳过推送。请通过 POST /api/qingflow/config 设置 qsourceId');
        return { success: false, errCode: -1, errMsg: 'Q-Source ID 未配置' };
    }

    const url = `${baseUrl}/api/qsource/${qsourceId}`;

    try {
        const result = await qingflowRequest('POST', url, payload);

        // Q-Source 返回 errCode=0 表示成功
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

/**
 * 测试 Q-Source 连接（发送一条测试数据）
 */
async function testConnection() {
    const testPayload = {
        bt: '[系统测试] 项目工作台集成验证',
        ms: '这是一条测试消息，用于验证 Q-Source 接口是否正常连接。',
        zrr: 'cio@grinm.com',  // 使用测试邮箱
        yxj: 'low',
        jzrq: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ssxm: '项目工作台',
    };

    console.log('[轻流推送] 测试消息:', testPayload);
    return await sendToQSource(testPayload);
}

/**
 * 直接提交表单数据到 Q-Source（调试/通用接口）
 */
async function addFormData(formData) {
    console.log('[轻流推送] 表单数据:', formData);
    return await sendToQSource(formData);
}

module.exports = {
    setConfig,
    getConfig,
    notifyTaskCreated,
    notifyTodoCreated,
    addFormData,
    testConnection,
};
