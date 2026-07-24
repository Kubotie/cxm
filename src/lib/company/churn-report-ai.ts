// ─── 解約遡及分析の AI サマリー生成 ──────────────────────────────────────────
//
// generateChurnRetrospective() の結果を Claude に渡して、
// CSM が週次で確認する「解約傾向・予兆パターン・推奨アクション」を JSON で返す。

import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import type { ChurnRetrospectiveReport } from './churn-retrospective';
import {
  computeSilentChurnOverlap,
  type ChronicSilentSnapshot,
  type SilentChurnOverlap,
} from '@/lib/nocodb/chronic-silent';

export interface ChurnAiReport {
  summary:         string;          // 3-5 文の全体総括
  keyFindings:     string[];        // 発見事項 (bullet)
  recommendations: string[];        // 推奨アクション (bullet)
  modelUsed:       string;
}

const CHURN_REPORT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'generate_churn_analysis',
    description: 'CSM 向け解約遡及分析の週次サマリーを生成する',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type:        'string',
          description: '3-5 文で全体状況を総括する。日本語で書くこと。',
        },
        key_findings: {
          type:  'array',
          items: { type: 'string' },
          description: '4-6 個の発見事項。数値・企業名を含めた具体的な観察を書くこと。日本語。',
        },
        recommendations: {
          type:  'array',
          items: { type: 'string' },
          description: '3-5 個の推奨アクション。CSM が今週着手すべきものを優先度順に並べる。日本語。',
        },
      },
      required: ['summary', 'key_findings', 'recommendations'],
      additionalProperties: false,
    },
  },
} as const;

/** 休眠（chronic silent）シグナルのプロンプト節を組み立てる。overlap が無ければ空文字。 */
function buildSilentSection(overlap: SilentChurnOverlap | null): string {
  if (!overlap) return '';
  const newList = overlap.silentOnlyNew
    .slice(0, 15)
    .map(c => `  - ${c.companyName ?? c.sfAccountId} (解約=${c.churnDate}, ${c.riskLevel ?? '—'}, 遷移=${c.portraitSequence ?? '—'})`)
    .join('\n');
  return `

## Ptengine 休眠シグナル（chronic silent, 参考: 2ヶ月連続で分析機能の操作が少なく直近30日アクティブも低い<3 有料プロジェクト / 基準月 ${overlap.refMonth}）
- スナップショット上の休眠アカウント総数: ${overlap.silentAccountCount} 社
- 今回の解約 ${overlap.churnTotal} 社のうち、休眠だった: ${overlap.churnSilentCount} 社
  - うち Metabase 予兆（Downsell/別PJ解約）と重複: ${overlap.overlapWithMetabase} 社
  - 休眠のみで拾えた純新規（Metabase 未検知）: ${overlap.silentOnlyNewCount} 社
- 休眠シグナルの精度（休眠アカウント中、窓内に実際に解約した割合）: ${(overlap.precision * 100).toFixed(1)}%
${overlap.silentOnlyNewCount > 0 ? `- 休眠のみ純新規リスト:\n${newList}` : ''}

⚠️ caveat: このスナップショットは基準月時点の断面のため、「解約後に休眠化した」post-churn ケースを含みうる。純新規は解約日より前に休眠だったかを個別に確認すること。また精度が低い（＝休眠は件数が多く誤検知が多い）ため、単独アラートではなく他シグナルの補助として扱う前提で言及すること。`;
}

