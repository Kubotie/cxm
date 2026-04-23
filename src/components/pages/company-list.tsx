"use client";

// ─── Company List ─────────────────────────────────────────────────────────────
// Layer 2: Priority Exploration
// 優先顧客を探索し、「なぜ優先か」を理解し、Company Detail に入るための面。
//
// Section A: クイックセグメント（上部タブ）
// Section B: フィルタバー（折り畳み）+ 検索
// Section C: カード一覧（1行 + 2行目 reason）
//
// データソース: /api/company-summary-list?limit=500&sort=priority_desc
// Home から ?health=critical 等のクエリパラメータを受け取る。

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw, Search, X, Filter,
  ArrowRight, ChevronDown, ChevronUp, Headphones,
  Sparkles, Building2, Plus,
} from "lucide-react";
import { SidebarNav }     from "@/components/layout/sidebar-nav";
import { GlobalHeader }   from "@/components/layout/global-header";
import { Badge }          from "@/components/ui/badge";
import { Button }         from "@/components/ui/button";
import { Input }          from "@/components/ui/input";
import { Skeleton }       from "@/components/ui/skeleton";
import { AlertBox }       from "@/components/ui/alert-box";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getHealthBadge, getFreshnessBadge } from "@/lib/company/badges";
import { orderedReasons } from "@/lib/company/priority-reason";
import { ActionCreateDialog } from "@/components/company/action-create-dialog";
import type { CompanyListItemVM } from "@/lib/company/company-vm";

// /api/company-summary-list は UI ルート（認証不要）
function apiFetch(path: string) {
  return fetch(path, { headers: { 'Content-Type': 'application/json' } });
}

// ── 型 ────────────────────────────────────────────────────────────────────────

type SortKey = 'priority' | 'name' | 'commBlank' | 'support';

interface Filters {
  search:         string;
  health:         string;   // '' | 'critical' | 'at_risk' | 'healthy' | 'expanding'
  phase:          string;   // '' | any phaseLabel
  owner:          string;   // '' | any owner name
  supportCrit:    string;   // '' | 'yes'
  freshness:      string;   // '' | 'missing' | 'stale' | 'fresh' | 'locked'
  commBlank:      string;   // '' | 'warning' | 'risk'
}

const DEFAULT_FILTERS: Filters = {
  search: '', health: '', phase: '', owner: '',
  supportCrit: '', freshness: '', commBlank: '',
};

// ── クイックセグメント定義 ────────────────────────────────────────────────────

type SegmentKey =
  | 'all'
  | 'renewal_30'
  | 'renewal_90'
  | 'arr_at_risk'
  | 'expanding'
  | 'critical'
  | 'at_risk'
  | 'support_high'
  | 'summary_stale'
  // ── snapshot 差分ベース ──────────────────────────────────────────────────
  | 'phase_changed'
  | 'renewal_entered_30'
  | 'renewal_entered_90'
  | 'support_increased'
  | 'mrr_increased'
  | 'mrr_decreased'
  | 'health_worsened'
  | 'health_improved'
  // ── 週次/月次傾向 ────────────────────────────────────────────────────────
  | 'weekly_worsened'
  | 'weekly_activated'
  | 'monthly_renewal_entered'
  | 'monthly_mrr_increased'
  | 'monthly_mrr_decreased';

interface Segment {
  key:    SegmentKey;
  label:  string;
  filter: (item: CompanyListItemVM) => boolean;
  color:  string;  // active 時の色クラス
}

