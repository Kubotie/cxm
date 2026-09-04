// ─── GET /api/radar/company/[companyUid] ──────────────────────────────────────
//
// 個社ドリル用。90日を1本の時間軸に揃えるためのデータを返す。
//   上段 = 4本の系列（席の稼働率 / 稼働施策 / 接触 / 未解決チケット）
//   下段 = 同じ軸に打つ出来事（点灯・悪化・接触・チケット・担当交代・言質）
//
// ボード（作り置きを読むだけ）と違い、ここは1社ぶんの生材料をその場で組み立てる。
// 因果を読むには日次の生系列が要るためで、対象が1社なので取得コストも軽い。

import { NextRequest, NextResponse } from 'next/server';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { sourceUrl, SOURCE_LABEL } from '@/lib/churn/radar-source';
import { collectRadarFacts, factsToInput } from '@/lib/churn/radar-input';
import { evaluateRadar, SIGNAL_SOURCE, type RadarResult } from '@/lib/churn/radar-rules';
import { fetchRadarState, fetchRadarEvents, parseReason, type AckStatus } from '@/lib/churn/radar-state';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── 出力型 ───────────────────────────────────────────────────────────────────

export interface RadarSeriesPoint {
  date:      string;
  /** 0〜1。席が無い日は null */
  seatRatio: number | null;
  seatTotal: number | null;
  seatActive: number | null;
  campaigns: number | null;
  /** その日に接点があったか */
  contact:   boolean;
  /** その日に開いていた高重要度チケット数 */
  openTickets: number;
}

export type RadarEventKind =
  | 'stage' | 'contact' | 'ticket_open' | 'ticket_close' | 'owner_change' | 'voice';

export interface RadarTimelineEvent {
  date:   string;
  kind:   RadarEventKind;
  label:  string;
  detail: string | null;
  /** 強調表示するか（点灯・重大バグ・言質） */
  strong: boolean;
  /** 出所の表示名（「Notion 議事録」など）。判定イベントには無い */
  source?:     string | null;
  /** 外部リンク。Slack / Chatwork のように張れないものは null */
  url?:        string | null;
  /** リンクが無いときに根拠を示すための本文抜粋 */
  excerpt?:    string | null;
}

/** LLM が抽出した言質。pending は人のレビュー待ちでスコアに入っていない */
export interface RadarVoiceItem {
  voiceId:      string;
  intentType:   string;
  intentLabel:  string;
  quotedText:   string;
  confidence:   number;
  occurredAt:   string;
  sourceType:   string;
  reviewStatus: 'pending' | 'confirmed' | 'rejected';
  reviewedBy:   string | null;
  /** 抽出元へのリンク。Notion 議事録 / Intercom 会話 */
  url:          string | null;
  sourceLabel:  string;
  /** required = レビューを回すべきもの。reference = 参考どまり */
  priority:     'required' | 'reference';
  /** なぜ契約継続に影響すると判断したか（LLM の説明） */
  extractReason: string | null;
}

export interface RadarCompanyResponse {
  companyUid:    string;
  name:          string;
  ownerName:     string | null;
  tier:          number | null;
  mrr:           number | null;
  renewalDate:   string | null;
  daysToRenewal: number | null;
  /** 保存済みの state（バッチが書いたもの）。無ければその場の判定を使う */
  stage:         string;
  score:         number;
  agedDays:      number | null;
  firstDetectedAt: string | null;
  ackStatus:     AckStatus;
  ackBy:         string | null;
  topReason:     string;
  current:       RadarResult;
  series:        RadarSeriesPoint[];
  events:        RadarTimelineEvent[];
  /** 材料が取れている期間。ここが短ければ判定は参考値 */
  coverage:      { from: string | null; to: string | null };
  /** 言質。pending はレビュー待ちで、まだスコアに入っていない */
  voices:        RadarVoiceItem[];
  /** シグナルIDごとのデータ元。画面が「参照した情報」を出すために使う */
  signalSources: Record<string, string>;
}

