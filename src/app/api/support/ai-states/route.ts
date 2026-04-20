// ─── GET /api/support/ai-states ───────────────────────────────────────────────
// source_queue で絞り込んだ AI state ViewModel を一括で返す。
// Queue / Home の一覧表示から呼ばれる。
//
// クエリパラメータ:
//   source_queue: 'intercom' | 'cse_ticket'  (default: 'intercom')
//   limit:        number                     (default: 500)
//
// レスポンス:
//   { [source_record_id]: SupportCaseAiViewModel }

import { NextRequest, NextResponse } from 'next/server';
import { getSupportCaseAiStatesByQueue } from '@/lib/nocodb/support-ai-state-store';
import { buildSupportCaseAiViewModel } from '@/lib/support/support-ai-state-view-model';
import type { SupportCaseAiSourceQueue } from '@/lib/nocodb/support-ai-state-types';

export async function GET(req: NextRequest) {
  const sq = req.nextUrl.searchParams.get('source_queue') ?? 'intercom';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '500', 10), 1000);

  if (sq !== 'intercom' && sq !== 'cse_ticket') {
    return NextResponse.json({ error: 'Invalid source_queue' }, { status: 400 });
  }
  const sourceQueue = sq as SupportCaseAiSourceQueue;

  const map = await getSupportCaseAiStatesByQueue(sourceQueue, limit);
  const result: Record<string, ReturnType<typeof buildSupportCaseAiViewModel>> = {};
  for (const [id, record] of map) {
    result[id] = buildSupportCaseAiViewModel(record);
  }
  return NextResponse.json(result);
}
