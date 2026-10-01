// ─── Twenty → RAW 互換 ViewModel アダプターの契約テスト（PtAI Pipeline）──────
//
//   node --experimental-strip-types --test scripts/twenty-adapters.test.mts
//
// 対象は **PtAI Pipeline の読み取り経路だけ**。CXM のコードは検査対象にも変更対象にもしない。
// **NocoDB へアクセスしないこと**（Pipeline の pga_docs を含め、どの NocoDB テーブルも
// 呼ばないこと）と、**Twenty へ書き込まないこと**を検証する。
// fetch はスタブするので実 API には接続しない。

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const SECRET = 'twenty-key-must-not-leak';
const realFetch = globalThis.fetch;
let methods: string[] = [];
let urls: string[] = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** plural ごとに応答を返すスタブ */
function stub(by: Record<string, unknown>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    methods.push(String(init?.method ?? 'GET'));
    if (url.includes('/rest/metadata/objects')) {
      return json({ data: [{ nameSingular: 'company', fields: [] }], pageInfo: { hasNextPage: false } });
    }
    for (const [plural, payload] of Object.entries(by)) {
      if (url.includes(`/rest/${plural}`)) return json(payload);
    }
    return json({ data: [], pageInfo: { hasNextPage: false } });
  }) as typeof fetch;
}

async function load(mod: string) {
  return import(`../src/lib/twenty/${mod}?t=${Math.random()}`);
}

beforeEach(() => {
  methods = []; urls = [];
  process.env.TWENTY_API_KEY = SECRET;
  process.env.TWENTY_API_URL = '';
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.TWENTY_API_KEY;
  delete process.env.TWENTY_API_URL;
});

// ── 変換の契約 ──────────────────────────────────────────────────────────────

describe('company アダプター', () => {
  test('CURRENCY を円に、LINKS を URL に、owner enum を呼称に変換する', async () => {
    const m = await load('adapters/company.ts');
    const c = m.toRawCompany({
      id: 'c1', name: 'テスト　会社', tier: 'TIER1',
      mrr: { amountMicros: 438504000000 },
      notionLinks: { primaryLinkUrl: 'https://notion.so/x' },
      domainName: { primaryLinkUrl: 'https://example.com' },
      pgaOwner: ['SHINICHI_NAGAI', 'UTTY'],
      updatedAt: '2026-09-30T00:00:00.000Z',
    });
    assert.equal(c.m, 438504);
    assert.equal(c.n, 'テスト 会社');                 // 全角スペース → 半角
    assert.equal(c.url, 'https://notion.so/x');
    assert.deepEqual(c.own, ['Paul', 'Utty']);
    assert.deepEqual(c.o, ['Paul']);                   // Utty は主担当から除く
    assert.equal(c.asg, null);                         // 担当3 は Twenty に無い
    assert.equal(c.up, '2026-09-30');
  });

  test('不足項目を推測で埋めない', async () => {
    const m = await load('adapters/company.ts');
    const c = m.toRawCompany({ id: 'c1', name: 'A' });
    assert.equal(c.t, null);
    assert.equal(c.ind, null);
    assert.equal(c.lay, null);                         // 「中堅」で埋めない
    assert.equal(c.cs, null);
    assert.equal(c.m, 0);
    assert.deepEqual(c.notes, []);
    assert.equal(c.opp, null);
  });
});

