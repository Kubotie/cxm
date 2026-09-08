// ─── 事例機会（顧客が「いま何を検証しているか」）────────────────────────────
//
// **施策の一覧は「運用が回っているか」を見るために作った。**
// だが同じデータには、もう一つ別の情報が入っている ——
// 顧客が **いま何を確かめようとしているか**（仮説）である。
//
//   PDP 動画POPUP PARCOURSV   AB / RUNNING
//   PDP 動画POPUP CESSAC      AB / RUNNING
//   PDP 動画POPUP MIDRAIN     AB / RUNNING   … 同じ型が6対象で並行
//
// これは「施策を6本作った」ではなく、**「商品詳細ページの動画が売上に効くかを、
// 対象を分けて同時に検証している」** という一つの取り組みである。
// 読めると2つのことができる:
//   1. 相手の部署が今期何に賭けているかが分かる（提案の文脈が合う）
//   2. 検証が終われば結果を持っている → **事例・共同発信の打診先になる**
//
// ── 判定の作り ────────────────────────────────────────────────────────────
//   対象  : 名前があり、ABテストで、実際に配信された（または予約された）施策
//   期間  : 配信中は無期限 / それ以外は作成から365日以内
//   グルーピング: 施策名に含まれる「検証の題材」語（動画・レビュー・クーポン…）
//   成立  : 同じ題材のABテストが2本以上
//
// ── 読み違いを避けるための前提 ────────────────────────────────────────────
//   1. **成果は入っていない。** 「効いたか」は分からない。分かるのは
//      「効果を測る形で回している」ところまで。**結果は本人に聞くしかない。**
//   2. **ゴールの中身も分からない。** `hasGoal` は設定の有無だけで、
//      それが購入なのかクリックなのかは列に無い。購買効果の検証と断定しない。
//   3. 題材語は施策名の文字列一致。名前を付けていない施策（全体の24%）は読めない。
//   4. 出し先（商品詳細・カート等）も施策名からの推定。URLは列に無い。
//
// 副作用なし。サーバー・クライアント両対応。

import type { CampaignDetailRow } from '@/lib/metabase/project-campaigns';

// ── 検証の題材 ────────────────────────────────────────────────────────────────
//
// **「何を出したか」ではなく「何を確かめようとしているか」で切る。**
// POPUP・バナーは出し方（型）であって題材ではないので入れない。
// ここに無い語は拾わない（拾えない題材は増えるが、誤読は増えない）。

export interface TacticMeta {
  label: string;
  /** 施策名に出る表記。ASCII は語境界つきで照合する */
  words: string[];
  /** この題材のABテストが立っているとき、顧客は何を確かめているか */
  question: string;
  /**
   * その会社ならではの賭けと言えるか。
   *
   * **CTA文言とフォームは誰でもやる。** 実測（102社）で、2本以上を条件にすると
   * 33社が立ち、うち18社が CTA・フォームだった。2本の文言変更を「事例機会」と
   * 呼ぶと、本当に何かを検証している会社が埋もれる。
   * そこで常套手段は本数の条件を上げ（`COMMON_MIN_AB`）、並び順も後ろにする。
   * ただし十数本を回しているなら、それは最適化プログラムとして事例になる。
   */
  distinctive: boolean;
}

