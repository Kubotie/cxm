#!/usr/bin/env node
// ─── PtAI Pipeline: Twenty `test*` オブジェクトの構築 ────────────────────────
//
//   node scripts/twenty-test-schema.mjs --status     現状を表示（GET のみ）
//   node scripts/twenty-test-schema.mjs --dry-run    作る予定を表示（GET のみ）
//   node scripts/twenty-test-schema.mjs --apply      不足分だけ作成（冪等）
//   node scripts/twenty-test-schema.mjs --destroy    test* を削除（要 --yes）
//
// 出典: docs/ptai-dashboard-operation-flows.md §7
//
// ── 守ること ──────────────────────────────────────────────────────────────────
//   - 触るのは nameSingular が `test` で始まるオブジェクトだけ。
//     既存の Company / Opportunity / Person / Task / Note には**一切触れない**
//     （--destroy も test* 以外は拒否する）
//   - 会社との結び付けは Notion のページ ID（`notionCompanyId`）。Twenty の
//     リレーションは張らない（§7）
//   - API キー・顧客データをログに出さない
//   - 冪等。何度実行しても、足りないものを足すだけ
//
// ── Twenty の制約（2026-09-30 実測）──────────────────────────────────────────
//   1. SELECT の option.value は **大文字**でないと 400（小文字は INVALID_FIELD_INPUT）。
//      仕様書のアプリ側の値（ui / apply / use / person …）は大文字で保存し、
//      アプリは schema.ts の VALUE_ALIAS で読み替える。
//   2. `type` は**予約語**（"This name is reserved"）。fallback の名前で作る。
//      `from` / `to` / `order` は通った。`object` / `field` は拒否された。
//   拒否された名前は FALLBACK で作り直し、対応を最後に表示する。
//   アプリ側は schema.ts の FIELD_ALIAS / VALUE_ALIAS を見ること。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const KEY  = (process.env.TWENTY_API_KEY || process.env.TWENTY_READ_API_KEY || '').trim();
const BASE = (process.env.TWENTY_API_URL || 'https://crm.ptengine.com').replace(/\/+$/, '');
if (!KEY) { console.error('TWENTY_API_KEY が未設定です'); process.exit(1); }

const argv = new Set(process.argv.slice(2));
const MODE = argv.has('--apply') ? 'apply' : argv.has('--destroy') ? 'destroy'
           : argv.has('--dry-run') ? 'dry-run' : 'status';

// ═══════════════════════════════════════════════════════════════════════════
// フェーズ（§F。Salesforce の商談フェーズに合わせた 7 段階＋失注）
// ═══════════════════════════════════════════════════════════════════════════

const STAGES = [
  // Salesforce のフェーズに合わせた（2026-10-01）。POC は使わないと決めたので入れない。
  // 旧キー（NOT_STARTED ほか）は読み込み時に読み替えるので、選択肢からは外す。
  ['INACTIVE',           'Inactive',           'gray'],
  ['ACTIVE',             'Active',             'blue'],
  ['GOAL_SHARED',        'Goal Shared',        'blue'],
  ['QUALIFIED_CHAMPION', 'Qualified Champion', 'blue'],
  ['EVALUATING',         'Evaluating',         'blue'],
  ['PROBABLE',           'Probable',           'blue'],
  ['VERBAL',             'Verbal',             'purple'],
  ['WON',                'Won',                'green'],
  ['CLOSED_WON',         '受注 (Closed Won)',   'green'],
  ['ADMIN_CLOSE',        'Admin Close',        'gray'],
  ['CLOSED_LOST',        'Close Lost',         'red'],
];

/** SELECT の options を組み立てる。value は英大文字スネーク or 指定値 */
const opts = rows => rows.map(([value, label, color], i) => ({
  value: String(value).toUpperCase(),   // Twenty は小文字の value を拒否する
  label, color: color || 'gray', position: i,
}));

const stageOpts = () => opts(STAGES);

// ═══════════════════════════════════════════════════════════════════════════
// スキーマ定義（docs/ptai-dashboard-operation-flows.md §7 のまま）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 各オブジェクトの `name`（TEXT）は Twenty が自動で作る表示名。
 * 仕様書が `title` を挙げているものは `title` も作り、アプリは両方に同じ値を入れる。
 */
