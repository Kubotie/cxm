// ─── GET /api/projects/[projectId] ────────────────────────────────────────────
//
// プロジェクト1件の詳細。一覧では概要しか出せないので、
// 機能ごとの内訳・種別構成・契約との差分をここで返す。
//
// **辞書に無いモジュールも「除外した」ことが分かる形で返す。**
// 集計から落としたものを黙って消すと、PVの総和が合わずに不審になる。

import { NextResponse } from 'next/server';
import { fetchProjectSignalMap, type ProjectSignalData } from '@/lib/metabase/project-signals';
import { fetchProjectModuleMap, type ProjectModuleData } from '@/lib/metabase/project-modules';
import { loadProjectFacts } from '@/lib/company/project-facts';
import { EMPTY_CAMPAIGN_SIGNAL, type CampaignSignalVM } from '@/lib/company/campaign-signals';
import { fetchProjectAccountMap, type ProjectAccountData } from '@/lib/metabase/project-accounts';
import { fetchCompaniesByTiers } from '@/lib/nocodb/companies';
import { buildModuleSignal, type ModuleSignalVM } from '@/lib/company/module-signals';

export const maxDuration = 60;

export interface ProjectModuleDetailRow {
  id:         string;
  label:      string;
  product:    string;
  signalType: string;
  moduleType: string;
  pv:         number;
  /** 総PVに占める割合（%） */
  share:      number;
  confidence: string;
  caution:    string | null;
  description: string;
}

export interface ProjectDetailResponse {
  /** 施策の直近の動き（サマリ由来）。null = 施策データなし */
  campaign: CampaignSignalVM | null;
  /**
   * このプロジェクトの状態を1段落で。
   * 数値タイルを並べただけでは読み解けないので、**何が言えるか**を先に置く。
   */
  headline: string;
  /** 手を入れられる点（提案の入口） */
  actions: string[];
  projectId:   string;
  projectName: string;
  paidType:    string | null;
  companyName: string | null;
  companyUid:  string | null;
  owner:       string | null;
  tier:        number | null;

  period: { start: string | null; end: string | null };
  module: ModuleSignalVM;

  /** 実測（project-signals） */
  metrics: {
    l30Active:     number;
    l7EventCount:  number;
    lastActiveDate: string | null;
    heatmapCount:  number;
    campaignCount: number;
    pvCeiling:     number | null;
    monthPvCount:  number | null;
    pvRate:        number | null;
    habituation:   boolean | null;
  };

  /** 機能ごとの内訳（PV降順） */
  modules: ProjectModuleDetailRow[];
  /** 種別ごとの構成（回遊を含む。何に時間を使っているかを見る） */
  bySignalType: Array<{ signalType: string; pv: number; share: number; countable: boolean }>;
  /** 製品ごとの構成 */
  byProduct: Array<{ product: string; pv: number; share: number }>;

