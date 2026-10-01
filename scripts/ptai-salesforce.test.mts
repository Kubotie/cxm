// ─── PtAI × Salesforce の対応表（schema.ts）────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     --test scripts/ptai-salesforce.test.mts
//
// ネットワークは使わない。2026-10-01 に Salesforce から実測した設定を固定する。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SF_STAGES, sfStage, sfProbability, isSfWon, isSfLost, isSfClosed,
  isPtaiOpportunityName, ptaiNameFilter, PTAI_NAME_PATTERNS,
} from '../src/lib/ptai/salesforce/schema.ts';

// ── ステージ（Salesforce の設定そのもの）──────────────────────────────────

test('有効なステージは 12 個で、順番が飛んでいない', () => {
  assert.equal(SF_STAGES.length, 12);
  assert.deepEqual(SF_STAGES.map(s => s.order), [1,2,3,4,5,6,7,8,9,10,11,12]);
});

test('確率は Salesforce の DefaultProbability をそのまま使う', () => {
  assert.equal(sfProbability('Inactive'), 0);
  assert.equal(sfProbability('Goal Shared'), 10);
  assert.equal(sfProbability('POC'), 20);
  assert.equal(sfProbability('Qualified Champion'), 30);
  assert.equal(sfProbability('Evaluating'), 40);
  assert.equal(sfProbability('Probable'), 60);
  assert.equal(sfProbability('Verbal'), 90);
  assert.equal(sfProbability('Won'), 100);
});

test('確定（受注）は「受注 (Closed Won)」だけ。Won は含めない', () => {
  assert.equal(isSfWon('受注 (Closed Won)'), true);
  assert.equal(isSfWon('Won'), false, 'Won は 100% だが IsWon = false・未クローズ');
  assert.equal(SF_STAGES.filter(s => s.isWon).length, 1);
});

test('Won はまだ閉じていない', () => {
  assert.equal(isSfClosed('Won'), false);
  assert.equal(isSfClosed('受注 (Closed Won)'), true);
});

test('失注は Close Lost だけ。Admin Close は「閉じたが失注ではない」', () => {
  assert.equal(isSfLost('Close Lost'), true);
  assert.equal(isSfLost('Admin Close'), false);
  assert.equal(isSfClosed('Admin Close'), true, '閉じてはいる');
});

test('知らないステージは推定せず 0% / 未確定にする', () => {
  assert.equal(sfStage('なにか'), null);
  assert.equal(sfProbability('なにか'), 0);
  assert.equal(isSfWon('なにか'), false);
  assert.equal(isSfClosed('なにか'), false);
  assert.equal(sfProbability(null), 0);
});

// ── PtAI 商談の見分け ───────────────────────────────────────────────────────
// 2026-10-01 の運用決定: 商談名に PtAI / Ptengine AI / PtengineAI を入れる。
// 大文字小文字は区別しない。

test('3 つの表記すべてを拾う', () => {
  assert.equal(isPtaiOpportunityName('PtAI 導入'), true);
  assert.equal(isPtaiOpportunityName('Ptengine AI 拡販'), true);
  assert.equal(isPtaiOpportunityName('PtengineAI'), true);
});

test('大文字小文字を区別しない', () => {
  for (const n of ['ptai', 'PTAI', 'PtAi', 'ptengine ai', 'PTENGINEAI']) {
    assert.equal(isPtaiOpportunityName(n), true, n);
  }
});

test('関係ない商談は拾わない', () => {
  for (const n of ['Ptengine Insight 更新', 'AI 活用相談', '', 'Experience 追加']) {
    assert.equal(isPtaiOpportunityName(n), false, n);
  }
});

test('「Ptengine AI」は「PtAI」を含まないので、パターンは 3 つ要る', () => {
  // 1 つにまとめられないことを固定しておく（まとめると取りこぼす）
  assert.equal('Ptengine AI'.toLowerCase().includes('ptai'), false);
  assert.equal('PtengineAI'.toLowerCase().includes('ptai'), false);
  assert.equal(PTAI_NAME_PATTERNS.length, 3);
});

test('SOQL は Name だけを見る（説明欄は見ない）', () => {
  const w = ptaiNameFilter();
  assert.equal(w, "Name LIKE '%PtAI%' OR Name LIKE '%Ptengine AI%' OR Name LIKE '%PtengineAI%'");
  assert.ok(!w.includes('Description'));
});

test('SOQL に引用符を壊す文字が入っていない', () => {
  assert.ok(!ptaiNameFilter().includes("\\'"));
  for (const p of PTAI_NAME_PATTERNS) assert.ok(!p.includes("'"), p);
});
