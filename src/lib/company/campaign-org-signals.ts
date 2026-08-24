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
  summaries: {
    /** 全体の結論。**最初に読む一段落。** 箇条書きの前に置く */
    headline: string;
    creators: string;
    themes:   string;
    pace:     string;
    recent:   string;
  };
}

export const EMPTY_ORG: CampaignOrgVM = {
  total: 0, named: 0, untitled: 0, creators: [], customerCreators: 0,
  newCreators: [], quietCreators: [], themes: [], recent: [],
  medianDaysToLaunch: null, slowLaunches: 0,
  deleted: { total: 0, neverRan: 0, ranThenDeleted: 0 },
  reasons: ['施策の明細データがありません'],
  summaries: { headline: '', creators: '', themes: '', pace: '', recent: '' },
};

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
  const wordCount = new Map<string, { total: number; recent: number }>();
  for (const r of named) {
    const recent = within(r.createdAt, 90);
    const words = new Set<string>();
    for (const m of r.name.matchAll(/【([^】]{1,12})】/g)) words.add(m[1].trim());
    for (const w of r.name.split(/[_｜|/／:：\s、,（）()【】]+/)) {
      const t = w.trim();
      if (t.length >= 3 && t.length <= 14 && !/^\d+$/.test(t)) words.add(t);
    }
    for (const w of words) {
      const e = wordCount.get(w) ?? { total: 0, recent: 0 };
      e.total++; if (recent) e.recent++;
      wordCount.set(w, e);
    }
  }
  const themes: CampaignTheme[] = [...wordCount.entries()]
    .filter(([, v]) => v.total >= THEME_MIN_COUNT)
    .map(([word, v]) => ({ word, count: v.total, recent: v.recent }))
    .sort((a, b) => b.recent - a.recent || b.count - a.count)
    .slice(0, 18);

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

  const running = named.filter(r => r.status === 'RUNNING').length;
  const noGoalRunning = named.filter(r => r.status === 'RUNNING' && !r.hasGoal).length;
  const recentSummary = named.length === 0
    ? '名前のある施策がありません。'
    : `名前のある ${named.length}件のうち配信中 ${running}件`
      + (noGoalRunning > 0 ? `（うち ${noGoalRunning}件はゴール未設定）` : '')
      + `。無題 ${rows.length - named.length}件は読み取れないので除いています。` + delSummary;

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
    summaries: {
      headline: headlineParts.join(''),
      creators: creatorSummary,
      themes:   themeSummary,
      pace:     paceSummary,
      recent:   recentSummary,
    },
  };
}
