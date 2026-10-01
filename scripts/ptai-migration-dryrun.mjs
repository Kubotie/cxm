#!/usr/bin/env node
// ─── 旧データ移行の dry-run（§9-8）──────────────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//        scripts/ptai-migration-dryrun.mjs
//
// `pga_docs` の各 collection を Twenty の test* / Notion へ移したときに
// **何件がどこへ行き、何が移せないか**を出す。
//
// ═══════════════════════════════════════════════════════════════════════════
//  **読み取りしかしない。** Twenty へも Notion へも NocoDB へも書き込まない。
//  出力は件数と種別だけ。**顧客名・UUID・本文は出さない。**
// ═══════════════════════════════════════════════════════════════════════════
//
// 会社の鍵の付け替えがこの移行の要:
//   旧: `edits` の doc_id = Twenty Company の UUID（`cid`）
//   新: `notionCompanyId` = Notion 顧客管理DB のページ ID
// RAW スナップショットの `url`（Notion ページの URL）で橋渡しする。

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
const nschema = await import(`file://${ROOT}/src/lib/ptai/notion/schema.ts`);
const tschema = await import(`file://${ROOT}/src/lib/ptai/twenty-test/schema.ts`);
const mm     = await import(`file://${ROOT}/src/lib/ptai/minutes.ts`);

const line = (s = '') => console.log(s);
const h = (s) => { line(); line(`── ${s} ${'─'.repeat(Math.max(0, 62 - s.length))}`); };

