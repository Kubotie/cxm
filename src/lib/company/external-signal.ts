// ─── External Signal（外部WHOシグナル）───────────────────────────────────────
//
// 「今提案する理由」＝外部機会を、既存の signal_id 体系に乗る形で扱う。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11
//
// 原則:
//   1. **取り込んだ瞬間に signal_id へ変換する**。変換先が決まらない情報は取り込まない。
//      これをしないと外部情報が「読み物」で終わり、WHAT と接続できない。
//   2. **出典（URL または議事録ID）と日付が必須**。出典を出せないシグナルは採用しない。
//   3. **鮮度で減衰する**。外部機会は消耗品であり、古い情報で提案の型を変えない。
//   4. キーワード抽出は**推定**。必ず該当箇所（excerpt）を返し、人が打ち消せるようにする。
//
// 先行性（§11.2）: 求人 > 組織改編 > 中計/IR > 決算 > プレス > 議事録での言及。
// 議事録由来は最も遅い情報だが、追加コストゼロで今すぐ取れるため第一層として使う。
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { AppLogNotionMinutes } from '@/lib/nocodb/types';

// ── シグナル定義 ──────────────────────────────────────────────────────────────

export type ExternalSignalId =
  | 'X5_Mkt_DXInvestment'       // DX / AI 投資・予算の明記
  | 'X6_Org_NewTeamFormed'      // 新部署・新体制・新サイトの立ち上げ
  | 'X7_Org_ExecChange'         // 担当役員・部門長の交代
  | 'X8_Org_HiringSurge'        // 関連職種の採用・増員
  | 'X9_Mkt_CompetitorAdoption' // 競合ツールの導入・比較検討
  | 'X10_Mkt_StrategyShift';    // 事業方針の転換

/** 情報の入手元。先行性の高い順に並べてある（§11.2） */
export type IntelSource =
  | 'hiring'   // 求人（最速: 組織が動く前に出る）
  | 'press'    // プレスリリース・人事発表
  | 'ir'       // 中期経営計画・IR・決算
  | 'news'     // 業界ニュース・アナリストレポート
  | 'manual'   // 担当者の手入力
  | 'minutes'; // 議事録での言及（最も遅い）

export interface ExternalSignalMeta {
  label:       string;
  /** 提案の「今やる理由」になるか（true = opportunity 判定に使う） */
  isOpportunity: boolean;
  /** 何が起きたことを示すか（UI の説明文） */
  description: string;
}

export const EXTERNAL_SIGNAL_META: Record<ExternalSignalId, ExternalSignalMeta> = {
  X5_Mkt_DXInvestment: {
    label: 'DX / AI 投資',
    isOpportunity: true,
    description: '中期経営計画・IR で DX / AI への投資や予算が明示された。投資余力がある領域を示す',
  },
  X6_Org_NewTeamFormed: {
    label: '新体制・新サイト',
    isOpportunity: true,
    description: '新部署・専任チーム・新規サイトが立ち上がった。新しい計測/改善の対象が発生する',
  },
  X7_Org_ExecChange: {
    label: '担当者・体制の交代',
    isOpportunity: true,
    description: '担当役員や部門長が交代した。方針が引き直される時期で、再提案の起点になる',
  },
  X8_Org_HiringSurge: {
    label: '関連職種の採用',
    isOpportunity: true,
    description: 'データ・マーケ・DX 関連職種の求人が出ている。組織が動く前の最速の先行指標',
  },
  X9_Mkt_CompetitorAdoption: {
    label: '競合ツールの検討',
    isOpportunity: false,
    description: '競合ツールの導入・比較検討が確認された。機会ではなく摩擦として扱う',
  },
  X10_Mkt_StrategyShift: {
    label: '事業方針の転換',
    isOpportunity: true,
    description: '注力領域や事業方針が変わった。提案の文脈を組み替える必要がある',
  },
};

/** opportunity 判定に使うシグナル */
export const OPPORTUNITY_SIGNAL_IDS: ExternalSignalId[] =
  (Object.keys(EXTERNAL_SIGNAL_META) as ExternalSignalId[])
    .filter(id => EXTERNAL_SIGNAL_META[id].isOpportunity);

// ── 鮮度 ──────────────────────────────────────────────────────────────────────

