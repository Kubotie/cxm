#!/usr/bin/env node
// ─── 保存済みレコードのフェーズ値を Salesforce のキーへ移す ─────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-stage-migrate.mjs            数えるだけ
//   … 同上 --apply                               書き換える（冪等）
//
// 旧キー（NOT_STARTED ほか）→ 新キーは schema.ts の STAGE_LEGACY が正。
// 読み込み時には読み替わるが、**保存済みの値そのものも揃えておく**
// （Twenty の画面で直接見たときに混ざらないように）。

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
const { listRecords, updateRecord } = await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS, STAGE_LEGACY } = await import('../src/lib/ptai/twenty-test/schema.ts');

/** 書き換える対象（オブジェクト, フィールド） */
const TARGETS = [
  [TEST_OBJECTS.opportunity, ['stage', 'pendingStage']],
  [TEST_OBJECTS.action,      ['stageAtDone']],
  [TEST_OBJECTS.activity,    ['fromStage', 'toStage']],
];

let total = 0, changed = 0;
for (const [obj, fields] of TARGETS) {
  const rows = await listRecords(obj.plural, obj.singular, { pageSize: 200, maxRecords: 5000 });
  for (const r of rows) {
    const patch = {};
    for (const f of fields) {
      const v = r[f];
      if (typeof v !== 'string' || !v) continue;
      total++;
      const next = STAGE_LEGACY[v];
      if (next && next !== v) patch[f] = next;
    }
    if (!Object.keys(patch).length) continue;
    changed++;
    if (apply) await updateRecord(obj.plural, obj.singular, String(r.id), patch);
  }
  console.log(`  ${obj.singular.padEnd(18)} ${rows.length} 件を確認`);
}
console.log(`\nフェーズ値 ${total} 個 / 書き換えが要るレコード ${changed} 件`);
if (!apply) console.log('書き換えるには --apply');
