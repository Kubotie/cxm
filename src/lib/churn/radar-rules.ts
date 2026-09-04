// ─── 解約レーダー：判定ロジック（純粋関数）────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md
//
// なぜ純粋関数として切るか:
//   **バックテストを回すため。** 過去のスナップショットを流し込めば、解約済み企業に
//   対して「何日前に鳴ったか」がその場で出る。閾値はその数字で決める。副作用を持つと
//   これができない（behavior-signals.ts と同じ理由）。
//
// なぜ単一スコアにしないか:
//   overall_health はまさに単一ラベルで、エレコムでは at_risk が4ヶ月鳴り続けても
//   誰も動かなかった。性質の違う3層（利用 / 関係 / 言質）を別々に立て、
//   更新までの残日数だけを乗数として掛ける。
//
// 評価できなかったものは黙って捨てない。入力が無い語彙は missing に理由付きで返す。
// 「立たなかった」と「見ていない」は意味が違う。
//
// 副作用なし。サーバー・クライアント両対応。

// ── 閾値 ──────────────────────────────────────────────────────────────────────

export const RADAR_THRESHOLD = {
  /** D1: 席の稼働率がこの比率を下回ったら「空いている」 */
  seatIdleRatio: 0.2,
  /** D1: 稼働率の低さがこの日数continueして初めて立てる（単発の谷で鳴らさない） */
  seatIdleDays: 30,
  /** D2: 施策の増減を見る窓 */
  campaignWindowDays: 60,
  /** D2: 窓の中で増加がなく、かつこの数以上純減していたら「畳んでいる」 */
  campaignNetDrop: 2,
  /** D3: 習慣化 No がこの日数連続 */
  habituationNoDays: 60,
  /** D4: 総ユーザー数がこの日数まったく変化しない */
  seatFrozenDays: 90,
  /** D5: 施策のピークを探す窓 */
  campaignPeakWindowDays: 180,
  /** D5: ピーク比がこの比率以下なら「畳み終わった状態」 */
  campaignPeakRatio: 0.5,
  /**
   * 窓の必要カバー率。
   *
   * ⚠️ これが無いと、記録開始直後の数日だけで「30日継続」を立ててしまう。
   *   実測（2026-09-04 バックテスト）: スナップショットが 5/1 に始まった直後の 5/1 に
   *   D1 が「0日継続」で点灯し、5/8 には critical に達していた。
   *   観測が窓を十分に埋めていないものは「立たなかった」ではなく「見ていない」に倒す。
   */
  minWindowCoverage: 0.7,
  /** B1: 接触空白の既定閾値 */
  blankDays: 60,
  /** B1: 更新がこの日数以内なら空白の閾値を短縮する */
  blankTightenWithinRenewal: 90,
  /** B1: 短縮後の空白閾値 */
  blankDaysTightened: 30,
  /** B2: 担当交代からこの日数以内を「直後」とみなす */
  ownerChangeDays: 90,
  /** S1: 高重要度チケットがこの日数以上開いていたら摩擦が残っている */
  staleHighTicketDays: 14,
} as const;

/** 層ごとの重み。ここを触ればスコアの性格が変わる */
export const RADAR_WEIGHT = {
  D1: 3, D2: 3, D4: 1, D5: 2,
  /**
   * D3（習慣化が戻らない）は重くしない。
   *
   * ⚠️ 実測（2026-09-04 バックテスト / Tier1-2 69社）: D3 は28社＝40%で立つ。
   *   ほぼ全社が該当する指標に識別力は無い。単独では watch にも届かない重さに留め、
   *   他の症状と重なったときだけ効かせる。
   */
  D3: 1,
  B1: 3, B2: 2, S1: 3,
  /** 言質は1件でも critical に届く重さを持たせる */
  V:  4,
} as const;

/** ステージ境界 */
export const RADAR_STAGE_CUT = { critical: 8, warn: 4, watch: 2 } as const;

