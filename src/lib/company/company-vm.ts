// ─── Company VM 型定義 ────────────────────────────────────────────────────────
//
// Company List / Detail API が返す整形済みレスポンス型の定義。
//
// 既存の CompanySummaryListItemViewModel（batch 運用向け）を List 用に拡張した
// CompanyListItemVM を定義する。
// Detail は CompanyDetailApiResponse として別定義。
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { CompanySummaryListItemViewModel } from '@/lib/company/company-summary-state-policy';
import type { OverallHealth }   from '@/lib/company/badges';
import type { PhaseSource }     from '@/lib/company/phase-comparison';
import type { PriorityScoreBreakdown } from '@/lib/company/priority-score';
import type {
  AppCompany,
  AppAlert,
  AppEvidence,
  AppPerson,
  AppSupportCase,
  AppCseTicket,
  AppSupportCaseAIState,
  AppCompanySummaryState,
} from '@/lib/nocodb/types';
import type { CompanySummaryViewModel } from '@/lib/company/company-summary-state-policy';
import type { CompanyHealthSignalVM } from '@/lib/company/health-signal';
import type { CommunicationSignalVM } from '@/lib/company/communication-signal';
import type { ProjectAggregateVM }    from '@/lib/company/project-aggregate';
import type { PhaseComparisonVM }     from '@/lib/company/phase-comparison';

// ── Company List Item VM ──────────────────────────────────────────────────────

/**
 * Company List API の1行レスポンス。
 * batch 運用ベースの CompanySummaryListItemViewModel を継承し、
 * 運用画面に必要なシグナル情報を追加する。
 */
export interface CompanyListItemVM extends CompanySummaryListItemViewModel {
  // ── Priority ────────────────────────────────────────────────────────────
  /** ソート用優先度スコア（高いほど上位） */
  priorityScore:         number;
  /** スコア内訳（hover ツールチップ等に使用） */
  priorityBreakdown:     PriorityScoreBreakdown[];

  // ── Health ──────────────────────────────────────────────────────────────
  /** AI または signal 集約から算出した企業 health */
  overallHealth:         OverallHealth | null;

  // ── Phase ───────────────────────────────────────────────────────────────
  /** 主フェーズラベル（CS担当有無で CSM/CRM 優先ルール適用済み） */
  activePhaseLabel:      string | null;
  /** どちらのソースを主表示にしたか */
  activePhaseSource:     PhaseSource | null;
  /** 比較可能かつ M-Phase ≠ A-Phase */
  phaseGap:              boolean;
  /** gap 説明文（例: "CRM: Active"） */
  phaseGapDescription:   string | null;
  /** 主フェーズ停滞日数（null = 更新日時不明） */
  phaseStagnationDays:   number | null;

  // ── Communication ────────────────────────────────────────────────────────
  /** 最終コミュニケーションから何日経過したか（null = データなし） */
  communicationBlankDays: number | null;
  /** blank_days に基づく risk level */
  communicationRiskLevel: 'none' | 'warning' | 'risk';

  // ── Support ─────────────────────────────────────────────────────────────
  openSupportCount:      number;
  criticalSupportCount:  number;

  // ── Projects ─────────────────────────────────────────────────────────────
  projectSummary: {
    total:   number;
    active:  number;
    stalled: number;
    unused:  number;
  };

  // ── Basic ───────────────────────────────────────────────────────────────
  owner:       string;
  lastContact: string;
}

// ── Company Detail API Response ───────────────────────────────────────────────

/**
 * GET /api/company/[companyUid] のレスポンス型。
 * UI コンポーネントは AppCompany 等の raw 型を自分で取得せず、
 * この型だけを参照してレンダリングできることを目指す。
 */
export interface CompanyDetailApiResponse {
  // ── 基本情報 ──────────────────────────────────────────────────────────────
  company:   AppCompany;

  // ── Phase ─────────────────────────────────────────────────────────────────
  phase:     PhaseComparisonVM;

  // ── AI Summary ────────────────────────────────────────────────────────────
  summary: {
    /** NocoDB から取得した生 state（null = 未生成） */
    state:             AppCompanySummaryState | null;
    /** UI 表示用の導出値 */
    vm:                CompanySummaryViewModel;
  };

  // ── Alerts（open alerts 一覧）─────────────────────────────────────────────
  /** status=open の全アラート。source が "policy:xxx" のものは Policy 由来 */
  alerts:    AppAlert[];

  // ── Health / Risk / Opportunity ───────────────────────────────────────────
  health:    CompanyHealthSignalVM;

  // ── Communication ─────────────────────────────────────────────────────────
  communication: CommunicationSignalVM;

  // ── Projects ──────────────────────────────────────────────────────────────
  projects:  ProjectAggregateVM;

  // ── Support ──────────────────────────────────────────────────────────────
  support: {
    openIntercomCount:  number;
    openCseCount:       number;
    /** cse_tickets の waiting_customer 数 */
    waitingCseCount:    number;
    criticalCount:      number;
    highCount:          number;
    /** 直近 5 件のサポートケース（log_intercom） */
    recentCases:        AppSupportCase[];
    /** 直近 5 件の CSE チケット */
    cseTickets:         AppCseTicket[];
    /** AI state サマリー（urgency/summary が見たい場合） */
    aiStates:           AppSupportCaseAIState[];
  };

  // ── People / Contacts ─────────────────────────────────────────────────────
  //
  // ■ データソース: company_people テーブル（NocoDB）
  //   - fetchPeople(companyUid) で取得
  //   - SF Contact は CXM 内の people レコードに sf_id / sync_status カラムで紐付け
  //
  // ■ SF Contact 連動の現状（2026-04 時点）
  //   ・個別 push: 実装済み — contact-form-dialog から PUT /api/.../people/[id]/sf-push
  //   ・全体 SF → CXM 同期: UI から未接続（sfSyncStatus = 'not_connected'）
  //     → salesforce-contact-adapter.ts / sf-contacts/sync ルートは実装済み
  //     → People タブの「SF同期」ボタンを押すと dry-run preview が表示されるが、
  //       Salesforce Connected App の OAuth 認証が通るまで adapter_not_connected になる
  //   ・これは「不具合」ではなく「SF認証未設定の制約」
  //
  // ■ sfSyncStatus は将来 'connected' | 'partial' | 'not_connected' に拡張予定
  people: {
    count:        number;
    /** 全コンタクト一覧 */
    contacts:     AppPerson[];
    /**
     * 意思決定者（decisionInfluence='high'）または is_decision_maker=TRUE のコンタクト。
     * List 画面のサマリー表示用に上位 3 件を含む。
     */
    keyContacts:  AppPerson[];
    /**
     * owner フィールドが設定されているコンタクト（CSM オーナー）。
     * 担当者不明判定のために使用。
     */
    owners:       AppPerson[];
    /**
     * SF 全体同期の接続状態。
     * 'not_connected' = SF OAuth 未設定（制約）。個別 push は別途利用可能。
     * 将来: 'connected' | 'partial' | 'not_connected'
     */
    sfSyncStatus: 'not_connected';
    sfNote:       string;
  };

  // ── Evidence ──────────────────────────────────────────────────────────────
  /** 直近 20 件の evidence（drill-down 起点） */
  evidence: AppEvidence[];
}
