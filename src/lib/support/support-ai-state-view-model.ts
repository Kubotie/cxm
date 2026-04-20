// ─── support_case_ai_state ViewModel ──────────────────────────────────────────
// AI state record を Detail / Queue / Home で使いやすい ViewModel に変換する。
//
// 設計方針:
//   - 文字列フィールドはすべて non-nullable（null / undefined は "" に変換）
//   - enum フィールドは定義済み fallback 値を保証（null は使わない）
//   - UI コンポーネントは型安全に `vm.severity` 等をそのまま使えばよい
//
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。

import type { SupportCaseAiStateRecord } from '@/lib/nocodb/support-ai-state-types';
import type {
  SupportCaseAiSeverity,
  SupportCaseAiPriority,
  SupportCaseAiRoutingStatus,
  SupportCaseAiEscalationTarget,
  SupportCaseAiHumanReviewStatus,
} from '@/lib/nocodb/support-ai-state-types';
import {
  getSimilarCaseIds,
  getSafeAiSummary,
  getSafeTriageNote,
  getSafeSuggestedAction,
  getSafeDraftReply,
} from './support-ai-state-reader';

// ── ViewModel 型 ──────────────────────────────────────────────────────────────

export interface SupportCaseAiViewModel {
  // ── AI テキスト系（非 null 保証） ────────────────────────────────────────
  /** AI 生成サマリー。未生成 → "" */
  summary:          string;
  /** トリアージノート。未生成 → "" */
  triageNote:       string;
  /** 推奨アクション。未生成 → "" */
  suggestedAction:  string;
  /** 下書き返信。未生成 → "" */
  draftReply:       string;

  // ── 分類・優先度（enum fallback 保証） ───────────────────────────────────
  severity:         SupportCaseAiSeverity;
  priority:         SupportCaseAiPriority;
  routingStatus:    SupportCaseAiRoutingStatus;

  // ── エスカレーション ──────────────────────────────────────────────────────
  escalationNeeded: boolean;
  escalationReason: string;         // "" when not applicable
  escalationTarget: SupportCaseAiEscalationTarget | null;

  // ── 人手レビュー ──────────────────────────────────────────────────────────
  humanReviewStatus: SupportCaseAiHumanReviewStatus;
  reviewedBy:        string | null;
  reviewedAt:        string | null;

  // ── タイムスタンプ ────────────────────────────────────────────────────────
  lastAiUpdatedAt:  string | null;

  // ── 関連 Case IDs ─────────────────────────────────────────────────────────
  similarCaseIds:   string[];

  // ── meta ──────────────────────────────────────────────────────────────────
  /** AI state がロード済みかどうか */
  hasAiState:       boolean;
  /** AI version 文字列（未設定 → null） */
  aiVersion:        string | null;
}

// ── ViewModel デフォルト（AI state がない場合） ───────────────────────────────

export const EMPTY_AI_VIEW_MODEL: SupportCaseAiViewModel = {
  summary:           '',
  triageNote:        '',
  suggestedAction:   '',
  draftReply:        '',
  severity:          'medium',
  priority:          'normal',
  routingStatus:     'new',
  escalationNeeded:  false,
  escalationReason:  '',
  escalationTarget:  null,
  humanReviewStatus: 'pending',
  reviewedBy:        null,
  reviewedAt:        null,
  lastAiUpdatedAt:   null,
  similarCaseIds:    [],
  hasAiState:        false,
  aiVersion:         null,
};

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * SupportCaseAiStateRecord → SupportCaseAiViewModel
 *
 * record が null の場合は EMPTY_AI_VIEW_MODEL を返す。
 * UI は `vm.hasAiState` で AI state の有無を判定する。
 *
 * @example
 * const aiVm = buildSupportCaseAiViewModel(aiRecord);
 * if (aiVm.hasAiState) { ... }
 */
export function buildSupportCaseAiViewModel(
  record: SupportCaseAiStateRecord | null | undefined,
): SupportCaseAiViewModel {
  if (!record) return EMPTY_AI_VIEW_MODEL;

  return {
    // テキスト系 — safe getters が null/空文字を "" に変換
    summary:          getSafeAiSummary(record),
    triageNote:       getSafeTriageNote(record),
    suggestedAction:  getSafeSuggestedAction(record),
    draftReply:       getSafeDraftReply(record),

    // enum 系 — record は toSupportCaseAiStateRecord 変換済みで fallback 済みのはずだが
    // ViewModel 層でも fallback を明示することで型安全を二重保証する
    severity:         record.severity         ?? 'medium',
    priority:         record.priority         ?? 'normal',
    routingStatus:    record.routingStatus     ?? 'triage',
    escalationNeeded: record.escalationNeeded  ?? false,
    escalationReason: record.escalationReason  ?? '',
    escalationTarget: record.escalationTarget  ?? null,
    humanReviewStatus: record.humanReviewStatus ?? 'pending',

    reviewedBy:       record.reviewedBy        ?? null,
    reviewedAt:       record.reviewedAt        ?? null,
    lastAiUpdatedAt:  record.lastAiUpdatedAt   ?? null,
    similarCaseIds:   getSimilarCaseIds(record),

    hasAiState:       true,
    aiVersion:        record.aiVersion         ?? null,
  };
}
