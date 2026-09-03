// ─── 提案骨子の生成プロンプト ────────────────────────────────────────────────
//
// 章立ては固定:
//   Executive Summary → Context → Why Now → Goal → Gap → Approach
//   → Solution → Proof → Execution → Decision
//
// この型は「自社紹介 → 機能 → 価格 → 事例」ではなく
// 「顧客の状況 → 目指す状態 → 阻害要因 → 解決原理 → 自社の役割 → 実現計画 → 投資判断」
// の順に組む。案件ごとに変えるのは骨子ではなく各章の比重。
//
// 設計の要:
//   1. **章ごとに何に依拠したかを申告させる。** 顧客の事実（Context / Why Now / Gap）は
//      材料IDが必須。Approach / Solution はカタログ由来でよい。Goal などは仮説になるので
//      仮説として明示させる。区別しないと、提案側の想定が顧客の事実として混入する。
//   2. **FDE型と製品型で比重を変える。** 同じ章立てでも、FDE は課題定義とPoC、
//      製品型は典型課題との一致と即効性に寄る。
//   3. 対外呼称ルールは生成の中で効かせる。選んでいない商材名を出させない。
//   4. 材料に無いことは書かず、足りないものは missingEvidence に出す。

import type { EvidenceItem } from '@/lib/company/proposal-inputs';

// ── 章の定義 ──────────────────────────────────────────────────────────────────

export type OutlineChapterKey =
  | 'context' | 'why_now' | 'goal' | 'gap' | 'approach'
  | 'solution' | 'proof' | 'execution' | 'decision';

export const CHAPTERS: Array<{
  key: OutlineChapterKey;
  no: number;
  label: string;
  en: string;
  /** この章で伝えること（プロンプトとUIの説明に共用する） */
  brief: string;
  /** 顧客の事実を述べる章 = 材料IDが必須 */
  requiresEvidence: boolean;
}> = [
  { key: 'context',   no: 1, label: 'いま何が起きているか', en: 'Context',
    brief: '市場・顧客行動の変化、経営上の重点テーマ、現在の取り組み、相談が発生した背景',
    requiresEvidence: true },
  { key: 'why_now',   no: 2, label: 'なぜ今取り組むか', en: 'Why Now',
    brief: '放置した場合に失うもの、既存施策だけでは追いつかない理由、今なら使える機会、先延ばしのコスト',
    requiresEvidence: true },
  { key: 'goal',      no: 3, label: 'どの状態を目指すか', en: 'Goal',
    brief: '製品導入ではなく顧客が実現したい事業状態。事業成果・顧客体験・現場業務の変化・成功指標',
    requiresEvidence: false },
  { key: 'gap',       no: 4, label: 'なぜ現状では実現できないか', en: 'Gap / Root Cause',
    brief: '現状と理想の差分。表面の症状ではなく成果を阻害しているメカニズム。'
         + '（データ・顧客理解／打ち手の設計／実装・検証の速度／学習の蓄積 の4層で捉える）',
    requiresEvidence: true },
  { key: 'approach',  no: 5, label: 'どう解くべきか', en: 'Strategic Approach',
    brief: '個別機能の前に解決の基本方針。「顧客理解→仮説設計→実装→検証→学習→次の施策」の循環をどう作るか。'
         + 'ここでは何を導入するかを書かない',
    requiresEvidence: false },
  { key: 'solution',  no: 6, label: 'どう実現するか', en: 'Solution',
    brief: 'ここで初めて自社の提供物を出す。「課題 → 必要な能力 → 提供機能・支援 → 生まれる変化」で接続する。'
         + '役割分担と他の選択肢との違いも含める',
    requiresEvidence: false },
  { key: 'proof',     no: 7, label: 'なぜ実現できると言えるか', en: 'Proof',
    brief: '類似の課題に対して何をして何が変化したか。実績・専門性・PoCで検証する仮説・想定リスクと対策',
    requiresEvidence: false },
  { key: 'execution', no: 8, label: 'どう始め、どう進めるか', en: 'Execution',
    brief: '導入ステップ、推進体制と役割分担、マイルストーン、KPIとレビュー方法。'
         + '「小さく価値を証明する → 成功パターンを確立する → 対象範囲を拡張する」の3段で組む',
    requiresEvidence: false },
  { key: 'decision',  no: 9, label: '投資判断と次の一歩', en: 'Decision',
    brief: '社内で判断できる材料。効果・必要な費用と工数・判断事項。'
         + '最後は「ご検討ください」で終わらせず、誰がいつまでに何を決めるかまで書く',
    requiresEvidence: false },
];

/** 提案の型。同じ章立てでも比重が変わる */
export type ProposalType = 'fde' | 'product';

