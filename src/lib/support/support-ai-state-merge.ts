// ─── case data × AI state merge ───────────────────────────────────────────────
// QueueItem（ケース本体）と SupportCaseAiViewModel（AI 派生状態）を合成する。
//
// ── 責務境界 ───────────────────────────────────────────────────────────────
//   source*     NocoDB DB の原値。QueueItem のフィールドがそのまま source 値。
//   ai*         AI が判定した値。SupportCaseAiViewModel のフィールド。
//   effective*  UI / 運用上で実際に使う値。resolveEffectiveState() が決定する。
//
// ルール:
//   - ケース本体の source 情報（id / title / company / source 等）は上書きしない
//   - AI 由来で UI に反映させたいフィールドのみマージする
//   - AI state がない場合（vm.hasAiState === false）は元の QueueItem をそのまま返す
//   - effective 値の採用ルールは getSupportCaseAiAdoptionPolicy() が管理する
//
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。

import type { QueueItem } from './queue-adapter';
import type { SupportCaseAiViewModel } from './support-ai-state-view-model';
import { EMPTY_AI_VIEW_MODEL } from './support-ai-state-view-model';
import { getSupportCaseAiAdoptionPolicy } from './support-ai-state-policy';

// ── Merged 型 ─────────────────────────────────────────────────────────────────

/**
 * QueueItem に AI 由来フィールドを付加した合成型。
 *
 * AI state がない場合（hasAiState = false）は AI フィールドがデフォルト値。
 * QueueItem の既存フィールドと重複するものは AI 値で上書きされる。
 */
export interface QueueItemWithAi extends QueueItem {
  // ── AI テキスト系（重複なし — QueueItem にないフィールド） ─────────────────
  aiSummary:        string;
  suggestedAction:  string;
  draftReply:       string;

  // ── AI 分類系（QueueItem.severity を AI 値で上書き） ─────────────────────
  // ※ severity は QueueItem にもあるが、AI 値の方が詳細（critical を含む）
  aiSeverity:       string;   // AI 由来 severity（'medium' 等）
  priority:         string;   // AI 由来 priority（'normal' 等）
  aiRoutingStatus:  string;   // AI 由来 routing_status（'triage' 等）

  // ── エスカレーション ──────────────────────────────────────────────────────
  escalationNeeded: boolean;
  escalationReason: string;
  escalationTarget: string | null;

  // ── meta ──────────────────────────────────────────────────────────────────
  hasAiState:       boolean;
  aiHumanReviewStatus: string;
  lastAiUpdatedAt:  string | null;
  similarCaseIds:   string[];

  // ── UI 表示解決済みフィールド（effective 値） ─────────────────────────────
  /** UI が使う severity: ポリシーに従い AI 値 or source 値 */
  displaySeverity:      string;
  /** UI が使う routingStatus: ポリシーに従い AI 値 or source 値 */
  displayRoutingStatus: string;
  /** UI が使う priority: ポリシーに従い AI 値 or 'normal' */
  displayPriority:      string;
}

// ── Effective state ───────────────────────────────────────────────────────────

/**
 * source / ai / effective の 3 層を明示した状態型。
 *
 * - source*   : NocoDB DB の原値（変更しない）
 * - ai*       : AI が判定した値（ない場合は source と同値）
 * - effective*: UI / 運用上で使う値（getSupportCaseAiAdoptionPolicy が決定）
 *
 * resolveEffectiveState() で生成し、Detail の AI Assist Panel 等で参照する。
 */
export interface EffectiveStateValues {
  // DB 原値
  sourceSeverity:         string;
  sourceRoutingStatus:    string;
  sourcePriority:         string;

  // AI 判定値（AI state がない場合は source 値と同じ）
  aiSeverity:             string;
  aiRoutingStatus:        string;
  aiPriority:             string;

  // effective 値（ポリシーにより source または AI 値）
  effectiveSeverity:      string;
  effectiveRoutingStatus: string;
  effectivePriority:      string;

  // meta
  hasAiState:    boolean;
  adoptAiValues: boolean;  // ポリシーにより AI 値を採用するか
  isLocked:      boolean;  // approved のみ true
}

/**
 * QueueItem + SupportCaseAiViewModel → EffectiveStateValues
 *
 * getSupportCaseAiAdoptionPolicy によって決定された effective 値を返す。
 * Detail の AI Assist Panel / source-ai diff 表示などで使う。
 */
