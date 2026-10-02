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

  // Salesforce の Account ID → Notion のページ ID
  const cidByAccount = new Map<string, { cid: string; owners: string[] }>();
  for (const c of customers) {
    if (c.sfAccountId) cidByAccount.set(c.sfAccountId, { cid: c.pageId, owners: c.owners3 });
  }

  // 送信できていない項目がある商談は、その項目だけ上書きしない。
  // 先に 1 回だけ全件引いて控えておく（商談ごとに引くと件数ぶん往復する）
  const pendingByExt = new Map<string, Set<SfEditableKey>>();
  const idByExt      = new Map<string, string>();
  for (const row of await listRecords(OPP.plural, OPP.singular, { pageSize: 200, maxRecords: 2000 })) {
    const ext = String(row.externalId ?? '');
    if (!ext.startsWith(SF_EXTERNAL_PREFIX)) continue;
    idByExt.set(ext, String(row.id));
    const p = parsePending(row.sfPending);
    if (p.size) pendingByExt.set(ext, p);
  }

  const r: SyncResult = { ...EMPTY, ok: true, fetched: opps.length };
  const seen = new Set<string>();

  for (const o of opps) {
    const hit = o.accountId ? cidByAccount.get(o.accountId) : undefined;
    if (!hit) { r.skippedNoCompany++; continue; }
    r.matched++;

    const ext = `${SF_EXTERNAL_PREFIX}${o.id}`;
    seen.add(ext);
    if (dryRun) continue;
    const pend = pendingByExt.get(ext) ?? new Set<SfEditableKey>();

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
    r.message = `${r.skippedNoCompany} 件は取引先が Notion 顧客管理DB に見つからず取り込めませんでした`;
  }
  return r;
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
