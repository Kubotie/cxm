// ═══════════════════════════════════════════════════════════════════════════
//  🔄 **【2026-09-30】方針変更中 — このファイルの前提は保留**
//
//  「Twenty へ全面集約」は保留になった。現在の方針は
//  「短期は PtAI Pipeline 専用の NocoDB を使い、Twenty は機能ごとに実測して
//   利用可否を判定し、使える機能だけ段階的に採用する」。
//
//  実測（2026-09-30）で読み取り元にできると判定できたのは
//  **企業マスタ・PtAI 担当・議事録本文の 3 つだけ**。商談・組織図・入力系は
//  Twenty 側のデータが空または紐付かないため、短期は Pipeline の NocoDB が正本。
//
//  正本の設計は docs/ptai-pipeline-data-strategy.md。
//  下記の `sourceOfTruth` と移行前提の記述は、その判定に合わせて改訂予定。
// ═══════════════════════════════════════════════════════════════════════════

// ─── Twenty 集約ポリシー（**PtAI Pipeline 限定**）────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  適用範囲（2026-09-30 確定）
//
//    **このポリシーが対象にするのは PtAI Pipeline（/ptai-pipeline）だけ。**
//    CXM は引き続き NocoDB を主要データストアとして利用する。**対象外。**
//
//  PtAI Pipeline の原則:
//    - 業務データの唯一の正本は Twenty。ダッシュボードは Twenty を操作する UI
//    - Pipeline の永続保存先として NocoDB を採用しない
//    - Pipeline から `pga_docs` への新規保存を行わない
//    - 現在の `pga_docs/_raw` や `edits` 等は、移植過程で作られた**一時的な互換実装**
//      （「もともと使っていない」のではなく、**目標設計では採用しない**）
//    - Pipeline 用の対応表（twenty_link のようなもの）を新設しない
//    - Twenty と `pga_docs` を継続同期しない。移行後に Pipeline の依存を外す
//
//  **対象外（今回も将来も、この計画では触らない）:**
//    - CXM の NocoDB テーブル（46 件）と `src/lib/nocodb/**`
//    - CXM の API・画面・バッチ・データモデル
//    - CXM の Salesforce / Notion / Metabase 連携
//    - 共通認証の `staff_identify`（ログインとロール判定）。
//      これは社内アカウントであって Pipeline の業務データではない
//    - `NOCODB_PGA_DOCS_TABLE_ID` 以外の NocoDB 環境変数
//
//  将来の削除候補は **Pipeline 専用の `NOCODB_PGA_DOCS_TABLE_ID` だけ**。
//  ここで扱う Notion も、PtAI Pipeline が参照している範囲に限る（CXM の Notion 連携は対象外）。
// ═══════════════════════════════════════════════════════════════════════════
//
// このファイルは Twenty と **PtAI Pipeline** の対応を定義する唯一の場所。
// client / adapter / route / UI はここを参照し、独自判断を持たないこと。
//
// ── 出典 ──────────────────────────────────────────────────────────────────────
//   1. 2026-09-30 に本番 Twenty へ実測した結果（MEASURED_2026_09_30）
//   2. Utty の取得スクリプト pga_dashboard_fetch.py の build()
//   食い違う場合は 1 が正しい。推測で変えないこと。
//
// ── Phase 1 の制約 ────────────────────────────────────────────────────────────
//   書き込みは実装しない。futureWriteTarget は「移行後にどこへ書くか」の記録であり、
//   これを読んで書き込む処理は存在しない（client.ts は GET しか発行しない）。

// ═══════════════════════════════════════════════════════════════════════════
// 0. 実測値（2026-09-30）
// ═══════════════════════════════════════════════════════════════════════════

