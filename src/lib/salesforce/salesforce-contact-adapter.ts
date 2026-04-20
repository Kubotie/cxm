// ─── Salesforce Contact Adapter Boundary ─────────────────────────────────────
//
// Salesforce Contact API との接続境界を定義する。
// 現時点では型定義・プレースホルダー実装のみ。
// 本接続時はこのファイルだけを差し替えればよい設計にする。
//
// 責務の分担:
//   このファイル（Salesforce側）:
//     - Salesforce Contact レコードの形式定義
//     - Salesforce REST API との通信
//     - SalesforceContact → AppPerson へのフィールドマッピング
//     - sfId / syncStatus / sfLastSyncedAt の設定責務
//
//   company_people テーブル（CXM側）:
//     - role / decisionInfluence / contactStatus / owner / managerId の管理
//     - CSM が独自に付けたメタ情報の永続化
//     - SF と CXM のマージ結果の参照
//     - lastTouchpoint の更新（CXM 側操作で変わるもの）
//
// ─────────────────────────────────────────────────────────────────────────────

import type { AppPerson, RawCompanyPerson } from '@/lib/nocodb/types';
import { toAppPersonFromCompanyPeople } from '@/lib/nocodb/types';
import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';
import { sfQuery, isSalesforceConfigured, SF_API_BASE, sfFetch } from './client';
import type { ContactSfPushPayload } from './sync-policy';

// ── Salesforce Contact 型 ─────────────────────────────────────────────────────

/** Salesforce REST API が返す Contact レコードの必要フィールド */
export interface SalesforceContact {
  Id:             string;      // Salesforce Contact ID
  FirstName?:     string;
  LastName:       string;
  Title?:         string;
  Department?:    string;
  Email?:         string;
  Phone?:         string;
  MobilePhone?:   string;
  AccountId?:     string;      // 親 Account（会社）ID
  ReportsToId?:   string;      // 上長の Contact ID (= managerId の元データ)
  OwnerId?:       string;      // Salesforce User ID（担当者）
  LastActivityDate?: string;   // 最終活動日 YYYY-MM-DD
  CreatedDate?:   string;
  LastModifiedDate?: string;
}

/** Salesforce → AppPerson のマッピング結果 */
export interface SalesforceContactMapResult {
  person:         AppPerson;
  sfId:           string;
  sfAccountId:    string | null;
  sfManagerId:    string | null;  // ReportsToId（SF Contact ID）
  syncedAt:       string;
}

// ── マッピング ────────────────────────────────────────────────────────────────

/**
 * Salesforce Contact → AppPerson への変換。
 * CXM 側フィールド（role, decisionInfluence 等）は undefined とし、
 * company_people テーブルの値で上書きする（mergeCompanyPeople が担当）。
 */
export function mapSalesforceContact(
  sf: SalesforceContact,
  companyUid: string,
): SalesforceContactMapResult {
  const syncedAt = new Date().toISOString();
  const name = [sf.FirstName, sf.LastName].filter(Boolean).join(' ');

  // NOTE: この AppPerson は syncContactsToCompanyPeople 内で name 取得のみに使用する。
  // 実際に NocoDB へ保存される person_id (UUID) は syncContactsToCompanyPeople で別途採番する。
  const person: AppPerson = {
    id:                crypto.randomUUID(),
    company:           companyUid,
    name,
    title:             sf.Title    ?? undefined,
    department:        sf.Department ?? undefined,
    email:             sf.Email    ?? undefined,
    phone:             sf.Phone ?? sf.MobilePhone ?? undefined,
    role:              '',             // CXM 側で設定
    roleType:          '',
    decisionInfluence: 'unknown',      // CXM 側で設定
    contactStatus:     'unknown',      // CXM 側で設定
    status:            'confirmed',    // SF 由来は confirmed
    evidenceCount:     0,
    lastTouchpoint:    sf.LastActivityDate ?? null,
    linkedProjects:    [],
    source:            'salesforce',
    sfId:              sf.Id,
    syncStatus:        'synced',
    sfLastSyncedAt:    syncedAt,
    managerId:         sf.ReportsToId ?? null,
  };

  return {
    person,
    sfId:        sf.Id,
    sfAccountId: sf.AccountId ?? null,
    sfManagerId: sf.ReportsToId ?? null,
    syncedAt,
  };
}

