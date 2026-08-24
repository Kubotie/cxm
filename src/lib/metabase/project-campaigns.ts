// ─── 施策（キャンペーン）データ ──────────────────────────────────────────────
//
// サマリ: https://bi.ptmind.com/public/question/08c87a08-6465-4f0c-9518-a4a781d947bc.csv
//   1プロジェクト1行 / 5,255行 / 約800KB / 実測2.6秒。**常時参照してよい。**
//
// 明細: https://bi.ptmind.com/public/question/23dd5100-2436-40da-8aac-a75424436826.csv
//   施策1件1行 / 76,833行 / 約13.8MB / 実測5秒。**一覧では絶対に読まない。**
//   ⚠️ URL パラメータでの絞り込みは効かない（実測: ?project_id= を付けても同じサイズ）。
//   個社ページ・プロジェクト詳細を開いたときだけ取得し、プロセス内でIDで引く。
//
// 判定に効く点:
//   1. **「稼働施策 N本」は在庫数で、時間の概念がない。**
//      実測で「稼働5本以上なのに30日間1本も公開していない」有料PJが48件。
//      最終公開が2023年のものまで含まれる。必ず `ran30d` / `lastRunAt` と併記する。
//   2. `ever_ran` で分ける。DELETED の70%は一度も公開されていない。
//      作っただけで消したものと、配信してから消したものは別の行動。
//   3. 列挙値をハードコードしない。未知の Status / Type は「未分類」に落とす。
//   4. 行が無い = ゼロ。横並び比較のときはゼロ埋めする。
//
// このデータが答えられないこと（画面にも明記する）:
//   停止時刻 / 最終更新日時 / 施策の成果。
//   `PAUSED` は現在のスナップショットで、いつ止めたかは分からない。
//
// サーバーサイド専用。

const SUMMARY_CSV_URL =
  'https://bi.ptmind.com/public/question/08c87a08-6465-4f0c-9518-a4a781d947bc.csv';
const DETAIL_CSV_URL =
  'https://bi.ptmind.com/public/question/23dd5100-2436-40da-8aac-a75424436826.csv';

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface CampaignSummary {
  projectId: string;
  totalCampaigns: number;

  firstCampaignAt: string | null;
  lastCampaignAt:  string | null;
  /** 最後に施策を公開した日時。**「稼働N本」を読むときは必ずこれを併記する** */
  lastRunAt:       string | null;

  runningCount:   number;
  pausedCount:    number;
  draftCount:     number;
  deletedCount:   number;
  scheduledCount: number;

  everRanCount:  number;
  neverRanCount: number;

  abTestCount:        number;
  untitledCount:      number;
  /** 配信中なのにゴール未設定。効果を測れないまま配信している */
  runningWithoutGoal: number;

  inlineCount:    number;
  popupCount:     number;
  redirectCount:  number;
  advancedCount:  number;
  stickybarCount: number;

  created90d: number;
  ran90d:     number;
  created30d: number;
  ran30d:     number;

  // ── 比率は自分で計算する（ゼロ除算を避けるため元データに列が無い）──────
  /** 公開率 = ever_ran / total。作った施策のうち何割を実際に公開したか */
  publishRate: number;
  /** ABテスト率 */
  abTestRate:  number;
  /** 無題率。高い = 場当たり的な運用 */
  untitledRate: number;
  /** 配信中のうちゴール未設定の割合。running が0なら null */
  noGoalRate:  number | null;
}

export interface CampaignDetailRow {
  projectId:  string;
  campaignId: string;
  name:       string;
  /** 未知の値は '未分類' に落とす（列挙をハードコードしない） */
  status:     string;
  type:       string;
  /** 施策を作った人。閲覧アカウントと突き合わせると「作る人／見る人」が分かる */
  creator:    string | null;
  createdAt:  string | null;
  firstRunAt: string | null;
  everRan:    boolean;
  /** 作成から初公開までの日数。ever_ran = false なら null */
  daysToLaunch: number | null;
  versionCount: number;
  isAbTest:   boolean;
  goalCount:  number;
  hasGoal:    boolean;
  usergroupCount: number;
  isUntitled: boolean;
}

// ── キャッシュ ────────────────────────────────────────────────────────────────

const TTL_MS = 60 * 60 * 1000;

