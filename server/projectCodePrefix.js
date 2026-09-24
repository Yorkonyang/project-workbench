/**
 * 项目编号前缀（纯函数）——后端 Node CommonJS 镜像
 *
 * 与前端 `src/lib/projectCodePrefix.js`（ESM 单一真源）保持同步，
 * 约定同 `server/hierarchy.js` ↔ `src/lib/hierarchy.js`。
 * 仅 import/require 与导出方式差异，算法逐函数一致。
 *
 * 顶层依赖 pinyin-pro（由根 node_modules 向上解析，服务端 require 可解析）。
 */

'use strict';

const { pinyin } = require('pinyin-pro');

/** 转义正则特殊字符（用于把前缀安全地拼进正则） */
function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 取成员归属部门 id。
 * 规则：
 *  - 先取 `String(member.departmentId ?? member.department ?? '')`；
 *  - 若该值在 deptIdSet 中，直接返回（视为已是部门 id）；
 *  - 否则用 nameToId（部门名→id，兼容 legacy `department` 存名称的数据）二次解析，
 *    解析出的 id 仍在 deptIdSet 中才返回；
 *  - 全部失败返回 null（归入「无部门」尾组）。
 *
 * @param {object} member 成员对象
 * @param {Set<string>} deptIdSet 合法部门 id 集合
 * @param {Object<string,string>} nameToId 部门名→部门 id 映射
 * @returns {string|null} 部门 id 或 null
 */
function deptKeyOf(member, deptIdSet, nameToId) {
  const raw = String(member ? (member.departmentId ?? member.department ?? '') : '');
  if (raw !== '' && deptIdSet.has(raw)) return raw;
  if (raw !== '' && nameToId && Object.prototype.hasOwnProperty.call(nameToId, raw)) {
    const id = nameToId[raw];
    if (id != null && deptIdSet.has(id)) return id;
  }
  return null;
}

/**
 * 按「组织结构顺序」对成员排序，返回成员 id 序列（string[]）。
 *
 * 顺序规则（已定稿）：
 *  - 根节点 = departments 中 parentId 为 null/''/undefined 者，按 id 字符串升序；
 *  - 深度优先：先输出该部门自身成员，再递归子部门；同级子部门按 id 升序；
 *  - 部门内成员按 `String(m.created_at || m.createdAt || '')` 升序，
 *    id 升序作次级稳定键；
 *  - 无部门成员排全序列最后，同样按 created_at 升序（id 次级）；
 *  - visited 防环；另做「不可达部门」兜底访问，避免漏排成员。
 *
 * @param {Array<object>} members 成员数组
 * @param {Array<object>} departments 部门数组
 * @returns {string[]} 成员 id 序列
 */
function orderMembersByOrg(members, departments) {
  const byId = new Map();
  (departments || []).forEach((d) => {
    if (d && d.id != null) byId.set(String(d.id), d);
  });
  const deptIdSet = new Set(byId.keys());
  const nameToId = {};
  (departments || []).forEach((d) => {
    if (d && d.name != null) nameToId[String(d.name)] = String(d.id);
  });

  // 部门内成员分组 + 无部门尾组
  const membersByDept = new Map(); // deptId -> member[]
  const noDept = [];
  (members || []).forEach((m) => {
    if (!m || m.id == null) return;
    const k = deptKeyOf(m, deptIdSet, nameToId);
    if (k == null) {
      noDept.push(m);
    } else {
      let list = membersByDept.get(k);
      if (!list) {
        list = [];
        membersByDept.set(k, list);
      }
      list.push(m);
    }
  });

  // 部门内 / 无部门 成员的稳定排序：created_at 升序，id 升序次级
  const createdKey = (m) => String(m.created_at || m.createdAt || '');
  const idKey = (m) => String(m.id ?? '');
  const cmpMembers = (a, b) => {
    const ca = createdKey(a);
    const cb = createdKey(b);
    if (ca !== cb) return ca < cb ? -1 : 1;
    const ia = idKey(a);
    const ib = idKey(b);
    if (ia !== ib) return ia < ib ? -1 : 1;
    return 0;
  };
  membersByDept.forEach((list) => list.sort(cmpMembers));
  noDept.sort(cmpMembers);

  // 子部门索引（父 id -> 子 id[]），同级按 id 升序
  const isRootParent = (pid) => pid === null || pid === undefined || String(pid).trim() === '';
  const childrenOf = new Map();
  (departments || []).forEach((d) => {
    if (!d || d.id == null) return;
    if (isRootParent(d.parentId)) return;
    const p = String(d.parentId);
    if (byId.has(p)) {
      let kids = childrenOf.get(p);
      if (!kids) {
        kids = [];
        childrenOf.set(p, kids);
      }
      kids.push(String(d.id));
    }
  });
  childrenOf.forEach((list) => list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));

  // 根部门：按 id 字符串升序
  const roots = (departments || [])
    .filter((d) => d && d.id != null && isRootParent(d.parentId))
    .map((d) => String(d.id))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const out = [];
  const visited = new Set();
  const dfs = (did) => {
    if (visited.has(did)) return;
    visited.add(did);
    const list = membersByDept.get(did);
    if (list) list.forEach((m) => out.push(String(m.id)));
    (childrenOf.get(did) || []).forEach(dfs);
  };
  roots.forEach(dfs);

  // 兜底：不可达部门（父 id 指向不存在的部门）仍访问一次，避免漏排成员
  membersByDept.forEach((_list, did) => {
    if (!visited.has(did)) dfs(did);
  });

  // 无部门成员排最末
  noDept.forEach((m) => out.push(String(m.id)));
  return out;
}