/** 言質を全ステータス取得する。collectRadarFacts は confirmed しか返さないため別途引く */
async function fetchVoices(companyUid: string): Promise<RadarVoiceItem[]> {
  if (!TABLE_IDS.churn_radar_voice) return [];
  const rows = await nocoFetch<Record<string, unknown>>(TABLE_IDS.churn_radar_voice, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-occurred_at',
    limit: '50',
  }, false).catch(() => []);
  return rows.map(r => ({
    voiceId:      String(r.voice_id ?? ''),
    intentType:   String(r.intent_type ?? ''),
    intentLabel:  String(r.intent_label ?? r.intent_type ?? ''),
    quotedText:   String(r.quoted_text ?? ''),
    confidence:   Number(r.confidence ?? 0),
    occurredAt:   String(r.occurred_at ?? '').slice(0, 10),
    sourceType:   String(r.source_type ?? ''),
    reviewStatus: (String(r.review_status ?? 'pending') as RadarVoiceItem['reviewStatus']),
    reviewedBy:   r.reviewed_by ? String(r.reviewed_by) : null,
    url:          sourceUrl(String(r.source_type ?? ''), r.source_record_id ? String(r.source_record_id) : null),
    sourceLabel:  SOURCE_LABEL[String(r.source_type ?? '')] ?? String(r.source_type ?? ''),
    priority:     (String(r.review_priority ?? 'required') as RadarVoiceItem['priority']),
    extractReason: r.extract_reason ? String(r.extract_reason) : null,
  })).filter(v => v.voiceId && v.quotedText);
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400_000;
const WINDOW_DAYS = 90;

function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

function daysSince(from: string | null, to: string): number | null {
  if (!from) return null;
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.floor((b - a) / DAY_MS);
}

