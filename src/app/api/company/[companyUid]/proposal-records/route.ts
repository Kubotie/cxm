// ─── /api/company/[companyUid]/proposal-records ───────────────────────────────
//
// 提案骨子の記録。作った骨子を残し、開き直して作り直せるようにする。
//
//   GET                  一覧（提案準備タブの先頭に出す）
//   GET  ?id=<rowId>     1件の全内容（開き直す）
//   POST                 保存（body.rowId があれば更新、無ければ新規）
//   DELETE ?id=<rowId>   削除
//
// テーブル未設定でも 200 で空を返す。骨子は保存できなくても生成できる必要がある。

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSavedOutlines, fetchSavedOutline, saveOutline, deleteSavedOutline,
  type SavedOutlineSummary, type SavedOutlineDetail,
} from '@/lib/nocodb/proposal-outlines';
import { TABLE_IDS } from '@/lib/nocodb/client';

export interface ProposalRecordsResponse {
  records: SavedOutlineSummary[];
  /** 保存機能が使えるか（false = テーブル未設定。UI で保存ボタンを隠す） */
  enabled: boolean;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const idParam = req.nextUrl.searchParams.get('id');
  if (idParam) {
    const rowId = Number(idParam);
    if (!Number.isFinite(rowId)) {
      return NextResponse.json({ error: 'id が不正です' }, { status: 400 });
    }
    const detail = await fetchSavedOutline(rowId);
    if (!detail) {
      return NextResponse.json({ error: '記録が見つかりません' }, { status: 404 });
    }
    return NextResponse.json(detail satisfies SavedOutlineDetail);
  }

  const body: ProposalRecordsResponse = {
    records: await fetchSavedOutlines(companyUid),
    enabled: Boolean(TABLE_IDS.proposal_outlines),
  };
  return NextResponse.json(body);
}

export interface SaveRecordRequest {
  rowId?:        number | null;
  companyName:   string;
  title:         string;
  intentName:    string;
  proposalType:  string;
  frameName?:    string | null;
  instruction?:  string;
  outline:       unknown;
  contextIds:    string[];
  customContext?: Array<{ title: string; detail: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  let payload: SaveRecordRequest;
  try {
    payload = await req.json() as SaveRecordRequest;
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  if (!payload.outline || !payload.intentName) {
    return NextResponse.json({ error: '保存する骨子がありません' }, { status: 400 });
  }

  const res = await saveOutline({
    rowId:         payload.rowId ?? null,
    companyUid,
    companyName:   payload.companyName ?? '',
    title:         payload.title || '（無題）',
    intentName:    payload.intentName,
    proposalType:  payload.proposalType ?? 'product',
    frameName:     payload.frameName ?? null,
    instruction:   payload.instruction ?? '',
    outline:       payload.outline,
    contextIds:    payload.contextIds ?? [],
    customContext: payload.customContext ?? [],
    createdBy:     req.cookies.get('cxm_user_uid')?.value ?? null,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error ?? '保存に失敗しました', skipped: res.skipped },
      { status: res.skipped ? 501 : 502 },
    );
  }
  return NextResponse.json({ ok: true, rowId: res.rowId });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }
  const rowId = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(rowId)) {
    return NextResponse.json({ error: 'id が不正です' }, { status: 400 });
  }
  const res = await deleteSavedOutline(rowId);
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? '削除に失敗しました' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
