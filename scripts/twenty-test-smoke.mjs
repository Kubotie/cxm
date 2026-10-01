#!/usr/bin/env node
// ─── Twenty test* の往復スモーク ────────────────────────────────────────────
//
//   node scripts/twenty-test-smoke.mjs
//
// 作成 → 取得 → 更新 → 冪等確認 → 削除 まで通す。作ったものは必ず消す。
// **既存の Company / Opportunity / Person / Note / Task には触れない。**
// 顧客データは一切入れない（会社名は 'SMOKE TEST' 固定）。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const ROOT = process.cwd();
const C = await import(`file://${ROOT}/src/lib/ptai/twenty-test/client.ts`);
const S = await import(`file://${ROOT}/src/lib/ptai/twenty-test/schema.ts`);

let pass = 0, fail = 0;
const check = async (name, fn) => {
  try { const d = await fn(); pass++; console.log(`  OK  ${name}${d ? ' — ' + d : ''}`); }
  catch (e) { fail++; console.log(`  NG  ${name}\n        ${e.message}`); }
};

const MARK = `SMOKE ${Date.now().toString(36)}`;
const OPP = S.TEST_OBJECTS.opportunity;
const LOG = S.TEST_OBJECTS.operationLog;
const created = [];

console.log(`\nTwenty test* 往復スモーク（${MARK}）\n`);

await check('既存オブジェクトへの書き込みが型で塞がれている', async () => {
  const blocked = [];
  for (const p of ['companies', 'opportunities', 'people', 'notes', 'tasks']) {
    try { await C.createRecord(p, 'company', { name: 'x' }); blocked.push(`${p} が通った`); }
    catch (e) { if (e.kind !== 'forbidden_object') blocked.push(`${p} が別の理由で失敗: ${e.kind}`); }
  }
  if (blocked.length) throw new Error(blocked.join(' / '));
  return '5 つとも forbidden_object で拒否';
});

let oppId = null;
await check('testOpportunity を作成できる', async () => {
  const r = await C.createRecord(OPP.plural, OPP.singular, {
    name: MARK, companyName: MARK, notionCompanyId: 'smoke-' + MARK,
    stage: 'EVALUATING', addMrr: 300000, applyDate: '2026-12-01',
    msBase: 'apply', isMain: true, need: 'スモークテスト',
  });
  oppId = r.id; created.push([OPP.plural, r.id]);
  if (!oppId) throw new Error('id が返らない');
  if (r.stage !== 'EVALUATING') throw new Error(`stage=${r.stage}`);
  if (r.msBase !== 'apply') throw new Error(`msBase が小文字に戻らない: ${r.msBase}`);
  return 'msBase は APPLY で保存され apply で返る';
});

await check('取得すると同じ値が返る', async () => {
  const r = await C.getRecord(OPP.plural, OPP.singular, oppId);
  if (!r) throw new Error('取得できない');
  if (r.addMrr !== 300000) throw new Error(`addMrr=${r.addMrr}`);
  if (r.applyDate?.slice(0, 10) !== '2026-12-01') throw new Error(`applyDate=${r.applyDate}`);
  if (r.isMain !== true) throw new Error(`isMain=${r.isMain}`);
  return 'addMrr / applyDate / isMain 一致';
});

await check('部分更新ができる（送った項目だけ変わる）', async () => {
  const r = await C.updateRecord(OPP.plural, OPP.singular, oppId, { stage: 'PROBABLE', barrier: '稟議が長い' });
  if (r.stage !== 'PROBABLE') throw new Error(`stage=${r.stage}`);
  if (r.addMrr !== 300000) throw new Error('送っていない addMrr が変わった');
  return 'stage だけ変わり addMrr は保持';
});

await check('旧フェーズキーが Salesforce のキーに正規化される', async () => {
  // 2026-10-01 にフェーズを Salesforce に合わせた。旧キーは読み込み時だけ読み替える
  if (S.normalizeStage('NOT_STARTED')   !== 'INACTIVE')   throw new Error('NOT_STARTED');
  if (S.normalizeStage('FIRST_MEETING') !== 'ACTIVE')     throw new Error('FIRST_MEETING');
  if (S.normalizeStage('TRIAL')         !== 'EVALUATING') throw new Error('TRIAL');
  if (S.normalizeStage('QUOTE')         !== 'PROBABLE')   throw new Error('QUOTE');
  if (S.normalizeStage('VERBAL_COMMIT') !== 'VERBAL')     throw new Error('VERBAL_COMMIT');
  if (S.normalizeStage('APPLICATION')   !== 'WON')        throw new Error('APPLICATION');
  if (S.normalizeStage('POC')           !== 'EVALUATING') throw new Error('POC は使わない');
  if (S.normalizeStage('SCREENING')     !== null)         throw new Error('未知の値を通した');
  return '旧 8 段階 → Salesforce のキー、POC は Evaluating へ';
});

