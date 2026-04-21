// ─── Policy 条件評価エンジン ────────────────────────────────────────────────────
//
// AlertPolicy の structured_conditions を entity のフィールド値に対して評価する。
// サーバーサイド・クライアントサイド共用可。

import { ALERT_CONDITION_FIELDS } from './templates';
import type {
  AlertPolicy,
  StructuredCondition,
  ConditionOperator,
} from './types';

// ── 評価結果型 ─────────────────────────────────────────────────────────────────

export interface ConditionEvalResult {
  condition:  StructuredCondition;
  matched:    boolean;
  /** 実際のフィールド値（デバッグ・表示用） */
  actualValue: unknown;
  /** 人間が読める根拠文（日本語） */
  reason:     string;
}

export interface PolicyEvalResult {
  matched:              boolean;
  matchedConditions:    ConditionEvalResult[];
  /** UI 表示用: マッチした条件の要約（AND/OR ロジック適用後） */
  reasons:              string[];
}

// ── フィールドラベル取得 ───────────────────────────────────────────────────────

function getFieldLabel(field: string): string {
  return ALERT_CONDITION_FIELDS[field]?.label ?? field;
}

// ── 演算子ごとの評価 ──────────────────────────────────────────────────────────

function evalOperator(
  op:     ConditionOperator,
  actual: unknown,
  expected: StructuredCondition["value"],
): boolean {
  // null / undefined は特殊演算子以外は false
  if (op === 'is_null')     return actual === null || actual === undefined;
  if (op === 'is_not_null') return actual !== null && actual !== undefined;
  if (actual === null || actual === undefined) return false;

  const a = actual;
  const e = expected;

  switch (op) {
    case 'gt':           return (a as number)  >  (e as number);
    case 'gte':          return (a as number)  >= (e as number);
    case 'lt':           return (a as number)  <  (e as number);
    case 'lte':          return (a as number)  <= (e as number);
    case 'eq':           return String(a) === String(e ?? '');
    case 'neq':          return String(a) !== String(e ?? '');
    case 'in': {
      const arr = Array.isArray(e) ? e : String(e ?? '').split(',').map(s => s.trim());
      return arr.includes(String(a));
    }
    case 'not_in': {
      const arr = Array.isArray(e) ? e : String(e ?? '').split(',').map(s => s.trim());
      return !arr.includes(String(a));
    }
    case 'contains':     return String(a).includes(String(e ?? ''));
    case 'not_contains': return !String(a).includes(String(e ?? ''));
    case 'regex': {
      try { return new RegExp(String(e ?? '')).test(String(a)); }
      catch { return false; }
    }
    default: return false;
  }
}

// ── 演算子の日本語表現 ────────────────────────────────────────────────────────

const OP_LABELS: Record<ConditionOperator, string> = {
  gt:           '>',
  gte:          '≥',
  lt:           '<',
  lte:          '≤',
  eq:           '=',
  neq:          '≠',
  in:           'いずれか',
  not_in:       '含まない',
  contains:     '含む',
  not_contains: '含まない',
  is_null:      'が未設定',
  is_not_null:  'が設定済み',
  regex:        'にマッチ',
};

// ── 人間が読める根拠文を生成 ──────────────────────────────────────────────────

function buildReason(c: StructuredCondition, actualValue: unknown): string {
  const label    = getFieldLabel(c.field);
  const opLabel  = OP_LABELS[c.operator] ?? c.operator;

  if (c.operator === 'is_null' || c.operator === 'is_not_null') {
    return `${label}${opLabel}`;
  }

  // 実値を分かりやすく整形
  const actualStr = actualValue !== null && actualValue !== undefined
    ? String(actualValue)
    : '(未設定)';

  return `${label}: ${actualStr} (条件: ${opLabel} ${c.value})`;
}

// ── 単一条件を評価 ────────────────────────────────────────────────────────────

export function evaluateCondition(
  condition:   StructuredCondition,
  fieldValues: Record<string, unknown>,
): ConditionEvalResult {
  const actualValue = fieldValues[condition.field] ?? null;
  const matched     = evalOperator(condition.operator, actualValue, condition.value);
  return {
    condition,
    matched,
    actualValue,
    reason: buildReason(condition, actualValue),
  };
}

// ── ポリシー全体を評価 ────────────────────────────────────────────────────────

/**
 * AlertPolicy の structured_conditions を fieldValues に対して評価する。
 * condition_logic: 'AND' = 全条件を満たす、'OR' = いずれかを満たす。
 */
export function evaluatePolicy(
  policy:      Partial<AlertPolicy>,
  fieldValues: Record<string, unknown>,
): PolicyEvalResult {
  const conditions = policy.structured_conditions ?? [];
  const logic      = policy.condition_logic ?? 'AND';

  if (conditions.length === 0) {
    return { matched: false, matchedConditions: [], reasons: [] };
  }

  const results = conditions.map(c => evaluateCondition(c, fieldValues));
  const matched  = logic === 'AND'
    ? results.every(r => r.matched)
    : results.some(r => r.matched);

  const matchedConditions = matched
    ? results.filter(r => r.matched)
    : [];

  const reasons = matchedConditions.map(r => r.reason);

  return { matched, matchedConditions, reasons };
}

// ── フィールド値スナップショット型 ───────────────────────────────────────────

/** company object_type のフィールド値セット */
export interface CompanyFieldValues {
  comm_blank_days:              number | null;
  active_project_count:         number;
  open_critical_support_count:  number;
  open_support_count:           number;
  decision_maker_count:         number;
  overall_health:               string | null;
  phase_stagnation_days:        number | null;
  open_alert_count:             number;
  open_action_count:            number;
}

/** CompanyFieldValues を evaluator が使う Record<string, unknown> に変換 */
export function toFieldValueRecord(
  values: CompanyFieldValues,
): Record<string, unknown> {
  return values as unknown as Record<string, unknown>;
}
