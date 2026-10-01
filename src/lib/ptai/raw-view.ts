// ─── PtAI Pipeline: 新しいデータ経路から RAW 互換を組み立てる ───────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §0・§C
//
// ═══════════════════════════════════════════════════════════════════════════
//  **board.js は 1 行も変えない。** 原本は起動時に `window.__PGA_RAW` を読むので、
//  その中身を Notion（アカウント情報の正本）＋ Twenty test*（商談）から作る。
//
//  旧経路（pga_docs/_raw）との違いは**会社の鍵**:
//    旧: `cid` = Twenty Company の UUID
//    新: `cid` = **Notion 顧客管理DB のページ ID**
//  board.js は `cid` を `edits/<cid>` の doc id に使うだけなので、
//  中身が何の ID かは問わない。新旧を混ぜないことだけが要件。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログ: 件数だけ。顧客名・UUID・本文は出さない。

import { listCompanySummaries, type CompanySummary } from './repository';
import { listCompanyMinutes } from './minutes';
import { TIER_TO_NOTION } from './notion/schema';
import type { RawSnapshot, RawCompany, RawOpportunity } from '@/lib/twenty/adapters/types';

export interface RawViewResult {
  snapshot: RawSnapshot;
  diagnostics: {
    companies: number;
    deals: number;
    /** 議事録を引いた会社数（引いていない場合は 0）*/
    minutesCompanies: number;
    minutesTotal: number;
    partialFailures: string[];
  };
}

/** board.js の Tier コードへ。AccountInfo はすでにコード化済みなのでそのまま通す */
const tierCode = (v: string | null): string | null =>
  v && Object.keys(TIER_TO_NOTION).includes(v) ? v : v;

function buildRawCompany(s: CompanySummary, deals: RawOpportunity[] | null): RawCompany {
  const a = s.account;
  return {
    cid:  a.notionPageId,
    n:    a.name,
    t:    tierCode(a.tier),
    ps:   a.solutionStatus,
    m:    a.mrr,
    ind:  a.industry,
    slug: null,
    lay:  null,
    own:  a.owners,
    o:    a.owners,          // 主担当は担当3。新経路では own と同じ
    asg:  '担当3',
    icp:  null,
    aw:   null,
    src:  null,
    na:   a.nextAction ?? '',
    up:   (a.lastEditedTime || '').slice(0, 10),
    url:  a.notionUrl ?? '',
    dom:  '',
    cs:   null,
    opp:  deals,
    notes: [],
    docs: [],
    od:   [],
  };
}

export interface BuildRawInput {
  /** 議事録も RAW に載せるか。重いので既定は載せない（議事録タブが別に引く）*/
  withMinutes?: boolean;
  /** 議事録を引く会社数の上限。全社ぶん引くと数分かかる */
  minutesCompanyLimit?: number;
}

/**
 * Notion ＋ Twenty test* から RAW 互換を作る。
 * **pga_docs には一切触らない。**
 */
export async function buildRawFromNewSources(input: BuildRawInput = {}): Promise<RawViewResult> {
  const { companies, partialFailures } = await listCompanySummaries();

  const rows: RawCompany[] = [];
  let deals = 0;

  for (const s of companies) {
    // 商談は repository が DealView で持っているが、RAW の `opp` は
    // 「Twenty 側の商談」を見せる欄なので、同じ中身を RAW の形に写す
    const opp: RawOpportunity[] | null = s.dealCount
      ? [{
          id:   '',
          raw:  '',
          st:   s.stage,
          close: null,
          net:  s.addMrr || null,
          ownerId: null,
          need: '',
          src:  '',
          pc:   '',
          up:   (s.account.lastEditedTime || '').slice(0, 10),
        }]
      : null;
    if (opp) deals += s.dealCount;
    rows.push(buildRawCompany(s, opp));
  }

  // 議事録は要求されたときだけ。会社ごとに 2〜3 リクエスト要るので既定は載せない
  let minutesCompanies = 0, minutesTotal = 0;
  if (input.withMinutes) {
    const limit = input.minutesCompanyLimit ?? 20;
    for (const row of rows.slice(0, limit)) {
      const s = companies.find(c => c.account.notionPageId === row.cid);
      if (!s) continue;
      try {
        const r = await listCompanyMinutes({
          companyRelationIds: s.account.companyRelationIds,
          companyName: s.account.name,
          limitPerSource: 3,
        });
        row.notes = r.meetings.map(m => ({ t: m.title, d: m.date, md: m.body }));
        if (row.notes.length) { minutesCompanies++; minutesTotal += row.notes.length; }
        partialFailures.push(...r.diagnostics.partialFailures);
      } catch {
        partialFailures.push('minutes:error');
      }
    }
  }

  const snapshot: RawSnapshot = {
    members: {},            // 新経路では担当は Notion の担当3。id → 名前の表は要らない
    fetched: new Date().toISOString().slice(0, 17) + '00Z',
    companies: rows,
    unmatchedOpps: [],
  };

  return {
    snapshot,
    diagnostics: {
      companies: rows.length,
      deals,
      minutesCompanies,
      minutesTotal,
      partialFailures: [...new Set(partialFailures)],
    },
  };
}
