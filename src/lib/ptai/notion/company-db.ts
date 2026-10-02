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
//
//  ⚠ **同じ会社の行が複数ある。足してはいけない。**（2026-10-02 に実害）
//     920 行のうち 132 組が同じ Salesforce Account ID を共有していて、
//     1 組は 23 行もある。`mrr` は Salesforce の Account の MRR が各行に
//     **同じ値で写っている**だけなので、足すと社数ぶん膨らむ。
//     （例: 旧社名の行と現社名の行が両方あり、62万が 125万 になっていた）
//     115/132 組は金額が全行同じ。残り 17 組は写した時点が違うとみられる
//     ので、**いちばん大きい値**を採る。
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
  // 同じ鍵で複数行あっても**足さない**。同じ会社の写しなので、いちばん大きい値を採る
  return { sfId: rows[0].sfId, name: rows[0].name, mrr: Math.max(...rows.map(r => r.mrr)) };
}

/** 突き合わせ用の索引 */
export interface CompanyIndex {
  bySfId: Map<string, number>;
  byName: Map<string, number>;
  /** 同じ鍵が複数行あった件数。**足さず、いちばん大きい値を採っている** */
  duplicates: number;
  /** そのうち金額まで食い違っていた件数（写した時点が違うとみられる） */
  conflicts: number;
  rows: number;
}

export function indexCompanies(rows: CompanyMrrRow[]): CompanyIndex {
  const bySfId = new Map<string, number>(), byName = new Map<string, number>();
  let duplicates = 0, conflicts = 0;
  // 同じ鍵が来たら max。足すと同じ会社の写しを何重にも数えてしまう
  const put = (m: Map<string, number>, k: string, v: number) => {
    if (!m.has(k)) { m.set(k, v); return; }
    duplicates++;
    const cur = m.get(k)!;
    if (cur !== v) conflicts++;
    if (v > cur) m.set(k, v);
  };
  for (const r of rows) {
    if (r.sfId) put(bySfId, r.sfId, r.mrr);
    if (r.name) put(byName, r.name, r.mrr);
  }
  return { bySfId, byName, duplicates, conflicts, rows: rows.length };
}