  /**
   * 週次のアカウント別稼働日数（誰がどれだけ触っているか）。
   * **社内アカウント（@ptmind.com）は internal=true で区別する。**
   * 運用人数には数えないが、伴走の濃さが見えるのでチャートには出す。
   */
  accounts: {
    /** X軸（週初日・昇順） */
    weeks: string[];
    series: Array<{
      email: string;
      internal: boolean;
      totalActiveDays: number;
      /** 直近4週にその人が何を見ていたか */
      role: 'insight' | 'experience' | 'both' | 'idle';
      recentPtiPv: number;
      recentPtxPv: number;
      /** weeks と同じ長さ。その週の稼働日数（0埋め） */
      activeDays: number[];
      ptiActiveDays: number[];
      ptxActiveDays: number[];
    }>;
    /** 直近4週の顧客側の運用人数 */
    operators: number;
    operatorsPrev: number;
    internalOperators: number;
    singleOperator: boolean;
    /** 顧客側の役割の内訳 */
    roleCounts: Record<'insight' | 'experience' | 'both' | 'idle', number>;
    /** 顧客側が直近4週に一度も見ていない製品 */
    untouchedProducts: string[];
  } | null;
  /** 辞書に定義が無く集計から外したもの */
  excluded: Array<{ id: string; pv: number; reason: string }>;
  totalPv: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: 'projectId が指定されていません' }, { status: 400 });
  }

  // 事前計算（朝のバッチ）を優先。揃っていなければ CSV に落ちる（§36.3）。
  // モジュールの内訳（機能別PV）だけは事前計算に持たせていないので別途引く。
  const [facts, companies] = await Promise.all([
    loadProjectFacts([projectId]),
    fetchCompaniesByTiers([1, 2, 3, 5], 2000).catch(() => []),
  ]);
  const pf = facts.map.get(projectId) ?? null;

  const sig = pf?.signal ?? null;
  // 機能別の内訳はここでしか使わないため、詳細を開いたときだけ引く
  const data = (await fetchProjectModuleMap().catch(
    () => new Map<string, ProjectModuleData>(),
  )).get(projectId) ?? null;

  if (!sig && !data) {
    return NextResponse.json({ error: `プロジェクトが見つかりません: ${projectId}` }, { status: 404 });
  }

  // NocoDB は `sf_0017F...`、Metabase は `0017F...`。両形式で引く
  const bySfId = new Map<string, (typeof companies)[number]>();
  for (const c of companies) {
    bySfId.set(c.id, c);
    if (c.id.startsWith('sf_')) bySfId.set(c.id.slice(3), c);
  }
  const company = sig?.masterCompanySfId ? bySfId.get(sig.masterCompanySfId) ?? null : null;

  const module = pf?.module ?? buildModuleSignal({
    paidType:  sig?.paidType ?? null,
    data,
    l30Active: sig?.l30Active ?? null,
  });

  const totalPv = data?.totalPv ?? 0;
  const share = (pv: number) => (totalPv > 0 ? Math.round((pv / totalPv) * 1000) / 10 : 0);

  const modules: ProjectModuleDetailRow[] = (data?.modules ?? []).map(m => ({
    id: m.moduleId,
    label: m.def.labelJa,
    product: m.def.product,
    signalType: m.def.signalType,
    moduleType: m.def.moduleType,
    pv: m.pageviews,
    share: share(m.pageviews),
    confidence: m.def.confidence,
    caution: m.def.caution,
    description: m.def.description,
  }));

  const bySignalType = Object.entries(data?.pvBySignalType ?? {})
    .map(([signalType, pv]) => ({
      signalType, pv, share: share(pv),
      // 回遊・未分類は「使っている」に数えていない
      countable: !['回遊', '未分類'].includes(signalType),
    }))
    .sort((a, b) => b.pv - a.pv);

  const byProduct = Object.entries(data?.pvByProduct ?? {})
    .map(([product, pv]) => ({ product, pv, share: share(pv) }))
    .sort((a, b) => b.pv - a.pv);

  // 週次のアカウント別稼働。週の欠損は0で埋めてチャートで線が切れないようにする
  // 週次チャートは明細（週ごとの系列）が要るので、詳細を開いたときだけ引く
  const acct = (await fetchProjectAccountMap().catch(
    () => new Map<string, ProjectAccountData>(),
  )).get(projectId) ?? null;
  const accounts: ProjectDetailResponse['accounts'] = acct
    ? {
        weeks: acct.weeks,
        series: acct.accounts.map(a => {
          const byWeek = new Map(a.weeks.map(w => [w.week, w]));
          return {
            email: a.email,
            internal: a.internal,
            totalActiveDays: a.totalActiveDays,
            role: a.role,
            recentPtiPv: a.recentPtiPv,
            recentPtxPv: a.recentPtxPv,
            activeDays:    acct.weeks.map(w => byWeek.get(w)?.activeDays ?? 0),
            ptiActiveDays: acct.weeks.map(w => byWeek.get(w)?.ptiActiveDays ?? 0),
            ptxActiveDays: acct.weeks.map(w => byWeek.get(w)?.ptxActiveDays ?? 0),
          };
        }),
        operators:         acct.operators,
        operatorsPrev:     acct.operatorsPrev,
        internalOperators: acct.internalOperators,
        singleOperator:    acct.singleOperator,
        roleCounts:        acct.roleCounts,
        untouchedProducts: acct.untouchedProducts,
      }
    : null;

  const body: ProjectDetailResponse = {
    ...buildProjectHeadline({
      module,
      campaign: pf?.campaign ?? EMPTY_CAMPAIGN_SIGNAL,
      accounts: acct,
    }),
    campaign: pf && pf.campaign.activity !== 'unknown' ? pf.campaign : null,
    projectId,
    projectName: sig?.projectName || projectId,
    paidType:    sig?.paidType ?? null,
    companyName: company?.name ?? sig?.masterCompanyName ?? null,
    companyUid:  company?.id ?? null,
    owner:       company?.owner ?? null,
    tier:        company?.tier ?? null,
    period: { start: data?.periodStart ?? null, end: data?.periodEnd ?? null },
    module,
    metrics: {
      l30Active:      sig?.l30Active ?? 0,
      l7EventCount:   sig?.l7EventCount ?? 0,
      lastActiveDate: sig?.lastActiveDate ?? null,
      heatmapCount:   sig?.heatmapCount ?? 0,
      campaignCount:  sig?.runningCampaignWithGoalCount ?? 0,
      pvCeiling:      sig?.pvCeiling ?? null,
      monthPvCount:   sig?.monthPvCount ?? null,
      pvRate: sig?.pvCeiling && sig.pvCeiling > 0 && sig.monthPvCount !== null
        ? Math.round((sig.monthPvCount / sig.pvCeiling) * 100) : null,
      habituation: null,
    },
    modules,
    bySignalType,
    byProduct,
    accounts,
    excluded: (data?.droppedPv ?? 0) > 0
      ? [{ id: '（辞書に定義なし）', pv: data!.droppedPv, reason: '辞書に定義が無いため集計から除外' }]
      : [],
    totalPv,
  };

  return NextResponse.json(body);
}

