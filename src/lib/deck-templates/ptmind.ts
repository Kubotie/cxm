// ─── PTmind デッキテンプレート（内蔵デフォルト）──────────────────────────────
// /Users/kubotie/Downloads/ptmind-deck の brand-tokens.json + SKILL.md から生成。
// 株式会社ピーティーマインドのブランドガイドライン準拠。

import type { DeckTemplate } from './types';

export const PTMIND_DECK_TEMPLATE: DeckTemplate = {
  id: 'ptmind-deck',
  layout_engine: 'ptmind-deck',
  name: 'Ptmind デック',
  description: 'PTmindブランド準拠（Lime #C8F050 / Black #101C1F）。提案資料・CS伴走レポートに最適。',
  is_builtin: true,
  brand_tokens: {
    colors: {
      primary:     '101C1F',   // Black B900 — タイトルバー・濃背景
      accent:      'C8F050',   // Lime G400 — アクセント・ハイライト
      bg:          'FFFFFF',   // White — 本文スライド背景
      bg_section:  'F4F6F3',   // セクション背景
      text_on_dark: 'FFFFFF',
      text_body:   '101C1F',
      text_muted:  '5A6568',
    },
    fonts: {
      primary:   'Noto Sans JP',
      secondary: 'Open Sans',
    },
  },
  prompt_guidance: `## PTmindブランド スライド生成ルール

### トーン
- 見出しは体言止め or 短い動詞止め（「顧客理解を深める」「データで判断を軽くする」）
- 本文は1-2文/スライドが目安。3文を超えたら分割を検討
- Confident, not arrogant（自信はあるが傲慢でない）
- 「〜させていただきます」「〜いただきたく存じます」はスライドに書かない

### 構成
- 表紙スライド（タイトル + 対象会社名 + 日付）
- 目次またはアジェンダ（5-6項目）
- 本編スライド（課題→解決→効果のフローを意識）
- クロージング（まとめ + 次のアクション）
- 全体で8-15枚が標準

### レイアウト選択（必ずコンテンツに合わせて選ぶ）
bullets（箇条書き）ばかりにしないこと。以下を積極的に使う：

**基本レイアウト**
- **three_column** — 「課題 / 解決策 / 期待効果」「3つの価値」「比較」などに。columns に3要素を設定
- **kpi_grid** — 成果数値・KPIレビューに。kpis にラベル+数値（+変化量）を最大6件設定
- **before_after** — 「導入前 vs 導入後」「課題 vs 改善後」に。before_*/after_*/arrow_keywords を設定
- **timeline** — 導入プロセス・ロードマップ・施策フローに。phases で各フェーズ（期間+活動）を設定
- **next_steps** — アクションプラン・提案の締めくくりに。steps に3段階（時期+タイトル+アクション）設定
- **exec_summary** — 報告資料冒頭の全体まとめに。achievement/challenge/next_move を各1-3項目設定
- **four_grid** — 「4つの課題・特徴・提供価値」に。cards（最大4件）に number/title/body/color を設定
- **formula_flow** — 成果ドライバーを「A×B×C」形式で可視化。variables に変数を設定
- **decomposition_grid** — 変数ごとの式と現状説明（最大6件）。cells に label/formula/body を設定

**表・比較系レイアウト**
- **risk_countermeasure** — リスク一覧。左列=リスクID/名称（紫）、中列=なぜ起きるか、右列=対策（緑）。risk_rows に { id, label, why, countermeasure } を設定
- **track_comparison** — 2〜4列の属性比較表（各オプション/プランを横に並べる）。tracks に { label, color, rows:[{key,value}] } を設定。color は lime/forest/orange/black から選択
- **phase_progression** — Phase1 → Phase2 の移行を大きい矢印で可視化。phase1/phase2 に { label, items } を設定、trigger に移行条件を記述
- **mobility_table** — 「◯◯から△△へ」行形式の移行表。各行: from（左ボックス）→ 矢印 → to（右ボックス）+ 説明。mobility_rows に { from, to, description } を設定
- **ng_ok_comparison** — 左に NG（薄赤地）、右に OK（濃緑地）の2カラム対比。底部の statement に結論1行を設定。ng_items/ok_items に各5項目以内で設定
- **function_table** — 役割×レベルのマトリクス表。func_columns に列ヘッダー、func_rows に { role, cells } を設定。役割列は緑背景で自動着色

### 数値・データの扱い
- KPI数字は大きく、単位は小さく（CVR 28%のような強調）
- 定量成果は必ず含める
- 具体的な固有名詞（会社名・製品名・施策名）は積極的に使う

### 箇条書きのルール（bullets レイアウト使用時）
- 1項目あたり15-25字程度
- 最大5項目/スライド
- 抽象的な表現より具体的な数字・事実を優先`,
};
