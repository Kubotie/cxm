// ─── POST/GET /api/batch/churn-voice ──────────────────────────────────────────
//
// 解約レーダーの言質抽出（週次）。議事録・Intercom 本文から契約継続の判断に触れる発言を
// 原文引用つきで拾い、churn_radar_voice に review_status=pending で保存する。
//
// ── スケジュール ─────────────────────────────────────────────────────────────
//   Vercel Cron: 毎週月曜 06:00 JST（日曜 21:00 UTC）
//
// ── パラメータ ───────────────────────────────────────────────────────────────
//   dry_run=1      保存せず抽出結果だけ返す
//   uid=sf_xxx     対象を絞る
//   window_days=30 何日ぶんの文書を見るか
//
// 実処理は src/lib/churn/voice-run.ts。

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { runChurnVoice } from '@/lib/churn/voice-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function tierTargets(): Promise<string[]> {
  const rows = await nocoFetch<{ company_uid?: string | null }>(TABLE_IDS.companies, {
    where:  '(status,eq,active)~and(tier,in,1,2)',
    fields: 'company_uid',
    limit:  '500',
  }, false).catch(() => []);
  return rows.map(r => r.company_uid?.trim()).filter((u): u is string => !!u);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  if (!TABLE_IDS.churn_radar_voice) {
    return NextResponse.json({
      error: 'churn_radar_voice テーブルが未設定です',
      hint:  'NOCODB_CHURN_RADAR_VOICE_TABLE_ID を環境変数に設定してください',
    }, { status: 503 });
  }

  const sp     = req.nextUrl.searchParams;
  const dryRun = sp.get('dry_run') === '1';
  const only   = sp.get('uid')?.split(',').map(s => s.trim()).filter(Boolean);
  const windowDays = parseInt(sp.get('window_days') ?? '30', 10);

  const uids = only?.length ? only : await tierTargets();

  if (dryRun || only?.length) {
    try {
      return NextResponse.json({ status: 'ok', ...(await runChurnVoice({ dryRun, uids, windowDays })) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  after(() => runChurnVoice({ dryRun: false, uids, windowDays }).catch(err =>
    console.error('[batch/churn-voice] background 例外:', err),
  ));
  return NextResponse.json({
    status:  'accepted',
    message: 'バックグラウンドで言質抽出を開始しました。抽出結果は個社ドリルでレビューしてください。',
  });
}

export const POST = handle;
export const GET  = handle;
