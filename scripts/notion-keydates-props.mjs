#!/usr/bin/env node
// ─── Notion 顧客管理DB にキー日程のプロパティを追加 ─────────────────────────
//
//   node scripts/notion-keydates-props.mjs            現状を表示（GET のみ）
//   node scripts/notion-keydates-props.mjs --apply    足りないものだけ追加（冪等）
//
// 出典: docs/ptai-dashboard-operation-flows.md D-05・§9-4（回答: 2026-10-01「Notion の方に」）
//
// 原本 board.js の持ち方（`edits/<cid>.company.keyDates`）:
//   fiscal  : { m: 1..12 } または { none: true }   決算月
//   budget  : { fm, tm }   または { none: true }   予算策定時期（毎年同じ月の範囲）
//   renewal : { m: 1..12 } または { none: true }   契約更新月
//
// **日付ではなく「月」**なので、Notion 側も date ではなく select / text にする。
//
// ⚠ **共有の顧客管理DB（73 プロパティ）に列を足す。** 他チームの画面にも出る。
//    既存プロパティは変更しない。足りないものだけ追加する。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TOKEN = (process.env.PGA_NOTION_TOKEN || process.env.TOKEN_NOTION || '').trim();
if (!TOKEN) { console.error('TOKEN_NOTION が未設定です'); process.exit(1); }

const CUSTOMERS_DS = '25ef5c40-d968-45d7-9120-7f1878006682';
const apply = process.argv.includes('--apply');

async function api(method, path, body) {
  const r = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Notion-Version': '2025-09-03',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Notion ${r.status} ${j.code ?? ''} ${String(j.message ?? '').slice(0, 200)}`);
  return j;
}

/** 1月〜12月 ＋ 情報なし */
const monthOptions = () => [
  ...Array.from({ length: 12 }, (_, i) => ({ name: `${i + 1}月`, color: 'default' })),
  { name: '情報なし', color: 'gray' },
];

const WANTED = {
  '決算月':       { select: { options: monthOptions() } },
  '予算策定時期': { rich_text: {} },   // 「10月〜11月」のような範囲。select だと 144 通りになる
  '契約更新月':   { select: { options: monthOptions() } },
  // 2026-10-01 追加。移行元の 103 社は **全件が推定値**（st:"est"）で、
  // それぞれに出典が付いていた。確度と出典を落とすと「確認済み」に見えてしまう。
  'キー日程の確度': { select: { options: [
    { name: '確認済み', color: 'green' },
    { name: '推定',     color: 'yellow' },
    { name: '一部推定', color: 'orange' },
  ] } },
  'キー日程の出典': { rich_text: {} },
};

const ds = await api('GET', `/data_sources/${CUSTOMERS_DS}`);
const current = ds.properties ?? {};
console.log(`顧客管理DB のプロパティ: ${Object.keys(current).length} 個`);

const missing = Object.keys(WANTED).filter(k => !(k in current));
for (const k of Object.keys(WANTED)) {
  console.log(`  ${k in current ? '既存' : '未作成'}  ${k}`);
}

if (!missing.length) { console.log('\n追加するものはありません'); process.exit(0); }
if (!apply) { console.log(`\n${missing.length} 個を追加します。実行するには --apply`); process.exit(0); }

const patch = {};
for (const k of missing) patch[k] = WANTED[k];
await api('PATCH', `/data_sources/${CUSTOMERS_DS}`, { properties: patch });
console.log(`\n追加しました: ${missing.join(', ')}`);

const after = await api('GET', `/data_sources/${CUSTOMERS_DS}`);
const ok = Object.keys(WANTED).every(k => k in (after.properties ?? {}));
console.log(`検証: ${ok ? 'すべて存在する' : '**足りないものがある**'} / 合計 ${Object.keys(after.properties ?? {}).length} 個`);
process.exit(ok ? 0 : 1);
