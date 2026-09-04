// ─── 解約レーダー：走査の実処理 ───────────────────────────────────────────────
//
// バッチ（/api/batch/churn-radar）から呼ばれる本体。
// route.ts に置くと Next.js の route 型制約（HTTP メソッド以外を export できない）に
// 引っかかるため、既存の churn-report-run.ts と同じくライブラリ側に切り出している。

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { writeBatchRunLog } from '@/lib/batch/logger';
import { collectRadarFacts, factsToInput } from '@/lib/churn/radar-input';
import { evaluateRadar } from '@/lib/churn/radar-rules';
import {
  fetchAllRadarStates, upsertRadarState, appendRadarEvent, stageRank,
  type RadarStateRow, type RadarEventType,
} from '@/lib/churn/radar-state';

export interface RunResult {
  asOf:        string;
  targets:     number;
  written:     number;
  failed:      number;
  distribution: Record<string, number>;
  changes:     Array<{ companyUid: string; name: string | null; from: string; to: string; score: number }>;
  durationMs:  number;
}

const DAY_MS = 86400_000;

function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * 初回走査の企業について、初回点灯日を過去に遡って求める。
 *
 * なぜ要るか: state が無い状態で走らせると全社の first_detected_at が「今日」になり、
 * 「何日鳴りっぱなしか」が全社0日になる。**放置の可視化がこの画面の要**なので、
 * 材料がある範囲で実際の点灯開始日まで戻す。
 *
 * 7日刻み・最大180日。clear に戻った時点で止め、その後の点灯開始日を返す
 * （途中で解消しているなら、そこからが今回の点灯）。
 */
function backfillFirstDetected(
  facts: Parameters<typeof factsToInput>[0],
  asOf: string,
): string | null {
  let earliest = asOf;
  for (let i = 7; i <= 180; i += 7) {
    const d = addDays(asOf, -i);
    const r = evaluateRadar(factsToInput(facts, d));
    if (r.stage === 'clear') break;
    earliest = d;
  }
  return earliest;
}

/** 対象は Tier1/2 の active。Tier3 は件数が多く担当もいないため /v2/tier3 側に任せる */
async function fetchTargetUids(): Promise<string[]> {
  const rows = await nocoFetch<{ company_uid?: string | null }>(TABLE_IDS.companies, {
    where:  '(status,eq,active)~and(tier,in,1,2)',
    fields: 'company_uid',
    limit:  '500',
  }, false).catch(() => []);
  return rows.map(r => r.company_uid?.trim()).filter((u): u is string => !!u);
}

export async function runChurnRadar(dryRun: boolean, onlyUids?: string[]): Promise<RunResult> {
  const startedAt = Date.now();
  const asOf = new Date().toISOString().slice(0, 10);

  const uids = onlyUids?.length ? onlyUids : await fetchTargetUids();
  const factsMap = await collectRadarFacts(uids);

  // 前日までの state を一括で読む。1社ずつ引くと 69 往復になる
  const prevStates = new Map<string, RadarStateRow>();
  if (!dryRun) {
    for (const row of await fetchAllRadarStates()) {
      if (row.company_uid) prevStates.set(row.company_uid, row);
    }
  }

  const distribution: Record<string, number> = { critical: 0, warn: 0, watch: 0, clear: 0 };
  const changes: RunResult['changes'] = [];
  let written = 0, failed = 0;

  for (const uid of uids) {
    const facts = factsMap.get(uid);
    if (!facts) continue;

    const result = evaluateRadar(factsToInput(facts, asOf));
    distribution[result.stage] = (distribution[result.stage] ?? 0) + 1;

    const prev = prevStates.get(uid) ?? null;
    const stageChanged = prev?.stage !== result.stage;

    // 初回走査だけ、実際の点灯開始日まで遡る。
    // 前回値があるときは upsertRadarState がそちらを優先するので計算しない。
    const backfilled =
      prev || result.stage === 'clear' ? null : backfillFirstDetected(facts, asOf);
    if (stageChanged && prev) {
      changes.push({
        companyUid: uid, name: facts.canonicalName,
        from: prev.stage, to: result.stage, score: result.score,
      });
    }

    if (dryRun) { written++; continue; }

    try {
      await upsertRadarState({
        company_uid:     uid,
        as_of:           asOf,
        stage:           result.stage,
        score:           result.score,
        decay_score:     result.decayScore,
        blank_score:     result.blankScore,
        voice_score:     result.voiceScore,
        clock:           result.clock,
        days_to_renewal: result.daysToRenewal,
        renewal_date:    facts.renewalDate,
        sector:          result.sector,
        top_reason:      result.topReason,
        reason_json:     JSON.stringify({ signals: result.signals, missing: result.missing }),
        signal_ids:      result.signals.map(s => s.id).join(','),
        first_detected_at: backfilled,
        stage_changed_at:  null,
        canonical_name:  facts.canonicalName,
        owner_name:      facts.ownerName,
        tier:            facts.tier,
        mrr:             facts.mrr,
        ack_status:      'none',   // 同上（悪化時のみリセットされる）
        ack_by:          null,
        ack_at:          null,
        ack_note:        null,
      }, prev);
      written++;

      // 変化だけを events に残す。毎日全社ぶん書くとログが読めなくなる
      if (stageChanged) {
        const eventType: RadarEventType =
          !prev ? 'detected'
          : result.stage === 'clear' ? 'cleared'
          : stageRank(result.stage) > stageRank(prev.stage) ? 'escalated'
          : 'recovered';
        // 初回は「今日点灯した」ではなく、遡って求めた実際の点灯日で記録する。
        // ここを当日にすると、放置日数（133日）と出来事（本日点灯）が食い違う。
        const occurredAt = !prev ? backfilled ?? asOf : asOf;
        await appendRadarEvent({
          event_id:    `${uid}:${occurredAt}:${result.stage}`,
          company_uid: uid,
          occurred_at: occurredAt,
          event_type:  eventType,
          from_stage:  prev?.stage ?? null,
          to_stage:    result.stage,
          score:       result.score,
          detail:      result.topReason,
          signal_ids:  result.signals.map(x => x.id).join(','),
        });
      }
    } catch (err) {
      console.error(`[batch/churn-radar] upsert 失敗 ${uid}:`, err);
      failed++;
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[batch/churn-radar] 完了 asOf=${asOf} targets=${uids.length} written=${written} failed=${failed} ` +
    `critical=${distribution.critical} warn=${distribution.warn} duration=${durationMs}ms`,
  );

  if (!dryRun) {
    const finishedAt = new Date();
    await writeBatchRunLog({
      endpoint:        '/api/batch/churn-radar',
      batch_type:      'churn-radar',
      started_at:      new Date(startedAt).toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     durationMs,
      dry_run:         false,
      source_queue:    'companies',
      request_params:  JSON.stringify({ as_of: asOf, only_uids: onlyUids?.length ?? 0 }),
      filters:         JSON.stringify({ tier: [1, 2], status: 'active' }),
      total_targeted:  uids.length,
      ok_count:        written,
      success_count:   written,
      partial_count:   0,
      failed_count:    failed,
      skipped_count:   uids.length - written - failed,
      failure_details: '[]',
      result_json:     JSON.stringify({ distribution, changes }),
    }).catch(err => console.warn('[batch/churn-radar] 監査ログ書き込み失敗:', err));
  }

  return { asOf, targets: uids.length, written, failed, distribution, changes, durationMs };
}
