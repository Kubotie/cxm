// ─── 施策明細から組織の動きを読む ────────────────────────────────────────────
//
// 施策名と作成者の時系列から「この会社で誰が何をしているか」を読む。
//
// 施策名には事業部・施策意図・改善サイクルが表れる:
//   「【介護】求人一覧ページ_特集ページへの遷移バナー追加_夜勤特集」
//   「TOPページ：SP_CTA文言変更_260708」
//
// ⚠️ 読み違いを避けるための前提:
//   1. **24%は無題。** 施策名を読むときは無題を除く（除いた件数は画面に出す）。
//   2. **DELETED の70%は一度も公開されていない。** 作って消しただけの試行錯誤と、
//      配信してから消したものは別の行動なので `everRan` で必ず分ける。
//   3. **停止時刻の列が無い。** 「いつ止めたか」は分からない。
//      PAUSED を「最近止めた」と読ませない。
//   4. 成果（表示回数・CV）は含まれない。ゴール数は設定数であって達成数ではない。
//
// 副作用なし。サーバー・クライアント両対応。

import type { CampaignDetailRow } from '@/lib/metabase/project-campaigns';

/** 作成者ごとの活動。組織の動きはここに出る */
export interface CreatorActivity {
  creator: string;
  /** 社内アカウント（@ptmind.com）。顧客側の動きと混ぜない */
  internal: boolean;
  total:    number;
  ran:      number;
  /** 直近90日の作成数 */
  created90d: number;
  /** 直近30日の作成数 */
  created30d: number;
  firstAt:  string | null;
  lastAt:   string | null;
  /** 初登場が直近90日 = 新しく入った人 */
  isNew:      boolean;
  /** 90日以上作成していない = 抜けた可能性 */
  wentQuiet:  boolean;
  /** よく使う施策タイプ */
  topType:  string | null;
}

/** 施策名から拾った繰り返し語。事業部・対象ページの手がかり */
export interface CampaignTheme {
  word:  string;
  count: number;
  /** 直近90日の件数。増えていれば今の関心 */
  recent: number;
}

/**
 * 方針の変化を読むための期間比較。
 *
 * **件数の説明だけでは「この会社がどこへ向かっているか」が読めない。**
 * 直近90日とその前90日を突き合わせて、テーマの入れ替わり・作る量・
 * 公開まで到達した割合・検証の姿勢（ABの比率）の変化を出す。
 */
/**
 * 月ごとの施策の動き。**チャート用。**
 * 「作った本数」と「公開まで到達した本数」の差が、詰まりの大きさになる。
 * running は月末時点の在庫（RUNNING の数）ではなく、その月に作られたもののうち
 * 現在も RUNNING のものを数える（過去の月末状態は明細から復元できないため）。
 */
export interface CampaignMonthPoint {
  /** "YYYY-MM" */
  month:    string;
  created:  number;
  launched: number;
  /** その月に作られたもののうち、今も配信中のもの */
  running:  number;
}

export interface CampaignDirection {
  /** 作成本数（名前のあるもの） */
  created:  { recent: number; prev: number };
  /** 初公開に至った本数 */
  launched: { recent: number; prev: number };
  /** 今期に新しく出たテーマ語（前期に無い） */
  emerging:  CampaignTheme[];
  /** 前期にあって今期に消えたテーマ語 */
  faded:     CampaignTheme[];
  /** 両方の期間に出ているテーマ語 */
  sustained: CampaignTheme[];
  /** 実行対象の偏り（SP / PC など）。テーマではないので分けて数える */
  devices:   Array<{ word: string; recent: number; prev: number }>;
  /** 名前のある施策の状態内訳 */
  statusMix: Array<{ status: string; count: number }>;
  /** 直近90日に作ったもののうち公開に至った割合（0〜100）。作成0なら null */
  launchRate: { recent: number | null; prev: number | null };
  /** ABテストの比率（0〜100）。作成0なら null */
  abShare:    { recent: number | null; prev: number | null };
}

export interface CampaignOrgVM {
  /** 集計対象（無題を含む全件） */
  total:      number;
  /** 施策名が読める件数 */
  named:      number;
  untitled:   number;

  creators:   CreatorActivity[];
  /** 顧客側の作成者数 */
  customerCreators: number;
  /** 直近90日に初めて施策を作った顧客側の人 */
  newCreators:   string[];
  /** 90日以上作成していない顧客側の人 */
  quietCreators: string[];

