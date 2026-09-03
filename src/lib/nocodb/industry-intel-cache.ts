// ─── industry_intel_cache（業界インテルの週次キャッシュ）─────────────────────
//
// 市場・業界の調査は **Web検索 + LLM** で、1回あたり数十秒とコストがかかる。
// これまでプロセス内キャッシュだけだったため、
// **サーバー再起動やインスタンス切替のたびに消えて、開くたびに再検索**していた。
//
// 外部情報は日次で変わるものではないので、週1のバッチで取って保存し、
// 画面は保存済みを読む。手動更新（?industry=refresh）は残す。
//
// ── テーブル定義（m4ll0ogmq3x9odj / 主キー id）─────────────────────────────
//   company_uid, company_name, industry_name
//   intel_json     IndustryIntel をそのまま
//   trend_count, cost_usd, error
//   fetched_at_jst, updated_at_jst

import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';
import type { IndustryIntel } from '@/lib/company/industry-intel';

export interface IndustryIntelRow {
  id?:            number;
  company_uid:    string;
  company_name:   string | null;
  industry_name:  string | null;
  intel_json:     string | null;
  trend_count:    number | null;
  cost_usd:       string | null;
  error:          string | null;
  fetched_at_jst: string | null;
  updated_at_jst: string | null;
}

export function isIndustryCacheEnabled(): boolean {
  return Boolean(TABLE_IDS.industry_intel_cache);
}

/** 保存済みの業界インテル。無ければ null */
export async function fetchStoredIndustryIntel(
  companyUid: string,
): Promise<{ intel: IndustryIntel | null; fetchedAt: string | null; ageDays: number | null }> {
  const tableId = TABLE_IDS.industry_intel_cache;
  if (!tableId) return { intel: null, fetchedAt: null, ageDays: null };

  const rows = await nocoFetch<IndustryIntelRow>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-updated_at_jst',
    limit: '1',
  }, false).catch(() => [] as IndustryIntelRow[]);

  const r = rows[0];
  if (!r?.intel_json) return { intel: null, fetchedAt: null, ageDays: null };

  try {
    const intel = JSON.parse(r.intel_json) as IndustryIntel;
    const t = r.fetched_at_jst ? new Date(r.fetched_at_jst.replace(' ', 'T') + ':00+09:00').getTime() : NaN;
    return {
      intel,
      fetchedAt: r.fetched_at_jst,
      ageDays: Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400_000),
    };
  } catch {
    return { intel: null, fetchedAt: null, ageDays: null };
  }
}

/** 同じ company_uid があれば更新、無ければ作成 */
export async function saveIndustryIntel(input: {
  companyUid:  string;
  companyName: string | null;
  intel:       IndustryIntel | null;
  error?:      string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const tableId = TABLE_IDS.industry_intel_cache;
  if (!tableId) return { ok: false, error: 'NOCODB_INDUSTRY_INTEL_TABLE_ID が未設定です' };

  const now = jstStamp();
  const fields = {
    company_uid:  input.companyUid,
    company_name: input.companyName,
    industry_name: input.intel?.industry ?? null,
    intel_json:   input.intel ? JSON.stringify(input.intel) : null,
    trend_count:  input.intel?.trends?.length ?? 0,
    // NocoDB の Number は小数不可なので文字列で持つ
    cost_usd:     input.intel?.costUsd != null ? String(input.intel.costUsd) : null,
    error:        input.error ?? null,
    fetched_at_jst: now,
    updated_at_jst: now,
  };

  try {
    const existing = await nocoFetch<IndustryIntelRow>(tableId, {
      where: `(company_uid,eq,${input.companyUid})`,
      limit: '1',
    }, false).catch(() => [] as IndustryIntelRow[]);

    if (existing[0]?.id) {
      // 主キーは小文字 `id`（自作テーブル）。既定の `Id` を送ると 404 になる
      await nocoUpdate(tableId, existing[0].id, fields, 'id');
    } else {
      await nocoCreate(tableId, fields);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function jstStamp(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
}

// ── 一覧取得（ホーム画面用）──────────────────────────────────────────────────

/**
 * 保存済みの業界インテルを全社分読む。
 *
 * ホーム画面の「業界ニュース」は**週次バッチが保存したものだけ**を見る。
 * ここで Web 検索に落ちると1社85秒かかるので、**絶対にフォールバックしない**。
 * 取得できていない企業は「未取得」として件数で示す（黙って空にしない）。
 */
export async function fetchAllStoredIndustryIntel(
  limit = 500,
): Promise<Array<{
  companyUid:   string;
  companyName:  string | null;
  industryName: string | null;
  intel:        IndustryIntel | null;
  error:        string | null;
  fetchedAt:    string | null;
  ageDays:      number | null;
}>> {
  const tableId = TABLE_IDS.industry_intel_cache;
  if (!tableId) return [];

  const rows = await nocoFetch<IndustryIntelRow>(tableId, {
    sort:  '-updated_at_jst',
    limit: String(Math.min(limit, 1000)),
  }, false).catch(() => [] as IndustryIntelRow[]);

  // 同じ company_uid が複数行あっても最新1行だけ使う（upsert 失敗時の重複対策）
  const seen = new Set<string>();
  const out: Array<ReturnType<typeof toEntry>> = [];
  for (const r of rows) {
    if (!r.company_uid || seen.has(r.company_uid)) continue;
    seen.add(r.company_uid);
    out.push(toEntry(r));
  }
  return out;
}

function toEntry(r: IndustryIntelRow) {
  let intel: IndustryIntel | null = null;
  if (r.intel_json) {
    try { intel = JSON.parse(r.intel_json) as IndustryIntel; } catch { intel = null; }
  }
  const t = r.fetched_at_jst
    ? new Date(r.fetched_at_jst.replace(' ', 'T') + ':00+09:00').getTime()
    : NaN;
  return {
    companyUid:   r.company_uid,
    companyName:  r.company_name ?? null,
    industryName: r.industry_name ?? intel?.industry ?? null,
    intel,
    error:        r.error ?? null,
    fetchedAt:    r.fetched_at_jst ?? null,
    ageDays:      Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400_000),
  };
}
