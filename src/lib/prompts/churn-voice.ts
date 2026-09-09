// ─── 解約レーダー：言質抽出プロンプト ─────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §2 層3
//
// 議事録・Intercom・チケット本文から「解約に直結する発言」を**原文引用つきで**拾う。
// エレコムの決定打（2026-07-03「自動更新でない方が安心だよねという話になっている」）は
// NocoDB に保存されていたのに、どのシグナルにもなっていなかった。ここがそれを埋める。
//
// ── 2026-09-04 の実測を受けた改訂 ────────────────────────────────────────────
// 初回抽出（Tier1-2 / 45文書）で 84件が出た。内訳を見て2つの問題が分かった:
//
//   1. **確信度が識別に使えていない。** 84件中69件が 0.7 に固まった。モデルが
//      迷ったら 0.7 を置くだけで、高い/低いの判断になっていない。
//      → 0.7 を選択肢から外し、3段階（0.6 / 0.8 / 0.95）から選ばせる。
//        「どちらとも言えないなら返さない」を明示する。
//
//   2. **自社側の発言を拾っていた。** エレコムの誤検知「契約更新に向けた社内稟議」は
//      議事録のネクストアクション欄＝自社のタスクだった。顧客が言っていないものを
//      言質として数えると、critical が汚れる。
//      → speaker を必ず判定させ、顧客の発言以外は保存側で捨てる。
//
//   3. V5（体制縮小）が21件中19件 0.7 で、「新任の担当が加わった」程度の人事まで
//      拾っていた。推進体制が失われる場合に限定する。
//
// ── 2026-09-09 追加 ─────────────────────────────────────────────────────────
//   4. **前向きな発言をリスクとして拾っていた。** ブレインスリープの
//      「今すごくイメージ湧きました」が V1（自動更新の回避）として抽出され、
//      採用された結果 voice=4 が乗って critical になった（この1件が無ければ watch）。
//      言質は向きを問わず重み4のリスクとして加算されるため、前向きな発言が
//      解約リスクを作ってしまう。
//      → direction（risk / positive / neutral）を必ず判定させ、risk 以外は保存しない。
//
// 設計上の要:
//   - **必ず原文を引用させる。** 要約だけを見せると判断の根拠を誤らせる。
//   - **無ければ空で返させる。** 拾いたいバイアスがかかると全社に言質が立つ。
//   - 出力は必ず人のレビューを通す（review_status=pending で保存し、承認まで加点しない）。

export const AI_CONFIG_KEY_CHURN_VOICE = 'churn_voice_extract';

