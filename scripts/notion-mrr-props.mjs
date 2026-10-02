#!/usr/bin/env node
// ─── Notion 顧客管理DB に「現在MRR」「期初MRR」を追加 ──────────────────────
//
//   node scripts/notion-mrr-props.mjs            現状を表示（GET のみ）
//   node scripts/notion-mrr-props.mjs --apply    足りないものだけ追加（冪等）
//
// ═══════════════════════════════════════════════════════════════════════════
//  決定（2026-10-01 Kubotie）
//
//  ダッシュボードの「現在MRR」は **⚠️MRR を見なくなる**。
//  代わりに Company Database（CCM）の `mrr`（Salesforce から自動反映）を
//  毎朝 8 時に写してくる。その受け皿が `現在MRR`。
//
//  `期初MRR` は**その初回同期の値を 1 回だけ焼き付けたもの**。
//  以後は動かさない。画面の「現在MRR（＋◯◯）」の括弧内は
//  現在MRR − 期初MRR で出す。
//
//  ⚠ ⚠️MRR は**消さない・触らない**。他のビューが参照しているため。
//     新しい 2 列を足すだけにする。
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ 共有の顧客管理DB に列を足す。他チームの画面にも出る。

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
    headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Notion ${r.status} ${j.code ?? ''} ${String(j.message ?? '').slice(0, 200)}`);
  return j;
}

const WANTED = {
  '現在MRR': { number: { format: 'yen' } },
  '期初MRR': { number: { format: 'yen' } },
  // 2026-10-02 追加。1 社を複数行に分けて持つとき（ビズリーチ ToB/ToC、
  // マネーフォワード アカウント1/2）に、その行が担う Ptengine アカウントを書く。
  // Account ID（UUID）をカンマ区切り。入っていればアカウントの MRR を足した額を
  // 現在MRR にする。空なら従来どおり Company Database の会社単位 MRR。
  // ※ 最初はプロジェクト単位にしたが、どのプロジェクトにも載らない Other MRR を
  //    取りこぼした（ビズリーチ ToC で 22,000 円）。アカウント単位なら合計が合う。
  '対象アカウントID': { rich_text: {} },
};

const ds = await api('GET', `/data_sources/${CUSTOMERS_DS}`);
const current = ds.properties ?? {};
console.log(`顧客管理DB のプロパティ: ${Object.keys(current).length} 個`);
for (const k of Object.keys(WANTED)) console.log(`  ${k in current ? '既存' : '未作成'}  ${k}`);

const missing = Object.keys(WANTED).filter(k => !(k in current));
if (!missing.length) { console.log('\n追加するものはありません'); process.exit(0); }
if (!apply) { console.log(`\n${missing.length} 個を追加します。実行するには --apply`); process.exit(0); }

// ⚠ 足りないものだけを送る。既存プロパティを payload に含めると、
//    select の選択肢が id 無しで作り直されて**保存値が NULL になる**（2026-10-01 に実害あり）。
const patch = {};
for (const k of missing) patch[k] = WANTED[k];
await api('PATCH', `/data_sources/${CUSTOMERS_DS}`, { properties: patch });

const after = await api('GET', `/data_sources/${CUSTOMERS_DS}`);
const ok = Object.keys(WANTED).every(k => k in (after.properties ?? {}));
console.log(`\n追加しました: ${missing.join(', ')}`);
console.log(`検証: ${ok ? 'すべて存在する' : '**足りないものがある**'} / 合計 ${Object.keys(after.properties ?? {}).length} 個`);
process.exit(ok ? 0 : 1);
