// ─── support_case_ai_state 再生成・鮮度判定ポリシー ───────────────────────────
// AI state の再生成可否・鮮度・human review 可否のルールを 1 箇所に閉じ込める。
// UI / API Routes / rebuild scripts はこのファイルを参照する。
//
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。

import type { SupportCaseAiStateRecord } from '@/lib/nocodb/support-ai-state-types';

// ── 定数 ──────────────────────────────────────────────────────────────────────

/** AI state を stale と判定する最大経過時間（ミリ秒）— 7 日 */
const MAX_AI_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── 鮮度判定 ──────────────────────────────────────────────────────────────────

/**
 * `sourceUpdatedAt` が `lastAiUpdatedAt` より新しい場合 true を返す。
 * どちらかが null の場合は比較できないので false を返す（stale とは言えない）。
 *
 * @param sourceUpdatedAt  元ケースの更新日時（YYYY-MM-DD HH:MM:SS or ISO）
 * @param lastAiUpdatedAt  最後に AI state が更新された日時
 */
export function shouldRefreshAi(
  sourceUpdatedAt: string | null | undefined,
  lastAiUpdatedAt: string | null | undefined,
): boolean {
  if (!sourceUpdatedAt || !lastAiUpdatedAt) return false;
  try {
    const srcMs  = Date.parse(sourceUpdatedAt.replace(' ', 'T'));
    const aiMs   = Date.parse(lastAiUpdatedAt.replace(' ', 'T'));
    if (isNaN(srcMs) || isNaN(aiMs)) return false;
    return srcMs > aiMs;
  } catch {
    return false;
  }
}

/**
 * AI state が stale（古くなっている）かどうか。
 *
 * stale 判定条件（いずれか 1 つでも true なら stale）:
 *   1. `ai_version` が空 → AI 未生成
 *   2. `source_updated_at > last_ai_updated_at` → 元ケース更新後に AI 未再生成
 *   3. `last_ai_updated_at` から MAX_AI_AGE_MS 以上経過
 *
 * record が null → stale（AI 未生成）
 */
export function isAiStale(
  record: SupportCaseAiStateRecord | null | undefined,
): boolean {
  if (!record) return true;

  // 1. ai_version が空
  if (!record.aiVersion) return true;

  // 2. 元ケースが更新されている
  if (shouldRefreshAi(record.sourceUpdatedAt, record.lastAiUpdatedAt)) return true;

  // 3. 最終更新から MAX_AI_AGE_MS 以上経過
  if (record.lastAiUpdatedAt) {
    try {
      const aiMs  = Date.parse(record.lastAiUpdatedAt.replace(' ', 'T'));
      if (!isNaN(aiMs) && Date.now() - aiMs > MAX_AI_AGE_MS) return true;
    } catch {
      // parse 失敗は stale 扱いにしない（誤 false positive を避ける）
    }
  }

  return false;
}

// ── 再生成可否 ────────────────────────────────────────────────────────────────

/**
 * AI state を再生成してよいかどうか。
 *
 * 再生成不可の条件:
 *   - `human_review_status === 'approved'`（人が確定させた状態）
 *
 * 再生成可の状態:
 *   - record が null（AI 未生成）
 *   - `pending` / `reviewed` / `corrected`（いずれも再生成可）
 */
export function canRegenerateAi(
  record: SupportCaseAiStateRecord | null | undefined,
): boolean {
  if (!record) return true;             // AI 未生成 → 生成可
  return record.humanReviewStatus !== 'approved';
}

// ── Human Review 可否 ─────────────────────────────────────────────────────────

/**
 * 人手レビューを実施してよいかどうか。
 *
 * 条件:
 *   - AI state が存在すること（record !== null）
 *   - human_review_status が 'pending' または 'corrected'
 *     （'reviewed' / 'approved' は再レビュー不要 — UI で分岐させる）
 *
 * 'reviewed' / 'approved' を更新したい場合は UI での明示的な「レビュー解除」操作を経ること。
 */
export function canHumanReview(
  record: SupportCaseAiStateRecord | null | undefined,
): boolean {
  if (!record) return false;  // AI state がなければレビュー対象なし
  const s = record.humanReviewStatus;
  return s === 'pending' || s === 'corrected';
}

