// ─── 毎朝の KPI スナップショット ─────────────────────────────────────────────
//
// ダッシュボード上部の数値（目標・計画・期待値・期限超過・確定・コミット・
// チャレンジ・パイプライン）を**毎朝 1 行ずつ** Twenty の testKpiSnapshot に残す。
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ残すのか
//    Twenty が持っているのは「いまの値」だけ。現在MRR は毎朝上書きされ、
//    商談のフェーズも金額も書き換わるので、**昨日いくらだったかは誰も知らない**。
//    変化（増えた・減った）を見るには、その日の値をその日に書き留めるしかない。
//
//  決めごと
//    ・鍵は externalId = `kpi:<YYYY-MM-DD>:<scope>`。同じ日に 2 回走っても
//      1 行のまま上書きする（Twenty に一意制約も upsert も無いので
//      upsertByExternalId を通す）
//    ・**過去の行は書き換えない。** 遡っての訂正はしない
//    ・scope は `team` と担当者 6 名ぶんの計 7 行／日
//    ・数値は円。画面と同じ式（kpi.ts）で出す
// ═══════════════════════════════════════════════════════════════════════════

import { upsertByExternalId, listRecords } from './twenty-test/client';
import { TEST_OBJECTS } from './twenty-test/schema';
import { computeKpis, type KpiRow } from './kpi';
import { loadKpiSource, MEMBERS, type KpiSource } from './kpi-source';

const OBJ = TEST_OBJECTS.kpiSnapshot;

/** JST の今日。Vercel は UTC で動くので、必ず +9 してから切る */
export function todayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export interface SnapshotResult {
  ok: boolean;
  /** その日のぶんが既にあったので何もしなかった */
  skipped?: boolean;
  /** 取得に失敗した部分があるので書かなかった */
  incomplete?: boolean;
  date: string;
  rows: KpiRow[];
  created: number;
  updated: number;
  failed: number;
  diagnostics: { companies: number; deals: number; partialFailures: string[]; targetsFromNotion: boolean };
}

export async function runKpiSnapshot(
  opts: {
    date?: string; dryRun?: boolean; onlyIfMissing?: boolean;
    /** 材料の取得元。テストで差し替えるためだけにある */
    load?: () => Promise<KpiSource>;
  } = {},
): Promise<SnapshotResult> {
  const date = opts.date ?? todayJst();

  // 画面から呼ぶとき用。Vercel の Hobby プランは Cron が 1 日 1 回までで、
  // すでに 10 本ある。11 本目が確実に走る保証が無いので、
  // **その日のぶんがまだ無ければ、最初に画面を開いた人が記録する**。
  // 先に見るので、2 人目以降は Twenty を読むだけで終わる。
  if (opts.onlyIfMissing) {
    const already = await listSnapshots({ scope: 'team', from: date, to: date });
    if (already.length) {
      return { ok: true, skipped: true, date, rows: [], created: 0, updated: 0, failed: 0,
        diagnostics: { companies: 0, deals: 0, partialFailures: [], targetsFromNotion: false } };
    }
  }

  const src = await (opts.load ?? loadKpiSource)();

  // ⚠ 取りこぼしたまま書かない。Twenty のレート制限（429）に当たると
  //   db-view は空のコレクションを返すので、そのまま計算すると
  //   「商談ゼロ・パイプライン 0 円」が**その日の記録として永久に残る**。
  //   過去の行は書き換えない方針なので、あとから直せない。
  //   2026-10-13 に export で実際に起きた（testOpportunities:rate_limited）。
  if (src.diagnostics.partialFailures.length) {
    console.warn('[kpi-snapshot] 取得に失敗した部分があるので書きません',
      JSON.stringify(src.diagnostics.partialFailures));
    return { ok: false, incomplete: true, date, rows: [], created: 0, updated: 0, failed: 0,
             diagnostics: src.diagnostics };
  }

  const rows: KpiRow[] = [
    computeKpis(src.companies, { scope: 'team', targetMrr: src.targetMrr, today: date }),
    ...MEMBERS.map(m =>
      computeKpis(src.companies, { scope: m, targetMrr: src.targets[m] ?? 0, today: date })),
  ];

  let created = 0, updated = 0, failed = 0;
  if (!opts.dryRun) {
    for (const r of rows) {
      try {
        const res = await upsertByExternalId(OBJ.plural, OBJ.singular, `kpi:${date}:${r.scope}`, {
          snapshotDate: date, targetDue: src.targetDue, ...toRecord(r),
        });
        if (res.created) created++; else updated++;
      } catch {
        failed++;   // 1 行こけても残りは書く
      }
    }
  }

  return { ok: failed === 0, date, rows, created, updated, failed, diagnostics: src.diagnostics };
}