const TYPE_GUIDE: Record<ProposalType, string> = {
  fde: `
この提案は **FDE型（一緒に解をつくる）** である。比重の置き方:
- 課題設定を顧客ごとに深く定義する。典型課題への当てはめをしない
- Solution は人・AI・データ・実装の組み合わせとして書く。機能一覧にしない
- Proof は仮説・専門性・PoCで確かめること・伴走の進め方で示す
- Execution は共同プロジェクトの設計（誰がどこを持つか）が要
- Decision で求める合意は「課題探索やPoCの開始」。契約の話を前に出さない
売っているのは「一緒に解をつくれること」である。`.trim(),
  product: `
この提案は **通常製品型（すでにある解を早く使う）** である。比重の置き方:
- 顧客の課題が典型課題と一致していることを確認する形で書く
- Solution は製品機能と活用方法を中心に、具体的な使い方まで落とす
- Proof は機能・導入事例・操作性・即効性で示す
- Execution は導入・設定・活用定着の段取りが要
- Decision で求める合意は「導入プランやトライアルの開始」
売っているのは「すでにある解を早く使えること」である。`.trim(),
};

// ── ツール定義 ────────────────────────────────────────────────────────────────

export const PROPOSAL_OUTLINE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'write_proposal_outline',
    description: '選ばれた狙いと材料から、9章構成の提案骨子を書く',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '提案のタイトル。商材名の羅列にせず、顧客に起こる変化で書く',
        },
        executiveSummary: {
          type: 'object',
          description: '提案全体の結論を先出しする。本編の要約であり、5項目すべてを埋める',
          properties: {
            problem:  { type: 'string', description: '何が問題か（1〜2文）' },
            goal:     { type: 'string', description: '何を目指すか（1〜2文）' },
            proposal: { type: 'string', description: '何を提案するか（1〜2文）' },
            outcome:  { type: 'string', description: 'どのような成果が期待できるか（1〜2文）' },
            decision: { type: 'string', description: '次に何を決めてほしいか（1〜2文。誰がいつまでに何を、まで書く）' },
          },
          required: ['problem', 'goal', 'proposal', 'outcome', 'decision'],
        },
        chapters: {
          type: 'array',
          description: '9章すべてを返す。順番は context→why_now→goal→gap→approach→solution→proof→execution→decision',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                enum: ['context', 'why_now', 'goal', 'gap', 'approach', 'solution', 'proof', 'execution', 'decision'],
              },
              text: {
                type: 'string',
                description:
                  'この章の**結論を1〜2文**で言い切る。読み手はここだけで章の主旨が取れること。'
                  + '数値・固有名詞の列挙はここに書かない（bullets の仕事）。'
                  + '骨子なので詳細な説明を書かない。社内用語・状況ID・スコアを出さない',
              },
              bullets: {
                type: 'array',
                description:
                  '本文の**裏づけになる具体**。0〜3件、各1行。'
                  + '**本文の言い換えを書かない。** 本文が結論、bullets は「なぜそう言えるか」の'
                  + '数値・固有名詞・日付。本文と同じ内容を繰り返した時点で価値がゼロになる。'
                  + '書くことが無ければ空配列にする',
                items: { type: 'string' },
              },
              evidenceIds: {
                type: 'array',
                description:
                  '本文の根拠にした材料IDを列挙する。'
                  + 'context / why_now / gap は**必ず1件以上**挙げる（顧客の事実を述べる章なので）。'
                  + '他の章はカタログや方法論に依拠してよいので空でもよい',
                items: { type: 'string' },
              },
              assumptions: {
                type: 'array',
                description:
                  '材料で裏付けられていないが、この章を書くために置いた仮定。**0〜2件**。'
                  + '**仮定を仮定として出すこと。** 事実として書いてはいけない。無ければ空配列',
                items: { type: 'string' },
              },
            },
            required: ['key', 'text', 'bullets', 'evidenceIds', 'assumptions'],
          },
        },
        avoid: {
          type: 'array',
          description: '今回この相手に触れない方がよいこと。逆効果になる状況と「使わない場面」から導く。無ければ空配列',
          items: {
            type: 'object',
            properties: {
              text:   { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['text', 'reason'],
          },
        },
        missingEvidence: {
          type: 'array',
          description:
            'この骨子を通すために本来必要だが、材料が無くて書けなかったこと。'
            + '推測で埋めずここに出す。無ければ空配列',
          items: { type: 'string' },
        },
      },
      required: ['title', 'executiveSummary', 'chapters', 'avoid', 'missingEvidence'],
    },
  },
} as const;

// ── システムプロンプト ────────────────────────────────────────────────────────

