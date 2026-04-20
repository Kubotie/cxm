// ─── Dialog / Sheet 共通レイアウト定数 ────────────────────────────────────────
//
// CXMツール全体で Dialog / Sheet のレイアウトを統一するための class 定数。
//
// ルール:
//   Dialog:
//     content  → flex flex-col max-h-[90vh] overflow-hidden
//     header   → flex-shrink-0
//     body     → flex-1 min-h-0  （ScrollArea に適用）
//     footer   → flex-shrink-0 border-t pt-3
//
//   Sheet:
//     content  → flex flex-col overflow-hidden
//     header   → flex-shrink-0
//     body     → flex-1 min-h-0  （ScrollArea に適用）
//     footer   → flex-shrink-0 border-t pt-3
//
// なぜ overflow-hidden が必要か:
//   max-h-[90vh] は flex コンテナ自身の高さを制限するが、
//   overflow-hidden がないと子要素がはみ出してクリップされない。
//
// なぜ min-h-0 が必要か:
//   flex アイテムはデフォルトで min-h が auto になるため、
//   コンテンツが多いと flex-1 でも縮まらない。min-h-0 で強制的に縮小可能にする。

// ── Dialog ────────────────────────────────────────────────────────────────────

export const DIALOG_CONTENT = {
  sm:  'sm:max-w-[400px] flex flex-col max-h-[90vh] overflow-hidden',
  md:  'sm:max-w-[480px] flex flex-col max-h-[90vh] overflow-hidden',
  lg:  'sm:max-w-[600px] flex flex-col max-h-[90vh] overflow-hidden',
  xl:  'max-w-2xl flex flex-col max-h-[90vh] overflow-hidden',
} as const;

// ── Sheet ─────────────────────────────────────────────────────────────────────

export const SHEET_CONTENT = {
  sm:  'w-[400px] sm:max-w-[400px] flex flex-col overflow-hidden',
  md:  'w-[480px] sm:max-w-[480px] flex flex-col overflow-hidden',
  lg:  'w-[520px] sm:max-w-[520px] flex flex-col overflow-hidden',
  xl:  'w-[600px] sm:max-w-[600px] flex flex-col overflow-hidden',
  xxl: 'w-[700px] sm:max-w-[700px] flex flex-col overflow-hidden',
} as const;

// ── 共通スロット ──────────────────────────────────────────────────────────────

/** Dialog/Sheet ヘッダー（常に画面上部に固定） */
export const LAYOUT_HEADER = 'flex-shrink-0';

/** Dialog/Sheet ボディ（ここだけがスクロールする） */
export const LAYOUT_BODY = 'flex-1 min-h-0';

/** Dialog/Sheet フッター（常に画面下部に固定） */
export const LAYOUT_FOOTER = 'flex-shrink-0 border-t pt-3';
