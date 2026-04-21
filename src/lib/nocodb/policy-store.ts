// ─── Policies テーブル read/write helpers ─────────────────────────────────────
//
// NocoDB の `policies` テーブルを操作するヘルパー。
// alert / summary の両ポリシーを1テーブルで管理（policy_type で区別）。
//
// ── テーブル設計（NocoDB 管理画面で手動作成が必要）────────────────────────────
//
//  カラム名               型            備考
//  Id                    Number (auto) NocoDB auto
//  policy_id             Text          UUID相当（アプリ側で生成）
//  policy_type           Text          'alert' | 'summary'
//  name                  Text
//  description           Text
//  status                Text          'draft' | 'active' | 'paused'
//  version               Number
//  object_type           Text          alert用: 'company' | 'support_case' | 'support_queue'
//  signal_category       Text          alert用: 'risk' | 'opportunity'
//  scope                 Text          alert用: 'per_entity' | 'aggregate'
//  condition_logic       Text          alert用: 'AND' | 'OR'
//  interpretation_mode   Text          alert用: 'structured_only' | 'ai_assisted' | 'nl_primary'
//  structured_conditions LongText      alert用: JSON string
//  segment_filter        LongText      alert用: JSON string (optional)
//  nl_condition          LongText      alert用: 自然言語意図（参考保存）
//  ai_hint               Text          alert用
//  output                LongText      alert用: JSON string (AlertPolicyOutput)
//  target                Text          summary用: 'company_summary' | 'support_summary'
//  generation_trigger    Text          summary用
//  input_scope           Text          summary用
//  input_recent_days     Number        summary用
//  summary_focus         LongText      summary用
//  output_schema         LongText      summary用: JSON string (OutputSchemaField[])
//  freshness_rule        LongText      summary用: JSON string
//  approval_rule         Text          summary用
//  created_at            DateTime
//  updated_at            DateTime
//
// 環境変数: NOCODB_POLICIES_TABLE_ID

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoUpdate } from './write';
import type { AlertPolicy, SummaryPolicy } from '@/lib/policy/types';

// ── Raw 型（NocoDB カラム名） ─────────────────────────────────────────────────

export interface RawPolicy {
  Id:                   number;
  policy_id:            string;
  policy_type:          'alert' | 'summary';
  name:                 string;
  description?:         string;
  status:               string;
  version:              number;
  // alert fields
  object_type?:         string;
  signal_category?:     string;
  scope?:               string;
  condition_logic?:     string;
  interpretation_mode?: string;
  structured_conditions?: string; // JSON
  segment_filter?:      string;   // JSON
  nl_condition?:        string;
  ai_hint?:             string;
  output?:              string;   // JSON
  // summary fields
  target?:              string;
  generation_trigger?:  string;
  input_scope?:         string;
  input_recent_days?:   number;
  summary_focus?:       string;
  output_schema?:       string;   // JSON
  freshness_rule?:      string;   // JSON
  approval_rule?:       string;
  // timestamps
  created_at?:          string;
  updated_at?:          string;
}

// ── App 型（型安全な変換後） ─────────────────────────────────────────────────

export interface AppPolicy {
  rowId:     number;           // NocoDB internal Id
  policyId:  string;
  policyType: 'alert' | 'summary';
  name:      string;
  description?: string;
  status:    'draft' | 'active' | 'paused';
  version:   number;
  createdAt?: string;
  updatedAt?: string;
  // alert 固有（policyType='alert' 時）
  alertPolicy?: Partial<AlertPolicy>;
  // summary 固有（policyType='summary' 時）
  summaryPolicy?: Partial<SummaryPolicy>;
}

// ── 変換 ─────────────────────────────────────────────────────────────────────

function safeParse<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; }
  catch { return null; }
}

