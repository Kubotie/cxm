// ─── Company Summary バッチ用 対象選定ヘルパー ────────────────────────────────
// list API と batch regenerate / batch review が共通で使う対象選定ロジック。
//
// このヘルパーを経由することで:
//   - freshness_filter の意味がエンドポイント間でずれない
//   - null / pending の「未確認」統一（isUnreviewed）が一か所に集約される
//   - regeneratePriority 降順ソートが統一される
//
// ── 処理の流れ ─────────────────────────────────────────────────────────────
//   1. resolveTargetCompanies で企業一覧取得
//   2. company_summary_state を並行取得
//   3. CompanySummaryListItemViewModel を構築
//   4. freshness_filter / review_filter で絞り込み
//   5. regeneratePriority 降順でソートして返す

import { resolveTargetCompanies } from './company-targets';
import { getCompanySummaryState }  from '@/lib/nocodb/company-summary-read';
import {
  buildCompanySummaryListItemViewModel,
  isUnreviewed,
} from '@/lib/company/company-summary-state-policy';
import type {
  SummaryFreshnessStatus,
  SummaryHumanReviewStatus,
  CompanySummaryListItemViewModel,
} from '@/lib/company/company-summary-state-policy';
import type { AppCompany } from '@/lib/nocodb/types';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface CompanySummaryTargetParams {
  limit:            number;
  company_uids?:    string[];
  /** 鮮度フィルタ（省略時 = 全状態） */
  freshness_filter?: SummaryFreshnessStatus[];
  /**
   * review ステータスフィルタ。
   * null は "未設定" の企業を含む。
   * isUnreviewed() に相当する ['pending', null] を渡すと未確認のみに絞れる。
   * 省略時 = 全状態。
   */
  review_filter?:    (SummaryHumanReviewStatus | null)[];
  summary_type?:     string;
}

/** list API / batch 系が共通で扱うアイテム */
export interface CompanySummaryTargetItem {
  company: AppCompany;
  listVM:  CompanySummaryListItemViewModel;
}

// ── メイン helper ──────────────────────────────────────────────────────────────

/**
 * 企業一覧 + summary state を並行取得し、
 * フィルタ適用後に regeneratePriority 降順で返す。
 *
 * list API, batch regenerate, batch review が共通で呼ぶ。
 * フィルタなしの場合は全企業を regeneratePriority 降順で返す。
 */
export async function resolveCompanySummaryTargets(
  params: CompanySummaryTargetParams,
): Promise<CompanySummaryTargetItem[]> {
  const summaryType = params.summary_type ?? 'default';

  // ① 企業一覧取得
  const companies = await resolveTargetCompanies({
    limit:        params.limit,
    company_uids: params.company_uids,
  });

  if (companies.length === 0) return [];

  // ② summary state を並行取得（失敗した企業は null = missing 扱い）
  const summaryStates = await Promise.all(
    companies.map(c => getCompanySummaryState(c.id, summaryType).catch(() => null)),
  );

  // ③ ViewModel 構築
  const items: CompanySummaryTargetItem[] = companies.map((company, i) => ({
    company,
    listVM: buildCompanySummaryListItemViewModel(company.id, company.name, summaryStates[i]),
  }));

  // ④ freshness_filter で絞り込み（指定なし = 全状態）
  const afterFreshness = params.freshness_filter && params.freshness_filter.length > 0
    ? items.filter(item => params.freshness_filter!.includes(item.listVM.freshnessStatus))
    : items;

  // ⑤ review_filter で絞り込み（指定なし = 全状態）
  //    null と pending は isUnreviewed() で同一グループとして扱う
  const afterReview = params.review_filter && params.review_filter.length > 0
    ? afterFreshness.filter(item => {
        const status = item.listVM.humanReviewStatus;
        // review_filter に null が含まれ、かつ isUnreviewed なら一致
        if (params.review_filter!.includes(null) && isUnreviewed(status)) return true;
        // 明示的な status が一致するか
        return params.review_filter!.includes(status);
      })
    : afterFreshness;

  // ⑥ regeneratePriority 降順ソート（同値は企業名 asc で安定化）
  return afterReview.sort((a, b) => {
    const pd = b.listVM.regeneratePriority - a.listVM.regeneratePriority;
    if (pd !== 0) return pd;
    return a.company.name.localeCompare(b.company.name, 'ja');
  });
}
