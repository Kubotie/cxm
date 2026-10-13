// ─── ダッシュボードの数字（kpi.ts）────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     --test scripts/ptai-kpi.test.mts
//
// ネットワークは使わない。**画面（board.js）と同じ式であること**を固定する。
// 2026-10-13 に実データで突き合わせ済み（126社・69商談）:
//   計画 5,470万(110社)／期待値 208万／期限超過 8件／確定 71万(1社)／
//   コミット 111万(2社)／チャレンジ 692万(13社)／パイプライン 2,511万(45社)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeKpis, m2, m3, wonAmt, atLeast, rung, planOf, share, FORECAST, AI_MIN,
  type KpiCompany,
} from '../src/lib/ptai/kpi.ts';
import { withDeltas, todayJst, toPoint } from '../src/lib/ptai/kpi-snapshot.ts';

const co = (p: Partial<KpiCompany> = {}): KpiCompany =>
  ({ cid: 'c1', owners: ['Paul'], curMrr: 0, baseMrr: 0, aim: 0, deals: [], ...p });
const deal = (stage: string, addMrr: number, extra = {}) => ({ stage, addMrr, ...extra });

test('②（商談）追加MRR は失注と管理クローズを除いた合計', () => {
  const c = co({ deals: [deal('EVALUATING', 100), deal('CLOSED_LOST', 500), deal('ADMIN_CLOSE', 700), deal('WON', 50)] });
  assert.equal(m2(c), 150);
});

test('③（見込）追加MRR は商談ごとに係数をかける。Verbal は 90%', () => {
  assert.equal(FORECAST.VERBAL, .90);
  const c = co({ deals: [deal('GOAL_SHARED', 100), deal('EVALUATING', 100), deal('VERBAL', 100)] });
  assert.equal(m3(c), 30 + 70 + 90);
});

test('確定は WON と CLOSED_WON の両方', () => {
  assert.equal(wonAmt(co({ deals: [deal('WON', 10), deal('CLOSED_WON', 20), deal('VERBAL', 40)] })), 30);
});

test('atLeast はそのフェーズ以上だけ。ADMIN_CLOSE / CLOSED_LOST は並びに入らない', () => {
  const c = co({ deals: [
    deal('QUALIFIED_CHAMPION', 1), deal('EVALUATING', 2), deal('PROBABLE', 4),
    deal('VERBAL', 8), deal('WON', 16), deal('CLOSED_LOST', 32), deal('ADMIN_CLOSE', 64),
  ] });
  assert.equal(atLeast(c, 'PROBABLE'), 4 + 8 + 16);
  assert.equal(atLeast(c, 'QUALIFIED_CHAMPION'), 1 + 2 + 4 + 8 + 16);
});

test('積み上げは合算MRR。期初MRR は会社ごとに 1 回だけ足す', () => {
  const c = co({ baseMrr: 1000, deals: [deal('PROBABLE', 10), deal('PROBABLE', 20)] });
  assert.equal(rung(c, atLeast(c, 'PROBABLE')), 1030);   // 1000 を 2 回足さない
  assert.equal(rung(c, 0), 0);                           // 対象の商談が無い会社は入らない
});

test('計画は ① と受注額の大きい方。10万円未満は入らない', () => {
  assert.equal(planOf(co({ baseMrr: 500, aim: AI_MIN - 1 })), null);
  assert.deepEqual(planOf(co({ baseMrr: 500, aim: 200_000 })), { base: 500, add: 200_000 });
  assert.deepEqual(
    planOf(co({ baseMrr: 500, aim: 200_000, deals: [deal('WON', 300_000)] })),
    { base: 500, add: 300_000 });
});

