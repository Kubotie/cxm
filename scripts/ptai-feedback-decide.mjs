#!/usr/bin/env node
// ─── フィードバックに判断を書く ────────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-feedback-decide.mjs <id> <状態> "方針や結果"
//
//   状態: TRIAGED（方針を示した） / DEFERRED（保留） /
//         RESOLVED（直した） / DISMISSED（対応しない）
//
// 保留（DEFERRED）にしたものは、以降の定期報告でも毎回読み上げられる。
// 画面側の PATCH /api/ptai/feedback と同じことをするが、こちらは認証不要。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const [id, status, ...rest] = process.argv.slice(2);
const decision = rest.join(' ').trim();

const { updateRecord } = await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS, FEEDBACK_STATUS, FEEDBACK_STATUS_JP } =
  await import('../src/lib/ptai/twenty-test/schema.ts');

if (!id || !FEEDBACK_STATUS.includes(status)) {
  console.error(`使い方: <id> <${FEEDBACK_STATUS.join('|')}> "方針や結果"`);
  process.exit(1);
}

const now = new Date().toISOString();
const patch = { status, decidedAt: now, decidedBy: 'Claude' };
if (decision) patch.decision = decision;
if (status === 'RESOLVED' || status === 'DISMISSED') patch.resolvedAt = now;

await updateRecord(TEST_OBJECTS.feedback.plural, TEST_OBJECTS.feedback.singular, id, patch);
console.log(`${id} → ${FEEDBACK_STATUS_JP[status]}${decision ? `（${decision}）` : ''}`);
