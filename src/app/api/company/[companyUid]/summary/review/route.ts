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
  // summary_type='default' のときは null/blank レコードも対象に（read 側と整合）。
  // 旧データには summary_type 未設定のレコードが残っているため、
  // それらも含めて全件まとめて更新することで重複レコードを統一する。
  const typeFilter = summaryType === DEFAULT_TYPE
    ? `(summary_type,eq,${DEFAULT_TYPE})~or(summary_type,blank)`
    : `(summary_type,eq,${summaryType})`;
  const where = `(company_uid,eq,${companyUid})~and(${typeFilter})`;
  const list  = await nocoFetch<RawCompanySummaryState>(tableId, { where, limit: '50' }).catch(() => null);

  if (!list || list.length === 0) {
    return NextResponse.json(
      { error: '対象の company_summary_state レコードが存在しません。先に保存してください。' },
      { status: 404 },
    );
  }

  const reviewedAt = new Date().toISOString();

  // 明示的に指定された場合のみ reviewed_by を更新（未指定時は既存値を保持）
  const basePatch: Partial<RawCompanySummaryState> = {
    human_review_status: status,
    reviewed_at:         reviewedAt,
    summary_type:        summaryType, // 重複統一: null/blank レコードを default に正規化
  };
  if (reviewed_by !== undefined) {
    basePatch.reviewed_by = reviewed_by;
  }

  // マッチした全レコードを更新（重複の orphan レコードもまとめてダウングレード）
  try {
    for (const existing of list) {
      await nocoUpdate<RawCompanySummaryState>(tableId, existing.Id, basePatch);
    }
  } catch (err) {
    console.error('[POST /api/company/[companyUid]/summary/review] nocoUpdate failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status, updated: list.length });
}
