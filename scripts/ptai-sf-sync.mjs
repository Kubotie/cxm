#!/usr/bin/env node
// ─── Salesforce の PtAI 商談を Twenty へ写す ────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-sf-sync.mjs            数えるだけ（書かない）
//   … 同上 --apply                         書き込む（冪等）
//
// **Salesforce が商談と金額の正本。** 一方向の写し取りで、書き戻さない。
// 顧客名・商談名は出さない。出すのは件数だけ。

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
const { syncSalesforceOpportunities } = await import('../src/lib/ptai/salesforce/sync.ts');

const actor = { name2: 'sync', displayName: 'Salesforce 同期', workspaceMemberId: null };
const r = await syncSalesforceOpportunities(actor, !apply);

console.log(`Salesforce の PtAI 商談: ${r.fetched} 件`);
console.log(`  Notion の会社に紐付いた: ${r.matched}`);
console.log(`  取引先が見つからない:     ${r.skippedNoCompany}`);
if (apply) console.log(`  作成 ${r.created} / 更新 ${r.updated} / 削除 ${r.deleted}`);
if (r.message) console.log(`  ${r.message}`);
if (!apply) console.log('\n書き込むには --apply');
