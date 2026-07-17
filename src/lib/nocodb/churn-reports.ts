// ─── churn_retrospective_reports の read/write ────────────────────────────────

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoCreate } from '@/lib/nocodb/write';

export interface ChurnReportRow {
  Id?:                  number;
  report_id:            string;
  week_start:           string;
  week_end:             string;
  window_days:          number;
  churn_total:          number;
  warning_total:        number;
  warning_rate:         number;
  ai_summary:           string;
  ai_key_findings:      string;   // JSON string
  ai_recommendations:   string;   // JSON string
  report_json:          string;   // JSON string
  generated_at:         string;
  model_used:           string;
}

export async function insertChurnReport(row: Omit<ChurnReportRow, 'Id'>): Promise<number | null> {
  const tableId = TABLE_IDS.churn_retrospective_reports;
  if (!tableId) return null;
  const created = await nocoCreate<ChurnReportRow>(tableId, row as Record<string, unknown>);
  return (created as ChurnReportRow).Id ?? null;
}

/**
 * レポート一覧（新しい順）を取得する。UI サイドバー用。
 * ※ このテーブルには Id カラムがないので fields でも Id は指定しない。
 */
export async function fetchChurnReports(limit = 100): Promise<ChurnReportRow[]> {
  const tableId = TABLE_IDS.churn_retrospective_reports;
  if (!tableId) return [];
  return nocoFetch<ChurnReportRow>(tableId, {
    fields: 'report_id,week_start,week_end,window_days,churn_total,warning_total,warning_rate,ai_summary,generated_at,model_used',
    sort:   '-generated_at',
    limit:  String(limit),
  }, false).catch(() => []);
}

/**
 * report_id で 1 件詳細を取得する（report_json 含む）。
 */
export async function fetchChurnReportById(reportId: string): Promise<ChurnReportRow | null> {
  const tableId = TABLE_IDS.churn_retrospective_reports;
  if (!tableId) return null;
  const list = await nocoFetch<ChurnReportRow>(tableId, {
    where: `(report_id,eq,${reportId})`,
    limit: '1',
  }, false).catch(() => []);
  return list[0] ?? null;
}
