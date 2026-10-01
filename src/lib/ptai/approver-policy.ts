// ─── PtAI Pipeline: 承認者ロールの判定（依存なし）──────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §1「利用者と権限」・§9-7
//
// ═══════════════════════════════════════════════════════════════════════════
//  §9-7 の回答（2026-10-01）: **固定ではなくロールにする。Utty と Kubotie を管理者。**
// ═══════════════════════════════════════════════════════════════════════════
//
// **Next.js にも DB にも依存しない。** リクエストに紐づく処理は approver.ts。
// 分けてあるのは、判定規則を単体テストできるようにするため。

/**
 * 既定の承認者（staff_identify.name2）。
 * 公開リポジトリなので、ここに個人のメールアドレスは書かない。
 * 増減は `PGA_APPROVER_NAME2`（カンマ区切り）で上書きできる。
 */
export const DEFAULT_APPROVER_NAME2: readonly string[] = ['Utty', 'Kubotie'];

/** name2 で指定された承認者。未設定なら既定 */
export function approverName2List(): string[] {
  const raw = (process.env.PGA_APPROVER_NAME2 ?? '').trim();
  if (!raw) return [...DEFAULT_APPROVER_NAME2];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

/** メールで指定された承認者。指定があればこちらを優先する */
export function approverEmailList(): string[] {
  return (process.env.PGA_APPROVER_EMAILS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** name2 とメールから承認者かを判定する。判定規則を 1 か所に閉じる */
export function isApprover(
  name2: string | null | undefined, email: string | null | undefined,
): boolean {
  const emails = approverEmailList();
  if (emails.length) {
    const e = (email ?? '').toLowerCase();
    return Boolean(e) && emails.includes(e);
  }
  const n = (name2 ?? '').trim();
  return Boolean(n) && approverName2List().includes(n);
}
