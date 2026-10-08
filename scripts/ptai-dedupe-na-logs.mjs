#!/usr/bin/env node
// ─── 重複したネクストアクション完了の記録を片付ける ────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-dedupe-na-logs.mjs            数えるだけ（消さない）
//   … --apply                                     消す
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ要るか（2026-10-08）
//
//  完了の保存に 1〜2 秒かかるのに画面が変わらず、反応が無いと思って続けて
//  押された結果、**同じ完了が 4 件**入った。連打は防ぐ作りにしたが、
//  すでに入ってしまったぶんをここで片付ける。
//
//  同じ商談・同じ本文で、**10 分以内**に並んでいるものを重複とみなし、
//  いちばん古い 1 件だけ残す。日をまたいで同じ文面の一手を本当に 2 回
//  完了したケースを消さないよう、時間の窓で区切っている。
// ═══════════════════════════════════════════════════════════════════════════
//
// 顧客名・商談名は出さない。出すのは件数と本文の先頭だけ。

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
const WINDOW_MS = 10 * 60_000;

const { listRecords, deleteRecord } = await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS } = await import('../src/lib/ptai/twenty-test/schema.ts');
const ACTV = TEST_OBJECTS.activity;
const str = v => (typeof v === 'string' ? v.trim() : '');
const ms  = v => { const t = new Date(str(v)).getTime(); return Number.isFinite(t) ? t : 0; };

const rows = (await listRecords(ACTV.plural, ACTV.singular, { pageSize: 200, maxRecords: 3000 }))
  .filter(r => str(r.type) === 'ACTION_DONE');

const groups = new Map();
for (const r of rows) {
  const k = `${str(r.opportunityId)}|${str(r.text)}`;
  (groups.get(k) ?? groups.set(k, []).get(k)).push(r);
}

let drop = 0, keep = 0;
const doomed = [];
for (const [, v] of groups) {
  v.sort((a, b) => ms(a.occurredAt) - ms(b.occurredAt));
  let anchor = null;
  for (const r of v) {
    if (anchor && ms(r.occurredAt) - ms(anchor) <= WINDOW_MS) { doomed.push(r); drop++; continue; }
    anchor = r.occurredAt; keep++;
  }
}

console.log(`完了の記録 ${rows.length} 件 / 残す ${keep} 件 / 重複 ${drop} 件`);
for (const r of doomed) console.log(`  消す: ${str(r.externalId)}  ${str(r.occurredAt).slice(0, 19)}  「${str(r.text).slice(0, 28)}…」`);
if (!drop) process.exit(0);
if (!apply) { console.log('\n消すには --apply'); process.exit(0); }

let n = 0;
for (const r of doomed) { await deleteRecord(ACTV.plural, str(r.id)); n++; }
console.log(`\n消しました ${n} 件`);
