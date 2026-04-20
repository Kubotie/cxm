// ─── POST /api/company/[companyUid]/sf-contacts/sync ─────────────────────────
//
// Salesforce Contact を company_people テーブルに同期する。
//
// ── sfAccountId 解決順 ───────────────────────────────────────────────────────
//   1. request body の sfAccountId（明示指定）
//   2. companies テーブルの sf_account_id カラム
//   3. companyUid をそのまま使用（fallback）
//   → fallback が使われた場合は warnings に記録する
//
// ── dryRun: true の挙動 ───────────────────────────────────────────────────────
//   - SF Contact を fetch して件数・create/update/conflict を計算
//   - NocoDB への書き込みは行わない
//   - adapter 未接続時は mock result を返す
//
// ── adapter 接続状態による挙動 ──────────────────────────────────────────────
//   未接続: { ok: false, syncResult: 'adapter_not_connected', ... }
//   dryRun: { ok: true,  syncResult: 'dry_run', result: SalesforceContactSyncResult }
//   成功:   { ok: true,  syncResult: 'synced',  result: SalesforceContactSyncResult }
//   エラー: { ok: false, syncResult: 'sync_error', error: string }

import { NextResponse } from 'next/server';
import {
  activeSalesforceContactAdapter,
  mapSalesforceContact,
  type SalesforceContact,
  type SalesforceContactSyncResult,
  type ContactSyncItemResult,
} from '@/lib/salesforce/salesforce-contact-adapter';
import { isSalesforceConfigured } from '@/lib/salesforce/client';
import { fetchSfAccountId } from '@/lib/nocodb/companies';
import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import type { RawCompanyPerson } from '@/lib/nocodb/types';

type RouteContext = { params: Promise<{ companyUid: string }> };

// ── sfAccountId 解決結果 ─────────────────────────────────────────────────────

type SfAccountIdSource = 'explicit' | 'companies_table' | 'fallback';

interface ResolvedSfAccountId {
  sfAccountId:       string;
  sfAccountIdSource: SfAccountIdSource;
  warnings:          string[];
}

async function resolveSfAccountId(
  companyUid:          string,
  explicitSfAccountId: string | undefined,
): Promise<ResolvedSfAccountId> {
  const warnings: string[] = [];

  // 1. 明示指定
  if (explicitSfAccountId) {
    return { sfAccountId: explicitSfAccountId, sfAccountIdSource: 'explicit', warnings };
  }

  // 2. companies テーブルの sf_account_id
  const fromTable = await fetchSfAccountId(companyUid);
  if (fromTable) {
    return { sfAccountId: fromTable, sfAccountIdSource: 'companies_table', warnings };
  }

  // 3. fallback: companyUid をそのまま使用
  warnings.push(
    `sf_account_id が companies テーブルに設定されていません。` +
    `companyUid='${companyUid}' を Salesforce Account ID として使用しています。` +
    `正確な同期のために companies.sf_account_id を設定してください。`,
  );
  return { sfAccountId: companyUid, sfAccountIdSource: 'fallback', warnings };
}

// ── dry-run プレビュー計算（書き込みなし）────────────────────────────────────

function computeDryRunPreview(
  sfContacts:  SalesforceContact[],
  existingRaw: RawCompanyPerson[],
  sfAccountId: string,
  companyUid:  string,
): SalesforceContactSyncResult {
  const syncedAt = new Date().toISOString();
  const items: ContactSyncItemResult[] = [];

  const bySfId  = new Map(existingRaw.filter(r => r.sf_id ).map(r => [r.sf_id!,  r]));
  const byEmail = new Map(existingRaw.filter(r => r.email).map(r => [r.email!.toLowerCase().trim(), r]));

  for (const sf of sfContacts) {
    const mapped = mapSalesforceContact(sf, companyUid);
    const name   = mapped.person.name;

    const existingBySfId  = bySfId.get(sf.Id);
    const existingByEmail = sf.Email ? byEmail.get(sf.Email.toLowerCase().trim()) : undefined;
    const existing        = existingBySfId ?? existingByEmail;

    if (!existing) {
      items.push({ sfId: sf.Id, name, outcome: 'created' });
    } else if (existingByEmail && !existingBySfId && existing.sf_id && existing.sf_id !== sf.Id) {
      items.push({
        sfId: sf.Id, name, outcome: 'conflicted',
        conflicts: [`email '${sf.Email}' は既存レコード(sfId:${existing.sf_id})に紐付き済み`],
      });
    } else {
      items.push({ sfId: sf.Id, name, outcome: 'updated' });
    }
  }

  return {
    companyUid,
    sfAccountId,
    syncedAt,
    sfTotal:       sfContacts.length,
    createdCount:  items.filter(i => i.outcome === 'created').length,
    updatedCount:  items.filter(i => i.outcome === 'updated').length,
    skippedCount:  items.filter(i => i.outcome === 'skipped').length,
    conflictCount: items.filter(i => i.outcome === 'conflicted').length,
    errorCount:    0,
    items,
  };
}

