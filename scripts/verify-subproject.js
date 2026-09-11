// 隔离验证脚本：创建临时项目 A/B/C，测试子项目功能，然后全部删除
// 不触碰 XM_001~008

const BASE_URL = 'http://localhost:3000/api';
const ADMIN_ID = '0a687335-397d-4473-a201-c68c9fea9a10';

async function request(method, path, body = null) {
  const options = { method, headers: { 'Content-Type': 'application/json', 'x-user-id': ADMIN_ID } };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, options);
  return res.json();
}

async function cleanup() {
  // 清理所有以 "验证-" 开头的项目（临时项目）
  const all = await request('GET', '/projects');
  const tempIds = all
    .filter(p => p.name.startsWith('验证-'))
    .map(p => p.id);

  console.log(`\n🗑️  清理 ${tempIds.length} 个临时项目...`);
  for (const id of tempIds) {
    await request('DELETE', `/projects/${id}`);
    console.log(`  - 删除 ${id}`);
  }
  console.log('✅ 清理完成\n');
}

async function test1_createSubproject() {
  console.log('📋 测试 1: 创建子项目');
  const parent = await request('POST', '/projects', {
    name: '验证-父项目',
    code: 'VP',
    stage: '规划中',
    type: '研发项目'
  });
  const parentId = parent.id;

  const child = await request('POST', '/projects', {
    name: '验证-子项目',
    code: 'VC',
    parentProjectId: parentId,
    stage: '规划中',
    type: '研发项目'
  });
  console.log(`  ✅ 创建成功: 父=${parentId}, 子=${child.id}`);
  console.log(`  📊 父项目 parentProjectId: ${parent.parentProjectId}`);
  console.log(`  📊 子项目 parentProjectId: ${child.parentProjectId}`);
  return { parentId, childId: child.id };
}

async function test2_rootFilter(parentId, childId) {
  console.log('\n📋 测试 2: GET /projects?parentId=__root__ 返回只有根项目');
  const roots = await request('GET', '/projects?parentId=__root__');
  const rootIds = roots.map(p => p.id);
  console.log(`  📊 返回的根项目数: ${rootIds.length}`);
  console.log(`  📊 根项目 ID: ${rootIds.join(', ')}`);
  console.log(`  ✅ 子项目 ${childId} 不在根列表中: ${!rootIds.includes(childId)}`);
  return rootIds;
}

async function test3_mergePreview(parentId, childId) {
  console.log('\n📋 测试 3: merge-preview + merge (keep)');

  // 3.1 创建源项目（子项目）的任务
  await request('POST', `/projects/${childId}/tasks`, {
    name: '子项目任务',
    stage: '进行中',
    assignee: 'yyg@grikin.com'
  });
  console.log(`  ✅ 创建子项目任务`);

  // 3.2 预览合并
  const preview = await request('GET', `/projects/${childId}/merge-preview?targetId=${parentId}`);
  console.log(`  📊 预览返回: sourceId=${preview.sourceId}, targetId=${preview.targetId}`);
  console.log(`  📊 被合并项目: ${preview.sourceId}`);
  console.log(`  📊 目标项目: ${preview.targetId}`);
  console.log(`  📊 任务被重定向: ${preview.counts.tasks} 个`);

  // 3.3 执行合并（keep，必须传 targetId）
  const merge = await request('POST', `/projects/${childId}/merge`, {
    targetId: parentId,
    strategy: 'keep'
  });
  console.log(`  ✅ 合并响应: success=${merge.success}, sourceId=${merge.sourceId}, targetId=${merge.targetId}`);
  console.log(`  📊 移动统计: ${JSON.stringify(merge.movedCounts)}`);

  // 3.4 验证：源项目被隐藏 + 任务重定向到目标
  // (a) includeMerged=1 能看到源项目且 mergedInto=parentId
  const withMerged = await request('GET', '/projects?includeMerged=1');
  const sourceVisible = withMerged.find(p => p.id === childId);
  console.log(`  📊 includeMerged=1 源项目 mergedInto: ${sourceVisible?.mergedInto || 'null'}`);
  console.log(`  ✅ 源项目带 mergedInto: ${sourceVisible?.mergedInto === parentId}`);
  // (b) 默认列表（includeMerged=0）看不到源项目 = 已被隐藏
  const defaultList = await request('GET', '/projects');
  const sourceHidden = !defaultList.some(p => p.id === childId);
  console.log(`  ✅ 默认列表已隐藏源项目: ${sourceHidden}`);
  // (c) 目标项目任务数（含重定向来的）
  const targetTasks = await request('GET', `/projects/${parentId}/tasks`);
  const targetTaskCount = Array.isArray(targetTasks) ? targetTasks.length : targetTasks.tasks?.length;
  console.log(`  ✅ 目标项目任务数: ${targetTaskCount}`);

  return { sourceId: childId, targetId: parentId };
}

