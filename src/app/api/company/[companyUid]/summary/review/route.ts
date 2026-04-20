// ─── POST /api/company/[companyUid]/summary/review ──────────────────────────
// human_review_status の更新専用エンドポイント。AI 生成・保存は行わない。
//
// ── リクエスト ──────────────────────────────────────────────────────────────
// {
//   status:        'reviewed' | 'corrected' | 'approved',
//   reviewed_by?:  string,   // レビュー実施者（省略可）
//   summary_type?: string,   // default: "default"
// }
//
// ── レスポンス ──────────────────────────────────────────────────────────────
// 成功: { ok: true, status: string }
// エラー: { error: string }
//
// ── 注意 ────────────────────────────────────────────────────────────────────
// status=reviewed を送ることで approved → reviewed へのダウングレードも行える。
// ダウングレード後は human_review_status が 'reviewed' に戻り、再生成が可能になる。

import { NextRequest, NextResponse } from 'next/server';
import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoUpdate } from '@/lib/nocodb/write';
import type { RawCompanySummaryState } from '@/lib/nocodb/types';
import type { SummaryHumanReviewStatus } from '@/lib/company/company-summary-state-policy';

const VALID_STATUSES = new Set<SummaryHumanReviewStatus>([
  'reviewed', 'corrected', 'approved',
]);

const DEFAULT_TYPE = 'default';

interface RequestBody {
  status:        string;
  reviewed_by?:  string;
  summary_type?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;

  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  const { status, reviewed_by, summary_type } = body;
  const summaryType = summary_type ?? DEFAULT_TYPE;

  if (!status || !VALID_STATUSES.has(status as SummaryHumanReviewStatus)) {
    return NextResponse.json(
      { error: `status は ${[...VALID_STATUSES].join(' | ')} のいずれかを指定してください` },
      { status: 400 },
    );
  }

  const tableId = TABLE_IDS.company_summary_state;
  if (!tableId) {
    return NextResponse.json(
      { error: 'NOCODB_COMPANY_SUMMARY_STATE_TABLE_ID が未設定です' },
      { status: 503 },
    );
  }

  // 既存レコードを取得
  const where = `(company_uid,eq,${companyUid})~and(summary_type,eq,${summaryType})`;
  const list  = await nocoFetch<RawCompanySummaryState>(tableId, { where, limit: '1' }).catch(() => null);

  if (!list || list.length === 0) {
    return NextResponse.json(
      { error: '対象の company_summary_state レコードが存在しません。先に保存してください。' },
      { status: 404 },
    );
  }

  const existing    = list[0];
  const reviewedAt  = new Date().toISOString();

  await nocoUpdate<RawCompanySummaryState>(tableId, existing.Id, {
    human_review_status: status,
    reviewed_by:         reviewed_by ?? null,
    reviewed_at:         reviewedAt,
  });

  return NextResponse.json({ ok: true, status });
}
