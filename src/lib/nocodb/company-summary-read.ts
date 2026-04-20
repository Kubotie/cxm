// ─── Company Summary 派生テーブルからの read helper ──────────────────────────
// company_summary_state の読み取りを担当する。
//
// ルール:
//   - upsert キー: company_uid + summary_type（複合）
//   - summary_type のデフォルト: "default"
//   - テーブル ID 未設定時は null を返す（エラーにしない）

import { TABLE_IDS, nocoFetch } from './client';
import type { RawCompanySummaryState, AppCompanySummaryState } from './types';
import { toAppCompanySummaryState } from './types';

/**
 * company_uid + summary_type をキーに company_summary_state の既存レコードを取得する。
 * レコードが存在しない場合、またはテーブル ID が未設定の場合は null を返す。
 *
 * @param companyUid   対象企業 UID
 * @param summaryType  summary の種別（デフォルト: "default"）
 */
export async function getCompanySummaryState(
  companyUid: string,
  summaryType = 'default',
): Promise<AppCompanySummaryState | null> {
  const tableId = TABLE_IDS.company_summary_state;
  if (!tableId) return null;

  const where = `(company_uid,eq,${companyUid})~and(summary_type,eq,${summaryType})`;

  const list = await nocoFetch<RawCompanySummaryState>(tableId, {
    where,
    limit: '1',
  });

  if (list.length === 0) return null;
  return toAppCompanySummaryState(list[0]);
}