let _sum: Map<string, CampaignSummary> | null = null;
let _sumAt = 0;
let _sumInflight: Promise<Map<string, CampaignSummary>> | null = null;

let _det: Map<string, CampaignDetailRow[]> | null = null;
let _detAt = 0;
let _detInflight: Promise<Map<string, CampaignDetailRow[]>> | null = null;

export function getCampaignCacheAge(): { summary: number | null; detail: number | null } {
  return {
    summary: _sum ? Date.now() - _sumAt : null,
    detail:  _det ? Date.now() - _detAt : null,
  };
}

// ── サマリ（常時参照可）────────────────────────────────────────────────────────

export async function fetchCampaignSummaryMap(
  opts: { force?: boolean } = {},
): Promise<Map<string, CampaignSummary>> {
  if (!opts.force) {
    if (_sum && Date.now() - _sumAt < TTL_MS) return _sum;
    if (_sumInflight) return _sumInflight;
  }
  _sumInflight = loadSummary().finally(() => { _sumInflight = null; });
  return _sumInflight;
}

async function loadSummary(): Promise<Map<string, CampaignSummary>> {
  const out = new Map<string, CampaignSummary>();
  try {
    const res = await fetch(SUMMARY_CSV_URL, { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) {
      console.warn(`[metabase/campaigns] summary CSV ${res.status}`);
      return _sum ?? out;
    }
    const lines = (await res.text()).split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return out;

    const h = parseCsvLine(lines[0]);
    const idx = (name: string) => h.indexOf(name);
    const I = {
      id: idx('Project ID'), total: idx('total_campaigns'),
      first: idx('first_campaign_at'), last: idx('last_campaign_at'), lastRun: idx('last_run_at'),
      running: idx('running_count'), paused: idx('paused_count'), draft: idx('draft_count'),
      deleted: idx('deleted_count'), scheduled: idx('scheduled_count'),
      everRan: idx('ever_ran_count'), neverRan: idx('never_ran_count'),
      ab: idx('ab_test_count'), untitled: idx('untitled_count'), noGoal: idx('running_without_goal'),
      inline: idx('inline_count'), popup: idx('popup_count'), redirect: idx('redirect_count'),
      advanced: idx('advanced_count'), sticky: idx('stickybar_count'),
      c90: idx('created_90d'), r90: idx('ran_90d'), c30: idx('created_30d'), r30: idx('ran_30d'),
    };
    if (I.id < 0 || I.total < 0) {
      console.warn('[metabase/campaigns] summary の想定列が無い:', h.join(','));
      return _sum ?? out;
    }

    for (let i = 1; i < lines.length; i++) {
      const f = parseCsvLine(lines[i]);
      const id = f[I.id];
      if (!id) continue;
      const total = num(f[I.total]) || 0;
      const everRan = num(f[I.everRan]);
      const running = num(f[I.running]);
      const noGoal  = num(f[I.noGoal]);
      // total_campaigns は1以上が保証されているが、壊れた行でも落ちないよう max(1) で割る
      const denom = Math.max(total, 1);

      out.set(id, {
        projectId: id,
        totalCampaigns: total,
        firstCampaignAt: date(f[I.first]),
        lastCampaignAt:  date(f[I.last]),
        lastRunAt:       date(f[I.lastRun]),
        runningCount: running,
        pausedCount:    num(f[I.paused]),
        draftCount:     num(f[I.draft]),
        deletedCount:   num(f[I.deleted]),
        scheduledCount: num(f[I.scheduled]),
        everRanCount:  everRan,
        neverRanCount: num(f[I.neverRan]),
        abTestCount:        num(f[I.ab]),
        untitledCount:      num(f[I.untitled]),
        runningWithoutGoal: noGoal,
        inlineCount:    num(f[I.inline]),
        popupCount:     num(f[I.popup]),
        redirectCount:  num(f[I.redirect]),
        advancedCount:  num(f[I.advanced]),
        stickybarCount: num(f[I.sticky]),
        created90d: num(f[I.c90]),
        ran90d:     num(f[I.r90]),
        created30d: num(f[I.c30]),
        ran30d:     num(f[I.r30]),
        publishRate:  everRan / denom,
        abTestRate:   num(f[I.ab]) / denom,
        untitledRate: num(f[I.untitled]) / denom,
        noGoalRate:   running > 0 ? noGoal / running : null,
      });
    }

    _sum = out; _sumAt = Date.now();
    return out;
  } catch (e) {
    console.warn('[metabase/campaigns] summary 取得失敗:', e instanceof Error ? e.message : e);
    return _sum ?? out;
  }
}

// ── 明細（個別ページでのみ）────────────────────────────────────────────────────

/**
 * 施策明細を projectId で引ける形で返す。
 *
 * ⚠️ **13.8MB を1回ダウンロードする。** 一覧・ボードから呼ばない。
 * URL パラメータでの絞り込みが効かないため、全件取ってプロセス内で索引する。
 */
export async function fetchCampaignDetailMap(
  opts: { force?: boolean } = {},
): Promise<Map<string, CampaignDetailRow[]>> {
  if (!opts.force) {
    if (_det && Date.now() - _detAt < TTL_MS) return _det;
    if (_detInflight) return _detInflight;
  }
  _detInflight = loadDetail().finally(() => { _detInflight = null; });
  return _detInflight;
}

async function loadDetail(): Promise<Map<string, CampaignDetailRow[]>> {
  const out = new Map<string, CampaignDetailRow[]>();
  try {
    const res = await fetch(DETAIL_CSV_URL, { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) {
      console.warn(`[metabase/campaigns] detail CSV ${res.status}`);
      return _det ?? out;
    }
    const lines = (await res.text()).split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return out;

    const h = parseCsvLine(lines[0]);
    const idx = (name: string) => h.indexOf(name);
    const I = {
      id: idx('Project ID'), cid: idx('Campaign ID'), name: idx('Campaign Name'),
      status: idx('Campaign Status'), type: idx('Campaign Type'),
      creator: idx('Creator Account'),
      created: idx('Campaign Create Time'), firstRun: idx('Campaign First Run Time'),
      everRan: idx('ever_ran'), d2l: idx('days_to_launch'),
      ver: idx('Version Count'), ab: idx('is_ab_test'),
      goal: idx('Goal Count'), hasGoal: idx('has_goal'),
      ug: idx('Usergroup Count'), untitled: idx('is_untitled'),
    };
    if (I.id < 0 || I.cid < 0) {
      console.warn('[metabase/campaigns] detail の想定列が無い:', h.join(','));
      return _det ?? out;
    }

    for (let i = 1; i < lines.length; i++) {
      const f = parseCsvLine(lines[i]);
      const id = f[I.id];
      if (!id) continue;
      const list = out.get(id) ?? [];
      list.push({
        projectId: id,
        campaignId: f[I.cid] ?? '',
        name:   f[I.name] ?? '',
        // 未知の値はエラーにせず「未分類」に落とす（将来の機能追加で壊れないため）
        status: (f[I.status] || '').trim() || '未分類',
        type:   (f[I.type]   || '').trim() || '未分類',
        creator: I.creator >= 0 ? (f[I.creator] || null) : null,
        createdAt:  date(f[I.created]),
        firstRunAt: date(f[I.firstRun]),
        everRan:  num(f[I.everRan]) === 1,
        daysToLaunch: I.d2l >= 0 && (f[I.d2l] ?? '').trim() !== '' ? num(f[I.d2l]) : null,
        versionCount: num(f[I.ver]),
        isAbTest: num(f[I.ab]) === 1,
        goalCount: num(f[I.goal]),
        hasGoal:   num(f[I.hasGoal]) === 1,
        usergroupCount: num(f[I.ug]),
        isUntitled: num(f[I.untitled]) === 1,
      });
      out.set(id, list);
    }

    // 新しい順にしておく（画面はほぼ時系列で読む）
    for (const list of out.values()) {
      list.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    }

    _det = out; _detAt = Date.now();
    return out;
  } catch (e) {
    console.warn('[metabase/campaigns] detail 取得失敗:', e instanceof Error ? e.message : e);
    return _det ?? out;
  }
}

// ── パーサ ────────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { fields.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

function num(v: string | undefined): number {
  const n = parseFloat(v ?? '');
  return Number.isNaN(n) ? 0 : n;
}

/** ISO 日時をそのまま保持する（JST +09:00）。空は null */
function date(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  return s && s !== 'null' ? s : null;
}