test('共同担当は均等按分。全員ぶん足すとチーム全体と一致する', () => {
  const cos = [
    co({ cid: 'a', owners: ['Paul', 'Eri'], baseMrr: 100, aim: 1_000_000 }),
    co({ cid: 'b', owners: ['Eri'], baseMrr: 200, deals: [deal('PROBABLE', 500_000)] }),
  ];
  assert.equal(share(cos[0], 'Paul'), .5);
  assert.equal(share(cos[0], 'Ava'), 0);

  const opt = { targetMrr: 0, today: '2026-10-13' };
  const team = computeKpis(cos, { ...opt, scope: 'team' });
  const each = ['Paul', 'Eri'].map(m => computeKpis(cos, { ...opt, scope: m }));
  assert.equal(team.plan, each.reduce((s, r) => s + r.plan, 0));
  assert.equal(team.expected, each.reduce((s, r) => s + r.expected, 0));
  assert.equal(team.commit, each.reduce((s, r) => s + r.commit, 0));
  // 社数は按分しない（担当が 2 人いても 1 社）
  assert.equal(team.planCompanies, 1);
  assert.equal(each[0].planCompanies, 1);
});

test('期限超過は CLOSED_WON / CLOSED_LOST だけ除く。WON は数える', () => {
  const t = '2026-10-13';
  const cos = [co({ deals: [
    deal('WON',         1, { na: 'あ', naDate: '2026-10-12' }),   // 数える
    deal('CLOSED_WON',  1, { na: 'い', naDate: '2026-10-12' }),   // 除く
    deal('CLOSED_LOST', 1, { na: 'う', naDate: '2026-10-12' }),   // 除く
    deal('ADMIN_CLOSE', 1, { na: 'え', naDate: '2026-10-12' }),   // 数える
    deal('EVALUATING',  1, { na: 'お', naDate: t }),              // 当日は超過でない
    deal('EVALUATING',  1, { na: '',   naDate: '2026-01-01' }),   // 本文が無いので数えない
  ] })];
  assert.equal(computeKpis(cos, { targetMrr: 0, today: t }).overdue, 2);
});

test('確定 ≦ コミット ≦ チャレンジ ≦ パイプライン', () => {
  const cos = [co({ baseMrr: 1_000_000, deals: [
    deal('QUALIFIED_CHAMPION', 100_000), deal('PROBABLE', 200_000), deal('WON', 300_000),
  ] })];
  const r = computeKpis(cos, { targetMrr: 0, today: '2026-10-13' });
  assert.ok(r.won <= r.commit && r.commit <= r.challenge && r.challenge <= r.pipeline);
});

test('差分は前の行との差。先頭は差分を持たない', () => {
  // listRecords が FIELD_ALIAS を逆引き済みなので、ここに来る鍵は `plan`
  // （Twenty の実名は planMrr）。commit は実名のまま commitMrr
  const base = toPoint({ snapshotDate: '2026-10-12', scope: 'team', plan: 100, commitMrr: 10 });
  const next = toPoint({ snapshotDate: '2026-10-13', scope: 'team', plan: 150, commitMrr: 4 });
  const out = withDeltas([base, next]);
  assert.deepEqual(out[0].delta, {});
  assert.equal(out[1].delta.plan, 50);
  assert.equal(out[1].delta.commit, -6);
});

test('スナップショットの日付は JST', () => {
  // UTC で 2026-10-12 23:00 は JST では 10-13
  assert.equal(todayJst(new Date('2026-10-12T23:00:00Z')), '2026-10-13');
  assert.equal(todayJst(new Date('2026-10-13T14:59:00Z')), '2026-10-13');
});

// ── 全データ書き出し（/api/ptai/export）────────────────────────────────────

test('フェーズは全部に表示名と社内の言い方の枠がある', async () => {
  const { STAGE_NOTE, INCLUDES, DEFAULT_INCLUDES } = await import('../src/lib/ptai/export.ts');
  const { STAGES, STAGE_JP } = await import('../src/lib/ptai/twenty-test/schema.ts');
  for (const s of STAGES) {
    assert.ok(STAGE_JP[s], `${s} の表示名が無い`);
    assert.ok(s in STAGE_NOTE, `${s} が STAGE_NOTE に無い`);
    assert.ok(s in FORECAST, `${s} が FORECAST に無い`);
  }
  // 既定は INCLUDES の部分集合。重いものを既定に入れない
  for (const i of DEFAULT_INCLUDES) assert.ok(INCLUDES.includes(i));
  assert.deepEqual(DEFAULT_INCLUDES, ['deals', 'kpi']);
});
