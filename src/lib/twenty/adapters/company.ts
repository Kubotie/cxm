// ─── Twenty Company → RAW 互換 ───────────────────────────────────────────────
//
// **PtAI Pipeline の正本は Twenty。** NocoDB には触らない。
// 不足項目は推測で埋めず、null / 空で返す（board.js 側が「未入力」として扱う）。

import { OWNER_ENUM_TO_NAME } from '../sync-policy';
import type { RawCompany } from './types';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

/** Twenty の CURRENCY（amountMicros）→ 円。無ければ 0 */
export function currencyToYen(v: unknown): number {
  if (typeof v !== 'object' || v === null) return 0;
  const micros = (v as { amountMicros?: unknown }).amountMicros;
  const n = typeof micros === 'number' ? micros : Number(micros);
  return Number.isFinite(n) ? Math.round(n / 1e6) : 0;
}

/** Twenty の LINKS → primaryLinkUrl */
export function linksToUrl(v: unknown): string {
  if (typeof v !== 'object' || v === null) return '';
  return str((v as { primaryLinkUrl?: unknown }).primaryLinkUrl);
}

/** pgaOwner の enum 配列 → 呼称配列 */
export function ownersToNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => OWNER_ENUM_TO_NAME[String(x)] ?? String(x)).filter(Boolean);
}

/**
 * 主担当。
 *
 * **Notion の「担当3」は Twenty に無い**（sync-policy の `o` を参照）。
 * 移行が済むまでは Twenty から決められないので、**推測しない。**
 * pgaOwner から Perry / Utty を除いたものを暫定で返し、空なら未割当。
 * `asg` は「どこから来た値か」を表す。Twenty 由来なら null（＝担当3 ではない）。
 */
export function primaryOwners(own: string[]): { o: string[]; asg: string | null } {
  const primary = own.filter(x => x !== 'Perry' && x !== 'Utty');
  const o = primary.length ? primary : (own.length ? own : ['未割当']);
  return { o, asg: null };
}

/** Twenty Company 1 件 → RAW の 1 社分（商談・議事録は後段で足す） */
export function toRawCompany(c: Record<string, unknown>): RawCompany {
  const own = ownersToNames(c.pgaOwner);
  const { o, asg } = primaryOwners(own);

  return {
    cid:   str(c.id),
    n:     str(c.name).replace(/　/g, ' '),
    // Salesforce の鍵は Notion 顧客管理DB が持つ。この経路（Twenty Company 直読み）には無い
    sfid:  null,
    t:     strOrNull(c.tier),
    ps:    strOrNull(c.pgaStatus),
    m:     currencyToYen(c.mrr),
    // この経路（Twenty Company 直読み）には期初MRR が無い。増減は 0 として扱う
    bm:    currencyToYen(c.mrr),
    ind:   strOrNull(c.industryJp),
    slug:  strOrNull(c.industrySlug),
    lay:   strOrNull(c.companySizeLayer),
    own,
    o,
    asg,
    icp:   strOrNull(c.icpJudgment),
    aw:    strOrNull(c.issueAwareness),
    src:   strOrNull(c.customerSource),
    na:    str(c.nextAction),
    up:    str(c.updatedAt).slice(0, 10),
    url:   linksToUrl(c.notionLinks),
    dom:   linksToUrl(c.domainName),
    cs:    strOrNull(c.qiYueZhuangKuang),
    opp:   null,
    notes: [],
    docs:  [],
    od:    [],
  };
}
