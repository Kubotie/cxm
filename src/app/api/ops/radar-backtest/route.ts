// ─── GET /api/ops/radar-backtest ──────────────────────────────────────────────
//
// 解約レーダーの判定を過去データで再生する。**画面を作る前に「本当に鳴るか」を確かめる**
// ためのもので、書き込みは一切しない。
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §6 Step 1
//   完了条件 = エレコム（sf_001Q900000tHQjBIAW）が 2026-06 に点灯することを再現できる。
//
// クエリ:
//   uid=sf_xxx[,sf_yyy]  対象企業。省略時は Tier1/2 の active 全社
//   from=YYYY-MM-DD      再生開始日（既定: 取得できる最古のスナップショット日）
//   to=YYYY-MM-DD        再生終了日（既定: 今日）
//   step=7               何日刻みで判定するか（既定 1）
//   detail=1             日ごとの内訳を全部返す（既定は変化点のみ）
//
// 使い方:
//   curl 'http://localhost:3000/api/ops/radar-backtest?uid=sf_001Q900000tHQjBIAW'

import { NextRequest, NextResponse } from 'next/server';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { collectRadarFacts, factsToInput, type RadarFacts } from '@/lib/churn/radar-input';
import { evaluateRadar, type RadarResult, type RadarStage } from '@/lib/churn/radar-rules';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── 出力型 ───────────────────────────────────────────────────────────────────

interface StageChange {
  date:      string;
  from:      RadarStage;
  to:        RadarStage;
  score:     number;
  topReason: string;
  signals:   string[];
}

interface BacktestCompany {
  companyUid:    string;
  canonicalName: string | null;
  ownerName:     string | null;
  tier:          number | null;
  mrr:           number | null;
  renewalDate:   string | null;
  /** 材料が取れた期間。ここが短ければ結果は信用できない */
  usageFrom:     string | null;
  usageTo:       string | null;
  /** 最初に watch 以上になった日 */
  firstDetectedAt: string | null;
  /** 最初に critical になった日 */
  firstCriticalAt: string | null;
  /** 終端時点の判定 */
  final:         RadarResult;
  changes:       StageChange[];
  /** detail=1 のときだけ */
  series?:       Array<{ date: string; stage: RadarStage; score: number }>;
}

interface BacktestResponse {
  window:   { from: string; to: string; step: number };
  /** 終端時点のステージ分布。閾値が緩すぎないかはここで見る */
  distribution: Record<RadarStage, number>;
  companies: BacktestCompany[];
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400_000;

function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

async function fetchTargetUids(): Promise<string[]> {
  const rows = await nocoFetch<{ company_uid?: string | null }>(TABLE_IDS.companies, {
    where:  '(status,eq,active)~and(tier,in,1,2)',
    fields: 'company_uid',
    limit:  '500',
  }, false).catch(() => []);
  return rows.map(r => r.company_uid?.trim()).filter((u): u is string => !!u);
}

/** 材料の中で最も古い観測日。ここより前を再生しても意味がない */
function earliestFactDate(facts: RadarFacts): string | null {
  const candidates = [
    facts.usage[0]?.date,
    facts.habituation[0]?.date,
    facts.contactDates[0],
  ].filter((d): d is string => !!d);
  return candidates.length > 0 ? candidates.sort()[0] : null;
}

// ── 本体 ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<BacktestResponse | { error: string }>> {
  try {
    const sp   = req.nextUrl.searchParams;
    const step = Math.max(1, parseInt(sp.get('step') ?? '1', 10));
    const to   = sp.get('to') ?? new Date().toISOString().slice(0, 10);
    const detail = sp.get('detail') === '1';

    const uidParam = sp.get('uid');
    const uids = uidParam
      ? uidParam.split(',').map(s => s.trim()).filter(Boolean)
      : await fetchTargetUids();

    if (uids.length === 0) {
      return NextResponse.json({ error: '対象企業が0件でした' }, { status: 400 });
    }

    // 材料は再生開始日より前から必要（D2 は60日窓、D4 は90日窓を見る）。
    // from 指定があってもその120日前から集める。
    const requestedFrom = sp.get('from');
    const collectSince  = addDays(requestedFrom ?? addDays(to, -180), -120);

    const factsMap = await collectRadarFacts(uids, collectSince);

    const companies: BacktestCompany[] = [];
    const distribution: Record<RadarStage, number> = { critical: 0, warn: 0, watch: 0, clear: 0 };
    let globalFrom = to;

    for (const uid of uids) {
      const facts = factsMap.get(uid);
      if (!facts) continue;

      const earliest = earliestFactDate(facts);
      // 窓が埋まるまで待たないと、記録開始直後の「データが無いだけ」を点灯と誤認する。
      // 併せて1年より前へは遡らない ─ 接点ログには数年前の行があり、そこまで再生しても
      // 利用系の材料が存在しないので B1 だけが延々立つ無意味な結果になる。
      const from = requestedFrom
        ?? maxDate(earliest ? addDays(earliest, 30) : addDays(to, -90), addDays(to, -365));
      if (from < globalFrom) globalFrom = from;

      let prev: RadarStage = 'clear';
      let firstDetectedAt: string | null = null;
      let firstCriticalAt: string | null = null;
      const changes: StageChange[] = [];
      const series: Array<{ date: string; stage: RadarStage; score: number }> = [];
      let last: RadarResult | null = null;

      for (let d = from; d <= to; d = addDays(d, step)) {
        const result = evaluateRadar(factsToInput(facts, d));
        last = result;
        if (detail) series.push({ date: d, stage: result.stage, score: result.score });

        if (result.stage !== prev) {
          changes.push({
            date: d, from: prev, to: result.stage, score: result.score,
            topReason: result.topReason,
            signals: result.signals.map(s => `${s.id} ${s.label}`),
          });
          prev = result.stage;
        }
        if (!firstDetectedAt && result.stage !== 'clear') firstDetectedAt = d;
        if (!firstCriticalAt && result.stage === 'critical') firstCriticalAt = d;
      }

      // 終端が step の刻みで to に届かないことがあるので、最後は必ず to で評価する
      const final = evaluateRadar(factsToInput(facts, to));
      if (last === null) last = final;
      distribution[final.stage]++;

      companies.push({
        companyUid: uid,
        canonicalName: facts.canonicalName,
        ownerName: facts.ownerName,
        tier: facts.tier,
        mrr: facts.mrr,
        renewalDate: facts.renewalDate,
        usageFrom: facts.usage[0]?.date ?? null,
        usageTo:   facts.usage[facts.usage.length - 1]?.date ?? null,
        firstDetectedAt, firstCriticalAt,
        final, changes,
        ...(detail ? { series } : {}),
      });
    }

    // 重い順に並べる。閾値調整では上位の顔ぶれを見る
    companies.sort((a, b) => b.final.score - a.final.score);

    return NextResponse.json({
      window: { from: requestedFrom ?? globalFrom, to, step },
      distribution,
      companies,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ops/radar-backtest] 失敗:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
