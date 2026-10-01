// ─── PtAI Pipeline: 承認者ロール（サーバー専用）──────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §1「利用者と権限」・§4-2・§9-7
//
// ═══════════════════════════════════════════════════════════════════════════
//  承認が要る操作（§4-2）:
//    - フェーズを「契約締結済み」に入れる／外す
//    - 受注済み商談の内容変更（pendingEdit）
//    - 受注済み商談の削除（pendingDelete）
//
//  ⚠ **画面側のチェックだけでは不十分**（§4-2 の注記）。
//     書き込み API でも requireApprover() / assertStageChangeAllowed() を通すこと。
// ═══════════════════════════════════════════════════════════════════════════
//
// 判定規則そのものは approver-policy.ts（Next 非依存・単体テスト済み）。

import { getCurrentUserProfile } from '@/lib/auth/session';
import { isApprover } from './approver-policy';

export {
  DEFAULT_APPROVER_NAME2, approverName2List, approverEmailList, isApprover,
} from './approver-policy';

export interface PtaiIdentity {
  /** staff_identify.name2。feed の by や操作記録の actor に入る */
  id:         string;
  name:       string;
  email:      string | null;
  /** 承認者かどうか。原本の `IS_APPROVER` に相当 */
  isApprover: boolean;
}

/** ログイン中の利用者の識別情報。未ログインなら null */
export async function getPtaiIdentity(): Promise<PtaiIdentity | null> {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;
  return {
    id:         profile.name2,
    name:       profile.name || profile.name2,
    email:      profile.email ?? null,
    isApprover: isApprover(profile.name2, profile.email),
  };
}

export type ApproverGateResult =
  | { ok: true;  identity: PtaiIdentity }
  | { ok: false; status: 401 | 403; error: string };

/** 承認が要る操作の前に必ず通す */
export async function requireApprover(): Promise<ApproverGateResult> {
  const identity = await getPtaiIdentity();
  if (!identity) return { ok: false, status: 401, error: 'unauthenticated' };
  if (!identity.isApprover) return { ok: false, status: 403, error: 'approver_required' };
  return { ok: true, identity };
}
