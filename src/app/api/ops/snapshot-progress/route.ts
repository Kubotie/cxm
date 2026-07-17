// ─── GET /api/ops/snapshot-progress ───────────────────────────────────────────
//
// company_daily_snapshot テーブルの蓄積状況を watch group 別に集計して返す。
// 90 日遡及分析の準備状況をモニタリングするため。

import { NextResponse } from 'next/server';
import {
  generateSnapshotProgress,
  type SnapshotProgressReport,
} from '@/lib/company/snapshot-progress';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(): Promise<NextResponse<SnapshotProgressReport | { error: string }>> {
  try {
    const report = await generateSnapshotProgress();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
