// ─── Salesforce の商談を Twenty の testOpportunity へ写す（サーバー専用）────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **Salesforce が商談と金額の正本。** こちらは写しを持つだけで、書き戻さない。
//  金額は `Opportunity.Amount` が作成不可・更新不可（明細からのロールアップ）
//  なので、そもそもこちらからは入れられない。
//
//  同一性の鍵は `externalId = sf:<OpportunityId>`。
//  ダッシュボードで作った商談（`edits:<cid>:<key>`）とは**接頭辞で分かれている**ので、
//  画面からの保存（全置換）で消えることはない。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログ: 件数だけ。顧客名・商談名は出さない。

import { upsertByExternalId, listRecords, listByExternalPrefix, deleteRecord } from '../twenty-test/client';
import { TEST_OBJECTS } from '../twenty-test/schema';
import { listCustomers, updateCustomerWithExtras } from '../notion/client';
import { OWNER_FROM_NOTION, CUSTOMER_PROP } from '../notion/schema';
import { listPtaiOpportunities, listAccountNames, isSalesforceConfigured } from './client';
import { SF_TO_DASHBOARD_STAGE, SF_EDITABLE_KEYS, type SfEditableKey } from './schema';
import type { ActorStamp } from '../staff';

const OPP = TEST_OBJECTS.opportunity;
const ACT = TEST_OBJECTS.action;
const LOG = TEST_OBJECTS.operationLog;

/** 新着欄と変更履歴に残す項目（Salesforce でしか直せないもの）。kind は画面の FEED_F の鍵 */
const TRACKED: Array<{ kind: string; label: string; field: string }> = [
  { kind: 'ph',    label: 'フェーズ',     field: 'stage' },
  { kind: 'add',   label: '（見込）追加MRR', field: 'addMrr' },
  { kind: 'apply', label: '申込完了日',   field: 'applyDate' },
  { kind: 'bill',  label: '課金開始日',   field: 'billingDate' },
];
const norm = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};

/**
 * 取り込みで変わった項目。前回の写し（before）が無い＝初回の取り込みは変更として数えない。
 * 2026-10-06 まで取り込みは履歴を残さず、申込完了日・課金開始日の変更が追えなかった（Utty 指摘）。
 */
export function syncChanges(
  before: Record<string, unknown> | undefined, after: Record<string, unknown>,
): Array<{ kind: string; label: string; from: string; to: string }> {
  if (!before) return [];
  const out: Array<{ kind: string; label: string; from: string; to: string }> = [];
  for (const t of TRACKED) {
    const a = norm(before[t.field]), b = norm(after[t.field]);
    if (a !== b) out.push({ kind: t.kind, label: t.label, from: a, to: b });
  }
  return out;
}

/**
 * 取引先 ID が同じ会社が Notion に複数あるとき（1 社を ToB／ToC の 2 行に分けている等）の振り分け。
 * 2026-10-06 までは Notion が返した順で後ろの行が勝ち、どちらに付くか決まっていなかった（Eri 指摘）。
 *   1. いま Twenty で付いている会社が候補にあれば、それを保つ（Twenty で付け替えたものを戻さない）
 *   2. 無ければページ ID の順で先頭（毎回同じ結果になる）
 */
export function pickCompany<T extends { cid: string }>(cands: T[], current: string | null): T | undefined {
  if (cands.length <= 1) return cands[0];
  return cands.find(c => c.cid === current) ?? [...cands].sort((a, b) => a.cid.localeCompare(b.cid))[0];
}

/** `sfPending` の読み書き。カンマ区切りの素朴な持ち方 */
const parsePending = (v: unknown): Set<SfEditableKey> =>
  new Set(String(v ?? '').split(',').map(x => x.trim())
    .filter((x): x is SfEditableKey => (SF_EDITABLE_KEYS as string[]).includes(x)));

/** 同期で作ったレコードの印。画面で作ったものと混ざらないようにする */
export const SF_EXTERNAL_PREFIX = 'sf:';

