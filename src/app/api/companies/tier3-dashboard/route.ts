// ─── GET /api/companies/tier3-dashboard ───────────────────────────────────────
//
// Tier 3 の企業を、ダッシュボード表示用の「拡張シグナル」つきで返す。
// （tier 未設定の Light watch 企業は対象外）
// /console/tier3 の「ダッシュボード」タブで使用する。
//
// light-watch API（最新スナップショット）に加え、以下を集約 API 層でその場計算する:
//   - 契約プラン（Insight / Experience / Bundle）: project_info.paidType を企業単位で集約
//   - PV 消費率:                                   project-signals の monthPvCount / pvCeiling
//   - 今週操作数（l7ActiveUsers 合計）:            project-user-activity
//   - 前週比:                                      project_user_snapshots.l7_active_users（7日前）と比較
//   - 最終活動日 / 無活動日数:                      signals.lastActiveDate ?? activity.maxLastActiveDate
//   - アラーム判定・重大度・優先度:                 本 API 内で決定論的に算出
//
// スナップショット（company_daily_snapshot）から流用: mrr / renewal / open_support / chronic silent

import { NextRequest, NextResponse } from 'next/server';
import { fetchLightWatchCompanies } from '@/lib/nocodb/companies';
import { fetchProjectsByUids } from '@/lib/nocodb/project-info';
import { fetchLatestSnapshotsByUids, nDaysAgoDateStr } from '@/lib/nocodb/company-snapshot';
import { fetchProjectSnapshotsByDate } from '@/lib/nocodb/project-user-snapshots';
import { fetchProjectSignalMap } from '@/lib/metabase/project-signals';
import { fetchProjectUserActivityMap } from '@/lib/metabase/project-user-activity';
import { fetchLatestChronicSilentSnapshot, buildSilentItemByCompanyUid } from '@/lib/nocodb/chronic-silent';

export const maxDuration = 60;

// ── 型 ────────────────────────────────────────────────────────────────────────

export type ContractPlan = 'insight' | 'experience' | 'bundle';
export type AlarmType = 'pv_over' | 'renewal_soon' | 'ops_drop' | 'inactive_30' | 'upsell';
export type Severity = 'red' | 'amber' | 'blue' | 'green';

export interface DashboardItem {
  companyUid:        string;
  canonicalName:     string;
  owner:            string;
  tier:             1 | 2 | 3 | 5 | null;
  isPaidWatched:    boolean;

  // ── 契約 / 収益 ─────────────────────────────────────────────────────────────
  mrr:              number | null;
  plan:             ContractPlan | null;
  renewalBucket:    string | null;
  renewalDate:      string | null;
  openSupportCount: number | null;

  // ── 利用シグナル ────────────────────────────────────────────────────────────
  /** PV 消費率（%, 企業内プロジェクト最大）*/
  pvRate:           number | null;
  /** PV 消費率が警戒水準（>=90%）か */
  pvOver:           boolean;
  /** 過去30日アクティブ（全プロジェクト合計）*/
  l30Total:         number | null;
  /** 今週アクティブユーザー数（全プロジェクト合計）*/
  l7ThisWeek:       number | null;
  /** 前週アクティブユーザー数（7日前スナップショット合計）*/
  l7PrevWeek:       number | null;
  /** 前週比（%, null = 前週データなし）*/
  wowPct:           number | null;
  /** 最終活動日（YYYY-MM-DD）*/
  lastActiveDate:   string | null;
  /** 最終活動からの経過日数 */
  daysSinceActive:  number | null;

  // ── Ptengine 休眠 ───────────────────────────────────────────────────────────
  isChronicSilent:  boolean;
  chronicSilentL30: number | null;

  // ── 判定結果 ────────────────────────────────────────────────────────────────
  alarms:           AlarmType[];
  severity:         Severity;
  /** 「今日対応する企業」表示用の主要理由文 */
  primaryReason:    string;
  /** 優先度スコア（降順ソート用）*/
  priorityScore:    number;
}

export interface Tier3DashboardResponse {
  updatedAt:    string;
  snapshotDate: string | null;
  /** アラームサマリー（種別ごとの該当企業数）*/
  summary: {
    pvOver:      number;
    renewalSoon: number;
    opsDrop:     number;
    inactive30:  number;
    upsell:      number;
  };
  /** フィルタタブ用カウント */
  counts: {
    all:        number;
    urgent:     number;   // severity red
    needAction: number;   // severity amber
    proposal:   number;   // severity blue
    normal:     number;   // severity green
  };
  items: DashboardItem[];
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
}

/** paidType 集合から契約プランを導出する */
function derivePlan(paidTypes: Set<string>): ContractPlan | null {
  const hasInsight    = paidTypes.has('PTI-PAID');
  const hasExperience = paidTypes.has('PTX-PAID');
  if (hasInsight && hasExperience) return 'bundle';
  if (hasInsight)    return 'insight';
  if (hasExperience) return 'experience';
  return null;
}

