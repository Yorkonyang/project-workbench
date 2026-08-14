# 信息化项目管理平台 - 今日修复总结（续）

## 20:10 新增修复

### 1. 登录页标题修改
- **修改前**："集中管理<br />MOM & ERP 项目"（两行）
- **修改后**："集中管理各类项目"（一行，字体大小不变）
- **文件**：`src/pages/LoginPage.jsx`

### 2. 文档上传功能改造
**DocumentForm.jsx 重写：**
- 移除了"存放位置"和"文件大小"手动输入字段
- 新增文件上传控件（点击选择文件）
- 显示文件预览卡片（文件名、大小、类型图标）
- 支持预览/下载按钮
- 自动识别文件类型和大小

**DocumentGrid.jsx 增强：**
- 添加了有附件的文档点击预览/下载功能
- 图标在有无附件时有所不同

### 3. 时间线下拉菜单重复问题
- TimelinePage.jsx 删除了 Select 组件的 `placeholder="全部项目"` 属性
- 现在只有一处"全部项目"选项

### 4. 文档管理归档项目过滤
- DocumentsPage.jsx 项目筛选下拉框已修正为 `projects.filter((p) => !p.archived)`
- 下拉菜单只显示活跃项目，不显示已归档项目

## 所有修改文件列表
| 文件 | 修改内容 |
|------|---------|
| `src/pages/LoginPage.jsx` | 登录页标题改为"集中管理各类项目" |
| `src/components/documents/DocumentForm.jsx` | 重写，添加文件上传功能 |
| `src/components/documents/DocumentGrid.jsx` | 添加文件预览/下载功能 |
| `src/pages/TimelinePage.jsx` | 修复下拉菜单重复、里程碑管理 |
| `src/pages/DocumentsPage.jsx` | 过滤已归档项目 |
| `src/components/ui/Modal.jsx` | 使用 React Portal + 动态定位 |
| `src/components/timeline/GanttView.jsx` | 锁定表头/列、项目配色 |
| `src/store/useProjectStore.js` | 恢复项目时生成通知 |
| `src/components/layout/Header.jsx` | 过滤已归档项目通知 |
| `src/components/layout/Sidebar.jsx` | 过滤已归档项目通知 |
| `src/components/projects/ProjectCard.jsx` | 恢复项目时添加通知 |
| `src/pages/NotificationsPage.jsx` | 过滤已归档项目通知 |
| `src/pages/RisksPage.jsx` | 过滤已归档项目数据 |
| `src/pages/TodosPage.jsx` | 过滤已归档项目数据 |

## 验证状态
- ✅ 开发服务器运行中 http://localhost:5173/
- ✅ 所有修复已生效
