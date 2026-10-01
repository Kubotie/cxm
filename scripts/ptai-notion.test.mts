// ─── Notion クライアントの単体テスト ────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs --test scripts/ptai-notion.test.mts
//
// 出典: docs/ptai-dashboard-operation-flows.md §8
// fetch をスタブするので **実際の Notion には接続しない**。

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = new URL('../src/lib/ptai/notion/', import.meta.url).href;
const load = (f: string) => import(`${ROOT}${f}?t=${Math.random()}`);

const TOKEN = 'notion-token-must-not-leak';
const realFetch = globalThis.fetch;
let calls: Array<{ method: string; url: string; body: any }> = [];

function stub(handler: (url: string, init: RequestInit) => unknown, status = 200) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const payload = handler(url, init ?? {});
    return new Response(JSON.stringify(payload ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

const page = (over: Record<string, unknown> = {}) => ({
  id: 'page-1', url: 'https://notion.so/page-1', last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    '企業名':        { type: 'title', title: [{ plain_text: 'テスト社' }] },
    'Tier':          { type: 'select', select: { name: 'Tier2' } },
    '業種':          { type: 'select', select: { name: 'IT・SaaS・ソフトウェア・Web' } },
    '担当3':         { type: 'multi_select', multi_select: [{ name: 'Shinichi Nagai' }, { name: 'Kubotie' }] },
    '⚠️MRR':         { type: 'number', number: 500000 },
    '想定追加MRR':   { type: 'number', number: 300000 },
    '課金ステージ':  { type: 'select', select: { name: 'S3 見積提示' } },
    '次回Action':    { type: 'rich_text', rich_text: [{ plain_text: '見積を送る' }] },
    'Action日':      { type: 'date', date: { start: '2026-10-10' } },
    '阻害の中身/これがあれば課金する': { type: 'rich_text', rich_text: [] },
    '課金開始予定月': { type: 'date', date: null },
    '新ソリューション状態': { type: 'select', select: { name: 'PoC進行' } },
    'Company Database': { type: 'relation', relation: [{ id: 'co-1' }] },
    '決算月':       { type: 'select', select: { name: '3月' } },
    '予算策定時期': { type: 'rich_text', rich_text: [{ plain_text: '10月〜11月' }] },
    '契約更新月':   { type: 'select', select: { name: '情報なし' } },
  },
  ...over,
});

describe('Notion クライアント（§8-1）', () => {
  beforeEach(() => { calls = []; process.env.TOKEN_NOTION = TOKEN; });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('顧客ページを読める', async () => {
    stub(() => page());
    const c = await load('client.ts');
    const r = await c.getCustomer('page-1');
    assert.equal(r.name, 'テスト社');
    assert.equal(r.tier, 'Tier2');
    assert.equal(r.mrr, 500000);
    assert.equal(r.aimMrr, 300000);
    assert.deepEqual(r.owners3, ['Shinichi Nagai', 'Kubotie']);
    assert.equal(r.nextAction, '見積を送る');
    assert.equal(r.nextActionDate, '2026-10-10');
    assert.deepEqual(r.companyRelation, ['co-1']);
  });

  test('変更した項目だけ PATCH する', async () => {
    stub(() => page());
    const c = await load('client.ts');
    const r = await c.updateCustomer('page-1', { tier: 'Tier1', aimMrr: 300000 }, '2026-10-01T00:00:00.000Z');
    assert.equal(r.ok, true);
    assert.deepEqual(r.changed, ['tier'], 'aimMrr は同値なので送らない');
    const patch = calls.find(x => x.method === 'PATCH');
    assert.ok(patch, 'PATCH していない');
    assert.deepEqual(Object.keys(patch!.body.properties), ['Tier']);
  });

  test('変更がなければ PATCH しない', async () => {
    stub(() => page());
    const c = await load('client.ts');
    const r = await c.updateCustomer('page-1', { tier: 'Tier2' }, '2026-10-01T00:00:00.000Z');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_change');
    assert.equal(calls.filter(x => x.method === 'PATCH').length, 0);
  });

  test('**楽観ロック**: Notion 側が新しければ上書きしない', async () => {
    stub(() => page({ last_edited_time: '2026-10-02T00:00:00.000Z' }));
    const c = await load('client.ts');
    const r = await c.updateCustomer('page-1', { tier: 'Tier1' }, '2026-10-01T00:00:00.000Z');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'conflict');
    assert.equal(r.theirs.tier, 'Tier2', '相手の値を返す');
    assert.equal(calls.filter(x => x.method === 'PATCH').length, 0, '上書きしてしまっている');
  });

  test('読み取り専用の項目は書けない', async () => {
    stub(() => page());
    const c = await load('client.ts');
    // MRR・新ソリューション状態・障壁状態 は CustomerPatch に無い＝型でも実行時でも書けない
    const r = await c.updateCustomer('page-1', { barrier: '稟議が長い' } as any, '2026-10-01T00:00:00.000Z');
    assert.equal(r.ok, true);
    const patch = calls.find(x => x.method === 'PATCH')!;
    const keys = Object.keys(patch.body.properties);
    assert.ok(!keys.includes('⚠️MRR'), 'MRR を書いている');
    assert.ok(!keys.includes('新ソリューション状態'), '新ソリューション状態を書いている');
    assert.ok(!keys.some(k => k.includes('障壁状態')), '廃止した障壁状態を書いている');
  });

  test('議事録は関連顧客リレーションで絞る（タイトル検索ではない）', async () => {
    stub(() => ({ results: [{
      id: 'doc-1', url: 'https://notion.so/doc-1',
      properties: {
        'お知らせ':  { type: 'title', title: [{ plain_text: '20260915_定例MTG' }] },
        '作成日付':  { type: 'created_time', created_time: '2026-09-15T02:00:00.000Z' },
        'Scope':     { type: 'select', select: { name: '社外' } },
        '決定事項':  { type: 'rich_text', rich_text: [{ plain_text: '見積を出す' }] },
        '次回アクション': { type: 'rich_text', rich_text: [] },
        '参加者(顧客)':   { type: 'rich_text', rich_text: [{ plain_text: '3名' }] },
      },
    }], has_more: false }));
    const c = await load('client.ts');
    const r = await c.listMinutes(['co-1'], 6);
    assert.equal(r.length, 1);
    assert.equal(r[0].source, 'NOTION');
    assert.equal(r[0].date, '2026-09-15', 'タイトルの YYYYMMDD を優先');
    assert.equal(r[0].externalId, 'doc-1');
    const q = calls.find(x => x.method === 'POST')!;
    const f = JSON.stringify(q.body.filter);
    assert.ok(f.includes('関連顧客') && f.includes('co-1'), 'リレーションで絞っていない');
    assert.ok(f.includes('議事録'), 'Category で絞っていない');
  });

  test('トークンが戻り値・例外に漏れない', async () => {
    stub(() => ({ code: 'unauthorized' }), 401);
    const c = await load('client.ts');
    await assert.rejects(() => c.getCustomer('page-1'), (e: any) => {
      assert.equal(e.kind, 'auth');
      assert.ok(!e.message.includes(TOKEN));
      assert.ok(!e.toSafeString().includes(TOKEN));
      return true;
    });
  });

  test('共有されていない DB は not_found として分かる', async () => {
    stub(() => ({ code: 'object_not_found', message: 'x' }), 404);
    const c = await load('client.ts');
    await assert.rejects(() => c.getCustomer('page-1'), (e: any) => e.kind === 'not_found');
  });

  test('目標DB を原本の settings/targets と同じ形に畳む', async () => {
    process.env.NOTION_PTAI_TARGETS_DS_ID = 'ds-1';
    stub(() => ({ results: [
      { id: 'r0', properties: {
        '対象': { type: 'title', title: [{ plain_text: 'チーム全体' }] },
        '種別': { type: 'select', select: { name: 'チーム' } },
        'name2': { type: 'rich_text', rich_text: [] },
        '目標MRR': { type: 'number', number: 40000000 },
        '期限': { type: 'rich_text', rich_text: [{ plain_text: '2026-12' }] },
        '有効': { type: 'checkbox', checkbox: true } } },
      { id: 'r1', properties: {
        '対象': { type: 'title', title: [{ plain_text: 'Paul' }] },
        '種別': { type: 'select', select: { name: 'メンバー' } },
        'name2': { type: 'rich_text', rich_text: [{ plain_text: 'Paul' }] },
        '目標MRR': { type: 'number', number: 12000000 },
        '期限': { type: 'rich_text', rich_text: [] },
        '有効': { type: 'checkbox', checkbox: true } } },
      { id: 'r2', properties: {
        '対象': { type: 'title', title: [{ plain_text: '退任者' }] },
        '種別': { type: 'select', select: { name: 'メンバー' } },
        'name2': { type: 'rich_text', rich_text: [{ plain_text: 'X' }] },
        '目標MRR': { type: 'number', number: 1000000 },
        '期限': { type: 'rich_text', rich_text: [] },
        '有効': { type: 'checkbox', checkbox: false } } },
    ], has_more: false }));
    const c = await load('client.ts');
    const t = await c.readTeamTargets();
    assert.equal(t.targetMrr, 40000000);
    assert.equal(t.targetDue, '2026-12');
    assert.deepEqual(t.targets, { Paul: 12000000 }, '無効の行は除く');
  });
});

