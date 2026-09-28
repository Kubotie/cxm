// ─── 解約報告 ────────────────────────────────────────────────────────────────
//
// **解約の連絡を受けた、という人が入れた事実。** レーダーの走査結果ではない。
//
// 当初は churn_radar_state（Tier1–2 の走査結果）に持たせたが、
// 実運用では Tier3 の企業にも立てたかった（株式会社アーカー）。
// 走査対象の外にいる企業には state の行が無いので、そこには置けない。
// そこで **companies（全社の正本）の4列**に移した。
//
//   churn_reported_at / churn_reported_by / churn_effective_date / churn_note
//
// companies への書き込みは tier-sync / paid-watched-sync ともフィールド単位の
// nocoUpdate なので、この4列が他のバッチに消されることはない。
//
// ⚠️ 絞り込みは **churn_reported_by（テキスト列）** に掛ける。
//   NocoDB の `isnot,null` は DateTime 列では効かず、全行が返る（実測）。
//   churn_reported_at に掛けると7315社が全部返ってくる。

import { nocoFetch, nocoFetchAll, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoUpdate } from '@/lib/nocodb/write';
import { appendRadarEvent } from '@/lib/churn/radar-state';

// ── 型 ────────────────────────────────────────────────────────────────────────

/** 画面に渡す解約報告。companies の4列を1つに畳んだもの */
export interface ChurnReport {
  reportedAt:    string;
  reportedBy:    string | null;
  /** 契約終了日。未定なら null */
  effectiveDate: string | null;
  note:          string | null;
}

interface RawChurnColumns {
  Id?:                   number;
  company_uid?:          string | null;
  churn_reported_at?:    string | null;
  churn_reported_by?:    string | null;
  churn_effective_date?: string | null;
  churn_note?:           string | null;
}

const FIELDS = 'Id,company_uid,churn_reported_at,churn_reported_by,churn_effective_date,churn_note';
/** 報告が立っている行だけ。テキスト列に掛けるのが要（上の ⚠️） */
const WHERE_REPORTED = '(churn_reported_by,isnot,null)';

// ── 変換 ─────────────────────────────────────────────────────────────────────

/**
 * NocoDB の DateTime は `2026-09-28 09:38:27+00:00` の形で返る。
 * 日付だけ出すときに JST へ寄せないと、朝に報告した分が前日の日付になる
 * （09:00 JST = 00:00 UTC）。
 *
 * ⚠️ 書くときは必ずオフセット付きの ISO で渡すこと。`2026-09-28 09:38:27` のような
 *   裸の文字列は NocoDB が **サーバのタイムゾーン（JST）** として解釈し、
 *   9時間ずれて保存される（実測）。
 */
function jstDate(raw: string): string {
  const s = String(raw).trim();
  const zoned = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const t = Date.parse(s.replace(' ', 'T') + (zoned ? '' : 'Z'));
  if (isNaN(t)) return s.slice(0, 10);
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
}

export function toChurnReport(row: RawChurnColumns | null | undefined): ChurnReport | null {
  // 判定は by で行う。at は DateTime で扱いが揺れるため
  if (!row?.churn_reported_by) return null;
  return {
    reportedAt:    row.churn_reported_at ? jstDate(String(row.churn_reported_at)) : '',
    reportedBy:    row.churn_reported_by,
    effectiveDate: row.churn_effective_date ? String(row.churn_effective_date).slice(0, 10) : null,
    note:          row.churn_note ?? null,
  };
}

// ── 読み取り ─────────────────────────────────────────────────────────────────

export async function fetchChurnReport(companyUid: string): Promise<ChurnReport | null> {
  const rows = await nocoFetch<RawChurnColumns>(TABLE_IDS.companies, {
    where:  `(company_uid,eq,${companyUid})`,
    fields: FIELDS,
    limit:  '1',
  }, false).catch(() => [] as RawChurnColumns[]);
  return toChurnReport(rows[0]);
}

/**
 * 報告が立っている企業だけを引く。
 * 7315社を全件読むと重いので、必ず WHERE で絞ること。
 */
export async function fetchChurnReportMap(): Promise<Map<string, ChurnReport>> {
  const rows = await nocoFetchAll<RawChurnColumns>(TABLE_IDS.companies, {
    where:  WHERE_REPORTED,
    fields: FIELDS,
  }).catch(err => {
    console.warn('[churn-report] 一覧取得に失敗:', err);
    return [] as RawChurnColumns[];
  });
  const m = new Map<string, ChurnReport>();
  for (const r of rows) {
    const uid = r.company_uid?.trim();
    const rep = toChurnReport(r);
    if (uid && rep) m.set(uid, rep);
  }
  return m;
}

// ── 書き込み ─────────────────────────────────────────────────────────────────

/**
 * 解約報告のフラグを立てる／取り消す（report=null で取り消し）。
 *
 * **判定スコアは変えない。** レーダーの精度検証は「点灯していたか」を後から
 * 答え合わせするので、人がスコアを動かすと検証が壊れる。
 * フラグはリストの既定の絞り込みから外すためだけに使う（記録は残す）。
 */
export async function saveChurnReport(
  companyUid: string,
  report: { by: string; effectiveDate?: string | null; note?: string | null } | null,
): Promise<ChurnReport | null | false> {
  const rows = await nocoFetch<RawChurnColumns>(TABLE_IDS.companies, {
    where:  `(company_uid,eq,${companyUid})`,
    fields: FIELDS,
    limit:  '1',
  }, false).catch(() => [] as RawChurnColumns[]);
  const prev = rows[0];
  if (!prev?.Id) return false;

  const at = new Date().toISOString();   // オフセット付きで渡す（上の ⚠️）
  const clearing = report === null;

  await nocoUpdate(TABLE_IDS.companies, prev.Id, {
    churn_reported_at:    clearing ? null : at,
    churn_reported_by:    clearing ? null : report.by,
    churn_effective_date: clearing ? null : report.effectiveDate ?? null,
    churn_note:           clearing ? null : report.note ?? null,
  });

  // 誰がいつ立てたかを追えないと、フラグは信用されなくなる。
  // レーダー未収録の企業でも events には残す（company_uid で引ける）
  await appendRadarEvent({
    event_id:    `${companyUid}:churn:${at}`,
    company_uid: companyUid,
    occurred_at: jstDate(at),
    event_type:  clearing ? 'churn_report_cleared' : 'churn_reported',
    from_stage:  null,
    to_stage:    null,
    score:       null,
    detail:      clearing
      ? `${prev.churn_reported_by ?? '—'} の解約報告を取り消した`
      : `${report.by} が解約報告を登録した`
        + (report.effectiveDate ? `（解約日 ${report.effectiveDate}）` : '（解約日は未定）')
        + (report.note ? `：${report.note}` : ''),
    signal_ids:  null,
  });

  return clearing ? null : {
    reportedAt:    jstDate(at),
    reportedBy:    report.by,
    effectiveDate: report.effectiveDate ?? null,
    note:          report.note ?? null,
  };
}
