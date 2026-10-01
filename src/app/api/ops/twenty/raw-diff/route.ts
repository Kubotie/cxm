// ─── GET /api/ops/twenty/raw-diff（**PtAI Pipeline の移行確認用**）────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **移行確認用の一時ツール。** Phase 2C の移行が済んだら削除する（Phase 2D）。
//
//    - 対象は PtAI Pipeline だけ。**CXM のデータには触れない**
//    - 本番 UI のデータ取得経路には使わない（UI は /api/ptai/raw だけを見る）
//    - **書き込まない。** 読むのは Pipeline の移行元スナップショット（pga_docs/_raw）を
//      Twenty と件数比較するためだけ
//    - **pga_docs が落ちても Twenty の診断は止めない。**
//      Twenty 単体の疎通は /api/ops/twenty/health が担当し、そちらは NocoDB を読まない。
//      このエンドポイントだけが移行元を読む
// ═══════════════════════════════════════════════════════════════════════════
//
// Twenty と移行元スナップショットの差分を **件数だけ** で把握する。
//
// ── 絶対に返さない・書かない ─────────────────────────────────────────────────
//   顧客名・UUID・商談名・Note 本文は**一切返さない。ログにも出さない。**
//   Twenty へも pga_docs へも書き込まない（GET のみ）。
//   差分の明細はファイルにも出さない。件数だけを画面とレポートに載せる。
//
// 認可: admin / ops のみ

import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/auth/guard';
import { listRecords, TwentyError, isTwentyConfigured } from '@/lib/twenty/client';
import { TWENTY_SOURCES, OPPORTUNITY_MATCH, NOTE_MATCH } from '@/lib/twenty/sync-policy';
import { getRawSnapshot } from '@/lib/ptai/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export interface RawDiffResult {
  status: 'ok' | 'degraded' | 'error';
  checkedAt: string;
  companies: {
    twenty: number;
    raw: number;
    /** ID で突き合わせた結果 */
    matchedById: number;
    onlyInTwenty: number;
    onlyInRaw: number;
    /** ID では一致しなかったが、正規化社名で一致したもの */
    matchedByNameFallback: number;
    /** どちらの方法でも一致しなかったもの */
    unmatched: number;
  };
  opportunities: {
    total: number;
    /** company リレーションで会社が特定できたもの */
    linkedByRelation: number;
    /** 名前照合（完全一致）で特定できたもの */
    linkedByExactName: number;
    /** 名前照合（部分一致）で特定できたもの */
    linkedByPartialName: number;
    unlinked: number;
  };
  notes: {
    total: number;
    /** noteTargets を持つもの */
    linkedByNoteTargets: number;
    /** noteTargets が無く、タイトル照合で特定できたもの */
    linkedByTitle: number;
    unlinked: number;
  };
  warnings: string[];
}

/** RAW の企業 1 件（必要な項目だけ。**この関数の外へ値を出さない**） */
interface RawCompany { cid?: unknown; n?: unknown }

