// ─── 現在MRR / 期初MRR の取り回し ──────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     --test scripts/ptai-mrr.test.mts
//
// ネットワークは使わない。2026-10-01 の決定（⚠️MRR をやめる）を固定する。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toAccountInfo } from '../src/lib/ptai/repository.ts';
import { CUSTOMER_PROP, COMPANY_DB_PROP, NOTION_SOURCES, CUSTOMER_READONLY_PROPS }
  from '../src/lib/ptai/notion/schema.ts';
import { indexCompanies } from '../src/lib/ptai/notion/company-db.ts';

const base = {
  pageId: 'p1', url: null, lastEditedTime: '2026-10-01T00:00:00.000Z',
  name: '某社', tier: null, industry: null, owners3: [],
  mrr: null, curMrr: null, baseMrr: null, aimMrr: null,
  billingMonth: null, billingStage: null, barrier: null,
  nextAction: null, nextActionDate: null, solutionStatus: null,
  companyRelation: [], sfAccountId: null,
  keyDates: { fiscalMonth: null, budgetMonths: null, renewalMonth: null },
} as const;

// ── 現在MRR の優先順位 ─────────────────────────────────────────────────────

test('同期済みの 現在MRR を ⚠️MRR より優先する', () => {
  const a = toAccountInfo({ ...base, mrr: 100_000, curMrr: 250_000 });
  assert.equal(a.mrr, 250_000, '⚠️MRR の古い値を使ってはいけない');
});

test('同期がまだ付いていない会社だけ ⚠️MRR に落ちる', () => {
  // Company Database に見つからなかった 7 社がこれにあたる
  assert.equal(toAccountInfo({ ...base, mrr: 100_000, curMrr: null }).mrr, 100_000);
});

test('どちらも無ければ 0', () => {
  assert.equal(toAccountInfo({ ...base }).mrr, 0);
});

test('現在MRR が 0 円なら 0 円を使う（⚠️MRR に落ちない）', () => {
  // Company Database にあって MRR 0 円の 14 社。ここで ⚠️MRR に落ちると復活してしまう
  assert.equal(toAccountInfo({ ...base, mrr: 900_000, curMrr: 0 }).mrr, 0);
});

// ── 期初MRR ────────────────────────────────────────────────────────────────

test('期初MRR はそのまま通る', () => {
  assert.equal(toAccountInfo({ ...base, curMrr: 733_333, baseMrr: 438_504 }).baseMrr, 438_504);
});

test('期初MRR が無い会社は増減 0 になるよう現在MRR と同じにする', () => {
  const a = toAccountInfo({ ...base, curMrr: 250_000, baseMrr: null });
  assert.equal(a.baseMrr, a.mrr, '増減（m − bm）が 0 になること');
});

// ── Company Database の索引 ────────────────────────────────────────────────

test('Salesforce Account ID と社名の両方で引ける', () => {
  const i = indexCompanies([{ sfId: '001X', name: 'A社', mrr: 100 }]);
  assert.equal(i.bySfId.get('001X'), 100);
  assert.equal(i.byName.get('A社'), 100);
  assert.equal(i.duplicates, 0);
});

test('同じ鍵が複数行あっても足さない（いちばん大きい値を採る）', () => {
  // Company Database は同じ会社の行が複数ある（旧社名・プロジェクトごとの写しなど）。
  // mrr は Account の値が各行に同じく写っているだけなので、足すと社数ぶん膨らむ。
  // 2026-10-02 に 62万の会社が 125万 になっていた。
  const i = indexCompanies([
    { sfId: '001X', name: '旧A社', mrr: 624800 },
    { sfId: '001X', name: 'A社',   mrr: 624800 },
  ]);
  assert.equal(i.bySfId.get('001X'), 624800, '足してはいけない');
  assert.equal(i.duplicates, 1, '社名は違うので Salesforce ID でだけぶつかる');
  assert.equal(i.conflicts, 0, '金額は同じなので食い違いではない');
});

