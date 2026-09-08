// ─── company_campaign_org（施策から読む組織の動きの保存）────────────────────
//
// 明細CSVは13.8MBあり、取得に **本番コールドで28.8秒**かかる（2026-08-24 実測）。
// これまで「押したときだけ取得」にしていたが、
// **毎朝1回落とせば全社分を一度に作れる**ので、日次バッチで先に作って保存する。
// 画面はボタンを押さずに保存済みを読む。
//
// ── テーブル定義（myahvqwhro56iet / 主キー id）────────────────────────────
//   company_uid, company_name
//   payload_json    CompanyCampaignsResponse をそのまま
//   campaign_count, creator_count, project_count
//   error, computed_at_jst, updated_at_jst

import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';

export interface CampaignOrgRow {
  id?:              number;
  company_uid:      string;
  company_name:     string | null;
  payload_json:     string | null;
  campaign_count:   number | null;
  creator_count:    number | null;
  project_count:    number | null;
  error:            string | null;
  computed_at_jst:  string | null;
  updated_at_jst:   string | null;
}

export function isCampaignOrgCacheEnabled(): boolean {
  return Boolean(TABLE_IDS.company_campaign_org);
}

/** 保存済みの組織の動き。無ければ null */
export async function fetchStoredCampaignOrg<T>(
  companyUid: string,
): Promise<{ payload: T | null; computedAt: string | null; ageHours: number | null }> {
  const tableId = TABLE_IDS.company_campaign_org;
  if (!tableId) return { payload: null, computedAt: null, ageHours: null };

  const rows = await nocoFetch<CampaignOrgRow>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-updated_at_jst',
    limit: '1',
  }, false).catch(() => [] as CampaignOrgRow[]);

  const r = rows[0];
  if (!r?.payload_json) return { payload: null, computedAt: null, ageHours: null };

  try {
    const t = r.computed_at_jst
      ? new Date(r.computed_at_jst.replace(' ', 'T') + ':00+09:00').getTime()
      : NaN;
    return {
      payload:    JSON.parse(r.payload_json) as T,
      computedAt: r.computed_at_jst,
      ageHours:   Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 3600_000),
    };
  } catch {
    return { payload: null, computedAt: null, ageHours: null };
  }
}

/** company_uid → 行ID を一括で引く（バッチが1件ずつ SELECT しないため） */
export async function fetchCampaignOrgRowIds(): Promise<Map<string, number>> {
  const tableId = TABLE_IDS.company_campaign_org;
  const out = new Map<string, number>();
  if (!tableId) return out;

  for (let page = 0; page < 10; page++) {
    const rows = await nocoFetch<{ id: number; company_uid: string }>(tableId, {
      fields: 'id,company_uid',
      limit:  '1000',
      offset: String(page * 1000),
    }, false).catch(() => [] as Array<{ id: number; company_uid: string }>);
    for (const r of rows) if (r.company_uid && !out.has(r.company_uid)) out.set(r.company_uid, r.id);
    if (rows.length < 1000) break;
  }
  return out;
}

/**
 * 全社分の「事例機会」だけを一括で読む。**一覧（提案準備ボード）用。**
 *
 * 事例機会の判定には施策名が必要で、施策名は明細CSV（13.8MB）にしかない。
 * 一覧から明細は引けない（本番コールドで28.8秒）ため、
 * **日次バッチが保存した payload から該当部分だけを取り出す。**
 *
 * ⚠️ payload_json は1社あたり十数KBある。**パースしたら必要な枝だけ残して捨てる**
 *   （全体を保持すると102社分がメモリに残る）。
 *   実測（2026-09-08 / dev）: この読み取りを含めてボード API 全体が 1.0〜2.5秒。
 * ⚠️ NocoDB は列を指定して JSON の中を絞れないので、行の絞り込みもしない
 *   （company_uid を100件並べた where はクエリが長くなりすぎる）。
 *   このテーブルは Tier1-3 しか入っていないので、全行読んで索引する。
 */
export async function fetchCaseOpportunityBriefs<T>(
  extract: (payload: unknown) => T | null,
): Promise<Map<string, { value: T; computedAt: string | null }>> {
  const tableId = TABLE_IDS.company_campaign_org;
  const out = new Map<string, { value: T; computedAt: string | null }>();
  if (!tableId) return out;

  // limit は最大2000で黙って切り詰められる。1000ずつ回す
  for (let page = 0; page < 3; page++) {
    const rows = await nocoFetch<CampaignOrgRow>(tableId, {
      fields: 'company_uid,payload_json,computed_at_jst',
      limit:  '1000',
      offset: String(page * 1000),
    }, false).catch(() => [] as CampaignOrgRow[]);

    for (const r of rows) {
      if (!r.company_uid || !r.payload_json || out.has(r.company_uid)) continue;
      try {
        // extract が null を返した = この行では判定できない（形式が古い等）。
        // 「判定したが該当なし」は extract 側が値で表現する（キーの有無で区別する）
        const value = extract(JSON.parse(r.payload_json));
        if (value !== null) out.set(r.company_uid, { value, computedAt: r.computed_at_jst });
      } catch {
        // 壊れた行は黙って飛ばす（1社の欠損で一覧を落とさない）
      }
    }
    if (rows.length < 1000) break;
  }
  return out;
}

export async function saveCampaignOrg(input: {
  companyUid:    string;
  companyName:   string | null;
  payload:       unknown | null;
  campaignCount: number;
  creatorCount:  number;
  projectCount:  number;
  error?:        string | null;
  /** `fetchCampaignOrgRowIds()` の結果。渡すと SELECT を省ける */
  knownId?:      number;
}): Promise<{ ok: boolean; error?: string }> {
  const tableId = TABLE_IDS.company_campaign_org;
  if (!tableId) return { ok: false, error: 'NOCODB_CAMPAIGN_ORG_TABLE_ID が未設定です' };

  const now = jstStamp();
  const fields = {
    company_uid:     input.companyUid,
    company_name:    input.companyName,
    payload_json:    input.payload ? JSON.stringify(input.payload) : null,
    campaign_count:  input.campaignCount,
    creator_count:   input.creatorCount,
    project_count:   input.projectCount,
    error:           input.error ?? null,
    computed_at_jst: now,
    updated_at_jst:  now,
  };

  try {
    let rowId = input.knownId;
    if (rowId === undefined) {
      const existing = await nocoFetch<CampaignOrgRow>(tableId, {
        where: `(company_uid,eq,${input.companyUid})`,
        limit: '1',
      }, false).catch(() => [] as CampaignOrgRow[]);
      rowId = existing[0]?.id;
    }
    // 自作テーブルなので主キーは小文字 `id`
    if (rowId !== undefined) await nocoUpdate(tableId, rowId, fields, 'id');
    else                     await nocoCreate(tableId, fields);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function jstStamp(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
}
