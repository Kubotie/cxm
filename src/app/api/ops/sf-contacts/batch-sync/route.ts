// ─── POST /api/ops/sf-contacts/batch-sync ────────────────────────────────────
//
// 担当がついている全CSM管理企業のContactをSalesforceから一括同期する。
//
// 動作:
//   1. owner_name が設定されている全アクティブ CSM 管理企業を取得
//   2. 各企業の sf_account_id（未設定時は company_uid をフォールバック）を使い
//      activeSalesforceContactAdapter.syncContactsToCompanyPeople() を呼び出す
//   3. 全件の結果サマリーを返す
//
// レスポンス:
//   200 — 全件成功
//   207 — 一部失敗（results で確認）
//   503 — Salesforce 未設定

import { NextResponse } from 'next/server';
import { isSalesforceConfigured } from '@/lib/salesforce/client';
import { activeSalesforceContactAdapter } from '@/lib/salesforce/salesforce-contact-adapter';
import { fetchAssignedCompanies } from '@/lib/nocodb/companies';
import type { SalesforceContactSyncResult } from '@/lib/salesforce/salesforce-contact-adapter';

type CompanyResult = {
  companyUid:  string;
  ownerName:   string;
  sfAccountId: string;
  status:      'ok' | 'error';
  summary?:    Pick<SalesforceContactSyncResult,
    'sfTotal' | 'createdCount' | 'updatedCount' | 'skippedCount' | 'conflictCount'>;
  error?:      string;
};

export interface BatchSfContactSyncResult {
  startedAt:      string;
  completedAt:    string;
  totalCompanies: number;
  succeeded:      number;
  failed:         number;
  results:        CompanyResult[];
}

export async function POST(): Promise<NextResponse<BatchSfContactSyncResult | { error: string }>> {
  if (!isSalesforceConfigured()) {
    return NextResponse.json({ error: 'Salesforce が設定されていません (SALESFORCE_* env vars)' }, { status: 503 });
  }

  const startedAt = new Date().toISOString();
  const companies = await fetchAssignedCompanies();

  const results: CompanyResult[] = [];

  for (const { companyUid, sfAccountId, ownerName } of companies) {
    // sf_account_id 未設定の場合は company_uid をフォールバックとして使用
    const accountId = sfAccountId ?? companyUid;

    try {
      const syncResult = await activeSalesforceContactAdapter.syncContactsToCompanyPeople(
        accountId,
        companyUid,
      );
      results.push({
        companyUid,
        ownerName,
        sfAccountId: accountId,
        status: 'ok',
        summary: {
          sfTotal:       syncResult.sfTotal,
          createdCount:  syncResult.createdCount,
          updatedCount:  syncResult.updatedCount,
          skippedCount:  syncResult.skippedCount,
          conflictCount: syncResult.conflictCount,
        },
      });
    } catch (err) {
      results.push({
        companyUid,
        ownerName,
        sfAccountId: accountId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const completedAt = new Date().toISOString();
  const succeeded   = results.filter(r => r.status === 'ok').length;
  const failed      = results.filter(r => r.status === 'error').length;

  const body: BatchSfContactSyncResult = {
    startedAt,
    completedAt,
    totalCompanies: companies.length,
    succeeded,
    failed,
    results,
  };

  const httpStatus = failed === 0 ? 200 : 207;
  return NextResponse.json(body, { status: httpStatus });
}
