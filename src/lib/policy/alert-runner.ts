// ─── Alert Policy 実行エンジン ─────────────────────────────────────────────────
//
// アクティブな Alert Policy を NocoDB から取得し、企業データに対して評価し、
// 「policy 由来のアラート候補」を返す。
//
// ── 設計方針 ──────────────────────────────────────────────────────────────────
//   1. built-in ロジックとは完全に分離: 既存の health-signal.ts を書き換えない
//   2. 返り値に source='policy:{policyId}' を付与し、built-in と区別できる
//   3. 実際に NocoDB alerts テーブルへの書き込みは行わない（呼び出し側が担当）
//   4. 同じ company_uid + policy_id の組み合わせが既存 alerts に存在すれば
//      dedup_key を返すことで重複防止を助ける
//
// ── 使用例 ───────────────────────────────────────────────────────────────────
//   // POST /api/ops/policies/run から呼び出す
//   const results = await runAlertPolicies({ dryRun: true });
//
// ── 将来拡張 ─────────────────────────────────────────────────────────────────
//   - NOCODB_POLICIES_TABLE_ID 未設定でも、テンプレートを直接評価するモードを追加
//   - support_case / support_queue の object_type 対応

import { listPolicies }                   from '@/lib/nocodb/policy-store';
import { fetchAllCompanies }              from '@/lib/nocodb/companies';
import { fetchBothPhasesByUids }          from '@/lib/nocodb/phases';
import { fetchProjectsByUids }            from '@/lib/nocodb/project-info';
import { fetchLatestCommunicationDatesByUids } from '@/lib/nocodb/communication-logs';
import { fetchSupportCountsByUids }       from '@/lib/nocodb/support-by-company';
import { fetchPeopleSignalsByUids }       from '@/lib/nocodb/people';
import { evaluatePolicy, toFieldValueRecord } from './evaluator';
import type { AlertPolicy, AlertSeverity } from './types';
import type { CompanyFieldValues }         from './evaluator';

// ── 結果型 ────────────────────────────────────────────────────────────────────

export interface PolicyAlertCandidate {
  /** 元の policy_id */
  policy_id:    string;
  policy_name:  string;
  /** 評価対象企業 UID */
  company_uid:  string;
  company_name: string;
  /** 重複防止キー: "<policy_id>:<company_uid>" */
  dedup_key:    string;
  /** テンプレート変数展開済みのタイトル */
  title:        string;
  description:  string;
  severity:     AlertSeverity;
  category_tag: string;
  /** アラートソース。UI や NocoDB への書き込み時に付与する */
  source:       string;               // 'policy:{policy_id}'
  /** マッチした条件の根拠文（人間向け） */
  match_reasons: string[];
  /** フィールド値スナップショット（デバッグ・audit 用） */
  field_snapshot: CompanyFieldValues;
}

export interface RunAlertPoliciesResult {
  dry_run:       boolean;
  evaluated_at:  string;
  policies_count: number;
  companies_count: number;
  candidates:    PolicyAlertCandidate[];
  /** policy ごとのヒット数サマリー */
  policy_summary: { policy_id: string; policy_name: string; hit_count: number }[];
}

// ── テンプレート変数展開 ──────────────────────────────────────────────────────

function expandTemplate(
  template: string,
  vars: { company_name: string; blank_days: number | null; count: number },
): string {
  return template
    .replace('{{company_name}}', vars.company_name)
    .replace('{{blank_days}}',   String(vars.blank_days ?? '?'))
    .replace('{{count}}',        String(vars.count));
}

// ── メイン実行関数 ────────────────────────────────────────────────────────────

export interface RunAlertPoliciesOptions {
  /** true の場合は候補を返すだけで NocoDB への書き込みを行わない（デフォルト true） */
  dryRun?:     boolean;
  /** 評価対象ポリシーを policy_id で絞り込む（省略時は全 active ポリシー） */
  policyIds?:  string[];
  /** 評価対象企業 UID を絞り込む（省略時は全 CSM 管理企業） */
  companyUids?: string[];
  /** 企業取得上限（デフォルト 200） */
  limit?:      number;
}

