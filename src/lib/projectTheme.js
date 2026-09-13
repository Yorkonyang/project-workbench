// 与时间线甘特图保持一致的 4 色项目主题（淡灰、淡绿、淡蓝、淡桔色循环）
// 用于 GanttView 行底色、TaskCard 进行中列背景色等所有"按项目编号着色"的地方
//
// 家族色阶（levelShades）：主项目取 [0]（最深），子项目按层级依次 [1][2][3] 逐级变浅。
// 设计原则：肉眼可分辨"主项目最深 → 逐级变浅"，且最浅档（3）仍明显深于任务行底色
//（白色 / 最浅档 30% 混合），不与任务底色混淆。四档亮度须严格单调递增（最深→最浅）。
export const PROJECT_THEMES = [
  {
    rowBg: 'bg-slate-50', border: 'border-slate-200', nameBg: 'bg-slate-400', nameText: 'text-white', accent: 'border-slate-200',
    // 淡灰：档0 最深(#64748b) → 档1/档2 中深 → 档3 最浅(#ccd7e4)
    levelShades: ['#64748b', '#8496a8', '#a5b6c8', '#ccd7e4'],
  },
  {
    rowBg: 'bg-emerald-50', border: 'border-emerald-200', nameBg: 'bg-emerald-500', nameText: 'text-white', accent: 'border-emerald-200',
    // 淡绿：档0 最深(#047857) → 档1/档2 中深 → 档3 最浅(#a4e9cc)
    levelShades: ['#047857', '#0ea072', '#34c38e', '#a4e9cc'],
  },
  {
    rowBg: 'bg-blue-50', border: 'border-blue-200', nameBg: 'bg-blue-500', nameText: 'text-white', accent: 'border-blue-200',
    // 淡蓝：档0 最深(#1d4ed8) → 档1/档2 中深 → 档3 最浅(#a9c4f4)
    levelShades: ['#1d4ed8', '#2f74ec', '#5b93f8', '#a9c4f4'],
  },
  {
    rowBg: 'bg-amber-50', border: 'border-amber-200', nameBg: 'bg-amber-500', nameText: 'text-white', accent: 'border-amber-200',
    // 淡桔：档0 最深(#d97706) → 档1/档2 中深 → 档3 最浅(#f8c766)
    levelShades: ['#d97706', '#f69a08', '#f8b13a', '#f8c766'],
  },
];

// 取某主题在指定层级（0=主项目最深，逐级变浅；超过档数后停留在最浅档）的色阶
// 为保证"主项目最深 → 逐级变浅"严格成立，取色前对色阶按亮度升序排序
//（档0 必须最深、档3 必须最浅），杜绝手工配色时档位交叉（如一级比主项目还深）。
const _shadeCache = new Map();
export function getLevelShade(theme, level) {
  const shades = theme?.levelShades;
  if (!shades || shades.length === 0) return theme?.nameBg;
  // 用主题身份做 key，缓存排好序的色阶（按亮度从深到浅）
  let ordered = _shadeCache.get(theme);
  if (!ordered) {
    ordered = [...shades].sort((a, b) => lum(a) - lum(b)); // lum 越小越深
    _shadeCache.set(theme, ordered);
  }
  const idx = Math.max(0, Math.min(level, ordered.length - 1));
  return ordered[idx];
}

// YIQ 近似亮度（0~765，越小越深）
function lum(hex) {
  const [r, g, b] = parseHex(hex);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// 取某主题的「最浅档」（档3）
export function getLightestShade(theme) {
  return getLevelShade(theme, (theme?.levelShades || []).length - 1);
}

// 偶数行任务底色：白 → 家族最浅档 的 30% 混合（浅于最浅档，与白底仍有可辨区分）
export function getTaskAltBg(theme) {
  const target = parseHex(getLightestShade(theme));
  const [r, g, b] = target;
  const mix = (ch) => Math.round(255 + (ch - 255) * 0.3);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function parseHex(hex) {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full || 'ffffff', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const PROJECT_THEME_COUNT = PROJECT_THEMES.length;

// 给定 projects 数组，返回 Map<projectId, theme>。
// 项目索引规则：未归档项目按 code 字典序排序后顺序分配；归档项目不分配（返回 undefined）。
// 与甘特图 GanttView 行底色、TaskCard 进行中列背景色保持一致。
export function buildProjectThemeMap(projects) {
  const active = projects.filter((p) => !p.archived);
  const sorted = [...active].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  const map = new Map();
  sorted.forEach((p, idx) => {
    map.set(p.id, PROJECT_THEMES[idx % PROJECT_THEMES.length]);
  });
  return map;
}

// 便捷查询：给定 projectId 与 map，返回对应主题；找不到时回落到第 0 个（淡灰）
export function getProjectTheme(themeMap, projectId) {
  return themeMap.get(projectId) || PROJECT_THEMES[0];
}