export async function GET(_req: NextRequest): Promise<NextResponse<RawDiffResult | { error: string }>> {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;

  const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } };
  const warnings: string[] = [];
  const empty: RawDiffResult = {
    status: 'error',
    checkedAt: new Date().toISOString(),
    companies: { twenty: 0, raw: 0, matchedById: 0, onlyInTwenty: 0, onlyInRaw: 0, matchedByNameFallback: 0, unmatched: 0 },
    opportunities: { total: 0, linkedByRelation: 0, linkedByExactName: 0, linkedByPartialName: 0, unlinked: 0 },
    notes: { total: 0, linkedByNoteTargets: 0, linkedByTitle: 0, unlinked: 0 },
    warnings,
  };

  if (!isTwentyConfigured()) {
    warnings.push('TWENTY_API_KEY が未設定です');
    return NextResponse.json(empty, noStore);
  }

  // ── 移行元スナップショット（読み取りのみ）──────────────────────────────────
  let rawCompanies: RawCompany[] = [];
  try {
    const text = await getRawSnapshot();
    if (!text) {
      warnings.push('移行元スナップショットが未投入です');
      return NextResponse.json(empty, noStore);
    }
    const parsed = JSON.parse(text) as { companies?: unknown };
    rawCompanies = Array.isArray(parsed.companies) ? (parsed.companies as RawCompany[]) : [];
  } catch {
    warnings.push('移行元スナップショットを読めませんでした');
    return NextResponse.json(empty, noStore);
  }

  // ── Twenty（GET のみ）────────────────────────────────────────────────────
  let twentyCompanies: Record<string, unknown>[] = [];
  let opps: Record<string, unknown>[] = [];
  let notes: Record<string, unknown>[] = [];
  let degraded = false;

  try {
    const src = TWENTY_SOURCES.companies;
    twentyCompanies = await listRecords(src.plural, { depth: src.depth, filter: src.filter });
  } catch (e) {
    warnings.push(`Twenty の企業を取得できませんでした（${(e as TwentyError).kind ?? 'error'}）`);
    return NextResponse.json({ ...empty, warnings }, noStore);
  }
  try {
    opps = await listRecords('opportunities', { depth: 1 });
  } catch (e) { degraded = true; warnings.push(`Opportunity を取得できませんでした（${(e as TwentyError).kind ?? 'error'}）`); }
  try {
    notes = await listRecords('notes', { depth: 1 });
  } catch (e) { degraded = true; warnings.push(`Note を取得できませんでした（${(e as TwentyError).kind ?? 'error'}）`); }

  // ── 突き合わせ（ここで扱う値は関数の外に出さない）────────────────────────
  const norm = OPPORTUNITY_MATCH.normalize;

  const twIds = new Set(twentyCompanies.map(c => String(c.id ?? '')).filter(Boolean));
  const rawIds = new Set(rawCompanies.map(c => String(c.cid ?? '')).filter(Boolean));

  const matchedById = [...twIds].filter(id => rawIds.has(id)).length;
  const onlyInTwentyIds = [...twIds].filter(id => !rawIds.has(id));
  const onlyInRawIds = [...rawIds].filter(id => !twIds.has(id));

  // ID で合わなかったぶんを社名で救えるか
  const twNameByMissingId = new Map(
    twentyCompanies
      .filter(c => onlyInTwentyIds.includes(String(c.id ?? '')))
      .map(c => [norm(String(c.name ?? '')), true]),
  );
  const rawNamesMissing = rawCompanies
    .filter(c => onlyInRawIds.includes(String(c.cid ?? '')))
    .map(c => norm(String(c.n ?? '')));
  const matchedByNameFallback = rawNamesMissing.filter(n => n && twNameByMissingId.has(n)).length;

  // ── Opportunity の紐付け方法別 ──────────────────────────────────────────
  const twNormNames = new Map<string, number>();
  for (const c of twentyCompanies) {
    const k = norm(String(c.name ?? ''));
    if (k) twNormNames.set(k, (twNormNames.get(k) ?? 0) + 1);
  }

  let linkedByRelation = 0, linkedByExactName = 0, linkedByPartialName = 0;
  for (const o of opps) {
    if (o[OPPORTUNITY_MATCH.relationField] != null) { linkedByRelation++; continue; }
    const key = norm(String(o.name ?? '').replace(OPPORTUNITY_MATCH.namePrefix, ''));
    if (key && twNormNames.has(key)) { linkedByExactName++; continue; }
    // 部分一致は誤爆しやすいので使わない（allowPartial=false）。
    // 件数だけは診断のために数えておく
    if (OPPORTUNITY_MATCH.allowPartial && key.length >= 3) {
      const hit = [...twNormNames.keys()].some(k => k.length >= 3 && (k.includes(key) || key.includes(k)));
      if (hit) { linkedByPartialName++; continue; }
    }
  }

  // ── Note の紐付け方法別 ─────────────────────────────────────────────────
  let linkedByNoteTargets = 0, linkedByTitle = 0;
  for (const n of notes) {
    const targets = n.noteTargets;
    if (Array.isArray(targets) && targets.length > 0) { linkedByNoteTargets++; continue; }
    const title = norm(String(n.title ?? ''));
    if (title && [...twNormNames.keys()].some(k => k.length >= 2 && title.includes(k))) linkedByTitle++;
  }

  if (matchedByNameFallback > 0) {
    warnings.push(`ID で一致しない企業のうち ${matchedByNameFallback} 件は社名でのみ一致します。ID が振り直された可能性があります`);
  }
  if (linkedByRelation === 0 && opps.length > 0) {
    warnings.push(`Opportunity ${opps.length} 件すべてで company リレーションが空のため、紐付けは社名照合に依存しています（監査 R-6）`);
  }
  warnings.push('このレポートは件数のみです。顧客名・UUID・本文は保存も出力もしていません');

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      checkedAt: new Date().toISOString(),
      companies: {
        twenty: twentyCompanies.length,
        raw: rawCompanies.length,
        matchedById,
        onlyInTwenty: onlyInTwentyIds.length,
        onlyInRaw: onlyInRawIds.length,
        matchedByNameFallback,
        unmatched: onlyInRawIds.length - matchedByNameFallback,
      },
      opportunities: {
        total: opps.length,
        linkedByRelation, linkedByExactName, linkedByPartialName,
        unlinked: opps.length - linkedByRelation - linkedByExactName - linkedByPartialName,
      },
      notes: {
        total: notes.length,
        linkedByNoteTargets, linkedByTitle,
        unlinked: notes.length - linkedByNoteTargets - linkedByTitle,
      },
      warnings,
    } satisfies RawDiffResult,
    noStore,
  );
}
