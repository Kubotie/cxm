// ─── Signal CTA ヘルパー ────────────────────────────────────────────────────
//
// Risk / Opportunity シグナルに対してどの CTA を表示するかを決定する。
// UI コンポーネントからロジックを分離する目的で独立ファイルとして置く。
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { RiskSignal, OpportunitySignal } from '@/lib/company/health-signal';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface SignalCTASpec {
  /** "Action作成" CTA を表示するか */
  showActionCTA:   boolean;
  /** "SF ToDo作成" CTA を表示するか */
  showSfTodoCTA:   boolean;
  /** Action CTA のボタンラベル（signal type によって変える） */
  actionLabel:     string;
  /** 関連タブへ遷移するか（true なら矢印を表示） */
  showTabLink:     boolean;
  /** 遷移先タブ名（'support' | 'communication' | 'projects' | null） */
  targetTab:       string | null;
  /** AI 推奨アクション例（hover tooltip や Action 下書きに使う） */
  suggestedAction: string;
}

// ── Risk シグナル CTA マップ ───────────────────────────────────────────────────

const RISK_CTA_MAP: Record<string, Partial<SignalCTASpec>> = {
  support_critical:    { showActionCTA: true,  showSfTodoCTA: false, actionLabel: 'Action作成', targetTab: 'support',       suggestedAction: 'Criticalサポートケースの対応方針を決定し、CSE連携を確認する' },
  support_high_volume: { showActionCTA: true,  showSfTodoCTA: false, actionLabel: 'Action作成', targetTab: 'support',       suggestedAction: 'サポート対応状況を確認し、優先順位を設定する' },
  alert_critical:      { showActionCTA: true,  showSfTodoCTA: false, actionLabel: 'Action作成', targetTab: 'support',       suggestedAction: 'クリティカルアラートの原因を特定し、対応計画を立てる' },
  alert_high:          { showActionCTA: true,  showSfTodoCTA: false, actionLabel: 'Action作成', targetTab: null,            suggestedAction: 'Highアラートを確認し、次のアクションを決定する' },
  communication_blank: { showActionCTA: true,  showSfTodoCTA: false, actionLabel: 'コンタクト', targetTab: 'communication', suggestedAction: 'コミュニケーションが途絶えているため、フォローアップを実施する' },
  phase_gap:           { showActionCTA: false, showSfTodoCTA: true,  actionLabel: 'Action作成', targetTab: null,            suggestedAction: 'SF Opportunityのフェーズを実態に合わせて更新する' },
  phase_stagnation:    { showActionCTA: true,  showSfTodoCTA: true,  actionLabel: 'Action作成', targetTab: null,            suggestedAction: 'フェーズ停滞の原因を確認し、次のマイルストーンを設定する' },
  project_stalled:     { showActionCTA: true,  showSfTodoCTA: false, actionLabel: 'Action作成', targetTab: 'projects',      suggestedAction: '停滞プロジェクトの再開または終了判断をする' },
  summary_stale:       { showActionCTA: false, showSfTodoCTA: false, actionLabel: 'Action作成', targetTab: null,            suggestedAction: 'AI Summaryを再生成して最新の状態を確認する' },
};

// ── Opportunity シグナル CTA マップ ──────────────────────────────────────────

const OPPORTUNITY_CTA_MAP: Record<string, Partial<SignalCTASpec>> = {
  expansion_project: { showActionCTA: true, showSfTodoCTA: true,  actionLabel: '提案メモ作成',  suggestedAction: '拡張提案の準備を開始し、SFに商談として登録する' },
  new_use_case:      { showActionCTA: true, showSfTodoCTA: true,  actionLabel: '提案メモ作成',  suggestedAction: '新ユースケースの提案書を作成し、担当者に共有する' },
  renewal_upcoming:  { showActionCTA: true, showSfTodoCTA: true,  actionLabel: '更新確認作成',  suggestedAction: '更新に向けた商談を開始し、条件を整理する' },
  upsell_signal:     { showActionCTA: true, showSfTodoCTA: true,  actionLabel: 'アップセル提案', suggestedAction: 'アップセル提案のタイミングを検討し、SF商談を作成する' },
  health_improving:  { showActionCTA: true, showSfTodoCTA: false, actionLabel: '成功事例記録',  suggestedAction: '改善事例をまとめ、カスタマーサクセス事例として記録する' },
};

const DEFAULT_CTA: SignalCTASpec = {
  showActionCTA:   true,
  showSfTodoCTA:   false,
  actionLabel:     'Action作成',
  showTabLink:     true,
  targetTab:       null,
  suggestedAction: 'このシグナルに対応するアクションを作成する',
};

// ── 公開ヘルパー ──────────────────────────────────────────────────────────────

/**
 * Risk シグナルに対する CTA 仕様を返す。
 * severity が low の場合は Action CTA を非表示にする（情報量を減らして UX 向上）。
 */
export function getRiskSignalCTA(signal: RiskSignal): SignalCTASpec {
  const base = RISK_CTA_MAP[signal.type] ?? {};
  const spec: SignalCTASpec = { ...DEFAULT_CTA, ...base, showTabLink: !!base.targetTab };

  // low severity は Action CTA 非表示（noise 軽減）
  if (signal.severity === 'low') {
    spec.showActionCTA  = false;
    spec.showSfTodoCTA  = false;
  }

  return spec;
}

/**
 * Opportunity シグナルに対する CTA 仕様を返す。
 * canCreateSfTodo フラグが false なら SF ToDo CTA を強制非表示。
 */
export function getOpportunitySignalCTA(signal: OpportunitySignal): SignalCTASpec {
  const base = OPPORTUNITY_CTA_MAP[signal.type] ?? {};
  const spec: SignalCTASpec = {
    ...DEFAULT_CTA,
    showSfTodoCTA: true,
    actionLabel:   '提案メモ作成',
    suggestedAction: '機会シグナルに対応するアクションを作成する',
    ...base,
    showTabLink: false,
    targetTab:   null,
  };

  if (!signal.canCreateSfTodo) spec.showSfTodoCTA = false;

  return spec;
}
