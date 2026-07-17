// ─── 解約遡及分析（Churn Retrospective） ──────────────────────────────────────
//
// 直近の Package-Churn イベントに紐づく企業について、解約日の 30 / 60 / 90 日前の
// 日次スナップショットを読み出し、その時点で「予兆シグナル」が出ていたかを集計する。
//
// データ源:
//   - Package-Churn: Metabase CSV (src/lib/metabase/package-events.ts)
//   - スナップショット: NocoDB company_daily_snapshot (src/lib/nocodb/company-snapshot.ts)
//   - sfId → company_uid: NocoDB companies テーブル
//
// 予兆判定（スナップショット単位）:
//   - overall_health が 'at_risk' | 'critical' なら warning
//   - stalled_project_count > 0 なら warning
//   - open_support_count    > 0 なら warning
//
// 「d90 → d60 → d30」の順で見て、最も早くフラグが立った時点を
// firstWarningAt に記録する。

import {
  fetchChurnEventsWithinWindow,
  fetchPrecedingEventsBySfId,
  type PackageEvent,
} from '@/lib/metabase/package-events';
import { fetchSnapshotsByDate, type CompanyDailySnapshot } from '@/lib/nocodb/company-snapshot';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import type { RawCompany } from '@/lib/nocodb/types';

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type WarningPoint = 'd30' | 'd60' | 'd90' | 'none';

export interface SnapshotWarning {
  snapshotDate:         string;
  overallHealth:        string | null;
  mPhase:               string | null;
  mrr:                  number | null;
  openSupportCount:     number | null;
  stalledProjectCount:  number | null;
  activeProjectCount:   number | null;
  totalL30Active:       number | null;
  reasons:              string[];
  isWarning:            boolean;
}

/**
 * Metabase Package events から抽出した「churn 前90日の予兆」
 */
export interface MetabaseSignal {
  precedingEventCount:      number;
  hadDownsell:              boolean;   // 90日以内に Package-Downsell あり
  hadTrialRegression:       boolean;   // 90日以内に Package-Trial あり (PAID→TRIAL)
  hadPriorChurnOnSameSfId:  boolean;   // 同 sfId で先行 Churn (別プロジェクト解約)
  precedingEvents: Array<{
    statDate:    string;
    changeType:  string;
    daysBefore:  number;   // churn 日からの日数（正の整数）
    projectName: string | null;
  }>;
  /** シグナルの中で最も早いイベントの churn 日からの日数（無ければ null） */
  earliestSignalDaysBefore: number | null;
  /** 予兆ありフラグ (Downsell OR Trial OR PriorChurn のいずれか) */
  hasWarning: boolean;
}

export interface ChurnedCompanyResult {
  sfAccountId:      string;
  companyUid:       string | null;
  canonicalName:    string | null;
  isCsmManaged:     boolean | null;
  tier:             1 | 2 | 3 | 5 | null;
  companyStatus:    string | null;
  ownerName:        string | null;
  churnDate:        string;
  projectName:      string | null;
  paidStatus:       string;
  snapshots: {
    d30: SnapshotWarning | null;
    d60: SnapshotWarning | null;
    d90: SnapshotWarning | null;
  };
  firstWarningAt:   WarningPoint;
  metabase:         MetabaseSignal;
}

