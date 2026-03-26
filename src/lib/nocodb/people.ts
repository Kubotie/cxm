import { nocoFetch, TABLE_IDS } from './client';
import { RawPerson, AppPerson, toAppPerson } from './types';

/** People 一覧（Company Detail 用） */
export async function fetchPeople(companyUid: string): Promise<AppPerson[]> {
  const raw = await nocoFetch<RawPerson>(TABLE_IDS.people, {
    where: `(company_uid,eq,${companyUid})`,
    limit: '200',
  });
  return raw.map(r => toAppPerson(r, companyUid));
}