  themes:     CampaignTheme[];
  /** 月ごとの動き（古い順）。ダッシュボードのチャートで使う */
  monthly:    CampaignMonthPoint[];
  /** 最近の施策（無題を除く・新しい順） */
  recent:     Array<{
    name: string; status: string; type: string; creator: string | null;
    createdAt: string | null; everRan: boolean; daysToLaunch: number | null;
    isAbTest: boolean; hasGoal: boolean; projectId: string;
  }>;

  /** 作成から公開までの日数の中央値。意思決定の速さ */
  medianDaysToLaunch: number | null;
  /** 公開まで30日以上かかった施策の件数（詰まった施策） */
  slowLaunches: number;

  /** 削除の内訳。作って消しただけ と 配信してから消した は別物 */
  deleted: { total: number; neverRan: number; ranThenDeleted: number };

  reasons: string[];

  /**
   * ブロックごとの一行サマリー。
   * 数字と一覧だけ並べても読み解けないので、**何が言えるか**を添える。
   * 文言はロジックと同じ場所に置く（画面側で解釈を書くと実装とずれる）。
   */
  /** 方針の変化（期間比較） */
  direction: CampaignDirection;

  summaries: {
    /** 全体の結論。**最初に読む一段落。** 箇条書きの前に置く */
    headline: string;
    creators: string;
    themes:   string;
    pace:     string;
    recent:   string;
    /** 方針の変化。「何を狙っていて、どこへ向かっているか」 */
    direction: string;
  };
}

export const EMPTY_DIRECTION: CampaignDirection = {
  created: { recent: 0, prev: 0 }, launched: { recent: 0, prev: 0 },
  emerging: [], faded: [], sustained: [], devices: [], statusMix: [],
  launchRate: { recent: null, prev: null }, abShare: { recent: null, prev: null },
};

export const EMPTY_ORG: CampaignOrgVM = {
  total: 0, named: 0, untitled: 0, creators: [], customerCreators: 0,
  newCreators: [], quietCreators: [], themes: [], monthly: [], recent: [],
  medianDaysToLaunch: null, slowLaunches: 0,
  deleted: { total: 0, neverRan: 0, ranThenDeleted: 0 },
  reasons: ['施策の明細データがありません'],
  direction: EMPTY_DIRECTION,
  summaries: { headline: '', creators: '', themes: '', pace: '', recent: '', direction: '' },
};

/**
 * 実行条件の指定。**テーマ語と混ぜない。**
 * 【SP】【PC】「100%配信」は「何を狙っているか」ではなく「どう出すか」なので、
 * テーマとして数えると上位が全部これで埋まる（実測: 軸が「100%配信・PC・SP」になった）。
 */
const DEVICE_WORDS = new Set(['SP', 'PC', 'スマホ', 'モバイル', 'タブレット', 'MB']);
const DELIVERY_WORDS = new Set(['100%配信', '全配信', '100配信', '100%', '50%配信']);

/**
 * テーマとして意味を持たない語。**完全一致でのみ落とす。**
 * 部分一致で落とすと「デモ会員数表示テスト」のような具体的な施策名まで消える。
 */
const THEME_STOP_WORDS = new Set([
  'テスト', '配信', '修正', '変更', '追加', '実施', '対応', '検証', '改善',
  'ver', 'Ver', 'VER', 'ref', 'REF', 'new', 'NEW', 'TOP', 'top',
  'コピー', 'copy', 'Copy', 'バックアップ', '複製', '一時停止', '停止中',
]);

/** 施策名を語に割るときの区切り。全角の中黒・空白も含める */
const NAME_SPLIT = /[_｜|/／:：\s　、,.。・＆&+＋（）()【】\[\]<>《》-]+/;

/** 語の正規化。記号と空白を落として比較できる形にする */
function normWord(w: string): string {
  return w.replace(/[\s　【】\[\]（）()・:：]/g, '').trim();
}

const DAY = 86400000;
/** 公開までこれ以上かかったら「詰まった施策」 */
const SLOW_LAUNCH_DAYS = 30;
/** テーマ語として拾う最小の出現回数 */
const THEME_MIN_COUNT = 2;

function isInternal(email: string | null): boolean {
  return !!email && /@ptmind\.com$/i.test(email.trim());
}

