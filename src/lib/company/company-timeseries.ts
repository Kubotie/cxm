// ─── 個社の時系列データ集約（route と Server Component から共用）───────────────
//
// company_daily_snapshot（企業日次: MRR / L30合計 / Campaign / PV超過数 / active・stalled PJ / health）
// と project_user_snapshots（プロジェクト日次: L7/L30アクティブ / Campaign / H・D・B スコア）を
// snapshot_date で統合し、日付昇順の系列にして返す。スコアは記録開始後のみ値が入る。

import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchProjectsByCompany } from '@/lib/nocodb/project-info';
import { fetchCompanySnapshotHistory, nDaysAgoDateStr } from '@/lib/nocodb/company-snapshot';
import { fetchProjectSnapshotHistory } from '@/lib/nocodb/project-user-snapshots';

export interface TimeseriesPoint {
  date:            string;
  l7Active:        number | null;
  l30Active:       number | null;
  campaign:        number | null;
  healthyAvg:      number | null;
  depthAvg:        number | null;
  breadthAvg:      number | null;
  mrr:             number | null;
  pvAlertCount:    number | null;
  activeProjects:  number | null;
  stalledProjects: number | null;
  overallHealth:   string | null;
}

export interface TimeseriesResponse {
  companyUid: string;
  name:       string;
  days:       number;
  hasScoreData: boolean;
  series: TimeseriesPoint[];
}

function num(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(v) ? v : null;
}
function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * 個社の時系列データを集約して返す。企業が見つからない場合は null。days は 7〜365 に丸める。
 */
export async function loadCompanyTimeseries(
  companyUid: string,
  daysRaw: number,
): Promise<TimeseriesResponse | null> {
  const days = Math.min(Math.max(daysRaw || 90, 7), 365);

  const company = await fetchCompanyByUid(companyUid).catch(() => null);
  if (!company) return null;

  const projects = await fetchProjectsByCompany(companyUid).catch(() => []);
  const projectIds = projects.map(p => p.id);
  const sinceDate = nDaysAgoDateStr(days);

  const [companyRows, projectRows] = await Promise.all([
    fetchCompanySnapshotHistory(companyUid, sinceDate).catch(() => []),
    projectIds.length > 0
      ? fetchProjectSnapshotHistory(projectIds, sinceDate).catch(() => [])
      : Promise.resolve([]),
  ]);

  interface ProjAgg { l7: number[]; l30: number[]; camp: number[]; h: number[]; d: number[]; b: number[]; }
  const projByDate = new Map<string, ProjAgg>();
  for (const r of projectRows) {
    const date = r.snapshot_date;
    if (!date) continue;
    let agg = projByDate.get(date);
    if (!agg) { agg = { l7: [], l30: [], camp: [], h: [], d: [], b: [] }; projByDate.set(date, agg); }
    const l7 = num(r.l7_active_users);   if (l7 != null) agg.l7.push(l7);
    const l30 = num(r.l30_active_users); if (l30 != null) agg.l30.push(l30);
    const cp = num(r.running_campaign_count); if (cp != null) agg.camp.push(cp);
    const h = num(r.healthy_score);  if (h != null) agg.h.push(h);
    const d = num(r.depth_score);    if (d != null) agg.d.push(d);
    const b = num(r.breadth_score);  if (b != null) agg.b.push(b);
  }

  const compByDate = new Map<string, typeof companyRows[number]>();
  for (const r of companyRows) { if (r.snapshot_date) compByDate.set(r.snapshot_date, r); }

  const allDates = new Set<string>([...projByDate.keys(), ...compByDate.keys()]);
  const sortedDates = [...allDates].sort();

  let hasScoreData = false;
  const series: TimeseriesPoint[] = sortedDates.map(date => {
    const pa = projByDate.get(date);
    const cr = compByDate.get(date);
    const sum = (arr: number[] | undefined) => (arr && arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null);

    const healthyAvg = pa ? avg(pa.h) : null;
    const depthAvg   = pa ? avg(pa.d) : null;
    const breadthAvg = pa ? avg(pa.b) : null;
    if (healthyAvg != null || depthAvg != null || breadthAvg != null) hasScoreData = true;

    return {
      date,
      l7Active:        pa ? sum(pa.l7) : null,
      l30Active:       pa ? sum(pa.l30) : (cr ? num(cr.total_l30_active) : null),
      campaign:        pa ? sum(pa.camp) : (cr ? num(cr.running_campaign_total) : null),
      healthyAvg,
      depthAvg,
      breadthAvg,
      mrr:             cr ? num(cr.mrr) : null,
      pvAlertCount:    cr ? num(cr.pv_ceiling_alert_count) : null,
      activeProjects:  cr ? num(cr.active_project_count) : null,
      stalledProjects: cr ? num(cr.stalled_project_count) : null,
      overallHealth:   cr?.overall_health ?? null,
    };
  });

  return { companyUid, name: company.name, days, hasScoreData, series };
}
