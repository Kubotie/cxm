// ─── POST /api/support/rebuild-display-fields ────────────────────────────────
// log_intercom / cse_tickets の display_title / display_message を AI で生成・更新する。
// source tables の元データ列は一切更新せず、表示用キャッシュ列のみを PATCH する。
//
// ── リクエストボディ ──────────────────────────────────────────────────────────
// {
//   table?:    "log_intercom" | "cse_tickets" | "all"  (default: "all")
//   limit?:    number    (default: 20, max: 100)
//   force?:    boolean   (default: false — display_title が空のレコードのみ対象)
//   dry_run?:  boolean   (default: false)
//   sort?:     "latest" | "oldest"  (default: "latest")
//     ソート基準:
//       log_intercom → sent_at_jst  (desc: latest / asc: oldest)
//       cse_tickets  → created_at   (desc: latest / asc: oldest)
//   case_ids?: string[]  指定時は limit/force/sort を無視し、この ID のみ対象
//     log_intercom → case_id カラムで絞り込み
//     cse_tickets  → ticket_id カラムで絞り込み
// }
//
// ── レスポンス（dry_run=false） ────────────────────────────────────────────────
// {
//   dry_run:         false,
//   table, limit, force, sort,
//   total_targeted, total_updated, total_failed,
//   tables: [{
//     table:    string,
//     targeted, updated, failed,
//     results:  [{ id, business_id, display_title, status, error? }]
//   }]
// }
//
// ── レスポンス（dry_run=true） ─────────────────────────────────────────────────
// {
//   dry_run:        true,
//   table, limit, force, sort,
//   total_targeted: number,
//   tables: [{
//     table:       string,
//     targeted:    number,
//     records: [{
//       id:          number,   // NocoDB 内部 Id
//       business_id: string,   // case_id / ticket_id
//       date:        string,   // sent_at_jst / created_at
//       display_title: string  // 現在の値（空なら未生成）
//     }]
//   }]
// }

import { NextRequest, NextResponse } from 'next/server';
import { checkBatchAuth } from '@/lib/batch/auth';
import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoUpdate } from '@/lib/nocodb/write';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  DISPLAY_FIELDS_SYSTEM_PROMPT,
  DISPLAY_FIELDS_JSON_SCHEMA,
  buildDisplayFieldsPromptForIntercom,
  buildDisplayFieldsPromptForCseTicket,
} from '@/lib/prompts/display-fields';
import type { DisplayFieldsResult } from '@/lib/prompts/display-fields';

// ── 定数 ─────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

// ── 型定義 ────────────────────────────────────────────────────────────────────

type TargetTable = 'log_intercom' | 'cse_tickets';
type SortOrder   = 'latest' | 'oldest';

interface RequestBody {
  table?:    'log_intercom' | 'cse_tickets' | 'all';
  limit?:    number;
  force?:    boolean;
  dry_run?:  boolean;
  sort?:     SortOrder;
  case_ids?: string[];
}

interface RecordResult {
  id:            number;
  business_id:   string;   // case_id / ticket_id
  display_title: string;
  status:        'ok' | 'failed';
  error?:        string;
}

interface TableResult {
  table:    TargetTable;
  targeted: number;
  updated:  number;
  failed:   number;
  results:  RecordResult[];
}

// dry_run 用のレコード情報
interface DryRunRecord {
  id:            number;
  business_id:   string;
  date:          string;
  display_title: string;
}

// NocoDB raw レコード（最小限のフィールド定義）
interface RawRecord {
  Id:            number;
  case_id?:      string | null;   // log_intercom
  ticket_id?:    string | null;   // cse_tickets
  sent_at_jst?:  string | null;   // log_intercom の日時基準
  created_at?:   string | null;   // cse_tickets の日時基準
  display_title?: string | null;
  [key: string]: unknown;
}

// ── ソート基準（テーブルごと）────────────────────────────────────────────────
// NocoDB v2: sort=field (asc) / sort=-field (desc)

const SORT_FIELD: Record<TargetTable, string> = {
  log_intercom: 'sent_at_jst',
  cse_tickets:  'created_at',
};

// ── NocoDB クエリパラメータ構築 ───────────────────────────────────────────────

function buildFetchParams(
  tableName: TargetTable,
  opts: {
    limit:    number;
    force:    boolean;
    sort:     SortOrder;
    caseIds?: string[];
  },
): Record<string, string> {
  const params: Record<string, string> = { limit: String(opts.limit) };

  if (opts.caseIds && opts.caseIds.length > 0) {
    // case_ids 指定: 該当 business key のみ対象（force / sort / blank フィルタは無視）
    const field = tableName === 'log_intercom' ? 'case_id' : 'ticket_id';
    params.where = opts.caseIds.map(id => `(${field},eq,${id})`).join('~or');
    return params;
  }

  // force=false → display_title が空のレコードのみ
  if (!opts.force) params.where = '(display_title,blank)';

  // sort: latest → desc (-field), oldest → asc (field)
  const field = SORT_FIELD[tableName];
  params.sort = opts.sort === 'latest' ? `-${field}` : field;

  return params;
}

// ── per-table 処理 ─────────────────────────────────────────────────────────────