describe('対応表（§8-1）', () => {
  test('Tier と業種が往復する', async () => {
    const s = await load('schema.ts');
    for (const k of Object.keys(s.TIER_TO_NOTION)) {
      assert.equal(s.TIER_FROM_NOTION[s.TIER_TO_NOTION[k]], k, `Tier ${k}`);
    }
    for (const k of Object.keys(s.INDUSTRY_TO_NOTION)) {
      assert.equal(s.INDUSTRY_FROM_NOTION[s.INDUSTRY_TO_NOTION[k]], k, `業種 ${k}`);
    }
  });

  test('課金ステージは全フェーズを網羅し、失注は書かない', async () => {
    const s  = await load('schema.ts');
    const ts = await import(new URL('../src/lib/ptai/twenty-test/schema.ts', import.meta.url).href);
    for (const st of ts.STAGES) {
      if (st === 'CLOSED_LOST') {
        assert.equal(s.STAGE_TO_BILLING_STAGE[st], undefined, '失注は課金ステージを動かさない');
      } else {
        assert.ok(s.STAGE_TO_BILLING_STAGE[st], `${st} の対応がない`);
      }
    }
  });

  test('議事録の出典に Notion と Mii が対等にある', async () => {
    const s = await load('schema.ts');
    assert.ok(s.MEETING_SOURCE_JP.MII, 'Mii が出典に無い');
    assert.ok(s.MEETING_SOURCE_JP.NOTION, 'Notion が出典に無い');
  });

  test('日付でまとめるだけで、タイトルで同一会議を推測しない', async () => {
    const s = await load('schema.ts');
    // 同じ日なら同じ鍵。タイトルの違いは鍵に影響しない
    assert.equal(
      s.meetingDayKey({ date: '2026-09-15', title: '20260915_定例MTG' }),
      s.meetingDayKey({ date: '2026-09-15', title: '【社外】定例MTG' }),
    );
    assert.notEqual(s.meetingDayKey({ date: '2026-09-15' }), s.meetingDayKey({ date: '2026-09-16' }));
    // 表示用の整形は照合に使わない
    assert.equal(s.meetingTitleForDisplay('20260915_定例MTG'), '定例MTG');
  });
});

