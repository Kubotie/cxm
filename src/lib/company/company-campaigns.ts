// ─── 施策から読む組織の動き（組み立て）──────────────────────────────────────
//
// 明細（13.8MB）から会社単位の「誰が何をしているか」を作る。
//
// **API とバッチの両方から呼ぶため、取得と組み立てを分けている。**
// バッチは明細を1回だけ落として全社分をここで作る。
// API は保存済みが無いときだけ、その場で落として作る。

import type { CampaignDetailRow, CampaignSummary } from '@/lib/metabase/project-campaigns';
import { buildCampaignOrg, type CampaignOrgVM } from '@/lib/company/campaign-org-signals';
import { aggregateCampaignSignals, type CampaignSignalVM } from '@/lib/company/campaign-signals';
import {
  buildCaseOpportunity, EMPTY_CASE_OPPORTUNITY, type CaseOpportunityVM,
} from '@/lib/company/case-opportunity';
import type { AppProjectInfo } from '@/lib/nocodb/types';

export interface CompanyCampaignsResponse {
  companyUid:  string;
  companyName: string;
  /** 集計に含めたプロジェクト（有料のみ） */
  projects: Array<{ id: string; name: string; paidType: string | null; campaigns: number }>;
  /** 施策の直近の動き（サマリ由来・有料PJ合算） */
  activity: CampaignSignalVM;
  /** 組織の動き（明細由来） */
  org: CampaignOrgVM;
  /**
   * 事例機会。**「運用が回っているか」とは別の軸。**
   * 同じ題材のABテストが並んでいれば、それは施策の本数ではなく
   * 「顧客がいま何を確かめようとしているか」で、事例の打診先になる。
   * 古い保存済みには入っていないので、読む側は既定値を用意する。
   */
  caseOpportunity?: CaseOpportunityVM;
  /** このデータで答えられないこと。画面に明記する */
  limitations: string[];
  cacheAgeSec: number | null;
  /** 日次バッチが作ったものを返したか */
  fromCache?: boolean;
  /** 事前計算の時刻（JST）。fromCache のときだけ入る */
  computedAt?: string | null;
}

export { EMPTY_CASE_OPPORTUNITY };

export const CAMPAIGN_LIMITATIONS = [
  '施策をいつ停止したかは分かりません（停止時刻の列がありません）。PAUSED は現在の状態であって履歴ではありません。',
  '施策の最終更新日時は分かりません。RUNNING が先週始まったのか2年前から放置なのかは、初公開日からの推測に留まります。',
  '施策の成果（表示回数・ゴール到達数・CVR）は含まれません。ゴール数は設定数であって達成数ではありません。',
  '明細は直近2年が対象です（ただし現在 RUNNING / SCHEDULED のものは期間外でも含まれます）。',
];

/** 有料PJのみを対象にする。FREE を混ぜると組織の動きが読めなくなる */
export function paidProjectsOf(projects: AppProjectInfo[]): AppProjectInfo[] {
  return projects.filter(p => p.paidType !== 'FREE');
}

export function composeCompanyCampaigns(input: {
  companyUid:  string;
  companyName: string;
  /** 有料プロジェクト */
  paid:        AppProjectInfo[];
  detail:      Map<string, CampaignDetailRow[]>;
  summary:     Map<string, CampaignSummary>;
  cacheAgeSec: number | null;
}): CompanyCampaignsResponse {
  const rows: CampaignDetailRow[] = [];
  const projectRows: CompanyCampaignsResponse['projects'] = [];

  for (const p of input.paid) {
    const list = input.detail.get(p.id) ?? [];
    rows.push(...list);
    projectRows.push({ id: p.id, name: p.name, paidType: p.paidType, campaigns: list.length });
  }
  projectRows.sort((a, b) => b.campaigns - a.campaigns);

  return {
    companyUid:  input.companyUid,
    companyName: input.companyName,
    projects:    projectRows,
    activity:    aggregateCampaignSignals(input.paid.map(p => input.summary.get(p.id) ?? null)),
    org:         buildCampaignOrg(rows),
    caseOpportunity: buildCaseOpportunity(rows),
    limitations: CAMPAIGN_LIMITATIONS,
    cacheAgeSec: input.cacheAgeSec,
  };
}