/**
 * プロジェクトの状態を1段落にまとめる。
 *
 * 数値タイルを並べただけでは読み解けない。
 * **「この状態は何を意味するか」と「手を入れられる点」**を先に出す。
 * 文言はここ（サーバー側）に置く。画面に解釈を書くと実装とずれる。
 */
function buildProjectHeadline(input: {
  module:   ReturnType<typeof buildModuleSignal>;
  campaign: CampaignSignalVM;
  accounts: ProjectAccountData | null;
}): { headline: string; actions: string[] } {
  const { module: mod, campaign: camp, accounts } = input;
  const parts: string[] = [];
  const actions: string[] = [];

  // ① 使われているか
  switch (mod.verdict) {
    case 'dormant':
      parts.push('30日間、管理画面へのアクセスも計測イベントもありません。提案より前に、使われる状態に戻すか契約の実態を確認する必要があります。');
      break;
    case 'unused':
      parts.push('ログインはしていますが、30日間 着地画面より先に進んでいません。');
      break;
    case 'partial':
      parts.push(`契約している ${mod.unusedEntitled.join('・')} を30日間使っていません。追加購入なしで価値を出せる状態です。`);
      break;
    case 'shallow':
      parts.push('施策や設定は触っていますが、分析・成果検証まで進んでいません。');
      break;
    case 'healthy':
      parts.push(`実利用 ${mod.activePv.toLocaleString('ja-JP')}PV / ${mod.activeModuleCount}機能。分析・検証まで到達しています。`);
      break;
    default:
      parts.push('管理画面の利用データが取得できていません。');
  }

  // ② 施策が動いているか
  if (camp.activity === 'idle_run') {
    parts.push(`施策は稼働中${camp.running}本ありますが、30日間の新規公開はゼロです（最終公開${camp.daysSinceLastRun ?? '—'}日前）。過去の施策が動き続けているだけの状態です。`);
  } else if (camp.activity === 'stuck') {
    parts.push(`30日で${camp.created30d}本作っていますが、1本も公開されていません。どこかで詰まっています。`);
  } else if (camp.activity === 'stopped') {
    parts.push('施策が止まっています。');
  } else if (camp.activity === 'active') {
    parts.push(`施策は30日で${camp.created30d}本作成・${camp.ran30d}本公開と回っています。`);
  }

  // ③ 誰が動かしているか
  if (accounts) {
    if (accounts.operators === 0) {
      parts.push('顧客側で管理画面を開いた人が30日間いません。');
    } else if (accounts.singleOperator) {
      parts.push(`運用は顧客側1人に依存しています（4週前は${accounts.operatorsPrev}人）。`);
      actions.push('運用が1人に依存しています。担当が離れると止まるため、二人目を巻き込む提案ができます');
    } else if (accounts.operatorsPrev > accounts.operators) {
      parts.push(`運用は${accounts.operators}人（4週前は${accounts.operatorsPrev}人）で、関わる人が減っています。`);
    }
    if (accounts.untouchedProducts.length > 0) {
      actions.push(`顧客側が ${accounts.untouchedProducts.join('・')} を4週間見ていません。価値が届いていない可能性があります`);
    }
  }

  // ④ 手を入れられる点
  actions.push(...mod.opportunities, ...camp.opportunities);
  if (camp.runningWithoutGoal > 0) {
    actions.push(`配信中${camp.runningWithoutGoal}本がゴール未設定。効果を測れる状態にする提案ができます`);
  }

  return { headline: parts.join(''), actions: [...new Set(actions)] };
}