export interface SyncResult {
  ok: boolean;
  /** Salesforce から取れた PtAI 商談 */
  fetched: number;
  /** Notion の会社に紐付いたもの */
  matched: number;
  created: number;
  updated: number;
  /** 前回の写しと同じで、書き込まなかったもの */
  unchanged: number;
  deleted: number;
  /** 「Salesforce Account ID」が空だった会社に、ロールアップ／社名から ID を書き戻した数 */
  linked: number;
  /** 取引先が無い／Notion に無い会社ぶん */
  skippedNoCompany: number;
  /** 取り込めなかった商談の名前（画面に出す用。ログには出さない） */
  skippedNames?: string[];
  /** 同じ取引先 ID の会社が複数あり、振り分けで 1 つ選んだ件数 */
  ambiguous?: number;
  /** 最近やったばかりで何もしなかった */
  skipped?: boolean;
  message: string | null;
}

const EMPTY: SyncResult = {
  ok: false, fetched: 0, matched: 0, created: 0, updated: 0, unchanged: 0,
  deleted: 0, linked: 0, skippedNoCompany: 0, message: null,
};

// ═══════════════════════════════════════════════════════════════════════════
//  同期の結果を 1 行だけ残す（2026-10-13）
//
//  紐付かない商談が 14 件あっても、それを知らせるのは「更新」ボタンの alert
//  だけで、Cron や画面を開いたときの自動同期では**誰にも見えないまま**毎日
//  飛ばしていた（Baba 指摘）。Vercel Hobby はログが 1 時間で消えるので、
//  自動同期が動いたかどうかも後から分からなかった。
//  → 毎回の結果を testOperationLog の固定 externalId に上書きし、画面上部に出す。
//    「最後に同期した時刻」もここで測る（以前は sf: 商談の updatedAt の最大値で、
//    画面で商談を直しただけでも「同期済み」に見えていた）。
// ═══════════════════════════════════════════════════════════════════════════

export const SYNC_STATUS_EXT = 'sys:sf-sync:status';

export interface SyncStatus {
  at: string;
  ok: boolean;
  /** 誰の操作で走ったか（batch＝Cron） */
  by: string;
  fetched: number; matched: number; created: number; updated: number;
  unchanged: number; deleted: number; linked: number;
  /** 取り込めなかった商談（全件） */
  skipped: Array<{ opp: string; account: string | null }>;
  ms: number;
  error?: string;
}

async function writeSyncStatus(s: SyncStatus, actor: ActorStamp): Promise<void> {
  try {
    await upsertByExternalId(LOG.plural, LOG.singular, SYNC_STATUS_EXT, {
      name: 'Salesforce 同期の結果', at: s.at, actor: actor.displayName || actor.name2,
      action: 'sync', object: 'sfSync', recordId: 'status', field: 'status',
      source: 'sync', message: JSON.stringify(s),
    }, actor);
  } catch { /* 残せなくても同期そのものは成立している */ }
}

export function parseSyncStatus(row: Record<string, unknown> | undefined): SyncStatus | null {
  if (!row) return null;
  try { return JSON.parse(String(row.message ?? '')) as SyncStatus; } catch { return null; }
}

/** 最後に同期を**やり終えた**時刻。失敗した回は数えない */
export async function lastSyncedAt(): Promise<Date | null> {
  try {
    const rows = await listRecords(LOG.plural, LOG.singular,
      { filter: `externalId[eq]:${SYNC_STATUS_EXT}`, pageSize: 2, maxRecords: 2 });
    const s = parseSyncStatus(rows[0]);
    return s?.ok && s.at ? new Date(s.at) : null;
  } catch {
    return null;
  }
}

/** 社名の突き合わせ用。法人格・空白・全半角の違いを無視する */
const companyKey = (s: string): string =>
  s.normalize('NFKC').replace(/株式会社|有限会社|合同会社|\(株\)|[\s・\-ー]/g, '').toLowerCase();

/** 同時に投げる書き込みの数。Twenty は 1 件 0.5〜1 秒かかり、直列だと 71 件で 300 秒の上限に迫った */
const CONCURRENCY = 5;

async function eachLimited<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/**
 * Salesforce → Twenty の一方向の写し取り。
 *
 * @param actor    書き込みの記録に使う操作者
 * @param dryRun   true なら数えるだけで書かない
 * @param maxAgeMs 指定すると、これより新しい同期が済んでいれば**何もしない**
 */
