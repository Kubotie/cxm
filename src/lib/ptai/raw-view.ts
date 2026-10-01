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
import { listCompanyMinutes, fetchAllTwentyNotes, pickNotesForCompany } from './minutes';
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
    /** Twenty Note（Mii 由来を含む）を配れた会社数と件数 */
    notesCompanies: number;
    notesTotal: number;

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
    sfid: a.sfAccountId,
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
    // 中身はあとで詰める（notes＝Twenty Note、od＝組織資料）。型を固定しておく
    notes: [] as Array<{ t: string; d: string; md: string }>,
    docs:  [] as Array<{ d: string; k: string; t: string; b: string }>,
    od:    [] as Array<{ d: string; k: string; t: string; b: string }>,
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

  // ── 議事録（Twenty Note / Mii）─────────────────────────────────────────
  //
  // ⚠ **ここを空にしていたせいで、組織図・直近の動き・計画相談の AI が
  //    議事録をまったく読めていなかった**（2026-10-01 に判明）。
  //    移行元 RAW は 63 社・89 件の notes を持っていたのに、新経路は 0 件だった。
  //
  //    Twenty の Note は全部で 100 件台なので、**1 リクエストで全件取って
  //    ローカルで社名照合する**。会社ごとに引くと 127 リクエストになる。
  //    Notion の議事録は JP_Docs が 2,000 件超あり全件は取れないので、
  //    画面側が会社ごとに MCP で引く（board.js の notionMinutes）。
  let notesCompanies = 0, notesTotal = 0;
  try {
    const allNotes = await fetchAllTwentyNotes();
    if (allNotes.length) {
      for (const row of rows) {
        const picked = pickNotesForCompany(allNotes, row.n, 6);
        if (!picked.length) continue;
        row.notes = picked.map(m => ({ t: m.title, d: m.date, md: m.body }));
        notesCompanies++; notesTotal += picked.length;
      }
    }
  } catch {
    partialFailures.push('twenty_notes:error');
  }

  // ── 組織資料（od）と repo の資料（docs）は入れていない ────────────────
  //
  //  原本の RAW は「組織資料（repo）」を持っていて、組織図 AI の主材料だった
  //  （1 社・3 本・最大 7,018 字）。**これに相当するものが Notion に無い。**
  //  2026-10-01 に探した結果:
  //    JP_Docs でタイトルに「組織」を含むページは全体で 5 件だけ。
  //    本文は 0〜554 字で、**どの顧客にも社名が一致しなかった**。
  //  取りに行くと 10 秒かかって 0 件なので、やめた。
  //
  //  使えるようにするには、組織資料を JP_Docs に置いて「関連顧客」を
  //  紐付けてもらう必要がある（運用側の作業）。それまでは組織図 AI は
  //  議事録（notes）と担当者メモを材料にする。
  //  docs（メール・チャットの控え）も移行元で 3 社 11 件だけだったので入れない。

  // 会社ごとに 2〜3 リクエスト要る Notion 議事録は、要求されたときだけ
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
      notesCompanies,
      notesTotal,
      partialFailures: [...new Set(partialFailures)],
    },
  };
}
