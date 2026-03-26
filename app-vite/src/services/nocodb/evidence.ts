import { nocoFetch, TABLE_IDS } from './client';
import { RawEvidence, AppEvidence, AppLogEntry, toAppEvidence, toAppLogEntry } from './types';

/** Evidence 一覧（Company Detail 用） */
export async function fetchEvidence(companyUid: string): Promise<AppEvidence[]> {
  const raw = await nocoFetch<RawEvidence>(TABLE_IDS.evidence, {
    where: `(company_uid,eq,${companyUid})`,
    sort: '-date',
    limit: '200',
  });
  return raw.map(toAppEvidence);
}

/** Evidence → LogEntry（Unified Log 用） */
export async function fetchLogEntries(companyUid: string): Promise<AppLogEntry[]> {
  const raw = await nocoFetch<RawEvidence>(TABLE_IDS.evidence, {
    where: `(company_uid,eq,${companyUid})`,
    sort: '-date',
    limit: '200',
  });
  return raw.map(toAppLogEntry);
}
