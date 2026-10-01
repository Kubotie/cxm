// ─── PtAI Pipeline: 会社 1 社ぶんの組み立て ─────────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §0・§D〜§I
//
// ═══════════════════════════════════════════════════════════════════════════
//  画面が要る形に、3 つの出どころをまとめる。
//
//    Notion 顧客管理DB   … アカウント情報の正本（Tier・業種・担当3・MRR・想定追加MRR）
//    Twenty の test*     … 商談・アクション・組織図・サクセス計画・活動記録
//    議事録              … Notion JP_Docs ＋ Mii（Twenty Note）。両方出す
//
//  会社の鍵は **Notion のページ ID**（`notionCompanyId`）。Twenty のリレーションは張らない。
//
//  **どれか 1 つが落ちても、取れた分は返す。** 落ちた系統は `partialFailures` に出す。
//  画面が真っ白になるより、欠けていることが分かるほうがよい。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログ: 件数と種別だけ。顧客名・本文は出さない。

import {
  getCustomer, listCustomers, NotionError, type NotionCustomer,
} from './notion/client';
import {
  OWNER_FROM_NOTION, TIER_FROM_NOTION, INDUSTRY_FROM_NOTION, type KeyDates,
} from './notion/schema';
import { listRecords, TestWriteError } from './twenty-test/client';
import { TEST_OBJECTS, normalizeStage, type Stage } from './twenty-test/schema';
import { listCompanyMinutes, type CompanyMeeting } from './minutes';
import {
  totalMrr, expectedMrr, wonMrr, inDealMrr, stackedMrr, stackBucket,
  backcastMilestones, lateMilestone, dueState,
  type CompanyLike, type StackBucket, type LateMilestone, type DueState,
} from './calc';

// ═══════════════════════════════════════════════════════════════════════════
// 型
// ═══════════════════════════════════════════════════════════════════════════

export interface AccountInfo {
  /** Notion のページ ID。これが会社の鍵 */
  notionPageId:   string;
  name:           string;
  /** ダッシュボードのコード（TIER1 など）。Notion の表記から変換済み */
  tier:           string | null;
  /** ダッシュボードのコード（IT_SAAS など） */
  industry:       string | null;
  /** 主担当の呼称（Paul / Baba …）。Notion の担当3 から変換済み */
  owners:         string[];
  mrr:            number;
  aimMrr:         number;
  billingMonth:   string | null;
  billingStage:   string | null;
  barrier:        string | null;
  nextAction:     string | null;
  nextActionDate: string | null;
  solutionStatus: string | null;
  notionUrl:      string | null;
  /** 楽観ロックに使う。書き込み時にそのまま渡す */
  lastEditedTime: string;
  /** JP_Docs の照会に使う */
  companyRelationIds: string[];
  /** キー日程（決算月・予算策定時期・契約更新月）。§9-4 で Notion が正本 */
  keyDates:       KeyDates;
}

export interface DealView {
  id:        string;
  name:      string;
  stage:     Stage | null;
  pendingStage: Stage | null;
  addMrr:    number;
  applyDate: string | null;
  billingDate: string | null;
  barrier:   string | null;
  need:      string | null;
  isMain:    boolean;
  /** 到達予定。保存値が無ければ申込完了日から逆算した値 */
  milestones: { TRIAL: string | null; QUOTE: string | null; VERBAL_COMMIT: string | null };
  /** 保存値そのまま（逆算で埋めたかを見分けるため） */
  milestonesStored: { TRIAL: string | null; QUOTE: string | null; VERBAL_COMMIT: string | null };
  /** 予定より遅れているか */
  late: LateMilestone | null;
  /** 承認待ちがあるか */
  pending: { edit: boolean; delete: boolean; stage: boolean };
}

export interface ActionView {
  id:       string;
  kind:     string | null;
  title:    string;
  dueDate:  string | null;
  status:   string | null;
  lane:     string | null;
  due:      DueState;
  opportunityId: string | null;
}

export interface CompanyKpi {
  total:    number;
  expected: number;
  won:      number;
  inDeal:   number;
  stacked:  number;
  bucket:   StackBucket;
}

