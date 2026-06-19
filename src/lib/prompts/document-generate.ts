// ─── 資料作成プロンプト（Claude API 用）──────────────────────────────────────
// デッキテンプレートのブランドトークン + プロンプト指示を使ってスライドを生成する。

export type SlideLayout =
  | 'bullets'            // 箇条書き（本当に他が当てはまらない場合のみ）
  | 'section_divider'    // 章扉（Black背景 + Lime番号 + White見出し）
  | 'three_column'       // 3列カードレイアウト（課題→解決→効果、など）
  | 'kpi_grid'           // KPIグリッド（数値カード最大6個）
  | 'before_after'       // Before/After 比較
  | 'timeline'           // 横型タイムライン
  | 'next_steps'         // 次のステップ3段階
  | 'exec_summary'       // エグゼクティブサマリー（成果/伸びしろ/次の一手）
  | 'four_grid'          // 2×2グリッド（課題・特徴・業界比較など）
  | 'formula_flow'       // 変数式フロー（A×B×C = 成果、など）
  | 'decomposition_grid' // 変数分解グリッド（各変数の式と説明）
  | 'risk_countermeasure'// リスク＆対策表（R1/R2行 × リスク/なぜ/対策列）
  | 'track_comparison'   // トラック比較（2〜4列 × N行アトリビュート）
  | 'phase_progression'  // フェーズ移行（Phase1 → Phase2、トリガー付き）
  | 'mobility_table'     // 移行テーブル（from → to + 説明）
  | 'ng_ok_comparison'   // NG/OK比較（左薄地 + 右濃地 + 底部まとめ）
  | 'function_table';    // 機能・役割テーブル（行=役割、列=レベル/項目）

export interface ColumnItem {
  header: string;
  icon?: string;   // 絵文字アイコン（任意）
  items: string[];
}

export interface KpiItem {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  positive?: boolean;
}

export interface TimelinePhase {
  label: string;
  period?: string;
  bullets?: string[];
}

export interface NextStep {
  when: string;
  title: string;
  items: string[];
}

export interface GridCard {
  number?: string;
  title: string;
  body?: string;
  result?: string;
  result_color?: string;
  /** ヘッダー背景色: 'orange'|'lime'|'forest'|'black'|'red'|'blue' */
  color?: string;
}

export interface FormulaVariable {
  n?: string;
  label: string;
  /** ボーダー色: 'lime'|'forest'|'orange'|'red'|'black'|'blue' */
  color?: string;
}

export interface DecompositionCell {
  number?: string;
  label: string;
  formula?: string;
  body?: string;
  /** ヘッダー背景色: 'black'|'lime'|'forest'|'red'|'orange' */
  color?: string;
  is_hypothesis?: boolean;
}

export interface RiskRow {
  id?: string;
  label: string;
  why: string;
  countermeasure: string;
}

export interface TrackItem {
  key?: string;
  value: string;
}

export interface TrackColumn {
  label: string;
  /** ヘッダー色: 'lime'|'forest'|'orange'|'black'|'red'|'blue' */
  color?: string;
  rows: TrackItem[];
}

export interface MobilityRow {
  from: string;
  to: string;
  description?: string;
}

export interface FunctionTableRow {
  role: string;
  cells: string[];
}

export interface SlideContent {
  slide_number: number;
  title: string;
  eyebrow?: string;          // ヘッダーバナー内の小見出し（章名・カテゴリ）
  layout?: SlideLayout;
  content: string[];         // bullets レイアウト用（必須、他レイアウトでも fallback に使用）
  section_number?: string;   // section_divider 用（例："01"）
  // three_column
  columns?: ColumnItem[];
  // kpi_grid
  kpis?: KpiItem[];
  // before_after
  before_title?: string;
  before_items?: string[];
  after_title?: string;
  after_items?: string[];
  arrow_keywords?: string[];
  // timeline
  phases?: TimelinePhase[];
  // next_steps
  steps?: NextStep[];
  // exec_summary
  achievement?: string[];
  challenge?: string[];
  next_move?: string[];
  // four_grid
  cards?: GridCard[];
  footer?: string;
  // formula_flow
  left_title?: string;
  left_body?: string;
  variables?: FormulaVariable[];
  denominator?: FormulaVariable;
  note?: { bold: string; body?: string };
  // decomposition_grid
  cells?: DecompositionCell[];
  // risk_countermeasure
  risk_rows?: RiskRow[];
  // track_comparison
  tracks?: TrackColumn[];
  // phase_progression
  phase1?: { label: string; items?: string[] };
  trigger?: string;
  phase2?: { label: string; items?: string[] };
  // mobility_table
  mobility_rows?: MobilityRow[];
  // ng_ok_comparison
  ng_items?: string[];
  ok_items?: string[];
  statement?: string;
  // function_table
  func_columns?: string[];
  func_rows?: FunctionTableRow[];
  speaker_note?: string;
}

