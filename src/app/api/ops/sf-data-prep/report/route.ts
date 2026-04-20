// ─── GET /api/ops/sf-data-prep/report ────────────────────────────────────────
//
// SF 実接続前データ整備レポートを生成して返す。
// - sf_account_id 未設定企業一覧
// - company_people フィールド品質（email / decision_influence / last_touchpoint / owner / manager_id）
// - company_actions の owner が email 形式でないもの
// - Contact 名寄せ競合候補（同一 email / 類似 name / SF+CXM 重複）

import { NextResponse } from 'next/server';
import { generateSfDataPrepReport, type SfDataPrepReport } from '@/lib/salesforce/sf-data-prep-report';

export async function GET(): Promise<NextResponse<SfDataPrepReport | { error: string }>> {
  try {
    const report = await generateSfDataPrepReport();
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
