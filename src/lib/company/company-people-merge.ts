// ─── Company People Merge / Dedupe ────────────────────────────────────────────
//
// 複数ソースの AppPerson[] をマージし重複を排除する。
//
// ソースの種類:
//   sf_contacts    — Salesforce Contact 同期（people テーブル由来）
//   cxm_contacts   — CXM マネージド（company_people テーブル由来）
//
// デデュープ優先順位（この順で同一人物と判断）:
//   1. sfId          — 両者に sfId が存在し一致
//   2. email         — 大文字小文字を正規化して一致
//   3. name + company — name の正規化一致（スペース・全半角・大小文字）
//
// ソース優先順位（マスタの扱い）:
//   - sfId がある SF レコードをベースとする（SF が truth）
//   - CXM 側にしかない補足フィールドはマージ（SF で null の場合のみ上書き）
//   - CXM 側で明示的に変更された場合は CXM 優先とするフィールド:
//       role, decisionInfluence, contactStatus, owner, managerId
//
// ─────────────────────────────────────────────────────────────────────────────

import type { AppPerson } from '@/lib/nocodb/types';

// ── マージルール ──────────────────────────────────────────────────────────────

/**
 * どのフィールドを SF 優先 / CXM 優先にするかの方針表。
 * "sf_wins"  — SF の値がある場合は SF を使う
 * "cxm_wins" — CXM で設定されていれば CXM を使う（CSM が管理するメタ情報）
 * "merge"    — SF でも CXM でもどちらかに値があれば採用
 */
export const MERGE_FIELD_POLICY = {
  name:               'sf_wins',      // 正式名は SF が truth
  title:              'sf_wins',      // 役職は SF が truth
  department:         'sf_wins',      // 部署は SF が truth
  email:              'sf_wins',      // メールは SF が truth
  phone:              'sf_wins',      // 電話は SF が truth
  role:               'cxm_wins',     // Champion/Sponsor 等は CSM が付与する
  decisionInfluence:  'cxm_wins',     // 意思決定影響度は CSM が評価する
  contactStatus:      'cxm_wins',     // コンタクト状況は CSM が管理する
  owner:              'cxm_wins',     // 担当 CSM は CXM 側が持つ
  managerId:          'merge',        // SF にあれば SF、なければ CXM
  lastTouchpoint:     'merge',        // どちらかに新しい方
  source:             'sf_wins',      // 出所は SF がある場合 sf 確定
  sfId:               'sf_wins',      // Salesforce ID は SF から
  syncStatus:         'sf_wins',      // 同期状態は SF から
  sfLastSyncedAt:     'sf_wins',      // 最終同期日時は SF から
  // ── Org chart 拡張フィールド（CXM 側が管理する）──────────────────────────────
  layerRole:          'cxm_wins',     // CSM が設定するレイヤー
  isExecutive:        'cxm_wins',     // CSM が設定する経営層フラグ
  isDepartmentHead:   'cxm_wins',     // CSM が設定する部署長フラグ
  reportsToPersonId:  'cxm_wins',     // CSM が設定する上長 person_id
  worksWithPersonIds: 'cxm_wins',     // CSM が設定する協働関係
  displayGroup:       'cxm_wins',     // CSM が設定する表示グループ
  stakeholderNote:    'cxm_wins',     // CSM のメモ
} as const satisfies Record<string, 'sf_wins' | 'cxm_wins' | 'merge'>;

// ── 正規化ユーティリティ ──────────────────────────────────────────────────────

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')           // 複数スペースを1つに
    .replace(/　/g, ' ');           // 全角スペースを半角に
}

// ── キー生成 ─────────────────────────────────────────────────────────────────

type DedupeKey = string;

function makeSfIdKey(sfId: string | null | undefined): DedupeKey | null {
  const v = (sfId ?? '').trim();
  return v ? `sfId:${v}` : null;
}

function makeEmailKey(email: string | null | undefined): DedupeKey | null {
  const v = normalizeEmail(email);
  return v ? `email:${v}` : null;
}

function makeNameKey(name: string, companyUid: string): DedupeKey {
  return `name:${normalizeName(name)}@${companyUid}`;
}

// ── マージロジック ────────────────────────────────────────────────────────────

/**
 * SF レコード（ベース）と CXM レコード（補足）をマージした AppPerson を返す。
 * ポリシーテーブルに従い、フィールドごとに優先ソースを選択する。
 */
