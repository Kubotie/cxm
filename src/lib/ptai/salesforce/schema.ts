// ─── PtAI Pipeline × Salesforce の対応表（Next 非依存）──────────────────────
//
// 出典: 2026-10-01 に Salesforce から実測した設定
//   OpportunityStage（IsActive = true の 12 件）
//   Opportunity の describe（103 項目・うちカスタム 59）
//
// ═══════════════════════════════════════════════════════════════════════════
//  決めごと（2026-10-01）
//
//  ・**フェーズは Salesforce に準拠する。** 確率も Salesforce の
//    `DefaultProbability` をそのまま使い、ダッシュボード独自の
//    0/10/30/55/80/95/100 は使わない。
//  ・**確定（受注）は `受注 (Closed Won)` だけ。** `Won` は 100% だが
//    `IsWon = false`・未クローズで、「ほぼ決まり」止まり。
//  ・**金額は Salesforce でしか入らない。** `Opportunity.Amount` は
//    作成不可・更新不可（明細からのロールアップ）。こちらは読むだけ。
// ═══════════════════════════════════════════════════════════════════════════

/** Salesforce の有効なステージ（SortOrder 順。2026-10-01 実測） */
export const SF_STAGES = [
  { name: 'Inactive',           order: 1,  probability: 0,   isWon: false, isClosed: false, forecast: 'Omitted' },
  { name: 'Active',             order: 2,  probability: 0,   isWon: false, isClosed: false, forecast: 'Pipeline' },
  { name: 'Goal Shared',        order: 3,  probability: 10,  isWon: false, isClosed: false, forecast: 'Pipeline' },
  { name: 'POC',                order: 4,  probability: 20,  isWon: false, isClosed: false, forecast: 'Pipeline' },
  { name: 'Qualified Champion', order: 5,  probability: 30,  isWon: false, isClosed: false, forecast: 'Pipeline' },
  { name: 'Evaluating',         order: 6,  probability: 40,  isWon: false, isClosed: false, forecast: 'Pipeline' },
  { name: 'Probable',           order: 7,  probability: 60,  isWon: false, isClosed: false, forecast: 'Best Case' },
  { name: 'Verbal',             order: 8,  probability: 90,  isWon: false, isClosed: false, forecast: 'Commit' },
  { name: 'Won',                order: 9,  probability: 100, isWon: false, isClosed: false, forecast: 'Commit' },
  { name: '受注 (Closed Won)',   order: 10, probability: 100, isWon: true,  isClosed: true,  forecast: 'Closed' },
  { name: 'Admin Close',        order: 11, probability: 0,   isWon: false, isClosed: true,  forecast: 'Omitted' },
  { name: 'Close Lost',         order: 12, probability: 0,   isWon: false, isClosed: true,  forecast: 'Omitted' },
] as const;

export type SfStageName = (typeof SF_STAGES)[number]['name'];

const BY_NAME = new Map(SF_STAGES.map(s => [s.name, s]));

export function sfStage(name: string | null | undefined) {
  return BY_NAME.get(String(name ?? '') as SfStageName) ?? null;
}

/** 画面に出す確率。知らないステージは 0 として扱う（勝手に推定しない） */
export function sfProbability(name: string | null | undefined): number {
  return sfStage(name)?.probability ?? 0;
}

/** 確定（受注）か。`Won` は含めない */
export function isSfWon(name: string | null | undefined): boolean {
  return sfStage(name)?.isWon === true;
}

/** 失注か。`Admin Close` は「閉じたが失注ではない」ので分ける */
export function isSfLost(name: string | null | undefined): boolean {
  return String(name ?? '') === 'Close Lost';
}

export function isSfClosed(name: string | null | undefined): boolean {
  return sfStage(name)?.isClosed === true;
}

// ── PtAI の商談を見分ける ───────────────────────────────────────────────────
//
// 2026-10-01 の決定: **商談名に次のどれかを入れる**運用にする。
// Salesforce 側に PtAI 専用の製品カテゴリーも RecordType も無いため
// （ProductLine__c は Insight / Experience / Other_CN / PTI&PTX Bundle / Service）。
//
// ⚠ SOQL の LIKE は **元から大文字小文字を区別しない**ので、
//    表記ゆれは 3 つのパターンを並べるだけでよい。
// ⚠ 'PtAI' は 'Ptengine AI'（間に空白）にも 'PtengineAI' にも含まれないので、
//    1 つにまとめられない。

export const PTAI_NAME_PATTERNS = ['PtAI', 'Ptengine AI', 'PtengineAI'] as const;

/** 商談名が PtAI のものか（画面・テスト用。SOQL と同じ規則） */
export function isPtaiOpportunityName(name: string | null | undefined): boolean {
  const n = String(name ?? '').toLowerCase();
  return PTAI_NAME_PATTERNS.some(p => n.includes(p.toLowerCase()));
}

/** SOQL の WHERE 句。`Name` だけを見る（説明欄は見ない） */
export function ptaiNameFilter(): string {
  return PTAI_NAME_PATTERNS.map(p => `Name LIKE '%${p}%'`).join(' OR ');
}

// ── 読み取る項目 ────────────────────────────────────────────────────────────
//
// すべて**読むだけ**。書き戻しは別途決める。
// 金額系は Opportunity 側が作成不可・更新不可（明細からのロールアップ）。

export const SF_OPPORTUNITY_FIELDS = [
  'Id', 'Name', 'AccountId', 'StageName', 'CloseDate', 'Amount', 'Probability',
  'IsClosed', 'IsWon', 'OwnerId', 'CreatedDate', 'LastModifiedDate',
  // カスタム項目（2026-10-01 実測）
  'JP_MRR__c',              // 見込MRR
  'MRR__c',                 // MRR
  'Net_MRR__c',             // NetGain MRR
  'ContractTerm__c',        // 契約期間（月）
  'Indentify_Pain_Needs__c', // Needs（ダッシュボードの need に対応）
  'Dead_Detail_Reason__c',  // 失注理由詳細
  'MRR_To_Count__c',        // MRR 計上判定
] as const;

export interface SfOpportunity {
  id: string;
  name: string;
  accountId: string | null;
  stage: string;
  probability: number;
  closeDate: string | null;
  /** 明細からのロールアップ。ダッシュボードからは書けない */
  amount: number | null;
  /** 見込MRR */
  jpMrr: number | null;
  netMrr: number | null;
  termMonths: number | null;
  needs: string | null;
  lostDetail: string | null;
  isWon: boolean;
  isClosed: boolean;
  updatedAt: string;
}