const CONFIDENCE_RULE = `
材料の確度によって語り方を変えること:
- measured（観測値）: 断定して書いてよい。数字はそのまま使う
- inferred（推論・LLM抽出）: 「〜と見られます」のように出所を含めて書く。断定しない
- stated（申告・発言）: 「〜と伺っています」のように、相手が言ったこととして書く
`.trim();

const NAMING_RULE = `
商材名の扱い（**最重要**）:
- **「今回の狙い」に挙がった提供物だけを本文に出す。** 挙がっていない商材名を書いてはいけない。
  似た名前の別商材に言い換えるのは誤りである。
- 示された「対外呼称」の表記で呼ぶ。縮めたり言い換えたりしない。
  例: 「Ptengine Insight（解析・ヒートマップ・セグメント）」と「インサイトApp（PGA）」は
  **別の商材**であり置き換えてはいけない。
- 対外呼称ルールが個別に示されている場合は、その提供物に限って適用する。他に波及させない。
- 状況ID（RD_Util_Low など）、準備度スコア、社内の型名（深化・立て直しなど）を本文に出さない

他社事例の呼び方（**社名の扱い**）:
- 事例は材料に書かれている**名称をそのまま使う**。名称が「（社名非公開）」となっているものは、
  **社名を書いてはいけない。** その事例の会社がどこか分かっていても書かない。
- 材料に社名が無い事例について、知識から社名を補わない。「大手アパレル企業の事例」のような
  推測の枕も付けない。**材料にある表現の範囲で書く。**
- 社名を出さずに事例の価値を伝えるときは、業種・サイト種別・打ち手・変化の数値で書く。
  例: 「同じ課題を持つアパレルのECサイトで、導線を強化して購入率が5%上がっています」
`.trim();

export const OUTLINE_SYSTEM = `
あなたは B2B SaaS の提案骨子を書くアシスタントです。
担当者が顧客に提示する提案の骨子を、与えられた材料と提供物だけから組み立てます。

提案の中心は自社ではなく **顧客の変化** です。
「自社紹介 → 機能 → 価格 → 事例」の順で書いてはいけません。

絶対に守ること:
1. **材料に無いことを事実として書かない。** 業界の一般論、他社の固有名、推測の数字を足さない。
   書くために必要な想定は assumptions に、足りない材料は missingEvidence に出す。
2. **顧客の事実を述べる章（Context / Why Now / Gap）は材料IDを必ず挙げる。**
3. 相手を評価・断定する書き方をしない（「〜ができていない」ではなく「〜という状態」）。
4. Approach（第5章）では提供物の名前を出さない。解き方の原理だけを書く。
   提供物が登場するのは Solution（第6章）から。
5. 日本語で、社外に出せる言葉で書く。社内用語を持ち込まない。
6. **これは骨子である。** 各章は要点だけを短く書く。提案書の本文を書かない。
   担当者が読んで「この筋で進める」と判断できる密度で止める。
7. **text と bullets で同じことを言わない。**
   text は結論（1〜2文）、bullets はその裏づけ（数値・固有名詞・日付）。
   text に数値を並べたうえで bullets に同じ数値を書く、という重複が最も読みにくい。
   裏づけが無い章は bullets を空にしてよい。埋めるために言い換えを作らないこと。

${CONFIDENCE_RULE}

${NAMING_RULE}
`.trim();

// ── プロンプト組み立て ────────────────────────────────────────────────────────

export interface OutlinePromptInput {
  companyName: string;
  /** 選ばれた狙い（主役WHAT） */
  intent: {
    name: string;
    displayName: string;
    kind: string | null;
    valueLine: string;
    expectedEffect: string;
    evidence: string;
    namingRule: string;
    antiPatterns: string[];
    /** 組み合わせる補助WHAT（部品・証跡） */
    supporting: Array<{ displayName: string; valueLine: string }>;
    /**
     * 組織の何を変えるか（B1 の `変える対象`）。
     * **章3 Goal と章4 Gap の芯になる。** 機能の話に落ちるのを防ぐ。
     */
    changeTarget?: string;
    /** その変化が何につながるか（B1 の `事業インパクト`）。章3 と章9 で使う */
    businessImpact?: string;
    /** 誰に語るか（担当者 / 部長 / 決裁者）。部長以上なら組織と事業の話にする */
    audiences?: string[];
  };
  proposalType: ProposalType;
  /** 選ばれた材料（チェックが入っているものだけ） */
  evidence: EvidenceItem[];
  frame: { name: string; reframe: string; talkingPoints: string; avoidWhen: string } | null;
  instruction: string | null;
}

