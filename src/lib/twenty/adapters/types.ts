// ─── Twenty → RAW 互換 ViewModel の共通型 ────────────────────────────────────
//
// 原則: **PtAI Pipeline の業務データは Twenty が唯一の正本。** ここは Twenty の応答を、
// 現行 board.js が期待する RAW 形式へ変換するだけの層。NocoDB には一切触らない。
//
// ── 守ること ──────────────────────────────────────────────────────────────────
//   - 顧客名・UUID・本文をログに出さない（診断は件数だけ）
//   - 不足項目を推測値で埋めない。無いものは null / 空で返す
//   - 8 段階フェーズは未確定なので変換しない（sync-policy の STAGE_MAPPING_DECIDED）
//   - 紐付かないレコードは黙って捨てず、件数として診断に出す

import type { LinkMethod } from '../sync-policy';

export type { LinkMethod };

/** 紐付けの結果。どの方法で決まったかを必ず持つ */
export interface Linked<T> {
  value: T;
  /** relation / exact_name / title / unresolved */
  method: LinkMethod;
}

/** 変換の診断情報。**件数と方式だけ。** 顧客が特定できる値は入れない */
export interface AdapterDiagnostics {
  companies: {
    total: number;
  };
  opportunities: {
    total: number;
    byMethod: Record<LinkMethod, number>;
    /** どの会社にも付かなかった件数 */
    unresolved: number;
  };
  notes: {
    total: number;
    byMethod: Record<LinkMethod, number>;
    unresolved: number;
  };
  /** Twenty の stage をそのまま持ち回っている旨（8 段階へは変換していない） */
  stagePassthrough: true;
  /** 取得に失敗した部分。空なら完全に取れている */
  partialFailures: string[];
}

export function emptyDiagnostics(): AdapterDiagnostics {
  const zero = (): Record<LinkMethod, number> =>
    ({ relation: 0, exact_name: 0, title: 0, unresolved: 0 });
  return {
    companies: { total: 0 },
    opportunities: { total: 0, byMethod: zero(), unresolved: 0 },
    notes: { total: 0, byMethod: zero(), unresolved: 0 },
    stagePassthrough: true,
    partialFailures: [],
  };
}

// ── RAW 互換型（board.js が読む形。原本 1353 行の const RAW）──────────────────

export interface RawOpportunity {
  id: string;
  raw: string;
  /** **Twenty の stage をそのまま入れる。** 8 段階へは変換しない */
  st: string | null;
  close: string | null;
  net: number | null;
  ownerId: string | null;
  need: string;
  src: string;
  pc: string;
  up: string;
}

export interface RawNote {
  t: string;
  d: string;
  md: string;
}

/**
 * 資料（原本の docs / od）。
 * 2026-10-01 まで「Twenty には無いので常に空」としていたが、
 * **組織資料は Notion の JP_Docs にある**（組織図 AI の主材料）。
 */
export interface RawDoc {
  /** 日付 YYYY-MM-DD */
  d: string;
  /** 種別（議事録・組織資料・メールなど） */
  k: string;
  t: string;
  b: string;
}

export interface RawCompany {
  cid: string;
  n: string;
  t: string | null;
  ps: string | null;
  /** 現在MRR。Notion の `現在MRR`（Company Database から毎朝同期） */
  m: number;
  /** 期初MRR。画面の「現在MRR（＋◯◯）」の括弧内は m − bm */
  bm: number;
  ind: string | null;
  slug: string | null;
  lay: string | null;
  own: string[];
  o: string[];
  asg: string | null;
  icp: string | null;
  aw: string | null;
  src: string | null;
  na: string;
  up: string;
  url: string;
  dom: string;
  cs: string | null;
  opp: RawOpportunity[] | null;
  /** Salesforce の Account ID（Notion 顧客管理DB が持つ）。未設定なら null */
  sfid: string | null;
  notes: RawNote[];
  /** repo の資料。いまは入れていない（移行元でも 3 社 11 件だけだった） */
  docs: RawDoc[];
  /** 組織資料。Notion の JP_Docs から配る */
  od: RawDoc[];
}

export interface RawSnapshot {
  /** メンバー id → 表示名 */
  members: Record<string, string>;
  /** 取得時刻。原本と同じ YYYY-MM-DDTHH:MM:00Z */
  fetched: string;
  companies: RawCompany[];
  /** どの会社にも紐付かなかった商談。件数把握のために残す */
  unmatchedOpps: RawOpportunity[][];
}
