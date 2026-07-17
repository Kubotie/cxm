// ─── Snapshot 蓄積モニタリング ────────────────────────────────────────────────
//
// company_daily_snapshot テーブルを解析して、遡及分析（30/60/90日）の準備状況を
// watch group 別に集計する。
//
// 出力:
//   - 全体の日付範囲、行数、企業数
//   - Watch group (Deep=Tier1/2, Light-Tier3, Light-Paid) 別のカバレッジ
//   - 各企業の初回スナップショット日 → 遡及可能日数
//   - d30/d60/d90 遡及分析に必要な日数まで あと何日か

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import type { RawCompany } from '@/lib/nocodb/types';
import type { CompanyDailySnapshot } from '@/lib/nocodb/company-snapshot';

export type WatchGroup = 'deep' | 'light-tier3' | 'light-paid' | 'other';

export interface CompanyCoverage {
  companyUid:     string;
  canonicalName:  string | null;
  watchGroup:     WatchGroup;
  tier:           number | null;
  isPaidWatched:  boolean;
  snapshotCount:  number;
  firstDate:      string;
  lastDate:       string;
  /** 最古スナップショット日から今日までの経過日数（遡及可能な日数の上限） */
  coverageDays:   number;
}

export interface GroupSummary {
  companyCount:          number;
  avgCoverageDays:       number;
  medianCoverageDays:    number;
  /** 30/60/90日前のスナップショットを持つ企業数（遡及可能） */
  d30Ready:              number;
  d60Ready:              number;
  d90Ready:              number;
  /** 平均で遡及可能日数まで あと何日 */
  daysUntilD30Ready:     number;
  daysUntilD60Ready:     number;
  daysUntilD90Ready:     number;
}

export interface SnapshotProgressReport {
  today:              string;
  totalRows:          number;
  distinctCompanies:  number;
  dateRange: {
    oldest: string | null;
    newest: string | null;
    spanDays: number;
  };
  byWatchGroup: {
    deep:       GroupSummary;
    lightTier3: GroupSummary;
    lightPaid:  GroupSummary;
    other:      GroupSummary;
  };
  /** 30日以内に d30 遡及可能となる企業数（推定） */
  d30_ready_at_snapshot_day_30: number;
  d60_ready_at_snapshot_day_60: number;
  d90_ready_at_snapshot_day_90: number;
  /** watch group 別サンプル（各グループ最大 5 社） */
  samples: {
    deep:       CompanyCoverage[];
    lightTier3: CompanyCoverage[];
    lightPaid:  CompanyCoverage[];
  };
}