export const MEASURED_2026_09_30 = {
  baseUrl: 'https://crm.ptengine.com',
  /** 引き継ぎ資料の値。**SPA が返るので API ではない** */
  wrongBaseUrl: 'https://crm.ptengine.com/api',
  counts: {
    pgaCompanies:     126,   // PTAI_COMPANY_FILTER 適用後
    allCompanies:     5134,  // フィルタ無し。混同しないこと
    opportunities:    49,
    notes:            114,
    workspaceMembers: 15,
    tasks:            0,
    noteTargets:      24,
  },
  /** 移行元スナップショット（2026-09-28）の企業数。Twenty 側は 126 で、すでに古い */
  legacySnapshotCompanies: 125,
  /** Opportunity 49 件のうち、値が入っている件数 */
  opportunityFilled: {
    company:         0,   // リレーションは存在するが全件空
    owner:           0,   // 同上
    pointOfContact: 46,
    needsSummary:   48,
    closeDate:       0,
    netMrr:          0,
    amount:          0,
    opportunityType: 0,
    salesChannel:    0,
  },
  /** stage の実測分布。**5 段階**（資料の 4 段階は誤り） */
  stageDistribution: { NEW: 13, SCREENING: 3, MEETING: 13, PROPOSAL: 20, CUSTOMER: 0 },
  notesWithNoteTargets: 22,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 1. 取得対象
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PtAI 対象の企業に絞るフィルタ。
 * **これを外すと 5,134 件（全社）になる。** 件数系の呼び出しでは必ず渡すこと。
 */
export const PTAI_COMPANY_FILTER = 'or(pgaStatus[is]:NOT_NULL,customerSource[in]:[PGA_TARGET,BOTH])';

export interface TwentySource {
  plural: string;
  depth:  0 | 1;
  filter: string | null;
  note:   string;
}

export const TWENTY_SOURCES: Record<string, TwentySource> = {
  companies: {
    plural: 'companies', depth: 0, filter: PTAI_COMPANY_FILTER,
    note: 'PtAI 対象のみ。フィルタ必須',
  },
  opportunities: {
    plural: 'opportunities', depth: 1, filter: null,
    note: 'depth=1 が必要（pointOfContact / company / owner を引くため）',
  },
  notes: {
    plural: 'notes', depth: 1, filter: null,
    note: 'depth=1 で noteTargets を見る。紐付かないぶんはタイトル照合に落とす',
  },
  workspaceMembers: {
    plural: 'workspaceMembers', depth: 0, filter: null,
    note: 'メンバー id → 表示名',
  },
  tasks: {
    plural: 'tasks', depth: 1, filter: null,
    note: '**実測 0 件**。商談 NA の移行先候補（Phase 2A で判断）',
  },
  noteTargets: {
    plural: 'noteTargets', depth: 0, filter: null,
    note: '**114 件中 22 件しか無い**。診断用',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. 正本と移行の方針
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PtAI Pipeline の業務データの正本。
 * **'dashboard' は存在しない。** ダッシュボードは UI であって保存先ではない。
 * legacy_* は Pipeline から見た移行元で、移行が終わったら Pipeline の依存を外す。
 * （CXM 側の NocoDB 利用はこの型の対象外で、影響を受けない）
 */
export type SourceOfTruth = 'twenty' | 'legacy_nocodb' | 'legacy_notion' | 'undecided';

/** Twenty 側でどう保持するか */
export type TwentyCapability =
  | 'standard'          // Twenty 標準フィールドで保持できる
  | 'existing_custom'   // すでにあるカスタムフィールドで保持できる
  | 'new_custom_field'  // 新しいカスタムフィールドが必要
  | 'new_custom_object' // カスタムオブジェクト／リレーションが必要
  | 'not_needed';       // そもそも Twenty に保存しなくてよい（再生成可能・UI 設定など）

/** 移行できるか */
export type Migratability = 'ready' | 'needs_schema' | 'needs_decision' | 'not_applicable';

export interface FieldPolicy {
  /** アプリ側の呼び名（RAW のキー、または共有 DB の項目名） */
  appField:          string;
  /** Twenty の既存フィールド。無ければ null */
  twentyField:       string | null;
  /** どの Twenty オブジェクトに載るか */
  twentyObject:      'company' | 'opportunity' | 'person' | 'note' | 'task' | 'custom' | null;
  /** 現在の旧保存先 */
  legacyStore:       string | null;
  sourceOfTruth:     SourceOfTruth;
  capability:        TwentyCapability;
  migratability:     Migratability;
  /** 既存データをどう移すか */
  migrationMethod:   string;
  /** 移行後、UI からの更新がどこへ行くか */
  futureWriteTarget: string;
  /** 変換規則。無変換なら null */
  transform:         string | null;
  /** 未確定事項。**空でないものは勝手に決めない** */
  open:              string | null;
  /** 移行完了後に消せる旧依存 */
  removableLegacyDep: string | null;
}

// ── Company 系 ───────────────────────────────────────────────────────────────

export const COMPANY_POLICY: FieldPolicy[] = [
  { appField: 'cid', twentyField: 'id', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要（Twenty の id をそのまま使う）',
    futureWriteTarget: 'Twenty（不変）', transform: null, open: null, removableLegacyDep: null },

  { appField: 'n', twentyField: 'name', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.name',
    transform: '全角スペース → 半角', open: null, removableLegacyDep: null },

  { appField: 't（Tier）', twentyField: 'tier', twentyObject: 'company', legacyStore: 'pga_docs/edits.company.tier',
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: 'edits に上書き値がある企業だけ Twenty へ反映（dry-run で差分確認）',
    futureWriteTarget: 'Twenty Company.tier（UI から直接）',
    transform: null, open: null, removableLegacyDep: 'pga_docs/edits.company.tier' },

  { appField: 'ind（業種）', twentyField: 'industryJp', twentyObject: 'company', legacyStore: 'pga_docs/edits.company.ind',
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '同上。industrySlug は IND_FALLBACK で導出して同時に更新',
    futureWriteTarget: 'Twenty Company.industryJp / industrySlug',
    transform: 'industrySlug は IND_FALLBACK で導出', open: null,
    removableLegacyDep: 'pga_docs/edits.company.ind' },

  { appField: 'slug', twentyField: 'industrySlug', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.industrySlug',
    transform: null, open: null, removableLegacyDep: null },

  { appField: 'lay（企業規模）', twentyField: 'companySizeLayer', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.companySizeLayer',
    transform: '未入力は「中堅」とみなして表示（保存はしない）', open: null, removableLegacyDep: null },

  { appField: 'ps', twentyField: 'pgaStatus', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.pgaStatus',
    transform: null, open: null, removableLegacyDep: null },

  { appField: 'm（現在MRR）', twentyField: 'mrr', twentyObject: 'company', legacyStore: 'Notion 顧客DB',
    sourceOfTruth: 'legacy_notion', capability: 'standard', migratability: 'needs_decision',
    migrationMethod: 'Notion の最新値を Twenty Company.mrr へ移す。移行後は Twenty が正本',
    futureWriteTarget: 'Twenty Company.mrr',
    transform: 'CURRENCY。amountMicros ÷ 1e6 で円',
    open: '**Notion 顧客DB と Twenty のどちらを先に更新する運用にするか未確定。** 現在は Notion が実質の正本で、Twenty の mrr がそれと一致しているかは未検証',
    removableLegacyDep: 'Notion 顧客DB からの MRR 取り込み' },

  { appField: 'own', twentyField: 'pgaOwner', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'existing_custom', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.pgaOwner',
    transform: 'MULTI_SELECT。enum → 呼称（OWNER_ENUM_TO_NAME）',
    open: 'Baba / Eri / Kubotie は Twenty ワークスペース未登録', removableLegacyDep: null },

  { appField: 'o（主担当・担当3）', twentyField: null, twentyObject: 'company', legacyStore: 'Notion 顧客DB「担当3」＋取得スクリプトの固定マップ',
    sourceOfTruth: 'legacy_notion', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: 'Notion「担当3」を Twenty の新カスタムフィールド（例 primaryOwner）へ一括移行',
    futureWriteTarget: 'Twenty Company.<新カスタムフィールド>',
    transform: null,
    open: '**Twenty に該当フィールドが無い。** 新規カスタムフィールドを作るか、pgaOwner の先頭を主担当とみなすか未確定（Phase 2A）',
    removableLegacyDep: 'Notion「担当3」の参照、取得スクリプトの固定マップ' },

  { appField: 'icp', twentyField: 'icpJudgment', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'existing_custom', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.icpJudgment',
    transform: null, open: null, removableLegacyDep: null },

  { appField: 'aw', twentyField: 'issueAwareness', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'existing_custom', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.issueAwareness',
    transform: null, open: null, removableLegacyDep: null },

  { appField: 'src', twentyField: 'customerSource', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'existing_custom', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.customerSource',
    transform: null, open: null, removableLegacyDep: null },

  { appField: 'na（行動履歴の元）', twentyField: 'nextAction', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.nextAction',
    transform: '日付区切りで分解して「行動履歴」に出す',
    open: '**読むだけ。** 商談 NA とは別物（10-4-1）', removableLegacyDep: null },

  { appField: 'url', twentyField: 'notionLinks', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.notionLinks',
    transform: 'LINKS。primaryLinkUrl',
    open: 'Notion への導線。Notion 廃止後は不要になる可能性', removableLegacyDep: null },

  { appField: 'dom', twentyField: 'domainName', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.domainName',
    transform: 'LINKS。primaryLinkUrl', open: null, removableLegacyDep: null },

  { appField: 'cs（契約状況）', twentyField: 'qiYueZhuangKuang', twentyObject: 'company', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'existing_custom', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Company.qiYueZhuangKuang',
    transform: 'SELECT', open: null, removableLegacyDep: null },

  { appField: 'company.aim（目標追加MRR）', twentyField: null, twentyObject: 'company', legacyStore: 'pga_docs/edits.company.aim',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: 'edits.company.aim を新カスタムフィールド（例 aimMrr, CURRENCY）へ一括移行',
    futureWriteTarget: 'Twenty Company.<aimMrr>',
    transform: '円 → amountMicros（×1e6）',
    open: '**カスタムフィールドの追加が要る。Leevis 承認待ち（Q7）**',
    removableLegacyDep: 'pga_docs/edits.company.aim' },

  { appField: 'company.keyDates（キー日程）', twentyField: null, twentyObject: 'company', legacyStore: 'pga_docs/edits.company.keyDates',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: '決算月・予算策定月・契約更新月をそれぞれカスタムフィールドへ',
    futureWriteTarget: 'Twenty Company.<fiscalEndMonth ほか>',
    transform: null, open: '**カスタムフィールドの追加が要る（Q7）**',
    removableLegacyDep: 'pga_docs/edits.company.keyDates' },
];

// ── Opportunity 系 ───────────────────────────────────────────────────────────

export const OPPORTUNITY_POLICY: FieldPolicy[] = [
  { appField: 'oid', twentyField: 'id', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty（不変）',
    transform: null, open: null, removableLegacyDep: null },

  { appField: 'name（商談名）', twentyField: 'name', twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.name / deals[].name',
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: 'ダッシュボードで追加した商談は Twenty に Opportunity として作成する',
    futureWriteTarget: 'Twenty Opportunity.name',
    transform: '表示時に `PtAI - ` → `Ptengine AI - `', open: null,
    removableLegacyDep: 'pga_docs/edits.deals[]' },

  { appField: 'phase（8段階フェーズ）', twentyField: 'stage', twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.phase',
    sourceOfTruth: 'undecided', capability: 'new_custom_field', migratability: 'needs_decision',
    migrationMethod: '**未確定。** stage を 8 段階に拡張するか、別フィールドで持つか',
    futureWriteTarget: '未確定',
    transform: null,
    open: '**Twenty は 5 段階（NEW/SCREENING/MEETING/PROPOSAL/CUSTOMER）、ダッシュボードは 8 段階。対応は未確定（Q6）。決まるまで変換しない。**',
    removableLegacyDep: 'pga_docs/edits.opp.phase' },

  { appField: 'addMrr（追加MRR実績）', twentyField: 'netMrr', twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.addMrr',
    sourceOfTruth: 'legacy_nocodb', capability: 'standard', migratability: 'needs_decision',
    migrationMethod: 'edits の addMrr を Twenty Opportunity.netMrr へ移す',
    futureWriteTarget: 'Twenty Opportunity.netMrr',
    transform: 'CURRENCY。円 → amountMicros',
    open: '**netMrr と amount が両方存在し、実測でどちらも 49 件中 0 件。** どちらを使うか Twenty 側の運用ルールが要る',
    removableLegacyDep: 'pga_docs/edits.opp.addMrr' },

  { appField: '（amount は未使用）', twentyField: 'amount', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'undecided', capability: 'standard', migratability: 'needs_decision',
    migrationMethod: '—', futureWriteTarget: '未確定',
    transform: null, open: '**存在するが全件空。** netMrr との使い分けが未確定',
    removableLegacyDep: null },

  { appField: 'applyDate（申込完了日）', twentyField: 'closeDate', twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.applyDate',
    sourceOfTruth: 'legacy_nocodb', capability: 'standard', migratability: 'ready',
    migrationMethod: 'edits の applyDate を Twenty Opportunity.closeDate へ移す',
    futureWriteTarget: 'Twenty Opportunity.closeDate',
    transform: 'DATE_TIME。日付部分のみ',
    open: '実測で 49 件中 0 件。Twenty 側に運用が無い',
    removableLegacyDep: 'pga_docs/edits.opp.applyDate' },

  { appField: 'billingDate（課金開始日）', twentyField: null, twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.billingDate',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: '新カスタムフィールド（DATE）へ一括移行',
    futureWriteTarget: 'Twenty Opportunity.<billingStartDate>',
    transform: null, open: '**カスタムフィールドの追加が要る（Q7）**',
    removableLegacyDep: 'pga_docs/edits.opp.billingDate' },

  { appField: 'term（契約期間）', twentyField: null, twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.term',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: '新カスタムフィールド（NUMBER・月数）へ',
    futureWriteTarget: 'Twenty Opportunity.<contractTermMonths>',
    transform: null, open: '**カスタムフィールドの追加が要る（Q7）**',
    removableLegacyDep: 'pga_docs/edits.opp.term' },

  { appField: 'barrier（障壁）', twentyField: null, twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.barrier',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: '新カスタムフィールド（TEXT）へ',
    futureWriteTarget: 'Twenty Opportunity.<barrier>',
    transform: null, open: '**カスタムフィールドの追加が要る（Q7）**',
    removableLegacyDep: 'pga_docs/edits.opp.barrier' },

  { appField: 'na / naDate（商談NA・期限）', twentyField: null, twentyObject: 'task', legacyStore: 'pga_docs/edits.opp.na / naDate',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_object', migratability: 'needs_decision',
    migrationMethod: 'Twenty Task（Opportunity に taskTargets で紐付け、dueAt を期限）として作成',
    futureWriteTarget: 'Twenty Task',
    transform: '完了は Task.status=DONE',
    open: '**Twenty の tasks は実測 0 件で運用実績が無い。** Task を使うか Opportunity のカスタムフィールドにするか未確定（Phase 2A）',
    removableLegacyDep: 'pga_docs/edits.opp.na / naDate / log[]' },

  { appField: 'ms（到達予定）', twentyField: null, twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.ms / msBase',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: 'フェーズ別の予定日を 4 つのカスタムフィールド（DATE）へ。基準は SELECT',
    futureWriteTarget: 'Twenty Opportunity.<msEvaluation ほか 4 つ>',
    transform: null,
    open: '**カスタムフィールドの追加が要る（Q7）。** 8 段階フェーズが未確定なので、フィールド名も確定できない',
    removableLegacyDep: 'pga_docs/edits.opp.ms / msBase' },

  { appField: 'lostReason / lostDetail', twentyField: null, twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.lostReason',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_schema',
    migrationMethod: '新カスタムフィールド（SELECT＋TEXT）へ',
    futureWriteTarget: 'Twenty Opportunity.<lostReason / lostDetail>',
    transform: null, open: '**カスタムフィールドの追加が要る（Q7）**',
    removableLegacyDep: 'pga_docs/edits.opp.lostReason' },

  { appField: 'pendingPhase / approvedAt（承認状態）', twentyField: null, twentyObject: 'opportunity', legacyStore: 'pga_docs/edits.opp.pendingPhase',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_field', migratability: 'needs_decision',
    migrationMethod: '承認待ちフェーズと承認日時をカスタムフィールドへ',
    futureWriteTarget: 'Twenty Opportunity.<pendingStage / approvedAt>',
    transform: null,
    open: '**Twenty の Workflow で承認を実装する案もある。** カスタムフィールドで持つか Workflow にするか未確定',
    removableLegacyDep: 'pga_docs/edits.opp.pendingPhase / approvedAt' },

  { appField: 'need', twentyField: 'needsSummary', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Opportunity.needsSummary',
    transform: null, open: '実測 48/49 件と**よく埋まっている。移行時に上書きしないこと**',
    removableLegacyDep: null },

  { appField: 'src（ニーズの出典）', twentyField: 'sourceInfo', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Opportunity.sourceInfo',
    transform: null, open: null, removableLegacyDep: null },

  { appField: 'pc（窓口）', twentyField: 'pointOfContact', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'ready',
    migrationMethod: '移行不要', futureWriteTarget: 'Twenty Opportunity.pointOfContact（Person リレーション）',
    transform: 'depth=1 で展開。「氏名 / 役職」に連結',
    open: '実測 46/49 件と**よく埋まっている。上書きしないこと**', removableLegacyDep: null },

  { appField: '（会社リレーション）', twentyField: 'company', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'needs_decision',
    migrationMethod: '社名照合の結果をもとに company リレーションを埋める（Phase 2C の候補）',
    futureWriteTarget: 'Twenty Opportunity.company',
    transform: null,
    open: '**`companyId` というフィールドは存在しない。正しくは `company`（RELATION）。実測で 49 件中 0 件。** 埋める作業を移行に含めるか要判断',
    removableLegacyDep: '社名照合フォールバック（OPPORTUNITY_MATCH）' },

  { appField: '（担当リレーション）', twentyField: 'owner', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'needs_decision',
    migrationMethod: 'Notion「担当3」から owner を埋める（Phase 2C の候補）',
    futureWriteTarget: 'Twenty Opportunity.owner',
    transform: null,
    open: '**`ownerId` というフィールドは存在しない。正しくは `owner`（RELATION）。実測で 49 件中 0 件。** Baba / Eri / Kubotie が未登録なので全員は埋められない',
    removableLegacyDep: null },

  { appField: '（商談種別）', twentyField: 'opportunityType', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'twenty', capability: 'standard', migratability: 'needs_decision',
    migrationMethod: 'PtAI は全件アップセルなので EXPANSION を一括設定する案',
    futureWriteTarget: 'Twenty Opportunity.opportunityType',
    transform: null, open: '**実測 0 件。運用の合意が要る。今回は書き込まない**',
    removableLegacyDep: null },

  { appField: '（販売チャネル）', twentyField: 'salesChannel', twentyObject: 'opportunity', legacyStore: null,
    sourceOfTruth: 'undecided', capability: 'standard', migratability: 'needs_decision',
    migrationMethod: '—', futureWriteTarget: '未確定',
    transform: null, open: '**実測 0 件。運用ルール未確定**', removableLegacyDep: null },
];

// ── ダッシュボード固有のデータ（Twenty に受け皿が無いもの）────────────────────

export const DASHBOARD_DATA_POLICY: FieldPolicy[] = [
  { appField: '組織図（orgs）', twentyField: null, twentyObject: 'person', legacyStore: 'pga_docs/orgs',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_object', migratability: 'needs_schema',
    migrationMethod: 'ノードを Twenty Person（会社リレーションつき）にし、決裁者・影響力・スタンス・接触状況はカスタムフィールドへ。上下関係は Person 間のリレーションが要る',
    futureWriteTarget: 'Twenty Person ＋ カスタムフィールド',
    transform: null,
    open: '**Person 間の上下関係を持つリレーションが Twenty にあるか未確認。** 無ければカスタムオブジェクトが要る。グループ／部署ノード（kind=group/dept）の受け皿も要検討',
    removableLegacyDep: 'pga_docs/orgs' },

  { appField: 'サクセスプラン（aplans）', twentyField: null, twentyObject: 'custom', legacyStore: 'pga_docs/aplans',
    sourceOfTruth: 'legacy_nocodb', capability: 'new_custom_object', migratability: 'needs_schema',
    migrationMethod: '四半期ロードマップはカスタムオブジェクト、月／週の Todo は Task へ',
    futureWriteTarget: 'Twenty カスタムオブジェクト ＋ Task',
    transform: null,
    open: '**カスタムオブジェクトの追加が要る。** Task で足りるか、四半期の状態・狙う額を持つ器が要るか未確定',
    removableLegacyDep: 'pga_docs/aplans' },

  { appField: 'AI 生成サマリー（recent）', twentyField: null, twentyObject: null, legacyStore: 'pga_docs/recent',
    sourceOfTruth: 'undecided', capability: 'not_needed', migratability: 'needs_decision',
    migrationMethod: '**移行しない案を推奨。** 再生成できるキャッシュなので、Twenty に保存する必要性は低い',
    futureWriteTarget: 'アプリ側のキャッシュ（Vercel Blob など）。Twenty には保存しない',
    transform: null,
    open: '**Twenty に保存するかどうかの判断が要る。** 保存するなら Note にするのが素直だが、AI 生成物を人の議事録と混ぜてよいか要検討',
    removableLegacyDep: 'pga_docs/recent' },

  { appField: '活動フィード（feed）', twentyField: null, twentyObject: null, legacyStore: 'pga_docs/feed',
    sourceOfTruth: 'undecided', capability: 'not_needed', migratability: 'needs_decision',
    migrationMethod: '**移行しない案を推奨。** Twenty の timelineActivities が同等の役割を持つ',
    futureWriteTarget: 'Twenty の timelineActivities（自動記録）',
    transform: null,
    open: '**Twenty の timelineActivities が UI から読めるか未確認。** 読めるなら feed は不要になる',
    removableLegacyDep: 'pga_docs/feed' },

  { appField: '新規企業（newcos）', twentyField: null, twentyObject: 'company', legacyStore: 'pga_docs/newcos',
    sourceOfTruth: 'legacy_nocodb', capability: 'standard', migratability: 'ready',
    migrationMethod: 'sync.twenty!=done のものを Twenty Company として作成し、以後は newcos を使わない',
    futureWriteTarget: 'Twenty Company（作成時に直接）',
    transform: null,
    open: '**重複作成を防ぐ冪等性が要る**（社名＋ドメインで既存確認）',
    removableLegacyDep: 'pga_docs/newcos、sync.twenty / twentyPending / syncedAt などの同期フラグ一式' },

  { appField: 'チーム目標（settings/targets）', twentyField: null, twentyObject: null, legacyStore: 'pga_docs/settings',
    sourceOfTruth: 'undecided', capability: 'not_needed', migratability: 'needs_decision',
    migrationMethod: '**Twenty に入れない案を推奨。** 顧客データではなくアプリの設定',
    futureWriteTarget: 'Pipeline のアプリ設定（Vercel Blob など）。顧客の業務データではない',
    transform: null,
    open: '**Pipeline の `pga_docs` 依存を外す方針との兼ね合いが要判断。** 顧客の業務データではないので Twenty 集約の対象外にしてよいか',
    removableLegacyDep: null },

  { appField: '旧プランニング（plans）／Chatwork 枠（chatwork）', twentyField: null, twentyObject: null, legacyStore: 'pga_docs/plans, pga_docs/chatwork',
    sourceOfTruth: 'legacy_nocodb', capability: 'not_needed', migratability: 'not_applicable',
    migrationMethod: '**移行しない。** どちらも実データ 0 件の未使用機能',
    futureWriteTarget: 'なし（廃止）',
    transform: null, open: null,
    removableLegacyDep: 'pga_docs/plans, pga_docs/chatwork' },
];

// ── まとめ ───────────────────────────────────────────────────────────────────

export function allPolicies(): FieldPolicy[] {
  return [...COMPANY_POLICY, ...OPPORTUNITY_POLICY, ...DASHBOARD_DATA_POLICY];
}

/** 未確定事項の一覧。ドキュメントと画面の警告に使う */
export function openQuestions(): Array<{ field: string; open: string }> {
  return allPolicies().filter(p => p.open).map(p => ({ field: p.appField, open: p.open as string }));
}

/** Twenty 側で新しい器が要るもの（Phase 2A の承認対象） */
export function schemaChangesNeeded(): FieldPolicy[] {
  return allPolicies().filter(p => p.capability === 'new_custom_field' || p.capability === 'new_custom_object');
}

/**
 * 移行完了後に **PtAI Pipeline から** 消せる旧依存の一覧（Phase 2D のチェックリスト）。
 * ここに並ぶのは Pipeline の業務データの保存先だけで、
 * CXM の NocoDB テーブルや共通認証の `staff_identify` は含まない。
 */
export function removableLegacyDeps(): string[] {
  return [...new Set(allPolicies().map(p => p.removableLegacyDep).filter((x): x is string => !!x))];
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. 紐付け規則
// ═══════════════════════════════════════════════════════════════════════════

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

export const OWNER_NAME_TO_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(OWNER_ENUM_TO_NAME).map(([k, v]) => [v, k]),
);

/** 紐付けがどの方法で決まったか。ViewModel の診断情報に載せる */
export type LinkMethod = 'relation' | 'exact_name' | 'title' | 'unresolved';

/**
 * Opportunity と Company の紐付け。
 * リレーションが入っていればそれを使う。実測で全件空なので、当面は社名照合に落ちる。
 * 移行（Phase 2C）でリレーションを埋めれば、このフォールバックは消せる。
 */
export const OPPORTUNITY_MATCH = {
  relationField: 'company',
  namePrefix: /^(PtAI|Ptengine AI) - /,
  normalize: (s: string): string =>
    (s || '').replace(/株式会社|一般社団法人|（.*?）|\(.*?\)|[\s　]/g, ''),
  /** 部分一致は誤爆しやすいので使わない。完全一致か unresolved にする */
  allowPartial: false,
} as const;

/**
 * Note と会社の紐付け。
 * noteTargets が実測 114 件中 22 件しか無いため、タイトル照合を暫定フォールバックにする。
 */
export const NOTE_MATCH = {
  preferNoteTargets: true,
  titleDatePattern: /^(\d{4}-\d{2}-\d{2})/,
  bodyMaxChars: 1800,
  maxPerCompany: 6,
  /** タイトル照合で使う最短長。短すぎると誤爆する */
  minTitleKeyLength: 2,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 4. 8 段階フェーズ（**変換しない**）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ダッシュボード側のフェーズ（**7 段階＋失注**）。
 * 2026-09-30 に Salesforce の商談フェーズへ合わせて 8 段階から変更された
 * （アーティファクト Version 96）。正本は
 * `src/lib/ptai/twenty-test/schema.ts` の STAGES で、ここはその写し。
 */
export const DASHBOARD_PHASES = [
  'INACTIVE', 'ACTIVE', 'GOAL_SHARED', 'QUALIFIED_CHAMPION', 'EVALUATING',
  'PROBABLE', 'VERBAL', 'WON', 'CLOSED_WON', 'ADMIN_CLOSE', 'CLOSED_LOST',
] as const;

/** 旧キー → 新キー（twenty-test/schema.ts の STAGE_LEGACY・board.js の PH_LEGACY と同じ） */
export const DASHBOARD_PHASE_LEGACY: Record<string, string> = {
  NOT_STARTED: 'INACTIVE', FIRST_MEETING: 'ACTIVE', TRIAL: 'EVALUATING',
  QUOTE: 'PROBABLE', VERBAL_COMMIT: 'VERBAL', APPLICATION: 'WON',
  POC: 'EVALUATING',
  RE_PROPOSAL: 'EVALUATING', EVALUATION: 'EVALUATING', APPROVAL: 'PROBABLE',
};

/** Twenty の stage（実測 5 段階） */
export const TWENTY_STAGES = ['NEW', 'SCREENING', 'MEETING', 'PROPOSAL', 'CUSTOMER'] as const;

/**
 * **対応表は意図的に定義していない。**
 *
 * 既存 Opportunity の stage（5 段階）とダッシュボードのフェーズ（7 段階＋失注）の
 * 対応は未確定（Q6）。なお 2026-09-30 の方針変更で、Pipeline の商談は
 * `testOpportunity` を正本にしたため、既存 Opportunity との対応付けは当面不要。
 * 推測で変換するとフェーズが静かにずれ、KPI と着地見込みが壊れる。
 * 合意ができるまで、アダプターは Twenty の stage を**そのまま持ち回り**、
 * ダッシュボードのフェーズは「未入力」として扱う（原本の「推定しない」方針と同じ）。
 */
export const STAGE_MAPPING_DECIDED = false;

/** stage を 8 段階へ変換しようとしたら落とす。実装の事故防止用 */
export function assertStageMappingNotDecided(): void {
  if (!STAGE_MAPPING_DECIDED) return;
  throw new Error('STAGE_MAPPING_DECIDED を true にするときは、合意した対応表をここに書くこと');
}