export interface CompanyDetail {
  account:    AccountInfo;
  deals:      DealView[];
  actions:    ActionView[];
  org:        Record<string, unknown>[];
  plans:      Record<string, unknown>[];
  activities: Record<string, unknown>[];
  minutes:    CompanyMeeting[];
  kpi:        CompanyKpi;
  diagnostics: {
    partialFailures: string[];
    minutes: { byRelation: number; byTitle: number; mii: number; titleMatchSkipped: boolean };
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 変換
// ═══════════════════════════════════════════════════════════════════════════

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const numOr0 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const dateOnly = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.slice(0, 10) : null;
};

export function toAccountInfo(c: NotionCustomer): AccountInfo {
  return {
    notionPageId:   c.pageId,
    name:           c.name,
    tier:           c.tier ? TIER_FROM_NOTION[c.tier] ?? null : null,
    industry:       c.industry ? INDUSTRY_FROM_NOTION[c.industry] ?? null : null,
    owners:         c.owners3.map(o => OWNER_FROM_NOTION[o] ?? o),
    mrr:            c.mrr ?? 0,
    aimMrr:         c.aimMrr ?? 0,
    billingMonth:   c.billingMonth,
    billingStage:   c.billingStage,
    barrier:        c.barrier,
    nextAction:     c.nextAction,
    nextActionDate: c.nextActionDate ? c.nextActionDate.slice(0, 10) : null,
    solutionStatus: c.solutionStatus,
    notionUrl:      c.url,
    keyDates:       c.keyDates,
    lastEditedTime: c.lastEditedTime,
    companyRelationIds: c.companyRelation,
  };
}

function toDealView(row: Record<string, unknown>): DealView {
  const stage = normalizeStage(row.stage);
  const stored = {
    TRIAL:         dateOnly(row.msTrial),
    QUOTE:         dateOnly(row.msQuote),
    VERBAL_COMMIT: dateOnly(row.msVerbal),
  };
  const back = backcastMilestones({
    applyDate:   dateOnly(row.applyDate),
    billingDate: dateOnly(row.billingDate),
    msBase:      (row.msBase as 'apply' | 'bill' | null) ?? 'apply',
  });
  // 保存値を優先し、無いところだけ逆算で埋める
  const milestones = {
    TRIAL:         stored.TRIAL ?? back.TRIAL,
    QUOTE:         stored.QUOTE ?? back.QUOTE,
    VERBAL_COMMIT: stored.VERBAL_COMMIT ?? back.VERBAL_COMMIT,
  };
  return {
    id:           str(row.id),
    name:         str(row.name),
    stage,
    pendingStage: normalizeStage(row.pendingStage),
    addMrr:       numOr0(row.addMrr),
    applyDate:    dateOnly(row.applyDate),
    billingDate:  dateOnly(row.billingDate),
    barrier:      str(row.barrier) || null,
    need:         str(row.need) || null,
    isMain:       row.isMain === true,
    milestones,
    milestonesStored: stored,
    late:         lateMilestone(stage, milestones, startOfToday()),
    pending: {
      edit:   row.pendingEdit != null,
      delete: row.pendingDelete != null,
      stage:  normalizeStage(row.pendingStage) !== null,
    },
  };
}

function toActionView(row: Record<string, unknown>): ActionView {
  const dueDate = dateOnly(row.dueDate);
  return {
    id:      str(row.id),
    kind:    str(row.kind) || null,
    title:   str(row.title) || str(row.name),
    dueDate,
    status:  str(row.status) || null,
    lane:    str(row.lane) || null,
    due:     dueState(dueDate, startOfToday()),
    opportunityId: str(row.opportunityId) || null,
  };
}

/** 時刻を落とした今日。日付比較を安定させる */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 会社の代表フェーズ。main の商談を優先し、無ければ最も進んだ商談 */
export function representativeStage(deals: DealView[]): Stage | null {
  if (!deals.length) return null;
  const main = deals.find(d => d.isMain);
  if (main) return main.stage;
  const open = deals.filter(d => d.stage && d.stage !== 'CLOSED_LOST');
  return (open[0] ?? deals[0]).stage;
}

/** calc が要る形に落とす */
export function toCompanyLike(account: AccountInfo, deals: DealView[]): CompanyLike {
  const live = deals.filter(d => d.stage !== 'CLOSED_LOST');
  return {
    mrr:    account.mrr,
    aimMrr: account.aimMrr,
    stage:  representativeStage(deals),
    addMrr: live.reduce((s, d) => s + d.addMrr, 0),
    owners: account.owners,
    deals:  live.map(d => ({ stage: d.stage, addMrr: d.addMrr, billingDate: d.billingDate })),
  };
}

function kpiOf(c: CompanyLike): CompanyKpi {
  return {
    total:    totalMrr(c),
    expected: expectedMrr(c),
    won:      wonMrr(c),
    inDeal:   inDealMrr(c),
    stacked:  stackedMrr(c),
    bucket:   stackBucket(c),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 取得
// ═══════════════════════════════════════════════════════════════════════════

const kindOf = (e: unknown): string =>
  (e as NotionError | TestWriteError)?.kind ?? 'error';

/** test* を notionCompanyId で引く小さなヘルパー */
async function byCompany(
  key: keyof typeof TEST_OBJECTS, notionPageId: string, failures: string[],
): Promise<Record<string, unknown>[]> {
  const o = TEST_OBJECTS[key];
  try {
    return await listRecords(o.plural, o.singular, {
      filter: `notionCompanyId[eq]:${notionPageId}`,
      pageSize: 200,
      maxRecords: 500,
    });
  } catch (e) {
    failures.push(`${o.plural}:${kindOf(e)}`);
    return [];
  }
}

export interface GetCompanyDetailInput {
  notionPageId: string;
  /** 議事録の取得件数（出どころごと）。0 なら引かない */
  minutesLimit?: number;
}

/**
 * 会社 1 社ぶんをまとめて返す。
 * Notion のアカウント情報が取れなければ失敗（会社そのものが特定できないため）。
 * それ以外は落ちても取れた分を返す。
 */
export async function getCompanyDetail(input: GetCompanyDetailInput): Promise<CompanyDetail> {
  const partialFailures: string[] = [];
  const account = toAccountInfo(await getCustomer(input.notionPageId));

  const [dealRows, actionRows, orgRows, planRows, activityRows] = await Promise.all([
    byCompany('opportunity',  account.notionPageId, partialFailures),
    byCompany('action',       account.notionPageId, partialFailures),
    byCompany('person',       account.notionPageId, partialFailures),
    byCompany('accountPlan',  account.notionPageId, partialFailures),
    byCompany('activity',     account.notionPageId, partialFailures),
  ]);

  const deals = dealRows.map(toDealView)
    // 進行中 → 受注 → 失注 の順（§F の並び順）
    .sort((a, b) => rankForSort(a.stage) - rankForSort(b.stage));

  const limit = input.minutesLimit ?? 6;
  let minutes: CompanyMeeting[] = [];
  let minutesDiag = { byRelation: 0, byTitle: 0, mii: 0, titleMatchSkipped: false };
  if (limit > 0) {
    const r = await listCompanyMinutes({
      companyRelationIds: account.companyRelationIds,
      companyName: account.name,
      limitPerSource: limit,
    });
    minutes = r.meetings;
    minutesDiag = {
      byRelation: r.diagnostics.notion.byRelation,
      byTitle:    r.diagnostics.notion.byTitle,
      mii:        r.diagnostics.mii.total,
      titleMatchSkipped: r.diagnostics.titleMatchSkipped,
    };
    partialFailures.push(...r.diagnostics.partialFailures);
  }

  const kpi = kpiOf(toCompanyLike(account, deals));

  console.info('[ptai/repository] 会社詳細', JSON.stringify({
    deals: deals.length, actions: actionRows.length, org: orgRows.length,
    plans: planRows.length, activities: activityRows.length,
    minutes: minutes.length, partialFailures: partialFailures.length,
  }));

  return {
    account,
    deals,
    actions: actionRows.map(toActionView),
    org: orgRows,
    plans: planRows,
    activities: activityRows,
    minutes,
    kpi,
    diagnostics: { partialFailures, minutes: minutesDiag },
  };
}

/** 並び順: 進行中 → 受注 → 失注 */
function rankForSort(s: Stage | null): number {
  if (s === 'CLOSED_LOST') return 2;
  if (s === 'CLOSED_WON') return 1;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 一覧（トップ画面）
// ═══════════════════════════════════════════════════════════════════════════

export interface CompanySummary {
  account: AccountInfo;
  stage:   Stage | null;
  addMrr:  number;
  dealCount: number;
  kpi:     CompanyKpi;
}

/**
 * 全社ぶんの軽い ViewModel。KPI・企業一覧・ゲージに使う。
 * 商談は**会社ごとに引かず 1 回で全件取って束ねる**（125 社ぶん個別に引くと遅い）。
 */
export async function listCompanySummaries(): Promise<{
  companies: CompanySummary[];
  partialFailures: string[];
}> {
  const partialFailures: string[] = [];

  const customers = await listCustomers({ maxPages: 20 });

  let dealRows: Record<string, unknown>[] = [];
  try {
    const o = TEST_OBJECTS.opportunity;
    dealRows = await listRecords(o.plural, o.singular, { pageSize: 200, maxRecords: 5000 });
  } catch (e) {
    partialFailures.push(`${TEST_OBJECTS.opportunity.plural}:${kindOf(e)}`);
  }

  const byCompanyId = new Map<string, DealView[]>();
  for (const row of dealRows) {
    const key = str(row.notionCompanyId);
    if (!key) continue;
    const list = byCompanyId.get(key) ?? [];
    list.push(toDealView(row));
    byCompanyId.set(key, list);
  }

  const companies = customers.map(c => {
    const account = toAccountInfo(c);
    const deals = (byCompanyId.get(account.notionPageId) ?? [])
      .sort((a, b) => rankForSort(a.stage) - rankForSort(b.stage));
    const like = toCompanyLike(account, deals);
    return {
      account,
      stage:     like.stage ?? null,
      addMrr:    like.addMrr,
      dealCount: deals.length,
      kpi:       kpiOf(like),
    };
  });

  console.info('[ptai/repository] 一覧', JSON.stringify({
    companies: companies.length, deals: dealRows.length, partialFailures: partialFailures.length,
  }));

  return { companies, partialFailures };
}
