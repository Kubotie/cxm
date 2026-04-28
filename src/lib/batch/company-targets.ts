// ─── Company バッチ用 対象企業解決ヘルパー ────────────────────────────────────
// company-summary / unified-log-signals バッチが共通で使う対象企業取得ロジック。
//
// ルール:
//   - company_uids 指定あり → 指定 UID のみ取得（limit でキャップ）
//   - 指定なし              → is_csm_managed=true の全企業を limit 件取得

import { fetchAllCompanies, fetchCompanyByUid } from '@/lib/nocodb/companies';
import type { AppCompany } from '@/lib/nocodb/types';

export interface CompanyTargetParams {
  limit:          number;
  company_uids?:  string[];
  /** owner_name フィルタ（staff_identify.name2 に対応）*/
  owner_name?:    string;
}

/**
 * バッチ対象企業を解決する。
 * company_uids が指定された場合はその UID のみ、なければ全 CSM 管理企業を返す。
 */
export async function resolveTargetCompanies(
  params: CompanyTargetParams,
): Promise<AppCompany[]> {
  if (params.company_uids && params.company_uids.length > 0) {
    const fetched = await Promise.all(
      params.company_uids.slice(0, params.limit).map(uid =>
        fetchCompanyByUid(uid).catch(() => null),
      ),
    );
    return fetched.filter((c): c is AppCompany => c !== null);
  }
  return fetchAllCompanies(params.limit, params.owner_name);
}
