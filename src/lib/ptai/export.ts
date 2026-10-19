// ─── PtAI Pipeline の全データ書き出し ───────────────────────────────────────
//
// 画面が持っているものを、**分析しやすい形に組み直して**まとめて返す。
// 画面は RAW（会社）と db（商談・サクセス・組織図…）を別々に読んで頭の中で
// 結合しているが、外から見るときに 2 本を突き合わせるのは面倒なので、
// ここで会社を軸に 1 本に畳む。
//
// ═══════════════════════════════════════════════════════════════════════════
//  **読み取り専用。** 取得元は画面とまったく同じ（kpi-source.ts と同じ 2 本）で、
//  ここでは何も書かない。数値は kpi.ts の式をそのまま使うので、画面と一致する。
//
//  顧客名・商談名・議事録の本文を**含む**。読み取り専用トークン
//  （PTAI_READ_TOKEN）か、ログイン済みのセッションでしか通らない経路から呼ぶこと。
//  ログには件数しか出さない。
// ═══════════════════════════════════════════════════════════════════════════

import { buildRawFromNewSources } from './raw-view';
import { buildDbView } from './db-view';
import { STAGES, STAGE_JP, type Stage } from './twenty-test/schema';
import {
  FORECAST, m2, m3, wonAmt, atLeast, rung, planOf, computeKpis, type KpiCompany, type KpiDeal,
} from './kpi';
import { MEMBERS } from './kpi-source';
import { toPtaiName2 } from './staff';
import { todayJst } from './kpi-snapshot';

/** 画面のフェーズ名（社内の言い方）。board.js の PH_JA と同じ */
export const STAGE_NOTE: Record<string, string> = {
  INACTIVE: '', ACTIVE: '初回アポ実施前', GOAL_SHARED: '初回アポ実施済み',
  QUALIFIED_CHAMPION: 'トライアル開始済み', EVALUATING: 'トライアル運用評価段階',
  PROBABLE: '最終見積もり提示済み', VERBAL: '口頭合意獲得済み', WON: '申込用紙回収済み',
  CLOSED_WON: '契約締結済み', ADMIN_CLOSE: '', CLOSED_LOST: '失注',
};

/** 何を含めるか。重いものは既定で外してある */
export const INCLUDES = [
  'deals', 'kpi', 'logs', 'success', 'org', 'minutes', 'notes', 'docs', 'recent', 'feed',
] as const;
export type Include = (typeof INCLUDES)[number];
export const DEFAULT_INCLUDES: Include[] = ['deals', 'kpi'];

export interface ExportFilter {
  include?: Include[];
  /** 担当者で絞る */
  owner?: string;
  /** フェーズで絞る（その商談を持つ会社だけ残す） */
  stage?: string;
  /** 会社の Notion ページ ID */
  cid?: string;
  /** 社名の部分一致 */
  q?: string;
  /** 商談のある会社だけ */
  withDeals?: boolean;
}

/**
 * 画面に出ない実行者。**人ではない**ので、この名前が出たら担当者に読み替える。
 * Salesforce 側でフェーズを動かすと、誰が動かしたかはこちらに残らない
 * （Salesforce の OwnerId は社内ユーザーの体系が別で、画面の担当者と対応しない）。
 */
export const SYSTEM_ACTORS = new Set(['Salesforce', 'batch', 'バッチ実行', 'system']);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const stageOf = (v: unknown): string => STAGES.includes(str(v) as Stage) ? str(v) : 'INACTIVE';

