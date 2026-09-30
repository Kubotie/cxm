// ─── DELETE /api/user/session ────────────────────────────────────────────────
// Cookie を削除してセッションをクリアする（/api/auth/logout と同じ結果）。
//
// ── 2026-09-30 セキュリティ是正 ──────────────────────────────────────────────
//   **認証なしで Cookie を発行していた POST を廃止した。DELETE はセッション削除用として存続。**
//   旧 `POST { name2 }` はパスワード照合なしに任意ユーザーの Cookie を発行でき、
//   middleware が /api/* を素通ししていたため未認証で到達できた。
//   画面からの参照も無かった（grep 済み）ため、POST ハンドラのみ取り除いた。
//   ユーザー切り替えが必要になったら、admin 限定の「代理ログイン」として
//   監査ログ付きで作り直すこと。

import { NextResponse } from 'next/server';
import { buildClearSessionCookieHeader, buildClearLegacyCookieHeaders } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', buildClearSessionCookieHeader());
  for (const clear of buildClearLegacyCookieHeaders()) res.headers.append('Set-Cookie', clear);
  return res;
}