export const CHURN_VOICE_SYSTEM_PROMPT = [
  'あなたは BtoB SaaS のカスタマーサクセス責任者です。',
  '顧客との議事録・問い合わせ本文から、**契約の継続判断に直接影響する顧客の発言だけ**を抜き出します。',
  '',
  '# 抽出する意図（intent_type）',
  'V1 自動更新の回避 — 自動更新をやめたい、稟議・決裁が必要になった、契約管理を厳格化した、解約・縮小を検討していると顧客が述べた',
  'V2 他社比較        — 競合ツール名を挙げた比較、「◯◯では見えた/できた」という他社優位の言及、乗り換え検討',
  'V3 効果を説明できない — 導入効果を社内に説明・報告できない、ROI が示せない、成果の因果が特定できないと**顧客が困っている**',
  'V4 製品起因の不信   — 不具合や仕様上の制約でクレーム・業務影響が出た、頼れないので別の手段に切り替えると述べた',
  'V5 体制縮小        — 予算削減、推進役の離任で後任がいない、部署解体など**推進体制が失われる**変化',
  '',
  '# 向きを必ず判定する（direction）',
  'risk     … 契約の継続を**危うくする**発言。解約・縮小・他社移行・不信・体制喪失',
  'positive … 契約の継続に**前向きな**発言。活用が進む、価値を実感した、拡張したい',
  'neutral  … どちらとも言えない事実確認',
  '**risk 以外は採用されません。** 「今すごくイメージ湧きました」「導入して良かった」のような',
  '前向きな発言を V1〜V5 として返してはいけません。それらは positive です。',
  '判断に迷ったら、まず「この発言は解約に近づく方向か」を自問してください。',
  '',
  '# 誰の発言かを必ず判定する（speaker）',
  'customer … 顧客側の人物の発言・顧客の状況説明',
  'us        … 自社（提供側）の発言、議事録の「ネクストアクション」「自社アクション」「アジェンダ」など**自社のタスク欄**',
  'unknown   … 話者が判別できない',
  '**customer 以外は採用されません。** 自社が「契約更新の稟議を依頼する」と書いた行を顧客の言質として拾ってはいけません。',
  '',
  '# 厳守すること',
  '- **quoted_text は必ず原文のまま**引用する。要約・言い換え・補完をしてはいけない。',
  '  原文が長い場合は、意図が分かる最小限の連続した一文を切り出す（前後を繋げて創作しない）。',
  '- 該当する発言が無ければ hits を空配列で返す。**無理に拾わない。**',
  '  「活用が進んでいない」「もっと使いたい」程度の一般的な感想は言質ではない。',
  '- 将来の希望・要望（「こういう機能が欲しい」）は言質ではない。契約継続の判断に触れているものだけ。',
  '- V5 は「担当者が増えた」「新任が加わった」のような通常の人事異動を含めない。',
  '  推進していた人がいなくなる／予算が削られる／部署が無くなる場合に限る。',
  '- V3 は自社側が「効果を説明する方法を検討する」と書いた行ではなく、',
  '  **顧客が「説明できない・報告できない」と困っている**発言に限る。',
  '',
  '# confidence は3段階から選ぶ',
  '0.95 … 契約・解約・他社乗り換えに明示的に言及している顧客の発言',
  '0.80 … 契約に直接は触れないが、継続判断に影響すると強く読める顧客の発言',
  '0.60 … 影響しそうだが文脈が足りず、人の判断を仰ぎたいもの',
  'これ以外の値を使ってはいけません。**迷ったら 0.60 ではなく、返さない**という判断を優先します。',
].join('\n');

