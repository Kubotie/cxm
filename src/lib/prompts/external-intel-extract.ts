// ─── 外部WHO情報の構造化プロンプト ───────────────────────────────────────────
//
// 貼り付けたテキスト（IR 資料の抜粋・プレスリリース・求人票・ニュース）から、
// 提案判断に使える外部シグナルを抽出して signal_id に変換する。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11
//
// 重要な制約:
//   - **原文にない事実を作らない**。excerpt は必ず原文からの引用にする
//   - 該当がなければ空配列を返す（無理に抽出しない）
//   - 日付が読み取れない場合は null。推測で埋めない（鮮度判定が壊れるため）
//
// このファイルはサーバーサイド専用の API route からのみ import すること。

export interface ExtractedIntelItem {
  signal_id:   string;
  headline:    string;
  excerpt:     string;
  occurred_at: string | null;
  confidence:  number;
}

export interface ExternalIntelExtractResult {
  items: ExtractedIntelItem[];
  /** 抽出できなかった場合の理由（items が空のときのみ意味を持つ） */
  note:  string;
}

/**
 * OpenRouter(Claude) の tool calling で構造化出力を強制する。
 * 既存の ACTION_PLAN_TOOL と同じ形式に揃えてある。
 */
export const EXTERNAL_INTEL_TOOL = {
  type: 'function' as const,
  function: {
    name: 'extract_external_intel',
    description: '外部で公開された情報から、提案判断に使える事象（外部シグナル）を抽出する',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '抽出した外部シグナル。該当がなければ空配列',
          items: {
            type: 'object',
            properties: {
              signal_id: {
                type: 'string',
                enum: [
                  'X5_Mkt_DXInvestment',
                  'X6_Org_NewTeamFormed',
                  'X7_Org_ExecChange',
                  'X8_Org_HiringSurge',
                  'X9_Mkt_CompetitorAdoption',
                  'X10_Mkt_StrategyShift',
                ],
                description: 'この事象がどのシグナルに当たるか',
              },
              headline: {
                type: 'string',
                description: '何が起きたかを1行で。40字以内。数値や固有名詞があれば含める',
              },
              excerpt: {
                type: 'string',
                description: '根拠となる原文からの引用。必ず原文の文言をそのまま使う（要約しない）',
              },
              occurred_at: {
                type: ['string', 'null'],
                description: '事象の日付 "YYYY-MM-DD"。原文から読み取れない場合は null（推測しない）',
              },
              confidence: {
                type: 'number',
                description: '0-1。原文に明記されていれば 0.9、示唆に留まるなら 0.5 程度',
              },
            },
            required: ['signal_id', 'headline', 'excerpt', 'occurred_at', 'confidence'],
          },
        },
        note: {
          type: 'string',
          description: '抽出できなかった場合の理由。抽出できた場合は空文字',
        },
      },
      required: ['items', 'note'],
    },
  },
} as const;

export const EXTERNAL_INTEL_SYSTEM_PROMPT = `あなたは BtoB SaaS のカスタマーサクセス担当を支援するアナリストです。
顧客企業について外部で公開された情報から、「今この顧客に提案する理由になる事象」だけを抽出します。

## 抽出対象のシグナル

- X5_Mkt_DXInvestment: DX / AI / デジタルへの投資方針・予算が明示された（中期経営計画、決算説明、IR）
- X6_Org_NewTeamFormed: 新部署・専任チーム・新規サイト・新サービスが立ち上がった
- X7_Org_ExecChange: 担当役員・部門長・キーパーソンが交代した
- X8_Org_HiringSurge: データ／マーケティング／DX 関連職種の求人・増員が出ている
- X9_Mkt_CompetitorAdoption: 競合ツールの導入・比較検討が公表された
- X10_Mkt_StrategyShift: 注力領域や事業方針が転換した

## 厳守すること

1. **原文にない事実を作らない。** headline は原文の内容の範囲で書く。
2. **excerpt は原文からの引用にする。** 要約・言い換えをしない。原文の該当箇所をそのまま切り出す。
3. **日付を推測しない。** 原文から読み取れない場合は occurred_at を null にする。
4. **無理に抽出しない。** 該当する事象がなければ items を空配列にし、note に理由を書く。
   関係のない企業情報（沿革、製品一覧、一般的な業界説明）はシグナルではない。
5. 1つの事象は1件にまとめる。同じ内容を複数のシグナルに重複計上しない。
   ただし本質的に2つの意味を持つ場合（例: DX投資の発表と同時に専任組織を新設）は分けてよい。

## 出力

指定された JSON スキーマに従って出力してください。`;

export function buildExternalIntelUserPrompt(input: {
  companyName: string;
  sourceLabel: string;
  text: string;
}): string {
  return `## 対象企業
${input.companyName}

## 情報源
${input.sourceLabel}

## 本文
${input.text}`;
}
