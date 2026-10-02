#!/usr/bin/env node
// ─── 現在MRR の同期を手で走らせる ──────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-mrr-sync.mjs            数えるだけ（書かない）
//   … --apply                               書く
//   … --diag                                突き合わせ具合だけ見る
//
// 本番は毎朝 8 時（JST）に /api/batch/ptai-mrr-sync が同じことをする。
// 会社名は出さない。出すのは件数だけ。

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
const { syncCurrentMrr, mrrSyncDiagnostics } = await import('../src/lib/ptai/notion/mrr-sync.ts');

if (process.argv.includes('--diag')) {
  const d = await mrrSyncDiagnostics();
  console.log(`顧客 ${d.customers} 社 / Company Database の有料行 ${d.payingRows}`);
  console.log(`突き合った ${d.matched} / 付かない ${d.unmatched} / 同じ鍵が重複 ${d.duplicates}`);
  process.exit(0);
}

const t0 = Date.now();
const r = await syncCurrentMrr(!apply);
console.log(`顧客 ${r.customers} 社（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
console.log(`  対象アカウントで集計 ${r.viaAccount} / Salesforce ID で一致 ${r.viaSfId} / 社名で一致 ${r.viaName} / MRR 0 円 ${r.zero}`);
if (r.accountMissing) console.log(`  指定アカウントが BI に無い: ${r.accountMissing} 社`);
console.log(`  書いた ${r.updated} / 変化なし ${r.unchanged} / 失敗 ${r.failed} / 見つからず ${r.unmatched}`);
if (r.message) console.log(`  ${r.message}`);
if (!apply) console.log('\n書くには --apply');