/**
 * KpiRow の鍵 → Twenty の列名。**書くときも読むときもこの 1 枚だけを見る**
 * （2 か所に並べると、列を足したとき片方だけ直して取りこぼす）。
 * 値が同じものは列名を省略。commit / challenge / pipeline は
 * Twenty 側で別名にしてある（`plan` は予約語、他は分かりやすさのため）。
 */
const FIELDS: Array<[keyof KpiRow, string?]> = [
  ['targetMrr'], ['plan'], ['planCompanies'],
  ['planBase'], ['planWon'], ['planDeal'], ['planAim'],
  ['expected'], ['won'], ['wonCompanies'],
  ['commit', 'commitMrr'], ['commitCompanies'],
  ['challenge'], ['challengeCompanies'],
  ['pipeline', 'pipelineMrr'], ['pipelineCompanies'],
  ['commitGoal'], ['challengeGoal'],
  ['overdue'], ['currentMrr'], ['baseMrr'], ['companies'], ['deals'],
];

function toRecord(r: KpiRow): Record<string, unknown> {
  const out: Record<string, unknown> = { scope: r.scope };
  for (const [key, col] of FIELDS) out[col ?? key] = r[key];
  return out;
}

/** Twenty の 1 行 → KpiRow ＋ 日付。API が返す形 */
export interface SnapshotPoint extends KpiRow { date: string; targetDue: string | null }

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function toPoint(row: Record<string, unknown>): SnapshotPoint {
  const out = {
    date: String(row.snapshotDate ?? '').slice(0, 10),
    scope: String(row.scope ?? 'team'),
    targetDue: typeof row.targetDue === 'string' ? row.targetDue : null,
  } as SnapshotPoint;
  for (const [key, col] of FIELDS) (out[key] as number) = n(row[col ?? key]);
  return out;
}

/** 保存済みのスナップショットを期間で読む。古い順 */
export async function listSnapshots(
  opts: { scope?: string; from?: string; to?: string } = {},
): Promise<SnapshotPoint[]> {
  const f: string[] = [];
  if (opts.scope) f.push(`scope[eq]:${opts.scope}`);
  if (opts.from)  f.push(`snapshotDate[gte]:${opts.from}`);
  if (opts.to)    f.push(`snapshotDate[lte]:${opts.to}`);
  const rows = await listRecords(OBJ.plural, OBJ.singular, {
    ...(f.length ? { filter: f.join(',') } : {}),
    orderBy: 'snapshotDate',
    pageSize: 200, maxRecords: 5000,
  });
  return rows.map(toPoint).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

/** 変化を見るための差分。**前の行との差**で、欠けた日は埋めない */
export const DELTA_KEYS: Array<keyof KpiRow> = FIELDS.map(([key]) => key);

export function withDeltas(points: SnapshotPoint[]): Array<SnapshotPoint & { delta: Record<string, number> }> {
  return points.map((p, i) => {
    const prev = i > 0 ? points[i - 1] : null;
    const delta: Record<string, number> = {};
    for (const k of DELTA_KEYS) if (prev) delta[k] = (p[k] as number) - (prev[k] as number);
    return { ...p, delta };
  });
}
