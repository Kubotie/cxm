// ─── Company Summary 派生テーブルからの read helper ──────────────────────────
// company_summary_state の読み取りを担当する。
//
// ルール:
//   - primary key: company_uid（1企業につき1レコード）
//   - テーブル ID 未設定時は null を返す（エラーにしない）

import { TABLE_IDS, nocoFetch } from './client';
import type { RawCompanySummaryState, AppCompanySummaryState } from './types';
import { toAppCompanySummaryState } from './types';

/**
 * company_uid をキーに company_summary_state の既存レコードを取得する。
 * レコードが存在しない場合、またはテーブル ID が未設定の場合は null を返す。
 */
export async function getCompanySummaryState(
  companyUid: string,
): Promise<AppCompanySummaryState | null> {
  const tableId = TABLE_IDS.company_summary_state;
  if (!tableId) return null;

  const list = await nocoFetch<RawCompanySummaryState>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    limit: '1',
  });

  if (list.length === 0) return null;
  return toAppCompanySummaryState(list[0]);
}
