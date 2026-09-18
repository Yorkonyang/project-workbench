/**
 * Excel 导入解析模块
 * 解析轻流导出的组织架构/成员 Excel 文件
 * 支持两种格式：
 *   1. 部门表 + 成员表（两个 sheet）
 *   2. 单表含部门层级列（一级部门/二级部门/三级部门...）
 */
import * as XLSX from 'xlsx';

const SHEET_PATTERNS = {
  department: /部门|组织架构|dept/i,
  member: /成员|用户|人员|user|member/i,
};

const HEADER_ALIASES = {
  // 成员字段
  name: ['姓名', '名字', '名称', '用户名', '用户名称', '真实姓名', '员工姓名', '姓名/名称', 'name'],
  account: ['账号', '用户账号', '工号', '员工编号', '账号/工号', '工号/账号', 'account', 'userid', 'user_id'],
  email: ['邮箱', '邮件', '电子邮件', '邮箱地址', 'email', 'mail', 'e-mail'],
  phone: ['手机', '手机号', '手机号码', '电话', '联系电话', 'phone', 'mobile', 'tel'],
  // 成员表的"所属部门"列（不放"部门"短词，避免与部门表的"部门名称/部门编号"冲突）
  department: ['所属部门', '所属组织', '部门/单位', 'department', 'dept'],
  role: ['角色', '职位', '岗位', '职务', 'role', 'position', 'title'],
  // 部门字段（部门表专属）
  deptCode: ['部门编号', '部门编码', '组织编码', '部门ID', 'dept_id', 'deptid', 'department_id'],
  deptName: ['部门名称', '组织名称', 'dept_name', 'deptname'],
  parentDept: ['上级部门名称', '上级部门', '上级组织', '父部门', '父级部门', 'parent', 'parent_dept', 'parent_id'],
  // 层级列（轻流按层级展开的格式）
  level1: ['一级部门', '一级组织', '一级部门名称'],
  level2: ['二级部门', '二级组织', '二级部门名称'],
  level3: ['三级部门', '三级组织', '三级部门名称'],
  level4: ['四级部门', '四级组织', '四级部门名称'],
  level5: ['五级部门', '五级组织', '五级部门名称'],
};

/** 将 sheet 解析为 JSON 行数组（自动去重表头、空行） */
function sheetToRows(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.filter((r) => Object.values(r).some((v) => String(v).trim() !== ''));
}

/** 匹配表头别名，返回标准化字段
 * 匹配策略（按优先级）：
 *  1. 表头完整等于某个 alias（最高优先级，避免"部门"截胡"部门名称"）
 *  2. 表头包含某个 alias（取最长的 alias，避免短别名胜出）
 */
function normalizeHeaders(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    const header = String(key).trim();
    let matched = null;

    // 第一轮：完整相等
    if (!matched) {
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(header)) {
          matched = field;
          break;
        }
      }
    }

    // 第二轮：子串包含（取最长 alias，避免"部门"胜出"部门名称"）
    if (!matched) {
      let bestLen = 0;
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        for (const a of aliases) {
          if (header.includes(a) && a.length > bestLen) {
            matched = field;
            bestLen = a.length;
          }
        }
      }
    }

    if (matched) {
      normalized[matched] = value;
    } else {
      normalized[header] = value;
    }
  }
  return normalized;
}

/**
 * 解析成员行 → 标准成员对象
 */
function parseMemberRow(row) {
  const r = normalizeHeaders(row);
  return {
    name: String(r.name || r.account || '').trim(),
    account: String(r.account || '').trim(),
    email: String(r.email || '').trim(),
    phone: String(r.phone || '').trim(),
    department: String(r.department || '').trim(),
    role: String(r.role || '').trim(),
  };
}

/**
 * 解析部门行 → 标准部门对象
 */
function parseDeptRow(row) {
  const r = normalizeHeaders(row);
  const dept = {
    id: String(r.deptCode || '').trim(),
    name: String(r.deptName || '').trim(),
    parentName: String(r.parentDept || '').trim(),
  };
  // 如果只有 name（无 deptName 字段），尝试用 name
  if (!dept.name && r.name) dept.name = String(r.name).trim();
  // 如果 name 是空但有编号，用编号当名称兜底
  if (!dept.name && dept.id) dept.name = dept.id;
  return dept;
}

/**
 * 处理层级列格式（一级部门~五级部门）
 * 将每一行拆成多条部门记录，建立父子关系
 */
function processHierarchyRows(rows) {
  const depts = [];
  const seen = new Set();

  rows.forEach((row) => {
    const r = normalizeHeaders(row);
    let parentName = '';
    for (let lvl = 1; lvl <= 5; lvl++) {
      const key = `level${lvl}`;
      const name = String(r[key] || '').trim();
      if (!name) break;
      const deptKey = `${parentName} > ${name}`;
      if (!seen.has(deptKey)) {
        seen.add(deptKey);
        depts.push({
          id: '',
          name,
          parentName,
        });
      }
      parentName = name;
    }
  });

  return depts;
}

