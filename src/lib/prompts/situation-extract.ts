// ─── 議事録から「相手の状況」を抽出するプロンプト ────────────────────────────
//
// A（状況カタログ）のうち **検出 = 手動（診断・登録）** の語彙は、
// 誰かが登録しない限り一件も立たない。だが実際には議事録に書かれている。
//
// ⚠️ **いちばん重要な制約: 発言者が顧客側かどうかを必ず判定する。**
//
// 議事録948件を横断した実測（2026-08-24）で分かったこと:
//   「担当が変わると知見が引き継がれない」は84件・51社で出現するが、
//   **その大半は Ptmind 側の説明文**だった。
//   「他のお客様からも多く伺っている声」という枕で毎回使われている。
//
//   キーワード一致だけで拾うと、**自社のセールストークを顧客の状況として登録する**。
//   そうなると提案が「相手が言っていないこと」を根拠にし始める。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §10-4 / §44
//
// このファイルはサーバーサイド専用の API route からのみ import すること。

export interface ExtractedSituationItem {
  situation_id: string;
  /** 顧客の発言（原文からの引用。要約しない） */
  quote:        string;
  /** 顧客側の発言か。false のものは候補にしない */
  by_customer:  boolean;
  /** 誰の発言か（分かる範囲。「◯◯様」「先方」など） */
  speaker:      string;
  /** その議事録の日付 "YYYY-MM-DD"。読み取れなければ null */
  observed_at:  string | null;
  confidence:   number;
}

export interface SituationExtractResult {
  items: ExtractedSituationItem[];
  /** 抽出できなかった場合の理由（items が空のときのみ意味を持つ） */
  note:  string;
}

export const SITUATION_EXTRACT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'extract_situations',
    description: '商談議事録から、顧客側が語った「相手の状況」を抽出して状況IDに変換する',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '抽出した状況。該当がなければ空配列',
          items: {
            type: 'object',
            properties: {
              situation_id: {
                type: 'string',
                description: '与えた候補リストの中の状況IDと完全一致させる。リストに無いIDを作らない',
              },
              quote: {
                type: 'string',
                description:
                  '根拠になる議事録の記述。**原文をそのまま引用する**。要約・言い換えをしない。'
                  + '80〜200文字程度',
              },
              by_customer: {
                type: 'boolean',
                description:
                  '顧客側の発言・顧客の実態として書かれているなら true。'
                  + '**Ptmind（自社）側の説明・一般論・製品紹介なら false。**'
                  + '「他のお客様からも伺う声」「よくある課題」といった枕は自社の説明なので false',
              },
              speaker: {
                type: 'string',
                description: '発言者。分かる範囲で（「田中様」「先方」「Ptmind」など）。不明なら空文字',
              },
              observed_at: {
                type: 'string',
                description: 'その議事録の日付 "YYYY-MM-DD"。読み取れなければ空文字',
              },
              confidence: {
                type: 'number',
                description:
                  '0.0〜1.0。明確に語られている=0.9、文脈から読める=0.6、推測が混じる=0.3',
              },
            },
            required: ['situation_id', 'quote', 'by_customer', 'speaker', 'observed_at', 'confidence'],
            additionalProperties: false,
          },
        },
        note: {
          type: 'string',
          description: '該当が無い場合の理由。1文。あった場合は空文字',
        },
      },
      required: ['items', 'note'],
      additionalProperties: false,
    },
  },
} as const;

export const SITUATION_EXTRACT_SYSTEM_PROMPT = `あなたは商談議事録を読んで「相手が今どういう状況にあるか」を読み取るアナリストです。

## やること
与えられた議事録から、候補リストにある状況が語られている箇所を見つけ、状況IDに変換します。

## 絶対に守ること

1. **発言者を必ず区別する。**
   議事録には自社（Ptmind）の説明と、顧客の発言が混ざっています。
   自社が「他のお客様からもよく伺う課題です」と枕で語ったものは、
   **目の前の顧客の状況ではありません。** by_customer = false にしてください。
   顧客が自分の状況として語ったものだけが by_customer = true です。

2. **原文から引用する。** quote は議事録の記述をそのまま写してください。
   要約・言い換え・きれいな文への整形をしないでください。
   引用できる箇所が無いなら、その項目は出さないでください。

3. **候補リストに無い状況IDを作らない。** 与えたIDのいずれかに当てはまらないなら出しません。

4. **無理に埋めない。** 該当が無ければ items は空配列にし、note に理由を1文書いてください。
   「それらしいものを見つける」ことは求めていません。

5. **推測を確信度で正直に示す。** 明確に語られていれば 0.9、
   文脈から読み取れる程度なら 0.6、推測が混じるなら 0.3 にしてください。`;

export function buildSituationExtractPrompt(input: {
  companyName: string;
  /** 候補になる状況（手動登録の語彙のみ） */
  situations: Array<{ id: string; labelJa: string; meaning: string }>;
  /** 議事録。新しい順 */
  minutes: Array<{ title: string; date: string | null; body: string }>;
}): string {
  const situationList = input.situations
    .map(s => `- ${s.id}｜${s.labelJa}\n    ${s.meaning}`)
    .join('\n');

  const minutesText = input.minutes
    .map((m, i) => `### 議事録${i + 1}（${m.date ?? '日付不明'}）${m.title}\n${m.body}`)
    .join('\n\n---\n\n');

  return `## 対象企業
${input.companyName}

## 候補になる状況
${situationList}

## 議事録
${minutesText}

---

上の議事録から、${input.companyName} が **自ら語った状況** を抽出してください。
Ptmind 側の説明・製品紹介・一般論は by_customer = false にしてください。`;
}