export const TACTICS: Record<string, TacticMeta> = {
  video: {
    label: '動画',
    words: ['動画', 'ムービー', 'ビデオ', 'VIDEO', 'MOVIE', 'YOUTUBE', 'リール'],
    question: '動画コンテンツが行動を変えるか',
    distinctive: true,
  },
  review: {
    label: 'レビュー・口コミ',
    words: ['レビュー', '口コミ', 'クチコミ', 'UGC', 'REVIEW'],
    question: '他者の評価を見せると後押しになるか',
    distinctive: true,
  },
  coupon: {
    label: 'クーポン・値引き',
    words: ['クーポン', '割引', '値下げ', 'セール', 'PRICEDOWN', 'COUPON', 'プライスダウン'],
    question: '値引きの見せ方で買われ方が変わるか',
    distinctive: true,
  },
  shipping: {
    label: '送料・配送',
    words: ['送料', '配送', '即日', 'お届け'],
    question: '送料や配送条件の訴求が決め手になるか',
    distinctive: true,
  },
  recommend: {
    label: 'レコメンド・関連商品',
    words: ['レコメンド', 'おすすめ', 'オススメ', '関連商品', 'RECOMMEND'],
    question: '出す商品を変えると回遊と購買が変わるか',
    distinctive: true,
  },
  ranking: {
    label: 'ランキング・人気',
    words: ['ランキング', '人気', 'RANKING', '売れ筋'],
    question: '人気の提示が選びやすさを作るか',
    distinctive: true,
  },
  scarcity: {
    label: '在庫・残数',
    words: ['在庫', '残り', '売り切れ', '完売', '再入荷'],
    question: '希少性の提示が決断を早めるか',
    distinctive: true,
  },
  sizing: {
    label: 'サイズ・試着',
    words: ['サイズ', '試着', 'フィット', '採寸'],
    question: 'サイズの不安を消すと購入まで進むか',
    distinctive: true,
  },
  membership: {
    label: '会員・登録',
    words: ['会員', '入会', '会員登録', 'ログイン', 'マイページ', '無料登録'],
    question: '会員化の導線で継続的な関係が作れるか',
    distinctive: true,
  },
  app: {
    label: 'アプリ',
    words: ['アプリ', 'APP', 'アプリDL'],
    question: 'アプリへ送ることが有効か',
    distinctive: true,
  },
  chat: {
    label: 'チャット・接客',
    words: ['チャット', '接客', 'CHAT', 'LINE'],
    question: '対話での接客が意思決定を助けるか',
    distinctive: true,
  },
  cta: {
    label: 'CTA・文言',
    words: ['CTA', '文言', 'コピー', 'ボタン文言', 'マイクロコピー'],
    question: '言い方だけで動きが変わるか',
    distinctive: false,
  },
  form: {
    label: 'フォーム・入力',
    words: ['フォーム', '入力', 'EFO', '問い合わせ'],
    question: '入力の負荷を下げると完了率が上がるか',
    distinctive: false,
  },
};

/**
 * 出し先（対象面）。**施策名からの推定。** URL は列に無い。
 * 商品詳細・カート・決済に出ている検証は、購買に近い場所で回している。
 */
const SURFACES: Array<{ label: string; words: string[]; nearPurchase: boolean }> = [
  { label: '商品詳細', words: ['PDP', '商品詳細', '詳細ページ', '商品ページ'], nearPurchase: true },
  { label: 'カート',   words: ['カート', 'CART', 'かご'],                      nearPurchase: true },
  { label: '決済',     words: ['決済', 'レジ', 'CHECKOUT', '購入手続'],        nearPurchase: true },
  { label: '一覧・検索', words: ['一覧', 'カテゴリ', '検索結果', 'PLP', 'LIST'], nearPurchase: false },
  { label: 'トップ',   words: ['TOP', 'トップ', 'ホーム'],                     nearPurchase: false },
  { label: '会員ページ', words: ['マイページ', '会員ページ'],                   nearPurchase: false },
  { label: 'LP',       words: ['LP', 'ランディング', '特集'],                   nearPurchase: false },
  { label: '記事',     words: ['記事', 'コラム', 'ブログ', 'BLOG'],             nearPurchase: false },
];

// ── 型 ────────────────────────────────────────────────────────────────────────

/** 検証がどこまで進んでいるか。事例として声をかけられる段階かを分ける */
export type CaseStrength = 'running' | 'done' | 'weak';

export const STRENGTH_META: Record<CaseStrength, { label: string; hint: string; tone: string }> = {
  running: {
    label: '検証中',
    hint: 'ABテストが今も配信中です。結果はまだ出ていない可能性があります。'
        + '「何を確かめようとしているか」を聞く場面で、結果が出たら事例の相談ができます。',
    tone: 'violet',
  },
  done: {
    label: '検証済み',
    hint: '配信を終えたABテストです。結果を相手が持っています。'
        + '事例・共同発信の打診、または次の検証の相談ができます。',
    tone: 'emerald',
  },
  weak: {
    label: '検証の兆し',
    hint: 'ABテストは立っていますが、ゴールが設定されていないため効果を測れていません。'
        + '測れる形にする提案（計測設計）から入る場面です。',
    tone: 'amber',
  },
};

export interface CaseOpportunityTheme {
  /** TACTICS のキー */
  key:      string;
  label:    string;
  /** 顧客が確かめようとしていること */
  question: string;
  strength: CaseStrength;

