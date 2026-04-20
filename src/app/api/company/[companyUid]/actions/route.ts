// GET  /api/company/[companyUid]/actions  — 一覧取得
// POST /api/company/[companyUid]/actions  — 新規作成

import { NextResponse } from 'next/server';
import { getCompanyActions, createCompanyAction } from '@/lib/nocodb/company-actions';
import type { CompanyActionCreatePayload } from '@/lib/nocodb/company-actions';
import {
  logMutationEvent,
  buildActionCreatedEvent,
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
    const actions = await getCompanyActions(companyUid);
    return NextResponse.json({ actions });
  } catch (err) {
    console.error('[GET /api/company/[companyUid]/actions]', err);
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

  let body: Partial<CompanyActionCreatePayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!body.action_id) {
    return NextResponse.json({ error: 'action_id is required' }, { status: 400 });
  }

  // ── リクエストフィールドの正規化 ─────────────────────────────────────────────
  // フロントは { body, description } どちらで送っても受け入れる（後方互換）
  const rawBody = (body as Record<string, unknown>);
  const descriptionValue = (rawBody.description as string | undefined)?.trim()
    ?? (rawBody.body as string | undefined)?.trim()
    ?? '';

  const payload: CompanyActionCreatePayload = {
    action_id:      body.action_id!,
    company_uid:    companyUid,
    title:          body.title!.trim(),
    description:    descriptionValue,
    owner:          (rawBody.owner as string | undefined)?.trim() ?? '',
    due_date:       (rawBody.due_date as string | null | undefined) ?? null,
    status:         (rawBody.status as CompanyActionCreatePayload['status'] | undefined) ?? 'open',
    created_from:   (rawBody.created_from as CompanyActionCreatePayload['created_from'] | undefined) ?? 'manual',
    source_ref:     (rawBody.source_ref as string | null | undefined) ?? null,
    person_ref:     (rawBody.person_ref as string | null | undefined) ?? null,
    sf_todo_status: (rawBody.sf_todo_status as CompanyActionCreatePayload['sf_todo_status'] | undefined) ?? null,
    sf_todo_id:     (rawBody.sf_todo_id as string | null | undefined) ?? null,
    created_at:     (rawBody.created_at as string | undefined) ?? new Date().toISOString(),
  };

  console.log('[POST /api/.../actions] request payload:', JSON.stringify(rawBody));
  console.log('[POST /api/.../actions] normalized payload:', JSON.stringify(payload));

  try {
    const action = await createCompanyAction(payload);
    // mutation log（fire and forget — 保存失敗は実行を止めない）
    logMutationEvent(buildActionCreatedEvent(companyUid, {
      id:          action.id,
      title:       action.title,
      createdFrom: action.createdFrom,
      status:      action.status,
      owner:       action.owner,
      dueDate:     action.dueDate,
      sourceRef:   action.sourceRef,
      personRef:   action.personRef,
    }, { source: 'ui' })).catch(() => {});
    return NextResponse.json({ action }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/company/[companyUid]/actions] error:', err);
    return NextResponse.json({
      error:          String(err),
      cause:          err instanceof Error ? err.cause : undefined,
      payload_summary: {
        action_id:   payload.action_id,
        title:       payload.title,
        company_uid: payload.company_uid,
        status:      payload.status,
        created_from: payload.created_from,
      },
    }, { status: 500 });
  }
}
