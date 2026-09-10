// ─── 解約レーダー：言質の前後文脈を切り出す ──────────────────────────────────
//
// **一文だけ見せられても判断できない。**
// 実測（2026-09-10）: LayerX の「今後もサービス自体は増えていく」が V5（体制縮小）として
// 出たが、この一文だけでは増員の話か縮小の話か読めず、レビューが止まった。
//
// 抽出時に保存するのではなく、**元文書から引き直す**。
//   - 既に溜まっている言質にも効く（再抽出が要らない）
//   - 引用は原文のままなので、文書内を検索すれば位置が定まる
//
// 引用が原文と完全一致しないことがある（LLM が鉤括弧を足す、句読点を変えるなど）。
// 完全一致 → 括弧を剥がして一致 → 先頭20文字で一致、の順に落として探す。

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';

/** 引用の前後に何文字ずつ添えるか */
export const VOICE_CONTEXT_CHARS = 500;

export interface VoiceContext {
  /** 引用の前。見つからなければ空 */
  before: string;
  /** 文書内で実際に一致した引用（原文側の表記） */
  matched: string;
  after:  string;
  /** 文書内で引用を見つけられなかった。文脈は文書の冒頭を返している */
  approximate: boolean;
}

/** 鉤括弧・引用符・前後の空白を剥がす */
function unquote(s: string): string {
  return s.trim().replace(/^[「『"'“”]+/, '').replace(/[」』"'“”]+$/, '').trim();
}

/**
 * 本文の中から引用の位置を探す。
 * 完全一致で見つからないときは、括弧剥がし → 先頭20文字、の順に緩めていく。
 */
function findQuote(body: string, quote: string): { index: number; length: number } | null {
  const candidates = [quote, unquote(quote)];
  for (const c of candidates) {
    if (!c) continue;
    const i = body.indexOf(c);
    if (i >= 0) return { index: i, length: c.length };
  }
  // 語尾が変えられていることがあるので、頭の20文字で探す
  const head = unquote(quote).slice(0, 20);
  if (head.length >= 8) {
    const i = body.indexOf(head);
    if (i >= 0) return { index: i, length: unquote(quote).length };
  }
  return null;
}

/** 議事録・Intercom の本文を source_record_id 単位でまとめて引く */
async function fetchBodies(
  refs: Array<{ sourceType: string; recordId: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  const minutesIds  = refs.filter(r => r.sourceType === 'minutes').map(r => r.recordId);
  const intercomIds = refs.filter(r => r.sourceType === 'intercom').map(r => r.recordId);

  await Promise.all([
    (async () => {
      if (!TABLE_IDS.log_notion_minutes || minutesIds.length === 0) return;
      const rows = await nocoFetch<{ page_id?: string; body?: string }>(
        TABLE_IDS.log_notion_minutes,
        { where: `(page_id,in,${minutesIds.join(',')})`, fields: 'page_id,body',
          limit: String(Math.min(minutesIds.length + 10, 500)) },
        false,
      ).catch(() => []);
      for (const r of rows) if (r.page_id) out.set(String(r.page_id), String(r.body ?? ''));
    })(),
    (async () => {
      if (!TABLE_IDS.log_intercom || intercomIds.length === 0) return;
      const rows = await nocoFetch<{ source_record_id?: string; raw_body?: string }>(
        TABLE_IDS.log_intercom,
        { where: `(source_record_id,in,${intercomIds.join(',')})`, fields: 'source_record_id,raw_body',
          limit: String(Math.min(intercomIds.length + 10, 500)) },
        false,
      ).catch(() => []);
      for (const r of rows) {
        if (r.source_record_id) out.set(String(r.source_record_id), String(r.raw_body ?? ''));
      }
    })(),
  ]);

  return out;
}

/**
 * 複数の言質について、前後の文脈を一括で取る。
 *
 * @param items voiceId / sourceType / recordId / quotedText
 * @returns Map<voiceId, VoiceContext>。本文が引けなかったものは含まれない
 */
export async function fetchVoiceContexts(
  items: Array<{ voiceId: string; sourceType: string; recordId: string | null; quotedText: string }>,
): Promise<Map<string, VoiceContext>> {
  const result = new Map<string, VoiceContext>();
  const refs = items
    .filter((i): i is typeof i & { recordId: string } => Boolean(i.recordId))
    .map(i => ({ sourceType: i.sourceType, recordId: i.recordId }));
  if (refs.length === 0) return result;

  // 同じ文書から複数の言質が出るので、id で重複を除いてから引く
  const uniq = new Map<string, { sourceType: string; recordId: string }>();
  for (const r of refs) uniq.set(r.recordId, r);

  const bodies = await fetchBodies([...uniq.values()]);

  for (const item of items) {
    if (!item.recordId) continue;
    const body = bodies.get(item.recordId);
    if (!body) continue;

    const hit = findQuote(body, item.quotedText);
    if (!hit) {
      // 見つからないときは黙って隠さず、冒頭を「近い場所ではない」と断って返す
      result.set(item.voiceId, {
        before: '', matched: body.slice(0, VOICE_CONTEXT_CHARS * 2), after: '',
        approximate: true,
      });
      continue;
    }

    result.set(item.voiceId, {
      before:  body.slice(Math.max(0, hit.index - VOICE_CONTEXT_CHARS), hit.index),
      matched: body.slice(hit.index, hit.index + hit.length),
      after:   body.slice(hit.index + hit.length, hit.index + hit.length + VOICE_CONTEXT_CHARS),
      approximate: false,
    });
  }

  return result;
}