  /** 対象のABテスト本数 */
  abCount:      number;
  runningCount: number;
  /** ゴールが設定されている本数。効果を測れる形になっているか */
  withGoal:     number;
  /** 対象プロジェクト数。複数なら事業横断の取り組み */
  projectCount: number;
  /**
   * 同じ型を並行させている対象数（施策名の末尾だけが違うもの）。
   * 3以上なら単発ではなく「プログラム」として回している。
   */
  parallel:     number;
  /** 推定した出し先 */
  surfaces:     string[];
  /** 出し先が購買に近い（商品詳細・カート・決済） */
  nearPurchase: boolean;
  /** 施策の型（POPUP / INLINE など） */
  types:        string[];
  firstAt:      string | null;
  lastAt:       string | null;

  /** 事実の一行。数字だけを書く */
  fact:    string;
  /** 読み取り。**推定を含む場合は文中に明記する** */
  reading: string;

  /** 根拠の現物。画面から施策名を確認できるようにする */
  samples: Array<{
    name: string; status: string; createdAt: string | null;
    hasGoal: boolean; projectId: string;
  }>;
}

export interface CaseOpportunityVM {
  themes: CaseOpportunityTheme[];
  /**
   * 施策の全件ではなく、保存済みの「最近の施策」（最大40件）から出した暫定判定。
   * 本数が実際より少なく出るので、画面ではそう書く。
   */
  partial?: boolean;
  /** 一覧カードに出す1本（最も強いもの）。無ければ null */
  top:    CaseOpportunityBrief | null;
  /** この会社の検証の全体像。1文 */
  summary: string;
  /** このデータで言えないこと */
  limits: string[];
}

/** 一覧（提案準備ボード）に載せる最小形。カードに出す分だけ持つ */
export interface CaseOpportunityBrief {
  key:      string;
  label:    string;
  question: string;
  strength: CaseStrength;
  abCount:      number;
  runningCount: number;
  withGoal:     number;
  parallel:     number;
  surfaces:     string[];
  nearPurchase: boolean;
  lastAt:       string | null;
  reading:      string;
  /**
   * 施策の全件ではなく、保存済みの「最近の施策」（最大40件）から出した暫定判定。
   * 本数が実際より少なく出るので、画面ではそう書く。
   * 日次バッチが判定を持つようになれば false になる。
   */
  partial?:     boolean;
}

export const CASE_OPPORTUNITY_LIMITS = [
  '施策の成果（表示回数・ゴール到達数・CVR）は含まれません。「効果を測る形で回している」ところまでしか分かりません。結果は本人に聞いてください。',
  'ゴールの中身は分かりません（購入なのかクリックなのかは列にありません）。購買効果の検証と断定はできません。',
  '出し先（商品詳細・カートなど）は施策名からの推定です。実際のURLは含まれていません。',
  '無題の施策（全体の約24%）は題材が読めないため対象外です。',
];

export const EMPTY_CASE_OPPORTUNITY: CaseOpportunityVM = {
  themes: [], top: null, summary: '', limits: CASE_OPPORTUNITY_LIMITS,
};

// ── 判定 ──────────────────────────────────────────────────────────────────────

const DAY = 86400000;
/** 配信中でない施策を「今の取り組み」として見る期間 */
const WINDOW_DAYS = 365;
/** 題材として成立する最小本数。1本は単発の試行で、取り組みとは言えない */
const MIN_AB = 2;
/**
 * 常套手段（CTA文言・フォーム）に必要な本数。
 * 2本では「よくある改善」と区別できない。十数本あれば最適化プログラム。
 */
const COMMON_MIN_AB = 4;

/**
 * ASCII 語は語境界つきで照合する。
 * `OFF` を部分一致で拾うと `OFFICIAL` が引っかかる（実際に起きる誤読）。
 */
function hasWord(upperName: string, word: string): boolean {
  const w = word.toUpperCase();
  if (/^[A-Z0-9]+$/.test(w)) {
    return new RegExp(`(?<![A-Z0-9])${w}(?![A-Z0-9])`).test(upperName);
  }
  return upperName.includes(w);
}

/**
 * 施策名の「頭」。末尾のトークンを落としたもの。
 * `PDP 動画POPUP PARCOURSV` → `PDP 動画POPUP`
 * 同じ頭を持つ施策が複数あれば、対象（店舗・ブランド）を分けた並行検証。
 */
function headOf(name: string): string {
  const parts = name.trim().split(/[\s　_｜|/／]+/).filter(Boolean);
  return (parts.length >= 2 ? parts.slice(0, -1) : parts).join(' ').toUpperCase();
}

