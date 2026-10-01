// ─── PtAI Pipeline: Twenty `test*` オブジェクトの契約 ────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §7
// 構築: scripts/twenty-test-schema.mjs（2026-09-30 に本番ワークスペースへ作成済み）
//
// ═══════════════════════════════════════════════════════════════════════════
//  **ここが Twenty 側の名前を知る唯一の場所。** client / repository / route / UI は
//  必ずここを経由すること。フィールド名を直書きしない。
//
//  既存の Company / Opportunity / Person / Note / Task は**参照しない**（§0）。
//  会社との結び付けは Notion 顧客管理DB のページ ID（`notionCompanyId`）で行う。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── Twenty の制約（2026-09-30 実測）──────────────────────────────────────────
//   1. SELECT の option.value は **大文字のみ**。小文字は 400 で拒否される。
//      仕様書のアプリ側の値（ui / apply / use / person …）は VALUE_ALIAS で読み替える。
//   2. `type` は予約語。`object` / `field` も拒否された。FIELD_ALIAS で読み替える。
//      （`from` / `to` / `order` / `action` / `at` はそのまま通った）
//   3. REST の limit は最大 200。depth は 0 か 1 のみ。`fields` パラメータは無い。

// ═══════════════════════════════════════════════════════════════════════════
// 1. オブジェクト
// ═══════════════════════════════════════════════════════════════════════════

export const TEST_OBJECTS = {
  opportunity:  { singular: 'testOpportunity',  plural: 'testOpportunities' },
  action:       { singular: 'testAction',       plural: 'testActions' },
  activity:     { singular: 'testActivity',     plural: 'testActivities' },
  person:       { singular: 'testPerson',       plural: 'testPeople' },
  accountPlan:  { singular: 'testAccountPlan',  plural: 'testAccountPlans' },
  comment:      { singular: 'testComment',      plural: 'testComments' },
  operationLog: { singular: 'testOperationLog', plural: 'testOperationLogs' },
} as const;

export type TestObjectKey = keyof typeof TEST_OBJECTS;

/** 書き込みを許すのはこの 6 つだけ。client.ts がここで弾く */
export const WRITABLE_PLURALS: ReadonlySet<string> =
  new Set(Object.values(TEST_OBJECTS).map(o => o.plural));

// ═══════════════════════════════════════════════════════════════════════════
// 2. フィールド名の読み替え（Twenty に拒否された名前）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 仕様書の名前 → Twenty で実際に作られた名前。
 * ここに無いものは仕様書どおりの名前で存在する。
 */
export const FIELD_ALIAS: Record<string, Record<string, string>> = {
  testActivity:     { type: 'activityType' },
  testOperationLog: { object: 'objectName', field: 'fieldName' },
};