/**
 * 主入口：解析整个工作簿
 * @param {ArrayBuffer|string} data - Excel 文件内容
 * @returns {{ departments: Array, members: Array, hasHierarchy: boolean, fileName: string }}
 */
export function parseOrgExcel(data) {
  const workbook = XLSX.read(data, { type: 'array' });
  const result = { departments: [], members: [], warnings: [] };

  // 收集所有 sheet 的行
  const deptSheets = [];
  const memberSheets = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = sheetToRows(sheet);
    if (rows.length === 0) return;

    if (SHEET_PATTERNS.department.test(sheetName)) {
      deptSheets.push({ name: sheetName, rows });
    } else if (SHEET_PATTERNS.member.test(sheetName)) {
      memberSheets.push({ name: sheetName, rows });
    } else {
      // 无法识别 sheet 类型：尝试从表头判断
      const firstRow = rows[0];
      const headers = Object.keys(firstRow).join(' ');
      if (/姓名|账号|工号|邮箱|手机/.test(headers) && !/部门名称|上级部门/.test(headers)) {
        memberSheets.push({ name: sheetName, rows });
      } else if (/部门名称|上级部门|一级部门|部门编码/.test(headers)) {
        deptSheets.push({ name: sheetName, rows });
      } else {
        result.warnings.push(`跳过无法识别的 sheet「${sheetName}」`);
      }
    }
  });

  // 解析部门
  let hierarchyDetected = false;
  deptSheets.forEach(({ rows }) => {
    // 检查是否层级列格式
    const normalized = normalizeHeaders(rows[0]);
    const hasHierarchyCols = [1, 2, 3, 4, 5].some((lvl) => normalized[`level${lvl}`] !== undefined);
    if (hasHierarchyCols) {
      hierarchyDetected = true;
      const hierarchyDepts = processHierarchyRows(rows);
      // 合并去重（按 父>名）
      hierarchyDepts.forEach((d) => {
        if (!result.departments.some((x) => x.name === d.name && x.parentName === d.parentName)) {
          result.departments.push(d);
        }
      });
    } else {
      rows.forEach((row) => {
        const d = parseDeptRow(row);
        if (d.name && !result.departments.some((x) => x.name === d.name && x.parentName === d.parentName)) {
          result.departments.push(d);
        }
      });
    }
  });

  // 解析成员
  memberSheets.forEach(({ rows }) => {
    rows.forEach((row) => {
      const m = parseMemberRow(row);
      if ((m.name || m.email) && !result.members.some((x) => (x.email && x.email === m.email) || (!m.email && x.name === m.name))) {
        result.members.push(m);
      }
    });
  });

  // 将父部门名称转换为 parentId（需要先建立 name->id 映射）
  if (result.departments.length > 0) {
    const nameToId = {};
    // 先分配 id（无编号的生成）
    result.departments.forEach((d, i) => {
      if (!d.id) d.id = `dept_imp_${i + 1}_${Date.now().toString(36)}`;
    });
    result.departments.forEach((d) => { nameToId[d.name] = d.id; });
    // 处理父子关系：parentName → parentId
    result.departments.forEach((d) => {
      if (d.parentName && nameToId[d.parentName]) {
        // 自引用（parentName 等于自己）当作顶级
        d.parentId = nameToId[d.parentName] === d.id ? null : nameToId[d.parentName];
      } else {
        d.parentId = null;
      }
      delete d.parentName;
    });
  }

  // 成员部门名称 → departmentId
  if (result.members.length > 0 && result.departments.length > 0) {
    const nameToId = {};
    result.departments.forEach((d) => { nameToId[d.name] = d.id; });
    result.members.forEach((m) => {
      if (m.department && nameToId[m.department]) {
        m.departmentId = nameToId[m.department];
      } else {
        m.departmentId = m.department || '';
      }
      delete m.department;
    });
  }

  result.hasHierarchy = hierarchyDetected;
  return result;
}

/**
 * 生成 Excel 导入模板下载
 */
export function generateTemplate() {
  const deptData = [
    { 部门编号: 'D001', 部门名称: '研发中心', 上级部门名称: '' },
    { 部门编号: 'D0011', 部门名称: '前端组', 上级部门名称: '研发中心' },
    { 部门编号: 'D0012', 部门名称: '后端组', 上级部门名称: '研发中心' },
    { 部门编号: 'D002', 部门名称: '测试中心', 上级部门名称: '' },
  ];
  const memberData = [
    { 姓名: '张三', 账号: 'zhangsan', 邮箱: 'zhangsan@grinm.com', 手机号: '13800138000', 所属部门: '前端组' },
    { 姓名: '李四', 账号: 'lisi', 邮箱: 'lisi@grinm.com', 手机号: '13900139000', 所属部门: '后端组' },
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(deptData);
  const ws2 = XLSX.utils.json_to_sheet(memberData);
  XLSX.utils.book_append_sheet(wb, ws1, '部门表');
  XLSX.utils.book_append_sheet(wb, ws2, '成员表');
  XLSX.writeFile(wb, '组织架构成员导入模板.xlsx');
}