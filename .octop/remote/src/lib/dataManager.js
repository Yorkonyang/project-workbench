/**
 * 数据导出/导入工具
 * 用于备份和迁移 localStorage 中的工作台数据
 */

const STORAGE_KEYS = [
  'pw_projects',
  'pw_tasks',
  'pw_milestones',
  'pw_documents',
  'pw_todos',
  'pw_risks',
  'pw_resources',
  'pw_members',
  'pw_notifications',
  'pw_reminder_config',
  'pw_auth',
];

/**
 * 导出全部数据为 JSON 文件
 */
export function exportAllData() {
  const data = {};
  STORAGE_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = null;
      }
    }
  });

  const exportObj = {
    _meta: {
      app: 'project-workbench',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
    },
    data,
  };

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workbench-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入数据
 * @param {File} file - 用户选择的 JSON 文件
 * @returns {Promise<void>}
 */
export function importAllData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        const data = obj.data || obj; // 兼容无 _meta 的旧格式

        STORAGE_KEYS.forEach((key) => {
          if (data[key] !== undefined && data[key] !== null) {
            localStorage.setItem(key, JSON.stringify(data[key]));
          }
        });

        resolve();
      } catch (err) {
        reject(new Error('文件格式错误，无法解析'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * 清空所有工作台数据（重置）
 */
export function clearAllData() {
  STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('pw_initialized');
}