function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T00:00:00Z`);
  const to   = new Date(`${toStr}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function toBoolLoose(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

function normalizeTier(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

function classifyWatchGroup(tier: number | null, isPaidWatched: boolean): WatchGroup {
  if (tier === 1 || tier === 2)               return 'deep';
  if (tier === 3)                             return 'light-tier3';
  if (tier == null && isPaidWatched)          return 'light-paid';
  return 'other';
}

async function loadAllSnapshotsMinimal(): Promise<{ company_uid: string; snapshot_date: string }[]> {
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId) return [];

  const out: { company_uid: string; snapshot_date: string }[] = [];
  const pageSize = 1000;
  let offset = 0;
  const maxPages = 100;

  for (let page = 0; page < maxPages; page++) {
    const rows = await nocoFetch<CompanyDailySnapshot>(tableId, {
      fields: 'company_uid,snapshot_date',
      limit:  String(pageSize),
      offset: String(offset),
      sort:   'snapshot_date',
    }, false).catch(err => {
      console.error('[snapshot-progress] pagination fetch 失敗:', err);
      return [] as CompanyDailySnapshot[];
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      if (r.company_uid && r.snapshot_date) {
        out.push({ company_uid: r.company_uid, snapshot_date: r.snapshot_date });
      }
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

async function loadAllCompanies(): Promise<Map<string, {
  canonicalName: string | null;
  tier: number | null;
  isPaidWatched: boolean;
}>> {
  const tableId = TABLE_IDS.companies;
  const map = new Map<string, {
    canonicalName: string | null;
    tier: number | null;
    isPaidWatched: boolean;
  }>();
  if (!tableId) return map;

  const pageSize = 1000;
  let offset = 0;
  const maxPages = 20;
  for (let page = 0; page < maxPages; page++) {
    const rows = await nocoFetch<RawCompany>(tableId, {
      fields: 'company_uid,canonical_name,tier,is_paid_watched',
      limit:  String(pageSize),
      offset: String(offset),
    }, false).catch(err => {
      console.error('[snapshot-progress] companies fetch 失敗:', err);
      return [] as RawCompany[];
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      const uid = r.company_uid?.trim();
      if (!uid) continue;
      map.set(uid, {
        canonicalName: r.canonical_name?.trim() ?? null,
        tier:          normalizeTier(r.tier),
        isPaidWatched: toBoolLoose(r.is_paid_watched),
      });
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return map;
}

function buildGroupSummary(items: CompanyCoverage[], today: string): GroupSummary {
  if (items.length === 0) {
    return {
      companyCount: 0, avgCoverageDays: 0, medianCoverageDays: 0,
      d30Ready: 0, d60Ready: 0, d90Ready: 0,
      daysUntilD30Ready: 30, daysUntilD60Ready: 60, daysUntilD90Ready: 90,
    };
  }
  const covs = items.map(it => it.coverageDays);
  const avg = covs.reduce((a, b) => a + b, 0) / covs.length;
  const med = median(covs);
  const d30 = items.filter(it => it.coverageDays >= 30).length;
  const d60 = items.filter(it => it.coverageDays >= 60).length;
  const d90 = items.filter(it => it.coverageDays >= 90).length;
  return {
    companyCount:       items.length,
    avgCoverageDays:    Math.round(avg * 10) / 10,
    medianCoverageDays: Math.round(med),
    d30Ready:           d30,
    d60Ready:           d60,
    d90Ready:           d90,
    daysUntilD30Ready:  Math.max(0, 30 - Math.round(med)),
    daysUntilD60Ready:  Math.max(0, 60 - Math.round(med)),
    daysUntilD90Ready:  Math.max(0, 90 - Math.round(med)),
  };
}

export async function generateSnapshotProgress(): Promise<SnapshotProgressReport> {
  const today = new Date().toISOString().slice(0, 10);
  const [snaps, companyMap] = await Promise.all([
    loadAllSnapshotsMinimal(),
    loadAllCompanies(),
  ]);

  // company_uid → snapshot 情報
  const perCompany = new Map<string, { first: string; last: string; count: number }>();
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const s of snaps) {
    const cur = perCompany.get(s.company_uid);
    if (!cur) {
      perCompany.set(s.company_uid, { first: s.snapshot_date, last: s.snapshot_date, count: 1 });
    } else {
      if (s.snapshot_date < cur.first) cur.first = s.snapshot_date;
      if (s.snapshot_date > cur.last)  cur.last  = s.snapshot_date;
      cur.count++;
    }
    if (!oldest || s.snapshot_date < oldest) oldest = s.snapshot_date;
    if (!newest || s.snapshot_date > newest) newest = s.snapshot_date;
  }

  const coverages: CompanyCoverage[] = [];
  for (const [uid, s] of perCompany) {
    const meta = companyMap.get(uid);
    const group = classifyWatchGroup(meta?.tier ?? null, meta?.isPaidWatched ?? false);
    coverages.push({
      companyUid:     uid,
      canonicalName:  meta?.canonicalName ?? null,
      watchGroup:     group,
      tier:           meta?.tier ?? null,
      isPaidWatched:  meta?.isPaidWatched ?? false,
      snapshotCount:  s.count,
      firstDate:      s.first,
      lastDate:       s.last,
      coverageDays:   daysBetween(s.first, today),
    });
  }

  const bucket = {
    deep:       coverages.filter(c => c.watchGroup === 'deep'),
    lightTier3: coverages.filter(c => c.watchGroup === 'light-tier3'),
    lightPaid:  coverages.filter(c => c.watchGroup === 'light-paid'),
    other:      coverages.filter(c => c.watchGroup === 'other'),
  };

  const spanDays = oldest && newest ? daysBetween(oldest, newest) : 0;

  return {
    today,
    totalRows:         snaps.length,
    distinctCompanies: perCompany.size,
    dateRange: { oldest, newest, spanDays },
    byWatchGroup: {
      deep:       buildGroupSummary(bucket.deep,       today),
      lightTier3: buildGroupSummary(bucket.lightTier3, today),
      lightPaid:  buildGroupSummary(bucket.lightPaid,  today),
      other:      buildGroupSummary(bucket.other,      today),
    },
    d30_ready_at_snapshot_day_30: bucket.deep.length + bucket.lightTier3.length + bucket.lightPaid.length,
    d60_ready_at_snapshot_day_60: bucket.deep.length + bucket.lightTier3.length + bucket.lightPaid.length,
    d90_ready_at_snapshot_day_90: bucket.deep.length + bucket.lightTier3.length + bucket.lightPaid.length,
    samples: {
      deep:       bucket.deep      .sort((a, b) => b.coverageDays - a.coverageDays).slice(0, 5),
      lightTier3: bucket.lightTier3.sort((a, b) => b.coverageDays - a.coverageDays).slice(0, 5),
      lightPaid:  bucket.lightPaid .sort((a, b) => b.coverageDays - a.coverageDays).slice(0, 5),
    },
  };
}
