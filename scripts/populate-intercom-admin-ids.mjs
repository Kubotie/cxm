#!/usr/bin/env node
// scripts/populate-intercom-admin-ids.mjs
// NocoDB staff_identify テーブルの intercom_admin_id を一括設定するスクリプト。
//
// 前提: NocoDB UI で staff_identify テーブルに intercom_admin_id 列（Text型）を追加済みであること。
//
// 実行: node scripts/populate-intercom-admin-ids.mjs

import { readFileSync } from 'fs';

// .env.local を手動パース
const env = {};
try {
  const content = readFileSync('.env.local', 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
} catch (e) {
  console.error('.env.local の読み込みに失敗しました:', e.message);
  process.exit(1);
}

const BASE     = env.NOCODB_BASE_URL || 'https://odtable.ptmind.ai';
const TOKEN    = env.NOCODB_API_TOKEN;
const TABLE_ID = env.NOCODB_STAFF_IDENTIFY_TABLE_ID || 'munjnmflbul56cu';

if (!TOKEN) {
  console.error('NOCODB_API_TOKEN が未設定です');
  process.exit(1);
}

// ─── スタッフ × Intercom Admin ID マッピング ─────────────────────────────────
// Id: NocoDB staff_identify の Id カラム
// intercom_admin_id: Intercom 管理画面で確認した Admin ID
// 確認方法: Intercom → Settings → Teammates → 各メンバーの ID
const MAPPING = [
  { Id: 1,  name2: 'Utty',           name: '大内諒大',     intercom_admin_id: '1322308' },
  { Id: 2,  name2: 'BB',             name: '馬場健斗',     intercom_admin_id: '7676696' },
  { Id: 3,  name2: 'Dong',           name: '伊東歩未',     intercom_admin_id: '6783246' },
  { Id: 4,  name2: 'Eri Kitada',     name: '北田恵里',     intercom_admin_id: '2701977' },
  { Id: 5,  name2: 'Paul',           name: '永井慎一',     intercom_admin_id: '7557090' },
  { Id: 6,  name2: 'Chi',            name: '遅骋',          intercom_admin_id: '7818711' },
  { Id: 7,  name2: 'Goro kasahara', name: '笠原五郎',     intercom_admin_id: '7250969' },
  { Id: 8,  name2: 'Kubotie',        name: '窪田知昭',     intercom_admin_id: '1014435' },
  // ── 必要に応じて追加 ──────────────────────────────────────────────────────
  // { Id: X, name2: '...', name: '...', intercom_admin_id: '...' },
];

// ─── 列が追加されているか確認 ────────────────────────────────────────────────

const checkRes = await fetch(
  `${BASE}/api/v2/tables/${TABLE_ID}/records?limit=1`,
  { headers: { 'xc-token': TOKEN } },
);
const checkData = await checkRes.json();
const sampleRecord = checkData.list?.[0];

if (!sampleRecord) {
  console.error('レコードが取得できませんでした');
  process.exit(1);
}

if (!Object.prototype.hasOwnProperty.call(sampleRecord, 'intercom_admin_id')) {
  console.error('❌ intercom_admin_id 列が存在しません。');
  console.error('   NocoDB UI で staff_identify テーブルに intercom_admin_id 列（Text型）を追加してから再実行してください。');
  process.exit(1);
}

console.log('✅ intercom_admin_id 列を確認しました。書き込みを開始します...\n');

// ─── 一括更新 ────────────────────────────────────────────────────────────────

let successCount = 0;
let errorCount   = 0;

for (const entry of MAPPING) {
  const res = await fetch(`${BASE}/api/v2/tables/${TABLE_ID}/records`, {
    method:  'PATCH',
    headers: { 'xc-token': TOKEN, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ Id: entry.Id, intercom_admin_id: entry.intercom_admin_id }),
  });

  if (res.ok) {
    console.log(`  ✅ [Id=${entry.Id}] ${entry.name2} (${entry.name}) → admin_id: ${entry.intercom_admin_id}`);
    successCount++;
  } else {
    const errBody = await res.text().catch(() => '');
    console.error(`  ❌ [Id=${entry.Id}] ${entry.name2} → エラー: ${res.status} ${errBody}`);
    errorCount++;
  }
}

console.log(`\n完了: 成功 ${successCount}件 / エラー ${errorCount}件`);
if (errorCount > 0) process.exit(1);
