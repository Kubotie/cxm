// ─── 解約レーダー：出所リンクの組み立て ───────────────────────────────────────
//
// **根拠を辿れないものは信じてもらえない。** リンクが張れるもの（Notion / Intercom）は
// リンクに、張れないもの（Slack / Chatwork）は本文の抜粋で示す。
//
// URL の規則は既存の /api/company/[companyUid]/communications と揃えている。
// 個社ドリルと言質レビュー一覧の両方から使うのでここに置く。

/** Intercom ワークスペースの id_code（Ptengine / US）。秘密情報ではない */
const INTERCOM_APP_ID = 'cfiqb37k';

/**
 * Intercom 管理画面の会話URL。
 * 旧形式 /a/apps/{app}/conversations/{id} は現形式へ301するので、
 * リダイレクトを踏まない現形式を直接組む。
 */
export function intercomUrl(conversationId: string | null | undefined): string | null {
  const id = String(conversationId ?? '').trim();
  if (!/^\d+$/.test(id)) return null;
  return `https://app.intercom.com/a/inbox/${INTERCOM_APP_ID}/inbox/conversation/${id}`;
}

/**
 * Notion ページURL。CSE チケットも議事録も実体は Notion ページで、
 * どちらもハイフン付き UUID が入っている。ハイフンを抜いた32桁形式で開ける。
 */
export function notionUrl(pageId: string | null | undefined): string | null {
  const id = String(pageId ?? '').replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(id) ? `https://www.notion.so/${id}` : null;
}

/** slack / chatwork はリンクを持たない。抜粋で示す */
export function sourceUrl(source: string, recordId: string | null): string | null {
  if (!recordId) return null;
  if (source === 'intercom') return intercomUrl(recordId);
  if (source === 'minutes' || source === 'ticket') return notionUrl(recordId);
  return null;
}

export const SOURCE_LABEL: Record<string, string> = {
  minutes:  'Notion 議事録',
  intercom: 'Intercom',
  chatwork: 'Chatwork',
  slack:    'Slack',
  ticket:   'CSE チケット',
};
