// ─── DELETE /api/documents/[id] ───────────────────────────────────────────────
// ドキュメントを削除する（NocoDB レコードのみ。Blob は削除しない）。

import { NextRequest, NextResponse } from 'next/server';
import { getDocuments, deleteDocument } from '@/lib/nocodb/documents';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // document_id から NocoDB の rowId を解決
    const docs = await getDocuments(200);
    const doc = docs.find(d => d.document_id === id);
    if (!doc) {
      return NextResponse.json({ error: 'ドキュメントが見つかりません' }, { status: 404 });
    }
    await deleteDocument(doc.Id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
