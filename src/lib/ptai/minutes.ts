// ─── PtAI Pipeline: 議事録の取得（Notion ＋ Mii）────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §I・§8-2
//
// ═══════════════════════════════════════════════════════════════════════════
//  **議事録には 2 系統ある。同じ会議が両方に残ることがある**（2026-10-01 確認）。
//
//    NOTION … Notion JP_Docs（Category＝議事録）
//    MII    … Twenty の Note。2026-08 に API で投入された 113 件がこれ
//
//  **片方に寄せない。両方をそのまま並べ、出典の印を付ける。**
//  タイトルが似ているからといって「同じ会議」と決めつけない（別会議を混ぜる事故になる）。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 会社への紐付け（2 段構え）────────────────────────────────────────────────
//   Notion: ① `関連顧客` リレーション → ② **タイトル照合（暫定）**
//           実測でリレーションがあるのは 127 社中 57 社（45%）しかないため、
//           残りはタイトル照合で拾う（2026-10-01 の判断）。
//   Mii:    Twenty の Note には会社リレーションが無い（noteTargets は全部 Person で
//           targetCompany は 0 件）。**タイトル照合だけ。**
//
//   ⚠ タイトル照合は**暫定策**。誤って別の会社の議事録が出ることがある。
//     どの方法で紐付いたかを `matchedBy` に必ず入れ、画面で見分けられるようにする。

import { listMinutes as listNotionMinutes, listMinutesByTitle, NotionError } from './notion/client';
import { MEETING_BODY_MAX, type MeetingRecord, type MeetingSource } from './notion/schema';
import { listRecords, TwentyError } from '@/lib/twenty/client';

// ── 社名の正規化 ─────────────────────────────────────────────────────────────

/** 法人格・記号・空白を落として照合用の鍵にする */
export function normalizeCompanyName(name: string): string {
  return (name || '')
    .replace(/株式会社|有限会社|合同会社|一般社団法人|一般財団法人|\(株\)|（株）/g, '')
    .replace(/（.*?）|\(.*?\)/g, '')
    .replace(/[\s　]/g, '')
    .trim();
}

/** タイトル照合に使う最短長。短すぎると誤爆する */
export const MIN_TITLE_KEY_LENGTH = 3;

/** 照合に使える社名か。短すぎるものはタイトル照合をあきらめる */
export function isMatchableName(name: string): boolean {
  return normalizeCompanyName(name).length >= MIN_TITLE_KEY_LENGTH;
}

// ── 取得結果 ─────────────────────────────────────────────────────────────────

export type MatchMethod = 'relation' | 'title' | 'none';

export interface CompanyMeeting extends MeetingRecord {
  /** どうやって会社に紐付いたか。**title は暫定策**なので画面で印を出す */
  matchedBy: MatchMethod;
}

export interface MinutesResult {
  meetings: CompanyMeeting[];
  diagnostics: {
    notion: { total: number; byRelation: number; byTitle: number };
    mii:    { total: number; byTitle: number };
    /** 取得に失敗した系統。片方が落ちてももう片方は返す */
    partialFailures: string[];
    /** 社名が短すぎてタイトル照合をあきらめた場合 true */
    titleMatchSkipped: boolean;
  };
}

// ── Mii（Twenty の Note）─────────────────────────────────────────────────────

/**
 * Twenty Note の出典を決める。
 *
 * **判別する印が無いので、作成元で分ける**（2026-10-01 の判断）。
 *   createdBy.source が API    → MII（Mii が API で投入したもの）
 *   それ以外（MANUAL など）    → TWENTY_NOTE（人が Twenty で書いたメモ）
 *
 * 実測では 114 件中 113 件が API、1 件が MANUAL。
 * Mii 以外の連携が API で書き込むようになったら、この判定は見直しが要る。
 */
export function meetingSourceOfTwentyNote(note: Record<string, unknown>): MeetingSource {
  const by = note.createdBy as { source?: unknown } | undefined;
  return String(by?.source ?? '').toUpperCase() === 'API' ? 'MII' : 'TWENTY_NOTE';
}

function noteBody(v: unknown): string {
  if (!v || typeof v !== 'object') return '';
  const md = (v as { markdown?: unknown }).markdown;
  return typeof md === 'string' ? md.slice(0, MEETING_BODY_MAX) : '';
}

