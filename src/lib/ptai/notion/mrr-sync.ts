// ─── 現在MRR の同期（Company Database → PtAI 顧客管理DB）──────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  毎朝 8 時（JST）に 1 回。Company Database の `mrr` を
//  PtAI 顧客管理DB の `現在MRR` に写すだけ。**一方向。書き戻さない。**
//
//  `期初MRR` はここでは触らない。初回に一度だけ焼き付けるもので、
//  scripts/ptai-mrr-baseline.mjs が入れる。
//
//  ⚠ 「Company Database に見つからない会社」は**書かない**。
//     0 円で上書きすると、契約のある会社の現在MRR が消える。
//     見つからない件数は結果に出すので、増えたら鍵（Salesforce Account ID）
//     を埋めること。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログは件数だけ。会社名は出さない。

import { listCustomers, request, isConfigured } from './client';
import { listPayingCompanies, indexCompanies, findCompany } from './company-db';
import { NOTION_SOURCES, CUSTOMER_PROP } from './schema';

export interface MrrSyncResult {
  ok: boolean;
  /** PtAI 顧客管理DB の件数 */
  customers: number;
  /** Salesforce Account ID で突き合わせた */
  viaSfId: number;
  /** 社名の完全一致で突き合わせた */
  viaName: number;
  /** Company Database にあるが MRR 0 円 */
  zero: number;
  /** Company Database に見つからず、書かなかった */
  unmatched: number;
  /** 実際に値が変わって書いた */
  updated: number;
  /** 値が同じで書かなかった */
  unchanged: number;
  failed: number;
  message: string | null;
}

const EMPTY: MrrSyncResult = {
  ok: false, customers: 0, viaSfId: 0, viaName: 0, zero: 0,
  unmatched: 0, updated: 0, unchanged: 0, failed: 0, message: null,
};

export async function syncCurrentMrr(dryRun = false): Promise<MrrSyncResult> {
  if (!isConfigured()) return { ...EMPTY, message: 'Notion が未設定です' };

  const [customers, paying] = await Promise.all([
    listCustomers({ maxPages: 20 }),
    listPayingCompanies(),
  ]);
  const idx = indexCompanies(paying);

  const r: MrrSyncResult = { ...EMPTY, ok: true, customers: customers.length };

  for (const c of customers) {
    // 1. Salesforce Account ID → 2. 社名、の順に見る
    let mrr: number | null = null;
    if (c.sfAccountId && idx.bySfId.has(c.sfAccountId)) {
      mrr = idx.bySfId.get(c.sfAccountId)!; r.viaSfId++;
    } else if (idx.byName.has(c.name)) {
      mrr = idx.byName.get(c.name)!; r.viaName++;
    } else {
      // MRR 0 円で絞り落とされただけなのか、そもそも DB に無いのかを確かめる
      const hit = await findCompany({ sfId: c.sfAccountId, name: c.name })
        ?? (c.sfAccountId ? await findCompany({ name: c.name }) : null);
      if (!hit) { r.unmatched++; continue; }
      mrr = hit.mrr; r.zero++;
    }

    if (c.curMrr === mrr) { r.unchanged++; continue; }
    if (dryRun) { r.updated++; continue; }
    try {
      await request('PATCH', `/pages/${c.pageId}`, {
        properties: { [CUSTOMER_PROP.curMrr]: { number: mrr } },
      });
      r.updated++;
    } catch {
      r.failed++;
    }
  }

  if (r.unmatched) {
    r.message = `${r.unmatched} 社は Company Database に見つからず、現在MRR を書きませんでした`;
  }
  return r;
}

/** 画面の診断用。同期せずに突き合わせ具合だけ見る */
export async function mrrSyncDiagnostics(): Promise<{
  configured: boolean; customers: number; payingRows: number;
  matched: number; unmatched: number; duplicates: number; message: string | null;
}> {
  if (!isConfigured()) {
    return { configured: false, customers: 0, payingRows: 0, matched: 0, unmatched: 0, duplicates: 0,
      message: 'Notion が未設定です' };
  }
  const [customers, paying] = await Promise.all([
    listCustomers({ maxPages: 20 }), listPayingCompanies(),
  ]);
  const idx = indexCompanies(paying);
  let matched = 0;
  for (const c of customers) {
    if ((c.sfAccountId && idx.bySfId.has(c.sfAccountId)) || idx.byName.has(c.name)) matched++;
  }
  return {
    configured: true, customers: customers.length, payingRows: idx.rows,
    matched, unmatched: customers.length - matched, duplicates: idx.duplicates,
    message: null,
  };
}

export { NOTION_SOURCES };