export interface SlideStructure {
  title: string;
  subtitle?: string;
  slides: SlideContent[];
}

/** OpenAI function calling 形式のスキーマ（OpenRouter 経由で使用） */
export const DOCUMENT_GENERATE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'generate_slides',
    description: 'MDファイルの内容をもとにプレゼンテーションのスライド構造を生成する',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'プレゼンテーション全体のタイトル（30字以内）' },
        subtitle: { type: 'string', description: 'サブタイトルまたは日付・会社名（省略可）' },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              slide_number: { type: 'number' },
              title:        { type: 'string', description: 'スライドタイトル（20字以内）' },
              eyebrow: {
                type: 'string',
                description: 'ヘッダーバナー内の小見出し（章名や文脈）。例："CS伴走の価値"、"課題の整理"。全スライドに付けると良い。',
              },
              layout: {
                type: 'string',
                enum: ['bullets', 'section_divider', 'three_column', 'kpi_grid', 'before_after', 'timeline', 'next_steps', 'exec_summary', 'four_grid', 'formula_flow', 'decomposition_grid', 'risk_countermeasure', 'track_comparison', 'phase_progression', 'mobility_table', 'ng_ok_comparison', 'function_table'],
                description: [
                  'スライドレイアウト。内容に最も合うものを選ぶ:',
                  '• section_divider: 章扉。section_numberを必ず設定',
                  '• three_column: 3要素の比較・フロー（課題/解決/効果） → columnsに3要素必須',
                  '• kpi_grid: KPI・数値成果（2〜6個） → kpisに必須',
                  '• before_after: 導入前後の比較 → before_*/after_*必須',
                  '• timeline: 導入プロセス・ロードマップ → phases必須',
                  '• next_steps: アクションプラン（3段階） → steps必須',
                  '• exec_summary: 冒頭サマリー → achievement/challenge/next_move必須',
                  '• four_grid: 2×2グリッド（業界課題・特徴・機能4点など） → cards（最大4件）必須。各cardにnumber/title/body/result/colorを設定',
                  '• formula_flow: 変数式フロー（A×B×C=成果、業績ドライバーなど） → variables必須。left_title/left_body/denominator/noteも設定',
                  '• decomposition_grid: 変数ごとの分解グリッド（各変数の式と意味） → cells必須（最大6件）。各cellにnumber/label/formula/body/colorを設定',
                  '• risk_countermeasure: リスク表（R1/R2行 × リスク名/なぜ起きるか/対策の3列） → risk_rows必須',
                  '• track_comparison: トラック比較（2〜4列 × N行の属性比較） → tracks必須。各trackにlabel/color/rows設定',
                  '• phase_progression: フェーズ移行（Phase1ボックス→矢印→Phase2ボックス） → phase1/phase2必須。triggerに移行条件',
                  '• mobility_table: 移行テーブル（from→to行、右に説明） → mobility_rows必須',
                  '• ng_ok_comparison: NG/OK対比（左薄地NG + 右濃地OK + 底部lime強調） → ng_items/ok_items必須、statementに結論',
                  '• function_table: 機能・役割テーブル（行=役割/機能、列=レベル/カテゴリ） → func_columns/func_rows必須',
                  '• bullets: 上記のどれにも当てはまらない場合のみ。多用禁止（全体の20%以内）',
                ].join('\n'),
              },
              content: {
                type: 'array',
                items: { type: 'string' },
                description: 'bullets レイアウト時の箇条書き（最大5項目）。他レイアウト使用時も summary 的に1〜3項目入れること。',
              },
              section_number: { type: 'string', description: 'section_divider レイアウト時の章番号（例："01"、"02"）' },
              columns: {
                type: 'array',
                description: 'layout=three_column の場合に必須。3要素を設定。',
                items: {
                  type: 'object',
                  properties: {
                    header: { type: 'string' },
                    icon:   { type: 'string', description: '絵文字（任意）' },
                    items:  { type: 'array', items: { type: 'string' }, description: '2〜4項目' },
                  },
                  required: ['header', 'items'],
                },
              },
              kpis: {
                type: 'array',
                description: 'layout=kpi_grid の場合に必須。2〜6件。',
                items: {
                  type: 'object',
                  properties: {
                    label:    { type: 'string' },
                    value:    { type: 'string', description: '数値文字列（例："28%"、"4,521"）' },
                    unit:     { type: 'string' },
                    delta:    { type: 'string', description: '変化量（例："+12%"）' },
                    positive: { type: 'boolean' },
                  },
                  required: ['label', 'value'],
                },
              },
              before_title:    { type: 'string' },
              before_items:    { type: 'array', items: { type: 'string' } },
              after_title:     { type: 'string' },
              after_items:     { type: 'array', items: { type: 'string' } },
              arrow_keywords:  { type: 'array', items: { type: 'string' }, description: '中央矢印に表示する変換キーワード（例：["旧来 → 刷新"]）' },
              phases: {
                type: 'array',
                description: 'layout=timeline の場合に必須。',
                items: {
                  type: 'object',
                  properties: {
                    label:   { type: 'string' },
                    period:  { type: 'string' },
                    bullets: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['label'],
                },
              },
              steps: {
                type: 'array',
                description: 'layout=next_steps の場合に必須。3要素を設定。',
                items: {
                  type: 'object',
                  properties: {
                    when:  { type: 'string', description: '時期（例："今月中"）' },
                    title: { type: 'string' },
                    items: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['when', 'title', 'items'],
                },
              },
              achievement: { type: 'array', items: { type: 'string' }, description: 'exec_summary の成果（1〜3項目）' },
              challenge:   { type: 'array', items: { type: 'string' }, description: 'exec_summary の伸びしろ（1〜3項目）' },
              next_move:   { type: 'array', items: { type: 'string' }, description: 'exec_summary の次の一手（1〜3項目）' },
              // four_grid
              cards: {
                type: 'array',
                description: 'layout=four_grid の場合に必須。最大4件。',
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'string', description: '番号（例："01"）' },
                    title:  { type: 'string' },
                    body:   { type: 'string', description: '説明文（2〜4行）' },
                    result: { type: 'string', description: '結果ライン（例："打ち手の精度が上がらない"）' },
                    result_color: { type: 'string', description: '結果テキスト色: red/orange/forest など' },
                    color:  { type: 'string', description: 'ヘッダー背景色: orange/lime/forest/black/red/blue' },
                  },
                  required: ['title'],
                },
              },
              footer: { type: 'string', description: 'four_grid の底部バナーテキスト（まとめ一言）' },
              // formula_flow
              left_title:  { type: 'string', description: 'formula_flow の左ブロック見出し（例："ブランド成長"）' },
              left_body:   { type: 'string', description: 'formula_flow の左ブロック副題（例："LTV × 顧客数"）' },
              variables: {
                type: 'array',
                description: 'layout=formula_flow の上段変数ボックス群（×でつなぐ）',
                items: {
                  type: 'object',
                  properties: {
                    n:     { type: 'string', description: '番号（例："01"）' },
                    label: { type: 'string' },
                    color: { type: 'string', description: 'ボーダー色: lime/forest/orange/red/black/blue' },
                  },
                  required: ['label'],
                },
              },
              denominator: {
                type: 'object',
                description: 'formula_flow の下段変数（分母・負の要因など）',
                properties: {
                  n:     { type: 'string' },
                  label: { type: 'string' },
                  color: { type: 'string' },
                },
                required: ['label'],
              },
              note: {
                type: 'object',
                description: 'formula_flow / decomposition_grid の底部ノートボックス',
                properties: {
                  bold: { type: 'string', description: '太字の主要メッセージ' },
                  body: { type: 'string', description: '補足テキスト（省略可）' },
                },
                required: ['bold'],
              },
              // decomposition_grid
              cells: {
                type: 'array',
                description: 'layout=decomposition_grid の場合に必須。最大6件（3列×2行）。',
                items: {
                  type: 'object',
                  properties: {
                    number:        { type: 'string', description: '番号（例："01"）' },
                    label:         { type: 'string', description: '変数名（例："認知の幅"）' },
                    formula:       { type: 'string', description: '計算式（例："リーチ数 × カテゴリ想起多様度 × ブランド連想の強度"）' },
                    body:          { type: 'string', description: '現状説明（1〜2行）' },
                    color:         { type: 'string', description: 'ヘッダー色: black/lime/forest/red/orange' },
                    is_hypothesis: { type: 'boolean', description: '仮説カード（右下固定）として表示する場合 true' },
                  },
                  required: ['label'],
                },
              },
              // risk_countermeasure
              risk_rows: {
                type: 'array',
                description: 'layout=risk_countermeasure の場合に必須。',
                items: {
                  type: 'object',
                  properties: {
                    id:              { type: 'string', description: 'リスクID（例："R1"）' },
                    label:           { type: 'string', description: 'リスク名' },
                    why:             { type: 'string', description: 'なぜ起きるか（1〜2行）' },
                    countermeasure:  { type: 'string', description: '対策（1〜2行）' },
                  },
                  required: ['label', 'why', 'countermeasure'],
                },
              },
              // track_comparison
              tracks: {
                type: 'array',
                description: 'layout=track_comparison の場合に必須。2〜4列。',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    color: { type: 'string', description: 'ヘッダー色: lime/forest/orange/black/red/blue' },
                    rows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          key:   { type: 'string', description: '行ラベル（任意）' },
                          value: { type: 'string' },
                        },
                        required: ['value'],
                      },
                    },
                  },
                  required: ['label', 'rows'],
                },
              },
              // phase_progression
              phase1: {
                type: 'object',
                description: 'layout=phase_progression の第1フェーズ',
                properties: {
                  label: { type: 'string' },
                  items: { type: 'array', items: { type: 'string' } },
                },
                required: ['label'],
              },
              trigger: { type: 'string', description: 'フェーズ移行トリガー（例："ダッシュボード完成"）' },
              phase2: {
                type: 'object',
                description: 'layout=phase_progression の第2フェーズ',
                properties: {
                  label: { type: 'string' },
                  items: { type: 'array', items: { type: 'string' } },
                },
                required: ['label'],
              },
              // mobility_table
              mobility_rows: {
                type: 'array',
                description: 'layout=mobility_table の場合に必須。',
                items: {
                  type: 'object',
                  properties: {
                    from:        { type: 'string', description: '移行元' },
                    to:          { type: 'string', description: '移行先' },
                    description: { type: 'string', description: '説明（任意）' },
                  },
                  required: ['from', 'to'],
                },
              },
              // ng_ok_comparison
              ng_items:  { type: 'array', items: { type: 'string' }, description: 'NG側の箇条書き（2〜5項目）' },
              ok_items:  { type: 'array', items: { type: 'string' }, description: 'OK側の箇条書き（2〜5項目）' },
              statement: { type: 'string', description: 'ng_ok_comparison の底部ハイライトまとめ文' },
              // function_table
              func_columns: {
                type: 'array',
                items: { type: 'string' },
                description: 'function_table の列ヘッダー（ロール列の右に並ぶ）',
              },
              func_rows: {
                type: 'array',
                description: 'function_table の行データ',
                items: {
                  type: 'object',
                  properties: {
                    role:  { type: 'string', description: '役割/機能名' },
                    cells: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['role', 'cells'],
                },
              },
              speaker_note: { type: 'string' },
            },
            required: ['slide_number', 'title', 'content'],
          },
          minItems: 3,
          maxItems: 15,
        },
      },
      required: ['title', 'slides'],
    },
  },
};