/**
 * AI state を「レビュー済み」に戻せるかどうか（approved → reviewed へのダウングレード）。
 * 'approved' のみ対象。
 */
export function canDowngradeFromApproved(
  record: SupportCaseAiStateRecord | null | undefined,
): boolean {
  return record?.humanReviewStatus === 'approved';
}

// ── ポリシーサマリー（UI でまとめて使う場合） ────────────────────────────────

export interface AiStatePolicy {
  isStale:           boolean;
  canRegenerate:     boolean;
  canReview:         boolean;
  canDowngrade:      boolean;
  shouldRefresh:     boolean;
}

/**
 * record から全ポリシーを一括で評価して返す。
 */
export function evaluateAiPolicy(
  record: SupportCaseAiStateRecord | null | undefined,
): AiStatePolicy {
  return {
    isStale:       isAiStale(record),
    canRegenerate: canRegenerateAi(record),
    canReview:     canHumanReview(record),
    canDowngrade:  canDowngradeFromApproved(record),
    shouldRefresh: shouldRefreshAi(record?.sourceUpdatedAt, record?.lastAiUpdatedAt),
  };
}

// ── AI 値採用ポリシー（ViewModel / UI 用） ────────────────────────────────────
//
// 責務境界:
//   source*     NocoDB DB の原値。変更しない。
//   ai*         AI が判定した値。support_case_ai_state テーブルに保存。
//   effective*  UI / 運用上で実際に使う値。以下のポリシーで決定する。
//
// human_review_status ごとの effective 採用ルール:
//   pending    → AI値を effective に採用。人未確認。
//   reviewed   → AI値を effective に採用。人が確認済み。
//   corrected  → 将来は人補正フィールド (corrected_severity 等) を effective に優先採用。
//                現時点では補正値フィールドが未実装のため AI値を使用。
//                ※ NocoDB に corrected_severity / corrected_routing_status 等を追加後、
//                  adoptAiValues を false にして補正値を優先すること。
//   approved   → AI値を effective に固定採用。再生成不可（isLocked = true）。

export type SupportCaseAiAdoptionPolicy =
  | 'adopt'            // pending / reviewed: AI値を effective に採用
  | 'adopt_corrected'  // corrected: 将来は人補正値優先（現在は AI値をフォールバック）
  | 'adopt_approved';  // approved: AI値固定採用、再生成ブロック

export interface SupportCaseAiAdoptionResult {
  policy:        SupportCaseAiAdoptionPolicy;
  /** true → AI値を effective 値として採用する */
  adoptAiValues: boolean;
  /** false → Refresh AI / 再生成をブロック */
  canRegenerate: boolean;
  /** approved のみ true — UI でロックマーク等に利用 */
  isLocked:      boolean;
  /** UI 表示用の短い説明（バッジラベルなど） */
  reviewNote:    string;
}

// ── AI Freshness Status ───────────────────────────────────────────────────────
//
// AI state の「鮮度」を 4 段階で表す。
//   fresh   : hasAiState=true かつ 7日以内に生成
//   stale   : hasAiState=true だが古い（lastAiUpdatedAt > MAX_AI_AGE_MS）
//   missing : hasAiState=false（AI 未生成）
//   locked  : humanReviewStatus === 'approved'（再生成不可）
//
// 判定順: missing → locked → stale → fresh
// approved は stale でも locked を優先（再生成の可否が最重要）。

export type AiFreshnessStatus = 'fresh' | 'stale' | 'missing' | 'locked';

/**
 * ViewModel / Record 両対応の鮮度判定。
 * hasAiState / humanReviewStatus / lastAiUpdatedAt の 3 フィールドのみ使用。
 * SupportCaseAiViewModel・SupportCaseAiStateRecord どちらの部分型も渡せる。
 */
export function getAiFreshnessStatus(state: {
  hasAiState:        boolean;
  humanReviewStatus: string | null | undefined;
  lastAiUpdatedAt:   string | null | undefined;
}): AiFreshnessStatus {
  if (!state.hasAiState) return 'missing';
  if (state.humanReviewStatus === 'approved') return 'locked';
  if (!state.lastAiUpdatedAt) return 'stale';  // タイムスタンプなし → stale 扱い
  try {
    const aiMs = Date.parse(state.lastAiUpdatedAt.replace(' ', 'T'));
    if (!isNaN(aiMs) && Date.now() - aiMs > MAX_AI_AGE_MS) return 'stale';
  } catch { /* parse 失敗は stale にしない（誤陽性回避）*/ }
  return 'fresh';
}

