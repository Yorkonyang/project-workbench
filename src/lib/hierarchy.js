/**
 * 层级工具（前端单一真源）
 *
 * 与后端 `server/hierarchy.js` 逻辑保持一致。
 * 约定：
 *  - `parentProjectId` 为 `null` / `""` / `"__root__"` 表示主项目（根，level 0）
 *  - `level` **永不持久化**，任何需要层级深度的地方都调用 `getProjectLevel`
 *  - `MAX_DEPTH` 默认 4：根(level0) + 最多 4 层子孙 = 5 个展示层级
 *  - 判定「能否再建子项目」：`getProjectLevel(p) < MAX_DEPTH`
 */

export const MAX_DEPTH = 4;
export const ROOT = null;

/** 归一化 parentProjectId：null/''/'__root__' 统一视为根（null） */
export function normalizeParent(parent) {
  if (parent === null || parent === undefined) return null;
  const s = String(parent).trim();
  if (s === '' || s === '__root__') return null;
  return s;
}

/** 沿 parentProjectId 上溯计算层级，根=0，带环保护 */
export function getLevel(projects, id) {
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
    // 无 MAX_DEPTH 硬截断：环完全由 visited 防住（数据损坏才有自环），
    // 保证深层子树的相对深度（maxSubtreeDepth）被准确计算，改挂深度校验才正确。
  }
  return level;
}

/** 别名：与 store 的 getProjectLevel 语义一致（按 id 查当前项目集合），便于页面直接调用 */
export const getProjectLevel = getLevel;

/** 收集某根项目的「自身 + 全部子孙」id 集合（BFS，防环） */
export function collectSubtree(projects, rootId) {
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
export function getChildren(projects, parentId) {
  const par = normalizeParent(parentId);
  return (projects || []).filter((p) => normalizeParent(p.parentProjectId) === par);
}

/** 取某项目的全部子孙（不含自身） */
export function getDescendants(projects, id) {
  const subtree = collectSubtree(projects, id);
  subtree.delete(id);
  return (projects || []).filter((p) => subtree.has(p.id));
}

/** 取某项目的祖先链（根在前，直属父在后，不含自身） */
export function getAncestors(projects, id) {
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
  return result.reverse(); // 根 → ... → 直属父
}

/** 把 source 挂到 target 下是否成环（target 落在 source 子树内即环） */
export function wouldCreateCycle(projects, sourceId, targetId) {
  if (!sourceId || !targetId) return false;
  if (sourceId === targetId) return true;
  return collectSubtree(projects, sourceId).has(targetId);
}

/** 某子树相对根的最深层级差（根自身为 0） */
export function maxSubtreeDepth(projects, rootId) {
  const base = getLevel(projects, rootId);
  let max = 0;
  collectSubtree(projects, rootId).forEach((id) => {
    if (id === rootId) return;
    const d = getLevel(projects, id) - base;
    if (d > max) max = d;
  });
  return max;
}

/** 层级编号生成器：子项目编号 = 父编号 + '.' + 同级序号（单数字，如 XM_001 → XM_001.1；XM_001.1 → XM_001.1.1） */
export function formatHierarchyCode(parentCode, seq) {
  const n = String(seq);
  if (!parentCode) return n;
  return `${parentCode}.${n}`;
}