export const CHURN_VOICE_JSON_SCHEMA = {
  name: 'churn_voice',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      hits: {
        type: 'array' as const,
        description: '抽出した言質。該当が無ければ空配列',
        items: {
          type: 'object' as const,
          properties: {
            intent_type: {
              type: 'string' as const,
              enum: ['V1', 'V2', 'V3', 'V4', 'V5'] as const,
              description: 'V1 自動更新の回避 / V2 他社比較 / V3 効果を説明できない / V4 製品起因の不信 / V5 体制縮小',
            },
            direction: {
              type: 'string' as const,
              enum: ['risk', 'positive', 'neutral'] as const,
              description: '契約継続にとっての向き。risk 以外は採用されない',
            },
            speaker: {
              type: 'string' as const,
              enum: ['customer', 'us', 'unknown'] as const,
              description: '誰の発言か。customer 以外は採用されない',
            },
            quoted_text: {
              type: 'string' as const,
              description: '**原文のままの引用**。要約・言い換え禁止。最大200文字',
            },
            reason: {
              type: 'string' as const,
              description: 'なぜこれが契約継続の判断に影響するのか。1文',
            },
            confidence: {
              type: 'number' as const,
              description: '0.95 / 0.80 / 0.60 のいずれか。他の値は使わない',
            },
          },
          required: ['intent_type', 'direction', 'speaker', 'quoted_text', 'reason', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    required: ['hits'],
    additionalProperties: false,
  },
} as const;

export const VOICE_INTENT_LABEL: Record<string, string> = {
  V1: '自動更新の回避',
  V2: '他社比較',
  V3: '効果を説明できない',
  V4: '製品起因の不信',
  V5: '体制縮小',
};

/**
 * レビュー必須か、参考どまりか。
 *
 * ── 確信度で切るのは諦めた（2026-09-04 実測）─────────────────────────────
 * 「0.7 を使うな」と指示したら、今度は 0.8 に68件中56件が固まった。
 * モデルは中間値に寄るので、確信度は選別に使えない。**意図の種類で切る。**
 *
 * V1 自動更新の回避 / V2 他社比較 だけをキューに積む。
 *   この2つは顧客の契約意思そのもので、**利用や接触のデータからは絶対に分からない**。
 *   人が読む価値がある。
 *
 * V3 効果を説明できない / V4 製品起因の不信 / V5 体制縮小 は参考どまり。
 *   これらは D層・B層が既に数値で捉えている状態の言い換えであることが多く
 *   （V5 の担当離任 ≒ B2 担当交代、V3 ≒ D層の停滞）、承認してもスコアが二重に乗る。
 *   個社ページには出すが、レビューは求めない。
 */
export function voiceReviewPriority(intentType: string, _confidence: number): 'required' | 'reference' {
  return intentType === 'V1' || intentType === 'V2' ? 'required' : 'reference';
}

/**
 * 議事録から「自社のタスク欄」を落とす。
 *
 * ⚠️ speaker を判定させても全件 customer が返り、機能しなかった（実測）。
 *   エレコムで誤検知した「契約更新に向けた社内稟議」は議事録のネクストアクション欄で、
 *   自社がやることを書いた行だった。プロンプトで頼むのではなく**入力から消す**。
 *
 * 見出し行から次の見出しまでを落とす。見出しが無い議事録はそのまま返る。
 */
export function stripOurActionSections(body: string): string {
  const DROP_HEADINGS = [
    'ネクストアクション', 'ネクスト・アクション', 'Next Action', 'NextAction',
    'アクションアイテム', 'アクションプラン', 'ToDo', 'TODO', 'To Do',
    '自社', '当社', 'Ptmind側', '弊社', 'アジェンダ', 'ゴール',
    '担当者フィードバック', '次回アドバイス',
  ];
  const lines = body.split('\n');
  const out: string[] = [];
  let dropping = false;

  for (const line of lines) {
    const t = line.trim();
    // 見出しらしい行（短く、記号や番号で始まることが多い）
    const isHeading = t.length > 0 && t.length <= 40 && !t.startsWith('「');
    if (isHeading) {
      const hit = DROP_HEADINGS.some(h => t.includes(h));
      if (hit) { dropping = true; continue; }
      // 別の見出しに来たら復帰する。
      // ⚠️ 「短い行」を見出しとみなすと、タスク欄のリスト項目
      //   （「議事録作成・共有（河野氏含む）」など）で復帰してしまい、
      //   その下の「契約更新に向けた社内稟議」が顧客の言質として残る（実測）。
      //   番号付き・記号付きの明確な見出しだけを復帰条件にする。
      if (dropping && /^(#{1,6}\s|\d+[.．]\s|[■●◆▼])/.test(t)) dropping = false;
    }
    if (!dropping) out.push(line);
  }
  return out.join('\n');
}

/** 1文書ぶんのユーザープロンプト */
export function buildChurnVoicePrompt(doc: {
  companyName: string;
  sourceType: string;
  title: string | null;
  occurredAt: string;
  body: string;
}): string {
  // 自社のタスク欄を消してから渡す。プロンプトで「自社の発言は拾うな」と
  // 指示しても効かなかったので、入力の側で断つ
  const body = doc.sourceType === 'minutes' ? stripOurActionSections(doc.body) : doc.body;
  return [
    `# 顧客: ${doc.companyName}`,
    `# 文書種別: ${doc.sourceType}`,
    `# 日付: ${doc.occurredAt}`,
    doc.title ? `# タイトル: ${doc.title}` : '',
    '',
    '# 本文（顧客の発言・状況のみ。自社のタスク欄は除去済み）',
    body,
  ].filter(Boolean).join('\n');
}
