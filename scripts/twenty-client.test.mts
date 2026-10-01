// ─── Twenty 読み取りクライアントの単体テスト（PtAI Pipeline）─────────────────
//
//   node --experimental-strip-types --test scripts/twenty-client.test.mts
//
// 対象は PtAI Pipeline の Twenty 連携だけ。CXM のコードは検査も変更もしない。
//
// テストランナーは **Node 標準の node:test**。依存は増やしていない。
// fetch をスタブするだけで、**実際の Twenty には接続しない**。
//
// 検証対象:
//   URL 正規化 / キー未設定 / 401 / 403 / 429 リトライ / 5xx リトライ /
//   タイムアウト / 応答不正 / pagination / countRecords のフィルタ引き渡し /
//   キーが例外・戻り値に漏れないこと

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const MOD = '../src/lib/twenty/client.ts';
const SECRET = 'super-secret-key-value-should-never-leak';

type Call = { url: string; headers: Record<string, string> };
let calls: Call[] = [];
const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string, call: number) => Response | Promise<Response> | 'timeout') {
  let n = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = await handler(url, n++);
    if (r === 'timeout') {
      // abort シグナルを待って AbortError を投げる
      return new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('aborted'); e.name = 'AbortError'; rej(e);
        });
      });
    }
    return r;
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** metadata プローブに成功させるための既定応答 */
const metaOk = () => json({ data: [{ nameSingular: 'company', fields: [] }], pageInfo: { hasNextPage: false } });

async function freshModule() {
  // モジュール状態（解決済み base）を毎回リセットする
  const m = await import(`${MOD}?t=${Math.random()}`);
  m.__resetClientStateForTests();
  return m;
}

beforeEach(() => { calls = []; process.env.TWENTY_API_KEY = SECRET; process.env.TWENTY_API_URL = ''; });
afterEach(() => { globalThis.fetch = realFetch; delete process.env.TWENTY_API_KEY; delete process.env.TWENTY_API_URL; });

// ── URL 正規化 ──────────────────────────────────────────────────────────────

describe('normalizeBaseUrl', () => {
  test('末尾スラッシュを落とす', async () => {
    const { normalizeBaseUrl } = await freshModule();
    assert.equal(normalizeBaseUrl('https://crm.ptengine.com/'), 'https://crm.ptengine.com');
    assert.equal(normalizeBaseUrl('https://crm.ptengine.com///'), 'https://crm.ptengine.com');
  });

  test('誤った /api・/rest・/metadata を剥がす', async () => {
    const { normalizeBaseUrl } = await freshModule();
    assert.equal(normalizeBaseUrl('https://crm.ptengine.com/api'), 'https://crm.ptengine.com');
    assert.equal(normalizeBaseUrl('https://crm.ptengine.com/api/'), 'https://crm.ptengine.com');
    assert.equal(normalizeBaseUrl('https://crm.ptengine.com/rest'), 'https://crm.ptengine.com');
    assert.equal(normalizeBaseUrl('https://crm.ptengine.com/metadata'), 'https://crm.ptengine.com');
  });

  test('空なら既定値', async () => {
    const { normalizeBaseUrl } = await freshModule();
    assert.equal(normalizeBaseUrl(''), 'https://crm.ptengine.com');
    assert.equal(normalizeBaseUrl(undefined), 'https://crm.ptengine.com');
  });
});

// ── 設定 ────────────────────────────────────────────────────────────────────

describe('設定', () => {
  test('キー未設定なら configured=false、値は返さない', async () => {
    delete process.env.TWENTY_API_KEY;
    const { isTwentyConfigured, getTwentyConfigStatus } = await freshModule();
    assert.equal(isTwentyConfigured(), false);
    const st = getTwentyConfigStatus();
    assert.deepEqual(st.missing, ['TWENTY_API_KEY']);
    assert.ok(!JSON.stringify(st).includes(SECRET), '設定状態にキーが含まれてはいけない');
  });

  test('キー未設定で listRecords すると config エラー', async () => {
    delete process.env.TWENTY_API_KEY;
    const { listRecords } = await freshModule();
    await assert.rejects(() => listRecords('companies', {}), (e: { kind: string }) => e.kind === 'config');
  });
});

