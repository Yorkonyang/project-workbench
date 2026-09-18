/**
 * 负责人/责任人选择置顶
 * 将经常被选中（在表单确认时）的成员 id 写入 localStorage，
 * 下次打开人员列表时这些成员排到最前并标记"常用"，方便快速点选。
 */
const KEY = 'pinned_member_ids';
const MAX = 30;

export function getPinnedIds() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// 置顶某个成员：已存在则移到最前，限制最多保留 MAX 个
export function pinMemberId(id) {
  if (!id) return;
  const sid = String(id);
  const list = getPinnedIds().filter((x) => x !== sid);
  list.unshift(sid);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* 忽略写入失败（如隐私模式） */
  }
}

export function pinMemberIds(ids = []) {
  ids.filter(Boolean).forEach((id) => pinMemberId(id));
}

// 生成按置顶排序的成员选项；valueKey 决定选项的 value 用 id 还是 name
export function buildMemberOptions(members, { valueKey = 'id', labelWithEmail = true } = {}) {
  const pinned = getPinnedIds();
  const opts = (members || []).map((m) => ({
    id: m.id,
    value: valueKey === 'name' ? m.name : m.id,
    label: labelWithEmail && m.email ? `${m.name} (${m.email})` : m.name,
  }));
  opts.sort((a, b) => {
    const ia = pinned.indexOf(String(a.id));
    const ib = pinned.indexOf(String(b.id));
    return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
  });
  return opts;
}

// 计算哪些选项的 value 属于已置顶成员（用于给下拉项加"常用"标记）
export function getPinnedValueSet(members, valueKey = 'id') {
  const pinned = getPinnedIds();
  return new Set(
    (members || [])
      .filter((m) => pinned.includes(String(m.id)))
      .map((m) => (valueKey === 'name' ? m.name : m.id))
  );
}
