// ─── 解約レーダー：言質抽出プロンプト ─────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §2 層3
//
// 議事録・Intercom・チケット本文から「解約に直結する発言」を**原文引用つきで**拾う。
// エレコムの決定打（2026-07-03「自動更新でない方が安心だよねという話になっている」）は
// NocoDB に保存されていたのに、どのシグナルにもなっていなかった。ここがそれを埋める。
//
// 設計上の要:
//   1. **必ず原文を引用させる。** 要約だけを見せると判断の根拠を誤らせる。
//      4月の AI サマリーが「活動イベント数17なので比較的活発」と逆の安心を与えた失敗の再来を防ぐ。
//   2. **無ければ空で返させる。** 拾いたいバイアスがかかると全社に言質が立ち、critical が汚れる。
//   3. 出力は必ず人のレビューを通す（review_status=pending で保存し、承認まで加点しない）。

export const AI_CONFIG_KEY_CHURN_VOICE = 'churn_voice_extract';

export const CHURN_VOICE_SYSTEM_PROMPT = [
  'あなたは BtoB SaaS のカスタマーサクセス責任者です。',
  '顧客との議事録・問い合わせ本文から、**契約の継続判断に直接影響する発言だけ**を抜き出します。',
  '',
  '# 抽出する意図（intent_type）',
  'V1 自動更新の回避 — 自動更新をやめたい、稟議・決裁を通す必要がある、契約管理を厳格化した、など契約手続きへの言及',
  'V2 他社比較        — 競合ツール名を挙げた比較、「◯◯では見えた/できた」という他社優位の言及、乗り換え検討',
  'V3 効果を説明できない — 導入効果を社内に説明・報告できない、ROI が示せない、成果の因果が特定できない',
  'V4 製品起因の不信   — 不具合でクレームになった、頼れないので別の手段に切り替える、といった製品への信頼低下',
  'V5 体制縮小        — 予算削減、担当者の離任・異動で推進役が不在、部署解体などの体制変更',
  '',
  '# 厳守すること',
  '- **quoted_text は必ず原文のまま**引用する。要約・言い換え・補完をしてはいけない。',
  '  原文が長い場合は、意図が分かる最小限の連続した一文を切り出す（前後を繋げて創作しない）。',
  '- 該当する発言が無ければ hits を空配列で返す。**無理に拾わない。**',
  '  「活用が進んでいない」「もっと使いたい」程度の一般的な感想は言質ではない。',
  '- 将来の希望・要望（「こういう機能が欲しい」）は言質ではない。契約継続の判断に触れているものだけ。',
  '- 自社（提供側）の発言は対象外。**顧客側の発言だけ**を拾う。',
  '- confidence は「その発言が契約の継続判断に影響する確信度」。',
  '  0.9 以上 = 契約や他社比較に明示的に言及、0.7 前後 = 強く示唆、0.5 未満は返さない。',
  '- occurred_at は本文中に日付があればそれを、無ければ与えられた文書日付を使う。',
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
              description: '0.5〜1.0。0.5 未満のものは返さない',
            },
          },
          required: ['intent_type', 'quoted_text', 'reason', 'confidence'],
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

/** 1文書ぶんのユーザープロンプト */
export function buildChurnVoicePrompt(doc: {
  companyName: string;
  sourceType: string;
  title: string | null;
  occurredAt: string;
  body: string;
}): string {
  return [
    `# 顧客: ${doc.companyName}`,
    `# 文書種別: ${doc.sourceType}`,
    `# 日付: ${doc.occurredAt}`,
    doc.title ? `# タイトル: ${doc.title}` : '',
    '',
    '# 本文',
    doc.body,
  ].filter(Boolean).join('\n');
}
