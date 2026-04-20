// ─── POST /api/support/cases/[caseId]/ai-review ──────────────────────────────
// human_review_status を更新する。
// reviewed_by / reviewed_at は自動セットされる。
//
// リクエストボディ:
//   { human_review_status: string; reviewed_by?: string; source_queue?: string }
//
// レスポンス:
//   { ok: true; record: SupportCaseAiStateRecord }
//   { ok: false; error: string }

import { NextRequest, NextResponse } from 'next/server';
import { updateHumanReviewStatus } from '@/lib/nocodb/support-ai-state-store';
import type { SupportCaseAiSourceQueue, SupportCaseAiHumanReviewStatus } from '@/lib/nocodb/support-ai-state-types';
import { SUPPORT_CASE_AI_HUMAN_REVIEW_STATUSES } from '@/lib/nocodb/support-ai-state-types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const body = await req.json().catch(() => ({}));

  const { human_review_status, reviewed_by, source_queue } = body as {
    human_review_status?: string;
    reviewed_by?: string;
    source_queue?: string;
  };

  if (!human_review_status || !SUPPORT_CASE_AI_HUMAN_REVIEW_STATUSES.includes(human_review_status as SupportCaseAiHumanReviewStatus)) {
    return NextResponse.json({ ok: false, error: 'Invalid human_review_status' }, { status: 400 });
  }

  const sq = source_queue ?? 'intercom';
  if (sq !== 'intercom' && sq !== 'cse_ticket') {
    return NextResponse.json({ ok: false, error: 'Invalid source_queue' }, { status: 400 });
  }

  const now = new Date();
  const reviewed_at = now.toISOString().replace('T', ' ').split('.')[0];

  const result = await updateHumanReviewStatus(
    sq as SupportCaseAiSourceQueue,
    caseId,
    {
      human_review_status: human_review_status as SupportCaseAiHumanReviewStatus,
      reviewed_by: reviewed_by ?? 'operator',
      reviewed_at,
    },
  );

  if (result.ok) {
    return NextResponse.json({ ok: true, record: result.record });
  }
  // discriminated union: { skipped: true; reason } | { skipped: false; error }
  const failedResult = result as { skipped: boolean; reason?: string; error?: string };
  const errMsg = failedResult.reason ?? failedResult.error ?? 'unknown error';
  return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
}
