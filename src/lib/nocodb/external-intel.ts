// ─── company_external_intel（外部WHO情報）NocoDB ヘルパー ────────────────────
//
// 外部で観測した事象（IR の DX 投資・組織改編・求人・競合導入など）を、
// signal_id に変換した状態で保存する。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11
//
// ⚠️ graceful degradation:
//   NOCODB_EXTERNAL_INTEL_TABLE_ID が未設定でも壊れない。
//   - read  → 空配列（議事録からのキーワード抽出だけで動作する）
//   - write → { ok: false, skipped: true } を返す（例外を投げない）
//   テーブル未作成の間も、外部機会の自動判定は議事録由来の第一層で機能する。
//
// ── NocoDB テーブル定義（手動作成が必要）──────────────────────────────────────
//   intel_id      Single line text   "xi_..." アプリ生成
//   company_uid   Single line text
//   signal_id     Single select      X5_Mkt_DXInvestment / X6_Org_NewTeamFormed /
//                                    X7_Org_ExecChange / X8_Org_HiringSurge /
//                                    X9_Mkt_CompetitorAdoption / X10_Mkt_StrategyShift
//   headline      Single line text   1行で何が起きたか
//   excerpt       Long text          根拠となる原文の抜粋
//   source        Single select      hiring / press / ir / news / manual / minutes
//   source_url    URL                出典URL（必須運用）
//   source_ref    Single line text   資料名・議事録IDなど
//   occurred_at   Single line text   "YYYY-MM-DD"（事象の日付）
//   confidence    Decimal            0-1
//   dismissed     Checkbox           担当者が打ち消した
//   created_by    Single line text
//   created_at    Date time
//
// ⚠️ 主キー: `id`（uidt=ID）を**必ず持たせる**。
//   初回作成時に ID 列を省いたため主キーが無く、行を識別できず API から削除も
//   更新もできない状態になった（project_user_snapshots と同じ罠）。
//   後付けは既存行があると通らないため、テーブルを作り直して復旧した。

import { TABLE_IDS, nocoFetch, nocoFetchByUids } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';
import type { ExternalSignalItem, ExternalSignalId, IntelSource } from '@/lib/company/external-signal';

// ── Raw 型 ────────────────────────────────────────────────────────────────────

export interface RawExternalIntel {
  /** 主キー。テーブル再作成時に uidt=ID の `id` 列として作った（小文字） */
  id:            number;
  intel_id?:     string | null;
  company_uid?:  string | null;
  signal_id?:    string | null;
  headline?:     string | null;
  excerpt?:      string | null;
  source?:       string | null;
  source_url?:   string | null;
  source_ref?:   string | null;
  occurred_at?:  string | null;
  confidence?:   number | string | null;
  dismissed?:    boolean | number | string | null;
  created_by?:   string | null;
  created_at?:   string | null;
}

const VALID_SIGNAL_IDS = new Set<string>([
  'X5_Mkt_DXInvestment', 'X6_Org_NewTeamFormed', 'X7_Org_ExecChange',
  'X8_Org_HiringSurge', 'X9_Mkt_CompetitorAdoption', 'X10_Mkt_StrategyShift',
]);
const VALID_SOURCES = new Set<string>(['hiring', 'press', 'ir', 'news', 'manual', 'minutes']);

