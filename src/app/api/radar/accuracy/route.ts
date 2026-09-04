// ─── GET /api/radar/accuracy ──────────────────────────────────────────────────
//
// 解約レーダーの精度パネル。**これが無いと閾値が誰にも触れなくなる。**
//
// 2つを出す:
//   1. 実際に解約した企業に対して、レーダーは何日前に鳴っていたか（検知リードタイム）
//      → 解約日を基準に判定を再生する。churn_radar_state の履歴は使わない（過去ぶんが無いため）
//   2. いま点灯している中で、人が「誤検知」と判断した割合
//      → 閾値が緩すぎないかの現場からの答え
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.4
//
// クエリ: window_days=180（解約をどこまで遡って拾うか）／ limit=40（対象企業の上限）

import { NextRequest, NextResponse } from 'next/server';
import { fetchChurnEventsWithinWindow } from '@/lib/metabase/package-events';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { collectRadarFacts, factsToInput } from '@/lib/churn/radar-input';
import { evaluateRadar, type RadarStage } from '@/lib/churn/radar-rules';
import { fetchAllRadarStates } from '@/lib/churn/radar-state';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── 出力型 ───────────────────────────────────────────────────────────────────

export interface AccuracyChurnedCompany {
  companyUid:    string;
  name:          string | null;
  churnDate:     string;
  /** 解約日から見て何日前に最初に点灯していたか。鳴っていなければ null */
  leadTimeDays:  number | null;
  /** critical に達していた日数（解約日から見て） */
  criticalLeadDays: number | null;
  stageAtChurn:  RadarStage;
  /** 材料が不足していて判定できなかった場合の理由 */
  note:          string | null;
}

