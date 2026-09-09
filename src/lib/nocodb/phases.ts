// ─── CSM / CRM phase read helpers ────────────────────────────────────────────
//
// フェーズ表示ルール:
//   CSM 担当あり → csm_customer_phase (M-Phase) を主表示
//   CSM 担当なし → crm_customer_phase (A-Phase) を主表示
//
// read helper は company_uid 単体 / 複数 company_uids の両方に対応する。
// 複数 UID 版は List 画面での一括取得に使用する。

import {
  nocoFetch,
  nocoFetchAll,
  nocoFetchByUids,
  nocoFetchAllByUids,
  TABLE_IDS,
} from '@/lib/nocodb/client';
import {
  toAppCsmPhase,
  toAppCrmPhase,
  type RawCsmPhase,
  type RawCrmPhase,
  type AppCsmPhase,
  type AppCrmPhase,
} from '@/lib/nocodb/types';

// ── crm_customer_phase は「プロジェクト単位」である ─────────────────────────
//
// csm_customer_phase は 1企業 1日 1行だが、crm_customer_phase は
// **1プロジェクト 1日 1行**。1企業が最大107プロジェクトを持つため、
// company_uid で引くと同じ stat_date の行が何十件も返る。
// どれを会社の A-Phase とするか決めないと、表示がリクエストごとに変わる。
//
// → **プロジェクトごとに最新行を採り**、その中で最も進んだ A-Phase を代表とする。
//   習慣化率をバッチ側で「配下PJに1つでも Yes があれば Yes」と集約しているのと
//   同じ考え方（会社は最も進んでいるプロジェクトで語る）。

/** A-Phase の進み具合。"6. Engagement" → 6。空/不明は -1 */
function aPhaseRank(v: unknown): number {
  const m = /^\s*(\d+)/.exec(String(v ?? ''));
  return m ? Number(m[1]) : -1;
}

/**
 * crm_customer_phase を引く窓（日数）。
 * 窓を切らないと1社で数千行になり 1ページ（最大1000件）に収まらない。
 * 週次スナップショットなので5週ぶんあれば最新分を取りこぼさない。
 */
const CRM_LOOKBACK_DAYS = 35;

function crmSinceWhere(): string {
  const since = new Date(Date.now() - CRM_LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return `(stat_date,gt,exactDate,${since})`;
}

/**
 * 会社の代表行を選ぶ。
 *
 * 「最新 stat_date の行だけ見る」ではダメ。週次バッチは1,500件を1件ずつ書くため
 * 実行中は当日分が途中までしか埋まっておらず、その瞬間に引くと
 * 「まだ書かれていない本命PJ」が候補から漏れてフェーズが逆戻りして見える。
 *
 * → **プロジェクトごとに最新行を採り**、その中で最も進んだ A-Phase を代表とする。
 *   同じ進み具合なら stat_date が新しい方を採る。
 */
function pickRepresentativeCrmRow(rows: RawCrmPhase[]): RawCrmPhase | null {
  if (rows.length === 0) return null;
  const dateOf = (r: RawCrmPhase) => String(r.stat_date ?? '').slice(0, 10);

  // プロジェクトごとの最新行（project_id が無い行は Id をキーにして落とさない）
  const newestPerProject = new Map<string, RawCrmPhase>();
  for (const r of rows) {
    const key = String(r.project_id ?? `#${r.Id}`);
    const cur = newestPerProject.get(key);
    if (!cur || dateOf(r) > dateOf(cur)) newestPerProject.set(key, r);
  }

  let best: RawCrmPhase | null = null;
  for (const r of newestPerProject.values()) {
    if (best === null) { best = r; continue; }
    const dr = aPhaseRank(r['A-Phase']);
    const db = aPhaseRank(best['A-Phase']);
    if (dr > db || (dr === db && dateOf(r) > dateOf(best))) best = r;
  }
  return best;
}

// ── 単一 company_uid ─────────────────────────────────────────────────────────

/**
 * 指定企業の CSM フェーズ (M-Phase) を取得する。
 * テーブル未設定 or レコードなし → null
 */
export async function fetchCsmPhase(
  companyUid: string,
): Promise<AppCsmPhase | null> {
  const tableId = TABLE_IDS.csm_customer_phase;
  if (!tableId) return null;
  const list = await nocoFetch<RawCsmPhase>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-stat_date',
    limit: '1',
  });
  return list.length > 0 ? toAppCsmPhase(list[0]) : null;
}

/**
 * 指定企業の CRM フェーズ (A-Phase) を取得する。
 * テーブル未設定 or レコードなし → null
 */
export async function fetchCrmPhase(
  companyUid: string,
): Promise<AppCrmPhase | null> {
  const tableId = TABLE_IDS.crm_customer_phase;
  if (!tableId) return null;
  // ⚠️ limit:1 で引くと「最新日のどれか1プロジェクト」が非決定的に返る。
  //   窓内を全件取って pickRepresentativeCrmRow で代表を決める。
  const rows = await nocoFetchAll<RawCrmPhase>(tableId, {
    where: `(company_uid,eq,${companyUid})~and${crmSinceWhere()}`,
    sort:  '-stat_date',
  });
  const rep = pickRepresentativeCrmRow(rows);
  return rep ? toAppCrmPhase(rep) : null;
}

