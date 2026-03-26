// ─── Support Queue フェッチ関数（サーバーサイド専用）────────────────────────
import { nocoFetch, TABLE_IDS } from './client';
import { RawSupportCase, AppSupportCase, toAppSupportCase } from './types';

export async function fetchSupportQueue(limit = 100): Promise<AppSupportCase[]> {
  if (!TABLE_IDS.support_queue) return [];
  const raw = await nocoFetch<RawSupportCase>(TABLE_IDS.support_queue, {
    sort: '-created_at',
    limit: String(limit),
  });
  return raw.map(toAppSupportCase);
}

export async function fetchSupportCaseById(caseId: string): Promise<AppSupportCase | null> {
  if (!TABLE_IDS.support_queue) return null;
  const raw = await nocoFetch<RawSupportCase>(TABLE_IDS.support_queue, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  });
  return raw.length > 0 ? toAppSupportCase(raw[0]) : null;
}