// ─── アセット深読みツール ─────────────────────────────────────────────────────

export const ASSET_EXTRACT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'extract_insights',
    description: 'アセットから資料作成に役立つ情報を構造化して抽出する',
    parameters: {
      type: 'object',
      properties: {
        headline: {
          type: 'string',
          description: 'このアセットを1行で表す最重要メッセージ（20字以内）',
        },
        key_numbers: {
          type: 'array',
          items: { type: 'string' },
          description: '数値・KPI・指標を含む情報（例："導入3ヶ月でCVR 28%改善"）。最大6件。',
        },
        case_points: {
          type: 'array',
          items: { type: 'string' },
          description: '具体的な事例・エピソード・事実（2〜5件）。スライドの bullet として使える粒度で。',
        },
        insights: {
          type: 'array',
          items: { type: 'string' },
          description: '重要な洞察・示唆・提言（2〜4件）。exec_summary や next_steps に使える内容。',
        },
        before_after: {
          type: 'object',
          description: '導入前後・改善前後の変化（あれば）',
          properties: {
            before: { type: 'string', description: '導入前・課題' },
            after:  { type: 'string', description: '導入後・成果' },
          },
          required: ['before', 'after'],
        },
      },
      required: ['headline', 'key_numbers', 'case_points', 'insights'],
    },
  },
};

