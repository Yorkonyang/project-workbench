const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = 'D:/AI/project-workbench';
const SHOT_DIR = path.join(ROOT, '.workbuddy/tmp/qa-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const LOGIN_EMAIL = process.env.WB_LOGIN_EMAIL || 'yyg@grikin.com';
const LOGIN_PASSWORD = process.env.WB_LOGIN_PASSWORD || '202489';

// 在前端 :5173 直接登录（cookie 跨端口/域不匹配，故走前端登录流程拿 session）
async function loginOnFrontend(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 30000 });
  // 已被登录则直接返回
  if (await page.evaluate(() => !window.location.pathname.endsWith('/login')) ) return;
  await page.locator('input[type="email"], input[type="text"]').first().fill(LOGIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(LOGIN_PASSWORD);
  await page.locator('button', { hasText: '登录' }).first().click();
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 20000, waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(500);
}

const PROJECT_ID = '8b09b0e8-10bb-4ee4-ac16-6a5097b4a3f1'; // XM_002

async function main() {
  const results = { mobile: [], desktop: [] };
  const browser = await chromium.launch({ headless: true });

  // ---------- MOBILE 375 x 667 ----------
  const mctx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  const mpage = await mctx.newPage();

  // 登录（前端 :5173）
  await loginOnFrontend(mpage);

  // M1: /timeline 默认（不锁定）
  await mpage.goto('http://localhost:5173/timeline', { waitUntil: 'networkidle', timeout: 30000 });
  await mpage.waitForTimeout(1500);
  await mpage.screenshot({ path: path.join(SHOT_DIR, 'm1-timeline-mobile.png'), fullPage: true });

  const m1 = await mpage.evaluate(() => {
    // 甘特容器（GanttView overflow-x-auto）
    const g = document.querySelector('.overflow-x-auto');
    // 筛选区
    const chipArea = document.querySelector('.md\\:hidden');
    const desktopRow = [...document.querySelectorAll('.hidden.md\\:flex')][0];
    return {
      ganttFound: !!g,
      ganttClientWidth: g ? g.clientWidth : null,
      ganttScrollWidth: g ? g.scrollWidth : null,
      hasChipArea: !!chipArea,
      chipAreaHidden: chipArea ? getComputedStyle(chipArea).display === 'none' : null,
      desktopRowExists: !!desktopRow,
      desktopRowHidden: desktopRow ? getComputedStyle(desktopRow).display === 'none' : null,
      viewW: window.innerWidth,
    };
  });
  results.mobile.push({ id: 'M1', name: '/timeline 默认（移动）', data: m1,
    check: m1.ganttFound && m1.hasChipArea && m1.desktopRowHidden === true });
  // 甘特可见宽度 = clientWidth（= 375 - LABEL_W）
  console.log('M1 ganttClientWidth =', m1.ganttClientWidth, 'scrollWidth =', m1.ganttScrollWidth);

  // M2: /timeline?projectId=<id>（锁定）
  await mpage.goto(`http://localhost:5173/timeline?projectId=${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await mpage.waitForTimeout(1500);
  await mpage.screenshot({ path: path.join(SHOT_DIR, 'm2-timeline-locked-mobile.png'), fullPage: true });

  const m2 = await mpage.evaluate(() => {
    const lockBar = [...document.querySelectorAll('span')].find(el => el.textContent && el.textContent.trim().startsWith('已锁定：'));
    const unlockBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '解锁');
    // 项目 chip（排除「新建里程碑」「含子项目」等其它 rounded-full+shrink-0 按钮）
    const chipButtons = [...document.querySelectorAll('button')].filter(b =>
      b.className.includes('rounded-full') && b.className.includes('shrink-0') &&
      !/新建里程碑|含子项目/.test(b.textContent.trim()));
    const disabledChips = chipButtons.filter(b => b.className.includes('pointer-events-none'));
    const enabledTexts = chipButtons.filter(b => !b.className.includes('pointer-events-none')).map(b => b.textContent.trim());
    return {
      hasLockBar: !!lockBar,
      lockBarText: lockBar ? lockBar.textContent.trim() : null,
      hasUnlockBtn: !!unlockBtn,
      totalChips: chipButtons.length,
      disabledChips: disabledChips.length,
      enabledTexts,
    };
  });
  // 锁定态：仅锁定项目 chip 可点（enabledTexts 仅含锁定项目），其余 chip（含「全部项目」）全部 pointer-events-none
  results.mobile.push({ id: 'M2', name: '/timeline?projectId 锁定（移动）', data: m2,
    check: m2.hasLockBar && m2.hasUnlockBtn && m2.enabledTexts.length === 1 && m2.enabledTexts[0].includes('XM_002')
      && m2.disabledChips === m2.totalChips - 1 });

  // M3: 点解锁 → 应即时清除锁定态（C-R2 修复点）
  const unlockBtn2 = mpage.locator('button', { hasText: '解锁' }).first();
  if (await unlockBtn2.count() > 0) {
    await unlockBtn2.click();
    await mpage.waitForTimeout(800);
  }
  const m3 = await mpage.evaluate(() => {
    const lockBar = [...document.querySelectorAll('span')].find(el => el.textContent && el.textContent.trim().startsWith('已锁定：'));
    const chipButtons = [...document.querySelectorAll('button')].filter(b => b.className.includes('rounded-full') && b.className.includes('shrink-0'));
    const disabledChips = chipButtons.filter(b => b.className.includes('pointer-events-none'));
    return {
      lockBarGone: !lockBar,
      urlHasProjectId: window.location.search.includes('projectId='),
      totalChips: chipButtons.length,
      disabledChips: disabledChips.length,
      // 切 chip 是否可行
      anyChipClickable: chipButtons.some(b => !b.className.includes('pointer-events-none')),
    };
  });
  await mpage.screenshot({ path: path.join(SHOT_DIR, 'm3-after-unlock-mobile.png'), fullPage: true });
  results.mobile.push({ id: 'M3', name: '解锁后（移动）', data: m3,
    check: m3.lockBarGone && !m3.urlHasProjectId && m3.anyChipClickable });

  // M4: 任务看板 /tasks（或 /projects 或 /kanban）
  await mpage.goto('http://localhost:5173/tasks', { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await mpage.waitForTimeout(1000);
  const m4 = await mpage.evaluate(() => {
    // 任务看板列 w-60（移动端）
    const kanbanCol = [...document.querySelectorAll('div')].find(d => d.className.includes('w-60') && d.className.includes('shrink-0'));
    const selectWFull = [...document.querySelectorAll('select')].find(s => s.className.includes('w-full'));
    const pageW = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    return { kanbanColFound: !!kanbanCol, kanbanColW: kanbanCol?getComputedStyle(kanbanCol).width:null,
             pageW, scrollW, overflow: scrollW > pageW + 2 };
  });
  results.mobile.push({ id: 'M4', name: '/tasks（移动）', data: m4,
    check: m4.kanbanColFound && m4.kanbanColW === '240px' });

  await mctx.close();

  // ---------- DESKTOP 1024 x 768 ----------
  const dctx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    locale: 'zh-CN',
  });
  const dpage = await dctx.newPage();

  // 登录（前端 :5173）
  await loginOnFrontend(dpage);

  // D1: /timeline 默认（桌面零回归）
  await dpage.goto('http://localhost:5173/timeline', { waitUntil: 'networkidle', timeout: 30000 });
  await dpage.waitForTimeout(1500);
  await dpage.screenshot({ path: path.join(SHOT_DIR, 'd1-timeline-desktop.png'), fullPage: true });

  const d1 = await dpage.evaluate(() => {
    const g = document.querySelector('.overflow-x-auto');
    const chipArea = document.querySelector('.md\\:hidden');
    const desktopRow = [...document.querySelectorAll('.hidden.md\\:flex')][0];
    // 图例
    const legendText = document.body.innerText.includes('图例');
    // 折叠按钮 md:hidden 在桌面应 display:none
    const foldBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('图例 ') && b.className.includes('md:hidden'));
    return {
      ganttFound: !!g,
      ganttClientWidth: g ? g.clientWidth : null,
      ganttScrollWidth: g ? g.scrollWidth : null,
      chipAreaExists: !!chipArea,
      chipAreaDisplay: chipArea ? getComputedStyle(chipArea).display : null,
      desktopRowExists: !!desktopRow,
      desktopRowDisplay: desktopRow ? getComputedStyle(desktopRow).display : null,
      legendVisible: legendText,
      foldBtnDisplay: foldBtn ? getComputedStyle(foldBtn).display : null,
      viewW: window.innerWidth,
    };
  });
  results.desktop.push({ id: 'D1', name: '/timeline 默认（桌面1024）', data: d1,
    check: d1.ganttFound && d1.chipAreaDisplay === 'none' && d1.desktopRowDisplay === 'flex' && d1.foldBtnDisplay === 'none' });
  // 桌面 LABEL_W 公式 min(480, max(192, 32+maxLen*11))，dayWidth=45
  console.log('D1 ganttClientWidth =', d1.ganttClientWidth, 'scrollWidth =', d1.ganttScrollWidth);

  // D2: /timeline?projectId 锁定（桌面，零回归：chip 区不显，桌面行 disabled）
  await dpage.goto(`http://localhost:5173/timeline?projectId=${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
  await dpage.waitForTimeout(1500);
  await dpage.screenshot({ path: path.join(SHOT_DIR, 'd2-timeline-locked-desktop.png'), fullPage: true });

  const d2 = await dpage.evaluate(() => {
    const chipArea = document.querySelector('.md\\:hidden');
    const lockBar = [...document.querySelectorAll('span')].find(el => el.textContent && el.textContent.trim().startsWith('已锁定：'));
    // 桌面行的 Select 应 disabled
    const desktopRow = [...document.querySelectorAll('.hidden.md\\:flex')][0];
    const select = desktopRow ? desktopRow.querySelector('select, [role="listbox"], button[class*="cursor-pointer"]') : null;
    return {
      chipAreaDisplay: chipArea ? getComputedStyle(chipArea).display : null,
      lockBarVisible: !!lockBar, // 桌面应不显（因 lockBar 在 md:hidden 块里）
      desktopRowDisplay: desktopRow ? getComputedStyle(desktopRow).display : null,
    };
  });
  results.desktop.push({ id: 'D2', name: '/timeline?projectId 锁定（桌面1024）', data: d2,
    check: d2.chipAreaDisplay === 'none' && !d2.lockBarVisible && d2.desktopRowDisplay === 'flex' });

  // D3: 任务看板列宽 w-72（288px）
  await dpage.goto('http://localhost:5173/tasks', { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await dpage.waitForTimeout(1000);
  const d3 = await dpage.evaluate(() => {
    const kanbanCol = [...document.querySelectorAll('div')].find(d => d.className.includes('w-72') && d.className.includes('shrink-0'));
    return { kanbanColFound: !!kanbanCol, kanbanColW: kanbanCol?getComputedStyle(kanbanCol).width:null };
  });
  results.desktop.push({ id: 'D3', name: '/tasks（桌面1024）', data: d3,
    check: d3.kanbanColFound && d3.kanbanColW === '288px' });

  // D4: 成员页统计卡 4 列（lg:grid-cols-4，桌面 1024）
  await dpage.goto('http://localhost:5173/members', { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await dpage.waitForTimeout(1000);
  const d4 = await dpage.evaluate(() => {
    const grid = [...document.querySelectorAll('div')].find(d => d.className.includes('grid-cols-4'));
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    return { found: !!grid, cols };
  });
  results.desktop.push({ id: 'D4', name: '/members（桌面1024）', data: d4,
    check: d4.found && d4.cols === 4 });

  await dctx.close();
  await browser.close();

  // ---------- 汇总 ----------
  const passed = { mobile: results.mobile.filter(r => r.check).length,
                   desktop: results.desktop.filter(r => r.check).length };
  const total = { mobile: results.mobile.length, desktop: results.desktop.length };
  console.log('\n========= MOBILE =========');
  results.mobile.forEach(r => console.log(`${r.check?'✅':'❌'} ${r.id} ${r.name}`, JSON.stringify(r.data)));
  console.log(`mobile: ${passed.mobile}/${total.mobile} 通过`);
  console.log('\n========= DESKTOP =========');
  results.desktop.forEach(r => console.log(`${r.check?'✅':'❌'} ${r.id} ${r.name}`, JSON.stringify(r.data)));
  console.log(`desktop: ${passed.desktop}/${total.desktop} 通过`);
  const allPass = passed.mobile === total.mobile && passed.desktop === total.desktop;
  console.log('\n[verify] ' + (allPass ? 'PASS' : 'FAIL'));
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
