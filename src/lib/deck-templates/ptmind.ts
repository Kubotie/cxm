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

- **three_column** — 「課題 / 解決策 / 期待効果」「3つの価値」「比較」などに。columns に3要素を設定
- **kpi_grid** — 成果数値・KPIレビューに。kpis にラベル+数値（+変化量）を最大6件設定
- **before_after** — 「導入前 vs 導入後」「課題 vs 改善後」に。before_*/after_*/arrow_keywords を設定
- **timeline** — 導入プロセス・ロードマップ・施策フローに。phases で各フェーズ（期間+活動）を設定
- **next_steps** — アクションプラン・提案の締めくくりに。steps に3段階（時期+タイトル+アクション）設定
- **exec_summary** — 報告資料冒頭の全体まとめに。achievement/challenge/next_move を各1-3項目設定

### 数値・データの扱い
- KPI数字は大きく、単位は小さく（CVR 28%のような強調）
- 定量成果は必ず含める
- 具体的な固有名詞（会社名・製品名・施策名）は積極的に使う

### 箇条書きのルール（bullets レイアウト使用時）
- 1項目あたり15-25字程度
- 最大5項目/スライド
- 抽象的な表現より具体的な数字・事実を優先`,
};
