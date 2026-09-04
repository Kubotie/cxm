// ─── 解約レーダー：言質抽出の実処理 ───────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §3（新規② churn-voice）
//
// 直近の議事録 / Intercom / チケット本文を LLM に通し、契約継続の判断に触れる発言を
// **原文引用つき**で churn_radar_voice に保存する。review_status=pending で入り、
// 人が承認するまでスコアには入らない（誤検知が critical を汚さないようにするため）。
//
// 対象を「直近N日ぶん」に絞るのはコストのためだけではない。古い発言まで拾うと、
// 既に解消した話が今日の critical を作ってしまう。

import { nocoFetch, nocoFetchAllByUids, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoCreate } from '@/lib/nocodb/write';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  CHURN_VOICE_SYSTEM_PROMPT, CHURN_VOICE_JSON_SCHEMA,
  buildChurnVoicePrompt, VOICE_INTENT_LABEL, voiceReviewPriority,
} from '@/lib/prompts/churn-voice';

// ── 型 ────────────────────────────────────────────────────────────────────────

interface SourceDoc {
  companyUid:  string;
  companyName: string;
  sourceType:  'minutes' | 'intercom' | 'ticket';
  sourceRecordId: string;
  title:       string | null;
  occurredAt:  string;
  body:        string;
}

export interface VoiceRunResult {
  scannedDocs:  number;
  companies:    number;
  extracted:    number;
  skippedExisting: number;
  failed:       number;
  /** この回で処理しきれなかった残り。0 になるまで再実行すれば全社に行き渡る */
  remaining:    number;
  durationMs:   number;
  /** 自社側の発言として捨てた数。プロンプトの効き具合はここで見る */
  droppedNonCustomer: number;
  hits: Array<{
    companyName: string; intentType: string; confidence: number;
    occurredAt: string; quote: string; priority: 'required' | 'reference';
  }>;
}

/** LLM に投げる本文の上限。議事録は長いが、冒頭〜中盤に要点が集まる */
const BODY_LIMIT = 12_000;
/**
 * 1回の走査で扱う文書数の上限。
 *
 * ⚠️ 1文書あたり LLM 呼び出しが2〜3秒かかる。maxDuration は 300 秒なので、
 *   200 件だと初回（未処理が大量にある週）に確実に打ち切られる。
 *   処理済みは source_record_id でスキップするため、週を跨いで少しずつ進めばよい。
 */
const MAX_DOCS = 60;

const DAY_MS = 86400_000;

/**
 * 引用文から安定した短いキーを作る。
 *
 * voice_id を `文書ID:意図` にしていたら、同じ議事録から同じ意図が2件出たときに
 * 衝突した（実測: React の key 重複 → レビュー時にどちらが更新されるか不定）。
 * 引用そのものを混ぜて一意にする。**再抽出しても同じ引用なら同じ ID** になるので、
 * レビュー状態を引き継げる。
 */
