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
// 認証は署名済みセッション（cxm_session）。ログイン済みなら書ける＝原本と同じ権限モデル。
//
// ただし **承認が要る変更だけはサーバーでも確認する**（仕様書 §4-2）。
// 画面側の `IS_APPROVER` チェックだけでは、API を直接叩けば誰でも
// 「契約締結済み」にできてしまうため。

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getUserUidFromCookie } from '@/lib/auth/session';
import {
  listAllDocs, setDoc, addDoc, deleteDoc, isPtaiCollection, isPtaiStoreConfigured,
} from '@/lib/ptai/store';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import { assertStageChangeAllowed } from '@/lib/ptai/edit-guard';
import { getPtaiDataSource } from '@/lib/twenty/data-source';
import { buildDbView } from '@/lib/ptai/db-view';
import { writeDoc, addDocNew } from '@/lib/ptai/db-write';

export const dynamic = 'force-dynamic';
// 組織図の保存は 1 人あたり Twenty へ数回書くので、数十人だと数十秒かかる。
// 途中で打ち切られると新しい行だけ残り、旧い行が消えずに二重になる
export const maxDuration = 300;

/** 複数タブ・複数人のポーリングで NocoDB を叩きすぎないための短期メモ */
let memo: { at: number; rev: string; body: string } | null = null;
const MEMO_MS = 2500;
/** 書き込みの世代。PUT/POST より前に始まった GET の結果を memo に入れない */
let writeGen = 0;

function unauthorized() {
  return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
}

async function requireUser(): Promise<string | null> {
  return getUserUidFromCookie();
}

export async function GET(req: NextRequest) {
  if (!(await requireUser())) return unauthorized();

  const source = getPtaiDataSource();
  if (source === 'legacy_nocodb' && !isPtaiStoreConfigured()) {
    return NextResponse.json({ error: 'store_not_configured' }, { status: 503 });
  }

  const clientRev = req.nextUrl.searchParams.get('rev');

  if (memo && Date.now() - memo.at < MEMO_MS) {
    if (clientRev && clientRev === memo.rev) return NextResponse.json({ unchanged: true, rev: memo.rev });
    return new NextResponse(memo.body, { headers: { 'Content-Type': 'application/json' } });
  }

  const gen = writeGen;
  // twenty 経路: Twenty test* ＋ Notion から組み立てる。pga_docs は読まない
  let partial = false;
  let collections: Record<string, Array<{ id: string; data: unknown }>> = {};
  if (source === 'twenty') {
    const view = await buildDbView();
    // 一部の読み取りに失敗すると、その collection は空で返ってくる。
    // すでに画面にデータがある（rev を持っている）なら、空で上書きして
    // ネクストアクションなどを一瞬消すより、今回は返さず前回のままにさせる。
    if (clientRev && view.diagnostics.partialFailures.length) {
      console.warn('[ptai/db] 一部読めず', JSON.stringify(view.diagnostics.partialFailures));
      return NextResponse.json({ error: 'partial_read' }, { status: 503 });
    }
    collections = view.collections;
    partial = view.diagnostics.partialFailures.length > 0;
  } else {
    const docs = await listAllDocs();
    for (const d of docs) {
      (collections[d.collection] ||= []).push({ id: d.id, data: d.data });
    }
  }

  const rev = createHash('sha1').update(JSON.stringify(collections)).digest('hex').slice(0, 16);
  const body = JSON.stringify({ rev, collections });
  // 読んでいる間に保存が入ったら、この結果は保存前のものかもしれない。
  // memo に入れると 2.5 秒間ほかのタブにも古い状態を配ってしまう
  // 一部欠けた結果も memo に入れない（rev を持つクライアントにまで配られてしまう）
  if (gen === writeGen && !partial) memo = { at: Date.now(), rev, body };

  if (clientRev && clientRev === rev) return NextResponse.json({ unchanged: true, rev });
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json' } });
}


export async function PUT(req: NextRequest) {
  const me = await getPtaiIdentity();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({})) as { path?: string; data?: unknown };
  const parsed = parsePath(body.path);
  if (!parsed) return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });
  writeGen++;   // 書いている途中の状態も memo に入れない

  // twenty 経路: Twenty test* ＋ Notion へ振り分ける。承認ガードは db-write が通す
  if (getPtaiDataSource() === 'twenty') {
    const r = await writeDoc(parsed.collection, parsed.docId, body.data ?? null, me);
    memo = null; writeGen++;
    if (!r.ok) {
      console.warn('[ptai/db] 保存できず', JSON.stringify({ error: r.error, collection: parsed.collection }));
      return NextResponse.json({ error: r.error, message: r.message }, { status: r.status });
    }
    console.info('[ptai/db] 保存', JSON.stringify({ collection: parsed.collection, ...r.changes }));
    return NextResponse.json({ ok: true, changes: r.changes });
  }

  // 承認が要る変更（契約締結済みへの出入り）は承認者だけ。§4-2
  if (parsed.collection === 'edits') {
    const docs = await listAllDocs();
    const before = docs.find(d => d.collection === 'edits' && d.id === parsed.docId)?.data ?? null;
    const verdict = assertStageChangeAllowed(before, body.data ?? null, me.isApprover);
    if (!verdict.ok) {
      // 対象の商談キーだけ返す。顧客名や本文は返さない
      console.warn('[ptai/db] 承認が要る変更を拒否', JSON.stringify({ reason: verdict.reason, deals: verdict.deals }));
      return NextResponse.json({ error: 'approver_required', reason: verdict.reason }, { status: 403 });
    }
  }

  await setDoc(parsed.collection, parsed.docId, body.data ?? null);
  memo = null; writeGen++;
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const me = await getPtaiIdentity();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({})) as { collection?: string; data?: unknown };
  if (!body.collection || !isPtaiCollection(body.collection)) {
    return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });
  }
  writeGen++;   // 書いている途中の状態も memo に入れない

  if (getPtaiDataSource() === 'twenty') {
    const r = await addDocNew(body.collection, body.data ?? null, me);
    memo = null; writeGen++;
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, id: r.id });
  }
  const id = await addDoc(body.collection, body.data ?? null);
  memo = null; writeGen++;
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireUser())) return unauthorized();
  const parsed = parsePath(req.nextUrl.searchParams.get('path'));
  if (!parsed) return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });

  // twenty 経路で doc.delete を使うのは原本では plans だけ。plans は実データ 0 件で廃止予定
  if (getPtaiDataSource() === 'twenty') {
    return NextResponse.json(
      { error: 'not_supported', message: 'この経路では doc.delete を使いません' },
      { status: 501 },
    );
  }

  await deleteDoc(parsed.collection, parsed.docId);
  memo = null; writeGen++;
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
  if (!isPtaiCollection(collection)) return null;
  return { collection, docId };
}
