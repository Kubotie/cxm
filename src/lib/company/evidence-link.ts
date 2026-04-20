// ─── Evidence Drill-Down リンク生成 ───────────────────────────────────────────
//
// signal の sourceType から適切な drill-down URL を生成する単一の helper。
//
// 設計方針:
//   - signal → URL のマッピングをここに集約（UI 側に書かない）
//   - companyUid を持てばどこからでも参照できる
//   - Support / Project は専用 detail ページへ
//   - Communication / Phase は Company Detail の tab + anchor へ
//   - Action は将来の action detail ページへ（暫定で Salesforce URL）

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type EvidenceSourceType =
  | 'support_case'
  | 'cse_ticket'
  | 'intercom'
  | 'project'
  | 'log_chatwork'
  | 'log_slack'
  | 'log_notion_minutes'
  | 'phase'
  | 'people'
  | 'alert'
  | 'evidence'
  | 'action'
  | 'salesforce_todo';

export interface EvidenceLinkParams {
  sourceType:  EvidenceSourceType;
  sourceId?:   string;   // support case id / project id / person id 等
  companyUid?: string;   // Company Detail タブへ遷移する場合に必要
  /** Salesforce レコード ID（action / contact 用） */
  sfId?:       string;
  sfDomain?:   string;   // 例: "myorg.my.salesforce.com"
}

// ── URL 生成 ─────────────────────────────────────────────────────────────────

/**
 * signal の sourceType と ID から drill-down URL を生成する。
 * CXM Platform 内のパスは相対パス、SF は https:// 絶対パスを返す。
 * 遷移先が不明な場合は null を返す。
 */
export function getEvidenceDrilldownUrl(params: EvidenceLinkParams): string | null {
  const { sourceType, sourceId, companyUid, sfId, sfDomain } = params;

  switch (sourceType) {
    // ── Support 系 ─────────────────────────────────────────────────────────
    case 'support_case':
      return sourceId ? `/support/${sourceId}` : null;

    case 'cse_ticket':
      return sourceId ? `/support?cse=${sourceId}` : null;

    case 'intercom':
      return sourceId ? `/support/${sourceId}` : null;

    // ── Project ─────────────────────────────────────────────────────────────
    case 'project':
      if (companyUid) {
        return sourceId
          ? `/companies/${companyUid}?tab=projects&project=${sourceId}`
          : `/companies/${companyUid}?tab=projects`;
      }
      return null;

    // ── Communication ────────────────────────────────────────────────────────
    case 'log_chatwork':
      return companyUid
        ? `/companies/${companyUid}?tab=communication&source=chatwork${sourceId ? `&entry=${sourceId}` : ''}`
        : null;

    case 'log_slack':
      return companyUid
        ? `/companies/${companyUid}?tab=communication&source=slack${sourceId ? `&entry=${sourceId}` : ''}`
        : null;

    case 'log_notion_minutes':
      return companyUid
        ? `/companies/${companyUid}?tab=communication&source=notion${sourceId ? `&entry=${sourceId}` : ''}`
        : null;

    // ── Phase ────────────────────────────────────────────────────────────────
    case 'phase':
      return companyUid
        ? `/companies/${companyUid}?tab=overview&section=phase`
        : null;

    // ── People ───────────────────────────────────────────────────────────────
    case 'people':
      if (companyUid) {
        return sourceId
          ? `/companies/${companyUid}?tab=people&person=${sourceId}`
          : `/companies/${companyUid}?tab=people`;
      }
      return null;

    // ── Alert / Evidence（Company Detail の overview タブ） ────────────────
    case 'alert':
      return companyUid ? `/companies/${companyUid}?tab=overview&section=alerts` : null;

    case 'evidence':
      return companyUid
        ? `/companies/${companyUid}?tab=overview&section=evidence${sourceId ? `&entry=${sourceId}` : ''}`
        : null;

    // ── Action / Salesforce ToDo ─────────────────────────────────────────────
    case 'action':
      return companyUid
        ? `/companies/${companyUid}?tab=overview&section=actions`
        : null;

    case 'salesforce_todo':
      if (sfId && sfDomain) {
        return `https://${sfDomain}/lightning/r/Task/${sfId}/view`;
      }
      return null;

    default:
      return companyUid ? `/companies/${companyUid}` : null;
  }
}

// ── Company Detail タブリンク（よく使うショートカット）─────────────────────

export function companyDetailTabUrl(companyUid: string, tab: string): string {
  return `/companies/${companyUid}?tab=${tab}`;
}

export function companySupportUrl(companyUid: string): string {
  return `/companies/${companyUid}?tab=support`;
}

export function companyProjectsUrl(companyUid: string): string {
  return `/companies/${companyUid}?tab=projects`;
}

export function companyCommunicationUrl(companyUid: string): string {
  return `/companies/${companyUid}?tab=communication`;
}

export function companyPeopleUrl(companyUid: string): string {
  return `/companies/${companyUid}?tab=people`;
}
