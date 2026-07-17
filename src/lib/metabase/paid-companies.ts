// ─── 有料顧客一覧の抽出 ────────────────────────────────────────────────────────
//
// project_info テーブル (NocoDB) を集約して「現在有料の企業 (sf_account_id)」の
// リストを返す。paid-watched-sync batch で使用。
//
// 定義:
//   - paid_type が "PAID" を含む（"PTI-PAID" / "PTX-PAID"）
//   - latest_order_end_date が未指定 or 今日以降（契約中）
//
// 返り値: sf_account_id の Set

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import type { RawProjectInfo } from '@/lib/nocodb/types';

export interface PaidCompanySummary {
  /** 有料プロジェクトを持つ SF Account ID セット */
  sfAccountIds: Set<string>;
  /** 対象となったプロジェクト行数（デバッグ用） */
  projectRowCount: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 現在有料のプロジェクトを持つ企業一覧を返す。
 * paid_type=%PAID% の行を全件取り、契約終了日フィルタで絞り込み → sf_account_id 集約。
 */
export async function fetchPaidCompanySfIds(): Promise<PaidCompanySummary> {
  const tableId = TABLE_IDS.project_info;
  if (!tableId) return { sfAccountIds: new Set(), projectRowCount: 0 };

  const today = todayStr();

  // paid_type に PAID を含む行を取得。契約終了日フィルタは post-fetch で行う
  // （NocoDB の "or is null" フィルタ表現が複雑になるため）
  let all: RawProjectInfo[] = [];
  const limit = 1000;
  let offset = 0;
  const maxPages = 20; // 最大 20,000 行まで防波堤

  for (let page = 0; page < maxPages; page++) {
    const batch = await nocoFetch<RawProjectInfo>(tableId, {
      where:  '(paid_type,like,%PAID%)',
      fields: 'master_company_sf_id,paid_type,latest_order_end_date',
      limit:  String(limit),
      offset: String(offset),
    }, false).catch(err => {
      console.error('[paid-companies] fetch 失敗:', err);
      return [] as RawProjectInfo[];
    });
    if (batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  const sfIds = new Set<string>();
  for (const row of all) {
    const sfId = row.master_company_sf_id?.toString().trim();
    if (!sfId) continue;

    // 契約終了日: 空 or "unlimited" 相当は有効とみなす
    const endDate = row.latest_order_end_date?.toString().trim().slice(0, 10) ?? '';
    if (endDate && endDate < today) continue; // 過去日 → 契約切れ

    sfIds.add(sfId);
  }

  return { sfAccountIds: sfIds, projectRowCount: all.length };
}
