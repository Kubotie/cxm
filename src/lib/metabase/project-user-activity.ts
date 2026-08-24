// ─── Metabase BI プロジェクト別ユーザー活動データ ──────────────────────────────
//
// https://bi.ptmind.com/public/question/874cd125-986f-4f30-86a5-9b6a36730708.csv
//
// CSV カラム（インデックス順）:
//   0: Project ID
//   1: Count                              — 総メンバー数
//   2: l30_active_users                   — 過去30日アクティブユーザー数（ローリング）
//   3: Max of ...Last Active Date: Week   — メンバー中の最終ログイン日（週粒度、ISO datetime）
//   4: l7_active_users                    — 今週アクティブユーザー数
//
// 3列目のヘッダーはロケール依存の長い文字列のためインデックスで取得する。
// キー: Project ID（project_info テーブルの project_id と突合）
// CSVが5MB超で Next.js fetch cache の2MB上限を超えるため、プロセスメモリキャッシュを使用する。

const PROJECT_USER_ACTIVITY_CSV_URL =
  'https://bi.ptmind.com/public/question/874cd125-986f-4f30-86a5-9b6a36730708.csv';

// プロセスメモリキャッシュ（4.3MB/11.8万行のため Next.js Data Cache の2MB上限を超える。
// unstable_cache には載らないので、プロセスメモリで保持する）。
// データは1日1回更新のため TTL を 12h に設定し、コールドスタート時の再DL頻度を抑える。
// 各サーバーインスタンス起動時に instrumentation.ts が先読みしてウォームアップ済み。
let _cache: Map<string, ProjectUserActivity> | null = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12時間

export interface ProjectUserActivity {
  /** 総メンバー数 */
  totalUsers:        number;
  /** 先月（L30）アクティブユーザー数 */
  l30ActiveUsers:    number;
  /** 今週（L7）アクティブユーザー数 */
  l7ActiveUsers:     number;
  /** メンバー中の最終ログイン日（YYYY-MM-DD, 不明なら null） */
  maxLastActiveDate: string | null;
}

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

/** ISO datetime 文字列から YYYY-MM-DD を切り出す */
function extractDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '') return null;
  // "2026-03-30T00:00:00+09:00" → "2026-03-30"
  return trimmed.slice(0, 10) || null;
}

// 進行中ロードの共有 Promise（コールドスタート時の重複DL防止）。
let _inflight: Promise<Map<string, ProjectUserActivity>> | null = null;

/**
 * Metabase CSV を取得し、Map<project_id, ProjectUserActivity> を返す。
 * 取得失敗時は空 Map（graceful degradation）。
 * キャッシュが新鮮なら即返す。ロード中なら進行中の Promise を共有する。
 */
export async function fetchProjectUserActivityMap(): Promise<Map<string, ProjectUserActivity>> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;
  if (_inflight) return _inflight;
  _inflight = loadActivityMap().finally(() => { _inflight = null; });
  return _inflight;
}

async function loadActivityMap(): Promise<Map<string, ProjectUserActivity>> {
  const result = new Map<string, ProjectUserActivity>();
  try {
    const res = await fetch(PROJECT_USER_ACTIVITY_CSV_URL, {
      cache: 'no-store',  // Next.js fetch cache はサイズ上限2MBのためスキップ。プロセスキャッシュで代替。
    });
    if (!res.ok) {
      console.warn(`[metabase/project-user-activity] CSV fetch failed: ${res.status}`);
      return result;
    }
    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return result;

    // ヘッダー行は存在チェックのみ（インデックスで取得するため）
    const headerFields = parseCsvLine(lines[0]);
    const idxId = headerFields.indexOf('Project ID');
    if (idxId < 0) {
      console.warn('[metabase/project-user-activity] "Project ID" カラムが見つかりません', headerFields.slice(0, 5));
      return result;
    }

    // カラム順は固定: 0=ProjectID, 1=Count, 2=l30_active, 3=LastActiveDate, 4=l7_active
    const IDX_ID       = 0;
    const IDX_COUNT    = 1;
    const IDX_L30      = 2;
    const IDX_LAST_ACT = 3;
    const IDX_L7       = 4;

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const projectId = fields[IDX_ID];
      if (!projectId) continue;

      const totalUsers     = Math.round(parseFloat(fields[IDX_COUNT]   ?? '0') || 0);
      const l30ActiveUsers = Math.round(parseFloat(fields[IDX_L30]     ?? '0') || 0);
      const l7ActiveUsers  = Math.round(parseFloat(fields[IDX_L7]      ?? '0') || 0);
      const maxLastActiveDate = extractDate(fields[IDX_LAST_ACT]);

      result.set(projectId, { totalUsers, l30ActiveUsers, l7ActiveUsers, maxLastActiveDate });
    }
    _cache = result;
    _cacheAt = Date.now();
  } catch (e) {
    console.error('[metabase/project-user-activity] CSV 取得エラー:', e);
    // エラー時はキャッシュが古くても返す（完全空より良い）
    if (_cache) return _cache;
  }
  return result;
}