await check('契約締結済みへの出入りだけ承認が要る', async () => {
  if (!S.needsApproval('PROBABLE', 'CLOSED_WON')) throw new Error('入りが承認不要になっている');
  if (!S.needsApproval('CLOSED_WON', 'PROBABLE')) throw new Error('外しが承認不要になっている');
  if (S.needsApproval('EVALUATING', 'PROBABLE')) throw new Error('通常の前進に承認を要求している');
  return '入り・外しのみ true';
});

await check('承認待ちを pendingEdit に積める（値は変えない）', async () => {
  const r = await C.updateRecord(OPP.plural, OPP.singular, oppId, {
    pendingEdit: { stage: 'CLOSED_WON', addMrr: 500000, requestedAt: new Date().toISOString(), requestedBy: 'smoke' },
  });
  if (r.stage !== 'PROBABLE') throw new Error('本体の stage が変わってしまった');
  const pe = typeof r.pendingEdit === 'string' ? JSON.parse(r.pendingEdit) : r.pendingEdit;
  if (pe?.stage !== 'CLOSED_WON') throw new Error('pendingEdit が読めない');
  return 'RAW_JSON に積めて本体は不変';
});

await check('createIfAbsent が重複を作らない（Twenty に upsert は無い）', async () => {
  const filter = `notionCompanyId[eq]:smoke-${MARK}`;
  const a = await C.createIfAbsent(OPP.plural, OPP.singular, filter, { name: MARK + ' dup', notionCompanyId: 'smoke-' + MARK });
  if (a.created) { created.push([OPP.plural, a.record.id]); throw new Error('既存を見つけられず新規作成した'); }
  if (a.record.id !== oppId) throw new Error('別のレコードを拾った');
  return '既存を再利用';
});

await check('testOperationLog に予約語の読み替えで書ける', async () => {
  const r = await C.createRecord(LOG.plural, LOG.singular, {
    name: MARK, at: new Date().toISOString(), actor: 'smoke', action: 'update',
    object: 'testOpportunity', recordId: oppId, field: 'stage', from: 'EVALUATING', to: 'PROBABLE',
    source: 'ui', message: 'スモーク',
  });
  created.push([LOG.plural, r.id]);
  if (r.object !== 'testOpportunity') throw new Error(`object が戻らない: ${JSON.stringify(r.object)}`);
  if (r.field !== 'stage') throw new Error(`field が戻らない: ${JSON.stringify(r.field)}`);
  if (r.from !== 'EVALUATING' || r.to !== 'PROBABLE') throw new Error('from/to が戻らない');
  if (r.action !== 'update') throw new Error(`action=${r.action}`);
  return 'object→objectName / field→fieldName を往復';
});

// ── 楽観ロック（§9-3: Twenty を人がイレギュラーに直した場合）────────────────
await check('Twenty 側が新しければ上書きしない（楽観ロック）', async () => {
  const cur = await C.getRecord(OPP.plural, OPP.singular, oppId);
  // 人が Twenty で直した、という状況を作る
  await C.updateRecord(OPP.plural, OPP.singular, oppId, { barrier: '人が直した値' });
  // ツールは古い updatedAt を持ったまま書こうとする
  const r = await C.updateRecordSafely(OPP.plural, OPP.singular, oppId,
    { barrier: 'ツールが書こうとした値' }, cur.updatedAt);
  if (r.ok) throw new Error('上書きしてしまった');
  if (r.reason !== 'conflict') throw new Error(`reason=${r.reason}`);
  if (r.theirs.barrier !== '人が直した値') throw new Error('相手の値を返していない');
  const after = await C.getRecord(OPP.plural, OPP.singular, oppId);
  if (after.barrier !== '人が直した値') throw new Error('値が書き換わっている');
  return '書かずに相手の値を返す';
});

