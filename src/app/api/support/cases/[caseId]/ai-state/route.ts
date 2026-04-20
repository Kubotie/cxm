// ─── GET /api/support/cases/[caseId]/ai-state ─────────────────────────────────
// 1ケース分の AI state ViewModel を返す。Detail 画面から呼ばれる。
//
// クエリパラメータ:
//   source_queue: 'intercom' | 'cse_ticket'  (default: 'intercom')
//
// レスポンス:
//   SupportCaseAiViewModel  (hasAiState=false の場合は EMPTY_AI_VIEW_MODEL を返す)

import { NextRequest, NextResponse } from 'next/server';
import { getSupportCaseAiState } from '@/lib/nocodb/support-ai-state-store';
import { buildSupportCaseAiViewModel } from '@/lib/support/support-ai-state-view-model';
import type { SupportCaseAiSourceQueue } from '@/lib/nocodb/support-ai-state-types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const sq = req.nextUrl.searchParams.get('source_queue') ?? 'intercom';

  if (sq !== 'intercom' && sq !== 'cse_ticket') {
    return NextResponse.json({ error: 'Invalid source_queue' }, { status: 400 });
  }
  const sourceQueue = sq as SupportCaseAiSourceQueue;

  const record = await getSupportCaseAiState(sourceQueue, caseId);
  return NextResponse.json(buildSupportCaseAiViewModel(record));
}
