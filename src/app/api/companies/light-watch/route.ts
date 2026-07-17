// ─── GET /api/companies/light-watch ───────────────────────────────────────────
//
// Tier 3 + is_paid_watched=true の企業一覧を、最新スナップショット情報つきで返す。
// /console/tier3 の一覧画面で使用。

import { NextRequest, NextResponse } from 'next/server';
import { fetchLightWatchCompanies } from '@/lib/nocodb/companies';
import { fetchLatestSnapshotsByUids } from '@/lib/nocodb/company-snapshot';

export interface LightWatchItem {
  companyUid:            string;
  canonicalName:         string;
  tier:                  1 | 2 | 3 | 5 | null;
  isPaidWatched:         boolean;
  owner:                 string;
  lastContact:           string;
  updatedAt:             string | null;

  // ── 最新スナップショット ─────────────────────────────────────────────────
  snapshotDate:          string | null;
  mrr:                   number | null;
  openSupportCount:      number | null;
  renewalBucket:         string | null;
  renewalDate:           string | null;
  activeProjectCount:    number | null;
  stalledProjectCount:   number | null;
  totalL30Active:        number | null;
  runningCampaignTotal:  number | null;
  pvCeilingAlertCount:   number | null;
}

export interface LightWatchResponse {
  total: number;
  byTier: {
    tier3:         number;
    paidUntagged:  number;   // is_paid_watched=true かつ tier=null
  };
  items: LightWatchItem[];
}

function n(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(v) ? v : null;
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<LightWatchResponse | { error: string }>> {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '2000', 10) || 2000;
    const companies = await fetchLightWatchCompanies(limit);
    const uids = companies.map(c => c.id);
    const snapshotMap = uids.length > 0
      ? await fetchLatestSnapshotsByUids(uids).catch(() => new Map())
      : new Map();

    const items: LightWatchItem[] = companies.map(c => {
      const snap = snapshotMap.get(c.id) ?? null;
      return {
        companyUid:            c.id,
        canonicalName:         c.name,
        tier:                  c.tier,
        isPaidWatched:         c.isPaidWatched,
        owner:                 c.owner,
        lastContact:           c.lastContact,
        updatedAt:             c.updatedAt,
        snapshotDate:          snap?.snapshot_date ?? null,
        mrr:                   n(snap?.mrr),
        openSupportCount:      n(snap?.open_support_count),
        renewalBucket:         snap?.renewal_bucket ?? null,
        renewalDate:           snap?.renewal_date ?? null,
        activeProjectCount:    n(snap?.active_project_count),
        stalledProjectCount:   n(snap?.stalled_project_count),
        totalL30Active:        n(snap?.total_l30_active),
        runningCampaignTotal:  n(snap?.running_campaign_total),
        pvCeilingAlertCount:   n(snap?.pv_ceiling_alert_count),
      };
    });

    let tier3Count = 0;
    let paidUntaggedCount = 0;
    for (const it of items) {
      if (it.tier === 3) tier3Count++;
      else if (it.isPaidWatched && it.tier == null) paidUntaggedCount++;
    }

    return NextResponse.json({
      total:  items.length,
      byTier: { tier3: tier3Count, paidUntagged: paidUntaggedCount },
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
