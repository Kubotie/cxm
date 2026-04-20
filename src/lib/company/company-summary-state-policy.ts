// ─── company_summary_state 鮮度判定・ViewModel ────────────────────────────────
// UI / API Routes が参照する single source of truth。
// support-ai-state-policy.ts と同じ思想で設計。
//
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
//
// ── source_updated_at の定義 ─────────────────────────────────────────────────
//
//   【暫定実装】companies.updatedAt（NocoDB の UpdatedAt システムカラム）を使用。
//              AppCompany.updatedAt として格納し、regenerate / batch 時に渡す。
//              フォーマット: "YYYY-MM-DD HH:MM"（スペース区切り）
//
//   【将来目標】summary の根拠データ群（evidence, alerts, people）の
//              最大更新時刻に置き換える。
//              想定カラム: MAX(evidence.updated_at, alerts.updated_at, people.updated_at)
//              この変更により「evidence が追加されたが companies は更新されていない」
//              ケースでも stale を正しく検出できるようになる。
//
// ── human_review_status の意味 ───────────────────────────────────────────────
//
//   null      = レコードが存在しない、または初期状態（AI 生成前 / 旧データ）。
//               UI 上は「未確認」として扱う。isUnreviewed() で pending と同一視。
//
//   pending   = AI 生成済み・人間が未確認の状態（write helper がデフォルトで設定）。
//               null との違いは「AI が明示的に生成した」という記録があること。
//               UI 上は「未確認」として扱う。
//
//   reviewed  = 担当 CSM が内容を確認済み。再生成・上書き可。
//               batch review で一括設定可。
//
//   corrected = 担当 CSM が内容を補正済み（手動編集後）。再生成・上書き可。
//               batch review では通常 target にしない（個別対応済みのため）。
//
//   approved  = 正式承認済み。再生成・上書きは write helper レベルでブロック。
//               batch review で一括設定する場合は confirm step を必須とすること。
//               承認解除（→ reviewed）は downgrade 操作として明示的に行う。

import type { AppCompanySummaryState } from '@/lib/nocodb/types';

// ── 型定義 ──────────────────────────────────────────────────────────────────

/** human_review_status の有効値（null は別途 isUnreviewed() で扱う） */
export type SummaryHumanReviewStatus =
  | 'pending'
  | 'reviewed'
  | 'corrected'
  | 'approved';

/**
 * AI summary の「鮮度」を 4 段階で表す。
 *
 * 判定順: missing → locked → stale → fresh
 * approved は stale でも locked を優先（再生成ブロックが最重要）。
 */
export type SummaryFreshnessStatus = 'missing' | 'locked' | 'stale' | 'fresh';

// ── null / pending の統一 helper ──────────────────────────────────────────────

/**
 * human_review_status が「未確認」かどうかを返す。
 *
 * null と pending はどちらも「未確認」として扱う。
 *   - null    = レコードが存在しない or 旧データ（AI 生成前）
 *   - pending = AI 生成済み・未確認（write helper がデフォルトで設定）
 *
 * UI 表示・batch フィルタ・一括操作の対象判定に使う。
 */