export async function buildExport(f: ExportFilter = {}) {
  const inc = new Set<Include>(f.include?.length ? f.include : DEFAULT_INCLUDES);
  const today = todayJst();
  const [raw, db] = await Promise.all([buildRawFromNewSources(), buildDbView()]);

  const byId = <T>(rows: Array<{ id: string; data: unknown }>) =>
    new Map<string, T>(rows.map(r => [r.id, r.data as T]));
  const edits   = byId<Record<string, unknown>>(db.collections.edits   ?? []);
  const aplans  = byId<unknown>(db.collections.aplans  ?? []);
  const orgs    = byId<unknown>(db.collections.orgs    ?? []);
  const recents = byId<unknown>(db.collections.recent  ?? []);
  const minutes = byId<unknown>(db.collections.minutes ?? []);

  // ── 会社を軸に畳む ────────────────────────────────────────────────────────
  const companies = (raw.snapshot.companies ?? []).map(c => {
    const e  = edits.get(c.cid) ?? {};
    const co = (e.company ?? {}) as Record<string, unknown>;

    const deals = arr(e.deals)
      .filter((x): x is Record<string, unknown> => !!x && !!str((x as Record<string, unknown>).key))
      .map(x => {
        const stage = stageOf(x.phase);
        const naDate = str(x.naDate).slice(0, 10) || null;
        const d: Record<string, unknown> = {
          key:        str(x.key),
          name:       str(x.name) || null,
          stage,
          stageLabel: STAGE_JP[stage as Stage] ?? stage,
          // 社内の言い方（画面でフェーズ名の下に小さく出しているもの）
          stageNote:  STAGE_NOTE[stage] || null,
          /** ②（商談）追加MRR。円 */
          addMrr:     num(x.addMrr),
          /** ③ に使う係数 */
          forecast:   FORECAST[stage] ?? 0,
          /** ③（見込）追加MRR ＝ addMrr × forecast */
          expected:   num(x.addMrr) * (FORECAST[stage] ?? 0),
          applyDate:   str(x.applyDate)   || null,
          billingDate: str(x.billingDate) || null,
          termMonths:  x.term ?? null,
          barrier:     str(x.barrier) || null,
          need:        str(x.need)    || null,
          /** 失注理由（画面の選択肢）。2026-10-13 時点では誰も使っていない */
          lostReason:  str(x.lostReason) || null,
          /** 失注理由の詳細。**Salesforce の Dead_Detail_Reason__c から入る** */
          lostDetail:  str(x.lostDetail) || null,
          nextAction:     str(x.na)   || null,
          nextActionDate: naDate,
          /** ネクストアクションの期日が過ぎている */
          overdue: !!(str(x.na) && naDate && naDate < today
                      && !['CLOSED_WON', 'CLOSED_LOST'].includes(stage)),
          /** 到達予定（TRIAL / QUOTE / VERBAL_COMMIT） */
          milestones: x.ms ?? null,
          msBase:     str(x.msBase) || 'apply',
          /** Salesforce へ送れていない項目 */
          sfPending:  str(x.sfPending) || null,
          /** 承認待ちのフェーズ変更 */
          pendingStage: x.pendingPhase ?? null,
          updatedAt:  str(x.updatedAt) || null,
          /** Salesforce の商談から取り込んだもの */
          fromSalesforce: str(x.key).startsWith('sf:'),
        };
        if (inc.has('logs')) d.logs = arr(x.log);
        return d;
      });

    const out: Record<string, unknown> = {
      cid:  c.cid,
      name: c.n,
      tier: c.t,
      /** 新規顧客フラグ。Notion 顧客管理DB の「新規顧客」 */
      newCustomer: c.nc === true,
      industry: c.ind,
      /** Ptengine AI ステータス */
      status: c.ps,
      owners: c.o,
      /** 現在MRR（毎朝 Company Database から同期） */
      currentMrr: num(c.m),
      /** 期初MRR。積み上げの土台 */
      baseMrr: typeof c.bm === 'number' ? c.bm : num(c.m),
      /** ①（Target）追加MRR。取りにいく上限（Notion の「想定追加MRR」） */
      aimMrr: num(co.aim),
      /** ①（Commit）追加MRR。約束する数字（Notion の「Commit追加MRR」） */
      commitMrr: num(co.commit),
      sfAccountId: c.sfid,
      url: c.url, domain: c.dom,
      customerSuccess: c.cs,
      icp: c.icp, awareness: c.aw, source: c.src,
      /** Notion 顧客管理DB のネクストアクション履歴（生の文字列） */
      notionNextAction: c.na,
      updatedAt: c.up,
      keyDates: co.keyDates ?? null,
    };

    if (inc.has('deals'))  out.deals = deals;
    if (inc.has('success')) out.success = aplans.get(c.cid) ?? null;
    if (inc.has('org'))     out.org     = orgs.get(c.cid) ?? null;
    if (inc.has('recent'))  out.aiSummary = recents.get(c.cid) ?? null;
    if (inc.has('minutes')) out.minutes = minutes.get(c.cid) ?? null;
    if (inc.has('notes'))   out.notes   = c.notes ?? [];
    if (inc.has('docs'))    out.docs    = [...(c.docs ?? []), ...(c.od ?? [])];

    if (inc.has('kpi')) {
      const k = toKpiCompany(c.cid, c.o, num(c.m),
        typeof c.bm === 'number' ? c.bm : num(c.m), num(co.aim), deals, num(co.commit));
      const plan = planOf(k);
      out.kpi = {
        /** ②（商談）追加MRR の合計 */
        dealMrr: m2(k),
        /** ③（見込）追加MRR の合計 */
        expected: m3(k),
        wonMrr: wonAmt(k),
        /** 合算MRR。期初MRR ＋ ② */
        pipeline: rung(k, m2(k)),
        commit:    rung(k, atLeast(k, 'PROBABLE')),
        challenge: rung(k, atLeast(k, 'QUALIFIED_CHAMPION')),
        won:       rung(k, wonAmt(k)),
        /** 計画に入っていれば 期初MRR ＋ 追加分、入っていなければ null */
        plan: plan ? plan.base + plan.add : null,
        openDeals: deals.filter(d => !['CLOSED_LOST', 'ADMIN_CLOSE'].includes(String(d.stage))).length,
        overdue:   deals.filter(d => d.overdue).length,
      };
    }
    return out;
  });

  // ── 絞り込み ──────────────────────────────────────────────────────────────
  const dealsOf = (c: Record<string, unknown>) => arr(c.deals) as Array<Record<string, unknown>>;
  let rows = companies;
  if (f.cid)   rows = rows.filter(c => c.cid === f.cid);
  if (f.owner) rows = rows.filter(c => (c.owners as string[]).includes(f.owner!));
  if (f.q)     rows = rows.filter(c => String(c.name).includes(f.q!));
  if (f.stage) rows = rows.filter(c => dealsOf(c).some(d => d.stage === f.stage));
  if (f.withDeals) rows = rows.filter(c => dealsOf(c).length > 0);

  // ── 全体の数字（絞り込んだあとの集合で出す）──────────────────────────────
  const t = (db.collections.settings ?? []).find(s => s.id === 'targets')?.data as
    { targetMrr?: unknown; targetDue?: unknown; targets?: unknown } | undefined;
  const targets = (t?.targets ?? {}) as Record<string, unknown>;
  const kpiCos: KpiCompany[] = rows.map(c => toKpiCompany(
    String(c.cid), c.owners as string[], num(c.currentMrr), num(c.baseMrr), num(c.aimMrr),
    dealsOf(c), num(c.commitMrr)));
  const totals = [
    computeKpis(kpiCos, { scope: 'team', targetMrr: num(t?.targetMrr) || 40_000_000, today }),
    ...MEMBERS.map(m => computeKpis(kpiCos, { scope: m, targetMrr: num(targets[m]), today })),
  ];

  // ── 操作ログに担当者を紐づける ────────────────────────────────────────────
  //   `by` が「Salesforce」の行は、Salesforce 側で動かされたもので実行者が残らない。
  //   会社の担当者（Notion 顧客管理DB の担当3）で読み替える。
  //   **推定なので取り違えない**ように、どちらなのかを actorKind に必ず入れる。
  const ownersByCid = new Map<string, string[]>(
    companies.map(c => [String(c.cid), (c.owners as string[]) ?? []]));
  const attribute = (by: string | null, cid: string | null) => {
    const owners = (cid && ownersByCid.get(cid)) || [];
    const person = !!by && !SYSTEM_ACTORS.has(by);
    // ログインの表記（Eri Kitada / Omori Aoi / BB）を画面の担当者名へ揃える。
    // 揃えないと本人の操作が担当者に紐づかない
    return {
      actorKind: person ? 'person' : 'system',
      /** 誰の動きとして数えるか。person ならその人、system なら会社の担当者 */
      attributedTo: person ? [toPtaiName2(by!)] : owners,
      owners,
    };
  };
  const opLog: Array<Record<string, unknown>> = (db.collections.feed ?? [])
    .map((r): Record<string, unknown> => {
      const f = r.data as Record<string, unknown>;
      return { ...f, ...attribute(str(f.by) || null, str(f.cid) || null) };
    })
    .sort((a, b) => str(a.at) < str(b.at) ? -1 : 1);

  // ── 商談ごとのフェーズ履歴 ────────────────────────────────────────────────
  //   フェーズ変更は商談の経過ログ（testActivity）ではなく操作ログに残る。
  //   商談の鍵で突き合わせて、商談の下にぶら下げる。
  if (inc.has('logs')) {
    const phByKey = new Map<string, unknown[]>();
    for (const f of opLog) {
      if (f.kind !== 'ph' || !f.key) continue;
      const k = `${f.cid}|${f.key}`;
      (phByKey.get(k) ?? phByKey.set(k, []).get(k)!).push(
        { at: f.at, from: f.from, to: f.to, by: f.by,
          actorKind: f.actorKind, attributedTo: f.attributedTo });
    }
    for (const c of companies) {
      for (const d of (arr(c.deals) as Array<Record<string, unknown>>)) {
        d.stageHistory = phByKey.get(`${c.cid}|${d.key}`) ?? [];
      }
    }
  }

  // ── 進捗（誰がどれだけ動かしたか）─────────────────────────────────────────
  //   ⚠ これは**ダッシュボードと Salesforce に残った記録の数**であって、
  //     面談・メール・電話の量ではない。稼働量として読まないこと。
  const since = opLog.length ? str(opLog[0].at).slice(0, 10) : null;
  const tally = () => ({ stageUp: 0, stageDown: 0, lost: 0, won: 0, records: 0 });
  const blank = () => ({ self: tally(), viaSalesforce: tally(), days: new Set<string>() });
  const per = new Map<string, ReturnType<typeof blank>>();
  /**
   * 操作ログのフェーズ名は 2 通り混ざっている。
   *   画面から … 表示名（'Active' / 'Qualified Champion'）
   *   Salesforce から … そのままの値（'ACTIVE' / 'QUALIFIED_CHAMPION'）
   * どちらでも並び順を引けるようにする。揃えないと画面の操作が
   * 「前進 0 件」に見える（2026-10-13 に実データで気づいた）。
   */
  const BY_LABEL = new Map<string, Stage>(STAGES.map(s2 => [STAGE_JP[s2].toLowerCase(), s2]));
  const rank = (v: unknown) => {
    const k = str(v).trim();
    if (!k) return -1;
    const i = STAGES.indexOf(k as Stage);
    if (i >= 0) return i;
    const byLabel = BY_LABEL.get(k.toLowerCase());
    return byLabel ? STAGES.indexOf(byLabel) : -1;
  };
  /** 'Close Lost' でも 'CLOSED_LOST' でも同じ鍵にする */
  const stageKey = (v: unknown): string => {
    const i = rank(v);
    return i >= 0 ? STAGES[i] : str(v);
  };
  for (const f of opLog) {
    const who = f.attributedTo as string[];
    if (!who.length) continue;
    const self = f.actorKind === 'person';
    for (const m of who) {
      const v = per.get(m) ?? per.set(m, blank()).get(m)!;
      const t = self ? v.self : v.viaSalesforce;
      t.records++;
      // 稼働日は**本人の操作だけ**。Salesforce の取り込み日は本人が動いた日ではない
      if (self && str(f.at)) v.days.add(str(f.at).slice(0, 10));
      if (f.kind !== 'ph') continue;
      const to = stageKey(f.to);
      if (to === 'CLOSED_LOST' || to === 'ADMIN_CLOSE') t.lost++;
      else if (to === 'WON' || to === 'CLOSED_WON') t.won++;
      else if (rank(f.to) > rank(f.from)) t.stageUp++;
      else if (rank(f.to) >= 0 && rank(f.from) >= 0) t.stageDown++;
    }
  }
  const sum = (k: keyof ReturnType<typeof tally>, v: ReturnType<typeof blank>) =>
    v.self[k] + v.viaSalesforce[k];
  const progress = MEMBERS.map(m => {
    const v = per.get(m) ?? blank();
    return {
      member: m,
      stageUp: sum('stageUp', v), stageDown: sum('stageDown', v),
      lost: sum('lost', v), won: sum('won', v), records: sum('records', v),
      /** 本人が画面で操作した日数。Salesforce 由来は数えない */
      activeDays: v.days.size,
      /** 画面で本人が動かしたぶん */
      self: v.self,
      /** Salesforce 側で動いたぶん（**実行者は不明。会社の担当者に割り当てた推定**） */
      viaSalesforce: v.viaSalesforce,
    };
  });

  // Salesforce 由来の変更が固まって並んでいる＝1 回の取り込み。
  // 「その日に起きたこと」ではなく「その取り込みで気づいたこと」なので、
  // 日付をそのまま営業活動の日として読むと誤る。固まりの切れ目を出しておく。
  const syncRuns: Array<{ at: string; changes: number }> = [];
  for (const f of opLog) {
    if (f.actorKind !== 'system') continue;
    const at = str(f.at);
    const last = syncRuns[syncRuns.length - 1];
    // 10 分以内に続いたものは同じ取り込みとみなす
    if (last && Date.parse(at) - Date.parse(last.at) < 10 * 60_000) { last.changes++; continue; }
    syncRuns.push({ at, changes: 1 });
  }

  // ── 失注 ──────────────────────────────────────────────────────────────────
  const lostDeals = rows.flatMap(c => dealsOf(c)
    .filter(d => d.stage === 'CLOSED_LOST' || d.stage === 'ADMIN_CLOSE')
    .map(d => ({
      cid: c.cid, company: c.name, owners: c.owners,
      key: d.key, name: d.name, stage: d.stage,
      addMrr: d.addMrr, reason: d.lostReason, detail: d.lostDetail,
      barrier: d.barrier, updatedAt: d.updatedAt,
      /** 失注する直前に到達していたフェーズ。履歴が無ければ null */
      reachedStage: null as string | null,
    })));
  for (const l of lostDeals) {
    const hist = (opLog.filter(f => f.kind === 'ph' && f.cid === l.cid && f.key === l.key));
    const last = [...hist].reverse().find(
      f => stageKey(f.to) !== 'CLOSED_LOST' && stageKey(f.to) !== 'ADMIN_CLOSE');
    l.reachedStage = last ? stageKey(last.to)
      : (hist.length ? stageKey(hist[hist.length - 1].from) : null);
  }

  const result: Record<string, unknown> = {
    ok: true,
    generatedAt: new Date().toISOString(),
    today,
    include: [...inc],
    filter: { owner: f.owner ?? null, stage: f.stage ?? null, cid: f.cid ?? null,
              q: f.q ?? null, withDeals: !!f.withDeals },
    target: { mrr: num(t?.targetMrr) || 40_000_000, due: str(t?.targetDue) || null, byMember: targets },
    members: MEMBERS,
    stages: STAGES.map(s => ({ key: s, label: STAGE_JP[s], note: STAGE_NOTE[s] || null, forecast: FORECAST[s] ?? 0 })),
    totals,
    /** 誰がどれだけ動かしたか。**記録の数であって稼働量ではない** */
    progress: { since, until: today,
      note:
        'ダッシュボードと Salesforce に残った記録の数。面談・メール・電話は含まない。'
        + 'self は本人が画面で操作したぶん。viaSalesforce は Salesforce 側で動いたぶんで、'
        + '**実行者が記録に残らないため会社の担当者に割り当てた推定**。'
        + 'viaSalesforce の日付は取り込みで気づいた日であって、Salesforce で変わった日ではない。'
        + '同じ時刻に固まっているものは 1 回の取り込み（syncRuns を参照）。'
        + 'とくに最初の取り込みは、それまでの推定値を Salesforce の実態に合わせ直しただけで、'
        + 'その日に商談が動いたわけではない',
      byMember: progress,
      /** Salesforce からの取り込みの切れ目。まとまって動いているのはこのため */
      syncRuns },
    /** 失注した商談。reason は画面の選択肢、detail は Salesforce の失注理由詳細 */
    lost: { count: lostDeals.length,
            addMrr: lostDeals.reduce((t, l) => t + num(l.addMrr), 0),
            deals: lostDeals },
    counts: {
      companies: rows.length,
      deals: rows.reduce((s, c) => s + dealsOf(c).length, 0),
      allCompanies: companies.length,
    },
    companies: rows,
    partialFailures: [...raw.diagnostics.partialFailures, ...db.diagnostics.partialFailures],
  };
  if (inc.has('feed')) result.operationLog = opLog;
  return result;
}

function toKpiCompany(
  cid: string, owners: string[], curMrr: number, baseMrr: number, aim: number,
  deals: Array<Record<string, unknown>>, commit = 0,
): KpiCompany {
  const ds: KpiDeal[] = deals.map(d => ({
    stage:  String(d.stage ?? 'INACTIVE'),
    addMrr: num(d.addMrr),
    na:     (d.nextAction as string | null) ?? null,
    naDate: (d.nextActionDate as string | null) ?? null,
  }));
  return { cid, owners: owners ?? [], curMrr, baseMrr, aim, commit, deals: ds };
}