export interface AssetInsights {
  headline: string;
  key_numbers: string[];
  case_points: string[];
  insights: string[];
  before_after?: { before: string; after: string };
}

export function buildAssetExtractPrompt(
  asset: { title: string; content: string },
  context: { templateName?: string; userInstruction?: string; companyName?: string },
): string {
  const lines = [
    `アセット「${asset.title}」から、以下の資料作成に役立つ情報を extract_insights ツールで抽出してください。`,
    '',
    '## 作成する資料のコンテキスト',
    context.templateName    ? `- テンプレート: ${context.templateName}` : '',
    context.userInstruction ? `- ユーザー指示: ${context.userInstruction}` : '',
    context.companyName     ? `- 対象会社: ${context.companyName}` : '',
    '',
    '## アセット全文',
    asset.content.slice(0, 4000),
  ].filter(l => l !== undefined);

  return lines.join('\n');
}

/** アセット推薦ツール */
export const ASSET_RECOMMEND_TOOL = {
  type: 'function' as const,
  function: {
    name: 'recommend_assets',
    description: '資料作成に適したアセットのIDリストを推薦する',
    parameters: {
      type: 'object',
      properties: {
        recommended_asset_ids: { type: 'array', items: { type: 'string' }, description: '最大5件' },
        reasoning: { type: 'string' },
      },
      required: ['recommended_asset_ids', 'reasoning'],
    },
  },
};

