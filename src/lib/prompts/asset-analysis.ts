// ─── MDアセット分析プロンプト（Claude API 用）─────────────────────────────────
// アップロードされたMDファイルの自動カテゴリ分類 + AI検索用サマリー生成に使用。
// Anthropic tool_use 形式で構造化出力を取得する。

export type AssetCategory = '事例' | 'AI計画' | 'アカウントプランニング' | 'ノウハウ・マニュアル' | 'その他';

export const ASSET_CATEGORIES: AssetCategory[] = [
  '事例',
  'AI計画',
  'アカウントプランニング',
  'ノウハウ・マニュアル',
  'その他',
];

export interface AssetAnalysisResult {
  /** 事例 / AI計画 / アカウントプランニング / ノウハウ・マニュアル / その他 */
  category: AssetCategory;
  /** 分類した根拠（1〜2文） */
  category_reason: string;
  /** AI検索用サマリー（200字以内）。検索ヒット率を最大化するキーワードを含める */
  summary: string;
  /** ファイル名より具体的な表示タイトル（〜30字） */
  title_suggestion: string;
}

/** OpenAI function calling 形式のスキーマ（OpenRouter 経由で使用） */
export const ASSET_ANALYSIS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'analyze_asset',
    description: 'MDファイルを分析してカテゴリ分類とサマリーを生成する',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['事例', 'AI計画', 'アカウントプランニング', 'ノウハウ・マニュアル', 'その他'],
          description: '事例: 具体的な顧客事例・成功/失敗事例。AI計画: AI生成のアクションプラン。アカウントプランニング: 顧客ごとの戦略・計画資料。ノウハウ・マニュアル: 手順書・ベストプラクティス・ノウハウ集。その他: 上記に当てはまらないもの。',
        },
        category_reason: {
          type: 'string',
          description: '分類した根拠（1〜2文）',
        },
        summary: {
          type: 'string',
          description: 'AI検索用サマリー（200字以内）。主要なキーワード・会社名・手法名を含める',
        },
        title_suggestion: {
          type: 'string',
          description: '表示タイトル（30字以内）。ファイル名よりも内容を端的に表す',
        },
      },
      required: ['category', 'category_reason', 'summary', 'title_suggestion'],
    },
  },
};

export function buildAssetAnalysisPrompt(filename: string, content: string): string {
  const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n\n...(以下省略)' : content;
  return `あなたはCSM（カスタマーサクセスマネージャー）の知識資産を管理するAIです。
以下のMDファイルを分析して、analyze_asset ツールを使って結果を返してください。

## ファイル名
${filename}

## ファイル内容
${truncated}

## 分析の指針
カテゴリの判断基準:
- **事例**: 特定顧客・プロジェクトの具体的な事例（成功/失敗問わず）
- **AI計画**: AIが生成したアクションプランや提案書
- **アカウントプランニング**: 顧客ごとの中長期戦略・計画・目標設定資料
- **ノウハウ・マニュアル**: 再利用可能な手順書・ベストプラクティス・ノウハウ集
- **その他**: 上記に分類できないもの（議事録・雑多なメモなど）

summaryは将来的にAI検索で使われます。重要なキーワード（顧客名・製品名・施策・成果）を必ず含めてください`;
}
