// PATCH /api/company/[companyUid]/people/[personId]
// CXM マネージド連絡先を部分更新する。
// personId は person_id (UUID)。rowId は body に含める。
//
// ⚠️  graceful degradation:
//   NOCODB_COMPANY_PEOPLE_TABLE_ID 未設定時は 500 を返す。
//   UI 側は catch して optimistic update（localContacts）をそのまま保持する。

import { NextResponse } from 'next/server';
import { updateCompanyPerson } from '@/lib/nocodb/company-people';
import type { CompanyPersonPatchPayload } from '@/lib/nocodb/company-people';
import {
  logMutationEvent,
  buildContactUpdatedEvent,
} from '@/lib/company/company-mutation-events';

type RouteContext = { params: Promise<{ companyUid: string; personId: string }> };

export async function PATCH(
  req: Request,
  { params }: RouteContext,
) {
  const { companyUid, personId } = await params;
  if (!companyUid || !personId) {
    return NextResponse.json(
      { error: 'companyUid and personId are required' },
      { status: 400 },
    );
  }

  let body: CompanyPersonPatchPayload & { rowId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rowId = body.rowId;
  if (typeof rowId !== 'number' || rowId <= 0) {
    return NextResponse.json(
      { error: 'rowId (NocoDB Id) is required' },
      { status: 400 },
    );
  }

  const patch: CompanyPersonPatchPayload = {};
  if (body.name                 !== undefined) patch.name                 = body.name;
  if (body.role                 !== undefined) patch.role                 = body.role;
  if (body.title                !== undefined) patch.title                = body.title;
  if (body.department           !== undefined) patch.department           = body.department;
  if (body.email                !== undefined) patch.email                = body.email;
  if (body.phone                !== undefined) patch.phone                = body.phone;
  if (body.decision_influence   !== undefined) patch.decision_influence   = body.decision_influence;
  if (body.contact_status       !== undefined) patch.contact_status       = body.contact_status;
  if (body.status               !== undefined) patch.status               = body.status;
  if (body.last_touchpoint      !== undefined) patch.last_touchpoint      = body.last_touchpoint;
  if (body.manager_id           !== undefined) patch.manager_id           = body.manager_id;
  if (body.owner                !== undefined) patch.owner                = body.owner;
  if (body.sf_id                !== undefined) patch.sf_id                = body.sf_id;
  if (body.sync_status          !== undefined) patch.sync_status          = body.sync_status;
  if (body.sf_last_synced_at    !== undefined) patch.sf_last_synced_at    = body.sf_last_synced_at;
  // ── Org chart 拡張フィールド ────────────────────────────────────────────────
  if (body.layer_role            !== undefined) patch.layer_role            = body.layer_role;
  if (body.is_executive          !== undefined) patch.is_executive          = body.is_executive;
  if (body.is_department_head    !== undefined) patch.is_department_head    = body.is_department_head;
  if (body.reports_to_person_id  !== undefined) patch.reports_to_person_id  = body.reports_to_person_id;
  if (body.works_with_person_ids !== undefined) patch.works_with_person_ids = body.works_with_person_ids;
  if (body.display_group         !== undefined) patch.display_group         = body.display_group;
  if (body.stakeholder_note      !== undefined) patch.stakeholder_note      = body.stakeholder_note;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const person = await updateCompanyPerson(rowId, patch);
    // mutation log（fire and forget）
    const afterEvent: Parameters<typeof buildContactUpdatedEvent>[4] = {};
    if (patch.role               !== undefined) afterEvent.role              = patch.role;
    if (patch.decision_influence !== undefined) afterEvent.decisionInfluence = patch.decision_influence;
    if (patch.contact_status     !== undefined) afterEvent.contactStatus     = patch.contact_status;
    if (patch.owner              !== undefined) afterEvent.owner             = patch.owner;
    if (patch.last_touchpoint    !== undefined) afterEvent.lastTouchpoint    = patch.last_touchpoint;
    logMutationEvent(buildContactUpdatedEvent(companyUid, personId, person.name, {}, afterEvent, { source: 'ui' })).catch(() => {});
    return NextResponse.json({ person });
  } catch (err) {
    console.error('[PATCH /api/company/[companyUid]/people/[personId]]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
