#!/usr/bin/env node
// ─── PtAI Pipeline 専用の設定テーブルを NocoDB に作る ───────────────────────
//
//   node scripts/ptai-settings-table.mjs            現状を表示（GET のみ）
//   node scripts/ptai-settings-table.mjs --apply    無ければ作成（冪等）
//
// 2026-10-01 の判断: Twenty API キーを管理画面から設定できるようにする。
// 置き場所は **PtAI 専用の小さなテーブル**。
//
// ⚠ **`staff_identify` には置かない。** あちらは共通認証のホットパスで、
//    10 モジュール（CXM のログイン・ホーム・認可ガードを含む）が読んでいる。
//    1 行＝1 人の表に、ワークスペースに 1 つの秘密を入れる場所が無い。
//
// ⚠ 値は **AES-256-GCM で暗号化**して入れる（src/lib/ptai/secret.ts）。
//    NocoDB のトークンは CXM と共用でテーブル単位に絞れないため、平文は置かない。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE  = (process.env.NOCODB_BASE_URL || 'https://odtable.ptmind.ai').replace(/\/+$/, '');
const TOKEN = (process.env.NOCODB_API_TOKEN || '').trim();
if (!TOKEN) { console.error('NOCODB_API_TOKEN が未設定です'); process.exit(1); }

/** pga_docs と同じ base（title "EC"）。CXM の 93 テーブルと同居している */
const BASE_ID = 'pcng30q6j3dqrsk';
const TABLE   = 'ptai_settings';
const apply = process.argv.includes('--apply');

async function api(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'xc-token': TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* そのまま */ }
  if (!r.ok) throw new Error(`NocoDB ${r.status}: ${String(text).slice(0, 300)}`);
  return json;
}

const tables = await api('GET', `/api/v2/meta/bases/${BASE_ID}/tables`);
const found = (tables.list ?? []).find(t => t.table_name === TABLE || t.title === TABLE);

console.log(`base ${BASE_ID} のテーブル数: ${(tables.list ?? []).length}`);
console.log(`${TABLE}: ${found ? `既存（${found.id}）` : '未作成'}`);

if (found) {
  const meta = await api('GET', `/api/v2/meta/tables/${found.id}`);
  console.log('  列:', (meta.columns ?? []).map(c => `${c.title}(${c.uidt})`).join(' '));
  console.log(`\nNOCODB_PTAI_SETTINGS_TABLE_ID=${found.id}`);
  process.exit(0);
}

if (!apply) { console.log('\n作成するには --apply'); process.exit(0); }

// memory: columns を明示すると ID 列が作られないので、先頭に uidt:"ID" を置く
const created = await api('POST', `/api/v2/meta/bases/${BASE_ID}/tables`, {
  table_name: TABLE,
  title: TABLE,
  columns: [
    { column_name: 'Id',           title: 'Id',           uidt: 'ID' },
    // 設定の名前。いまは 'twenty_api_key' の 1 行だけ
    { column_name: 'setting_key',  title: 'setting_key',  uidt: 'SingleLineText' },
    // AES-256-GCM で暗号化した値（v1.<iv>.<tag>.<ct>）
    { column_name: 'value_enc',    title: 'value_enc',    uidt: 'LongText' },
    // 画面に出す手がかり（末尾 4 文字など）。復号しなくても状態が分かるように
    { column_name: 'hint',         title: 'hint',         uidt: 'SingleLineText' },
    { column_name: 'updated_by',   title: 'updated_by',   uidt: 'SingleLineText' },
    { column_name: 'updated_at_s', title: 'updated_at_s', uidt: 'SingleLineText' },
  ],
});

console.log(`作成しました: ${created.id}`);
const meta = await api('GET', `/api/v2/meta/tables/${created.id}`);
console.log('  列:', (meta.columns ?? []).map(c => `${c.title}(${c.uidt})`).join(' '));
console.log(`\n環境変数に設定してください:`);
console.log(`  NOCODB_PTAI_SETTINGS_TABLE_ID=${created.id}`);
