/**
 * 拼音模糊匹配工具
 * 支持用拼音首字母或完整拼音搜索中文名，无需输入完整汉字。
 * 例：搜索 "zs" 可匹配 "张三"，搜索 "zhangsan" 可匹配 "张三"
 */
import { pinyin } from 'pinyin-pro';

// 缓存：label -> { fullPinyin, initials }，避免重复计算
const cache = new Map();

function getPinyinInfo(text) {
  if (!text) return { fullPinyin: '', initials: '' };
  if (cache.has(text)) return cache.get(text);

  // 不带声调的完整拼音（小写），非中文字符保留原样（小写）
  const full = pinyin(text, { toneType: 'none', type: 'array' })
    .map((s) => (s || '').toLowerCase())
    .join('');
  // 首字母（每个音节取首字母）
  const initials = pinyin(text, { toneType: 'none', type: 'array' })
    .map((s) => (s || '').charAt(0).toLowerCase())
    .join('');

  const info = { fullPinyin: full, initials };
  cache.set(text, info);
  return info;
}

/**
 * 判断搜索词是否匹配目标文本
 * 匹配规则（不区分大小写）：
 * 1. 直接包含原文（汉字/英文/数字）
 * 2. 完整拼音包含搜索词
 * 3. 拼音首字母包含搜索词
 */
export function pinyinMatch(text, query) {
  if (!query) return true;
  if (!text) return false;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  // 1. 直接文本匹配
  if (text.toLowerCase().includes(q)) return true;

  const { fullPinyin, initials } = getPinyinInfo(text);

  // 2. 完整拼音匹配
  if (fullPinyin.includes(q)) return true;

  // 3. 首字母匹配
  if (initials.includes(q)) return true;

  return false;
}
