// ─── PtAI: 操作者・担当者の名寄せ（staff.ts）────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     --test scripts/ptai-staff.test.mts
//
// ネットワークは使わない。別名表と createdBy の組み立てだけを見る。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAFF_NAME2_TO_PTAI, PTAI_NAME2_TO_STAFF,
  toPtaiName2, toStaffName2, createdByPayload, type ActorStamp,
} from '../src/lib/ptai/staff.ts';
import { OWNER_FROM_NOTION } from '../src/lib/ptai/notion/schema.ts';

// ── 別名表 ──────────────────────────────────────────────────────────────────

test('staff_identify の表記をダッシュボード表記に寄せる', () => {
  assert.equal(toPtaiName2('Eri Kitada'), 'Eri');
  assert.equal(toPtaiName2('BB'),         'Baba');
  assert.equal(toPtaiName2('Omori Aoi'),  'Ava');
});

test('別名が無い人はそのまま', () => {
  for (const n of ['Kubotie', 'Utty', 'Paul']) assert.equal(toPtaiName2(n), n);
});

test('前後の空白を落とす', () => {
  assert.equal(toPtaiName2('  Eri Kitada  '), 'Eri');
  assert.equal(toStaffName2('  Baba  '), 'BB');
});

test('空文字は空文字のまま（null を作らない）', () => {
  assert.equal(toPtaiName2(''), '');
  assert.equal(toStaffName2(undefined as unknown as string), '');
});

test('逆引きは往復する', () => {
  for (const [staff, ptai] of Object.entries(STAFF_NAME2_TO_PTAI)) {
    assert.equal(toStaffName2(ptai), staff, `${ptai} → ${staff}`);
    assert.equal(toPtaiName2(staff), ptai, `${staff} → ${ptai}`);
  }
  assert.equal(Object.keys(PTAI_NAME2_TO_STAFF).length, Object.keys(STAFF_NAME2_TO_PTAI).length,
    '別名表に重複した行き先がある');
});

test('Notion の担当3 の対応表と矛盾しない', () => {
  // OWNER_FROM_NOTION は Notion 表記 → ダッシュボード表記。
  // staff_identify 表記と綴りが同じ行は、両方の表で同じ答えにならないといけない。
  for (const [notion, dash] of Object.entries(OWNER_FROM_NOTION)) {
    if (!(notion in STAFF_NAME2_TO_PTAI)) continue;
    assert.equal(STAFF_NAME2_TO_PTAI[notion], dash,
      `${notion} の行き先が Notion 側(${dash}) と staff 側(${STAFF_NAME2_TO_PTAI[notion]}) で食い違う`);
  }
});

// ── createdBy の組み立て ────────────────────────────────────────────────────
//
// Twenty の実測（2026-10-01）:
//   createdBy は作成時に明示できる。workspaceMemberId も効く。
//   updatedBy は明示しても API キー名で上書きされる → 送らない。

test('Twenty に席がある人は本人レコードへ紐付ける', () => {
  const a: ActorStamp = { name2: 'Kubotie', displayName: '久保田 千明', workspaceMemberId: 'wm-1' };
  assert.deepEqual(createdByPayload(a), {
    source: 'MANUAL', name: '久保田 千明', workspaceMemberId: 'wm-1',
  });
});

test('Twenty に席が無い人は名前だけ。偽の workspaceMemberId を作らない', () => {
  const a: ActorStamp = { name2: 'Baba', displayName: 'Baba', workspaceMemberId: null };
  const p = createdByPayload(a);
  assert.deepEqual(p, { source: 'API', name: 'Baba' });
  assert.ok(!('workspaceMemberId' in p));
});

test('表示名が無ければ name2 を使う', () => {
  assert.equal(createdByPayload({ name2: 'Utty', displayName: '', workspaceMemberId: null }).name, 'Utty');
});

test('updatedBy は組み立てない（Twenty が上書きするため）', () => {
  const p = createdByPayload({ name2: 'Kubotie', displayName: 'K', workspaceMemberId: 'wm-1' });
  assert.ok(!('updatedBy' in p), 'updatedBy を送ると誤解のもとになる');
});