// ── SF Contact Sync SyncResult ────────────────────────────────────────────────
//
// SalesforceContact → AppPerson → company_people の同期フロー結果型。
//
// 同期フロー:
//   1. fetchContactsByAccount(sfAccountId) → SalesforceContact[]
//   2. 各 SalesforceContact を mapSalesforceContact() で AppPerson に変換
//   3. mergeCompanyPeople(sfContacts, cxmContacts) でデュープ検出・マージ
//   4. CXM 側にない SF Contact は createCompanyPerson() で新規作成
//   5. CXM 側にある SF Contact は updateCompanyPerson() で SF wins フィールドを更新
//   6. SyncResult を返す
//
// SF wins フィールド（SF 側の値で上書きするフィールド）:
//   name / title / department / email / phone / sfId / syncStatus / sfLastSyncedAt
//
// CXM wins フィールド（CXM 側の値を保持するフィールド）:
//   role / roleType / decisionInfluence / contactStatus / owner / managerId / lastTouchpoint

/** 1件の Contact 同期結果 */
export interface ContactSyncItemResult {
  sfId:      string;
  name:      string;
  /** 'created' = 新規作成 / 'updated' = 更新 / 'skipped' = 変更なし / 'conflicted' = 競合あり */
  outcome:   'created' | 'updated' | 'skipped' | 'conflicted';
  /** 競合内容（outcome === 'conflicted' のとき設定） */
  conflicts?: string[];
  /** エラーメッセージ（outcome が予期せぬ場合） */
  error?:    string;
}

/** SF Contact 同期全体の結果サマリー */
export interface SalesforceContactSyncResult {
  companyUid:    string;
  sfAccountId:   string;
  syncedAt:      string;
  /** 取得した SF Contact 数 */
  sfTotal:       number;
  createdCount:  number;
  updatedCount:  number;
  skippedCount:  number;
  conflictCount: number;
  errorCount:    number;
  items:         ContactSyncItemResult[];
}

// ── Salesforce API インターフェース（placeholder）────────────────────────────
//
// 本接続時は実装に置き換える。
// 現在はすべて NotImplementedError をスローする。

export interface SalesforceContactAdapter {
  /**
   * Account（companyUid に対応）に紐づく Contact 一覧を取得する。
   * @returns SalesforceContact[]（空の場合は []）
   */
  fetchContactsByAccount(accountId: string): Promise<SalesforceContact[]>;

  /**
   * Salesforce に新規 Contact を作成する。
   * @returns 作成された Contact の sfId
   */
  createContact(
    contact: Omit<SalesforceContact, 'Id' | 'CreatedDate' | 'LastModifiedDate'>,
  ): Promise<string>;

  /**
   * Salesforce の既存 Contact を更新する。
   * @param sfId    Salesforce Contact ID
   * @param patch   更新フィールド
   */
  updateContact(
    sfId: string,
    patch: Partial<Omit<SalesforceContact, 'Id'>>,
  ): Promise<void>;

  /**
   * Salesforce Account に紐づく Contact を company_people テーブルに一括同期する。
   * - fetchContactsByAccount → mapSalesforceContact → mergeCompanyPeople の順で処理
   * - SF 側にあって CXM 側にない → createCompanyPerson
   * - 両方にある → updateCompanyPerson（SF wins フィールドのみ上書き）
   * - CXM 側にあって SF 側にない → 変更なし（CXM 独自管理のため）
   * @returns SalesforceContactSyncResult（全件のサマリー + item ごとの outcome）
   */
  syncContactsToCompanyPeople(
    sfAccountId: string,
    companyUid:  string,
  ): Promise<SalesforceContactSyncResult>;

  /**
   * CXM で変更された Contact フィールドを Salesforce に push する（手動実行）。
   * sync-policy.ts の CONTACT_CXM_TO_SF_PUSH_FIELDS（title / department / email / phone）のみ対象。
   * CXM主フィールド（role / layer_role / stakeholder_note 等）は含まない。
   *
   * @param payload  sf_id（SF Contact ID）+ 変更フィールド
   */
  pushCxmFieldsToSalesforce(payload: ContactSfPushPayload): Promise<{ ok: boolean; error?: string }>;
}

