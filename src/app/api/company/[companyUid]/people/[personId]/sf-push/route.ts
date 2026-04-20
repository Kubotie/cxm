// ─── POST /api/company/[companyUid]/people/[personId]/sf-push ─────────────────
//
// CXM Contact の SF主フィールドを Salesforce Contact に push する（CXM → SF 手動同期）。
//
// sync-policy.ts の CONTACT_CXM_TO_SF_PUSH_FIELDS に従い、以下のみを対象とする:
//   Title / Department / Email / Phone
//
// CXM主フィールド（role / layer_role / stakeholder_note 等）は含まない。
// SF側には存在しないため、送っても反映されないか上書きされる恐れがある。
//
// 前提:
//   - company_people.sf_id が存在すること（SF Contact と紐付いていること）
//   - sf_id は request body の sfContactId で渡す
//
// レスポンス:
//   { ok: true,  syncedAt, syncedFields }
//   { ok: false, error }

import { NextResponse } from 'next/server';
import { activeSalesforceContactAdapter } from '@/lib/salesforce/salesforce-contact-adapter';
import { isSalesforceConfigured } from '@/lib/salesforce/client';
import { CONTACT_CXM_TO_SF_PUSH_FIELDS } from '@/lib/salesforce/sync-policy';
import { logMutationEvent, buildContactSfPushedEvent } from '@/lib/company/company-mutation-events';

type RouteContext = { params: Promise<{ companyUid: string; personId: string }> };

interface SfPushBody {
  sfContactId:  string;
  Title?:       string;
  Department?:  string;
  Email?:       string;
  Phone?:       string;
}

export async function POST(req: Request, { params }: RouteContext) {
  const { companyUid, personId } = await params;
  if (!companyUid || !personId) {
    return NextResponse.json({ error: 'companyUid and personId are required' }, { status: 400 });
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

  if (!body.sfContactId) {
    return NextResponse.json({
      error: 'sfContactId は必須です。company_people.sf_id の値を渡してください。',
    }, { status: 400 });
  }

  const result = await activeSalesforceContactAdapter.pushCxmFieldsToSalesforce({
    sfContactId: body.sfContactId,
    Title:       body.Title,
    Department:  body.Department,
    Email:       body.Email,
    Phone:       body.Phone,
  });

  const syncedAt  = new Date().toISOString();
  const syncResult = result.ok ? 'synced' : 'sync_error';

  // fire-and-forget mutation log
  logMutationEvent(buildContactSfPushedEvent(
    companyUid,
    { personId, sfContactId: body.sfContactId, syncedFields: [...CONTACT_CXM_TO_SF_PUSH_FIELDS], syncResult, error: result.error },
    { source: 'ui' },
  )).catch(() => {});

  if (result.ok) {
    return NextResponse.json({
      ok:           true,
      personId,
      sfContactId:  body.sfContactId,
      syncedAt,
      syncedFields: CONTACT_CXM_TO_SF_PUSH_FIELDS,
    });
  }

  return NextResponse.json({
    ok:    false,
    error: result.error ?? 'SF Contact 更新に失敗しました',
  }, { status: 502 });
}