// ── 本体 ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
): Promise<NextResponse<RadarCompanyResponse | { error: string }>> {
  const { companyUid } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const from  = addDays(today, -WINDOW_DAYS);

  try {
    const [factsMap, state, events, voices] = await Promise.all([
      collectRadarFacts([companyUid], addDays(from, -120), true),
      fetchRadarState(companyUid),
      fetchRadarEvents(companyUid),
      fetchVoices(companyUid),
    ]);

    const facts = factsMap.get(companyUid);
    if (!facts) {
      return NextResponse.json({ error: '企業が見つかりません' }, { status: 404 });
    }

    const current = evaluateRadar(factsToInput(facts, today));

    // ── 系列 ────────────────────────────────────────────────────────────────
    const contactSet = new Set(facts.contactDates);
    const usageByDate = new Map(facts.usage.map(u => [u.date, u]));
    const series: RadarSeriesPoint[] = [];
    for (let d = from; d <= today; d = addDays(d, 1)) {
      const u = usageByDate.get(d) ?? null;
      const seatTotal  = u?.seatTotal  ?? null;
      const seatActive = u?.seatActive ?? null;
      series.push({
        date: d,
        seatRatio: seatTotal && seatTotal > 0 && seatActive !== null ? seatActive / seatTotal : null,
        seatTotal, seatActive,
        campaigns: u?.campaigns ?? null,
        contact: contactSet.has(d),
        openTickets: facts.highTickets.filter(
          t => t.openedAt <= d && (t.closedAt === null || t.closedAt > d),
        ).length,
      });
    }

    // ── 出来事 ──────────────────────────────────────────────────────────────
    const timeline: RadarTimelineEvent[] = [];

    for (const e of events) {
      if (!e.occurred_at || e.occurred_at < from) continue;
      const isUp = e.event_type === 'detected' || e.event_type === 'escalated';
      // 判定は「何を見てそう言ったか」が無いと検算できない。
      // そのとき立っていたシグナルと、それぞれのデータ元を添える。
      const ids = (e.signal_ids ?? '').split(',').map(x => x.trim()).filter(Boolean);
      const sources = ids.length > 0
        ? ids.map(id => `${id}：${SIGNAL_SOURCE[id] ?? '不明'}`).join('\n')
        : null;
      timeline.push({
        date: e.occurred_at.slice(0, 10),
        kind: 'stage',
        label:
          e.event_type === 'detected'  ? '点灯'
          : e.event_type === 'escalated' ? `悪化 ${e.from_stage} → ${e.to_stage}`
          : e.event_type === 'recovered' ? `回復 ${e.from_stage} → ${e.to_stage}`
          : e.event_type === 'cleared'   ? '消灯'
          : '確認',
        detail: e.detail ?? null,
        strong: isUp,
        source: ids.length > 0 ? `判定に使ったデータ：${ids.join(' / ')}` : null,
        url: null,
        excerpt: sources,
      });
    }

    for (const t of facts.highTickets) {
      const url = sourceUrl('ticket', t.recordId);
      if (t.openedAt >= from) {
        timeline.push({
          date: t.openedAt, kind: 'ticket_open',
          label: '高重要度チケット',
          detail: t.title, strong: true,
          source: SOURCE_LABEL.ticket, url, excerpt: null,
        });
      }
      if (t.closedAt && t.closedAt >= from) {
        timeline.push({
          date: t.closedAt, kind: 'ticket_close',
          label: 'チケット解決', detail: t.title, strong: false,
          source: SOURCE_LABEL.ticket, url, excerpt: null,
        });
      }
    }

    for (const c of facts.ownerChangeLog) {
      if (c.date >= from) {
        timeline.push({
          date: c.date, kind: 'owner_change',
          label: c.from ? `担当交代 ${c.from} → ${c.to}` : `担当が ${c.to} に`,
          detail: null, strong: true,
          source: 'csm_customer_phase（週次）／CS担当者',
          url: null,
          excerpt: `${c.date} の週次スナップショットで sf_cs が ${c.from ?? '未設定'} から ${c.to} に変わった`,
        });
      }
    }

    for (const v of facts.voices ?? []) {
      if (v.occurredAt >= from) {
        const hit = voices.find(x => x.occurredAt === v.occurredAt && x.quotedText === v.quote);
        timeline.push({
          date: v.occurredAt, kind: 'voice',
          label: v.label, detail: v.quote, strong: true,
          source: hit?.sourceLabel ?? null, url: hit?.url ?? null, excerpt: null,
        });
      }
    }

    // 接点は系列にも出るが、間隔が空いた後の再開だけは出来事として立てる。
    // 全接点を打つと軸が埋まって、空白そのものが見えなくなる。
    const contactsInWindow = facts.contacts.filter(c => c.date >= from);
    let prevContact: string | null =
      facts.contactDates.filter(d => d < from).slice(-1)[0] ?? null;
    for (const c of contactsInWindow) {
      const gap = daysSince(prevContact, c.date);
      if (gap === null || gap >= 30) {
        timeline.push({
          date: c.date, kind: 'contact',
          label: gap === null ? '接点' : `${gap}日ぶりの接点`,
          detail: null, strong: false,
          source: SOURCE_LABEL[c.source] ?? c.source,
          url: sourceUrl(c.source, c.recordId),
          excerpt: c.excerpt,
        });
      }
      prevContact = c.date;
    }

    timeline.sort((a, b) => a.date.localeCompare(b.date));

    const firstDetectedAt = state?.first_detected_at ?? null;

    return NextResponse.json({
      companyUid,
      name: facts.canonicalName ?? companyUid,
      ownerName: facts.ownerName,
      tier: facts.tier,
      mrr: facts.mrr,
      renewalDate: facts.renewalDate,
      daysToRenewal: current.daysToRenewal,
      stage: state?.stage ?? current.stage,
      score: state?.score ?? current.score,
      agedDays: daysSince(firstDetectedAt, today),
      firstDetectedAt,
      ackStatus: (state?.ack_status ?? 'none') as AckStatus,
      ackBy: state?.ack_by ?? null,
      topReason: state?.top_reason ?? current.topReason,
      current: state
        ? { ...current, signals: parseReason(state.reason_json).signals.length > 0
            ? parseReason(state.reason_json).signals : current.signals }
        : current,
      series,
      events: timeline,
      coverage: {
        from: facts.usage[0]?.date ?? null,
        to:   facts.usage[facts.usage.length - 1]?.date ?? null,
      },
      voices,
      signalSources: SIGNAL_SOURCE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[radar/company] ${companyUid} 失敗:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
