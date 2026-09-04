// ─── 解約レーダー：state / events の read・write ──────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §4
//
// churn_radar_state は **1社1行**。日次バッチが上書きし、画面はこれを読むだけ。
// 「読むときに計算しない」を守るための作り置きテーブル。
//
// ⚠️ project_user_snapshots は PK 無しで重複行が溜まり続けている。同じ轍を踏まないよう、
//    ここでは company_uid を一意キーとして扱い、必ず「引いてから update / create」する。

import { nocoFetch, nocoFetchAll, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';
import type { RadarStage, RadarLayer, RadarSignal } from '@/lib/churn/radar-rules';

// ── 型 ────────────────────────────────────────────────────────────────────────

export type AckStatus = 'none' | 'ack' | 'working' | 'watching' | 'dismissed';

export interface RadarStateRow {
  Id?:                number;
  company_uid:        string;
  as_of:              string;
  stage:              RadarStage;
  score:              number;
  decay_score:        number;
  blank_score:        number;
  voice_score:        number;
  clock:              number;
  days_to_renewal:    number | null;
  renewal_date:       string | null;
  sector:             RadarLayer;
  top_reason:         string;
  /** 立った全シグナルと実測値。UI のカードはここから根拠を描く */
  reason_json:        string;
  signal_ids:         string;
  /** 初めて watch 以上になった日。**放置日数の起点**なので絶対に上書きしない */
  first_detected_at:  string | null;
  stage_changed_at:   string | null;
  canonical_name:     string | null;
  owner_name:         string | null;
  tier:               number | null;
  mrr:                number | null;
  ack_status:         AckStatus;
  ack_by:             string | null;
  ack_at:             string | null;
  ack_note:           string | null;
}

export type RadarEventType = 'detected' | 'escalated' | 'recovered' | 'cleared' | 'acked' | 'dismissed';

export interface RadarEventRow {
  Id?:          number;
  event_id:     string;
  company_uid:  string;
  occurred_at:  string;
  event_type:   RadarEventType;
  from_stage:   string | null;
  to_stage:     string | null;
  score:        number | null;
  detail:       string | null;
  /** そのとき立っていたシグナル。**後から根拠を辿るために要る** */
  signal_ids:   string | null;
}

/** reason_json に入れる構造。UI 側と共有する */
export interface RadarReason {
  signals: RadarSignal[];
  missing: Array<{ id: string; reason: string }>;
}

// ── 読み取り ─────────────────────────────────────────────────────────────────

export function radarTablesReady(): boolean {
  return Boolean(TABLE_IDS.churn_radar_state);
}

/** 全 state を取得する（board 画面用。69社想定なので全件で足りる） */
export async function fetchAllRadarStates(): Promise<RadarStateRow[]> {
  if (!TABLE_IDS.churn_radar_state) return [];
  const rows = await nocoFetchAll<RadarStateRow>(TABLE_IDS.churn_radar_state, {
    sort: '-score',
  }).catch(err => {
    console.warn('[radar-state] 一覧取得に失敗:', err);
    return [] as RadarStateRow[];
  });
  return rows;
}

export async function fetchRadarState(companyUid: string): Promise<RadarStateRow | null> {
  if (!TABLE_IDS.churn_radar_state) return null;
  const rows = await nocoFetch<RadarStateRow>(TABLE_IDS.churn_radar_state, {
    where: `(company_uid,eq,${companyUid})`,
    limit: '1',
  }, false).catch(() => [] as RadarStateRow[]);
  return rows[0] ?? null;
}

/** 1社の変化ログを新しい順に返す（個社ドリルのタイムライン用） */
export async function fetchRadarEvents(companyUid: string, limit = 60): Promise<RadarEventRow[]> {
  if (!TABLE_IDS.churn_radar_events) return [];
  return nocoFetch<RadarEventRow>(TABLE_IDS.churn_radar_events, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-occurred_at',
    limit: String(limit),
  }, false).catch(() => [] as RadarEventRow[]);
}

// ── 書き込み ─────────────────────────────────────────────────────────────────

