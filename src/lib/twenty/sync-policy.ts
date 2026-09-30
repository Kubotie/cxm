// ─── Twenty ↔ PGA パイプライン 同期ポリシー（Single Source of Truth）──────────
//
// このファイルは Twenty と PGA ダッシュボードの対応を定義する唯一の場所。
// client / adapter / route / UI はここの型・定数を参照し、独自判断を持たないこと。
// （Salesforce 側の src/lib/salesforce/sync-policy.ts と同じ作法）
//
// ── 出典 ──────────────────────────────────────────────────────────────────────
//   Utty の取得スクリプト `pga_dashboard_fetch.py` の build()。
//   実測で動いているマッピングなので、**推測で変えないこと**。
//   HANDOVER 5-3 の対応表よりこちらが新しい（いくつかの「要確認」が確定している）。
//
// ── 更新ルール ────────────────────────────────────────────────────────────────
//   フィールドの主従を変える前に、必ずここを更新してから実装に反映する。

// ── 1. 取得対象 ──────────────────────────────────────────────────────────────

/**
 * Phase 2 の初回インポートで引くもの。
 * plural 名・depth・filter は取得スクリプトと同一。
 *
 * depth=1 にしているのは relation を 1 段引くため:
 *   opportunities … pointOfContact（窓口の氏名・役職）
 *   tasks         … 紐付け先
 * companies / notes は depth=0 で足りる。
 */
export const TWENTY_SOURCES = {
  opportunities: { plural: 'opportunities', depth: 1 as const, filter: undefined },
  companies: {
    plural: 'companies',
    depth: 0 as const,
    // PGA の対象だけに絞る。全社を引くと無関係な企業まで入る
    filter: 'or(pgaStatus[is]:NOT_NULL,customerSource[in]:[PGA_TARGET,BOTH])',
  },
  workspaceMembers: { plural: 'workspaceMembers', depth: 0 as const, filter: undefined },
  tasks:            { plural: 'tasks',            depth: 1 as const, filter: undefined },
  notes:            { plural: 'notes',            depth: 0 as const, filter: undefined },
  /** 取得はするが **現状は使っていない**（Note と会社の紐付けはタイトル照合） */
  noteTargets:      { plural: 'noteTargets',      depth: 0 as const, filter: undefined },
} as const;

// ── 2. Company → RAW.companies[] ─────────────────────────────────────────────

/**
 * RAW の短縮キー ← Twenty のフィールド。
 * 値は build() の実装どおり。変換が要るものは note に書く。
 */
export const COMPANY_FIELD_MAP = {
  cid:  { twenty: 'id',                              note: '共有 DB の doc id にもなる' },
  n:    { twenty: 'name',                            note: '全角スペースを半角に置換する' },
  t:    { twenty: 'tier',                            note: 'TIER1/2/3/5' },
  ps:   { twenty: 'pgaStatus',                       note: 'フェーズ推定には使わない' },
  m:    { twenty: 'mrr.amountMicros',                note: '÷1e6 して円。null なら 0' },
  ind:  { twenty: 'industryJp',                      note: 'IND_JP のキー' },
  slug: { twenty: 'industrySlug',                    note: 'ポテンシャル計算用。IND15 のキー' },
  lay:  { twenty: 'companySizeLayer',                note: 'ENTERPRISE/MID/SMB。未入力は中堅扱い' },
  own:  { twenty: 'pgaOwner[]',                      note: 'enum → 呼称（OWNER_ENUM_TO_NAME）' },
  icp:  { twenty: 'icpJudgment',                     note: '' },
  aw:   { twenty: 'issueAwareness',                  note: '' },
  src:  { twenty: 'customerSource',                  note: '' },
  na:   { twenty: 'nextAction',                      note: '**履歴として読むだけ**。次の一手には使わない（10-4-1）' },
  up:   { twenty: 'updatedAt',                       note: '日付部分のみ' },
  url:  { twenty: 'notionLinks.primaryLinkUrl',      note: '' },
  dom:  { twenty: 'domainName.primaryLinkUrl',       note: '' },
  cs:   { twenty: 'qiYueZhuangKuang',                note: '契約状況。HANDOVER で「要確認」だったが確定' },
} as const;

