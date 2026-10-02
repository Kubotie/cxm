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
  assert.ok(w.includes("Name LIKE '%PtAI%'"), w);
  assert.ok(w.includes("Name LIKE '%Ptengine AI%'"), w);
  assert.ok(w.includes("Name LIKE '%PtengineAI%'"), w);
  assert.ok(!w.includes('Description'), '説明欄は条件に入れない');
});

test('SOQL に引用符を壊す文字が入っていない', () => {
  assert.ok(!ptaiNameFilter().includes("\\'"));
  for (const p of PTAI_NAME_PATTERNS) assert.ok(!p.includes("'"), p);
});

// ── イレギュラーの取り込み（2026-10-01）────────────────────────────────────

test('名前の規則に合わなくても、一覧にある商談は PtAI として扱う', async () => {
  const { isPtaiOpportunity, PTAI_OPPORTUNITY_ALLOWLIST } =
    await import('../src/lib/ptai/salesforce/schema.ts');
  const id = PTAI_OPPORTUNITY_ALLOWLIST[0];
  assert.ok(id, '一覧が空');
  assert.equal(isPtaiOpportunity('【更新】_某社_20260918', id), true);
  assert.equal(isPtaiOpportunityName('【更新】_某社_20260918'), false, '名前では拾えない');
});

test('一覧に無い商談は Id を渡しても拾わない', async () => {
  const { isPtaiOpportunity } = await import('../src/lib/ptai/salesforce/schema.ts');
  assert.equal(isPtaiOpportunity('関係ない商談', '006000000000000AAA'), false);
  assert.equal(isPtaiOpportunity('関係ない商談', null), false);
  assert.equal(isPtaiOpportunity('関係ない商談'), false);
});

test('SOQL にイレギュラーの Id が入る', () => {
  const w = ptaiNameFilter();
  assert.ok(w.includes("Id IN ('006Q900001xHFUnIAO')"), w);
  assert.ok(w.startsWith("Name LIKE '%PtAI%'"), '名前の条件が先');
});

test('Salesforce の Id は 18 桁（URL に出る形）で持つ', async () => {
  const { PTAI_OPPORTUNITY_ALLOWLIST } = await import('../src/lib/ptai/salesforce/schema.ts');
  for (const id of PTAI_OPPORTUNITY_ALLOWLIST) {
    assert.match(id, /^006[A-Za-z0-9]{15}$/, `${id} が Opportunity の 18 桁 Id ではない`);
  }
});

// ── Salesforce へ書き戻す 3 項目（2026-10-02）────────────────────────────────
//
// 金額・フェーズ・日付を**間違って送らない**ことが肝心なので、
// 送れる項目をここで固定しておく。

test('書き戻せるのは 障壁・ニーズ・ネクストアクション の 3 つだけ', async () => {
  const { SF_EDITABLE, SF_EDITABLE_KEYS } = await import('../src/lib/ptai/salesforce/schema.ts');
  assert.deepEqual([...SF_EDITABLE_KEYS].sort(), ['barrier', 'need', 'nextAction']);
  assert.equal(SF_EDITABLE.barrier.field,    'Issue_to_closewon__c');
  assert.equal(SF_EDITABLE.need.field,       'Indentify_Pain_Needs__c');
  assert.equal(SF_EDITABLE.nextAction.field, 'Next_Action__c');
});

test('金額・フェーズ・日付は送らない', async () => {
  const { toSfPatch } = await import('../src/lib/ptai/salesforce/schema.ts');
  const { patch } = toSfPatch({ barrier: 'あ', need: null,
    // @ts-expect-error 渡しても無視されることを確かめる
    Amount: 100, StageName: 'Won', CloseDate: '2026-12-31' } as never);
  assert.deepEqual(Object.keys(patch).sort(), ['Indentify_Pain_Needs__c', 'Issue_to_closewon__c']);
});

test('渡さなかった項目は patch に入らない（空で上書きしない）', async () => {
  const { toSfPatch } = await import('../src/lib/ptai/salesforce/schema.ts');
  const { patch } = toSfPatch({ barrier: 'あ' });
  assert.deepEqual(Object.keys(patch), ['Issue_to_closewon__c']);
});

test('空文字は null で送る（消したいときは消せる）', async () => {
  const { toSfPatch } = await import('../src/lib/ptai/salesforce/schema.ts');
  assert.equal(toSfPatch({ need: '' }).patch.Indentify_Pain_Needs__c, null);
  assert.equal(toSfPatch({ need: '   ' }).patch.Indentify_Pain_Needs__c, null);
});

test('上限を超えたら切って、切った項目を返す', async () => {
  const { toSfPatch, SF_EDITABLE } = await import('../src/lib/ptai/salesforce/schema.ts');
  // 導入障壁は 255 文字（2026-10-02 実測）
  const { patch, truncated } = toSfPatch({ barrier: 'あ'.repeat(300) });
  assert.equal(String(patch.Issue_to_closewon__c).length, SF_EDITABLE.barrier.max);
  assert.deepEqual(truncated, ['barrier']);
});

test('上限ちょうどは切らない', async () => {
  const { toSfPatch, SF_EDITABLE } = await import('../src/lib/ptai/salesforce/schema.ts');
  const { truncated } = toSfPatch({ need: 'あ'.repeat(SF_EDITABLE.need.max) });
  assert.deepEqual(truncated, []);
});

test('読み取る項目に書き戻す 3 項目が入っている（入れ忘れると取り込めない）', async () => {
  const { SF_OPPORTUNITY_FIELDS, SF_EDITABLE, SF_EDITABLE_KEYS } =
    await import('../src/lib/ptai/salesforce/schema.ts');
  for (const k of SF_EDITABLE_KEYS) {
    assert.ok((SF_OPPORTUNITY_FIELDS as readonly string[]).includes(SF_EDITABLE[k].field),
      `${SF_EDITABLE[k].field} が SELECT に無い`);
  }
});
