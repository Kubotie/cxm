// ─── PtAI Pipeline: 操作者・担当者の名寄せ（サーバー専用）────────────────────
//
// 2026-10-01 の判断: **メンバーごとの Twenty API キーは発行しない。**
//
// ═══════════════════════════════════════════════════════════════════════════
//  Twenty の `createdBy` / `updatedBy` は ACTOR 型で、API キー認証だと
//  **キーに付けた名前**が入り、`workspaceMemberId` は null になる（実測）。
//  つまりキーを人数ぶん配っても「名前の文字列」が変わるだけで、
//  Twenty の人物レコードには繋がらない。しかも配るのは Admin キーなので
//  全員が本番 CRM を壊せるようになり、むしろ危ない。
//
//  代わりに **CXM のログイン（HMAC 署名付き Cookie）で本人を特定**し、
//    - 作成時: `createdBy` に workspaceMemberId を明示して本人へ紐付ける
//    - 更新時: `updatedByName2`（自前の列）に name2 を残す
//  とする。`updatedBy` は Twenty が必ず上書きするので使えない（実測）。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 名簿が 3 つあって、どれも一致しない ──────────────────────────────────────
//   ダッシュボード    : Paul / Eri / Baba / Ava / Utty / Kubotie …
//   staff_identify    : Paul / Eri Kitada / BB / Omori Aoi / Utty / Kubotie …
//   Twenty member     : Shinichi(Paul) Nagai / 北田 恵理 / Ava Omori / 大内 諒大 …
//
//   表記では繋がらないので **メールアドレスで突き合わせる**（実測 5/11 一致）。
//   ダッシュボード表記 ⇄ staff_identify 表記だけ、下の別名表で吸収する。
//
// ⚠ staff_identify は共通認証のテーブル。**読むだけ。書かない。**

import { fetchAllUserProfiles, type AppUserProfile } from '@/lib/nocodb/user-profile';
import { listRecords as listTwentyRecords } from '@/lib/twenty/client';
import { createdByPayload, type WriteActor } from './twenty-test/client';

// createdBy の組み立ては twenty-test/client.ts に 1 つだけ置く。ここは窓口
export { createdByPayload };

/**
 * staff_identify の name2 → ダッシュボードの name2。
 *
 * 根拠:
 *   'Eri Kitada' / 'BB' … notion/schema.ts の OWNER_FROM_NOTION が同じ対応を持つ
 *   'Omori Aoi'         … Twenty 側の本人が 'Ava Omori'、目標DBの行が 'Ava'
 * ここに無い人は表記が一致しているとみなす（Paul / Utty / Kubotie など）。
 */
export const STAFF_NAME2_TO_PTAI: Record<string, string> = {
  'Eri Kitada': 'Eri',
  'BB':         'Baba',
  'Omori Aoi':  'Ava',
};

export const PTAI_NAME2_TO_STAFF: Record<string, string> =
  Object.fromEntries(Object.entries(STAFF_NAME2_TO_PTAI).map(([s, p]) => [p, s]));

/** ダッシュボード表記に寄せる */
export function toPtaiName2(name2: string): string {
  const k = (name2 ?? '').trim();
  return STAFF_NAME2_TO_PTAI[k] ?? k;
}

/** staff_identify の表記に寄せる */
export function toStaffName2(name2: string): string {
  const k = (name2 ?? '').trim();
  return PTAI_NAME2_TO_STAFF[k] ?? k;
}

export interface PtaiStaff {
  /** ダッシュボード表記。商談の `owner` や操作記録に入れるのはこれ */
  name2:      string;
  /** staff_identify の表記（別名があるとき name2 と違う） */
  staffName2: string;
  /** 日本語の表示名 */
  displayName: string;
  email:      string | null;
  role:       string | null;
  /** Salesforce の担当者 ID。**Salesforce 連携の突き合わせ鍵**（いまは保持だけ） */
  sfAccountId: string | null;
  /** Twenty の本人レコード。無い人は null（Twenty に席が無い） */
  workspaceMemberId: string | null;
  /** Twenty 側の表示名。突き合わせ結果の確認用 */
  twentyName: string | null;
}

// ── 名簿の取得（どちらも読み取り専用。5 分だけ覚える）──────────────────────

const CACHE_MS = 5 * 60_000;
let cache: { at: number; rows: PtaiStaff[] } | null = null;

interface WorkspaceMemberLite {
  id: string;
  email: string;
  name: string;
}

async function listWorkspaceMembers(): Promise<WorkspaceMemberLite[]> {
  try {
    const rows = await listTwentyRecords('workspaceMembers', { pageSize: 100 });
    return rows.map(r => {
      const n = (r.name ?? {}) as { firstName?: unknown; lastName?: unknown };
      return {
        id:    String(r.id ?? ''),
        email: String(r.userEmail ?? '').toLowerCase().trim(),
        name:  [n.firstName, n.lastName].filter(x => typeof x === 'string' && x).join(' ').trim(),
      };
    }).filter(m => m.id);
  } catch {
    // Twenty が落ちていても name2 だけは解決できるようにする
    return [];
  }
}

function merge(profiles: AppUserProfile[], members: WorkspaceMemberLite[]): PtaiStaff[] {
  const byEmail = new Map(members.filter(m => m.email).map(m => [m.email, m]));
  return profiles
    .filter(p => p.name2 && p.is_active !== false)
    .map(p => {
      const email = (p.email ?? '').toLowerCase().trim() || null;
      const wm = email ? byEmail.get(email) ?? null : null;
      return {
        name2:       toPtaiName2(p.name2),
        staffName2:  p.name2,
        displayName: p.name || p.name2,
        email,
        role:        p.role ?? null,
        sfAccountId: p.sf_account_id ?? null,
        workspaceMemberId: wm?.id ?? null,
        twentyName:  wm?.name ?? null,
      };
    });
}

/** 名寄せ済みの名簿。失敗しても空配列を返して保存は止めない */
export async function listPtaiStaff(): Promise<PtaiStaff[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const [profiles, members] = await Promise.all([
    fetchAllUserProfiles().catch(() => [] as AppUserProfile[]),
    listWorkspaceMembers(),
  ]);
  const rows = merge(profiles, members);
  cache = { at: Date.now(), rows };
  return rows;
}

export function invalidateStaffCache(): void {
  cache = null;
}

/** どちらの表記でも引ける。見つからなければ null */
export async function resolveStaff(name2: string): Promise<PtaiStaff | null> {
  const key = toPtaiName2(name2);
  if (!key) return null;
  const rows = await listPtaiStaff();
  return rows.find(r => r.name2 === key) ?? null;
}

// ── Twenty へ渡す「誰が」────────────────────────────────────────────────────

/**
 * `createdBy` / `updatedByName2` に載せる操作者。
 *
 * `workspaceMemberId` が取れた人だけ Twenty の人物レコードに紐付く。
 * 取れない人（Twenty に席が無い）は名前の文字列だけ残る。
 */
export interface ActorStamp extends WriteActor {
  name2:       string;
  displayName: string;
  workspaceMemberId: string | null;
}

export async function actorStampFor(name2: string, fallbackName?: string): Promise<ActorStamp> {
  const s = await resolveStaff(name2).catch(() => null);
  const key = toPtaiName2(name2);
  return {
    name2:       s?.name2 ?? key,
    displayName: s?.displayName ?? fallbackName ?? key,
    workspaceMemberId: s?.workspaceMemberId ?? null,
  };
}

