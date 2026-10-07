// ─── PtAI Pipeline: 共有 DB への保存を Twenty / Notion へ振り分ける ─────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §6（保存時の共通処理）・§7・§8
//
// ═══════════════════════════════════════════════════════════════════════════
//  **board.js は 1 行も変えない。** 原本は `doc.set(body)` で
//  **ドキュメントまるごと**を送ってくる（全置換・後勝ち）。
//  ここで現在の状態と突き合わせ、作成・更新・削除に振り分ける。
//
//    edits/<cid>    → testOpportunity ＋ testAction ＋ testActivity ＋ Notion
//    aplans/<cid>   → testAccountPlan ＋ testAction(SUCCESS)
//    orgs/<cid>     → testPerson
//    recent/<cid>   → testActivity(AI_RECENT)
//    settings/targets → Notion 目標DB
//
//  同一性の鍵は **`externalId`**。移行スクリプトと同じ付け方にしてあるので、
//  移行済みのレコードを二重に作らない。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 守ること ──────────────────────────────────────────────────────────────────
//   - 承認が要る変更は `edit-guard` を通す（§4-2）
//   - 変更は `testOperationLog` に残す（§6）
//   - 顧客名・本文をログに出さない。出すのは件数と種別だけ

import {
  upsertByExternalId, listByExternalPrefix, deleteRecord, listRecords, updateRecord,
  TestWriteError,
} from './twenty-test/client';
import { TEST_OBJECTS, normalizeStage, type Stage } from './twenty-test/schema';
import { getCustomer, updateCustomerWithExtras, listTargetRows, updateTargetRow } from './notion/client';
import { OWNER_FROM_NOTION } from './notion/schema';
import { assertStageChangeAllowed, APPROVER_REQUIRED_MESSAGE } from './edit-guard';
import { actorStampFor, type ActorStamp } from './staff';
import { pushOpportunityFields } from './salesforce/client';
import { SF_EDITABLE_KEYS } from './salesforce/schema';
import type { PtaiIdentity } from './approver';

const OPP  = TEST_OBJECTS.opportunity;
const ACT  = TEST_OBJECTS.action;
const ACTV = TEST_OBJECTS.activity;
const PERS = TEST_OBJECTS.person;
const PLAN = TEST_OBJECTS.accountPlan;
const LOG  = TEST_OBJECTS.operationLog;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const numOr = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter(x => x && typeof x === 'object') as Record<string, unknown>[] : [];

/**
 * ⚠ `tsconfig` が `strict: false` なので、判別可能ユニオンの絞り込みが効かない。
 *    呼び出し側で `r.error` を読めるよう、**両方のメンバーに全プロパティを置く**。
 */
export type WriteResult =
  | { ok: true;  changes: Record<string, number>; status?: undefined; error?: undefined; message?: undefined }
  | { ok: false; changes?: undefined; status: 403 | 501 | 502; error: string; message?: string };

export type AddResult =
  | { ok: true;  id: string; status?: undefined; error?: undefined }
  | { ok: false; id?: undefined; status: 501 | 502; error: string };

