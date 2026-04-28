// ─── GET /api/ops/ai-config/default?key=xxx ──────────────────────────────────
// 指定キーのコードデフォルト値を返す（admin のみ）。

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import {
  COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
  AI_CONFIG_KEY_COMPANY_SUMMARY,
} from '@/lib/prompts/company-evidence-summary';
import {
  SUPPORT_ALERT_SYSTEM_PROMPT,
  AI_CONFIG_KEY_SUPPORT_ALERT,
} from '@/lib/prompts/support-alert';
import {
  SUPPORT_SUMMARY_SYSTEM_PROMPT,
  AI_CONFIG_KEY_SUPPORT_SUMMARY,
} from '@/lib/prompts/support-summary';
import {
  SUPPORT_TRIAGE_SYSTEM_PROMPT,
  AI_CONFIG_KEY_SUPPORT_TRIAGE,
} from '@/lib/prompts/support-triage';
import {
  UNIFIED_LOG_SIGNAL_SYSTEM_PROMPT,
  AI_CONFIG_KEY_UNIFIED_LOG_SIGNAL,
} from '@/lib/prompts/unified-log-signal';
import {
  buildDraftReplySystemPrompt,
  AI_CONFIG_KEY_SUPPORT_DRAFT_REPLY,
} from '@/lib/prompts/support-draft-reply';

const DEFAULTS: Record<string, string> = {
  [AI_CONFIG_KEY_COMPANY_SUMMARY]:     COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
  [AI_CONFIG_KEY_SUPPORT_ALERT]:       SUPPORT_ALERT_SYSTEM_PROMPT,
  [AI_CONFIG_KEY_SUPPORT_SUMMARY]:     SUPPORT_SUMMARY_SYSTEM_PROMPT,
  [AI_CONFIG_KEY_SUPPORT_TRIAGE]:      SUPPORT_TRIAGE_SYSTEM_PROMPT,
  [AI_CONFIG_KEY_UNIFIED_LOG_SIGNAL]:  UNIFIED_LOG_SIGNAL_SYSTEM_PROMPT,
  [AI_CONFIG_KEY_SUPPORT_DRAFT_REPLY]: buildDraftReplySystemPrompt(),
};

function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key パラメータが必要です' }, { status: 400 });
  }

  const value = DEFAULTS[key];
  if (value === undefined) {
    return NextResponse.json({ error: `未知のキー: ${key}` }, { status: 404 });
  }

  return NextResponse.json({ key, value });
}