/**
 * critical に必要な「更新までの近さ」。
 *
 * critical の意味は **今週手を打つ** であって「一番悪い」ではない。更新まで300日ある企業は、
 * どれだけ落ちていても今週やる仕事ではない（warn に留めて更新前に拾う）。
 * ただし言質だけは例外で、距離を問わず critical にする。顧客が口に出した以上、時間の問題ではない。
 */
export const RADAR_CRITICAL_WITHIN_DAYS = 180;

/**
 * 各シグナルが何を見て立ったか。
 *
 * **根拠を辿れない判定は使われない。** 画面はここを引いて「参照した情報」を出す。
 * 判定ロジックを変えたらここも直す（入力とラベルがずれると嘘になる）。
 */
export const SIGNAL_SOURCE: Record<string, string> = {
  D1: 'project_user_snapshots（日次）／席数と30日ログイン人数',
  D2: 'project_user_snapshots（日次）／稼働施策数',
  D3: 'csm_customer_phase（週次）／習慣化率',
  D4: 'project_user_snapshots（日次）／総ユーザー数',
  D5: 'project_user_snapshots（日次）／稼働施策数',
  B1: '議事録・Intercom・Slack・Chatwork・チケットの最終接点',
  B2: 'csm_customer_phase（週次）／CS担当者の変化',
  S1: 'cse_tickets／severity=high かつ未クローズ',
  V1: '議事録・問い合わせ本文からの抽出（人が採用したもの）',
  V2: '議事録・問い合わせ本文からの抽出（人が採用したもの）',
  V3: '議事録・問い合わせ本文からの抽出（人が採用したもの）',
  V4: '議事録・問い合わせ本文からの抽出（人が採用したもの）',
  V5: '議事録・問い合わせ本文からの抽出（人が採用したもの）',
};

// ── 入力 ──────────────────────────────────────────────────────────────────────

/** 利用系の1日分。company 配下の有料PJを合算した値 */
export interface UsageDay {
  date:       string;          // "YYYY-MM-DD"
  /** 総メンバー数（席） */
  seatTotal:  number | null;
  /** 過去30日に管理画面へログインした人数。イベント数ではない */
  seatActive: number | null;
  /** 目標付き稼働 Campaign 数 */
  campaigns:  number | null;
}

/** 習慣化の1日分（csm_customer_phase の週次行をそのまま使う） */
export interface HabituationDay {
  date:        string;
  /** 習慣化率 = Yes なら true */
  habituated:  boolean | null;
}

/** 承認済みの言質。未承認はスコアに入れない（誤検知が critical を汚すため） */
export interface VoiceHit {
  intentType: string;          // "V1" 〜 "V5"
  label:      string;          // 「自動更新の回避」など
  occurredAt: string;
  quote:      string;
}

/** 開いたままの高重要度チケット */
export interface OpenTicket {
  openedAt: string;
  title:    string | null;
}

export interface RadarInput {
  companyUid:   string;
  /** 基準日。省略時は今日 */
  today?:       string;
  renewalDate:  string | null;
  mrr:          number | null;
  /** 日付昇順。90日分あれば十分 */
  usage:        UsageDay[];
  /** 日付昇順。週次でよい */
  habituation:  HabituationDay[];
  /** 最終接点日（議事録 / Slack / Chatwork / Intercom の最大値） */
  lastContactDate: string | null;
  /** CSM 担当が変わった日。分からなければ null */
  ownerChangedAt:  string | null;
  /** 未取得なら null（S1 を評価しない）。空配列は「取得したが0件」 */
  openHighTickets: OpenTicket[] | null;
  /** 未取得なら null（V 層を評価しない） */
  voices:          VoiceHit[] | null;
}

// ── 出力 ──────────────────────────────────────────────────────────────────────

export type RadarLayer = 'decay' | 'blank' | 'voice';
export type RadarStage = 'critical' | 'warn' | 'watch' | 'clear';

export interface RadarSignal {
  id:     string;
  layer:  RadarLayer;
  label:  string;
  /** なぜ立ったか。**実測値を必ず含める**（顧客に持っていける粒度にする） */
  detail: string;
  weight: number;
}

