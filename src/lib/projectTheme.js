// 与时间线甘特图保持一致的 4 色项目主题（淡灰、淡绿、淡蓝、淡桔色循环）
// 用于 GanttView 行底色、TaskCard 进行中列背景色等所有"按项目编号着色"的地方
export const PROJECT_THEMES = [
  { rowBg: 'bg-slate-50', border: 'border-slate-200', nameBg: 'bg-slate-400', nameText: 'text-white', accent: 'border-slate-200' },     // 淡灰
  { rowBg: 'bg-emerald-50', border: 'border-emerald-200', nameBg: 'bg-emerald-500', nameText: 'text-white', accent: 'border-emerald-200' }, // 淡绿
  { rowBg: 'bg-blue-50', border: 'border-blue-200', nameBg: 'bg-blue-500', nameText: 'text-white', accent: 'border-blue-200' },          // 淡蓝
  { rowBg: 'bg-amber-50', border: 'border-amber-200', nameBg: 'bg-amber-500', nameText: 'text-white', accent: 'border-amber-200' },       // 淡桔
];

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