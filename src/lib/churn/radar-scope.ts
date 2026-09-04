// ─── 解約レーダー：スコープの座標変換 ─────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.1
//
// 上半円（0°=右 / 90°=真上 / 180°=左）に企業を置く。
//   半径 = 更新までの日数（中心＝更新日、外周＝1年先）
//   角度 = 落ち方の種類（右＝言質 / 上＝関係 / 左＝利用）
//
// 副作用なし。描画側（クライアント）とテストの両方から使う。

import { daysToCancelDeadline, type RadarLayer, type RadarStage } from '@/lib/churn/radar-rules';

/** セクターの角度範囲（度）。上半円を3等分する */
export const SCOPE_SECTORS: Record<RadarLayer, [number, number]> = {
  voice: [0, 60],
  blank: [60, 120],
  decay: [120, 180],
};

export const SCOPE_SECTOR_LABEL: Record<RadarLayer, string> = {
  decay: '利用が減る',
  blank: '関係が冷える',
  voice: '言質',
};

/**
 * 危険圏＝解約申出の期限まで30日以内（＝更新31〜60日前）。
 *
 * **本当の締切は更新日ではない。** 解約を申し出られるのは更新30日前まで。
 * 半径は「締切までの残日数」で取り、この圏内に入った顧客が今週の仕事になる。
 */
export const SCOPE_DANGER_DAYS = 30;
/** 外周が示す日数（締切まで） */
export const SCOPE_MAX_DAYS = 335;
/**
 * 危険圏に割り当てる半径の比率。
 * 線形にすると危険圏が中心のごく一部に潰れて、一番見たい範囲が読めなくなる。
 */
const DANGER_RADIUS_RATIO = 0.42;
/**
 * 締切を過ぎた顧客を置く半径。
 * 今期はもう解約されないが、消すと見落とすので中心のすぐ外に薄く置く。
 */
const PASSED_RADIUS = 0.06;

export const STAGE_COLOR: Record<RadarStage, string> = {
  critical: '#ff5a4a',
  warn:     '#f0a13c',
  watch:    '#5c7d9e',
  clear:    '#33465e',
};

/**
 * 更新までの残日数を半径（0〜1）に変換する。
 *
 * 中心は「更新日」ではなく**解約を申し出られる最終日**（更新30日前）。
 * - 締切を過ぎたもの（更新30日以内）は中心のすぐ外に薄く固める。今期はもう動かせない
 * - 更新日が不明なものは外周に置く（時間の軸に乗せられないため）
 */
export function radiusRatio(daysToRenewal: number | null): number {
  const deadline = daysToCancelDeadline(daysToRenewal);
  if (deadline === null) return 1;
  if (deadline < 0) return PASSED_RADIUS;
  const d = Math.min(SCOPE_MAX_DAYS, deadline);
  if (d <= SCOPE_DANGER_DAYS) return (d / SCOPE_DANGER_DAYS) * DANGER_RADIUS_RATIO;
  return DANGER_RADIUS_RATIO
    + ((d - SCOPE_DANGER_DAYS) / (SCOPE_MAX_DAYS - SCOPE_DANGER_DAYS)) * (1 - DANGER_RADIUS_RATIO);
}

/** 危険圏に入っているか。更新31〜60日前 ＝ 締切まで0〜30日 */
export function inDangerZone(daysToRenewal: number | null): boolean {
  const d = daysToCancelDeadline(daysToRenewal);
  return d !== null && d >= 0 && d <= SCOPE_DANGER_DAYS;
}

/**
 * company_uid を安定した 0〜1 の値に落とす。
 * セクター内の配置に使う。**毎日同じ位置に出す**ためにランダムを使わない
 * （位置が動くと「増えた/動いた」の判断ができなくなる）。
 */
export function hashRatio(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** セクター内の角度（度）。両端に余白を取り、境界線に重ならないようにする */
export function angleFor(sector: RadarLayer, companyUid: string): number {
  const [lo, hi] = SCOPE_SECTORS[sector];
  const pad = 8;
  return lo + pad + hashRatio(companyUid) * (hi - lo - pad * 2);
}

/** MRR を点の半径（px）に。平方根スケールにしないと大口だけが画面を埋める */
export function dotRadius(mrr: number | null): number {
  if (!mrr || mrr <= 0) return 3;
  return 3 + Math.min(1, Math.sqrt(mrr / 800_000)) * 5.5;
}

/** 極座標 → SVG 座標 */
export function polar(
  cx: number, cy: number, r: number, deg: number,
): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
}
