// ─── GET /api/ops/ai-config/default?key=xxx ──────────────────────────────────
// 指定キーのコードデフォルト値を返す（admin のみ）。
// UI の「デフォルトに戻す」ボタンから呼ばれ、返り値を PUT /api/ops/ai-config で保存する。

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import {
  COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
  AI_CONFIG_KEY_COMPANY_SUMMARY,
} from '@/lib/prompts/company-evidence-summary';

const DEFAULTS: Record<string, string> = {
  [AI_CONFIG_KEY_COMPANY_SUMMARY]: COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
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