function buildPrompt(report: ChurnRetrospectiveReport, overlap: SilentChurnOverlap | null): string {
  const { window, churnEvents, aggregate, perCompany } = report;

  const tierBreakdown = aggregate.byTier
    .map(t => `  Tier ${t.tier ?? 'なし'}: ${t.count}社 (snapshot予兆=${t.warningCountSnapshot}, Metabase予兆=${t.warningCountMetabase})`)
    .join('\n');

  const topWarnings = perCompany
    .filter(c => c.metabase.hasWarning || c.firstWarningAt !== 'none')
    .slice(0, 20)
    .map(c => {
      const signals: string[] = [];
      if (c.firstWarningAt !== 'none') signals.push(`snapshot=${c.firstWarningAt}`);
      if (c.metabase.hadDownsell)             signals.push('Downsell先行');
      if (c.metabase.hadPriorChurnOnSameSfId) signals.push('別PJ解約先行');
      if (c.metabase.hadTrialRegression)      signals.push('Trial逆行');
      const lead = c.metabase.earliestSignalDaysBefore !== null
        ? `${c.metabase.earliestSignalDaysBefore}日前`
        : '—';
      return `- ${c.canonicalName ?? c.sfAccountId} (Tier${c.tier ?? 'なし'}, 解約=${c.churnDate}): ${signals.join(', ') || '無'}、リードタイム=${lead}`;
    })
    .join('\n');

  return `# 解約遡及分析 週次レポートを作成してください

## 分析期間
${window.from} 〜 ${window.to} (${window.days}日間)

## 統計
- 解約企業数: ${churnEvents.total}
- NocoDB マッチ数: ${churnEvents.mapped}
- スナップショット取得数: ${churnEvents.snapshotFound}
- Tier 別:
${tierBreakdown}

## Snapshot 由来シグナル (30/60/90日前スナップショットで overall_health=at_risk/critical, stalled/support あり)
- d90時点で予兆あり: ${aggregate.firstWarningAtD90}
- d60時点で予兆あり: ${aggregate.firstWarningAtD60}
- d30時点で予兆あり: ${aggregate.firstWarningAtD30}
- 予兆なし: ${aggregate.neverWarning}
- d30 検知率: ${(aggregate.warningRateD30 * 100).toFixed(1)}%

## Metabase Package Events 由来シグナル (Downsell / PriorChurn / Trial 先行)
- 予兆あり: ${aggregate.metabase.warningCount} 社 (${(aggregate.metabase.warningRate * 100).toFixed(1)}%)
  - Downsell 先行: ${aggregate.metabase.hadDownsellCount}
  - 別PJ解約 先行: ${aggregate.metabase.hadPriorChurnCount}
  - Trial 逆行: ${aggregate.metabase.hadTrialRegressionCount}
- 平均リードタイム: ${aggregate.metabase.avgEarliestDaysBefore ? `${aggregate.metabase.avgEarliestDaysBefore.toFixed(1)}日前` : '—'}

## 予兆が立った主要企業 (最大20社)
${topWarnings || '(該当なし)'}
${buildSilentSection(overlap)}

## 依頼
CSM 向けの週次レポートとして generate_churn_analysis を呼び出してください。

- **summary**: 今週の解約状況と予兆察知の効き具合を 3〜5 文で要約
- **key_findings**: 具体的な数値・企業名を含めた発見事項 4〜6 個
- **recommendations**: CSM が今週アクション取るべきこと 3〜5 個（Tier 昇格候補、監視強化、追客タイミング等）

余計な前置きは書かず、実務で使える洞察に絞ること。`;
}

/**
 * ChurnRetrospectiveReport を AI に渡して週次サマリー JSON を返す。
 * @param report    解約遡及分析結果
 * @param silentSnapshot Ptengine 休眠スナップショット（あれば AI プロンプトに休眠シグナル節を注入）
 */
export async function generateChurnAiReport(
  report: ChurnRetrospectiveReport,
  silentSnapshot: ChronicSilentSnapshot | null = null,
): Promise<ChurnAiReport> {
  const client = getAnthropicClient();
  const model  = getAnthropicModel();

  const overlap = computeSilentChurnOverlap(
    silentSnapshot,
    report.perCompany.map(c => ({
      sfAccountId:        c.sfAccountId,
      canonicalName:      c.canonicalName,
      churnDate:          c.churnDate,
      metabaseHasWarning: c.metabase.hasWarning,
    })),
  );

  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    tools: [CHURN_REPORT_TOOL],
    tool_choice: { type: 'function', function: { name: 'generate_churn_analysis' } },
    messages: [
      {
        role: 'user',
        content: buildPrompt(report, overlap),
      },
    ],
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error('AI サマリーの生成に失敗しました (tool_call が返ってこない)');
  }
  const parsed = JSON.parse(toolCall.function.arguments) as {
    summary:         string;
    key_findings:    string[];
    recommendations: string[];
  };

  return {
    summary:         parsed.summary,
    keyFindings:     parsed.key_findings,
    recommendations: parsed.recommendations,
    modelUsed:       model,
  };
}
