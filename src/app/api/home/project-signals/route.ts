// ─── GET /api/home/project-signals ────────────────────────────────────────────
//
// 有料プロジェクト単位のシグナル（利用停止・活動低下）を検出して返す。
// Home 画面の「プロジェクトシグナル」セクション用。
//
// ── レスポンス ────────────────────────────────────────────────────────────────
//   { period, groups: ProjectSignalGroup[], total: number }
//
// ── 検出シグナル ──────────────────────────────────────────────────────────────
//   inactive_30d  : maxLastActiveDate から 30日+ 経過（critical）
//   inactive_20d  : maxLastActiveDate から 20日+ 経過（critical）
//   inactive_10d  : maxLastActiveDate から 10日+ 経過（warning）
//   inactive_7d   : maxLastActiveDate から 7日+  経過 or l7ActiveUsers=0（warning）
//   pv_ceiling_90 : 当月 PV 予測 / 上限 >= 90%（warning）
//   campaign_surge: 実行中 Campaign が前週比で増加（warning）
//   heatmap_first_use: Heatmap 初回利用が 90日以内（warning）
//   new_users     : 前週比でユーザー数が増加（info）
//
// ── データソース ──────────────────────────────────────────────────────────────
//   companies              : fetchAllCompanies（CSM 管理企業）
//   project_info           : fetchProjectsByUids（SF 連携企業のみ）
//   Metabase CSV (activity): fetchProjectUserActivityMap（totalUsers, l7ActiveUsers, maxLastActiveDate）
//   Metabase CSV (signals) : fetchProjectSignalMap（pvCeiling, campaigns, heatmap）
//   NocoDB snapshot        : fetchProjectSnapshotsByDate（7日前の total_users, running_campaign_count）
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   UI から直接呼ばれる（ブラウザ）。セッション認証なし（将来拡張予定）。

import { NextResponse } from 'next/server';
import { fetchAllCompanies }              from '@/lib/nocodb/companies';
import { fetchProjectsByUids }            from '@/lib/nocodb/project-info';
import { fetchProjectUserActivityMap }    from '@/lib/metabase/project-user-activity';
import { fetchProjectSignalMap }          from '@/lib/metabase/project-signals';
import { fetchProjectSnapshotsByDate }    from '@/lib/nocodb/project-user-snapshots';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type ProjectSignalType =
  | 'inactive_30d'
  | 'inactive_20d'
  | 'inactive_10d'
  | 'inactive_7d'
  | 'pv_ceiling_90'
  | 'campaign_surge'
  | 'campaign_drop'
  | 'heatmap_first_use'
  | 'new_users';

export interface ProjectSignalItem {
  companyUid:   string;
  companyName:  string;
  projectId:    string;
  projectName:  string;
  signalType:   ProjectSignalType;
  severity:     'critical' | 'warning' | 'info';
  detail:       string;
  detailValue?: number;
}

export interface ProjectSignalGroup {
  type:     ProjectSignalType;
  label:    string;
  count:    number;
  severity: 'critical' | 'warning' | 'info';
  items:    ProjectSignalItem[];
}

interface ProjectSignalsResponse {
  period: string;
  groups: ProjectSignalGroup[];
  total:  number;
}

// ── シグナル定義 ──────────────────────────────────────────────────────────────

const INACTIVE_DEFS: Array<{
  type:      ProjectSignalType;
  label:     string;
  severity:  'critical' | 'warning';
  minDays:   number;
}> = [
  { type: 'inactive_30d', label: '30日+ 無活動',  severity: 'critical', minDays: 30 },
  { type: 'inactive_20d', label: '20日+ 無活動',  severity: 'critical', minDays: 20 },
  { type: 'inactive_10d', label: '10日+ 無活動',  severity: 'warning',  minDays: 10 },
  { type: 'inactive_7d',  label: '7日+  無活動',  severity: 'warning',  minDays:  7 },
];

const SIGNAL_META: Record<ProjectSignalType, { label: string; severity: 'critical' | 'warning' | 'info' }> = {
  inactive_30d:      { label: '30日+ 無活動',        severity: 'critical' },
  inactive_20d:      { label: '20日+ 無活動',        severity: 'critical' },
  inactive_10d:      { label: '10日+ 無活動',        severity: 'warning'  },
  inactive_7d:       { label: '7日+  無活動',        severity: 'warning'  },
  pv_ceiling_90:     { label: 'PV上限 90%超',        severity: 'warning'  },
  campaign_surge:    { label: 'Campaign 急増',       severity: 'warning'  },
  campaign_drop:     { label: 'Campaign 急減',       severity: 'warning'  },
  heatmap_first_use: { label: 'Heatmap 初利用',      severity: 'warning'  },
  new_users:         { label: 'ユーザー追加',         severity: 'info'     },
};

