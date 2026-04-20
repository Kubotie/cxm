// ─── SF 実接続前データ整備レポート ────────────────────────────────────────────
//
// Salesforce 接続前に CXM 側のデータ品質を診断し、整備が必要な箇所を洗い出す。
//
// ── 検査内容 ─────────────────────────────────────────────────────────────────
//   1. sf_account_id 未設定 company
//   2. company_people フィールド品質（email / decision_influence / last_touchpoint / owner / manager_id）
//   3. company_actions の owner が email 形式でない
//   4. Contact 名寄せ競合候補（同一 email / 類似 name / SF+CXM 重複）
//
// ── データ取得戦略 ────────────────────────────────────────────────────────────
//   - fetchAllCompanies(200)     : CSM管理企業一覧
//   - nocoFetch(company_people)  : 全 company_people を一括取得 → company_uid でグループ化
//   - nocoFetch(company_actions) : 全 company_actions を一括取得 → company_uid でグループ化

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { fetchAllCompanies }    from '@/lib/nocodb/companies';
import type { RawCompanyPerson, RawCompanyAction } from '@/lib/nocodb/types';

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface PeopleQualityMetrics {
  total:         number;
  noEmail:       number;
  noInfluence:   number;   // decision_influence が null / 'unknown'
  noTouchpoint:  number;   // last_touchpoint が null
  noOwner:       number;   // owner が null / 空
  noManagerId:   number;   // manager_id が null（全員 top-level の場合は 0 が正常）
  hasIssue:      boolean;
}

export interface ActionOwnerIssue {
  actionId: string;
  title:    string;
  owner:    string;
}

export type ConflictType = 'duplicate_email' | 'sf_cxm_same_email' | 'similar_name';

export interface ConflictPerson {
  name:      string;
  source:    string;    // 'salesforce' | 'cxm' | 'unknown'
  email?:    string;
  personId?: string;
}

export interface ConflictCandidate {
  type:    ConflictType;
  persons: ConflictPerson[];
  detail:  string;
}

export interface CompanyDataPrepItem {
  companyUid:         string;
  name:               string;
  sfCompanyId:        string | null;
  peopleQuality:      PeopleQualityMetrics;
  actionOwnerIssues:  ActionOwnerIssue[];
  conflictCandidates: ConflictCandidate[];
  /** 問題の重み付きスコア（ソート用） */
  issueScore:         number;
}

