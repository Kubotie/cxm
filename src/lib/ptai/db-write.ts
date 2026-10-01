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
  upsertByExternalId, listByExternalPrefix, deleteRecord, TestWriteError,
} from './twenty-test/client';
import { TEST_OBJECTS, normalizeStage, type Stage } from './twenty-test/schema';
import { getCustomer, updateCustomerWithExtras, listTargetRows, updateTargetRow } from './notion/client';
import { OWNER_FROM_NOTION } from './notion/schema';
import { assertStageChangeAllowed, APPROVER_REQUIRED_MESSAGE } from './edit-guard';
import { actorStampFor, type ActorStamp } from './staff';
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
    const ext = `edits:${cid}:${key}`;
    seen.add(ext);
    const r = await upsertByExternalId(OPP.plural, OPP.singular, ext, dealFields(x, cid, isMain, owner), who);
    changes.opportunity++;
    const oppId = str(r.record.id);

    // ネクストアクション（1 商談に 1 つ）
    const naExt = `${ext}:na`;
    if (str(x.na)) {
      await upsertByExternalId(ACT.plural, ACT.singular, naExt, {
        name: str(x.na), notionCompanyId: cid, opportunityId: oppId,
        kind: 'NEXT_ACTION', title: str(x.na),
        dueDate: str(x.naDate) || null, status: 'OPEN', source: 'ui', owner,
      }, who);
      changes.action++;
    } else {
      // 空になったら消す（原本は完了時に na を空にする）
      const old = await listByExternalPrefix(ACT.plural, ACT.singular, naExt);
      for (const a of old) { await deleteRecord(ACT.plural, str(a.id)); changes.action++; }
    }

    // 経過ログは追記のみ。既にあるぶんは作り直さない
    const logs = arr(x.log);
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
        fromStage: normalizeStage(l.from), toStage: normalizeStage(l.to),
        text: str(l.text) || null, note: str(l.note) || null,
        actor: str(l.by) || who.name2,
      }, who);
      changes.activity++;
    }
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

async function writeOrgs(cid: string, body: Record<string, unknown>, me: PtaiIdentity, who: ActorStamp): Promise<WriteResult> {
  const changes: Record<string, number> = { person: 0, personDeleted: 0, fromAi: 0, fromCard: 0 };
  const nodes = arr(body.nodes);

  // 1 パス目: 親を付けずに作る／直す
  const idMap = new Map<string, string>();
  const seen = new Set<string>();
  for (const [i, n] of nodes.entries()) {
    const nid = str(n.id);
    if (!nid) continue;
    const ext = `orgs:${cid}:${nid}`;
    seen.add(ext);
    const src = nodeSource(str(n.src));
    const r = await upsertByExternalId(PERS.plural, PERS.singular, ext, {
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
    }, who);
    idMap.set(nid, str(r.record.id));
    changes.person++;
    if (src === 'ai') changes.fromAi++;
    if (src === 'card') changes.fromCard++;
  }

  // 2 パス目: 親子関係（全員の id が決まってから）
  for (const n of nodes) {
    const nid = str(n.id), pid = str(n.parent);
    const childId = idMap.get(nid);
    if (!childId) continue;
    const parentId = pid ? idMap.get(pid) ?? null : null;
    await upsertByExternalId(PERS.plural, PERS.singular, `orgs:${cid}:${nid}`, { parentId }, who);
  }

  for (const p of await listByExternalPrefix(PERS.plural, PERS.singular, `orgs:${cid}:`)) {
    const ext = str(p.externalId);
    if (seen.has(ext) || ext.includes(':memo:')) continue;
    await deleteRecord(PERS.plural, str(p.id));
    changes.personDeleted++;
  }

  await writeLog(who, 'update', 'testPerson', null,
    `組織図を保存（${changes.person} 行。AI 生成 ${changes.fromAi} / 名刺 ${changes.fromCard}）`,
    { source: changes.fromAi + changes.fromCard > 0 ? 'ai' : 'ui' });
  return { ok: true, changes };
}

async function writeRecent(cid: string, body: Record<string, unknown>, me: PtaiIdentity, who: ActorStamp): Promise<WriteResult> {
  await upsertByExternalId(ACTV.plural, ACTV.singular, `recent:${cid}`, {
    name: '直近の動き（AI 推計）', notionCompanyId: cid, type: 'AI_RECENT',
    occurredAt: str(body.genAt) || new Date().toISOString(),
    text: str(body.summary) || null, note: str(body.overview) || null, actor: 'ai',
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
      // ── 議事録の取り込み結果（読み取り専用の控え）────────────────────
      //   原本は MCP で引いた議事録を `minutes/<cid>` に貯める。これは
      //   **Notion と Twenty から何度でも引き直せる控え**で、正本ではない。
      //   Twenty に二重に持つ意味がないので保存しないが、画面にエラーを出す
      //   必要もないので「受け取った」として返す（原本の保存成功と同じ扱い）。
      //   ⚠ 501 を返していた頃は、議事録タブが毎回「保存できませんでした」と
      //      出していた（2026-10-01 修正）。
      case 'minutes':
        return { ok: true, changes: { minutes: 0 } };

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
  const ext = `ui:feed:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  try {
    const r = await upsertByExternalId(LOG.plural, LOG.singular, ext, {
      name: str(f.label) || str(f.kind) || '変更',
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
