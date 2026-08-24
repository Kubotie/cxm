// ─── company_situations（手動登録の状況）NocoDB ヘルパー ─────────────────────
//
// 自動検出できない状況IDを保持する。
// Notion A で「検出 = 手動（診断・登録）」になっている語彙が対象:
//   AIREADY_* / SKILL_NoAnalyst / TIME_NoCapacity / USECASE_Unclear /
//   ALIGN_Internal_Misaligned / OWNER_Undefined / GOAL_Undefined /
//   SELF_Sufficient_Claimed / INDUSTRY_NoMatchingCase など
//
// ⚠️ graceful degradation:
//   NOCODB_COMPANY_SITUATIONS_TABLE_ID が未設定でも壊れない。read は空配列を返す。
//   マッチングは「手動状況が空でも動く」設計なので、これで問題ない。
//
// ── NocoDB テーブル定義 ───────────────────────────────────────────────────────
//   id            ID（**主キー。必須**）
//   company_uid   Single line text
//   situation_id  Single line text   Notion A の 状況ID と文字列一致させる
//   source        Single line text   診断 / ヒアリング / 手入力 など
//   note          Long text
//   observed_at   Single line text   "YYYY-MM-DD"
//   created_by    Single line text
//
// 主キーを必ず持たせる理由: PK が無いと行を識別できず、API から削除・更新が
// できなくなる（project_user_snapshots / 初回の company_external_intel で実際に発生）。

import { TABLE_IDS, nocoFetch, nocoFetchByUids } from '@/lib/nocodb/client';
import { nocoCreate } from '@/lib/nocodb/write';

export interface RawCompanySituation {
  id:            number;
  company_uid?:  string | null;
  situation_id?: string | null;
  source?:       string | null;
  note?:         string | null;
  observed_at?:  string | null;
  created_by?:   string | null;
}

export interface CompanySituation {
  rowId:      number;
  companyUid: string;
  situationId: string;
  source:     string | null;
  note:       string;
  observedAt: string | null;
}

function toCompanySituation(raw: RawCompanySituation): CompanySituation | null {
  const situationId = String(raw.situation_id ?? '').trim();
  if (!situationId) return null;
  return {
    rowId:       raw.id,
    companyUid:  String(raw.company_uid ?? ''),
    situationId,
    source:      raw.source ? String(raw.source) : null,
    note:        String(raw.note ?? ''),
    observedAt:  raw.observed_at ? String(raw.observed_at).slice(0, 10) : null,
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** 1企業の手動登録状況。テーブル未設定時は空配列 */
export async function fetchCompanySituations(companyUid: string): Promise<CompanySituation[]> {
  const tableId = TABLE_IDS.company_situations;
  if (!tableId) return [];

  const rows = await nocoFetch<RawCompanySituation>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-observed_at',
    limit: '200',
  }, false).catch(() => [] as RawCompanySituation[]);

  return rows.map(toCompanySituation).filter((v): v is CompanySituation => v !== null);
}

/** 複数企業の手動登録状況を一括取得（ボード用）。テーブル未設定時は空 Map */
export async function fetchCompanySituationsByUids(
  companyUids: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>(companyUids.map(u => [u, []]));
  const tableId = TABLE_IDS.company_situations;
  if (!tableId || companyUids.length === 0) return result;

  const rawMap = await nocoFetchByUids<RawCompanySituation>(tableId, companyUids, {
    limit: String(Math.min(companyUids.length * 20, 1000)),
  }, false).catch(() => new Map<string, RawCompanySituation[]>());

  for (const [uid, rows] of rawMap) {
    const ids = rows
      .map(r => String(r.situation_id ?? '').trim())
      .filter(Boolean);
    result.set(uid, [...new Set(ids)]);
  }
  return result;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createCompanySituation(payload: {
  companyUid:  string;
  situationId: string;
  source:      string;
  note?:       string;
  observedAt?: string | null;
  createdBy?:  string | null;
}): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  const tableId = TABLE_IDS.company_situations;
  if (!tableId) {
    return { ok: false, skipped: true, error: 'NOCODB_COMPANY_SITUATIONS_TABLE_ID が未設定です' };
  }
  try {
    await nocoCreate(tableId, {
      company_uid:  payload.companyUid,
      situation_id: payload.situationId,
      source:       payload.source,
      note:         payload.note ?? '',
      observed_at:  payload.observedAt ?? new Date().toISOString().slice(0, 10),
      created_by:   payload.createdBy ?? null,
    });
    return { ok: true, skipped: false };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : String(e) };
  }
}