/** Twenty の pgaOwner enum → ダッシュボードの呼称 */
export const OWNER_ENUM_TO_NAME: Record<string, string> = {
  SHINICHI_NAGAI: 'Paul',
  BB:             'Baba',
  ERI_KITADA:     'Eri',
  KUBOTIE:        'Kubotie',
  AVA:            'Ava',
  PERRY:          'Perry',
  UTTY:           'Utty',
};

/** 呼称 → enum（Phase 3 の書き込み用） */
export const OWNER_NAME_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(OWNER_ENUM_TO_NAME).map(([k, v]) => [v, k]),
);

/**
 * 主担当（RAW.o）の決め方。
 *   1. Notion 顧客DB「担当3」があればそれ（asg='担当3'）
 *   2. 無ければ pgaOwner から Perry / Utty を除いたもの
 *   3. それも空なら pgaOwner そのまま、さらに空なら ['未割当']
 *
 * **担当3 は Twenty には無い。** 取得スクリプトでは 2026-09-28 時点の固定マップを
 * 内蔵している。Phase 2 で Notion から引くか、固定マップを外部ファイルにするか要判断。
 */
export const PRIMARY_OWNER_RULE = {
  excludeFromFallback: ['Perry', 'Utty'] as const,
  unassignedLabel: '未割当',
  assignedBySource: '担当3',
} as const;

// ── 3. Opportunity → RAW.companies[].opp[] ───────────────────────────────────

export const OPPORTUNITY_FIELD_MAP = {
  id:      { twenty: 'id',                        note: '主商談の oid' },
  raw:     { twenty: 'name',                      note: '表示時に `PGA - ` を `Ptengine AI - ` に置換' },
  st:      { twenty: 'stage',                     note: '現値は NEW/SCREENING/MEETING/PROPOSAL。8 段階フェーズと不一致' },
  close:   { twenty: 'closeDate',                 note: '日付部分のみ。現データは全件 null' },
  net:     { twenty: 'netMrr.amountMicros',       note: '÷1e6。**amount ではない**（HANDOVER の「要確認」を解決）' },
  ownerId: { twenty: 'ownerId',                   note: '現データは全件 null' },
  need:    { twenty: 'needsSummary',              note: '' },
  src:     { twenty: 'sourceInfo',                note: 'ニーズの出典' },
  pc:      { twenty: 'pointOfContact.name / .jobTitle', note: '**depth=1 が必要**。「氏名 / 役職」に連結' },
  up:      { twenty: 'updatedAt',                 note: '日付部分のみ' },
} as const;

/**
 * Opportunity と Company の紐付け。
 *
 * **Twenty の Opportunity.companyId は全件空**なので、リレーションは使えない。
 * 商談名から接頭辞を外し、正規化した社名で突き合わせる。
 *   1. 完全一致（正規化名）を優先
 *   2. 残りは 3 文字以上の部分一致（どちらかがどちらかを含む）
 *   3. 一度使った商談は再利用しない
 *
 * Phase 2 でここが壊れると商談が会社に付かない（監査 R-6）。
 */
export const OPPORTUNITY_MATCH = {
  /** 商談名から取り除く接頭辞 */
  namePrefix: /^(PGA|Ptengine AI) - /,
  /** 社名の正規化（法人格・括弧・空白を落とす） */
  normalize: (s: string): string =>
    (s || '').replace(/株式会社|一般社団法人|（.*?）|\(.*?\)|[\s　]/g, ''),
  /** 部分一致を許す最短長 */
  minPartialLength: 3,
} as const;

// ── 4. Note → RAW.companies[].notes[] ────────────────────────────────────────

