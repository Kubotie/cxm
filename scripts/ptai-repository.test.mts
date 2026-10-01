// ─── リポジトリ層の単体テスト ───────────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs --test scripts/ptai-repository.test.mts
//
// 出典: docs/ptai-dashboard-operation-flows.md §0・§D〜§I
// fetch をスタブするので実接続しない。

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = new URL('../src/lib/ptai/', import.meta.url).href;
const load = (f: string) => import(`${ROOT}${f}?t=${Math.random()}`);

const realFetch = globalThis.fetch;
let calls: Array<{ method: string; url: string; body: any }> = [];

/** Notion / Twenty の両方を 1 か所でさばく */
function stub(opts: {
  customer?: unknown; customers?: unknown[];
  deals?: unknown[]; actions?: unknown[]; people?: unknown[];
  plans?: unknown[]; activities?: unknown[];
  docs?: unknown[]; notes?: unknown[];
  fail?: RegExp;
}) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const ok = (p: unknown) => new Response(JSON.stringify(p), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (opts.fail?.test(url)) return new Response('{}', { status: 500 });

    if (/api\.notion\.com\/v1\/pages\//.test(url))  return ok(opts.customer ?? {});
    if (/data_sources\/25ef5c40/.test(url))         return ok({ results: opts.customers ?? [], has_more: false });
    if (/data_sources\/5f583654/.test(url))         return ok({ results: opts.docs ?? [], has_more: false });

    const list = (rows: unknown[] | undefined) => ok({ data: rows ?? [], pageInfo: { hasNextPage: false } });
    if (/\/rest\/testOpportunities/.test(url))  return list(opts.deals);
    if (/\/rest\/testActions/.test(url))        return list(opts.actions);
    if (/\/rest\/testPeople/.test(url))         return list(opts.people);
    if (/\/rest\/testAccountPlans/.test(url))   return list(opts.plans);
    if (/\/rest\/testActivities/.test(url))     return list(opts.activities);
    if (/\/rest\/notes/.test(url))              return list(opts.notes);
    return ok({ data: [], results: [], pageInfo: { hasNextPage: false } });
  }) as typeof fetch;
}

