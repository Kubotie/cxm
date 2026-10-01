// ═══════════════════════════════════════════════════════════════════════════
//  🔄 **【2026-09-30】方針変更中 — このファイルの前提は保留**
//
//  「Twenty へ全面集約」は保留になった。現在の方針は
//  「短期は PtAI Pipeline 専用の NocoDB を使い、Twenty は機能ごとに実測して
//   利用可否を判定し、使える機能だけ段階的に採用する」。
//
//  実測（2026-09-30）で読み取り元にできると判定できたのは
//  **企業マスタ・PtAI 担当・議事録本文の 3 つだけ**。商談・組織図・入力系は
//  Twenty 側のデータが空または紐付かないため、短期は Pipeline の NocoDB が正本。
//
//  正本の設計は docs/ptai-pipeline-data-strategy.md。
//  下記の `sourceOfTruth` と移行前提の記述は、その判定に合わせて改訂予定。
// ═══════════════════════════════════════════════════════════════════════════

// ─── **PtAI Pipeline** のデータ取得元を切り替える Feature Flag ───────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **適用範囲は PtAI Pipeline（/ptai-pipeline と /api/ptai/**）だけ。**
//  CXM のデータ取得には一切関与しない。CXM は引き続き NocoDB を利用する。
//
//  **移行期間専用のフラグ。** 恒久的な二重正本にしないこと。
//
//  最終形は `twenty` 一本。Phase 2D で `legacy_nocodb` の分岐ごと削除し、
//  このファイルも消す。それまでの間、Preview で Twenty 読み取りを試し、
//  旧画面と表示を比べるためだけに使う。
// ═══════════════════════════════════════════════════════════════════════════
//
//   PTAI_DATA_SOURCE=legacy_nocodb   Pipeline の pga_docs/_raw を返す（**現在の既定**）
//   PTAI_DATA_SOURCE=twenty          Twenty から取得して RAW 互換に変換して返す（目標設計）
//
// `legacy_nocodb` は移植過程で作られた互換実装であって、目標設計ではない。
// 既定を変えるのは Phase 2B の比較が済んでから。今回は切り替えない。

export type PtaiDataSource = 'legacy_nocodb' | 'twenty';

/** 移行が終わるまでの既定。**勝手に変えないこと** */
const DEFAULT_SOURCE: PtaiDataSource = 'legacy_nocodb';

export function getPtaiDataSource(): PtaiDataSource {
  const v = (process.env.PTAI_DATA_SOURCE ?? '').trim();
  return v === 'twenty' ? 'twenty' : DEFAULT_SOURCE;
}

/** 診断表示用。値そのものは秘密ではない */
export function describePtaiDataSource(): { source: PtaiDataSource; isDefault: boolean } {
  const source = getPtaiDataSource();
  return { source, isDefault: source === DEFAULT_SOURCE };
}
