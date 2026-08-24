// ─── proposal_outlines（提案骨子の保存）NocoDB ヘルパー ──────────────────────
//
// 作った骨子を残し、いつでも開き直して作り直せるようにする。
//
// ── NocoDB テーブル定義（2026-08-21 作成 / mjwwirhtqf3pee2）─────────────────
//   id              ID（**主キー。必須**）
//   company_uid     SingleLineText
//   company_name    SingleLineText
//   title           SingleLineText   骨子のタイトル（一覧の見出し）
//   intent_name     SingleLineText   選んだ狙い（カタログの名称）
//   proposal_type   SingleLineText   fde / product
//   frame_name      SingleLineText
//   instruction     LongText         生成時の指示
//   outline_json    LongText         ProposalOutlineResponse をそのまま
//   context_ids     LongText         使ったコンテキストID（JSON配列）
//   custom_context  LongText         担当者の追記（JSON配列）
//   created_by      SingleLineText
//   created_at_jst  SingleLineText   "YYYY-MM-DD HH:mm"
//   updated_at_jst  SingleLineText
//
// 主キーを必ず持たせる理由: PK が無いと行を識別できず、API から更新・削除が
// できなくなる（project_user_snapshots / 初回の company_external_intel で実際に発生）。
//
// graceful degradation: テーブル未設定でも壊れない。read は空配列、write は skipped を返す。
// 骨子そのものは保存できなくても生成できる必要がある。

import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate, nocoDelete } from '@/lib/nocodb/write';

export interface RawProposalOutline {
  id:              number;
  company_uid?:    string | null;
  company_name?:   string | null;
  title?:          string | null;
  intent_name?:    string | null;
  proposal_type?:  string | null;
  frame_name?:     string | null;
  instruction?:    string | null;
  outline_json?:   string | null;
  context_ids?:    string | null;
  custom_context?: string | null;
  created_by?:     string | null;
  created_at_jst?: string | null;
  updated_at_jst?: string | null;
}

/** 一覧に出す最小情報（outline_json は重いので一覧では返さない） */
export interface SavedOutlineSummary {
  id:           number;
  title:        string;
  intentName:   string;
  proposalType: string;
  frameName:    string | null;
  createdAt:    string | null;
  updatedAt:    string | null;
  createdBy:    string | null;
  /** 使ったコンテキストの件数（一覧で規模がわかる） */
  contextCount: number;
}

/** 開き直すときに必要な全部 */
export interface SavedOutlineDetail extends SavedOutlineSummary {
  companyName:   string;
  instruction:   string;
  /** ProposalOutlineResponse。型は API 側で解釈する */
  outline:       unknown;
  contextIds:    string[];
  customContext: Array<{ title: string; detail: string }>;
}

// ── 変換 ──────────────────────────────────────────────────────────────────────

function parseArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v as T[] : fallback;
  } catch {
    return fallback;
  }
}

function toSummary(raw: RawProposalOutline): SavedOutlineSummary {
  return {
    id:           raw.id,
    title:        String(raw.title ?? '（無題）'),
    intentName:   String(raw.intent_name ?? ''),
    proposalType: String(raw.proposal_type ?? 'product'),
    frameName:    raw.frame_name ? String(raw.frame_name) : null,
    createdAt:    raw.created_at_jst ?? null,
    updatedAt:    raw.updated_at_jst ?? null,
    createdBy:    raw.created_by ?? null,
    contextCount: parseArray<string>(raw.context_ids, []).length,
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** 1企業の保存済み骨子の一覧（新しい順）。テーブル未設定時は空配列 */
export async function fetchSavedOutlines(companyUid: string): Promise<SavedOutlineSummary[]> {
  const tableId = TABLE_IDS.proposal_outlines;
  if (!tableId) return [];

  const rows = await nocoFetch<RawProposalOutline>(tableId, {
    where:  `(company_uid,eq,${companyUid})`,
    sort:   '-id',
    // outline_json は重いので一覧では取らない
    fields: 'id,title,intent_name,proposal_type,frame_name,created_at_jst,updated_at_jst,created_by,context_ids',
    limit:  '100',
  }, false).catch(() => [] as RawProposalOutline[]);

  return rows.map(toSummary);
}

/** 1件の全内容。見つからなければ null */
export async function fetchSavedOutline(rowId: number): Promise<SavedOutlineDetail | null> {
  const tableId = TABLE_IDS.proposal_outlines;
  if (!tableId) return null;

  const rows = await nocoFetch<RawProposalOutline>(tableId, {
    where: `(id,eq,${rowId})`,
    limit: '1',
  }, false).catch(() => [] as RawProposalOutline[]);

  const raw = rows[0];
  if (!raw) return null;

  let outline: unknown = null;
  try {
    outline = raw.outline_json ? JSON.parse(raw.outline_json) : null;
  } catch {
    outline = null;
  }

  return {
    ...toSummary(raw),
    companyName:   String(raw.company_name ?? ''),
    instruction:   String(raw.instruction ?? ''),
    outline,
    contextIds:    parseArray<string>(raw.context_ids, []),
    customContext: parseArray<{ title: string; detail: string }>(raw.custom_context, []),
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface SaveOutlinePayload {
  /** 指定があれば更新、無ければ新規 */
  rowId?:        number | null;
  companyUid:    string;
  companyName:   string;
  title:         string;
  intentName:    string;
  proposalType:  string;
  frameName:     string | null;
  instruction:   string;
  outline:       unknown;
  contextIds:    string[];
  customContext: Array<{ title: string; detail: string }>;
  createdBy?:    string | null;
}

export async function saveOutline(
  payload: SaveOutlinePayload,
): Promise<{ ok: boolean; skipped: boolean; rowId?: number; error?: string }> {
  const tableId = TABLE_IDS.proposal_outlines;
  if (!tableId) {
    return { ok: false, skipped: true, error: 'NOCODB_PROPOSAL_OUTLINES_TABLE_ID が未設定です' };
  }

  const now = jstNow();
  const fields = {
    company_uid:    payload.companyUid,
    company_name:   payload.companyName,
    title:          payload.title.slice(0, 250),
    intent_name:    payload.intentName,
    proposal_type:  payload.proposalType,
    frame_name:     payload.frameName,
    instruction:    payload.instruction,
    outline_json:   JSON.stringify(payload.outline),
    context_ids:    JSON.stringify(payload.contextIds),
    custom_context: JSON.stringify(payload.customContext),
    updated_at_jst: now,
  };

  try {
    if (payload.rowId) {
      // 主キーは小文字 `id`（自作テーブル）。既定の `Id` を送ると 404 になる
      await nocoUpdate(tableId, payload.rowId, fields, 'id');
      return { ok: true, skipped: false, rowId: payload.rowId };
    }
    const created = await nocoCreate<{ id?: number; Id?: number }>(tableId, {
      ...fields,
      created_by:     payload.createdBy ?? null,
      created_at_jst: now,
    });
    return { ok: true, skipped: false, rowId: created.id ?? created.Id };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSavedOutline(
  rowId: number,
): Promise<{ ok: boolean; error?: string }> {
  const tableId = TABLE_IDS.proposal_outlines;
  if (!tableId) return { ok: false, error: 'NOCODB_PROPOSAL_OUTLINES_TABLE_ID が未設定です' };
  try {
    await nocoDelete(tableId, rowId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** "YYYY-MM-DD HH:mm"（JST） */
function jstNow(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}