const SEGMENTS: Segment[] = [
  {
    key:    'all',
    label:  'すべて',
    filter: () => true,
    color:  'border-slate-700 text-slate-700 bg-slate-50',
  },
  {
    key:    'renewal_30',
    label:  '更新30日',
    filter: i => i.renewalBucket === '0-30',
    color:  'border-rose-500 text-rose-700 bg-rose-50',
  },
  {
    key:    'renewal_90',
    label:  '更新90日',
    filter: i => i.renewalBucket === '31-90',
    color:  'border-orange-500 text-orange-700 bg-orange-50',
  },
  {
    key:    'arr_at_risk',
    label:  'ARR リスク',
    filter: i => (i.mrr ?? 0) > 0 && (i.overallHealth === 'critical' || i.overallHealth === 'at_risk'),
    color:  'border-red-500 text-red-700 bg-red-50',
  },
  {
    key:    'expanding',
    label:  '拡大中',
    filter: i => i.overallHealth === 'expanding',
    color:  'border-indigo-500 text-indigo-700 bg-indigo-50',
  },
  {
    key:    'critical',
    label:  'Critical',
    filter: i => i.overallHealth === 'critical',
    color:  'border-red-500 text-red-700 bg-red-50',
  },
  {
    key:    'at_risk',
    label:  'At Risk',
    filter: i => i.overallHealth === 'at_risk',
    color:  'border-amber-500 text-amber-700 bg-amber-50',
  },
  {
    key:    'support_high',
    label:  'Support高',
    filter: i => (i.criticalSupportCount ?? 0) > 0 || (i.openSupportCount ?? 0) >= 5,
    color:  'border-orange-500 text-orange-700 bg-orange-50',
  },
  {
    key:    'summary_stale',
    label:  'Summary要更新',
    filter: i => i.freshnessStatus === 'missing' || i.freshnessStatus === 'stale',
    color:  'border-violet-500 text-violet-700 bg-violet-50',
  },
  // ── snapshot 差分ベース ────────────────────────────────────────────────────
  {
    key:    'phase_changed',
    label:  'フェーズ変化',
    filter: i => i.snapshotDiff?.phaseChanged === true,
    color:  'border-violet-500 text-violet-700 bg-violet-50',
  },
  {
    key:    'renewal_entered_30',
    label:  '更新30日入り',
    filter: i => i.snapshotDiff?.renewalEnteredThirty === true,
    color:  'border-rose-500 text-rose-700 bg-rose-50',
  },
  {
    key:    'renewal_entered_90',
    label:  '更新90日入り',
    filter: i => i.snapshotDiff?.renewalEnteredNinety === true,
    color:  'border-orange-500 text-orange-700 bg-orange-50',
  },
  {
    key:    'support_increased',
    label:  'サポート増加',
    filter: i => i.snapshotDiff?.supportIncreased === true,
    color:  'border-amber-500 text-amber-700 bg-amber-50',
  },
  {
    key:    'mrr_increased',
    label:  'MRR増加',
    filter: i => i.snapshotDiff?.mrrIncreased === true,
    color:  'border-emerald-500 text-emerald-700 bg-emerald-50',
  },
  {
    key:    'mrr_decreased',
    label:  'MRR減少',
    filter: i => i.snapshotDiff?.mrrDecreased === true,
    color:  'border-red-500 text-red-700 bg-red-50',
  },
  {
    key:    'health_worsened',
    label:  '健全度悪化',
    filter: i => i.snapshotDiff?.healthWorsened === true,
    color:  'border-red-500 text-red-700 bg-red-50',
  },
  {
    key:    'health_improved',
    label:  '健全度改善',
    filter: i => i.snapshotDiff?.healthImproved === true,
    color:  'border-emerald-500 text-emerald-700 bg-emerald-50',
  },
  // ── 週次/月次傾向 ────────────────────────────────────────────────────────
  {
    key:    'weekly_worsened',
    label:  '悪化（週）',
    filter: i => i.snapshotDiff?.weeklyHealthWorsened === true,
    color:  'border-red-500 text-red-700 bg-red-50',
  },
  {
    key:    'weekly_activated',
    label:  '健全化（週）',
    filter: i => i.snapshotDiff?.weeklyActivated === true,
    color:  'border-emerald-500 text-emerald-700 bg-emerald-50',
  },
  {
    key:    'monthly_renewal_entered',
    label:  '更新接近（月）',
    filter: i => i.snapshotDiff?.monthlyRenewalEntered === true,
    color:  'border-orange-500 text-orange-700 bg-orange-50',
  },
  {
    key:    'monthly_mrr_increased',
    label:  'MRR増（月）',
    filter: i => i.snapshotDiff?.monthlyMrrIncreased === true,
    color:  'border-emerald-500 text-emerald-700 bg-emerald-50',
  },
  {
    key:    'monthly_mrr_decreased',
    label:  'MRR減（月）',
    filter: i => i.snapshotDiff?.monthlyMrrDecreased === true,
    color:  'border-red-500 text-red-700 bg-red-50',
  },
];

