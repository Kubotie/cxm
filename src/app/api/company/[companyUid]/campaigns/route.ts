// ─── GET /api/company/[companyUid]/campaigns ──────────────────────────────────
//
// 個社の施策明細から「チーム・組織がどう動いているか」を返す。
// 顧客情報タブで使う。
//
// ⚠️ **明細CSVは13.8MB。** URL パラメータでの絞り込みが効かないため全件取得して
// プロセス内で索引する（1時間キャッシュ）。**このルート以外から呼ばない。**
// 一覧・ボードはサマリ（800KB）だけで組む。
//
// 初回は取得に5秒前後かかる。タブを開いたときだけ走るので許容する。

import { NextResponse } from 'next/server';
import { fetchProjectsByCompany } from '@/lib/nocodb/project-info';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import {
  fetchCampaignDetailMap, fetchCampaignSummaryMap, getCampaignCacheAge,
  type CampaignDetailRow,
} from '@/lib/metabase/project-campaigns';
import { buildCampaignOrg, type CampaignOrgVM } from '@/lib/company/campaign-org-signals';
import { aggregateCampaignSignals, type CampaignSignalVM } from '@/lib/company/campaign-signals';

export const maxDuration = 120;

export interface CompanyCampaignsResponse {
  companyUid:  string;
  companyName: string;
  /** 集計に含めたプロジェクト（有料のみ） */
  projects: Array<{ id: string; name: string; paidType: string | null; campaigns: number }>;
  /** 施策の直近の動き（サマリ由来・有料PJ合算） */
  activity: CampaignSignalVM;
  /** 組織の動き（明細由来） */
  org: CampaignOrgVM;
  /** このデータで答えられないこと。画面に明記する */
  limitations: string[];
  cacheAgeSec: number | null;
}

const LIMITATIONS = [
  '施策をいつ停止したかは分かりません（停止時刻の列がありません）。PAUSED は現在の状態であって履歴ではありません。',
  '施策の最終更新日時は分かりません。RUNNING が先週始まったのか2年前から放置なのかは、初公開日からの推測に留まります。',
  '施策の成果（表示回数・ゴール到達数・CVR）は含まれません。ゴール数は設定数であって達成数ではありません。',
  '明細は直近2年が対象です（ただし現在 RUNNING / SCHEDULED のものは期間外でも含まれます）。',
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const [company, projects] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchProjectsByCompany(companyUid).catch(() => []),
  ]);
  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // 有料PJのみ。FREE を混ぜると組織の動きが読めなくなる
  const paid = projects.filter(p => p.paidType !== 'FREE');
  if (paid.length === 0) {
    return NextResponse.json({
      companyUid, companyName: company.name, projects: [],
      activity: aggregateCampaignSignals([]),
      org: buildCampaignOrg([]),
      limitations: LIMITATIONS, cacheAgeSec: null,
    } satisfies CompanyCampaignsResponse);
  }

  const [detail, summary] = await Promise.all([
    fetchCampaignDetailMap().catch(() => new Map<string, CampaignDetailRow[]>()),
    fetchCampaignSummaryMap().catch(() => new Map()),
  ]);

  const rows: CampaignDetailRow[] = [];
  const projectRows: CompanyCampaignsResponse['projects'] = [];
  for (const p of paid) {
    const list = detail.get(p.id) ?? [];
    rows.push(...list);
    projectRows.push({ id: p.id, name: p.name, paidType: p.paidType, campaigns: list.length });
  }
  projectRows.sort((a, b) => b.campaigns - a.campaigns);

  const body: CompanyCampaignsResponse = {
    companyUid,
    companyName: company.name,
    projects: projectRows,
    activity: aggregateCampaignSignals(paid.map(p => summary.get(p.id) ?? null)),
    org: buildCampaignOrg(rows),
    limitations: LIMITATIONS,
    cacheAgeSec: (() => {
      const a = getCampaignCacheAge().detail;
      return a === null ? null : Math.round(a / 1000);
    })(),
  };
  return NextResponse.json(body);
}
