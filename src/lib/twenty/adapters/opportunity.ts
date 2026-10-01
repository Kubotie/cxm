// ─── Twenty Opportunity → RAW 互換 ───────────────────────────────────────────
//
// ── 重要 ──────────────────────────────────────────────────────────────────────
//   **8 段階フェーズへは変換しない。** Twenty の stage（5 段階）をそのまま持ち回る。
//   対応表が未確定（sync-policy の STAGE_MAPPING_DECIDED = false）なので、
//   推測で変換すると KPI と着地見込みが静かに壊れる。
//
//   会社との紐付けは relation → exact_name の順。部分一致は使わない（誤爆するため）。
//   紐付かないものは捨てずに unresolved として件数に残す。

import { OPPORTUNITY_MATCH, type LinkMethod } from '../sync-policy';
import { currencyToYen } from './company';
import type { RawOpportunity } from './types';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** pointOfContact（depth=1 の RELATION）→ 「氏名 / 役職」 */
export function pointOfContactLabel(v: unknown): string {
  if (typeof v !== 'object' || v === null) return '';
  const pc = v as { name?: unknown; jobTitle?: unknown };
  const nm = (typeof pc.name === 'object' && pc.name !== null ? pc.name : {}) as
    { firstName?: unknown; lastName?: unknown };
  const full = `${str(nm.firstName)}${str(nm.lastName)}`.trim();
  const title = str(pc.jobTitle);
  if (!full && !title) return '';
  return title ? `${full} / ${title}` : full;
}

/** owner（RELATION）→ id。実測で全件空 */
export function ownerId(v: unknown): string | null {
  if (typeof v !== 'object' || v === null) return null;
  const id = (v as { id?: unknown }).id;
  return typeof id === 'string' && id ? id : null;
}

export function toRawOpportunity(o: Record<string, unknown>): RawOpportunity {
  const net = currencyToYen(o.netMrr);
  return {
    id:      str(o.id),
    raw:     str(o.name),
    // ★ そのまま。8 段階へは変換しない
    st:      typeof o.stage === 'string' && o.stage ? o.stage : null,
    close:   str(o.closeDate).slice(0, 10) || null,
    net:     net || null,
    ownerId: ownerId(o.owner),
    need:    str(o.needsSummary),
    src:     str(o.sourceInfo),
    pc:      pointOfContactLabel(o.pointOfContact),
    up:      str(o.updatedAt).slice(0, 10),
  };
}

/** 正規化した社名キー。接頭辞（PtAI - / Ptengine AI - ）を外してから正規化する */
export function opportunityNameKey(name: string): string {
  return OPPORTUNITY_MATCH.normalize(String(name || '').replace(OPPORTUNITY_MATCH.namePrefix, ''));
}

export interface OpportunityLink {
  /** 紐付いた Twenty Company の id。付かなければ null */
  companyId: string | null;
  method: LinkMethod;
}

/**
 * 商談を会社へ紐付ける。
 *   1. company リレーションが入っていればそれ（relation）
 *   2. 無ければ正規化社名の完全一致（exact_name）
 *   3. どちらも駄目なら unresolved。**捨てない**
 *
 * @param companyIdByNameKey 正規化社名 → Company id。同名が複数ある場合は登録しない
 */
export function linkOpportunity(
  o: Record<string, unknown>,
  companyIdByNameKey: Map<string, string>,
): OpportunityLink {
  const rel = o[OPPORTUNITY_MATCH.relationField];
  if (typeof rel === 'object' && rel !== null) {
    const id = (rel as { id?: unknown }).id;
    if (typeof id === 'string' && id) return { companyId: id, method: 'relation' };
  }
  const key = opportunityNameKey(str(o.name));
  if (key) {
    const hit = companyIdByNameKey.get(key);
    if (hit) return { companyId: hit, method: 'exact_name' };
  }
  return { companyId: null, method: 'unresolved' };
}