// ── フィルタ適用 ──────────────────────────────────────────────────────────────

function applyFilters(
  items:   CompanyListItemVM[],
  f:       Filters,
  segment: SegmentKey,
): CompanyListItemVM[] {
  const seg = SEGMENTS.find(s => s.key === segment) ?? SEGMENTS[0];
  return items.filter(item => {
    if (!seg.filter(item)) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!item.companyName.toLowerCase().includes(q) &&
          !item.companyUid.toLowerCase().includes(q)) return false;
    }
    if (f.health    && item.overallHealth !== f.health) return false;
    if (f.phase     && item.activePhaseLabel !== f.phase) return false;
    if (f.owner     && item.owner !== f.owner) return false;
    if (f.freshness && item.freshnessStatus !== f.freshness) return false;
    if (f.supportCrit === 'yes' && (item.criticalSupportCount ?? 0) === 0) return false;
    if (f.commBlank === 'warning' && item.communicationRiskLevel === 'none') return false;
    if (f.commBlank === 'risk'    && item.communicationRiskLevel !== 'risk')  return false;
    return true;
  });
}

// ── ソート適用 ────────────────────────────────────────────────────────────────

function applySort(
  items: CompanyListItemVM[],
  key:   SortKey,
  dir:   'asc' | 'desc',
): CompanyListItemVM[] {
  return [...items].sort((a, b) => {
    let diff = 0;
    if (key === 'priority')   diff = (a.priorityScore ?? 0) - (b.priorityScore ?? 0);
    if (key === 'name')       diff = a.companyName.localeCompare(b.companyName, 'ja');
    if (key === 'commBlank')  diff = (a.communicationBlankDays ?? -1) - (b.communicationBlankDays ?? -1);
    if (key === 'support')    diff = (a.openSupportCount ?? 0) - (b.openSupportCount ?? 0);
    return dir === 'asc' ? diff : -diff;
  });
}

// ── ユニーク選択肢抽出 ────────────────────────────────────────────────────────

