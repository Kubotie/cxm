// ─── 解約レーダー：入力の収集 ─────────────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §3
//
// ここは NocoDB から「時間軸を持った生材料」（RadarFacts）を集めるだけで、判定はしない。
// 判定は radar-rules.ts（純粋関数）が行う。
//
// なぜ材料と判定を分けるか:
//   **バックテストのため。** 材料さえ全期間ぶん持っていれば、`factsToInput(facts, 日付)`
//   に過去日を渡すだけでその日の判定を再現できる。取得のたびに過去へ問い合わせ直す必要がない。
//
// ⚠️ 接触日・習慣化・担当交代は「その時点での状態」を再構成する必要があるため、
//    最新1件ではなく履歴を丸ごと持つ。既存の fetchLatestCommunicationDatesByUids は
//    最新日しか返さないのでここでは使えない。

import { nocoFetch, nocoFetchAll, nocoFetchAllByUids, TABLE_IDS } from '@/lib/nocodb/client';
import { isCseOpen } from '@/lib/nocodb/support-by-company';
import type {
  RadarInput, UsageDay, HabituationDay, VoiceHit, OpenTicket,
} from '@/lib/churn/radar-rules';

// ── 型 ────────────────────────────────────────────────────────────────────────

/** 接点1件の出所。**根拠を辿れないものは信じてもらえない** */
export interface ContactRecord {
  date:      string;
  source:    'minutes' | 'chatwork' | 'slack' | 'intercom' | 'ticket';
  /** 外部リンクを組むための id（Notion page_id / Intercom conversation id） */
  recordId:  string | null;
  /** 件名・本文の頭。Slack/Chatwork のようにリンクを張れないものはこれで示す */
  excerpt:   string | null;
}

/** 1企業ぶんの生材料。時間軸を持ち、任意の日付の入力を再構成できる */
export interface RadarFacts {
  companyUid:    string;
  canonicalName: string | null;
  ownerName:     string | null;
  tier:          number | null;
  mrr:           number | null;
  renewalDate:   string | null;
  /** 日付昇順・company 合算 */
  usage:         UsageDay[];
  /** 日付昇順（週次） */
  habituation:   HabituationDay[];
  /** 接点があった日（昇順）。判定はこれだけを見る */
  contactDates:  string[];
  /** 同じ接点を出所つきで持ったもの（昇順）。画面が根拠を示すために使う */
  contacts:      ContactRecord[];
  /** CSM 担当が切り替わった日（昇順）。判定はこれだけを見る */
  ownerChanges:  string[];
  /** 同じ交代を「誰から誰へ」つきで持ったもの。画面が根拠を示すために使う */
  ownerChangeLog: Array<{ date: string; from: string | null; to: string }>;
  /** 高重要度チケット。closedAt が null なら未クローズ */
  highTickets:   Array<{
    openedAt: string; closedAt: string | null; title: string | null;
    /** Notion ページとして開くための id */
    recordId: string | null;
  }>;
  /** 承認済みの言質。テーブル未設定なら null（V 層を評価しない） */
  voices:        VoiceHit[] | null;
}

// ── 生材料 → 指定日の入力 ─────────────────────────────────────────────────────

/**
 * 生材料から「その日時点」の RadarInput を組み立てる。副作用なし。
 * バックテストは today を変えながらこれを呼ぶ。
 */