export function toExternalSignalItem(raw: RawExternalIntel): ExternalSignalItem | null {
  const signalId = String(raw.signal_id ?? '');
  if (!VALID_SIGNAL_IDS.has(signalId)) return null;  // 未知の signal_id は捨てる

  const source = String(raw.source ?? 'manual');

  return {
    signalId:   signalId as ExternalSignalId,
    headline:   String(raw.headline ?? '').trim() || '(見出しなし)',
    excerpt:    String(raw.excerpt ?? ''),
    source:     (VALID_SOURCES.has(source) ? source : 'manual') as IntelSource,
    sourceUrl:  raw.source_url ? String(raw.source_url) : null,
    sourceRef:  raw.source_ref ? String(raw.source_ref) : null,
    occurredAt: raw.occurred_at ? String(raw.occurred_at).slice(0, 10) : null,
    confidence: toNumber(raw.confidence, 0.8),
    dismissed:  toBool(raw.dismissed),
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * 1企業の外部シグナルを取得する。テーブル未設定時は空配列。
 *
 * ⚠️ キャッシュしない（ttl=false）。登録した外部情報は提案の型を即座に変えるため、
 *    既定TTL（300秒）が効くと「登録したのに機会なしのまま」になり判定を誤らせる。
 */
export async function fetchExternalIntel(companyUid: string): Promise<ExternalSignalItem[]> {
  const tableId = TABLE_IDS.external_intel;
  if (!tableId) return [];

  const rows = await nocoFetch<RawExternalIntel>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-occurred_at',
    limit: '200',
  }, false).catch(() => [] as RawExternalIntel[]);

  return rows.map(toExternalSignalItem).filter((v): v is ExternalSignalItem => v !== null);
}

/** 複数企業の外部シグナルを一括取得する（ボード用）。テーブル未設定時は空 Map */
export async function fetchExternalIntelByUids(
  companyUids: string[],
): Promise<Map<string, ExternalSignalItem[]>> {
  const result = new Map<string, ExternalSignalItem[]>(companyUids.map(u => [u, []]));
  const tableId = TABLE_IDS.external_intel;
  if (!tableId || companyUids.length === 0) return result;

  const rawMap = await nocoFetchByUids<RawExternalIntel>(tableId, companyUids, {
    sort:  '-occurred_at',
    limit: String(Math.min(companyUids.length * 20, 1000)),
  }, false).catch(() => new Map<string, RawExternalIntel[]>());

  for (const [uid, rows] of rawMap) {
    result.set(uid, rows.map(toExternalSignalItem).filter((v): v is ExternalSignalItem => v !== null));
  }
  return result;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface CreateExternalIntelPayload {
  companyUid: string;
  signalId:   ExternalSignalId;
  headline:   string;
  excerpt:    string;
  source:     IntelSource;
  sourceUrl:  string | null;
  sourceRef:  string | null;
  occurredAt: string | null;
  confidence: number;
  createdBy:  string | null;
}

export interface WriteResult {
  ok:      boolean;
  skipped: boolean;
  intelId?: string;
  error?:  string;
}

/**
 * 外部シグナルを1件保存する。
 * テーブル未設定時は例外を投げず { ok:false, skipped:true } を返す。
 */
export async function createExternalIntel(
  payload: CreateExternalIntelPayload,
): Promise<WriteResult> {
  const tableId = TABLE_IDS.external_intel;
  if (!tableId) {
    return {
      ok: false, skipped: true,
      error: 'NOCODB_EXTERNAL_INTEL_TABLE_ID が未設定です。NocoDB に company_external_intel を作成し .env に追加してください。',
    };
  }

  const intelId = `xi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await nocoCreate(tableId, {
      intel_id:    intelId,
      company_uid: payload.companyUid,
      signal_id:   payload.signalId,
      headline:    payload.headline,
      excerpt:     payload.excerpt,
      source:      payload.source,
      source_url:  payload.sourceUrl,
      source_ref:  payload.sourceRef,
      occurred_at: payload.occurredAt,
      confidence:  payload.confidence,
      dismissed:   false,
      created_by:  payload.createdBy,
      created_at:  new Date().toISOString(),
    });
    return { ok: true, skipped: false, intelId };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 担当者による打ち消し / 復帰（推定を人が上書きできるようにする） */
export async function setExternalIntelDismissed(
  rowId: number,
  dismissed: boolean,
): Promise<WriteResult> {
  const tableId = TABLE_IDS.external_intel;
  if (!tableId) return { ok: false, skipped: true, error: 'NOCODB_EXTERNAL_INTEL_TABLE_ID が未設定です' };
  try {
    await nocoUpdate(tableId, rowId, { dismissed });
    return { ok: true, skipped: false };
  } catch (e) {
    return { ok: false, skipped: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function toNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isNaN(n) ? fallback : n;
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}
