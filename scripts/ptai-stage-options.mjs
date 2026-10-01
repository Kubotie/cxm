#!/usr/bin/env node
// ─── フェーズの選択肢を Salesforce のものへ入れ替える ───────────────────────
//
//   node scripts/ptai-stage-options.mjs            現状を表示
//   node scripts/ptai-stage-options.mjs --apply    更新
//
// twenty-test-schema.mjs は**フィールドを作るときにしか選択肢を入れない**ので、
// 既にあるフィールドの選択肢はここで PATCH する（2026-09-30 に FAVORABLE で踏んだ）。
//
// 旧キー（NOT_STARTED ほか）は読み込み時に読み替えるが、**保存済みレコードが
// まだ旧キーを持っている間は選択肢から消せない**。新しい値を足すだけにして、
// データ移行が済んでから別途そぎ落とす。

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
const KEY  = (process.env.TWENTY_API_KEY || '').trim();
const BASE = (process.env.TWENTY_API_URL || 'https://crm.ptengine.com').replace(/\/+$/, '');
if (!KEY) { console.error('TWENTY_API_KEY が未設定です'); process.exit(1); }

const NEW = [
  ['INACTIVE', 'Inactive', 'gray'], ['ACTIVE', 'Active', 'blue'],
  ['GOAL_SHARED', 'Goal Shared', 'blue'], ['QUALIFIED_CHAMPION', 'Qualified Champion', 'blue'],
  ['EVALUATING', 'Evaluating', 'blue'], ['PROBABLE', 'Probable', 'blue'],
  ['VERBAL', 'Verbal', 'purple'], ['WON', 'Won', 'green'],
  ['CLOSED_WON', '受注 (Closed Won)', 'green'], ['ADMIN_CLOSE', 'Admin Close', 'gray'],
  ['CLOSED_LOST', 'Close Lost', 'red'],
];
/** フェーズの選択肢を持つフィールド */
const TARGETS = [
  ['testOpportunity', 'stage'], ['testOpportunity', 'pendingStage'],
  ['testAction', 'stageAtDone'],
  ['testActivity', 'fromStage'], ['testActivity', 'toStage'],
];

const api = async (method, path, body) => {
  const r = await fetch(BASE + path, {
    method, headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};

const meta = await api('GET', '/rest/metadata/objects?limit=100');
const objects = meta.data ?? [];
let changed = 0;

for (const [objName, fieldName] of TARGETS) {
  const obj = objects.find(o => o.nameSingular === objName);
  const field = (obj?.fields ?? []).find(f => f.name === fieldName);
  if (!field) { console.log(`  ✗ ${objName}.${fieldName} が無い`); continue; }

  const have = new Set((field.options ?? []).map(o => o.value));
  const missing = NEW.filter(([v]) => !have.has(v));
  console.log(`  ${objName}.${fieldName.padEnd(14)} 既存 ${have.size} / 不足 ${missing.length}`);
  if (!missing.length || !apply) continue;

  // 既存の選択肢は消さない（保存済みレコードが旧キーを持っている）
  const options = [
    ...(field.options ?? []).map((o, i) => ({ value: o.value, label: o.label, color: o.color || 'gray', position: i })),
    ...missing.map(([value, label, color], i) => ({ value, label, color, position: (field.options?.length ?? 0) + i })),
  ];
  await api('PATCH', `/rest/metadata/fields/${field.id}`, { options });
  changed++;
}

console.log(apply ? `\n更新 ${changed} フィールド` : '\n更新するには --apply');
