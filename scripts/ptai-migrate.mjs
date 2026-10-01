#!/usr/bin/env node
// ─── 旧データの移行（§9-8）───────────────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//        scripts/ptai-migrate.mjs --only=keydates [--apply] [--limit=N]
//
//   --only=keydates   ① キー日程 → Notion 顧客管理DB
//   --only=orgs       ② 組織図 → testPerson ＋ testComment ＋ testOperationLog
//   --only=plans      ③ サクセス計画 → testAccountPlan ＋ testAction
//   --only=deals      ④ 商談 → testOpportunity ＋ testAction ＋ testActivity
//   --only=logs       ⑤ 変更ログ・AI サマリー → testOperationLog ＋ testActivity
//   --only=all        ①〜⑤ を順に
//
//   既定は **dry-run**。`--apply` を付けたときだけ書き込む。
//
// ═══════════════════════════════════════════════════════════════════════════
//  作りの約束
//    - **冪等**：すでに同じ値なら何もしない。何度流しても増えない
//    - **再実行可能**：途中で落ちても、もう一度流せば続きから
//    - **楽観ロック**：人が Notion を触っていたら上書きせず conflict として飛ばす
//    - **顧客名・本文をログに出さない。** 出すのは件数と種別だけ
// ═══════════════════════════════════════════════════════════════════════════

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const ROOT = process.cwd();
const store  = await import(`file://${ROOT}/src/lib/ptai/store.ts`);
const notion = await import(`file://${ROOT}/src/lib/ptai/notion/client.ts`);
const mm     = await import(`file://${ROOT}/src/lib/ptai/minutes.ts`);
const tw     = await import(`file://${ROOT}/src/lib/ptai/twenty-test/client.ts`);
const T      = await import(`file://${ROOT}/src/lib/ptai/twenty-test/schema.ts`);

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ONLY  = (argv.find(a => a.startsWith('--only=')) ?? '--only=keydates').split('=')[1];
const LIMIT = Number((argv.find(a => a.startsWith('--limit=')) ?? '--limit=0').split('=')[1]) || 0;

const log = (s = '') => console.log(s);
log(`PtAI Pipeline 移行 — ${ONLY} / ${APPLY ? '**本番実行（--apply）**' : 'dry-run'}${LIMIT ? ` / 先頭 ${LIMIT} 社` : ''}`);
log(`実行 ${new Date().toISOString()}`);

// ═══════════════════════════════════════════════════════════════════════════
// 会社の鍵の付け替え（cid → Notion ページ ID）
// ═══════════════════════════════════════════════════════════════════════════