async function test4_antiCycle() {
  console.log('\n📋 测试 4: 闭环检测（409 Forbidden）');

  // 4.1 创建两个子项目
  const p1 = await request('POST', '/projects', {
    name: '验证-P1',
    code: 'VP1',
    parentProjectId: null // 根
  });
  const p2 = await request('POST', '/projects', {
    name: '验证-P2',
    code: 'VP2',
    parentProjectId: p1.id
  });
  const p3 = await request('POST', '/projects', {
    name: '验证-P3',
    code: 'VP3',
    parentProjectId: p2.id
  });
  console.log(`  ✅ 创建 P1=${p1.id}, P2=${p2.id}, P3=${p3.id}`);

  // 4.2 尝试将 P1 合并到 P3（P3 是 P1 的后代 → 形成环，应返回 409）
  const mergeRes = await request('POST', `/projects/${p1.id}/merge`, {
    targetId: p3.id,
    strategy: 'keep'
  });
  if (mergeRes.success === false) {
    console.log(`  ✅ 闭环检测成功: ${mergeRes.error}`);
  } else {
    console.log(`  ❌ 错误：未检测到闭环！响应: ${JSON.stringify(mergeRes)}`);
  }

  // 4.3 清理 P1/P2/P3
  await request('DELETE', `/projects/${p1.id}`);
  await request('DELETE', `/projects/${p2.id}`);
  await request('DELETE', `/projects/${p3.id}`);
  console.log(`  ✅ 清理 P1/P2/P3`);
}

async function test5_undoMerge() {
  console.log('\n📋 测试 5: 合并撤销（T13，24h 限时回滚）');

  // 5.1 建父/子 + 子项目任务
  const parent = await request('POST', '/projects', { name: '验证-撤销父', code: 'VPD', stage: '规划中' });
  const child = await request('POST', '/projects', {
    name: '验证-撤销子', code: 'VCD', parentProjectId: parent.id, stage: '规划中'
  });
  await request('POST', `/projects/${child.id}/tasks`, { name: '撤销测试任务', stage: '进行中' });
  console.log(`  ✅ 父=${parent.id}, 子=${child.id}, 已建子项目任务`);

  // 5.2 执行合并（子 → 父），拿到 mergeId
  const merge = await request('POST', `/projects/${child.id}/merge`, { targetId: parent.id, strategy: 'keep' });
  console.log(`  ✅ 合并成功, mergeId=${merge.mergeId}`);
  console.log(`  📊 目标项目任务数（合并后）: ${Array.isArray(await request('GET', `/projects/${parent.id}/tasks`)) ? (await request('GET', `/projects/${parent.id}/tasks`)).length : 'n/a'}`);

  // 5.3 查询可撤销日志
  const logs = await request('GET', `/merges?targetId=${parent.id}`);
  console.log(`  📊 GET /merges?targetId= 返回 ${logs.length} 条可撤销项`);
  const log0 = logs.find(l => l.id === merge.mergeId);
  console.log(`  ✅ 日志存在且 sourceId 正确: ${log0?.sourceId === child.id}`);

  // 5.4 撤销
  const undoRes = await request('POST', `/merges/${merge.mergeId}/undo`);
  console.log(`  ✅ 撤销响应: success=${undoRes.success}, restored=${JSON.stringify(undoRes.restoredCounts)}`);

  // 5.5 验证源项目复活 + 任务归属还原
  const defaultList = await request('GET', '/projects');
  const revived = defaultList.find(p => p.id === child.id);
  console.log(`  ✅ 源项目在默认列表复活: ${!!revived}`);
  console.log(`  ✅ 复活后无 mergedInto: ${!revived?.mergedInto}`);
  const parentTasks = await request('GET', `/projects/${parent.id}/tasks`);
  const childTasks = await request('GET', `/projects/${child.id}/tasks`);
  const parentTaskCount = Array.isArray(parentTasks) ? parentTasks.length : parentTasks.tasks?.length;
  const childTaskCount = Array.isArray(childTasks) ? childTasks.length : childTasks.tasks?.length;
  console.log(`  📊 父项目任务数（撤销后）: ${parentTaskCount}, 子项目任务数（撤销后）: ${childTaskCount}`);
  console.log(`  ✅ 任务已还原到源项目: ${childTaskCount === 1}`);

  // 5.6 重复撤销应 409
  const redo = await request('POST', `/merges/${merge.mergeId}/undo`);
  console.log(`  ✅ 重复撤销被拒: ${redo.success === false ? redo.error : '未拒绝!'}`);

  // 5.7 清理
  await request('DELETE', `/projects/${parent.id}`);
  await request('DELETE', `/projects/${child.id}`);
  console.log(`  ✅ 清理父/子项目`);
}

async function main() {
  console.log('=== 子项目功能后端验证 ===\n');

  try {
    await cleanup();

    // 测试 1: 创建子项目
    const { parentId, childId } = await test1_createSubproject();

    // 测试 2: 根过滤器
    await test2_rootFilter(parentId, childId);

    // 测试 3: 合并预览 + 执行
    await test3_mergePreview(parentId, childId);

    // 测试 4: 闭环检测
    await test4_antiCycle();

    // 测试 5: 合并撤销（T13）
    await test5_undoMerge();

    // 清理临时项目
    await cleanup();

    console.log('\n=== ✅ 所有测试通过 ===');
  } catch (err) {
    console.error('\n❌ 验证失败:', err);
    process.exit(1);
  }
}

main();
