// ─── Metabase BI パッケージ変動イベントログ ──────────────────────────────────
//
// https://bi.ptmind.com/public/question/cd981843-db5d-429c-b0bb-2a93ba495bff.csv
//
// 概要: Package-Renew を除いた変更イベントログ（日次スナップショットではなくイベント単位）
//
// CSV カラム（インデックス順）:
//   0: Project ID
//   1: Stat Date                      — イベント発生日（YYYY-M-D, HH:MM 形式）
//   2: Package Day Index              — パッケージ継続日数（Renew除外のため全て0）
//   3: Project Paid Status            — PAID / FREE
//   4: Package Change Type            — Package-Churn / Package-Downsell / Package-New / Package-Trial / Package-Upsell
//   5: Pti Package Name               — PTI プラン名
//   6: Ptx Package Name               — PTX プラン名
//   7: Project Name                   — プロジェクト名
//   8: Domain                         — ドメイン（カンマ区切り複数あり）
//   9: Master Company Sf ID           — Salesforce Account ID（空の場合あり）
//
// キー（用途別）:
//   - sf_id ベース: sfId → PackageEvent[] のマップ（企業詳細用）
//   - 集計: changeType / month → 件数（ホーム画面チャート用）
//
// プロセスメモリキャッシュ（CSVが大容量のため Next.js fetch cache の2MB上限回避）

const PACKAGE_EVENTS_CSV_URL =
  'https://bi.ptmind.com/public/question/cd981843-db5d-429c-b0bb-2a93ba495bff.csv';

export type PackageChangeType =
  | 'Package-Churn'
  | 'Package-Downsell'
  | 'Package-New'
  | 'Package-Trial'
  | 'Package-Upsell';

export interface PackageEvent {
  projectId:    string;
  statDate:     string;        // YYYY-MM-DD
  changeType:   PackageChangeType;
  paidStatus:   'PAID' | 'FREE' | string;
  ptiPackage:   string | null;
  ptxPackage:   string | null;
  projectName:  string | null;
  sfId:         string | null; // Master Company Sf ID（空の場合 null）
}

/** ホーム画面チャート用の月次集計 */
export interface PackageEventMonthlySummary {
  /** "YYYY-MM" 形式 */
  month: string;
  churn:     number;
  downsell:  number;
  upsell:    number;
  newEntry:  number;
  trial:     number;
}

/** ホーム画面用レスポンス */
export interface PackageEventSummary {
  /** 直近12ヶ月の月次集計（古い順） */
  monthly:    PackageEventMonthlySummary[];
  /** 直近30日の集計 */
  last30: {
    churn:     number;
    downsell:  number;
    upsell:    number;
    newEntry:  number;
  };
}

// ── プロセスメモリキャッシュ ──────────────────────────────────────────────────

let _events: PackageEvent[] | null = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

/** CSV の1行をフィールド配列に分解する（クォート対応）*/
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

/**
 * "2026-4-23, 00:00" → "2026-04-23"
 * "2026-04-22" → "2026-04-22"
 */
function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().split(',')[0].trim(); // "00:00" 以降を切り捨て
  const parts = trimmed.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const VALID_CHANGE_TYPES = new Set<string>([
  'Package-Churn', 'Package-Downsell', 'Package-New', 'Package-Trial', 'Package-Upsell',
]);

async function loadEvents(): Promise<PackageEvent[]> {
  if (_events && Date.now() - _cacheAt < CACHE_TTL_MS) return _events;

  const events: PackageEvent[] = [];
  try {
    const res = await fetch(PACKAGE_EVENTS_CSV_URL, {
      cache: 'no-store', // プロセスキャッシュで代替
    });
    if (!res.ok) {
      console.warn(`[metabase/package-events] CSV fetch failed: ${res.status}`);
      return _events ?? events;
    }
    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return events;

    for (let i = 1; i < lines.length; i++) {
      const f = parseCsvLine(lines[i]);
      const projectId  = f[0];
      if (!projectId) continue;

      const changeType = f[4];
      if (!VALID_CHANGE_TYPES.has(changeType)) continue;

      const statDate = normalizeDate(f[1]);
      if (!statDate) continue;

      const sfIdRaw = f[9]?.trim() ?? '';
      events.push({
        projectId,
        statDate,
        changeType:  changeType as PackageChangeType,
        paidStatus:  f[3] ?? '',
        ptiPackage:  f[5] || null,
        ptxPackage:  f[6] || null,
        projectName: f[7] || null,
        sfId:        sfIdRaw || null,
      });
    }
    _events = events;
    _cacheAt = Date.now();
  } catch (e) {
    console.error('[metabase/package-events] CSV 取得エラー:', e);
    if (_events) return _events;
  }
  return events;
}

/**
 * 全イベントを読み込み、ホーム画面用の集計を返す。
 * - 直近12ヶ月の月次集計
 * - 直近30日の集計
 * @param allowedSfIds  担当企業の SF Account ID セット（指定時はこの企業のみ集計）
 */
export async function fetchPackageEventSummary(
  allowedSfIds?: Set<string>,
): Promise<PackageEventSummary> {
  const allEvents = await loadEvents();
  // 担当企業に絞り込み（sfId が null の行は除外）
  const events = allowedSfIds
    ? allEvents.filter(ev => ev.sfId !== null && allowedSfIds.has(ev.sfId))
    : allEvents;

  const today   = new Date();
  const d30ago  = new Date(today);
  d30ago.setDate(d30ago.getDate() - 30);

  // 直近12ヶ月のラベルを生成
  const monthMap = new Map<string, PackageEventMonthlySummary>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { month: key, churn: 0, downsell: 0, upsell: 0, newEntry: 0, trial: 0 });
  }

  const last30 = { churn: 0, downsell: 0, upsell: 0, newEntry: 0 };

  for (const ev of events) {
    const month = ev.statDate.slice(0, 7); // "YYYY-MM"
    const row   = monthMap.get(month);
    if (row) {
      if (ev.changeType === 'Package-Churn')     { row.churn++;    }
      if (ev.changeType === 'Package-Downsell')  { row.downsell++; }
      if (ev.changeType === 'Package-Upsell')    { row.upsell++;   }
      if (ev.changeType === 'Package-New')       { row.newEntry++; }
      if (ev.changeType === 'Package-Trial')     { row.trial++;    }
    }

    if (ev.statDate >= d30ago.toISOString().slice(0, 10)) {
      if (ev.changeType === 'Package-Churn')     last30.churn++;
      if (ev.changeType === 'Package-Downsell')  last30.downsell++;
      if (ev.changeType === 'Package-Upsell')    last30.upsell++;
      if (ev.changeType === 'Package-New')       last30.newEntry++;
    }
  }

  return {
    monthly: [...monthMap.values()],
    last30,
  };
}

/**
 * 指定 SF Account ID に紐づくイベント一覧を返す（企業詳細用）。
 * sfId = null の行は除外済み。
 */
export async function fetchPackageEventsBySfId(sfId: string): Promise<PackageEvent[]> {
  const events = await loadEvents();
  return events.filter(ev => ev.sfId === sfId);
}