export function buildCaseOpportunity(rows: CampaignDetailRow[]): CaseOpportunityVM {
  if (rows.length === 0) return EMPTY_CASE_OPPORTUNITY;

  const now = Date.now();
  const within = (v: string | null, days: number) => {
    const t = v ? new Date(v).getTime() : NaN;
    return !Number.isNaN(t) && now - t <= days * DAY;
  };

  // 対象: 名前があり、ABテストで、実際に世に出た（または予約済み）もの。
  // 作っただけの下書きを入れると「検証している」の意味が消える。
  const candidates = rows.filter(r =>
    !r.isUntitled && r.isAbTest
    && (r.everRan || r.status === 'SCHEDULED')
    && (r.status === 'RUNNING' || within(r.createdAt, WINDOW_DAYS)),
  );
  if (candidates.length === 0) {
    return { ...EMPTY_CASE_OPPORTUNITY, summary: '直近1年に配信されたABテストがありません。' };
  }

  const themes: CaseOpportunityTheme[] = [];

  for (const [key, meta] of Object.entries(TACTICS)) {
    const hits = candidates.filter(r => {
      const up = r.name.toUpperCase();
      return meta.words.some(w => hasWord(up, w));
    });
    if (hits.length < (meta.distinctive ? MIN_AB : COMMON_MIN_AB)) continue;

    const running  = hits.filter(r => r.status === 'RUNNING').length;
    const withGoal = hits.filter(r => r.hasGoal).length;
    const projects = new Set(hits.map(r => r.projectId));

    // 並行数: 同じ頭を持つ施策のうち最大のかたまり
    const heads = new Map<string, number>();
    for (const r of hits) {
      const h = headOf(r.name);
      if (h) heads.set(h, (heads.get(h) ?? 0) + 1);
    }
    const parallel = Math.max(...[...heads.values()], 1);

    const surfaceHits = SURFACES.filter(s => {
      return hits.some(r => {
        const up = r.name.toUpperCase();
        return s.words.some(w => hasWord(up, w));
      });
    });

    const dates = hits.map(r => r.createdAt).filter((v): v is string => Boolean(v)).sort();
    const types = [...new Set(hits.map(r => r.type).filter(t => t && t !== '未分類'))];

    // 段階の判定。**ゴールが無ければ「検証」と呼ばない。**
    // 効果を測れないままABを分けているだけの状態を、事例機会と混ぜてはいけない。
    const strength: CaseStrength =
      withGoal === 0 ? 'weak'
      : running > 0  ? 'running'
      : 'done';

    const nearPurchase = surfaceHits.some(s => s.nearPurchase);

    const factParts = [
      `${meta.label}を含むABテスト ${hits.length}本`,
      running > 0 ? `配信中 ${running}本` : '配信中はなし',
      `ゴール設定 ${withGoal}/${hits.length}本`,
      projects.size > 1 ? `${projects.size}プロジェクト` : null,
      surfaceHits.length > 0 ? `出し先は${surfaceHits.map(s => s.label).join('・')}（施策名からの推定）` : null,
      dates.length > 0
        ? (dates[0].slice(0, 10) === dates.at(-1)!.slice(0, 10)
            ? dates[0].slice(0, 10)
            : `${dates[0].slice(0, 10)}〜${dates.at(-1)!.slice(0, 10)}`)
        : null,
    ].filter(Boolean);

    // 読み取り。**事実 → 推定の順に書き、推定は推定と言う。**
    const readParts: string[] = [];
    if (strength === 'weak') {
      readParts.push(
        `${meta.label}のABテストを${hits.length}本立てていますが、ゴールが設定されていません。`
        + '比較はしているのに効果を測れていない状態です。',
      );
    } else {
      readParts.push(`${meta.label}について「${meta.question}」を、ABテストで確かめています。`);
      if (nearPurchase) {
        readParts.push(
          `出し先が${surfaceHits.filter(s => s.nearPurchase).map(s => s.label).join('・')}なので、`
          + '購買への効果を見ている可能性が高いです（ゴールの中身はデータに無いため推定）。',
        );
      }
      if (parallel >= 3) {
        readParts.push(
          `同じ型を${parallel}対象で並行させており、単発の思いつきではなく`
          + '検証プログラムとして回しています。',
        );
      }
      if (projects.size > 1) {
        readParts.push(`${projects.size}つのプロジェクトにまたがっています。`);
      }
      readParts.push(
        strength === 'running'
          ? '結果はまだ相手の手元にあります。何を確かめたいのかを聞ける段階です。'
          : '配信は終わっており、結果を相手が持っています。事例・共同発信を打診できます。',
      );
    }

    themes.push({
      key, label: meta.label, question: meta.question, strength,
      abCount: hits.length, runningCount: running, withGoal,
      projectCount: projects.size, parallel,
      surfaces: surfaceHits.map(s => s.label), nearPurchase,
      types,
      firstAt: dates[0] ?? null,
      lastAt:  dates.at(-1) ?? null,
      fact:    factParts.join(' / '),
      reading: readParts.join(''),
      samples: hits.slice(0, 6).map(r => ({
        name: r.name, status: r.status, createdAt: r.createdAt,
        hasGoal: r.hasGoal, projectId: r.projectId,
      })),
    });
  }

  // 並び: **その会社ならではの題材を先に。** CTA文言が20本あっても、
  // 動画を6本試している事実のほうが「今どこに賭けているか」を語る。
  // 次に段階（検証済み → 検証中 → 兆し）→ 並行数 → 本数。
  const STRENGTH_RANK: Record<CaseStrength, number> = { done: 0, running: 1, weak: 2 };
  themes.sort((a, b) =>
    Number(TACTICS[b.key].distinctive) - Number(TACTICS[a.key].distinctive)
    || STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength]
    || b.parallel - a.parallel
    || b.abCount - a.abCount,
  );

  const solid = themes.filter(t => t.strength !== 'weak');
  const summary = themes.length === 0
    ? `直近1年のABテストは ${candidates.length}本ありますが、施策名から検証の題材が読めませんでした。`
    : solid.length === 0
      ? `${themes.map(t => t.label).join('・')}でABテストを立てていますが、いずれもゴール未設定で効果を測れていません。`
      // 配信中が1本も無ければ「いま」ではない。過去形で書く
      : `${solid.some(t => t.runningCount > 0) ? 'いま検証しているのは' : '直近1年で検証していたのは'} `
        + `${solid.slice(0, 3).map(t => t.label).join('・')}`
        + `（ABテスト ${solid.reduce((n, t) => n + t.abCount, 0)}本）。`
        + (solid[0].nearPurchase
            ? `主戦場は${solid[0].surfaces.join('・')}で、購買に近い場所で確かめています。`
            : '')
        + (solid.some(t => t.strength === 'done')
            ? ' 配信を終えた検証があり、結果を相手が持っています。'
            : '');

  return {
    themes,
    top: themes.length > 0 ? briefOf(themes[0]) : null,
    summary,
    limits: CASE_OPPORTUNITY_LIMITS,
  };
}

