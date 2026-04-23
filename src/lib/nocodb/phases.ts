// ─── CSM / CRM phase read helpers ────────────────────────────────────────────
//
// フェーズ表示ルール:
//   CSM 担当あり → csm_customer_phase (M-Phase) を主表示
//   CSM 担当なし → crm_customer_phase (A-Phase) を主表示
//
// read helper は company_uid 単体 / 複数 company_uids の両方に対応する。
// 複数 UID 版は List 画面での一括取得に使用する。

import { nocoFetch, nocoFetchByUids, TABLE_IDS } from '@/lib/nocodb/client';
import {
  toAppCsmPhase,
  toAppCrmPhase,
  type RawCsmPhase,
  type RawCrmPhase,
  type AppCsmPhase,
  type AppCrmPhase,
} from '@/lib/nocodb/types';

// ── 単一 company_uid ─────────────────────────────────────────────────────────

/**
 * 指定企業の CSM フェーズ (M-Phase) を取得する。
 * テーブル未設定 or レコードなし → null
 */
export async function fetchCsmPhase(
  companyUid: string,
): Promise<AppCsmPhase | null> {
  const tableId = TABLE_IDS.csm_customer_phase;
  if (!tableId) return null;
  const list = await nocoFetch<RawCsmPhase>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-stat_date',
    limit: '1',
  });
  return list.length > 0 ? toAppCsmPhase(list[0]) : null;
}

/**
 * 指定企業の CRM フェーズ (A-Phase) を取得する。
 * テーブル未設定 or レコードなし → null
 */
export async function fetchCrmPhase(
  companyUid: string,
): Promise<AppCrmPhase | null> {
  const tableId = TABLE_IDS.crm_customer_phase;
  if (!tableId) return null;
  const list = await nocoFetch<RawCrmPhase>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-stat_date',
    limit: '1',
  });
  return list.length > 0 ? toAppCrmPhase(list[0]) : null;
}

/**
 * CSM / CRM 両フェーズを並行取得する。
 * company-detail の初期ロードで使用する。
 */
export async function fetchBothPhases(companyUid: string): Promise<{
  csmPhase: AppCsmPhase | null;
  crmPhase: AppCrmPhase | null;
}> {
  const [csmPhase, crmPhase] = await Promise.all([
    fetchCsmPhase(companyUid),
    fetchCrmPhase(companyUid),
  ]);
  return { csmPhase, crmPhase };
}

// ── 複数 company_uids（List 画面向け）────────────────────────────────────────

/**
 * 複数企業の CSM フェーズを一括取得する。
 * 返り値: Map<company_uid, AppCsmPhase>（存在しない UID は Map に含まれない）
 */
export async function fetchCsmPhasesByUids(
  companyUids: string[],
): Promise<Map<string, AppCsmPhase>> {
  const tableId = TABLE_IDS.csm_customer_phase;
  if (!tableId || companyUids.length === 0) return new Map();
  // nocoFetchByUids は Map<uid, RawRow[]> を返す。phase は 1企業1レコード想定
  const rawMap = await nocoFetchByUids<RawCsmPhase>(tableId, companyUids, {
    sort: '-phase_updated_at',
  });
  const result = new Map<string, AppCsmPhase>();
  for (const [uid, rows] of rawMap) {
    if (rows.length > 0) result.set(uid, toAppCsmPhase(rows[0]));
  }
  return result;
}

/**
 * 複数企業の CRM フェーズを一括取得する。
 * 返り値: Map<company_uid, AppCrmPhase>
 */
export async function fetchCrmPhasesByUids(
  companyUids: string[],
): Promise<Map<string, AppCrmPhase>> {
  const tableId = TABLE_IDS.crm_customer_phase;
  if (!tableId || companyUids.length === 0) return new Map();
  const rawMap = await nocoFetchByUids<RawCrmPhase>(tableId, companyUids, {
    sort: '-phase_updated_at',
  });
  const result = new Map<string, AppCrmPhase>();
  for (const [uid, rows] of rawMap) {
    if (rows.length > 0) result.set(uid, toAppCrmPhase(rows[0]));
  }
  return result;
}

/**
 * 複数企業の CSM / CRM 両フェーズを並行一括取得する。
 * 返り値: { csmMap, crmMap } — いずれも Map<company_uid, AppPhase>
 */
export async function fetchBothPhasesByUids(companyUids: string[]): Promise<{
  csmMap: Map<string, AppCsmPhase>;
  crmMap: Map<string, AppCrmPhase>;
}> {
  const [csmMap, crmMap] = await Promise.all([
    fetchCsmPhasesByUids(companyUids),
    fetchCrmPhasesByUids(companyUids),
  ]);
  return { csmMap, crmMap };
}

// ── フェーズ履歴（変化検知用）────────────────────────────────────────────────

export interface CsmPhaseWithHistory {
  current:  AppCsmPhase;
  previous: AppCsmPhase | null;
}

/**
 * 複数企業の CSM フェーズを「最新2件」取得し、フェーズ変化を検知できるようにする。
 * - rows[0] = 最新（current）
 * - rows[1] = 直前（previous）— 存在しない場合は null
 *
 * 返り値: Map<company_uid, CsmPhaseWithHistory>
 */
export async function fetchCsmPhasesWithHistoryByUids(
  companyUids: string[],
): Promise<Map<string, CsmPhaseWithHistory>> {
  const tableId = TABLE_IDS.csm_customer_phase;
  if (!tableId || companyUids.length === 0) return new Map();
  // 2件/社 必要なので limit を uids × 2 で要求（上限 1000）
  const limit = String(Math.min(companyUids.length * 2, 1000));
  const rawMap = await nocoFetchByUids<RawCsmPhase>(tableId, companyUids, {
    sort: '-stat_date',
    limit,
  });
  const result = new Map<string, CsmPhaseWithHistory>();
  for (const [uid, rows] of rawMap) {
    if (rows.length === 0) continue;
    result.set(uid, {
      current:  toAppCsmPhase(rows[0]),
      previous: rows.length > 1 ? toAppCsmPhase(rows[1]) : null,
    });
  }
  return result;
}
