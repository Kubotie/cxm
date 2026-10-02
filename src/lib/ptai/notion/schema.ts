// ─── PtAI Pipeline: Notion 側の契約 ─────────────────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §8
// 実測: 2026-10-01（顧客管理DB 73 プロパティ / JP_Docs 47 プロパティ）
//
// ═══════════════════════════════════════════════════════════════════════════
//  **アカウント情報の正本は Notion 顧客管理DB**（§0）。Tier・業種・想定追加MRR・
//  課金ステージ・次回Action は、ダッシュボードから即時に書き戻す（§9-2 で承認済み）。
//
//  **議事録は 2 系統ある。**
//    - Notion JP_Docs（Category＝議事録）
//    - Mii（Twenty の Note。2026-08 に API で投入済み 113 件）
//  同じ会議が両方に残ることがあるので、**片方に寄せず両方を出す**（2026-10-01 確認）。
// ═══════════════════════════════════════════════════════════════════════════
//
// プロパティ名を直書きしないこと。必ずここを経由する。

// ═══════════════════════════════════════════════════════════════════════════
// 1. データソース
// ═══════════════════════════════════════════════════════════════════════════

export const NOTION_SOURCES = {
  /** 🗂️ Ptengine AI 顧客管理DB。アカウント情報の正本 */
  customers: '25ef5c40-d968-45d7-9120-7f1878006682',
  /** JP_Docs DB。議事録（読むだけ） */
  docs:      '5f583654-f021-4bb9-8661-01a75fe818c7',
  /**
   * Company Database（CCM / 顧客リスト）。**現在MRR の出どころ**。読むだけ。
   * `mrr` は「SFのMRRが自動反映」。約 8,960 行あるので、必ず mrr > 0 で絞ること。
   * 同じ TOKEN_NOTION で読める（TOKEN_NOTION_2 では PtAI 側が 404 になる）。
   */
  companyDb: '7358bc25-cfde-44eb-8e7b-c24aa7088a92',
} as const;

/** Company Database 側のプロパティ名（2026-10-01 実測） */
export const COMPANY_DB_PROP = {
  name:  'company_name',   // title
  /** Salesforce の Account ID。PtAI 側の「Salesforce Account ID」と突き合わせる鍵 */
  sfId:  'company_id',     // rich_text
  mrr:   'mrr',            // number（円）
} as const;