// ── 認証まわり ──────────────────────────────────────────────────────────────

describe('認証', () => {
  test('401 は再試行せずに auth エラー', async () => {
    stubFetch(() => json({ statusCode: 401 }, 401));
    const { resolveBaseUrl } = await freshModule();
    const r = await resolveBaseUrl({ force: true });
    assert.equal(r.base, null);
    assert.equal(r.authFailedBase, 'https://crm.ptengine.com');
    assert.equal(calls.length, 1, '401 で再試行してはいけない');
  });

  test('403 も再試行しない', async () => {
    stubFetch(() => json({ statusCode: 403 }, 403));
    const { resolveBaseUrl } = await freshModule();
    await resolveBaseUrl({ force: true });
    assert.equal(calls.length, 1);
  });

  test('Authorization ヘッダーにキーが入るが、例外には漏れない', async () => {
    stubFetch(() => json({ statusCode: 401 }, 401));
    const { resolveBaseUrl } = await freshModule();
    const r = await resolveBaseUrl({ force: true });
    assert.ok(String(calls[0].headers.Authorization).includes(SECRET), '送信時にはキーが必要');
    assert.ok(!JSON.stringify(r).includes(SECRET), 'プローブ結果にキーが含まれてはいけない');
  });
});

// ── リトライ ────────────────────────────────────────────────────────────────

describe('リトライ', () => {
  test('429 は再試行し、成功したら返す', async () => {
    stubFetch((_u, n) => (n === 0 ? json({}, 429) : metaOk()));
    const { resolveBaseUrl, listRecords } = await freshModule();
    // プローブは noRetry なので、本体の listRecords で確認する
    stubFetch(() => metaOk());
    await resolveBaseUrl({ force: true });
    calls = [];
    stubFetch((_u, n) => (n === 0 ? json({}, 429) : json({ data: [], pageInfo: { hasNextPage: false } })));
    const rows = await listRecords('companies', {});
    assert.deepEqual(rows, []);
    assert.equal(calls.length, 2, '429 は 1 回再試行される');
  });

  test('5xx も再試行する', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, listRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    calls = [];
    stubFetch((_u, n) => (n < 2 ? json({}, 503) : json({ data: [], pageInfo: { hasNextPage: false } })));
    await listRecords('companies', {});
    assert.equal(calls.length, 3);
  });

  test('その他の 4xx は再試行しない', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, listRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    calls = [];
    stubFetch(() => json({}, 400));
    await assert.rejects(() => listRecords('companies', {}), (e: { kind: string }) => e.kind === 'client');
    assert.equal(calls.length, 1);
  });
});

// ── 応答の扱い ──────────────────────────────────────────────────────────────

describe('応答', () => {
  test('HTML が返ると not_api として扱う', async () => {
    stubFetch(() => new Response('<!doctype html><html></html>', { status: 200 }));
    const { resolveBaseUrl } = await freshModule();
    const r = await resolveBaseUrl({ force: true });
    assert.equal(r.base, null);
    assert.ok(r.report.every((p: { result: string }) => p.result === 'not_api'));
  });

  test('new / legacy どちらの封筒でも配列を取り出せる', async () => {
    const { unwrapList } = await freshModule();
    assert.equal(unwrapList({ data: [{ a: 1 }, { b: 2 }] }, 'companies').length, 2);
    assert.equal(unwrapList({ data: { objects: [{ a: 1 }] } }, 'objects').length, 1);
    assert.equal(unwrapList(null, 'x').length, 0);
    assert.equal(unwrapList({ data: 'not-an-array' }, 'x').length, 0);
  });

  test('AbortError（タイムアウト）は network として分類し、再試行してから諦める', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, listRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    calls = [];
    // 実時間 30 秒を待たずに済むよう、fetch が即座に AbortError を投げる形で再現する
    globalThis.fetch = (async () => {
      calls.push({ url: '(aborted)', headers: {} });
      const e = new Error('The operation was aborted'); e.name = 'AbortError'; throw e;
    }) as typeof fetch;
    await assert.rejects(
      () => listRecords('companies', {}),
      (e: { kind: string; message: string }) => {
        assert.equal(e.kind, 'network');
        assert.ok(!e.message.includes(SECRET), '例外メッセージにキーが漏れてはいけない');
        return true;
      },
    );
    assert.equal(calls.length, 4, 'network エラーは MAX_RETRY(3) + 初回 = 4 回');
  });
});

