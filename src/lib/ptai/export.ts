// ─── PtAI Pipeline の全データ書き出し ───────────────────────────────────────
//
// 画面が持っているものを、**分析しやすい形に組み直して**まとめて返す。
// 画面は RAW（会社）と db（商談・サクセス・組織図…）を別々に読んで頭の中で
// 結合しているが、外から見るときに 2 本を突き合わせるのは面倒なので、
// ここで会社を軸に 1 本に畳む。
//
// ═══════════════════════════════════════════════════════════════════════════
//  **読み取り専用。** 取得元は画面とまったく同じ（kpi-source.ts と同じ 2 本）で、
//  ここでは何も書かない。数値は kpi.ts の式をそのまま使うので、画面と一致する。
//
//  顧客名・商談名・議事録の本文を**含む**。読み取り専用トークン
//  （PTAI_READ_TOKEN）か、ログイン済みのセッションでしか通らない経路から呼ぶこと。
//  ログには件数しか出さない。
// ═══════════════════════════════════════════════════════════════════════════

import { buildRawFromNewSources } from './raw-view';
import { buildDbView } from './db-view';
import { STAGES, STAGE_JP, type Stage } from './twenty-test/schema';
import {
  FORECAST, m2, m3, wonAmt, atLeast, rung, planOf, computeKpis, type KpiCompany, type KpiDeal,
} from './kpi';
import { MEMBERS } from './kpi-source';
import { todayJst } from './kpi-snapshot';

/** 画面のフェーズ名（社内の言い方）。board.js の PH_JA と同じ */
export const STAGE_NOTE: Record<string, string> = {
  INACTIVE: '', ACTIVE: '初回アポ実施前', GOAL_SHARED: '初回アポ実施済み',
  QUALIFIED_CHAMPION: 'トライアル開始済み', EVALUATING: 'トライアル運用評価段階',
  PROBABLE: '最終見積もり提示済み', VERBAL: '口頭合意獲得済み', WON: '申込用紙回収済み',
  CLOSED_WON: '契約締結済み', ADMIN_CLOSE: '', CLOSED_LOST: '失注',
};

/** 何を含めるか。重いものは既定で外してある */
export const INCLUDES = [
  'deals', 'kpi', 'logs', 'success', 'org', 'minutes', 'notes', 'docs', 'recent', 'feed',
] as const;
export type Include = (typeof INCLUDES)[number];
export const DEFAULT_INCLUDES: Include[] = ['deals', 'kpi'];