describe('opportunity アダプター', () => {
  test('stage を 8 段階へ変換せず、そのまま持ち回る', async () => {
    const m = await load('adapters/opportunity.ts');
    for (const st of ['NEW', 'SCREENING', 'MEETING', 'PROPOSAL', 'CUSTOMER']) {
      const o = m.toRawOpportunity({ id: 'o1', name: 'PtAI - A', stage: st });
      assert.equal(o.st, st, `${st} が変換されている`);
    }
  });

  test('stage が無ければ null（推測しない）', async () => {
    const m = await load('adapters/opportunity.ts');
    assert.equal(m.toRawOpportunity({ id: 'o1', name: 'x' }).st, null);
  });

  test('pointOfContact を「氏名 / 役職」に連結する', async () => {
    const m = await load('adapters/opportunity.ts');
    const o = m.toRawOpportunity({
      id: 'o1', name: 'x',
      pointOfContact: { name: { firstName: '山田', lastName: '太郎' }, jobTitle: '部長' },
    });
    assert.equal(o.pc, '山田太郎 / 部長');
  });

  test('紐付けは relation → exact_name → unresolved の順', async () => {
    const m = await load('adapters/opportunity.ts');
    const byName = new Map([['テスト会社', 'c1']]);

    assert.deepEqual(
      m.linkOpportunity({ name: 'PtAI - テスト会社', company: { id: 'cX' } }, byName),
      { companyId: 'cX', method: 'relation' });

    assert.deepEqual(
      m.linkOpportunity({ name: 'PtAI - 株式会社テスト会社' }, byName),
      { companyId: 'c1', method: 'exact_name' });

    assert.deepEqual(
      m.linkOpportunity({ name: 'PtAI - 知らない会社' }, byName),
      { companyId: null, method: 'unresolved' });
  });

  test('部分一致では紐付けない（誤爆を避ける）', async () => {
    const m = await load('adapters/opportunity.ts');
    const byName = new Map([['テスト会社ホールディングス', 'c1']]);
    assert.equal(m.linkOpportunity({ name: 'PtAI - テスト会社' }, byName).method, 'unresolved');
  });
});

describe('note アダプター', () => {
  test('noteTargets があれば relation', async () => {
    const m = await load('adapters/note.ts');
    const r = m.linkNote({ title: 'x', noteTargets: [{ companyId: 'c9' }] }, new Map(), (s: string) => s);
    assert.deepEqual(r, { companyId: 'c9', method: 'relation' });
  });

  test('noteTargets が無ければタイトル照合', async () => {
    const m = await load('adapters/note.ts');
    const norm = (s: string) => (s || '').replace(/株式会社|[\s　]/g, '');
    const r = m.linkNote({ title: '20260930 テスト会社 定例' }, new Map([['テスト会社', 'c1']]), norm);
    assert.deepEqual(r, { companyId: 'c1', method: 'title' });
  });

  test('どちらでも付かなければ unresolved', async () => {
    const m = await load('adapters/note.ts');
    const r = m.linkNote({ title: '無関係' }, new Map([['テスト会社', 'c1']]), (s: string) => s);
    assert.equal(r.method, 'unresolved');
  });

  test('タイトルの日付を拾う。無ければ createdAt', async () => {
    const m = await load('adapters/note.ts');
    assert.equal(m.noteDate({ title: '2026-09-30 定例' }), '2026-09-30');
    assert.equal(m.noteDate({ title: '定例', createdAt: '2026-08-01T00:00:00Z' }), '2026-08-01');
  });
});

// ── pga-raw の契約 ──────────────────────────────────────────────────────────

