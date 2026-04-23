// ─── POST /api/batch/company-summary-event ────────────────────────────────────
//
// Summary Policy の generation_trigger = 'on_event' に対応するイベントドリブン
// エンドポイント。NocoDB の Webhook（Evidence 作成・更新時）から呼ばれることを想定。
//
// ── 生成ロジックの所在 ────────────────────────────────────────────────────────
//   生成ロジックは src/lib/summary/event-trigger.ts に集約。
//   このファイルは HTTP アダプター（認証 + パース + 監査ログ）のみ担当。
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   SUPPORT_BATCH_SECRET を Authorization: Bearer に設定
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
// {
//   event_type?:   "evidence_created" | "evidence_updated"  (ログ用, default: "evidence_event")
//   company_uid:   string                                    (必須)
//   evidence_id?:  string                                    (ログ用 / 将来フィルタ用)
//   policy_id?:    string                                    (省略時 = active な on_event ポリシーを自動選択)
//   dry_run?:      boolean                                   (default: false)
// }
//
// ── NocoDB Webhook 設定例 ─────────────────────────────────────────────────────
//   テーブル: evidence
//   イベント: After Insert / After Update
//   URL:      https://<your-domain>/api/batch/company-summary-event
//   Headers:  Authorization: Bearer <SUPPORT_BATCH_SECRET>
//   Body:
//   {
//     "event_type": "evidence_created",
//     "company_uid": "{{row.company_uid}}",
//     "evidence_id": "{{row.Id}}"
//   }

import { NextRequest, NextResponse }  from 'next/server';
import { checkBatchAuth }             from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { triggerSummaryRefreshForCompany } from '@/lib/summary/event-trigger';

// ── 型定義 ───────────────────────────────────────────────────────────────────

interface RequestBody {
  event_type?:  string;
  company_uid?: string;
  evidence_id?: string;
  policy_id?:   string;
  dry_run?:     boolean;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 認証 ──────────────────────────────────────────────────────────────────
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const startedAt = new Date();
  const body: RequestBody = await req.json().catch(() => ({}));

  const companyUid = body.company_uid?.trim();
  if (!companyUid) {
    return NextResponse.json({ error: 'company_uid は必須です' }, { status: 400 });
  }

  const eventType = body.event_type ?? 'evidence_event';

  // ── トリガー実行 ──────────────────────────────────────────────────────────
  let triggerResult: Awaited<ReturnType<typeof triggerSummaryRefreshForCompany>>;
  try {
    triggerResult = await triggerSummaryRefreshForCompany(
      companyUid,
      eventType,
      { policy_id: body.policy_id, dry_run: body.dry_run ?? false },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[batch/company-summary-event] ${companyUid} error:`, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const finishedAt = new Date();
  console.log(`[batch/company-summary-event] ${companyUid} (${eventType}) → ${triggerResult.status}`);

  // ── 監査ログ ──────────────────────────────────────────────────────────────
  const { logId } = await writeBatchRunLog({
    endpoint:        '/api/batch/company-summary-event',
    batch_type:      'company-summary-event',
    started_at:      startedAt.toISOString(),
    finished_at:     finishedAt.toISOString(),
    duration_ms:     finishedAt.getTime() - startedAt.getTime(),
    dry_run:         body.dry_run ?? false,
    source_queue:    'evidence_event',
    request_params:  sanitizeRequestParams(body as unknown as Record<string, unknown>),
    filters:         JSON.stringify({ event_type: eventType }),
    total_targeted:  1,
    ok_count:        triggerResult.status === 'generated' ? 1 : 0,
    success_count:   triggerResult.status === 'generated' ? 1 : 0,
    partial_count:   0,
    failed_count:    triggerResult.status === 'failed'    ? 1 : 0,
    skipped_count:   triggerResult.status === 'skipped'   ? 1 : 0,
    failure_details: triggerResult.status === 'failed'
      ? JSON.stringify([{ company_uid: companyUid, reason: triggerResult.error ?? '' }])
      : '[]',
    result_json: JSON.stringify({ ...triggerResult, event_type: eventType, company_uid: companyUid }),
  }).catch(() => ({ logId: undefined }));

  return NextResponse.json({
    event_type:        eventType,
    company_uid:       companyUid,
    ...triggerResult,
    audit_log_id: logId,
  });
}