test('金額が食い違う重複は大きい方を採り、conflicts に数える', () => {
  const i = indexCompanies([
    { sfId: '001Y', name: 'B社', mrr: 1_382_304 },
    { sfId: '001Y', name: 'B社', mrr: 1_428_867 },
  ]);
  assert.equal(i.bySfId.get('001Y'), 1_428_867);
  assert.ok(i.conflicts >= 1);
});

test('行の順番で結果が変わらない', () => {
  const a = indexCompanies([{ sfId: '1', name: 'x', mrr: 10 }, { sfId: '1', name: 'x', mrr: 90 }]);
  const b = indexCompanies([{ sfId: '1', name: 'x', mrr: 90 }, { sfId: '1', name: 'x', mrr: 10 }]);
  assert.equal(a.bySfId.get('1'), b.bySfId.get('1'));
});

test('鍵が空の行は索引に入れない', () => {
  const i = indexCompanies([{ sfId: '', name: '', mrr: 100 }]);
  assert.equal(i.bySfId.size, 0);
  assert.equal(i.byName.size, 0);
});

// ── 名前の取り違え防止 ─────────────────────────────────────────────────────

test('プロパティ名を固定する（Notion 側を直したらここも直す）', () => {
  assert.equal(CUSTOMER_PROP.curMrr, '現在MRR');
  assert.equal(CUSTOMER_PROP.baseMrr, '期初MRR');
  assert.equal(CUSTOMER_PROP.mrr, '⚠️MRR');
  assert.equal(COMPANY_DB_PROP.mrr, 'mrr');
  assert.equal(COMPANY_DB_PROP.sfId, 'company_id');
  assert.equal(COMPANY_DB_PROP.name, 'company_name');
  assert.equal(NOTION_SOURCES.companyDb, '7358bc25-cfde-44eb-8e7b-c24aa7088a92');
});

test('現在MRR・期初MRR は画面から書けない（同期だけが書く）', () => {
  assert.ok(CUSTOMER_READONLY_PROPS.includes('現在MRR'));
  assert.ok(CUSTOMER_READONLY_PROPS.includes('期初MRR'));
});

// ── 1 社を複数行に分ける（2026-10-02）────────────────────────────────────────
//
// ビズリーチ ToB/ToC、マネーフォワード アカウント1/2 のように、Company Database
// では 1 行の会社を PtAI 側で分けて持つケース。会社単位の MRR をそのまま両方に
// 入れると行の数だけ重なる（実際に 1,702,580 円ぶん重なっていた）。

test('対象プロジェクトID を読み取れる（区切りは , 、 空白）', async () => {
  const { parseProjectIds } = await import('../src/lib/ptai/bi/project-mrr.ts');
  assert.deepEqual(parseProjectIds('5d7bb68e'), ['5d7bb68e']);
  assert.deepEqual(parseProjectIds('5d7bb68e, 1c53hb20'), ['5d7bb68e', '1c53hb20']);
  assert.deepEqual(parseProjectIds('5d7bb68e、1c53hb20'), ['5d7bb68e', '1c53hb20']);
  assert.deepEqual(parseProjectIds('5d7bb68e 1c53hb20'), ['5d7bb68e', '1c53hb20']);
});

test('空・未設定は空の配列（従来どおり会社単位に落ちる）', async () => {
  const { parseProjectIds } = await import('../src/lib/ptai/bi/project-mrr.ts');
  for (const v of ['', '  ', ',', '、', null, undefined]) {
    assert.deepEqual(parseProjectIds(v), [], JSON.stringify(v));
  }
});

test('NotionCustomer に projectIds が入る', () => {
  assert.deepEqual(toAccountInfo({ ...base }).notionPageId, 'p1');
  assert.equal(CUSTOMER_PROP.projectIds, '対象プロジェクトID');
  // 同期だけが現在MRR を書く。対象プロジェクトID は人が Notion で入れる
  assert.ok(CUSTOMER_READONLY_PROPS.includes('対象プロジェクトID'));
});