export function toAppPolicy(raw: RawPolicy): AppPolicy {
  const base: AppPolicy = {
    rowId:      raw.Id,
    policyId:   raw.policy_id,
    policyType: raw.policy_type,
    name:       raw.name,
    description: raw.description,
    status:     (raw.status ?? 'draft') as AppPolicy['status'],
    version:    raw.version ?? 1,
    createdAt:  raw.created_at,
    updatedAt:  raw.updated_at,
  };

  if (raw.policy_type === 'alert') {
    base.alertPolicy = {
      id:                    raw.policy_id,
      name:                  raw.name,
      description:           raw.description,
      status:                base.status,
      version:               base.version,
      created_at:            raw.created_at ?? '',
      updated_at:            raw.updated_at ?? '',
      object_type:           (raw.object_type ?? 'company') as AlertPolicy['object_type'],
      signal_category:       (raw.signal_category ?? 'risk') as AlertPolicy['signal_category'],
      scope:                 (raw.scope ?? 'per_entity') as AlertPolicy['scope'],
      condition_logic:       (raw.condition_logic ?? 'AND') as AlertPolicy['condition_logic'],
      interpretation_mode:   (raw.interpretation_mode ?? 'structured_only') as AlertPolicy['interpretation_mode'],
      structured_conditions: safeParse(raw.structured_conditions) ?? [],
      segment_filter:        safeParse(raw.segment_filter) ?? undefined,
      nl_condition:          raw.nl_condition,
      ai_hint:               raw.ai_hint,
      output:                safeParse(raw.output) ?? { severity: 'medium', title: '', description: '' },
    };
  }

  if (raw.policy_type === 'summary') {
    base.summaryPolicy = {
      id:                  raw.policy_id,
      name:                raw.name,
      description:         raw.description,
      status:              base.status,
      version:             base.version,
      created_at:          raw.created_at ?? '',
      updated_at:          raw.updated_at ?? '',
      target:              (raw.target ?? 'company_summary') as SummaryPolicy['target'],
      generation_trigger:  (raw.generation_trigger ?? 'manual') as SummaryPolicy['generation_trigger'],
      input_scope:         (raw.input_scope ?? 'all_evidence') as SummaryPolicy['input_scope'],
      input_recent_days:   raw.input_recent_days,
      summary_focus:       raw.summary_focus ?? '',
      output_schema:       safeParse(raw.output_schema) ?? [],
      freshness_rule:      safeParse(raw.freshness_rule) ?? { stale_after_days: 7, auto_regenerate_on_stale: false },
      approval_rule:       (raw.approval_rule ?? 'require_review') as SummaryPolicy['approval_rule'],
    };
  }

  return base;
}

// ── Write ペイロード型 ────────────────────────────────────────────────────────

export interface PolicyWritePayload {
  policy_id:            string;
  policy_type:          'alert' | 'summary';
  name:                 string;
  description?:         string;
  status:               string;
  version:              number;
  // alert
  object_type?:         string;
  signal_category?:     string;
  scope?:               string;
  condition_logic?:     string;
  interpretation_mode?: string;
  structured_conditions?: string;
  segment_filter?:      string;
  nl_condition?:        string;
  ai_hint?:             string;
  output?:              string;
  // summary
  target?:              string;
  generation_trigger?:  string;
  input_scope?:         string;
  input_recent_days?:   number;
  summary_focus?:       string;
  output_schema?:       string;
  freshness_rule?:      string;
  approval_rule?:       string;
  // timestamps
  created_at:           string;
  updated_at:           string;
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** policies テーブルが設定されているか確認 */
function requireTableId(): string {
  const id = TABLE_IDS.policies;
  if (!id) throw new Error('NOCODB_POLICIES_TABLE_ID が未設定です。NocoDB 管理画面でテーブルを作成後、.env.local に追加してください。');
  return id;
}

/**
 * 全ポリシーを取得する。
 * @param policyType 省略時は全種類、'alert' | 'summary' で絞り込み
 */
export async function listPolicies(
  policyType?: 'alert' | 'summary',
  limit = 200,
): Promise<AppPolicy[]> {
  const tableId = requireTableId();
  const params: Record<string, string> = {
    sort:  '-updated_at',
    limit: String(limit),
  };
  if (policyType) {
    params.where = `(policy_type,eq,${policyType})`;
  }
  const rows = await nocoFetch<RawPolicy>(tableId, params);
  return rows.map(toAppPolicy);
}

/** policy_id で1件取得 */
export async function getPolicyById(policyId: string): Promise<AppPolicy | null> {
  const tableId = requireTableId();
  const rows = await nocoFetch<RawPolicy>(tableId, {
    where: `(policy_id,eq,${policyId})`,
    limit: '1',
  });
  return rows.length > 0 ? toAppPolicy(rows[0]) : null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** 新規ポリシーを作成する */
export async function createPolicy(payload: PolicyWritePayload): Promise<AppPolicy> {
  const tableId = requireTableId();
  const raw = await nocoCreate<RawPolicy>(tableId, payload);
  return toAppPolicy(raw);
}

/** 既存ポリシーを部分更新する（rowId = NocoDB の Id） */
export async function updatePolicy(
  rowId: number,
  patch: Partial<PolicyWritePayload>,
): Promise<void> {
  const tableId = requireTableId();
  await nocoUpdate(tableId, rowId, { ...patch, updated_at: new Date().toISOString() });
}

/** status を変更する */
export async function setPolicyStatus(
  rowId: number,
  status: 'draft' | 'active' | 'paused',
): Promise<void> {
  await updatePolicy(rowId, { status, updated_at: new Date().toISOString() });
}
