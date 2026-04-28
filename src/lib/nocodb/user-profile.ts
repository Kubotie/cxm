// ─── ユーザープロファイル（staff_identify テーブル）────────────────────────────
//
// NocoDB テーブル: staff_identify (TABLE_IDS.staff_identify)
// owner_name in companies = staff_identify.name2（Roman/nickname 形式）
//
// 拡張フィールド（NocoDB で列追加が必要）:
//   role, default_home_scope, preferred_summary_policy_id, focus_areas
//   これらが未設定の場合はデフォルト値を使用する（graceful degradation）。

import { nocoFetch, TABLE_IDS } from './client';
import { nocoUpdate } from './write';
import type { AppRole } from '@/lib/auth/role';

// ── 型定義 ──────────────────────────────────────────────────────────────────

/** アプリ内で使うユーザープロファイル型 */
export interface AppUserProfile {
  Id?: number;
  /** Roman/nickname（companies.owner_name と一致。Cookie に保存するユーザー識別子）*/
  name2: string;
  /** 表示名（日本語名） */
  name: string;
  email?: string | null;
  /** アプリロール */
  role: AppRole;
  team?: string | null;
  /** Salesforce Account ID（アクションの担当者フィルタに使用） */
  sf_account_id?: string | null;
  /** Intercom Admin ID（Outbound メール送信時の from.id に使用） */
  intercom_admin_id?: string | null;
  /** Home 表示スコープ: mine=自分担当のみ, team=チーム全体, all=全社 */
  default_home_scope: 'mine' | 'team' | 'all';
  /** AI サマリ生成時のデフォルトポリシー ID */
  preferred_summary_policy_id?: string | null;
  /** 重点領域: renewal / expansion / risk / support */
  focus_areas?: string[];
  is_active?: boolean;
}

/** NocoDB の生レコード型（存在しないカラムは undefined になる） */
interface RawStaffIdentify {
  Id: number;
  name?: string | null;
  name2?: string | null;
  email?: string | null;
  role?: string | null;
  team?: string | null;
  sf_account_id?: string | null;
  intercom_admin_id?: string | null;
  default_home_scope?: string | null;
  preferred_summary_policy_id?: string | null;
  focus_areas?: string | null;
  is_active?: boolean | null;
  [key: string]: unknown;
}

// ── Intercom Admin ID フォールバックマッピング ────────────────────────────────
// NocoDB の intercom_admin_id カラムが未設定の場合にメールアドレスで引く。
// Intercom 管理画面 GET /admins で取得した値（2026-04-27 時点）。

const INTERCOM_ADMIN_ID_BY_EMAIL: Record<string, string> = {
  'ohuchi@ptmind.com':         '1322308',
  'kento.baba@ptmind.com':     '7676696',
  'ayumi.ito@ptmind.com':      '6783246',
  'kitada@ptmind.com':         '2701977',
  'shinichi.nagai@ptmind.com': '7557090',
  'cheng.chi@ptmind.com':      '7818711',
  'goro.kasahara@ptmind.com':  '7250969',
  'kubota@ptmind.com':         '1014435',
};

// ── 変換 ────────────────────────────────────────────────────────────────────

const VALID_ROLES: AppRole[] = ['admin', 'manager', 'ops', 'csm', 'viewer'];
const VALID_SCOPES = ['mine', 'team', 'all'] as const;

function toAppProfile(raw: RawStaffIdentify): AppUserProfile {
  const role: AppRole = VALID_ROLES.includes(raw.role as AppRole)
    ? (raw.role as AppRole)
    : 'csm';

  // CSM は未設定の場合「自分担当のみ」をデフォルトにする
  const csmDefaultScope: 'mine' | 'team' | 'all' = role === 'csm' ? 'mine' : 'all';
  const scope: 'mine' | 'team' | 'all' = VALID_SCOPES.includes(
    raw.default_home_scope as 'mine' | 'team' | 'all',
  )
    ? (raw.default_home_scope as 'mine' | 'team' | 'all')
    : csmDefaultScope;

  let focusAreas: string[] = [];
  if (raw.focus_areas) {
    try { focusAreas = JSON.parse(raw.focus_areas); } catch { /* ignore */ }
  }

  return {
    Id:                          raw.Id,
    name2:                       raw.name2?.trim() ?? '',
    name:                        raw.name?.trim() ?? raw.name2?.trim() ?? '',
    email:                       raw.email ?? null,
    role,
    team:                        raw.team ?? null,
    sf_account_id:               raw.sf_account_id?.trim() ?? null,
    // NocoDB カラムが設定されていない場合はメールアドレスで引く
    intercom_admin_id:           raw.intercom_admin_id
      ? String(raw.intercom_admin_id).trim()
      : (raw.email ? (INTERCOM_ADMIN_ID_BY_EMAIL[String(raw.email).toLowerCase().trim()] ?? null) : null),
    default_home_scope:          scope,
    preferred_summary_policy_id: raw.preferred_summary_policy_id ?? null,
    focus_areas:                 focusAreas,
    is_active:                   raw.is_active !== false,
  };
}

// ── 読み取り ─────────────────────────────────────────────────────────────────

/**
 * 全ユーザーを取得する（設定 UI のドロップダウン用）。
 * sort は省略（列名不一致による silent fail を避ける）。
 */
export async function fetchAllUserProfiles(): Promise<AppUserProfile[]> {
  const tableId = TABLE_IDS.staff_identify;
  if (!tableId) return [];

  const rows = await nocoFetch<RawStaffIdentify>(tableId, {
    limit: '100',
  }, false).catch(() => [] as RawStaffIdentify[]);

  return rows
    .map(toAppProfile)
    .filter(p => p.name2 !== '');
}

/**
 * name2（Cookie 保存値）でプロファイルを取得する。
 * NocoDB の eq フィルタは特殊文字や列型によって不安定なため、
 * 全件取得→JS フィルタで対応する（ユーザー数が 1-10 人程度なので問題なし）。
 */
export async function fetchUserProfileByName2(
  name2: string,
): Promise<AppUserProfile | null> {
  if (!name2) return null;
  const all = await fetchAllUserProfiles();
  return all.find(p => p.name2 === name2) ?? null;
}

// ── 書き込み ─────────────────────────────────────────────────────────────────

/** 設定可能なフィールドのみを部分更新する。role は NocoDB 管理のため除外。 */
export type UserProfilePatch = Partial<Pick<
  AppUserProfile,
  'team' | 'default_home_scope' | 'preferred_summary_policy_id' | 'focus_areas'
>>;

/**
 * プロファイルを部分更新する（設定 UI から呼び出す）。
 */
export async function updateUserProfile(
  rowId: number,
  patch: UserProfilePatch,
): Promise<void> {
  const tableId = TABLE_IDS.staff_identify;
  if (!tableId) return;

  const payload: Record<string, unknown> = {};
  if (patch.team                       !== undefined) payload.team                       = patch.team;
  if (patch.default_home_scope         !== undefined) payload.default_home_scope         = patch.default_home_scope;
  if (patch.preferred_summary_policy_id !== undefined) payload.preferred_summary_policy_id = patch.preferred_summary_policy_id;
  if (patch.focus_areas                !== undefined) payload.focus_areas                = JSON.stringify(patch.focus_areas);

  await nocoUpdate(tableId, rowId, payload);
}
