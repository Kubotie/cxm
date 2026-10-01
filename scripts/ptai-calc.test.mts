// ─── §3 の計算ルールの単体テスト ────────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs --test scripts/ptai-calc.test.mts
//
// 出典: docs/ptai-dashboard-operation-flows.md §3
// 期待値は原本 board.js（Version 96）の挙動に合わせている。外部接続なし。

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const calc = await import(new URL('../src/lib/ptai/calc.ts', import.meta.url).href);

/** 円は原本も丸めていないので、比較は 1 円未満の誤差を許す */
const yen = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 1, msg ?? `${actual} ≠ ${expected}`);

const co = (over: Record<string, unknown> = {}) => ({
  mrr: 500_000, stage: 'PROBABLE', addMrr: 300_000, owners: ['Paul'], ...over,
}) as any;

describe('金額（§3）', () => {
  test('合算MRR ＝ 現在MRR ＋ 追加MRR', () => {
    assert.equal(calc.totalMrr(co()), 800_000);
    assert.equal(calc.totalMrr(co({ addMrr: 0 })), 500_000);
  });

  test('足切り: 追加MRR が 10 万未満なら期待値も商談中も 0', () => {
    const small = co({ addMrr: 99_999 });
    assert.equal(calc.expectedMrr(small), 0);
    assert.equal(calc.inDealMrr(small), 0);
    // ちょうど 10 万は通る
    assert.ok(calc.expectedMrr(co({ addMrr: 100_000 })) > 0);
  });

  test('期待値MRR ＝ **合算MRR** × フェーズの確率（原本に合わせる）', () => {
    // Probable は 60%（Salesforce の DefaultProbability）。(500,000 + 300,000) × 0.60
    yen(calc.expectedMrr(co()), 480_000);
    // 仕様書 §3 の「現在MRR × 確率」だと 300,000 になる。そちらではない
    assert.ok(Math.abs(calc.expectedMrr(co()) - 300_000) > 1);
  });

  test('商談が複数なら 現在MRR×代表確率 ＋ 商談ごとの期待値', () => {
    const c = co({
      addMrr: 500_000, stage: 'EVALUATING',
      deals: [
        { stage: 'EVALUATING', addMrr: 200_000 },        // 0.40 → 80,000
        { stage: 'VERBAL', addMrr: 300_000 },            // 0.90 → 270,000
      ],
    });
    // 代表フェーズは Evaluating。500,000 × 0.40 ＝ 200,000 ＋ 80,000 ＋ 270,000
    yen(calc.expectedMrr(c), 550_000);
  });

  test('失注の商談は期待値に入れない', () => {
    assert.equal(calc.dealExpected({ stage: 'CLOSED_LOST', addMrr: 1_000_000 } as any), 0);
  });

  test('確定MRR は契約締結済みのみ。足切りも効く', () => {
    assert.equal(calc.wonMrr(co({ stage: 'CLOSED_WON' })), 800_000);
    assert.equal(calc.wonMrr(co({ stage: 'PROBABLE' })), 0, '契約前を数えている');
    assert.equal(calc.wonMrr(co({ stage: 'CLOSED_WON', addMrr: 50_000 })), 0, '足切りが効いていない');
  });

  test('**Won も確定に含める**（2026-10-01 Kubotie。従来の「申込用紙回収済み」に当たる）', () => {
    assert.equal(calc.wonMrr(co({ stage: 'WON' })), 800_000);
    assert.equal(calc.wonMrr(co({ stage: 'VERBAL' })), 0, 'Verbal はまだ確定でない');
    // Won は Salesforce 上は IsWon = false・未クローズだが、確率 100%・Commit
    assert.deepEqual([...calc.WON_STAGES].sort(), ['CLOSED_WON', 'WON']);
  });

  test('確定に入れた申込用紙回収済みは、商談中から外す（二重計上を防ぐ）', () => {
    const c = co({ stage: 'WON' });
    assert.ok(calc.wonMrr(c) > 0);
    assert.equal(calc.inDealMrr(c), 0, '確定と商談中の両方に出てしまっている');
    assert.equal(calc.stackBucket(c), 'won');
  });

  test('Won の確率は Salesforce どおり 100%', () => {
    // Salesforce の DefaultProbability が 100%。確定にも入れる
    yen(calc.expectedMrr(co({ stage: 'WON' })), 800_000 * 1);
    yen(calc.expectedMrr(co({ stage: 'CLOSED_WON' })), 800_000);
  });

  test('商談が複数のとき、確定した商談の追加MRR だけ足す（申込用紙回収済みも確定）', () => {
    const c = co({
      stage: 'CLOSED_WON', addMrr: 600_000,
      deals: [
        { stage: 'CLOSED_WON',  addMrr: 300_000 },
        { stage: 'WON', addMrr: 100_000 },   // これも確定
        { stage: 'PROBABLE',       addMrr: 200_000 },
      ],
    });
    assert.equal(calc.wonAddMrr(c), 400_000);
    assert.equal(calc.wonMrr(c), 900_000, '現在MRR ＋ 確定ぶん');
  });

  test('商談中は 初回アポ実施済み〜口頭合意獲得済み', () => {
    for (const s of ['ACTIVE', 'EVALUATING', 'PROBABLE', 'VERBAL'])
      assert.ok(calc.isInDeal(co({ stage: s })), `${s} が商談中でない`);
    for (const s of ['INACTIVE', 'WON', 'CLOSED_WON', 'CLOSED_LOST'])
      assert.ok(!calc.isInDeal(co({ stage: s })), `${s} を商談中にしている`);
  });
});