// ── ページング ──────────────────────────────────────────────────────────────

describe('ページング', () => {
  test('カーソルをたどって全件取得する', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, listRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    calls = [];
    stubFetch((_u, n) => n === 0
      ? json({ data: [{ id: 'a' }, { id: 'b' }], pageInfo: { hasNextPage: true, endCursor: 'C1' } })
      : json({ data: [{ id: 'c' }], pageInfo: { hasNextPage: false } }));
    const rows = await listRecords('companies', { pageSize: 2 });
    assert.equal(rows.length, 3);
    assert.ok(calls[1].url.includes('starting_after=C1'), '2 ページ目はカーソルを渡す');
  });

  test('pageSize は 200 に丸める（超えると Twenty が黙って切り詰めるため）', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, listRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    calls = [];
    stubFetch(() => json({ data: [], pageInfo: { hasNextPage: false } }));
    await listRecords('companies', { pageSize: 999 });
    assert.ok(calls[0].url.includes('limit=200'), `limit が丸められていない: ${calls[0].url}`);
  });
});

// ── countRecords のフィルタ（回帰テスト）────────────────────────────────────

describe('countRecords', () => {
  test('フィルタが URL に必ず載る（PtAI フィルタ欠落の回帰テスト）', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, countRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    calls = [];
    stubFetch(() => json({ totalCount: 126 }));
    const n = await countRecords('companies', 'or(pgaStatus[is]:NOT_NULL)');
    assert.equal(n, 126);
    assert.ok(calls[0].url.includes('filter='), `フィルタが落ちている: ${calls[0].url}`);
    assert.ok(decodeURIComponent(calls[0].url).includes('pgaStatus'), 'フィルタ内容が渡っていない');
  });

  test('filter=null なら filter を付けない（明示が必要）', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, countRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    calls = [];
    stubFetch(() => json({ totalCount: 5134 }));
    const n = await countRecords('companies', null);
    assert.equal(n, 5134);
    assert.ok(!calls[0].url.includes('filter='));
  });

  test('totalCount が無ければ null', async () => {
    stubFetch(() => metaOk());
    const { resolveBaseUrl, countRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    stubFetch(() => json({ data: [] }));
    assert.equal(await countRecords('companies', null), null);
  });
});

// ── 書き込み関数が存在しないこと ────────────────────────────────────────────

describe('読み取り専用', () => {
  test('POST/PATCH/DELETE 系と汎用 request を export していない', async () => {
    const m = await freshModule();
    for (const name of ['request', 'twentyRequest', 'createRecord', 'updateRecord', 'deleteRecord', 'createRecordsBatch']) {
      assert.equal(m[name], undefined, `${name} を export してはいけない`);
    }
  });

  test('発行する HTTP メソッドは GET だけ', async () => {
    let methods: string[] = [];
    globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      methods.push(String(init?.method));
      return metaOk();
    }) as typeof fetch;
    const { resolveBaseUrl, listRecords, countRecords } = await freshModule();
    await resolveBaseUrl({ force: true });
    await listRecords('companies', {});
    await countRecords('companies', null);
    assert.ok(methods.length > 0);
    assert.ok(methods.every(m => m === 'GET'), `GET 以外を発行している: ${methods.join(',')}`);
  });
});