/**
 * state を upsert する。
 *
 * 引き継ぐもの:
 *   - first_detected_at … clear に戻るまでリセットしない（放置日数の起点）
 *   - ack_*             … ステージが上がったときだけ none に戻す
 *     （悪化したのに「確認済み」のままだと、また4ヶ月放置が起きる）
 */
export async function upsertRadarState(
  next: Omit<RadarStateRow, 'Id'>,
  prev: RadarStateRow | null,
): Promise<{ created: boolean; stageChanged: boolean } | null> {
  const tableId = TABLE_IDS.churn_radar_state;
  if (!tableId) return null;

  const stageChanged = prev?.stage !== next.stage;
  const escalated = stageChanged && stageRank(next.stage) > stageRank(prev?.stage ?? 'clear');

  const payload: Omit<RadarStateRow, 'Id'> = {
    ...next,
    // 前回値が最優先。無ければ呼び出し側が遡って求めた値（初回走査の遡及）、
    // それも無ければ当日。**ここを上書きすると放置日数が毎日リセットされる。**
    first_detected_at:
      next.stage === 'clear' ? null
      : prev?.first_detected_at ?? next.first_detected_at ?? next.as_of,
    stage_changed_at: stageChanged ? next.as_of : prev?.stage_changed_at ?? next.as_of,
    ack_status: escalated ? 'none' : prev?.ack_status ?? 'none',
    ack_by:     escalated ? null : prev?.ack_by ?? null,
    ack_at:     escalated ? null : prev?.ack_at ?? null,
    ack_note:   escalated ? null : prev?.ack_note ?? null,
  };

  if (prev?.Id != null) {
    await nocoUpdate(tableId, prev.Id, payload as unknown as Record<string, unknown>);
    return { created: false, stageChanged };
  }
  await nocoCreate<RadarStateRow>(tableId, payload as unknown as Record<string, unknown>);
  return { created: true, stageChanged };
}

export async function appendRadarEvent(event: Omit<RadarEventRow, 'Id'>): Promise<void> {
  const tableId = TABLE_IDS.churn_radar_events;
  if (!tableId) return;
  await nocoCreate<RadarEventRow>(tableId, event as unknown as Record<string, unknown>)
    .catch(err => console.warn('[radar-state] event 追記に失敗:', err));
}

/** 確認操作（見た / 対応中 / 様子見 / 誤検知）を保存する */
export async function saveRadarAck(
  companyUid: string,
  ack: { status: AckStatus; by: string; note?: string | null },
): Promise<boolean> {
  const tableId = TABLE_IDS.churn_radar_state;
  if (!tableId) return false;
  const prev = await fetchRadarState(companyUid);
  if (!prev?.Id) return false;

  const at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await nocoUpdate(tableId, prev.Id, {
    ack_status: ack.status,
    ack_by:     ack.by,
    ack_at:     at,
    ack_note:   ack.note ?? null,
  });
  await appendRadarEvent({
    event_id:    `${companyUid}:${at}`,
    company_uid: companyUid,
    occurred_at: at.slice(0, 10),
    event_type:  ack.status === 'dismissed' ? 'dismissed' : 'acked',
    from_stage:  prev.stage,
    to_stage:    prev.stage,
    score:       prev.score ?? null,
    detail:      `${ack.by} が「${ACK_LABEL[ack.status]}」にした${ack.note ? `：${ack.note}` : ''}`,
    signal_ids:  prev.signal_ids ?? null,
  });
  return true;
}

export const ACK_LABEL: Record<AckStatus, string> = {
  none:      '未確認',
  ack:       '見た',
  working:   '対応中',
  watching:  '様子見',
  dismissed: '誤検知',
};

export function stageRank(stage: RadarStage | string): number {
  return { clear: 0, watch: 1, warn: 2, critical: 3 }[stage as RadarStage] ?? 0;
}

/** reason_json を安全に読む。壊れていても画面を落とさない */
export function parseReason(raw: string | null | undefined): RadarReason {
  if (!raw) return { signals: [], missing: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<RadarReason>;
    return { signals: parsed.signals ?? [], missing: parsed.missing ?? [] };
  } catch {
    return { signals: [], missing: [] };
  }
}