export async function syncSalesforceOpportunities(
  actor: ActorStamp, dryRun = false, maxAgeMs?: number,
): Promise<SyncResult> {
  if (!isSalesforceConfigured()) {
    return { ...EMPTY, message: 'Salesforce が未設定です' };
  }

  if (maxAgeMs) {
    const last = await lastSyncedAt();
    if (last && Date.now() - last.getTime() < maxAgeMs) {
      return { ...EMPTY, ok: true, skipped: true, message: null };
    }
  }

  const startedAt = Date.now();
  try {
    const r = await runSync(actor, dryRun);
    if (!dryRun) {
      await writeSyncStatus({
        at: new Date().toISOString(), ok: true, by: actor.name2,
        fetched: r.fetched, matched: r.matched, created: r.created, updated: r.updated,
        unchanged: r.unchanged, deleted: r.deleted, linked: r.linked,
        skipped: r.skippedList, ms: Date.now() - startedAt,
      }, actor);
    }
    const { skippedList: _, ...out } = r;
    return out;
  } catch (e) {
    if (!dryRun) {
      await writeSyncStatus({
        at: new Date().toISOString(), ok: false, by: actor.name2,
        fetched: 0, matched: 0, created: 0, updated: 0, unchanged: 0, deleted: 0, linked: 0,
        skipped: [], ms: Date.now() - startedAt, error: (e as Error).name || 'Error',
      }, actor);
    }
    throw e;
  }
}

