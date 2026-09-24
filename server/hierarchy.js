/**
 * 层级工具（后端 Node CommonJS）
 *
 * 与前端 `src/lib/hierarchy.js` 逻辑保持一致。
 * 常量 `MAX_DEPTH = 3`、`ROOT = null`。
 */

const MAX_DEPTH = 4;
const ROOT = null;

/** 归一化 parentProjectId：null/''/'__root__' 统一视为根（null） */
function normalizeParent(parent) {
  if (parent === null || parent === undefined) return null;
  const s = String(parent).trim();
  if (s === '' || s === '__root__') return null;
  return s;
}

/** 沿 parentProjectId 上溯计算层级，根=0，带环保护 */
function getLevel(projects, id) {
  let level = 0;
  let cur = (projects || []).find((p) => p.id === id);
  const visited = new Set();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    const parent = normalizeParent(cur.parentProjectId);
    if (parent === null) break;
    cur = (projects || []).find((p) => p.id === parent);
    if (!cur) break;
    level += 1;
    // 无 MAX_DEPTH 硬截断：环完全由 visited 防住，保证深层子树相对深度计算准确
  }
  return level;
}

/** 收集某根项目的「自身 + 全部子孙」id 集合（BFS，防环） */
function collectSubtree(projects, rootId) {
  const ids = new Set();
  if (rootId != null) ids.add(rootId);
  const childrenMap = {};
  (projects || []).forEach((p) => {
    const par = normalizeParent(p.parentProjectId);
    if (par) {
      (childrenMap[par] = childrenMap[par] || []).push(p.id);
    }
  });
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop();
    (childrenMap[cur] || []).forEach((childId) => {
      if (!ids.has(childId)) {
        ids.add(childId);
        stack.push(childId);
      }
    });
  }
  return ids;
}

/** 取某父项目下的直属子项目（parentId 为 null 时返回根项目） */
function getChildren(projects, parentId) {
  const par = normalizeParent(parentId);
  return (projects || []).filter((p) => normalizeParent(p.parentProjectId) === par);
}

/** 取某项目的全部子孙（不含自身） */
function getDescendants(projects, id) {
  const subtree = collectSubtree(projects, id);
  subtree.delete(id);
  return (projects || []).filter((p) => subtree.has(p.id));
}

/** 取某项目的祖先链（根在前，直属父在后，不含自身） */
function getAncestors(projects, id) {
  const result = [];
  const visited = new Set();
  let cur = (projects || []).find((p) => p.id === id);
  let guard = 0;
  while (cur && guard <= MAX_DEPTH + 5) {
    guard += 1;
    const parent = normalizeParent(cur.parentProjectId);
    if (parent === null) break;
    if (visited.has(parent)) break;
    visited.add(parent);
    const p = (projects || []).find((x) => x.id === parent);
    if (!p) break;
    result.push(p);
    cur = p;
  }
  return result.reverse();
}

/** 把 source 挂到 target 下是否成环 */
function wouldCreateCycle(projects, sourceId, targetId) {
  if (!sourceId || !targetId) return false;
  if (sourceId === targetId) return true;
  return collectSubtree(projects, sourceId).has(targetId);
}

/** 某子树相对根的最深层级差 */
function maxSubtreeDepth(projects, rootId) {
  const base = getLevel(projects, rootId);
  let max = 0;
  collectSubtree(projects, rootId).forEach((id) => {
    if (id === rootId) return;
    const d = getLevel(projects, id) - base;
    if (d > max) max = d;
  });
  return max;
}

/** 层级编号生成器：子项目编号 = 父编号 + '.' + 同级序号（单数字，父码前缀无关，如 YYG_001 → YYG_001.1） */
function formatHierarchyCode(parentCode, seq) {
  const n = String(seq);
  if (!parentCode) return n;
  return `${parentCode}.${n}`;
}

module.exports = {
  MAX_DEPTH,
  ROOT,
  normalizeParent,
  getLevel,
  collectSubtree,
  getChildren,
  getDescendants,
  getAncestors,
  wouldCreateCycle,
  maxSubtreeDepth,
  formatHierarchyCode,
};
