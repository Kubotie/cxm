// ─── プロジェクト × アカウント × 週次アクティビティ ─────────────────────────
//
// https://bi.ptmind.com/public/question/61c669bf-6f86-48db-806f-7c0adff4ac00.csv
//
// CSV: Project ID, Account Email, Stat Date(週初), active_days,
//      pti_active_days, ptx_active_days, pti_pv, ptx_pv
//
// 実測（2026-08-22）: 24,030行 / 3,095プロジェクト / 4,205アカウント / 14週
//   期間 2026-05-18 〜 2026-08-17
//
// **これで「何人で回しているか」が初めて分かる。**
// これまで実行体制はキャンペーン数と活動量の推移だけで見ていた。
//
// ⚠️ 要点2つ:
//   1. **社内アカウント（@ptmind.com）を顧客の運用人数に数えない。**
//      実測で全行の3.3%。我々が触っているのを顧客の運用と数えると、
//      伴走している顧客ほど「体制がある」と誤判定する。
//      チャートには出す（誰が動かしているかは見たい）が、人数からは除く。
//   2. **運用人数の中央値は1人。** 1,651PJ中1,120PJ（68%）が1人だけ。
//      「1人しかいない」は普通の状態なので、それ自体を危険とは扱わない。
//      属人化のリスクとして別に見る。
//
// サーバーサイド専用。

const PROJECT_ACCOUNTS_CSV_URL =
  'https://bi.ptmind.com/public/question/61c669bf-6f86-48db-806f-7c0adff4ac00.csv';

/** 社内アカウントの判定。運用人数から除く */
export function isInternalAccount(email: string): boolean {
  return /@ptmind\.com\s*$/i.test(email.trim());
}

/** 運用人数を数える対象期間（直近何週か） */
export const OPERATOR_WINDOW_WEEKS = 4;

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface AccountWeek {
  /** 週初日 "YYYY-MM-DD" */
  week:          string;
  activeDays:    number;
  ptiActiveDays: number;
  ptxActiveDays: number;
  ptiPv:         number;
  ptxPv:         number;
}

/**
 * 直近4週にそのアカウントが何を見ていたか。
 * 実測（2026-08-22 / 顧客側アカウント×PJ）:
 *   Insight中心 1,134 / Experience中心 982 / 両方 369 / 活動なし 867
 *   1,242の稼働PJのうち222で役割が分かれている。
 */
export type AccountRole = 'insight' | 'experience' | 'both' | 'idle';

export interface AccountSeries {
  email:    string;
  internal: boolean;
  weeks:    AccountWeek[];
  /** 全期間の稼働日数合計。凡例の並び順に使う */
  totalActiveDays: number;
  /** 直近4週の役割 */
  role:      AccountRole;
  /** 直近4週の Insight PV */
  recentPtiPv: number;
  /** 直近4週の Experience PV */
  recentPtxPv: number;
}

export interface ProjectAccountData {
  projectId: string;
  /** 週のリスト（昇順）。チャートのX軸 */
  weeks:     string[];
  accounts:  AccountSeries[];

  /** 直近4週に稼働した**顧客側**アカウント数 = 運用人数 */
  operators:        number;
  /** 直近4週に稼働した社内アカウント数（伴走の濃さ） */
  internalOperators: number;
  /** 前の4週の運用人数。増減を見る */
  operatorsPrev:    number;
  /** 直近4週の顧客側の稼働日数合計 */
  recentActiveDays: number;
  /** 運用が1人に依存している（顧客側が1人だけ） */
  singleOperator:   boolean;
  /**
   * 顧客側の役割の内訳（直近4週）。
   * 「Experienceしか触っていない」＝ Insight の価値が届いていない、が読める。
   */
  roleCounts: Record<AccountRole, number>;
  /** 顧客側で見られていない製品（契約の有無はここでは見ない） */
  untouchedProducts: string[];
}

/** Insight / Experience のどちらかに寄っていると見なす閾値 */
const ROLE_DOMINANT_SHARE = 0.8;

// ── キャッシュ ────────────────────────────────────────────────────────────────

let _cache:   Map<string, ProjectAccountData> | null = null;
let _cacheAt = 0;
let _inflight: Promise<Map<string, ProjectAccountData>> | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function fetchProjectAccountMap(
  opts: { force?: boolean } = {},
): Promise<Map<string, ProjectAccountData>> {
  if (!opts.force) {
    if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;
    if (_inflight) return _inflight;
  }
  _inflight = load().finally(() => { _inflight = null; });
  return _inflight;
}

