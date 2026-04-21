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
 * 複数企業の summary state を一括取得する（N+1 回避版）。
 * NocoDB の IN フィルタ: `(company_uid,in,uid1,uid2,...)~and(summary_type,eq,default)` を使い
 * 1 リクエストで全社分を取得して Map に変換して返す。
 *
 * @param companyUids  取得対象の company_uid 配列
 * @param summaryType  summary の種別（デフォルト: "default"）
 * @returns company_uid → AppCompanySummaryState の Map（存在しない uid はキーなし）
 */
export async function getCompanySummaryStatesByUids(
  companyUids: string[],
  summaryType = 'default',
): Promise<Map<string, AppCompanySummaryState>> {
  const tableId = TABLE_IDS.company_summary_state;
  if (!tableId || companyUids.length === 0) return new Map();

  const where = `(company_uid,in,${companyUids.join(',')})~and(summary_type,eq,${summaryType})`;
  const limit = String(Math.min(companyUids.length * 2, 1000)); // 1社につき最大2件（通常1件）

  const rows = await nocoFetch<RawCompanySummaryState>(tableId, { where, limit });

  const map = new Map<string, AppCompanySummaryState>();
  for (const raw of rows) {
    if (!raw.company_uid) continue;
    // 同一 company_uid で複数件ある場合は最初のレコードを使用
    if (!map.has(raw.company_uid)) {
      map.set(raw.company_uid, toAppCompanySummaryState(raw));
    }
  }
  return map;
}

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
