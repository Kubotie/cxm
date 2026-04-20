// GET  /api/company/[companyUid]/people  — CXM マネージド連絡先一覧取得
// POST /api/company/[companyUid]/people  — 新規連絡先作成
//
// ⚠️  graceful degradation:
//   NOCODB_COMPANY_PEOPLE_TABLE_ID 未設定時:
//   - GET → { people: [] }（空配列。UI は壊れない）
//   - POST → 500 を返すが、UI 側は optimistic update でローカルに保持する

import { NextResponse } from 'next/server';
import { getCompanyPeople, createCompanyPerson } from '@/lib/nocodb/company-people';
import type { CompanyPersonCreatePayload } from '@/lib/nocodb/company-people';
import {
  logMutationEvent,
  buildContactCreatedEvent,
} from '@/lib/company/company-mutation-events';

type RouteContext = { params: Promise<{ companyUid: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: RouteContext,
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid is required' }, { status: 400 });
  }

  try {
    const people = await getCompanyPeople(companyUid);
    return NextResponse.json({ people });
  } catch (err) {
    console.error('[GET /api/company/[companyUid]/people]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: RouteContext,
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid is required' }, { status: 400 });
  }

  let body: Partial<CompanyPersonCreatePayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!body.person_id) {
    return NextResponse.json({ error: 'person_id is required' }, { status: 400 });
  }

  const payload: CompanyPersonCreatePayload = {
    person_id:         body.person_id,
    company_uid:       companyUid,
    name:              body.name.trim(),
    role:              body.role?.trim(),
    title:             body.title?.trim(),
    department:        body.department?.trim(),
    email:             body.email?.trim() ?? null,
    phone:             body.phone?.trim() ?? null,
    decision_influence: body.decision_influence ?? 'unknown',
    contact_status:    body.contact_status    ?? 'not contacted',
    status:            body.status            ?? 'proposed',
    last_touchpoint:   body.last_touchpoint   ?? null,
    manager_id:        body.manager_id        ?? null,
    owner:             body.owner             ?? null,
    source:            body.source            ?? 'cxm',
    sf_id:             body.sf_id             ?? null,
    sync_status:       body.sync_status       ?? null,
    sf_last_synced_at: body.sf_last_synced_at ?? null,
    created_at:        body.created_at        ?? new Date().toISOString(),
  };

  try {
    const person = await createCompanyPerson(payload);
    // mutation log（fire and forget）
    logMutationEvent(buildContactCreatedEvent(companyUid, {
      id:                person.id,
      name:              person.name,
      role:              person.role ?? '',
      decisionInfluence: person.decisionInfluence ?? 'unknown',
      contactStatus:     person.contactStatus ?? 'not contacted',
      source:            person.source ?? 'cxm',
    }, { source: 'ui' })).catch(() => {});
    return NextResponse.json({ person }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/company/[companyUid]/people]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
