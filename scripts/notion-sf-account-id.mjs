#!/usr/bin/env node
// ─── Notion 顧客管理DB に Salesforce Account ID を持たせる ──────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/notion-sf-account-id.mjs            現状を表示（書き込まない）
//   … 同上 --apply                                 列の作成と流し込み（冪等）
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ要るか（2026-10-01）
//
//  Salesforce の Account に Notion ページ ID を持つ項目が無く、Notion 側にも
//  Salesforce の ID が無いため、**会社を突き合わせる鍵が存在しなかった**。
//  社名の正規化照合だと 127 社中 113 社しか当たらず、同名 11 社は決められない。
//
//  Notion（アカウント情報の正本）側に列を 1 つ持たせるのが一番軽い。
//  **社名が完全一致する 113 社はここで自動的に埋め、残りは人が入れる。**
//
//  ⚠ Notion の「ロールアップ」ではできない。あれはリレーション先の値を集計する
//     機能で、Salesforce の値は取れない。ただのテキスト列にする。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 出力について ─────────────────────────────────────────────────────────────
//   **顧客名・Account 名を標準出力に出さない。** 出すのは件数だけ。

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

const { sfFetch, SF_API_BASE } = await import('../src/lib/salesforce/client.ts');
const { listCustomers } = await import('../src/lib/ptai/notion/client.ts');
const { NOTION_SOURCES } = await import('../src/lib/ptai/notion/schema.ts');
const { normalizeCompanyName } = await import('../src/lib/ptai/minutes.ts');

/** この名前の列を作る。board.js や API から参照するのでここが唯一の定義 */
export const SF_ACCOUNT_PROP = 'Salesforce Account ID';

const TOKEN = process.env.PGA_NOTION_TOKEN || process.env.TOKEN_NOTION || process.env.TOKEN_NOTION_2;
const NH = { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' };

async function notion(method, path, body) {
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    method, headers: NH, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Notion ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

// 既存クライアントは 2000 件で打ち切るので、ここだけ自前でページングする
async function sfAll(soql) {
  let r = await sfFetch('GET', `${SF_API_BASE}/query?q=${encodeURIComponent(soql)}`);
  const rows = [...r.records];
  while (r.nextRecordsUrl) { r = await sfFetch('GET', r.nextRecordsUrl); rows.push(...r.records); }
  return rows;
}

// ── 1. 列があるか ───────────────────────────────────────────────────────────

const ds = await notion('GET', `/data_sources/${NOTION_SOURCES.customers}`);
const exists = Boolean(ds.properties?.[SF_ACCOUNT_PROP]);
console.log(`顧客管理DB の列数: ${Object.keys(ds.properties ?? {}).length}`);
console.log(`「${SF_ACCOUNT_PROP}」: ${exists ? '既存' : '未作成'}`);

if (!exists && apply) {
  // API 2025-09-03 では列は data source が持つ（memory: DB ID と data source ID は別物）
  await notion('PATCH', `/data_sources/${NOTION_SOURCES.customers}`, {
    properties: { [SF_ACCOUNT_PROP]: { rich_text: {} } },
  });
  console.log('  → 作成しました');
}

// ── 2. 社名で突き合わせる ───────────────────────────────────────────────────

const [cust, accs] = await Promise.all([
  listCustomers({ maxPages: 20 }),
  sfAll('SELECT Id, Name FROM Account'),
]);
console.log(`\nNotion 顧客 ${cust.length} 社 / SF Account ${accs.length} 社`);

const byName = new Map();
for (const a of accs) {
  const k = normalizeCompanyName(a.Name || '');
  if (k.length < 3) continue;
  const cur = byName.get(k);
  if (cur) cur.push(a.Id); else byName.set(k, [a.Id]);
}

const plan = [];
let dup = 0, miss = 0, already = 0;
for (const c of cust) {
  const hit = byName.get(normalizeCompanyName(c.name));
  if (!hit)            { miss++; continue; }
  if (hit.length > 1)  { dup++;  continue; }   // 同名は機械的に決められない
  plan.push({ pageId: c.pageId, accountId: hit[0] });
}

// 既に入っている行は触らない
if (exists) {
  const pages = await notion('POST', `/data_sources/${NOTION_SOURCES.customers}/query`, { page_size: 100 });
  const filled = new Set();
  let cursor = pages.has_more ? pages.next_cursor : null;
  const scan = (res) => {
    for (const p of res.results ?? []) {
      const v = p.properties?.[SF_ACCOUNT_PROP]?.rich_text ?? [];
      if (v.map(x => x.plain_text ?? '').join('').trim()) filled.add(p.id);
    }
  };
  scan(pages);
  while (cursor) {
    const more = await notion('POST', `/data_sources/${NOTION_SOURCES.customers}/query`, { page_size: 100, start_cursor: cursor });
    scan(more);
    cursor = more.has_more ? more.next_cursor : null;
  }
  already = plan.filter(p => filled.has(p.pageId)).length;
}

console.log(`\n自動で埋められる: ${plan.length} 社（うち入力済み ${already} 社）`);
console.log(`人が入れる必要: 同名が複数 ${dup} 社 / 社名が一致せず ${miss} 社`);

if (!apply) { console.log('\n書き込むには --apply'); process.exit(0); }
if (!exists) { console.log('\n列を作ったので、もう一度実行して流し込んでください'); process.exit(0); }

// ── 3. 流し込み ─────────────────────────────────────────────────────────────

let wrote = 0, failed = 0;
for (const { pageId, accountId } of plan) {
  try {
    await notion('PATCH', `/pages/${pageId}`, {
      properties: { [SF_ACCOUNT_PROP]: { rich_text: [{ text: { content: accountId } }] } },
    });
    wrote++;
  } catch {
    failed++;
  }
  await new Promise(r => setTimeout(r, 350));   // Notion は約 3 req/s
}
console.log(`\n書き込み ${wrote} 件 / 失敗 ${failed} 件`);
