// ─── GET/PATCH/DELETE /api/ops/policies/[policyId] ────────────────────────────
//
// GET    — policy_id で1件取得
// PATCH  — 部分更新（status/name/conditions 等）
// DELETE — 論理削除（status を 'paused' + deleted_at 設定）
//          物理削除は NocoDB 管理画面で行う（API では提供しない）

import { NextRequest, NextResponse } from 'next/server';
import { getPolicyById, updatePolicy, setPolicyStatus } from '@/lib/nocodb/policy-store';
import type { PolicyWritePayload } from '@/lib/nocodb/policy-store';

type RouteContext = { params: Promise<{ policyId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { policyId } = await params;

  try {
    const policy = await getPolicyById(policyId);
    if (!policy) {
      return NextResponse.json({ error: 'ポリシーが見つかりません' }, { status: 404 });
    }
    return NextResponse.json(policy);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { policyId } = await params;

  let body: Partial<PolicyWritePayload & { status: 'draft' | 'active' | 'paused' }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  try {
    const existing = await getPolicyById(policyId);
    if (!existing) {
      return NextResponse.json({ error: 'ポリシーが見つかりません' }, { status: 404 });
    }

    // status のみの変更は setPolicyStatus を使う
    if (body.status && Object.keys(body).length === 1) {
      await setPolicyStatus(existing.rowId, body.status);
    } else {
      await updatePolicy(existing.rowId, body);
    }

    const updated = await getPolicyById(policyId);
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { policyId } = await params;

  try {
    const existing = await getPolicyById(policyId);
    if (!existing) {
      return NextResponse.json({ error: 'ポリシーが見つかりません' }, { status: 404 });
    }
    // 論理削除: status を paused にする（物理削除は NocoDB 管理画面で行う）
    await setPolicyStatus(existing.rowId, 'paused');
    return NextResponse.json({ ok: true, policyId, status: 'paused' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