/** 保存の記録（§6）。失敗しても保存そのものは止めない */
async function writeLog(
  who: ActorStamp, action: string, object: string, recordId: string | null,
  message: string, opts: { field?: string; from?: string | null; to?: string | null; source?: 'ui' | 'ai' } = {},
): Promise<void> {
  const { field, from, to, source = 'ui' } = opts;
  try {
    await upsertByExternalId(LOG.plural, LOG.singular,
      `ui:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`, {
        name: message, at: new Date().toISOString(), actor: who.name2, action,
        object, recordId, field: field ?? null,
        from: from ?? null, to: to ?? null, source, message,
      }, who);
  } catch {
    // 記録に失敗しても本体の保存は成立している
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// edits
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Notion の「担当3」→ ダッシュボード表記の name2。
 * 複数人いるときは先頭だけを `owner` に入れる（Twenty 側は単一値の TEXT）。
 */
export function ownerOf(owners3: string[] | undefined): string | null {
  for (const o of owners3 ?? []) {
    const v = OWNER_FROM_NOTION[o] ?? o;
    if (v && v !== 'その他') return v;
  }
  return null;
}

/** edits の 1 商談 → testOpportunity のフィールド */
function dealFields(x: Record<string, unknown>, cid: string, isMain: boolean, owner: string | null) {
  const ms = rec(x.ms);
  return {
    name:        str(x.name) || 'Ptengine AI',
    notionCompanyId: cid,
    owner,
    stage:        normalizeStage(x.phase),
    pendingStage: normalizeStage(x.pendingPhase),
    addMrr:      numOr(x.addMrr),
    applyDate:   str(x.applyDate) || null,
    billingDate: str(x.billingDate) || null,
    termMonths:  numOr(x.term),
    msBase:      str(x.msBase) === 'bill' ? 'bill' : 'apply',
    msTrial:     str(ms.TRIAL) || null,
    msQuote:     str(ms.QUOTE) || null,
    msVerbal:    str(ms.VERBAL_COMMIT) || null,
    barrier:     str(x.barrier) || null,
    need:        str(x.need) || null,
    lostReason:  str(x.lostReason) || null,
    lostDetail:  str(x.lostDetail) || null,
    pendingEdit:   x.pendingEdit ?? null,
    pendingDelete: x.pendingDelete ?? null,
    approvedAt:  str(x.approvedAt) || null,
    isMain,
  };
}

/**
 * ネクストアクション（1 商談に 1 つ）。
 * `sf:` 由来の商談でも画面のものを正とするので、両方からここを通す。
 * 空になったら消す（原本は完了時に na を空にしてくる）。
 */
async function writeNextAction(
  baseExt: string, cid: string, oppId: string, x: Record<string, unknown>,
  owner: string | null, who: ActorStamp, changes: Record<string, number>,
): Promise<void> {
  const naExt = `${baseExt}:na`;
  if (str(x.na)) {
    await upsertByExternalId(ACT.plural, ACT.singular, naExt, {
      name: str(x.na), notionCompanyId: cid, opportunityId: oppId,
      kind: 'NEXT_ACTION', title: str(x.na),
      dueDate: str(x.naDate) || null, status: 'OPEN', source: 'ui', owner,
    }, who);
    changes.action = (changes.action ?? 0) + 1;
  } else {
    const old = await listByExternalPrefix(ACT.plural, ACT.singular, naExt);
    for (const a of old) { await deleteRecord(ACT.plural, str(a.id)); changes.action = (changes.action ?? 0) + 1; }
  }
}

/**
 * 商談の経過ログ（フェーズが進んだ・障壁を更新・ネクストアクション完了）。
 * **追記のみ**。既にあるぶんは作り直さない。
 *
 * ⚠ 2026-10-07 まで `sf:` の商談ではここを通っておらず、ネクストアクションを
 *   完了にしても**行動履歴にも道のりにも残らなかった**（画面を開き直すと消えた）。
 *   いまの商談はすべて Salesforce 由来なので、実質どこにも記録されていなかった。
 */
async function writeLogs(
  ext: string, cid: string, oppId: string, x: Record<string, unknown>,
  who: ActorStamp, changes: Record<string, number>,
): Promise<void> {
  const logs = arr(x.log);
  if (!logs.length) return;
  const existing = await listByExternalPrefix(ACTV.plural, ACTV.singular, `${ext}:log:`);
  const have = new Set(existing.map(a => str(a.externalId)));
  for (const [i, l] of logs.entries()) {
    const lext = `${ext}:log:${i}`;
    if (have.has(lext)) continue;
    const t = str(l.t);
    await upsertByExternalId(ACTV.plural, ACTV.singular, lext, {
      name: str(l.text) || t, notionCompanyId: cid, opportunityId: oppId,
      type: t === 'ph' ? 'STAGE_CHANGE' : t === 'br' ? 'BARRIER_UPDATE' : 'ACTION_DONE',
      occurredAt: str(l.at) || new Date().toISOString(),
      // ネクストアクション完了は「どのフェーズのときの一手だったか」を fromStage に入れる。
      // 道のりがフェーズごとに束ねるのに使う
      fromStage: normalizeStage(t === 'na' ? l.ph : l.from),
      toStage:   normalizeStage(l.to),
      dueDate:   t === 'na' ? (str(l.due) || null) : null,
      text: str(l.text) || null, note: str(l.note) || null,
      actor: str(l.by) || who.name2,
    }, who);
    changes.activity = (changes.activity ?? 0) + 1;
  }
}

async function writeEdits(
  cid: string, body: Record<string, unknown>, me: PtaiIdentity, who: ActorStamp,
): Promise<WriteResult> {
  const changes: Record<string, number> = {
    opportunity: 0, opportunityDeleted: 0, action: 0, activity: 0, notion: 0,
  };

  // 担当（§A）は Notion（アカウント情報の正本）から取る。**操作者とは別物。**
  // ここで 1 回だけ読み、下の会社項目の更新でも使い回す（Notion は約 3 req/s）。
  const customer = await getCustomer(cid).catch(() => null);
  const owner = ownerOf(customer?.owners3);

  // 送られてきた商談を一覧に揃える
  const incoming: Array<{ key: string; x: Record<string, unknown>; isMain: boolean }> = [];
  const main = rec(body.opp);
  if (Object.keys(main).length) incoming.push({ key: 'main', x: main, isMain: true });
  for (const [i, x] of arr(body.deals).entries()) {
    incoming.push({ key: str(x.key) || `d${i}`, x, isMain: false });
  }

  // 商談ごとに作成 or 更新
  const seen = new Set<string>();
  for (const { key, x, isMain } of incoming) {
    // ── Salesforce 由来の商談 ───────────────────────────────────────────
    //   金額・フェーズ・申込完了日・課金開始日・契約期間の**正本は Salesforce**。
    //   ここで `edits:<cid>:sf:...` を作ると複製になるので、新しくは作らない。
    //
    //   ただし **障壁・ニーズ・ネクストアクション・到達予定は画面のもの**
    //   （2026-10-01 の決定「ネクストアクション・障壁は Web で操作し Twenty に連携」）。
    //   2026-10-02 まではここで丸ごと捨てていたため、入力しても
    //   「Twenty 未反映」のまま永久に保存されなかった。その分だけ書く。
    if (key.startsWith('sf:')) {
      const hit = await listRecords(OPP.plural, OPP.singular,
        { filter: `externalId[eq]:${key}`, pageSize: 2, maxRecords: 2 });
      if (!hit.length) continue;            // Salesforce 側から消えた商談。作り直さない
      const oppId = str(hit[0].id);
      const v = {
        barrier:    str(x.barrier) || null,
        need:       str(x.need) || null,
        nextAction: str(x.na) || null,
      };
      // 保存と同時に Salesforce へ送る（2026-10-02 の決定「送信（編集時）」）。
      // 送れたら sfPending は空、送れなかったらその項目名を残して
      // **毎時の取り込みで上書きされないようにする**。
      const push = await pushOpportunityFields(key.slice(3), v);
      await updateRecord(OPP.plural, OPP.singular, oppId, {
        barrier:  v.barrier,
        need:     v.need,
        msBase:   str(x.msBase) === 'bill' ? 'bill' : 'apply',
        msTrial:  str(rec(x.ms).TRIAL) || null,
        msQuote:  str(rec(x.ms).QUOTE) || null,
        msVerbal: str(rec(x.ms).VERBAL_COMMIT) || null,
        sfPending: push.ok ? null : SF_EDITABLE_KEYS.join(','),
        updatedByName2: who.name2,
      });
      changes.opportunity++;
      if (!push.ok) changes.sfFailed = (changes.sfFailed ?? 0) + 1;
      if (push.truncated.length) changes.sfTruncated = (changes.sfTruncated ?? 0) + push.truncated.length;
      await writeNextAction(key, cid, oppId, x, owner, who, changes);
      await writeLogs(key, cid, oppId, x, who, changes);
      continue;
    }
    // ── 画面で入力した商談（Salesforce に無いもの）─────────────────────
    //   **新しくは作らない**（2026-10-02 Kubotie 決定「商談は Salesforce で作る」）。
    //   すでに Twenty にある分だけ直す。無いものは捨てる（＝画面にも戻らない）。
    //   作っていた頃、SF に無い商談が立って消せなくなった（フィードバック 119b8b3a）。
    const ext = `edits:${cid}:${key}`;
    const hit = await listRecords(OPP.plural, OPP.singular,
      { filter: `externalId[eq]:${ext}`, pageSize: 2, maxRecords: 2 });
    if (!hit.length) { changes.skippedNew = (changes.skippedNew ?? 0) + 1; continue; }
    seen.add(ext);
    const oppId = str(hit[0].id);
    await updateRecord(OPP.plural, OPP.singular, oppId,
      { ...dealFields(x, cid, isMain, owner), updatedByName2: who.name2 });
    changes.opportunity++;

    await writeNextAction(ext, cid, oppId, x, owner, who, changes);

    await writeLogs(ext, cid, oppId, x, who, changes);
  }

  // 送られてこなかった商談は消えたということ（全置換の意味）。
  // **ぶら下がるネクストアクションと経過ログも一緒に消す。**
  // 消し忘れると、商談が無いのにアクションだけ残る（2026-10-01 の検証で踏んだ）。
  const all = await listByExternalPrefix(OPP.plural, OPP.singular, `edits:${cid}:`);
  for (const o of all) {
    const ext = str(o.externalId);
    // `:na` や `:log:` を拾わないよう、商談そのものだけに絞る
    if (!ext || seen.has(ext) || ext.includes(':log:') || ext.endsWith(':na')) continue;
    await deleteRecord(OPP.plural, str(o.id));
    changes.opportunityDeleted++;
    for (const a of await listByExternalPrefix(ACT.plural, ACT.singular, `${ext}:na`)) {
      await deleteRecord(ACT.plural, str(a.id));
      changes.action++;
    }
    for (const l of await listByExternalPrefix(ACTV.plural, ACTV.singular, `${ext}:log:`)) {
      await deleteRecord(ACTV.plural, str(l.id));
      changes.activity++;
    }
  }

  // 会社側の項目は Notion（アカウント情報の正本）へ
  const company = rec(body.company);
  if (Object.keys(company).length) {
    const kd = rec(company.keyDates);
    const monthOf = (v: unknown): number | 'none' | null => {
      const o = rec(v);
      if (o.none === true) return 'none';
      const m = numOr(o.month) ?? numOr(o.m);
      return m && m >= 1 && m <= 12 ? m : null;
    };
    const rangeOf = (v: unknown): [number, number] | 'none' | null => {
      const o = rec(v);
      if (o.none === true) return 'none';
      const f = numOr(o.fm), t = numOr(o.tm);
      return f ? [f, t ?? f] : null;
    };
    const patch: Record<string, unknown> = {};
    if ('aim' in company) patch.aimMrr = numOr(company.aim);
    if (kd.fiscal)  patch.fiscalMonth  = monthOf(kd.fiscal);
    if (kd.budget)  patch.budgetMonths = rangeOf(kd.budget);
    if (kd.renewal) patch.renewalMonth = monthOf(kd.renewal);

    if (Object.keys(patch).length) {
      if (!customer) {
        return { ok: false, status: 502, error: 'notion_unavailable',
                 message: 'Notion に書けませんでした。もう一度試してください' };
      }
      try {
        const r = await updateCustomerWithExtras(cid, patch, {}, customer.lastEditedTime);
        if (r.ok) changes.notion += r.changed.length;
      } catch {
        return { ok: false, status: 502, error: 'notion_unavailable',
                 message: 'Notion に書けませんでした。もう一度試してください' };
      }
    }
  }

  await writeLog(who, 'update', 'testOpportunity', null,
    `商談を保存（${changes.opportunity} 件）`);
  return { ok: true, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// aplans / orgs / recent
// ═══════════════════════════════════════════════════════════════════════════

async function writePlans(cid: string, body: Record<string, unknown>, me: PtaiIdentity, who: ActorStamp): Promise<WriteResult> {
  const changes: Record<string, number> = { plan: 0, planDeleted: 0, action: 0, actionDeleted: 0, fromAi: 0 };

  const seenPlan = new Set<string>();
  for (const [q, v] of Object.entries(rec(body.quarters))) {
    const o = rec(v);
    const ext = `aplans:${cid}:${q}`;
    seenPlan.add(ext);
    await upsertByExternalId(PLAN.plural, PLAN.singular, ext, {
      name: `${q} サクセス計画`, notionCompanyId: cid, quarter: q,
      goal: str(o.goal) || null, aimMrr: numOr(o.aim),
      source: str(o.src).startsWith('ai') ? 'ai' : 'ui',
    }, who);
    changes.plan++;
  }
  for (const p of await listByExternalPrefix(PLAN.plural, PLAN.singular, `aplans:${cid}:`)) {
    if (seenPlan.has(str(p.externalId))) continue;
    await deleteRecord(PLAN.plural, str(p.id));
    changes.planDeleted++;
  }

  const seenItem = new Set<string>();
  for (const it of arr(body.items)) {
    const ext = `aplans:${cid}:${str(it.id)}`;
    seenItem.add(ext);
    await upsertByExternalId(ACT.plural, ACT.singular, ext, {
      name: str(it.text), notionCompanyId: cid, kind: 'SUCCESS',
      title: str(it.text), lane: str(it.t) === 'exp' ? 'exp' : 'use',
      month: str(it.m) || null, week: it.w != null ? String(it.w) : null,
      status: it.done === true ? 'DONE' : 'OPEN',
      doneAt: str(it.doneAt) || null,
      source: str(it.src).startsWith('ai') ? 'ai' : 'ui',
    }, who);
    changes.action++;
    if (str(it.src).startsWith('ai')) changes.fromAi++;
  }
  // サクセスの Todo だけを対象にする（ネクストアクションは別の鍵）
  for (const a of await listByExternalPrefix(ACT.plural, ACT.singular, `aplans:${cid}:`)) {
    if (seenItem.has(str(a.externalId))) continue;
    await deleteRecord(ACT.plural, str(a.id));
    changes.actionDeleted++;
  }

  await writeLog(who, 'update', 'testAccountPlan', null,
    `サクセス計画を保存（${changes.plan} 四半期・${changes.action} 項目。うち AI 生成 ${changes.fromAi}）`,
    { source: changes.fromAi > 0 ? 'ai' : 'ui' });
  return { ok: true, changes };
}

const ATT_CODE: Record<string, string> = {
  '推進': 'PROMOTE', '好意的': 'FAVORABLE', '中立': 'NEUTRAL',
  '慎重': 'CAUTIOUS', '反対': 'OPPOSED', '不明': 'UNKNOWN',
};
const CONF_CODE: Record<string, string> = {
  '公開': 'PUBLIC', '社内': 'INTERNAL', '推定': 'ESTIMATED',
};
const ROLE_CODE: Record<string, string> = {
  '最終決裁者': 'FINAL_APPROVER', '決裁者': 'APPROVER', '影響者': 'INFLUENCER',
  '推進者': 'PROMOTER', '技術評価者': 'EVALUATOR', '利用者': 'USER',
};

/**
 * 組織図ノードの入力元。原本は `src` に由来を文字で入れてくる。
 *   '手入力'        … 画面で足した（newNode）
 *   '名刺（…）'     … 名刺画像から読み取った（CARD_INSTR がそう書かせる）
 *   それ以外・空    … AI が資料から組み立てた（orgGenerate）
 * 2026-10-01 まで全部 'ui' で入れていたので、AI 生成が画面入力に見えていた。
 */
export function nodeSource(src: string): 'ui' | 'ai' | 'card' {
  if (src.startsWith('名刺')) return 'card';
  if (src === '手入力') return 'ui';
  return 'ai';
}

/**
 * 組織図の付帯情報（出典・確認事項・生成元）を testComment に置く。
 * db-view は orgs:<cid>:source:N / :question:N / :meta を読むが、2026-10-06 まで
 * 書いていなかったので、保存すると出典と確認事項が消えて見えた。
 * 原本が送ってこなかった項目は触らない（手入力の保存で AI の出典を消さない）。
 */
async function writeOrgMeta(cid: string, body: Record<string, unknown>, who: ActorStamp): Promise<void> {
  const CMT = TEST_OBJECTS.comment;
  const author = str(body.genBy) || 'AI';
  const at = str(body.genAt) ? new Date(str(body.genAt)).toISOString() : new Date().toISOString();
  const put = (ext: string, text: string) => upsertByExternalId(CMT.plural, CMT.singular, ext, {
    name: text.slice(0, 60), notionCompanyId: cid, targetType: 'COMPANY', targetId: cid,
    body: text, author, at, source: 'ai',
  }, who);
  const lists: Array<['source' | 'question', unknown]> = [['source', body.sources], ['question', body.questions]];
  const sent = lists.filter(([, v]) => Array.isArray(v));
  if (!sent.length && !str(body.genAt)) return;
  const keep = new Set<string>();
  for (const [kind, v] of sent) {
    for (const [i, t] of (v as unknown[]).map(x => String(x ?? '')).filter(Boolean).entries()) {
      const ext = `orgs:${cid}:${kind}:${i}`;
      keep.add(ext);
      await put(ext, t);
    }
  }
  if (str(body.genAt)) await put(`orgs:${cid}:meta`, '組織図の生成元');
  // 送ってきた種類のうち、件数が減ったぶんを消す
  const kinds = new Set(sent.map(([k]) => k));
  for (const c of await listByExternalPrefix(CMT.plural, CMT.singular, `orgs:${cid}:`)) {
    const m = str(c.externalId).match(/^orgs:[^:]+:(source|question):\d+$/);
    if (m && kinds.has(m[1] as 'source' | 'question') && !keep.has(str(c.externalId))) {
      await deleteRecord(CMT.plural, str(c.id));
    }
  }
}

/**
 * 同じ externalId の行が複数あるとき、どれを残すか。**全保存で同じ答え**になるよう、
 * いちばん古い行（createdAt、同時刻なら id）を採る。今回更新した行を残す方式だと、
 * 2 人が同時に保存したときに互いの行を消し合い、その人が 1 行も残らない。
 */
export function orgKeepers(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const keep = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const ext = str(r.externalId), cur = keep.get(ext);
    const older = !cur || str(r.createdAt) < str(cur.createdAt)
      || (str(r.createdAt) === str(cur.createdAt) && str(r.id) < str(cur.id));
    if (older) keep.set(ext, r);
  }
  return keep;
}

async function writeOrgs(cid: string, body: Record<string, unknown>, me: PtaiIdentity, who: ActorStamp): Promise<WriteResult> {
  const changes: Record<string, number> = { person: 0, personDeleted: 0, fromAi: 0, fromCard: 0 };
  const nodes = arr(body.nodes);
  const prefix = `orgs:${cid}:`;
  const before = orgKeepers(await listByExternalPrefix(PERS.plural, PERS.singular, prefix));

  // 1 パス目: 親を付けずに作る／直す
  const seen = new Set<string>();
  const done = new Set<string>();
  for (const [i, n] of nodes.entries()) {
    const nid = str(n.id);
    if (!nid || done.has(nid)) continue;   // 同じ id が 2 回来たら 1 人として扱う
    done.add(nid);
    const ext = `${prefix}${nid}`;
    seen.add(ext);
    const src = nodeSource(str(n.src));
    const data = {
      name: str(n.name), notionCompanyId: cid,
      nodeType: str(n.kind) || 'person', order: i,
      title: str(n.title) || null,
      attitude: ATT_CODE[str(n.stance)] ?? null,
      contact: str(n.contact) === '接点あり' ? 'CONTACTED'
             : str(n.contact) === '未接触' ? 'NOT_CONTACTED' : null,
      // st（確定済みか）と conf（情報源）は別の列に分けて持つ。
      // 畳むと、未確定のノードが「公開/社内」をなくしてしまう。
      confirmed:  str(n.st) === 'ok',
      infoSource: CONF_CODE[str(n.conf)] ?? null,
      dealRole: ROLE_CODE[str(n.role)] ?? null,
      isDecisionMaker: str(n.role) === '決裁者' || str(n.role) === '最終決裁者',
      influential: n.inf === true,
      memo: str(n.note) || null, sourceNote: str(n.src) || null, source: src,
    };
    const hit = before.get(ext);
    if (hit) await updateRecord(PERS.plural, PERS.singular, str(hit.id), { ...data, updatedByName2: who.name2 });
    else await upsertByExternalId(PERS.plural, PERS.singular, ext, data, who);
    changes.person++;
    if (src === 'ai') changes.fromAi++;
    if (src === 'card') changes.fromCard++;
  }

  // 図から外れた人と、同じ externalId の重複行を消す（引き直してから決める）。
  // Twenty に一意制約は無いので、保存が 2 本重なると同じ鍵の行が 2 件できる
  // （2026-10-06 Utty 指摘「人物が二重に作成される」）。
  const after = await listByExternalPrefix(PERS.plural, PERS.singular, prefix);
  const keep = orgKeepers(after);
  for (const p of after) {
    const ext = str(p.externalId);
    if (ext.includes(':memo:')) continue;
    if (seen.has(ext) && str(keep.get(ext)?.id) === str(p.id)) continue;
    await deleteRecord(PERS.plural, str(p.id));
    changes.personDeleted++;
  }

  // 2 パス目: 親子関係（残す行が決まってから。消した行を親にしないため）
  for (const n of nodes) {
    const nid = str(n.id), pid = str(n.parent);
    const child = keep.get(`${prefix}${nid}`);
    if (!nid || !child) continue;
    const parentId = pid ? str(keep.get(`${prefix}${pid}`)?.id) || null : null;
    if ((str(child.parentId) || null) === parentId) continue;
    await updateRecord(PERS.plural, PERS.singular, str(child.id), { parentId });
  }

  await writeOrgMeta(cid, body, who);

  await writeLog(who, 'update', 'testPerson', null,
    `組織図を保存（${changes.person} 行。AI 生成 ${changes.fromAi} / 名刺 ${changes.fromCard}）`,
    { source: changes.fromAi + changes.fromCard > 0 ? 'ai' : 'ui' });
  return { ok: true, changes };
}

/** recent ドキュメントのうち text 列に入らない部分（overview・events ほか）を JSON にする */
export function recentNote(body: Record<string, unknown>): string | null {
  const { summary, genAt, companyId, companyName, ...rest } = body;
  void summary; void genAt; void companyId; void companyName;
  return Object.keys(rest).length ? JSON.stringify(rest) : null;
}

async function writeRecent(cid: string, body: Record<string, unknown>, me: PtaiIdentity, who: ActorStamp): Promise<WriteResult> {
  await upsertByExternalId(ACTV.plural, ACTV.singular, `recent:${cid}`, {
    name: '直近の動き（AI 推計）', notionCompanyId: cid, type: 'AI_RECENT',
    occurredAt: str(body.genAt) || new Date().toISOString(),
    // ⚠ overview はオブジェクト。2026-10-06 まで str() に通して捨てていたので、
    //   次のポーリングで要約が空に戻っていた（Utty 指摘）。summary 以外は note に
    //   JSON でまるごと持ち、db-view で戻す。
    text: str(body.summary) || null, note: recentNote(body), actor: 'ai',
  }, who);
  // testActivity に source 列は無いので actor:'ai' が印。操作ログ側に残しておく
  await writeLog(who, 'update', 'testActivity', null, '直近の動きを AI で生成', { source: 'ai' });
  void me;
  return { ok: true, changes: { activity: 1 } };
}

async function writeTargets(body: Record<string, unknown>, me: PtaiIdentity, who: ActorStamp): Promise<WriteResult> {
  if (!me.isApprover) {
    return { ok: false, status: 403, error: 'approver_required',
             message: '目標の編集は承認者のみです' };
  }
  const rows = await listTargetRows();
  const targets = rec(body.targets);
  let updated = 0;

  for (const row of rows) {
    if (row.kind === 'チーム') {
      const mrr = numOr(body.targetMrr), due = str(body.targetDue) || null;
      await updateTargetRow(row.pageId, { mrr, due });
      updated++;
    } else if (row.name2 && row.name2 in targets) {
      await updateTargetRow(row.pageId, { mrr: numOr(targets[row.name2]) });
      updated++;
    }
  }
  await writeLog(who, 'update', 'notionTargets', null, `目標を保存（${updated} 行）`);
  return { ok: true, changes: { targets: updated } };
}

/**
 * 議事録の取り込み結果を `testActivity(type=MEETING)` へ。
 *
 * 原本が送ってくる形:
 *   { companyId, companyName, notion:{fetchedAt, items:[{title,date,url,text}]},
 *                             mii:{syncedAt,   items:[...]} }
 *
 * ⚠ **Notion の本文の控えを Twenty に置くことになる。**
 *   正本は Notion のままで、ここに入るのは取り込み時点の写し。
 *   古くなったら「最新に更新」で上書きされる。
 */
const MINUTE_BODY_MAX = 6000;

async function writeMinutes(
  cid: string, body: Record<string, unknown>, who: ActorStamp,
): Promise<WriteResult> {
  const changes: Record<string, number> = { meeting: 0, meetingDeleted: 0 };
  const seen = new Set<string>();

  for (const src of ['notion', 'mii'] as const) {
    const group = rec(body[src]);
    for (const [i, it] of arr(group.items).entries()) {
      const ext = `minutes:${cid}:${src}:${i}`;
      seen.add(ext);
      await upsertByExternalId(ACTV.plural, ACTV.singular, ext, {
        name:          str(it.title) || '議事録',
        notionCompanyId: cid,
        type:          'MEETING',
        meetingSource: src === 'notion' ? 'NOTION' : 'MII',
        occurredAt:    str(it.date) ? `${str(it.date)}T00:00:00.000Z` : null,
        text:          (str(it.summary) || str(it.text)).slice(0, MINUTE_BODY_MAX) || null,
        // LINKS 型なので文字列では 400 になる（2026-10-01 に踏んだ）
        sourceUrl:     str(it.url) ? { primaryLinkUrl: str(it.url) } : null,
        actor:         'sync',
      }, who);
      changes.meeting++;
    }
  }

  // 全置換。取り込み直して減ったぶんは消す
  for (const a of await listByExternalPrefix(ACTV.plural, ACTV.singular, `minutes:${cid}:`)) {
    if (seen.has(str(a.externalId))) continue;
    await deleteRecord(ACTV.plural, str(a.id));
    changes.meetingDeleted++;
  }

  await writeLog(who, 'sync', 'testActivity', null,
    `議事録を取り込み（${changes.meeting} 件）`, { source: 'ui' });
  return { ok: true, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// 入口
// ═══════════════════════════════════════════════════════════════════════════

/** 現在の状態を edits の形で取り出す。承認ガードの突き合わせに使う */
async function currentEditsDoc(cid: string): Promise<unknown> {
  const rows = await listByExternalPrefix(OPP.plural, OPP.singular, `edits:${cid}:`);
  const deals = rows
    .filter(r => !str(r.externalId).includes(':log:') && !str(r.externalId).endsWith(':na'));
  const main = deals.find(r => r.isMain === true);
  return {
    opp: main ? { phase: normalizeStage(main.stage) as Stage | null } : {},
    deals: deals.filter(r => r !== main).map(r => ({
      key: str(r.externalId).split(':').slice(2).join(':'),
      phase: normalizeStage(r.stage),
    })),
  };
}

/**
 * `doc.set(collection/docId, body)` を Twenty / Notion へ振り分ける。
 * **pga_docs には書かない。**
 */
export async function writeDoc(
  collection: string, docId: string, body: unknown, me: PtaiIdentity,
): Promise<WriteResult> {
  const data = rec(body);
  // 操作者は CXM のログインから。Twenty の API キーには依存しない
  const who = await actorStampFor(me.id, me.name);

  try {
    switch (collection) {
      case 'edits': {
        // 承認が要る変更はここで止める（§4-2）。画面側のチェックだけに頼らない
        const before = await currentEditsDoc(docId);
        const verdict = assertStageChangeAllowed(before, data, me.isApprover);
        if (!verdict.ok) {
          return { ok: false, status: 403, error: 'approver_required',
                   message: APPROVER_REQUIRED_MESSAGE[verdict.reason!] };
        }
        return await writeEdits(docId, data, me, who);
      }
      case 'aplans':  return await writePlans(docId, data, me, who);
      case 'orgs':    return await writeOrgs(docId, data, me, who);
      case 'recent':  return await writeRecent(docId, data, me, who);
      case 'settings':
        if (docId !== 'targets') {
          return { ok: false, status: 501, error: 'not_supported',
                   message: `settings/${docId} の保存先は決まっていません` };
        }
        return await writeTargets(data, me, who);
      // ── 議事録の取り込み結果 ──────────────────────────────────────────
      //   原本は MCP で引いた議事録を `minutes/<cid>` に貯める。
      //   `testActivity(type=MEETING)` に入れる。**スキーマの meetingSource
      //   （NOTION / MII / MANUAL）はこのために用意してある。**
      //   保存しないと、画面を開き直すたびに「最新に更新」が要る。
      case 'minutes':  return await writeMinutes(docId, data, who);

      // ── 引き継がないもの（2026-10-01 の決定）─────────────────────────
      //   旧プランニング（plans／GATES／ピン）は **Twenty へ移さない。**
      //   いまの画面はサクセス管理（aplans）が主体で、plans は原本に残った
      //   旧構造（Utty 仕様 §3-4 の指摘どおり）。二重の計画は持たない。
      //   計画相談（aiAsk）の助言そのものは使えるが、**保存先は aplans**。
      case 'plans':
        return { ok: false, status: 501, error: 'retired',
                 message: 'プランニング（旧構造）は引き継ぎません。サクセス管理に入力してください' };
      //   Chatwork の取り込みも旧経路。材料は議事録（Notion／Mii）に寄せる
      case 'chatwork':
        return { ok: false, status: 501, error: 'retired',
                 message: 'Chatwork の取り込みは引き継ぎません' };
      default:
        return { ok: false, status: 501, error: 'not_supported',
                 message: `${collection} の保存先は決まっていません` };
    }
  } catch (e) {
    const err = e as TestWriteError;
    console.error('[ptai/db-write] 保存に失敗', err.toSafeString?.() ?? String(err));
    return { ok: false, status: 502, error: 'upstream_unavailable',
             message: '保存できませんでした。もう一度試してください' };
  }
}

/** `collection.add(body)` 相当。原本が使うのは feed だけ */
export async function addDocNew(
  collection: string, body: unknown, me: PtaiIdentity,
): Promise<AddResult> {
  if (collection !== 'feed') return { ok: false, status: 501, error: 'not_supported' };
  const f = rec(body);
  const who = await actorStampFor(me.id, me.name);
  // 会社 id を鍵に入れておく。testOperationLog に会社の列は無く、recordId には
  // 商談キーが入るので、2026-10-06 まで新着欄で会社名が出ず、押しても飛べなかった
  const cid = str(f.cid).replace(/:/g, '');
  const ext = `ui:feed:${cid ? cid + ':' : ''}${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  try {
    const r = await upsertByExternalId(LOG.plural, LOG.singular, ext, {
      name: (str(f.label) || str(f.kind) || '変更') + (str(f.deal) ? `（${str(f.deal)}）` : ''),
      at: str(f.at) || new Date().toISOString(), actor: str(f.by) || who.name2,
      action: 'update', object: 'testOpportunity', recordId: str(f.key) || null,
      field: str(f.kind) || null,
      from: f.from == null ? null : String(f.from),
      to: f.to == null ? null : String(f.to),
      message: str(f.label) || null, source: 'ui',
    }, who);
    return { ok: true, id: str(r.record.id) };
  } catch {
    return { ok: false, status: 502, error: 'upstream_unavailable' };
  }
}
