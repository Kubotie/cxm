// ─── POST /api/company/[companyUid]/actions/[actionId]/sf-push ────────────────
//
// CXM Action の現在値を Salesforce Task に push する（CXM → SF 手動同期）。
//
// sync-policy.ts の ACTION_SYNC_FIELDS に従い、以下のフィールドを SF Task に反映:
//   title / description / due_date / owner(email→SF UserId変換) / status
//
// 前提:
//   - action.sf_todo_id が存在すること（SF Task と紐付いていること）
//   - sf_todo_id は request body の sfTaskId で渡す
//
// レスポンス:
//   { ok: true,  syncedAt }
//   { ok: false, error }

import { NextResponse } from 'next/server';
import { activeSalesforceTaskAdapter } from '@/lib/salesforce/salesforce-task-adapter';
import { isSalesforceConfigured } from '@/lib/salesforce/client';
import { ACTION_SYNC_FIELDS } from '@/lib/salesforce/sync-policy';
import { logMutationEvent, buildActionSfPushedEvent } from '@/lib/company/company-mutation-events';

type RouteContext = { params: Promise<{ companyUid: string; actionId: string }> };

interface SfPushBody {
  sfTaskId:     string;
  title?:       string;
  description?: string;
  dueDate?:     string | null;
  ownerEmail?:  string;
  status?:      string;
}

export async function POST(req: Request, { params }: RouteContext) {
  const { companyUid, actionId } = await params;
  if (!companyUid || !actionId) {
    return NextResponse.json({ error: 'companyUid and actionId are required' }, { status: 400 });
  }

  if (!isSalesforceConfigured()) {
    return NextResponse.json({
      ok:    false,
      error: 'Salesforce 環境変数が未設定です。SALESFORCE_* を設定してください。',
    }, { status: 503 });
  }

  let body: SfPushBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.sfTaskId) {
    return NextResponse.json({
      error: 'sfTaskId は必須です。company_actions.sf_todo_id の値を渡してください。',
    }, { status: 400 });
  }

  const result = await activeSalesforceTaskAdapter.updateTask({
    sfTaskId:     body.sfTaskId,
    title:        body.title,
    description:  body.description,
    dueDate:      body.dueDate,
    ownerEmail:   body.ownerEmail,
    status:       body.status,
  });

  const syncedAt = new Date().toISOString();
  const syncResult = result.syncResult === 'synced' ? 'synced' : 'sync_error';

  // fire-and-forget mutation log
  logMutationEvent(buildActionSfPushedEvent(
    companyUid,
    { actionId, sfTaskId: body.sfTaskId, syncedFields: [...ACTION_SYNC_FIELDS], syncResult, error: result.error },
    { source: 'ui' },
  )).catch(() => {});

  if (result.syncResult === 'synced') {
    return NextResponse.json({
      ok:           true,
      actionId,
      sfTaskId:     body.sfTaskId,
      syncedAt,
      syncedFields: ACTION_SYNC_FIELDS,
    });
  }

  return NextResponse.json({
    ok:    false,
    error: result.error ?? 'SF Task 更新に失敗しました',
  }, { status: 502 });
}