/**
 * 外部機会の鮮度しきい値（日）。
 * 外部機会は消耗品であり、古い情報で提案の型を変えない。
 */
export const FRESHNESS = {
  /** これ以内なら機会として有効 */
  activeDays: 180,
  /** これ以内なら「新しい」として強調表示 */
  recentDays: 60,
} as const;

/**
 * opportunity 判定に必要な確信度の下限。
 *
 * 議事録のキーワード一致（0.35）だけで「今提案する理由がある」と断定してはいけない。
 * 「交代」「新体制」などの語は議事録に頻出し、機会ではない文脈（解約検討の背景説明など）
 * でも一致してしまうため。
 *
 * 低確信度のものは candidateSignals として UI に出し、担当者が確認して
 * 登録（＝確信度の高いシグナルに昇格）したものだけを判定に使う。
 * 観測 → 推定 → 確定 の3層モデル（§9.2）と同じ扱い。
 */
export const CONFIDENCE_THRESHOLD = 0.5;

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface ExternalSignalItem {
  signalId:   ExternalSignalId;
  /** 見出し（1行で何が起きたか） */
  headline:   string;
  /** 根拠となる該当箇所。抽出元の原文をそのまま切り出す */
  excerpt:    string;
  source:     IntelSource;
  /** 出典URL。議事録由来の場合は null（sourceRef で辿る） */
  sourceUrl:  string | null;
  /** 出典の識別子（議事録ID / 資料名など） */
  sourceRef:  string | null;
  /** 事象の日付 "YYYY-MM-DD" */
  occurredAt: string | null;
  /** 0-1。キーワード抽出は低め、手入力・LLM構造化は高め */
  confidence: number;
  /** 担当者が打ち消した場合 true（表示はするが判定に使わない） */
  dismissed:  boolean;
}

export interface ExternalOpportunityVM {
  /** 提案の「今やる理由」があるか。readiness の opportunity 入力になる */
  hasOpportunity: boolean;
  /** 有効（鮮度内・未打ち消し・opportunity 種別）なシグナル */
  activeSignals:  ExternalSignalItem[];
  /**
   * 確信度が下限に届かない候補（議事録のキーワード一致など）。
   * 判定には使わないが、担当者が確認して登録できるよう UI に出す。
   */
  candidateSignals: ExternalSignalItem[];
  /** 鮮度切れ・打ち消し済みを含む全シグナル（新しい順） */
  allSignals:     ExternalSignalItem[];
  /** 摩擦として扱うシグナル（競合検討など） */
  frictionSignals: ExternalSignalItem[];
  /** 最新の事象日 */
  latestDate:     string | null;
  /** 情報源の種別（先行性の評価に使う） */
  sources:        IntelSource[];
}

export const EMPTY_EXTERNAL_OPPORTUNITY: ExternalOpportunityVM = {
  hasOpportunity:  false,
  activeSignals:   [],
  candidateSignals: [],
  allSignals:      [],
  frictionSignals: [],
  latestDate:      null,
  sources:         [],
};

// ── 集約 ──────────────────────────────────────────────────────────────────────

/**
 * 外部シグナル群から「今提案する理由があるか」を判定する。
 *
 * 判定条件（すべて満たす）:
 *   - opportunity 種別のシグナルである
 *   - 鮮度が activeDays 以内（日付不明は採用しない。古い可能性を排除できないため）
 *   - 担当者に打ち消されていない
 *   - 出典がある（URL または sourceRef）
 *   - 確信度が CONFIDENCE_THRESHOLD 以上（キーワード一致だけでは断定しない）
 *
 * しきい値に届かないものは candidateSignals に入れ、担当者の確認を待つ。
 */
