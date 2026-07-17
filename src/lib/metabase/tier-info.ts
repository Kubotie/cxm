// ─── Metabase BI Tier マスター CSV ─────────────────────────────────────────────
//
// https://bi.ptmind.com/public/question/3dcbe335-560e-4270-8e2e-ecd192187710.csv
//
// 概要: CSM 管理対象企業の Tier 分類マスター（Metabase 側 SSOT）
//
// CSV カラム:
//   0: 客户 ID              — SF Account ID（sf_ プレフィックスなし）
//   1: Count                — Metabase の集計用（未使用）
//   2: 会社名               — canonical_name
//   3: Tier                 — "Tier1" / "Tier2" / "Tier3" / "Tier5"（空欄あり）
//   4: Cs 1v1               — "true" / "false"（個別担当ありフラグ）
//   5: Cs担当               — オーナー名（Paul / BB / Eri Kitada 等）
//   6: ご契約アカウント     — "true" / "false"（契約アカウントフラグ）
//
// 日次 batch (/api/batch/tier-sync) が NocoDB companies.tier に upsert する。

const TIER_INFO_CSV_URL =
  'https://bi.ptmind.com/public/question/3dcbe335-560e-4270-8e2e-ecd192187710.csv';

export type TierValue = 1 | 2 | 3 | 5;

export interface TierRow {
  /** SF Account ID（sf_ プレフィックスなし） */
  sfAccountId:  string;
  companyName:  string | null;
  tier:         TierValue | null;
  cs1v1:        boolean;
  csOwner:      string | null;
  hasContract:  boolean;
}

// ── CSV 行パース ─────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseTier(raw: string | undefined): TierValue | null {
  if (!raw) return null;
  const m = raw.trim().match(/^Tier([1-9])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return (n === 1 || n === 2 || n === 3 || n === 5) ? n : null;
}

function parseBool(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true';
}

// ── メイン ───────────────────────────────────────────────────────────────────

/**
 * Tier マスター CSV を取得してパースする。
 * batch は 1 日 1 回しか叩かないため、モジュール内キャッシュは持たない。
 */
export async function fetchTierRows(): Promise<TierRow[]> {
  const res = await fetch(TIER_INFO_CSV_URL, { cache: 'no-store', redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`[metabase/tier-info] CSV fetch failed: ${res.status}`);
  }
  const text = await res.text();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const rows: TierRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const sfId = f[0]?.trim();
    if (!sfId) continue;

    rows.push({
      sfAccountId: sfId,
      companyName: f[2] || null,
      tier:        parseTier(f[3]),
      cs1v1:       parseBool(f[4]),
      csOwner:     f[5]?.trim() || null,
      hasContract: parseBool(f[6]),
    });
  }
  return rows;
}