describe('pga-raw の組み立て', () => {
  test('RAW 互換形式を満たし、紐付け件数を診断に出す', async () => {
    stub({
      companies: { data: [
        { id: 'c1', name: 'テスト会社', tier: 'TIER1', mrr: { amountMicros: 1000000 }, updatedAt: '2026-09-30T00:00:00Z' },
        { id: 'c2', name: '別会社', updatedAt: '2026-09-30T00:00:00Z' },
      ], pageInfo: { hasNextPage: false } },
      opportunities: { data: [
        { id: 'o1', name: 'PtAI - テスト会社', stage: 'PROPOSAL' },       // exact_name
        { id: 'o2', name: 'PtAI - 知らない会社', stage: 'NEW' },           // unresolved
      ], pageInfo: { hasNextPage: false } },
      notes: { data: [
        { id: 'n1', title: '2026-09-30 テスト会社 定例', bodyV2: { markdown: '本文' } },  // title
        { id: 'n2', title: '無関係な記録' },                                              // unresolved
      ], pageInfo: { hasNextPage: false } },
      workspaceMembers: { data: [{ id: 'm1', name: { firstName: 'A', lastName: 'B' } }], pageInfo: { hasNextPage: false } },
    });
    const m = await load('adapters/ptai-raw.ts');
    const { snapshot, diagnostics } = await m.buildPtaiRawFromTwenty();

    // RAW 互換の形
    assert.ok(Array.isArray(snapshot.companies));
    assert.match(snapshot.fetched, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
    assert.deepEqual(Object.keys(snapshot).sort(), ['companies', 'fetched', 'members', 'unmatchedOpps']);
    const c1 = snapshot.companies.find((c: { cid: string }) => c.cid === 'c1');
    for (const k of ['cid','n','t','ps','m','ind','slug','lay','own','o','asg','icp','aw','src','na','up','url','dom','cs','opp','notes','docs','od']) {
      assert.ok(k in c1, `RAW のキー ${k} が無い`);
    }

    // 紐付け方式の件数
    assert.equal(diagnostics.opportunities.total, 2);
    assert.equal(diagnostics.opportunities.byMethod.exact_name, 1);
    assert.equal(diagnostics.opportunities.byMethod.unresolved, 1);
    assert.equal(diagnostics.opportunities.unresolved, 1);
    assert.equal(diagnostics.notes.byMethod.title, 1);
    assert.equal(diagnostics.notes.unresolved, 1);
    assert.equal(diagnostics.stagePassthrough, true);

    // 紐付かない商談は捨てない
    assert.equal(snapshot.unmatchedOpps.length, 1);

    // stage はそのまま
    assert.equal(c1.opp[0].st, 'PROPOSAL');
  });

  test('**Twenty へ書き込まない**（発行メソッドは GET だけ）', async () => {
    stub({});
    const m = await load('adapters/ptai-raw.ts');
    await m.buildPtaiRawFromTwenty();
    assert.ok(methods.length > 0);
    assert.ok(methods.every(x => x === 'GET'), `GET 以外を発行している: ${[...new Set(methods)].join(',')}`);
  });

  test('**NocoDB へアクセスしない**（Pipeline の pga_docs も含め、呼ぶ URL は Twenty だけ）', async () => {
    stub({});
    const m = await load('adapters/ptai-raw.ts');
    await m.buildPtaiRawFromTwenty();
    const foreign = urls.filter(u => !u.includes('crm.ptengine.com'));
    assert.deepEqual(foreign, [], `Twenty 以外を呼んでいる: ${foreign.join(', ')}`);
    assert.ok(!urls.some(u => /odtable|nocodb/i.test(u)), 'NocoDB を呼んでいる');
  });

  test('companies の取得には PtAI フィルタが載る', async () => {
    stub({});
    const m = await load('adapters/ptai-raw.ts');
    await m.buildPtaiRawFromTwenty();
    const call = urls.find(u => u.includes('/rest/companies'));
    assert.ok(call, 'companies を呼んでいない');
    assert.ok(decodeURIComponent(call).includes('pgaStatus'), `フィルタが落ちている: ${call}`);
  });

  test('一部が失敗しても取れた分を返し、partialFailures に出す', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      methods.push(String(init?.method ?? 'GET'));
      if (url.includes('/rest/metadata/objects')) {
        return json({ data: [{ nameSingular: 'company', fields: [] }], pageInfo: { hasNextPage: false } });
      }
      if (url.includes('/rest/companies')) {
        return json({ data: [{ id: 'c1', name: 'A' }], pageInfo: { hasNextPage: false } });
      }
      if (url.includes('/rest/notes')) return json({ statusCode: 403 }, 403);   // ここだけ失敗
      return json({ data: [], pageInfo: { hasNextPage: false } });
    }) as typeof fetch;

    const m = await load('adapters/ptai-raw.ts');
    const { snapshot, diagnostics } = await m.buildPtaiRawFromTwenty();
    assert.equal(snapshot.companies.length, 1, '取れた企業は返す');
    assert.ok(diagnostics.partialFailures.some((x: string) => x.startsWith('notes:')), 'notes の失敗が出ていない');
  });

  test('診断に顧客名・UUID が含まれない', async () => {
    stub({
      companies: { data: [{ id: '0321d20b-ec31-4a4d-8b2b-188caa9cd497', name: '株式会社テスト' }], pageInfo: { hasNextPage: false } },
    });
    const m = await load('adapters/ptai-raw.ts');
    const { diagnostics } = await m.buildPtaiRawFromTwenty();
    const s = JSON.stringify(diagnostics);
    assert.ok(!s.includes('株式会社テスト'), '診断に社名が含まれる');
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(s), '診断に UUID が含まれる');
    assert.ok(!s.includes(SECRET), '診断にキーが含まれる');
  });
});

// ── 方針の担保 ──────────────────────────────────────────────────────────────

