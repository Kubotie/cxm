// ─── 顧客理解プロファイルの生成プロンプト ────────────────────────────────────
//
// 集めた材料（外部シグナル・議事録・利用実態・サポート・人物）から、
// **担当者が読んで使える「顧客理解の記述」** を生成する。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11 / §15
//
// なぜ必要か:
//   準備度スコアやシグナルIDは「判断のための計器」であって、読み物ではない。
//   商談前に担当者が読むのは「この顧客に何が起きていて、何が論点か」という記述。
//   計器と記述の両方が要る。
//
// 設計の要:
//   - 材料には必ず ID（E1, E2, ...）を振り、各記述に `evidence_refs` で紐付けさせる。
//     出典なしの記述を作れない構造にすることで、モデルの作文を防ぐ。
//   - 事実だけでなく **示唆**（だから何が言えるか）まで書かせる。事実の羅列は判断に使えない。
//   - **分かっていないことを書かせる**。欠損を隠すと、次に何を聞けばよいかが見えなくなる。
//
// このファイルはサーバーサイド専用の API route からのみ import すること。

/** 材料1件。ID を振って渡し、記述から参照させる */
export interface ProfileEvidence {
  /** "E1" など。プロンプト内での参照キー */
  id:    string;
  /** 材料の種別ラベル（UI の出典表示にも使う） */
  kind:  '業界' | '外部情報' | '議事録' | '利用実態' | 'サポート' | '契約' | '人物' | 'チャット';
  /** 出典名（資料名・議事録タイトル・データソース名） */
  label: string;
  /** 出典URL（あれば） */
  url:   string | null;
  /** 日付（議事録の開催日・スナップショット日など） */
  date:  string | null;
  /** 情報の時点（外部記事の公開時期など）。date と違い「いつのデータか」を示す */
  asOf?: string | null;
  /** 本文・数値 */
  body:  string;
}

export interface ProfileBullet {
  text:          string;
  evidence_refs: string[];
}

export interface ProfileSection {
  key:     string;
  bullets: ProfileBullet[];
}

export interface CompanyProfileResult {
  sections:  ProfileSection[];
  /** 全体を1〜2文で（一覧表示や冒頭に使う） */
  headline:  string;
  /** まだ分かっていないこと。次に何を確認すべきか */
  unknowns:  string[];
}

/** 生成するセクション。デモの「顧客情報」タブの構成を CS 文脈に翻訳したもの */
export const PROFILE_SECTIONS = [
  {
    key:   'market',
    title: '市場・業界の動き',
    hint:  '**この顧客が属する業界全体**で起きていること。競合他社の動向、規制、技術トレンド、市場の構造変化。この顧客個社の話は含めない',
  },
  {
    key:   'strategy',
    title: '顧客の経営・組織の動き',
    hint:  '中期経営計画・IR・組織改編・人事・採用から読み取れる、顧客の向かっている方向',
  },
  {
    key:   'usage',
    title: 'Ptengine の利用実態',
    hint:  '実際にどう使われているか。何が回っていて何が止まっているか。契約に対して使い切れているか',
  },
  {
    key:   'competition',
    title: '競合・代替の状況',
    hint:  '他ツールの検討、内製化の動き、当社が代替可能と見られていないか',
  },
  {
    key:   'issues',
    title: '論点（いま何が問われているか）',
    hint:  '上記を踏まえて、この顧客との間で決着させるべき論点。担当者が次に動くべきこと',
  },
] as const;

export const COMPANY_PROFILE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'write_company_profile',
    description: '与えられた材料から、担当者が商談前に読む「顧客理解」を書く',
    parameters: {
      type: 'object',
      properties: {
        headline: {
          type: 'string',
          description: 'この顧客の現状を1〜2文で。最も重要な事実と、いま何が問われているかを含める',
        },
        sections: {
          type: 'array',
          description: '各セクションの記述。材料がないセクションは bullets を空配列にする',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                enum: ['market', 'strategy', 'usage', 'competition', 'issues'],
              },
              bullets: {
                type: 'array',
                description: '箇条書き。各項目は事実だけで終わらせず「だから何が言えるか」まで書く',
                items: {
                  type: 'object',
                  properties: {
                    text: {
                      type: 'string',
                      description:
                        '1項目。事実 → 示唆 の順で1〜2文。数値・固有名詞・日付は材料のものをそのまま使う。' +
                        '「〜が増加 → 〜の引き合いが強まる」のように矢印で示唆をつなぐ書き方でよい',
                    },
                    evidence_refs: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '根拠にした材料のID（E1 など）。**必ず1つ以上**。材料にない記述は書かない',
                    },
                  },
                  required: ['text', 'evidence_refs'],
                },
              },
            },
            required: ['key', 'bullets'],
          },
        },
        unknowns: {
          type: 'array',
          items: { type: 'string' },
          description:
            'まだ分かっていないこと。次の商談で確認すべきこと。' +
            '材料から読み取れない重要事項（意思決定者、予算、他部門の状況など）を具体的に挙げる',
        },
      },
      required: ['headline', 'sections', 'unknowns'],
    },
  },
} as const;

