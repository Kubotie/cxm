// ─── PtAI Pipeline: Twenty test* → 共有 DB の形に戻す ───────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md 付録（現行コレクションと移行先）
//
// ═══════════════════════════════════════════════════════════════════════════
//  **board.js は 1 行も変えない。** 原本は `window.claude.use('db')` から
//  collection/doc の形でデータを読むので、その形を Twenty test* から組み立てる。
//  移行スクリプト（ptai-migrate.mjs）の**逆向き**の変換。
//
//    testOpportunity / testAction / testActivity → edits
//    testAccountPlan / testAction(SUCCESS)       → aplans
//    testPerson                                  → orgs
//    testActivity(AI_RECENT)                     → recent
//    testOperationLog                            → feed
//    Notion 目標DB                               → settings/targets
//
//  会社の鍵は **Notion のページ ID**。`edits/<notionPageId>` になる。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログ: 件数だけ。顧客名・本文は出さない。

import { listRecords, TestWriteError } from './twenty-test/client';
import { TEST_OBJECTS, normalizeStage } from './twenty-test/schema';
import { readTeamTargets, listCustomers, NotionError } from './notion/client';

export type DbCollections = Record<string, Array<{ id: string; data: unknown }>>;

export interface DbViewResult {
  collections: DbCollections;
  diagnostics: {
    counts: Record<string, number>;
    partialFailures: string[];
  };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const date = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.slice(0, 10) : null;
};
const kindOf = (e: unknown): string =>
  (e as TestWriteError | NotionError)?.kind ?? 'error';

/** Twenty の LINKS 型から URL を取り出す */
function linkUrl(v: unknown): string | null {
  if (typeof v === 'string') return v || null;
  const o = v as { primaryLinkUrl?: unknown } | null;
  return typeof o?.primaryLinkUrl === 'string' && o.primaryLinkUrl ? o.primaryLinkUrl : null;
}

/** 空の値を落とす。原本は「無い項目はキーごと無い」前提で書かれている */
function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === '' ) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

async function fetchAll(
  key: keyof typeof TEST_OBJECTS, failures: string[], filter?: string,
): Promise<Record<string, unknown>[]> {
  const o = TEST_OBJECTS[key];
  try {
    return await listRecords(o.plural, o.singular, {
      pageSize: 200, maxRecords: 5000, ...(filter ? { filter } : {}),
    });
  } catch (e) {
    failures.push(`${o.plural}:${kindOf(e)}`);
    return [];
  }
}

/** AI_RECENT の新旧比較。occurredAt（生成時刻）を優先し、無ければ更新時刻 */
const recentAt = (r: Record<string, unknown>): string =>
  str(r.occurredAt) || str(r.updatedAt) || str(r.createdAt);

/**
 * AI_RECENT の note（JSON）を overview ほかに戻す。
 * 2026-10-06 より前の行は "[object Object]…" などの壊れた文字列なので捨てる
 * （見出しだけで中身が空の要約を出すより、未作成として出し直してもらう方がよい）。
 */
