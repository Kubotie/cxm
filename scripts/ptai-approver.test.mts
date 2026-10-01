// ─── 承認者ロールと保存ガードの単体テスト ──────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs --test scripts/ptai-approver.test.mts
//
// 出典: docs/ptai-dashboard-operation-flows.md §4-2・§9-7
// 外部接続はしない。

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = new URL('../src/lib/ptai/', import.meta.url).href;
const load = async (f: string) => import(`${ROOT}${f}?t=${Math.random()}`);

describe('承認者ロール（§9-7）', () => {
  beforeEach(() => {
    delete process.env.PGA_APPROVER_NAME2;
    delete process.env.PGA_APPROVER_EMAILS;
  });

  test('既定は Utty と Kubotie の 2 人', async () => {
    const m = await load('approver-policy.ts');
    assert.deepEqual([...m.DEFAULT_APPROVER_NAME2], ['Utty', 'Kubotie']);
    assert.equal(m.isApprover('Utty', null), true);
    assert.equal(m.isApprover('Kubotie', null), true);
    assert.equal(m.isApprover('BB', null), false);
    assert.equal(m.isApprover('', null), false);
    assert.equal(m.isApprover(null, null), false);
  });

  test('PGA_APPROVER_NAME2 で差し替えられる', async () => {
    process.env.PGA_APPROVER_NAME2 = 'Paul, Eri';
    const m = await load('approver-policy.ts');
    assert.equal(m.isApprover('Paul', null), true);
    assert.equal(m.isApprover('Eri', null), true);
    assert.equal(m.isApprover('Utty', null), false, '差し替えたら既定は効かない');
  });

  test('メール指定があればそちらを優先する', async () => {
    process.env.PGA_APPROVER_EMAILS = 'a@example.com';
    const m = await load('approver-policy.ts');
    assert.equal(m.isApprover('Utty', null), false, 'メール指定時は name2 で通さない');
    assert.equal(m.isApprover('だれか', 'A@Example.com'), true, '大文字小文字は無視する');
  });
});

describe('保存ガード（§4-2）', () => {
  const doc = (phase: string | null, deals: Array<[string, string | null]> = []) => ({
    opp: phase === null ? {} : { phase },
    deals: deals.map(([key, p]) => ({ key, phase: p })),
  });

  test('承認者は何でも通る', async () => {
    const g = await load('edit-guard.ts');
    assert.equal(g.assertStageChangeAllowed(doc('QUOTE'), doc('CLOSED_WON'), true).ok, true);
    assert.equal(g.assertStageChangeAllowed(doc('CLOSED_WON'), doc('QUOTE'), true).ok, true);
  });

  test('承認者以外は「契約締結済み」に入れられない', async () => {
    const g = await load('edit-guard.ts');
    const v = g.assertStageChangeAllowed(doc('QUOTE'), doc('CLOSED_WON'), false);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'won_in');
    assert.deepEqual(v.deals, ['main']);
  });

  test('承認者以外は「契約締結済み」から外せない', async () => {
    const g = await load('edit-guard.ts');
    const v = g.assertStageChangeAllowed(doc('CLOSED_WON'), doc('QUOTE'), false);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'won_out');
  });

  test('受注済みの商談をまるごと消すすり抜けも塞ぐ', async () => {
    const g = await load('edit-guard.ts');
    const before = doc('QUOTE', [['d1', 'CLOSED_WON']]);
    const after  = doc('QUOTE', []);                       // d1 を配列から削除
    const v = g.assertStageChangeAllowed(before, after, false);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'won_out');
    assert.deepEqual(v.deals, ['d1']);
  });

  test('通常の前進は承認者以外でも通る', async () => {
    const g = await load('edit-guard.ts');
    assert.equal(g.assertStageChangeAllowed(doc('TRIAL'), doc('QUOTE'), false).ok, true);
    assert.equal(g.assertStageChangeAllowed(doc('QUOTE'), doc('VERBAL_COMMIT'), false).ok, true);
    assert.equal(g.assertStageChangeAllowed(doc('QUOTE'), doc('APPLICATION'), false).ok, true);
    assert.equal(g.assertStageChangeAllowed(doc('QUOTE'), doc('CLOSED_LOST'), false).ok, true, '失注は承認不要');
  });

  test('pendingPhase に積むだけなら通る（画面の正しい使い方）', async () => {
    const g = await load('edit-guard.ts');
    const before = doc('QUOTE');
    const after  = { opp: { phase: 'QUOTE', pendingPhase: 'CLOSED_WON' }, deals: [] };
    assert.equal(g.assertStageChangeAllowed(before, after, false).ok, true);
  });

  test('旧キーで書かれても正規化して判定する', async () => {
    const g = await load('edit-guard.ts');
    // APPROVAL → QUOTE 相当。どちらも受注ではないので通る
    assert.equal(g.assertStageChangeAllowed(doc('APPROVAL'), doc('QUOTE'), false).ok, true);
    // 旧キーの受注前から CLOSED_WON へは弾く
    assert.equal(g.assertStageChangeAllowed(doc('RE_PROPOSAL'), doc('CLOSED_WON'), false).ok, false);
  });

  test('新規ドキュメント（before なし）でいきなり受注は弾く', async () => {
    const g = await load('edit-guard.ts');
    const v = g.assertStageChangeAllowed(null, doc('CLOSED_WON'), false);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'won_in');
  });

  test('拒否の応答に顧客データが入らない', async () => {
    const g = await load('edit-guard.ts');
    const before = { opp: { phase: 'QUOTE', need: '顧客の機微なニーズ' }, deals: [] };
    const after  = { opp: { phase: 'CLOSED_WON', need: '顧客の機微なニーズ' }, deals: [] };
    const v = g.assertStageChangeAllowed(before, after, false);
    const s = JSON.stringify(v);
    assert.ok(!s.includes('顧客の機微なニーズ'), '判定結果に本文が混ざっている');
  });
});