const SCHEMA = [
  {
    nameSingular: 'testOpportunity', namePlural: 'testOpportunities',
    labelSingular: 'PtAI 商談（test）', labelPlural: 'PtAI 商談（test）',
    description: 'PtAI Pipeline の商談。会社は Notion のページ ID で結ぶ', icon: 'IconTargetArrow',
    fields: [
      ['notionCompanyId', 'TEXT',      'Notion 会社ページID'],
      ['companyName',     'TEXT',      '会社名'],
      ['stage',           'SELECT',    'フェーズ',          { options: stageOpts() }],
      ['pendingStage',    'SELECT',    '承認待ちフェーズ',  { options: stageOpts() }],
      ['addMrr',          'NUMBER',    '追加MRR（円）'],
      ['applyDate',       'DATE',      '申込完了日'],
      ['billingDate',     'DATE',      '課金開始日'],
      ['termMonths',      'NUMBER',    '契約期間（月）'],
      ['msTrial',         'DATE',      '到達予定 トライアル'],
      ['msQuote',         'DATE',      '到達予定 最終見積'],
      ['msVerbal',        'DATE',      '到達予定 口頭合意'],
      ['msBase',          'SELECT',    '到達予定の基準', { options: opts([['apply','申込完了日','blue'],['bill','課金開始日','purple']]) }],
      ['barrier',         'TEXT',      '障壁'],
      ['need',            'TEXT',      'ニーズ'],
      ['lostReason',      'TEXT',      '失注理由'],
      ['lostDetail',      'TEXT',      '失注理由の詳細'],
      ['followUpMonths',  'NUMBER',    'フォロー間隔（月）'],
      ['isMain',          'BOOLEAN',   'main の商談か'],
      ['pendingEdit',     'RAW_JSON',  '承認待ちの変更'],
      ['pendingDelete',   'RAW_JSON',  '承認待ちの削除'],
      ['approvedAt',      'DATE_TIME', '承認日時'],
      ['approvedBy',      'TEXT',      '承認者'],
      ['owner',           'TEXT',      '担当'],
      ['updatedByName2', 'TEXT', '最終更新者（PtAI の操作者）'],
      ['externalId',      'TEXT',      '移行元のID'],
    ],
  },
  {
    nameSingular: 'testAction', namePlural: 'testActions',
    labelSingular: 'PtAI アクション（test）', labelPlural: 'PtAI アクション（test）',
    description: 'ネクストアクションとサクセス Todo、定期フォロー', icon: 'IconChecklist',
    fields: [
      ['kind',            'SELECT', '種類', { options: opts([['NEXT_ACTION','ネクストアクション','blue'],['SUCCESS','サクセス Todo','green'],['FOLLOW_UP','定期フォロー','gray']]) }],
      ['opportunityId',   'TEXT',   '商談ID'],
      ['notionCompanyId', 'TEXT',   'Notion 会社ページID'],
      ['title',           'TEXT',   '内容'],
      ['dueDate',         'DATE',   '期日'],
      ['week',            'TEXT',   '週'],
      ['lane',            'SELECT', 'レーン', { options: opts([['use','活用・サクセス','green'],['exp','アカウント攻略','orange']]) }],
      ['month',           'TEXT',   '月'],
      ['status',          'SELECT', '状態', { options: opts([['OPEN','未完了','blue'],['DONE','完了','green'],['CANCELED','取消','gray']]) }],
      ['doneAt',          'DATE_TIME', '完了日時'],
      ['result',          'TEXT',   '結果メモ'],
      ['stageAtDone',     'SELECT', '完了時のフェーズ', { options: stageOpts() }],
      ['source',          'SELECT', '入力元', { options: opts([['ui','画面','blue'],['ai','AI','purple']]) }],
      ['aiDraftId',       'TEXT',   'AI 下書きID'],
      ['owner',           'TEXT',   '担当'],
      ['updatedByName2', 'TEXT', '最終更新者（PtAI の操作者）'],
      ['externalId',      'TEXT',   '移行元のID'],
    ],
  },
  {
    nameSingular: 'testActivity', namePlural: 'testActivities',
    labelSingular: 'PtAI 活動記録（test）', labelPlural: 'PtAI 活動記録（test）',
    description: '行動履歴の元になる活動記録', icon: 'IconTimeline',
    fields: [
      ['type',            'SELECT', '種類', { fallback: 'activityType', options: opts([['ACTION_DONE','アクション完了','green'],['STAGE_CHANGE','フェーズ変更','blue'],['BARRIER_UPDATE','障壁更新','orange'],['MEETING','打ち合わせ','purple'],['AI_RECENT','AI推計','gray']]) }],
      ['occurredAt',      'DATE_TIME', '発生日時'],
      ['notionCompanyId', 'TEXT',   'Notion 会社ページID'],
      ['opportunityId',   'TEXT',   '商談ID'],
      ['fromStage',       'SELECT', '変更前フェーズ', { options: stageOpts() }],
      ['toStage',         'SELECT', '変更後フェーズ', { options: stageOpts() }],
      ['text',            'TEXT',   '内容'],
      ['note',            'TEXT',   '補足'],
      ['sourceUrl',       'LINKS',  '出典URL'],
      ['actor',           'TEXT',   '実行者'],
      // 議事録の出典。Notion（JP_Docs）と Mii（Twenty Note）は**別系統で、同じ会議が
      // 両方に載りうる**（2026-10-01 実測・利用者確認）。片方に寄せず両方を残す。
      ['meetingSource',   'SELECT', '議事録の出典', { options: opts([
        ['NOTION','Notion JP_Docs','blue'],['MII','Mii（Twenty Note）','purple'],
        ['TWENTY_NOTE','Twenty Note（その他）','gray'],['MANUAL','手入力','green']]) }],
      // 重複取り込みを防ぐ鍵。Notion のページID / Twenty Note の id を入れる
      ['updatedByName2', 'TEXT', '最終更新者（PtAI の操作者）'],
      ['externalId',      'TEXT',   '出典のレコードID'],
    ],
  },
  {
    nameSingular: 'testPerson', namePlural: 'testPeople',
    labelSingular: 'PtAI 組織図（test）', labelPlural: 'PtAI 組織図（test）',
    description: '組織図の人・グループ・部署', icon: 'IconSitemap',
    fields: [
      ['notionCompanyId', 'TEXT',    'Notion 会社ページID'],
      ['nodeType',        'SELECT',  '種別', { options: opts([['person','人','blue'],['group','グループ','green'],['dept','部署','purple']]) }],
      ['parentId',        'TEXT',    '親ノードID'],
      ['order',           'NUMBER',  '並び順', { fallback: 'sortOrder' }],
      ['title',           'TEXT',    '役職'],
      ['department',      'TEXT',    '部署'],
      ['attitude',        'SELECT',  '態度', { options: opts([['PROMOTE','推進','green'],['FAVORABLE','好意的','turquoise'],['NEUTRAL','中立','gray'],['CAUTIOUS','慎重','yellow'],['OPPOSED','反対','red'],['UNKNOWN','不明','gray']]) }],
      ['isDecisionMaker', 'BOOLEAN', '決裁者'],
      ['influential',     'BOOLEAN', '影響力'],
      ['contact',         'SELECT',  '接点', { options: opts([['CONTACTED','接点あり','green'],['NOT_CONTACTED','未接触','gray']]) }],
      ['infoSource',      'SELECT',  '情報源', { options: opts([['PUBLIC','公開','blue'],['INTERNAL','社内','green'],['ESTIMATED','推定','gray']]) }],
      // 原本の st（ok=確定済み / est=未確定）。infoSource（公開・社内・推定）とは別の軸。
      // 2026-10-01 まで 1 列に畳んでいたため、st='est' のノードは conf を失っていた。
      ['confirmed',       'BOOLEAN', '確定済み'],
      ['memo',            'TEXT',    'メモ'],
      // 移行で足したもの（2026-10-01）
      ['dealRole',        'SELECT',  '商談での役割', { options: opts([
        ['FINAL_APPROVER','最終決裁者','red'],['APPROVER','決裁者','orange'],
        ['INFLUENCER','影響者','yellow'],['PROMOTER','推進者','green'],
        ['EVALUATOR','技術評価者','blue'],['USER','利用者','gray']]) }],
      ['sourceNote',      'TEXT',    '出典'],
      ['updatedByName2', 'TEXT', '最終更新者（PtAI の操作者）'],
      ['externalId',      'TEXT',    '移行元のID'],
      ['email',           'TEXT',    'メール'],
      ['phone',           'TEXT',    '電話'],
      ['source',          'SELECT',  '入力元', { options: opts([['ui','画面','blue'],['ai','AI','purple'],['card','名刺','orange']]) }],
    ],
  },
  {
    nameSingular: 'testAccountPlan', namePlural: 'testAccountPlans',
    labelSingular: 'PtAI サクセス計画（test）', labelPlural: 'PtAI サクセス計画（test）',
    description: '四半期の狙いとキー日程', icon: 'IconCalendarStats',
    fields: [
      ['notionCompanyId', 'TEXT',   'Notion 会社ページID'],
      ['quarter',         'TEXT',   '四半期（YYYY-Qn）'],
      ['goal',            'TEXT',   'サクセス状態'],
      ['aimMrr',          'NUMBER', '狙う追加MRR（円）'],
      ['source',          'SELECT', '入力元', { options: opts([['ui','画面','blue'],['ai','AI','purple']]) }],
      ['fiscalMonth',     'TEXT',   '決算月'],
      ['budgetMonths',    'TEXT',   '予算策定時期'],
      ['renewal',         'TEXT',   '契約更新'],
      ['updatedByName2', 'TEXT', '最終更新者（PtAI の操作者）'],
      ['externalId',      'TEXT',   '移行元のID'],
    ],
  },
  {
    nameSingular: 'testComment', namePlural: 'testComments',
    labelSingular: 'PtAI コメント（test）', labelPlural: 'PtAI コメント（test）',
    description: '組織図の会話メモなど、人が書き足したコメントのログ', icon: 'IconMessage',
    fields: [
      ['notionCompanyId', 'TEXT',      'Notion 会社ページID'],
      // 何に付いたコメントか。会社単位のメモは targetType=COMPANY で targetId を空にする
      ['targetType',      'SELECT',    '対象', { options: opts([
        ['COMPANY','会社','blue'],['PERSON','組織図の人','green'],
        ['OPPORTUNITY','商談','purple'],['ACCOUNT_PLAN','サクセス計画','orange']]) }],
      ['targetId',        'TEXT',      '対象レコードID'],
      ['body',            'TEXT',      '本文'],
      ['author',          'TEXT',      '書いた人'],
      ['at',              'DATE_TIME', '日時'],
      ['source',          'SELECT',    '入力元', { options: opts([['ui','画面','blue'],['ai','AI','purple']]) }],
      // 移行の重複を防ぐ鍵
      ['updatedByName2', 'TEXT', '最終更新者（PtAI の操作者）'],
      ['externalId',      'TEXT',      '移行元のID'],
    ],
  },
  {
    nameSingular: 'testOperationLog', namePlural: 'testOperationLogs',
    labelSingular: 'PtAI 操作記録（test）', labelPlural: 'PtAI 操作記録（test）',
    description: '監査ログと新着フィードの元', icon: 'IconHistory',
    fields: [
      ['at',         'DATE_TIME', '日時', { fallback: 'occurredAt' }],
      ['actor',      'TEXT',      '実行者'],
      ['action',     'SELECT',    '操作', { fallback: 'actionType', options: opts([['create','作成','green'],['update','更新','blue'],['delete','削除','red'],['approve','承認','green'],['reject','却下','orange'],['request','申請','yellow'],['sync','同期','gray']]) }],
      ['object',     'TEXT',      '対象オブジェクト', { fallback: 'objectName' }],
      ['recordId',   'TEXT',      '対象レコードID'],
      ['field',      'TEXT',      '項目', { fallback: 'fieldName' }],
      ['from',       'TEXT',      '変更前', { fallback: 'fromValue' }],
      ['to',         'TEXT',      '変更後', { fallback: 'toValue' }],
      ['source',     'SELECT',    '入力元', { options: opts([['ui','画面','blue'],['ai','AI','purple'],['sync','同期','gray']]) }],
      ['aiDraftId',  'TEXT',      'AI 下書きID'],
      ['message',    'TEXT',      '説明'],
      ['updatedByName2', 'TEXT', '最終更新者（PtAI の操作者）'],
      ['externalId', 'TEXT',      '移行元のID'],
    ],
  },
  {
    nameSingular: 'testFeedback', namePlural: 'testFeedbacks',
    labelSingular: 'PtAI フィードバック（test）', labelPlural: 'PtAI フィードバック（test）',
    description: '画面から送られた要望・不具合の報告と、その判断記録', icon: 'IconMessageReport',
    fields: [
      ['body',        'TEXT',      '内容'],
      ['kind',        'SELECT',    '種別', { options: opts([
        ['BUG','動かない','red'],['WRONG','内容が違う','orange'],
        ['REQUEST','こうしたい','blue'],['QUESTION','質問','gray']]) }],
      // NEW → TRIAGED（方針を示した）→ RESOLVED / DISMISSED / DEFERRED（保留）
      ['status',      'SELECT',    '状態', { options: opts([
        ['NEW','新規','red'],['TRIAGED','方針あり','blue'],['DEFERRED','保留','orange'],
        ['RESOLVED','解決','green'],['DISMISSED','見送り','gray']]) }],
      // 画面のどこを指しているか。再描画で変わりうるので elementText も残す
      ['selector',    'TEXT',      '要素のパス'],
      ['elementText', 'TEXT',      '要素の文字'],
      ['screenPath',  'TEXT',      '画面・タブ'],
      ['notionCompanyId', 'TEXT',  'Notion 会社ページID'],
      ['reporter',    'TEXT',      '報告者'],
      // ここから下は私（Claude）が書く判断記録
      ['decision',    'TEXT',      '対応方針'],
      ['decidedBy',   'TEXT',      '判断した人'],
      ['decidedAt',   'DATE_TIME', '判断日時'],
      ['resolvedAt',  'DATE_TIME', '解決・見送り日時'],
      ['updatedByName2', 'TEXT',   '最終更新者（PtAI の操作者）'],
      ['externalId',  'TEXT',      '移行元のID'],
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HTTP
// ═══════════════════════════════════════════════════════════════════════════

let calls = 0;
async function api(method, path, body) {
  calls++;
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* 204 など */ }
  if (!r.ok) {
    const msg = json && (json.messages?.join(' / ') || json.message || json.error);
    const e = new Error(`HTTP ${r.status}${msg ? ' — ' + String(msg).slice(0, 200) : ''}`);
    e.status = r.status;
    throw e;
  }
  return json;
}
/** data の形が呼び出しごとに違うので吸収する */
const pick = j => { const d = j?.data; if (!d) return j; if (d.id) return d; for (const k of Object.keys(d)) if (d[k]?.id) return d[k]; return d; };

async function listObjects() {
  const out = [];
  let cursor;
  for (let guard = 0; guard < 20; guard++) {
    const qs = `?limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ''}`;
    const j = await api('GET', `/rest/metadata/objects${qs}`);
    const items = j?.data?.objects ?? j?.data ?? [];
    out.push(...items);
    const pi = j?.pageInfo ?? j?.data?.pageInfo;
    if (!pi?.hasNextPage) break;
    cursor = pi.endCursor;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 実行
// ═══════════════════════════════════════════════════════════════════════════

const alias = {};   // 予約語で作り直したもの: 'testOperationLog.from' -> 'fromValue'
const log = [];
const say = s => { log.push(s); console.log(s); };

const existing = await listObjects();
const byName = new Map(existing.map(o => [o.nameSingular, o]));
const testObjects = existing.filter(o => o.nameSingular.startsWith('test'));

say(`接続先 ${BASE}`);
say(`既存オブジェクト ${existing.length} 個（うち test* は ${testObjects.length} 個）\n`);

// ── status / dry-run ────────────────────────────────────────────────────────
if (MODE === 'status' || MODE === 'dry-run') {
  for (const spec of SCHEMA) {
    const cur = byName.get(spec.nameSingular);
    if (!cur) { say(`[未作成] ${spec.nameSingular} — フィールド ${spec.fields.length} 個を作成予定`); continue; }
    const have = new Set((cur.fields ?? []).map(f => f.name));
    const missing = spec.fields.filter(([n, , , o]) => !have.has(n) && !have.has(o?.fallback));
    say(missing.length
      ? `[不足] ${spec.nameSingular} — 既存 ${have.size} / 不足 ${missing.length}: ${missing.map(f => f[0]).join(', ')}`
      : `[完了] ${spec.nameSingular} — 必要なフィールドは揃っている`);
  }
  say(`\nGET ${calls} 回。書き込みはしていない。`);
  if (MODE === 'dry-run') say('適用するには --apply');
  process.exit(0);
}

// ── destroy ─────────────────────────────────────────────────────────────────
if (MODE === 'destroy') {
  if (!argv.has('--yes')) { console.error('--destroy には --yes が要る'); process.exit(1); }
  for (const o of testObjects) {
    if (!o.nameSingular.startsWith('test')) continue;    // 二重の安全弁
    try {
      try { await api('DELETE', `/rest/metadata/objects/${o.id}`); }
      catch { await api('PATCH', `/rest/metadata/objects/${o.id}`, { isActive: false });
              await api('DELETE', `/rest/metadata/objects/${o.id}`); }
      say(`削除 ${o.nameSingular}`);
    } catch (e) { say(`削除できず ${o.nameSingular} — ${e.message}`); }
  }
  const after = (await listObjects()).filter(o => o.nameSingular.startsWith('test'));
  say(`\n残っている test*: ${after.length ? after.map(o => o.nameSingular).join(', ') : 'なし'}`);
  process.exit(0);
}

// ── apply ───────────────────────────────────────────────────────────────────
let created = 0, addedFields = 0, failed = 0;

for (const spec of SCHEMA) {
  let obj = byName.get(spec.nameSingular);

  if (!obj) {
    try {
      const j = await api('POST', '/rest/metadata/objects', {
        nameSingular: spec.nameSingular, namePlural: spec.namePlural,
        labelSingular: spec.labelSingular, labelPlural: spec.labelPlural,
        description: spec.description, icon: spec.icon,
      });
      obj = pick(j);
      say(`作成 ${spec.nameSingular}`);
      created++;
    } catch (e) { say(`作成できず ${spec.nameSingular} — ${e.message}`); failed++; continue; }
  } else {
    say(`既存 ${spec.nameSingular}`);
  }

  const have = new Set((obj.fields ?? []).map(f => f.name));

  for (const [name, type, label, o = {}] of spec.fields) {
    if (have.has(name) || (o.fallback && have.has(o.fallback))) continue;
    const body = { type, name, label, objectMetadataId: obj.id, isNullable: true };
    if (o.options) body.options = o.options;
    try {
      await api('POST', '/rest/metadata/fields', body);
      addedFields++;
    } catch (e) {
      if (!o.fallback) { say(`  フィールド追加できず ${spec.nameSingular}.${name} — ${e.message}`); failed++; continue; }
      try {
        await api('POST', '/rest/metadata/fields', { ...body, name: o.fallback });
        alias[`${spec.nameSingular}.${name}`] = o.fallback;
        say(`  ${name} は拒否されたので ${o.fallback} で作成（予約語）`);
        addedFields++;
      } catch (e2) { say(`  フィールド追加できず ${spec.nameSingular}.${name} — ${e2.message}`); failed++; }
    }
  }
}

say(`\nオブジェクト作成 ${created} / フィールド追加 ${addedFields} / 失敗 ${failed}`);
if (Object.keys(alias).length) {
  say('\n予約語による名前の読み替え（src/lib/ptai/twenty-test/schema.ts の FIELD_ALIAS に反映すること）:');
  for (const [k, v] of Object.entries(alias)) say(`  ${k} → ${v}`);
}

// ── 検証 ────────────────────────────────────────────────────────────────────
const after = await listObjects();
const afterByName = new Map(after.map(o => [o.nameSingular, o]));
say('\n検証:');
let ng = 0;
for (const spec of SCHEMA) {
  const cur = afterByName.get(spec.nameSingular);
  if (!cur) { say(`  NG ${spec.nameSingular} — 存在しない`); ng++; continue; }
  const have = new Set((cur.fields ?? []).map(f => f.name));
  const missing = spec.fields.filter(([n, , , o]) => !have.has(n) && !have.has(o?.fallback));
  if (missing.length) { say(`  NG ${spec.nameSingular} — 不足: ${missing.map(f => f[0]).join(', ')}`); ng++; }
  else say(`  OK ${spec.nameSingular} — フィールド ${have.size} 個`);
}
say(`\n非 test* のオブジェクト数: ${after.filter(o => !o.nameSingular.startsWith('test')).length}（変更していない）`);
say(`API 呼び出し ${calls} 回`);
process.exit(ng ? 1 : 0);
