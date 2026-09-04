// ─── GET /api/radar/board ─────────────────────────────────────────────────────
//
// 解約レーダーのトップ（スコープ）が読むデータ。
//
// **ここでは判定しない。** churn_radar_state を読んで整形するだけ。
// 日次バッチ（/api/batch/churn-radar）が書いた作り置きを返す。
// 設計 §3「読むときに計算しない」— 個社 usage の CSV 全件DL 遅延事故を繰り返さないため。

import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import {
  fetchAllRadarStates, parseReason, radarTablesReady,
  type RadarStateRow, type AckStatus,
} from '@/lib/churn/radar-state';
import { inDangerZone } from '@/lib/churn/radar-scope';
import type { RadarStage, RadarSignal, RadarLayer } from '@/lib/churn/radar-rules';

export const dynamic = 'force-dynamic';

// ── 出力型（クライアントと共有）──────────────────────────────────────────────

export interface RadarBoardPoint {
  companyUid:    string;
  name:          string;
  stage:         RadarStage;
  score:         number;
  sector:        RadarLayer;
  daysToRenewal: number | null;
  renewalDate:   string | null;
  mrr:           number | null;
  tier:          number | null;
  ownerName:     string | null;
  topReason:     string;
  /** 根拠。カードに実測値つきで出す */
  signals:       RadarSignal[];
  /** 初回点灯からの経過日数。**放置の可視化がこの画面の要** */
  agedDays:      number | null;
  /** 7日以内の新規点灯。スコープで明滅させる */
  isNew:         boolean;
  ackStatus:     AckStatus;
  ackBy:         string | null;
}

export interface RadarBoardResponse {
  ready:   boolean;
  asOf:    string | null;
  /** 現在ユーザーの owner 名（name2）。担当フィルタの初期値に使う */
  viewerOwnerName: string | null;
  counts:  Record<RadarStage, number> & { total: number };
  /** 解約申出の期限まで30日以内（＝更新31〜60日前）かつ点灯中 */
  dangerZone:      number;
  /** 危険圏の MRR 合計 */
  dangerZoneMrr:   number;
  newlyDetected:   number;
  recoveredThisWeek: number;
  longestAged:     { name: string; days: number } | null;
  unacked:         number;
  /** 言質のレビュー待ち。溜まると critical に上がるはずの企業が上がらない */
  voiceReviewPending: number;
  points:          RadarBoardPoint[];
  /** セットアップが未完了のときの案内 */
  setupHint?:      string;
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────

const DAY_MS = 86400_000;

function daysSince(date: string | null | undefined, today: string): number | null {
  if (!date) return null;
  const a = new Date(`${String(date).slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.floor((b - a) / DAY_MS);
}

function toPoint(row: RadarStateRow, today: string): RadarBoardPoint {
  const aged = daysSince(row.first_detected_at, today);
  return {
    companyUid:    row.company_uid,
    name:          row.canonical_name?.trim() || row.company_uid,
    stage:         (row.stage ?? 'clear') as RadarStage,
    score:         Number(row.score ?? 0),
    sector:        (row.sector ?? 'decay') as RadarLayer,
    daysToRenewal: row.days_to_renewal ?? null,
    renewalDate:   row.renewal_date ?? null,
    mrr:           row.mrr ?? null,
    tier:          row.tier ?? null,
    ownerName:     row.owner_name ?? null,
    topReason:     row.top_reason ?? '',
    signals:       parseReason(row.reason_json).signals,
    agedDays:      aged,
    isNew:         aged !== null && aged <= 7,
    ackStatus:     (row.ack_status ?? 'none') as AckStatus,
    ackBy:         row.ack_by ?? null,
  };
}

/** レビュー待ちの言質（要レビューのみ）。溜まっていること自体を画面に出す */
async function countVoiceReviewPending(): Promise<number> {
  if (!TABLE_IDS.churn_radar_voice) return 0;
  const rows = await nocoFetch<{ review_status?: string | null }>(TABLE_IDS.churn_radar_voice, {
    where:  '(review_status,eq,pending)~and(review_priority,eq,required)',
    fields: 'review_status',
    limit:  '500',
  }, false).catch(() => []);
  return rows.length;
}

/** 今週 clear に戻った件数。events から数える（state には残らないため） */
async function countRecovered(sinceDate: string): Promise<number> {
  if (!TABLE_IDS.churn_radar_events) return 0;
  const rows = await nocoFetch<{ event_type?: string | null }>(TABLE_IDS.churn_radar_events, {
    where:  `(occurred_at,gte,${sinceDate})~and(event_type,eq,cleared)`,
    fields: 'event_type',
    limit:  '200',
  }, false).catch(() => []);
  return rows.length;
}

// ── 本体 ─────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<RadarBoardResponse>> {
  const today = new Date().toISOString().slice(0, 10);
  const empty: RadarBoardResponse = {
    ready: false, asOf: null, viewerOwnerName: null,
    counts: { critical: 0, warn: 0, watch: 0, clear: 0, total: 0 },
    dangerZone: 0, dangerZoneMrr: 0, newlyDetected: 0, recoveredThisWeek: 0,
    longestAged: null, unacked: 0, voiceReviewPending: 0, points: [],
  };

  if (!radarTablesReady()) {
    return NextResponse.json({
      ...empty,
      setupHint: 'NOCODB_CHURN_RADAR_STATE_TABLE_ID が未設定です。テーブルを作成して環境変数に設定してください。',
    });
  }

  const [rows, profile] = await Promise.all([
    fetchAllRadarStates(),
    getCurrentUserProfile().catch(() => null),
  ]);

  if (rows.length === 0) {
    return NextResponse.json({
      ...empty, ready: true,
      viewerOwnerName: profile?.name2 ?? null,
      setupHint: 'まだ走査結果がありません。/api/batch/churn-radar を1度実行してください。',
    });
  }

  const points = rows.map(r => toPoint(r, today));

  const counts = { critical: 0, warn: 0, watch: 0, clear: 0, total: points.length } as
    Record<RadarStage, number> & { total: number };
  for (const p of points) counts[p.stage]++;

  const lit = points.filter(p => p.stage !== 'clear');
  // 危険圏＝解約申出の期限（更新30日前）まで30日以内
  const danger = lit.filter(p => inDangerZone(p.daysToRenewal));

  const longest = lit
    .filter(p => p.agedDays !== null)
    .sort((a, b) => (b.agedDays as number) - (a.agedDays as number))[0];

  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString().slice(0, 10);

  return NextResponse.json({
    ready: true,
    asOf: rows[0]?.as_of ?? today,
    viewerOwnerName: profile?.name2 ?? null,
    counts,
    dangerZone: danger.length,
    dangerZoneMrr: danger.reduce((a, p) => a + (p.mrr ?? 0), 0),
    newlyDetected: lit.filter(p => p.isNew).length,
    recoveredThisWeek: await countRecovered(weekAgo),
    voiceReviewPending: await countVoiceReviewPending(),
    longestAged: longest ? { name: longest.name, days: longest.agedDays as number } : null,
    unacked: lit.filter(p => p.ackStatus === 'none').length,
    // スコアの重い順。スコープは全点を描き、リストは上位だけを使う
    points: points.sort((a, b) => b.score - a.score),
  });
}
