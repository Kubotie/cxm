// ─── POST /api/assets/upload ──────────────────────────────────────────────────
// ユーザーが確認・調整済みのアセット情報をNocoDB に保存する。
// /api/assets/analyze でAI提案を取得した後、ユーザーが確認・編集してからこのAPIを呼ぶ。
//
// リクエスト: application/json
//   title:            string
//   category:         string
//   category_reason:  string
//   summary:          string
//   blob_url:         string | null
//   content:          string  (MDファイル全文)
//   author:           string
//
// レスポンス: { asset: CsmAsset }
// エラー:     { error: string }

import { NextRequest, NextResponse } from 'next/server';
import { createAsset, type CsmAsset } from '@/lib/nocodb/assets';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    category?: string;
    category_reason?: string;
    summary?: string;
    blob_url?: string | null;
    content?: string;
    author?: string;
  };

  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON のパースに失敗しました' }, { status: 400 });
  }

  const { title, category, category_reason, summary, blob_url, content, author } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title が必要です' }, { status: 400 });
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content が必要です' }, { status: 400 });
  }

  const assetId = randomUUID();
  const now = new Date().toISOString();

  const asset = await createAsset({
    asset_id: assetId,
    title: title.trim(),
    content,
    blob_url: blob_url ?? null,
    category: (category as CsmAsset['category']) ?? null,
    category_reason: category_reason ?? null,
    summary: summary ?? null,
    author: author?.trim() || null,
    source_type: 'uploaded',
    linked_action_id: null,
    created_by: author?.trim() || null,
    created_at: now,
    tags: null,
  });

  return NextResponse.json({ asset });
}