await check('最新の updatedAt を渡せば通る', async () => {
  const cur = await C.getRecord(OPP.plural, OPP.singular, oppId);
  const r = await C.updateRecordSafely(OPP.plural, OPP.singular, oppId,
    { barrier: '合意のうえ更新' }, cur.updatedAt);
  if (!r.ok) throw new Error(`conflict になった: ${r.reason}`);
  if (r.record.barrier !== '合意のうえ更新') throw new Error('更新されていない');
  return '更新できる';
});

// ── 組織図: AI 案を「保存」で 1 行ずつ testPerson へ（E-04〜E-06）──────────
const PERSON = S.TEST_OBJECTS.person;
const NCID = 'smoke-org-' + MARK;
let rootId = null;

await check('組織図の人物を 1 行ずつ保存できる', async () => {
  const draft = [
    { name: '部長A', title: '事業部長', nodeType: 'person', isDecisionMaker: true,  influential: true,  attitude: 'PROMOTE',  contact: 'CONTACTED',     infoSource: 'INTERNAL', order: 0 },
    { name: '課長B', title: '課長',     nodeType: 'person', isDecisionMaker: false, influential: true,  attitude: 'NEUTRAL',  contact: 'NOT_CONTACTED', infoSource: 'PUBLIC',   order: 1 },
    { name: '販促部', title: '',        nodeType: 'dept',   isDecisionMaker: false, influential: false, attitude: 'UNKNOWN',  contact: 'NOT_CONTACTED', infoSource: 'ESTIMATED', order: 2 },
  ];
  for (const d of draft) {
    const r = await C.createRecord(PERSON.plural, PERSON.singular, {
      ...d, notionCompanyId: NCID, parentId: rootId, source: 'ai',
    });
    created.push([PERSON.plural, r.id]);
    if (rootId === null) rootId = r.id;          // 2 人目以降は部長Aの下にぶら下げる
  }
  const rows = await C.listRecords(PERSON.plural, PERSON.singular, {
    filter: `notionCompanyId[eq]:${NCID}`, pageSize: 20,
  });
  if (rows.length !== 3) throw new Error(`${rows.length} 件しか保存できていない`);
  return '3 行（人 2・部署 1）';
});

await check('親子関係・決裁者・態度・並び順が戻る', async () => {
  const rows = await C.listRecords(PERSON.plural, PERSON.singular, {
    filter: `notionCompanyId[eq]:${NCID}`, pageSize: 20,
  });
  const byName = new Map(rows.map(r => [r.name, r]));
  const boss = byName.get('部長A'), sub = byName.get('課長B'), dept = byName.get('販促部');
  if (boss.isDecisionMaker !== true) throw new Error('決裁者が戻らない');
  if (boss.attitude !== 'PROMOTE')   throw new Error(`態度=${boss.attitude}`);
  if (sub.parentId !== boss.id)      throw new Error('親子関係が戻らない');
  if (dept.nodeType !== 'dept')      throw new Error(`nodeType が小文字で戻らない: ${dept.nodeType}`);
  if (sub.order !== 1)               throw new Error(`並び順=${sub.order}`);
  if (sub.source !== 'ai')           throw new Error(`入力元=${sub.source}`);
  return 'parentId / isDecisionMaker / attitude / order / source すべて一致';
});

await check('人物を個別に更新できる（★の切り替えなど）', async () => {
  const rows = await C.listRecords(PERSON.plural, PERSON.singular, { filter: `notionCompanyId[eq]:${NCID}`, pageSize: 20 });
  const sub = rows.find(r => r.name === '課長B');
  const r = await C.updateRecord(PERSON.plural, PERSON.singular, sub.id, { influential: false, contact: 'CONTACTED' });
  if (r.influential !== false) throw new Error('影響力が切り替わらない');
  if (r.contact !== 'CONTACTED') throw new Error('接点が変わらない');
  if (r.name !== '課長B') throw new Error('送っていない name が変わった');
  return '送った項目だけ変わる';
});

// ── 後始末 ──────────────────────────────────────────────────────────────────
console.log('\n  後始末');
for (const [plural, id] of created) {
  if (!id) continue;
  try { await C.deleteRecord(plural, id); console.log(`    削除 ${plural}`); }
  catch (e) { console.log(`    削除できず ${plural} — ${e.message}`); fail++; }
}

await check('削除後は取得できない', async () => {
  const r = await C.listRecords(OPP.plural, OPP.singular, { filter: `notionCompanyId[eq]:smoke-${MARK}`, pageSize: 5 });
  if (r.length) throw new Error(`${r.length} 件残っている`);
  return '0 件';
});

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗\n`);
process.exit(fail ? 1 : 0);
