import { nocoFetch, TABLE_IDS } from './client';
import { RawAlert, AppAlert, toAppAlert } from './types';

/** アラート一覧取得。companyUid を渡すと絞り込み */
export async function fetchAlerts(companyUid?: string): Promise<AppAlert[]> {
  const params: Record<string, string> = { limit: '200' };
  if (companyUid) {
    params.where = `(company_uid,eq,${companyUid})`;
  }
  const raw = await nocoFetch<RawAlert>(TABLE_IDS.alerts, params);
  return raw.map(toAppAlert);
}
