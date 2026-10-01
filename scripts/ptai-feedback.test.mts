// ─── フィードバックの種別・状態（schema.ts）─────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     --test scripts/ptai-feedback.test.mts
//
// ネットワークは使わない。
// 定期報告（平日 9〜21 時）が「未処理」として拾う範囲を固定しておく。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TEST_OBJECTS,
  FEEDBACK_KIND, FEEDBACK_KIND_JP,
  FEEDBACK_STATUS, FEEDBACK_STATUS_JP, FEEDBACK_OPEN,
} from '../src/lib/ptai/twenty-test/schema.ts';

test('Twenty 側の名前が決め打ちできている', () => {
  assert.equal(TEST_OBJECTS.feedback.singular, 'testFeedback');
  assert.equal(TEST_OBJECTS.feedback.plural, 'testFeedbacks');
});

test('種別はすべて日本語訳がある', () => {
  for (const k of FEEDBACK_KIND) assert.ok(FEEDBACK_KIND_JP[k], k);
  assert.equal(Object.keys(FEEDBACK_KIND_JP).length, FEEDBACK_KIND.length);
});

test('状態はすべて日本語訳がある', () => {
  for (const s of FEEDBACK_STATUS) assert.ok(FEEDBACK_STATUS_JP[s], s);
  assert.equal(Object.keys(FEEDBACK_STATUS_JP).length, FEEDBACK_STATUS.length);
});

test('Twenty の SELECT に入れられる形（大文字・英数字と _ だけ）', () => {
  for (const v of [...FEEDBACK_KIND, ...FEEDBACK_STATUS]) assert.match(v, /^[A-Z][A-Z0-9_]*$/);
});

test('未処理は NEW / TRIAGED / DEFERRED の 3 つ', () => {
  // 定期報告はこの集合を「残っているもの」として読み上げる。
  // 解決・取り下げを足すと毎回ぶり返すので、ここを増やすときは報告側も見ること。
  assert.deepEqual([...FEEDBACK_OPEN].sort(), ['DEFERRED', 'NEW', 'TRIAGED']);
  assert.equal(FEEDBACK_OPEN.has('RESOLVED'), false);
  assert.equal(FEEDBACK_OPEN.has('DISMISSED'), false);
});

test('新規は必ず NEW から始まる', () => {
  assert.equal(FEEDBACK_STATUS[0], 'NEW');
  assert.equal(FEEDBACK_OPEN.has('NEW'), true);
});
