// ─── GET /api/documents ───────────────────────────────────────────────────────
// 作成済みドキュメント一覧を返す（ログインユーザーの分のみ）。
// レスポンス: { documents: CsmDocument[] }

import { NextResponse } from 'next/server';
import { getDocuments } from '@/lib/nocodb/documents';
import { getUserUidFromCookie } from '@/lib/auth/session';

export async function GET() {
  try {
    const userId = await getUserUidFromCookie();
    const documents = await getDocuments(50, userId);
    return NextResponse.json({ documents });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
