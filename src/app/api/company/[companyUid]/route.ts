// ─── GET /api/company/[companyUid] ───────────────────────────────────────────
// 1企業の全体情報を集約して返す Company Detail API。
//
// ── source of truth 一覧 ────────────────────────────────────────────────────
//   フィールド                  テーブル                  カラム（実名）
//   ──────────────────────────────────────────────────────────────────────────
//   company.*                  companies                各カラム
//   phase.primaryPhaseLabel    csm_customer_phase       M-Phase / sf_cs / stat_date
//                              crm_customer_phase       A-Phase / CSM / stat_date
//                              ※ CS担当（companies.owner）有無で主副切替
//   summary.state              company_summary_state    ai_summary 等
//   health.*                   上記複数から signal 集約（buildHealthSignalVM）
//   communication.*            log_chatwork             account_name / body / sent_at_jst
//                              log_slack                account_name / body / sent_at_jst
//                              log_notion_minutes       page_name / creat_at_jst
//   projects.*                 project_info             master_company_sf_id で join
//   support.recentCases        log_intercom             display_title → body（fallback）/ sent_at_jst
//   support.cseTickets         cse_tickets              display_title → title → description
//   people.contacts            company_people           全カラム
//   evidence.*                 evidence                 先頭 20 件
//
// ── 意図的な未接続 / 制約（不具合ではない）────────────────────────────────────
//   people.sfSyncStatus = 'not_connected'
//     → SF Contact 全体同期は SF OAuth（Connected App）未設定のため未接続。
//       salesforce-contact-adapter.ts 実装済み。個別 push は people/[id]/sf-push で利用可能。
//   project = 空（cmp_xxx 企業）
//     → project_info は master_company_sf_id FK のみ。sf_xxx 以外は取得不可（仕様）。
//   Notion candidate = weakSources 固定
//     → log_notion_minutes に participants カラムが存在しない構造的制約。
//   AI Summary state = null
//     → 未生成（エラーではない）。Generate ボタンで生成可能。
//
// ── エラーハンドリング ────────────────────────────────────────────────────────
//   - company が見つからない → 404
//   - テーブル未設定のデータソース → 空配列 / null (フォールバック)
//   - 個別テーブルの取得失敗 → 空データでフォールバック（全体を止めない）
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   このルートは UI（ブラウザ）から直接呼ばれる。
//   checkBatchAuth は DolphinScheduler 等の外部バッチ専用のため、ここでは使わない。
//   将来的に NextAuth セッション認証を導入する場合はここに追加する。

import { NextResponse } from 'next/server';

// ── Data fetch ─────────────────────────────────────────────────────────────────
import { fetchCompanyByUid }           from '@/lib/nocodb/companies';
import { getCompanySummaryState }      from '@/lib/nocodb/company-summary-read';
import { fetchBothPhases }             from '@/lib/nocodb/phases';
import { fetchProjectsByCompany }      from '@/lib/nocodb/project-info';
import { fetchAllCommunicationLogs }   from '@/lib/nocodb/communication-logs';
import { fetchSupportAggregateForCompany } from '@/lib/nocodb/support-by-company';
import { fetchEvidence, sortEvidenceForDisplay } from '@/lib/nocodb/evidence';
import { fetchAlerts }                from '@/lib/nocodb/alerts';
import { fetchPeople }                 from '@/lib/nocodb/people';

// ── VM builders ───────────────────────────────────────────────────────────────
import {
  buildCompanySummaryViewModel,
} from '@/lib/company/company-summary-state-policy';
import {
  buildPhaseComparisonVM,
  hasAssignedCsm,
} from '@/lib/company/phase-comparison';
import {
  buildCommunicationSignalVM,
} from '@/lib/company/communication-signal';
import {
  buildProjectAggregateVM,
  EMPTY_PROJECT_AGGREGATE,
} from '@/lib/company/project-aggregate';
import {
  buildHealthSignalVM,
} from '@/lib/company/health-signal';
import type { CompanyDetailApiResponse } from '@/lib/company/company-vm';

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  // ── company 基本情報（これが取れなければ 404）────────────────────────────
  const company = await fetchCompanyByUid(companyUid).catch(() => null);
  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // ── 全テーブルを並行取得（各テーブルは独立しているため Promise.all）────────
  const [
    summaryState,
    { csmPhase, crmPhase },
    projects,
    commLogs,
    support,
    evidence,
    people,
    alerts,
  ] = await Promise.all([
    getCompanySummaryState(companyUid).catch(() => null),
    fetchBothPhases(companyUid).catch(() => ({ csmPhase: null, crmPhase: null })),
    fetchProjectsByCompany(companyUid).catch(() => []),
    fetchAllCommunicationLogs(companyUid).catch(() => ({ chatwork: [], slack: [], notionMinutes: [] })),
    fetchSupportAggregateForCompany(companyUid).catch(() => ({
      openIntercomCount: 0, openCseCount: 0, waitingCseCount: 0, criticalCount: 0, highCount: 0,
      recentSupportCount: 0, recentCases: [], cseTickets: [], aiStates: [],
    })),
    fetchEvidence(companyUid).catch(() => []),
    fetchPeople(companyUid).catch(() => []),
    fetchAlerts(companyUid).catch(() => []),
  ]);

  // ── VM 構築 ──────────────────────────────────────────────────────────────
  const summaryVM        = buildCompanySummaryViewModel(summaryState);
  const phaseVM          = buildPhaseComparisonVM(csmPhase, crmPhase, hasAssignedCsm(company.owner));
  const communicationVM  = buildCommunicationSignalVM(
    commLogs.chatwork,
    commLogs.slack,
    commLogs.notionMinutes,
  );
  const projectVM        = projects.length > 0
    ? buildProjectAggregateVM(projects)
    : EMPTY_PROJECT_AGGREGATE;
  const healthVM         = buildHealthSignalVM({
    companyUid,
    summary:             summaryState,
    phaseVM,
    communicationVM,
    projectVM,
    openCriticalSupport: support.criticalCount,
    openHighSupport:     support.highCount,
    openAlertCount:      company.openAlerts,
  });

  // ── レスポンス組み立て ────────────────────────────────────────────────────
  const response: CompanyDetailApiResponse = {
    company,

    phase: phaseVM,

    summary: {
      state: summaryState,
      vm:    summaryVM,
    },

    alerts: alerts.filter(a => a.id),

    health: healthVM,

    communication: communicationVM,

    projects: projectVM,

    support: {
      openIntercomCount: support.openIntercomCount,
      openCseCount:      support.openCseCount,
      waitingCseCount:   support.waitingCseCount,
      criticalCount:     support.criticalCount,
      highCount:         support.highCount,
      recentCases:       support.recentCases,
      cseTickets:        support.cseTickets,
      aiStates:          support.aiStates,
    },

    people: {
      count:        people.length,
      contacts:     people,
      keyContacts:  people.filter(p => p.decisionInfluence === 'high').slice(0, 3),
      owners:       people.filter(p => !!p.owner),
      // SF 全体同期は SF OAuth（Connected App）未設定のため not_connected（制約・不具合ではない）。
      // 個別 push は PUT /api/company/[uid]/people/[id]/sf-push で利用可能。
      sfSyncStatus: 'not_connected',
      sfNote:       'SF Contact 全体同期: SF OAuth 設定待ち（制約）。個別の連絡先編集 → 「SF push」で1件ずつ反映できます。',
    },

    evidence: sortEvidenceForDisplay(evidence).slice(0, 20),
  };

  return NextResponse.json(response);
}