describe('担当の持分と積み上げ（§3）', () => {
  test('共同担当は均等割', () => {
    const c = co({ owners: ['Paul', 'Baba'] });
    assert.equal(calc.shareOf(c, 'Paul'), 0.5);
    assert.equal(calc.shareOf(c, 'Eri'), 0);
  });

  test('積み上げは 見込 と 目標 の大きいほう', () => {
    assert.equal(calc.stackedMrr(co({ addMrr: 300_000, aimMrr: 800_000 })), 1_300_000);
    assert.equal(calc.stackedMrr(co({ addMrr: 900_000, aimMrr: 200_000 })), 1_400_000);
  });

  test('積み上げも足切りを通す', () => {
    assert.equal(calc.stackedMrr(co({ addMrr: 0, aimMrr: 50_000 })), 0);
  });

  test('メンバーを指定すると持分で按分', () => {
    const c = co({ owners: ['Paul', 'Baba'], addMrr: 300_000, aimMrr: 0 });
    assert.equal(calc.stackedMrr(c, 'Paul'), 400_000);
  });

  test('内訳は 確定 → 商談中 → 狙い の順に 1 つだけ', () => {
    assert.equal(calc.stackBucket(co({ stage: 'CLOSED_WON' })), 'won');
    assert.equal(calc.stackBucket(co({ stage: 'PROBABLE' })), 'inDeal');
    assert.equal(calc.stackBucket(co({ stage: 'INACTIVE', addMrr: 0, aimMrr: 500_000 })), 'aim');
    assert.equal(calc.stackBucket(co({ stage: 'INACTIVE', addMrr: 0, aimMrr: 0 })), 'none');
  });
});

describe('到達予定の逆算（§3・F-06）', () => {
  test('申込完了日から 49 / 35 / 10 日前', () => {
    // 2026-12-01（火）を基準
    const r = calc.backcastMilestones({ applyDate: '2026-12-01', msBase: 'apply' });
    assert.equal(r.VERBAL_COMMIT, '2026-11-20', '10 日前（金）');
    assert.equal(r.QUOTE, '2026-10-27');
    assert.equal(r.TRIAL, '2026-10-13');
  });

  test('課金開始日を基準にすると 14 日引いてから逆算', () => {
    const apply = calc.backcastMilestones({ applyDate: '2026-12-01', msBase: 'apply' });
    const bill  = calc.backcastMilestones({ billingDate: '2026-12-15', msBase: 'bill' });
    assert.deepEqual(bill, apply, '課金開始日 −14 日 ＝ 申込完了日 と同じ結果になるはず');
  });

  test('土日に当たったら金曜へ寄せる', () => {
    const r = calc.backcastMilestones({ applyDate: '2026-12-01', msBase: 'apply' });
    for (const [k, v] of Object.entries(r)) {
      if (!v) continue;
      const d = new Date(v as string);
      assert.ok(d.getDay() !== 0 && d.getDay() !== 6, `${k} が土日（${v}）`);
    }
  });

  test('基準日が無ければ空', () => {
    assert.deepEqual(calc.backcastMilestones({ msBase: 'apply' }),
      { TRIAL: null, QUOTE: null, VERBAL_COMMIT: null });
  });
});

describe('遅れと期限（§3）', () => {
  const today = new Date(2026, 10, 1);   // 2026-11-01

  test('予定を過ぎて未到達なら遅れ', () => {
    const r = calc.lateMilestone('ACTIVE', { TRIAL: '2026-10-13', QUOTE: '2026-10-27' }, today);
    assert.ok(r);
    assert.equal(r!.stage, 'EVALUATING', '最も古い遅れを返す');
    assert.equal(r!.days, 19);
  });

  test('すでに到達しているフェーズは遅れにしない', () => {
    const r = calc.lateMilestone('PROBABLE', { TRIAL: '2026-10-13', QUOTE: '2026-10-27' }, today);
    assert.equal(r, null);
  });

  test('受注・失注は遅れの対象外', () => {
    assert.equal(calc.lateMilestone('CLOSED_WON', { TRIAL: '2026-01-01' }, today), null);
    assert.equal(calc.lateMilestone('CLOSED_LOST', { TRIAL: '2026-01-01' }, today), null);
  });

  test('期日の状態', () => {
    assert.equal(calc.dueState('2026-10-31', today), 'overdue');
    assert.equal(calc.dueState('2026-11-01', today), 'this_week');
    assert.equal(calc.dueState('2026-11-08', today), 'this_week');
    assert.equal(calc.dueState('2026-11-09', today), 'later');
    assert.equal(calc.dueState(null, today), 'none');
  });
});

describe('KPI の集計', () => {
  const companies = [
    co({ mrr: 500_000, addMrr: 300_000, stage: 'CLOSED_WON', owners: ['Paul'] }),
    co({ mrr: 400_000, addMrr: 200_000, stage: 'PROBABLE',      owners: ['Paul', 'Baba'] }),
    co({ mrr: 300_000, addMrr: 50_000,  stage: 'EVALUATING',      owners: ['Baba'] }),   // 足切り
  ];

  test('チーム全体', () => {
    const k = calc.kpis(companies);
    assert.equal(k.won, 800_000);
    assert.equal(k.wonCount, 1);
    assert.equal(k.inDeal, 600_000, '足切りされた 1 社は入らない');
    assert.equal(k.inDealCount, 1);
    yen(k.expected, 800_000 + 600_000 * 0.60);
  });

  test('メンバー別は持分で按分する', () => {
    const k = calc.kpis(companies, 'Paul');
    assert.equal(k.won, 800_000, '単独担当はそのまま');
    assert.equal(k.inDeal, 300_000, '共同担当は半分');
  });

  test('担当でない会社は数えない', () => {
    const k = calc.kpis(companies, 'Eri');
    assert.equal(k.won, 0);
    assert.equal(k.inDeal, 0);
  });
});