/** 表示順（重要度順） */
const SIGNAL_ORDER: ProjectSignalType[] = [
  'inactive_30d', 'inactive_20d', 'pv_ceiling_90',
  'inactive_10d', 'inactive_7d',
  'campaign_surge', 'campaign_drop', 'heatmap_first_use', 'new_users',
];

function daysSince(dateStr: string): number {
  const d = new Date(dateStr.trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr.trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return 0;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function nDaysAgoDateStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isPaidProject(paidType: string | null | undefined): boolean {
  const t = (paidType ?? '').toUpperCase();
  return t !== '' && t !== 'FREE';
}

// ── ルートハンドラ ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period    = (searchParams.get('period') ?? 'week') as string;
  const ownerName = searchParams.get('owner') ?? undefined;

  // ── データ取得（並列）───────────────────────────────────────────────────────
  const [companies, activityMap, signalDataMap] = await Promise.all([
    fetchAllCompanies(300, ownerName).catch(() => []),
    fetchProjectUserActivityMap().catch(() => new Map<string, import('@/lib/metabase/project-user-activity').ProjectUserActivity>()),
    fetchProjectSignalMap().catch(() => new Map<string, import('@/lib/metabase/project-signals').ProjectSignalData>()),
  ]);

  if (companies.length === 0) {
    return NextResponse.json<ProjectSignalsResponse>({ period, groups: [], total: 0 });
  }

  const uids = companies.map(c => c.id);
  const projectMap = await fetchProjectsByUids(uids).catch(() =>
    new Map<string, import('@/lib/nocodb/types').AppProjectInfo[]>(),
  );

  // ── 全プロジェクト ID を収集して 7日前スナップショットを一括取得 ─────────────
  const allProjectIds: string[] = [];
  for (const uid of uids) {
    for (const p of (projectMap.get(uid) ?? [])) {
      if (isPaidProject(p.paidType)) allProjectIds.push(p.id);
    }
  }
  const sevenDaysAgo = nDaysAgoDateStr(7);
  const prevSnapshotMap = await fetchProjectSnapshotsByDate(allProjectIds, sevenDaysAgo).catch(
    () => new Map<string, import('@/lib/nocodb/project-user-snapshots').ProjectUserSnapshot>(),
  );

  // ── 会社名 Map ──────────────────────────────────────────────────────────────
  const companyNameMap = new Map<string, string>(companies.map(c => [c.id, c.name] as [string, string]));

  // ── シグナル検出 ─────────────────────────────────────────────────────────────
  const signals: ProjectSignalItem[] = [];

  // Heatmap 初利用の閾値: 過去 90 日以内に初回利用
  const HEATMAP_FIRST_USE_DAYS = 90;

  for (const company of companies) {
    const projects = (projectMap.get(company.id) ?? []).filter(p => isPaidProject(p.paidType));

    for (const project of projects) {
      const activity    = activityMap.get(project.id);
      const signalData  = signalDataMap.get(project.id);
      const prevSnap    = prevSnapshotMap.get(project.id);
      const companyName = companyNameMap.get(company.id) ?? company.id;

      // ── 無活動シグナル（maxLastActiveDate 基準）───────────────────────────────
      const lastActiveDate = activity?.maxLastActiveDate ?? signalData?.lastActiveDate ?? null;
      if (lastActiveDate) {
        const days = daysSince(lastActiveDate);
        const matched = INACTIVE_DEFS.find(d => days >= d.minDays);
        if (matched) {
          signals.push({
            companyUid:  company.id,
            companyName,
            projectId:   project.id,
            projectName: project.name,
            signalType:  matched.type,
            severity:    matched.severity,
            detail:      `最終活動: ${lastActiveDate} (${days}日経過)`,
            detailValue: days,
          });
        }
      } else if (activity && activity.l7ActiveUsers === 0 && activity.totalUsers > 0) {
        signals.push({
          companyUid:  company.id,
          companyName,
          projectId:   project.id,
          projectName: project.name,
          signalType:  'inactive_7d',
          severity:    'warning',
          detail:      '過去7日間 アクティブユーザー 0人',
        });
      }

      // ── PV上限シグナル（forecast/ceiling >= 90%、残日数付き）─────────────────
      if (signalData?.pvCeiling && signalData.pvCeiling > 0 && signalData.monthPvCount != null) {
        const ratio = signalData.monthPvCount / signalData.pvCeiling;
        if (ratio >= 0.9) {
          const pct = Math.round(ratio * 100);
          const remaining = signalData.monthPeriodEndTime
            ? Math.max(0, daysUntil(signalData.monthPeriodEndTime))
            : null;
          const remainStr = remaining !== null ? ` | 更新まで${remaining}日` : '';
          signals.push({
            companyUid:  company.id,
            companyName,
            projectId:   project.id,
            projectName: project.name,
            signalType:  'pv_ceiling_90',
            severity:    'warning',
            detail:      `${pct}% 到達 (実績${Math.round(signalData.monthPvCount).toLocaleString()} / 上限${Math.round(signalData.pvCeiling).toLocaleString()})${remainStr}`,
            detailValue: pct,
          });
        }
      }

      // ── Campaign 急増・急減シグナル（前週スナップとの比較）──────────────────
      const currentCampaign = signalData?.runningCampaignWithGoalCount ?? 0;
      const prevCampaign    = prevSnap?.running_campaign_count ?? null;

      if (prevCampaign !== null) {
        // 前回スナップあり → 差分で判定
        if (currentCampaign > prevCampaign) {
          const delta = currentCampaign - prevCampaign;
          signals.push({
            companyUid:  company.id,
            companyName,
            projectId:   project.id,
            projectName: project.name,
            signalType:  'campaign_surge',
            severity:    'warning',
            detail:      `実行中 ${currentCampaign} Campaign (+${delta})`,
            detailValue: delta,
          });
        } else if (prevCampaign > 0 && currentCampaign < prevCampaign) {
          const delta = prevCampaign - currentCampaign;
          signals.push({
            companyUid:  company.id,
            companyName,
            projectId:   project.id,
            projectName: project.name,
            signalType:  'campaign_drop',
            severity:    'warning',
            detail:      `実行中 ${currentCampaign} Campaign (-${delta})`,
            detailValue: delta,
          });
        }
      } else if (currentCampaign > 0) {
        // 前回スナップなし（初回検出）→ 実行中として記録
        signals.push({
          companyUid:  company.id,
          companyName,
          projectId:   project.id,
          projectName: project.name,
          signalType:  'campaign_surge',
          severity:    'warning',
          detail:      `実行中 ${currentCampaign} Campaign`,
          detailValue: currentCampaign,
        });
      }

      // ── Heatmap 初利用シグナル（firstHeatmapDate が HEATMAP_FIRST_USE_DAYS 以内）
      if (signalData?.firstHeatmapDate) {
        const daysAgo = daysSince(signalData.firstHeatmapDate);
        if (daysAgo >= 0 && daysAgo <= HEATMAP_FIRST_USE_DAYS) {
          signals.push({
            companyUid:  company.id,
            companyName,
            projectId:   project.id,
            projectName: project.name,
            signalType:  'heatmap_first_use',
            severity:    'warning',
            detail:      `初回 ${signalData.firstHeatmapDate} (${daysAgo}日前)`,
            detailValue: daysAgo,
          });
        }
      }

      // ── 新規ユーザー追加シグナル（前週比でユーザー数が増加）──────────────────
      const currentUsers = activity?.totalUsers ?? null;
      const prevUsers    = prevSnap?.total_users ?? null;
      if (currentUsers !== null && prevUsers !== null && currentUsers > prevUsers) {
        const added = currentUsers - prevUsers;
        signals.push({
          companyUid:  company.id,
          companyName,
          projectId:   project.id,
          projectName: project.name,
          signalType:  'new_users',
          severity:    'info',
          detail:      `${added}名追加 (計${currentUsers}名)`,
          detailValue: added,
        });
      }
    }
  }

  // ── グループ化 ────────────────────────────────────────────────────────────
  const groups: ProjectSignalGroup[] = [];

  for (const type of SIGNAL_ORDER) {
    const items = signals.filter(s => s.signalType === type);
    if (items.length === 0) continue;
    // 経過日数の降順（より古い / より深刻なものを先頭）
    items.sort((a, b) => (b.detailValue ?? 0) - (a.detailValue ?? 0));
    const meta = SIGNAL_META[type];
    groups.push({
      type,
      label:    meta.label,
      count:    items.length,
      severity: meta.severity,
      items,
    });
  }

  return NextResponse.json<ProjectSignalsResponse>({
    period,
    groups,
    total: signals.length,
  });
}