export function buildDocumentGeneratePrompt(
  promptGuidance: string | undefined,
  assets: { title: string; summary: string; content: string; insights?: AssetInsights }[],
  companyName?: string,
  userInstruction?: string,
): string {
  const guidance = promptGuidance ?? `## スライド構成ガイド（汎用）
1. タイトルスライド（タイトル + 対象会社名）
2. アジェンダ（本日の内容）
3. 課題・背景
4. 解決策・アプローチ
5. 成果・実績
6. まとめ・次のステップ`;

  const assetContext = assets.length > 0
    ? assets.map((a, i) => {
        if (a.insights) {
          const { headline, key_numbers, case_points, insights, before_after } = a.insights;
          return [
            `### 参考資料${i + 1}: ${a.title}`,
            `**ヘッドライン**: ${headline}`,
            key_numbers.length > 0  ? `\n**数値・KPI**:\n${key_numbers.map(n => `- ${n}`).join('\n')}` : '',
            case_points.length > 0  ? `\n**事例・エピソード**:\n${case_points.map(p => `- ${p}`).join('\n')}` : '',
            insights.length > 0     ? `\n**重要洞察**:\n${insights.map(ins => `- ${ins}`).join('\n')}` : '',
            before_after            ? `\n**Before → After**: ${before_after.before} → ${before_after.after}` : '',
          ].filter(Boolean).join('\n');
        }
        return `### 参考資料${i + 1}: ${a.title}\n${a.summary ?? ''}\n\n${a.content.slice(0, 2000)}`;
      }).join('\n\n---\n\n')
    : '（参考資料なし — テンプレートのみで生成）';

  return `あなたはプレゼンテーション作成AIです。generate_slides ツールを使ってスライドを作成してください。

${userInstruction ? `## ユーザーの指示（最優先で反映すること）\n${userInstruction}\n` : ''}
${companyName ? `## 対象会社: ${companyName}\n` : ''}
${guidance}

## ★ レイアウト選択ルール（厳守）

### STEP 1: 各スライドの内容を見て、最適なレイアウトを選ぶ
以下の判断木に従い **layout フィールドを必ず設定** すること。

| 内容の性質 | 使うレイアウト | 設定必須フィールド |
|-----------|--------------|-----------------|
| 章の区切り（セクション扉） | section_divider | section_number |
| 3つの要素を比較・フロー | three_column | columns（3要素） |
| 数値・KPIを強調 | kpi_grid | kpis（2〜6件） |
| 導入前後・改善前後の変化 | before_after | before_title/items、after_title/items |
| 時系列・プロセス・ロードマップ | timeline | phases |
| 今後のアクション・提案まとめ | next_steps | steps（3段階） |
| 冒頭サマリー（成果/課題/次手） | exec_summary | achievement、challenge、next_move |
| **4つの課題・特徴・機能を2×2で見せたい** | **four_grid** | **cards（最大4件）。各cardにnumber/title/body/result/colorを設定。footerに1行まとめ** |
| **変数の掛け算・式で成果を説明** | **formula_flow** | **variables（×でつなぐ変数群）。left_title/left_body=左側の成果ブロック。denominator=下段の負の変数。note=底部メモ** |
| **変数ごとの式と現状を分解説明** | **decomposition_grid** | **cells（最大6件、3列×2行）。各cellにnumber/label/formula/body/color。最後のcellをis_hypothesis:trueにして仮説カードに** |
| **リスク一覧（ID/名称/なぜ/対策）** | **risk_countermeasure** | **risk_rows に {id,label,why,countermeasure} を設定** |
| **2〜4プランを属性ごとに横並び比較** | **track_comparison** | **tracks に {label,color,rows:[{key,value}]} を設定** |
| **Phase1→Phase2 の移行を可視化** | **phase_progression** | **phase1/phase2 に {label,items} 設定。trigger に移行条件** |
| **◯◯→△△ の移行・変換を一覧化** | **mobility_table** | **mobility_rows に {from,to,description} を設定** |
| **NG例 vs OK例 の対比** | **ng_ok_comparison** | **ng_items/ok_items に各項目設定。statement に結論** |
| **役割×レベルのマトリクス表** | **function_table** | **func_columns に列ヘッダー、func_rows に {role,cells} を設定** |
| 上記のどれにも当てはまらない | bullets | content |

### STEP 2: 必須フィールドを確実に埋める
- **three_column** → columns に3要素を必ず設定
- **kpi_grid** → kpis に必ず設定
- **before_after** → before_title + before_items + after_title + after_items を必ず設定
- **timeline** → phases に2〜5フェーズを必ず設定
- **next_steps** → steps に3要素を必ず設定
- **exec_summary** → achievement + challenge + next_move を必ず設定
- **four_grid** → cards に1〜4件を必ず設定（title必須、color は orange/lime/forest/black/red/blue から選択）
- **formula_flow** → variables に2〜5件を必ず設定（各変数に n/label/color）。left_title と left_body で左ブロックを必ず設定
- **decomposition_grid** → cells に3〜6件を必ず設定（label必須、formula で式を表現）
- **risk_countermeasure** → risk_rows に2〜5件を必ず設定（label/why/countermeasure 必須）
- **track_comparison** → tracks に2〜4件を必ず設定（label/rows 必須、color は lime/forest/orange/black）
- **phase_progression** → phase1 と phase2 を両方設定（label 必須、items に3〜5行）
- **mobility_table** → mobility_rows に2〜6件を必ず設定（from/to 必須）
- **ng_ok_comparison** → ng_items と ok_items を両方設定（各2〜5件）、statement に1行まとめ
- **function_table** → func_columns に1〜5列、func_rows に各 {role, cells} を設定

### STEP 3: eyebrow（小見出し）を設定する
- 全スライドに eyebrow（章名・文脈を示す12pt小文字）を設定することを推奨
- 例: eyebrow="課題の整理"、title="なぜ今この問題が重要か"

### STEP 4: レイアウト分布の目標
全スライドのうち **bullets は最大20%** に抑えること。残り80%以上は構造レイアウトを使う。

## 参考資料
${assetContext}

## 共通ルール
- 参考資料の具体的な数値・事例・固有名詞を積極的に活用する
- タイトルは体言止めまたは短い動詞止め（20字以内）
- 全体として聴衆に価値が伝わる構成にする`;
}

// ─── MD / Docs 用ツール定義 ───────────────────────────────────────────────────

/** Markdown / Word 文書生成ツール */
export const DOCUMENT_GENERATE_TEXT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'generate_document',
    description: 'Markdown または Word 形式の文書を生成する',
    parameters: {
      type: 'object',
      properties: {
        title:    { type: 'string', description: '文書タイトル' },
        content:  { type: 'string', description: 'Markdown 形式の本文（見出し・箇条書き・表を活用する）' },
      },
      required: ['title', 'content'],
    },
  },
};

export interface TextDocument {
  title: string;
  content: string; // Markdown
}

/** MD / Docs 向けプロンプト */
export function buildTextDocumentPrompt(
  outputType: 'md' | 'docs',
  assets: { title: string; summary: string; content: string }[],
  companyName?: string,
  userInstruction?: string,
): string {
  const format = outputType === 'md' ? 'Markdown' : 'Word（Markdown形式で出力）';
  const assetContext = assets.length > 0
    ? assets.map((a, i) => `### 参考資料${i + 1}: ${a.title}\n${a.summary ?? ''}\n\n${a.content.slice(0, 2000)}`).join('\n\n---\n\n')
    : '（参考資料なし — 指示のみで生成）';

  return `あなたはCSMドキュメント作成AIです。generate_document ツールを使って${format}文書を作成してください。

${userInstruction ? `## ユーザーの指示（最優先で反映すること）\n${userInstruction}\n` : ''}
${companyName ? `## 対象会社: ${companyName}\n` : ''}

## 構成ガイドライン
- 見出し（# ## ###）を使って構造化する
- 数値・事例は箇条書きまたは表で見やすく整理する
- 参考資料の具体的な数値・固有名詞を積極的に活用する
- 全体として読み手に価値が伝わる構成にする
- 分量の目安: 1,000〜3,000字

## 参考資料
${assetContext}`;
}

// ─── スライドレビューツール ───────────────────────────────────────────────────

export const SLIDE_REVIEW_TOOL = {
  type: 'function' as const,
  function: {
    name: 'review_slides',
    description: '生成されたスライド構造の問題点を特定し、修正指示を出す',
    parameters: {
      type: 'object',
      properties: {
        has_issues: {
          type: 'boolean',
          description: '修正が必要な問題がある場合 true',
        },
        score: {
          type: 'number',
          description: '品質スコア 1〜10（7以上なら合格）',
        },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              slide_number: { type: 'number' },
              type: {
                type: 'string',
                enum: ['text_overflow', 'missing_field', 'duplicate_title', 'wrong_layout', 'bullets_overuse', 'content_quality'],
              },
              description: { type: 'string', description: '問題の説明' },
              fix:         { type: 'string', description: '具体的な修正指示' },
            },
            required: ['slide_number', 'type', 'description', 'fix'],
          },
        },
        overall_feedback: {
          type: 'string',
          description: '全体的なフィードバック（修正プロンプトに添付する）',
        },
      },
      required: ['has_issues', 'score', 'issues', 'overall_feedback'],
    },
  },
};

export interface SlideReview {
  has_issues: boolean;
  score: number;
  issues: Array<{
    slide_number: number;
    type: string;
    description: string;
    fix: string;
  }>;
  overall_feedback: string;
}

export function buildSlideReviewPrompt(structure: SlideStructure): string {
  const bulletCount = structure.slides.filter(s => !s.layout || s.layout === 'bullets').length;
  const bulletRatio = Math.round((bulletCount / structure.slides.length) * 100);

  return `あなたはプレゼンテーション品質レビュアーです。以下のスライド構造を review_slides ツールで評価してください。

## レビュー観点

### 1. テキスト過多（text_overflow）
- content 配列が5項目を超えている
- KPI の value が15文字を超えている
- タイトルが20文字を超えている
- before_items / after_items が5項目を超えている
- columns の items が4項目を超えている

### 2. 必須フィールド不足（missing_field）
- layout=three_column なのに columns が3件ない
- layout=kpi_grid なのに kpis が設定されていない
- layout=section_divider なのに section_number が未設定
- layout=before_after なのに before_title/before_items/after_title/after_items のいずれかが欠けている
- layout=timeline なのに phases が設定されていない
- layout=next_steps なのに steps が3件ない
- layout=exec_summary なのに achievement/challenge/next_move のいずれかが欠けている
- layout=four_grid なのに cards が設定されていない
- layout=formula_flow なのに variables が設定されていない
- layout=decomposition_grid なのに cells が設定されていない
- layout=risk_countermeasure なのに risk_rows が設定されていない
- layout=track_comparison なのに tracks が設定されていない
- layout=phase_progression なのに phase1/phase2 のいずれかが欠けている
- layout=mobility_table なのに mobility_rows が設定されていない
- layout=ng_ok_comparison なのに ng_items/ok_items のいずれかが欠けている
- layout=function_table なのに func_columns/func_rows のいずれかが欠けている

### 3. タイトル重複（duplicate_title）
- 2枚以上のスライドで全く同じタイトルを使っている

### 4. bullets 多用（bullets_overuse）
- bullets レイアウトが全体の20%を超えている
- 現在: bullets=${bulletCount}枚 / 全体=${structure.slides.length}枚 = ${bulletRatio}%

### 5. eyebrow 未設定（content_quality）
- eyebrow が空のスライドが多い（全体の半数以上に eyebrow を設定すべき）

### 判定基準
- score 8〜10: 問題なし（has_issues=false）
- score 5〜7: 軽微な問題あり（has_issues=true、重大なものだけ報告）
- score 1〜4: 重大な問題あり（has_issues=true）

## 評価対象スライド構造

\`\`\`json
${JSON.stringify(structure, null, 2).slice(0, 8000)}
\`\`\``;
}

