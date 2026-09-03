// ─── GET /api/company/[companyUid]/campaigns ──────────────────────────────────
//
// 個社の施策明細から「チーム・組織がどう動いているか」を返す。
// 顧客情報タブで使う。
//
// **既定は日次バッチ（cxm_campaign_org）が作った保存済みを返す。**
//   明細CSVは13.8MBで、本番コールドで28.8秒かかる（2026-08-24 実測）。
//   毎朝1回落とせば全社分を一度に作れるので、画面はボタンを押さずに読むだけにした。
//
//   ?refresh=1 … 保存済みを無視してその場で明細から作り直す（時間がかかる）
//
// ⚠️ 明細は URL パラメータでの絞り込みが効かないため全件取得してプロセス内で索引する。
//   **このルートとバッチ以外から呼ばない。** 一覧・ボードはサマリ（800KB）だけで組む。

import { NextRequest, NextResponse } from 'next/server';
import { fetchProjectsByCompany } from '@/lib/nocodb/project-info';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import {
  fetchCampaignDetailMap, fetchCampaignSummaryMap, getCampaignCacheAge,
  type CampaignDetailRow,
} from '@/lib/metabase/project-campaigns';
import { buildCampaignOrg, EMPTY_DIRECTION } from '@/lib/company/campaign-org-signals';
import { aggregateCampaignSignals } from '@/lib/company/campaign-signals';
import {
  composeCompanyCampaigns, paidProjectsOf, CAMPAIGN_LIMITATIONS,
  type CompanyCampaignsResponse,
} from '@/lib/company/company-campaigns';
import { fetchStoredCampaignOrg } from '@/lib/nocodb/campaign-org-cache';

export const maxDuration = 120;

export type { CompanyCampaignsResponse };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }
  const refresh = req.nextUrl.searchParams.get('refresh') === '1';

  // ── 保存済み（既定）────────────────────────────────────────────────────
  if (!refresh) {
    const cached = await fetchStoredCampaignOrg<CompanyCampaignsResponse>(companyUid)
      .catch(() => ({ payload: null, computedAt: null, ageHours: null }));
    if (cached.payload) {
      // 日次バッチが古い形式で保存している間も壊れないようにする。
      // （`direction` は 2026-08-25 に追加。次のバッチで埋まる）
      const payload = cached.payload;
      return NextResponse.json({
        ...payload,
        org: { ...payload.org, direction: payload.org?.direction ?? EMPTY_DIRECTION,
               summaries: { direction: '', ...(payload.org?.summaries ?? {}) } },
        fromCache:  true,
        computedAt: cached.computedAt,
      } satisfies CompanyCampaignsResponse);
    }
  }

  const [company, projects] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchProjectsByCompany(companyUid).catch(() => []),
  ]);
  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  const paid = paidProjectsOf(projects);
  if (paid.length === 0) {
    return NextResponse.json({
      companyUid, companyName: company.name, projects: [],
      activity: aggregateCampaignSignals([]),
      org: buildCampaignOrg([] as CampaignDetailRow[]),
      limitations: CAMPAIGN_LIMITATIONS, cacheAgeSec: null, fromCache: false,
    } satisfies CompanyCampaignsResponse);
  }

  const [detail, summary] = await Promise.all([
    fetchCampaignDetailMap().catch(() => new Map<string, CampaignDetailRow[]>()),
    fetchCampaignSummaryMap().catch(() => new Map()),
  ]);

  const age = getCampaignCacheAge().detail;
  const body = composeCompanyCampaigns({
    companyUid,
    companyName: company.name,
    paid, detail, summary,
    cacheAgeSec: age === null ? null : Math.round(age / 1000),
  });
  return NextResponse.json({ ...body, fromCache: false } satisfies CompanyCampaignsResponse);
}
