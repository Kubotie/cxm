#!/usr/bin/env node
// ─── 期初MRR を一度だけ焼き付ける ──────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-mrr-baseline.mjs            数えるだけ（書かない）
//   … --apply                                   書く
//
// ═══════════════════════════════════════════════════════════════════════════
//  **1 回きりの作業**（2026-10-01 Kubotie）。
//  同期で入った `現在MRR` をそのまま `期初MRR` に写す。以後は動かさない。
//  画面の「現在MRR（＋◯◯）」の括弧内は 現在MRR − 期初MRR で出す。
//
//  例外: セイコーエプソン株式会社の期初MRR は **438,504 円**（Kubotie 指定）。
//        更新商談の前の金額で、同期で入る現在MRR とは別物。
//
//  ⚠ すでに期初MRR が入っている会社は**上書きしない**。
//     二度走らせても安全にするため。入れ直したいときは Notion 側で空にする。
// ═══════════════════════════════════════════════════════════════════════════
//
// 会社名は出さない。出すのは件数と、例外として指定したエプソンだけ。

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

const { listCustomers, request } = await import('../src/lib/ptai/notion/client.ts');
const { CUSTOMER_PROP } = await import('../src/lib/ptai/notion/schema.ts');

/** 名前にこれを含む会社は、同期の値ではなくこの額を期初MRR にする */
const EXCEPTIONS = [{ match: 'エプソン', yen: 438504 }];

const cs = await listCustomers({ maxPages: 20 });
let write = 0, skipHas = 0, skipNoCur = 0, exc = 0, failed = 0;

for (const c of cs) {
  if (c.baseMrr !== null) { skipHas++; continue; }
  const e = EXCEPTIONS.find(x => c.name.includes(x.match));
  const v = e ? e.yen : c.curMrr;
  if (v === null || v === undefined) { skipNoCur++; continue; }
  if (e) { exc++; console.log(`  例外: ${c.name} → ${v.toLocaleString('ja-JP')} 円`); }
  if (!apply) { write++; continue; }
  try {
    await request('PATCH', `/pages/${c.pageId}`, {
      properties: { [CUSTOMER_PROP.baseMrr]: { number: v } },
    });
    write++;
  } catch { failed++; }
}

console.log(`\n顧客 ${cs.length} 社`);
console.log(`  ${apply ? '書いた' : '書く予定'} ${write} 件（うち例外 ${exc} 件）`);
console.log(`  すでに期初MRR あり ${skipHas} / 現在MRR が無く見送り ${skipNoCur} / 失敗 ${failed}`);
if (!apply) console.log('\n書くには --apply');