/**
 * 为未分配前缀的成员就地分配 `codePrefix`（固化原则：已有值不改写）。
 *
 * 语义（已定稿）：
 *  - 顺序 = orderMembersByOrg(...)；
 *  - 已有非空 codePrefix 的成员：直接跳过且不改写，但把其已用数字后缀登记进
 *    used[base] 集合（无数字尾记 0）；
 *  - 未分配成员：base = initialsOf(m)；digit = used[base] ? max(used[base])+1 : 0；
 *    m.codePrefix = digit===0 ? base : base+String(digit)；写入并登记 used[base]。
 *
 * 注意：本函数会 in-place 修改传入的 members 对象（调用方对测试数据请深拷贝）。
 *
 * @param {Array<object>} members 成员数组（会被原地改写）
 * @param {Array<object>} departments 部门数组
 * @param {(member:object)=>string} initialsOf 注入回调：member -> 基础拼音首字母串
 * @returns {{changed:boolean, assigned:number}}
 */
function assignMissingPrefixes(members, departments, initialsOf) {
  const order = orderMembersByOrg(members, departments);
  const byId = new Map();
  (members || []).forEach((m) => {
    if (m && m.id != null) byId.set(String(m.id), m);
  });

  const used = {}; // base -> Set<number>
  const digitOf = (s) => {
    const m = String(s).match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const baseOf = (s) => String(s).replace(/\d+$/, '');

  let assigned = 0;
  for (const mid of order) {
    const m = byId.get(mid);
    if (!m) continue;

    const existing = m.codePrefix;
    if (existing != null && String(existing) !== '') {
      // 固化：不改写；仅登记已占用的数字后缀
      const base = baseOf(existing);
      const set = used[base] || (used[base] = new Set());
      set.add(digitOf(existing));
      continue;
    }

    const base = String(initialsOf(m) ?? '');
    const set = used[base] || (used[base] = new Set());
    let digit = 0;
    if (set.size > 0) {
      let max = 0;
      set.forEach((d) => {
        if (d > max) max = d;
      });
      digit = max + 1;
    }
    m.codePrefix = digit === 0 ? base : base + String(digit);
    set.add(digit);
    assigned += 1;
  }
  return { changed: assigned > 0, assigned };
}

/**
 * 计算某前缀下下一个可用的「根项目编号」。
 * 遍历**全部** projects（含 archived / mergedInto）的 code 取 max，
 * 删除不回号、防撞号；子项目码含 `.` 天然不命中。
 *
 * @param {Array<object>} projects 全部项目数组
 * @param {string} prefix 前缀（如 'SJ'）
 * @returns {string} 下一个根项目 code（如 'SJ_010'），>999 自动进位不截断
 */
function pickNextRootCode(projects, prefix) {
  const pfx = String(prefix ?? '');
  const re = new RegExp('^' + escapeRe(pfx) + '_(\\d+)$');
  let max = 0;
  (projects || []).forEach((pr) => {
    if (!pr || pr.code == null) return;
    const m = String(pr.code).match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return pfx + '_' + String(max + 1).padStart(3, '0');
}

/**
 * 成员姓名 → 拼音大写首字母前缀（Q3 兜底链）。
 *  - pinyin(name, { toneType:'none', type:'array', nonChinese:'consecutive' })
 *    （复用 src/lib/pinyinMatch.js 第 16/20 行同款调用方式）；
 *  - 每音节取首字符，仅保留 /[a-z]/ 字母（非字母丢弃），全名拼成大写串；
 *  - 若为空：取 String(email).split('@')[0] 中的 ASCII 大写字母；
 *  - 仍为空：返回 'U'。
 *
 * @param {string} name 姓名
 * @param {string} email 邮箱
 * @returns {string} 大写前缀
 */
function memberInitials(name, email) {
  const nm = String(name ?? '').trim();
  let s = '';
  if (nm !== '') {
    const arr = pinyin(nm, { toneType: 'none', type: 'array', nonChinese: 'consecutive' });
    s = arr
      .map((x) => {
        const c = String(x ?? '').charAt(0);
        return /^[a-z]$/.test(c) ? c : '';
      })
      .join('')
      .toUpperCase();
  }
  if (s === '') {
    const local = String(email ?? '').split('@')[0];
    s = (local.match(/[A-Za-z]/g) || []).map((c) => c.toUpperCase()).join('');
  }
  if (s === '') s = 'U';
  return s;
}

module.exports = {
  escapeRe,
  deptKeyOf,
  orderMembersByOrg,
  assignMissingPrefixes,
  pickNextRootCode,
  memberInitials,
};
