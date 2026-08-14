# 轻流集成使用说明

## 🎯 功能概述

项目工作台现已支持与轻流系统对接，当创建任务或待办时，会自动推送消息到轻流系统，并通过企业微信触达责任人。

## 📋 配置步骤

### 1. 获取轻流 API 凭证

1. 登录轻流系统 (填写您的轻流服务器地址)
2. 进入「轻商城」→「拓展插件」
3. 安装「OPEN API」插件
4. 在配置页面获取：
   - **accessToken**: 访问凭证（类似密码）
   - **appKey**: 应用ID（从应用URL或基本信息中获取）

### 2. 配置轻流表单

在轻流中创建一个表单用于接收任务/待办数据，建议字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 标题 | 单行文字 | 任务/待办标题 |
| 描述 | 多行文字 | 任务/待办描述 |
| 责任人 | 单行文字 | 责任人姓名 |
| 优先级 | 下拉选择 | high/medium/low |
| 截止日期 | 日期 | dueDate |
| 来源系统 | 单行文字 | 项目工作台 |

**记录表单的 queId（字段ID）**，用于后续配置。

### 3. 配置项目工作台

访问轻流配置页面：http://localhost:5173/qingflow-config.html

填入以下信息：
- **API基础地址**: https://api.qingflow.com（或你的专有轻流地址）
- **Access Token**: 从轻流获取的凭证
- **App Key**: 轻流应用ID

点击「保存配置」和「测试连接」。

### 4. 更新 qingflow.js

修改 `server/qingflow.js` 文件，将表单字段的 `queId` 替换为你实际创建的表单字段ID：

```javascript
// 在 notifyTaskCreated 和 notifyTodoCreated 函数中
answers: [
    {
        queId: 1,  // 替换为你的实际 queId
        queTitle: '任务标题',
        queType: 1,
        values: [{ value: task.title || '' }]
    },
    // ... 其他字段
]
```

## 🧪 测试通知

配置完成后：
1. 访问 http://localhost:5173/qingflow-config.html
2. 在「测试通知推送」区域填写信息
3. 点击「发送测试通知」
4. 查看「推送历史记录」确认状态

## 📊 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/qingflow/config` | GET | 获取当前配置 |
| `/api/qingflow/config` | POST | 保存配置 |
| `/api/qingflow/test` | GET | 测试连接 |

## 🔧 环境变量

可通过环境变量覆盖配置：

```bash
QINGFLOW_BASE_URL=https://api.qingflow.com
QINGFLOW_ACCESS_TOKEN=your_token_here
QINGFLOW_APP_KEY=your_app_key
QINGFLOW_USER_ID=optional_user_id
```

## ⚠️ 注意事项

1. **异步发送**: 通知推送是异步的，不会阻塞任务/待办的创建
2. **失败处理**: 如果推送失败，会记录错误日志，但不会影响数据保存
3. **权限要求**: 确保 accessToken 具有对应应用的写入权限
4. **字段匹配**: 确保表单字段与代码中的 queId 匹配

## 📞 帮助

如有问题，请参考：
- 轻流OpenAPI文档: https://help.qingflow.com/
- 轻流企业微信集成: https://news.qingflow.com/update-aotopush