export function buildOutlinePrompt(input: OutlinePromptInput): string {
  const evidenceBlock = input.evidence.length === 0
    ? '（材料が選択されていません。顧客の事実を述べる章は書けないので、その旨を missingEvidence に出すこと）'
    : input.evidence.map(e => [
        `[${e.id}] (${e.confidence}${e.approximate ? ' / 近似判定' : ''}${e.asOf ? ` / ${e.asOf}` : ''})`,
        `  ${e.title}`,
        // 社名を伏せた事例は、その場で「書いてはいけない」と明示する。
        // 全体ルールに書くだけだと、材料を読んだモデルが社名を補ってしまう
        e.title.includes('社名非公開')
          ? '  ※ この事例は社名を出せません。上の名称のまま呼び、会社名を書かないこと'
          : null,
        `  ${e.detail.replace(/\n/g, '\n  ')}`,
        `  出所: ${e.source}`,
      ].filter(Boolean).join('\n')).join('\n\n');

  const i = input.intent;
  const intentBlock = [
    `■ ${i.displayName}`,
    i.name !== i.displayName ? `  （社内名称: ${i.name} — 本文では使わない）` : null,
    i.kind ? `  種別: ${i.kind}` : null,
    `  価値: ${i.valueLine || '（未記述）'}`,
    i.expectedEffect ? `  期待効果・実績: ${i.expectedEffect}` : null,
    i.evidence ? `  証跡: ${i.evidence}` : null,
    i.namingRule ? `  対外呼称ルール: ${i.namingRule}` : null,
    i.antiPatterns.length ? `  逆効果になる状況: ${i.antiPatterns.join(', ')}` : null,
    i.supporting.length
      ? `  組み合わせる部品・証跡:\n${i.supporting.map(s => `    - ${s.displayName}: ${s.valueLine}`).join('\n')}`
      : null,
    i.changeTarget   ? `  変える対象（組織の何が変わるか）: ${i.changeTarget}` : null,
    i.businessImpact ? `  事業インパクト: ${i.businessImpact}` : null,
    i.audiences?.length ? `  語る相手: ${i.audiences.join(' / ')}` : null,
  ].filter(Boolean).join('\n')
    + '\n\n※ 本文に出してよい提供物の名前は上記のみ。他の商材名（似た名前のものを含む）を書かないこと。';

  // **決裁者・部長が読む前提のとき、機能の話に落とさないための指示。**
  // 実商談948件で予算・稟議は89社に出現し、その多くが
  // 「担当者単独では決まらない」構造だった（§44）。
  const audienceGuide = i.audiences?.some(a => a === '決裁者' || a === '部長')
    ? [
        '# 読む相手',
        `この骨子は ${i.audiences.join(' / ')} が読む前提で書くこと。`,
        '- 章3 Goal は「どの機能を入れるか」ではなく、**組織の何が変わり、業務フローがどう変わるか**で書く',
        i.changeTarget ? `  変える対象はカタログで決まっている: ${i.changeTarget}` : null,
        '- 章4 Gap も、機能の不足ではなく**今のやり方の構造**として書く',
        i.businessImpact ? `- 章9 Decision では事業に返るもの（${i.businessImpact}）を先に置き、費用はその後に書く` : null,
        '- 担当者がそのまま社内説明に使える言葉にする。専門用語で説明を要するものは避ける',
      ].filter(Boolean).join('\n')
    : null;

  const chapterBlock = CHAPTERS
    .map(c => `${c.no}. ${c.label}（${c.en}）${c.requiresEvidence ? ' ※材料ID必須' : ''}\n   ${c.brief}`)
    .join('\n');

  return [
    `# 対象企業\n${input.companyName}`,
    `# 提案の型\n${TYPE_GUIDE[input.proposalType]}`,
    `# 今回の狙い（提供物）\n${intentBlock}`,
    `# 材料（これ以外を顧客の事実の根拠にしないこと）\n${evidenceBlock}`,
    input.frame
      ? `# 文脈フレーム（どう語るか）\nフレーム名: ${input.frame.name}\n言い換え: ${input.frame.reframe}`
        + (input.frame.talkingPoints ? `\nトーキングポイント:\n${input.frame.talkingPoints}` : '')
        + (input.frame.avoidWhen ? `\n使わない場面: ${input.frame.avoidWhen}` : '')
      : null,
    audienceGuide,
    `# 章立て（この順で9章すべて書く）\n${chapterBlock}`,
    input.instruction ? `# 担当者からの指示（最優先で反映する）\n${input.instruction}` : null,
    `# 出力\nwrite_proposal_outline ツールを1回だけ呼んで返すこと。`,
  ].filter(Boolean).join('\n\n');
}

/** Notion B の「種別」から提案の型を決める */
export function proposalTypeFromKind(kind: string | null): ProposalType {
  const k = (kind ?? '').trim();
  // 支援メニュー / データ設計知見 は人が入って一緒に解く型
  if (k.includes('支援メニュー') || k.includes('データ設計')) return 'fde';
  return 'product';
}