export async function runAlertPolicies(
  opts: RunAlertPoliciesOptions = {},
): Promise<RunAlertPoliciesResult> {
  const {
    dryRun    = true,
    policyIds,
    companyUids: filterUids,
    limit     = 200,
  } = opts;

  const evaluatedAt = new Date().toISOString();

  // ── Step 1: アクティブな alert policy を取得 ───────────────────────────────
  let policies: Awaited<ReturnType<typeof listPolicies>>;
  try {
    const all = await listPolicies('alert', 200);
    policies = all.filter(p => {
      if (p.status !== 'active') return false;
      if (policyIds && !policyIds.includes(p.policyId)) return false;
      return true;
    });
  } catch {
    // TABLE_ID 未設定等: ポリシーなしで graceful degradation
    policies = [];
  }

  if (policies.length === 0) {
    return {
      dry_run: dryRun, evaluated_at: evaluatedAt,
      policies_count: 0, companies_count: 0,
      candidates: [], policy_summary: [],
    };
  }

  // ── Step 2: 企業データを取得 ──────────────────────────────────────────────
  const companies = await fetchAllCompanies(limit);
  const targets   = filterUids
    ? companies.filter(c => filterUids.includes(c.id))
    : companies;

  if (targets.length === 0) {
    return {
      dry_run: dryRun, evaluated_at: evaluatedAt,
      policies_count: policies.length, companies_count: 0,
      candidates: [], policy_summary: [],
    };
  }

  const allUids = targets.map(c => c.id);

  // ── Step 3: bulk fetch ────────────────────────────────────────────────────
  const [bothPhases, projectMap, commDateMap, supportMap, peopleSignalMap] = await Promise.all([
    fetchBothPhasesByUids(allUids).catch(() => ({
      csmMap: new Map<string, import('@/lib/nocodb/types').AppCsmPhase>(),
      crmMap: new Map<string, import('@/lib/nocodb/types').AppCrmPhase>(),
    })),
    fetchProjectsByUids(allUids).catch(() => new Map<string, import('@/lib/nocodb/types').AppProjectInfo[]>()),
    fetchLatestCommunicationDatesByUids(allUids).catch(() => new Map()),
    fetchSupportCountsByUids(allUids).catch(() => new Map()),
    fetchPeopleSignalsByUids(allUids).catch(() => new Map()),
  ]);
  const { csmMap } = bothPhases;

  // ── Step 4: 各 policy × 各 company を評価 ────────────────────────────────
  const candidates: PolicyAlertCandidate[] = [];
  const policyHitMap = new Map<string, number>();

  for (const pol of policies) {
    const alertPolicy = pol.alertPolicy;
    if (!alertPolicy || alertPolicy.object_type !== 'company') continue;

    policyHitMap.set(pol.policyId, 0);

    for (const company of targets) {
      const uid = company.id;

      const commDate     = commDateMap.get(uid) ?? { latestDate: null, blankDays: null };
      const supportCounts = supportMap.get(uid)  ?? { openCount: 0, waitingCseCount: 0, criticalCount: 0, recentSupportCount: 0 };
      const projList     = projectMap.get(uid)   ?? [];
      const peopleSignal = peopleSignalMap.get(uid);
      const csmPhase     = csmMap.get(uid);

      const activeProjects = projList.filter(p => {
        const s = String(p.status ?? '').toLowerCase();
        return s === 'active' || s === '進行中' || s === 'in_progress';
      }).length;

      const fieldValues: CompanyFieldValues = {
        comm_blank_days:             commDate.blankDays,
        active_project_count:        activeProjects,
        open_critical_support_count: supportCounts.criticalCount,
        open_support_count:          supportCounts.openCount,
        decision_maker_count:        peopleSignal?.dmCount ?? 0,
        overall_health:              null,
        phase_stagnation_days:       null, // PhaseComparisonVM が必要 — bulk run では未計算
        open_alert_count:            company.openAlerts  ?? 0,
        open_action_count:           company.openActions ?? 0,
      };

      const evalResult = evaluatePolicy(alertPolicy as Partial<AlertPolicy>, toFieldValueRecord(fieldValues));
      if (!evalResult.matched) continue;

      policyHitMap.set(pol.policyId, (policyHitMap.get(pol.policyId) ?? 0) + 1);

      const vars = {
        company_name: company.name,
        blank_days:   commDate.blankDays,
        count:        supportCounts.criticalCount,
      };

      const output   = alertPolicy.output ?? { severity: 'medium', title: '', description: '' };
      const severity = (output.severity ?? 'medium') as AlertSeverity;

      candidates.push({
        policy_id:      pol.policyId,
        policy_name:    pol.name,
        company_uid:    uid,
        company_name:   company.name,
        dedup_key:      `${pol.policyId}:${uid}`,
        title:          expandTemplate(output.title ?? '{{company_name}}', vars),
        description:    expandTemplate(output.description ?? '', vars),
        severity,
        category_tag:   output.category_tag ?? '',
        source:         `policy:${pol.policyId}`,
        match_reasons:  evalResult.reasons,
        field_snapshot: fieldValues,
      });
    }
  }

  const policySummary = policies.map(p => ({
    policy_id:   p.policyId,
    policy_name: p.name,
    hit_count:   policyHitMap.get(p.policyId) ?? 0,
  }));

  return {
    dry_run:         dryRun,
    evaluated_at:    evaluatedAt,
    policies_count:  policies.length,
    companies_count: targets.length,
    candidates,
    policy_summary:  policySummary,
  };
}