/**
 * 保存済みの「最近の施策」（`CampaignOrgVM.recent`）から暫定判定する。
 *
 * **移行用の経路。** 事例機会の判定を日次バッチに入れたのは 2026-09-08 で、
 * それ以前に保存された payload には判定が入っていない。次のバッチまで
 * 一覧が空になるのを避けるため、同じ payload に入っている施策名から作る。
 *
 * ⚠️ `recent` は名前のある施策の先頭40件しかない（プロジェクトごとの新しい順を
 *   連結したもので、全社の時系列に並んでいるわけでもない）。
 *   **本数は実際より少なく出る。** 拾えた場合は `partial` を立てて画面に書く。
 */
export function caseOpportunityFromRecent(
  recent: Array<{
    name: string; status: string; createdAt: string | null; everRan: boolean;
    isAbTest: boolean; hasGoal: boolean; projectId: string;
  }>,
): CaseOpportunityVM {
  const rows: CampaignDetailRow[] = recent.map(r => ({
    projectId: r.projectId, campaignId: '', name: r.name,
    status: r.status, type: '未分類', creator: null,
    createdAt: r.createdAt, firstRunAt: null,
    everRan: r.everRan, daysToLaunch: null, versionCount: 0,
    isAbTest: r.isAbTest, goalCount: r.hasGoal ? 1 : 0, hasGoal: r.hasGoal,
    usergroupCount: 0, isUntitled: false,
  }));
  const vm = buildCaseOpportunity(rows);
  return {
    ...vm,
    partial: true,
    top: vm.top ? { ...vm.top, partial: true } : null,
  };
}

/** 一覧に渡す最小形へ落とす。カードに samples まで運ぶと102社分で重くなる */
export function briefOf(t: CaseOpportunityTheme): CaseOpportunityBrief {
  return {
    key: t.key, label: t.label, question: t.question, strength: t.strength,
    abCount: t.abCount, runningCount: t.runningCount, withGoal: t.withGoal,
    parallel: t.parallel, surfaces: t.surfaces, nearPurchase: t.nearPurchase,
    lastAt: t.lastAt, reading: t.reading,
  };
}