const normId = (v) => String(v ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');
const idFromUrl = (u) => {
  const m = /([0-9a-f]{32})(?:\?|$|#)/i.exec(String(u ?? '').replace(/-/g, ''));
  return m ? m[1].toLowerCase() : null;
};

const rawText = await store.getRawSnapshot();
const raw = rawText ? JSON.parse(rawText) : { companies: [] };
const rawByCid = new Map((raw.companies ?? []).map(c => [c.cid, c]));

const customers = await notion.listCustomers({ maxPages: 20 });
const byId = new Map(customers.map(c => [normId(c.pageId), c]));
const byName = new Map();
for (const c of customers) {
  const k = mm.normalizeCompanyName(c.name);
  if (!k) continue;
  byName.set(k, byName.has(k) ? null : c);   // 同名が複数あるものは使わない
}

/** cid → { customer, how } */
function resolveCompany(cid) {
  const co = rawByCid.get(cid);
  if (!co) return { customer: null, how: 'raw_missing' };
  const u = idFromUrl(co.url);
  if (u && byId.has(u)) return { customer: byId.get(u), how: 'notion_url' };
  const n = byName.get(mm.normalizeCompanyName(co.n ?? ''));
  // 社名一致は、MRR も一致するときだけ採る（2026-10-01 に 21/21 で一致を確認済み）
  if (n && co.m != null && n.mrr != null && Number(co.m) === Number(n.mrr)) {
    return { customer: n, how: 'name_and_mrr' };
  }
  if (n) return { customer: n, how: 'name_only' };
  return { customer: null, how: 'unresolved' };
}

const docs = await store.listAllDocs();

// ═══════════════════════════════════════════════════════════════════════════
// ① キー日程 → Notion
// ═══════════════════════════════════════════════════════════════════════════

/** 旧形式（fiscal:{month}/budget:{from,to}/renewal:{month}）を月に直す */
function monthOf(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v >= 1 && v <= 12 ? v : null;
  const s = String(v);
  const ym = /^(\d{4})-(\d{2})/.exec(s);          // "2026-09" → 9
  if (ym) return Number(ym[2]);
  const n = /^(\d{1,2})月?$/.exec(s);
  return n && Number(n[1]) >= 1 && Number(n[1]) <= 12 ? Number(n[1]) : null;
}

/** keyDates → Notion に書く形。`null` は「触らない」 */
function toPatch(kd) {
  const patch = {};
  const srcLines = [];
  let est = 0, total = 0;

  const one = (key, field) => {
    const v = kd?.[key];
    if (!v) return;
    total++;
    if (v.st === 'est') est++;
    if (v.src) srcLines.push(`${field}: ${v.src}`);
    if (v.none) return 'none';
    return undefined;
  };

  // 決算月
  if (kd?.fiscal) {
    const none = one('fiscal', '決算月');
    patch.fiscalMonth = none === 'none' ? 'none' : monthOf(kd.fiscal.month);
  }
  // 予算策定時期（from/to は "YYYY-MM"）
  if (kd?.budget) {
    const none = one('budget', '予算策定時期');
    if (none === 'none') patch.budgetMonths = 'none';
    else {
      const f = monthOf(kd.budget.fm ?? kd.budget.from);
      const t = monthOf(kd.budget.tm ?? kd.budget.to) ?? f;
      patch.budgetMonths = f ? [f, t ?? f] : null;
    }
  }
  // 契約更新月
  if (kd?.renewal) {
    const none = one('renewal', '契約更新月');
    patch.renewalMonth = none === 'none' ? 'none' : monthOf(kd.renewal.month);
  }

  // 未設定になったものは送らない（既存を消さないため）
  for (const k of Object.keys(patch)) if (patch[k] == null) delete patch[k];

  const confidence = total === 0 ? null : est === total ? '推定' : est === 0 ? '確認済み' : '一部推定';
  return { patch, confidence, source: srcLines.join('\n').slice(0, 1800) };
}

async function migrateKeyDates() {
  const edits = docs.filter(d => d.collection === 'edits');
  const targets = [];

  const resolveStats = { notion_url: 0, name_and_mrr: 0, name_only: 0, unresolved: 0, raw_missing: 0 };
  for (const d of edits) {
    const kd = (d.data ?? {}).company?.keyDates;
    if (!kd || !Object.keys(kd).length) continue;
    const r = resolveCompany(d.id);
    resolveStats[r.how]++;
    if (!r.customer) continue;
    targets.push({ customer: r.customer, ...toPatch(kd) });
  }

  log('');
  log(`キー日程を持つ会社: ${targets.length + resolveStats.unresolved + resolveStats.raw_missing} 社`);
  log(`  会社を解決: URL ${resolveStats.notion_url} / 社名＋MRR ${resolveStats.name_and_mrr} / 社名のみ ${resolveStats.name_only}`);
  log(`  解決できない: ${resolveStats.unresolved + resolveStats.raw_missing} 社`);

  const list = LIMIT ? targets.slice(0, LIMIT) : targets;
  const stats = { updated: 0, skipped: 0, conflict: 0, failed: 0, fields: {} };

  for (const t of list) {
    // 確度と出典も一緒に書く。プロパティ名は Notion の実名
    const full = { ...t.patch };
    const extra = {};
    if (t.confidence) extra['キー日程の確度'] = t.confidence;
    if (t.source) extra['キー日程の出典'] = t.source;

    if (!APPLY) {
      stats.updated++;
      for (const k of Object.keys(full)) stats.fields[k] = (stats.fields[k] ?? 0) + 1;
      if (t.confidence) stats.fields['確度'] = (stats.fields['確度'] ?? 0) + 1;
      continue;
    }

    try {
      const r = await notion.updateCustomerWithExtras(
        t.customer.pageId, full, extra, t.customer.lastEditedTime,
      );
      if (r.ok) {
        stats.updated++;
        for (const k of r.changed) stats.fields[k] = (stats.fields[k] ?? 0) + 1;
      } else if (r.reason === 'conflict') {
        stats.conflict++;
      } else {
        stats.skipped++;
      }
    } catch (e) {
      stats.failed++;
      console.error(`  更新できず: ${e.kind ?? 'error'}`);
    }
  }

  log('');
  log(APPLY ? '結果（本番）' : '結果（dry-run。書き込んでいない）');
  log(`  更新     : ${stats.updated}`);
  log(`  変更なし : ${stats.skipped}`);
  log(`  競合     : ${stats.conflict}  ${stats.conflict ? '← 人が Notion を触っている。もう一度流せば取り込める' : ''}`);
  log(`  失敗     : ${stats.failed}`);
  log(`  項目別   : ${JSON.stringify(stats.fields)}`);
  return stats.failed ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Twenty へ入れる共通の道具
// ═══════════════════════════════════════════════════════════════════════════

/** externalId で重複を防いで作る。Twenty に upsert が無いため「作る前に検索」 */
async function createOnce(objKey, externalId, rec, stats) {
  const o = T.TEST_OBJECTS[objKey];
  if (!APPLY) { stats.create++; return { id: `(dry)${externalId}`, created: true }; }
  try {
    const r = await tw.createIfAbsent(o.plural, o.singular,
      `externalId[eq]:${externalId}`, { ...rec, externalId });
    r.created ? stats.create++ : stats.exists++;
    return { id: r.record.id, created: r.created };
  } catch (e) {
    stats.failed++;
    console.error(`  作成できず ${o.plural}: ${e.kind ?? 'error'}`);
    return null;
  }
}

const summary = (label, s) =>
  log(`  ${label.padEnd(20)} 新規 ${s.create} / 既存 ${s.exists} / 失敗 ${s.failed}`);

/** 会社を解決して Notion ページ ID を返す。解決できなければ null */
function pageIdOf(cid, miss) {
  const r = resolveCompany(cid);
  if (!r.customer) { miss.push(r.how); return null; }
  return r.customer.pageId;
}

// ═══════════════════════════════════════════════════════════════════════════
// ② 組織図
// ═══════════════════════════════════════════════════════════════════════════

const ATTITUDE = { '推進': 'PROMOTE', '好意的': 'FAVORABLE', '中立': 'NEUTRAL',
                   '慎重': 'CAUTIOUS', '反対': 'OPPOSED', '不明': 'UNKNOWN' };
const CONTACT  = { '接点あり': 'CONTACTED', '未接触': 'NOT_CONTACTED' };
const CONF     = { '公開': 'PUBLIC', '社内': 'INTERNAL' };
const DEAL_ROLE = { '最終決裁者': 'FINAL_APPROVER', '決裁者': 'APPROVER', '影響者': 'INFLUENCER',
                    '推進者': 'PROMOTER', '技術評価者': 'EVALUATOR', '利用者': 'USER' };

async function migrateOrgs() {
  const orgs = docs.filter(d => d.collection === 'orgs');
  const person = { create: 0, exists: 0, failed: 0 };
  const comment = { create: 0, exists: 0, failed: 0 };
  const oplog = { create: 0, exists: 0, failed: 0 };
  const miss = [];
  let parentFixed = 0, parentFailed = 0;

  for (const d of orgs) {
    const pageId = pageIdOf(d.id, miss);
    if (!pageId) continue;
    const o = d.data ?? {};
    const idMap = new Map();   // 旧ノードID → 新 testPerson id

    // 1 パス目: 親を付けずに作る
    for (const [i, n] of (o.nodes ?? []).entries()) {
      const ext = `orgs:${d.id}:${n.id}`;
      const memo = [n.note, n.src ? `出典: ${n.src}` : null, n.conf ? `情報区分: ${n.conf}` : null]
        .filter(Boolean).join('\n') || null;
      const r = await createOnce('person', ext, {
        name: n.name ?? '', notionCompanyId: pageId,
        nodeType: n.kind ?? 'person', order: i,
        title: n.title || null,
        attitude: ATTITUDE[n.stance] ?? null,
        contact: CONTACT[n.contact] ?? null,
        // 推定は情報区分より優先して分かるようにする
        infoSource: n.st === 'est' ? 'ESTIMATED' : (CONF[n.conf] ?? null),
        dealRole: DEAL_ROLE[n.role] ?? null,
        isDecisionMaker: n.role === '決裁者' || n.role === '最終決裁者',
        influential: n.inf === true,
        memo, sourceNote: n.src || null, source: 'ui',
      }, person);
      if (r) idMap.set(n.id, r.id);
    }

    // 2 パス目: 親子関係を付ける（1 パス目で全員の id が決まってから）
    for (const n of (o.nodes ?? [])) {
      if (!n.parent || typeof n.parent !== 'string') continue;
      const childId = idMap.get(n.id), parentId = idMap.get(n.parent);
      if (!childId || !parentId) continue;
      if (!APPLY) { parentFixed++; continue; }
      try {
        await tw.updateRecord(T.TEST_OBJECTS.person.plural, T.TEST_OBJECTS.person.singular,
          childId, { parentId });
        parentFixed++;
      } catch { parentFailed++; }
    }

    // 会話メモ → testComment
    for (const [i, m] of (o.memos ?? []).entries()) {
      await createOnce('comment', `orgs:${d.id}:memo:${i}`, {
        name: `組織図メモ ${m.at ?? ''}`.trim(), notionCompanyId: pageId,
        targetType: 'COMPANY', body: m.text ?? '', at: m.at ?? null, source: 'ui',
      }, comment);
    }

    // 変更履歴 → testOperationLog
    for (const [i, h] of (o.history ?? []).entries()) {
      await createOnce('operationLog', `orgs:${d.id}:history:${i}`, {
        name: '組織図の変更', at: h.at ?? null, actor: o.genBy ?? null,
        action: 'update', object: 'testPerson', recordId: null,
        message: h.summary ?? '', source: 'sync',
      }, oplog);
    }
  }

  log('');
  log(`② 組織図: ${orgs.length} 社 / 解決できない ${miss.length}`);
  summary('testPerson', person);
  log(`  ${'親子関係'.padEnd(18)} 設定 ${parentFixed} / 失敗 ${parentFailed}`);
  summary('testComment', comment);
  summary('testOperationLog', oplog);
  return person.failed + comment.failed + oplog.failed + parentFailed;
}

// ═══════════════════════════════════════════════════════════════════════════
// ③ サクセス計画
// ═══════════════════════════════════════════════════════════════════════════

async function migratePlans() {
  const aplans = docs.filter(d => d.collection === 'aplans');
  const plan = { create: 0, exists: 0, failed: 0 };
  const action = { create: 0, exists: 0, failed: 0 };
  const miss = [];

  for (const d of aplans) {
    const pageId = pageIdOf(d.id, miss);
    if (!pageId) continue;
    const a = d.data ?? {};

    for (const [q, v] of Object.entries(a.quarters ?? {})) {
      await createOnce('accountPlan', `aplans:${d.id}:${q}`, {
        name: `${q} サクセス計画`, notionCompanyId: pageId,
        quarter: q, goal: v.goal ?? null, aimMrr: typeof v.aim === 'number' ? v.aim : null,
        source: String(v.src ?? '').startsWith('ai') ? 'ai' : 'ui',
      }, plan);
    }

    for (const it of (a.items ?? [])) {
      await createOnce('action', `aplans:${d.id}:${it.id}`, {
        name: it.text ?? '', notionCompanyId: pageId,
        kind: 'SUCCESS', title: it.text ?? '',
        lane: it.t === 'exp' ? 'exp' : 'use',
        month: it.m ?? null, week: it.w != null ? String(it.w) : null,
        status: it.done ? 'DONE' : 'OPEN',
        doneAt: it.doneAt ?? null,
        source: String(it.src ?? '').startsWith('ai') ? 'ai' : 'ui',
      }, action);
    }
  }

  log('');
  log(`③ サクセス計画: ${aplans.length} 社 / 解決できない ${miss.length}`);
  summary('testAccountPlan', plan);
  summary('testAction', action);
  return plan.failed + action.failed;
}

// ═══════════════════════════════════════════════════════════════════════════
// ④ 商談
// ═══════════════════════════════════════════════════════════════════════════

async function migrateDeals() {
  const edits = docs.filter(d => d.collection === 'edits');
  const opp = { create: 0, exists: 0, failed: 0 };
  const action = { create: 0, exists: 0, failed: 0 };
  const activity = { create: 0, exists: 0, failed: 0 };
  const miss = [];
  let msDropped = 0;

  const msOf = (ms) => {
    if (!ms || typeof ms !== 'object') return {};
    const out = {};
    for (const [k, v] of Object.entries(ms)) {
      if (k === 'TRIAL') out.msTrial = v;
      else if (k === 'QUOTE') out.msQuote = v;
      else if (k === 'VERBAL_COMMIT') out.msVerbal = v;
      else if (v) msDropped++;          // 旧フェーズの予定は捨てる（対応先が無い）
    }
    return out;
  };

  const oneDeal = async (cid, pageId, key, x, isMain) => {
    const stage = T.normalizeStage(x.phase);
    const r = await createOnce('opportunity', `edits:${cid}:${key}`, {
      name: x.name ?? 'Ptengine AI', notionCompanyId: pageId,
      stage, addMrr: typeof x.addMrr === 'number' ? x.addMrr : null,
      applyDate: x.applyDate ?? null, billingDate: x.billingDate ?? null,
      termMonths: typeof x.term === 'number' ? x.term : null,
      msBase: x.msBase === 'bill' ? 'bill' : 'apply', ...msOf(x.ms),
      barrier: x.barrier || null, need: x.need || null,
      lostReason: x.lostReason || null, lostDetail: x.lostDetail || null,
      pendingStage: T.normalizeStage(x.pendingPhase),
      approvedAt: x.approvedAt ?? null, isMain,
    }, opp);
    if (!r) return;

    if (x.na) {
      await createOnce('action', `edits:${cid}:${key}:na`, {
        name: x.na, notionCompanyId: pageId, opportunityId: r.id,
        kind: 'NEXT_ACTION', title: x.na, dueDate: x.naDate ?? null,
        status: 'OPEN', source: 'ui',
      }, action);
    }
    for (const [i, l] of (Array.isArray(x.log) ? x.log : []).entries()) {
      const type = l.t === 'ph' ? 'STAGE_CHANGE' : l.t === 'br' ? 'BARRIER_UPDATE' : 'ACTION_DONE';
      await createOnce('activity', `edits:${cid}:${key}:log:${i}`, {
        name: l.text ?? l.t ?? '', notionCompanyId: pageId, opportunityId: r.id,
        type, occurredAt: l.at ?? null,
        fromStage: T.normalizeStage(l.from), toStage: T.normalizeStage(l.to),
        text: l.text ?? null, note: l.note ?? null, actor: l.by ?? null,
        meetingSource: null,
      }, activity);
    }
  };

  for (const d of edits) {
    const e = d.data ?? {};
    const hasMain = Object.keys(e.opp ?? {}).length > 0;
    const extra = Array.isArray(e.deals) ? e.deals : [];
    if (!hasMain && !extra.length) continue;
    const pageId = pageIdOf(d.id, miss);
    if (!pageId) continue;
    if (hasMain) await oneDeal(d.id, pageId, 'main', e.opp, true);
    for (const x of extra) await oneDeal(d.id, pageId, x.key ?? 'x', x, false);
  }

  log('');
  log(`④ 商談: 解決できない ${miss.length} / 到達予定の欠落 ${msDropped} 件`);
  summary('testOpportunity', opp);
  summary('testAction', action);
  summary('testActivity', activity);
  return opp.failed + action.failed + activity.failed;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑤ 変更ログと AI サマリー
// ═══════════════════════════════════════════════════════════════════════════

async function migrateLogs() {
  const oplog = { create: 0, exists: 0, failed: 0 };
  const activity = { create: 0, exists: 0, failed: 0 };
  const miss = [];

  for (const [i, d] of docs.filter(x => x.collection === 'feed').entries()) {
    const f = d.data ?? {};
    const pageId = pageIdOf(f.cid, miss);
    await createOnce('operationLog', `feed:${d.id}`, {
      name: f.label ?? f.kind ?? '変更', at: f.at ?? null, actor: f.by ?? null,
      action: 'update', object: 'testOpportunity', recordId: f.key ?? null,
      field: f.kind ?? null, from: f.from == null ? null : String(f.from),
      to: f.to == null ? null : String(f.to),
      message: [f.label, pageId ? null : '（会社を解決できず）'].filter(Boolean).join(' '),
      source: 'sync',
    }, oplog);
    void i;
  }

  for (const d of docs.filter(x => x.collection === 'recent')) {
    const r = d.data ?? {};
    const pageId = pageIdOf(r.companyId ?? d.id, miss);
    if (!pageId) continue;
    await createOnce('activity', `recent:${d.id}`, {
      name: '直近の動き（AI 推計）', notionCompanyId: pageId,
      type: 'AI_RECENT', occurredAt: r.genAt ?? null,
      text: typeof r.summary === 'string' ? r.summary : null,
      note: [r.overview, r.momentum ? `勢い: ${r.momentum}` : null,
             r.lastContact ? `最終接触: ${r.lastContact}` : null].filter(Boolean).join('\n') || null,
      actor: 'ai',
    }, activity);
  }

  log('');
  log(`⑤ 変更ログと AI サマリー: 会社を解決できない ${miss.length}`);
  summary('testOperationLog', oplog);
  summary('testActivity', activity);
  return oplog.failed + activity.failed;
}

// ═══════════════════════════════════════════════════════════════════════════

let code = 0;
const run = { keydates: migrateKeyDates, orgs: migrateOrgs, plans: migratePlans,
              deals: migrateDeals, logs: migrateLogs };
if (ONLY === 'all') {
  for (const k of ['keydates', 'orgs', 'plans', 'deals', 'logs']) code += await run[k]();
} else if (run[ONLY]) {
  code += await run[ONLY]();
} else {
  console.error(`未対応: --only=${ONLY}`);
  code = 1;
}

log('');
log(APPLY ? '**書き込みました。**' : '書き込みは一切していません。実行するには --apply');
process.exit(code);