export interface ChurnRetrospectiveReport {
  window: {
    from:      string;
    to:        string;
    days:      number;
  };
  churnEvents: {
    total:          number;
    mapped:         number;
    unmapped:       number;
    csmManaged:     number;
    snapshotFound:  number;
  };
  aggregate: {
    firstWarningAtD90: number;
    firstWarningAtD60: number;
    firstWarningAtD30: number;
    neverWarning:      number;
    warningRateD90:    number;
    warningRateD60:    number;
    warningRateD30:    number;
    signals: {
      healthAtRiskOrCritical: { d30: number; d60: number; d90: number };
      hadStalledProjects:     { d30: number; d60: number; d90: number };
      hadOpenSupport:         { d30: number; d60: number; d90: number };
    };
    metabase: {
      /** 予兆ありと判定できた社数（Downsell / Trial / PriorChurn のいずれか） */
      warningCount:            number;
      warningRate:             number;
      hadDownsellCount:        number;
      hadTrialRegressionCount: number;
      hadPriorChurnCount:      number;
      /** 予兆イベントの平均リードタイム（日）*/
      avgEarliestDaysBefore:   number | null;
    };
    byTier: Array<{
      tier: number | null;
      count: number;
      warningCountSnapshot: number;
      warningCountMetabase: number;
    }>;
  };
  perCompany: ChurnedCompanyResult[];
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function nDaysBefore(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function evaluateSnapshot(snap: CompanyDailySnapshot | null): SnapshotWarning | null {
  if (!snap) return null;
  const reasons: string[] = [];
  const health = snap.overall_health;
  if (health === 'at_risk' || health === 'critical') {
    reasons.push(`overall_health=${health}`);
  }
  if ((snap.stalled_project_count ?? 0) > 0) {
    reasons.push(`stalled_project_count=${snap.stalled_project_count}`);
  }
  if ((snap.open_support_count ?? 0) > 0) {
    reasons.push(`open_support_count=${snap.open_support_count}`);
  }
  return {
    snapshotDate:        snap.snapshot_date,
    overallHealth:       snap.overall_health,
    mPhase:              snap.m_phase,
    mrr:                 snap.mrr,
    openSupportCount:    snap.open_support_count,
    stalledProjectCount: snap.stalled_project_count,
    activeProjectCount:  snap.active_project_count,
    totalL30Active:      snap.total_l30_active,
    reasons,
    isWarning:           reasons.length > 0,
  };
}

interface CompanyMeta {
  companyUid:    string;
  canonicalName: string | null;
  isCsmManaged:  boolean | null;
  tier:          1 | 2 | 3 | 5 | null;
  companyStatus: string | null;
  ownerName:     string | null;
}

function normalizeTier(raw: unknown): 1 | 2 | 3 | 5 | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return (n === 1 || n === 2 || n === 3 || n === 5) ? n : null;
}

async function buildSfIdReverseMap(sfIds: string[]): Promise<Map<string, CompanyMeta>> {
  const result = new Map<string, CompanyMeta>();
  if (sfIds.length === 0 || !TABLE_IDS.companies) return result;

  const unique = Array.from(new Set(sfIds));
  const where  = `(sf_account_id,in,${unique.join(',')})`;
  try {
    const rows = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
      where,
      fields: 'company_uid,sf_account_id,canonical_name,is_csm_managed,tier,status,owner_name',
      limit:  String(unique.length + 20),
    }, false);
    for (const row of rows) {
      const sfId = row.sf_account_id?.toString().trim();
      const uid  = row.company_uid?.trim();
      if (!sfId || !uid) continue;
      const rawManaged: unknown = row.is_csm_managed;
      const isCsmManaged =
        rawManaged === true || rawManaged === 'true' || rawManaged === 1 ? true
        : rawManaged === false || rawManaged === 'false' || rawManaged === 0 ? false
        : null;
      if (!result.has(sfId)) {
        result.set(sfId, {
          companyUid:    uid,
          canonicalName: row.canonical_name?.trim() ?? null,
          isCsmManaged,
          tier:          normalizeTier(row.tier),
          companyStatus: row.status?.trim() ?? null,
          ownerName:     row.owner_name?.trim() ?? null,
        });
      }
    }
  } catch {
    // 空マップで返す
  }
  return result;
}

// ── メイン ───────────────────────────────────────────────────────────────────

/**
 * 直近 `windowDays` 日以内に発生した Package-Churn イベントについて、
 * 各企業の解約日から見た 30 / 60 / 90 日前スナップショットで予兆シグナルを評価する。
 */
