// ─── project_info read helpers ────────────────────────────────────────────────
//
// 1企業配下の複数プロジェクトを取得する。
//
// ⚠️ 実テーブル結合の注意:
//   project_info テーブルに company_uid カラムは存在しない。
//   代わりに master_company_sf_id (= companies.sf_account_id) で紐づく。
//
//   company_uid の形式:
//     "sf_0017F00000TEOSMQA5" → sfAccountId = "0017F00000TEOSMQA5"  （SF 連携済み企業）
//     "cmp_xxx"               → SF 連携なし → project は 0 件（graceful fallback）

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import {
  toAppProjectInfo,
  type RawProjectInfo,
  type AppProjectInfo,
} from '@/lib/nocodb/types';

// ── SF Account ID 抽出ユーティリティ ──────────────────────────────────────────

/**
 * company_uid から Salesforce Account ID を抽出する。
 * "sf_0017F00000TEOSMQA5" → "0017F00000TEOSMQA5"
 * "cmp_xxx" など sf_ 以外 → null（SF 未連携企業）
 */
function sfIdFromCompanyUid(companyUid: string): string | null {
  return companyUid.startsWith('sf_') ? companyUid.slice(3) : null;
}

// ── 単一 company_uid ─────────────────────────────────────────────────────────

/**
 * 指定企業の全プロジェクトを取得する。
 * - SF 連携済み企業（"sf_xxx"）: master_company_sf_id で検索
 * - 非 SF 企業（"cmp_xxx"）: graceful fallback で空配列
 * - テーブル未設定: 空配列
 *
 * sort: project_create_time 降順（最近作成順）
 */
export async function fetchProjectsByCompany(
  companyUid: string,
): Promise<AppProjectInfo[]> {
  const tableId = TABLE_IDS.project_info;
  if (!tableId) return [];

  const sfId = sfIdFromCompanyUid(companyUid);
  if (!sfId) return [];  // SF 未連携企業は project なし

  const list = await nocoFetch<RawProjectInfo>(tableId, {
    where: `(master_company_sf_id,eq,${sfId})`,
    sort:  '-project_create_time',
    limit: '100',
  });
  return list.map(raw => toAppProjectInfo(raw, companyUid));
}

// ── 複数 company_uids（List 画面向け）────────────────────────────────────────

/**
 * 複数企業のプロジェクトを一括取得する。
 * 返り値: Map<company_uid, AppProjectInfo[]>
 * 存在しない UID / SF 未連携 UID は空配列がセットされる。
 *
 * 結合ロジック:
 *   1. company_uid → sfAccountId を変換（"sf_xxx" のみ）
 *   2. master_company_sf_id IN (sfId1, sfId2, ...) で一括 fetch
 *   3. sfId → company_uid のリバース Map で再マッピング
 */
export async function fetchProjectsByUids(
  companyUids: string[],
): Promise<Map<string, AppProjectInfo[]>> {
  const result = new Map<string, AppProjectInfo[]>(companyUids.map(uid => [uid, []]));

  const tableId = TABLE_IDS.project_info;
  if (!tableId || companyUids.length === 0) return result;

  // sf_xxx 形式の UID のみ sfId に変換
  const sfIdToUid = new Map<string, string>();
  for (const uid of companyUids) {
    const sfId = sfIdFromCompanyUid(uid);
    if (sfId) sfIdToUid.set(sfId, uid);
  }
  if (sfIdToUid.size === 0) return result;  // SF 連携企業なし

  const sfIds = [...sfIdToUid.keys()];
  const where = `(master_company_sf_id,in,${sfIds.join(',')})`;
  const limit = String(Math.min(sfIds.length * 50, 2000));

  const rows = await nocoFetch<RawProjectInfo>(tableId, { where, limit, sort: '-project_create_time' });

  for (const raw of rows) {
    const sfId = (raw.master_company_sf_id as string | null | undefined) ?? '';
    const uid  = sfIdToUid.get(sfId);
    if (!uid) continue;
    const arr = result.get(uid) ?? [];
    arr.push(toAppProjectInfo(raw, uid));
    result.set(uid, arr);
  }
  return result;
}
