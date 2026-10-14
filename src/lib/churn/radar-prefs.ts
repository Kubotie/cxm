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
const TIER_KEY  = 'cxm.radar.tierFilter';

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

// ── Tier フィルタ ─────────────────────────────────────────────────────────────
//
// Tier3 を監視対象に入れた（2026-10-14）。**Tier3 は低接触が通常運用**なので
// 接触空白（B1/B2）がほぼ全社で立ち、critical が倍増する。
// 「今週やる」を Tier1–2 の意味で見たい日と、Tier3 まで見る日が分かれるので、
// どちらで見ていたかを端末に覚えさせる。

/** "all" または Tier 番号（"1" | "2" | "3" | "none"）。複数は "," 区切り */
export type TierFilter = string;

export function readTierFilter(): TierFilter {
  if (typeof window === 'undefined') return 'all';
  try {
    return window.localStorage.getItem(TIER_KEY) || 'all';
  } catch {
    return 'all';
  }
}

export function writeTierFilter(value: TierFilter): void {
  if (typeof window === 'undefined') return;
  try {
    if (!value || value === 'all') window.localStorage.removeItem(TIER_KEY);
    else window.localStorage.setItem(TIER_KEY, value);
  } catch {
    // 使えない環境では保持しないだけ。画面は動く
  }
}
