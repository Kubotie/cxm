// ─── Route Handler 用の認証・認可ヘルパー ─────────────────────────────────────
//
// middleware は「ログインしているか」までしか見ない。
// 「その操作をしてよいか」は必ずここを通してハンドラ側で判定する
// （middleware だけに頼らない＝多層防御）。
//
// 使い方:
//   export async function POST(req: NextRequest) {
//     const gate = await requireAdmin();
//     if (!gate.ok) return gate.response;
//     const { profile } = gate;   // 検証済みのプロファイル
//     ...
//   }
//
// ロールは **Cookie の自己申告値ではなく staff_identify から引く**。
// 旧 `cxm_user_role` Cookie は廃止した（session.ts 参照）。

import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import type { AppRole } from '@/lib/auth/role';
import type { AppUserProfile } from '@/lib/nocodb/user-profile';
import { checkBatchAuth, checkCronOrBatchAuth } from '@/lib/batch/auth';

/**
 * 拒否レスポンスの型。
 * 呼び出し元のハンドラは `Promise<NextResponse<SomeType>>` を返すと宣言していることが多い。
 * `NextResponse<never>` にしておけば、どの戻り値型のハンドラからでもそのまま return できる。
 */
type DenyResponse = NextResponse<never>;

/**
 * 判定結果。
 * tsconfig が strict:false（strictNullChecks 無効）なので判別共用体の絞り込みが効かない。
 * 両メンバーに両方のプロパティを宣言して `gate.response` を読めるようにする。
 */
export type Gate =
  | { ok: true;  profile: AppUserProfile; response?: undefined }
  | { ok: false; profile?: undefined;     response: DenyResponse };

function unauthorized(): Gate {
  return {
    ok: false,
    response: NextResponse.json({ error: 'unauthenticated', message: 'ログインが必要です' }, { status: 401 }) as DenyResponse,
  };
}

function forbidden(required: readonly AppRole[]): Gate {
  return {
    ok: false,
    response: NextResponse.json(
      { error: 'forbidden', message: 'この操作の権限がありません', required },
      { status: 403 },
    ) as DenyResponse,
  };
}

// ── 認証 ─────────────────────────────────────────────────────────────────────

/** ログイン済みであることだけを要求する */
export async function requireUser(): Promise<Gate> {
  const profile = await getCurrentUserProfile();
  if (!profile) return unauthorized();
  return { ok: true, profile };
}

// ── 認可 ─────────────────────────────────────────────────────────────────────

/** 指定ロールのいずれかであることを要求する */
export async function requireRole(...roles: AppRole[]): Promise<Gate> {
  const gate = await requireUser();
  if (!gate.ok) return gate;
  if (!roles.includes(gate.profile.role)) return forbidden(roles);
  return gate;
}

/** admin のみ */
export function requireAdmin(): Promise<Gate> {
  return requireRole('admin');
}

/** admin または ops。運用系エンドポイントの既定 */
export function requireOpsOrAdmin(): Promise<Gate> {
  return requireRole('admin', 'ops');
}

/** admin / ops / manager。閲覧寄りの運用画面 */
export function requireManagerOrAbove(): Promise<Gate> {
  return requireRole('admin', 'ops', 'manager');
}

// ── バッチ系（外部トークン or 画面からの操作）────────────────────────────────

/**
 * 外部バッチ（DolphinScheduler / curl）と、ops 画面のボタンの両方から
 * 呼ばれるエンドポイント向け。
 *
 *   1. Authorization: Bearer <SUPPORT_BATCH_SECRET> が正しければ通す
 *   2. そうでなければ admin / ops のセッションを要求する
 *
 * これにより、ブラウザへバッチシークレットを渡さずに済む
 * （旧実装は NEXT_PUBLIC_SUPPORT_BATCH_SECRET をバンドルに埋めていた）。
 */
export async function requireBatchTokenOrOps(req: NextRequest): Promise<Gate> {
  if (req.headers.get('Authorization')) {
    const denied = checkBatchAuth(req);
    if (denied) return { ok: false, response: denied as DenyResponse };
    return { ok: true, profile: BATCH_PSEUDO_PROFILE };
  }
  return requireOpsOrAdmin();
}

/**
 * Vercel Cron / 外部バッチ / ops 画面の 3 経路から呼ばれるエンドポイント向け。
 * Authorization があれば CRON_SECRET か SUPPORT_BATCH_SECRET を照合し、
 * 無ければ admin / ops のセッションを要求する。
 */
export async function requireCronTokenOrOps(req: NextRequest): Promise<Gate> {
  if (req.headers.get('Authorization')) {
    const denied = checkCronOrBatchAuth(req);
    if (denied) return { ok: false, response: denied as DenyResponse };
    return { ok: true, profile: BATCH_PSEUDO_PROFILE };
  }
  return requireOpsOrAdmin();
}

/**
 * トークン認証で通過したときの擬似プロファイル。
 * 「人ではない実行者」を表すだけで、staff_identify には存在しない。
 */
const BATCH_PSEUDO_PROFILE: AppUserProfile = {
  name2: 'batch',
  name:  'バッチ実行',
  role:  'ops',
  default_home_scope: 'all',
};
