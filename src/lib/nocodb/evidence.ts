import { nocoFetch, TABLE_IDS } from './client';
import { RawEvidence, AppEvidence, AppLogEntry, toAppEvidence, toAppLogEntry } from './types';

/** Evidence 一覧（Company Detail 用） */
export async function fetchEvidence(companyUid: string): Promise<AppEvidence[]> {
  const raw = await nocoFetch<RawEvidence>(TABLE_IDS.evidence, {
    where: `(company_uid,eq,${companyUid})`,
    sort: '-date',
    limit: '200',
  });
  return raw.map(toAppEvidence);
}

/** Evidence → LogEntry（Unified Log 用） */
export async function fetchLogEntries(companyUid: string): Promise<AppLogEntry[]> {
  const raw = await nocoFetch<RawEvidence>(TABLE_IDS.evidence, {
    where: `(company_uid,eq,${companyUid})`,
    sort: '-date',
    limit: '200',
  });
  return raw.map(toAppLogEntry);
}

// ── Evidence 並び順ヘルパー ──────────────────────────────────────────────────
//
// 並び順方針:
//   1. リスク・機会シグナルを先頭（scope が "risk" | "opportunity"）
//   2. 同一 priority グループ内は date 降順（最新が先）
//   3. support / ticket ソースを通常ログより上位
//
// Company Detail の evidence[] を UI に渡す直前に適用する。

/** evidence の表示優先度グループ（小さい数値ほど上位） */
function evidencePriorityGroup(e: AppEvidence): number {
  const scope = (e.scope ?? '').toLowerCase();
  const src   = (e.sourceType ?? '').toLowerCase();

  // リスク・機会シグナルは最優先
  if (scope === 'risk' || scope === 'opportunity') return 0;

  // サポート・チケットは次点
  if (src === 'support' || src === 'ticket' || src === 'inquiry') return 1;

  // 通常ログ
  return 2;
}

function parseDateMs(dateStr: string): number {
  if (!dateStr) return 0;
  const ms = new Date(dateStr.trim().replace(' ', 'T')).getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Evidence 一覧を表示向けに並べ替える。
 * - リスク・機会シグナルを先頭
 * - 同一グループ内は date 降順
 * - サポート / チケットソースを通常ログより上位
 *
 * 元の配列を変更せずコピーを返す。
 */
export function sortEvidenceForDisplay(items: AppEvidence[]): AppEvidence[] {
  return [...items].sort((a, b) => {
    const gDiff = evidencePriorityGroup(a) - evidencePriorityGroup(b);
    if (gDiff !== 0) return gDiff;
    // 同グループ内は新しいものが先
    return parseDateMs(b.date) - parseDateMs(a.date);
  });
}