export function isUnreviewed(
  humanReviewStatus: string | null | undefined,
): boolean {
  return !humanReviewStatus || humanReviewStatus === 'pending';
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

/** Company Detail が summary state を表示するために必要な導出値 */
export interface CompanySummaryViewModel {
  /** NocoDB にレコードが存在するか */
  hasSummary:        boolean;
  /** 鮮度ステータス */
  freshnessStatus:   SummaryFreshnessStatus;
  /** human_review_status === 'approved' */
  isApproved:        boolean;
  /** !isApproved（approved のみ再生成を禁止） */
  canRegenerate:     boolean;
  /** human_review_status の日本語ラベル（null/pending は「未確認」） */
  reviewStatusLabel: string;
  /** 保存状態の日本語ラベル（サイドバー等での短い表示用） */
  savedStatusLabel:  string;
  /** 最終 AI 更新日時（表示用 ISO 文字列 or null） */
  lastAiUpdatedAt:   string | null;
  /** 使用モデル名 */
  model:             string | null;
  /** AI バージョン */
  aiVersion:         string | null;
}

// ── Freshness 判定 ─────────────────────────────────────────────────────────────

/**
 * summary の鮮度を 4 段階で返す。
 *
 * 判定順（上から評価）:
 *   1. hasSummary=false                → "missing"
 *   2. humanReviewStatus === 'approved' → "locked"
 *   3. sourceUpdatedAt > lastAiUpdatedAt → "stale"
 *   4. それ以外                          → "fresh"
 *
 * sourceUpdatedAt が null の場合は stale にしない（不明は fresh 扱い）。
 * ※ source_updated_at の定義はファイル先頭コメントを参照。
 */
export function getSummaryFreshnessStatus(state: {
  hasSummary:        boolean;
  humanReviewStatus: string | null | undefined;
  sourceUpdatedAt:   string | null | undefined;
  lastAiUpdatedAt:   string | null | undefined;
}): SummaryFreshnessStatus {
  if (!state.hasSummary) return 'missing';
  if (state.humanReviewStatus === 'approved') return 'locked';

  if (state.sourceUpdatedAt && state.lastAiUpdatedAt) {
    try {
      const srcMs = Date.parse(state.sourceUpdatedAt.replace(' ', 'T'));
      const aiMs  = Date.parse(state.lastAiUpdatedAt.replace(' ', 'T'));
      if (!isNaN(srcMs) && !isNaN(aiMs) && srcMs > aiMs) return 'stale';
    } catch {
      // parse 失敗は stale にしない（誤陽性回避）
    }
  }

  return 'fresh';
}

// ── ViewModel ビルダー ────────────────────────────────────────────────────────

/**
 * human_review_status → 日本語ラベル。
 * null / pending はどちらも「未確認」を返す（isUnreviewed() と対応）。
 */
const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending:   '未確認',
  reviewed:  '確認済み',
  corrected: '補正済み',
  approved:  '承認済み',
};

function getReviewStatusLabel(status: string | null | undefined): string {
  if (!status || status === 'pending') return '未確認';
  return REVIEW_STATUS_LABELS[status] ?? '未確認';
}

/**
 * AppCompanySummaryState（または null）から CompanySummaryViewModel を生成する。
 * record=null の場合は "missing" 状態の ViewModel を返す。
 */
export function buildCompanySummaryViewModel(
  record: AppCompanySummaryState | null,
): CompanySummaryViewModel {
  if (!record) {
    return {
      hasSummary:        false,
      freshnessStatus:   'missing',
      isApproved:        false,
      canRegenerate:     true,
      reviewStatusLabel: '',
      savedStatusLabel:  '未保存',
      lastAiUpdatedAt:   null,
      model:             null,
      aiVersion:         null,
    };
  }

  const freshnessStatus = getSummaryFreshnessStatus({
    hasSummary:        true,
    humanReviewStatus: record.humanReviewStatus,
    sourceUpdatedAt:   record.sourceUpdatedAt,
    lastAiUpdatedAt:   record.lastAiUpdatedAt,
  });

  const isApproved = record.humanReviewStatus === 'approved';

  return {
    hasSummary:        true,
    freshnessStatus,
    isApproved,
    canRegenerate:     !isApproved,
    reviewStatusLabel: getReviewStatusLabel(record.humanReviewStatus),
    savedStatusLabel:  isApproved ? '承認済み（上書き不可）' : '保存済み',
    lastAiUpdatedAt:   record.lastAiUpdatedAt,
    model:             record.model || null,
    aiVersion:         record.aiVersion,
  };
}

// ── Freshness UI 設定 ────────────────────────────────────────────────────────

