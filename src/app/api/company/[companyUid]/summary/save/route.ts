// ─── POST /api/company/[companyUid]/summary/save ───────────────────────────
// すでに生成済みの Company Summary 結果を NocoDB に保存する（再生成しない）。
// OpenAI は呼ばない。
//
// ── リクエスト ──────────────────────────────────────────────────────────────
// {
//   summary:                 string,
//   overall_health:          string,
//   key_risks:               RiskItem[],
//   key_opportunities:       OpportunityItem[],
//   recommended_next_action: string,
//   model:                   string,
//   generated_at:            ISO8601,
//   evidence_count:          number,
//   alert_count:             number,
//   people_count:            number,
// }
//
// ── レスポンス ──────────────────────────────────────────────────────────────
// {
//   saved:       boolean,
//   created:     boolean,
//   save_error?: string,
// }

import { NextRequest, NextResponse } from 'next/server';
import { saveCompanySummaryState } from '@/lib/nocodb/company-summary-write';
import type { RiskItem, OpportunityItem } from '@/lib/prompts/company-evidence-summary';

interface RequestBody {
  summary:                 string;
  overall_health:          string;
  key_risks:               RiskItem[];
  key_opportunities:       OpportunityItem[];
  recommended_next_action: string;
  model:                   string;
  generated_at:            string;
  evidence_count:          number;
  alert_count:             number;
  people_count:            number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;

  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const saveResult = await saveCompanySummaryState({
    company_uid:             companyUid,
    summary:                 body.summary,
    overall_health:          body.overall_health,
    key_risks:               JSON.stringify(body.key_risks),
    key_opportunities:       JSON.stringify(body.key_opportunities),
    recommended_next_action: body.recommended_next_action,
    generated_by:            body.model,
    generated_at:            body.generated_at,
    last_ai_updated_at:      now,
    evidence_count:          body.evidence_count,
    alert_count:             body.alert_count,
    people_count:            body.people_count,
  }).catch(err => ({
    ok: false  as const,
    skipped: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  if (saveResult.ok) {
    return NextResponse.json({ saved: true, created: saveResult.created });
  } else if ('skipped' in saveResult && saveResult.skipped) {
    return NextResponse.json(
      { saved: false, created: false, save_error: saveResult.reason },
      { status: 409 },
    );
  } else {
    return NextResponse.json(
      { saved: false, created: false, save_error: (saveResult as { ok: false; skipped: false; error: string }).error },
      { status: 500 },
    );
  }
}