async function processTable(
  tableId:   string,
  tableName: TargetTable,
  params:    Record<string, string>,
  openai:    ReturnType<typeof getOpenAIClient>,
  model:     string,
): Promise<TableResult> {
  const records = await nocoFetch<RawRecord>(tableId, params);

  const result: TableResult = {
    table:    tableName,
    targeted: records.length,
    updated:  0,
    failed:   0,
    results:  [],
  };

  for (const record of records) {
    const businessId = tableName === 'log_intercom'
      ? (record.case_id   ? String(record.case_id)   : String(record.Id))
      : (record.ticket_id ? String(record.ticket_id) : String(record.Id));

    try {
      const userPrompt = tableName === 'log_intercom'
        ? buildDisplayFieldsPromptForIntercom({
            body:         record.body         as string | null,
            account_name: record.account_name as string | null,
            massage_type: record.massage_type as string | null,
          })
        : buildDisplayFieldsPromptForCseTicket({
            title:    record.title    as string | null,
            describe: record.describe as string | null,
            body:     record.body     as string | null,
            comment:  record.comment  as string | null,
            product:  record.product  as string | null,
          });

      const comp = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: DISPLAY_FIELDS_SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
        response_format: { type: 'json_schema', json_schema: DISPLAY_FIELDS_JSON_SCHEMA },
      });

      const raw = comp.choices[0].message.content;
      if (!raw) throw new Error('OpenAI から空のレスポンス');

      const r: DisplayFieldsResult = JSON.parse(raw);

      // display_title / display_message のみ更新（他フィールドは触らない）
      await nocoUpdate(tableId, record.Id, {
        display_title:   r.display_title,
        display_message: r.display_message,
      });

      result.updated++;
      result.results.push({
        id:            record.Id,
        business_id:   businessId,
        display_title: r.display_title,
        status:        'ok',
      });

      console.log(`[rebuild-display-fields] ${tableName}#${record.Id} (${businessId}) → "${r.display_title}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.results.push({
        id:            record.Id,
        business_id:   businessId,
        display_title: '',
        status:        'failed',
        error:         msg,
      });
      console.error(`[rebuild-display-fields] ${tableName}#${record.Id} (${businessId}) failed:`, msg);
    }
  }

  return result;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 認証 ──────────────────────────────────────────────────────────────────
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const body: RequestBody = await req.json().catch(() => ({}));

  // ── パラメータ正規化 ───────────────────────────────────────────────────────
  const tableSpec = body.table    ?? 'all';
  const limit     = Math.min(body.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const force     = body.force    ?? false;
  const dryRun    = body.dry_run  ?? false;
  const sort      = body.sort     ?? 'latest';
  const caseIds   = body.case_ids?.length ? body.case_ids : undefined;

  // ── 対象テーブルを解決 ────────────────────────────────────────────────────
  const targets: { tableId: string; tableName: TargetTable }[] = [];

  if ((tableSpec === 'log_intercom' || tableSpec === 'all') && TABLE_IDS.log_intercom) {
    targets.push({ tableId: TABLE_IDS.log_intercom, tableName: 'log_intercom' });
  }
  if ((tableSpec === 'cse_tickets' || tableSpec === 'all') && TABLE_IDS.cse_tickets) {
    targets.push({ tableId: TABLE_IDS.cse_tickets, tableName: 'cse_tickets' });
  }

  if (targets.length === 0) {
    return NextResponse.json({
      error: 'テーブルIDが未設定です。NOCODB_LOG_INTERCOM_TABLE_ID / NOCODB_CSE_TICKETS_TABLE_ID を確認してください。',
      table: tableSpec,
    }, { status: 400 });
  }

  // ── dry_run: 対象レコードの情報を返す（更新しない）────────────────────────
  if (dryRun) {
    const dryResults = await Promise.all(
      targets.map(async ({ tableId, tableName }) => {
        const params = buildFetchParams(tableName, { limit, force, sort, caseIds });
        const records = await nocoFetch<RawRecord>(tableId, params).catch(() => [] as RawRecord[]);

        const dryRecords: DryRunRecord[] = records.map(r => ({
          id:          r.Id,
          business_id: tableName === 'log_intercom'
            ? (r.case_id   ? String(r.case_id)   : String(r.Id))
            : (r.ticket_id ? String(r.ticket_id) : String(r.Id)),
          date: tableName === 'log_intercom'
            ? (r.sent_at_jst ? String(r.sent_at_jst).slice(0, 16) : '—')
            : (r.created_at  ? String(r.created_at).slice(0, 16)  : '—'),
          display_title: r.display_title ? String(r.display_title) : '',
        }));

        return {
          table:    tableName,
          targeted: records.length,
          records:  dryRecords,
        };
      }),
    );

    return NextResponse.json({
      dry_run:        true,
      table:          tableSpec,
      limit,
      force,
      sort,
      case_ids:       caseIds ?? null,
      total_targeted: dryResults.reduce((s, r) => s + r.targeted, 0),
      tables:         dryResults,
    });
  }

  // ── OpenAI クライアント初期化 ──────────────────────────────────────────────
  let openai: ReturnType<typeof getOpenAIClient>;
  let model: string;
  try {
    openai = getOpenAIClient();
    model  = getOpenAIModel();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }

  // ── テーブルごとに順次処理 ─────────────────────────────────────────────────
  const tableResults: TableResult[] = [];

  for (const { tableId, tableName } of targets) {
    const params = buildFetchParams(tableName, { limit, force, sort, caseIds });
    console.log(`[rebuild-display-fields] start: ${tableName}`, params);
    const r = await processTable(tableId, tableName, params, openai, model);
    tableResults.push(r);
    console.log(`[rebuild-display-fields] done: ${tableName} updated=${r.updated} failed=${r.failed}`);
  }

  // ── レスポンス ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    dry_run:         false,
    table:           tableSpec,
    limit,
    force,
    sort,
    case_ids:        caseIds ?? null,
    total_targeted:  tableResults.reduce((s, r) => s + r.targeted, 0),
    total_updated:   tableResults.reduce((s, r) => s + r.updated,  0),
    total_failed:    tableResults.reduce((s, r) => s + r.failed,   0),
    tables:          tableResults,
  });
}