/** 目標DB（§9-1 で新設）。id は環境変数から取る */
export function targetsDataSourceId(): string | null {
  return (process.env.NOTION_PTAI_TARGETS_DS_ID || '').trim() || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. 顧客管理DB のプロパティ（実測名。絵文字や記号も含めて正確に）
// ═══════════════════════════════════════════════════════════════════════════

export const CUSTOMER_PROP = {
  /**
   * Salesforce の Account ID。2026-10-01 に追加した列。
   * SF の Account に Notion ページ ID を持つ項目が無いので、**こちら側に鍵を持つ**。
   * 社名が完全一致した 113 社は scripts/notion-sf-account-id.mjs が埋めた。
   * 残り（同名 11 社・不一致 3 社）は人が入れる。
   */
  sfAccountId:  'Salesforce Account ID',
  name:            '企業名',                            // title
  tier:            'Tier',                              // select
  industry:        '業種',                              // select
  owner3:          '担当3',                             // multi_select（主担当）
  owner1:          '担当1',                             // multi_select（参照のみ）
  owner2:          '担当2',                             // select（参照のみ）
  /**
   * ⚠️MRR。**もう画面の「現在MRR」には使わない**（2026-10-01）。
   * 人が入れた古い値が混ざっており、Company Database と 51 社で食い違っていた。
   * 他のビューが参照しているので消さない。読むだけ。
   */
  mrr:             '⚠️MRR',                             // number（読むだけ）
  /**
   * 現在MRR。Company Database の `mrr` を**毎朝 8 時に写したもの**。
   * 画面の「現在MRR」はこれ。書くのは同期バッチだけ。
   */
  curMrr:          '現在MRR',                           // number（同期が書く）
  /**
   * 期初MRR。初回同期の値を**一度だけ**焼き付けたもの。以後動かさない。
   * 画面の「現在MRR（＋◯◯）」の括弧内は 現在MRR − 期初MRR。
   */
  baseMrr:         '期初MRR',                           // number（初回のみ）
  /**
   * 対象プロジェクトID。1 社を複数行に分けて持つときだけ使う。
   * （ビズリーチ ToB/ToC、マネーフォワード アカウント1/2）
   * カンマ区切り。入っていれば**そのプロジェクトの MRR を足した額**を
   * 現在MRR にする。空なら Company Database の会社単位 MRR。
   */
  projectIds:      '対象プロジェクトID',                // rich_text（人が入れる）
  aimMrr:          '想定追加MRR',                       // number（双方向。§9-2）
  billingMonth:    '課金開始予定月',                    // date（書く）
  billingStage:    '課金ステージ',                      // select（書く。§9-2）
  barrier:         '阻害の中身/これがあれば課金する',   // rich_text（書く）
  nextAction:      '次回Action',                        // rich_text（書く。§9-2）
  nextActionDate:  'Action日',                          // date（書く）
  solutionStatus:  '新ソリューション状態',              // select（読むだけ）
  companyDatabase: 'Company Database',                  // relation（読むだけ）
  lastEdited:      '🔒 最終更新日',                     // last_edited_time
  // キー日程（§9-4 の回答で Notion に置くと決定。2026-10-01 に 3 列追加）
  fiscalMonth:     '決算月',                            // select（1月〜12月 / 情報なし）
  budgetMonths:    '予算策定時期',                      // rich_text（「10月〜11月」/ 情報なし）
  renewalMonth:    '契約更新月',                        // select（1月〜12月 / 情報なし）
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 2-1. キー日程（D-05・§9-4）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 原本は `edits/<cid>.company.keyDates` に**月（1〜12）**で持っている。日付ではない。
 *   fiscal  : { m }        決算月
 *   budget  : { fm, tm }   予算策定時期（毎年同じ月の範囲）
 *   renewal : { m }        契約更新月
 * いずれも「情報なし」を明示できる。
 *
 * ⚠ **原本の確度フラグ（`st`）は Notion に持たない。**
 *    Notion が正本なので、人が入れた値は確認済みとして扱う。
 *    推定値を区別したくなったら列を足すこと。
 */
export interface KeyDates {
  /** 1〜12。「情報なし」は 'none'、未設定は null */
  fiscalMonth:  number | 'none' | null;
  /** [開始月, 終了月]。「情報なし」は 'none'、未設定は null */
  budgetMonths: [number, number] | 'none' | null;
  renewalMonth: number | 'none' | null;
}

export const KEY_DATES_NONE = '情報なし';

/** 「7月」→ 7 ／「情報なし」→ 'none' ／ 空 → null */
export function parseMonth(v: string | null | undefined): number | 'none' | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  if (s === KEY_DATES_NONE) return 'none';
  const m = /^(\d{1,2})月?$/.exec(s);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 12 ? n : null;
}

export function formatMonth(v: number | 'none' | null): string | null {
  if (v === 'none') return KEY_DATES_NONE;
  if (typeof v === 'number' && v >= 1 && v <= 12) return `${v}月`;
  return null;
}

/** 「10月〜11月」→ [10, 11] ／「10月」→ [10, 10] */
export function parseMonthRange(v: string | null | undefined): [number, number] | 'none' | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  if (s === KEY_DATES_NONE) return 'none';
  const m = /^(\d{1,2})月?\s*[〜~\-–]\s*(\d{1,2})月?$/.exec(s);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) return [a, b];
    return null;
  }
  const one = parseMonth(s);
  return typeof one === 'number' ? [one, one] : null;
}

export function formatMonthRange(v: [number, number] | 'none' | null): string | null {
  if (v === 'none') return KEY_DATES_NONE;
  if (!Array.isArray(v)) return null;
  const [a, b] = v;
  return a === b ? `${a}月` : `${a}月〜${b}月`;
}