export function buildCampaignOrg(rows: CampaignDetailRow[]): CampaignOrgVM {
  if (rows.length === 0) return EMPTY_ORG;

  const now = Date.now();
  const at = (v: string | null) => (v ? new Date(v).getTime() : NaN);
  const within = (v: string | null, days: number) => {
    const t = at(v);
    return !Number.isNaN(t) && now - t <= days * DAY;
  };

  const named = rows.filter(r => !r.isUntitled);

  // ── 作成者ごと ────────────────────────────────────────────────────────
  const byCreator = new Map<string, CampaignDetailRow[]>();
  for (const r of rows) {
    const c = r.creator?.trim();
    if (!c) continue;
    const list = byCreator.get(c) ?? [];
    list.push(r);
    byCreator.set(c, list);
  }

  const creators: CreatorActivity[] = [...byCreator.entries()].map(([creator, list]) => {
    const dates = list.map(r => r.createdAt).filter((v): v is string => Boolean(v)).sort();
    const types = new Map<string, number>();
    for (const r of list) types.set(r.type, (types.get(r.type) ?? 0) + 1);
    const topType = [...types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const first = dates[0] ?? null;
    const last  = dates.at(-1) ?? null;
    return {
      creator,
      internal: isInternal(creator),
      total: list.length,
      ran:   list.filter(r => r.everRan).length,
      created90d: list.filter(r => within(r.createdAt, 90)).length,
      created30d: list.filter(r => within(r.createdAt, 30)).length,
      firstAt: first, lastAt: last,
      isNew:     within(first, 90),
      wentQuiet: !within(last, 90),
      topType,
    };
  }).sort((a, b) => b.created90d - a.created90d || b.total - a.total);

  const customers = creators.filter(c => !c.internal);

  // ── テーマ語（施策名の繰り返し）────────────────────────────────────────
  // 形態素解析はしない。【】で囲まれた語と、区切り文字で割った語のうち
  // 複数回出るものを拾う。**推測で意味づけせず、出現回数だけを見せる。**
  const wordCount  = new Map<string, { total: number; recent: number; prev: number }>();
  const deviceCount = new Map<string, { recent: number; prev: number }>();

  /** 直近90日 = recent、その前の90日（91〜180日前）= prev */
  const inPrev = (v: string | null) => {
    const t = at(v);
    if (Number.isNaN(t)) return false;
    const age = now - t;
    return age > 90 * DAY && age <= 180 * DAY;
  };

  for (const r of named) {
    const recent = within(r.createdAt, 90);
    const prev   = inPrev(r.createdAt);
    const words = new Set<string>();
    // 【】の中も区切りで割る。`【PC・SP】` を1語にすると "PCSP" という
    // 存在しないテーマ語ができる（実測）
    for (const m of r.name.matchAll(/【([^】]{1,16})】/g)) {
      for (const part of m[1].split(NAME_SPLIT)) {
        const t = normWord(part);
        if (t) words.add(t);
      }
    }
    for (const w of r.name.split(NAME_SPLIT)) {
      const t = normWord(w);
      // 純粋な数字・バージョン表記（v1 / 2026 など）はテーマではない
      if (t.length >= 3 && t.length <= 14 && !/^\d+$/.test(t) && !/^v\d+$/i.test(t)) words.add(t);
    }
    for (const w of words) {
      const up = w.toUpperCase();
      // 実行条件（SP/PC・100%配信）はテーマではないので別に数える
      if (DEVICE_WORDS.has(up) || DELIVERY_WORDS.has(w)) {
        const key = DELIVERY_WORDS.has(w) ? w : up;
        const d = deviceCount.get(key) ?? { recent: 0, prev: 0 };
        if (recent) d.recent++; if (prev) d.prev++;
        deviceCount.set(key, d);
        continue;
      }
      if (THEME_STOP_WORDS.has(w)) continue;
      const e = wordCount.get(w) ?? { total: 0, recent: 0, prev: 0 };
      e.total++; if (recent) e.recent++; if (prev) e.prev++;
      wordCount.set(w, e);
    }
  }
  const themes: CampaignTheme[] = [...wordCount.entries()]
    .filter(([, v]) => v.total >= THEME_MIN_COUNT)
    .map(([word, v]) => ({ word, count: v.total, recent: v.recent }))
    .sort((a, b) => b.recent - a.recent || b.count - a.count)
    .slice(0, 18);

  // ── 方針の変化（直近90日 vs その前90日）──────────────────────────────
  const recentNamed = named.filter(r => within(r.createdAt, 90));
  const prevNamed   = named.filter(r => inPrev(r.createdAt));
  const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100));

  const themeEntries = [...wordCount.entries()].filter(([, v]) => v.total >= THEME_MIN_COUNT);
  const toTheme = ([word, v]: [string, { total: number; recent: number; prev: number }]): CampaignTheme =>
    ({ word, count: v.total, recent: v.recent });

  const direction: CampaignDirection = {
    created:  { recent: recentNamed.length, prev: prevNamed.length },
    launched: {
      recent: named.filter(r => within(r.firstRunAt, 90)).length,
      prev:   named.filter(r => inPrev(r.firstRunAt)).length,
    },
    // 今期だけに出た語 = 新しく始めたこと
    emerging: themeEntries.filter(([, v]) => v.recent > 0 && v.prev === 0)
      .map(toTheme).sort((a, b) => b.recent - a.recent).slice(0, 5),
    // 前期にあって今期に消えた語 = やめたこと
    faded: themeEntries.filter(([, v]) => v.recent === 0 && v.prev > 0)
      .map(toTheme).sort((a, b) => b.count - a.count).slice(0, 5),
    // 続いている語 = 軸になっていること
    sustained: themeEntries.filter(([, v]) => v.recent > 0 && v.prev > 0)
      .map(toTheme).sort((a, b) => b.recent - a.recent).slice(0, 5),
    devices: [...deviceCount.entries()]
      .map(([word, v]) => ({ word, recent: v.recent, prev: v.prev }))
      .filter(d => d.recent + d.prev > 0)
      .sort((a, b) => b.recent - a.recent),
    statusMix: [...named.reduce((m, r) => m.set(r.status, (m.get(r.status) ?? 0) + 1), new Map<string, number>())]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    launchRate: {
      recent: pct(recentNamed.filter(r => r.everRan).length, recentNamed.length),
      prev:   pct(prevNamed.filter(r => r.everRan).length, prevNamed.length),
    },
    abShare: {
      recent: pct(recentNamed.filter(r => r.isAbTest).length, recentNamed.length),
      prev:   pct(prevNamed.filter(r => r.isAbTest).length, prevNamed.length),
    },
  };

  // ── 月ごとの動き（チャート用）──────────────────────────────────────────
  //
  // 作成日のある施策を月に丸めて、作成・公開・現在配信中を数える。
  // **公開は初公開日（firstRunAt）の月で数える。** 作成月で数えると
  // 「作ったが翌月まで出せなかった」ものが同じ月に乗り、詰まりが消える。
  const monthOf = (v: string | null): string | null => {
    const t = at(v);
    if (Number.isNaN(t)) return null;
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthAgg = new Map<string, { created: number; launched: number; running: number }>();
  const touch = (m: string) => {
    const e = monthAgg.get(m) ?? { created: 0, launched: 0, running: 0 };
    monthAgg.set(m, e);
    return e;
  };
  for (const r of named) {
    const cm = monthOf(r.createdAt);
    if (cm) {
      const e = touch(cm);
      e.created++;
      if (r.status === 'RUNNING') e.running++;
    }
    const lm = monthOf(r.firstRunAt);
    if (lm) touch(lm).launched++;
  }
  const monthly: CampaignMonthPoint[] = [...monthAgg.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);   // 直近12ヶ月

  // ── 意思決定の速さ ────────────────────────────────────────────────────
  const d2l = rows.map(r => r.daysToLaunch).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const median = d2l.length > 0 ? d2l[Math.floor(d2l.length / 2)] : null;

  // ── 削除の内訳 ────────────────────────────────────────────────────────
  const del = rows.filter(r => r.status === 'DELETED');

  const reasons: string[] = [];
  if (customers.length === 0) {
    reasons.push('顧客側で施策を作っている人が記録されていません');
  } else if (customers.length === 1) {
    reasons.push(`施策を作っているのは顧客側1人（${customers[0].creator}）に依存しています`);
  } else {
    reasons.push(`顧客側 ${customers.length}人が施策を作っています`);
  }
  const news = customers.filter(c => c.isNew);
  const quiet = customers.filter(c => c.wentQuiet);
  if (news.length > 0)  reasons.push(`直近90日に ${news.length}人が新しく施策を作り始めました`);
  if (quiet.length > 0) reasons.push(`${quiet.length}人は90日以上、施策を作っていません`);
  if (median !== null)  reasons.push(`作成から公開までの中央値 ${median}日`);

  // ── ブロックごとの読み取り ────────────────────────────────────────────
  const active90 = customers.filter(c => c.created90d > 0);
  const top = customers[0] ?? null;
  const topShare = top && rows.length > 0 ? Math.round((top.total / rows.length) * 100) : 0;

  const creatorSummary = customers.length === 0
    ? '顧客側の作成者が記録されていません。社内が代行している可能性があります。'
    : [
        `登録 ${customers.length}人のうち、直近90日に動いているのは ${active90.length}人。`,
        active90.length === 0
          ? '90日間、顧客側で誰も施策を作っていません。'
          : active90.length === 1
            ? `${active90[0].creator} だけが動いています（1人依存）。`
            : `最も多いのは ${top?.creator}（全体の${topShare}%）。`,
        quiet.length > 0 ? `${quiet.length}人は90日以上動いておらず、担当交代や体制変更の可能性があります。` : null,
        news.length > 0 ? `直近90日に ${news.map(c => c.creator).join('・')} が新しく参加しました。` : null,
      ].filter(Boolean).join(' ');

  const recentThemes = themes.filter(t => t.recent > 0);
  const themeSummary = themes.length === 0
    ? '施策名から繰り返しの語は拾えませんでした。'
    : recentThemes.length === 0
      ? `繰り返し出る語は ${themes.length}種類ありますが、直近90日に使われたものはありません（過去の施策名です）。`
      : `直近90日は ${recentThemes.slice(0, 3).map(t => t.word).join('・')} が中心です`
        + `（${recentThemes.length}種類が今も使われています）。語の出現回数のみで、意味づけはしていません。`;

  const paceSummary = median === null
    ? '公開実績がないため、意思決定の速さは測れません。'
    : median === 0
      ? `作ったその日に公開するのが基本です${d2l.filter(v => v >= SLOW_LAUNCH_DAYS).length > 0 ? `。ただし ${d2l.filter(v => v >= SLOW_LAUNCH_DAYS).length}件は30日以上かかっており、そこで何かが詰まっています` : '（詰まった施策はありません）'}。`
      : `公開まで中央値 ${median}日かかっています。全社の標準は0日なので、承認や実装の待ちが挟まっている可能性があります。`;

  const delSummary = del.length === 0
    ? ''
    : del.filter(r => !r.everRan).length > del.filter(r => r.everRan).length
      ? ` 削除の多く（${del.filter(r => !r.everRan).length}/${del.length}件）は一度も公開されておらず、試行錯誤の跡です。`
      : ` 削除のうち ${del.filter(r => r.everRan).length}件は配信後の停止で、実施済みの施策です。`;

  // ── 方針の変化 ────────────────────────────────────────────────────────
  //
  // **件数の説明ではなく「どこへ向かっているか」を書く。**
  // 施策名のテーマ・作る量・公開に至る率・ABの比率の、前期との差を並べる。
  // 意味づけ（なぜそうしたか）はしない。差分の事実だけを出して読む人に渡す。
  const d = direction;
  const dirParts: string[] = [];

  if (d.created.recent === 0 && d.created.prev === 0) {
    dirParts.push('直近180日に新しい施策は作られていません。');
  } else {
    // 1. 何を狙っているか（今の軸 → 新しく始めたこと → やめたこと）
    if (d.sustained.length > 0) {
      dirParts.push(`軸は ${d.sustained.slice(0, 3).map(t => t.word).join('・')}（前期から継続）。`);
    }
    if (d.emerging.length > 0) {
      dirParts.push(`今期から ${d.emerging.slice(0, 3).map(t => t.word).join('・')} が入りました。`);
    }
    if (d.faded.length > 0) {
      dirParts.push(`前期にあった ${d.faded.slice(0, 3).map(t => t.word).join('・')} は今期は出ていません。`);
    }
    if (d.sustained.length === 0 && d.emerging.length === 0 && d.faded.length === 0) {
      dirParts.push('施策名から繰り返しの語が拾えず、テーマの変化は読めません。');
    }

    // 2. 量の変化
    const delta = d.created.recent - d.created.prev;
    dirParts.push(
      `作成は ${d.created.prev}本 → ${d.created.recent}本`
      + (d.created.prev === 0 ? '（前期は0本）。'
        : delta > 0 ? `（+${delta}）と増えています。`
        : delta < 0 ? `（${delta}）と減っています。`
        : '（横ばい）。'),
    );

    // 3. 作ったものが世に出ているか
    if (d.launchRate.recent !== null) {
      const prevTxt = d.launchRate.prev !== null ? `前期は${d.launchRate.prev}%` : '前期は比較できません';
      dirParts.push(
        `作った施策が公開に至った割合は ${d.launchRate.recent}%（${prevTxt}）`
        + (d.launchRate.prev !== null && d.launchRate.recent < d.launchRate.prev - 15
            ? '。作っても出せていない状態が増えています。'
            : d.launchRate.prev !== null && d.launchRate.recent > d.launchRate.prev + 15
              ? '。作ったものを出せるようになっています。'
              : '。'),
      );
    }

    // 4. 検証の姿勢（当てにいくのか、確かめにいくのか）
    if (d.abShare.recent !== null) {
      const ab = d.abShare.recent;
      const prevAb = d.abShare.prev;
      dirParts.push(
        `ABテストの比率は ${ab}%`
        + (prevAb !== null
            ? `（前期 ${prevAb}%）`
              + (ab > prevAb + 15 ? '。当てにいくより確かめにいく動きに寄っています。'
                : ab < prevAb - 15 ? '。検証より実装を優先する動きに寄っています。'
                : '。')
            : '。'),
      );
    }

    // 5. どこに出しているか
    // 今期に出ていないもの（「100% 0本」）は文章に混ぜない
    const devNow = d.devices.filter(x => x.recent > 0);
    if (devNow.length > 0) {
      const top = devNow[0];
      const sum = devNow.reduce((n, x) => n + x.recent, 0);
      if (sum > 0) {
        const share = Math.round((top.recent / sum) * 100);
        dirParts.push(
          share >= 70
            ? `出し先は ${top.word} に偏っています（今期の${share}%）。`
            : `出し先は ${devNow.map(x => `${x.word} ${x.recent}本`).join(' / ')}。`,
        );
      }
    }
  }
  const directionSummary = dirParts.join('');

  const running = named.filter(r => r.status === 'RUNNING').length;
  const noGoalRunning = named.filter(r => r.status === 'RUNNING' && !r.hasGoal).length;

  // ── 直近の動き ────────────────────────────────────────────────────────
  //
  // **通算の件数だけでは「今どう動いているか」が読めない。**
  // 直近30日に作ったものが世に出ているか、同じ内容を PC/SP の両方で試しているか、
  // といった「この数週間の手つき」を先に書く。
  const last30 = named.filter(r => within(r.createdAt, 30));
  const unpublished30 = last30.filter(r => !r.everRan);
  const statusOf30 = [...unpublished30.reduce(
    (m, r) => m.set(r.status, (m.get(r.status) ?? 0) + 1), new Map<string, number>(),
  )].sort((a, b) => b[1] - a[1]);

  /**
   * デバイス指定を外した「中身の名前」でまとめる。
   * `Carトップ_SP` と `Carトップ_PC` は同じ内容を両方で試している対。
   */
  const baseName = (n: string) => n
    .replace(/【[^】]*】/g, '')
    .replace(/[_｜|/／\s　-]*(SP|PC|スマホ|モバイル|MB)[_｜|/／\s　-]*/gi, '')
    .replace(/\s+/g, '')
    .trim();
  const pairMap = new Map<string, Set<string>>();
  for (const r of last30) {
    const key = baseName(r.name);
    if (!key) continue;
    const dev = /SP|スマホ|モバイル/i.test(r.name) ? 'SP' : /PC/i.test(r.name) ? 'PC' : '';
    if (!dev) continue;
    const set = pairMap.get(key) ?? new Set<string>();
    set.add(dev);
    pairMap.set(key, set);
  }
  const pairs = [...pairMap.values()].filter(v => v.size >= 2).length;

  const recentParts: string[] = [];
  if (named.length === 0) {
    recentParts.push('名前のある施策がありません。');
  } else if (last30.length === 0) {
    recentParts.push(
      `直近30日に新しく作られた施策はありません（通算 ${named.length}件・配信中 ${running}件）。`,
    );
  } else {
    recentParts.push(`直近30日に ${last30.length}本を作成。`);
    if (unpublished30.length === 0) {
      recentParts.push('すべて公開まで到達しています。');
    } else {
      const detail = statusOf30.map(([st, n]) => `${st} ${n}`).join('・');
      recentParts.push(
        `うち ${unpublished30.length}本が未公開です（${detail}）。`
        + (unpublished30.length >= last30.length * 0.6
            ? '作ってから出すまでで止まっています。'
            : ''),
      );
    }
    if (pairs > 0) {
      recentParts.push(`同じ内容を PC と SP の両方で用意しているものが ${pairs}組あります。`);
    }
    recentParts.push(`通算では ${named.length}件・配信中 ${running}件`
      + (noGoalRunning > 0 ? `（うち ${noGoalRunning}件はゴール未設定）` : '') + '。');
  }
  recentParts.push(`無題 ${rows.length - named.length}件は読み取れないので除いています。`);
  const recentSummary = recentParts.join('') + delSummary;

  // ── 全体の結論 ────────────────────────────────────────────────────────
  // 章ごとのサマリーを読む前に、**この会社はいまどういう状態か**を1段落で言う。
  // 箇条書きを並べただけでは、何を見ればいいのか分からない。
  const headlineParts: string[] = [];

  if (customers.length === 0) {
    headlineParts.push('顧客側で施策を作っている人が記録されていません。社内が代行している可能性があります。');
  } else if (active90.length === 0) {
    headlineParts.push(
      `施策を作れる人は ${customers.length}人いますが、**90日間、顧客側で誰も施策を作っていません**。`
      + '運用が止まっています。',
    );
  } else if (active90.length === 1) {
    headlineParts.push(
      `いま動いているのは ${active90[0].creator} の1人だけです（登録は${customers.length}人）。`
      + 'この人が離れると運用が止まります。',
    );
  } else {
    headlineParts.push(
      `顧客側 ${customers.length}人のうち ${active90.length}人が直近90日に動いています`
      + (topShare >= 50 ? `。ただし ${top?.creator} が全体の${topShare}%を作っており、実質この人に依存しています。` : '。'),
    );
  }

  if (quiet.length > 0 && news.length > 0) {
    headlineParts.push(`${quiet.length}人が抜け、${news.length}人が新しく入っており、体制が入れ替わっている可能性があります。`);
  } else if (quiet.length >= Math.max(2, Math.ceil(customers.length / 2))) {
    headlineParts.push(`${customers.length}人中${quiet.length}人が90日以上動いておらず、体制が縮小しています。`);
  } else if (news.length > 0) {
    headlineParts.push(`直近90日に ${news.length}人が新しく参加しました。立ち上がりを支える機会です。`);
  }

  const runningNoGoal = named.filter(r => r.status === 'RUNNING' && !r.hasGoal).length;
  const stuck = d2l.filter(v => v >= SLOW_LAUNCH_DAYS).length;
  const issues: string[] = [];
  if (runningNoGoal > 0) issues.push(`配信中${runningNoGoal}本がゴール未設定`);
  if (stuck > 0)         issues.push(`公開まで30日以上かかった施策が${stuck}件`);
  if (rows.length > 0 && (rows.length - named.length) / rows.length > 0.4) {
    issues.push(`無題が${Math.round((rows.length - named.length) / rows.length * 100)}%で施策の意図を追えない`);
  }
  if (issues.length > 0) headlineParts.push(`手を入れられる点: ${issues.join('、')}。`);

  return {
    total: rows.length,
    named: named.length,
    untitled: rows.length - named.length,
    creators,
    customerCreators: customers.length,
    newCreators:   news.map(c => c.creator),
    quietCreators: quiet.map(c => c.creator),
    themes,
    monthly,
    recent: named.slice(0, 40).map(r => ({
      name: r.name, status: r.status, type: r.type, creator: r.creator,
      createdAt: r.createdAt, everRan: r.everRan, daysToLaunch: r.daysToLaunch,
      isAbTest: r.isAbTest, hasGoal: r.hasGoal, projectId: r.projectId,
    })),
    medianDaysToLaunch: median,
    slowLaunches: d2l.filter(v => v >= SLOW_LAUNCH_DAYS).length,
    deleted: {
      total: del.length,
      neverRan: del.filter(r => !r.everRan).length,
      ranThenDeleted: del.filter(r => r.everRan).length,
    },
    reasons,
    direction,
    summaries: {
      headline: headlineParts.join(''),
      creators: creatorSummary,
      themes:   themeSummary,
      pace:     paceSummary,
      recent:   recentSummary,
      direction: directionSummary,
    },
  };
}
