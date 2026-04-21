// ─── Batch API 認証ヘルパー ───────────────────────────────────────────────────
//
// ── 認証トークンの使い分け ────────────────────────────────────────────────────
//
//   SUPPORT_BATCH_SECRET  手動 ops 実行（DolphinScheduler, curl, ops UI）向け
//   CRON_SECRET           Vercel Cron 自動実行向け
//                         Vercel は CRON_SECRET が設定されていると
//                         cron リクエストに自動で
//                         "Authorization: Bearer {CRON_SECRET}" を付与する。
//
// ── 関数の使い分け ────────────────────────────────────────────────────────────
//   checkBatchAuth           → 手動 ops のみ許可（既存バッチ系）
//   checkCronOrBatchAuth     → Cron + 手動 ops の両方を許可（staleness 等 cron 化対象）
//
// ── ローカル開発時（両 secret 未設定）─────────────────────────────────────────
//   両関数ともに認証をスキップして警告のみを出す。

import { NextRequest, NextResponse } from 'next/server';

// ── 内部ヘルパー ──────────────────────────────────────────────────────────────

function extractBearerToken(req: NextRequest): string {
  const header = req.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function logFailure(req: NextRequest, hint: string) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  console.warn('[batch-auth] 認証失敗:', { ip, path: req.nextUrl.pathname, hint });
}

// ── 手動 ops 専用 ─────────────────────────────────────────────────────────────

/**
 * SUPPORT_BATCH_SECRET による Bearer 認証。
 * DolphinScheduler / 手動 curl / ops UI からのリクエストに使用。
 *
 * 未設定の場合は認証をスキップ（ローカル開発向け）。
 */
export function checkBatchAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.SUPPORT_BATCH_SECRET;

  if (!secret) {
    console.warn('[batch-auth] SUPPORT_BATCH_SECRET が未設定です。認証をスキップしています。');
    return null;
  }

  const token = extractBearerToken(req);
  if (!token || token !== secret) {
    logFailure(req, 'SUPPORT_BATCH_SECRET 不一致');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// ── Cron + 手動 ops 両対応 ────────────────────────────────────────────────────

/**
 * CRON_SECRET または SUPPORT_BATCH_SECRET のいずれかに一致すれば通過する。
 * scheduled エンドポイント（Vercel Cron + 手動 ops 両方から呼ばれる）に使用。
 *
 * ── Vercel Cron の動作 ──────────────────────────────────────────────────────
 *   CRON_SECRET が Vercel プロジェクトに設定されている場合、
 *   Vercel は cron リクエストに自動で "Authorization: Bearer {CRON_SECRET}" を付与する。
 *   このため、cron 専用エンドポイントは CRON_SECRET だけで認証できる。
 *
 * ── 両 secret 未設定 ────────────────────────────────────────────────────────
 *   ローカル開発時は認証をスキップする。
 */
export function checkCronOrBatchAuth(req: NextRequest): NextResponse | null {
  const cronSecret  = process.env.CRON_SECRET;
  const batchSecret = process.env.SUPPORT_BATCH_SECRET;

  // 両方未設定 → 開発モード（スキップ + 警告）
  if (!cronSecret && !batchSecret) {
    console.warn(
      '[batch-auth] CRON_SECRET / SUPPORT_BATCH_SECRET が未設定です。' +
      '認証をスキップしています（本番環境では必ず設定してください）。',
    );
    return null;
  }

  const token = extractBearerToken(req);
  if (!token) {
    logFailure(req, 'Authorization ヘッダーなし');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // CRON_SECRET または SUPPORT_BATCH_SECRET のいずれかに一致すれば OK
  const valid =
    (cronSecret  && token === cronSecret) ||
    (batchSecret && token === batchSecret);

  if (!valid) {
    logFailure(req, 'CRON_SECRET/SUPPORT_BATCH_SECRET 不一致');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
