#!/usr/bin/env node
// ─── 完了したネクストアクションを操作ログから復元する ──────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-recover-na-logs.mjs            数えるだけ（書かない）
//   … --apply                                      書く（冪等）
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ要るか（2026-10-07）
//
//  db-write が Salesforce 由来の商談で**経過ログを書いていなかった**ため、
//  メンバーがネクストアクションを完了にしても、道のりにも行動履歴にも
//  残らなかった（画面を開き直すと消える）。
//
//  ただし操作ログ（testOperationLog）には `field=nadone` として
//  「いつ・誰が・どの商談で・何を完了にしたか」が残っていた。
//  そこから活動記録（testActivity / ACTION_DONE）を作り直す。
//
//  ⚠ 1 回やれば済む。鍵を `…:log:recover-<操作ログID>` にしてあるので、
//    二度流しても増えない。
//  ⚠ 操作ログに無いもの（結果メモ・そのときのフェーズ・元の期日）は復元
//    できない。本文と日時と実行者だけ。
// ═══════════════════════════════════════════════════════════════════════════
//
// 会社名・商談名は出さない。出すのは件数だけ。

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
const { listRecords, upsertByExternalId } = await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS } = await import('../src/lib/ptai/twenty-test/schema.ts');
const OPP = TEST_OBJECTS.opportunity, ACTV = TEST_OBJECTS.activity, LOG = TEST_OBJECTS.operationLog;

const str = v => (typeof v === 'string' ? v.trim() : '');

const [opps, logs, actvs] = await Promise.all([
  listRecords(OPP.plural, OPP.singular, { pageSize: 200, maxRecords: 2000 }),
  listRecords(LOG.plural, LOG.singular, { pageSize: 200, maxRecords: 2000 }),
  listRecords(ACTV.plural, ACTV.singular, { pageSize: 200, maxRecords: 3000 }),
]);

/** 商談の externalId → Twenty の id */
const byExt = new Map(opps.map(o => [str(o.externalId), { id: str(o.id), cid: str(o.notionCompanyId) }]));
const have  = new Set(actvs.map(a => str(a.externalId)));

const done = logs.filter(r => str(r.field) === 'nadone' && str(r.to));
console.log(`操作ログ ${logs.length} 件 / うち「ネクストアクション完了」 ${done.length} 件`);

let make = 0, already = 0, noOpp = 0, failed = 0;
for (const r of done) {
  const key = str(r.recordId);
  const opp = byExt.get(key);
  if (!opp) { noOpp++; continue; }          // 商談が Salesforce から消えている等
  const ext = `${key}:log:recover-${str(r.id)}`;
  if (have.has(ext)) { already++; continue; }
  make++;
  if (!apply) continue;
  try {
    await upsertByExternalId(ACTV.plural, ACTV.singular, ext, {
      name: str(r.to) || 'ネクストアクション完了',
      notionCompanyId: opp.cid, opportunityId: opp.id,
      type: 'ACTION_DONE',
      occurredAt: str(r.at) || null,
      text: str(r.to) || null,
      actor: str(r.actor) || null,
    });
  } catch { failed++; }
}

console.log(`  ${apply ? '作った' : '作る予定'} ${make} 件 / すでにある ${already} 件 / 商談が見つからない ${noOpp} 件 / 失敗 ${failed} 件`);
if (!apply) console.log('\n書くには --apply');
