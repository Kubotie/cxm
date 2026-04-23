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
 *
 * ── summary_type フィルタの扱い ────────────────────────────────────────────────
 * NocoDB の `eq` 演算子は null にマッチしない。
 * `summary_type` カラムが後付けで追加された、または手動作成されたレコードでは
 * summary_type が null になっていることがある。
 * summaryType='default' の場合は `(summary_type,eq,default)~or(summary_type,blank)` を使い、
 * null/空文字レコードも "default" として扱う。
 *
 * ── 複数レコードの優先順位 ────────────────────────────────────────────────────
 * 同一 company_uid に複数件ある場合、human_review_status='approved' のレコードを優先する。
 * これにより approved 保護が確実に機能する。
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

  // summaryType='default' のとき: null/blank も 'default' として扱う
  const typeFilter = summaryType === 'default'
    ? `(summary_type,eq,default)~or(summary_type,blank)`
    : `(summary_type,eq,${summaryType})`;
  const where = `(company_uid,in,${companyUids.join(',')})~and(${typeFilter})`;
  const limit = String(Math.min(companyUids.length * 5, 1000)); // 1社につき最大5件（重複考慮）

  const rows = await nocoFetch<RawCompanySummaryState>(tableId, { where, limit });

  const map = new Map<string, AppCompanySummaryState>();
  for (const raw of rows) {
    if (!raw.company_uid) continue;
    const existing = map.get(raw.company_uid);
    // approved レコードを優先。既存がない or 現レコードが approved なら上書き
    if (!existing || raw.human_review_status === 'approved') {
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

  const typeFilter = summaryType === 'default'
    ? `(summary_type,eq,default)~or(summary_type,blank)`
    : `(summary_type,eq,${summaryType})`;
  const where = `(company_uid,eq,${companyUid})~and(${typeFilter})`;

  // approved レコードを優先するため limit=5 で取得して client 側で選択
  const list = await nocoFetch<RawCompanySummaryState>(tableId, {
    where,
    limit: '5',
  });

  if (list.length === 0) return null;
  // approved レコードを優先
  const approved = list.find(r => r.human_review_status === 'approved');
  return toAppCompanySummaryState(approved ?? list[0]);
}