const SEVERITY_RANK: Record<Severity, number> = { red: 3, amber: 2, blue: 1, green: 0 };

/** NocoDB Number カラムが文字列で返ることがあるため安全に数値化する */
function num(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(v) ? v : null;
}

// ── ハンドラ ──────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
): Promise<NextResponse<Tier3DashboardResponse | { error: string }>> {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '2000', 10) || 2000;

    // fetchLightWatchCompanies は「Tier 3」＋「tier 未設定の is_paid_watched=true（Light watch）」を返す。
    // この画面は Tier 3 管理なので Tier 3 のみに絞る。
    const companies = (await fetchLightWatchCompanies(limit)).filter(c => c.tier === 3);
    const uids = companies.map(c => c.id);

    const [snapshotMap, projectMap, signalMap, activityMap, silentSnapshot] = await Promise.all([
      uids.length > 0 ? fetchLatestSnapshotsByUids(uids).catch(() => new Map()) : Promise.resolve(new Map()),
      uids.length > 0 ? fetchProjectsByUids(uids).catch(() => new Map()) : Promise.resolve(new Map()),
      fetchProjectSignalMap().catch(() => new Map()),
      fetchProjectUserActivityMap().catch(() => new Map()),
      fetchLatestChronicSilentSnapshot('JP').catch(() => null),
    ]);
    const silentByUid = buildSilentItemByCompanyUid(silentSnapshot);

    // 前週スナップショット（7日前時点）の l7_active_users を一括取得
    const allProjectIds: string[] = [];
    for (const uid of uids) {
      for (const p of (projectMap.get(uid) ?? [])) allProjectIds.push(p.id);
    }
    const prevSnapMap = allProjectIds.length > 0
      ? await fetchProjectSnapshotsByDate(allProjectIds, nDaysAgoDateStr(7)).catch(() => new Map())
      : new Map();

    let latestSnapshotDate: string | null = null;

    const items: DashboardItem[] = companies.map(c => {
      const uid  = c.id;
      const snap = snapshotMap.get(uid) ?? null;
      const projList = projectMap.get(uid) ?? [];

      if (snap?.snapshot_date && (!latestSnapshotDate || snap.snapshot_date > latestSnapshotDate)) {
        latestSnapshotDate = snap.snapshot_date;
      }

      // ── プラン判定 ────────────────────────────────────────────────────────────
      const paidTypes = new Set<string>();
      for (const p of projList) {
        const pt = (p.paidType ?? '').toUpperCase();
        if (pt) paidTypes.add(pt);
      }
      const plan = derivePlan(paidTypes);

      // ── PV 消費率（企業内プロジェクト最大）───────────────────────────────────
      let pvRate: number | null = null;
      for (const p of projList) {
        const sd = signalMap.get(p.id);
        if (!sd || !sd.pvCeiling || sd.pvCeiling <= 0 || sd.monthPvCount == null) continue;
        const rate = (sd.monthPvCount / sd.pvCeiling) * 100;
        if (pvRate == null || rate > pvRate) pvRate = Math.round(rate);
      }
      const pvOver = pvRate != null && pvRate >= 90;

      // ── 今週 / 前週 操作数（l7 active users 合計）────────────────────────────
      let l7ThisWeek: number | null = null;
      let l7PrevWeek: number | null = null;
      let hasThis = false;
      let hasPrev = false;
      for (const p of projList) {
        const act = activityMap.get(p.id);
        const sd  = signalMap.get(p.id);
        const thisVal = act?.l7ActiveUsers ?? sd?.l7EventCount ?? null;
        if (thisVal != null) { l7ThisWeek = (l7ThisWeek ?? 0) + thisVal; hasThis = true; }
        const prev = prevSnapMap.get(p.id);
        if (prev?.l7_active_users != null) { l7PrevWeek = (l7PrevWeek ?? 0) + prev.l7_active_users; hasPrev = true; }
      }
      const wowPct = (hasThis && hasPrev && (l7PrevWeek ?? 0) > 0)
        ? Math.round(((l7ThisWeek! - l7PrevWeek!) / l7PrevWeek!) * 100)
        : null;

      // ── 最終活動日 ────────────────────────────────────────────────────────────
      let lastActiveDate: string | null = null;
      for (const p of projList) {
        const sd  = signalMap.get(p.id);
        const act = activityMap.get(p.id);
        const d = sd?.lastActiveDate ?? act?.maxLastActiveDate ?? null;
        if (d && (!lastActiveDate || d > lastActiveDate)) lastActiveDate = d;
      }
      const daysSinceActive = daysSince(lastActiveDate);

      // ── スナップショット由来 ──────────────────────────────────────────────────
      const mrr              = num(snap?.mrr);
      const renewalBucket    = snap?.renewal_bucket ?? null;
      const renewalDate      = snap?.renewal_date ?? null;
      const openSupportCount = num(snap?.open_support_count);
      const totalL30Active   = num(snap?.total_l30_active);
      const isChronicSilent  = silentByUid.has(uid);
      const chronicSilentL30 = silentByUid.get(uid)?.l30Active ?? null;

      // ── アラーム判定 ──────────────────────────────────────────────────────────
      //   契約更新は renewal_date の残日数で判定: 0-30 or 期限切れ=要観察 / 31-60=要注意 / 61日〜=無印
      const renewalDaysSince = daysSince(renewalDate);          // 過去=正 / 未来=負
      const renewalLeft = renewalDaysSince == null ? null : -renewalDaysSince; // 未来=正
      const alarms: AlarmType[] = [];
      if (pvOver) alarms.push('pv_over');
      if (renewalLeft != null && renewalLeft <= 60) alarms.push('renewal_soon');
      if (wowPct != null && wowPct <= -50) alarms.push('ops_drop');
      if ((daysSinceActive != null && daysSinceActive >= 30) || isChronicSilent) alarms.push('inactive_30');
      // アップセル: 単一プラン契約（Bundle 未満）で、ある程度稼働している企業
      const hasActivity = (l7ThisWeek ?? 0) > 0 || (totalL30Active ?? 0) > 0;
      if (plan != null && plan !== 'bundle' && hasActivity) alarms.push('upsell');

      // ── 重大度 ────────────────────────────────────────────────────────────────
      let severity: Severity = 'green';
      // 契約更新(0-30/expired)は解約不可期間 or 更新交渉フェーズであり緊急ではない → amber
      if (alarms.includes('pv_over')) severity = 'red';
      else if (alarms.includes('renewal_soon') || alarms.includes('ops_drop') || alarms.includes('inactive_30')) severity = 'amber';
      else if (alarms.includes('upsell')) severity = 'blue';

      // ── 主要理由文 ────────────────────────────────────────────────────────────
      const reasons: string[] = [];
      if (renewalLeft != null && renewalLeft < 0) reasons.push('契約更新期限切れ（要観察）');
      else if (renewalLeft != null && renewalLeft <= 30) reasons.push('更新30日以内（要観察）');
      else if (renewalLeft != null && renewalLeft <= 60) reasons.push('更新31-60日（要注意）');
      if (pvOver) reasons.push(`PV消費 ${pvRate}%`);
      if (wowPct != null && wowPct <= -50) reasons.push(`操作数急減 ${wowPct}%`);
      if (isChronicSilent) reasons.push('Ptengine休眠');
      else if (daysSinceActive != null && daysSinceActive >= 30) reasons.push(`${daysSinceActive}日間 無活動`);
      if (alarms.includes('upsell') && reasons.length === 0) {
        reasons.push(plan === 'insight' ? 'アップセル機会：Experience 提案余地' : 'アップセル機会：Insight 提案余地');
      }
      const primaryReason = reasons.length > 0 ? reasons.join(' ／ ') : '異常なし';

      // ── 優先度スコア ──────────────────────────────────────────────────────────
      // 重大度を最優先、同順位内は MRR とアラーム数で加点
      const priorityScore =
        SEVERITY_RANK[severity] * 1_000_000
        + alarms.length * 100_000
        + (mrr ?? 0) / 1000;

      return {
        companyUid: uid,
        canonicalName: c.name,
        owner: c.owner,
        tier: c.tier,
        isPaidWatched: c.isPaidWatched,
        mrr,
        plan,
        renewalBucket,
        renewalDate,
        openSupportCount,
        pvRate,
        pvOver,
        l30Total:   totalL30Active,
        l7ThisWeek,
        l7PrevWeek,
        wowPct,
        lastActiveDate,
        daysSinceActive,
        isChronicSilent,
        chronicSilentL30,
        alarms,
        severity,
        primaryReason,
        priorityScore,
      };
    });

    // ── 集計 ────────────────────────────────────────────────────────────────────
    const summary = { pvOver: 0, renewalSoon: 0, opsDrop: 0, inactive30: 0, upsell: 0 };
    const counts  = { all: items.length, urgent: 0, needAction: 0, proposal: 0, normal: 0 };
    for (const it of items) {
      if (it.alarms.includes('pv_over'))      summary.pvOver++;
      if (it.alarms.includes('renewal_soon')) summary.renewalSoon++;
      if (it.alarms.includes('ops_drop'))     summary.opsDrop++;
      if (it.alarms.includes('inactive_30'))  summary.inactive30++;
      if (it.alarms.includes('upsell'))       summary.upsell++;
      if      (it.severity === 'red')   counts.urgent++;
      else if (it.severity === 'amber') counts.needAction++;
      else if (it.severity === 'blue')  counts.proposal++;
      else                              counts.normal++;
    }

    items.sort((a, b) => b.priorityScore - a.priorityScore);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      snapshotDate: latestSnapshotDate,
      summary,
      counts,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
