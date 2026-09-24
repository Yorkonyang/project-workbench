/**
 * T02 dev 回归工具：成员 codePrefix 双端一致性校验
 *
 * 职责（防双端漂移）：
 *  - 读 data/workbench.db 的 members/departments；
 *  - 深拷贝 members 后分别调 CJS 版（server/projectCodePrefix.js）与
 *    ESM 版（src/lib/projectCodePrefix.js）的 assignMissingPrefixes；
 *  - 逐字段比对两端分配结果必须相等（mismatch 必须为 0）；
 *  - 打印前缀分布 top20、ZY/LY 组连续性抽查、无部门成员数；
 *  - 不写库、不改生产数据（全程深拷贝内存对象）。
 *
 * 用法：node server/scripts/verify-prefixes.js
 * 退出码：mismatch>0 或 ZY/LY 组不连续 → 1；否则 0。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DB_FILE =
  process.env.WB_DB_PATH || path.join(REPO_ROOT, 'data', 'workbench.db');
const ESM_PREFIX_MODULE = path.join(
  REPO_ROOT,
  'src',
  'lib',
  'projectCodePrefix.js'
);

/** 深拷贝（库为纯 JSON 数据，structuredClone 可用） */
function deepClone(x) {
  return structuredClone(x);
}

/** 前缀 -> 数字后缀（无数字尾记 0）与 base */
function digitOf(prefix) {
  const m = String(prefix).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function baseOf(prefix) {
  return String(prefix).replace(/\d+$/, '');
}

/** 检查某 base（如 'ZY'）的成员前缀序列是否连续：base, base1 … baseN 无空洞 */
function checkContinuity(prefixes, base, label) {
  const digits = prefixes
    .filter((p) => baseOf(p) === base)
    .map(digitOf)
    .sort((a, b) => a - b);
  const problems = [];
  if (digits.length === 0) {
    problems.push(`${label} 组不存在`);
  } else {
    for (let i = 0; i < digits.length; i += 1) {
      if (digits[i] !== i) {
        problems.push(
          `${label} 组序列在 第 ${i} 位断裂：期望数字 ${i}，实际 ${digits[i]}`
        );
        break; // 只需报第一处
      }
    }
  }
  return { digits, problems };
}

async function main() {
  // ---- 1. 读库（只读） ----
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const members0 = Array.isArray(raw.members) ? raw.members : [];
  const departments0 = Array.isArray(raw.departments) ? raw.departments : [];
  console.log(
    `[verify-prefixes] ${DB_FILE}：members=${members0.length} departments=${departments0.length}`
  );

  // ---- 2. CJS 端（深拷贝后跑，不污染库） ----
  const cjs = require('../projectCodePrefix');
  const cjsMembers = deepClone(members0);
  const cjsResult = cjs.assignMissingPrefixes(
    cjsMembers,
    departments0,
    (m) => cjs.memberInitials(m.name, m.email)
  );

  // ---- 3. ESM 端（动态 import，另一份深拷贝） ----
  const esmMod = await import(
    'file://' + ESM_PREFIX_MODULE.replace(/\\/g, '/')
  );
  const esmMembers = deepClone(members0);
  const esmResult = esmMod.assignMissingPrefixes(
    esmMembers,
    departments0,
    (m) => esmMod.memberInitials(m.name, m.email)
  );

  // ---- 4. 逐字段比对两端 codePrefix ----
  let mismatch = 0;
  const byId = new Map(esmMembers.map((m) => [String(m.id), m]));
  for (const cm of cjsMembers) {
    const em = byId.get(String(cm.id));
    const a = cm.codePrefix ?? '';
    const b = em ? em.codePrefix ?? '' : '(missing)';
    if (a !== b) {
      mismatch += 1;
      if (mismatch <= 10) {
        console.log(
          `  [MISMATCH] member=${cm.id} name=${cm.name} cjs=${JSON.stringify(a)} esm=${JSON.stringify(b)}`
        );
      }
    }
  }
  console.log(`[verify-prefixes] 双端分配：cjs.assigned=${cjsResult.assigned} esm.assigned=${esmResult.assigned} mismatch=${mismatch}`);

  // ---- 5. 前缀分布 top 20（基于 CJS 端结果） ----
  const dist = new Map();
  cjsMembers.forEach((m) => {
    const p = m.codePrefix ?? '';
    dist.set(p, (dist.get(p) || 0) + 1);
  });
  const top = [...dist.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 20);
  console.log('[verify-prefixes] 前缀分布 top20：');
  top.forEach(([p, n]) => console.log(`  ${p || '(空)'} × ${n}`));

  // ---- 6. ZY / LY 组连续性抽查 ----
  const zy = checkContinuity(
    cjsMembers.map((m) => m.codePrefix ?? ''),
    'ZY',
    'ZY'
  );
  console.log(
    `[verify-prefixes] ZY 组连续=${zy.problems.length === 0}（序列 ${zy.digits
      .map((d) => (d === 0 ? 'ZY' : `ZY${d}`))
      .join(',')}）`
  );
  if (zy.problems.length) zy.problems.forEach((p) => console.log('  [PROBLEM] ' + p));

  const ly = checkContinuity(
    cjsMembers.map((m) => m.codePrefix ?? ''),
    'LY',
    'LY'
  );
  console.log(
    `[verify-prefixes] LY 组连续=${ly.problems.length === 0}（序列 ${ly.digits
      .map((d) => (d === 0 ? 'LY' : `LY${d}`))
      .join(',')}）`
  );
  if (ly.problems.length) ly.problems.forEach((p) => console.log('  [PROBLEM] ' + p));

  // ---- 7. 无部门成员数（用 CJS deptKeyOf 判定，归入尾组） ----
  const deptIdSet = new Set(departments0.map((d) => String(d.id)));
  const nameToId = {};
  departments0.forEach((d) => {
    if (d.name) nameToId[d.name] = String(d.id);
  });
  const noDept = cjsMembers.filter(
    (m) => cjs.deptKeyOf(m, deptIdSet, nameToId) === null
  ).length;
  console.log(`[verify-prefixes] 无部门成员数=${noDept}（排尾组）`);

  // ---- 8. 退出码 ----
  const bad = mismatch > 0 || zy.problems.length > 0 || ly.problems.length > 0;
  console.log(
    bad
      ? '[verify-prefixes] FAIL（双端漂移或 ZY/LY 序列不连续）'
      : '[verify-prefixes] PASS'
  );
  process.exit(bad ? 1 : 0);
}

main().catch((err) => {
  console.error('[verify-prefixes] 运行异常：', err);
  process.exit(1);
});
