// ─── POST /api/company/[companyUid]/summary/save ────────────────────────────
// すでに生成済みの Company Summary 結果を NocoDB に保存する（AI 呼び出しなし）。
// 再生成 + 保存は POST /regenerate を使うこと。
//
// ── リクエスト ──────────────────────────────────────────────────────────────
// {
//   summary:                 string,       // AI 生成テキスト
//   overall_health:          string,
//   key_risks:               RiskItem[],
//   key_opportunities:       OpportunityItem[],
//   recommended_next_action: string,
//   model:                   string,
//   generated_at:            ISO8601,
//   evidence_count:          number,
//   alert_count:             number,
//   people_count:            number,
//   summary_type?:           string,       // default: "default"
//   ai_version?:             string,       // default: "company-summary-v1"
// }
//
// ── レスポンス ──────────────────────────────────────────────────────────────
// { saved: boolean, created: boolean, save_error?: string }

import { NextRequest, NextResponse } from 'next/server';
import { saveCompanySummaryState } from '@/lib/nocodb/company-summary-write';
import type { RiskItem, OpportunityItem } from '@/lib/prompts/company-evidence-summary';

const DEFAULT_AI_VERSION = 'company-summary-v1';

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
  summary_type?:           string;
  ai_version?:             string;
  applied_policy_id?:      string | null;
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
    summary_type:            body.summary_type ?? 'default',
    ai_summary:              body.summary,
    overall_health:          body.overall_health,
    key_risks:               JSON.stringify(body.key_risks),
    key_opportunities:       JSON.stringify(body.key_opportunities),
    recommended_next_action: body.recommended_next_action,
    model:                   body.model,
    ai_version:              body.ai_version ?? DEFAULT_AI_VERSION,
    last_ai_updated_at:      now,
    evidence_count:          body.evidence_count,
    alert_count:             body.alert_count,
    people_count:            body.people_count,
    applied_policy_id:       body.applied_policy_id ?? null,
  }).catch(err => ({
    ok:      false  as const,
    skipped: false  as const,
    error:   err instanceof Error ? err.message : String(err),
  }));

  if (saveResult.ok) {
    return NextResponse.json({
      saved:             true,
      created:           saveResult.created,
      applied_policy_id: body.applied_policy_id ?? null,
    });
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
