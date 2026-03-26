import { nocoFetch, TABLE_IDS } from './client';
import { RawCompany, AppCompany, toAppCompany } from './types';

/**
 * CSM管理企業を取得（Console 一覧用）
 *
 * 表示ルール:
 *   - is_csm_managed=true の企業のみ対象（現在96社）
 *     → この条件を持つ企業のみ current_phase / open_alert_count 等が入っている
 *   - is_csm_managed=null/false の企業（約4500社）は canonical_name 以外が空のため除外
 *
 * ソート順:
 *   1. open_alert_count 降順（アラート多い＝緊急度高い）
 *   2. last_contact 降順（最近接点あり＝アクティブ）
 */
export async function fetchAllCompanies(limit = 50): Promise<AppCompany[]> {
  const raw = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
    where: '(status,eq,active)~and(is_csm_managed,eq,true)',
    sort: '-open_alert_count,-last_contact',
    limit: String(limit),
  });
  return raw.map(toAppCompany);
}

/**
 * company_uid でピンポイント取得（Company Detail 用）
 * is_csm_managed に関わらず全企業を対象とする（UID直接指定は意図的アクセス）
 */
export async function fetchCompanyByUid(uid: string): Promise<AppCompany | null> {
  const raw = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
    where: `(company_uid,eq,${uid})`,
    limit: '1',
  });
  return raw.length > 0 ? toAppCompany(raw[0]) : null;
}