export function resolveEffectiveState(
  item: QueueItem,
  aiVm: SupportCaseAiViewModel | null | undefined,
): EffectiveStateValues {
  const policy = getSupportCaseAiAdoptionPolicy(
    aiVm?.hasAiState ? aiVm.humanReviewStatus : null,
  );
  const adoptAi = !!(aiVm?.hasAiState && policy.adoptAiValues);

  const aiSev = aiVm?.hasAiState ? (aiVm.severity      || item.severity)      : item.severity;
  const aiRs  = aiVm?.hasAiState ? (aiVm.routingStatus || item.routingStatus)  : item.routingStatus;
  const aiPri = aiVm?.hasAiState ? (aiVm.priority      || 'normal')            : 'normal';

  return {
    sourceSeverity:         item.severity,
    sourceRoutingStatus:    item.routingStatus,
    sourcePriority:         'normal',

    aiSeverity:             aiSev,
    aiRoutingStatus:        aiRs,
    aiPriority:             aiPri,

    effectiveSeverity:      adoptAi ? aiSev : item.severity,
    effectiveRoutingStatus: adoptAi ? aiRs  : item.routingStatus,
    effectivePriority:      adoptAi ? aiPri : 'normal',

    hasAiState:    !!(aiVm?.hasAiState),
    adoptAiValues: adoptAi,
    isLocked:      policy.isLocked,
  };
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * QueueItem + SupportCaseAiViewModel → QueueItemWithAi
 *
 * aiStateVm が null / EMPTY の場合はケース本体の値を保持したまま
 * AI フィールドをデフォルト値（空文字 / false 等）で埋めて返す。
 *
 * @example
 * const aiVm = buildSupportCaseAiViewModel(await getSupportCaseAiState('intercom', case.id));
 * const merged = mergeCaseWithAiState(queueItem, aiVm);
 * // merged.aiSeverity  → AI が判定した severity
 * // merged.triageNote  → AI が生成したトリアージノート（QueueItem にも同名フィールドあり）
 */
export function mergeCaseWithAiState(
  caseItem:   QueueItem,
  aiStateVm:  SupportCaseAiViewModel | null | undefined,
): QueueItemWithAi {
  const vm = aiStateVm ?? EMPTY_AI_VIEW_MODEL;
  const eff = resolveEffectiveState(caseItem, aiStateVm);

  return {
    // ── QueueItem のすべてのフィールドをそのままコピー ──────────────────────
    // source 情報（id / title / company / source / companyUid 等）は上書きしない
    ...caseItem,

    // ── AI テキスト系フィールドのみ上書き ──────────────────────────────────
    // triageNote は QueueItem にもあるが AI 版を使う（QueueItem は DB の triage_note を読む）
    triageNote:      vm.hasAiState ? vm.triageNote : (caseItem.triageNote ?? ''),
    aiSummary:       vm.summary,
    suggestedAction: vm.suggestedAction,
    draftReply:      vm.draftReply,

    // ── AI 分類系：AI 値があれば優先、なければ元の値を文字列で保持 ───────────
    aiSeverity:      vm.hasAiState ? vm.severity      : caseItem.severity,
    priority:        vm.hasAiState ? vm.priority       : 'normal',
    aiRoutingStatus: vm.hasAiState ? vm.routingStatus : 'new',

    // ── エスカレーション ────────────────────────────────────────────────────
    escalationNeeded: vm.escalationNeeded,
    escalationReason: vm.escalationReason,
    escalationTarget: vm.escalationTarget,

    // ── meta ────────────────────────────────────────────────────────────────
    hasAiState:            vm.hasAiState,
    aiHumanReviewStatus:   vm.humanReviewStatus,
    lastAiUpdatedAt:       vm.lastAiUpdatedAt,
    similarCaseIds:        vm.similarCaseIds,

    // ── display 系（effective 値 — ポリシーで決定） ──────────────────────────
    displaySeverity:      eff.effectiveSeverity,
    displayRoutingStatus: eff.effectiveRoutingStatus,
    displayPriority:      eff.effectivePriority,
  };
}

/**
 * QueueItem[] と source_record_id → QueueItemWithAi の Map を使って一括マージする。
 * aiStateMap は `getSupportCaseAiStatesByQueue` の戻り値をそのまま渡す。
 *
 * @param caseItems     マージ元 QueueItem 配列
 * @param aiStateVmMap  source_record_id → SupportCaseAiViewModel の Map
 */
export function mergeCasesWithAiStates(
  caseItems:    QueueItem[],
  aiStateVmMap: Map<string, SupportCaseAiViewModel>,
): QueueItemWithAi[] {
  return caseItems.map(item =>
    mergeCaseWithAiState(item, aiStateVmMap.get(item.id) ?? null),
  );
}

// ── Display helpers ───────────────────────────────────────────────────────────

/**
 * QueueItem に effective 値を適用して返す。
 *
 * resolveEffectiveState() を使って severity / routingStatus を effective 値で上書きする。
 * buildCaseViewModel() に渡す前に適用することで、isHomeWorthy / getCaseReasons /
 * getCasePriorityScore などのライフサイクル関数が effective 値を参照できるようになる。
 *
 * AI state がない / adoptAiValues = false の場合は item をそのまま返す（コピーなし）。
 */
export function applyAiDisplayToItem(
  item: QueueItem,
  aiVm: SupportCaseAiViewModel | null | undefined,
): QueueItem {
  if (!aiVm?.hasAiState) return item;
  const eff = resolveEffectiveState(item, aiVm);
  if (!eff.adoptAiValues) return item;
  return {
    ...item,
    severity:      eff.effectiveSeverity,
    routingStatus: eff.effectiveRoutingStatus,
  };
}

// ── Decision recommendation ───────────────────────────────────────────────────

/**
 * Decision Panel で使う AI 由来の推奨情報。
 * CTA 強調・ヒント表示・バナー制御・理由説明などに使う。
 */
export interface DecisionRecommendation {
  /** escalationNeeded && escalationTarget === 'cse' → CSE Ticket CTA を強調 */
  emphasizeCseTicket:  boolean;
  /** AI の suggestedAction テキスト（Action CTA 付近のヒントに表示） */
  suggestedActionHint: string;
  /** humanReviewStatus === 'approved' */
  aiApproved:          boolean;
  /** humanReviewStatus === 'pending' */
  aiPending:           boolean;
  /** !isLocked — approved なら再生成をブロック */
  canRegenerate:       boolean;
  /** humanReviewStatus 現在値（バッジ表示用） */
  reviewStatus:        string;
  /** 推奨理由のコード（ロギング / テスト用） */
  reasonCode:          string;
  /** 推奨理由の短いラベル（Decision Panel の 1 行表示） */
  reasonLabel:         string;
  /** 推奨理由の詳細説明 */
  reasonDescription:   string;
}

// ── reason helper ─────────────────────────────────────────────────────────────

/**
 * AI VM から推奨理由を生成する。
 * getDecisionRecommendation() の内部ヘルパー。
 */
function buildReasonInfo(
  aiVm: SupportCaseAiViewModel,
  isLocked: boolean,
): Pick<DecisionRecommendation, 'reasonCode' | 'reasonLabel' | 'reasonDescription'> {
  if (isLocked) {
    return {
      reasonCode:        'ai_approved',
      reasonLabel:       'AI承認済み',
      reasonDescription: 'AI提案が承認済みです。再生成はブロックされています。',
    };
  }
  if (aiVm.escalationNeeded && aiVm.escalationTarget === 'cse') {
    const sevSuffix = aiVm.severity === 'critical' ? '_critical' : aiVm.severity === 'high' ? '_high' : '';
    const sevLabel  = aiVm.severity === 'critical' ? '緊急' : aiVm.severity === 'high' ? '高' : '';
    return {
      reasonCode:        `escalation_cse${sevSuffix}`,
      reasonLabel:       `CSE${sevLabel}対応推奨`,
      reasonDescription: `${sevLabel ? aiVm.severity.toUpperCase() + ' Severity かつ ' : ''}escalation target が CSE のため CSE Ticket 作成を推奨します`,
    };
  }
  if (aiVm.escalationNeeded) {
    return {
      reasonCode:        'escalation_required',
      reasonLabel:       'エスカレーション必要',
      reasonDescription: `エスカレーション先: ${aiVm.escalationTarget ?? '不明'}。担当チームへの引き継ぎを検討してください。`,
    };
  }
  if (aiVm.severity === 'critical') {
    return {
      reasonCode:        'critical_severity',
      reasonLabel:       '緊急対応',
      reasonDescription: 'AI が最高深刻度（Critical）と判定しました。即時対応を推奨します。',
    };
  }
  if (aiVm.priority === 'urgent') {
    return {
      reasonCode:        'urgent_priority',
      reasonLabel:       '至急対応',
      reasonDescription: 'AI 判定優先度が最高（Urgent）です。',
    };
  }
  return { reasonCode: '', reasonLabel: '', reasonDescription: '' };
}

/**
 * SupportCaseAiViewModel → DecisionRecommendation
 *
 * AI state がない場合はすべてデフォルト値（canRegenerate: true）を返す。
 */
export function getDecisionRecommendation(
  aiVm: SupportCaseAiViewModel | null | undefined,
): DecisionRecommendation {
  if (!aiVm?.hasAiState) {
    return {
      emphasizeCseTicket:  false,
      suggestedActionHint: '',
      aiApproved:          false,
      aiPending:           false,
      canRegenerate:       true,
      reviewStatus:        '',
      reasonCode:          '',
      reasonLabel:         '',
      reasonDescription:   '',
    };
  }
  const policy = getSupportCaseAiAdoptionPolicy(aiVm.humanReviewStatus);
  const reason = buildReasonInfo(aiVm, policy.isLocked);
  return {
    emphasizeCseTicket:  aiVm.escalationNeeded && aiVm.escalationTarget === 'cse',
    suggestedActionHint: aiVm.suggestedAction,
    aiApproved:          policy.isLocked,
    aiPending:           aiVm.humanReviewStatus === 'pending',
    canRegenerate:       policy.canRegenerate,
    reviewStatus:        aiVm.humanReviewStatus,
    ...reason,
  };
}