const customerPage = (over: Record<string, unknown> = {}) => ({
  id: 'page-1', url: 'https://notion.so/page-1', last_edited_time: '2026-10-01T00:00:00.000Z',
  properties: {
    '企業名':        { type: 'title', title: [{ plain_text: '株式会社テスト商事' }] },
    'Tier':          { type: 'select', select: { name: 'Tier2' } },
    '業種':          { type: 'select', select: { name: 'IT・SaaS・ソフトウェア・Web' } },
    '担当3':         { type: 'multi_select', multi_select: [{ name: 'Shinichi Nagai' }, { name: 'BB' }] },
    '⚠️MRR':         { type: 'number', number: 500_000 },
    '想定追加MRR':   { type: 'number', number: 200_000 },
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

const deal = (over: Record<string, unknown> = {}) => ({
  id: 'd1', name: 'Ptengine AI - テスト商事', notionCompanyId: 'page-1',
  stage: 'QUOTE', addMrr: 300_000, applyDate: '2026-12-01', msBase: 'APPLY',
  isMain: true, ...over,
});

describe('Notion → アカウント情報', () => {
  beforeEach(() => { calls = []; process.env.TOKEN_NOTION = 't'; process.env.TWENTY_API_KEY = 'k'; });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('Tier・業種・担当をダッシュボードの呼称へ変換する', async () => {
    stub({ customer: customerPage(), deals: [deal()] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.equal(d.account.tier, 'TIER2', 'Notion の「Tier2」を変換していない');
    assert.equal(d.account.industry, 'IT_SAAS');
    assert.deepEqual(d.account.owners, ['Paul', 'Baba'], '担当3 を呼称に変換していない');
    assert.equal(d.account.mrr, 500_000);
    assert.equal(d.account.lastEditedTime, '2026-10-01T00:00:00.000Z', '楽観ロック用の時刻が落ちている');
  });
});

describe('商談の組み立て', () => {
  beforeEach(() => { calls = []; process.env.TOKEN_NOTION = 't'; process.env.TWENTY_API_KEY = 'k'; });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('notionCompanyId で絞って引く', async () => {
    stub({ customer: customerPage(), deals: [deal()] });
    const r = await load('repository.ts');
    await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    const q = calls.find(c => /testOpportunities/.test(c.url))!;
    assert.ok(decodeURIComponent(q.url).includes('notionCompanyId[eq]:page-1'), '会社で絞っていない');
  });

  test('到達予定は保存値を優先し、無いところだけ逆算で埋める', async () => {
    stub({ customer: customerPage(), deals: [deal({ msQuote: '2026-11-05' })] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    const x = d.deals[0];
    assert.equal(x.milestones.QUOTE, '2026-11-05', '保存値を上書きしている');
    assert.equal(x.milestonesStored.QUOTE, '2026-11-05');
    assert.equal(x.milestones.TRIAL, '2026-10-13', '逆算で埋まっていない');
    assert.equal(x.milestonesStored.TRIAL, null, '逆算値を保存値として返している');
  });

  test('承認待ちの有無が分かる', async () => {
    stub({ customer: customerPage(), deals: [deal({
      pendingEdit: { stage: 'CLOSED_WON' }, pendingStage: 'CLOSED_WON',
    })] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.deepEqual(d.deals[0].pending, { edit: true, delete: false, stage: true });
  });

  test('並び順は 進行中 → 受注 → 失注', async () => {
    stub({ customer: customerPage(), deals: [
      deal({ id: 'lost', stage: 'CLOSED_LOST', isMain: false }),
      deal({ id: 'won',  stage: 'CLOSED_WON',  isMain: false }),
      deal({ id: 'open', stage: 'TRIAL',       isMain: true }),
    ] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.deepEqual(d.deals.map((x: any) => x.id), ['open', 'won', 'lost']);
  });

  test('旧フェーズキーは正規化して読む', async () => {
    stub({ customer: customerPage(), deals: [deal({ stage: 'APPROVAL' })] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.equal(d.deals[0].stage, 'QUOTE');
  });
});

describe('KPI の組み立て', () => {
  beforeEach(() => { calls = []; process.env.TOKEN_NOTION = 't'; process.env.TWENTY_API_KEY = 'k'; });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('失注の商談は追加MRR に足さない', async () => {
    stub({ customer: customerPage(), deals: [
      deal({ id: 'a', stage: 'QUOTE',       addMrr: 300_000, isMain: true }),
      deal({ id: 'b', stage: 'CLOSED_LOST', addMrr: 900_000, isMain: false }),
    ] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.equal(d.kpi.total, 800_000, '失注ぶんを足している');
  });

  test('商談が無ければ確定も期待値も 0', async () => {
    stub({ customer: customerPage(), deals: [] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.equal(d.kpi.expected, 0);
    assert.equal(d.kpi.won, 0);
    assert.equal(d.kpi.total, 500_000, '現在MRR は残る');
  });

  test('申込用紙回収済みは確定に入る（§9-6）', async () => {
    stub({ customer: customerPage(), deals: [deal({ stage: 'APPLICATION' })] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.equal(d.kpi.won, 800_000);
    assert.equal(d.kpi.inDeal, 0, '商談中にも入れてしまっている');
    assert.equal(d.kpi.bucket, 'won');
  });

  test('代表フェーズは main の商談', async () => {
    stub({ customer: customerPage(), deals: [
      deal({ id: 'sub',  stage: 'TRIAL', isMain: false }),
      deal({ id: 'main', stage: 'VERBAL_COMMIT', isMain: true }),
    ] });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    const like = r.toCompanyLike(d.account, d.deals);
    assert.equal(like.stage, 'VERBAL_COMMIT');
  });
});

describe('部分的な失敗に耐える', () => {
  beforeEach(() => { calls = []; process.env.TOKEN_NOTION = 't'; process.env.TWENTY_API_KEY = 'k'; });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('組織図が落ちても、アカウント情報と商談は返す', async () => {
    stub({ customer: customerPage(), deals: [deal()], fail: /testPeople/ });
    const r = await load('repository.ts');
    const d = await r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 });
    assert.equal(d.account.name, '株式会社テスト商事');
    assert.equal(d.deals.length, 1);
    assert.equal(d.org.length, 0);
    assert.ok(d.diagnostics.partialFailures.some((x: string) => x.startsWith('testPeople:')), '失敗が記録されていない');
  });

  test('Notion の顧客ページが引けなければ失敗させる（会社を特定できないため）', async () => {
    stub({ customer: customerPage(), fail: /api\.notion\.com\/v1\/pages\// });
    const r = await load('repository.ts');
    await assert.rejects(() => r.getCompanyDetail({ notionPageId: 'page-1', minutesLimit: 0 }));
  });
});

describe('一覧（トップ画面）', () => {
  beforeEach(() => { calls = []; process.env.TOKEN_NOTION = 't'; process.env.TWENTY_API_KEY = 'k'; });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('商談は 1 回で全件取って会社ごとに束ねる', async () => {
    stub({
      customers: [customerPage(), customerPage({ id: 'page-2' })],
      deals: [deal({ id: 'd1', notionCompanyId: 'page-1' }),
              deal({ id: 'd2', notionCompanyId: 'page-2', addMrr: 100_000 })],
    });
    const r = await load('repository.ts');
    const { companies } = await r.listCompanySummaries();
    assert.equal(companies.length, 2);
    assert.equal(companies[0].dealCount, 1);
    assert.equal(companies[1].addMrr, 100_000);
    // 会社ごとに引いていない＝testOpportunities の呼び出しは 1 回だけ
    assert.equal(calls.filter(c => /testOpportunities/.test(c.url)).length, 1, '会社ごとに引いている');
  });

  test('商談が引けなくても会社一覧は返す', async () => {
    stub({ customers: [customerPage()], fail: /testOpportunities/ });
    const r = await load('repository.ts');
    const { companies, partialFailures } = await r.listCompanySummaries();
    assert.equal(companies.length, 1);
    assert.equal(companies[0].dealCount, 0);
    assert.ok(partialFailures.length);
  });
});