// ── リクエスト型 ─────────────────────────────────────────────────────────────

interface SfContactSyncBody {
  /** true: 書き込みを行わずプレビューのみ返す */
  dryRun?:      boolean;
  /** Salesforce Account ID（省略時は解決順に従い自動解決） */
  sfAccountId?: string;
}

// ── レスポンス型 ─────────────────────────────────────────────────────────────

export type SfContactSyncResult =
  | {
      ok:                true;
      syncResult:        'synced' | 'dry_run';
      dryRun:            boolean;
      sfAccountId:       string;
      sfAccountIdSource: SfAccountIdSource;
      warnings:          string[];
      result:            SalesforceContactSyncResult;
    }
  | {
      ok:                false;
      syncResult:        'adapter_not_connected';
      dryRun:            boolean;
      sfAccountId:       string;
      sfAccountIdSource: SfAccountIdSource;
      warnings:          string[];
      mockResult:        SalesforceContactSyncResult;
    }
  | {
      ok:                false;
      syncResult:        'sync_error';
      dryRun:            boolean;
      sfAccountId:       string;
      sfAccountIdSource: SfAccountIdSource;
      warnings:          string[];
      error:             string;
    };

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: RouteContext) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid is required' }, { status: 400 });
  }

  let body: SfContactSyncBody;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const dryRun = body.dryRun ?? false;

  // sfAccountId 解決（解決順: explicit → companies_table → fallback）
  const resolved = await resolveSfAccountId(companyUid, body.sfAccountId);
  const { sfAccountId, sfAccountIdSource, warnings } = resolved;

  // adapter 未接続時 → mock result
  if (!isSalesforceConfigured()) {
    const response: SfContactSyncResult = {
      ok:                false,
      syncResult:        'adapter_not_connected',
      dryRun,
      sfAccountId,
      sfAccountIdSource,
      warnings:          [
        ...warnings,
        'Salesforce 環境変数が未設定です。SALESFORCE_CLIENT_ID / CLIENT_SECRET / INSTANCE_URL / REFRESH_TOKEN を設定してください。',
      ],
      mockResult: {
        companyUid,
        sfAccountId,
        syncedAt:      new Date().toISOString(),
        sfTotal:       0,
        createdCount:  0,
        updatedCount:  0,
        skippedCount:  0,
        conflictCount: 0,
        errorCount:    0,
        items:         [],
      },
    };
    return NextResponse.json(response, { status: 503 });
  }

  try {
    if (dryRun) {
      // dry-run: SF から fetch して件数計算のみ、NocoDB 書き込みなし
      const sfContacts = await activeSalesforceContactAdapter.fetchContactsByAccount(sfAccountId);
      const existingRaw = TABLE_IDS.company_people
        ? await nocoFetch<RawCompanyPerson>(TABLE_IDS.company_people, {
            where: `(company_uid,eq,${companyUid})`,
            limit: '500',
          })
        : [];

      const result = computeDryRunPreview(sfContacts, existingRaw, sfAccountId, companyUid);

      const response: SfContactSyncResult = {
        ok:                true,
        syncResult:        'dry_run',
        dryRun:            true,
        sfAccountId,
        sfAccountIdSource,
        warnings,
        result,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // 本実行
    const syncResult = await activeSalesforceContactAdapter.syncContactsToCompanyPeople(
      sfAccountId,
      companyUid,
    );

    const response: SfContactSyncResult = {
      ok:                true,
      syncResult:        'synced',
      dryRun:            false,
      sfAccountId,
      sfAccountIdSource,
      warnings,
      result:            syncResult,
    };
    return NextResponse.json(response, { status: 201 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const response: SfContactSyncResult = {
      ok:                false,
      syncResult:        'sync_error',
      dryRun,
      sfAccountId,
      sfAccountIdSource,
      warnings,
      error:             msg,
    };
    return NextResponse.json(response, { status: 502 });
  }
}