/**
 * **書き込んではいけないもの。**
 * `障壁状態(受注に対しての)` は V74 で廃止した（§8-1）。
 * 計算式・ロールアップ・last_edited_time は Notion 側が管理する。
 */
export const CUSTOMER_READONLY_PROPS: readonly string[] = [
  '障壁状態(受注に対しての)', '🔒 最終更新日', ' sf_company_id',
  CUSTOMER_PROP.mrr, CUSTOMER_PROP.solutionStatus, CUSTOMER_PROP.companyDatabase,
  // 同期バッチだけが書く。画面からは書かせない
  CUSTOMER_PROP.curMrr, CUSTOMER_PROP.baseMrr,
  // 人が Notion で入れる。画面からは書かせない
  CUSTOMER_PROP.projectIds,
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. 選択肢の対応（実測。**推測で足さないこと**）
// ═══════════════════════════════════════════════════════════════════════════

/** Tier: ダッシュボード ⇄ Notion。値が同じなので恒等だが、取り違え防止に明示する */
export const TIER_TO_NOTION: Record<string, string> = {
  NONE: '未顧客', TIER1: 'Tier1', TIER2: 'Tier2', TIER3: 'Tier3', TIER5: 'Tier5',
};
export const TIER_FROM_NOTION: Record<string, string> =
  Object.fromEntries(Object.entries(TIER_TO_NOTION).map(([k, v]) => [v, k]));

/**
 * 業種: board.js の `IND_JP` のキー → Notion `業種` の選択肢。
 * Notion 側は 18 択で、ダッシュボードの 16 種より細かい区分がある。
 */
export const INDUSTRY_TO_NOTION: Record<string, string> = {
  BEAUTY_D2C:    '美容・コスメ・健康食品・D2C',
  HEALTHCARE:    '医療・ヘルスケア・製薬・医療機器',
  FITNESS:       'フィットネス・ウェルネス',
  APPAREL:       'アパレル・ファッション',
  EC_RETAIL:     'EC・通販・小売',
  MANUFACTURER:  'メーカー・製造・電機',
  IT_SAAS:       'IT・SaaS・ソフトウェア・Web',
  FINANCE:       '金融・保険・投資',
  HR:            '人材・HR・採用',
  TELECOM_INFRA: '通信・インフラ・エネルギー',
  REAL_ESTATE:   '不動産・建設・住宅',
  EDUCATION:     '教育・スクール・EdTech',
  ENTERTAINMENT: 'エンタメ・メディア',
  TOURISM:       '観光・宿泊・催事',
  AGENCY:        '代理店',
  OTHER:         'その他',
};
export const INDUSTRY_FROM_NOTION: Record<string, string> = {
  ...Object.fromEntries(Object.entries(INDUSTRY_TO_NOTION).map(([k, v]) => [v, k])),
  // ダッシュボードに対応する区分が無い Notion 側の値
  '公共・団体・士業': 'OTHER',
  '要確認':           'OTHER',
};

/**
 * 課金ステージ（§8-1 の案）。**S2 は使わない。**
 * 初回アポ前・初回アポ済 → S0、トライアル → S1、最終見積 → S3、
 * 口頭合意・申込用紙回収 → S4、契約締結 → S5。
 *
 * ⚠ **不可逆ではないが、粗い。** 7 段階を 5 値に落とすので、
 *    Notion 側から読み戻してもフェーズは復元できない。
 *    **フェーズの正本は testOpportunity.stage**（Notion へは書くだけ）。
 */
export const STAGE_TO_BILLING_STAGE: Record<string, string> = {
  // Salesforce のフェーズ（2026-10-01）→ Notion の課金ステージ
  INACTIVE:           'S0 未検証',
  ACTIVE:             'S0 未検証',
  GOAL_SHARED:        'S0 未検証',
  QUALIFIED_CHAMPION: 'S1 PoC開始済み',
  EVALUATING:         'S1 PoC開始済み',
  PROBABLE:           'S3 見積提示',
  VERBAL:             'S4 稟議中',
  WON:                'S4 稟議中',
  CLOSED_WON:         'S5 受注',
  // 閉じたが失注ではない Admin Close は動かさない
  ADMIN_CLOSE:        'S0 未検証',
  // 失注は課金ステージを動かさない（運用の合意が要るため書かない）
};

/** 担当3（multi_select）: Notion の表記 → ダッシュボードの呼称 */
export const OWNER_FROM_NOTION: Record<string, string> = {
  'Shinichi Nagai': 'Paul',
  'Eri Kitada':     'Eri',
  'BB':             'Baba',
  'Ava':            'Ava',
  'Utty':           'Utty',
  'Kubotie':        'Kubotie',
  'Perry':          'Perry',
  'Haillan':        'Haillan',
  'Andy':           'Andy',
  'その他':          'その他',
};
export const OWNER_TO_NOTION: Record<string, string> =
  Object.fromEntries(Object.entries(OWNER_FROM_NOTION).map(([k, v]) => [v, k]));

// ═══════════════════════════════════════════════════════════════════════════
// 4. JP_Docs（議事録。読むだけ）
// ═══════════════════════════════════════════════════════════════════════════

export const DOC_PROP = {
  title:       'お知らせ',        // title
  category:    'Category',        // multi_select（「議事録」を含むものだけ）
  company:     '関連顧客',        // relation（Company Database へ）
  createdDate: '作成日付',        // created_time
  scope:       'Scope',           // select（社内／社外）
  attendees:   '参加者(顧客)',    // rich_text
  decisions:   '決定事項',        // rich_text
  nextAction:  '次回アクション',  // rich_text
  reaction:    '反応',            // select
} as const;

export const DOC_CATEGORY_MINUTES = '議事録';

// ═══════════════════════════════════════════════════════════════════════════
// 5. 議事録の出典（Notion と Mii を対等に扱う）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 同じ会議が Notion と Mii の両方に残ることがある（2026-10-01 確認）。
 * **統合して片方を捨てない。** 画面では日付でまとめて並べ、出典の印を付ける。
 * 重複取り込みの防止は `externalId`（Notion のページID／Twenty Note の id）で行う。
 */
export type MeetingSource = 'NOTION' | 'MII' | 'TWENTY_NOTE' | 'MANUAL';

export const MEETING_SOURCE_JP: Record<MeetingSource, string> = {
  NOTION:      'Notion 議事録',
  MII:         'Mii',
  TWENTY_NOTE: 'Twenty メモ',
  MANUAL:      '手入力',
};

export interface MeetingRecord {
  /** 出典側の一意な ID。重複取り込みを防ぐ鍵 */
  externalId: string;
  source:     MeetingSource;
  title:      string;
  /** YYYY-MM-DD */
  date:       string;
  body:       string;
  url:        string | null;
  /** Notion 側だけ入る */
  scope?:     string | null;
  attendees?: string | null;
}

/** 本文の保存上限（§I-02 の 6,000 字に合わせる）*/
export const MEETING_BODY_MAX = 6000;

/**
 * 並べるときの日付の鍵。**日付でまとめて表示するためだけに使う。**
 *
 * ⚠ **「同じ会議か」をタイトルで推測しない。**
 *    Notion の議事録と Mii の記録は、同じ会議でもタイトルの付け方が違う
 *    （「20260915_定例MTG」と「【社外】定例MTG」など）。似ているから同じ、と
 *    決めつけると別の会議を混ぜてしまう。**両方をそのまま並べ、出典の印を付ける。**
 *    統合が要るなら、人が見て判断できる材料（日付・出典・参加者）を出すところまで。
 */
export function meetingDayKey(m: Pick<MeetingRecord, 'date'>): string {
  return m.date || '';
}

/** 表示用にタイトルの飾りを落とす。**照合には使わない** */
export function meetingTitleForDisplay(title: string): string {
  return (title || '').replace(/^\d{8}[_\-\s]*/, '').trim();
}