/**
 * CSM / CRM 両フェーズを並行取得する。
 * company-detail の初期ロードで使用する。
 */
export async function fetchBothPhases(companyUid: string): Promise<{
  csmPhase: AppCsmPhase | null;
  crmPhase: AppCrmPhase | null;
}> {
  const [csmPhase, crmPhase] = await Promise.all([
    fetchCsmPhase(companyUid),
    fetchCrmPhase(companyUid),
  ]);
  return { csmPhase, crmPhase };
}

// ── 複数 company_uids（List 画面向け）────────────────────────────────────────

/**
 * 複数企業の CSM フェーズを一括取得する。
 * 返り値: Map<company_uid, AppCsmPhase>（存在しない UID は Map に含まれない）
 */
export async function fetchCsmPhasesByUids(
  companyUids: string[],
): Promise<Map<string, AppCsmPhase>> {
  const tableId = TABLE_IDS.csm_customer_phase;
  if (!tableId || companyUids.length === 0) return new Map();
  // ⚠️ sort は `stat_date`。`phase_updated_at` は実テーブルに存在せず、
  //   NocoDB は FIELD_NOT_FOUND で **リクエスト全体を404にする**（実測）。
  //   これを踏むと全社フェーズ未取得になり、原因が「CSM未管理」と区別できない。
  // このテーブルは1企業1日1行の履歴形式なので、日付降順の先頭が最新。
  // 履歴が厚いため limit は既定（uids×20/上限500）では足りない。
  const rawMap = await nocoFetchByUids<RawCsmPhase>(tableId, companyUids, {
    sort:  '-stat_date',
    limit: String(Math.min(companyUids.length * 30, 2000)),
  });
  const result = new Map<string, AppCsmPhase>();
  for (const [uid, rows] of rawMap) {
    if (rows.length > 0) result.set(uid, toAppCsmPhase(rows[0]));
  }
  return result;
}

/**
 * 複数企業の CRM フェーズを一括取得する。
 * 返り値: Map<company_uid, AppCrmPhase>
 */
export async function fetchCrmPhasesByUids(
  companyUids: string[],
): Promise<Map<string, AppCrmPhase>> {
  const tableId = TABLE_IDS.crm_customer_phase;
  if (!tableId || companyUids.length === 0) return new Map();
  // ⚠️ CSM 側と同じ罠。実カラムは `stat_date`（`phase_updated_at` は存在しない）。
  // ⚠️ このテーブルはプロジェクト単位で 1社最大107行/日。単一ページの limit では
  //   1社の行だけで埋まり他社が 0 件になるため、必ずページングして窓で絞る。
  const rawMap = await nocoFetchAllByUids<RawCrmPhase>(
    tableId,
    companyUids,
    { sort: '-stat_date' },
    false,
    { andWhere: `~and${crmSinceWhere()}` },
  );
  const result = new Map<string, AppCrmPhase>();
  for (const [uid, rows] of rawMap) {
    const rep = pickRepresentativeCrmRow(rows);
    if (rep) result.set(uid, toAppCrmPhase(rep));
  }
  return result;
}

/**
 * 複数企業の CSM / CRM 両フェーズを並行一括取得する。
 * 返り値: { csmMap, crmMap } — いずれも Map<company_uid, AppPhase>
 */
export async function fetchBothPhasesByUids(companyUids: string[]): Promise<{
  csmMap: Map<string, AppCsmPhase>;
  crmMap: Map<string, AppCrmPhase>;
}> {
  const [csmMap, crmMap] = await Promise.all([
    fetchCsmPhasesByUids(companyUids),
    fetchCrmPhasesByUids(companyUids),
  ]);
  return { csmMap, crmMap };
}

// ── フェーズ履歴（変化検知用）────────────────────────────────────────────────

export interface CsmPhaseWithHistory {
  current:  AppCsmPhase;
  previous: AppCsmPhase | null;
}

/**
 * 複数企業の CSM フェーズを「最新2件」取得し、フェーズ変化を検知できるようにする。
 * - rows[0] = 最新（current）
 * - rows[1] = 直前（previous）— 存在しない場合は null
 *
 * 返り値: Map<company_uid, CsmPhaseWithHistory>
 */
export async function fetchCsmPhasesWithHistoryByUids(
  companyUids: string[],
): Promise<Map<string, CsmPhaseWithHistory>> {
  const tableId = TABLE_IDS.csm_customer_phase;
  if (!tableId || companyUids.length === 0) return new Map();
  // 2件/社 必要なので limit を uids × 2 で要求（上限 1000）
  const limit = String(Math.min(companyUids.length * 2, 1000));
  const rawMap = await nocoFetchByUids<RawCsmPhase>(tableId, companyUids, {
    sort: '-stat_date',
    limit,
  });
  const result = new Map<string, CsmPhaseWithHistory>();
  for (const [uid, rows] of rawMap) {
    if (rows.length === 0) continue;
    result.set(uid, {
      current:  toAppCsmPhase(rows[0]),
      previous: rows.length > 1 ? toAppCsmPhase(rows[1]) : null,
    });
  }
  return result;
}
