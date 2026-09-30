// ─── RAW スナップショットの投入 ──────────────────────────────────────────────
//
//   node scripts/ptai-seed-raw.mjs <pga-pipeline-board.html のパス>
//
// 原本 1353 行の `const RAW = {...}` を取り出して NocoDB(pga_docs) の _raw に入れる。
// 顧客名・MRR・議事録を含むので、このファイルをリポジトリに置かないこと（HANDOVER 12-6）。
// Phase 2 でここは「サーバーが Twenty / Notion から取得して書く」に置き換わる。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE_URL = process.env.NOCODB_BASE_URL ?? 'https://odtable.ptmind.ai';
const TOKEN    = process.env.NOCODB_API_TOKEN;
const TABLE    = process.env.NOCODB_PGA_DOCS_TABLE_ID;
const SRC      = process.argv[2];
const CHUNK    = 50_000;   // NocoDB の LongText は 60KB 前後で 422 になる

if (!TOKEN || !TABLE) { console.error('NOCODB_API_TOKEN / NOCODB_PGA_DOCS_TABLE_ID が未設定'); process.exit(1); }
if (!SRC)             { console.error('使い方: node scripts/ptai-seed-raw.mjs <pga-pipeline-board.html>'); process.exit(1); }

const url = (qs = '') => `${BASE_URL}/api/v2/tables/${TABLE}/records${qs}`;
const headers = { 'xc-token': TOKEN, 'Content-Type': 'application/json' };
async function noco(u, init) {
  const res = await fetch(u, { ...init, headers });
  if (!res.ok) throw new Error(`NocoDB ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// 原本 HTML から RAW の 1 行を取り出す
const html = await readFile(SRC, 'utf8');
const line = html.split('\n').find(l => l.startsWith('const RAW = {'));
if (!line) { console.error('const RAW = {…} の行が見つかりません'); process.exit(1); }
const jsonText = line.slice('const RAW = '.length).trim().replace(/;$/, '');
JSON.parse(jsonText);                              // 壊れていないことだけ確認
console.log(`RAW ${(jsonText.length / 1024).toFixed(0)}KB`);

const where = encodeURIComponent('(collection,eq,_raw)');
const old = await noco(url(`?where=${where}&limit=500&fields=Id`));
if (old.list.length) {
  await noco(url(), { method: 'DELETE', body: JSON.stringify(old.list.map(r => ({ Id: r.Id }))) });
  console.log(`既存 ${old.list.length} チャンクを削除`);
}

const now = new Date().toISOString();
const rows = [];
for (let i = 0; i * CHUNK < jsonText.length; i++) {
  rows.push({
    collection: '_raw',
    doc_id: String(i).padStart(4, '0'),
    data: jsonText.slice(i * CHUNK, (i + 1) * CHUNK),
    at: now, updated_at_s: now, deleted: false,
  });
}
for (let i = 0; i < rows.length; i += 5) {
  await noco(url(), { method: 'POST', body: JSON.stringify(rows.slice(i, i + 5)) });
  console.log(`  ${Math.min(i + 5, rows.length)} / ${rows.length}`);
}
console.log(`完了: ${rows.length} チャンク`);
