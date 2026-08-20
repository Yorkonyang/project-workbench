/**
 * 种子数据：默认用户 + 示例系统档案 + 默认设置
 * 幂等：仅在 users 为空时执行
 */
const bcrypt = require('bcryptjs');
const { db } = require('./index');

const SALT_ROUNDS = 10;

/** 默认用户（admin/admin123；其余成员 123456） */
const USERS = [
  { username: 'admin', name: '杨大白', password: 'admin123', role: 'admin', email: 'admin@itc.local' },
  { username: 'zhangsan', name: '张三', password: '123456', role: 'member', email: 'zhangsan@itc.local' },
  { username: 'lisi', name: '李四', password: '123456', role: 'member', email: 'lisi@itc.local' },
  { username: 'wangwu', name: '王五', password: '123456', role: 'member', email: 'wangwu@itc.local' }
];

/** 示例系统档案（开发用 localhost 探测地址）
 *  - ERP/PLM 指向本后端自探活接口 /api/health（返回 200 → ok）
 *  - MOM/BPM 走 TCP 探活 127.0.0.1:3001（本后端端口 → ok）
 *  - QMS 指向不存在端口 9999（→ down，用于演示告警→工单→通知联动）
 */
const SYSTEMS = [
  {
    name: 'ERP 企业资源计划', code: 'erp', version: 'U8 Cloud v3.0',
    base_url: 'http://localhost:3001', health_type: 'http', health_path: '/api/health',
    expected_status: 200, check_interval: 1, owner: 'admin', vendor: '用友',
    description: '财务+供应链+生产计划核心系统，数据库 Oracle 19c'
  },
  {
    name: 'PLM 产品生命周期管理', code: 'plm', version: '10.1',
    base_url: 'http://127.0.0.1:3001', health_type: 'http', health_path: '/api/health',
    expected_status: 200, check_interval: 1, owner: 'zhangsan', vendor: '思普',
    description: '研发数据管理与 BOM 管理，数据库 SQL Server 2019'
  },
  {
    name: 'QMS 质量管理系统', code: 'qms', version: 'v2.5',
    base_url: 'http://localhost:9999', health_type: 'http', health_path: '/api/health',
    expected_status: 200, check_interval: 1, owner: 'lisi', vendor: '赛意',
    description: '来料/过程/出货质量管理，数据库 MySQL 8.0（示例：端口不可达，用于演示告警链路）'
  },
  {
    name: 'MOM 制造运营管理', code: 'mom', version: 'v3.2',
    base_url: '127.0.0.1', health_type: 'tcp', health_path: '',
    db_host: '127.0.0.1', db_port: 3001, expected_status: 200,
    check_interval: 1, owner: 'zhangsan', vendor: '赛意',
    description: 'MES→MOM 升级后的制造执行平台'
  },
  {
    name: 'BPM 流程管理平台', code: 'bpm', version: '轻流 v6',
    base_url: '127.0.0.1', health_type: 'tcp', health_path: '',
    db_host: '127.0.0.1', db_port: 3001, expected_status: 200,
    check_interval: 1, owner: 'wangwu', vendor: '轻流',
    description: '流程审批/IT服务台流程，对接轻流 Q-Source'
  }
];

/** 默认设置（轻流未配置时推送仅 log 不报错） */
const SETTINGS = [
  { key: 'qingflow_base_url', value: '' },
  { key: 'qingflow_qsource_id', value: '' },
  { key: 'sla_policy', value: JSON.stringify({
    urgent: { responseHours: 0.5, resolveHours: 4 },
    high: { responseHours: 1, resolveHours: 8 },
    medium: { responseHours: 4, resolveHours: 24 },
    low: { responseHours: 8, resolveHours: 72 }
  }) }
];

/** 插入默认数据（幂等） */
function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount > 0) {
    return { seeded: false, reason: 'users 已存在，跳过' };
  }

  const insertUser = db.prepare(
    'INSERT INTO users (username, name, password_hash, role, email) VALUES (?, ?, ?, ?, ?)'
  );
  const userIds = {};
  const tx = db.transaction(() => {
    for (const u of USERS) {
      const hash = bcrypt.hashSync(u.password, SALT_ROUNDS);
      const info = insertUser.run(u.username, u.name, hash, u.role, u.email);
      userIds[u.username] = info.lastInsertRowid;
    }
  });
  tx();
  console.log('[seed] 已创建默认用户:', USERS.map((u) => u.username).join(', '));

  const insertSystem = db.prepare(`
    INSERT INTO systems (
      name, code, version, base_url, health_type, health_path,
      db_host, db_port, expected_status, check_interval, owner_id, vendor, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const sysTx = db.transaction(() => {
    for (const s of SYSTEMS) {
      insertSystem.run(
        s.name, s.code, s.version, s.base_url || '', s.health_type, s.health_path || '',
        s.db_host || null, s.db_port || null, s.expected_status || 200,
        s.check_interval || 5, userIds[s.owner] || userIds.admin, s.vendor || '', s.description || ''
      );
    }
  });
  sysTx();
  console.log('[seed] 已创建示例系统档案:', SYSTEMS.map((s) => s.code).join(', '));

  const insertSetting = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
  );
  for (const s of SETTINGS) {
    insertSetting.run(s.key, s.value);
  }
  console.log('[seed] 已写入默认设置');

  return { seeded: true };
}

module.exports = { seedIfEmpty, USERS, SYSTEMS };