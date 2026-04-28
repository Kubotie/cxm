import { nocoFetch, TABLE_IDS } from './client';
import { RawCompany, AppCompany, toAppCompany } from './types';

/**
 * company_uid に対応する Salesforce Account ID を取得する。
 * companies テーブルの sf_account_id カラムを参照する。
 *
 * @returns sfAccountId（未設定 or テーブル未設定 or エラー時は null）
 * @remarks
 *   sf_account_id が null/空の場合は companyUid そのものが SF Account ID に
 *   なっているケースがある（呼び出し元で fallback として使用可）。
 */
export async function fetchSfAccountId(companyUid: string): Promise<string | null> {
  if (!TABLE_IDS.companies) return null;
  try {
    const rows = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
      where:  `(company_uid,eq,${companyUid})`,
      fields: 'company_uid,sf_account_id',
      limit:  '1',
    });
    const val = rows[0]?.sf_account_id;
    return val ? String(val).trim() : null;
  } catch {
    return null;
  }
}

/**
 * 複数の company_uid → sfAccountId のマッピングを一括取得する。
 * @returns Map<companyUid, sfAccountId>（sf_account_id が null の UID は含まれない）
 */
export async function fetchSfAccountIdMap(uids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (uids.length === 0 || !TABLE_IDS.companies) return result;
  try {
    const where = `(company_uid,in,${uids.join(',')})`;
    const rows = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
      where,
      fields: 'company_uid,sf_account_id',
      limit:  String(uids.length + 10),
    });
    for (const row of rows) {
      const uid  = row.company_uid?.trim();
      const sfId = row.sf_account_id?.toString().trim();
      if (uid && sfId) result.set(uid, sfId);
    }
  } catch {
    // エラー時は空 Map（呼び出し元が fallback を処理）
  }
  return result;
}

/**
 * 複数の company_uid に対応する canonical_name を一括取得する。
 * Support Queue など company_uid が判明している一覧に会社名を付与するために使用。
 * @returns Map<company_uid, canonical_name>（見つからない UID は含まれない）
 * @remarks エラー時は空 Map を返す（呼び出し元の表示は fallback のまま継続）
 */
export async function fetchCanonicalNameMap(uids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (uids.length === 0 || !TABLE_IDS.companies) return result;
  try {
    const where = `(company_uid,in,${uids.join(',')})`;
    const rows = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
      where,
      fields: 'company_uid,canonical_name',
      limit: String(uids.length + 10),
    });
    for (const row of rows) {
      const uid  = row.company_uid?.trim();
      const name = row.canonical_name?.trim();
      if (uid && name) result.set(uid, name);
    }
  } catch {
    // 失敗しても一覧表示は継続（companyName fallback を保持）
  }
  return result;
}

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
export async function fetchAllCompanies(limit = 50, ownerName?: string): Promise<AppCompany[]> {
  const baseWhere = '(status,eq,active)~and(is_csm_managed,eq,true)';
  const where = ownerName
    ? `${baseWhere}~and(owner_name,eq,${ownerName})`
    : baseWhere;
  const raw = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
    where,
    sort: '-open_alert_count,-last_contact',
    limit: String(limit),
  });
  return raw.map(toAppCompany);
}

/**
 * 担当がついているCSM管理企業を全件取得（SF一括同期用）。
 * owner_name が空でない企業のみ対象。
 */
export async function fetchAssignedCompanies(): Promise<Array<{
  companyUid:  string;
  sfAccountId: string | null;
  ownerName:   string;
}>> {
  if (!TABLE_IDS.companies) return [];
  try {
    const rows = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
      where:  '(status,eq,active)~and(is_csm_managed,eq,true)~and(owner_name,notblank,)',
      fields: 'company_uid,sf_account_id,owner_name',
      limit:  '300',
    }, false);
    return rows
      .filter(r => r.company_uid && r.owner_name)
      .map(r => ({
        companyUid:  String(r.company_uid).trim(),
        sfAccountId: r.sf_account_id ? String(r.sf_account_id).trim() : null,
        ownerName:   String(r.owner_name).trim(),
      }));
  } catch {
    return [];
  }
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
