// ─── GET/POST /api/batch/campaign-org ─────────────────────────────────────────
//
// **「施策から読む組織の動き」の日次事前計算。**
//
// 明細CSVは13.8MB。本番コールドで28.8秒かかる（2026-08-24 実測）。
// これまで個社ページで「押したときだけ」取得していたが、
// **1回落とせば全社分を一度に作れる**ので、毎朝まとめて作って保存する。
// 画面はボタンを押さずに保存済みを読む。
//
// 明細の取得は**この実行の中で1回だけ**。あとは会社ごとの索引と集計なので軽い。
//
//   ?tiers=1,2,3   対象Tier（既定 1,2,3）
//   ?budgetSec=N   1回の実行に使う秒数（既定 240 / 上限 280）

import { NextRequest, NextResponse } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { fetchCompaniesByTiers } from '@/lib/nocodb/companies';
import { fetchProjectsByUids } from '@/lib/nocodb/project-info';
import {
  fetchCampaignDetailMap, fetchCampaignSummaryMap, getCampaignCacheAge,
  type CampaignDetailRow,
} from '@/lib/metabase/project-campaigns';
import { composeCompanyCampaigns, paidProjectsOf } from '@/lib/company/company-campaigns';
import {
  saveCampaignOrg, fetchCampaignOrgRowIds, isCampaignOrgCacheEnabled,
} from '@/lib/nocodb/campaign-org-cache';

export const maxDuration = 300;

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const unauthorized = checkCronOrBatchAuth(req);
  if (unauthorized) return unauthorized;

  if (!isCampaignOrgCacheEnabled()) {
    return NextResponse.json(
      { error: 'NOCODB_CAMPAIGN_ORG_TABLE_ID が未設定です' }, { status: 501 },
    );
  }

  const started = Date.now();
  const sp = req.nextUrl.searchParams;
  const tiers = (sp.get('tiers') ?? '1,2,3').split(',')
    .map(v => Number(v.trim()))
    .filter((v): v is 1 | 2 | 3 | 5 => [1, 2, 3, 5].includes(v));
  const budgetSec = Math.min(Number(sp.get('budgetSec') ?? '240') || 240, 280);

  const companies = await fetchCompaniesByTiers(tiers, 600).catch(() => []);
  if (companies.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, saved: 0, failed: 0, remaining: 0 });
  }

  const uids = companies.map(c => c.id);

  // 明細・サマリ・プロジェクト・既存行IDを**それぞれ1回だけ**取る
  const [detail, summary, projectsByUid, rowIds] = await Promise.all([
    fetchCampaignDetailMap().catch(() => new Map<string, CampaignDetailRow[]>()),
    fetchCampaignSummaryMap().catch(() => new Map()),
    fetchProjectsByUids(uids).catch(() => new Map()),
    fetchCampaignOrgRowIds().catch(() => new Map<string, number>()),
  ]);

  const age = getCampaignCacheAge().detail;
  const cacheAgeSec = age === null ? null : Math.round(age / 1000);

  let ok = 0, failed = 0, processed = 0;
  const errors: string[] = [];

  // 書き込みは並列化する。1件ずつだと会社数ぶんの往復で予算を使い切る
  const queue = companies.slice();
  let cursor = 0;
  let stop = false;

  async function worker() {
    while (!stop) {
      const idx = cursor++;
      if (idx >= queue.length) return;
      if ((Date.now() - started) / 1000 > budgetSec) { stop = true; return; }

      const c = queue[idx];
      processed++;
      try {
        const paid = paidProjectsOf(projectsByUid.get(c.id) ?? []);
        const body = composeCompanyCampaigns({
          companyUid: c.id,
          companyName: c.name,
          paid, detail, summary, cacheAgeSec,
        });
        const res = await saveCampaignOrg({
          companyUid:    c.id,
          companyName:   c.name,
          payload:       body,
          campaignCount: body.projects.reduce((n, p) => n + p.campaigns, 0),
          creatorCount:  body.org.creators.length,
          projectCount:  body.projects.length,
          knownId:       rowIds.get(c.id),
        });
        if (res.ok) ok++;
        else { failed++; if (errors.length < 5) errors.push(`${c.name}: ${res.error}`); }
      } catch (e) {
        failed++;
        if (errors.length < 5) errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 6 }, () => worker()));

  return NextResponse.json({
    ok: failed === 0,
    tiers,
    processed,
    saved: ok,
    failed,
    total: companies.length,
    /** まだ処理していない社数。0 になるまで走り続ける */
    remaining: companies.length - processed,
    budgetSec,
    errors,
    elapsedSec: Math.round((Date.now() - started) / 1000),
  });
}