/**
 * Note と会社の紐付け。
 *
 * **noteTargets は取得しているが使っていない。**（HANDOVER の「要確認」を解決）
 * 実際はタイトルに正規化社名を含むかで判定し、さらに
 *   - より長い社名にも含まれてしまう場合は除外（誤爆防止）
 *   - ToB / ToC の取り違えを除外
 * をかけている。日付はタイトル先頭の YYYY-MM-DD。
 */
export const NOTE_MATCH = {
  titleDatePattern: /^(\d{4}-\d{2}-\d{2})/,
  bodyField: 'bodyV2.markdown',
  bodyMaxChars: 1800,
  maxPerCompany: 6,
  useNoteTargets: false,
} as const;

// ── 5. 正本の分担（Phase 3 以降）────────────────────────────────────────────
//
// **未確定。Leevis との合意が要る。** ここに書いてあるのは提案であって決定ではない。
// 合意できたら status を 'agreed' にして、adapter はこの表だけを見るようにする。

export type FieldOwner = 'twenty' | 'dashboard' | 'notion';

export interface SyncRule {
  field:  string;
  owner:  FieldOwner;
  /** 'read' = Twenty から読むだけ / 'write' = ダッシュボードから書く / 'none' = 同期しない */
  direction: 'read' | 'write' | 'none';
  status: 'proposed' | 'agreed';
  note?:  string;
}

export const SYNC_RULES: SyncRule[] = [
  // 企業マスタは Twenty が正本
  { field: 'company.name',         owner: 'twenty',    direction: 'read',  status: 'proposed' },
  { field: 'company.mrr',          owner: 'notion',    direction: 'read',  status: 'proposed', note: '現在MRR は Notion 顧客DB の最新値（10-4-12）' },
  { field: 'company.pgaOwner',     owner: 'twenty',    direction: 'read',  status: 'proposed' },
  { field: 'company.primaryOwner', owner: 'notion',    direction: 'read',  status: 'proposed', note: 'Notion「担当3」。Twenty には無い' },
  // Tier・業種はダッシュボードから書き戻す（HANDOVER 5-4 の確度「高」）
  { field: 'company.tier',         owner: 'dashboard', direction: 'write', status: 'proposed' },
  { field: 'company.industryJp',   owner: 'dashboard', direction: 'write', status: 'proposed', note: 'industrySlug は IND_FALLBACK で導出' },
  // 商談の進行情報はダッシュボードが正本
  { field: 'opportunity.name',     owner: 'dashboard', direction: 'write', status: 'proposed' },
  { field: 'opportunity.needsSummary', owner: 'dashboard', direction: 'write', status: 'proposed' },
  { field: 'opportunity.netMrr',   owner: 'dashboard', direction: 'write', status: 'proposed' },
  { field: 'opportunity.closeDate', owner: 'dashboard', direction: 'write', status: 'proposed', note: '申込完了日' },
  // 対応が決まっていないもの
  { field: 'opportunity.stage',    owner: 'dashboard', direction: 'none',  status: 'proposed', note: '**Twenty は 4 段階、ダッシュボードは 8 段階。対応を Leevis と決めるまで同期しない**（監査 Q6）' },
  { field: 'company.aimMrr',       owner: 'dashboard', direction: 'none',  status: 'proposed', note: 'Twenty にフィールドが無い。スキーマ追加の承認待ち（監査 Q7）' },
  { field: 'opportunity.barrier',  owner: 'dashboard', direction: 'none',  status: 'proposed', note: '同上' },
  { field: 'opportunity.billingDate', owner: 'dashboard', direction: 'none', status: 'proposed', note: '同上' },
  { field: 'opportunity.milestones',  owner: 'dashboard', direction: 'none', status: 'proposed', note: '同上（到達予定）' },
  // 削除は同期しない
  { field: '*.delete',             owner: 'twenty',    direction: 'none',  status: 'proposed', note: 'Twenty で消えてもアプリ側は残す。sync_state=orphaned にするだけ（監査 Q14）' },
];

/** 合意済みのルールだけを返す。adapter はこれを使う */
export function agreedRules(): SyncRule[] {
  return SYNC_RULES.filter(r => r.status === 'agreed');
}