async function load(): Promise<Map<string, ProjectAccountData>> {
  const result = new Map<string, ProjectAccountData>();
  try {
    const res = await fetch(PROJECT_ACCOUNTS_CSV_URL, { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) {
      console.warn(`[metabase/project-accounts] CSV fetch failed: ${res.status}`);
      return _cache ?? result;
    }
    const text  = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return result;

    const header = parseCsvLine(lines[0]);
    const I = {
      id:    header.indexOf('Project ID'),
      email: header.indexOf('Account Email'),
      date:  header.indexOf('Stat Date'),
      days:  header.indexOf('active_days'),
      pti:   header.indexOf('pti_active_days'),
      ptx:   header.indexOf('ptx_active_days'),
      ptiPv: header.indexOf('pti_pv'),
      ptxPv: header.indexOf('ptx_pv'),
    };
    if (I.id < 0 || I.email < 0 || I.date < 0) {
      console.warn('[metabase/project-accounts] 想定した列が見つかりません:', header.join(','));
      return _cache ?? result;
    }

    // projectId → email → weeks
    const raw = new Map<string, Map<string, AccountWeek[]>>();
    const allWeeks = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const f = parseCsvLine(lines[i]);
      const pid = f[I.id];
      const email = f[I.email];
      if (!pid || !email) continue;
      const week = (f[I.date] ?? '').slice(0, 10);
      if (!week) continue;
      allWeeks.add(week);

      let byEmail = raw.get(pid);
      if (!byEmail) { byEmail = new Map(); raw.set(pid, byEmail); }
      const list = byEmail.get(email) ?? [];
      list.push({
        week,
        activeDays:    num(f[I.days]),
        ptiActiveDays: num(f[I.pti]),
        ptxActiveDays: num(f[I.ptx]),
        ptiPv:         num(f[I.ptiPv]),
        ptxPv:         num(f[I.ptxPv]),
      });
      byEmail.set(email, list);
    }

    const weeksSorted = [...allWeeks].sort();
    const recent = new Set(weeksSorted.slice(-OPERATOR_WINDOW_WEEKS));
    const prev   = new Set(weeksSorted.slice(-OPERATOR_WINDOW_WEEKS * 2, -OPERATOR_WINDOW_WEEKS));

    for (const [pid, byEmail] of raw) {
      const accounts: AccountSeries[] = [];
      let operators = 0, internalOperators = 0, operatorsPrev = 0, recentActiveDays = 0;

      const roleCounts: Record<AccountRole, number> = { insight: 0, experience: 0, both: 0, idle: 0 };
      let anyPti = 0, anyPtx = 0;

      for (const [email, weeks] of byEmail) {
        weeks.sort((a, b) => a.week.localeCompare(b.week));
        const internal = isInternalAccount(email);
        const total = weeks.reduce((n, w) => n + w.activeDays, 0);

        const rw = weeks.filter(w => recent.has(w.week));
        const pti = rw.reduce((n, w) => n + w.ptiPv, 0);
        const ptx = rw.reduce((n, w) => n + w.ptxPv, 0);
        const sum = pti + ptx;
        const role: AccountRole =
          sum === 0 ? 'idle'
          : pti / sum >= ROLE_DOMINANT_SHARE ? 'insight'
          : ptx / sum >= ROLE_DOMINANT_SHARE ? 'experience'
          : 'both';

        if (!internal) {
          roleCounts[role]++;
          anyPti += pti; anyPtx += ptx;
        }
        accounts.push({
          email, internal, weeks, totalActiveDays: total,
          role, recentPtiPv: pti, recentPtxPv: ptx,
        });

        const activeRecent = weeks.some(w => recent.has(w.week) && w.activeDays > 0);
        const activePrev   = weeks.some(w => prev.has(w.week)   && w.activeDays > 0);
        if (activeRecent) { if (internal) internalOperators++; else operators++; }
        if (activePrev && !internal) operatorsPrev++;
        if (!internal) {
          recentActiveDays += weeks
            .filter(w => recent.has(w.week))
            .reduce((n, w) => n + w.activeDays, 0);
        }
      }

      // 稼働日数が多い順。顧客側を先に出す（社内は補助情報）
      accounts.sort((a, b) =>
        Number(a.internal) - Number(b.internal) || b.totalActiveDays - a.totalActiveDays);

      const untouched: string[] = [];
      if (anyPti === 0) untouched.push('Insight');
      if (anyPtx === 0) untouched.push('Experience');

      result.set(pid, {
        projectId: pid,
        weeks: weeksSorted,
        accounts,
        roleCounts,
        untouchedProducts: untouched,
        operators,
        internalOperators,
        operatorsPrev,
        recentActiveDays,
        singleOperator: operators === 1,
      });
    }

    _cache = result;
    _cacheAt = Date.now();
    return result;
  } catch (e) {
    console.warn('[metabase/project-accounts] 取得に失敗:', e instanceof Error ? e.message : e);
    return _cache ?? result;
  }
}

// ── CSV パーサ（他の metabase ローダーと同じ実装）────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function num(v: string | undefined): number {
  const n = parseFloat(v ?? '');
  return Number.isNaN(n) ? 0 : n;
}
