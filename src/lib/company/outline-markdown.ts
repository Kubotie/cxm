// ─── 提案骨子を Markdown にする ──────────────────────────────────────────────
//
// 画面の表示と .md ファイルで内容がずれないよう、変換をここ1箇所に置く。
//
// 出力方針:
//   - 章見出しは `## <番号>. <日本語>（<英語>）`。9章の型をそのまま残す
//   - **根拠（材料）を残す。** どの記述がどこから来たかを .md 側でも辿れるようにする
//   - 仮定・触れない方がよいこと・材料不足も落とさない。
//     都合の悪い情報を消した .md を配ると、判断を誤らせる
//
// 副作用なし。サーバー・クライアント両対応。

import type { ProposalOutlineResponse } from '@/app/api/company/[companyUid]/proposal-outline/route';

export function outlineToMarkdown(input: {
  outline:     ProposalOutlineResponse;
  companyName: string;
  /** 生成日時（"YYYY-MM-DD HH:mm"）。呼び出し側で作って渡す */
  generatedAt: string;
  instruction?: string | null;
}): string {
  const o = input.outline;
  const s = o.executiveSummary;
  const L: string[] = [];

  L.push(`# ${o.title || '提案骨子'}`, '');
  L.push(`- 対象: ${input.companyName}`);
  L.push(`- 狙い: ${o.intent.displayName}`);
  L.push(`- 提案の型: ${o.proposalType === 'fde' ? 'FDE型（一緒に解をつくる）' : '通常製品型（すでにある解を早く使う）'}`);
  if (o.frame) L.push(`- 語り口: ${o.frame}`);
  L.push(`- 作成: ${input.generatedAt}（${o.model}）`);
  if (input.instruction?.trim()) L.push(`- 生成時の指示: ${input.instruction.trim()}`);
  L.push('');

  if (o.warnings.length > 0) {
    L.push('> [!WARNING]');
    for (const w of o.warnings) L.push(`> ${w}`);
    L.push('');
  }

  L.push('## 0. Executive Summary', '');
  L.push('| | |', '|---|---|');
  const rows: Array<[string, string]> = [
    ['何が問題か', s.problem], ['何を目指すか', s.goal], ['何を提案するか', s.proposal],
    ['期待できる成果', s.outcome], ['次に決めてほしいこと', s.decision],
  ];
  for (const [k, v] of rows) if (v) L.push(`| **${k}** | ${escapeCell(v)} |`);
  L.push('');

  for (const c of o.chapters) {
    if (!c.text.trim() && c.bullets.length === 0) continue;
    L.push(`## ${c.no}. ${c.label}（${c.en}）`, '');
    if (c.unsourced) {
      L.push('> [!CAUTION]', '> 顧客の事実を述べる章ですが、根拠となる情報が挙がっていません。そのまま使わないでください。', '');
    }
    if (c.text.trim()) L.push(c.text.trim(), '');
    if (c.bullets.length > 0) {
      for (const b of c.bullets) L.push(`- ${b}`);
      L.push('');
    }
    if (c.assumptions.length > 0) {
      L.push('**この章で置いた仮定**', '');
      for (const a of c.assumptions) L.push(`- ${a}`);
      L.push('');
    }
    if (c.evidence.length > 0) {
      const list = c.evidence
        .map(e => `${e.title}${e.asOf ? `（${e.asOf}）` : ''}[${confidenceJa(e.confidence)}]`)
        .join(' / ');
      L.push(`<sub>根拠: ${list}</sub>`, '');
    }
  }

  if (o.avoid.length > 0) {
    L.push('## 触れない方がよいこと', '');
    for (const a of o.avoid) L.push(`- **${a.text}** — ${a.reason}`);
    L.push('');
  }

  if (o.missingEvidence.length > 0) {
    L.push('## 材料が足りず書けなかったこと', '');
    for (const m of o.missingEvidence) L.push(`- ${m}`);
    L.push('');
  }

  L.push('---', '');
  L.push('<sub>この骨子は選択された材料だけを根拠に生成されています。');
  L.push('観測値は断定、推論・申告は出所付きで記述されています。判断は根拠を確認のうえ行ってください。</sub>');

  return L.join('\n');
}

function confidenceJa(v: string): string {
  return v === 'measured' ? '観測' : v === 'inferred' ? '推論' : v === 'stated' ? '申告' : v;
}

/** テーブルセルに入れるので改行とパイプを潰す */
function escapeCell(v: string): string {
  return v.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/** ダウンロード用のファイル名。記号はファイル名に使えないので落とす */
export function outlineFileName(companyName: string, intentName: string, date: string): string {
  const safe = (v: string) => v.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
  return `提案骨子_${safe(companyName)}_${safe(intentName)}_${date.slice(0, 10)}.md`;
}