function uniqueValues(items: CompanyListItemVM[], key: keyof CompanyListItemVM): string[] {
  const set = new Set<string>();
  items.forEach(i => {
    const v = i[key];
    if (v && typeof v === 'string') set.add(v);
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
}

// ── MRR フォーマット ─────────────────────────────────────────────────────────

function formatMrr(yen: number): string {
  if (yen >= 100_000_000) return `¥${(yen / 100_000_000).toFixed(1)}億`;
  if (yen >= 10_000)      return `¥${Math.round(yen / 10_000).toLocaleString()}万`;
  return `¥${yen.toLocaleString()}`;
}

// ── セグメント対応アクション prefill ─────────────────────────────────────────

function getSegmentPrefill(segment: SegmentKey, item: CompanyListItemVM): string | null {
  if (segment === 'renewal_30' || segment === 'renewal_entered_30' || segment === 'monthly_renewal_entered') {
    const days = item.renewalDaysLeft;
    return days != null ? `更新対応: ${item.companyName}（あと${days}日）` : `更新対応: ${item.companyName}`;
  }
  if (segment === 'support_high' || segment === 'support_increased') {
    return `サポート確認: ${item.companyName}`;
  }
  if (segment === 'expanding' || segment === 'weekly_activated') {
    return `upsell提案: ${item.companyName}`;
  }
  if (segment === 'health_worsened' || segment === 'weekly_worsened' || segment === 'critical' || segment === 'at_risk') {
    return `健全度悪化確認: ${item.companyName}`;
  }
  if (segment === 'mrr_decreased' || segment === 'monthly_mrr_decreased') {
    return `MRR減少確認: ${item.companyName}`;
  }
  return null;
}

// ── 推奨アクション候補 ─────────────────────────────────────────────────────────

function getNextActionCandidate(item: CompanyListItemVM): string | null {
  const bd = item.priorityBreakdown ?? [];
  if (!bd.length) return null;
  const top = bd[0].reason;
  if (top === 'health: critical')               return '緊急対応ミーティングを設定する';
  if (top === 'health: at_risk')                return 'リスク確認のコンタクトを取る';
  if (top === 'support: critical case')         return 'サポートケースを確認する';
  if (top === 'health: expanding')              return 'upsell 提案を準備する';
  if (top === 'phase: stagnation')              return 'フェーズ進捗を確認する';
  if (top === 'phase: gap')                     return 'フェーズをすり合わせる';
  if (top.startsWith('communication blank:'))   return 'コンタクトを取る';
  if (top === 'people: 意思決定者未登録')        return '意思決定者を登録する';
  if (top === 'people: 意思決定者 90d+ 未接触') return '意思決定者にコンタクトを取る';
  if (top === 'action: 期限切れあり')           return '期限切れアクションを確認する';
  return null;
}

// ── Summary freshness badge ───────────────────────────────────────────────────

function FreshnessBadge({ status }: { status: string }) {
  const b = getFreshnessBadge(status);
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${b.className}`}>
      {b.label}
    </Badge>
  );
}

// ── Company カード ────────────────────────────────────────────────────────────

function CompanyCard({ item, segment }: { item: CompanyListItemVM; segment: SegmentKey }) {
  const [actionOpen, setActionOpen] = useState(false);

  const health     = getHealthBadge(item.overallHealth);
  const reasons    = orderedReasons(item, item.priorityBreakdown ?? []);
  const nextAction = getSegmentPrefill(segment, item) ?? getNextActionCandidate(item);

  // 機会 vs リスク理由を分離
  const isExpanding = item.overallHealth === 'expanding';
  const oppReason   = isExpanding && reasons.length > 0 ? reasons[0] : null;
  const riskReasons = isExpanding ? reasons.slice(1) : reasons;

  const commCls = item.communicationRiskLevel === 'risk'    ? 'text-red-500'
                : item.communicationRiskLevel === 'warning' ? 'text-amber-500'
                : 'text-slate-400';
  const commLabel = item.communicationBlankDays != null
    ? `${item.communicationBlankDays}日前` : '—';

  const hasRow2 = reasons.length > 0 || !!nextAction;

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all group">
        {/* 1行目: 主要情報 */}
        <div className={`flex items-center gap-2 px-4 pt-3 min-w-0 ${hasRow2 ? 'pb-1' : 'pb-3'}`}>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 flex-shrink-0 font-medium ${health.className}`}
          >
            {health.label}
          </Badge>

          <Link
            href={`/companies/${item.companyUid}`}
            className="text-sm font-medium text-slate-800 flex-1 truncate hover:text-slate-900 hover:underline"
          >
            {item.companyName}
          </Link>

          {item.activePhaseLabel && (
            <span className="text-[11px] text-slate-400 flex-shrink-0 hidden sm:block">
              {item.activePhaseLabel}
              {item.phaseGap && (
                <span className="ml-1 text-amber-500" title={item.phaseGapDescription ?? undefined}>⚠</span>
              )}
            </span>
          )}

          {/* MRR */}
          {item.mrr != null && item.mrr > 0 && (
            <span className="text-[11px] text-slate-500 flex-shrink-0 hidden lg:block tabular-nums">
              {formatMrr(item.mrr)}
            </span>
          )}

          {/* 更新日数 */}
          {item.renewalDaysLeft != null && item.renewalBucket !== null && (
            <span className={`text-[11px] flex-shrink-0 tabular-nums font-medium hidden md:block ${
              item.renewalBucket === '0-30'  ? 'text-rose-600' :
              item.renewalBucket === '31-90' ? 'text-orange-500' : 'text-slate-400'
            }`}>
              {item.renewalDaysLeft >= 0 ? `更新${item.renewalDaysLeft}日` : '更新超過'}
            </span>
          )}

          <span className={`text-[11px] flex-shrink-0 ${commCls}`}>{commLabel}</span>

          {(item.criticalSupportCount ?? 0) > 0 ? (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0">
              <Headphones className="w-3 h-3" /> C:{item.criticalSupportCount}
            </span>
          ) : (item.openSupportCount ?? 0) >= 5 ? (
            <span className="flex-shrink-0 flex items-center gap-0.5 text-[11px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0">
              <Headphones className="w-3 h-3" /> {item.openSupportCount}
            </span>
          ) : null}

          {(item.freshnessStatus === 'missing' || item.freshnessStatus === 'stale') && (
            <FreshnessBadge status={item.freshnessStatus} />
          )}

          {/* アクション作成ボタン（hover 時に表示） */}
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] gap-1 flex-shrink-0 px-2 border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.preventDefault(); e.stopPropagation(); setActionOpen(true); }}
          >
            <Plus className="w-3 h-3" />アクション
          </Button>

          <Link href={`/companies/${item.companyUid}`} className="flex-shrink-0">
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </Link>
        </div>

        {/* 2行目: 機会 / リスク理由 + 推奨アクション */}
        {hasRow2 && (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 px-4 pb-3 pt-0 pl-[calc(52px+16px)]">
            {oppReason && (
              <span className="text-[11px] text-indigo-500 truncate">↑ {oppReason}</span>
            )}
            {riskReasons.slice(0, oppReason ? 1 : 2).map((r, i) => (
              <span key={i} className="text-[11px] text-slate-400 truncate">→ {r}</span>
            ))}
            {nextAction && (
              <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">
                <span className="text-[10px] text-slate-300 mr-1">推奨:</span>
                {nextAction}
              </span>
            )}
          </div>
        )}
      </div>

      <ActionCreateDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        companyUid={item.companyUid}
        companyName={item.companyName}
        prefillTitle={nextAction ?? `${item.companyName} — アクション`}
        sourceType="signal"
        createdFrom="manual"
      />
    </>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export function CompanyList() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const pathname     = usePathname();

  // ── データ ──────────────────────────────────────────────────────────────────
  const [items,       setItems]       = useState<CompanyListItemVM[] | null>(null);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  // ── URL クエリ → 初期セグメント解決 ────────────────────────────────────────
  // ?segment=renewal_30 / renewal_90 / arr_at_risk / expanding / support_high 等を受け取る
  // ?health=critical 等の旧パラメータも引き続きサポート
  const VALID_SEGMENTS = new Set<SegmentKey>([
    'all','renewal_30','renewal_90','arr_at_risk',
    'expanding','critical','at_risk','support_high','summary_stale',
    'phase_changed','renewal_entered_30','renewal_entered_90',
    'support_increased','mrr_increased','mrr_decreased',
    'health_worsened','health_improved',
    'weekly_worsened','weekly_activated',
    'monthly_renewal_entered','monthly_mrr_increased','monthly_mrr_decreased',
  ]);

  const initSegment = ((): SegmentKey => {
    const seg = searchParams.get('segment') as SegmentKey | null;
    if (seg && VALID_SEGMENTS.has(seg)) return seg;
    const h = searchParams.get('health') ?? '';
    if (h === 'critical') return 'critical';
    if (h === 'at_risk')  return 'at_risk';
    if (h === 'expanding') return 'expanding';
    return 'all';
  })();

  const initSegmentLabel = ((): string | null => {
    const seg = searchParams.get('segment');
    const found = SEGMENTS.find(s => s.key === initSegment);
    return seg && found && found.key !== 'all' ? found.label : null;
  })();

  const [segment,      setSegment]      = useState<SegmentKey>(initSegment);
  const [fromHome,     setFromHome]     = useState<string | null>(initSegmentLabel);
  const [filters,      setFilters]      = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters,  setShowFilters]  = useState(false);
  const [sortKey,      setSortKey]      = useState<SortKey>('priority');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc');

  // クエリパラメータ適用は初回のみ（以降は内部状態で管理）
  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    // 適用後はクエリパラメータをクリア（ブラウザバックで再適用しないよう）
    if (searchParams.get('segment') || searchParams.get('health')) {
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  // ── データ取得 ──────────────────────────────────────────────────────────────
  const load = useCallback((refresh = false) => {
    if (refresh) setRefreshing(true);
    setLoadError(null);
    apiFetch('/api/company-summary-list?limit=500&sort=priority_desc')
      .then(r => r.ok ? r.json() : r.json().then((e: {error?:string}) => Promise.reject(e.error ?? '取得エラー')))
      .then((data: { items: CompanyListItemVM[] }) => {
        setItems(data.items ?? []);
        setLastFetched(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch((err: unknown) => setLoadError(String(err)))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── フィルタ helpers ─────────────────────────────────────────────────────────
  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => ({ ...f, [key]: value }));
  }
  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSegment('all');
    setFromHome(null);
  }
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => k !== 'search' && v !== '');
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v !== '').length;

  // ── 集計（セグメント件数）───────────────────────────────────────────────────
  const segmentCounts = SEGMENTS.reduce((acc, seg) => {
    acc[seg.key] = (items ?? []).filter(seg.filter).length;
    return acc;
  }, {} as Record<SegmentKey, number>);

  // ── 表示データ ───────────────────────────────────────────────────────────────
  const displayed = items
    ? applySort(applyFilters(items, filters, segment), sortKey, sortDir)
    : null;

  // ── フェーズ・担当 選択肢 ────────────────────────────────────────────────────
  const phaseOptions  = items ? uniqueValues(items, 'activePhaseLabel') : [];
  const ownerOptions  = items ? uniqueValues(items, 'owner')            : [];

  // ── ローディング ──────────────────────────────────────────────────────────────
  if (items === null && !loadError) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <SidebarNav />
        <div className="flex-1 flex flex-col overflow-hidden">
          <GlobalHeader />
          <main className="flex-1 p-6">
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />

        <main className="flex-1 flex flex-col overflow-hidden">

          {/* ── ページヘッダー ─────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h1 className="text-base font-semibold text-slate-800">Companies</h1>
              {displayed !== null && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {displayed.length}
                  {items && items.length !== displayed.length && ` / ${items.length}`}
                  {' '}社
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 検索 */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={filters.search}
                  onChange={e => setFilter('search', e.target.value)}
                  placeholder="企業名で検索..."
                  className="pl-8 h-8 text-sm w-48"
                />
                {filters.search && (
                  <button onClick={() => setFilter('search', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* フィルタ toggle */}
              <Button
                variant="outline" size="sm"
                className={`h-8 text-xs gap-1.5 ${hasActiveFilters ? 'border-blue-300 text-blue-700 bg-blue-50' : ''}`}
                onClick={() => setShowFilters(v => !v)}
              >
                <Filter className="w-3.5 h-3.5" />
                フィルタ
                {activeFilterCount > 0 && (
                  <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
                {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>

              {/* 並び順 */}
              <Select
                value={`${sortKey}_${sortDir}`}
                onValueChange={v => {
                  const [k, d] = v.split('_') as [SortKey, 'asc' | 'desc'];
                  setSortKey(k); setSortDir(d);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority_desc" className="text-xs">優先度（高い順）</SelectItem>
                  <SelectItem value="commBlank_desc" className="text-xs">空白日数（長い順）</SelectItem>
                  <SelectItem value="support_desc" className="text-xs">サポート（多い順）</SelectItem>
                  <SelectItem value="name_asc" className="text-xs">企業名（昇順）</SelectItem>
                </SelectContent>
              </Select>

              {/* 更新 */}
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => load(true)} disabled={refreshing}>
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              {lastFetched && <span className="text-[11px] text-slate-400">{lastFetched}</span>}
            </div>
          </div>

          {/* ── Home からのコンテキストバナー ─────────────────────────── */}
          {fromHome && (
            <div className="px-6 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-indigo-700 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                変動コックピットから：<span className="font-semibold">{fromHome}</span> で絞り込み中
              </span>
              <button
                onClick={() => { setSegment('all'); setFromHome(null); }}
                className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> 解除
              </button>
            </div>
          )}

          {/* ── Section A: クイックセグメント ─────────────────────────── */}
          <div className="px-6 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 flex-shrink-0 overflow-x-auto">
            {SEGMENTS.map(seg => {
              const count   = segmentCounts[seg.key];
              const isActive = segment === seg.key;
              return (
                <button
                  key={seg.key}
                  onClick={() => setSegment(seg.key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? seg.color
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {seg.label}
                  <span className={`${isActive ? 'opacity-70' : 'text-slate-400'} tabular-nums`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Section B: フィルタバー ────────────────────────────────── */}
          {showFilters && (
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3 flex-shrink-0">

              {/* Health */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Health</span>
                <Select value={filters.health || '__all__'} onValueChange={v => setFilter('health', v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="expanding">Expanding</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* フェーズ */}
              {phaseOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">フェーズ</span>
                  <Select value={filters.phase || '__all__'} onValueChange={v => setFilter('phase', v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">すべて</SelectItem>
                      {phaseOptions.map(p => (
                        <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* CSM担当 */}
              {ownerOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">担当</span>
                  <Select value={filters.owner || '__all__'} onValueChange={v => setFilter('owner', v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">すべて</SelectItem>
                      {ownerOptions.map(o => (
                        <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* コミュニケーション空白 */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">空白</span>
                <Select value={filters.commBlank || '__all__'} onValueChange={v => setFilter('commBlank', v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="warning">30日以上</SelectItem>
                    <SelectItem value="risk">60日以上</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />Summary
                </span>
                <Select value={filters.freshness || '__all__'} onValueChange={v => setFilter('freshness', v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="missing">未生成</SelectItem>
                    <SelectItem value="stale">要更新</SelectItem>
                    <SelectItem value="fresh">最新</SelectItem>
                    <SelectItem value="locked">承認済</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Support Critical */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Headphones className="w-3 h-3" />Support
                </span>
                <Select value={filters.supportCrit || '__all__'} onValueChange={v => setFilter('supportCrit', v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="yes">Critical あり</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 gap-1" onClick={resetFilters}>
                  <X className="w-3 h-3" />リセット
                </Button>
              )}
            </div>
          )}

          {/* ── アクティブフィルターチップ ────────────────────────────── */}
          {hasActiveFilters && (
            <div className="px-6 py-2 border-b border-slate-100 bg-white flex flex-wrap items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-slate-400 mr-1">絞り込み中:</span>
              {filters.health && (
                <span className="flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  Health: {filters.health}
                  <button onClick={() => setFilter('health', '')} className="hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filters.phase && (
                <span className="flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  フェーズ: {filters.phase}
                  <button onClick={() => setFilter('phase', '')} className="hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filters.owner && (
                <span className="flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  担当: {filters.owner}
                  <button onClick={() => setFilter('owner', '')} className="hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filters.commBlank && (
                <span className="flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  空白: {filters.commBlank === 'warning' ? '30日以上' : '60日以上'}
                  <button onClick={() => setFilter('commBlank', '')} className="hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filters.freshness && (
                <span className="flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  Summary: {filters.freshness}
                  <button onClick={() => setFilter('freshness', '')} className="hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filters.supportCrit && (
                <span className="flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  Support: Critical あり
                  <button onClick={() => setFilter('supportCrit', '')} className="hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              <button
                onClick={resetFilters}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline ml-1"
              >
                すべて解除
              </button>
            </div>
          )}

          {/* ── エラー ────────────────────────────────────────────────── */}
          {loadError && (
            <AlertBox variant="error" className="mx-6 mt-4 flex-shrink-0">
              <span className="flex items-center justify-between gap-2 w-full">
                {loadError}
                <Button variant="ghost" size="sm" className="h-6 text-xs flex-shrink-0" onClick={() => load()}>再試行</Button>
              </span>
            </AlertBox>
          )}

          {/* ── Section C: カード一覧 ──────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {displayed === null ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Building2 className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">
                  {segment !== 'all' || hasActiveFilters
                    ? '条件に一致する企業がありません'
                    : '企業データがありません'}
                </p>
                {(segment !== 'all' || hasActiveFilters) && (
                  <button
                    className="mt-2 text-xs text-blue-500 hover:underline"
                    onClick={() => { setSegment('all'); resetFilters(); }}
                  >
                    フィルタをリセット
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {displayed.map(item => (
                  <CompanyCard key={item.companyUid} item={item} segment={segment} />
                ))}
                {displayed.length >= 500 && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    表示上限（500件）に達しています
                  </p>
                )}
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