export const COMPANY_PROFILE_SYSTEM_PROMPT = `あなたは BtoB SaaS（Ptengine）のカスタマーサクセス担当を支援するアナリストです。
担当者が商談・定例の前に読む「顧客理解」を書きます。

## 書き方

- **事実で終わらせず、示唆まで書く。** 「PV消化率28%」ではなく「PV消化率28%で契約に対して使い切れていない → 上位プランの必要性より、まず既存枠での成果創出が論点」のように。
- **数値・固有名詞・日付は材料のものをそのまま使う。** 概算に丸めない。
- **各項目に必ず evidence_refs を付ける。** 材料にない記述は書かない。推測を事実として書かない。
- 推測を述べる場合は「〜の可能性がある」「〜と見られる」と明示し、その根拠となる材料を refs に入れる。
- 冗長な前置きを書かない。担当者は忙しい。1項目1〜2文。

## セクション

- market … **この顧客が属する業界全体**の動き。同業他社の動向、規制・制度、技術トレンド、市場の構造変化
- strategy … **この顧客個社**の経営・組織の動き。中計・IR・組織改編・人事・採用から読み取れる方向性
- usage … Ptengine の利用実態。何が回っていて何が止まっているか。**当社が持つ最大の情報優位なので具体的に書く**
- competition … 競合・代替の状況。他ツール検討、内製化、当社が代替可能と見られていないか
- issues … 論点。上記を踏まえて担当者が次に決着させるべきこと

### market と strategy の切り分け（間違えやすい）

**この顧客個社の話を market に入れないでください。**

- ✗ 誤り: 「この顧客が中計で3年2,800億円の成長投資を発表 → 投資余力がある」を market に書く
  → これは**個社**の話なので strategy に入れる
- ○ 正しい market: 「製造業ではTier1取引先からのScope3開示要求の期限が最大の駆動力になっている → CO2可視化基盤の引き合いが業界全体で急増」
  → **業界全体**で起きていること

market に書けるのは「同業他社も含めて起きていること」「業界の共通課題」「規制・制度の変化」「市場構造の変化」です。
主語が「この顧客が」になっている記述は market ではありません。

**材料がないセクションは bullets を空配列にする。** 埋めるために一般論を書かない。
特に market は、**kind が「業界」の材料**が渡されていなければ**空にしてください**。
個社の材料（外部情報・議事録・利用実態）から業界トレンドを推測して書かないこと。

## 時制の扱い（重要）

材料には過去の議事録が含まれます。**本日の日付を基準に時制を判断してください。**

- 議事録に「4月末頃に明確化予定」とあり、本日が8月なら、それは**既に過ぎた予定**です。
  「4月末に明確化される予定だった（その後の状況は材料にない）」のように書き、未来のことのように書かないでください。
- 期限・締切は本日との差を明示してください（「更新まで残り42日」など）。
- 直近の材料と古い材料が矛盾する場合は、**新しい材料を優先**し、変化があったことを書いてください。

## unknowns（分かっていないこと）

材料から読み取れない重要事項を具体的に挙げます。「意思決定者が誰か特定できていない」「GX予算の規模が不明」など。
ここを正直に書くことが、次に何を聞くべきかを担当者に示すことになります。埋め合わせの推測をしないでください。`;

/** 材料を ID 付きのテキストに整形する */
export function buildProfileUserPrompt(input: {
  companyName: string;
  tier:        number | null;
  evidences:   ProfileEvidence[];
  /** 本日の日付 "YYYY-MM-DD"。時制の判断に使う */
  today:       string;
}): string {
  const lines = input.evidences.map(e => {
    const when = e.date ?? (e.asOf ? `${e.asOf}時点` : '');
    const head = [`[${e.id}]`, e.kind, when, e.label].filter(Boolean).join(' ');
    const url  = e.url ? `\n  出典URL: ${e.url}` : '';
    return `${head}${url}\n  ${e.body.replace(/\n/g, '\n  ')}`;
  });

  return `## 本日
${input.today}

## 対象企業
${input.companyName}${input.tier ? `（Tier ${input.tier}）` : ''}

## 材料
以下の材料**だけ**を使って書いてください。各記述には材料のID（E1 など）を evidence_refs で付けてください。

${lines.join('\n\n')}`;
}
