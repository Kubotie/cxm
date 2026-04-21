// ─── GET/POST /api/ops/policies ────────────────────────────────────────────────
//
// GET  — ポリシー一覧取得
//   クエリ: type=alert|summary（省略=全件）、limit（デフォルト200）
//
// POST — ポリシー新規作成
//   ボディ: PolicyWritePayload（policy_id は省略可、サーバーで生成）

import { NextRequest, NextResponse } from 'next/server';
import { listPolicies, createPolicy } from '@/lib/nocodb/policy-store';
import type { PolicyWritePayload } from '@/lib/nocodb/policy-store';

function randomPolicyId(): string {
  return `pol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const policyType = searchParams.get('type') as 'alert' | 'summary' | null;
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500);

  try {
    const policies = await listPolicies(policyType ?? undefined, limit);
    return NextResponse.json({ total: policies.length, items: policies });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[policies] list error:', err);
    // TABLE_ID 未設定の場合は空リストで graceful degradation
    if (msg.includes('NOCODB_POLICIES_TABLE_ID が未設定')) {
      return NextResponse.json({ total: 0, items: [], warning: msg });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Partial<PolicyWritePayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  if (!body.name || !body.policy_type) {
    return NextResponse.json({ error: 'name と policy_type は必須です' }, { status: 400 });
  }

  const now     = new Date().toISOString();
  const payload: PolicyWritePayload = {
    policy_id:            body.policy_id ?? randomPolicyId(),
    policy_type:          body.policy_type,
    name:                 body.name,
    description:          body.description,
    status:               body.status ?? 'draft',
    version:              body.version ?? 1,
    object_type:          body.object_type,
    signal_category:      body.signal_category,
    scope:                body.scope,
    condition_logic:      body.condition_logic,
    interpretation_mode:  body.interpretation_mode,
    structured_conditions: body.structured_conditions,
    segment_filter:       body.segment_filter,
    nl_condition:         body.nl_condition,
    ai_hint:              body.ai_hint,
    output:               body.output,
    target:               body.target,
    generation_trigger:   body.generation_trigger,
    input_scope:          body.input_scope,
    input_recent_days:    body.input_recent_days,
    summary_focus:        body.summary_focus,
    output_schema:        body.output_schema,
    freshness_rule:       body.freshness_rule,
    approval_rule:        body.approval_rule,
    created_at:           body.created_at ?? now,
    updated_at:           now,
  };

  try {
    const created = await createPolicy(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[policies] create error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
