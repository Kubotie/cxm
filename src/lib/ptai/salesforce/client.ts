// ─── PtAI Pipeline: Salesforce の読み取り（サーバー専用）────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **読むだけ。書かない。**
//  金額・見積もりは Salesforce でしか入れられないので（Opportunity.Amount は
//  作成不可・更新不可）、こちらは商談の状態を取り込むだけにする。
//
//  CXM の src/lib/salesforce/client.ts（接続・認証）をそのまま使う。
//  あちらの `sfQuery` は **2,000 件で打ち切る**ので、全件要るところだけ
//  ここで自前にページングする。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログ: 件数だけ。顧客名・商談名は出さない。

import { sfFetch, SF_API_BASE, isSalesforceConfigured } from '@/lib/salesforce/client';
import {
  SF_OPPORTUNITY_FIELDS, ptaiNameFilter, sfProbability,
  type SfOpportunity,
} from './schema';

export { isSalesforceConfigured };

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
};

/** 2,000 件を超えても全部取る */
async function queryAll<T>(soql: string): Promise<T[]> {
  let page = await sfFetch<{ records: T[]; nextRecordsUrl?: string }>(
    'GET', `${SF_API_BASE}/query?q=${encodeURIComponent(soql)}`);
  const rows = [...page.records];
  let guard = 0;
  while (page.nextRecordsUrl && ++guard < 50) {
    page = await sfFetch<{ records: T[]; nextRecordsUrl?: string }>('GET', page.nextRecordsUrl);
    rows.push(...page.records);
  }
  return rows;
}

function toOpportunity(r: Record<string, unknown>): SfOpportunity {
  const stage = String(r.StageName ?? '');
  return {
    id:         String(r.Id ?? ''),
    name:       String(r.Name ?? ''),
    accountId:  str(r.AccountId),
    stage,
    // Salesforce の Probability はステージから自動で入るが、空のことがある。
    // 空なら設定表（SF_STAGES）の既定値を使う
    probability: num(r.Probability) ?? sfProbability(stage),
    closeDate:  str(r.CloseDate),
    amount:     num(r.Amount),
    jpMrr:      num(r.JP_MRR__c),
    netMrr:     num(r.Net_MRR__c),
    termMonths: num(r.ContractTerm__c),
    billingDate: str(r.Payment_Day__c),
    contractEnd: str(r.First_Order_End_Date__c),
    needs:      str(r.Indentify_Pain_Needs__c),
    lostDetail: str(r.Dead_Detail_Reason__c),
    isWon:      r.IsWon === true,
    isClosed:   r.IsClosed === true,
    updatedAt:  String(r.LastModifiedDate ?? ''),
  };
}

/**
 * PtAI の商談を取る。
 *
 * 見分け方は**商談名**（`PtAI` / `Ptengine AI` / `PtengineAI`。大文字小文字は
 * Salesforce 側で元から区別されない）。2026-10-01 の運用決定。
 *
 * @param accountIds 絞り込む Account。省略すると PtAI 商談を全部取る
 */
export async function listPtaiOpportunities(accountIds?: string[]): Promise<SfOpportunity[]> {
  const where: string[] = [`(${ptaiNameFilter()})`];

  if (accountIds) {
    if (!accountIds.length) return [];
    // IN 句が長くなりすぎないよう分割する
    const out: SfOpportunity[] = [];
    for (let i = 0; i < accountIds.length; i += 150) {
      const ids = accountIds.slice(i, i + 150).map(x => `'${x.replace(/'/g, "\\'")}'`).join(',');
      const rows = await queryAll<Record<string, unknown>>(
        `SELECT ${SF_OPPORTUNITY_FIELDS.join(', ')} FROM Opportunity
         WHERE ${where.join(' AND ')} AND AccountId IN (${ids})
         ORDER BY LastModifiedDate DESC`.replace(/\s+/g, ' '));
      out.push(...rows.map(toOpportunity));
    }
    return out;
  }

  const rows = await queryAll<Record<string, unknown>>(
    `SELECT ${SF_OPPORTUNITY_FIELDS.join(', ')} FROM Opportunity
     WHERE ${where.join(' AND ')} ORDER BY LastModifiedDate DESC`.replace(/\s+/g, ' '));
  return rows.map(toOpportunity);
}

/** 画面の診断用。件数だけを返す */
export interface SfDiagnostics {
  configured: boolean;
  /** PtAI 商談の総数（商談名で判定） */
  ptaiOpportunities: number;
  /** そのうち未クローズ */
  open: number;
  /** ステージごとの件数 */
  byStage: Record<string, number>;
  /** Account が空のもの（会社に紐付けられない） */
  withoutAccount: number;
  message: string | null;
}

export async function salesforceDiagnostics(): Promise<SfDiagnostics> {
  const empty: SfDiagnostics = {
    configured: false, ptaiOpportunities: 0, open: 0, byStage: {}, withoutAccount: 0, message: null,
  };
  if (!isSalesforceConfigured()) {
    return { ...empty, message: 'SALESFORCE_CLIENT_ID / SECRET が未設定です' };
  }
  try {
    const opps = await listPtaiOpportunities();
    const byStage: Record<string, number> = {};
    for (const o of opps) byStage[o.stage] = (byStage[o.stage] ?? 0) + 1;
    return {
      configured: true,
      ptaiOpportunities: opps.length,
      open: opps.filter(o => !o.isClosed).length,
      byStage,
      withoutAccount: opps.filter(o => !o.accountId).length,
      message: opps.length === 0
        ? '商談名に PtAI / Ptengine AI / PtengineAI を含む商談がまだありません'
        : null,
    };
  } catch (e) {
    // 原因は種別までで、応答本文は載せない
    return { ...empty, configured: true, message: `Salesforce を読めませんでした（${(e as Error).name}）` };
  }
}
