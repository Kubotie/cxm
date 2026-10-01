#!/usr/bin/env node
// ─── PtAI Pipeline: 目標用 Notion DB の作成 ─────────────────────────────────
//
//   node scripts/notion-targets-db.mjs --status    既存を探すだけ（GET のみ）
//   node scripts/notion-targets-db.mjs --apply     無ければ作成（冪等）
//
// 出典: docs/ptai-dashboard-operation-flows.md §9-1（回答: 2026-10-01）
//   「専用DBを作成してください。置き場所は Ptengine AI Project Board（JP）」
//
// 現行の `settings/targets`（チーム目標・期限・メンバー別目標）の置き換え先。
// 1 行 = 1 対象。チーム全体の行が期限（YYYY-MM）を持ち、メンバーの行が配分を持つ。
//
// ── 守ること ──────────────────────────────────────────────────────────────────
//   - 親ページ以外には触らない
//   - 冪等。同じタイトルの DB があれば作らない
//   - トークンをログに出さない

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** 顧客管理DB と同じ側のトークン（PtAI 用）。PGA_NOTION_TOKEN で上書きできる */
const TOKEN = (process.env.PGA_NOTION_TOKEN || process.env.TOKEN_NOTION || '').trim();
if (!TOKEN) { console.error('TOKEN_NOTION が未設定です'); process.exit(1); }

/** Ptengine AI Project Board（JP） */
export const PARENT_PAGE_ID = '2a86643a-9819-80f3-8966-dc858874a459';
export const DB_TITLE = 'Ptengine AI 目標（Pipeline）';

const VERSION = '2025-09-03';
const apply = process.argv.includes('--apply');

async function api(method, path, body) {
  const r = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`Notion ${r.status} ${j.code ?? ''} ${String(j.message ?? '').slice(0, 200)}`);
    e.status = r.status;
    throw e;
  }
  return j;
}

const plain = rich => (rich ?? []).map(t => t.plain_text).join('');

// ── 既存を探す ──────────────────────────────────────────────────────────────
async function findExisting() {
  let cursor;
  for (let guard = 0; guard < 20; guard++) {
    const body = { block_id: PARENT_PAGE_ID, page_size: 100 };
    const res = await api('GET', `/blocks/${PARENT_PAGE_ID}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    for (const b of res.results ?? []) {
      if (b.type !== 'child_database') continue;
      if ((b.child_database?.title ?? '') === DB_TITLE) return b.id;
    }
    if (!res.has_more) break;
    cursor = res.next_cursor;
    void body;
  }
  return null;
}

const existing = await findExisting();
console.log(`親ページ: ${PARENT_PAGE_ID}`);
console.log(`DB「${DB_TITLE}」: ${existing ? `既存（${existing}）` : '未作成'}`);

if (!apply) {
  console.log('\n作成するには --apply');
  process.exit(0);
}

let dbId = existing;

if (!dbId) {
  const created = await api('POST', '/databases', {
    parent: { type: 'page_id', page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: DB_TITLE } }],
    description: [{ type: 'text', text: {
      content: 'Ptengine AI パイプラインダッシュボードのチーム目標・メンバー別目標。ダッシュボードから読み書きします。',
    } }],
  });   // ⚠ API 2025-09-03 の POST /databases は properties を無視する。
        //    スキーマは下の PATCH /data_sources/{id} で入れる
  dbId = created.id;
  console.log(`作成しました: ${dbId}`);
  const ds = created.data_sources ?? [];
  if (ds.length) console.log(`data source: ${ds.map(d => d.id).join(', ')}`);
} else {
  console.log('既にあるので作成しません');
}

// ── スキーマをデータソースへ反映（冪等）──────────────────────────────────────
//   2025-09-03 では列は database ではなく data source が持つ。
//   既定の `Name`（title）を `対象` に名前だけ変え、残りを足す。

const dbMeta = await api('GET', `/databases/${dbId}`);
const dataSourceId = (dbMeta.data_sources ?? [])[0]?.id;
if (!dataSourceId) { console.error('data source が見つかりません'); process.exit(1); }

const ds = await api('GET', `/data_sources/${dataSourceId}`);
const current = ds.properties ?? {};
const titleKey = Object.keys(current).find(k => current[k].type === 'title');

const wanted = {
  '種別':    { select: { options: [
    { name: 'チーム',   color: 'blue' },
    { name: 'メンバー', color: 'green' },
  ] } },
  'name2':   { rich_text: {} },
  '目標MRR': { number: { format: 'yen' } },
  '期限':    { rich_text: {} },
  '有効':    { checkbox: {} },
  '備考':    { rich_text: {} },
};

const patch = {};
if (titleKey && titleKey !== '対象') patch[titleKey] = { name: '対象' };
for (const [k, v] of Object.entries(wanted)) if (!(k in current)) patch[k] = v;

if (Object.keys(patch).length) {
  await api('PATCH', `/data_sources/${dataSourceId}`, { properties: patch });
  console.log(`スキーマを更新: ${Object.keys(patch).join(', ')}`);
} else {
  console.log('スキーマは最新');
}

// ── 初期行（無ければ入れる）─────────────────────────────────────────────────
// 原本の初期値: 全体4,000万／Paul 1,200・Baba 1,000・Eri 800・Kubotie 600・Ava 400万円
const SEED = [
  ['チーム全体', 'チーム',   '',        40_000_000, '2026-12'],
  ['Paul',       'メンバー', 'Paul',    12_000_000, ''],
  ['Baba',       'メンバー', 'Baba',    10_000_000, ''],
  ['Eri',        'メンバー', 'Eri',      8_000_000, ''],
  ['Kubotie',    'メンバー', 'Kubotie',  6_000_000, ''],
  ['Ava',        'メンバー', 'Ava',      4_000_000, ''],
];

const dsId = dataSourceId;

const rows = await api('POST', `/data_sources/${dsId}/query`, { page_size: 100 })
  .catch(() => api('POST', `/databases/${dbId}/query`, { page_size: 100 }));
const have = new Set((rows.results ?? []).map(p => plain(p.properties?.['対象']?.title)));
console.log(`既存の行: ${have.size} 件`);

let added = 0;
for (const [name, kind, name2, mrr, due] of SEED) {
  if (have.has(name)) continue;
  await api('POST', '/pages', {
    parent: { type: 'data_source_id', data_source_id: dsId },
    properties: {
      '対象':    { title: [{ type: 'text', text: { content: name } }] },
      '種別':    { select: { name: kind } },
      'name2':   { rich_text: name2 ? [{ type: 'text', text: { content: name2 } }] : [] },
      '目標MRR': { number: mrr },
      '期限':    { rich_text: due ? [{ type: 'text', text: { content: due } }] : [] },
      '有効':    { checkbox: true },
    },
  });
  added++;
}
console.log(`初期行を ${added} 件追加`);

console.log(`\n環境変数に設定してください:`);
console.log(`  NOTION_PTAI_TARGETS_DB_ID=${dbId}`);
if (dsId !== dbId) console.log(`  NOTION_PTAI_TARGETS_DS_ID=${dsId}`);
