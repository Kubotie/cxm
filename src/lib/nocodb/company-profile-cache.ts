// ─── company_profile_cache（顧客理解プロファイルの保存）──────────────────────
//
// 顧客理解は **議事録8件の本文 + 利用実態 + 外部情報を読ませる LLM 生成**で、
// 1社あたり30秒前後かかる。これまで都度生成だったため、
// **顧客情報タブを開くたびに30秒待たされ、ページの上半分が空白**になっていた。
//
// 業界インテル（industry_intel_cache）と同じ考え方で、
// 週次バッチが書いて画面は保存済みを読む。手動更新（?refresh=1）は残す。
//
// ── テーブル定義（m247ipotimas5y5 / 主キー id）────────────────────────────
//   company_uid, company_name
//   profile_json      CompanyProfileResponse をそのまま
//   headline          一覧で中身を確認するための冗長コピー
//   bullet_count, evidence_count, unknown_count, industry_name, trend_count
//   error, generated_at_jst, updated_at_jst

import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';

export interface CompanyProfileRow {
  id?:               number;
  company_uid:       string;
  company_name:      string | null;
  profile_json:      string | null;
  headline:          string | null;
  bullet_count:      number | null;
  evidence_count:    number | null;
  unknown_count:     number | null;
  industry_name:     string | null;
  trend_count:       number | null;
  error:             string | null;
  generated_at_jst:  string | null;
  updated_at_jst:    string | null;
}

export function isProfileCacheEnabled(): boolean {
  return Boolean(TABLE_IDS.company_profile_cache);
}

/** 保存済みの顧客理解。無ければ null */
export async function fetchStoredProfile<T>(
  companyUid: string,
): Promise<{ profile: T | null; generatedAt: string | null; ageDays: number | null }> {
  const tableId = TABLE_IDS.company_profile_cache;
  if (!tableId) return { profile: null, generatedAt: null, ageDays: null };

  const rows = await nocoFetch<CompanyProfileRow>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-updated_at_jst',
    limit: '1',
  }, false).catch(() => [] as CompanyProfileRow[]);

  const r = rows[0];
  if (!r?.profile_json) return { profile: null, generatedAt: null, ageDays: null };

  try {
    return {
      profile:     JSON.parse(r.profile_json) as T,
      generatedAt: r.generated_at_jst,
      ageDays:     ageDaysOf(r.generated_at_jst),
    };
  } catch {
    return { profile: null, generatedAt: null, ageDays: null };
  }
}

/** 同じ company_uid があれば更新、無ければ作成 */
export async function saveProfile(input: {
  companyUid:   string;
  companyName:  string | null;
  profile:      unknown | null;
  headline:     string | null;
  bulletCount:  number;
  evidenceCount: number;
  unknownCount: number;
  industryName: string | null;
  trendCount:   number;
  error?:       string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const tableId = TABLE_IDS.company_profile_cache;
  if (!tableId) return { ok: false, error: 'NOCODB_COMPANY_PROFILE_TABLE_ID が未設定です' };

  const now = jstStamp();
  const fields = {
    company_uid:      input.companyUid,
    company_name:     input.companyName,
    profile_json:     input.profile ? JSON.stringify(input.profile) : null,
    headline:         input.headline,
    bullet_count:     input.bulletCount,
    evidence_count:   input.evidenceCount,
    unknown_count:    input.unknownCount,
    industry_name:    input.industryName,
    trend_count:      input.trendCount,
    error:            input.error ?? null,
    generated_at_jst: now,
    updated_at_jst:   now,
  };

  try {
    const existing = await nocoFetch<CompanyProfileRow>(tableId, {
      where: `(company_uid,eq,${input.companyUid})`,
      limit: '1',
    }, false).catch(() => [] as CompanyProfileRow[]);

    if (existing[0]?.id) {
      // 自作テーブルなので主キーは小文字 `id`。既定の `Id` を送ると 404 になる
      await nocoUpdate(tableId, existing[0].id, fields, 'id');
    } else {
      await nocoCreate(tableId, fields);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 保存済みの生成日時だけを全社分引く（週次バッチが古い順に処理するため） */
export async function fetchProfileAges(): Promise<Map<string, number | null>> {
  const tableId = TABLE_IDS.company_profile_cache;
  const out = new Map<string, number | null>();
  if (!tableId) return out;

  const rows = await nocoFetch<CompanyProfileRow>(tableId, {
    fields: 'company_uid,generated_at_jst',
    sort:   '-updated_at_jst',
    limit:  '1000',
  }, false).catch(() => [] as CompanyProfileRow[]);

  for (const r of rows) {
    if (!r.company_uid || out.has(r.company_uid)) continue;
    out.set(r.company_uid, ageDaysOf(r.generated_at_jst));
  }
  return out;
}

function ageDaysOf(stamp: string | null | undefined): number | null {
  if (!stamp) return null;
  const t = new Date(stamp.replace(' ', 'T') + ':00+09:00').getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400_000);
}

function jstStamp(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
}