/** 仕様書の名前を Twenty の実名に変換する */
export function twentyField(objectSingular: string, specName: string): string {
  return FIELD_ALIAS[objectSingular]?.[specName] ?? specName;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. フェーズ（§F。Salesforce の商談フェーズに合わせた 7 段階＋失注）
// ═══════════════════════════════════════════════════════════════════════════

export const STAGES = [
  'NOT_STARTED', 'FIRST_MEETING', 'TRIAL', 'QUOTE',
  'VERBAL_COMMIT', 'APPLICATION', 'CLOSED_WON', 'CLOSED_LOST',
] as const;
export type Stage = (typeof STAGES)[number];

/** 進行順。CLOSED_LOST はどこからでも遷移できるので順序に含めない */
export const STAGE_ORDER: readonly Stage[] = STAGES.slice(0, 7) as readonly Stage[];

export const STAGE_JP: Record<Stage, string> = {
  NOT_STARTED:   '初回アポ実施前',
  FIRST_MEETING: '初回アポ実施済み',
  TRIAL:         'トライアル開始済み',
  QUOTE:         '最終見積もり提示済み',
  VERBAL_COMMIT: '口頭合意獲得済み',
  APPLICATION:   '申込用紙回収済み',
  CLOSED_WON:    '契約締結済み',
  CLOSED_LOST:   '失注',
};

/** §F の暫定確率。**§9-6 が未決**（申込用紙回収済みを確定に含めるか） */
export const STAGE_PROB: Record<Stage, number> = {
  NOT_STARTED: 0, FIRST_MEETING: 0.10, TRIAL: 0.30, QUOTE: 0.55,
  VERBAL_COMMIT: 0.80, APPLICATION: 0.95, CLOSED_WON: 1, CLOSED_LOST: 0,
};

/** 旧キーの読み替え（§F）。読み込み時にだけ使う。書き込みは新キーのみ */
export const STAGE_LEGACY: Record<string, Stage> = {
  RE_PROPOSAL: 'TRIAL', EVALUATION: 'TRIAL', APPROVAL: 'QUOTE',
};

export function normalizeStage(v: unknown): Stage | null {
  const s = typeof v === 'string' ? v : '';
  const mapped = STAGE_LEGACY[s] ?? s;
  return (STAGES as readonly string[]).includes(mapped) ? (mapped as Stage) : null;
}

/** 承認が要る変更（§4-2）。契約締結済みに入れる／外す */
export function needsApproval(from: Stage | null, to: Stage | null): boolean {
  return from !== to && (from === 'CLOSED_WON' || to === 'CLOSED_WON');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SELECT の値（Twenty は大文字のみ）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 仕様書のアプリ側の値 → Twenty に保存する値。
 * 単純な大文字化だが、取り違えないよう明示する。
 */
export const toTwentyValue = (v: string | null | undefined): string | null =>
  v == null || v === '' ? null : String(v).toUpperCase();

/** Twenty の値 → 仕様書のアプリ側の値（小文字が正の項目だけ） */
export const LOWERCASE_VALUE_FIELDS: ReadonlySet<string> = new Set([
  'msBase', 'lane', 'source', 'nodeType', 'action',
]);

export function fromTwentyValue(fieldName: string, v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  return LOWERCASE_VALUE_FIELDS.has(fieldName) ? v.toLowerCase() : v;
}

export const ACTION_KIND  = ['NEXT_ACTION', 'SUCCESS', 'FOLLOW_UP'] as const;
export const ACTION_STATUS = ['OPEN', 'DONE', 'CANCELED'] as const;
export const ACTIVITY_TYPE = ['ACTION_DONE', 'STAGE_CHANGE', 'BARRIER_UPDATE', 'MEETING', 'AI_RECENT'] as const;
export const NODE_TYPE     = ['person', 'group', 'dept'] as const;
export const ATTITUDE      = ['PROMOTE', 'NEUTRAL', 'CAUTIOUS', 'OPPOSED', 'UNKNOWN'] as const;
export const LOG_ACTION    = ['create', 'update', 'delete', 'approve', 'reject', 'request', 'sync'] as const;
export const SOURCE        = ['ui', 'ai', 'sync'] as const;

export type ActionKind   = (typeof ACTION_KIND)[number];
export type ActionStatus = (typeof ACTION_STATUS)[number];
export type ActivityType = (typeof ACTIVITY_TYPE)[number];
export type NodeType     = (typeof NODE_TYPE)[number];
export type Attitude     = (typeof ATTITUDE)[number];
export type LogAction    = (typeof LOG_ACTION)[number];
export type Source       = (typeof SOURCE)[number];

// ═══════════════════════════════════════════════════════════════════════════
// 5. レコードの型（仕様書 §7 の名前で書く。Twenty 実名への変換は client が行う）
// ═══════════════════════════════════════════════════════════════════════════

export interface TestOpportunity {
  id?:              string;
  name?:            string;     // Twenty の表示名。商談名と同じ値を入れる
  notionCompanyId?: string | null;
  companyName?:     string | null;
  stage?:           Stage | null;
  pendingStage?:    Stage | null;
  addMrr?:          number | null;   // 円
  applyDate?:       string | null;   // YYYY-MM-DD
  billingDate?:     string | null;
  termMonths?:      number | null;
  msTrial?:         string | null;
  msQuote?:         string | null;
  msVerbal?:        string | null;
  msBase?:          'apply' | 'bill' | null;
  barrier?:         string | null;
  need?:            string | null;
  lostReason?:      string | null;
  lostDetail?:      string | null;
  followUpMonths?:  number | null;
  isMain?:          boolean | null;
  pendingEdit?:     unknown;
  pendingDelete?:   unknown;
  approvedAt?:      string | null;
  approvedBy?:      string | null;
  owner?:           string | null;
  deletedAt?:       string | null;
}

export interface TestAction {
  id?:              string;
  name?:            string;
  kind?:            ActionKind | null;
  opportunityId?:   string | null;
  notionCompanyId?: string | null;
  title?:           string | null;
  dueDate?:         string | null;
  week?:            string | null;
  lane?:            'use' | 'exp' | null;
  month?:           string | null;
  status?:          ActionStatus | null;
  doneAt?:          string | null;
  result?:          string | null;
  stageAtDone?:     Stage | null;
  source?:          Source | null;
  aiDraftId?:       string | null;
  owner?:           string | null;
}

export interface TestActivity {
  id?:              string;
  name?:            string;
  /** Twenty 実名は activityType（`type` は予約語）*/
  type?:            ActivityType | null;
  occurredAt?:      string | null;
  notionCompanyId?: string | null;
  opportunityId?:   string | null;
  fromStage?:       Stage | null;
  toStage?:         Stage | null;
  text?:            string | null;
  note?:            string | null;
  sourceUrl?:       string | null;
  actor?:           string | null;
  /**
   * 議事録の出典。Notion（JP_Docs）と Mii（Twenty Note）は**別系統で、
   * 同じ会議が両方に載りうる**。片方に寄せない。
   */
  meetingSource?:   MeetingSource | null;
  /** 重複取り込みを防ぐ鍵。Notion のページID / Twenty Note の id */
  externalId?:      string | null;
}

/** 議事録の出典（notion/schema.ts と同じ値。循環 import を避けてここにも置く） */
export const MEETING_SOURCES = ['NOTION', 'MII', 'TWENTY_NOTE', 'MANUAL'] as const;
export type MeetingSource = (typeof MEETING_SOURCES)[number];

export interface TestPerson {
  id?:              string;
  name?:            string;
  notionCompanyId?: string | null;
  nodeType?:        NodeType | null;
  parentId?:        string | null;
  order?:           number | null;
  title?:           string | null;
  department?:      string | null;
  attitude?:        Attitude | null;
  isDecisionMaker?: boolean | null;
  influential?:     boolean | null;
  contact?:         'CONTACTED' | 'NOT_CONTACTED' | null;
  infoSource?:      'PUBLIC' | 'INTERNAL' | 'ESTIMATED' | null;
  memo?:            string | null;
  email?:           string | null;
  phone?:           string | null;
  source?:          'ui' | 'ai' | 'card' | null;
}

export interface TestAccountPlan {
  id?:              string;
  name?:            string;
  notionCompanyId?: string | null;
  quarter?:         string | null;   // YYYY-Qn
  goal?:            string | null;
  aimMrr?:          number | null;
  source?:          Source | null;
  fiscalMonth?:     string | null;
  budgetMonths?:    string | null;
  renewal?:         string | null;
}

/**
 * コメントのログ（§9-3 の回答 / 2026-10-01）。
 * 組織図の会話メモのように、人が書き足した文章を 1 行ずつ残す。
 * **変更履歴は `testOperationLog` のほう**（誰が何をどう変えたか）。
 */
export interface TestComment {
  id?:              string;
  name?:            string;
  notionCompanyId?: string | null;
  targetType?:      'COMPANY' | 'PERSON' | 'OPPORTUNITY' | 'ACCOUNT_PLAN' | null;
  targetId?:        string | null;
  body?:            string | null;
  author?:          string | null;
  at?:              string | null;
  source?:          'ui' | 'ai' | null;
  /** 移行の重複を防ぐ鍵 */
  externalId?:      string | null;
}

export interface TestOperationLog {
  id?:         string;
  name?:       string;
  at?:         string | null;
  actor?:      string | null;
  action?:     LogAction | null;
  /** Twenty 実名は objectName */
  object?:     string | null;
  recordId?:   string | null;
  /** Twenty 実名は fieldName */
  field?:      string | null;
  from?:       string | null;
  to?:         string | null;
  source?:     Source | null;
  aiDraftId?:  string | null;
  message?:    string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. 自動計算のルール（§3。保存しない）
// ═══════════════════════════════════════════════════════════════════════════

/** 足切り。会社ごとの追加MRR がこの額未満なら合算MRR ごと数えない */
export const AI_MIN = 100_000;

/** 到達予定の逆算（§3）。申込完了日から何日前か */
export const MS_OFFSET_DAYS = { TRIAL: 49, QUOTE: 35, VERBAL_COMMIT: 10 } as const;

/** 課金開始日を基準にするときは 14 日引いてから逆算する */
export const MS_BILL_OFFSET_DAYS = 14;
