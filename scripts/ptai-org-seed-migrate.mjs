#!/usr/bin/env node
// ─── board.js の ORG_SEED を Twenty へ移す ───────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-org-seed-migrate.mjs            現状を表示（GET のみ）
//   … 同上 --apply                                  書き込む（冪等）
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ移すか（2026-10-01）
//
//  `public/ptai-pipeline/board.js` の `ORG_SEED` に、**実在顧客 1 社の社名と
//  組織図（氏名 21 件・役職・商談での役割・スタンス）** が埋め込まれていた。
//  このリポジトリは **public**（github.com/Kubotie/cxm）なので、置いたままに
//  できない。組織図データの正しい置き場は Twenty の `testPerson` なので、
//  そこへ移してからソースを空にする。
//
//  移行後の見え方は変わらない。board.js の `orgOf()` は
//    ORGS[cid] があればそれを返し、無ければ ORG_SEED を見る
//  という順なので、ORGS 側に入れば seed は呼ばれない。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 出力について ─────────────────────────────────────────────────────────────
//   **顧客名・氏名・本文を標準出力に出さない。** 出すのは件数と種別だけ。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const apply = process.argv.includes('--apply');

const { upsertByExternalId, listRecords } =
  await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS } = await import('../src/lib/ptai/twenty-test/schema.ts');
const { listCustomers } = await import('../src/lib/ptai/notion/client.ts');

const PERS = TEST_OBJECTS.person;
const CMT  = TEST_OBJECTS.comment;

// ── 1. board.js から ORG_SEED を読む ────────────────────────────────────────

const board = await readFile('public/ptai-pipeline/board.js', 'utf8');
const line = board.split('\n').find(l => l.startsWith('const ORG_SEED = '));
if (!line) { console.error('board.js に ORG_SEED の行がありません'); process.exit(1); }
const seed = JSON.parse(line.replace(/^const ORG_SEED = /, '').replace(/;\s*$/, ''));
const companies = Object.keys(seed);
console.log(`ORG_SEED: ${companies.length} 社`);
if (!companies.length) { console.log('移すものはありません'); process.exit(0); }

// ── 2. 社名 → Notion ページ ID（board.js と同じ照合: d.n.includes(key)）─────

const customers = await listCustomers({ maxPages: 20 });
console.log(`Notion 顧客管理DB: ${customers.length} 社`);

const ATT  = { '推進': 'PROMOTE', '好意的': 'FAVORABLE', '中立': 'NEUTRAL',
               '慎重': 'CAUTIOUS', '反対': 'OPPOSED', '不明': 'UNKNOWN' };
const ROLE = { '最終決裁者': 'FINAL_APPROVER', '決裁者': 'APPROVER', '影響者': 'INFLUENCER',
               '推進者': 'PROMOTER', '技術評価者': 'EVALUATOR', '利用者': 'USER' };
const CONF = { '公開': 'PUBLIC', '社内': 'INTERNAL', '推定': 'ESTIMATED' };

let created = 0, updated = 0, skipped = 0, comments = 0;

for (const key of companies) {
  const v = seed[key];
  const hits = customers.filter(c => (c.name || '').includes(key));
  if (hits.length !== 1) {
    console.log(`  ✗ 会社を一意に特定できませんでした（候補 ${hits.length} 件）。手当てが要ります`);
    skipped++;
    continue;
  }
  const cid = hits[0].pageId;

  // ⚠ 既存判定は **notionCompanyId** で見る。externalId の接頭辞では見ない。
  //    移行済みの行は、別のページ ID から組み立てた externalId を持っていることがある
  //    （2026-10-01 に 21 行の重複を作って気づいた）。
  const already = (await listRecords(PERS.plural, PERS.singular, {
    filter: `notionCompanyId[eq]:${cid}`, pageSize: 200, maxRecords: 500,
  })).filter(r => String(r.externalId || '').startsWith('orgs:'));

  console.log(`  対象 1 社 — seed ${v.nodes.length} 件 / Twenty の既存 ${already.length} 件`);
  if (already.length) {
    console.log('  → 既に組織図がある。seed は入れない（画面は ORGS を先に見るので不要）');
    skipped++;
    continue;
  }
  if (!apply) continue;

  // 1 パス目: 親を付けずに作る（id が確定してから繋ぐ）
  const idMap = new Map();
  for (const [i, n] of v.nodes.entries()) {
    const r = await upsertByExternalId(PERS.plural, PERS.singular, `orgs:${cid}:${n.id}`, {
      name: n.name, notionCompanyId: cid,
      nodeType: n.kind || 'person', order: i,
      title: n.title || null,
      attitude: ATT[n.stance] ?? null,
      contact: n.contact === '接点あり' ? 'CONTACTED'
             : n.contact === '未接触'  ? 'NOT_CONTACTED' : null,
      // st（確定済みか）と conf（情報源）は別の列。畳まない
      confirmed: n.st === 'ok',
      infoSource: CONF[n.conf] ?? null,
      dealRole: ROLE[n.role] ?? null,
      isDecisionMaker: n.role === '決裁者' || n.role === '最終決裁者',
      influential: n.inf === true,
      memo: n.note || null, sourceNote: n.src || null,
      // ORG_SEED は AI が資料から組み立てたもの（genBy に明記されている）
      source: 'ai',
    }, { name2: 'migration', displayName: 'ORG_SEED 移行', workspaceMemberId: null });
    idMap.set(n.id, String(r.record.id));
    r.created ? created++ : updated++;
  }

  // 2 パス目: 親子関係
  for (const n of v.nodes) {
    if (!n.parent) continue;
    const parentId = idMap.get(n.parent) ?? null;
    if (!parentId) continue;
    await upsertByExternalId(PERS.plural, PERS.singular, `orgs:${cid}:${n.id}`, { parentId });
  }

  // 付帯情報（出典・確認事項・生成元）は testComment へ
  const put = async (ext, body, author) => {
    await upsertByExternalId(CMT.plural, CMT.singular, ext, {
      name: body.slice(0, 60), notionCompanyId: cid,
      targetType: 'COMPANY', targetId: cid,
      body, author, at: v.genAt ? `${v.genAt}T00:00:00.000Z` : new Date().toISOString(),
      source: 'ai',
    }, { name2: 'migration', displayName: 'ORG_SEED 移行', workspaceMemberId: null });
    comments++;
  };
  for (const [i, sgl] of (v.sources || []).entries())   await put(`orgs:${cid}:source:${i}`, String(sgl), v.genBy || 'AI');
  for (const [i, q]   of (v.questions || []).entries()) await put(`orgs:${cid}:question:${i}`, String(q), v.genBy || 'AI');
  await put(`orgs:${cid}:meta`, '組織図の生成元', v.genBy || 'AI');
}

console.log(`\n作成 ${created} / 更新 ${updated} / 付帯情報 ${comments} / 見送り ${skipped}`);
if (!apply) console.log('書き込むには --apply');