export interface ExportFilter {
  include?: Include[];
  /** 担当者で絞る */
  owner?: string;
  /** フェーズで絞る（その商談を持つ会社だけ残す） */
  stage?: string;
  /** 会社の Notion ページ ID */
  cid?: string;
  /** 社名の部分一致 */
  q?: string;
  /** 商談のある会社だけ */
  withDeals?: boolean;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const stageOf = (v: unknown): string => STAGES.includes(str(v) as Stage) ? str(v) : 'INACTIVE';

export async function buildExport(f: ExportFilter = {}) {
  const inc = new Set<Include>(f.include?.length ? f.include : DEFAULT_INCLUDES);
  const today = todayJst();
  const [raw, db] = await Promise.all([buildRawFromNewSources(), buildDbView()]);

  const byId = <T>(rows: Array<{ id: string; data: unknown }>) =>
    new Map<string, T>(rows.map(r => [r.id, r.data as T]));
  const edits   = byId<Record<string, unknown>>(db.collections.edits   ?? []);
  const aplans  = byId<unknown>(db.collections.aplans  ?? []);
  const orgs    = byId<unknown>(db.collections.orgs    ?? []);
  const recents = byId<unknown>(db.collections.recent  ?? []);
  const minutes = byId<unknown>(db.collections.minutes ?? []);

  // ── 会社を軸に畳む ────────────────────────────────────────────────────────
  const companies = (raw.snapshot.companies ?? []).map(c => {
    const e  = edits.get(c.cid) ?? {};
    const co = (e.company ?? {}) as Record<string, unknown>;

    const deals = arr(e.deals)
      .filter((x): x is Record<string, unknown> => !!x && !!str((x as Record<string, unknown>).key))
      .map(x => {
        const stage = stageOf(x.phase);
        const naDate = str(x.naDate).slice(0, 10) || null;
        const d: Record<string, unknown> = {
          key:        str(x.key),
          name:       str(x.name) || null,
          stage,
          stageLabel: STAGE_JP[stage as Stage] ?? stage,
          // 社内の言い方（画面でフェーズ名の下に小さく出しているもの）
          stageNote:  STAGE_NOTE[stage] || null,
          /** ②（商談）追加MRR。円 */
          addMrr:     num(x.addMrr),
          /** ③ に使う係数 */
          forecast:   FORECAST[stage] ?? 0,
          /** ③（見込）追加MRR ＝ addMrr × forecast */
          expected:   num(x.addMrr) * (FORECAST[stage] ?? 0),
          applyDate:   str(x.applyDate)   || null,
          billingDate: str(x.billingDate) || null,
          termMonths:  x.term ?? null,
          barrier:     str(x.barrier) || null,
          need:        str(x.need)    || null,
          nextAction:     str(x.na)   || null,
          nextActionDate: naDate,
          /** ネクストアクションの期日が過ぎている */
          overdue: !!(str(x.na) && naDate && naDate < today
                      && !['CLOSED_WON', 'CLOSED_LOST'].includes(stage)),
          /** 到達予定（TRIAL / QUOTE / VERBAL_COMMIT） */
          milestones: x.ms ?? null,
          msBase:     str(x.msBase) || 'apply',
          /** Salesforce へ送れていない項目 */
          sfPending:  str(x.sfPending) || null,
          /** 承認待ちのフェーズ変更 */
          pendingStage: x.pendingPhase ?? null,
          updatedAt:  str(x.updatedAt) || null,
          /** Salesforce の商談から取り込んだもの */
          fromSalesforce: str(x.key).startsWith('sf:'),
        };
        if (inc.has('logs')) d.logs = arr(x.log);
        return d;
      });

    const out: Record<string, unknown> = {
      cid:  c.cid,
      name: c.n,
      tier: c.t,
      industry: c.ind,
      /** Ptengine AI ステータス */
      status: c.ps,
      owners: c.o,
      /** 現在MRR（毎朝 Company Database から同期） */
      currentMrr: num(c.m),
      /** 期初MRR。積み上げの土台 */
      baseMrr: typeof c.bm === 'number' ? c.bm : num(c.m),
      /** ①（目標）追加MRR */
      aimMrr: num(co.aim),
      sfAccountId: c.sfid,
      url: c.url, domain: c.dom,
      customerSuccess: c.cs,
      icp: c.icp, awareness: c.aw, source: c.src,
      /** Notion 顧客管理DB のネクストアクション履歴（生の文字列） */
      notionNextAction: c.na,
      updatedAt: c.up,
      keyDates: co.keyDates ?? null,
    };

    if (inc.has('deals'))  out.deals = deals;
    if (inc.has('success')) out.success = aplans.get(c.cid) ?? null;
    if (inc.has('org'))     out.org     = orgs.get(c.cid) ?? null;
    if (inc.has('recent'))  out.aiSummary = recents.get(c.cid) ?? null;
    if (inc.has('minutes')) out.minutes = minutes.get(c.cid) ?? null;
    if (inc.has('notes'))   out.notes   = c.notes ?? [];
    if (inc.has('docs'))    out.docs    = [...(c.docs ?? []), ...(c.od ?? [])];

    if (inc.has('kpi')) {
      const k = toKpiCompany(c.cid, c.o, num(c.m),
        typeof c.bm === 'number' ? c.bm : num(c.m), num(co.aim), deals);
      const plan = planOf(k);
      out.kpi = {
        /** ②（商談）追加MRR の合計 */
        dealMrr: m2(k),
        /** ③（見込）追加MRR の合計 */
        expected: m3(k),
        wonMrr: wonAmt(k),
        /** 合算MRR。期初MRR ＋ ② */
        pipeline: rung(k, m2(k)),
        commit:    rung(k, atLeast(k, 'PROBABLE')),
        challenge: rung(k, atLeast(k, 'QUALIFIED_CHAMPION')),
        won:       rung(k, wonAmt(k)),
        /** 計画に入っていれば 期初MRR ＋ 追加分、入っていなければ null */
        plan: plan ? plan.base + plan.add : null,
        openDeals: deals.filter(d => !['CLOSED_LOST', 'ADMIN_CLOSE'].includes(String(d.stage))).length,
        overdue:   deals.filter(d => d.overdue).length,
      };
    }
    return out;
  });

  // ── 絞り込み ──────────────────────────────────────────────────────────────
  const dealsOf = (c: Record<string, unknown>) => arr(c.deals) as Array<Record<string, unknown>>;
  let rows = companies;
  if (f.cid)   rows = rows.filter(c => c.cid === f.cid);
  if (f.owner) rows = rows.filter(c => (c.owners as string[]).includes(f.owner!));
  if (f.q)     rows = rows.filter(c => String(c.name).includes(f.q!));
  if (f.stage) rows = rows.filter(c => dealsOf(c).some(d => d.stage === f.stage));
  if (f.withDeals) rows = rows.filter(c => dealsOf(c).length > 0);

  // ── 全体の数字（絞り込んだあとの集合で出す）──────────────────────────────
  const t = (db.collections.settings ?? []).find(s => s.id === 'targets')?.data as
    { targetMrr?: unknown; targetDue?: unknown; targets?: unknown } | undefined;
  const targets = (t?.targets ?? {}) as Record<string, unknown>;
  const kpiCos: KpiCompany[] = rows.map(c => toKpiCompany(
    String(c.cid), c.owners as string[], num(c.currentMrr), num(c.baseMrr), num(c.aimMrr),
    dealsOf(c)));
  const totals = [
    computeKpis(kpiCos, { scope: 'team', targetMrr: num(t?.targetMrr) || 40_000_000, today }),
    ...MEMBERS.map(m => computeKpis(kpiCos, { scope: m, targetMrr: num(targets[m]), today })),
  ];

  const result: Record<string, unknown> = {
    ok: true,
    generatedAt: new Date().toISOString(),
    today,
    include: [...inc],
    filter: { owner: f.owner ?? null, stage: f.stage ?? null, cid: f.cid ?? null,
              q: f.q ?? null, withDeals: !!f.withDeals },
    target: { mrr: num(t?.targetMrr) || 40_000_000, due: str(t?.targetDue) || null, byMember: targets },
    members: MEMBERS,
    stages: STAGES.map(s => ({ key: s, label: STAGE_JP[s], note: STAGE_NOTE[s] || null, forecast: FORECAST[s] ?? 0 })),
    totals,
    counts: {
      companies: rows.length,
      deals: rows.reduce((s, c) => s + dealsOf(c).length, 0),
      allCompanies: companies.length,
    },
    companies: rows,
    partialFailures: [...raw.diagnostics.partialFailures, ...db.diagnostics.partialFailures],
  };
  if (inc.has('feed')) result.operationLog = (db.collections.feed ?? []).map(r => r.data);
  return result;
}

function toKpiCompany(
  cid: string, owners: string[], curMrr: number, baseMrr: number, aim: number,
  deals: Array<Record<string, unknown>>,
): KpiCompany {
  const ds: KpiDeal[] = deals.map(d => ({
    stage:  String(d.stage ?? 'INACTIVE'),
    addMrr: num(d.addMrr),
    na:     (d.nextAction as string | null) ?? null,
    naDate: (d.nextActionDate as string | null) ?? null,
  }));
  return { cid, owners: owners ?? [], curMrr, baseMrr, aim, deals: ds };
}