async function runSync(
  actor: ActorStamp, dryRun: boolean,
): Promise<SyncResult & { skippedList: SyncStatus['skipped'] }> {
  const [opps, customers, oppRows, naRows] = await Promise.all([
    listPtaiOpportunities(),
    listCustomers({ maxPages: 20 }),
    listRecords(OPP.plural, OPP.singular, { pageSize: 200, maxRecords: 2000 }),
    listByExternalPrefix(ACT.plural, ACT.singular, SF_EXTERNAL_PREFIX),
  ]);

  // ── 取引先 → Notion の会社 ──────────────────────────────────────────────
  // 鍵は 3 段。上の段で付いた取引先には下の段を使わない。
  //   1. 「Salesforce Account ID」（人が入れた列）
  //   2. ` sf_company_id`（Company Database リレーション越しのロールアップ）
  //   3. 社名の完全一致（法人格・空白を無視。1 社に絞れたときだけ）
  // 2・3 で付いた会社は 1 の列に書き戻す。次回からは 1 で付く。
  type Cand = { cid: string; owners: string[] };
  const cidByAccount = new Map<string, Cand[]>();
  const addCand = (acc: string, c: (typeof customers)[number]) => {
    const list = cidByAccount.get(acc) ?? [];
    if (!list.some(x => x.cid === c.pageId)) list.push({ cid: c.pageId, owners: c.owners3 });
    cidByAccount.set(acc, list);
  };
  for (const c of customers) if (c.sfAccountId) addCand(c.sfAccountId, c);

  const toLink = new Map<string, string>();   // cid → 書き戻す Account ID
  const viaRollup = new Map<string, Array<(typeof customers)[number]>>();
  for (const c of customers) {
    if (c.sfAccountId) continue;
    for (const acc of c.sfCompanyIds) {
      if (cidByAccount.has(acc)) continue;
      (viaRollup.get(acc) ?? viaRollup.set(acc, []).get(acc)!).push(c);
    }
  }
  for (const [acc, cs] of viaRollup) {
    for (const c of cs) addCand(acc, c);
    if (cs.length === 1 && cs[0].sfCompanyIds.length === 1) toLink.set(cs[0].pageId, acc);
  }

  const unknownAccounts = [...new Set(opps.map(o => o.accountId).filter((a): a is string => !!a && !cidByAccount.has(a)))];
  const accountName = new Map<string, string>();
  if (unknownAccounts.length) {
    try {
      for (const a of await listAccountNames(unknownAccounts)) accountName.set(a.id, a.name);
    } catch { /* 社名が引けなくても、付いたぶんは取り込む */ }
    const byName = new Map<string, Array<(typeof customers)[number]>>();
    for (const c of customers) {
      if (c.sfAccountId) continue;
      const k = companyKey(c.name);
      if (k) (byName.get(k) ?? byName.set(k, []).get(k)!).push(c);
    }
    for (const acc of unknownAccounts) {
      const hits = byName.get(companyKey(accountName.get(acc) ?? ''));
      if (hits?.length !== 1) continue;
      addCand(acc, hits[0]);
      if (!toLink.has(hits[0].pageId)) toLink.set(hits[0].pageId, acc);
    }
  }

  // ── いまの写し。1 回だけ全件引いて控える（商談ごとに引くと件数ぶん往復する）
  const pendingByExt = new Map<string, Set<SfEditableKey>>();
  const rowByExt     = new Map<string, Record<string, unknown>>();
  for (const row of oppRows) {
    const ext = String(row.externalId ?? '');
    if (!ext.startsWith(SF_EXTERNAL_PREFIX)) continue;
    rowByExt.set(ext, row);
    // 送信できていない項目がある商談は、その項目だけ上書きしない
    const p = parsePending(row.sfPending);
    if (p.size) pendingByExt.set(ext, p);
  }
  const naByExt = new Map<string, Record<string, unknown>[]>();
  for (const a of naRows) {
    const ext = String(a.externalId ?? '');
    if (ext.endsWith(':na')) (naByExt.get(ext) ?? naByExt.set(ext, []).get(ext)!).push(a);
  }

  const r: SyncResult & { skippedList: SyncStatus['skipped'] } =
    { ...EMPTY, ok: true, fetched: opps.length, skippedList: [] };
  const seen = new Set<string>();
  const usedLinks = new Set<string>();
  const work: Array<() => Promise<void>> = [];

  for (const o of opps) {
    const ext = `${SF_EXTERNAL_PREFIX}${o.id}`;
    const cands = o.accountId ? cidByAccount.get(o.accountId) ?? [] : [];
    const hit = pickCompany(cands, String(rowByExt.get(ext)?.notionCompanyId ?? '') || null);
    if (!hit) {
      r.skippedNoCompany++;
      r.skippedList.push({ opp: o.name, account: (o.accountId && accountName.get(o.accountId)) || null });
      continue;
    }
    if (cands.length > 1) r.ambiguous = (r.ambiguous ?? 0) + 1;
    if (toLink.has(hit.cid)) usedLinks.add(hit.cid);
    r.matched++;

    seen.add(ext);
    if (dryRun) continue;
    const pend = pendingByExt.get(ext) ?? new Set<SfEditableKey>();
    const before = rowByExt.get(ext);

    const rec: Record<string, unknown> = {
      name:            o.name,
      notionCompanyId: hit.cid,
      stage:           SF_TO_DASHBOARD_STAGE[o.stage] ?? 'INACTIVE',
      // 「（見込）追加MRR」は NetGain MRR。更新商談だと増加分がここに入る
      addMrr:          o.netMrr,
      // 「申込完了日」は商談の完了予定日
      applyDate:       o.closeDate,
      // 「課金開始日」は Salesforce の Payment_Day__c
      billingDate:     o.billingDate,
      termMonths:      o.termMonths,
      // ⚠ 障壁・ニーズ・ネクストアクションは **Salesforce が正**（2026-10-02 Kubotie）。
      //   画面で直したぶんは保存と同時に Salesforce へ送っているので、ここで
      //   上書きしてよい。送れていない項目（sfPending）だけ手を付けない。
      ...(pend.has('need')    ? {} : { need:    o.needs }),
      ...(pend.has('barrier') ? {} : { barrier: o.barrier }),
      lostDetail:      o.lostDetail,
      // 担当は Notion の担当3（Salesforce の OwnerId は社内ユーザーで体系が別）
      owner:           ownerOf(hit.owners),
      // 画面で作った商談（main）とは別物として並べる
      isMain:          false,
    };

    work.push(async () => {
      // 前回の写しと同じなら書かない。以前は毎回全件を書き直していて、
      // 71 件で 240〜290 秒かかり、関数の上限（300 秒）すれすれだった（2026-10-13）
      let oppId = String(before?.id ?? '');
      if (before && sameAs(before, rec)) {
        r.unchanged++;
      } else {
        const res = await upsertByExternalId(OPP.plural, OPP.singular, ext, rec, actor);
        oppId = String(res.record.id);
        res.created ? r.created++ : r.updated++;
        for (const c of syncChanges(before, rec).slice(0, 4)) await logSyncChange(ext, hit.cid, c, actor);
      }
      // ネクストアクションは別レコード（testAction）。Salesforce の Next Action を写す
      if (!pend.has('nextAction')) {
        await syncNextAction(oppId, ext, hit.cid, o.nextAction, naByExt.get(`${ext}:na`) ?? [], actor);
      }
    });
  }

  if (!dryRun) {
    await eachLimited(work, CONCURRENCY, fn => fn());

    // 2・3 段目で付いた会社は「Salesforce Account ID」に書き戻す。
    // 商談が実際に付いた会社だけ（関係ない行まで触らない）
    await eachLimited([...usedLinks], CONCURRENCY, async cid => {
      try {
        const u = await updateCustomerWithExtras(cid, {}, { [CUSTOMER_PROP.sfAccountId]: toLink.get(cid)! });
        if (u.ok) r.linked++;
      } catch { /* 書き戻せなくても、今回の取り込みは鍵 2・3 で済んでいる */ }
    });

    // Salesforce から消えた（または PtAI でなくなった）ぶんを片付ける。
    // **画面で作った商談（edits: 接頭辞）には触らない。**
    // 紐付かなかった商談も消さない（Notion 側の不備で写しが消えると戻すのが手間）
    const skippedExt = new Set(opps.map(o => `${SF_EXTERNAL_PREFIX}${o.id}`));
    for (const [ext, row] of rowByExt) {
      if (seen.has(ext) || skippedExt.has(ext)) continue;
      await deleteRecord(OPP.plural, String(row.id));
      r.deleted++;
    }
  }

  if (r.skippedNoCompany) {
    r.skippedNames = r.skippedList.map(s => s.opp);
    r.message = `${r.skippedNoCompany} 件は取引先が Notion 顧客管理DB に見つからず取り込めませんでした`
      + '（Notion の「Salesforce Account ID」に取引先 ID を入れると取り込まれます）';
  }
  return r;
}