export const SUMMARY_FRESHNESS_CONFIG: Record<SummaryFreshnessStatus, {
  label:       string;
  badgeClass:  string;
  description: string;
}> = {
  missing: {
    label:       'missing',
    badgeClass:  'bg-slate-100 border-slate-200 text-slate-500',
    description: 'Company Summary がありません',
  },
  locked: {
    label:       'locked',
    badgeClass:  'bg-green-100 border-green-200 text-green-700',
    description: '承認済みです。再生成はブロックされています',
  },
  stale: {
    label:       'stale',
    badgeClass:  'bg-amber-100 border-amber-200 text-amber-700',
    description: '会社情報が更新されました。再生成を推奨します',
  },
  fresh: {
    label:       'fresh',
    badgeClass:  'bg-teal-100 border-teal-200 text-teal-700',
    description: 'Company Summary は最新の状態です',
  },
};

// ── 再生成可否 ────────────────────────────────────────────────────────────────

/**
 * AI summary を再生成してよいかどうか。
 * 再生成不可の条件: human_review_status === 'approved'
 */
export function canRegenerateSummary(
  record: AppCompanySummaryState | null | undefined,
): boolean {
  if (!record) return true;
  return record.humanReviewStatus !== 'approved';
}

// ── Review 可否 ───────────────────────────────────────────────────────────────

/**
 * Human Review を実施してよいかどうか。
 * 条件: record が存在 && human_review_status が 'approved' 以外
 */
export function canReviewSummary(
  record: AppCompanySummaryState | null | undefined,
): boolean {
  if (!record) return false;
  return record.humanReviewStatus !== 'approved';
}

/**
 * approved からダウングレード（→ reviewed）できるかどうか。
 */
export function canDowngradeFromApproved(
  record: AppCompanySummaryState | null | undefined,
): boolean {
  return record?.humanReviewStatus === 'approved';
}

// ── List ViewModel（batch 一覧・フィルタ用） ──────────────────────────────────
//
// ── batch review の運用ルール ─────────────────────────────────────────────────
//
//   【reviewed への一括設定】
//     - canBulkRegenerate=true（= !isApproved）の企業が対象。
//     - 再生成後に自動で reviewed に更新するユースケース等で使用。
//     - confirm step 不要。
//
//   【approved への一括設定】
//     - canBulkApprove=true（= hasSummary && !isApproved）の企業が対象。
//     - 一括承認は影響が大きいため、必ず confirm step を挟むこと。
//     - 承認後は regenerate・上書き保存が write helper レベルでブロックされる。
//     - 誤承認の回復手段: POST /review { status: 'reviewed' } でダウングレード可。
//
//   【locked（approved）への再生成】
//     - canBulkRegenerate=false のため batch の自動処理では skip される。
//     - 手動で承認解除してから再生成すること。
//
//   【batch 実行順序の推奨】
//     1. dry_run=true で対象リストを確認
//     2. locked 企業を除外確認（canBulkRegenerate=false）
//     3. 本実行（batch regenerate）
//     4. 結果確認後に必要に応じて batch review（reviewed）
//     5. 個別確認後に approved は手動で設定（batch approved は運用上禁止推奨）
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * regeneratePriority のスコア定義。
 * 数値が大きいほど再生成の優先度が高い。
 * batch 処理で「先に処理すべき企業」を並べ替える際に使用。
 */
const REGENERATE_PRIORITY: Record<SummaryFreshnessStatus, number> = {
  missing: 4,   // 最優先: summary が存在しない
  stale:   3,   // 次点: ソース更新後に未再生成
  fresh:   2,   // 通常: 最新だが定期更新対象にはなりえる
  locked:  1,   // 最低: 承認済みのため自動再生成は不可
};

/**
 * company summary state の一覧表示・フィルタ用 ViewModel。
 *
 * 用途:
 *   - batch regenerate / batch review の対象企業リスト表示
 *   - freshnessStatus と humanReviewStatus によるフィルタリング
 *   - 将来の Company List ページでの summary 状態カラム
 */
