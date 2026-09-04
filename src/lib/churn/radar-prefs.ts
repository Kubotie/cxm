"use client";

// ─── 解約レーダー：画面をまたいで保つ設定 ─────────────────────────────────────
//
// 担当フィルタは**画面を移動しても保つ**。レーダーで自分の担当に絞ったのに、
// 言質レビューへ移ると全体に戻る、では毎回選び直すことになる。
//
// localStorage に置く理由:
//   - 週次のトリアージは同じ担当で通しで見る作業なので、セッションをまたいでも残ってよい
//   - サーバーに持たせるほどの設定ではない（端末ごとに違ってよい）
//
// ⚠️ プライベートウィンドウなどで localStorage が使えないことがある。
//   読み書きは必ず try/catch し、失敗したら既定値で動く。

const OWNER_KEY = 'cxm.radar.ownerFilter';

/** "all" または担当者名（staff_identify の name2） */
export type OwnerFilter = string;

export function readOwnerFilter(): OwnerFilter {
  if (typeof window === 'undefined') return 'all';
  try {
    return window.localStorage.getItem(OWNER_KEY) || 'all';
  } catch {
    return 'all';
  }
}

export function writeOwnerFilter(value: OwnerFilter): void {
  if (typeof window === 'undefined') return;
  try {
    if (!value || value === 'all') window.localStorage.removeItem(OWNER_KEY);
    else window.localStorage.setItem(OWNER_KEY, value);
  } catch {
    // 使えない環境では保持しないだけ。画面は動く
  }
}