export function buildExternalOpportunity(
  signals: ExternalSignalItem[],
  now: number = Date.now(),
): ExternalOpportunityVM {
  const sorted = [...signals].sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''));

  const isActive = (s: ExternalSignalItem): boolean => {
    if (s.dismissed) return false;
    if (!s.sourceUrl && !s.sourceRef) return false;   // 出典なしは採用しない
    const age = daysSince(s.occurredAt, now);
    if (age === null) return false;                    // 日付不明は採用しない
    return age <= FRESHNESS.activeDays;
  };

  const opportunitySignals = sorted.filter(s =>
    EXTERNAL_SIGNAL_META[s.signalId]?.isOpportunity && isActive(s));

  const activeSignals    = opportunitySignals.filter(s => s.confidence >= CONFIDENCE_THRESHOLD);
  const candidateSignals = opportunitySignals.filter(s => s.confidence <  CONFIDENCE_THRESHOLD);

  const frictionSignals = sorted.filter(s =>
    EXTERNAL_SIGNAL_META[s.signalId] && !EXTERNAL_SIGNAL_META[s.signalId].isOpportunity && !s.dismissed);

  return {
    hasOpportunity:  activeSignals.length > 0,
    activeSignals,
    candidateSignals,
    allSignals:      sorted,
    frictionSignals,
    latestDate:      sorted.find(s => s.occurredAt)?.occurredAt ?? null,
    sources:         [...new Set(sorted.map(s => s.source))],
  };
}

// ── 議事録からのキーワード抽出（第一層）──────────────────────────────────────
//
// 追加コストゼロで今すぐ動く層。精度は高くないので confidence を低く固定し、
// 必ず excerpt（該当箇所）を返して人が判断できるようにする。
// より精度の高い抽出は LLM 経由（prompts/external-intel-extract.ts）で行う。

interface KeywordRule {
  signalId: ExternalSignalId;
  /** いずれか1つでも含まれれば候補 */
  terms: string[];
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    signalId: 'X5_Mkt_DXInvestment',
    terms: ['DX投資', 'AI投資', 'DX推進', 'デジタル投資', '中期経営計画', '中計', 'DX予算', 'AI活用推進', 'デジタル戦略'],
  },
  {
    signalId: 'X6_Org_NewTeamFormed',
    terms: ['新設', '立ち上げ', '新部署', '専任チーム', '新チーム', '新サイト', 'サイトリニューアル', '新規事業', '新体制'],
  },
  {
    signalId: 'X7_Org_ExecChange',
    terms: ['着任', '就任', '交代', '異動', '体制変更', '組織変更', '組織改編', '新任', '後任', '引き継ぎ'],
  },
  {
    signalId: 'X8_Org_HiringSurge',
    terms: ['採用', '求人', '増員', '人材募集', '中途採用'],
  },
  {
    signalId: 'X10_Mkt_StrategyShift',
    terms: ['方針転換', '事業方針', '戦略変更', '注力領域', '重点領域', '方針が変わ', '注力する'],
  },
];

/** excerpt に前後どれだけ含めるか */
const EXCERPT_PADDING = 70;

/**
 * 議事録本文からキーワードで外部事象の言及を抽出する。
 *
 * ⚠️ 推定であり確定ではない。confidence は 0.35 固定（低め）で返し、
 *    UI では「候補」として扱う。判断は人に返す。
 */
export function extractExternalSignalsFromMinutes(
  minutes: AppLogNotionMinutes[],
): ExternalSignalItem[] {
  const out: ExternalSignalItem[] = [];

  for (const m of minutes) {
    const text = `${m.title}\n${m.body ?? ''}`;
    if (!text.trim()) continue;

    for (const rule of KEYWORD_RULES) {
      const hit = rule.terms.find(t => text.includes(t));
      if (!hit) continue;

      out.push({
        signalId:   rule.signalId,
        headline:   `議事録で「${hit}」に言及`,
        excerpt:    excerptAround(text, hit, EXCERPT_PADDING),
        source:     'minutes',
        sourceUrl:  null,
        sourceRef:  `minutes:${m.id}｜${m.title}`,
        occurredAt: m.meetingDate,
        confidence: 0.35,
        dismissed:  false,
      });
    }
  }

  return out.sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''));
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

export function daysSince(dateStr: string | null | undefined, now: number = Date.now()): number | null {
  if (!dateStr) return null;
  const t = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`).getTime();
  if (isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

/** キーワード周辺を切り出す。改行は空白に潰して1行にする */
function excerptAround(text: string, term: string, padding: number): string {
  const idx = text.indexOf(term);
  if (idx < 0) return '';
  const start = Math.max(0, idx - padding);
  const end   = Math.min(text.length, idx + term.length + padding);
  const body  = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}