export interface RadarResult {
  companyUid:   string;
  asOf:         string;
  stage:        RadarStage;
  /** clock 適用後 */
  score:        number;
  decayScore:   number;
  blankScore:   number;
  voiceScore:   number;
  clock:        number;
  daysToRenewal: number | null;
  /** スコープの角度を決める層。最大スコアの層。全て0なら decay */
  sector:       RadarLayer;
  signals:      RadarSignal[];
  /** 評価できなかった語彙と理由 */
  missing:      Array<{ id: string; reason: string }>;
  /** 「なぜ今この位置なのか」の1文。AI ではなくルールが組み立てる */
  topReason:    string;
}

// ── 日付ユーティリティ ────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" / ISO datetime を UTC ミリ秒に。壊れていれば null */
function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = String(value).trim().replace(' ', 'T');
  const ms = new Date(s.length === 10 ? `${s}T00:00:00Z` : s).getTime();
  return isNaN(ms) ? null : ms;
}

/** from から to までの日数。どちらか壊れていれば null */
export function daysBetween(from: string | null, to: string): number | null {
  const a = toMs(from), b = toMs(to);
  if (a === null || b === null) return null;
  return Math.floor((b - a) / DAY_MS);
}

/** 基準日から n 日前の "YYYY-MM-DD" */
function shiftDays(date: string, n: number): string {
  const ms = toMs(date);
  if (ms === null) return date;
  return new Date(ms + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * 窓を観測がどれだけ埋めているか（0〜1）。
 *
 * 「窓の中の全データが条件を満たす」系のルール（D1 / D3 / D4）は、
 * 観測が1点しかなくても真になってしまう。記録開始直後を点灯と誤認しないために、
 * 実際に観測がまたいでいる期間の割合で足切りする。
 */
function windowCoverage(dates: string[], today: string, windowDays: number): number {
  if (dates.length === 0) return 0;
  const first = dates[0];
  const span = daysBetween(first, today);
  if (span === null) return 0;
  return Math.min(1, (span + 1) / windowDays);
}

// ── 契約時計 ──────────────────────────────────────────────────────────────────

/**
 * 更新までの残日数から乗数を決める。
 * 同じ症状でも更新30日前と300日前では意味が違う。更新日が不明なら等倍。
 */
export function clockMultiplier(daysToRenewal: number | null): number {
  if (daysToRenewal === null) return 1.0;
  if (daysToRenewal <= 30)  return 2.0;
  if (daysToRenewal <= 90)  return 1.5;
  if (daysToRenewal <= 180) return 1.2;
  return 1.0;
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export function evaluateRadar(input: RadarInput): RadarResult {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const signals: RadarSignal[] = [];
  const missing: Array<{ id: string; reason: string }> = [];

  const hit = (id: string, layer: RadarLayer, label: string, detail: string) =>
    signals.push({ id, layer, label, detail, weight: RADAR_WEIGHT[id as keyof typeof RADAR_WEIGHT] ?? 0 });
  const skip = (id: string, reason: string) => missing.push({ id, reason });

  const daysToRenewal = input.renewalDate ? -(daysBetween(input.renewalDate, today) ?? 0) : null;

  // 日付昇順を保証する。呼び出し側の取得順に依存させない
  const usage = [...input.usage].sort((a, b) => a.date.localeCompare(b.date));
  const habit = [...input.habituation].sort((a, b) => a.date.localeCompare(b.date));

  // ── D1: 席が空いている ───────────────────────────────────────────────────
  // イベント数ではなく**人数**の稼働率で見る。エレコムの見逃しはここだった
  // （企業レベルの活動イベント数は12〜21で健全に見えたが、ログインは7人中1人）。
  const seatWindow = usage.filter(
    d => d.date >= shiftDays(today, -RADAR_THRESHOLD.seatIdleDays) &&
         d.seatTotal != null && d.seatTotal > 0 && d.seatActive != null,
  );
  const latestSeat = [...usage].reverse().find(d => d.seatTotal != null && d.seatTotal > 0);
  const seatCoverage = windowCoverage(seatWindow.map(d => d.date), today, RADAR_THRESHOLD.seatIdleDays);
  if (seatWindow.length === 0) {
    skip('D1', '席数・稼働人数の記録が窓内に無い');
  } else if (seatCoverage < RADAR_THRESHOLD.minWindowCoverage) {
    skip('D1', `席の記録が${RADAR_THRESHOLD.seatIdleDays}日窓の${Math.round(seatCoverage * 100)}%しかない`);
  } else {
    const allIdle = seatWindow.every(
      d => (d.seatActive as number) / (d.seatTotal as number) < RADAR_THRESHOLD.seatIdleRatio,
    );
    if (allIdle) {
      const last = seatWindow[seatWindow.length - 1];
      const streak = idleStreakDays(usage, today);
      hit('D1', 'decay', '席が空いている',
        `${last.seatTotal}席中 ${last.seatActive}人しかログインしていない状態が${streak}日`);
    }
  }

  // ── D2: 施策の単調減少 ───────────────────────────────────────────────────
  // 「減っている」ではなく「**増える月が一度もない**」を条件にする。
  // 入れ替えで一時的に減る運用と、畳んでいる顧客を分けるため。
  const campWindow = usage.filter(
    d => d.date >= shiftDays(today, -RADAR_THRESHOLD.campaignWindowDays) && d.campaigns != null,
  );
  if (campWindow.length < 2) {
    skip('D2', '施策数の記録が窓内に2日分もない');
  } else {
    const first = campWindow[0].campaigns as number;
    const last  = campWindow[campWindow.length - 1].campaigns as number;
    const peak  = Math.max(...campWindow.map(d => d.campaigns as number));
    const netDrop = first - last;
    // peak が first を超えていたら「増えた日がある」＝入れ替え運用とみなす
    const neverIncreased = peak <= first;
    if (neverIncreased && netDrop >= RADAR_THRESHOLD.campaignNetDrop) {
      hit('D2', 'decay', '施策の単調減少',
        `稼働施策が${RADAR_THRESHOLD.campaignWindowDays}日で ${first}件 → ${last}件（増えた日なし）`);
    }
  }

  // ── D3: 習慣化が戻らない ─────────────────────────────────────────────────
  const habitWindow = habit.filter(
    h => h.date >= shiftDays(today, -RADAR_THRESHOLD.habituationNoDays) && h.habituated != null,
  );
  const habitCoverage = windowCoverage(habitWindow.map(h => h.date), today, RADAR_THRESHOLD.habituationNoDays);
  if (habitWindow.length === 0) {
    skip('D3', '習慣化の記録が窓内に無い');
  } else if (habitCoverage < RADAR_THRESHOLD.minWindowCoverage) {
    skip('D3', `習慣化の記録が${RADAR_THRESHOLD.habituationNoDays}日窓の${Math.round(habitCoverage * 100)}%しかない`);
  } else if (habitWindow.every(h => h.habituated === false)) {
    const spanDays = daysBetween(habitWindow[0].date, today) ?? RADAR_THRESHOLD.habituationNoDays;
    hit('D3', 'decay', '習慣化が戻らない',
      `習慣化 No が${spanDays}日連続（${habitWindow.length}回の観測すべて）`);
  }

  // ── D5: 施策がピークから半減したまま ─────────────────────────────────────
  // D2 は「減っている最中」しか捉えられない。**畳み終わると消える。**
  // 実測（エレコム）: 5→2 の減少は 5〜7月に起き、9月時点では60日窓が全て 2件で平坦になり
  // D2 が消えた。畳まれた状態が続くこと自体がリスクなので、ピーク比で別に見る。
  const peakWindow = usage.filter(
    d => d.date >= shiftDays(today, -RADAR_THRESHOLD.campaignPeakWindowDays) && d.campaigns != null,
  );
  if (peakWindow.length < 2) {
    skip('D5', '施策数の記録が窓内に2日分もない');
  } else {
    const peak = Math.max(...peakWindow.map(d => d.campaigns as number));
    const now  = peakWindow[peakWindow.length - 1].campaigns as number;
    // ピークが1件以下だと比率が暴れる。純減2以上も同時に要求する
    if (peak >= 2 && now <= peak * RADAR_THRESHOLD.campaignPeakRatio && peak - now >= RADAR_THRESHOLD.campaignNetDrop) {
      const peakDay = peakWindow.find(d => d.campaigns === peak)?.date ?? '';
      hit('D5', 'decay', '施策がピークから半減',
        `稼働施策が ${peak}件（${peakDay}）→ ${now}件。戻っていない`);
    }
  }

  // ── D4: 席が増えない ─────────────────────────────────────────────────────
  // 単独では意味が薄い（安定運用でも増えない）。D1 と併発したときだけ立てる。
  const frozenWindow = usage.filter(
    d => d.date >= shiftDays(today, -RADAR_THRESHOLD.seatFrozenDays) && d.seatTotal != null,
  );
  const hasD1 = signals.some(s => s.id === 'D1');
  const frozenCoverage = windowCoverage(frozenWindow.map(d => d.date), today, RADAR_THRESHOLD.seatFrozenDays);
  if (frozenWindow.length < 2) {
    skip('D4', '席数の記録が窓内に2日分もない');
  } else if (!hasD1) {
    skip('D4', 'D1（席が空いている）が立っていないため評価しない');
  } else if (frozenCoverage < RADAR_THRESHOLD.minWindowCoverage) {
    skip('D4', `席数の記録が${RADAR_THRESHOLD.seatFrozenDays}日窓の${Math.round(frozenCoverage * 100)}%しかない`);
  } else {
    const uniq = new Set(frozenWindow.map(d => d.seatTotal));
    if (uniq.size === 1) {
      const spanDays = daysBetween(frozenWindow[0].date, today) ?? RADAR_THRESHOLD.seatFrozenDays;
      hit('D4', 'decay', '席が増えない',
        `総ユーザー数が${spanDays}日間 ${latestSeat?.seatTotal ?? '?'}人のまま`);
    }
  }

  // ── B1: 接触空白 ─────────────────────────────────────────────────────────
  const blank = daysBetween(input.lastContactDate, today);
  const tighten = daysToRenewal !== null && daysToRenewal <= RADAR_THRESHOLD.blankTightenWithinRenewal;
  const blankCut = tighten ? RADAR_THRESHOLD.blankDaysTightened : RADAR_THRESHOLD.blankDays;
  if (blank === null) {
    skip('B1', '最終接点の記録が無い');
  } else if (blank >= blankCut) {
    hit('B1', 'blank', '接触空白',
      tighten
        ? `最終接点から${blank}日（更新${daysToRenewal}日前のため${blankCut}日で判定）`
        : `最終接点から${blank}日`);
  }

  // ── B2: 担当交代の直後 ───────────────────────────────────────────────────
  // 交代そのものはリスクではない。**交代したのに接触が戻っていない**ことがリスク。
  const sinceOwnerChange = daysBetween(input.ownerChangedAt, today);
  const hasB1 = signals.some(s => s.id === 'B1');
  if (sinceOwnerChange === null) {
    skip('B2', '担当交代日が不明');
  } else if (!hasB1) {
    skip('B2', 'B1（接触空白）が立っていないため評価しない');
  } else if (sinceOwnerChange <= RADAR_THRESHOLD.ownerChangeDays) {
    hit('B2', 'blank', '担当交代の直後',
      `${sinceOwnerChange}日前に担当が変わり、以降の接触が戻っていない`);
  }

  // ── S1: 未解決の摩擦 ─────────────────────────────────────────────────────
  if (input.openHighTickets === null) {
    skip('S1', 'チケット状況を取得していない');
  } else {
    const stale = input.openHighTickets
      .map(t => ({ t, age: daysBetween(t.openedAt, today) }))
      .filter(x => x.age !== null && x.age >= RADAR_THRESHOLD.staleHighTicketDays)
      .sort((a, b) => (b.age as number) - (a.age as number));
    if (stale.length > 0) {
      const worst = stale[0];
      hit('S1', 'blank', '未解決の摩擦',
        `高重要度チケットが${worst.age}日開いたまま（${stale.length}件）`);
    }
  }

  // ── V: 言質 ──────────────────────────────────────────────────────────────
  if (input.voices === null) {
    skip('V', '言質の抽出結果を取得していない');
  } else {
    for (const v of input.voices) {
      signals.push({
        id: v.intentType, layer: 'voice', label: v.label,
        detail: `${v.occurredAt.slice(0, 10)}「${truncate(v.quote, 40)}」`,
        weight: RADAR_WEIGHT.V,
      });
    }
  }

  // ── 集計 ─────────────────────────────────────────────────────────────────
  const sum = (layer: RadarLayer) =>
    signals.filter(s => s.layer === layer).reduce((a, s) => a + s.weight, 0);
  const decayScore = sum('decay');
  const blankScore = sum('blank');
  const voiceScore = sum('voice');
  const clock = clockMultiplier(daysToRenewal);
  const score = Math.round((decayScore + blankScore + voiceScore) * clock * 10) / 10;

  // 更新日が不明な企業も critical には上げない。「いつまでに」が無いものは今週の仕事にできない。
  const renewalNear =
    daysToRenewal !== null && daysToRenewal <= RADAR_CRITICAL_WITHIN_DAYS;
  const reachedCritical = score >= RADAR_STAGE_CUT.critical;

  const stage: RadarStage =
    voiceScore > 0 ? 'critical'
    : reachedCritical && renewalNear ? 'critical'
    : reachedCritical || score >= RADAR_STAGE_CUT.warn ? 'warn'
    : score >= RADAR_STAGE_CUT.watch ? 'watch'
    : 'clear';

  // セクターは最大スコアの層。同点なら voice > blank > decay の順で重い方を採る
  const sector: RadarLayer =
    voiceScore >= blankScore && voiceScore >= decayScore && voiceScore > 0 ? 'voice'
    : blankScore >= decayScore && blankScore > 0 ? 'blank'
    : 'decay';

  return {
    companyUid: input.companyUid,
    asOf: today,
    stage, score, decayScore, blankScore, voiceScore, clock, daysToRenewal, sector,
    signals: signals.slice().sort((a, b) => b.weight - a.weight),
    missing,
    topReason: buildTopReason(signals, daysToRenewal, stage),
  };
}

// ── 補助 ──────────────────────────────────────────────────────────────────────

/** 稼働率が閾値を下回り続けている日数を、系列の末尾から遡って数える */
function idleStreakDays(usage: UsageDay[], today: string): number {
  let streak = 0;
  for (let i = usage.length - 1; i >= 0; i--) {
    const d = usage[i];
    if (d.seatTotal == null || d.seatTotal === 0 || d.seatActive == null) break;
    if (d.seatActive / d.seatTotal >= RADAR_THRESHOLD.seatIdleRatio) break;
    streak++;
  }
  // 系列の粒度は日次。観測が飛んでいる場合に実日数へ寄せる
  if (streak > 0) {
    const from = usage[usage.length - streak].date;
    return daysBetween(from, today) ?? streak;
  }
  return 0;
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/**
 * カードの1文を組み立てる。
 *
 * **AI に書かせない。** 生成待ちが発生するうえ、同じ状態でも文が揺れて
 * 「昨日と何が変わったか」が読めなくなる。ルールが立った順に事実を並べる。
 */
function buildTopReason(
  signals: RadarSignal[],
  daysToRenewal: number | null,
  stage: RadarStage,
): string {
  if (signals.length === 0) return '点灯している要因はない。';

  const head = daysToRenewal !== null
    ? (daysToRenewal < 0 ? '契約満了後、' : `更新まで${daysToRenewal}日。`)
    : '';

  // 重い順に2件まで。
  // 3件並べると一覧のカードで2〜3行に伸び、隣に置く根拠チップとほぼ同じ文が重複する。
  // 「なぜ今この位置か」は2件で言い切れる。残りはチップが担う。
  const top = signals.slice().sort((a, b) => b.weight - a.weight).slice(0, 2);
  const body = top.map(s => s.detail).join('。');
  const rest = signals.length - top.length;
  const more = rest > 0 ? `。ほか${rest}件` : '';
  const tail = stage === 'critical' ? '。今週手を打つ。' : '。';
  return `${head}${body}${more}${tail}`;
}