export function factsToInput(facts: RadarFacts, today: string): RadarInput {
  // その日までの接点だけを見る（未来の接点で空白を埋めない）
  const contacts = facts.contactDates.filter(d => d <= today);
  const lastContactDate = contacts.length > 0 ? contacts[contacts.length - 1] : null;

  const ownerChanges = facts.ownerChanges.filter(d => d <= today);
  const ownerChangedAt = ownerChanges.length > 0 ? ownerChanges[ownerChanges.length - 1] : null;

  // その日時点で開いていた高重要度チケット
  const openHighTickets: OpenTicket[] = facts.highTickets
    .filter(t => t.openedAt <= today && (t.closedAt === null || t.closedAt > today))
    .map(t => ({ openedAt: t.openedAt, title: t.title, recordId: t.recordId }));

  // 最終接点の出所。B1 が立ったとき「どこで途切れたか」を辿れるようにする
  const contactsUpTo = facts.contacts.filter(c => c.date <= today);
  const lastContact = contactsUpTo.length > 0 ? contactsUpTo[contactsUpTo.length - 1] : null;

  return {
    companyUid:  facts.companyUid,
    today,
    renewalDate: facts.renewalDate,
    mrr:         facts.mrr,
    usage:       facts.usage.filter(d => d.date <= today),
    habituation: facts.habituation.filter(d => d.date <= today),
    lastContactDate,
    lastContactRef: lastContact
      ? { source: lastContact.source, recordId: lastContact.recordId } : null,
    ownerChangedAt,
    openHighTickets,
    voices: facts.voices === null ? null : facts.voices.filter(v => v.occurredAt.slice(0, 10) <= today),
  };
}

// ── 収集 ──────────────────────────────────────────────────────────────────────

interface RawCompanyRow {
  company_uid?:    string | null;
  canonical_name?: string | null;
  owner_name?:     string | null;
  tier?:           number | null;
  sf_account_id?:  string | null;
}

interface RawProjectRow {
  project_id?:            string | null;
  master_company_sf_id?:  string | null;
  latest_order_end_date?: string | null;
  total_mrr?:             number | null;
  paid_type?:             string | null;
}

interface RawProjectSnapshotRow {
  project_id?:             string | null;
  company_uid?:            string | null;
  snapshot_date?:          string | null;
  total_users?:            number | null;
  l30_active_users?:       number | null;
  running_campaign_count?: number | null;
}

interface RawPhaseRow {
  company_uid?: string | null;
  stat_date?:   string | null;
  sf_cs?:       string | null;
  習慣化率?:     string | null;
}

interface RawTicketRow {
  company_uid?:      string | null;
  source_record_id?: string | null;
  severity?:         string | null;
  status?:           string | null;
  created_at?:       string | null;
  closed_at?:        string | null;
  CreatedAt?:        string | null;
  UpdatedAt?:        string | null;
  title?:            string | null;
}

interface RawVoiceRow {
  company_uid?:      string | null;
  intent_type?:      string | null;
  intent_label?:     string | null;
  occurred_at?:      string | null;
  quoted_text?:      string | null;
  review_status?:    string | null;
  source_type?:      string | null;
  source_record_id?: string | null;
}