describe('方針', () => {
  test('sourceOfTruth に dashboard は存在しない', async () => {
    const m = await load('sync-policy.ts');
    const all = m.allPolicies();
    const bad = all.filter((p: { sourceOfTruth: string }) => String(p.sourceOfTruth) === 'dashboard');
    assert.deepEqual(bad, [], 'ダッシュボードを正本にしている項目がある');
    for (const p of all) {
      assert.ok(['twenty', 'legacy_nocodb', 'legacy_notion', 'undecided'].includes(p.sourceOfTruth),
        `未知の sourceOfTruth: ${p.sourceOfTruth}`);
    }
  });

  test('既存 Opportunity の stage との対応表は、いまも作らない', async () => {
    const m = await load('sync-policy.ts');
    // ダッシュボードのフェーズは Salesforce に合わせた（2026-10-01）。
    // 既存の **Twenty** Opportunity（5 段階）との対応は依然として不要
    // （Pipeline の商談は testOpportunity と Salesforce が正本）。
    assert.equal(m.STAGE_MAPPING_DECIDED, false);
    assert.equal(m.DASHBOARD_PHASES.length, 11);       // Salesforce のフェーズ（POC は使わない）
    assert.equal(m.TWENTY_STAGES.length, 5);
  });

  test('ダッシュボードのフェーズが twenty-test/schema.ts と一致する', async () => {
    const p = await load('sync-policy.ts');
    const s = await import(new URL('../src/lib/ptai/twenty-test/schema.ts', import.meta.url).href);
    assert.deepEqual([...p.DASHBOARD_PHASES], [...s.STAGES], 'フェーズ定義が 2 箇所でずれている');
    assert.deepEqual(p.DASHBOARD_PHASE_LEGACY, s.STAGE_LEGACY, '旧キーの読み替えがずれている');
  });

  test('データ取得元の既定は legacy_nocodb（今回は切り替えない）', async () => {
    const m = await load('data-source.ts');
    delete process.env.PTAI_DATA_SOURCE;
    assert.equal(m.getPtaiDataSource(), 'legacy_nocodb');
    process.env.PTAI_DATA_SOURCE = 'twenty';
    assert.equal(m.getPtaiDataSource(), 'twenty');
    process.env.PTAI_DATA_SOURCE = 'なにか変な値';
    assert.equal(m.getPtaiDataSource(), 'legacy_nocodb', '未知の値は既定に倒す');
    delete process.env.PTAI_DATA_SOURCE;
  });

  test('移行後に Pipeline から消せる旧依存が列挙されている', async () => {
    const m = await load('sync-policy.ts');
    const deps = m.removableLegacyDeps();
    assert.ok(deps.length > 0);
    assert.ok(deps.some((d: string) => d.includes('pga_docs')), 'pga_docs の依存が挙がっていない');
  });

  test('削除候補は Pipeline のものだけ（CXM のテーブルを挙げていない）', async () => {
    const m = await load('sync-policy.ts');
    // CXM が使い続けるテーブル。1 つでも削除候補に入っていたらスコープ逸脱
    const cxmTables = [
      'companies', 'project_info', 'people', 'company_people', 'company_actions',
      'alerts', 'evidence', 'audit_logs', 'churn_radar', 'cse_tickets',
      'crm_customer_phase', 'csm_customer_phase', 'staff_identify',
    ];
    for (const dep of m.removableLegacyDeps() as string[]) {
      // Pipeline の依存は pga_docs / Notion / 照合フォールバックのいずれか
      const scoped = dep.includes('pga_docs') || dep.includes('Notion') || dep.includes('照合') || dep.includes('スクリプト');
      assert.ok(scoped, `Pipeline 外の依存が挙がっている: ${dep}`);
      for (const t of cxmTables) {
        assert.ok(!new RegExp(`(^|[^_a-z])${t}([^_a-z]|$)`).test(dep),
          `CXM のテーブル（${t}）が削除候補に入っている: ${dep}`);
      }
    }
  });

  test('共通認証の staff_identify は Twenty 集約の対象外', async () => {
    const m = await load('sync-policy.ts');
    const all = m.allPolicies();
    const bad = all.filter((p: { legacyStore: string | null }) =>
      (p.legacyStore ?? '').includes('staff_identify'));
    assert.deepEqual(bad, [], '認証テーブルが移行対象に含まれている');
  });
});