/** freshness ごとの UI ラベル・バッジスタイル・説明文 */
export const AI_FRESHNESS_LABELS: Record<AiFreshnessStatus, {
  label:       string;
  badgeClass:  string;
  description: string;
}> = {
  fresh:   {
    label:       'fresh',
    badgeClass:  'bg-teal-100 border-teal-200 text-teal-700',
    description: 'AI state が最新の状態です',
  },
  stale:   {
    label:       'stale',
    badgeClass:  'bg-amber-100 border-amber-200 text-amber-700',
    description: 'AI state が古くなっています。再生成を推奨します',
  },
  missing: {
    label:       'missing',
    badgeClass:  'bg-slate-100 border-slate-200 text-slate-500',
    description: 'AI state がありません。AI 生成を実行してください',
  },
  locked:  {
    label:       'locked',
    badgeClass:  'bg-green-100 border-green-200 text-green-700',
    description: '承認済みです。再生成はブロックされています',
  },
};

// ── Review Status Descriptions ────────────────────────────────────────────────
//
// human_review_status の意味一覧。
// UI tooltip / フィルタラベル / ドキュメントで共通使用すること。
// 各 status の意味・effective 採用ルール・再生成可否を明記する。

export const REVIEW_STATUS_DESCRIPTIONS: Record<string, {
  /** Queue フィルタ等で使う短いラベル */
  label:         string;
  /** Detail パネルの tooltip 等で使う説明文 */
  description:   string;
  /** AI 再生成が可能か */
  canRegenerate: boolean;
  /** AI 値を effective に採用するか */
  adoptAiValues: boolean;
}> = {
  pending: {
    label:         '未確認',
    description:   'AI が生成したがまだ人が確認していない状態。AI 値を effective に採用。再生成可能。',
    canRegenerate: true,
    adoptAiValues: true,
  },
  reviewed: {
    label:         '確認済み（補正なし）',
    description:   '内容を確認したが補正はしていない状態。AI 値をそのまま effective に採用。再生成可能。',
    canRegenerate: true,
    adoptAiValues: true,
  },
  corrected: {
    label:         '人が補正済み',
    description:   '人が AI 判断を補正した状態。補正フィールド実装後は補正値を effective に優先採用（現在は AI 値フォールバック）。再生成可能。',
    canRegenerate: true,
    adoptAiValues: true,
  },
  approved: {
    label:         '最終採用済み',
    description:   '内容を最終確認し承認済み。AI 値を effective に固定採用。再生成は不可。この状態から変更するには downgrade 操作が必要。',
    canRegenerate: false,
    adoptAiValues: true,
  },
};

/**
 * human_review_status から AI 値採用ポリシーを返す。
 *
 * status が null / undefined の場合は AI state なし扱い（source 値のみ使用）。
 * コンポーネント / merge helper から参照する。
 */
export function getSupportCaseAiAdoptionPolicy(
  humanReviewStatus: string | null | undefined,
): SupportCaseAiAdoptionResult {
  switch (humanReviewStatus) {
    case 'approved':
      return {
        policy:        'adopt_approved',
        adoptAiValues: true,
        canRegenerate: false,
        isLocked:      true,
        reviewNote:    'AI承認済み',
      };
    case 'corrected':
      return {
        policy:        'adopt_corrected',
        adoptAiValues: true,   // TODO: corrected 補正値フィールド実装後に false へ
        canRegenerate: true,
        isLocked:      false,
        reviewNote:    'AI修正済み',
      };
    case 'reviewed':
      return {
        policy:        'adopt',
        adoptAiValues: true,
        canRegenerate: true,
        isLocked:      false,
        reviewNote:    '確認済み',
      };
    case 'pending':
      return {
        policy:        'adopt',
        adoptAiValues: true,
        canRegenerate: true,
        isLocked:      false,
        reviewNote:    '未確認',
      };
    default:
      return {
        policy:        'adopt',
        adoptAiValues: false,
        canRegenerate: true,
        isLocked:      false,
        reviewNote:    '',
      };
  }
}