// ── REST 実装 ────────────────────────────────────────────────────────────────
//
// Salesforce REST API を使った実装。
// sfFetch / sfQuery は src/lib/salesforce/client.ts が認証を担当する。

/**
 * Salesforce REST API を使った Contact Adapter 本実装。
 * `isSalesforceConfigured() === true` の場合に `activeSalesforceContactAdapter` として使われる。
 */
export const salesforceRestContactAdapter: SalesforceContactAdapter = {
  async fetchContactsByAccount(accountId: string): Promise<SalesforceContact[]> {
    const soql = [
      'SELECT Id,FirstName,LastName,Title,Department,Email,Phone,MobilePhone,',
      'AccountId,ReportsToId,OwnerId,LastActivityDate',
      ' FROM Contact',
      ` WHERE AccountId='${accountId}' AND IsDeleted=false`,
      ' ORDER BY LastName ASC',
    ].join('');
    return sfQuery<SalesforceContact>(soql);
  },

  async createContact(
    contact: Omit<SalesforceContact, 'Id' | 'CreatedDate' | 'LastModifiedDate'>,
  ): Promise<string> {
    const result = await sfFetch<{ id: string; success: boolean }>(
      'POST',
      `${SF_API_BASE}/sobjects/Contact`,
      contact,
    );
    return result.id;
  },

  async updateContact(sfId: string, patch: Partial<Omit<SalesforceContact, 'Id'>>): Promise<void> {
    await sfFetch('PATCH', `${SF_API_BASE}/sobjects/Contact/${sfId}`, patch);
  },

  async pushCxmFieldsToSalesforce(payload: ContactSfPushPayload): Promise<{ ok: boolean; error?: string }> {
    try {
      const sfPatch: Record<string, string | undefined> = {};
      if (payload.Title      !== undefined) sfPatch.Title      = payload.Title;
      if (payload.Department !== undefined) sfPatch.Department = payload.Department;
      if (payload.Email      !== undefined) sfPatch.Email      = payload.Email;
      if (payload.Phone      !== undefined) sfPatch.Phone      = payload.Phone;
      if (Object.keys(sfPatch).length === 0) return { ok: true };
      await sfFetch('PATCH', `${SF_API_BASE}/sobjects/Contact/${payload.sfContactId}`, sfPatch);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async syncContactsToCompanyPeople(
    sfAccountId: string,
    companyUid:  string,
  ): Promise<SalesforceContactSyncResult> {
    const syncedAt = new Date().toISOString();
    const items: ContactSyncItemResult[] = [];

    // 1. SF Contact 一覧を取得
    const sfContacts = await this.fetchContactsByAccount(sfAccountId);

    // 2. 既存 company_people を全取得して index を構築
    const tableId = TABLE_IDS.company_people;
    if (!tableId) {
      throw new Error('NOCODB_COMPANY_PEOPLE_TABLE_ID が未設定です');
    }
    const existingRaw = await nocoFetch<RawCompanyPerson>(tableId, {
      where: `(company_uid,eq,${companyUid})`,
      limit: '500',
    });

    // sfId → row, email → row の高速検索用 Map
    const bySfId  = new Map<string, RawCompanyPerson>();
    const byEmail = new Map<string, RawCompanyPerson>();
    for (const row of existingRaw) {
      if (row.sf_id)  bySfId.set(row.sf_id, row);
      if (row.email)  byEmail.set(row.email.toLowerCase().trim(), row);
    }

    // 3. SF Contact ごとに create / update を実行
    for (const sf of sfContacts) {
      const mapped = mapSalesforceContact(sf, companyUid);
      const name   = mapped.person.name;

      try {
        // sf_wins フィールドのみ書き込む（cxm_wins フィールドは触らない）
        const sfWinsPayload = {
          name:              name,
          title:             sf.Title             ?? null,
          department:        sf.Department        ?? null,
          email:             sf.Email             ?? null,
          phone:             sf.Phone ?? sf.MobilePhone ?? null,
          sf_id:             sf.Id,
          sync_status:       'synced',
          sf_last_synced_at: syncedAt,
          source:            'salesforce',
        };

        // 優先度: sfId 一致 → email 一致 → 新規作成
        const existingBySfId  = bySfId.get(sf.Id);
        const existingByEmail = sf.Email
          ? byEmail.get(sf.Email.toLowerCase().trim())
          : undefined;

        const existing = existingBySfId ?? existingByEmail;

        if (!existing) {
          // 新規作成（cxm_wins フィールドはデフォルト値で初期化）
          // person_id は UUID を採番する（SF Contact ID と分離するため）
          await nocoCreate<RawCompanyPerson>(tableId, {
            ...sfWinsPayload,
            person_id:          crypto.randomUUID(),
            company_uid:        companyUid,
            status:             'confirmed',
            decision_influence: 'unknown',
            contact_status:     'unknown',
          });
          items.push({ sfId: sf.Id, name, outcome: 'created' });
        } else {
          // email 一致で既存レコードに別の sfId がある場合は conflict
          if (existingByEmail && !existingBySfId && existing.sf_id && existing.sf_id !== sf.Id) {
            items.push({
              sfId: sf.Id,
              name,
              outcome: 'conflicted',
              conflicts: [`email '${sf.Email}' は既存レコード(sfId:${existing.sf_id})に紐付き済み`],
            });
            continue;
          }

          // sf_wins フィールドのみ更新
          await nocoUpdate<RawCompanyPerson>(tableId, existing.Id, sfWinsPayload);
          items.push({ sfId: sf.Id, name, outcome: 'updated' });

          // インデックスを最新化（後続の Contact でのマッチに使用）
          if (!existingBySfId) bySfId.set(sf.Id, { ...existing, ...sfWinsPayload } as RawCompanyPerson);
        }
      } catch (err) {
        items.push({ sfId: sf.Id, name, outcome: 'conflicted', error: String(err) });
      }
    }

    return {
      companyUid,
      sfAccountId,
      syncedAt,
      sfTotal:       sfContacts.length,
      createdCount:  items.filter(i => i.outcome === 'created').length,
      updatedCount:  items.filter(i => i.outcome === 'updated').length,
      skippedCount:  items.filter(i => i.outcome === 'skipped').length,
      conflictCount: items.filter(i => i.outcome === 'conflicted').length,
      errorCount:    items.filter(i => i.error != null && i.outcome !== 'conflicted').length,
      items,
    };
  },
};

// ── Placeholder 実装 ──────────────────────────────────────────────────────────

/**
 * 未接続状態のプレースホルダー実装。
 * SALESFORCE_* 環境変数が未設定の場合に activeSalesforceContactAdapter として使われる。
 */
export const placeholderSalesforceContactAdapter: SalesforceContactAdapter = {
  async fetchContactsByAccount(_accountId: string): Promise<SalesforceContact[]> {
    // TODO: Salesforce REST API: GET /services/data/v60.0/query
    //   SELECT Id,FirstName,LastName,Title,Department,Email,Phone,ReportsToId,LastActivityDate
    //   FROM Contact WHERE AccountId = '{accountId}'
    throw new Error('Salesforce Contact adapter is not yet connected. Implement SalesforceRestContactAdapter.');
  },

  async createContact(_contact): Promise<string> {
    // TODO: POST /services/data/v60.0/sobjects/Contact
    throw new Error('Salesforce Contact adapter is not yet connected.');
  },

  async updateContact(_sfId, _patch): Promise<void> {
    // TODO: PATCH /services/data/v60.0/sobjects/Contact/{sfId}
    throw new Error('Salesforce Contact adapter is not yet connected.');
  },

  async syncContactsToCompanyPeople(
    _sfAccountId: string,
    _companyUid: string,
  ): Promise<SalesforceContactSyncResult> {
    throw new Error('Salesforce Contact adapter is not yet connected. Set SALESFORCE_* env vars.');
  },

  async pushCxmFieldsToSalesforce(_payload: ContactSfPushPayload): Promise<{ ok: boolean; error?: string }> {
    throw new Error('Salesforce Contact adapter is not yet connected.');
  },
};

// ── アクティブ adapter ────────────────────────────────────────────────────────
//
// 環境変数が設定済みなら REST 実装、未設定なら placeholder を使う。
// 呼び出し元はこれを import して使う（直接 placeholder は参照しない）。

export const activeSalesforceContactAdapter: SalesforceContactAdapter =
  isSalesforceConfigured() ? salesforceRestContactAdapter : placeholderSalesforceContactAdapter;