/** タイトル先頭の YYYYMMDD / YYYY-MM-DD → YYYY-MM-DD */
export function dateFromTitle(title: string): string {
  const m = String(title || '').match(/(20\d{2})[-/]?(\d{2})[-/]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/**
 * Mii の議事録（Twenty Note）を社名のタイトル照合で拾う。
 * Twenty の Note には会社リレーションが無いので、これしか手段がない。
 */
export async function listMiiMinutes(companyName: string, limit = 6): Promise<CompanyMeeting[]> {
  const key = normalizeCompanyName(companyName);
  if (key.length < MIN_TITLE_KEY_LENGTH) return [];

  const rows = await listRecords('notes', {
    depth: 0,
    pageSize: 200,
    maxRecords: 200,
    filter: `title[ilike]:%${key}%`,
  });

  return rows
    .map(n => {
      const title = typeof n.title === 'string' ? n.title : '';
      return {
        externalId: String(n.id ?? ''),
        source:     meetingSourceOfTwentyNote(n),
        title,
        date:       dateFromTitle(title) || String(n.createdAt ?? '').slice(0, 10),
        body:       noteBody(n.bodyV2),
        url:        null,
        matchedBy:  'title' as MatchMethod,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit);
}

// ── 全社ぶんを 1 回で取る（RAW 組み立て用）────────────────────────────────
//
// `listMiiMinutes` は会社ごとに 1 リクエスト要るので、127 社ぶん回すと重い。
// Twenty の Note は全部で 100 件台しかないため、**1 回で全部取ってから
// ローカルで社名照合する**。RAW にはこちらを使う。

export interface TwentyNoteLite {
  externalId: string;
  source: MeetingSource;
  title: string;
  date: string;
  body: string;
  /** 照合用に正規化したタイトル */
  key: string;
}

/** Twenty の Note を全件（上限 1000）取る。失敗したら空配列 */
export async function fetchAllTwentyNotes(limit = 1000): Promise<TwentyNoteLite[]> {
  let rows: Record<string, unknown>[];
  try {
    rows = await listRecords('notes', { depth: 0, pageSize: 200, maxRecords: limit });
  } catch {
    return [];
  }
  return rows.map(n => {
    const title = typeof n.title === 'string' ? n.title : '';
    return {
      externalId: String(n.id ?? ''),
      source:     meetingSourceOfTwentyNote(n),
      title,
      date:       dateFromTitle(title) || String(n.createdAt ?? '').slice(0, 10),
      body:       noteBody(n.bodyV2),
      key:        normalizeCompanyName(title),
    };
  });
}

/**
 * 全件から 1 社ぶんを抜く。`listMiiMinutes` と同じ照合規則（正規化後の部分一致）。
 * 短い社名は誤爆するので拾わない。
 */
export function pickNotesForCompany(
  all: TwentyNoteLite[], companyName: string, limit = 6,
): CompanyMeeting[] {
  const key = normalizeCompanyName(companyName);
  if (key.length < MIN_TITLE_KEY_LENGTH) return [];
  return all
    .filter(n => n.key.includes(key))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
    .map(n => ({
      externalId: n.externalId,
      source:     n.source,
      title:      n.title,
      date:       n.date,
      body:       n.body,
      url:        null,
      matchedBy:  'title' as MatchMethod,
    }));
}

// ── まとめて取る ─────────────────────────────────────────────────────────────

export interface ListCompanyMinutesInput {
  /** 顧客管理DB の `Company Database` リレーション。空なら Notion はタイトル照合に落ちる */
  companyRelationIds: string[];
  /** 表示中の会社名。タイトル照合に使う */
  companyName: string;
  limitPerSource?: number;
}

/**
 * 会社の議事録を Notion と Mii の両方から取り、日付の新しい順にまとめる。
 * **重複は排除しない。** 同じ会議の Notion 版と Mii 版が並ぶのが正しい姿。
 */
export async function listCompanyMinutes(input: ListCompanyMinutesInput): Promise<MinutesResult> {
  const limit = input.limitPerSource ?? 6;
  const matchable = isMatchableName(input.companyName);
  const partialFailures: string[] = [];

  let notionByRelation: CompanyMeeting[] = [];
  let notionByTitle: CompanyMeeting[] = [];
  let mii: CompanyMeeting[] = [];

  // ① Notion：まずリレーション
  if (input.companyRelationIds.length) {
    try {
      const rows = await listNotionMinutes(input.companyRelationIds, limit);
      notionByRelation = rows.map(r => ({ ...r, matchedBy: 'relation' as MatchMethod }));
    } catch (e) {
      partialFailures.push(`notion_relation:${(e as NotionError).kind ?? 'error'}`);
    }
  }

  // ② Notion：リレーションで取れなかったぶんをタイトル照合で補う（暫定）
  if (notionByRelation.length < limit && matchable) {
    try {
      const rows = await listMinutesByTitle(normalizeCompanyName(input.companyName), limit);
      const seen = new Set(notionByRelation.map(r => r.externalId));
      notionByTitle = rows
        .filter(r => !seen.has(r.externalId))
        .map(r => ({ ...r, matchedBy: 'title' as MatchMethod }));
    } catch (e) {
      partialFailures.push(`notion_title:${(e as NotionError).kind ?? 'error'}`);
    }
  }

  // ③ Mii（Twenty Note）：タイトル照合のみ
  if (matchable) {
    try {
      mii = await listMiiMinutes(input.companyName, limit);
    } catch (e) {
      partialFailures.push(`mii:${(e as TwentyError).kind ?? 'error'}`);
    }
  }

  const meetings = [...notionByRelation, ...notionByTitle, ...mii]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    meetings,
    diagnostics: {
      notion: {
        total: notionByRelation.length + notionByTitle.length,
        byRelation: notionByRelation.length,
        byTitle: notionByTitle.length,
      },
      mii: { total: mii.length, byTitle: mii.length },
      partialFailures,
      titleMatchSkipped: !matchable,
    },
  };
}
