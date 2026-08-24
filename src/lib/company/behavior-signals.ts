// ─── 内部・行動シグナルの検出（R* / O* / H*）──────────────────────────────────
//
// Notion A｜状況カタログ の「内部・行動」層の語彙を、既存データから組み立てる。
//
// なぜ必要か（2026-08-21 の実測）:
//   この層が未実装だったため、102社中72社が activeSignals を `PLAY_Deepen` 1個しか
//   持たず、WHAT の順位がカタログの登録件数という顧客と無関係な要素で決まっていた。
//   マッチングの形は動いていても出し分けにならない。解像度はここで決まる。
//
// 設計の要:
//   1. **判定は1箇所に閉じる。** signalIdsFromReadiness() が RD_*/PLAY_*/RENEWAL_* を
//      持つのと同じ理由で、R*/O*/H* もここだけで組み立てる。画面ごとにずれると追えない。
//   2. **評価できなかったものを黙って捨てない。** 入力が無い語彙は `missing` に理由付きで
//      返す。「立たなかった」と「見ていない」は意味が違う。
//   3. **閾値は BEHAVIOR_THRESHOLD に集約する。** 直接埋め込むと調整時に取り漏らす。
//   4. 近似で代用したものは `approximate: true` を付ける。定義そのままでない語彙を
//      定義通りに見せると、判断の根拠を誤らせる。
//
// 副作用なし。サーバー・クライアント両対応。

// ── 閾値 ──────────────────────────────────────────────────────────────────────

export const BEHAVIOR_THRESHOLD = {
  /** R1: 最終活動日からこの日数以上触られていない */
  noActivityDays: 14,
  /** R2: 直近7日が「30日平均の1週間分」に対してこの比率を下回ったら低下 */
  weeklyDropRatio: 0.6,
  /** R2: 母数が小さいと比率が暴れるため、30日活動量がこの値未満なら評価しない */
  weeklyDropMinBase: 20,
  /** R4: 直近7日の新規オープン件数がこの数以上で「急増」 */
  ticketBurstCount: 3,
  /** R5: 最終接点からこの日数以上で「途絶」 */
  silentDays: 60,
  /** R6: 当月PV / PV上限 がこの比率以上で「接近」 */
  pvNearRatio: 0.9,
  /** H3: 1PJあたり活動量が過去比でこの倍率以上なら「深さ向上」 */
  depthUpRatio: 1.2,
} as const;

/** overall_health の順序。O3（スコア上昇）の比較に使う */
const HEALTH_RANK: Record<string, number> = {
  critical: 0,
  at_risk: 1,
  healthy: 2,
  expanding: 3,
};

// ── 入力 ──────────────────────────────────────────────────────────────────────

/** company_snapshot の1日分（必要な列だけ） */
export interface SnapshotFacts {
  activeProjectCount:  number | null;
  stalledProjectCount: number | null;
  totalL30Active:      number | null;
  runningCampaignTotal: number | null;
  pvCeilingAlertCount: number | null;
  overallHealth:       string | null;
  mPhase:              string | null;
}

/** Metabase project-signals を企業内の有料PJで合算したもの */
export interface UsageFacts {
  campaigns:      number | null;
  heatmaps:       number | null;
  l30Active:      number | null;
  l7EventCount:   number | null;
  pvCeiling:      number | null;
  monthPvCount:   number | null;
  lastActiveDate: string | null;
}

/** サポート状況。一覧では取得しないことがあるため null 可 */
export interface SupportFacts {
  /** 直近7日に作成されたオープンケース数（RECENT_DAYS = 7） */
  recentSupportCount: number | null;
  /** リスクウィンドウ（90日）を超えて開いている件数 = 滞留 */
  staleOpenCount:     number | null;
}

export interface BehaviorSignalInput {
  latest: SnapshotFacts | null;
  /** 比較対象の過去スナップショット。無ければ推移系（O1/O3/H3）は評価しない */
  past:   SnapshotFacts | null;
  usage:  UsageFacts | null;
  /** 企業内いずれかの有料PJが習慣化していれば true / いずれも未達なら false */
  habituation: boolean | null;
  /** 最終接点からの空白日数 */
  communicationBlankDays: number | null;
  /** 有料プロジェクトの契約種別（O4 の「契約済みだが未使用」判定に使う） */
  paidTypes: string[];
  /**
   * オンボーディング完了日（csm_customer_phase の `4_ONB完了`）。
   * H2 はこれで厳密に判定する。M-Phase での代用は行わない。
   */
  onboardingCompletedAt?: string | null;
  /** 未取得なら null。R3 / R4 は評価しない扱いになる */
  support: SupportFacts | null;
  /** 基準日。省略時は今日 */
  today?: string;
}

