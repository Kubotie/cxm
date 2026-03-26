// ─── Unified Log 派生テーブルからの read helper ──────────────────────────────
// unified_log_signal_state の読み取りを担当する。
//
// ルール:
//   - primary key: company_uid（1企業につき1レコード）
//   - テーブル ID 未設定時は null を返す（エラーにしない）

import { TABLE_IDS, nocoFetch } from './client';
import type { RawUnifiedLogSignalState, AppUnifiedLogSignalState } from './types';
import { toAppUnifiedLogSignalState } from './types';

/**
 * company_uid をキーに unified_log_signal_state の既存レコードを取得する。
 * レコードが存在しない場合、またはテーブル ID が未設定の場合は null を返す。
 */
export async function getUnifiedLogSignalState(
  companyUid: string,
): Promise<AppUnifiedLogSignalState | null> {
  const tableId = TABLE_IDS.unified_log_signal_state;
  if (!tableId) return null;

  const list = await nocoFetch<RawUnifiedLogSignalState>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    limit: '1',
  });

  if (list.length === 0) return null;
  return toAppUnifiedLogSignalState(list[0]);
}
