// ─── Batch API 認証ヘルパー ───────────────────────────────────────────────────
// DolphinScheduler などの外部サービスからバッチ API を呼ぶ際の簡易 Bearer 認証。
//
// env: SUPPORT_BATCH_SECRET
//   - 未設定の場合: 認証をスキップし警告のみ（ローカル開発用）
//   - 設定済みの場合: Authorization: Bearer <token> が一致しなければ 401
//
// 使用方法:
//   const auth = checkBatchAuth(req);
//   if (!auth.ok) return auth.response;

import { NextRequest, NextResponse } from 'next/server';

const ENV_KEY = 'SUPPORT_BATCH_SECRET';

/**
 * リクエストヘッダーの Bearer トークンを検証する。
 * 認証失敗時は 401 NextResponse を返す。成功・スキップ時は null を返す。
 *
 * 使用方法:
 *   const authError = checkBatchAuth(req);
 *   if (authError) return authError;
 *
 * SUPPORT_BATCH_SECRET が未設定の場合は認証をスキップ（ローカル開発向け）。
 */
export function checkBatchAuth(req: NextRequest): NextResponse | null {
  const secret = process.env[ENV_KEY];

  // 未設定: スキップ（本番では必ず設定すること）
  if (!secret) {
    console.warn(
      '[batch-auth] SUPPORT_BATCH_SECRET が未設定です。' +
      '認証をスキップしています（本番環境では必ず設定してください）。',
    );
    return null;
  }

  const header = req.headers.get('Authorization') ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token || token !== secret) {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    console.warn('[batch-auth] 認証失敗:', { ip, path: req.nextUrl.pathname });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
