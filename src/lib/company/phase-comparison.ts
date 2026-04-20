// ─── Phase Comparison ViewModel ───────────────────────────────────────────────
//
// フェーズ表示ルール（single source of truth）:
//   CS担当（cs_owner）がいる企業 → csm_customer_phase の M-Phase を主表示
//   CS担当がいない企業           → crm_customer_phase の A-Phase を主表示
//
// 差分検出:
//   M-Phase !== A-Phase → hasGap = true → risk signal に昇格
//
// 停滞判定:
//   主フェーズの phase_updated_at が PHASE_STAGNATION_THRESHOLD_DAYS 以上前
//   → isStagnant = true → risk signal に昇格
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { AppCsmPhase, AppCrmPhase } from '@/lib/nocodb/types';
import {
  PHASE_STAGNATION_THRESHOLD_DAYS,
  PHASE_GAP_WARNING,
} from '@/lib/company/badges';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type PhaseSource = 'CSM' | 'CRM';

export interface PhaseRiskSignal {
  type:        'phase_gap' | 'phase_stagnation';
  severity:    'high' | 'medium';
  description: string;
}

/**
 * 1企業のフェーズ比較 ViewModel。
 * UI はこの型だけを参照すればよい（生の Raw 型は不要）。
 */
export interface PhaseComparisonVM {
  /** 主表示に使うソース（CS担当有無で決まる） */
  primarySource:       PhaseSource;

  /** 主フェーズのラベル（例: "Onboarding"） */
  primaryPhaseLabel:   string | null;

  /** 主フェーズの最終更新日時（"YYYY-MM-DD" or "YYYY-MM-DD HH:mm"） */
  primaryUpdatedAt:    string | null;

  /** 主フェーズの担当者名 */
  primaryOwner:        string | null;

  /** 副フェーズのラベル（比較表示用） */
  secondaryPhaseLabel: string | null;

  /** 副フェーズのソース */
  secondarySource:     PhaseSource;

  /**
   * M-Phase と A-Phase の両方が取得できているか（比較可能か）。
   * false の場合（片方が null / テーブル未設定）は hasGap を信頼しないこと。
   */
  isComparable:        boolean;

  /** M-Phase と A-Phase に差分があるか（isComparable=true の場合のみ有効） */
  hasGap:              boolean;

  /** ズレがある場合の説明文（例: "CRM: Active"） */
  gapDescription:      string | null;

  /** 主フェーズが最後に更新されてから何日経過したか（null = 更新日時不明） */
  stagnationDays:      number | null;

  /** PHASE_STAGNATION_THRESHOLD_DAYS 以上変化なし */
  isStagnant:          boolean;

  /** 派生したリスクシグナル（phase_gap / phase_stagnation） */
  riskSignals:         PhaseRiskSignal[];

  /** CRM フェーズから計算した契約終了まで何日か（null = 不明） */
  daysUntilRenewal:    number | null;

  /** 生データ（drill-down 用）*/
  csmPhaseRaw:         AppCsmPhase | null;
  crmPhaseRaw:         AppCrmPhase | null;
}

// ── 日付ユーティリティ ────────────────────────────────────────────────────────

/**
 * "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" 形式の文字列を Date に変換する。
 * パース失敗時は null を返す。
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // スペース区切り → T 区切りに正規化して ISO 8601 として parse
  const normalized = dateStr.trim().replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** 2つの日付の差を「日数」で返す（today - target の絶対値）。 */