function quoteKey(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function ymd(value: unknown): string | null {
  if (value == null || value === '') return null;
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// ── 対象文書の収集 ────────────────────────────────────────────────────────────

async function collectDocs(uids: string[], since: string): Promise<SourceDoc[]> {
  const nameByUid = new Map<string, string>();
  const companyRows = await nocoFetch<{ company_uid?: string; canonical_name?: string }>(
    TABLE_IDS.companies,
    { where: `(company_uid,in,${uids.join(',')})`, fields: 'company_uid,canonical_name', limit: '500' },
    false,
  ).catch(() => []);
  for (const r of companyRows) {
    if (r.company_uid) nameByUid.set(r.company_uid.trim(), r.canonical_name?.trim() ?? r.company_uid.trim());
  }

  const docs: SourceDoc[] = [];

  // ── 議事録。エレコムの決定打がここにあった ─────────────────────────────────
  if (TABLE_IDS.log_notion_minutes) {
    const map = await nocoFetchAllByUids<Record<string, unknown>>(
      TABLE_IDS.log_notion_minutes, uids,
      { fields: 'company_uid,page_id,page_name,creat_at_jst,body', sort: '-creat_at_jst' },
    ).catch(() => new Map());
    for (const [uid, rows] of map) {
      for (const r of rows) {
        const date = ymd(r.creat_at_jst);
        const body = String(r.body ?? '').trim();
        if (!date || date < since || body.length < 40) continue;
        docs.push({
          companyUid: uid, companyName: nameByUid.get(uid) ?? uid,
          sourceType: 'minutes',
          sourceRecordId: String(r.page_id ?? `${uid}:${date}`),
          title: (r.page_name as string) ?? null,
          occurredAt: date, body: body.slice(0, BODY_LIMIT),
        });
      }
    }
  }

  // ── Intercom（サポート会話）─────────────────────────────────────────────
  if (TABLE_IDS.log_intercom) {
    const map = await nocoFetchAllByUids<Record<string, unknown>>(
      TABLE_IDS.log_intercom, uids,
      { fields: 'company_uid,source_record_id,display_title,sent_at_jst,raw_body', sort: '-sent_at_jst' },
    ).catch(() => new Map());
    for (const [uid, rows] of map) {
      for (const r of rows) {
        const date = ymd(r.sent_at_jst);
        const body = String(r.raw_body ?? '').trim();
        if (!date || date < since || body.length < 40) continue;
        docs.push({
          companyUid: uid, companyName: nameByUid.get(uid) ?? uid,
          sourceType: 'intercom',
          sourceRecordId: String(r.source_record_id ?? `${uid}:${date}`),
          title: (r.display_title as string) ?? null,
          occurredAt: date, body: body.slice(0, BODY_LIMIT),
        });
      }
    }
  }

  // ⚠️ 同じ文書が複数行で入っていることがある（log_notion_minutes に同一 page_id が
  //    重複）。畳まないと同じ本文を2回 LLM に投げ、同じ引用が2行できる（実測）。
  //    fetchDoneRecordIds は実行前のスナップショットなので、同一実行内の重複は防げない。
  const uniq = new Map<string, SourceDoc>();
  for (const d of docs) if (!uniq.has(d.sourceRecordId)) uniq.set(d.sourceRecordId, d);

  // ⚠️ ここで MAX_DOCS に切らない。切ってから処理済みを除くと、上位を処理済みが
  //    占めた時点で対象が 0 件になり、2回目以降がまったく進まなくなる。
  //    上限は「未処理だけに絞ったあと」に適用する（呼び出し側）。
  return [...uniq.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** 既に抽出済みの source_record_id を引く。同じ文書を二度課金しない */
async function fetchDoneRecordIds(uids: string[]): Promise<Set<string>> {
  const done = new Set<string>();
  if (!TABLE_IDS.churn_radar_voice) return done;
  const map = await nocoFetchAllByUids<{ company_uid?: string; source_record_id?: string }>(
    TABLE_IDS.churn_radar_voice, uids, { fields: 'company_uid,source_record_id' },
  ).catch(() => new Map());
  for (const [, rows] of map) {
    for (const r of rows) if (r.source_record_id) done.add(r.source_record_id);
  }
  return done;
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export async function runChurnVoice(opts: {
  dryRun?:     boolean;
  uids:        string[];
  windowDays?: number;
}): Promise<VoiceRunResult> {
  const startedAt  = Date.now();
  const windowDays = opts.windowDays ?? 30;
  const since = new Date(Date.now() - windowDays * DAY_MS).toISOString().slice(0, 10);

  const [docs, done] = await Promise.all([
    collectDocs(opts.uids, since),
    fetchDoneRecordIds(opts.uids),
  ]);

  // 未処理だけに絞ってから上限を適用する。新しい文書から順に片付ける
  const pending = docs.filter(d => !done.has(d.sourceRecordId));
  const targets = pending.slice(0, MAX_DOCS);
  const result: VoiceRunResult = {
    scannedDocs: targets.length,
    companies: new Set(targets.map(d => d.companyUid)).size,
    extracted: 0, skippedExisting: docs.length - pending.length, failed: 0,
    droppedNonCustomer: 0,
    /** まだ手を付けていない残り。0 になるまで繰り返し叩けばよい */
    remaining: Math.max(0, pending.length - targets.length),
    durationMs: 0, hits: [],
  };

  if (targets.length === 0) {
    result.durationMs = Date.now() - startedAt;
    console.log(
      `[churn-voice] 未処理なし（対象${docs.length}件はすべて抽出済み）duration=${result.durationMs}ms`,
    );
    return result;
  }

  const openai = getOpenAIClient();
  const model  = getOpenAIModel();

  for (const doc of targets) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: CHURN_VOICE_SYSTEM_PROMPT },
          { role: 'user',   content: buildChurnVoicePrompt(doc) },
        ],
        response_format: { type: 'json_schema', json_schema: CHURN_VOICE_JSON_SCHEMA },
      });

      const raw = completion.choices[0]?.message?.content ?? '{"hits":[]}';
      const parsed = JSON.parse(raw) as {
        hits: Array<{
          intent_type: string; speaker: string; quoted_text: string;
          reason: string; confidence: number;
        }>;
      };

      for (const hit of parsed.hits ?? []) {
        if (!hit.quoted_text?.trim() || hit.confidence < 0.5) continue;
        // 顧客が言っていないものを言質として数えると critical が汚れる。
        // 実測: エレコムの誤検知は議事録のネクストアクション欄＝自社のタスクだった。
        if (hit.speaker !== 'customer') { result.droppedNonCustomer++; continue; }

        const priority = voiceReviewPriority(hit.intent_type, hit.confidence);
        result.extracted++;
        result.hits.push({
          companyName: doc.companyName, intentType: hit.intent_type,
          confidence: hit.confidence, occurredAt: doc.occurredAt,
          quote: hit.quoted_text.slice(0, 120), priority,
        });
        if (opts.dryRun || !TABLE_IDS.churn_radar_voice) continue;

        await nocoCreate(TABLE_IDS.churn_radar_voice, {
          voice_id:         `${doc.sourceRecordId}:${hit.intent_type}:${quoteKey(hit.quoted_text)}`,
          company_uid:      doc.companyUid,
          source_type:      doc.sourceType,
          source_record_id: doc.sourceRecordId,
          occurred_at:      doc.occurredAt,
          intent_type:      hit.intent_type,
          intent_label:     VOICE_INTENT_LABEL[hit.intent_type] ?? hit.intent_type,
          quoted_text:      hit.quoted_text.slice(0, 500),
          confidence:       hit.confidence,
          speaker:          hit.speaker,
          review_priority:  priority,
          extract_reason:   hit.reason?.slice(0, 300) ?? null,
          // **承認されるまでスコアには入らない。** 誤検知で critical を汚さないため
          review_status:    'pending',
          reviewed_by:      null,
          reviewed_at:      null,
        });
      }
    } catch (err) {
      result.failed++;
      console.warn(`[churn-voice] ${doc.companyUid} / ${doc.sourceRecordId} 失敗:`, err);
    }
  }

  result.durationMs = Date.now() - startedAt;
  // remaining はバックグラウンド実行だとレスポンスで返らない。
  // 「あと何回叩けば行き渡るか」はログでしか分からないので必ず出す。
  console.log(
    `[churn-voice] 完了 docs=${result.scannedDocs} extracted=${result.extracted} ` +
    `(要レビュー ${result.hits.filter(h => h.priority === 'required').length}) ` +
    `自社発言で除外=${result.droppedNonCustomer} ` +
    `skipped=${result.skippedExisting} failed=${result.failed} ` +
    `remaining=${result.remaining} duration=${result.durationMs}ms`,
  );
  return result;
}
