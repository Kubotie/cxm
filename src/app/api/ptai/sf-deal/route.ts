// ─── /api/ptai/sf-deal ───────────────────────────────────────────────────────
//
// 商談 1 件ぶんの Salesforce 連携。商談一覧ごと取り込む /api/ptai/sf-sync とは別。
//
// ═══════════════════════════════════════════════════════════════════════════
//  階層で意味が違う（2026-10-02 Kubotie）
//
//    商談の上：新しい商談を Salesforce から読み込む  → /api/ptai/sf-sync
//    商談の中：障壁・ニーズ・ネクストアクションを読み書き → ここ
//
//  **Salesforce が正本。** 読み込み（GET）は Salesforce の値で上書きし、
//  送信（POST）は画面の値を Salesforce へ書く。
//  ふだんは保存と同時に送っているので、ここの送信は「送れなかったぶんの
//  やり直し」と「いますぐ送りたいとき」のためのもの。
// ═══════════════════════════════════════════════════════════════════════════
//
// 返すのは可否と項目名だけ。顧客名・商談名・本文は出さない。

import { NextRequest, NextResponse } from 'next/server';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import { actorStampFor } from '@/lib/ptai/staff';
import { getPtaiOpportunity, pushOpportunityFields } from '@/lib/ptai/salesforce/client';
import { SF_EDITABLE_KEYS, SF_EDITABLE_JP } from '@/lib/ptai/salesforce/schema';
import { listRecords, updateRecord, upsertByExternalId, deleteRecord }
  from '@/lib/ptai/twenty-test/client';
import { TEST_OBJECTS } from '@/lib/ptai/twenty-test/schema';
import { getPtaiDataSource } from '@/lib/twenty/data-source';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const OPP = TEST_OBJECTS.opportunity;
const ACT = TEST_OBJECTS.action;

/** `sf:006...` → `006...`。それ以外は受け付けない */
function oppIdOf(key: unknown): string | null {
  const s = typeof key === 'string' ? key.trim() : '';
  if (!s.startsWith('sf:')) return null;
  const id = s.slice(3);
  return /^006[A-Za-z0-9]{12,15}$/.test(id) ? id : null;
}

async function findDeal(key: string) {
  const rows = await listRecords(OPP.plural, OPP.singular,
    { filter: `externalId[eq]:${key}`, pageSize: 2, maxRecords: 2 });
  return rows[0] ?? null;
}

async function guard() {
  const me = await getPtaiIdentity();
  if (!me) return { ok: false as const, res: NextResponse.json({ ok: false, code: 'session_expired' }, { status: 401 }) };
  if (getPtaiDataSource() !== 'twenty') {
    return { ok: false as const, res: NextResponse.json(
      { ok: false, code: 'not_supported', message: 'この環境では Salesforce 連携を使えません' }, { status: 501 }) };
  }
  return { ok: true as const, me };
}

// ── 読み込み：Salesforce の値で上書きする ─────────────────────────────────

export async function GET(req: NextRequest) {
  const g = await guard();
  if (!g.ok) return g.res;

  const key = req.nextUrl.searchParams.get('key') ?? '';
  const id = oppIdOf(key);
  if (!id) return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 });

  try {
    const [o, row] = await Promise.all([getPtaiOpportunity(id), findDeal(key)]);
    if (!o)   return NextResponse.json({ ok: false, code: 'not_found', message: 'Salesforce にこの商談がありません' }, { status: 404 });
    if (!row) return NextResponse.json({ ok: false, code: 'not_found', message: 'まだ取り込まれていない商談です' }, { status: 404 });

    const actor = await actorStampFor(g.me.id, g.me.name);
    // 読み込んだ時点で画面側の未送信ぶんは捨てる（Salesforce が正）
    await updateRecord(OPP.plural, OPP.singular, String(row.id), {
      barrier: o.barrier, need: o.needs, sfPending: null, updatedByName2: actor.name2,
    });

    const naExt = `${key}:na`;
    if (o.nextAction) {
      await upsertByExternalId(ACT.plural, ACT.singular, naExt, {
        name: o.nextAction, notionCompanyId: String(row.notionCompanyId ?? ''),
        opportunityId: String(row.id), kind: 'NEXT_ACTION', title: o.nextAction,
        status: 'OPEN', source: 'ui',
      }, actor);
    } else {
      const old = await listRecords(ACT.plural, ACT.singular,
        { filter: `externalId[eq]:${naExt}`, pageSize: 2, maxRecords: 2 });
      for (const a of old) await deleteRecord(ACT.plural, String(a.id));
    }

    return NextResponse.json({
      ok: true,
      filled: SF_EDITABLE_KEYS.filter(k =>
        k === 'barrier' ? !!o.barrier : k === 'need' ? !!o.needs : !!o.nextAction),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ptai/sf-deal] 読み込みに失敗', (e as Error).name);
    return NextResponse.json({ ok: false, code: 'upstream_unavailable' }, { status: 502 });
  }
}

// ── 送信：画面の値を Salesforce へ書く ────────────────────────────────────

export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g.ok) return g.res;

  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const key = typeof b.key === 'string' ? b.key : '';
  const id = oppIdOf(key);
  if (!id) return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 });

  try {
    const row = await findDeal(key);
    if (!row) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404 });

    // 送るのは **Twenty に入っている値**。画面から本文を受け取らないので、
    // 途中で差し替えられる余地が無い
    const na = (await listRecords(ACT.plural, ACT.singular,
      { filter: `externalId[eq]:${key}:na`, pageSize: 2, maxRecords: 2 }))[0];

    const push = await pushOpportunityFields(id, {
      barrier:    (row.barrier as string) ?? null,
      need:       (row.need as string) ?? null,
      nextAction: na ? String(na.title ?? '') : null,
    });

    const actor = await actorStampFor(g.me.id, g.me.name);
    await updateRecord(OPP.plural, OPP.singular, String(row.id), {
      sfPending: push.ok ? null : SF_EDITABLE_KEYS.join(','),
      updatedByName2: actor.name2,
    });

    return NextResponse.json({
      ok: push.ok,
      message: push.ok
        ? (push.truncated.length
            ? `送りました（${push.truncated.map(k => SF_EDITABLE_JP[k]).join('・')}は文字数の上限で切りました）`
            : 'Salesforce に送りました')
        : (push.message ?? 'Salesforce に送れませんでした'),
      truncated: push.truncated,
    }, { status: push.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ptai/sf-deal] 送信に失敗', (e as Error).name);
    return NextResponse.json({ ok: false, code: 'upstream_unavailable' }, { status: 502 });
  }
}