function daysSince(dateStr: string | null | undefined): number | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string | null | undefined): number | null {
  const d = parseDate(dateStr);
  if (!d) return null;
  const diffMs = d.getTime() - Date.now();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ── VM 構築 ───────────────────────────────────────────────────────────────────

/**
 * CSM / CRM フェーズから PhaseComparisonVM を構築する。
 *
 * @param csmPhase    CSM_customer_phase レコード（null = 取得不可 or テーブル未設定）
 * @param crmPhase    CRM_customer_phase レコード
 * @param hasAssignedCsm  企業の cs_owner フィールドが空でないか（AppCompany.owner から判断）
 */
export function buildPhaseComparisonVM(
  csmPhase:    AppCsmPhase | null,
  crmPhase:    AppCrmPhase | null,
  hasAssignedCsm:  boolean,
): PhaseComparisonVM {
  // ── 主/副 フェーズの決定 ─────────────────────────────────────────────────
  const primarySource:   PhaseSource = hasAssignedCsm ? 'CSM' : 'CRM';
  const secondarySource: PhaseSource = hasAssignedCsm ? 'CRM' : 'CSM';

  const primaryPhase   = hasAssignedCsm ? csmPhase   : crmPhase;
  const secondaryPhase = hasAssignedCsm ? crmPhase   : csmPhase;

  const primaryPhaseLabel   = primaryPhase?.phaseLabel
                              ?? (hasAssignedCsm ? csmPhase?.mPhase : crmPhase?.aPhase)
                              ?? null;
  const secondaryPhaseLabel = secondaryPhase?.phaseLabel
                              ?? (hasAssignedCsm ? crmPhase?.aPhase : csmPhase?.mPhase)
                              ?? null;

  // ── ズレ判定 ──────────────────────────────────────────────────────────────
  const mPhaseLabel = csmPhase?.mPhase ?? csmPhase?.phaseLabel ?? null;
  const aPhaseLabel = crmPhase?.aPhase ?? crmPhase?.phaseLabel ?? null;

  // 両方のフェーズが取得できている場合のみ比較可能
  const isComparable = mPhaseLabel !== null && aPhaseLabel !== null;

  // 比較可能かつ値が異なる場合のみ gap あり
  const hasGap = isComparable && mPhaseLabel !== aPhaseLabel;

  const gapDescription = hasGap
    ? `${secondarySource}: ${secondaryPhaseLabel}`
    : null;

  // ── 停滞判定 ──────────────────────────────────────────────────────────────
  const stagnationDays = daysSince(primaryPhase?.phaseUpdatedAt);
  const isStagnant     =
    stagnationDays !== null &&
    stagnationDays >= PHASE_STAGNATION_THRESHOLD_DAYS;

  // ── リスクシグナル ────────────────────────────────────────────────────────
  const riskSignals: PhaseRiskSignal[] = [];

  if (hasGap) {
    riskSignals.push({
      type:        'phase_gap',
      severity:    'medium',
      description: `${PHASE_GAP_WARNING}: M-Phase=${mPhaseLabel} / A-Phase=${aPhaseLabel}`,
    });
  }

  if (isStagnant) {
    riskSignals.push({
      type:        'phase_stagnation',
      severity:    stagnationDays! >= 180 ? 'high' : 'medium',
      description: `フェーズが ${stagnationDays}日間 変化していません（閾値: ${PHASE_STAGNATION_THRESHOLD_DAYS}日）`,
    });
  }

  // ── 更新余裕日数 ─────────────────────────────────────────────────────────
  const daysUntilRenewal = daysUntil(crmPhase?.contractEndDate);

  return {
    primarySource,
    primaryPhaseLabel,
    primaryUpdatedAt:    primaryPhase?.phaseUpdatedAt    ?? null,
    primaryOwner:        hasAssignedCsm
                           ? csmPhase?.csOwner   ?? null
                           : crmPhase?.crmOwner  ?? null,
    secondaryPhaseLabel,
    secondarySource,
    isComparable,
    hasGap,
    gapDescription,
    stagnationDays,
    isStagnant,
    riskSignals,
    daysUntilRenewal,
    csmPhaseRaw:   csmPhase,
    crmPhaseRaw:   crmPhase,
  };
}

// ── ユーティリティ ─────────────────────────────────────────────────────────────

/** companies.owner_name が空でないかを判定するヘルパー */
export function hasAssignedCsm(ownerName: string | null | undefined): boolean {
  return Boolean(ownerName && String(ownerName).trim() !== '—' && String(ownerName).trim() !== '');
}

/** PhaseComparisonVM の primaryPhaseLabel を "短縮 + ソース" 形式で返す */
export function formatPhaseBadgeText(vm: PhaseComparisonVM): string {
  const label = vm.primaryPhaseLabel ?? '—';
  const source = vm.primarySource === 'CSM' ? 'M' : 'A';
  return `${label} (${source})`;
}