/** 写しが今回の値と同じか。Twenty の返す形（日付は ISO、空は null/''）の揺れは norm で吸収する */
function sameAs(before: Record<string, unknown>, rec: Record<string, unknown>): boolean {
  return Object.entries(rec).every(([k, v]) => norm(before[k]) === norm(v));
}

/**
 * 取り込みで変わった項目を操作記録に残す。新着欄（db-view の feed）が `ui:feed:<cid>:` で拾う。
 * 失敗しても取り込みは止めない。
 */
async function logSyncChange(
  ext: string, cid: string, c: { kind: string; label: string; from: string; to: string }, actor: ActorStamp,
): Promise<void> {
  try {
    await upsertByExternalId(LOG.plural, LOG.singular,
      `ui:feed:${cid.replace(/:/g, '')}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`, {
        name: `${c.label}（Salesforce）`, at: new Date().toISOString(), actor: 'Salesforce',
        action: 'sync', object: 'testOpportunity', recordId: ext, field: c.kind,
        from: c.from || null, to: c.to || null, source: 'sync', message: c.label,
      }, actor);
  } catch { /* 記録できなくても取り込みは成立している */ }
}

/**
 * Salesforce の Next Action を testAction（kind=NEXT_ACTION）に写す。
 * 空になったら消す。期日は Salesforce 側に項目が無いので触らない。
 */
async function syncNextAction(
  oppId: string, ext: string, cid: string, text: string | null,
  found: Record<string, unknown>[], actor: ActorStamp,
): Promise<void> {
  const naExt = `${ext}:na`;
  if (text) {
    // 同じ文面・同じ商談に付いていれば書かない
    if (found.length === 1 && String(found[0].title ?? '') === text
        && String(found[0].opportunityId ?? '') === oppId) return;
    await upsertByExternalId(ACT.plural, ACT.singular, naExt, {
      name: text, notionCompanyId: cid, opportunityId: oppId,
      kind: 'NEXT_ACTION', title: text, status: 'OPEN', source: 'ui',
    }, actor);
  } else {
    for (const a of found) await deleteRecord(ACT.plural, String(a.id));
  }
}

function ownerOf(owners3: string[]): string | null {
  for (const o of owners3 ?? []) {
    const v = OWNER_FROM_NOTION[o] ?? o;
    if (v && v !== 'その他') return v;
  }
  return null;
}