describe('キー日程（D-05・§9-4）', () => {
  test('月・範囲・情報なしを往復できる', async () => {
    const s = await load('schema.ts');
    assert.equal(s.parseMonth('7月'), 7);
    assert.equal(s.parseMonth('情報なし'), 'none');
    assert.equal(s.parseMonth(''), null);
    assert.equal(s.parseMonth('13月'), null, '範囲外を通している');
    assert.equal(s.formatMonth(7), '7月');
    assert.equal(s.formatMonth('none'), '情報なし');

    assert.deepEqual(s.parseMonthRange('10月〜11月'), [10, 11]);
    assert.deepEqual(s.parseMonthRange('10月'), [10, 10], '単月も範囲として読む');
    assert.equal(s.parseMonthRange('情報なし'), 'none');
    assert.equal(s.formatMonthRange([10, 11]), '10月〜11月');
    assert.equal(s.formatMonthRange([10, 10]), '10月', '同じ月なら 1 つで出す');
  });

  test('顧客ページからキー日程を読む', async () => {
    stub(() => page());
    const c = await load('client.ts');
    const r = await c.getCustomer('page-1');
    assert.equal(r.keyDates.fiscalMonth, 3);
    assert.deepEqual(r.keyDates.budgetMonths, [10, 11]);
    assert.equal(r.keyDates.renewalMonth, 'none');
  });

  test('キー日程を Notion の表記に直して書く', async () => {
    stub(() => page());
    const c = await load('client.ts');
    const r = await c.updateCustomer('page-1',
      { fiscalMonth: 12, budgetMonths: [8, 9], renewalMonth: 'none' },
      '2026-10-01T00:00:00.000Z');
    assert.equal(r.ok, true);
    const props = calls.find(x => x.method === 'PATCH')!.body.properties;
    assert.equal(props['決算月'].select.name, '12月');
    assert.equal(props['予算策定時期'].rich_text[0].text.content, '8月〜9月');
    assert.ok(!('契約更新月' in props), '同値なのに送っている');
    assert.deepEqual(r.changed.sort(), ['budgetMonths', 'fiscalMonth']);
  });
});
