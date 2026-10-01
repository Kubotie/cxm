// ─── Twenty → PtAI RAW 互換スナップショットの組み立て ────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **PtAI Pipeline の業務データは Twenty が唯一の正本。** この関数は Twenty から GET した
//  内容をその場で変換して返すだけで、NocoDB にも Notion にも一切書かない（読みもしない）。
//  Pipeline の `pga_docs/_raw` を更新する設計は撤回した。
//  （CXM の NocoDB 利用はこの方針の対象外で、影響を受けない）
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 守っていること ────────────────────────────────────────────────────────────
//   - 顧客名・UUID・本文をログに出さない。診断は件数と方式だけ
//   - 8 段階フェーズへ変換しない（Twenty の stage をそのまま持ち回る）
//   - 不足項目を推測で埋めない
//   - 紐付かないレコードを黙って捨てず、件数として返す
//   - ページングは client 側で完全に処理する
//   - 部分的な取得失敗は partialFailures に出し、取れた分だけ返す

import {
  listRecords, TwentyError,
} from '../client';
import {
  TWENTY_SOURCES, OPPORTUNITY_MATCH, NOTE_MATCH,
} from '../sync-policy';
import { toRawCompany } from './company';
import { toRawOpportunity, linkOpportunity, opportunityNameKey } from './opportunity';
import { toRawNote, linkNote } from './note';
import {
  emptyDiagnostics, type AdapterDiagnostics, type RawSnapshot, type RawCompany, type RawOpportunity,
} from './types';

export interface BuildResult {
  snapshot: RawSnapshot;
  diagnostics: AdapterDiagnostics;
}

/** 原本と同じ形式（YYYY-MM-DDTHH:MM:00Z） */
function fetchedStamp(now = new Date()): string {
  return `${now.toISOString().slice(0, 16)}:00Z`;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Twenty から RAW 互換のスナップショットを組み立てる。
 * **保存はしない。** 呼び出し側がそのままレスポンスにする。
 */
export async function buildPtaiRawFromTwenty(): Promise<BuildResult> {
  const diag = emptyDiagnostics();

  // ── 1. 企業（PtAI フィルタ必須）─────────────────────────────────────────
  const src = TWENTY_SOURCES.companies;
  const twCompanies = await listRecords(src.plural, {
    depth: src.depth, filter: src.filter, pageSize: 60,
  });
  const companies: RawCompany[] = twCompanies.map(toRawCompany);
  diag.companies.total = companies.length;

  const byId = new Map<string, RawCompany>(companies.map(c => [c.cid, c]));

  // 正規化社名 → id。**同名が複数ある場合は登録しない**（誤爆を避ける）
  const nameCount = new Map<string, number>();
  for (const c of companies) {
    const k = OPPORTUNITY_MATCH.normalize(c.n);
    if (k) nameCount.set(k, (nameCount.get(k) ?? 0) + 1);
  }
  const idByNameKey = new Map<string, string>();
  for (const c of companies) {
    const k = OPPORTUNITY_MATCH.normalize(c.n);
    if (k && nameCount.get(k) === 1) idByNameKey.set(k, c.cid);
  }

  // ── 2. 商談 ────────────────────────────────────────────────────────────
  const unmatchedOpps: RawOpportunity[][] = [];
  try {
    const twOpps = await listRecords('opportunities', { depth: 1, pageSize: 60 });
    diag.opportunities.total = twOpps.length;

    for (const o of twOpps) {
      const link = linkOpportunity(o, idByNameKey);
      diag.opportunities.byMethod[link.method]++;
      const raw = toRawOpportunity(o);

      if (link.companyId && byId.has(link.companyId)) {
        const c = byId.get(link.companyId) as RawCompany;
        (c.opp ??= []).push(raw);
      } else {
        diag.opportunities.unresolved++;
        unmatchedOpps.push([raw]);   // 捨てずに残す
      }
    }
  } catch (e) {
    diag.partialFailures.push(`opportunities: ${(e as TwentyError).kind ?? 'error'}`);
  }

  // ── 3. 議事録 ──────────────────────────────────────────────────────────
  try {
    const twNotes = await listRecords('notes', { depth: 1, pageSize: 60 });
    diag.notes.total = twNotes.length;

    for (const n of twNotes) {
      const link = linkNote(n, idByNameKey, OPPORTUNITY_MATCH.normalize);
      diag.notes.byMethod[link.method]++;
      if (!link.companyId || !byId.has(link.companyId)) {
        diag.notes.unresolved++;
        continue;
      }
      const c = byId.get(link.companyId) as RawCompany;
      if (c.notes.length < NOTE_MATCH.maxPerCompany) c.notes.push(toRawNote(n));
    }
    // 新しい順
    for (const c of companies) c.notes.sort((a, b) => (a.d < b.d ? 1 : -1));
  } catch (e) {
    diag.partialFailures.push(`notes: ${(e as TwentyError).kind ?? 'error'}`);
  }

  // ── 4. メンバー ────────────────────────────────────────────────────────
  const members: Record<string, string> = {};
  try {
    const twMembers = await listRecords('workspaceMembers', { depth: 0, pageSize: 60 });
    for (const m of twMembers) {
      const id = str(m.id);
      if (!id) continue;
      const nm = (typeof m.name === 'object' && m.name !== null ? m.name : {}) as
        { firstName?: unknown; lastName?: unknown };
      members[id] = `${str(nm.firstName)} ${str(nm.lastName)}`.trim();
    }
  } catch (e) {
    diag.partialFailures.push(`workspaceMembers: ${(e as TwentyError).kind ?? 'error'}`);
  }

  return {
    snapshot: { members, fetched: fetchedStamp(), companies, unmatchedOpps },
    diagnostics: diag,
  };
}
