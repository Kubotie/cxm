// ─── ダッシュボードの数字の材料を集める ──────────────────────────────────────
//
// 画面（board.js）は RAW（/api/ptai/raw）と db（/api/ptai/db）を読んで
// `DEALS` を組み立てている。ここはその**同じ 2 つの材料**から、
// kpi.ts が必要とする分だけを取り出す。
//
// ⚠ 画面と材料が違うと数字がずれるので、取得元は必ず同じにする：
//     会社・現在MRR・期初MRR・担当 … buildRawFromNewSources()（Notion 顧客管理DB）
//     商談・①（目標）追加MRR       … buildDbView() の edits（Twenty test*）
//     目標・配分                    … buildDbView() の settings/targets（Notion 目標DB）
//
// board.js の該当箇所（2026-10-13 時点）:
//   商談     … `((e&&e.deals)||[]).forEach(...)` で edits の deals をそのまま使う。
//              **main 商談は作らない**（RAW の opp は集計であって商談ではない）
//   フェーズ … `PHASES.includes(phN(x.phase)) ? phN(x.phase) : 'INACTIVE'`
//   ①       … `aimOf = d => (EDITS[d.cid].company.aim)||0`（editActive の対象外）

import { buildRawFromNewSources } from './raw-view';
import { buildDbView } from './db-view';
import { STAGES, type Stage } from './twenty-test/schema';
import type { KpiCompany, KpiDeal } from './kpi';

/** 画面の MEMBERS と同じ並び（board.js 77 行） */
export const MEMBERS = ['Paul', 'Baba', 'Eri', 'Kubotie', 'Ava', 'Utty'] as const;

/** 目標が Notion から取れなかったときの既定値（board.js の CONFIG と同じ） */
const DEFAULT_TARGETS = {
  targetMrr: 40_000_000,
  targetDue: '2026-12',
  targets: { Paul: 12_000_000, Baba: 10_000_000, Eri: 8_000_000, Kubotie: 6_000_000, Ava: 4_000_000, Utty: 0 } as Record<string, number>,
};

export interface KpiSource {
  companies: KpiCompany[];
  targetMrr: number;
  targetDue: string;
  targets: Record<string, number>;
  /** 件数だけ。顧客名は入れない */
  diagnostics: { companies: number; deals: number; partialFailures: string[]; targetsFromNotion: boolean };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
// board.js と同じ: 知らないフェーズは INACTIVE 扱い
const stage = (v: unknown): string => STAGES.includes(str(v) as Stage) ? str(v) : 'INACTIVE';

export async function loadKpiSource(): Promise<KpiSource> {
  const [raw, db] = await Promise.all([buildRawFromNewSources(), buildDbView()]);

  const editsById = new Map<string, Record<string, unknown>>();
  for (const e of db.collections.edits ?? []) editsById.set(e.id, (e.data ?? {}) as Record<string, unknown>);

  const companies: KpiCompany[] = (raw.snapshot.companies ?? []).map(c => {
    const e = editsById.get(c.cid) ?? {};
    const co = (e.company ?? {}) as Record<string, unknown>;
    const deals: KpiDeal[] = (Array.isArray(e.deals) ? e.deals : [])
      .filter((x): x is Record<string, unknown> => !!x && !!str((x as Record<string, unknown>).key))
      .map(x => ({
        stage:  stage(x.phase),
        addMrr: num(x.addMrr),
        na:     str(x.na) || null,
        naDate: str(x.naDate).slice(0, 10) || null,
      }));
    return {
      cid: c.cid,
      owners: Array.isArray(c.o) ? c.o : [],
      curMrr: num(c.m),
      // 期初MRR が未設定の会社は、画面の baseMrrOf と同じく現在MRR を土台にする
      baseMrr: typeof c.bm === 'number' ? c.bm : num(c.m),
      aim: num(co.aim),
      deals,
    };
  });

  const t = (db.collections.settings ?? []).find(s => s.id === 'targets')?.data as
    { targetMrr?: unknown; targetDue?: unknown; targets?: unknown } | undefined;
  const targetMrr = num(t?.targetMrr) || DEFAULT_TARGETS.targetMrr;
  const targetDue = str(t?.targetDue) || DEFAULT_TARGETS.targetDue;
  const targets: Record<string, number> = {};
  for (const m of MEMBERS) {
    const v = (t?.targets as Record<string, unknown> | undefined)?.[m];
    targets[m] = t?.targets ? num(v) : DEFAULT_TARGETS.targets[m];
  }

  return {
    companies, targetMrr, targetDue, targets,
    diagnostics: {
      companies: companies.length,
      deals: companies.reduce((s, c) => s + c.deals.length, 0),
      partialFailures: [...raw.diagnostics.partialFailures, ...db.diagnostics.partialFailures],
      targetsFromNotion: !!t,
    },
  };
}