function mergePair(sf: AppPerson, cxm: AppPerson): AppPerson {
  const pick = <K extends keyof AppPerson>(
    field: K,
    policy: 'sf_wins' | 'cxm_wins' | 'merge',
  ): AppPerson[K] => {
    const sfVal  = sf[field];
    const cxmVal = cxm[field];
    if (policy === 'sf_wins')  return (sfVal  != null && sfVal  !== '') ? sfVal  : cxmVal;
    if (policy === 'cxm_wins') return (cxmVal != null && cxmVal !== '') ? cxmVal : sfVal;
    // merge: どちらかに値があれば採用（cxm 優先で上書き）
    return (cxmVal != null && cxmVal !== '') ? cxmVal : sfVal;
  };

  // lastTouchpoint は新しい方を優先（どちらかに値があれば）
  let lastTouchpoint = sf.lastTouchpoint;
  if (cxm.lastTouchpoint) {
    if (!lastTouchpoint || cxm.lastTouchpoint > lastTouchpoint) {
      lastTouchpoint = cxm.lastTouchpoint;
    }
  }

  return {
    // ID: SF の id を保持（primary key）。CXM の rowId も保持して PATCH に使える
    id:                sf.id,
    rowId:             cxm.rowId ?? sf.rowId,   // CXM rowId を優先（PATCH 用）
    company:           sf.company || cxm.company,
    name:              pick('name',              MERGE_FIELD_POLICY.name),
    title:             pick('title',             MERGE_FIELD_POLICY.title),
    department:        pick('department',        MERGE_FIELD_POLICY.department),
    email:             pick('email',             MERGE_FIELD_POLICY.email),
    phone:             pick('phone',             MERGE_FIELD_POLICY.phone),
    role:              pick('role',              MERGE_FIELD_POLICY.role),
    roleType:          sf.roleType || cxm.roleType || '',
    decisionInfluence: pick('decisionInfluence', MERGE_FIELD_POLICY.decisionInfluence),
    contactStatus:     pick('contactStatus',     MERGE_FIELD_POLICY.contactStatus),
    owner:             pick('owner',             MERGE_FIELD_POLICY.owner),
    managerId:         pick('managerId',         MERGE_FIELD_POLICY.managerId),
    lastTouchpoint,
    source:            pick('source',            MERGE_FIELD_POLICY.source),
    sfId:              pick('sfId',              MERGE_FIELD_POLICY.sfId),
    syncStatus:        pick('syncStatus',        MERGE_FIELD_POLICY.syncStatus),
    sfLastSyncedAt:    pick('sfLastSyncedAt',    MERGE_FIELD_POLICY.sfLastSyncedAt),
    // 非マージフィールド（SF / CXM どちらかのみ持つ）
    status:            sf.status || cxm.status || 'proposed',
    confidence:        sf.confidence ?? cxm.confidence,
    evidenceCount:     (sf.evidenceCount ?? 0) + (cxm.evidenceCount ?? 0),
    linkedProjects:    [...(sf.linkedProjects ?? []), ...(cxm.linkedProjects ?? [])],
    linkedActions:     (sf.linkedActions ?? 0) + (cxm.linkedActions ?? 0),
    missingFields:     [...(sf.missingFields ?? []), ...(cxm.missingFields ?? [])],
    scope:             sf.scope ?? cxm.scope,
    // ── Org chart 拡張フィールド（cxm_wins — pick を使わず直接マージ）──────────
    layerRole:         cxm.layerRole         ?? sf.layerRole         ?? null,
    isExecutive:       cxm.isExecutive        ?? sf.isExecutive        ?? null,
    isDepartmentHead:  cxm.isDepartmentHead   ?? sf.isDepartmentHead   ?? null,
    reportsToPersonId: cxm.reportsToPersonId  ?? sf.reportsToPersonId  ?? null,
    worksWithPersonIds:cxm.worksWithPersonIds ?? sf.worksWithPersonIds ?? null,
    displayGroup:      cxm.displayGroup       ?? sf.displayGroup       ?? null,
    stakeholderNote:   cxm.stakeholderNote    ?? sf.stakeholderNote    ?? null,
  };
}

// ── メイン export ─────────────────────────────────────────────────────────────

/**
 * SF 由来 (sfContacts) と CXM 由来 (cxmContacts) の AppPerson[] をマージする。
 *
 * - sfId / email / name+company の順で同一人物を検出
 * - マッチした場合は mergePair() でフィールドをポリシーに従い合成
 * - マッチしない SF 側は sf_only としてそのまま追加
 * - マッチしない CXM 側は cxm_only としてそのまま追加
 * - 返り値は重複なし。順序: merged → sf_only → cxm_only
 */
export function mergeCompanyPeople(
  sfContacts:  AppPerson[],
  cxmContacts: AppPerson[],
): AppPerson[] {
  const merged:   AppPerson[] = [];
  const sfOnly:   AppPerson[] = [];
  const usedCxm = new Set<string>();  // id

  for (const sf of sfContacts) {
    // 1. sfId 一致
    const bySfId = sf.sfId
      ? cxmContacts.find(c => c.sfId && c.sfId === sf.sfId)
      : undefined;

    // 2. email 一致
    const byEmail = !bySfId && sf.email
      ? cxmContacts.find(c =>
          c.email && normalizeEmail(c.email) === normalizeEmail(sf.email) && !usedCxm.has(c.id),
        )
      : undefined;

    // 3. name + company 一致
    const byName = !bySfId && !byEmail
      ? cxmContacts.find(c =>
          normalizeName(c.name) === normalizeName(sf.name) &&
          c.company === sf.company &&
          !usedCxm.has(c.id),
        )
      : undefined;

    const cxmMatch = bySfId ?? byEmail ?? byName;

    if (cxmMatch) {
      usedCxm.add(cxmMatch.id);
      merged.push(mergePair(sf, cxmMatch));
    } else {
      sfOnly.push(sf);
    }
  }

  // マッチしなかった CXM 側をそのまま追加
  const cxmOnly = cxmContacts.filter(c => !usedCxm.has(c.id));

  return [...merged, ...sfOnly, ...cxmOnly];
}

// ── ソース別分類ユーティリティ ────────────────────────────────────────────────

/** `company_people` テーブル由来かどうかを判定（rowId があれば CXM マネージド）*/
export function isCxmManaged(person: AppPerson): boolean {
  return person.source === 'cxm' || (!!person.rowId && person.source !== 'salesforce');
}

/** デデュープキーセットを人間が読める形で返す（デバッグ用） */
export function getDedupeKeys(person: AppPerson): {
  sfIdKey:   string | null;
  emailKey:  string | null;
  nameKey:   string;
} {
  return {
    sfIdKey:  makeSfIdKey(person.sfId),
    emailKey: makeEmailKey(person.email),
    nameKey:  makeNameKey(person.name, person.company),
  };
}
