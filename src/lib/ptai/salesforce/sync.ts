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

import { upsertByExternalId, listRecords, deleteRecord } from '../twenty-test/client';
import { TEST_OBJECTS } from '../twenty-test/schema';
import { listCustomers } from '../notion/client';
import { OWNER_FROM_NOTION } from '../notion/schema';
import { listPtaiOpportunities, isSalesforceConfigured } from './client';
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
  deleted: number;
  /** 取引先が無い／Notion に無い会社ぶん */
  skippedNoCompany: number;
  /** 取り込めなかった商談の名前（最大 10。画面に出す用。ログには出さない） */
  skippedNames?: string[];
  /** 同じ取引先 ID の会社が複数あり、振り分けで 1 つ選んだ件数 */
  ambiguous?: number;
  /** 最近やったばかりで何もしなかった */
  skipped?: boolean;
  message: string | null;
}

const EMPTY: SyncResult = {
  ok: false, fetched: 0, matched: 0, created: 0, updated: 0,
  deleted: 0, skippedNoCompany: 0, message: null,
};

/**
 * 最後に同期した時刻。`sf:` のレコードの updatedAt の最大値で測る。
 * 同期は毎回 update を打つので、これがそのまま「最後に走った時刻」になる。
 * 専用の保存先を作らずに済ませるための割り切り。
 */
export async function lastSyncedAt(): Promise<Date | null> {
  try {
    const rows = await listRecords(OPP.plural, OPP.singular, { pageSize: 200, maxRecords: 2000 });
    let max = 0;
    for (const r of rows) {
      if (!String(r.externalId ?? '').startsWith(SF_EXTERNAL_PREFIX)) continue;
      const t = new Date(String(r.updatedAt ?? '')).getTime();
      if (Number.isFinite(t) && t > max) max = t;
    }
    return max ? new Date(max) : null;
  } catch {
    return null;
  }
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

  const [opps, customers] = await Promise.all([
    listPtaiOpportunities(),
    listCustomers({ maxPages: 20 }),
  ]);

  // Salesforce の Account ID → Notion のページ ID（同じ ID の行が複数ありうる）
  const cidByAccount = new Map<string, Array<{ cid: string; owners: string[] }>>();
  for (const c of customers) {
    if (!c.sfAccountId) continue;
    const list = cidByAccount.get(c.sfAccountId) ?? [];
    list.push({ cid: c.pageId, owners: c.owners3 });
    cidByAccount.set(c.sfAccountId, list);
  }

  // 送信できていない項目がある商談は、その項目だけ上書きしない。
  // 先に 1 回だけ全件引いて控えておく（商談ごとに引くと件数ぶん往復する）
  const pendingByExt = new Map<string, Set<SfEditableKey>>();
  const idByExt      = new Map<string, string>();
  const rowByExt     = new Map<string, Record<string, unknown>>();
  for (const row of await listRecords(OPP.plural, OPP.singular, { pageSize: 200, maxRecords: 2000 })) {
    const ext = String(row.externalId ?? '');
    if (!ext.startsWith(SF_EXTERNAL_PREFIX)) continue;
    idByExt.set(ext, String(row.id));
    rowByExt.set(ext, row);
    const p = parsePending(row.sfPending);
    if (p.size) pendingByExt.set(ext, p);
  }

  const r: SyncResult = { ...EMPTY, ok: true, fetched: opps.length };
  const seen = new Set<string>();

  for (const o of opps) {
    const ext = `${SF_EXTERNAL_PREFIX}${o.id}`;
    const cands = o.accountId ? cidByAccount.get(o.accountId) ?? [] : [];
    const hit = pickCompany(cands, String(rowByExt.get(ext)?.notionCompanyId ?? '') || null);
    if (!hit) {
      r.skippedNoCompany++;
      // 画面に出すための名前（ログには出さない）
      if ((r.skippedNames ??= []).length < 10) r.skippedNames.push(o.name);
      continue;
    }
    if (cands.length > 1) r.ambiguous = (r.ambiguous ?? 0) + 1;
    r.matched++;

    seen.add(ext);
    if (dryRun) continue;
    const pend = pendingByExt.get(ext) ?? new Set<SfEditableKey>();

    const fields = {
      stage:       SF_TO_DASHBOARD_STAGE[o.stage] ?? 'INACTIVE',
      addMrr:      o.netMrr,
      applyDate:   o.closeDate,
      billingDate: o.billingDate,
    };
    const diff = syncChanges(rowByExt.get(ext), fields);
    const res = await upsertByExternalId(OPP.plural, OPP.singular, ext, {
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
    }, actor);
    res.created ? r.created++ : r.updated++;
    for (const c of diff.slice(0, 4)) await logSyncChange(ext, hit.cid, c, actor);

    // ネクストアクションは別レコード（testAction）。Salesforce の Next Action を写す
    if (!pend.has('nextAction')) {
      await syncNextAction(String(res.record.id), ext, hit.cid, o.nextAction, actor);
    }
  }

  // Salesforce から消えた（または PtAI でなくなった）ぶんを片付ける。
  // **画面で作った商談（edits: 接頭辞）には触らない。**
  if (!dryRun) {
    const all = await listRecords(OPP.plural, OPP.singular, { pageSize: 200, maxRecords: 2000 });
    for (const row of all) {
      const ext = String(row.externalId ?? '');
      if (!ext.startsWith(SF_EXTERNAL_PREFIX) || seen.has(ext)) continue;
      await deleteRecord(OPP.plural, String(row.id));
      r.deleted++;
    }
  }

  if (r.skippedNoCompany) {
    r.message = `${r.skippedNoCompany} 件は取引先が Notion 顧客管理DB に見つからず取り込めませんでした`
      + '（Notion の「Salesforce Account ID」に取引先 ID を入れると取り込まれます）';
  }
  return r;
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
  oppId: string, ext: string, cid: string, text: string | null, actor: ActorStamp,
): Promise<void> {
  const naExt = `${ext}:na`;
  const found = await listRecords(ACT.plural, ACT.singular,
    { filter: `externalId[eq]:${naExt}`, pageSize: 2, maxRecords: 2 });
  if (text) {
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