export function buildSlideFixPrompt(
  originalPrompt: string,
  structure: SlideStructure,
  review: SlideReview,
): string {
  const issueList = review.issues
    .map(i => `- スライド${i.slide_number}（${i.type}）: ${i.description} → 修正: ${i.fix}`)
    .join('\n');

  return `${originalPrompt}

---

## ★ 前回生成のレビュー結果（品質スコア: ${review.score}/10）

以下の問題が見つかりました。修正してスライドを再生成してください。

### 発見された問題
${issueList}

### 全体フィードバック
${review.overall_feedback}

## 前回生成したスライド（参考）
\`\`\`json
${JSON.stringify(structure, null, 2).slice(0, 6000)}
\`\`\`

上記の問題を修正し、generate_slides ツールで改善版を出力してください。問題のないスライドはそのまま保持し、問題のあるスライドのみ修正すること。`;
}

export function buildAssetRecommendPrompt(
  templateName: string,
  assetSummaries: { asset_id: string; title: string; summary: string }[],
): string {
  const assetList = assetSummaries
    .map(a => `- asset_id: ${a.asset_id}\n  タイトル: ${a.title}\n  サマリー: ${a.summary ?? '（なし）'}`)
    .join('\n');

  return `あなたはCSMアセットライブラリのキュレーターです。
「${templateName}」の資料作成に最も適したアセットを recommend_assets ツールを使って選んでください。

## 利用可能なアセット一覧
${assetList}

関連性・品質・活用可能性を考慮して最大5件を選んでください。`;
}
