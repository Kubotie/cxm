// ─── GET /api/company/[companyUid]/readiness ──────────────────────────────────
//
// 提案準備度（Proposal Readiness）を算出して返す。
// 「今この顧客に提案を持ち込んでよいか」を既存データだけで判定する。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §15
//
// 評価単位:
//   projects[] : プロジェクト（＝部門・予算単位）ごとの準備度。**こちらが主**
//   company    : 会社全体の粗い指標。一覧表示用
//   会社単位で平均すると「主契約部門は解約方向、別部門は拡張余地」のような
//   部門差が消えるため、判断は projects[] を見て行う（§15.3）。
//
// 外部機会（opportunity）は既定で**自動判定**する（§11）。
//
// クエリパラメータ:
//   ?opportunity=true|false  自動判定を上書きする（担当者が手で切り替える場合）
//
// ⚠️ 算出そのものは `src/lib/company/readiness-facts.ts` に置いている。
//   提案フロー（proposal-inputs）が同じ土台を使うため。同じ画面の上下で
//   違う準備度が出ると原因が追えなくなるので、計算をここに戻さないこと。
//
// 既知の制限:
//   実行体制（execution）の推移は company_daily_snapshot 由来のため**会社合計**である。

import { NextResponse } from 'next/server';
import {
  loadReadinessFacts, TREND_WINDOW_DAYS,
  type ReadinessProjectFacts,
} from '@/lib/company/readiness-facts';
import type { ProposalReadinessVM, ProposalPlayResult, RenewalBucket } from '@/lib/company/proposal-readiness';
import type { ReplaceabilitySignalVM } from '@/lib/company/replaceability-signal';
import type { ExternalOpportunityVM } from '@/lib/company/external-signal';

// ── レスポンス型（クライアントから import して使う）─────────────────────────

export type ReadinessProjectItem = ReadinessProjectFacts;

export interface ReadinessResponse {
  companyUid:   string;
  companyName:  string;
  tier:         1 | 2 | 3 | 5 | null;
  renewalBucket: RenewalBucket | null;
  renewalDate:  string | null;
  hasExternalOpportunity: boolean;
  /** 外部機会の判定根拠。override 指定時も参考として返す */
  externalOpportunity: ExternalOpportunityVM;
  /** true = クエリパラメータで上書きされた（自動判定ではない） */
  opportunityOverridden: boolean;

  company: {
    readiness: ProposalReadinessVM;
    play:      ProposalPlayResult;
    note:      string;
  };

  projects: ReadinessProjectItem[];

  inputs: {
    trendWindowDays:        number;
    trendFrom:              string | null;
    trendTo:                string | null;
    communicationBlankDays: number | null;
    lastContactDate:        string | null;
    touchpointCount90d:     number;
    openSupportCount:       number | null;
    replaceability:         ReplaceabilitySignalVM;
    paidProjectCount:       number;
    excludedFreeCount:      number;
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  // 明示指定があればそれを優先し、無ければ外部シグナルから自動判定する
  const opportunityParam = new URL(req.url).searchParams.get('opportunity');
  const opportunityOverride =
    opportunityParam === 'true' ? true : opportunityParam === 'false' ? false : null;

  const facts = await loadReadinessFacts(companyUid, opportunityOverride);
  if (!facts) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  const body: ReadinessResponse = {
    companyUid:  facts.companyUid,
    companyName: facts.companyName,
    tier:        facts.tier,
    renewalBucket: facts.renewalBucket,
    renewalDate:   facts.renewalDate,
    hasExternalOpportunity: facts.hasExternalOpportunity,
    externalOpportunity:    facts.externalOpportunity,
    opportunityOverridden:  facts.opportunityOverridden,

    company: {
      readiness: facts.companyReadiness,
      play:      facts.companyPlay,
      note:      'プロジェクト（部門・予算）単位で差が出るため、判断は projects[] を参照すること',
    },

    projects: facts.projects,

    inputs: { ...facts.inputs, trendWindowDays: TREND_WINDOW_DAYS },
  };

  return NextResponse.json(body);
}
