// ─── PtAI の読み取り専用トークン ─────────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  `PTAI_READ_TOKEN` は **読むことしかできない鍵**。
//
//  `SUPPORT_BATCH_SECRET` と分けてあるのは、あちらが 25 本の API を開ける鍵で、
//  その大半が書き込み・再計算を走らせるため（現在MRR の上書き、Salesforce の
//  取り込み、Tier の書き換え、解約レーダーの再計算…）。
//  分析ツールや外部に渡すのはこちらだけにすること。
//
//  この鍵を受け付けてよいのは **GET だけ**。書き込む経路では絶対に使わない。
// ═══════════════════════════════════════════════════════════════════════════
//
// 認証の順番
//   1. Authorization ヘッダーがある → PTAI_READ_TOKEN と照合
//   2. 無い                         → セッション Cookie（画面から）
//
// 未設定のとき: 本番は 503 で止める（設定漏れで全公開になるのを防ぐ）。
// ローカルは警告だけ出して素通し（他のバッチ API と同じ扱い）。

import { NextRequest, NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';

const isProduction = () => process.env.VERCEL_ENV === 'production';

function deny(req: NextRequest, hint: string): NextResponse {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  console.warn('[ptai-read] 認証失敗:', { ip, path: req.nextUrl.pathname, hint });
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

/** 通ってよければ null、駄目ならそのまま返すレスポンス */
export async function requirePtaiRead(req: NextRequest): Promise<NextResponse | null> {
  const header = req.headers.get('Authorization') ?? '';

  if (header) {
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const secret = (process.env.PTAI_READ_TOKEN ?? '').trim();
    if (!secret) {
      if (isProduction()) {
        console.error('[ptai-read] 設定不備: PTAI_READ_TOKEN が未設定のため拒否しました');
        return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
      }
      console.warn('[ptai-read] PTAI_READ_TOKEN が未設定です。認証をスキップしています（開発のみ）。');
      return null;
    }
    if (!token || token !== secret) return deny(req, 'PTAI_READ_TOKEN 不一致');
    return null;
  }

  if (await getUserUidFromCookie()) return null;
  return NextResponse.json(
    { error: 'unauthenticated', message: 'ログインが必要です' }, { status: 401 });
}
