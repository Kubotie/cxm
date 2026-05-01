// ─── GET /api/documents ───────────────────────────────────────────────────────
// 作成済みドキュメント一覧を返す。
// レスポンス: { documents: CsmDocument[] }

import { NextResponse } from 'next/server';
import { getDocuments } from '@/lib/nocodb/documents';

export async function GET() {
  try {
    const documents = await getDocuments(50);
    return NextResponse.json({ documents });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