export interface CompanySummaryListItemViewModel {
  /** 企業 ID */
  companyUid:          string;
  /** 企業名 */
  companyName:         string;
  /** 鮮度ステータス */
  freshnessStatus:     SummaryFreshnessStatus;
  /** human_review_status（null = 未設定 = pending 相当。isUnreviewed() で統一判定） */
  humanReviewStatus:   SummaryHumanReviewStatus | null;
  /** 承認済みか */
  isApproved:          boolean;
  /** 再生成可否（= !isApproved） */
  canRegenerate:       boolean;
  /** 最終 AI 更新日時 */
  lastAiUpdatedAt:     string | null;
  /** ソース更新日時（stale 判定の根拠） */
  sourceUpdatedAt:     string | null;

  // ── 派生表示値 ────────────────────────────────────────────────────────────

  /**
   * review グループラベル（一覧の group-by・フィルタ UI 用）。
   * null / pending → 「未確認」（isUnreviewed() と対応）
   */
  reviewGroupLabel:    string;

  /**
   * 再生成優先度スコア（降順で並べると処理推奨順になる）。
   * missing=4 > stale=3 > fresh=2 > locked=1
   */
  regeneratePriority:  number;

  /**
   * batch regenerate の対象にできるか。
   * false（= approved/locked）の企業は batch でスキップされる。
   */
  canBulkRegenerate:   boolean;

  /**
   * batch approve の対象にできるか。
   * summary が存在し、かつ未承認の企業のみ true。
   * missing と locked は false。
   */
  canBulkApprove:      boolean;
}

/**
 * 企業情報 + summary record から List ViewModel を構築する。
 * Company List や batch 処理の進捗表示に使う。
 */
export function buildCompanySummaryListItemViewModel(
  companyUid:  string,
  companyName: string,
  record:      AppCompanySummaryState | null,
): CompanySummaryListItemViewModel {
  const vm = buildCompanySummaryViewModel(record);
  const humanReviewStatus = (record?.humanReviewStatus as SummaryHumanReviewStatus | null) ?? null;

  return {
    companyUid,
    companyName,
    freshnessStatus:    vm.freshnessStatus,
    humanReviewStatus,
    isApproved:         vm.isApproved,
    canRegenerate:      vm.canRegenerate,
    lastAiUpdatedAt:    vm.lastAiUpdatedAt,
    sourceUpdatedAt:    record?.sourceUpdatedAt ?? null,
    // 派生値
    reviewGroupLabel:   getReviewStatusLabel(humanReviewStatus),
    regeneratePriority: REGENERATE_PRIORITY[vm.freshnessStatus],
    canBulkRegenerate:  !vm.isApproved,
    canBulkApprove:     vm.hasSummary && !vm.isApproved,
  };
}

/**
 * List ViewModel のフィルタ条件型。
 *
 * 例:
 *   { freshnessStatus: ['stale', 'missing'] }
 *     → 再生成が必要な企業だけに絞る（canBulkRegenerate=true の中でさらに絞る）
 *   { humanReviewStatus: ['pending', null] }
 *     → 未確認の企業だけに絞る（isUnreviewed() と等価）
 *   { freshnessStatus: ['locked'] }
 *     → 承認済み企業の一覧
 */
export interface CompanySummaryListFilter {
  freshnessStatus?:   SummaryFreshnessStatus[];
  humanReviewStatus?: (SummaryHumanReviewStatus | null)[];
}

/**
 * フィルタを適用してリストを絞り込む。
 * 複数条件は AND で結合される。
 *
 * isUnreviewed() を使った「未確認のみ」フィルタは:
 *   filterCompanySummaryList(items, { humanReviewStatus: ['pending', null] })
 */
export function filterCompanySummaryList(
  items:  CompanySummaryListItemViewModel[],
  filter: CompanySummaryListFilter,
): CompanySummaryListItemViewModel[] {
  return items.filter(item => {
    if (filter.freshnessStatus && !filter.freshnessStatus.includes(item.freshnessStatus)) {
      return false;
    }
    if (filter.humanReviewStatus && !filter.humanReviewStatus.includes(item.humanReviewStatus)) {
      return false;
    }
    return true;
  });
}