export interface SfDataPrepReport {
  generatedAt:                  string;
  totalCompanies:               number;
  missingSfId:                  number;
  companiesWithPeopleIssues:    number;
  totalActionOwnerIssues:       number;
  totalConflictCandidates:      number;
  items:                        CompanyDataPrepItem[];
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function isEmailFormat(value: string): boolean {
  return value.includes('@') && value.includes('.') && !value.includes(' ');
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

// ── People 品質メトリクス ─────────────────────────────────────────────────────

function computePeopleQuality(persons: RawCompanyPerson[]): PeopleQualityMetrics {
  if (persons.length === 0) {
    return { total: 0, noEmail: 0, noInfluence: 0, noTouchpoint: 0, noOwner: 0, noManagerId: 0, hasIssue: false };
  }
  const noEmail      = persons.filter(p => !p.email?.trim()).length;
  const noInfluence  = persons.filter(p => !p.decision_influence || p.decision_influence === 'unknown').length;
  const noTouchpoint = persons.filter(p => !p.last_touchpoint).length;
  const noOwner      = persons.filter(p => !p.owner?.trim()).length;
  const noManagerId  = persons.filter(p => !p.manager_id?.trim()).length;
  // manager_id は全員 top-level ならば全員 null でも問題ないケースがある。
  // ただし 2名以上いて全員 manager_id なしは構造未整備と判断する
  const managerIdIssue = persons.length >= 2 ? noManagerId : 0;

  const hasIssue = noEmail > 0 || noInfluence > 0 || noTouchpoint > 0 || noOwner > 0 || managerIdIssue > 0;
  return { total: persons.length, noEmail, noInfluence, noTouchpoint, noOwner, noManagerId, hasIssue };
}

// ── Action Owner 問題検出 ─────────────────────────────────────────────────────

function detectActionOwnerIssues(actions: RawCompanyAction[]): ActionOwnerIssue[] {
  const issues: ActionOwnerIssue[] = [];
  for (const a of actions) {
    const owner = a.owner?.trim();
    // owner が設定されているが email 形式でない場合のみ問題とする
    if (owner && !isEmailFormat(owner)) {
      issues.push({
        actionId: a.action_id ?? String(a.Id),
        title:    a.title?.trim() ?? '(タイトルなし)',
        owner,
      });
    }
  }
  return issues;
}

// ── Contact 競合候補検出 ──────────────────────────────────────────────────────

function detectConflictCandidates(persons: RawCompanyPerson[]): ConflictCandidate[] {
  const candidates: ConflictCandidate[] = [];

  // ─ 1. 同一 email（完全一致）─────────────────────────────────────────────
  const byEmail = new Map<string, RawCompanyPerson[]>();
  for (const p of persons) {
    const email = p.email?.trim().toLowerCase();
    if (!email) continue;
    const bucket = byEmail.get(email) ?? [];
    bucket.push(p);
    byEmail.set(email, bucket);
  }
  for (const [email, group] of byEmail) {
    if (group.length < 2) continue;
    // SF/CXM 混在かどうかで type を分ける
    const sources = group.map(p => p.source ?? 'unknown');
    const hasSf  = sources.includes('salesforce');
    const hasCxm = sources.includes('cxm') || sources.includes('unknown');
    candidates.push({
      type:    hasSf && hasCxm ? 'sf_cxm_same_email' : 'duplicate_email',
      persons: group.map(p => ({
        name:     p.name?.trim() ?? '(名前なし)',
        source:   p.source ?? 'unknown',
        email:    p.email?.trim(),
        personId: p.person_id ?? undefined,
      })),
      detail: `同一 email '${email}' が ${group.length} レコードに存在`,
    });
  }

  // ─ 2. 類似 name（正規化後一致、email が異なるケース）────────────────────
  const byNormName = new Map<string, RawCompanyPerson[]>();
  for (const p of persons) {
    const name = p.name?.trim();
    if (!name) continue;
    const key = normalizeName(name);
    if (!key) continue;
    const bucket = byNormName.get(key) ?? [];
    bucket.push(p);
    byNormName.set(key, bucket);
  }
  for (const [normName, group] of byNormName) {
    if (group.length < 2) continue;
    // 全員が同一 email ならば上の重複検出で既にカバー済み
    const emails = new Set(group.map(p => p.email?.trim().toLowerCase()).filter(Boolean));
    if (emails.size <= 1 && group.every(p => p.email?.trim())) continue;  // 全員同一 email → 上で検出済み
    candidates.push({
      type:    'similar_name',
      persons: group.map(p => ({
        name:     p.name?.trim() ?? '(名前なし)',
        source:   p.source ?? 'unknown',
        email:    p.email?.trim(),
        personId: p.person_id ?? undefined,
      })),
      detail: `正規化名 '${normName}' が ${group.length} レコードに存在`,
    });
  }

  return candidates;
}

// ── issueScore 計算 ───────────────────────────────────────────────────────────
//
// 問題ごとの重み:
//   sf_account_id なし:   10
//   email 未設定 (人数):   3 / person
//   influence 未分類:      2 / person
//   action owner 問題:     5 / action
//   conflict 候補:         8 / conflict

function calcIssueScore(item: Omit<CompanyDataPrepItem, 'issueScore'>): number {
  let score = 0;
  if (!item.sfCompanyId)             score += 10;
  score += item.peopleQuality.noEmail     * 3;
  score += item.peopleQuality.noInfluence * 2;
  score += item.actionOwnerIssues.length  * 5;
  score += item.conflictCandidates.length * 8;
  return score;
}

// ── レポート生成 ──────────────────────────────────────────────────────────────

export async function generateSfDataPrepReport(): Promise<SfDataPrepReport> {
  const generatedAt = new Date().toISOString();

  // ─ 企業一覧取得 ──────────────────────────────────────────────────────────
  const companies = await fetchAllCompanies(200);

  // ─ company_people 全件取得 ────────────────────────────────────────────────
  const allPeople: RawCompanyPerson[] = TABLE_IDS.company_people
    ? await nocoFetch<RawCompanyPerson>(TABLE_IDS.company_people, {
        limit: '1000',
        sort:  'company_uid',
      }).catch(() => [])
    : [];

  // ─ company_actions 全件取得（cancelled を除く）────────────────────────────
  const allActions: RawCompanyAction[] = TABLE_IDS.company_actions
    ? await nocoFetch<RawCompanyAction>(TABLE_IDS.company_actions, {
        where: '(status,neq,cancelled)',
        limit: '2000',
        sort:  'company_uid',
      }).catch(() => [])
    : [];

  // ─ company_uid でグループ化 ───────────────────────────────────────────────
  const peopleByCompany  = new Map<string, RawCompanyPerson[]>();
  const actionsByCompany = new Map<string, RawCompanyAction[]>();

  for (const p of allPeople) {
    const uid = p.company_uid?.trim();
    if (!uid) continue;
    const bucket = peopleByCompany.get(uid) ?? [];
    bucket.push(p);
    peopleByCompany.set(uid, bucket);
  }
  for (const a of allActions) {
    const uid = a.company_uid?.trim();
    if (!uid) continue;
    const bucket = actionsByCompany.get(uid) ?? [];
    bucket.push(a);
    actionsByCompany.set(uid, bucket);
  }

  // ─ 各企業のレポートアイテム生成 ──────────────────────────────────────────
  const items: CompanyDataPrepItem[] = companies.map(company => {
    const persons = peopleByCompany.get(company.id)  ?? [];
    const actions = actionsByCompany.get(company.id) ?? [];

    const partial: Omit<CompanyDataPrepItem, 'issueScore'> = {
      companyUid:         company.id,
      name:               company.name,
      sfCompanyId:        company.sfAccountId,
      peopleQuality:      computePeopleQuality(persons),
      actionOwnerIssues:  detectActionOwnerIssues(actions),
      conflictCandidates: detectConflictCandidates(persons),
    };

    return { ...partial, issueScore: calcIssueScore(partial) };
  });

  // issueScore 降順ソート
  items.sort((a, b) => b.issueScore - a.issueScore);

  // ─ サマリー集計 ───────────────────────────────────────────────────────────
  const missingSfId                = items.filter(i => !i.sfCompanyId).length;
  const companiesWithPeopleIssues  = items.filter(i => i.peopleQuality.hasIssue).length;
  const totalActionOwnerIssues     = items.reduce((s, i) => s + i.actionOwnerIssues.length, 0);
  const totalConflictCandidates    = items.reduce((s, i) => s + i.conflictCandidates.length, 0);

  return {
    generatedAt,
    totalCompanies:            companies.length,
    missingSfId,
    companiesWithPeopleIssues,
    totalActionOwnerIssues,
    totalConflictCandidates,
    items,
  };
}