/** Notion のページ ID をダッシュ無し小文字に揃える */
const normId = (v) => String(v ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');
/** Notion の URL からページ ID を取り出す */
const idFromUrl = (u) => {
  const m = /([0-9a-f]{32})(?:\?|$|#)/i.exec(String(u ?? '').replace(/-/g, ''));
  return m ? m[1].toLowerCase() : null;
};

line('PtAI Pipeline 旧データ移行 dry-run（書き込みなし）');
line(`実行 ${new Date().toISOString()}`);

// ═══════════════════════════════════════════════════════════════════════════
// 0. 読み込み
// ═══════════════════════════════════════════════════════════════════════════

const rawText = await store.getRawSnapshot();
const raw = rawText ? JSON.parse(rawText) : { companies: [] };
const docs = await store.listAllDocs();
const customers = await notion.listCustomers({ maxPages: 20 });

const byCollection = {};
for (const d of docs) (byCollection[d.collection] ??= []).push(d);

h('入力');
line(`RAW スナップショット : ${raw.companies?.length ?? 0} 社（取得 ${raw.fetched ?? '不明'}）`);
line(`Notion 顧客管理DB    : ${customers.length} 社`);
line(`pga_docs             : ${docs.length} 行`);
for (const [k, v] of Object.entries(byCollection).sort()) line(`  ${k.padEnd(10)} ${v.length} 行`);

// ═══════════════════════════════════════════════════════════════════════════
// 1. 会社の鍵の付け替え（cid → Notion ページ ID）
// ═══════════════════════════════════════════════════════════════════════════

const notionById = new Map(customers.map(c => [normId(c.pageId), c]));
const notionByName = new Map();
for (const c of customers) {
  const key = mm.normalizeCompanyName(c.name);
  if (!key) continue;
  // 同名が複数あるものは誤爆するので照合表に入れない
  notionByName.set(key, notionByName.has(key) ? null : c);
}

const rawByCid = new Map((raw.companies ?? []).map(c => [c.cid, c]));

/** cid → { pageId, how } */
function resolveCompany(cid) {
  const co = rawByCid.get(cid);
  if (!co) return { pageId: null, how: 'raw_missing' };
  const fromUrl = idFromUrl(co.url);
  if (fromUrl && notionById.has(fromUrl)) return { pageId: fromUrl, how: 'notion_url' };
  const byName = notionByName.get(mm.normalizeCompanyName(co.n ?? ''));
  if (byName) return { pageId: normId(byName.pageId), how: 'name' };
  if (fromUrl) return { pageId: null, how: 'url_not_in_notion' };
  return { pageId: null, how: 'unresolved' };
}

const edits = byCollection.edits ?? [];
const resolve = { notion_url: 0, name: 0, url_not_in_notion: 0, unresolved: 0, raw_missing: 0 };
const resolved = new Map();
for (const d of edits) {
  const r = resolveCompany(d.id);
  resolve[r.how]++;
  if (r.pageId) resolved.set(d.id, r.pageId);
}

h('① 会社の鍵の付け替え（edits の doc_id → Notion ページ ID）');
line(`対象 ${edits.length} 社`);
line(`  Notion の URL から解決 : ${resolve.notion_url}`);
line(`  社名の完全一致で解決   : ${resolve.name}  ${resolve.name ? '← 2026-10-01 検証済み（社名・MRR とも完全一致）' : ''}`);
line(`  **解決できない**       : ${resolve.url_not_in_notion + resolve.unresolved + resolve.raw_missing}`);
line(`    URL はあるが Notion に無い : ${resolve.url_not_in_notion}`);
line(`    URL も社名も一致しない     : ${resolve.unresolved}`);
line(`    RAW に会社が無い           : ${resolve.raw_missing}`);

// ═══════════════════════════════════════════════════════════════════════════
// 2. edits → testOpportunity / testAction / testActivity
// ═══════════════════════════════════════════════════════════════════════════

const has = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);
const OPP_FIELDS = ['name','phase','addMrr','applyDate','billingDate','term','barrier','need',
                    'na','naDate','lostReason','lostDetail','ms','msBase','pendingPhase','approvedAt'];

let oppMain = 0, oppExtra = 0, actionNa = 0, activityLog = 0, oppSkipped = 0;
const stageCount = {};
const legacyStage = { RE_PROPOSAL: 0, EVALUATION: 0, APPROVAL: 0 };
const msDropped = { APPROVAL: 0, RE_PROPOSAL: 0, EVALUATION: 0 };
let msKept = 0;
const logKinds = {};
const unmapped = {};

const countStage = (v) => {
  if (!has(v)) return;
  if (v in legacyStage) legacyStage[v]++;
  const s = tschema.normalizeStage(v);
  stageCount[s ?? `(未知:${v})`] = (stageCount[s ?? `(未知:${v})`] ?? 0) + 1;
};
const countMs = (ms) => {
  if (!ms || typeof ms !== 'object') return;
  for (const k of Object.keys(ms)) {
    if (k in msDropped) msDropped[k]++;
    else if (has(ms[k])) msKept++;
  }
};

for (const d of edits) {
  const e = d.data ?? {};
  if (!resolved.has(d.id)) { oppSkipped++; continue; }

  const opp = e.opp ?? {};
  if (OPP_FIELDS.some(k => has(opp[k]))) {
    oppMain++;
    countStage(opp.phase);
    countMs(opp.ms);
    if (has(opp.na)) actionNa++;
    for (const l of (Array.isArray(opp.log) ? opp.log : [])) {
      activityLog++; logKinds[l?.t ?? '(なし)'] = (logKinds[l?.t ?? '(なし)'] ?? 0) + 1;
    }
    for (const k of Object.keys(opp)) {
      if (!OPP_FIELDS.includes(k) && !['log','updatedAt','steps','pendingEdit','pendingDelete'].includes(k)) {
        unmapped[`opp.${k}`] = (unmapped[`opp.${k}`] ?? 0) + 1;
      }
    }
  }

  for (const x of (Array.isArray(e.deals) ? e.deals : [])) {
    oppExtra++;
    countStage(x.phase);
    countMs(x.ms);
    if (has(x.na)) actionNa++;
    for (const l of (Array.isArray(x.log) ? x.log : [])) {
      activityLog++; logKinds[l?.t ?? '(なし)'] = (logKinds[l?.t ?? '(なし)'] ?? 0) + 1;
    }
  }
}

h('② edits → Twenty test*');
line(`main の商談  → testOpportunity : ${oppMain} 件`);
line(`追加の商談   → testOpportunity : ${oppExtra} 件`);
line(`ネクストアクション → testAction : ${actionNa} 件`);
line(`経過ログ     → testActivity     : ${activityLog} 件  内訳 ${JSON.stringify(logKinds)}`);
line(`**移せない（会社が解決できない）** : ${oppSkipped} 社`);
line();
line(`フェーズの分布（正規化後）: ${JSON.stringify(stageCount)}`);
line(`旧キーの読み替え: RE_PROPOSAL→TRIAL ${legacyStage.RE_PROPOSAL} / EVALUATION→TRIAL ${legacyStage.EVALUATION} / APPROVAL→QUOTE ${legacyStage.APPROVAL}`);
line();
line(`到達予定（ms）: 移せる ${msKept} 件`);
line(`  **捨てられる**: APPROVAL ${msDropped.APPROVAL} / RE_PROPOSAL ${msDropped.RE_PROPOSAL} / EVALUATION ${msDropped.EVALUATION}`);
line(`  （新しい 7 段階に対応するフェーズが無いため。TRIAL / QUOTE / VERBAL_COMMIT だけが残る）`);
if (Object.keys(unmapped).length) {
  line();
  line(`対応先が決まっていない項目: ${JSON.stringify(unmapped)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. edits.company → Notion
// ═══════════════════════════════════════════════════════════════════════════

let aimMove = 0, aimSame = 0, tierMove = 0, indMove = 0;
const kd = { fiscal: 0, budget: 0, renewal: 0, none: 0 };
let kdCompanies = 0;

for (const d of edits) {
  const pageId = resolved.get(d.id);
  if (!pageId) continue;
  const c = (d.data ?? {}).company ?? {};
  const cust = notionById.get(pageId);

  if (has(c.aim)) (Number(c.aim) === Number(cust?.aimMrr ?? 0) ? aimSame++ : aimMove++);
  if (has(c.tier)) tierMove++;
  if (has(c.ind)) indMove++;

  const k = c.keyDates ?? {};
  if (Object.keys(k).length) kdCompanies++;
  for (const key of ['fiscal', 'budget', 'renewal']) {
    const v = k[key];
    if (!v) continue;
    if (v.none) kd.none++; else kd[key]++;
  }
}

h('③ edits.company → Notion 顧客管理DB');
line(`（目標）追加MRR → 想定追加MRR : 更新 ${aimMove} 件 / すでに同値 ${aimSame} 件`);
line(`Tier の上書き                  : ${tierMove} 件`);
line(`業種の上書き                   : ${indMove} 件`);
line(`キー日程                       : ${kdCompanies} 社`);
line(`  決算月 ${kd.fiscal} / 予算策定時期 ${kd.budget} / 契約更新月 ${kd.renewal} / 「情報なし」 ${kd.none}`);

// ═══════════════════════════════════════════════════════════════════════════
// 4. その他の collection
// ═══════════════════════════════════════════════════════════════════════════

const orgs = byCollection.orgs ?? [];
let orgNodes = 0, orgResolved = 0, orgMemos = 0, orgHistory = 0;
const nodeKinds = {};
for (const d of orgs) {
  if (resolved.has(d.id) || notionById.has(normId(d.id))) orgResolved++;
  const o = d.data ?? {};
  for (const n of (Array.isArray(o.nodes) ? o.nodes : [])) {
    orgNodes++; nodeKinds[n?.kind ?? 'person'] = (nodeKinds[n?.kind ?? 'person'] ?? 0) + 1;
  }
  orgMemos += (Array.isArray(o.memos) ? o.memos.length : 0);
  orgHistory += (Array.isArray(o.history) ? o.history.length : 0);
}

const aplans = byCollection.aplans ?? [];
let quarters = 0, items = 0, aiDrafts = 0;
for (const d of aplans) {
  const a = d.data ?? {};
  quarters += Object.keys(a.quarters ?? {}).length;
  items += (Array.isArray(a.items) ? a.items.length : 0);
  if (a.ai) aiDrafts++;
}

const feed = byCollection.feed ?? [];
const recent = byCollection.recent ?? [];
const newcos = byCollection.newcos ?? [];
let newcosUnsynced = 0;
for (const d of newcos) if ((d.data ?? {}).sync?.twenty !== 'done') newcosUnsynced++;

h('④ その他の collection');
line(`orgs    ${orgs.length} 社 → testPerson ${orgNodes} 行  内訳 ${JSON.stringify(nodeKinds)}`);
line(`          会社を解決できる: ${orgResolved} / ${orgs.length}`);
line(`          会話メモ ${orgMemos} 件 → testComment（§9-3 の回答で新設）`);
line(`          変更履歴 ${orgHistory} 件 → testOperationLog`);
line(`aplans  ${aplans.length} 社 → testAccountPlan ${quarters} 行 ＋ testAction ${items} 行（AI 下書き ${aiDrafts} 件は移さない）`);
line(`feed    ${feed.length} 行 → testOperationLog ${feed.length} 行`);
line(`recent  ${recent.length} 行 → testActivity(AI_RECENT) ${recent.length} 行（**移す**。行動履歴の時系列に穴を空けないため）`);
line(`newcos  ${newcos.length} 行 → Notion にページ作成 ${newcosUnsynced} 件（未同期のぶんだけ）`);
line(`plans / chatwork : ${(byCollection.plans ?? []).length} / ${(byCollection.chatwork ?? []).length} 行 → 実データ無し。移さない`);

// ═══════════════════════════════════════════════════════════════════════════
// 5. まとめ
// ═══════════════════════════════════════════════════════════════════════════

const totalCreate = oppMain + oppExtra + actionNa + activityLog + orgNodes + quarters + items
  + feed.length + orgMemos + orgHistory + recent.length;
h('まとめ');
line(`Twenty へ作成する行の合計 : 約 ${totalCreate} 行`);
line(`  testOpportunity ${oppMain + oppExtra} / testAction ${actionNa + items} / testActivity ${activityLog}`);
line(`  testPerson ${orgNodes} / testAccountPlan ${quarters}`);
line(`  testComment ${orgMemos} / testOperationLog ${feed.length + orgHistory} / testActivity(AI_RECENT) ${recent.length}`);
line(`Notion を更新する会社     : 約 ${aimMove + tierMove + indMove + kdCompanies} 項目ぶん`);
line();
line('要判断:');
const issues = [];
if (oppSkipped) issues.push(`・**${oppSkipped} 社ぶんの入力が移せない**（Notion の会社に結びつかない）`);
if (resolve.name) issues.push(`・${resolve.name} 社は社名で結んでいる（2026-10-01 検証: 21/21 で社名も MRR も完全一致。このまま進める判断）`);
const msLost = msDropped.APPROVAL + msDropped.RE_PROPOSAL + msDropped.EVALUATION;
if (msLost) issues.push(`・到達予定 ${msLost} 件が捨てられる（旧フェーズに対応先が無い）`);
if (aiDrafts) issues.push(`・サクセスの AI 下書き ${aiDrafts} 件は移さない（採用前の案のため）`);
if (!issues.length) issues.push('・特になし');
for (const i of issues) line(i);
line();
line('**書き込みは一切していません。**');
