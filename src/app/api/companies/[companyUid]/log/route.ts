// ─── GET /api/companies/[companyUid]/log ────────────────────────────────────
//
// Company 単位の横断ログを返す Unified Log API。
//
// ── 統合ソース ──────────────────────────────────────────────────────────────
//   chatwork / slack / notion_minutes → CommunicationEntry[]
//   evidence テーブル                  → AppLogEntry[]
//
// ── レスポンス ─────────────────────────────────────────────────────────────
// {
//   companyUid:      string,
//   commEntries:     CommunicationEntry[],
//   evidenceEntries: AppLogEntry[],
// }
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
// なし（Company Detail と同じ内部 API として扱う）

import { NextRequest, NextResponse }       from 'next/server';
import { fetchAllCommunicationLogs }       from '@/lib/nocodb/communication-logs';
import { fetchLogEntries }                 from '@/lib/nocodb/evidence';
import { buildCommunicationTimeline }      from '@/lib/company/communication-signal';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const [commLogs, evidenceEntries] = await Promise.all([
    fetchAllCommunicationLogs(companyUid).catch(() => ({
      chatwork: [], slack: [], notionMinutes: [],
    })),
    fetchLogEntries(companyUid).catch(() => []),
  ]);

  const commEntries = buildCommunicationTimeline(
    commLogs.chatwork,
    commLogs.slack,
    commLogs.notionMinutes,
  );

  return NextResponse.json({
    companyUid,
    commEntries,
    evidenceEntries,
  });
}
