// ─── Support Queue フェッチ関数（サーバーサイド専用）────────────────────────
// NOTE: このファイルは現在どこからも import されていない（dead code）。
//       実際の read は @/lib/nocodb/support の各関数を使うこと。
import { nocoFetch, TABLE_IDS } from './client';
import { RawSupportCase, AppSupportCase, toAppSupportCase } from './types';

export async function fetchSupportQueue(limit = 100): Promise<AppSupportCase[]> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) throw new Error('NOCODB_LOG_INTERCOM_TABLE_ID が未設定です | source_table=log_intercom | filter=(massage_type,eq,support)');
  const raw = await nocoFetch<RawSupportCase>(tableId, {
    where: '(massage_type,eq,support)',
    sort: '-CreatedAt',
    limit: String(limit),
  });
  return raw.map(toAppSupportCase);
}

export async function fetchSupportCaseById(caseId: string): Promise<AppSupportCase | null> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) throw new Error(`NOCODB_LOG_INTERCOM_TABLE_ID が未設定です | source_table=log_intercom | filter=(case_id,eq,${caseId})`);
  const raw = await nocoFetch<RawSupportCase>(tableId, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  });
  return raw.length > 0 ? toAppSupportCase(raw[0]) : null;
}
