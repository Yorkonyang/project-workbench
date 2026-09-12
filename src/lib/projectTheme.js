// 与时间线甘特图保持一致的 4 色项目主题（淡灰、淡绿、淡蓝、淡桔色循环）
// 用于 GanttView 行底色、TaskCard 进行中列背景色等所有"按项目编号着色"的地方
//
// 家族色阶（levelShades）：主项目取 [0]，子项目按层级依次 [1][2][3] 逐级变浅。
// 设计原则：肉眼可分辨变浅，但最浅档（3）仍明显深于任务行底色（白色 / *-50），不与任务底色混淆。
export const PROJECT_THEMES = [
  {
    rowBg: 'bg-slate-50', border: 'border-slate-200', nameBg: 'bg-slate-400', nameText: 'text-white', accent: 'border-slate-200',
    levelShades: ['#94a3b8', '#aebccb', '#cbd6e3', '#e8eef4'], // 淡灰：档3=#e8eef4（比 slate-50 #f8fafc 略深，可辨但很浅）
  },
  {
    rowBg: 'bg-emerald-50', border: 'border-emerald-200', nameBg: 'bg-emerald-500', nameText: 'text-white', accent: 'border-emerald-200',
    levelShades: ['#10b981', '#5fd9ab', '#a4e9cc', '#ddf6ea'], // 淡绿：档3=#ddf6ea
  },
  {
    rowBg: 'bg-blue-50', border: 'border-blue-200', nameBg: 'bg-blue-500', nameText: 'text-white', accent: 'border-blue-200',
    levelShades: ['#3b82f6', '#7aa6f9', '#a9c4f4', '#d8e7fc'], // 淡蓝：档3=#d8e7fc
  },
  {
    rowBg: 'bg-amber-50', border: 'border-amber-200', nameBg: 'bg-amber-500', nameText: 'text-white', accent: 'border-amber-200',
    levelShades: ['#f59e0b', '#f8c766', '#fadb9b', '#fdf3d9'], // 淡桔：档3=#fdf3d9（比 amber-50 #fffbeb 略深，可辨）
  },
];

// 取某主题在指定层级（0=主项目，逐级变浅；超过档数后停留在最浅档）的色阶
export function getLevelShade(theme, level) {
  const shades = theme?.levelShades;
  if (!shades || shades.length === 0) return theme?.nameBg;
  const idx = Math.max(0, Math.min(level, shades.length - 1));
  return shades[idx];
}

// 取某主题的「最浅档」（用于任务行交替底色，与主项目色系同源但比白底色略深）
export function getLightestShade(theme) {
  return getLevelShade(theme, (theme?.levelShades || []).length - 1);
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