export async function generateChurnRetrospective(
  windowDays: number = 90,
): Promise<ChurnRetrospectiveReport> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const fromStr  = nDaysBefore(todayStr, windowDays);

  const churnEvents: PackageEvent[] = await fetchChurnEventsWithinWindow(fromStr, todayStr);

  const sfIds = churnEvents.map(e => e.sfId!).filter(Boolean);
  const sfMap = await buildSfIdReverseMap(sfIds);

  // ── Metabase Package events を 90 日前まで一括取得（会社ごとの anchor 日を使う）
  const anchors = churnEvents.map(ev => ({ sfId: ev.sfId!, anchorDate: ev.statDate }));
  const precedingBySfId = await fetchPrecedingEventsBySfId(anchors, 90);

  const perCompany: ChurnedCompanyResult[] = [];
  let mapped         = 0;
  let unmapped       = 0;
  let csmManaged     = 0;
  let snapshotFound  = 0;

  for (const ev of churnEvents) {
    const sfId = ev.sfId!;
    const mapping = sfMap.get(sfId);
    const uid = mapping?.companyUid ?? null;
    if (uid) mapped++;
    else     unmapped++;
    if (mapping?.isCsmManaged === true) csmManaged++;

    const churnDate = ev.statDate;
    const d30Date = nDaysBefore(churnDate, 30);
    const d60Date = nDaysBefore(churnDate, 60);
    const d90Date = nDaysBefore(churnDate, 90);

    let d30Snap: CompanyDailySnapshot | null = null;
    let d60Snap: CompanyDailySnapshot | null = null;
    let d90Snap: CompanyDailySnapshot | null = null;

    if (uid) {
      const [m30, m60, m90] = await Promise.all([
        fetchSnapshotsByDate([uid], d30Date),
        fetchSnapshotsByDate([uid], d60Date),
        fetchSnapshotsByDate([uid], d90Date),
      ]);
      d30Snap = m30.get(uid) ?? null;
      d60Snap = m60.get(uid) ?? null;
      d90Snap = m90.get(uid) ?? null;
      if (d30Snap || d60Snap || d90Snap) snapshotFound++;
    }

    const w30 = evaluateSnapshot(d30Snap);
    const w60 = evaluateSnapshot(d60Snap);
    const w90 = evaluateSnapshot(d90Snap);

    let firstWarningAt: WarningPoint = 'none';
    if (w90?.isWarning)      firstWarningAt = 'd90';
    else if (w60?.isWarning) firstWarningAt = 'd60';
    else if (w30?.isWarning) firstWarningAt = 'd30';

    // ── Metabase シグナル計算 ──────────────────────────────────────────────
    const preceding = precedingBySfId.get(sfId) ?? [];
    const churnDt = new Date(`${churnDate}T00:00:00Z`);
    const enriched = preceding.map(pev => {
      const evDt = new Date(`${pev.statDate}T00:00:00Z`);
      const daysBefore = Math.round((churnDt.getTime() - evDt.getTime()) / 86_400_000);
      return {
        statDate:    pev.statDate,
        changeType:  pev.changeType as string,
        daysBefore,
        projectName: pev.projectName,
      };
    });
    const hadDownsell        = enriched.some(e => e.changeType === 'Package-Downsell');
    const hadTrialRegression = enriched.some(e => e.changeType === 'Package-Trial');
    const hadPriorChurn      = enriched.some(e => e.changeType === 'Package-Churn');
    const signalEvents       = enriched.filter(e =>
      e.changeType === 'Package-Downsell' ||
      e.changeType === 'Package-Trial'    ||
      e.changeType === 'Package-Churn',
    );
    const earliestSignalDaysBefore = signalEvents.length > 0
      ? Math.max(...signalEvents.map(e => e.daysBefore))
      : null;

    const metabase: MetabaseSignal = {
      precedingEventCount:      preceding.length,
      hadDownsell,
      hadTrialRegression,
      hadPriorChurnOnSameSfId:  hadPriorChurn,
      precedingEvents:          enriched,
      earliestSignalDaysBefore,
      hasWarning:               hadDownsell || hadTrialRegression || hadPriorChurn,
    };

    perCompany.push({
      sfAccountId:   sfId,
      companyUid:    uid,
      canonicalName: mapping?.canonicalName ?? ev.projectName ?? null,
      isCsmManaged:  mapping?.isCsmManaged  ?? null,
      tier:          mapping?.tier          ?? null,
      companyStatus: mapping?.companyStatus ?? null,
      ownerName:     mapping?.ownerName     ?? null,
      churnDate,
      projectName:   ev.projectName,
      paidStatus:    ev.paidStatus,
      snapshots: { d30: w30, d60: w60, d90: w90 },
      firstWarningAt,
      metabase,
    });
  }

  const agg: ChurnRetrospectiveReport['aggregate'] = {
    firstWarningAtD90: 0,
    firstWarningAtD60: 0,
    firstWarningAtD30: 0,
    neverWarning:      0,
    warningRateD90:    0,
    warningRateD60:    0,
    warningRateD30:    0,
    signals: {
      healthAtRiskOrCritical: { d30: 0, d60: 0, d90: 0 },
      hadStalledProjects:     { d30: 0, d60: 0, d90: 0 },
      hadOpenSupport:         { d30: 0, d60: 0, d90: 0 },
    },
    metabase: {
      warningCount:            0,
      warningRate:             0,
      hadDownsellCount:        0,
      hadTrialRegressionCount: 0,
      hadPriorChurnCount:      0,
      avgEarliestDaysBefore:   null,
    },
    byTier: [],
  };

  const earliestSignals: number[] = [];
  const tierBucket = new Map<number | null, { count: number; snap: number; meta: number }>();

  for (const c of perCompany) {
    if      (c.firstWarningAt === 'd90')  agg.firstWarningAtD90++;
    else if (c.firstWarningAt === 'd60')  agg.firstWarningAtD60++;
    else if (c.firstWarningAt === 'd30')  agg.firstWarningAtD30++;
    else                                   agg.neverWarning++;

    for (const key of ['d30', 'd60', 'd90'] as const) {
      const s = c.snapshots[key];
      if (!s) continue;
      if (s.overallHealth === 'at_risk' || s.overallHealth === 'critical') {
        agg.signals.healthAtRiskOrCritical[key]++;
      }
      if ((s.stalledProjectCount ?? 0) > 0) agg.signals.hadStalledProjects[key]++;
      if ((s.openSupportCount ?? 0)    > 0) agg.signals.hadOpenSupport[key]++;
    }

    if (c.metabase.hasWarning)              agg.metabase.warningCount++;
    if (c.metabase.hadDownsell)             agg.metabase.hadDownsellCount++;
    if (c.metabase.hadTrialRegression)      agg.metabase.hadTrialRegressionCount++;
    if (c.metabase.hadPriorChurnOnSameSfId) agg.metabase.hadPriorChurnCount++;
    if (c.metabase.earliestSignalDaysBefore !== null) {
      earliestSignals.push(c.metabase.earliestSignalDaysBefore);
    }

    const tierKey = c.tier;
    const b = tierBucket.get(tierKey) ?? { count: 0, snap: 0, meta: 0 };
    b.count++;
    if (c.firstWarningAt !== 'none') b.snap++;
    if (c.metabase.hasWarning)       b.meta++;
    tierBucket.set(tierKey, b);
  }

  const denom = perCompany.length || 1;
  agg.warningRateD90 = agg.firstWarningAtD90 / denom;
  agg.warningRateD60 = (agg.firstWarningAtD90 + agg.firstWarningAtD60) / denom;
  agg.warningRateD30 = (agg.firstWarningAtD90 + agg.firstWarningAtD60 + agg.firstWarningAtD30) / denom;
  agg.metabase.warningRate = agg.metabase.warningCount / denom;
  agg.metabase.avgEarliestDaysBefore = earliestSignals.length > 0
    ? earliestSignals.reduce((a, b) => a + b, 0) / earliestSignals.length
    : null;

  agg.byTier = Array.from(tierBucket.entries())
    .map(([tier, b]) => ({
      tier,
      count: b.count,
      warningCountSnapshot: b.snap,
      warningCountMetabase: b.meta,
    }))
    .sort((a, b) => (a.tier ?? 999) - (b.tier ?? 999));

  return {
    window:      { from: fromStr, to: todayStr, days: windowDays },
    churnEvents: {
      total:         churnEvents.length,
      mapped,
      unmapped,
      csmManaged,
      snapshotFound,
    },
    aggregate:   agg,
    perCompany,
  };
}