export function recentExtra(note: unknown): Record<string, unknown> {
  const s = str(note);
  if (!s.startsWith('{')) return {};
  try {
    const o = JSON.parse(s);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}

/** testOpportunity 1 件 → edits の opp / deals[] に入る形 */
function toEditDeal(row: Record<string, unknown>, key: string) {
  const ms = clean({
    TRIAL:         date(row.msTrial),
    QUOTE:         date(row.msQuote),
    VERBAL_COMMIT: date(row.msVerbal),
  });
  return clean({
    key,
    name:        str(row.name) || null,
    phase:       normalizeStage(row.stage),
    addMrr:      num(row.addMrr),
    applyDate:   date(row.applyDate),
    billingDate: date(row.billingDate),
    term:        num(row.termMonths),
    msBase:      str(row.msBase) || 'apply',
    ms:          Object.keys(ms).length ? ms : null,
    barrier:     str(row.barrier) || null,
    need:        str(row.need) || null,
    lostReason:  str(row.lostReason) || null,
    lostDetail:  str(row.lostDetail) || null,
    pendingPhase: normalizeStage(row.pendingStage),
    pendingEdit: row.pendingEdit ?? null,
    pendingDelete: row.pendingDelete ?? null,
    approvedAt:  str(row.approvedAt) || null,
    // Salesforce へ送れていない項目。画面に「未送信あり」を出すのに使う
    sfPending:   str(row.sfPending) || null,
    updatedAt:   str(row.updatedAt) || null,
  });
}

/** testActivity → 原本の経過ログ（log[]）の形 */
function toLogEntry(row: Record<string, unknown>) {
  const type = str(row.type);
  const t = type === 'STAGE_CHANGE' ? 'ph' : type === 'BARRIER_UPDATE' ? 'br' : 'na';
  const stage = normalizeStage(row.fromStage);
  return clean({
    t,
    at:   str(row.occurredAt) || null,
    // ネクストアクション完了は fromStage に「そのときのフェーズ」を入れている。
    // 道のりがフェーズごとに束ねるのに使う（2026-10-07）
    from: t === 'na' ? null : stage,
    ph:   t === 'na' ? stage : null,
    due:  t === 'na' ? date(row.dueDate) : null,
    to:   normalizeStage(row.toStage),
    text: str(row.text) || null,
    note: str(row.note) || null,
    by:   str(row.actor) || null,
  });
}

/**
 * Twenty test* ＋ Notion から、board.js が読む collection を組み立てる。
 * **pga_docs には一切触らない。**
 */
export async function buildDbView(): Promise<DbViewResult> {
  const partialFailures: string[] = [];

  const [opps, actions, activities, people, plans, oplogs, comments] = await Promise.all([
    fetchAll('opportunity',  partialFailures),
    fetchAll('action',       partialFailures),
    fetchAll('activity',     partialFailures),
    fetchAll('person',       partialFailures),
    fetchAll('accountPlan',  partialFailures),
    fetchAll('operationLog', partialFailures),
    fetchAll('comment',      partialFailures),
  ]);

  // 会社名とキー日程は Notion 側にある
  let customers: Awaited<ReturnType<typeof listCustomers>> = [];
  try { customers = await listCustomers({ maxPages: 20 }); }
  catch (e) { partialFailures.push(`notion_customers:${kindOf(e)}`); }
  const custById = new Map(customers.map(c => [c.pageId, c]));

  const group = <T,>(rows: T[], keyOf: (r: T) => string): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = keyOf(r);
      if (!k) continue;
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    return m;
  };
  const byCompany = (rows: Record<string, unknown>[]) =>
    group(rows, r => str(r.notionCompanyId));

  // ── edits ─────────────────────────────────────────────────────────────────
  /**
   * 原本が deals[].key として往復させる値。
   *
   * ・画面で作った商談 … `edits:<cid>:<key>` の <key>
   * ・Salesforce 由来  … `sf:<OpportunityId>` を**そのまま**返す
   *
   * ⚠ Twenty のレコード id を返してはいけない。保存時に別の externalId になり、
   *    元のレコードが消えて作り直される（2026-10-01 に直した）。
   * ⚠ Salesforce 由来を `d0` のような連番にしてもいけない。保存時に
   *    `edits:<cid>:d0` として**複製**されてしまう。
   */
  const dealKey = (r: Record<string, unknown>, cid: string): string => {
    const ext = str(r.externalId);
    if (ext.startsWith('sf:')) return ext;
    const prefix = `edits:${cid}:`;
    return ext.startsWith(prefix) ? ext.slice(prefix.length) : '';
  };

  const oppsBy = byCompany(opps);
  const actBy  = byCompany(actions);
  const actvBy = byCompany(activities);

  const edits: Array<{ id: string; data: unknown }> = [];
  const companyIds = new Set([...oppsBy.keys(), ...custById.keys()]);

  for (const cid of companyIds) {
    const cust = custById.get(cid);
    const rows = oppsBy.get(cid) ?? [];
    if (!rows.length && !cust) continue;

    const main = rows.find(r => r.isMain === true);
    const extra = rows.filter(r => r !== main);

    // 経過ログは商談ごとに束ねる
    const logsByOpp = group(actvBy.get(cid) ?? [], r => str(r.opportunityId));
    const naByOpp   = group((actBy.get(cid) ?? []).filter(r => str(r.kind) === 'NEXT_ACTION'),
                            r => str(r.opportunityId));

    const withExtras = (row: Record<string, unknown>, key: string) => {
      const d = toEditDeal(row, key) as Record<string, unknown>;
      const logs = (logsByOpp.get(str(row.id)) ?? [])
        .filter(l => str(l.type) !== 'AI_RECENT' && str(l.type) !== 'MEETING')
        .map(toLogEntry);
      if (logs.length) d.log = logs;
      const na = (naByOpp.get(str(row.id)) ?? []).find(a => str(a.status) !== 'DONE');
      if (na) { d.na = str(na.title); d.naDate = date(na.dueDate); }
      return d;
    };

    const kd = cust?.keyDates;
    const company = clean({
      keyDates: kd ? clean({
        fiscal:  kd.fiscalMonth  != null ? (kd.fiscalMonth === 'none' ? { none: true } : { month: kd.fiscalMonth }) : null,
        budget:  kd.budgetMonths != null ? (kd.budgetMonths === 'none' ? { none: true } : { fm: kd.budgetMonths[0], tm: kd.budgetMonths[1] }) : null,
        renewal: kd.renewalMonth != null ? (kd.renewalMonth === 'none' ? { none: true } : { month: kd.renewalMonth }) : null,
      }) : null,
      aim: cust?.aimMrr ?? null,
    });

    const data = clean({
      companyId:   cid,
      companyName: cust?.name ?? '',
      opp:   main ? withExtras(main, 'main') : {},
      // ⚠ 鍵は **externalId の末尾**にする。Twenty のレコード id を返すと、
      //    保存時に `edits:<cid>:<その id>` という別の externalId になり、
      //    **元のレコードが消えて作り直される**（保存のたびに id が変わり、
      //    createdAt と「作成者」が失われる）。2026-10-01 に気づいて直した。
      deals: extra.map((r, i) => withExtras(r, dealKey(r, cid) || `d${i}`)),
      company,
    });
    // 中身が何も無い会社は返さない（原本は「編集があるものだけ」を前提にしている）
    const d = data as Record<string, unknown>;
    if (!Object.keys((d.opp ?? {}) as object).length
        && !(d.deals as unknown[])?.length
        && !Object.keys((d.company ?? {}) as object).length) continue;
    edits.push({ id: cid, data });
  }

  // ── aplans ────────────────────────────────────────────────────────────────
  const plansBy = byCompany(plans);
  const succBy  = byCompany(actions.filter(r => str(r.kind) === 'SUCCESS'));
  const aplans: Array<{ id: string; data: unknown }> = [];
  for (const cid of new Set([...plansBy.keys(), ...succBy.keys()])) {
    const quarters: Record<string, unknown> = {};
    for (const p of plansBy.get(cid) ?? []) {
      const q = str(p.quarter);
      if (!q) continue;
      quarters[q] = clean({ goal: str(p.goal) || null, aim: num(p.aimMrr), src: str(p.source) || null });
    }
    const items = (succBy.get(cid) ?? []).map(a => clean({
      id:     str(a.id),
      t:      str(a.lane) || 'use',
      text:   str(a.title) || str(a.name),
      m:      str(a.month) || null,
      w:      a.week != null && str(a.week) !== '' ? Number(a.week) : null,
      done:   str(a.status) === 'DONE',
      doneAt: str(a.doneAt) || null,
      src:    str(a.source) || null,
    }));
    if (!Object.keys(quarters).length && !items.length) continue;
    aplans.push({ id: cid, data: clean({
      cid, company: custById.get(cid)?.name ?? '', quarters, items,
    }) });
  }

  // ── orgs ──────────────────────────────────────────────────────────────────
  const ATT_JP: Record<string, string> = {
    PROMOTE: '推進', FAVORABLE: '好意的', NEUTRAL: '中立',
    CAUTIOUS: '慎重', OPPOSED: '反対', UNKNOWN: '不明',
  };
  const CONF_JP: Record<string, string> = {
    PUBLIC: '公開', INTERNAL: '社内', ESTIMATED: '推定',
  };
  const ROLE_JP: Record<string, string> = {
    FINAL_APPROVER: '最終決裁者', APPROVER: '決裁者', INFLUENCER: '影響者',
    PROMOTER: '推進者', EVALUATOR: '技術評価者', USER: '利用者',
  };
  // ── 組織図の付帯情報（出典・確認事項・生成元）──────────────────────────
  //   原本の orgs ドキュメントは nodes のほかに genAt / genBy / sources / questions を
  //   持つ。testPerson は 1 行 1 人なので、図そのものではないこれらは testComment に
  //   置く（externalId: orgs:<cid>:source:N / :question:N / :meta）。
  const orgMeta = new Map<string, { genAt: string | null; genBy: string | null; sources: string[]; questions: string[] }>();
  for (const c of comments) {
    const ext = str(c.externalId);
    const m = ext.match(/^orgs:([^:]+):(source|question|meta)(?::\d+)?$/);
    if (!m) continue;
    const [, cid, kind] = m;
    const cur = orgMeta.get(cid)
      ?? { genAt: null, genBy: null, sources: [] as string[], questions: [] as string[] };
    if (kind === 'source')   { if (str(c.body)) cur.sources.push(str(c.body)); }
    else if (kind === 'question') { if (str(c.body)) cur.questions.push(str(c.body)); }
    else {
      cur.genAt = date(c.at);
      cur.genBy = str(c.author) || null;
    }
    orgMeta.set(cid, cur);
  }

  const peopleBy = byCompany(people);
  const orgs: Array<{ id: string; data: unknown }> = [];
  for (const [cid, all] of peopleBy) {
    // ⚠ ノードの id は **externalId の末尾**。Twenty のレコード id を返すと、
    //    次の保存で `orgs:<cid>:<レコードid>` という別の鍵になり、全員が
    //    作り直される（edits の dealKey と同じ罠。2026-10-06 に組織図も直した）。
    //    親も Twenty の parentId（レコード id）からノード id に引き直す。
    const prefix = `orgs:${cid}:`;
    const nodeId = (n: Record<string, unknown>): string => {
      const ext = str(n.externalId);
      return ext.startsWith(prefix) ? ext.slice(prefix.length) : str(n.id);
    };
    // 同じ鍵の重複行（保存が重なった名残）は 1 件にして返す
    const byKey = new Map<string, Record<string, unknown>>();
    for (const n of all) {
      const k = nodeId(n), cur = byKey.get(k);
      if (!cur || str(n.updatedAt) > str(cur.updatedAt)) byKey.set(k, n);
    }
    const rows = [...byKey.values()];
    const recToNode = new Map<string, string>();
    for (const n of all) recToNode.set(str(n.id), nodeId(n));
    const nodes = [...rows]
      .sort((a, b) => (num(a.order) ?? 0) - (num(b.order) ?? 0))
      .map(n => clean({
        id:      nodeId(n),
        kind:    (str(n.nodeType) || 'person').toLowerCase(),
        name:    str(n.name),
        title:   str(n.title) || null,
        role:    ROLE_JP[str(n.dealRole)] ?? null,
        stance:  ATT_JP[str(n.attitude)] ?? null,
        contact: str(n.contact) === 'CONTACTED' ? '接点あり' : str(n.contact) === 'NOT_CONTACTED' ? '未接触' : null,
        // ⚠ 原本の st（確定済みか）と conf（情報源）は**別の軸**。
        //    2026-10-01 まで infoSource 1 列に畳んでいたので、st='est' のノードは
        //    conf を失っていた。confirmed 列を足して解いた。
        //    confirmed が無い古い行は、畳んでいた頃の読み方に落とす。
        conf:    CONF_JP[str(n.infoSource)] ?? null,
        st:      n.confirmed === true ? 'ok'
               : n.confirmed === false ? 'est'
               : str(n.infoSource) === 'ESTIMATED' ? 'est' : 'ok',
        inf:     n.influential === true ? true : null,
        parent:  str(n.parentId) ? (recToNode.get(str(n.parentId)) ?? null) : null,
        note:    str(n.memo) || null,
        src:     str(n.sourceNote) || null,
      }));
    if (!nodes.length) continue;
    const meta = orgMeta.get(cid);
    orgs.push({ id: cid, data: clean({
      cid, company: custById.get(cid)?.name ?? '', nodes,
      // 組織図そのものではない付帯情報。原本は見出しと末尾に出す
      genAt:     meta?.genAt ?? null,
      genBy:     meta?.genBy ?? null,
      sources:   meta?.sources ?? [],
      questions: meta?.questions ?? [],
    }) });
  }

  // ── recent ────────────────────────────────────────────────────────────────
  //   1 社 1 件。移行で作った recent:<旧ID> と画面の recent:<cid> が並ぶ会社があるので
  //   新しい方を採る（同じ id で 2 件返すと、どちらが勝つかが並び順で決まる）。
  const recentBy = new Map<string, Record<string, unknown>>();
  for (const r of activities) {
    if (str(r.type) !== 'AI_RECENT') continue;
    const cid = str(r.notionCompanyId);
    const cur = recentBy.get(cid);
    if (!cur || recentAt(r) > recentAt(cur)) recentBy.set(cid, r);
  }
  const recent = [...recentBy].map(([cid, r]) => ({
    id: cid,
    data: clean({
      ...recentExtra(r.note),
      companyId:   cid,
      companyName: custById.get(cid)?.name ?? '',
      summary:     str(r.text) || null,
      genAt:       str(r.occurredAt) || null,
    }),
  }));

  // ── feed ──────────────────────────────────────────────────────────────────
  // 原本の「新着・更新」は**商談の変更だけ**を出す欄（§B-07）。
  // 画面が feed.add で送った行（externalId が ui:feed:）だけにする。保存のたびに
  // サーバーが残す要約（「商談を保存（N 件）」）まで流していたので、
  // 何をしたか分からない「• 商談を保存（0 件） →」が並んでいた（2026-10-06 Utty 指摘）。
  // 会社は鍵（ui:feed:<cid>:…）から、無い古い行は商談キーから引く。
  const oppByKey = new Map<string, Record<string, unknown>>();
  for (const o of opps) {
    const ext = str(o.externalId);
    if (ext.startsWith('sf:')) oppByKey.set(ext, o);
    else { const m = ext.match(/^edits:([^:]+):(.+)$/); if (m) oppByKey.set(`${m[1]}|${m[2]}`, o); }
  }
  const feed = oplogs
    .filter(r => str(r.object) === 'testOpportunity' && str(r.externalId).startsWith('ui:feed:'))
    .map(r => {
      const parts = str(r.externalId).split(':');            // ui feed [cid] ts rand
      const key = str(r.recordId);
      let cid = parts.length >= 5 ? parts[2] : '';
      const opp = oppByKey.get(key) ?? (cid ? oppByKey.get(`${cid}|${key}`) : undefined);
      if (!cid && opp) cid = str(opp.notionCompanyId);
      return {
        id: str(r.id),
        data: clean({
          at:      str(r.at) || null,
          by:      str(r.actor) || null,
          cid:     cid || null,
          key:     key || null,
          company: custById.get(cid)?.name ?? null,
          deal:    opp ? str(opp.name) || null : null,
          kind:    str(r.field) || null,
          label:   str(r.message) || null,
          from:    str(r.from) || null,
          to:      str(r.to) || null,
        }),
      };
    });

  // ── minutes（議事録タブの取り込み結果）─────────────────────────────────
  //   原本の形に戻す:
  //     { companyId, companyName, notion:{fetchedAt, items[]}, mii:{syncedAt, items[]} }
  //   items は {title, date, url, text}。保存は testActivity(type=MEETING)。
  const minutesBy = new Map<string, { notion: unknown[]; mii: unknown[]; at: string }>();
  for (const r of activities) {
    if (str(r.type) !== 'MEETING') continue;
    const cid = str(r.notionCompanyId);
    if (!cid) continue;
    const src = str(r.meetingSource) === 'MII' ? 'mii' : 'notion';
    const cur = minutesBy.get(cid) ?? { notion: [], mii: [], at: '' };
    cur[src].push(clean({
      title: str(r.name),
      date:  date(r.occurredAt) ?? '',
      // LINKS 型は {primaryLinkUrl} で返る
      url:   linkUrl(r.sourceUrl),
      text:  str(r.text) || '',
    }));
    const u = str(r.updatedAt) || str(r.createdAt);
    if (u > cur.at) cur.at = u;
    minutesBy.set(cid, cur);
  }
  const minutes: Array<{ id: string; data: unknown }> = [];
  for (const [cid, v] of minutesBy) {
    minutes.push({ id: cid, data: clean({
      companyId:   cid,
      companyName: custById.get(cid)?.name ?? '',
      notion: v.notion.length ? { fetchedAt: v.at, items: v.notion } : null,
      mii:    v.mii.length    ? { syncedAt:  v.at, items: v.mii }    : null,
    }) });
  }

  // ── settings ──────────────────────────────────────────────────────────────
  const settings: Array<{ id: string; data: unknown }> = [];
  try {
    const t = await readTeamTargets();
    settings.push({ id: 'targets', data: t });
  } catch (e) {
    partialFailures.push(`notion_targets:${kindOf(e)}`);
  }

  const collections: DbCollections = { edits, aplans, orgs, recent, feed, settings, minutes };
  const counts = Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length]));

  console.info('[ptai/db-view] 組み立て', JSON.stringify({
    ...counts, partialFailures: partialFailures.length,
  }));

  return { collections, diagnostics: { counts, partialFailures: [...new Set(partialFailures)] } };
}