// ── 出力 ──────────────────────────────────────────────────────────────────────

export interface DetectedBehaviorSignal {
  id:     string;
  /** なぜ立ったか（実測値を含める） */
  detail: string;
  /**
   * 定義そのままではなく近似で判定したもの。
   * UI とレポートで区別できないと、根拠の強さを誤解させる。
   */
  approximate: boolean;
}

export interface BehaviorSignalResult {
  /** activeSignals に合流させる状況ID */
  signalIds: string[];
  detected:  DetectedBehaviorSignal[];
  /** 評価できなかった語彙と理由。「立たなかった」と区別する */
  missing:   Array<{ id: string; reason: string }>;
}

export const EMPTY_BEHAVIOR_RESULT: BehaviorSignalResult = {
  signalIds: [], detected: [], missing: [],
};

// ── 本体 ──────────────────────────────────────────────────────────────────────

export function detectBehaviorSignals(input: BehaviorSignalInput): BehaviorSignalResult {
  const detected: DetectedBehaviorSignal[] = [];
  const missing:  Array<{ id: string; reason: string }> = [];

  const hit = (id: string, detail: string, approximate = false) =>
    detected.push({ id, detail, approximate });
  const skip = (id: string, reason: string) => missing.push({ id, reason });

  const { latest, past, usage, support } = input;
  const today = input.today ?? new Date().toISOString().slice(0, 10);

  // ── R1: 連続未ログイン ────────────────────────────────────────────────
  const idleDays = daysBetween(usage?.lastActiveDate ?? null, today);
  if (idleDays === null) {
    skip('R1_Risk_NoLogin_ConsecutiveDays', '最終活動日が未取得');
  } else if (idleDays >= BEHAVIOR_THRESHOLD.noActivityDays) {
    hit('R1_Risk_NoLogin_ConsecutiveDays', `最終活動から${idleDays}日`);
  }

  // ── R2: 利用量の週次低下 ──────────────────────────────────────────────
  // ⚠️ 真の週次比較（今週 vs 先週）はデータが無い。
  //   「直近7日 vs 30日平均の1週間分」で代用しているため approximate。
  const l7  = usage?.l7EventCount ?? null;
  const l30 = usage?.l30Active ?? null;
  if (l7 === null || l30 === null) {
    skip('R2_Risk_UsageDrop_WoW', '週次・30日の活動量が未取得');
  } else if (l30 < BEHAVIOR_THRESHOLD.weeklyDropMinBase) {
    skip('R2_Risk_UsageDrop_WoW', `30日活動量が${l30}件で母数不足（${BEHAVIOR_THRESHOLD.weeklyDropMinBase}件未満）`);
  } else {
    const expected = l30 / 4;
    if (l7 < expected * BEHAVIOR_THRESHOLD.weeklyDropRatio) {
      hit(
        'R2_Risk_UsageDrop_WoW',
        `直近7日 ${l7}件 / 30日平均の1週間分 ${Math.round(expected)}件`,
        true,
      );
    }
  }

  // ── R3 / R4: サポート ─────────────────────────────────────────────────
  if (!support) {
    skip('R3_Risk_UnresolvedTicket_Aging', 'サポート状況を取得していない');
    skip('R4_Risk_TicketBurst_L7', 'サポート状況を取得していない');
  } else {
    if (support.staleOpenCount === null) {
      skip('R3_Risk_UnresolvedTicket_Aging', '滞留件数が未取得');
    } else if (support.staleOpenCount >= 1) {
      hit('R3_Risk_UnresolvedTicket_Aging', `90日を超えて未解決 ${support.staleOpenCount}件`);
    }

    if (support.recentSupportCount === null) {
      skip('R4_Risk_TicketBurst_L7', '直近7日の件数が未取得');
    } else if (support.recentSupportCount >= BEHAVIOR_THRESHOLD.ticketBurstCount) {
      hit('R4_Risk_TicketBurst_L7', `直近7日の新規問い合わせ ${support.recentSupportCount}件`);
    }
  }

  // ── R5: 接点の途絶 ────────────────────────────────────────────────────
  const blank = input.communicationBlankDays;
  if (blank === null) {
    skip('R5_Risk_CommunicationSilent', '最終接点日が未取得');
  } else if (blank >= BEHAVIOR_THRESHOLD.silentDays) {
    hit('R5_Risk_CommunicationSilent', `最終接点から${blank}日`);
  }

  // ── R6: PV計測上限に接近 ──────────────────────────────────────────────
  const ceiling = usage?.pvCeiling ?? null;
  const pv      = usage?.monthPvCount ?? null;
  const pvAlert = latest?.pvCeilingAlertCount ?? null;
  if (ceiling !== null && ceiling > 0 && pv !== null) {
    const rate = pv / ceiling;
    if (rate >= BEHAVIOR_THRESHOLD.pvNearRatio) {
      hit('R6_Risk_PVQuotaNearCeiling', `当月PV消化率 ${Math.round(rate * 100)}%`);
    }
  } else if (pvAlert !== null && pvAlert >= 1) {
    // 合算値が取れない場合はスナップショットのPJ単位アラート数で拾う
    hit('R6_Risk_PVQuotaNearCeiling', `PV上限90%超のPJ ${pvAlert}件`, true);
  } else {
    skip('R6_Risk_PVQuotaNearCeiling', 'PV上限・当月PVが未取得');
  }

  // ── R7 / H1: 習慣化 ───────────────────────────────────────────────────
  if (input.habituation === null) {
    skip('R7_Risk_HabituationDrop_60d', '習慣化判定が未取得');
    skip('H1_Health_HighHabituation_60d', '習慣化判定が未取得');
  } else if (input.habituation) {
    hit('H1_Health_HighHabituation_60d', '有料PJが習慣化に到達');
  } else {
    hit('R7_Risk_HabituationDrop_60d', '有料PJが習慣化に未到達');
  }

  // ── O1: プロジェクト数の増加 ──────────────────────────────────────────
  const pjNow  = latest?.activeProjectCount ?? null;
  const pjPast = past?.activeProjectCount ?? null;
  if (pjNow === null || pjPast === null) {
    skip('O1_Opp_ProjectIncrease_Company', '有料アクティブPJ数の推移が未取得');
  } else if (pjNow > pjPast) {
    hit('O1_Opp_ProjectIncrease_Company', `有料アクティブPJ ${pjPast}→${pjNow}`);
  }

  // ── O2: 利用機能の幅が拡大 ────────────────────────────────────────────
  // ⚠️ 「幅」を完全に測るにはヒートマップ等の履歴列が必要。現状はキャンペーンの
  //   0→1 のみを「新しい機能を使い始めた」として拾っているため approximate。
  const cmpNow  = latest?.runningCampaignTotal ?? null;
  const cmpPast = past?.runningCampaignTotal ?? null;
  if (cmpNow === null || cmpPast === null) {
    skip('O2_Opp_UsageExpansion_BreadthUp', 'キャンペーン数の推移が未取得');
  } else if (cmpPast === 0 && cmpNow > 0) {
    hit('O2_Opp_UsageExpansion_BreadthUp', `キャンペーン運用を開始（0→${cmpNow}）`, true);
  }

  // ── O3: 健全性スコアの上昇 ────────────────────────────────────────────
  const hNow  = healthRank(latest?.overallHealth ?? null);
  const hPast = healthRank(past?.overallHealth ?? null);
  if (hNow === null || hPast === null) {
    skip('O3_Opp_HealthyScoreUp', 'overall_health の推移が未取得');
  } else if (hNow > hPast) {
    hit('O3_Opp_HealthyScoreUp', `健全性 ${past?.overallHealth}→${latest?.overallHealth}`);
  }

  // ── O4: 契約済みだが未使用 ────────────────────────────────────────────
  // 契約種別の実値（csm_customer_phase.paid_type / project_info.paid_type）:
  //   PTI-PAID    … Insight（解析・ヒートマップ）
  //   PTX-PAID    … Experience（ABテスト・Web接客）
  //   BUNDLE-PAID … **両方**。実測で110社中86社がこれ。
  //                 バンドル契約で片側しか使っていない状態こそ O4 の本命なので、
  //                 これを取りこぼすと語彙がほぼ立たない。
  //   FREE        … 契約なし（対象外）
  const types  = input.paidTypes.map(t => t.toUpperCase());
  const bundle = types.some(t => t.includes('BUNDLE'));
  const hasPtx = bundle || types.some(t => t.includes('PTX'));
  const hasPti = bundle || types.some(t => t.includes('PTI'));
  const unused: string[] = [];
  if (hasPtx && (usage?.campaigns ?? null) === 0) unused.push('Experience（キャンペーン0件）');
  if (hasPti && (usage?.heatmaps  ?? null) === 0) unused.push('Insight（ヒートマップ0件）');
  if (!hasPtx && !hasPti) {
    skip('O4_Opp_FeatureReady_NotUsed', '有料契約種別が未取得');
  } else if (usage === null) {
    skip('O4_Opp_FeatureReady_NotUsed', '利用実績が未取得');
  } else if (unused.length > 0) {
    hit('O4_Opp_FeatureReady_NotUsed', `契約済みで未使用: ${unused.join(' / ')}`);
  }

  // ── H2: 初期ガイド完了 ────────────────────────────────────────────────
  // csm_customer_phase の `4_ONB完了`（完了日）が正本。日付が入っていれば完了。
  // M-Phase による代用はしない（フェーズは巻き戻ることがあり完了の証明にならない）。
  const onb = (input.onboardingCompletedAt ?? '').trim();
  const phase = (latest?.mPhase ?? '').trim();
  if (onb) {
    hit('H2_Health_FirstGuideProgress_Complete', `オンボーディング完了 ${onb.slice(0, 10)}`);
  } else if (!phase) {
    skip('H2_Health_FirstGuideProgress_Complete', 'オンボーディング完了日・M-Phase がいずれも未取得');
  } else {
    // フェーズは取れているが完了日が無い = 未完了として扱う（立てない）
  }

  // ── H3: 利用の深さが向上 ──────────────────────────────────────────────
  // 深さ = 1PJあたりの30日活動量。PJが増えただけの「広がり」と区別する。
  const depthNow  = perProject(latest?.totalL30Active ?? null, pjNow);
  const depthPast = perProject(past?.totalL30Active ?? null, pjPast);
  if (depthNow === null || depthPast === null || depthPast === 0) {
    skip('H3_Health_DepthScoreUp', '1PJあたり活動量の推移が算出できない');
  } else if (depthNow >= depthPast * BEHAVIOR_THRESHOLD.depthUpRatio) {
    hit(
      'H3_Health_DepthScoreUp',
      `1PJあたり活動量 ${Math.round(depthPast)}→${Math.round(depthNow)}`,
    );
  }

  // ── H4: アクティブユーザー増（14日）──────────────────────────────────
  // 保持しているのはイベント数で、ユーザー数の履歴が無い。14日窓も取っていない。
  // イベント数で代用すると別の指標を同じ名前で出すことになるため評価しない。
  skip('H4_Health_ActiveUsersUp_L14', 'アクティブユーザー数の履歴を保持していない（イベント数での代用はしない）');

  // ── H5: 30日間リスクなしで安定 ────────────────────────────────────────
  // R* が1つも立っていないことが条件。最後に判定する。
  const riskFired = detected.some(d => d.id.startsWith('R'));
  const riskUnevaluated = missing.filter(m => m.id.startsWith('R'));
  if (!past) {
    skip('H5_Health_StableNoRiskAlerts_30d', '30日前のスナップショットが無く安定を確認できない');
  } else if (riskUnevaluated.length > 0) {
    skip(
      'H5_Health_StableNoRiskAlerts_30d',
      `未評価のリスク語彙があるため安定と断定しない（${riskUnevaluated.map(m => m.id).join(', ')}）`,
    );
  } else if (!riskFired) {
    hit('H5_Health_StableNoRiskAlerts_30d', 'リスク語彙がいずれも立たず30日継続');
  }

  return {
    signalIds: detected.map(d => d.id),
    detected,
    missing,
  };
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function healthRank(value: string | null): number | null {
  if (!value) return null;
  const rank = HEALTH_RANK[value.trim().toLowerCase()];
  return rank === undefined ? null : rank;
}

function perProject(total: number | null, projects: number | null): number | null {
  if (total === null || projects === null || projects <= 0) return null;
  return total / projects;
}

/** from から to までの日数。どちらか欠けていれば null */
function daysBetween(from: string | null, to: string): number | null {
  if (!from) return null;
  const a = new Date(`${String(from).slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${to.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / 86400000);
}