/** "2026-04-07 08:03:51+00:00" / ISO → "YYYY-MM-DD"。壊れていれば null */
function ymd(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/**
 * 対象企業の生材料を一括収集する。
 *
 * @param uids        対象 company_uid
 * @param sinceDate   この日以降のスナップショットを読む（既定 120日前）
 * @param withExcerpt 接点の本文抜粋も取る。1社の画面表示用。全社走査では false のまま
 */
export async function collectRadarFacts(
  uids: string[],
  sinceDate?: string,
  withExcerpt = false,
): Promise<Map<string, RadarFacts>> {
  const result = new Map<string, RadarFacts>();
  if (uids.length === 0) return result;

  const since = sinceDate ?? new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10);
  const uidSet = new Set(uids);

  // ── companies（名前・担当・Tier・sf_account_id）───────────────────────────
  const companyRows = await nocoFetch<RawCompanyRow>(TABLE_IDS.companies, {
    where:  `(company_uid,in,${uids.join(',')})`,
    fields: 'company_uid,canonical_name,owner_name,tier,sf_account_id',
    limit:  String(Math.min(uids.length + 10, 2000)),
  }, false).catch(() => [] as RawCompanyRow[]);

  const sfIdByUid = new Map<string, string>();
  for (const r of companyRows) {
    const uid = r.company_uid?.trim();
    if (!uid || !uidSet.has(uid)) continue;
    if (r.sf_account_id) sfIdByUid.set(uid, String(r.sf_account_id).trim());
    result.set(uid, {
      companyUid: uid,
      canonicalName: r.canonical_name?.trim() ?? null,
      ownerName: r.owner_name?.trim() ?? null,
      tier: num(r.tier),
      mrr: null, renewalDate: null,
      usage: [], habituation: [], contactDates: [], contacts: [],
      ownerChanges: [], ownerChangeLog: [],
      highTickets: [], voices: null,
    });
  }
  // companies に無い uid も箱だけ作る（判定は missing だらけになるが黙って落とさない）
  for (const uid of uids) {
    if (!result.has(uid)) {
      result.set(uid, {
        companyUid: uid, canonicalName: null, ownerName: null, tier: null,
        mrr: null, renewalDate: null,
        usage: [], habituation: [], contactDates: [], contacts: [],
        ownerChanges: [], ownerChangeLog: [],
        highTickets: [], voices: null,
      });
    }
  }

  // ── project_info（MRR・契約満了日・対象 project_id）──────────────────────
  // project_info に company_uid は無い。master_company_sf_id で結ぶ（AGENTS.md 準拠）。
  const sfIds = [...sfIdByUid.values()];
  const uidBySfId = new Map<string, string>();
  for (const [uid, sf] of sfIdByUid) uidBySfId.set(sf, uid);

  const projectIdToUid = new Map<string, string>();
  if (TABLE_IDS.project_info && sfIds.length > 0) {
    const projectRows = await nocoFetchAll<RawProjectRow>(TABLE_IDS.project_info, {
      where:  `(master_company_sf_id,in,${sfIds.join(',')})`,
      fields: 'project_id,master_company_sf_id,latest_order_end_date,total_mrr,paid_type',
    }).catch(() => [] as RawProjectRow[]);

    for (const p of projectRows) {
      const sf  = p.master_company_sf_id?.trim();
      const uid = sf ? uidBySfId.get(sf) : undefined;
      const pid = p.project_id?.trim();
      if (!uid || !pid) continue;
      projectIdToUid.set(pid, uid);
      const f = result.get(uid);
      if (!f) continue;
      const mrr = num(p.total_mrr);
      if (mrr !== null) f.mrr = (f.mrr ?? 0) + mrr;
      // 満了日は最も遅いものを採る（複数PJで契約が分かれている場合の安全側）
      const end = ymd(p.latest_order_end_date);
      if (end && (!f.renewalDate || end > f.renewalDate)) f.renewalDate = end;
    }
  }

  // ── project_user_snapshots（席・施策の日次系列）──────────────────────────
  const projectIds = [...projectIdToUid.keys()];
  if (TABLE_IDS.project_user_snapshots && projectIds.length > 0) {
    const snapRows = await nocoFetchAll<RawProjectSnapshotRow>(TABLE_IDS.project_user_snapshots, {
      where:  `(project_id,in,${projectIds.join(',')})~and(snapshot_date,gte,${since})`,
      fields: 'project_id,company_uid,snapshot_date,total_users,l30_active_users,running_campaign_count',
      sort:   'snapshot_date',
    }).catch(() => [] as RawProjectSnapshotRow[]);

    // 企業 × 日付で合算。PK が無く重複行が溜まるテーブルなので
    // (project_id, date) 単位で後勝ち dedupe してから足す。
    const byUidDate = new Map<string, Map<string, Map<string, RawProjectSnapshotRow>>>();
    for (const r of snapRows) {
      const pid  = r.project_id?.trim();
      const date = ymd(r.snapshot_date);
      if (!pid || !date) continue;
      const uid = projectIdToUid.get(pid);
      if (!uid) continue;
      if (!byUidDate.has(uid)) byUidDate.set(uid, new Map());
      const dates = byUidDate.get(uid)!;
      if (!dates.has(date)) dates.set(date, new Map());
      dates.get(date)!.set(pid, r);
    }

    for (const [uid, dates] of byUidDate) {
      const f = result.get(uid);
      if (!f) continue;
      const days: UsageDay[] = [];
      for (const date of [...dates.keys()].sort()) {
        let seatTotal: number | null = null;
        let seatActive: number | null = null;
        let campaigns: number | null = null;
        for (const row of dates.get(date)!.values()) {
          const t = num(row.total_users);
          const a = num(row.l30_active_users);
          const c = num(row.running_campaign_count);
          if (t !== null) seatTotal  = (seatTotal  ?? 0) + t;
          if (a !== null) seatActive = (seatActive ?? 0) + a;
          if (c !== null) campaigns  = (campaigns  ?? 0) + c;
        }
        days.push({ date, seatTotal, seatActive, campaigns });
      }
      f.usage = days;
    }
  }

  // ── csm_customer_phase（習慣化の履歴・担当交代）──────────────────────────
  if (TABLE_IDS.csm_customer_phase) {
    const phaseMap = await nocoFetchAllByUids<RawPhaseRow>(
      TABLE_IDS.csm_customer_phase, uids,
      { sort: 'stat_date' },
    ).catch(() => new Map<string, RawPhaseRow[]>());

    for (const [uid, rows] of phaseMap) {
      const f = result.get(uid);
      if (!f) continue;
      const sorted = rows
        .map(r => ({ date: ymd(r.stat_date), habit: r.習慣化率, cs: r.sf_cs?.trim() ?? null }))
        .filter((r): r is { date: string; habit: string | null | undefined; cs: string | null } => !!r.date)
        .sort((a, b) => a.date.localeCompare(b.date));

      f.habituation = sorted
        .filter(r => r.date >= since)
        .map(r => ({
          date: r.date,
          habituated: r.habit == null || r.habit === '' ? null : String(r.habit).toLowerCase() === 'yes',
        }));

      // 担当交代 = sf_cs が前行と変わった日。初回出現は交代ではない。
      // 誰から誰へ変わったかも残す（「担当交代」だけでは根拠にならない）
      let prevCs: string | null = null;
      const changeLog: RadarFacts['ownerChangeLog'] = [];
      for (const r of sorted) {
        if (prevCs !== null && r.cs !== null && r.cs !== prevCs) {
          changeLog.push({ date: r.date, from: prevCs, to: r.cs });
        }
        if (r.cs !== null) prevCs = r.cs;
      }
      f.ownerChangeLog = changeLog;
      f.ownerChanges = changeLog.map(c => c.date);
    }
  }

  // ── 接点の履歴（議事録 / Slack / Chatwork / Intercom）─────────────────────
  // 日付だけでなく出所も持つ。画面が「なぜそう言えるのか」を示せないと使われない。
  // 本文は withExcerpt のときだけ引く（全社ぶん取ると重い）。
  const contactSources: Array<{
    tableId: string; dateField: string; source: ContactRecord['source'];
    idField: string | null; textField: string | null;
  }> = [
    { tableId: TABLE_IDS.log_notion_minutes, dateField: 'creat_at_jst', source: 'minutes',
      idField: 'page_id', textField: 'page_name' },
    { tableId: TABLE_IDS.log_chatwork, dateField: 'sent_at_jst', source: 'chatwork',
      idField: null, textField: 'raw_body' },
    { tableId: TABLE_IDS.log_slack, dateField: 'sent_at_jst', source: 'slack',
      idField: null, textField: 'raw_body' },
    { tableId: TABLE_IDS.log_intercom, dateField: 'sent_at_jst', source: 'intercom',
      idField: 'source_record_id', textField: 'display_title' },
  ];

  const contactsByUid = new Map<string, ContactRecord[]>();
  await Promise.all(contactSources.map(async ({ tableId, dateField, source, idField, textField }) => {
    if (!tableId) return;
    const fields = ['company_uid', dateField, idField, withExcerpt ? textField : null]
      .filter(Boolean).join(',');
    const map = await nocoFetchAllByUids<Record<string, unknown>>(
      tableId, uids, { fields, sort: dateField },
    ).catch(() => new Map<string, Record<string, unknown>[]>());
    for (const [uid, rows] of map) {
      if (!contactsByUid.has(uid)) contactsByUid.set(uid, []);
      const list = contactsByUid.get(uid)!;
      for (const r of rows) {
        const d = ymd(r[dateField]);
        if (!d) continue;
        const text = withExcerpt && textField ? String(r[textField] ?? '').trim() : '';
        list.push({
          date: d, source,
          recordId: idField ? (r[idField] ? String(r[idField]) : null) : null,
          excerpt: text ? text.replace(/\s+/g, ' ').slice(0, 160) : null,
        });
      }
    }
  }));

  // ── cse_tickets（高重要度の未クローズ）────────────────────────────────────
  if (TABLE_IDS.cse_tickets) {
    const ticketMap = await nocoFetchAllByUids<RawTicketRow>(
      TABLE_IDS.cse_tickets, uids,
      { fields: 'company_uid,source_record_id,severity,status,created_at,closed_at,CreatedAt,UpdatedAt,title' },
    ).catch(() => new Map<string, RawTicketRow[]>());

    for (const [uid, rows] of ticketMap) {
      const f = result.get(uid);
      if (!f) continue;

      // ⚠️ 1チケット = 複数行。source_record_id で畳まないと件数が2桁膨らむ。
      //    行ごとに列が虫食いなので、非 null を優先してマージする。
      const merged = new Map<string, RawTicketRow>();
      for (const r of rows) {
        const sid = r.source_record_id?.trim();
        if (!sid) continue;
        const cur = merged.get(sid) ?? {};
        for (const [k, v] of Object.entries(r)) {
          if (v !== null && v !== undefined && v !== '' && (cur as Record<string, unknown>)[k] == null) {
            (cur as Record<string, unknown>)[k] = v;
          }
        }
        merged.set(sid, cur);
      }

      const tickets: RadarFacts['highTickets'] = [];
      for (const t of merged.values()) {
        // created_at が空の行がある（エレコムの PTX 不具合がまさにそれ）。
        // 取り込み日 CreatedAt を代替に使う。捨てると一番重い事象が消える。
        const openedAt = ymd(t.created_at) ?? ymd(t.CreatedAt);
        if (!openedAt) continue;
        if (String(t.severity ?? '').toLowerCase() !== 'high') continue;
        const closedAt = isCseOpen(t.status) ? null : (ymd(t.closed_at) ?? ymd(t.UpdatedAt));
        const sid = t.source_record_id?.trim() ?? null;
        tickets.push({ openedAt, closedAt, title: t.title?.trim() ?? null, recordId: sid });
        // チケット起票も接点として数える（サポート窓口経由でも接触は接触）
        if (!contactsByUid.has(uid)) contactsByUid.set(uid, []);
        contactsByUid.get(uid)!.push({
          date: openedAt, source: 'ticket', recordId: sid,
          excerpt: t.title?.trim() ?? null,
        });
      }
      f.highTickets = tickets.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
    }
  }

  for (const [uid, list] of contactsByUid) {
    const f = result.get(uid);
    if (!f) continue;
    f.contacts = list.sort((a, b) => a.date.localeCompare(b.date));
    f.contactDates = [...new Set(list.map(c => c.date))].sort();
  }

  // ── 言質（承認済みのみ）──────────────────────────────────────────────────
  // テーブル未設定なら null のまま＝「見ていない」。0件と区別する。
  if (TABLE_IDS.churn_radar_voice) {
    const voiceMap = await nocoFetchAllByUids<RawVoiceRow>(
      TABLE_IDS.churn_radar_voice, uids,
      { sort: 'occurred_at' },
    ).catch(() => new Map<string, RawVoiceRow[]>());
    for (const uid of uids) {
      const f = result.get(uid);
      if (!f) continue;
      const rows = voiceMap.get(uid) ?? [];
      f.voices = rows
        .filter(r => String(r.review_status ?? '').toLowerCase() === 'confirmed')
        .map(r => ({
          intentType: r.intent_type?.trim() || 'V',
          label:      r.intent_label?.trim() || '言質',
          occurredAt: ymd(r.occurred_at) ?? '',
          quote:      r.quoted_text?.trim() ?? '',
          sourceType: r.source_type?.trim() ?? null,
          recordId:   r.source_record_id?.trim() ?? null,
        }))
        .filter(v => v.occurredAt !== '');
    }
  }

  return result;
}