export interface RadarAccuracyResponse {
  window: { from: string; to: string; days: number };
  detection: {
    churnedTotal:  number;
    /** 判定を再生できた社数（材料があった社） */
    evaluated:     number;
    /** 解約前に1度でも点灯していた社数 */
    detected:      number;
    detectionRate: number;
    /** 検知できた社の平均・中央値リードタイム（日） */
    avgLeadDays:    number | null;
    medianLeadDays: number | null;
    companies:     AccuracyChurnedCompany[];
  };
  falsePositive: {
    lit:        number;
    dismissed:  number;
    rate:       number;
    /** 未確認のまま放置されている点灯。ここが多いと精度以前の問題 */
    unacked:    number;
    /** 平均放置日数 */
    avgAgedDays: number | null;
  };
  distribution: Record<RadarStage, number>;
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400_000;

function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** sfId → company_uid。companies は "sf_" + sf_account_id 形式 */
async function uidBySfId(sfIds: string[]): Promise<Map<string, { uid: string; name: string | null }>> {
  const out = new Map<string, { uid: string; name: string | null }>();
  if (sfIds.length === 0) return out;
  const rows = await nocoFetch<{ company_uid?: string; canonical_name?: string; sf_account_id?: string }>(
    TABLE_IDS.companies,
    { where: `(sf_account_id,in,${sfIds.join(',')})`, fields: 'company_uid,canonical_name,sf_account_id', limit: '500' },
    false,
  ).catch(() => []);
  for (const r of rows) {
    if (r.sf_account_id && r.company_uid) {
      out.set(r.sf_account_id.trim(), { uid: r.company_uid.trim(), name: r.canonical_name?.trim() ?? null });
    }
  }
  return out;
}

// ── 本体 ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<RadarAccuracyResponse | { error: string }>> {
  try {
    const sp = req.nextUrl.searchParams;
    const windowDays = Math.min(365, parseInt(sp.get('window_days') ?? '180', 10));
    const limit      = Math.min(80, parseInt(sp.get('limit') ?? '40', 10));
    const to   = new Date().toISOString().slice(0, 10);
    const from = addDays(to, -windowDays);

    // ── 1. 解約した企業に対する検知リードタイム ──────────────────────────────
    const churnEvents = await fetchChurnEventsWithinWindow(from, to).catch(() => []);
    // 同一企業で複数PJが解約している場合は最初の解約日で代表させる
    const bySfId = new Map<string, string>();
    for (const ev of churnEvents) {
      if (!ev.sfId) continue;
      const cur = bySfId.get(ev.sfId);
      if (!cur || ev.statDate < cur) bySfId.set(ev.sfId, ev.statDate);
    }

    const sfIds = [...bySfId.keys()].slice(0, limit);
    const uidMap = await uidBySfId(sfIds);
    const uids = [...uidMap.values()].map(v => v.uid);

    const factsMap = uids.length > 0
      ? await collectRadarFacts(uids, addDays(from, -180))
      : new Map();

    const companies: AccuracyChurnedCompany[] = [];
    for (const sfId of sfIds) {
      const churnDate = bySfId.get(sfId)!;
      const info = uidMap.get(sfId);
      if (!info) continue;
      const facts = factsMap.get(info.uid);
      if (!facts) continue;

      // 解約日時点で材料があるか。無いなら「見ていない」として除外する
      const hasMaterial =
        facts.usage.some((u: { date: string }) => u.date <= churnDate) ||
        facts.contactDates.some((d: string) => d <= churnDate);

      if (!hasMaterial) {
        companies.push({
          companyUid: info.uid, name: info.name, churnDate,
          leadTimeDays: null, criticalLeadDays: null, stageAtChurn: 'clear',
          note: '解約時点の材料が無く判定を再生できない',
        });
        continue;
      }

      // 解約日から遡って、点灯していた最も早い日を探す（7日刻み・最大180日）
      let firstLit: string | null = null;
      let firstCritical: string | null = null;
      for (let i = 0; i <= 180; i += 7) {
        const d = addDays(churnDate, -i);
        const r = evaluateRadar(factsToInput(facts, d));
        if (r.stage === 'clear') {
          if (firstLit) break;   // 点灯 → clear と遡ったらそこで打ち切り
          continue;
        }
        firstLit = d;
        if (r.stage === 'critical') firstCritical = d;
      }

      const atChurn = evaluateRadar(factsToInput(facts, churnDate));
      companies.push({
        companyUid: info.uid, name: info.name, churnDate,
        leadTimeDays: firstLit
          ? Math.round((Date.parse(churnDate) - Date.parse(firstLit)) / DAY_MS) : null,
        criticalLeadDays: firstCritical
          ? Math.round((Date.parse(churnDate) - Date.parse(firstCritical)) / DAY_MS) : null,
        stageAtChurn: atChurn.stage,
        note: null,
      });
    }

    const evaluated = companies.filter(c => c.note === null);
    const detected  = evaluated.filter(c => c.leadTimeDays !== null);
    const leads     = detected.map(c => c.leadTimeDays as number);

    // ── 2. 誤検知率（現場の判断）────────────────────────────────────────────
    const states = await fetchAllRadarStates();
    const lit = states.filter(s => s.stage !== 'clear');
    const dismissed = lit.filter(s => s.ack_status === 'dismissed');
    const unacked   = lit.filter(s => (s.ack_status ?? 'none') === 'none');
    const agedDays = lit
      .map(s => s.first_detected_at
        ? Math.round((Date.parse(to) - Date.parse(s.first_detected_at.slice(0, 10))) / DAY_MS) : null)
      .filter((n): n is number => n !== null);

    const distribution: Record<RadarStage, number> = { critical: 0, warn: 0, watch: 0, clear: 0 };
    for (const s of states) distribution[(s.stage ?? 'clear') as RadarStage]++;

    return NextResponse.json({
      window: { from, to, days: windowDays },
      detection: {
        churnedTotal:  bySfId.size,
        evaluated:     evaluated.length,
        detected:      detected.length,
        detectionRate: evaluated.length > 0
          ? Math.round((detected.length / evaluated.length) * 100) / 100 : 0,
        avgLeadDays: leads.length > 0
          ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null,
        medianLeadDays: median(leads),
        companies: companies.sort((a, b) => b.churnDate.localeCompare(a.churnDate)),
      },
      falsePositive: {
        lit:       lit.length,
        dismissed: dismissed.length,
        rate:      lit.length > 0 ? Math.round((dismissed.length / lit.length) * 100) / 100 : 0,
        unacked:   unacked.length,
        avgAgedDays: agedDays.length > 0
          ? Math.round(agedDays.reduce((a, b) => a + b, 0) / agedDays.length) : null,
      },
      distribution,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[radar/accuracy] 失敗:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
