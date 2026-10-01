// ─── Company Database（CCM）から現在MRR を読む（サーバー専用）──────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **現在MRR の正本は Company Database の `mrr`**（Salesforce から自動反映）。
//  PtAI 顧客管理DB の `⚠️MRR` は人が入れた古い値で、2026-10-01 時点で
//  127 社中 51 社がずれていた。もう画面では使わない。
//
//  突き合わせの鍵は **Salesforce Account ID**（PtAI 側「Salesforce Account ID」
//  ⇄ Company Database 側 `company_id`）。実測 109/127 がこれで付く。
//  付かないものだけ社名の完全一致で拾う（+11 社）。
//
//  ⚠ Company Database は約 8,960 行ある。**必ず mrr > 0 で絞って引くこと。**
//     全件引くと 90 リクエストになる。絞れば 10 前後で済む。
//  ⚠ 絞った結果に出てこない会社は「MRR 0 円」か「DB に無い」のどちらか。
//     取り違えると契約のある会社を 0 円で上書きしてしまうので、
//     1 社ずつ引き直して区別する。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログは件数だけ。会社名は出さない。

import { request } from './client';
import { NOTION_SOURCES, COMPANY_DB_PROP } from './schema';

const CDB = NOTION_SOURCES.companyDb;

export interface CompanyMrrRow {
  /** Salesforce Account ID。空のことがある */
  sfId: string;
  name: string;
  mrr:  number;
}

type Props = Record<string, Record<string, unknown>> | undefined;

function toRow(page: Record<string, unknown>): CompanyMrrRow {
  const p = page.properties as Props;
  const title = (p?.[COMPANY_DB_PROP.name]?.title as Array<{ plain_text?: string }> | undefined) ?? [];
  const rich  = (p?.[COMPANY_DB_PROP.sfId]?.rich_text as Array<{ plain_text?: string }> | undefined) ?? [];
  return {
    name: title.map(t => t.plain_text ?? '').join('').trim(),
    sfId: rich.map(t => t.plain_text ?? '').join('').trim(),
    mrr:  (p?.[COMPANY_DB_PROP.mrr]?.number as number | null) ?? 0,
  };
}

/** MRR が入っている会社だけを全部取る（約 900 行 / 10 リクエスト） */
export async function listPayingCompanies(): Promise<CompanyMrrRow[]> {
  const out: CompanyMrrRow[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 60; i++) {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: { property: COMPANY_DB_PROP.mrr, number: { greater_than: 0 } },
    };
    if (cursor) body.start_cursor = cursor;
    const res = await request('POST', `/data_sources/${CDB}/query`, body);
    for (const p of (res.results as Array<Record<string, unknown>>) ?? []) out.push(toRow(p));
    if (res.has_more !== true) break;
    cursor = String(res.next_cursor ?? '');
    if (!cursor) break;
  }
  return out;
}

/** 1 社だけ引き直す。「0 円」と「DB に無い」を区別するために使う */
export async function findCompany(
  by: { sfId?: string | null; name?: string | null },
): Promise<CompanyMrrRow | null> {
  const filter = by.sfId
    ? { property: COMPANY_DB_PROP.sfId, rich_text: { equals: by.sfId } }
    : by.name
      ? { property: COMPANY_DB_PROP.name, title: { equals: by.name } }
      : null;
  if (!filter) return null;
  const res = await request('POST', `/data_sources/${CDB}/query`, { page_size: 5, filter });
  const rows = ((res.results as Array<Record<string, unknown>>) ?? []).map(toRow);
  if (!rows.length) return null;
  // 同じ鍵で複数行あるときは合計する（プロジェクト分割などで分かれていることがある）
  return { sfId: rows[0].sfId, name: rows[0].name, mrr: rows.reduce((s, r) => s + r.mrr, 0) };
}

/** 突き合わせ用の索引 */
export interface CompanyIndex {
  bySfId: Map<string, number>;
  byName: Map<string, number>;
  /** 同じ鍵が複数行あった件数（合計して入れてある） */
  duplicates: number;
  rows: number;
}

export function indexCompanies(rows: CompanyMrrRow[]): CompanyIndex {
  const bySfId = new Map<string, number>(), byName = new Map<string, number>();
  let duplicates = 0;
  for (const r of rows) {
    if (r.sfId) {
      if (bySfId.has(r.sfId)) duplicates++;
      bySfId.set(r.sfId, (bySfId.get(r.sfId) ?? 0) + r.mrr);
    }
    if (r.name) {
      if (byName.has(r.name)) duplicates++;
      byName.set(r.name, (byName.get(r.name) ?? 0) + r.mrr);
    }
  }
  return { bySfId, byName, duplicates, rows: rows.length };
}
