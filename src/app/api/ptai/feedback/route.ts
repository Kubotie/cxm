// ─── /api/ptai/feedback ───────────────────────────────────────────────────────
//
// 画面から送られた要望・不具合を Twenty（testFeedback）に貯める。
//
// ── 認可（2026-10-01 の決定）──────────────────────────────────────────────
//   POST  … ログインしていれば誰でも送れる（気づいたときに出せることを優先）
//   GET   … admin / ops だけ。一覧と判断記録は運用側のもの
//   PATCH … admin / ops だけ。対応方針・状態を書く
//
// 返すのは件数と本人が書いた内容だけ。顧客名は載せない。

import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/auth/guard';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import { actorStampFor } from '@/lib/ptai/staff';
import { upsertByExternalId, listRecords, updateRecord } from '@/lib/ptai/twenty-test/client';
import {
  TEST_OBJECTS, FEEDBACK_KIND, FEEDBACK_STATUS,
  type FeedbackKind, type FeedbackStatus,
} from '@/lib/ptai/twenty-test/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const FB = TEST_OBJECTS.feedback;

const str = (v: unknown, max = 2000): string =>
  (typeof v === 'string' ? v : '').trim().slice(0, max);

/** 見出しは本文の 1 行目から作る。長い本文をそのまま name にしない */
const headline = (body: string): string => {
  const first = body.split(/\r?\n/).find(l => l.trim()) ?? '';
  return first.trim().slice(0, 60) || '（内容なし）';
};

// ── 送信（誰でも）─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const me = await getPtaiIdentity();
  if (!me) return NextResponse.json({ ok: false, code: 'session_expired' }, { status: 401 });

  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const body = str(b.body);
  if (!body) {
    return NextResponse.json({ ok: false, code: 'invalid_request', message: '内容を入力してください' }, { status: 400 });
  }
  const kind = (FEEDBACK_KIND as readonly string[]).includes(str(b.kind))
    ? str(b.kind) as FeedbackKind : 'REQUEST';

  try {
    const who = await actorStampFor(me.id, me.name);
    const ext = `fb:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    await upsertByExternalId(FB.plural, FB.singular, ext, {
      name:        headline(body),
      body,
      kind,
      status:      'NEW',
      selector:    str(b.selector, 400) || null,
      elementText: str(b.elementText, 300) || null,
      screenPath:  str(b.screenPath, 200) || null,
      notionCompanyId: str(b.companyId, 64) || null,
      reporter:    who.name2,
    }, who);
    return NextResponse.json({ ok: true, id: ext }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ptai/feedback] 保存に失敗', (e as Error).name);
    return NextResponse.json({ ok: false, code: 'upstream_unavailable' }, { status: 502 });
  }
}

// ── 一覧（admin / ops）────────────────────────────────────────────────────

export interface FeedbackRow {
  id: string;
  externalId: string;
  name: string;
  body: string;
  kind: string;
  status: string;
  selector: string | null;
  elementText: string | null;
  screenPath: string | null;
  reporter: string | null;
  decision: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;

  const want = req.nextUrl.searchParams.get('status');
  try {
    const rows = await listRecords(FB.plural, FB.singular, { pageSize: 200, maxRecords: 1000 });
    const out: FeedbackRow[] = rows
      .map(r => ({
        id:          String(r.id ?? ''),
        externalId:  String(r.externalId ?? ''),
        name:        String(r.name ?? ''),
        body:        String(r.body ?? ''),
        kind:        String(r.kind ?? ''),
        status:      String(r.status ?? 'NEW'),
        selector:    (r.selector as string) ?? null,
        elementText: (r.elementText as string) ?? null,
        screenPath:  (r.screenPath as string) ?? null,
        reporter:    (r.reporter as string) ?? null,
        decision:    (r.decision as string) ?? null,
        decidedBy:   (r.decidedBy as string) ?? null,
        decidedAt:   (r.decidedAt as string) ?? null,
        resolvedAt:  (r.resolvedAt as string) ?? null,
        createdAt:   String(r.createdAt ?? ''),
      }))
      .filter(r => !want || r.status === want)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const byStatus: Record<string, number> = {};
    for (const r of out) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    return NextResponse.json({ ok: true, total: out.length, byStatus, items: out },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ptai/feedback] 一覧に失敗', (e as Error).name);
    return NextResponse.json({ ok: false, code: 'upstream_unavailable' }, { status: 502 });
  }
}

// ── 判断を書く（admin / ops）──────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;

  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = str(b.id, 64);
  const status = str(b.status, 20);
  if (!id || !(FEEDBACK_STATUS as readonly string[]).includes(status)) {
    return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: status as FeedbackStatus,
    decidedAt: now,
    decidedBy: gate.profile.name2,
  };
  const decision = str(b.decision);
  if (decision) patch.decision = decision;
  if (status === 'RESOLVED' || status === 'DISMISSED') patch.resolvedAt = now;

  try {
    await updateRecord(FB.plural, FB.singular, id, patch);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ptai/feedback] 更新に失敗', (e as Error).name);
    return NextResponse.json({ ok: false, code: 'upstream_unavailable' }, { status: 502 });
  }
}
