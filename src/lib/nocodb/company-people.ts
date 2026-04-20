// ─── Company People NocoDB helper ────────────────────────────────────────────
// company_people テーブル（CXM マネージド連絡先）の read / create / update。
//
// テーブル設定:
//   .env.local: NOCODB_COMPANY_PEOPLE_TABLE_ID=<テーブルID>
//
// ⚠️  graceful degradation:
//   NOCODB_COMPANY_PEOPLE_TABLE_ID が未設定の場合:
//   - getCompanyPeople → 空配列を返す（UI は壊れない）
//   - createCompanyPerson / updateCompanyPerson → Error をスローする
//     （呼び出し側の API route で catch して optimistic update は保持）
//
// 既存の people テーブル（TABLE_IDS.people）は Salesforce 同期データで読み取り専用。
// company_people は CSM が CXM 上で追加・編集する連絡先専用のテーブル。

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoUpdate } from './write';
import { toAppPersonFromCompanyPeople, type RawCompanyPerson, type AppPerson } from './types';

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * company_uid に紐づく CXM マネージド連絡先を全件取得する。
 * テーブル未設定時は空配列を返す（graceful degradation）。
 */
export async function getCompanyPeople(
  companyUid: string,
): Promise<AppPerson[]> {
  const tableId = TABLE_IDS.company_people;
  if (!tableId) return []; // ← テーブル未設定: 永続化されない旨をコメントで明示

  const rows = await nocoFetch<RawCompanyPerson>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-created_at',
    limit: '500',
  });

  return rows.map(toAppPersonFromCompanyPeople);
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CompanyPersonCreatePayload {
  person_id:              string;   // UUID（app 生成）
  company_uid:            string;
  name:                   string;
  role?:                  string;
  title?:                 string;
  department?:            string;
  email?:                 string | null;
  phone?:                 string | null;
  decision_influence?:    string;
  contact_status?:        string;
  status?:                string;
  last_touchpoint?:       string | null;
  /** 上長の person_id（org chart 用。UUID を格納すること） */
  manager_id?:            string | null;
  owner?:                 string | null;
  /** 明示的に渡さない限り 'cxm' とする */
  source?:                string;
  sf_id?:                 string | null;
  sync_status?:           string | null;
  sf_last_synced_at?:     string | null;
  created_at?:            string;
  // ── Org chart 拡張フィールド ──────────────────────────────────────────────────
  /** executive / department_head / manager / operator / unclassified */
  layer_role?:            string | null;
  is_executive?:          boolean | null;
  is_department_head?:    boolean | null;
  /** 直属上長の person_id（reports_to_person_id が manager_id より精度高） */
  reports_to_person_id?:  string | null;
  /** 協働関係の person_id 配列を JSON 文字列化したもの */
  works_with_person_ids?: string | null;
  display_group?:         string | null;
  stakeholder_note?:      string | null;
}

/**
 * company_people テーブルに新規レコードを作成する。
 * テーブル未設定時は Error をスローする（呼び出し元で catch → optimistic のまま継続）。
 */
export async function createCompanyPerson(
  payload: CompanyPersonCreatePayload,
): Promise<AppPerson> {
  const tableId = TABLE_IDS.company_people;
  if (!tableId) {
    // NOTE: NOCODB_COMPANY_PEOPLE_TABLE_ID が未設定のため、この連絡先は永続化されていません。
    throw new Error(
      'NOCODB_COMPANY_PEOPLE_TABLE_ID が未設定です。.env.local に追加してください。',
    );
  }

  const raw = await nocoCreate<RawCompanyPerson>(tableId, {
    ...payload,
    source: payload.source ?? 'cxm',
    created_at: payload.created_at ?? new Date().toISOString(),
  });
  return toAppPersonFromCompanyPeople(raw);
}

// ── Update ───────────────────────────────────────────────────────────────────

export type CompanyPersonPatchPayload = Partial<{
  name:                   string;
  role:                   string;
  title:                  string;
  department:             string;
  email:                  string | null;
  phone:                  string | null;
  decision_influence:     string;
  contact_status:         string;
  status:                 string;
  last_touchpoint:        string | null;
  /** 上長の person_id（org chart 用。UUID を格納すること） */
  manager_id:             string | null;
  owner:                  string | null;
  sf_id:                  string | null;
  sync_status:            string | null;
  sf_last_synced_at:      string | null;
  // ── Org chart 拡張フィールド ────────────────────────────────────────────────
  layer_role:             string | null;
  is_executive:           boolean | null;
  is_department_head:     boolean | null;
  reports_to_person_id:   string | null;
  works_with_person_ids:  string | null;
  display_group:          string | null;
  stakeholder_note:       string | null;
}>;

/**
 * NocoDB row Id（数値）を指定して連絡先を部分更新する。
 * テーブル未設定時は Error をスローする（呼び出し元で catch → optimistic のまま継続）。
 */
export async function updateCompanyPerson(
  rowId: number,
  patch: CompanyPersonPatchPayload,
): Promise<AppPerson> {
  const tableId = TABLE_IDS.company_people;
  if (!tableId) {
    // NOTE: NOCODB_COMPANY_PEOPLE_TABLE_ID が未設定のため、この更新は永続化されていません。
    throw new Error(
      'NOCODB_COMPANY_PEOPLE_TABLE_ID が未設定です。.env.local に追加してください。',
    );
  }

  const raw = await nocoUpdate<RawCompanyPerson>(tableId, rowId, patch);
  return toAppPersonFromCompanyPeople(raw);
}
