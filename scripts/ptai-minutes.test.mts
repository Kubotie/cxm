// ─── 議事録（Notion ＋ Mii）の単体テスト ────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs --test scripts/ptai-minutes.test.mts
//
// 出典: docs/ptai-dashboard-operation-flows.md §I・§8-2
// fetch をスタブするので実接続しない。

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = new URL('../src/lib/ptai/', import.meta.url).href;
const load = (f: string) => import(`${ROOT}${f}?t=${Math.random()}`);

const realFetch = globalThis.fetch;
let calls: Array<{ method: string; url: string; body: any }> = [];

function stub(routes: Array<[RegExp, unknown]>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : null });
    for (const [re, payload] of routes) {
      if (re.test(url)) return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ results: [], data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

const notionDoc = (id: string, title: string) => ({
  id, url: `https://notion.so/${id}`,
  properties: {
    'お知らせ':   { type: 'title', title: [{ plain_text: title }] },
    '作成日付':   { type: 'created_time', created_time: '2026-09-15T02:00:00.000Z' },
    'Scope':      { type: 'select', select: { name: '社外' } },
    '決定事項':   { type: 'rich_text', rich_text: [{ plain_text: '見積を出す' }] },
    '次回アクション': { type: 'rich_text', rich_text: [] },
    '参加者(顧客)':   { type: 'rich_text', rich_text: [] },
  },
});

const twentyNote = (id: string, title: string, source: string) => ({
  id, title, createdAt: '2026-08-20T00:00:00.000Z',
  createdBy: { source, name: 'x' },
  bodyV2: { markdown: '# 参加者\n田中: よろしく' },
});

describe('社名の正規化', () => {
  test('法人格と記号を落とす', async () => {
    const m = await load('minutes.ts');
    assert.equal(m.normalizeCompanyName('株式会社テスト商事'), 'テスト商事');
    assert.equal(m.normalizeCompanyName('テスト商事（関西）'), 'テスト商事');
    assert.equal(m.normalizeCompanyName('一般社団法人 テスト協会'), 'テスト協会');
  });

  test('短すぎる社名はタイトル照合をあきらめる', async () => {
    const m = await load('minutes.ts');
    assert.equal(m.isMatchableName('株式会社AB'), false, '2 文字は誤爆する');
    assert.equal(m.isMatchableName('株式会社ABC'), true);
  });
});

describe('Mii（Twenty Note）の出典判定', () => {
  test('API 作成は MII、それ以外は TWENTY_NOTE', async () => {
    const m = await load('minutes.ts');
    assert.equal(m.meetingSourceOfTwentyNote({ createdBy: { source: 'API' } }), 'MII');
    assert.equal(m.meetingSourceOfTwentyNote({ createdBy: { source: 'MANUAL' } }), 'TWENTY_NOTE');
    assert.equal(m.meetingSourceOfTwentyNote({}), 'TWENTY_NOTE', '不明なら手書き扱い');
  });

  test('タイトル先頭の日付を読む', async () => {
    const m = await load('minutes.ts');
    assert.equal(m.dateFromTitle('20260915_定例MTG'), '2026-09-15');
    assert.equal(m.dateFromTitle('2026-09-15 定例'), '2026-09-15');
    assert.equal(m.dateFromTitle('定例MTG'), '');
  });
});

describe('会社の議事録（§I・§8-2）', () => {
  beforeEach(() => {
    calls = [];
    process.env.TOKEN_NOTION = 'notion-token';
    process.env.TWENTY_API_KEY = 'twenty-key';
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('リレーションがあれば relation で拾い、Mii も並ぶ', async () => {
    stub([
      [/data_sources\/.*\/query/, { results: [notionDoc('n1', '20260915_定例MTG')], has_more: false }],
      [/\/rest\/notes/,           { data: [twentyNote('t1', '20260910 テスト商事 打合せ', 'API')], pageInfo: { hasNextPage: false } }],
    ]);
    const m = await load('minutes.ts');
    const r = await m.listCompanyMinutes({ companyRelationIds: ['co-1'], companyName: '株式会社テスト商事' });

    assert.equal(r.diagnostics.notion.byRelation, 1);
    assert.equal(r.diagnostics.mii.total, 1);
    assert.equal(r.meetings.length, 2, 'Notion と Mii の両方が出る');
    assert.equal(r.meetings[0].date, '2026-09-15', '新しい順');
    assert.deepEqual(r.meetings.map((x: any) => x.source), ['NOTION', 'MII']);
    assert.deepEqual(r.meetings.map((x: any) => x.matchedBy), ['relation', 'title']);
  });

  test('**リレーションが無い会社はタイトル照合で拾う**', async () => {
    stub([
      [/data_sources\/.*\/query/, { results: [notionDoc('n2', 'テスト商事 定例')], has_more: false }],
      [/\/rest\/notes/,           { data: [], pageInfo: { hasNextPage: false } }],
    ]);
    const m = await load('minutes.ts');
    const r = await m.listCompanyMinutes({ companyRelationIds: [], companyName: '株式会社テスト商事' });

    assert.equal(r.diagnostics.notion.byRelation, 0);
    assert.equal(r.diagnostics.notion.byTitle, 1, 'タイトル照合で拾えていない');
    assert.equal(r.meetings[0].matchedBy, 'title', '暫定策であることが分かる印が無い');

    const q = calls.find(c => /data_sources/.test(c.url))!;
    const f = JSON.stringify(q.body.filter);
    assert.ok(f.includes('お知らせ') && f.includes('テスト商事'), 'タイトルで絞っていない');
    assert.ok(f.includes('議事録'), 'Category で絞っていない');
  });

  test('リレーションとタイトルで同じページを二重に出さない', async () => {
    stub([
      [/data_sources\/.*\/query/, { results: [notionDoc('same', 'テスト商事 定例')], has_more: false }],
      [/\/rest\/notes/,           { data: [], pageInfo: { hasNextPage: false } }],
    ]);
    const m = await load('minutes.ts');
    const r = await m.listCompanyMinutes({ companyRelationIds: ['co-1'], companyName: '株式会社テスト商事' });
    assert.equal(r.meetings.filter((x: any) => x.externalId === 'same').length, 1);
  });

  test('同じ日の Notion と Mii を統合しない（両方出す）', async () => {
    stub([
      [/data_sources\/.*\/query/, { results: [notionDoc('n3', '20260915_定例MTG')], has_more: false }],
      [/\/rest\/notes/,           { data: [twentyNote('t3', '20260915 テスト商事 定例', 'API')], pageInfo: { hasNextPage: false } }],
    ]);
    const m = await load('minutes.ts');
    const r = await m.listCompanyMinutes({ companyRelationIds: ['co-1'], companyName: '株式会社テスト商事' });
    const sameDay = r.meetings.filter((x: any) => x.date === '2026-09-15');
    assert.equal(sameDay.length, 2, '同じ会議でも出典ごとに残すのが正しい');
    assert.deepEqual([...new Set(sameDay.map((x: any) => x.source))].sort(), ['MII', 'NOTION']);
  });

  test('片方が落ちても、もう片方は返す', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ method: init?.method ?? 'GET', url, body: null });
      if (/\/rest\/notes/.test(url)) return new Response('{}', { status: 403 });
      return new Response(JSON.stringify({ results: [notionDoc('n4', 'テスト商事 定例')], has_more: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    const m = await load('minutes.ts');
    const r = await m.listCompanyMinutes({ companyRelationIds: ['co-1'], companyName: '株式会社テスト商事' });
    assert.equal(r.meetings.length, 1, 'Notion 側は返るべき');
    assert.ok(r.diagnostics.partialFailures.some((x: string) => x.startsWith('mii:')), '失敗が記録されていない');
  });

  test('社名が短すぎるときはタイトル照合をせず、その旨を返す', async () => {
    stub([[/data_sources\/.*\/query/, { results: [], has_more: false }]]);
    const m = await load('minutes.ts');
    const r = await m.listCompanyMinutes({ companyRelationIds: [], companyName: '株式会社AB' });
    assert.equal(r.diagnostics.titleMatchSkipped, true);
    assert.equal(r.meetings.length, 0);
    assert.equal(calls.filter(c => /rest\/notes/.test(c.url)).length, 0, 'Mii を引いてしまっている');
  });
});
