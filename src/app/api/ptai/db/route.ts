// ─── /api/ptai/db ─────────────────────────────────────────────────────────────
//
// アーティファクトの共有 DB（`window.claude.use('db')`）のサーバー側。
// リアルタイム購読（onSnapshot）は、クライアントの短間隔ポーリング + rev 比較で代替する。
//
//   GET    ?rev=<hash>          全 collection を返す。rev が一致すれば {unchanged:true}
//   PUT    {path, data}         doc.set（全置換）
//   POST   {collection, data}   collection.add（自動 ID）
//   DELETE ?path=col/doc        doc.delete
//
// 認証は middleware の cxm_user_uid Cookie に乗る（ログイン済みなら書ける ＝ 原本と同じ）。

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getUserUidFromCookie } from '@/lib/auth/session';
import {
  listAllDocs, setDoc, addDoc, deleteDoc, isPgaCollection, isPgaStoreConfigured,
} from '@/lib/ptai/store';

export const dynamic = 'force-dynamic';

/** 複数タブ・複数人のポーリングで NocoDB を叩きすぎないための短期メモ */
let memo: { at: number; rev: string; body: string } | null = null;
const MEMO_MS = 2500;

function unauthorized() {
  return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
}

async function requireUser(): Promise<string | null> {
  return getUserUidFromCookie();
}

export async function GET(req: NextRequest) {
  if (!(await requireUser())) return unauthorized();
  if (!isPgaStoreConfigured()) {
    return NextResponse.json({ error: 'store_not_configured' }, { status: 503 });
  }

  const clientRev = req.nextUrl.searchParams.get('rev');

  if (memo && Date.now() - memo.at < MEMO_MS) {
    if (clientRev && clientRev === memo.rev) return NextResponse.json({ unchanged: true, rev: memo.rev });
    return new NextResponse(memo.body, { headers: { 'Content-Type': 'application/json' } });
  }

  const docs = await listAllDocs();
  const collections: Record<string, Array<{ id: string; data: unknown }>> = {};
  for (const d of docs) {
    (collections[d.collection] ||= []).push({ id: d.id, data: d.data });
  }

  const rev = createHash('sha1').update(JSON.stringify(collections)).digest('hex').slice(0, 16);
  const body = JSON.stringify({ rev, collections });
  memo = { at: Date.now(), rev, body };

  if (clientRev && clientRev === rev) return NextResponse.json({ unchanged: true, rev });
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json' } });
}

export async function PUT(req: NextRequest) {
  if (!(await requireUser())) return unauthorized();
  const body = await req.json().catch(() => ({})) as { path?: string; data?: unknown };
  const parsed = parsePath(body.path);
  if (!parsed) return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });

  await setDoc(parsed.collection, parsed.docId, body.data ?? null);
  memo = null;
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!(await requireUser())) return unauthorized();
  const body = await req.json().catch(() => ({})) as { collection?: string; data?: unknown };
  if (!body.collection || !isPgaCollection(body.collection)) {
    return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });
  }
  const id = await addDoc(body.collection, body.data ?? null);
  memo = null;
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireUser())) return unauthorized();
  const parsed = parsePath(req.nextUrl.searchParams.get('path'));
  if (!parsed) return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });

  await deleteDoc(parsed.collection, parsed.docId);
  memo = null;
  return NextResponse.json({ ok: true });
}

/** 'edits/<cid>' → {collection:'edits', docId:'<cid>'} */
function parsePath(path: string | null | undefined): { collection: string; docId: string } | null {
  if (!path) return null;
  const i = path.indexOf('/');
  if (i <= 0) return null;
  const collection = path.slice(0, i);
  const docId = path.slice(i + 1);
  if (!docId || docId.includes('/')) return null;
  if (!isPgaCollection(collection)) return null;
  return { collection, docId };
}
