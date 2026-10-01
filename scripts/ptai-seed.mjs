// ─── PtAI 共有 DB の初期投入 ───────────────────────────────────────────────────
//
//   node scripts/ptai-seed.mjs <db-snapshot のパス> [--force]
//
// HANDOVER の reference/db-snapshot/（2026-09-30 時点の共有 DB 全件）を
// NocoDB の pga_docs に入れる。既存行があるときは --force を付けない限り止める。
// スナップショットは顧客情報を含むのでリポジトリには置かないこと（12-6）。

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DOTENV = ['.env.local', '.env'];
for (const f of DOTENV) {
  if (!existsSync(f)) continue;
  const txt = await readFile(f, 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE_URL = process.env.NOCODB_BASE_URL ?? 'https://odtable.ptmind.ai';
const TOKEN    = process.env.NOCODB_API_TOKEN;
const TABLE    = process.env.NOCODB_PGA_DOCS_TABLE_ID;
const SNAP     = process.argv[2];
const FORCE    = process.argv.includes('--force');

if (!TOKEN || !TABLE) { console.error('NOCODB_API_TOKEN / NOCODB_PGA_DOCS_TABLE_ID が未設定'); process.exit(1); }
if (!SNAP)            { console.error('使い方: node scripts/ptai-seed.mjs <db-snapshot のパス> [--force]'); process.exit(1); }

const url = (qs = '') => `${BASE_URL}/api/v2/tables/${TABLE}/records${qs}`;
const headers = { 'xc-token': TOKEN, 'Content-Type': 'application/json' };

async function noco(u, init) {
  const res = await fetch(u, { ...init, headers });
  if (!res.ok) throw new Error(`NocoDB ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const existing = await noco(url('?limit=1'));
if (existing.pageInfo?.totalRows > 0 && !FORCE) {
  console.error(`pga_docs にすでに ${existing.pageInfo.totalRows} 行あります。上書きするなら --force`);
  process.exit(1);
}

const rows = [];
for (const collection of await readdir(SNAP, { withFileTypes: true })) {
  if (!collection.isDirectory()) continue;
  const dir = path.join(SNAP, collection.name);
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.json')) continue;
    const docId = file.replace(/\.json$/, '');
    const data  = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    rows.push({
      collection: collection.name,
      doc_id: docId,
      data: JSON.stringify(data),
      at: data?.at ?? data?.updatedAt ?? new Date().toISOString(),
      updated_at_s: new Date().toISOString(),
      deleted: false,
    });
  }
}

console.log(`${rows.length} 件を投入します`);
for (let i = 0; i < rows.length; i += 50) {
  const chunk = rows.slice(i, i + 50);
  await noco(url(), { method: 'POST', body: JSON.stringify(chunk) });
  console.log(`  ${Math.min(i + 50, rows.length)} / ${rows.length}`);
}

const byCol = rows.reduce((a, r) => (a[r.collection] = (a[r.collection] ?? 0) + 1, a), {});
console.log('完了:', byCol);
