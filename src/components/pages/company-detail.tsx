"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { SummaryStateBadge } from "@/components/summary/summary-state-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building,
  User,
  Users,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Headphones,
  FolderOpen,
  Calendar,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Database,
  CheckCircle2,
  Lock,
  Loader2,
  ExternalLink,
  Zap,
  Clock,
  Plus,
  ShieldAlert,
  Star,
  ChevronDown,
  ChevronRight,
  Search,
  XCircle,
  ListTodo,
  Unplug,
} from "lucide-react";

import type { CompanyDetailApiResponse } from "@/lib/company/company-vm";
import type { CompanyEvidenceSummaryApiResponse } from "@/lib/prompts/company-evidence-summary";
import type { AppCompanySummaryState } from "@/lib/nocodb/types";
import {
  buildCompanySummaryViewModel,
  SUMMARY_FRESHNESS_CONFIG,
} from "@/lib/company/company-summary-state-policy";
import { getHealthBadge, HEALTH_BADGE, RISK_SEVERITY_BADGE, PROJECT_STATUS_BADGE } from "@/lib/company/badges";
import type { RiskSignal, OpportunitySignal } from "@/lib/company/health-signal";
import type { ProjectItemVM } from "@/lib/company/project-aggregate";
import type { CommunicationEntry } from "@/lib/company/communication-signal";
import type { AppAlert, AppSupportCase, AppCseTicket, AppPerson } from "@/lib/nocodb/types";
import type {
  ContactCandidate,
  ContactCandidatesResult,
  ContactCandidateAction,
  ContactCandidateSource,
} from "@/lib/company/contact-candidate";
import { ActionCreateDialog }  from "@/components/company/action-create-dialog";
import { SfTodoDialog }        from "@/components/company/sf-todo-dialog";
import type { SfTodoCreateResult } from "@/app/api/company/[companyUid]/sf-todos/route";
import type { SfContactSyncResult } from "@/app/api/company/[companyUid]/sf-contacts/sync/route";
import type { SalesforceContactSyncResult, ContactSyncItemResult } from "@/lib/salesforce/salesforce-contact-adapter";
import { ContactFormDialog }   from "@/components/company/contact-form-dialog";
import {
  getRiskSignalCTA,
  getOpportunitySignalCTA,
  type SignalCTASpec,
} from "@/lib/company/signal-cta-helper";
import {
  type ActionSourceType,
  type ActionStatus,
  type LocalAction,
  ACTION_STATUS_BADGE,
  ACTION_CREATED_FROM_LABEL,
} from "@/lib/company/action-vm";
import {
  MANUAL_PREFILL,
  buildRiskSignalPrefill,
  buildOpportunitySignalPrefill,
  buildOrgPersonPrefill,
  buildPeopleRiskPrefill,
  type ActionPrefillConfig,
} from "@/lib/company/action-prefill-helper";
import {
  groupActionsByStatus,
  type CompanyActionVM,
} from "@/lib/company/company-action-vm";
import {
  buildOrgChartVM,
  type OrgChartVM,
  type OrgLayer,
  type OrgPersonVM,
  type OrgTreeNode,
  type TouchpointAge,
} from "@/lib/company/org-chart-vm";
import { mergeCompanyPeople } from "@/lib/company/company-people-merge";

// ── Helper types ──────────────────────────────────────────────────────────────

interface RiskItem        { title: string; description: string }
interface OpportunityItem { title: string; description: string }

function parseItems(arr: unknown[]): RiskItem[] {
  return (arr ?? []).flatMap(item => {
    if (typeof item !== 'object' || !item) return [];
    const o = item as Record<string, unknown>;
    return [{ title: String(o.title ?? ''), description: String(o.description ?? '') }];
  });
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

const ROUTING_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  unassigned:          { label: '未割当',       cls: 'bg-red-50 text-red-700 border-red-200' },
  triaged:             { label: 'トリアージ済',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  assigned:            { label: '担当者割当',    cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  'in progress':       { label: '対応中',        cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'waiting on customer': { label: '顧客確認待', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  'waiting on cse':    { label: 'CSE待ち',       cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const CSE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open:              { label: 'Open',        cls: 'bg-red-50 text-red-700 border-red-200' },
  in_progress:       { label: '対応中',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  waiting_customer:  { label: '顧客確認待',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved:          { label: '解決済',      cls: 'bg-green-50 text-green-700 border-green-200' },
  closed:            { label: 'Closed',      cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const COMM_SOURCE_ICON: Record<string, React.ReactNode> = {
  chatwork:      <MessageSquare className="w-3 h-3 text-indigo-500 flex-shrink-0" />,
  slack:         <MessageSquare className="w-3 h-3 text-sky-500 flex-shrink-0" />,
  notion_minutes:<Calendar className="w-3 h-3 text-purple-500 flex-shrink-0" />,
};

const COMM_SOURCE_LABEL: Record<string, string> = {
  chatwork:      'Chatwork',
  slack:         'Slack',
  notion_minutes:'議事録',
};

function SeverityDot({ severity }: { severity: string }) {
  const s = (severity ?? '').toLowerCase();
  const cls = s === 'critical' ? 'bg-red-500'
    : s === 'high'    ? 'bg-orange-500'
    : s === 'medium'  ? 'bg-amber-400'
    : 'bg-slate-400';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}

function PhaseSourceChip({ source }: { source: 'CSM' | 'CRM' | null }) {
  if (!source) return null;
  const cls = source === 'CSM'
    ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
    : 'bg-purple-50 text-purple-600 border-purple-200';
  return (
    <Badge variant="outline" className={`text-[10px] py-0 ${cls}`}>{source}</Badge>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// /api/company/[companyUid] はUIルートのため checkBatchAuth 不要。
// ただし既存の ops / batch ルートは Bearer が必要なため、ここでトークンを保持しておく。
const BATCH_TOKEN = process.env.NEXT_PUBLIC_SUPPORT_BATCH_SECRET ?? '';

export function CompanyDetail() {
  const params = useParams();
  const companyId = params.companyUid as string;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [detail, setDetail]         = useState<CompanyDetailApiResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);

  // savedRecord: Detail API 初期値 → save/review 操作後は override で更新
  const [savedRecordOverride, setSavedRecordOverride] = useState<AppCompanySummaryState | null | undefined>(undefined);

  // ── Summary sheet state ───────────────────────────────────────────────────
  const [showSummarySheet,     setShowSummarySheet]     = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [summaryLoading,       setSummaryLoading]       = useState(false);
  const [summarySaving,        setSummarySaving]        = useState(false);
  const [summaryReviewing,     setSummaryReviewing]     = useState(false);
  const [summaryResult,        setSummaryResult]        = useState<CompanyEvidenceSummaryApiResponse | null>(null);
  const [summaryError,         setSummaryError]         = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,  setActiveTab]  = useState("overview");

  // ── Dialog states ─────────────────────────────────────────────────────────
  const [actionDialogOpen,    setActionDialogOpen]    = useState(false);
  const [actionDialogConfig,  setActionDialogConfig]  = useState<ActionPrefillConfig>(MANUAL_PREFILL);
  const [sfTodoDialogOpen,    setSfTodoDialogOpen]    = useState(false);
  const [sfTodoDialogConfig,  setSfTodoDialogConfig]  = useState<{
    prefillTitle?:      string;
    relatedSignalId?:   string;
    relatedSignalRef?:  string;
    /** CXM Action ID（ActionRow から起票した場合。結果受信後に sfTodoStatus を更新） */
    relatedActionId?:   string;
    /** NocoDB row Id（PATCH 永続化用） */
    relatedActionRowId?: number;
  }>({});
  const [contactDialogOpen,   setContactDialogOpen]   = useState(false);
  const [contactDialogPerson, setContactDialogPerson] = useState<AppPerson | undefined>();
  // ── State sync strategy（List ↔ Detail 整合メモ） ────────────────────────
  //
  // 【Detail 内再計算】
  //   Action / Contact の CRUD は Optimistic Update で localActions / localContacts を
  //   即時更新し、API 成功後に rowId を付与する確定更新を行う（2フェーズ更新）。
  //   派生 UI（openActionCount バッジ等）は localActions をもとに memo で再計算される。
  //
  // 【再訪時の API 再取得】
  //   PeopleTab / ActionsTab の初回マウント時に /api/company/[uid]/people・/actions を
  //   fetch して localContacts / localActions を上書きする（actionsLoaded / contactsLoaded
  //   フラグで 1 回のみ）。Detail ページを離れて戻ると再 mount → 再取得が走る。
  //
  // 【List 側の source of truth】
  //   Company List の priorityScore は companies テーブルの open_action_count
  //   および fetchPeopleSignalsByUids の dmCount を参照する（バッチ更新値）。
  //   Detail で Action / Contact を追加しても、companies テーブルが更新されるまで
  //   List の score には反映されない（eventual consistency）。
  //   hasStaleDm / hasOverdueActions は List では常に false（近似値）。
  //   → Detail 側が常に最新。List は次回バッチ実行後に正確化する。
  //
  // 【完全な cross-page 同期は未実装】
  //   Detail で変更後 List へ戻っても List の score はリアルタイム更新されない。
  //   必要になれば: onCreated/onSaved 時に /api/company-summary-list へ invalidate
  //   のための revalidateTag or router.refresh() を追加する。
  const [localContacts,       setLocalContacts]       = useState<AppPerson[]>([]);
  const [contactsLoaded,      setContactsLoaded]      = useState(false);
  const [localActions,        setLocalActions]        = useState<LocalAction[]>([]);
  const [actionsLoaded,       setActionsLoaded]       = useState(false);

  // ── Communication tab full log ────────────────────────────────────────────
  const [commFullEntries, setCommFullEntries] = useState<CommunicationEntry[] | null>(null);
  const [commFullLoading, setCommFullLoading] = useState(false);

  // ── Org chart VM (component-level, shared between Overview people risk + PeopleTab) ──
  // mergeCompanyPeople で dedupe する:
  //   sfContacts  = detail.people.contacts（Salesforce 同期 / people テーブル由来）
  //   cxmContacts = localContacts（company_people テーブル由来 / CXM 追加分）
  const allContacts = useMemo(() => mergeCompanyPeople(
    detail?.people?.contacts ?? [],
    localContacts,
  ), [localContacts, detail]);
  const orgVM = useMemo(() => buildOrgChartVM(allContacts), [allContacts]);

  // ── Derived summary values ────────────────────────────────────────────────
  const savedRecord = savedRecordOverride !== undefined
    ? savedRecordOverride
    : (detail?.summary?.state ?? null);
  const summaryVM   = buildCompanySummaryViewModel(savedRecord);
  const summaryBusy = summaryLoading || summarySaving || summaryReviewing;

  // ── Data fetch ────────────────────────────────────────────────────────────
  // /api/company/[companyUid] は UI向けルート（Bearer 認証不要）
  // TODO: サーバーサイドフェッチ or SWR に移行してクライアント再計算を減らすこと
  const loadDetail = useCallback((refresh = false) => {
    if (!companyId) return;
    if (!refresh) setLoading(true);
    setLoadError(null);
    fetch(`/api/company/${companyId}`)
      .then(r => {
        if (r.status === 401) throw new Error('company詳細API: 認証エラー（SUPPORT_BATCH_SECRET の設定を確認）');
        if (r.status === 404) throw new Error(`company詳細API: 企業が見つかりません (uid: ${companyId})`);
        if (!r.ok) return r.json().then((e: { error?: string }) => Promise.reject(`company詳細API: ${e.error ?? `HTTP ${r.status}`}`));
        return r.json();
      })
      .then((data: CompanyDetailApiResponse) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(String(err));
        setLoading(false);
      });
  }, [companyId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // ── Actions 初期ロード ────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId || actionsLoaded) return;
    fetch(`/api/company/${companyId}/actions`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { actions: LocalAction[] } | null) => {
        if (data?.actions) setLocalActions(data.actions);
      })
      .catch(() => { /* silent — fallback to empty */ })
      .finally(() => setActionsLoaded(true));
  }, [companyId, actionsLoaded]);

  // ── Contacts (CXM マネージド) 初期ロード ─────────────────────────────────
  // NOCODB_COMPANY_PEOPLE_TABLE_ID 未設定時は空配列が返り、UI は壊れない。
  useEffect(() => {
    if (!companyId || contactsLoaded) return;
    fetch(`/api/company/${companyId}/people`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { people: AppPerson[] } | null) => {
        if (data?.people) setLocalContacts(data.people);
      })
      .catch(() => { /* silent — fallback to empty */ })
      .finally(() => setContactsLoaded(true));
  }, [companyId, contactsLoaded]);

  async function refreshSavedRecord() {
    try {
      const res  = await fetch(`/api/company/${companyId}/summary`);
      const data = await res.json() as { record: AppCompanySummaryState | null };
      setSavedRecordOverride(data.record ?? null);
    } catch { /* silent */ }
  }

  // ── Summary operations ────────────────────────────────────────────────────

  async function generateCompanySummary() {
    setSummaryLoading(true); setSummaryError(null); setShowSummarySheet(true);
    try {
      const res = await fetch(`/api/company/${companyId}/summary`, { method: 'POST' });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      setSummaryResult(await res.json() as CompanyEvidenceSummaryApiResponse);
    } catch (e) { setSummaryError(e instanceof Error ? e.message : String(e)); }
    finally { setSummaryLoading(false); }
  }

  async function handleRegenerate() {
    setSummaryLoading(true); setSummaryError(null); setShowSummarySheet(true);
    try {
      const res = await fetch(`/api/company/${companyId}/summary/regenerate`, { method: 'POST' });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string; message?: string }).message ?? `HTTP ${res.status}`);
      setSummaryResult(await res.json() as CompanyEvidenceSummaryApiResponse);
      await refreshSavedRecord();
    } catch (e) { setSummaryError(e instanceof Error ? e.message : String(e)); }
    finally { setSummaryLoading(false); }
  }

  async function handleSave() {
    if (!summaryResult) return;
    setSummarySaving(true); setSummaryError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/summary/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary:                 summaryResult.summary,
          overall_health:          summaryResult.overall_health,
          key_risks:               summaryResult.key_risks,
          key_opportunities:       summaryResult.key_opportunities,
          recommended_next_action: summaryResult.recommended_next_action,
          model:                   summaryResult.model,
          generated_at:            summaryResult.generated_at,
          evidence_count:          summaryResult.evidence_count,
          alert_count:             summaryResult.alert_count,
          people_count:            summaryResult.people_count,
        }),
      });
      const data = await res.json() as { saved: boolean; created: boolean; save_error?: string };
      if (data.saved) {
        setSummaryResult({ ...summaryResult, saved: true, created: data.created });
        await refreshSavedRecord();
      } else {
        setSummaryError(data.save_error ?? '保存に失敗しました');
      }
    } catch (e) { setSummaryError(e instanceof Error ? e.message : String(e)); }
    finally { setSummarySaving(false); }
  }

  async function handleReview(status: 'reviewed' | 'approved') {
    setSummaryReviewing(true); setSummaryError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/summary/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      await refreshSavedRecord();
    } catch (e) { setSummaryError(e instanceof Error ? e.message : String(e)); }
    finally { setSummaryReviewing(false); }
  }

  async function handleDowngrade() {
    setSummaryReviewing(true); setSummaryError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/summary/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reviewed' }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      await refreshSavedRecord();
    } catch (e) { setSummaryError(e instanceof Error ? e.message : String(e)); }
    finally { setSummaryReviewing(false); setShowDowngradeConfirm(false); }
  }

  // ── Dialog openers ───────────────────────────────────────────────────────
  function openActionDialog(cfg: ActionPrefillConfig = MANUAL_PREFILL) {
    setActionDialogConfig(cfg);
    setActionDialogOpen(true);
  }

  function openSfTodoDialog(config: {
    prefillTitle?:       string;
    relatedSignalId?:    string;
    relatedSignalRef?:   string;
    relatedActionId?:    string;
    relatedActionRowId?: number;
  }) {
    setSfTodoDialogConfig(config);
    setSfTodoDialogOpen(true);
  }

  /** SF ToDo 作成結果を受け取り Action の sfTodoStatus / sfTodoId を更新する */
  async function handleSfTodoResult(result: SfTodoCreateResult) {
    // dry-run は Action の状態を変更しない（SF Task は未作成のため）
    if (result.mode === 'dry_run') return;

    const actionId = result.actionId;
    if (!actionId) return;  // Action と無関係な起票は何もしない

    const action = localActions.find(a => a.id === actionId);
    if (!action) return;

    const newStatus      = result.ok ? 'synced' as const : 'sync_error' as const;
    const newSfTodoId    = result.ok ? result.sfTodoId : null;
    const newSyncedAt    = result.ok && result.mode === 'created' ? result.syncedAt : null;

    // Optimistic update
    setLocalActions(prev => prev.map(a =>
      a.id === actionId
        ? { ...a, sfTodoStatus: newStatus, ...(newSfTodoId ? { sfTodoId: newSfTodoId } : {}) }
        : a,
    ));

    // Persist（rowId がある場合のみ）
    const rowId = sfTodoDialogConfig.relatedActionRowId ?? action.rowId;
    if (rowId) {
      try {
        await fetch(`/api/company/${companyId}/actions/${actionId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowId,
            sf_todo_status:   newStatus,
            ...(newSfTodoId  ? { sf_todo_id:        newSfTodoId  } : {}),
            ...(newSyncedAt  ? { sf_last_synced_at: newSyncedAt  } : {}),
          }),
        });
      } catch { /* silent — optimistic update は保持 */ }
    }
  }

  // ── Communication tab lazy-load ───────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'communication' || commFullEntries !== null || commFullLoading) return;
    setCommFullLoading(true);
    fetch(`/api/companies/${companyId}/log`)
      .then(r => r.json())
      .then((data: { commEntries: CommunicationEntry[] }) => {
        setCommFullEntries(data.commEntries ?? []);
      })
      .catch(() => {})
      .finally(() => setCommFullLoading(false));
  }, [activeTab, companyId, commFullEntries, commFullLoading]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <SidebarNav />
        <div className="flex-1 flex flex-col overflow-hidden">
          <GlobalHeader />
          <main className="flex-1 p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
          </main>
        </div>
      </div>
    );
  }

  const company     = detail?.company;
  const phase       = detail?.phase;
  const health      = detail?.health;
  const comm        = detail?.communication;
  const projects    = detail?.projects;
  const support     = detail?.support;
  const people      = detail?.people;
  const policyAlerts: AppAlert[] = (detail?.alerts ?? []).filter(
    a => a.source?.startsWith('policy:'),
  );
  const healthBadge = getHealthBadge(health?.overallHealth);

  const supportTabLabel = support
    ? `Support (${support.openIntercomCount + support.openCseCount})`
    : 'Support';
  const projectTabLabel = projects
    ? `Projects (${projects.total})`
    : 'Projects';
  // allContacts はマージ後の最新リストなので件数ソースとして使う
  const peopleTabLabel = `People (${allContacts.length > 0 ? allContacts.length : (people?.count ?? 0)})`;

  // ── Header derived values ─────────────────────────────────────────────────
  const openActionCount    = localActions.filter(a => a.status === 'open' || a.status === 'in_progress').length;
  const today = new Date(); today.setHours(0,0,0,0);
  const overdueActionCount = localActions.filter(a =>
    (a.status === 'open' || a.status === 'in_progress') && a.dueDate && new Date(a.dueDate) < today,
  ).length;
  const openSupportCount   = support ? (support.openIntercomCount + support.openCseCount) : 0;
  const hasCriticalSupport = support ? (support.openIntercomCount + support.openCseCount) > 0 : false;

  // last contact: communication の最終エントリ日付（dateStr フィールド）
  const lastContactDate = comm?.recentEntries?.[0]?.dateStr ?? null;
  const lastContactDays = lastContactDate
    ? Math.floor((Date.now() - new Date(lastContactDate).getTime()) / 86_400_000)
    : null;

  // people risk
  const peopleRiskCount = orgVM.peopleRisks.length;

  // org relation coverage: reports_to が設定されている人の割合
  const peopleCount       = orgVM.persons.length;
  const reportsToCount    = orgVM.persons.filter(p => p.raw.reportsToPersonId).length;
  const worksWithCount    = orgVM.persons.filter(p => p.worksWithPersonIds.length > 0).length;
  const relationCoverage  = peopleCount > 0 ? Math.round(reportsToCount / peopleCount * 100) : null;

  // SF linked
  const hasSfAccount      = !!company?.sfAccountId;
  const sfAccountFallback = !hasSfAccount;  // companyUid を fallback 使用中

  // summary freshness
  const summaryIsMissing = !summaryVM.hasSummary;
  const summaryIsStale   = summaryVM.hasSummary && summaryVM.freshnessStatus === 'stale';

  // alert items for alert strip
  type AlertItem = { key: string; level: 'error' | 'warn' | 'info'; label: string; action?: () => void; actionLabel?: string };
  const alertItems: AlertItem[] = [];
  if (loadError) {
    alertItems.push({ key: 'load', level: 'error', label: `Company 詳細の取得に失敗しました: ${loadError}`, action: () => loadDetail(), actionLabel: '再試行' });
  }
  if (sfAccountFallback && company) {
    alertItems.push({ key: 'sf_fallback', level: 'warn', label: 'sf_account_id 未設定。SF同期は companyUid で代替中（SF連携が不完全）' });
  }
  if (summaryIsStale) {
    alertItems.push({ key: 'summary_stale', level: 'info', label: 'AI Summary が古くなっています（30日以上）', action: () => handleRegenerate(), actionLabel: '再生成' });
  }
  if (localActions.some(a => a.sfTodoStatus === 'sync_error')) {
    alertItems.push({ key: 'sf_task_error', level: 'warn', label: 'SF Task の同期エラーがあります。Actions タブで確認してください' });
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-hidden flex flex-col">

          {/* ════════════════════════════════════════════════════════════════
              DECISION HEADER — 3層構成
              Layer 1: 会社識別 + 主要状態 + 優先度付き CTA
              Layer 2: Quick Stats（判断に必要な数値を一覧）
              Layer 3: Alert Strip（文脈付き警告）
          ════════════════════════════════════════════════════════════════ */}
          <div className="bg-white border-b flex-shrink-0">

            {/* ── Layer 1: 識別 + 状態バッジ + CTA ──────────────────────── */}
            <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-4">
              {/* Left: Company identity + status */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Building className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <h1 className="font-semibold text-slate-900 truncate text-sm">
                  {company?.name ?? (
                    loadError
                      ? <span className="text-red-400 font-normal text-xs">会社情報未取得</span>
                      : <span className="text-slate-400 font-normal text-xs">読み込み中…</span>
                  )}
                </h1>
                {/* Phase — クリックで Overview へ */}
                {phase?.primaryPhaseLabel && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1 flex-shrink-0 cursor-pointer"
                          onClick={() => setActiveTab('overview')}
                        >
                          <Badge variant="outline" className={`text-[10px] py-0 flex-shrink-0 ${
                            phase.hasGap
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : phase.isStagnant
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {phase.primaryPhaseLabel}
                          </Badge>
                          <PhaseSourceChip source={phase.primarySource} />
                          {phase.hasGap && (
                            <span className="text-[9px] text-amber-600 font-medium flex items-center gap-0.5 flex-shrink-0">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {phase.gapDescription}
                            </span>
                          )}
                          {phase.isStagnant && phase.stagnationDays !== null && (
                            <span className="text-[9px] text-orange-500 font-medium flex-shrink-0">
                              停滞{phase.stagnationDays}d
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="text-xs max-w-xs">
                        <div className="space-y-1">
                          <div className="font-medium">{phase.primarySource} Phase: {phase.primaryPhaseLabel}</div>
                          {phase.isComparable && phase.secondaryPhaseLabel && (
                            <div className="text-slate-500">{phase.secondarySource}: {phase.secondaryPhaseLabel}</div>
                          )}
                          {phase.hasGap && phase.gapDescription && (
                            <div className="text-amber-600">⚠ フェーズ差分: {phase.gapDescription}</div>
                          )}
                          {phase.isStagnant && phase.stagnationDays !== null && (
                            <div className="text-orange-600">{phase.stagnationDays}日間フェーズ変化なし</div>
                          )}
                          <div className="text-slate-400 text-[10px] pt-0.5">クリックで Overview を表示</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* Health — dominant signal tooltip */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={`text-[10px] py-0 flex-shrink-0 cursor-default ${healthBadge.className}`}>
                        {healthBadge.label}
                      </Badge>
                    </TooltipTrigger>
                    {(health?.riskSignals?.length ?? 0) > 0 && (
                      <TooltipContent side="bottom" align="start" className="text-xs max-w-xs">
                        <div className="space-y-1">
                          <div className="font-medium">主要リスク</div>
                          {health!.riskSignals.slice(0, 3).map(s => (
                            <div key={s.id} className="text-slate-300">{s.title}</div>
                          ))}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                {/* Summary state */}
                <button
                  type="button"
                  className="focus:outline-none flex-shrink-0"
                  onClick={() => summaryVM.hasSummary ? setShowSummarySheet(true) : undefined}
                  title={summaryVM.hasSummary ? SUMMARY_FRESHNESS_CONFIG[summaryVM.freshnessStatus].description : undefined}
                >
                  <SummaryStateBadge vm={summaryVM} variant="inline" />
                </button>
                {/* SF linked chip */}
                {hasSfAccount ? (
                  <span className="text-[10px] flex items-center gap-0.5 text-sky-600 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5 flex-shrink-0">
                    <ExternalLink className="w-2.5 h-2.5" />SF
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 flex-shrink-0"
                    title="sf_account_id 未設定">
                    SF未設定
                  </span>
                )}
                {/* Owner */}
                {company?.owner && (
                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5 flex-shrink-0">
                    <User className="w-2.5 h-2.5" />{company.owner}
                  </span>
                )}
              </div>

              {/* Right: CTA 優先順位付き */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Primary: Action作成（最優先・solid） */}
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 bg-slate-800 hover:bg-slate-700 text-white"
                  onClick={() => openActionDialog(MANUAL_PREFILL)}
                >
                  <Plus className="w-3 h-3" />Action作成
                </Button>

                {/* Secondary group: SF ToDo + 連絡先追加（outline） */}
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => openSfTodoDialog({})}
                >
                  <ExternalLink className="w-3 h-3" />SF ToDo
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => { setContactDialogPerson(undefined); setContactDialogOpen(true); }}
                >
                  <Users className="w-3 h-3" />連絡先追加
                </Button>

                {/* AI Summary — missing/stale 時は amber 強調、それ以外は ghost */}
                <Button
                  variant={summaryIsMissing || summaryIsStale ? 'outline' : 'ghost'}
                  size="sm"
                  className={`h-7 text-xs gap-1 ${
                    summaryIsMissing ? 'border-amber-300 text-amber-700 hover:bg-amber-50' :
                    summaryIsStale   ? 'border-amber-200 text-amber-600 hover:bg-amber-50' :
                    'text-slate-400'
                  }`}
                  onClick={() => summaryVM.hasSummary ? setShowSummarySheet(true) : generateCompanySummary()}
                  disabled={summaryBusy}
                  title={summaryVM.hasSummary ? SUMMARY_FRESHNESS_CONFIG[summaryVM.freshnessStatus].description : 'AI Summary を生成'}
                >
                  {summaryBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {summaryIsMissing ? 'Summary生成' : summaryIsStale ? 'Summary更新' : 'Summary'}
                </Button>

                {/* Tertiary: Unified Log（ghost小） */}
                <Link href={`/companies/${companyId}/log`}>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-slate-400 px-2">
                    Log
                  </Button>
                </Link>
              </div>
            </div>

            {/* ── Layer 2: Quick Stats ────────────────────────────────────── */}
            <div className="px-5 pb-2 flex items-center gap-5 flex-wrap text-[10px]">
              {/* Open Actions */}
              <span className={`flex items-center gap-1 ${overdueActionCount > 0 ? 'text-red-600 font-semibold' : openActionCount > 0 ? 'text-slate-600' : 'text-slate-400'}`}
                title={overdueActionCount > 0 ? `期限超過 ${overdueActionCount}件含む` : undefined}
              >
                <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                Action {openActionCount}
                {overdueActionCount > 0 && <span className="text-red-500 ml-0.5">({overdueActionCount}超過)</span>}
              </span>

              {/* Support */}
              <span className={`flex items-center gap-1 ${hasCriticalSupport ? 'text-orange-600 font-semibold' : 'text-slate-400'}`}
                title="Open Support チケット数"
              >
                <MessageSquare className="w-3 h-3 flex-shrink-0" />
                Support {openSupportCount}
              </span>

              {/* Last Contact */}
              <span className={`flex items-center gap-1 ${lastContactDays !== null && lastContactDays > 30 ? 'text-amber-600' : 'text-slate-400'}`}
                title={lastContactDate ? `最終コンタクト: ${lastContactDate}` : '記録なし'}
              >
                <Clock className="w-3 h-3 flex-shrink-0" />
                {lastContactDays !== null ? `${lastContactDays}日前` : 'コンタクト記録なし'}
              </span>

              <span className="text-slate-200">|</span>

              {/* People risk */}
              <span className={`flex items-center gap-1 ${peopleRiskCount > 0 ? 'text-rose-500 font-medium' : 'text-slate-400'}`}
                title={`People リスク: ${orgVM.peopleRisks.map(r => r.label).join(' / ')}`}
              >
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                People risk {peopleRiskCount}
              </span>

              {/* Org relation coverage */}
              {peopleCount > 0 && (
                <span className={`flex items-center gap-1 ${relationCoverage !== null && relationCoverage < 50 ? 'text-amber-500' : 'text-slate-400'}`}
                  title={`reports_to 設定: ${reportsToCount}/${peopleCount}名 / works_with 設定: ${worksWithCount}名`}
                >
                  <Users className="w-3 h-3 flex-shrink-0" />
                  Relation {reportsToCount}/{peopleCount}
                  {worksWithCount > 0 && <span className="text-indigo-400 ml-0.5">⇌{worksWithCount}</span>}
                </span>
              )}

              <span className="text-slate-200">|</span>

              {/* SF sync state */}
              <span className={`flex items-center gap-1 ${!hasSfAccount ? 'text-slate-400' : 'text-sky-500'}`}
                title={hasSfAccount ? `SF Account ID: ${company?.sfAccountId}` : 'sf_account_id 未設定'}
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                {hasSfAccount ? `SF: ${company?.sfAccountId?.slice(0, 10)}…` : 'SF未連携'}
              </span>
            </div>

            {/* ── Layer 3: Alert Strip（文脈付き警告） ───────────────────── */}
            {alertItems.length > 0 && (
              <div className="border-t border-slate-100">
                {alertItems.map(item => (
                  <div key={item.key} className={`px-5 py-1 flex items-center gap-2 text-[10px] ${
                    item.level === 'error' ? 'bg-red-50 text-red-700 border-b border-red-100' :
                    item.level === 'warn'  ? 'bg-amber-50 text-amber-700 border-b border-amber-100' :
                    'bg-sky-50 text-sky-700 border-b border-sky-100'
                  }`}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span>{item.label}</span>
                    {item.action && item.actionLabel && (
                      <button className="ml-1 underline font-medium" onClick={item.action}>
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              TABS
          ════════════════════════════════════════════════════════════════ */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <TabsList className="flex-shrink-0 bg-white border-b rounded-none h-9 px-5 justify-start gap-0 p-0">
              <TabsTrigger value="overview"
                className="text-xs h-9 px-3 rounded-none border-b-2 border-transparent bg-transparent shadow-none
                  data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  text-slate-500 hover:text-slate-700">
                Overview
              </TabsTrigger>
              <TabsTrigger value="actions"
                className="text-xs h-9 px-3 rounded-none border-b-2 border-transparent bg-transparent shadow-none
                  data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  text-slate-500 hover:text-slate-700">
                Actions
                {localActions.filter(a => a.status === 'open' || a.status === 'in_progress').length > 0 && (
                  <span className="ml-1 text-[9px] bg-blue-100 text-blue-700 rounded-full px-1 py-0">
                    {localActions.filter(a => a.status === 'open' || a.status === 'in_progress').length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="support"
                className="text-xs h-9 px-3 rounded-none border-b-2 border-transparent bg-transparent shadow-none
                  data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  text-slate-500 hover:text-slate-700">
                {supportTabLabel}
              </TabsTrigger>
              <TabsTrigger value="projects"
                className="text-xs h-9 px-3 rounded-none border-b-2 border-transparent bg-transparent shadow-none
                  data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  text-slate-500 hover:text-slate-700">
                {projectTabLabel}
              </TabsTrigger>
              <TabsTrigger value="communication"
                className="text-xs h-9 px-3 rounded-none border-b-2 border-transparent bg-transparent shadow-none
                  data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  text-slate-500 hover:text-slate-700">
                Communication
              </TabsTrigger>
              <TabsTrigger value="people"
                className="text-xs h-9 px-3 rounded-none border-b-2 border-transparent bg-transparent shadow-none
                  data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  text-slate-500 hover:text-slate-700">
                {peopleTabLabel}
              </TabsTrigger>
            </TabsList>

            {/* ── Overview tab ── */}
            <TabsContent value="overview" className="flex-1 overflow-hidden m-0">
              <div className="h-full overflow-auto p-4 space-y-3">

                {/* ════ A: 現在地 ════════════════════════════════════════════ */}
                <section className="bg-white border rounded-lg p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">現在地</p>
                  <div className="flex items-start gap-5 flex-wrap">

                    {/* Phase */}
                    <div className="space-y-1 min-w-[90px]">
                      <p className="text-[10px] text-slate-400">Phase</p>
                      {phase?.primaryPhaseLabel ? (
                        <div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{phase.primaryPhaseLabel}</span>
                            <PhaseSourceChip source={phase.primarySource} />
                          </div>
                          {phase.isComparable && phase.secondaryPhaseLabel && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {phase.secondarySource}: {phase.secondaryPhaseLabel}
                              {phase.hasGap && <span className="text-amber-600 ml-1">⚠ 差分</span>}
                            </p>
                          )}
                          {phase.isStagnant && phase.stagnationDays !== null && (
                            <p className="text-[10px] text-orange-500 mt-0.5">{phase.stagnationDays}日間停滞</p>
                          )}
                          {phase.primaryOwner && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{phase.primaryOwner}</p>
                          )}
                          {phase.daysUntilRenewal !== null && (
                            <p className={`text-[10px] mt-0.5 ${phase.daysUntilRenewal < 60 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                              更新まで {phase.daysUntilRenewal}日
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">未設定</span>
                      )}
                    </div>

                    <div className="w-px bg-slate-200 self-stretch flex-shrink-0" />

                    {/* Health */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-400">Health</p>
                      <Badge variant="outline" className={`text-xs ${healthBadge.className}`}>
                        {healthBadge.label}
                      </Badge>
                      {/* dominant signal — At Risk / Critical の根拠を 1 行表示 */}
                      {(health?.riskSignals?.length ?? 0) > 0 && (
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          {health!.riskSignals[0].title}
                          {health!.riskSignals.length > 1 && (
                            <span className="text-slate-400"> +{health!.riskSignals.length - 1}</span>
                          )}
                        </p>
                      )}
                      {savedRecord?.overallHealth && savedRecord.overallHealth !== health?.overallHealth && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          AI: {getHealthBadge(savedRecord.overallHealth).label}
                        </p>
                      )}
                    </div>

                    <div className="w-px bg-slate-200 self-stretch flex-shrink-0" />

                    {/* AI Summary */}
                    <div className="space-y-1 flex-1 min-w-[180px]">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400">AI Summary</p>
                        {summaryVM.hasSummary && (
                          <button
                            className="text-[10px] text-violet-600 hover:underline"
                            onClick={() => setShowSummarySheet(true)}
                          >
                            詳細・レビュー →
                          </button>
                        )}
                      </div>
                      <SummaryStateBadge vm={summaryVM} record={savedRecord} variant="inline" />
                      {!summaryVM.hasSummary && (
                        <button
                          className="mt-1 text-[10px] text-violet-600 hover:text-violet-800 hover:underline flex items-center gap-0.5"
                          onClick={generateCompanySummary}
                          disabled={summaryBusy}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Evidence・Alert・People から生成 →
                        </button>
                      )}
                      {savedRecord?.aiSummary && (
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 mt-1 border-l-2 border-violet-100 pl-2">
                          {savedRecord.aiSummary}
                        </p>
                      )}
                      {/* AI 要点: Key Risks / Opportunities（各2件まで） */}
                      {(savedRecord?.keyRisks || savedRecord?.keyOpportunities) && (
                        <div className="mt-2 space-y-0.5">
                          {savedRecord.keyRisks && parseItems(savedRecord.keyRisks as unknown[]).slice(0, 2).map((r, i) => (
                            <div key={`r${i}`} className="flex items-baseline gap-1 text-[10px] text-slate-600">
                              <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0 translate-y-px" />
                              <span className="line-clamp-1">{r.title}</span>
                            </div>
                          ))}
                          {savedRecord.keyOpportunities && parseItems(savedRecord.keyOpportunities as unknown[]).slice(0, 2).map((o, i) => (
                            <div key={`o${i}`} className="flex items-baseline gap-1 text-[10px] text-slate-600">
                              <TrendingUp className="w-2.5 h-2.5 text-green-500 flex-shrink-0 translate-y-px" />
                              <span className="line-clamp-1">{o.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* ════ B: 注意が必要なこと ══════════════════════════════════ */}
                <section className="bg-white border rounded-lg p-4">
                  <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="w-3 h-3" />
                    注意が必要なこと
                  </h2>

                  {(health?.riskSignals ?? []).length === 0 && orgVM.peopleRisks.length === 0 && policyAlerts.length === 0 ? (
                    <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-3 py-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-700">現在大きなリスクシグナルはありません</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Support・People・Communication・Phase に異常は検出されていません
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">

                      {/* Health Risk signals (support-critical / comm blank / phase gap / project stalled etc.) */}
                      {(health?.riskSignals ?? []).length > 0 && (
                        <div className="space-y-2">
                          {(health?.riskSignals ?? []).map(sig => (
                            <RiskSignalRow
                              key={sig.id}
                              signal={sig}
                              onTabSwitch={setActiveTab}
                              onActionCTA={(s, cta) => openActionDialog(buildRiskSignalPrefill(s, cta))}
                              onSfTodoCTA={(s, cta) => openSfTodoDialog({
                                prefillTitle:     cta.suggestedAction,
                                relatedSignalId:  s.id,
                                relatedSignalRef: s.title,
                              })}
                            />
                          ))}
                        </div>
                      )}

                      {/* Policy-derived alerts */}
                      {policyAlerts.length > 0 && (
                        <div className="space-y-2">
                          {(health?.riskSignals ?? []).length > 0 && <Separator />}
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Policy アラート</p>
                          {policyAlerts.map(a => {
                            const dot = a.severity === 'high'
                              ? 'bg-orange-500'
                              : a.severity === 'low'
                              ? 'bg-slate-400'
                              : 'bg-amber-400';
                            return (
                              <div key={a.id} className="flex items-start gap-2 text-sm">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-slate-700 font-medium text-xs">{a.title}</span>
                                    <Badge variant="outline" className="text-[10px] py-0 border-violet-200 text-violet-600 bg-violet-50">Policy</Badge>
                                  </div>
                                  {a.description && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{a.description}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* People risks (not included in health signals) */}
                      {orgVM.peopleRisks.length > 0 && (
                        <div className="space-y-2">
                          {((health?.riskSignals ?? []).length > 0 || policyAlerts.length > 0) && <Separator />}
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">People リスク</p>
                          {orgVM.peopleRisks.map((risk, i) => {
                            const person = orgVM.persons.find(p => p.id === risk.personId);
                            return (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                                  risk.severity === 'high' ? 'bg-orange-500' : 'bg-amber-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-slate-700 font-medium">{risk.label}</span>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{risk.description}</p>
                                  {person && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <button
                                        className="text-[10px] text-indigo-600 hover:underline"
                                        onClick={() => openActionDialog(buildPeopleRiskPrefill(risk, person))}
                                      >
                                        + Action作成
                                      </button>
                                      <button
                                        className="text-[10px] text-slate-500 hover:underline"
                                        onClick={() => setActiveTab('people')}
                                      >
                                        → People
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* ════ C: 機会と次の一手 ════════════════════════════════════ */}
                <section className="bg-white border rounded-lg p-4">
                  <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" />
                    機会と次の一手
                  </h2>

                  <div className="space-y-4">
                    {/* Opportunity signals */}
                    {(health?.opportunitySignals ?? []).length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">機会シグナル</p>
                        {(health?.opportunitySignals ?? []).map(sig => (
                          <OpportunitySignalRow
                            key={sig.id}
                            signal={sig}
                            onActionCTA={(s, cta) => openActionDialog(buildOpportunitySignalPrefill(s, cta))}
                            onSfTodoCTA={(s, cta) => openSfTodoDialog({
                              prefillTitle:     cta.suggestedAction,
                              relatedSignalId:  s.id,
                              relatedSignalRef: s.title,
                            })}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">機会シグナルなし</p>
                    )}

                    {/* AI Recommended Next Action */}
                    {savedRecord?.recommendedNextAction && (
                      <>
                        {(health?.opportunitySignals ?? []).length > 0 && <Separator />}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">AI 推奨アクション</p>
                          <div className="bg-violet-50 border border-violet-100 rounded p-2.5 text-xs text-violet-800">
                            <div className="flex items-start gap-2">
                              <p className="leading-relaxed flex-1">{savedRecord.recommendedNextAction}</p>
                              <button
                                className="text-[10px] text-violet-600 hover:underline flex-shrink-0"
                                onClick={() => openActionDialog(MANUAL_PREFILL)}
                              >
                                + Action
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Summary: missing/stale → generate CTA */}
                    {(summaryIsMissing || summaryIsStale) && (
                      <>
                        <Separator />
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">AI Summary</p>
                          <div className="border border-dashed border-violet-200 rounded p-2.5">
                            <p className="text-xs text-slate-500 mb-2">
                              {summaryIsMissing
                                ? 'AI Summary 未生成。Evidence・Alert・People データを元に自動生成できます。'
                                : 'AI Summary が古くなっています（30日以上）。最新データで更新してください。'}
                            </p>
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-xs gap-1.5 border-violet-200 text-violet-700"
                              onClick={generateCompanySummary}
                              disabled={summaryBusy}
                            >
                              {summaryLoading
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Sparkles className="w-3 h-3" />
                              }
                              {summaryIsMissing ? 'AI Summary を生成' : 'Summary を更新'}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Summary: fresh/approved → review buttons */}
                    {summaryVM.hasSummary && savedRecord && !summaryIsMissing && !summaryIsStale && (
                      <>
                        <Separator />
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Summary レビュー</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {summaryVM.isApproved ? (
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs gap-1 border-amber-200 text-amber-700"
                                onClick={() => setShowDowngradeConfirm(true)}
                                disabled={summaryBusy}
                              >
                                <Lock className="w-3 h-3" /> 承認解除
                              </Button>
                            ) : (
                              <>
                                {summaryVM.canRegenerate && (
                                  <>
                                    <Button size="sm" variant="outline"
                                      className="h-7 text-xs gap-1 border-sky-200 text-sky-700"
                                      onClick={() => handleReview('reviewed')} disabled={summaryBusy}>
                                      <CheckCircle2 className="w-3 h-3" /> 確認済
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      className="h-7 text-xs gap-1 border-green-200 text-green-700"
                                      onClick={() => handleReview('approved')} disabled={summaryBusy}>
                                      <CheckCircle2 className="w-3 h-3" /> 承認
                                    </Button>
                                  </>
                                )}
                                <Button size="sm" variant="outline"
                                  className="h-7 text-xs gap-1 border-violet-200 text-violet-700"
                                  onClick={handleRegenerate}
                                  disabled={summaryBusy || !summaryVM.canRegenerate}
                                >
                                  {summaryLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                  再生成して保存
                                </Button>
                              </>
                            )}
                          </div>
                          {summaryError && <p className="text-xs text-red-600">{summaryError}</p>}
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* Quick action links */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] text-slate-400">クイックアクション:</span>
                      <button
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => openActionDialog(MANUAL_PREFILL)}
                      >
                        + Action 作成
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => openSfTodoDialog({})}
                      >
                        + SF ToDo
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        className="text-xs text-indigo-600 hover:underline"
                        onClick={() => { setContactDialogPerson(undefined); setContactDialogOpen(true); }}
                      >
                        + 連絡先追加
                      </button>
                    </div>
                  </div>
                </section>

                {/* ════ D: 根拠 ══════════════════════════════════════════════ */}
                <section className="bg-white border rounded-lg p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">根拠</p>

                  <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">

                    {/* Recent Communications */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3 text-slate-400" />コミュニケーション
                        </p>
                        <button className="text-[10px] text-indigo-600 hover:underline" onClick={() => setActiveTab("communication")}>
                          すべて見る →
                        </button>
                      </div>
                      {comm?.blankDays !== null && (comm?.blankDays ?? 0) >= 30 && (
                        <div className={`text-[10px] mb-2 px-2 py-1 rounded ${
                          comm?.riskLevel === 'risk' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          最終コミュニケーションから <strong>{comm?.blankDays}</strong> 日経過
                        </div>
                      )}
                      {comm ? (
                        comm.recentEntries.length > 0 ? (
                          <div className="space-y-2">
                            {comm.recentEntries.slice(0, 3).map(entry => (
                              <CommEntryRow key={entry.key} entry={entry} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">コミュニケーション記録なし</p>
                        )
                      ) : (
                        <p className="text-xs text-slate-400">データなし</p>
                      )}
                    </div>

                    {/* Right: Projects + Support counts */}
                    <div className="space-y-4">
                      {/* Projects (compact) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <FolderOpen className="w-3 h-3 text-slate-400" />プロジェクト
                          </p>
                          {(projects?.total ?? 0) > 0 && (
                            <button className="text-[10px] text-indigo-600 hover:underline" onClick={() => setActiveTab("projects")}>
                              詳細 →
                            </button>
                          )}
                        </div>
                        {projects && projects.total > 0 ? (
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                              {[
                                { label: '合計',   value: projects.total,   cls: 'text-slate-700' },
                                { label: 'Active', value: projects.active,  cls: 'text-green-600' },
                                { label: '停滞',   value: projects.stalled, cls: projects.stalled > 0 ? 'text-amber-600' : 'text-slate-400' },
                                { label: '未活用', value: projects.unused,  cls: projects.unused  > 0 ? 'text-slate-500' : 'text-slate-400' },
                              ].map(col => (
                                <div key={col.label} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400">{col.label}</span>
                                  <span className={`font-semibold ${col.cls}`}>{col.value}</span>
                                </div>
                              ))}
                            </div>
                            {projects.riskSignals.length > 0 && (
                              <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 flex items-start gap-1">
                                <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
                                {projects.riskSignals[0].description}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">プロジェクトなし</p>
                        )}
                      </div>

                      {/* Support: counts + urgent cases */}
                      {support && (support.openIntercomCount + support.openCseCount) > 0 && (() => {
                        // critical/high 優先でソート、最大3件
                        const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                        const urgentCases = [...support.recentCases]
                          .sort((a, b) =>
                            (SEVERITY_ORDER[a.severity?.toLowerCase() ?? ''] ?? 9) -
                            (SEVERITY_ORDER[b.severity?.toLowerCase() ?? ''] ?? 9)
                          )
                          .slice(0, 3);
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                <Headphones className="w-3 h-3 text-slate-400" />サポート
                              </p>
                              <button className="text-[10px] text-indigo-600 hover:underline" onClick={() => setActiveTab("support")}>
                                詳細 →
                              </button>
                            </div>
                            {/* counts row */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              {support.openIntercomCount > 0 && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                                  Intercom {support.openIntercomCount}
                                </span>
                              )}
                              {support.openCseCount > 0 && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                                  CSE {support.openCseCount}
                                </span>
                              )}
                              {support.criticalCount > 0 && (
                                <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">
                                  Critical {support.criticalCount}
                                </span>
                              )}
                              {support.waitingCseCount > 0 && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                                  CSE待 {support.waitingCseCount}
                                </span>
                              )}
                            </div>
                            {/* urgent cases */}
                            {urgentCases.length > 0 && (
                              <div className="space-y-1.5">
                                {urgentCases.map(c => (
                                  <SupportCaseRow key={c.id} c={c} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </section>

              </div>
            </TabsContent>

            {/* ── Actions tab ── */}
            <TabsContent value="actions" className="flex-1 overflow-auto m-0 p-4">
              <ActionsTab
                actions={localActions}
                onStatusChange={async (id, status) => {
                  const action = localActions.find(a => a.id === id);
                  if (!action) return;
                  // Optimistic
                  setLocalActions(prev => prev.map(a => a.id === id ? { ...a, status } : a));
                  // Persist (rowId が取れていれば PATCH)
                  if (action.rowId) {
                    try {
                      await fetch(`/api/company/${companyId}/actions/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rowId: action.rowId, status }),
                      });
                    } catch { /* silent */ }
                  }
                }}
                onCreateAction={() => openActionDialog(MANUAL_PREFILL)}
                onSfTodo={action => openSfTodoDialog({
                  prefillTitle:        action.title,
                  relatedSignalId:     action.sourceRef ?? undefined,
                  relatedSignalRef:    action.sourceRef ?? undefined,
                  relatedActionId:     action.id,
                  relatedActionRowId:  action.rowId,
                })}
              />
            </TabsContent>

            {/* ── Support tab ── */}
            <TabsContent value="support" className="flex-1 overflow-auto m-0 p-4">
              <SupportTab support={support} />
            </TabsContent>

            {/* ── Projects tab ── */}
            <TabsContent value="projects" className="flex-1 overflow-auto m-0 p-4">
              {!companyId.startsWith('sf_') ? (
                <p className="text-sm text-slate-400">
                  SF 未連携企業のため、プロジェクト情報は取得できません（company_uid: {companyId}）
                </p>
              ) : (
                <ProjectsTab projects={projects} />
              )}
            </TabsContent>

            {/* ── Communication tab ── */}
            <TabsContent value="communication" className="flex-1 overflow-auto m-0 p-4">
              <CommunicationTab
                comm={comm}
                fullEntries={commFullEntries}
                fullLoading={commFullLoading}
              />
            </TabsContent>

            {/* ── People tab ── */}
            <TabsContent value="people" className="flex-1 overflow-auto m-0 p-4">
              <PeopleTab
                companyUid={companyId}
                people={people}
                localContacts={localContacts}
                orgVM={orgVM}
                onAddContact={() => { setContactDialogPerson(undefined); setContactDialogOpen(true); }}
                onEditContact={p  => { setContactDialogPerson(p); setContactDialogOpen(true); }}
                onCreateAction={vm => openActionDialog(buildOrgPersonPrefill(vm))}
                onPeopleAdded={() => setContactsLoaded(false)}
              />
            </TabsContent>
          </Tabs>
        </main>

        {/* ════════════════════════════════════════════════════════════════
            SUMMARY GENERATION SHEET
        ════════════════════════════════════════════════════════════════ */}
        <Sheet open={showSummarySheet} onOpenChange={setShowSummarySheet}>
          <SheetContent side="right" className="w-[520px] sm:max-w-[520px] flex flex-col overflow-hidden">
            <SheetHeader className="flex-shrink-0">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                AI Company Summary
              </SheetTitle>
              <SheetDescription>
                Evidence・Alert・People を元にした AI 分析サマリー
              </SheetDescription>
            </SheetHeader>

            <SummaryStateBadge vm={summaryVM} record={savedRecord} variant="sheet-panel" />

            <ScrollArea className="flex-1 min-h-0 mt-4">
              {/* Loading */}
              {(summaryLoading || summarySaving) && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <p className="text-sm">
                    {summarySaving ? 'Evidence を分析して保存しています...' : 'Evidence を分析しています...'}
                  </p>
                </div>
              )}

              {/* Error */}
              {!summaryLoading && !summarySaving && summaryError && (
                <div className="space-y-4 px-4 pb-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-700">{summaryError}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={generateCompanySummary}>再試行</Button>
                    <Button size="sm" variant="outline" onClick={handleRegenerate}>再生成して保存</Button>
                  </div>
                </div>
              )}

              {/* Result */}
              {!summaryLoading && !summarySaving && !summaryError && summaryResult && (
                <div className="space-y-4 px-4 pb-4">
                  {/* Save badge */}
                  {summaryResult.saved && (
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                      {summaryResult.created ? '新規保存' : '上書き保存'} 完了
                    </Badge>
                  )}

                  {/* Health */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Overall Health:</span>
                    <Badge variant="outline" className={`text-xs ${getHealthBadge(summaryResult.overall_health).className}`}>
                      {getHealthBadge(summaryResult.overall_health).label}
                    </Badge>
                  </div>

                  {/* Summary */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">サマリー</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{summaryResult.summary}</p>
                  </div>

                  {/* Key risks */}
                  {(summaryResult.key_risks as RiskItem[] ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">キーリスク</p>
                      <div className="space-y-2">
                        {(summaryResult.key_risks as RiskItem[]).map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-slate-800">{r.title}</p>
                              {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key opportunities */}
                  {(summaryResult.key_opportunities as OpportunityItem[] ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">機会・拡販ポイント</p>
                      <div className="space-y-2">
                        {(summaryResult.key_opportunities as OpportunityItem[]).map((o, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-slate-800">{o.title}</p>
                              {o.description && <p className="text-xs text-slate-500">{o.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended next action */}
                  {summaryResult.recommended_next_action && (
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-violet-700 mb-1">推奨次アクション</p>
                      <p className="text-sm text-violet-900">{summaryResult.recommended_next_action}</p>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="text-[10px] text-slate-400 border-t pt-2 space-y-0.5">
                    <p>Model: {summaryResult.model}</p>
                    <p>Generated: {summaryResult.generated_at?.slice(0, 16)}</p>
                    <p>Evidence: {summaryResult.evidence_count}件 / Alert: {summaryResult.alert_count}件 / People: {summaryResult.people_count}名</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {!summaryResult.saved && (
                      <Button size="sm" onClick={handleSave} disabled={summarySaving} className="gap-1">
                        <Database className="w-3 h-3" /> 保存
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={summaryBusy} className="gap-1">
                      <RefreshCw className="w-3 h-3" /> 再生成して保存
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty (sheet opened without generating) */}
              {!summaryLoading && !summarySaving && !summaryError && !summaryResult && summaryVM.hasSummary && savedRecord && (
                <div className="space-y-4 px-4 pb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Overall Health:</span>
                    <Badge variant="outline" className={`text-xs ${getHealthBadge(savedRecord.overallHealth).className}`}>
                      {getHealthBadge(savedRecord.overallHealth).label}
                    </Badge>
                  </div>
                  {savedRecord.aiSummary && (
                    <p className="text-sm text-slate-700 leading-relaxed">{savedRecord.aiSummary}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleRegenerate} disabled={summaryBusy || !summaryVM.canRegenerate} className="gap-1">
                      <RefreshCw className="w-3 h-3" /> 再生成して保存
                    </Button>
                    {!summaryVM.isApproved && (
                      <Button size="sm" variant="outline" onClick={() => handleReview('approved')} disabled={summaryBusy} className="gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 承認
                      </Button>
                    )}
                    {summaryVM.isApproved && (
                      <Button size="sm" variant="outline" onClick={() => setShowDowngradeConfirm(true)} disabled={summaryBusy} className="gap-1 border-amber-200 text-amber-700">
                        <Lock className="w-3 h-3" /> 承認解除
                      </Button>
                    )}
                  </div>
                  {summaryError && <p className="text-xs text-red-600">{summaryError}</p>}
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* ── Action create dialog ── */}
        <ActionCreateDialog
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          companyUid={companyId}
          companyName={company?.name ?? companyId}
          prefillTitle={actionDialogConfig.title}
          prefillBody={actionDialogConfig.body}
          createdFrom={actionDialogConfig.createdFrom}
          sourceRef={actionDialogConfig.sourceRef ?? undefined}
          personRef={actionDialogConfig.personRef ?? undefined}
          onCreated={async (action) => {
            // Optimistic: 先に UI に反映
            setLocalActions(prev => [action, ...prev]);
            // 永続化
            try {
              const res = await fetch(`/api/company/${companyId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action_id:      action.id,
                  title:          action.title,
                  description:    action.body,
                  owner:          action.owner,
                  due_date:       action.dueDate,
                  status:         action.status,
                  created_from:   action.createdFrom,
                  source_ref:     action.sourceRef,
                  person_ref:     action.personRef,
                  sf_todo_status: action.sfTodoStatus,
                  sf_todo_id:     null,
                  created_at:     action.createdAt,
                }),
              });
              if (res.ok) {
                const data = await res.json() as { action: LocalAction };
                // rowId を反映
                setLocalActions(prev =>
                  prev.map(a => a.id === action.id ? { ...a, rowId: data.action.rowId } : a),
                );
              } else {
                const errData = await res.json().catch(() => ({}));
                console.error('[actions POST] NocoDB error:', res.status, errData);
              }
            } catch (err) { console.error('[actions POST] error:', err); }
          }}
        />

        {/* ── SF ToDo dialog ── */}
        <SfTodoDialog
          open={sfTodoDialogOpen}
          onOpenChange={setSfTodoDialogOpen}
          companyUid={companyId}
          companyName={company?.name ?? companyId}
          prefillTitle={sfTodoDialogConfig.prefillTitle}
          relatedSignalId={sfTodoDialogConfig.relatedSignalId}
          relatedSignalRef={sfTodoDialogConfig.relatedSignalRef}
          relatedActionId={sfTodoDialogConfig.relatedActionId}
          onResult={handleSfTodoResult}
        />

        {/* ── Contact form dialog ── */}
        <ContactFormDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          companyUid={companyId}
          companyName={company?.name ?? companyId}
          person={contactDialogPerson}
          persons={allContacts}
          onSaved={saved => {
            setLocalContacts(prev => {
              const idx = prev.findIndex(p => p.id === saved.id);
              if (idx >= 0) {
                // edit: in-place 更新
                // ⚠️ 単純 replace (p => saved) は禁止。
                // saved が partial な場合に既存フィールドを上書き消失させないよう、
                // 既存 p をベースとして saved で上書きする defensive merge を行う。
                // （name/email/title 等が空 or falsy なら既存値を保持）
                const existing = prev[idx];
                const merged: typeof existing = {
                  ...existing,
                  ...saved,
                  // 文字列フィールド: saved が空 / falsy なら既存値を保持
                  name:       saved.name       || existing.name,
                  role:       saved.role       ?? existing.role,
                  title:      saved.title      ?? existing.title,
                  department: saved.department ?? existing.department,
                  email:      saved.email      ?? existing.email,
                  phone:      saved.phone      ?? existing.phone,
                  // 関係性フィールド: saved に明示的に含まれているので `...saved` で上書き済み。
                  // null（クリア）も含め正しく伝播する。orgVM は allContacts の useMemo
                  // が自動再計算するので、ここで特別な処理は不要。
                  // reportsToPersonId: ...saved 内に含まれる
                  // worksWithPersonIds: ...saved 内に含まれる
                };
                return prev.map(p => p.id === saved.id ? merged : p);
              }
              // add: 先頭に追加（重複防止: まだ入っていない場合のみ）
              return [saved, ...prev];
            });
          }}
        />

        {/* ── Downgrade confirm dialog ── */}
        <Dialog open={showDowngradeConfirm} onOpenChange={setShowDowngradeConfirm}>
          <DialogContent className="sm:max-w-[400px] flex flex-col max-h-[90vh] overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>承認を解除しますか？</DialogTitle>
              <DialogDescription>
                「承認済み」ステータスを「確認済み」に戻します。AI 再生成が可能になります。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-shrink-0 border-t pt-3">
              <Button variant="outline" onClick={() => setShowDowngradeConfirm(false)}>キャンセル</Button>
              <Button variant="destructive" onClick={handleDowngrade} disabled={summaryReviewing}>
                {summaryReviewing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                承認解除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-components (inline, no separate file needed)
// ════════════════════════════════════════════════════════════════════════════

// ── Risk signal row ──────────────────────────────────────────────────────────

const SIGNAL_TAB_MAP: Record<string, string> = {
  phase_gap:          'overview',
  phase_stagnation:   'overview',
  communication_blank: 'communication',
  project_stalled:    'projects',
  support_critical:   'support',
  support_high_volume: 'support',
  alert_critical:     'support',
  alert_high:         'support',
  summary_stale:      'overview',
};

function RiskSignalRow({
  signal,
  onTabSwitch,
  onActionCTA,
  onSfTodoCTA,
}: {
  signal:      RiskSignal;
  onTabSwitch: (tab: string) => void;
  onActionCTA: (signal: RiskSignal, cta: SignalCTASpec) => void;
  onSfTodoCTA: (signal: RiskSignal, cta: SignalCTASpec) => void;
}) {
  const cfg       = RISK_SEVERITY_BADGE[signal.severity] ?? RISK_SEVERITY_BADGE.medium;
  const targetTab = SIGNAL_TAB_MAP[signal.type];
  const cta       = getRiskSignalCTA(signal);

  // alert signal のソース説明（alerts テーブル、status=open）
  const alertSourceHint = (signal.type === 'alert_critical' || signal.type === 'alert_high')
    ? 'alerts テーブル / status=open'
    : null;

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${cfg.dotClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-700 font-medium text-xs">{signal.title}</span>
          <Badge variant="outline" className={`text-[10px] py-0 ${cfg.className}`}>{cfg.label}</Badge>
          {alertSourceHint && (
            <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-200 rounded px-1 py-px">
              {alertSourceHint}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{signal.description}</p>
        {/* CTAs */}
        {(cta.showActionCTA || cta.showSfTodoCTA) && (
          <div className="flex items-center gap-2 mt-1">
            {cta.showActionCTA && (
              <button
                className="text-[10px] text-indigo-600 hover:underline"
                onClick={() => onActionCTA(signal, cta)}
              >
                + {cta.actionLabel}
              </button>
            )}
            {cta.showSfTodoCTA && (
              <button
                className="text-[10px] text-violet-600 hover:underline"
                onClick={() => onSfTodoCTA(signal, cta)}
              >
                SF ToDo作成
              </button>
            )}
          </div>
        )}
      </div>
      {targetTab && targetTab !== 'overview' && (
        <button
          className="text-[10px] text-indigo-500 hover:underline flex-shrink-0 mt-0.5"
          onClick={() => onTabSwitch(targetTab)}
        >
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Opportunity signal row ────────────────────────────────────────────────────

function OpportunitySignalRow({
  signal,
  onActionCTA,
  onSfTodoCTA,
}: {
  signal:      OpportunitySignal;
  onActionCTA: (signal: OpportunitySignal, cta: SignalCTASpec) => void;
  onSfTodoCTA: (signal: OpportunitySignal, cta: SignalCTASpec) => void;
}) {
  const cta = getOpportunitySignalCTA(signal);

  // project expansion: 判定ロジックを説明するヒント
  // description に「N プロジェクトが稼働中」が含まれているので score も併せて可視化
  const expansionHint = signal.type === 'expansion_project'
    ? `判定スコア: ${signal.score} / 条件: active ≥ 2`
    : null;

  return (
    <div className="flex items-start gap-2 text-sm">
      <Zap className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-700 font-medium text-xs">{signal.title}</span>
          {expansionHint && (
            <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-200 rounded px-1 py-px">
              {expansionHint}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5">{signal.description}</p>
        {(cta.showActionCTA || cta.showSfTodoCTA) && (
          <div className="flex items-center gap-2 mt-1">
            {cta.showActionCTA && (
              <button
                className="text-[10px] text-indigo-600 hover:underline"
                onClick={() => onActionCTA(signal, cta)}
              >
                + {cta.actionLabel}
              </button>
            )}
            {cta.showSfTodoCTA && (
              <button
                className="text-[10px] text-violet-600 hover:underline"
                onClick={() => onSfTodoCTA(signal, cta)}
              >
                SF ToDo作成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Communication entry row ───────────────────────────────────────────────────

function CommEntryRow({ entry }: { entry: CommunicationEntry }) {
  return (
    <div className="flex items-start gap-2 text-xs text-slate-600 border-l-2 border-slate-100 pl-2">
      {COMM_SOURCE_ICON[entry.source]}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-slate-700 truncate">{entry.title}</span>
          <span className="text-slate-400 text-[10px] flex-shrink-0">{entry.dateStr ? entry.dateStr.slice(0, 10) : '日付不明'}</span>
          <span className="text-[10px] text-slate-400">{COMM_SOURCE_LABEL[entry.source]}</span>
          {entry.hasActionItems && (
            <span className="text-[10px] bg-violet-50 text-violet-600 px-1 rounded">アクション有</span>
          )}
        </div>
        {entry.excerpt && (
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{entry.excerpt}</p>
        )}
      </div>
    </div>
  );
}

// ── Support case row ──────────────────────────────────────────────────────────

function SupportCaseRow({ c }: { c: AppSupportCase }) {
  const routing = ROUTING_STATUS_LABEL[(c.routingStatus ?? '').toLowerCase()];
  const title   = c.title;

  return (
    <Link
      href={`/support/${c.id}`}
      className="flex items-center gap-2 text-xs hover:bg-slate-50 rounded px-1 py-0.5 group"
    >
      <SeverityDot severity={c.severity} />
      <span className="flex-1 truncate text-slate-700 group-hover:text-indigo-600">{title}</span>
      {routing && (
        <Badge variant="outline" className={`text-[10px] py-0 ${routing.cls}`}>
          {routing.label}
        </Badge>
      )}
      <span className="text-slate-400 flex-shrink-0">{c.createdAt?.slice(0, 10)}</span>
    </Link>
  );
}

// ── CSE ticket expandable row ────────────────────────────────────────────────

function CseTicketRow({ t }: { t: AppCseTicket }) {
  const [open, setOpen] = useState(false);
  const st = CSE_STATUS_LABEL[(t.status ?? 'open').toLowerCase()];
  // title fallback: title → description 先頭 → (タイトルなし)
  const displayTitle = t.title && t.title !== '(タイトルなし)'
    ? t.title
    : t.description
      ? (t.description.replace(/[\r\n]+/g, ' ').trim().slice(0, 40) + (t.description.length > 40 ? '…' : ''))
      : '(タイトルなし)';

  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <div
        className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 group"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-xs text-slate-400 font-mono flex-shrink-0">{t.id.slice(0, 8)}</span>
        <span className="flex-1 truncate text-slate-700">{displayTitle}</span>
        {st && (
          <Badge variant="outline" className={`text-xs flex-shrink-0 ${st.cls}`}>{st.label}</Badge>
        )}
        <span className="text-xs text-slate-400 flex-shrink-0">{t.createdAt?.slice(0, 10)}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-slate-300 flex-shrink-0 transition-transform group-hover:text-slate-400 ${open ? 'rotate-90' : ''}`} />
      </div>
      {open && (
        <div className="px-4 pb-3 pt-1 bg-slate-50/60 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
          {t.description && (
            <p className="text-slate-500 leading-relaxed line-clamp-4">{t.description}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap text-[10px] text-slate-400">
            <span>ID: <span className="font-mono text-slate-500">{t.id}</span></span>
            {t.priority && <span>優先度: {t.priority}</span>}
            {t.waitingHours != null && t.waitingHours > 0 && (
              <span>待機: {t.waitingHours}h</span>
            )}
            {t.createdAt && <span>作成: {t.createdAt.slice(0, 10)}</span>}
            {t.updatedAt && <span>更新: {t.updatedAt.slice(0, 10)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Support tab ───────────────────────────────────────────────────────────────

function SupportTab({ support }: { support: CompanyDetailApiResponse['support'] | undefined }) {
  if (!support) return <p className="text-sm text-slate-400">データなし</p>;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Summary row */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Intercom オープン', value: support.openIntercomCount, cls: support.openIntercomCount > 0 ? 'text-slate-700' : 'text-slate-400' },
          { label: 'CSE オープン',      value: support.openCseCount,      cls: support.openCseCount > 0      ? 'text-slate-700' : 'text-slate-400' },
          { label: 'Critical',         value: support.criticalCount,     cls: support.criticalCount > 0     ? 'text-red-600 font-semibold' : 'text-slate-400' },
          { label: 'High',             value: support.highCount,         cls: support.highCount > 0          ? 'text-orange-600 font-semibold' : 'text-slate-400' },
          { label: 'CSE 待ち',         value: support.waitingCseCount,   cls: support.waitingCseCount > 0   ? 'text-amber-600' : 'text-slate-400' },
        ].map(col => (
          <div key={col.label} className="bg-white border rounded-lg px-4 py-3 text-center min-w-[100px]">
            <p className={`text-xl font-bold ${col.cls}`}>{col.value}</p>
            <p className="text-[10px] text-slate-500">{col.label}</p>
          </div>
        ))}
      </div>

      {/* Intercom cases */}
      {support.recentCases.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
            <Headphones className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Intercom ケース</h3>
          </div>
          <div className="divide-y">
            {support.recentCases.map(c => (
              <Link
                key={c.id}
                href={`/support/${c.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm group"
              >
                <SeverityDot severity={c.severity} />
                <span className="flex-1 truncate text-slate-700 group-hover:text-indigo-600">
                  {c.title}
                </span>
                {(() => { const r = ROUTING_STATUS_LABEL[(c.routingStatus ?? '').toLowerCase()]; return r ? (
                  <Badge variant="outline" className={`text-xs ${r.cls}`}>{r.label}</Badge>
                ) : null; })()}
                <span className="text-xs text-slate-400">{c.createdAt?.slice(0, 10)}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CSE Tickets */}
      {support.cseTickets.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">CSE チケット</h3>
            <span className="text-[10px] text-slate-400 ml-auto">行をクリックで詳細</span>
          </div>
          <div>
            {support.cseTickets.map(t => (
              <CseTicketRow key={t.id} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* AI States */}
      {support.aiStates.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-slate-700">AI 分析結果</h3>
          </div>
          <div className="divide-y">
            {support.aiStates.map(ai => (
              <div key={ai.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-500">{ai.urgency}</span>
                  {ai.displayTitle && <span className="text-slate-700 font-medium">{ai.displayTitle}</span>}
                </div>
                {ai.summary && <p className="text-xs text-slate-600 line-clamp-2">{ai.summary}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {support.recentCases.length === 0 && support.cseTickets.length === 0 && (
        <p className="text-sm text-slate-400">オープンケースなし</p>
      )}
    </div>
  );
}

// ── Projects tab ──────────────────────────────────────────────────────────────

function ProjectsTab({ projects }: { projects: CompanyDetailApiResponse['projects'] | undefined }) {
  if (!projects || projects.total === 0) {
    return <p className="text-sm text-slate-400">プロジェクトなし</p>;
  }

  return (
    <div className="max-w-4xl space-y-4">
      {/* Aggregate counts */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: '合計',    value: projects.total,    cls: 'text-slate-700' },
          { label: 'Active',  value: projects.active,   cls: projects.active  > 0 ? 'text-green-600' : 'text-slate-400' },
          { label: '停滞',    value: projects.stalled,  cls: projects.stalled > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: '未活用',  value: projects.unused,   cls: projects.unused  > 0 ? 'text-slate-500' : 'text-slate-400' },
          { label: '無効',    value: projects.inactive, cls: 'text-slate-400' },
        ].map(col => (
          <div key={col.label} className="bg-white border rounded-lg px-4 py-3 text-center min-w-[80px]">
            <p className={`text-xl font-bold ${col.cls}`}>{col.value}</p>
            <p className="text-[10px] text-slate-500">{col.label}</p>
          </div>
        ))}
      </div>

      {/* Risk signals */}
      {projects.riskSignals.map((sig, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {sig.description}
        </div>
      ))}

      {/* Project list */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="divide-y">
          {projects.projects.map((p: ProjectItemVM) => {
            const statusCfg = PROJECT_STATUS_BADGE[p.derivedStatus] ?? PROJECT_STATUS_BADGE.inactive;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 truncate">{p.name}</p>
                  {p.useCase && <p className="text-xs text-slate-400">{p.useCase}</p>}
                </div>
                <Badge variant="outline" className={`text-xs flex-shrink-0 ${statusCfg.className}`}>
                  {statusCfg.label}
                </Badge>
                {p.stalledDays !== null && p.stalledDays >= 60 && (
                  <span className="text-xs text-amber-600 flex-shrink-0">{p.stalledDays}d停滞</span>
                )}
                {p.lastUpdatedAt && (
                  <span className="text-xs text-slate-400 flex-shrink-0">{p.lastUpdatedAt?.slice(0, 10)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Communication tab ─────────────────────────────────────────────────────────

const COMM_SOURCE_FILTERS = [
  { value: 'all',            label: '全て' },
  { value: 'chatwork',       label: 'Chatwork' },
  { value: 'slack',          label: 'Slack' },
  { value: 'notion_minutes', label: '議事録' },
];

const COMM_DISPLAY_LIMIT = 20;

function CommunicationTab({
  comm,
  fullEntries,
  fullLoading,
}: {
  comm:        CompanyDetailApiResponse['communication'] | undefined;
  fullEntries: CommunicationEntry[] | null;
  fullLoading: boolean;
}) {
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [displayLimit, setDisplayLimit] = useState(COMM_DISPLAY_LIMIT);

  if (!comm) return <p className="text-sm text-slate-400">データなし</p>;

  const allEntries = fullEntries ?? comm.recentEntries;

  const filtered = allEntries.filter(e => {
    if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || (e.excerpt ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const displayed    = filtered.slice(0, displayLimit);
  const hasMore      = filtered.length > displayLimit;
  const showingAll   = displayLimit >= filtered.length;

  return (
    <div className="max-w-3xl space-y-4">
      {/* Signal summary */}
      <div className="bg-white border rounded-lg p-4 flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-2xl font-bold text-slate-700">{comm.blankDays ?? '—'}</p>
          <p className="text-xs text-slate-500">最終コミュニケーションから（日）</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-600">{comm.totalCount}</p>
          <p className="text-xs text-slate-500">ログ総数</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">{comm.activeSources.join(' / ') || '—'}</p>
          <p className="text-xs text-slate-500">アクティブソース</p>
        </div>
        {comm.riskLevel !== 'none' && (
          <div className={`text-xs px-3 py-1.5 rounded-full font-medium ${
            comm.riskLevel === 'risk' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {comm.riskLevel === 'risk' ? 'コミュニケーションリスク' : '要注意'}
          </div>
        )}
      </div>

      {/* Keyword search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setDisplayLimit(COMM_DISPLAY_LIMIT); }}
          placeholder="キーワードで検索..."
          className="w-full pl-8 pr-8 py-1.5 text-xs border rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Source filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {COMM_SOURCE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              sourceFilter === f.value
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => { setSourceFilter(f.value); setDisplayLimit(COMM_DISPLAY_LIMIT); }}
          >
            {f.label}
          </button>
        ))}
        {fullLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 ml-2" />}
        <span className="text-[10px] text-slate-400 ml-auto">
          {filtered.length}件{!showingAll && `（${displayed.length}件表示中）`}
        </span>
      </div>

      {displayed.length > 0 ? (
        <>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="divide-y">
              {displayed.map(entry => (
                <div key={entry.key} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <div className="flex-shrink-0 mt-0.5">
                    {COMM_SOURCE_ICON[entry.source]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{entry.title}</span>
                      {entry.hasActionItems && (
                        <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-600 border-violet-200">
                          アクション有
                        </Badge>
                      )}
                    </div>
                    {entry.excerpt && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{entry.excerpt}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {COMM_SOURCE_LABEL[entry.source]} · {entry.dateStr ? entry.dateStr.slice(0, 10) : '日付不明'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                className="text-xs text-indigo-600 hover:underline px-4 py-2"
                onClick={() => setDisplayLimit(prev => prev + COMM_DISPLAY_LIMIT)}
              >
                もっと見る（残り {filtered.length - displayLimit} 件）
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400">
          {fullLoading ? '読み込み中...' : (searchQuery ? '検索結果なし' : 'コミュニケーション記録なし')}
        </p>
      )}
    </div>
  );
}

// ── People tab ────────────────────────────────────────────────────────────────

const DECISION_INFLUENCE_BADGE: Record<string, { label: string; cls: string }> = {
  high:    { label: '意思決定者',  cls: 'bg-red-50 text-red-700 border-red-200' },
  medium:  { label: '影響者',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  low:     { label: '実務担当',    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  unknown: { label: '不明',        cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

function PeopleTab({
  companyUid,
  people,
  localContacts,
  orgVM,
  onAddContact,
  onEditContact,
  onCreateAction,
  onPeopleAdded,
}: {
  companyUid:      string;
  people:          CompanyDetailApiResponse['people'] | undefined;
  localContacts:   AppPerson[];
  orgVM:           OrgChartVM;
  onAddContact:    () => void;
  onEditContact:   (person: AppPerson) => void;
  onCreateAction:  (vm: OrgPersonVM) => void;
  onPeopleAdded?:  () => void;
}) {
  const [sfSyncSheetOpen,   setSfSyncSheetOpen]   = useState(false);
  const [sfDryRunLoading,   setSfDryRunLoading]   = useState(false);
  const [sfSyncLoading,     setSfSyncLoading]     = useState(false);
  const [sfDryRunResult,    setSfDryRunResult]     = useState<SfContactSyncResult | null>(null);
  const [sfSyncResult,      setSfSyncResult]       = useState<SfContactSyncResult | null>(null);

  // ── Log-from-candidate 状態 ────────────────────────────────────────────────
  const [candidateSheetOpen,  setCandidateSheetOpen]  = useState(false);
  const [candidateLoading,    setCandidateLoading]    = useState(false);
  const [candidateResult,     setCandidateResult]     = useState<ContactCandidatesResult | null>(null);
  const [candidateError,      setCandidateError]      = useState<string | null>(null);
  const [candidateDecisions,  setCandidateDecisions]  = useState<Record<string, ContactCandidateAction>>({});
  const [candidateSaving,     setCandidateSaving]     = useState(false);

  async function extractCandidates() {
    setCandidateLoading(true); setCandidateError(null);
    try {
      const res = await fetch(`/api/company/${companyUid}/contact-candidates`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ContactCandidatesResult;
      setCandidateResult(data);
      // デフォルト: 既存 people に類似するもの → link、それ以外 → 未決（空 = ignore 扱い）
      const defaults: Record<string, ContactCandidateAction> = {};
      for (const c of data.candidates) {
        defaults[c.id] = c.existingMatch ? 'link' : 'add';
      }
      setCandidateDecisions(defaults);
    } catch (e) {
      setCandidateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCandidateLoading(false);
    }
  }

  async function applyCandidateDecisions() {
    if (!candidateResult) return;
    setCandidateSaving(true);
    const addTargets = candidateResult.candidates.filter(
      c => candidateDecisions[c.id] === 'add',
    );
    for (const c of addTargets) {
      const note = c.excerpt
        ? `ログ抽出 (${c.source}) — ${c.sourceRef}: ${c.excerpt}`
        : `ログ抽出 (${c.source}) — ${c.sourceRef}`;
      await fetch(`/api/company/${companyUid}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id:       crypto.randomUUID(),
          name:            c.name,
          role:            '',
          status:          'proposed',
          source:          'cxm',
          stakeholder_note: note.slice(0, 500),
        }),
      }).catch(() => {});
    }
    setCandidateSaving(false);
    setCandidateSheetOpen(false);
    setCandidateResult(null);
    onPeopleAdded?.();
  }

  async function confirmPerson(personId: string) {
    await fetch(`/api/company/${companyUid}/people/${personId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    }).catch(() => {});
    onPeopleAdded?.();
  }

  // orgVM.persons は上位で mergeCompanyPeople + buildOrgChartVM 済み
  const keyContacts = orgVM.tiers.decision_maker.map(vm => vm.raw);
  const others      = [...orgVM.tiers.influencer, ...orgVM.tiers.operator, ...orgVM.tiers.unclassified].map(vm => vm.raw);

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {orgVM.persons.length}名
          {localContacts.length > 0 && (
            <span className="ml-1 text-indigo-500">(CXM: {localContacts.length}名)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {/* ログから候補抽出 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
            onClick={() => { setCandidateSheetOpen(true); extractCandidates(); }}
          >
            <Search className="w-3 h-3" />
            ログから候補抽出
          </Button>
          {/* SF Contact sync — Sheet で dry-run preview を表示（SF OAuth 未設定時は adapter_not_connected） */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-slate-500 hover:text-slate-700"
            onClick={() => setSfSyncSheetOpen(true)}
            title="SF Contact 全体同期（SF OAuth 設定前は dry-run プレビューのみ）"
          >
            <ExternalLink className="w-3 h-3" />
            SF同期
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onAddContact}>
            <Plus className="w-3 h-3" />
            連絡先追加
          </Button>
        </div>
      </div>

      {/* ── Log Candidate Sheet ────────────────────────────────────────────── */}
      <Sheet open={candidateSheetOpen} onOpenChange={v => { setCandidateSheetOpen(v); if (!v) { setCandidateResult(null); setCandidateError(null); } }}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600" />
              ログからの連絡先候補
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Chatwork / Slack / 議事録に登場した名前を候補として抽出します。
              確認して追加するものを選んでください。
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0 mt-4">
            {candidateLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">ログを解析中...</span>
              </div>
            ) : candidateError ? (
              <div className="space-y-3 px-4 pb-4">
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3">{candidateError}</div>
                <Button size="sm" variant="outline" onClick={extractCandidates}>再試行</Button>
              </div>
            ) : candidateResult ? (
              <div className="space-y-4 px-4 pb-4">
                {/* ソース状況 */}
                {(candidateResult.skippedSources.length > 0 || candidateResult.emptySources.length > 0 || (candidateResult.weakSources ?? []).length > 0) && (
                  <div className="text-[10px] space-y-1">
                    {/* 精度インジケータ */}
                    <div className="flex gap-3 text-slate-500 mb-1">
                      {['chatwork', 'slack', 'notion_minutes'].map(src => {
                        const SOURCE_STAR: Record<string, string> = { chatwork: '★★★', slack: '★★', notion_minutes: '★' };
                        const SOURCE_LBL: Record<string, string> = { chatwork: 'Chatwork', slack: 'Slack', notion_minutes: 'Notion' };
                        const isSkipped = candidateResult.skippedSources.includes(src as ContactCandidateSource);
                        const isEmpty   = candidateResult.emptySources.includes(src as ContactCandidateSource);
                        const isWeak    = (candidateResult.weakSources ?? []).includes(src as ContactCandidateSource);
                        const cls = isSkipped ? 'text-slate-300' : isEmpty ? 'text-slate-300' : isWeak ? 'text-amber-400' : 'text-emerald-500';
                        const label = isSkipped ? '未設定' : isEmpty ? 'データなし' : isWeak ? '構造制約' : '有効';
                        return (
                          <span key={src} className={`${cls} flex items-center gap-0.5`} title={label}>
                            {SOURCE_STAR[src]} {SOURCE_LBL[src]}
                          </span>
                        );
                      })}
                    </div>
                    {(candidateResult.weakSources ?? []).length > 0 && (
                      <p className="text-amber-500">
                        ⚠ Notion: participants カラムなし — ページ本文から抽出不可
                      </p>
                    )}
                    {candidateResult.skippedSources.length > 0 && (
                      <p className="text-slate-400">テーブル未設定: {candidateResult.skippedSources.join(', ')}</p>
                    )}
                    {candidateResult.emptySources.length > 0 && (
                      <p className="text-slate-400">データなし: {candidateResult.emptySources.join(', ')}</p>
                    )}
                  </div>
                )}

                {candidateResult.candidates.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">新規候補は見つかりませんでした</p>
                    <p className="text-xs mt-1">既存の連絡先と一致するか、ログにデータがありません</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">{candidateResult.candidates.length}名の候補が見つかりました</p>
                    {candidateResult.candidates.map(c => {
                      const decision = candidateDecisions[c.id] ?? 'ignore';
                      const SOURCE_LABEL: Record<string, string> = {
                        chatwork: 'Chatwork', slack: 'Slack', notion_minutes: '議事録',
                      };
                      return (
                        <div key={c.id} className={`border rounded-lg p-3 text-xs space-y-2 ${
                          decision === 'add'    ? 'border-emerald-200 bg-emerald-50' :
                          decision === 'link'   ? 'border-sky-200 bg-sky-50' :
                          'border-slate-200 bg-white'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-slate-800 truncate">{c.name}</p>
                                <span className={`text-[9px] px-1 rounded border font-medium shrink-0 ${
                                  c.confidence === 'high'   ? 'border-emerald-300 text-emerald-600 bg-emerald-50' :
                                  c.confidence === 'medium' ? 'border-amber-300 text-amber-600 bg-amber-50' :
                                  'border-slate-300 text-slate-400 bg-slate-50'
                                }`}>
                                  {c.confidence === 'high' ? '実名★高' : c.confidence === 'medium' ? '実名★中' : '実名★低'}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {SOURCE_LABEL[c.source] ?? c.source} · {c.sourceRef}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{c.whyPicked}</p>
                              {c.excerpt && (
                                <p className="text-[10px] text-slate-500 mt-0.5 italic line-clamp-1">「{c.excerpt}」</p>
                              )}
                              {c.existingMatch && (
                                <p className="text-[10px] text-sky-600 mt-0.5">
                                  類似: {c.existingMatch.name}（スコア {Math.round(c.existingMatch.similarity * 100)}%）
                                </p>
                              )}
                            </div>
                          </div>
                          {/* アクション選択 */}
                          <div className="flex gap-1.5">
                            {(['add', 'link', 'ignore'] as ContactCandidateAction[]).map(action => {
                              const labels: Record<ContactCandidateAction, string> = {
                                add: '新規追加', link: '既存候補に紐付', ignore: '無視',
                              };
                              const cls: Record<ContactCandidateAction, string> = {
                                add:    'border-emerald-300 text-emerald-700 bg-emerald-50',
                                link:   'border-sky-300 text-sky-700 bg-sky-50',
                                ignore: 'border-slate-200 text-slate-500',
                              };
                              return (
                                <button
                                  key={action}
                                  className={`text-[10px] border rounded px-2 py-0.5 transition-colors ${
                                    decision === action
                                      ? cls[action] + ' font-semibold'
                                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                  }`}
                                  onClick={() => setCandidateDecisions(prev => ({ ...prev, [c.id]: action }))}
                                >
                                  {labels[action]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </ScrollArea>

          {/* Footer */}
          {candidateResult && candidateResult.candidates.length > 0 && (
            <div className="flex-shrink-0 border-t pt-3 mt-1 flex items-center justify-between gap-2">
              <p className="text-[10px] text-slate-400">
                「新規追加」を選んだ{Object.values(candidateDecisions).filter(d => d === 'add').length}名を status=proposed で追加します
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCandidateSheetOpen(false)}>キャンセル</Button>
                <Button
                  size="sm"
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={applyCandidateDecisions}
                  disabled={candidateSaving || Object.values(candidateDecisions).every(d => d !== 'add')}
                >
                  {candidateSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  反映する
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* SF Sync Sheet */}
      <Sheet open={sfSyncSheetOpen} onOpenChange={setSfSyncSheetOpen}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-sky-500" />
              Salesforce Contact 同期
            </SheetTitle>
            <SheetDescription>
              Salesforce Account の Contact を company_people テーブルに同期します
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-3 px-4 pb-4">

              {/* Adapter 接続状態 */}
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg border bg-slate-50 border-slate-200 text-xs">
                <Unplug className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-slate-700">Salesforce adapter: 未接続（制約）</p>
                  <p className="text-slate-500 text-[11px]">Connected App の認証情報未設定。個別の SF push は各連絡先から利用可能。</p>
                  <div className="bg-slate-100 rounded px-2 py-1 font-mono text-[9px] text-slate-400">
                    SALESFORCE_CLIENT_ID / CLIENT_SECRET / LOGIN_URL
                  </div>
                </div>
              </div>

              {/* 同期フロー説明 */}
              <div>
                <p className="text-[11px] font-semibold text-slate-600 mb-1.5">同期フロー（接続後）</p>
                <ol className="text-[11px] text-slate-500 space-y-1 list-none">
                  {[
                    'fetchContactsByAccount(sfAccountId) → SalesforceContact[]',
                    'mapSalesforceContact() → AppPerson 形式に変換',
                    'mergeCompanyPeople() でデュープ検出',
                    'SF のみ → createCompanyPerson()',
                    '両方あり → updateCompanyPerson()（SF wins フィールドのみ）',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[9px] flex-shrink-0 font-medium mt-0.5">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* フィールドポリシー */}
              <div>
                <p className="text-[11px] font-semibold text-slate-600 mb-1.5">フィールド更新ポリシー</p>
                <div className="overflow-x-auto rounded border border-slate-100">
                  <table className="w-full text-[10px] text-slate-500 border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="text-left px-2 py-1 font-medium text-slate-600">フィールド</th>
                        <th className="text-left px-2 py-1 font-medium text-green-600">SF主</th>
                        <th className="text-left px-2 py-1 font-medium text-sky-600">push可</th>
                        <th className="text-left px-2 py-1 font-medium text-indigo-600">CXM主</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ['name', '✓', '', ''],
                        ['title / department', '✓', '✓', ''],
                        ['email / phone', '✓', '✓', ''],
                        ['sf_id / sync_status', '✓', '', ''],
                        ['role / role_type', '', '', '✓'],
                        ['decision_influence / contact_status', '', '', '✓'],
                        ['layer_role / reports_to / works_with', '', '', '✓ Org Chart'],
                      ] as [string, string, string, string][]).map(([field, sf, push, cxm], i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1 font-mono text-[9px]">{field}</td>
                          <td className={`px-2 py-1 ${sf ? 'text-green-600 font-medium' : ''}`}>{sf}</td>
                          <td className={`px-2 py-1 ${push ? 'text-sky-600 font-medium' : ''}`}>{push}</td>
                          <td className={`px-2 py-1 ${cxm ? 'text-indigo-600 font-medium' : ''}`}>{cxm}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 現在の contacts 状態 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded px-3 py-2 text-xs">
                <p className="font-medium text-indigo-700 mb-1">現在の連絡先状態</p>
                <div className="flex gap-4 text-indigo-600 text-[11px]">
                  <span>合計 {orgVM.persons.length}名</span>
                  <span>CXM管理 {localContacts.length}名</span>
                  <span>SF由来 {orgVM.persons.filter(p => p.source === 'salesforce').length}名</span>
                </div>
              </div>

              {/* Dry-run / 本実行 結果（ScrollArea 内に含める） */}
              {(sfDryRunResult || sfSyncResult) && (
                <div className="space-y-2">
                  {sfDryRunResult && <SfDryRunResultView result={sfDryRunResult} label="Dry-run" />}
                  {sfSyncResult   && <SfDryRunResultView result={sfSyncResult}   label="本実行" />}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 pt-3 border-t space-y-2">
            {/* フッターボタン行 */}
            <div className="flex items-center gap-2">
              {/* Dry-run */}
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs gap-1.5"
                disabled={sfDryRunLoading || sfSyncLoading}
                onClick={async () => {
                  setSfDryRunLoading(true);
                  setSfDryRunResult(null);
                  setSfSyncResult(null);
                  try {
                    const res = await fetch(`/api/company/${companyUid}/sf-contacts/sync`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ dryRun: true }),
                    });
                    const data = await res.json() as SfContactSyncResult;
                    setSfDryRunResult(data);
                  } catch (err) {
                    setSfDryRunResult({
                      ok: false, syncResult: 'sync_error', dryRun: true,
                      sfAccountId: companyUid, sfAccountIdSource: 'fallback',
                      warnings: [], error: err instanceof Error ? err.message : String(err),
                    });
                  } finally {
                    setSfDryRunLoading(false);
                  }
                }}
              >
                {sfDryRunLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />確認中...</>
                  : <><ExternalLink className="w-3.5 h-3.5" />Dry-run 確認</>
                }
              </Button>

              {/* 本実行（dry-run 成功後に有効化） */}
              <Button
                size="sm"
                className="flex-1 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                disabled={sfSyncLoading || sfDryRunLoading || !(sfDryRunResult?.ok)}
                onClick={async () => {
                  if (!window.confirm(
                    `Salesforce Contact を company_people テーブルに同期します。\n` +
                    `dry-run 結果: 新規 ${sfDryRunResult?.ok ? (sfDryRunResult.result as SalesforceContactSyncResult).createdCount : 0} 件 / 更新 ${sfDryRunResult?.ok ? (sfDryRunResult.result as SalesforceContactSyncResult).updatedCount : 0} 件\n\n実行しますか？`
                  )) return;
                  setSfSyncLoading(true);
                  setSfSyncResult(null);
                  try {
                    const res = await fetch(`/api/company/${companyUid}/sf-contacts/sync`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ dryRun: false }),
                    });
                    const data = await res.json() as SfContactSyncResult;
                    setSfSyncResult(data);
                  } catch (err) {
                    setSfSyncResult({
                      ok: false, syncResult: 'sync_error', dryRun: false,
                      sfAccountId: companyUid, sfAccountIdSource: 'fallback',
                      warnings: [], error: err instanceof Error ? err.message : String(err),
                    });
                  } finally {
                    setSfSyncLoading(false);
                  }
                }}
              >
                {sfSyncLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />同期中...</>
                  : <>本実行</>
                }
              </Button>

              <Button variant="outline" size="sm" onClick={() => setSfSyncSheetOpen(false)}>
                閉じる
              </Button>
            </div>
            {!sfDryRunResult?.ok && (
              <p className="text-[10px] text-slate-400 text-center">
                先に Dry-run を実行すると「本実行」が有効になります
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── データ品質サマリー ── */}
      <PeopleDataQualityBanner persons={orgVM.persons.map(p => p.raw)} />

      {/* ── Org Chart (top section) ── */}
      <OrgChartSection
        vm={orgVM}
        onEdit={vm => onEditContact(vm.raw)}
        onCreateAction={onCreateAction}
      />

      {/* ── Detailed list ── */}
      {/* Key contacts */}
      {keyContacts.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            意思決定者 / キーコンタクト ({keyContacts.length})
          </h3>
          <div className="grid gap-3">
            {keyContacts.map(p => <PersonCard key={p.id} person={p} onEdit={() => onEditContact(p)} onConfirm={p.status === 'proposed' ? () => confirmPerson(p.id) : undefined} />)}
          </div>
        </div>
      )}

      {/* Other contacts */}
      {others.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            その他コンタクト ({others.length})
          </h3>
          <div className="grid gap-2">
            {others.map(p => <PersonCard key={p.id} person={p} compact onEdit={() => onEditContact(p)} onConfirm={p.status === 'proposed' ? () => confirmPerson(p.id) : undefined} />)}
          </div>
        </div>
      )}

      {/* SF Contact sync 状態説明（not_connected = 制約であり不具合ではない） */}
      {people?.sfSyncStatus === 'not_connected' && (
        <div className="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded p-2 space-y-0.5">
          <p className="font-medium text-slate-500">SF 全体同期: 未接続（SF OAuth 設定待ち）</p>
          <p>個別の連絡先編集 → 「SF push」ボタンで 1件ずつ SF Contact に反映できます。</p>
          <p className="text-slate-300">全体同期は Salesforce Connected App 認証設定後に利用可能になります。</p>
        </div>
      )}

      {orgVM.persons.length === 0 && (
        <p className="text-sm text-slate-400">コンタクト情報なし</p>
      )}
    </div>
  );
}

// ── People データ品質サマリー ─────────────────────────────────────────────────

function PeopleDataQualityBanner({ persons }: { persons: AppPerson[] }) {
  if (persons.length === 0) return null;

  const noEmail    = persons.filter(p => !p.email).length;
  const noInfluence = persons.filter(p => !p.decisionInfluence || p.decisionInfluence === 'unknown').length;
  const noTouchpoint = persons.filter(p => !p.lastTouchpoint).length;
  const noOwner    = persons.filter(p => !p.owner).length;

  const issues: { label: string; count: number; cls: string }[] = [];
  if (noEmail > 0)      issues.push({ label: 'email 未設定',          count: noEmail,      cls: 'text-red-600'   });
  if (noInfluence > 0)  issues.push({ label: 'influence 未分類',       count: noInfluence,  cls: 'text-amber-600' });
  if (noTouchpoint > 0) issues.push({ label: 'last_touchpoint 未記録', count: noTouchpoint, cls: 'text-amber-500' });
  if (noOwner > 0)      issues.push({ label: 'owner 未設定',           count: noOwner,      cls: 'text-slate-500' });

  if (issues.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
      <p className="font-medium text-slate-600 mb-1.5 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        データ品質: 未整備項目
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {issues.map(issue => (
          <span key={issue.label} className={issue.cls}>
            {issue.count}名 — {issue.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PersonCard({
  person,
  compact = false,
  onEdit,
  onConfirm,
}: {
  person:     AppPerson;
  compact?:   boolean;
  onEdit?:    () => void;
  onConfirm?: () => void;
}) {
  const infBadge = DECISION_INFLUENCE_BADGE[person.decisionInfluence ?? 'unknown'];
  const missingFields: string[] = [];
  if (!person.email)                                          missingFields.push('email');
  if (!person.decisionInfluence || person.decisionInfluence === 'unknown') missingFields.push('influence');
  if (!person.lastTouchpoint)                                 missingFields.push('touchpoint');

  return (
    <div className={`bg-white border rounded-lg ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${missingFields.length > 0 ? 'border-slate-200' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm font-medium text-slate-500">
          {person.name.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 text-sm">{person.name}</span>
            <Badge variant="outline" className={`text-[10px] py-0 ${infBadge.cls}`}>
              {infBadge.label}
            </Badge>
            {person.status === 'proposed' && (
              <>
                <Badge variant="outline" className="text-[10px] py-0 bg-amber-50 text-amber-600 border-amber-200">
                  候補
                </Badge>
                {onConfirm && (
                  <button
                    className="text-[9px] px-1.5 py-0 rounded border border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                    onClick={e => { e.stopPropagation(); onConfirm(); }}
                    title="確認済みにする（proposed → confirmed）"
                  >
                    確認済みにする
                  </button>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{person.role}</p>
          {!compact && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
              {person.email
                ? <span>{person.email}</span>
                : <span className="text-slate-300 italic">email 未設定</span>
              }
              {person.lastTouchpoint ? (
                <span className="flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" />
                  最終接触: {person.lastTouchpoint}
                </span>
              ) : (
                <span className="text-slate-300 italic">接触記録なし</span>
              )}
            </div>
          )}
          {!compact && missingFields.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {missingFields.map(f => (
                <span key={f} className="text-[10px] bg-amber-50 text-amber-500 border border-amber-200 rounded px-1.5 py-0.5">
                  {f} 未設定
                </span>
              ))}
            </div>
          )}
        </div>
        {onEdit && (
          <button
            className="text-[10px] text-slate-400 hover:text-slate-600 flex-shrink-0"
            onClick={onEdit}
            title="編集"
          >
            編集
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Org Chart Components
// ════════════════════════════════════════════════════════════════════════════

const TOUCHPOINT_AGE_DOT: Record<TouchpointAge, { cls: string; title: string }> = {
  recent: { cls: 'bg-green-400',  title: '最近接触あり' },
  warn:   { cls: 'bg-amber-400',  title: '30日以上未接触' },
  stale:  { cls: 'bg-red-400',    title: '90日以上未接触' },
  none:   { cls: 'bg-slate-200',  title: '接触記録なし' },
};

// ── Layer node styling ────────────────────────────────────────────────────────
// OrgLayer ごとのカード・アバター・ラベルのスタイル定義

const LAYER_CONFIG: Record<OrgLayer, {
  cardCls:   string;
  avatarCls: string;
  badgeCls:  string;
  rowBg:     string;
  labelCls:  string;
  label:     string;
  icon:      string;  // 絵文字アイコン
}> = {
  executive: {
    cardCls:  'border-amber-300 bg-amber-50/80',
    avatarCls:'bg-amber-500 text-white',
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-300',
    rowBg:    'bg-amber-50/50',
    labelCls: 'text-amber-700',
    label:    '経営層',
    icon:     '★',
  },
  department_head: {
    cardCls:  'border-violet-200 bg-violet-50/60',
    avatarCls:'bg-violet-400 text-white',
    badgeCls: 'bg-violet-50 text-violet-700 border-violet-200',
    rowBg:    'bg-violet-50/30',
    labelCls: 'text-violet-600',
    label:    '部署長',
    icon:     '◆',
  },
  manager: {
    cardCls:  'border-sky-200 bg-sky-50/50',
    avatarCls:'bg-sky-400 text-white',
    badgeCls: 'bg-sky-50 text-sky-700 border-sky-200',
    rowBg:    'bg-sky-50/25',
    labelCls: 'text-sky-600',
    label:    '中間層',
    icon:     '▷',
  },
  operator: {
    cardCls:  'border-slate-200 bg-white',
    avatarCls:'bg-slate-200 text-slate-600',
    badgeCls: 'bg-slate-50 text-slate-500 border-slate-200',
    rowBg:    '',
    labelCls: 'text-slate-500',
    label:    '実務担当',
    icon:     '·',
  },
  unclassified: {
    cardCls:  'border-slate-100 bg-slate-50/50',
    avatarCls:'bg-slate-100 text-slate-400',
    badgeCls: 'bg-gray-50 text-gray-400 border-gray-200',
    rowBg:    '',
    labelCls: 'text-slate-300',
    label:    '未分類',
    icon:     '?',
  },
};

// ── Org person node (compact card) ────────────────────────────────────────────

function OrgPersonNode({
  person,
  onEdit,
  onCreateAction,
  directReports = 0,
  managerName,
  managerSource,
  worksWithNames = [],
}: {
  person:          OrgPersonVM;
  onEdit:          () => void;
  onCreateAction:  () => void;
  /** reportsToPersonId / managerId ベースで何人が自分を親に持つか（0 = 部下なし） */
  directReports?:  number;
  /** この人の上長名（reportsToPersonId > managerId で解決） */
  managerName?:    string;
  /** 上長解決に使ったフィールド（tooltip 表示用） */
  managerSource?:  'reports_to' | 'manager';
  /** works_with_person_ids から解決した協働相手の名前リスト */
  worksWithNames?: string[];
}) {
  const cfg   = LAYER_CONFIG[person.layerRole];
  const tpDot = TOUCHPOINT_AGE_DOT[person.touchpointAge];
  const isExec = person.layerRole === 'executive';

  return (
    <div className={`relative overflow-hidden border rounded-lg p-2.5 flex-shrink-0 ${cfg.cardCls} ${isExec ? 'w-[184px]' : 'w-[168px]'}`}>
      {/* Relation source left border strip: reports_to=実線 sky、manager=破線 slate */}
      {managerSource && (
        <div
          className="absolute top-0 left-0 h-full w-[3px]"
          style={managerSource === 'reports_to'
            ? { background: '#7dd3fc' }
            : { backgroundImage: 'repeating-linear-gradient(to bottom, #cbd5e1 0px, #cbd5e1 4px, transparent 4px, transparent 8px)' }
          }
        />
      )}
      {/* Header */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <div className={`${isExec ? 'w-8 h-8' : 'w-7 h-7'} rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${cfg.avatarCls}`}>
          {person.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-slate-800 truncate flex-1">{person.name}</p>
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tpDot.cls}`}
              title={tpDot.title}
            />
          </div>
          {person.title && (
            <p className="text-[10px] text-slate-500 truncate leading-tight">{person.title}</p>
          )}
          {person.department && (
            <p className="text-[10px] text-slate-400 truncate leading-tight">{person.department}</p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-0.5 mb-1.5">
        <Badge variant="outline" className={`text-[9px] py-0 px-1 ${cfg.badgeCls}`}>
          {cfg.label}
        </Badge>
        {person.isOwner && (
          <Badge variant="outline" className="text-[9px] py-0 px-1 bg-indigo-50 text-indigo-600 border-indigo-200">
            担当CXM
          </Badge>
        )}
        {person.isProposed && (
          <Badge variant="outline" className="text-[9px] py-0 px-1 bg-slate-50 text-slate-400">
            仮
          </Badge>
        )}
        {person.source === 'salesforce' && (
          <Badge variant="outline" className="text-[9px] py-0 px-1 bg-blue-50 text-blue-500 border-blue-200">
            SF
          </Badge>
        )}
      </div>

      {/* Role */}
      {person.role && (
        <p className="text-[10px] text-slate-500 mb-1 truncate">{person.role}</p>
      )}

      {/* Relation hints */}
      {(directReports > 0 || managerName || worksWithNames.length > 0) && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] mb-1">
          {/* 部下数 */}
          {directReports > 0 && (
            <span className="flex items-center gap-0.5 text-slate-400"
              title={`直属の部下 ${directReports}名`}>
              <span className="text-slate-300">↓</span>{directReports}名
            </span>
          )}
          {/* 上長（relation source を tooltip に表示） */}
          {managerName && (
            <span
              className="flex items-center gap-0.5 text-slate-500 min-w-0 max-w-full"
              title={`上長: ${managerName}（${managerSource === 'reports_to' ? 'reports_to_person_id' : 'manager_id'}）`}
            >
              <span className={managerSource === 'reports_to' ? 'text-sky-400' : 'text-slate-300'}>↑</span>
              <span className="truncate">{managerName}</span>
              {managerSource === 'manager' && (
                <span className="text-[8px] text-slate-300 flex-shrink-0">*</span>
              )}
            </span>
          )}
          {/* 横断協働 — 代表名を1〜2名表示、hover で全員をハイライト */}
          {worksWithNames.length > 0 && (
            <span
              className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-500 border border-indigo-100 rounded px-1 cursor-help max-w-full"
              title={`横断協働: ${worksWithNames.join('、')}`}
            >
              <span className="text-indigo-300 flex-shrink-0">⇌</span>
              <span className="truncate text-[9px]">
                {worksWithNames.length === 1
                  ? worksWithNames[0]
                  : worksWithNames.length === 2
                  ? `${worksWithNames[0]}、${worksWithNames[1]}`
                  : `${worksWithNames[0]} +${worksWithNames.length - 1}`
                }
              </span>
            </span>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-0.5 pt-1.5 border-t border-slate-100/80">
        <button
          onClick={onEdit}
          className="text-[10px] text-slate-500 hover:text-slate-700 rounded px-1 py-0.5 hover:bg-slate-50"
        >
          編集
        </button>
        <button
          onClick={onCreateAction}
          className="text-[10px] text-indigo-600 rounded px-1 py-0.5 hover:bg-indigo-50"
        >
          + Action
        </button>
        <button
          className="text-[10px] text-slate-300 cursor-not-allowed rounded px-1 py-0.5 ml-auto"
          title="SF連携は将来実装"
          disabled
        >
          SF↗
        </button>
      </div>
    </div>
  );
}

// ── Org chart manager tree view ───────────────────────────────────────────────

function OrgManagerNode({
  node,
  onEdit,
  onCreateAction,
  personById,
  directReportCount,
}: {
  node:              OrgTreeNode;
  onEdit:            (p: OrgPersonVM) => void;
  onCreateAction:    (p: OrgPersonVM) => void;
  personById:        Map<string, OrgPersonVM>;
  directReportCount: Map<string, number>;
}) {
  const p           = node.person;
  const parentId    = p.raw.reportsToPersonId ?? p.raw.managerId;
  const managerName = parentId ? personById.get(parentId)?.name : undefined;

  if (node.children.length === 0) {
    return (
      <OrgPersonNode
        person={p}
        onEdit={() => onEdit(p)}
        onCreateAction={() => onCreateAction(p)}
        directReports={directReportCount.get(p.id) ?? 0}
        managerName={managerName}
        managerSource={p.parentSource ?? undefined}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Parent card */}
      <OrgPersonNode
        person={p}
        onEdit={() => onEdit(p)}
        onCreateAction={() => onCreateAction(p)}
        directReports={directReportCount.get(p.id) ?? 0}
        managerName={managerName}
        managerSource={p.parentSource ?? undefined}
      />
      {/* Children with CSS tree lines */}
      <div className="relative mt-1 ml-4">
        {/* Vertical bar spanning all children */}
        <div className="absolute left-0 top-0 bottom-3 w-0.5 bg-slate-200" />
        <div className="flex flex-col gap-2 pl-4">
          {node.children.map(child => (
            <div key={child.person.id} className="relative">
              {/* Horizontal connector from vertical bar to card */}
              <div className="absolute -left-4 top-[14px] w-4 h-0.5 bg-slate-200" />
              <OrgManagerNode
                node={child}
                onEdit={onEdit}
                onCreateAction={onCreateAction}
                personById={personById}
                directReportCount={directReportCount}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrgChartManagerTree({
  vm,
  onEdit,
  onCreateAction,
}: {
  vm:             OrgChartVM;
  onEdit:         (p: OrgPersonVM) => void;
  onCreateAction: (p: OrgPersonVM) => void;
}) {
  // reports_to_person_id > manager_id の優先順で事前計算
  const personById        = new Map(vm.persons.map(p => [p.id, p]));
  const directReportCount = new Map<string, number>();
  for (const p of vm.persons) {
    const pid = p.raw.reportsToPersonId ?? p.raw.managerId;
    if (pid) directReportCount.set(pid, (directReportCount.get(pid) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <span className="text-slate-300">coverage</span>
        <span className="font-mono text-slate-500">{Math.round(vm.managerCoverage * 100)}%</span>
        <span className="text-slate-200 mx-1">|</span>
        <span className="text-slate-300">接続線 = reports_to &gt; manager_id</span>
      </div>
      <div className="space-y-4">
        {vm.treeRoots.map(root => (
          <OrgManagerNode
            key={root.person.id}
            node={root}
            onEdit={onEdit}
            onCreateAction={onCreateAction}
            personById={personById}
            directReportCount={directReportCount}
          />
        ))}
      </div>
    </div>
  );
}

// ── Org chart layered view (5-layer horizontal bands) ────────────────────────
// レイヤーごとに横帯を分けて表示する。
//
// 関係線（SVG overlay）:
//   reports_to → 実線 sky-300: 子1人=S字ベジェ / 子複数=T字分岐（幹+横バー+縦ドロップ）
//   manager    → 破線 slate-300: 同上構造、SF由来の暫定上長
//   works_with → 点線 indigo-300: hover 時のみ、相手カードも ring ハイライト
//
// 座標計測: containerRef → [data-pid] → getBoundingClientRect() → 毎 render 後に再計測

const ORG_LAYER_ORDER: OrgLayer[] = [
  'executive', 'department_head', 'manager', 'operator', 'unclassified',
];

function OrgChartLayered({
  vm,
  onEdit,
  onCreateAction,
}: {
  vm:             OrgChartVM;
  onEdit:         (p: OrgPersonVM) => void;
  onCreateAction: (p: OrgPersonVM) => void;
}) {
  // ── DOM refs / SVG lines ──────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [branchPaths, setBranchPaths] = useState<Array<{d: string; type: 'reports_to' | 'manager'}>>([]);
  const [worksPaths,  setWorksPaths]  = useState<Array<{d: string}>>([]);
  const [svgH, setSvgH] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // reports_to_person_id > manager_id の優先順でカウント
  const personById        = new Map(vm.persons.map(p => [p.id, p]));
  const directReportCount = new Map<string, number>();
  for (const p of vm.persons) {
    const pid = p.raw.reportsToPersonId ?? p.raw.managerId;
    if (pid) directReportCount.set(pid, (directReportCount.get(pid) ?? 0) + 1);
  }

  // works_with ホバーで相手カードをハイライト（VM で双方向補完済みのため対称的に動作）
  const highlightedSet = useMemo(() => {
    if (!hoveredId) return new Set<string>();
    const hovered = vm.persons.find(q => q.id === hoveredId);
    return new Set(hovered?.worksWithPersonIds ?? []);
  }, [hoveredId, vm.persons]);

  // ① 分岐構造ライン: 毎 render 後に DOM 座標を計測
  // 子が1人 → S字ベジェ / 子が複数 → T字分岐（幹→横バー→縦ドロップ）
  // reports_to → 実線 sky-300 / manager → 破線 slate-300
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    // parentId → [{id, type}] map を構築
    const childrenByParent = new Map<string, Array<{id: string; type: 'reports_to' | 'manager'}>>();
    for (const p of vm.persons) {
      const pid = p.raw.reportsToPersonId ?? p.raw.managerId;
      if (!pid) continue;
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push({ id: p.id, type: p.raw.reportsToPersonId ? 'reports_to' : 'manager' });
    }

    const paths: typeof branchPaths = [];

    for (const [parentId, children] of childrenByParent) {
      const parentEl = container.querySelector<HTMLElement>(`[data-pid="${parentId}"]`);
      if (!parentEl) continue;
      const pR = parentEl.getBoundingClientRect();
      const px = pR.left + pR.width  / 2 - cRect.left;
      const py = pR.bottom - cRect.top;

      // type ごとにグループ分け
      const rtGroup: Array<{x: number; y: number}> = [];
      const mgGroup: Array<{x: number; y: number}> = [];
      for (const c of children) {
        const el = container.querySelector<HTMLElement>(`[data-pid="${c.id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const coord = { x: r.left + r.width / 2 - cRect.left, y: r.top - cRect.top };
        (c.type === 'reports_to' ? rtGroup : mgGroup).push(coord);
      }

      for (const [type, group] of [['reports_to', rtGroup], ['manager', mgGroup]] as const) {
        if (group.length === 0) continue;

        if (group.length === 1) {
          // 子が1人: S字ベジェ
          const { x: cx, y: cy } = group[0];
          const my = (py + cy) / 2;
          paths.push({ d: `M ${px} ${py} C ${px} ${my} ${cx} ${my} ${cx} ${cy}`, type });
        } else {
          // 子が複数: T字分岐（幹 → 横バー → 縦ドロップ）
          const minCY   = Math.min(...group.map(c => c.y));
          const branchY = py + Math.max(14, (minCY - py) * 0.45);
          const xs      = group.map(c => c.x);
          const minX    = Math.min(...xs);
          const maxX    = Math.max(...xs);
          let d = `M ${px} ${py} L ${px} ${branchY}`;           // 幹
          d    += ` M ${minX} ${branchY} L ${maxX} ${branchY}`; // 横バー
          for (const { x: cx, y: cy } of group) {
            d  += ` M ${cx} ${branchY} L ${cx} ${cy}`;          // 縦ドロップ
          }
          paths.push({ d, type });
        }
      }
    }

    setBranchPaths(paths);
    setSvgH(container.scrollHeight);
  }); // 毎 render 後に再計測（レイアウト変化・resize 対応）

  // ② works_with 点線: ホバー中カードから協働相手への indigo 破線（hover 時のみ）
  useEffect(() => {
    const container = containerRef.current;
    if (!hoveredId || !container) { setWorksPaths([]); return; }
    const cRect = container.getBoundingClientRect();

    const fromEl = container.querySelector<HTMLElement>(`[data-pid="${hoveredId}"]`);
    if (!fromEl) { setWorksPaths([]); return; }
    const fR = fromEl.getBoundingClientRect();
    const fx  = fR.left + fR.width  / 2 - cRect.left;
    const fy  = fR.top  + fR.height / 2 - cRect.top;

    const hovered = vm.persons.find(p => p.id === hoveredId);
    if (!hovered?.worksWithPersonIds.length) { setWorksPaths([]); return; }

    const wPaths: typeof worksPaths = [];
    for (const wid of hovered.worksWithPersonIds) {
      const toEl = container.querySelector<HTMLElement>(`[data-pid="${wid}"]`);
      if (!toEl) continue;
      const tR = toEl.getBoundingClientRect();
      const tx  = tR.left + tR.width  / 2 - cRect.left;
      const ty  = tR.top  + tR.height / 2 - cRect.top;
      // 水平距離に応じて上方向に弧を張る（同レイヤーは大きな弧、異レイヤーは小さい弧）
      const bow  = -(Math.abs(tx - fx) * 0.25 + 20);
      const cpx  = (fx + tx) / 2;
      wPaths.push({ d: `M ${fx} ${fy} C ${cpx} ${fy + bow} ${cpx} ${ty + bow} ${tx} ${ty}` });
    }
    setWorksPaths(wPaths);
  }, [hoveredId, vm.persons]); // hoveredId / データ変化時のみ再計算

  const populated = ORG_LAYER_ORDER
    .map(layer => ({ layer, people: vm.byLayer[layer] ?? [] }))
    .filter(row => row.people.length > 0);

  const hasManagerLinks   = directReportCount.size > 0;
  const hasWorksWithLinks = vm.persons.some(p => p.worksWithPersonIds.length > 0);

  return (
    <div ref={containerRef} className="relative rounded-lg border border-slate-200">
      {/* SVG relation lines overlay — pointer-events-none で操作を透過 */}
      {(branchPaths.length > 0 || worksPaths.length > 0) && (
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: '100%', height: svgH, zIndex: 0 }}
        >
          {/* ① manager 破線（最下層）*/}
          {branchPaths.filter(p => p.type === 'manager').map((p, i) => (
            <path key={`m${i}`} d={p.d} fill="none"
              stroke="#cbd5e1" strokeWidth={1} strokeDasharray="5,3"
              strokeLinecap="round" strokeOpacity={0.75} />
          ))}
          {/* ② reports_to 実線（中層）*/}
          {branchPaths.filter(p => p.type === 'reports_to').map((p, i) => (
            <path key={`r${i}`} d={p.d} fill="none"
              stroke="#7dd3fc" strokeWidth={1.5}
              strokeLinecap="round" strokeOpacity={0.9} />
          ))}
          {/* ③ works_with 点線（最上層・hover 時のみ）*/}
          {worksPaths.map((p, i) => (
            <path key={`w${i}`} d={p.d} fill="none"
              stroke="#a5b4fc" strokeWidth={1.2} strokeDasharray="3,3"
              strokeLinecap="round" strokeOpacity={0.85} />
          ))}
        </svg>
      )}
      {/* Content（z-index: 1 で SVG の上に重ねる） */}
      <div className="relative" style={{ zIndex: 1 }}>
      {populated.map(({ layer, people }, rowIdx) => {
        const cfg        = LAYER_CONFIG[layer];
        const isTopLayer = layer === 'executive';
        const explicitCount = people.filter(p => p.layerIsExplicit).length;

        return (
          <div key={layer}>
            {/* Layer separator — 経営層以降はやや強めの仕切り */}
            {rowIdx > 0 && (
              <div className="flex items-center border-t border-slate-200">
                <div className="flex-1 h-px bg-slate-100" />
                <div className="flex items-center gap-1 px-3 py-0.5 text-[9px] text-slate-300">
                  <ChevronDown className="w-2.5 h-2.5" />
                </div>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
            )}
            {/* Layer row */}
            <div className={`px-4 ${isTopLayer ? 'pt-4 pb-3' : 'pt-3 pb-3'} ${cfg.rowBg}`}>
              <div className="flex items-baseline gap-2 mb-2.5">
                <p className={`text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 ${cfg.labelCls}`}>
                  <span className="opacity-70">{cfg.icon}</span>
                  {cfg.label}
                  <span className="font-normal opacity-50">（{people.length}名）</span>
                </p>
                {/* 実データ確定バッジ（明示的に設定された人がいる場合） */}
                {explicitCount > 0 && (
                  <span className="text-[9px] text-slate-400 bg-white border border-slate-200 rounded px-1">
                    確定 {explicitCount}名
                  </span>
                )}
              </div>
              {(() => {
                // display_group でグループ分け（値なし = department → fallback ''）
                const groupMap = new Map<string, OrgPersonVM[]>();
                for (const p of people) {
                  const grp = p.raw.displayGroup?.trim() || p.department?.trim() || '';
                  if (!groupMap.has(grp)) groupMap.set(grp, []);
                  groupMap.get(grp)!.push(p);
                }
                const showSubGroups = groupMap.size > 1;

                const renderPersons = (ps: OrgPersonVM[]) => (
                  <div className="flex flex-wrap gap-2">
                    {ps.map(p => {
                      const parentId       = p.raw.reportsToPersonId ?? p.raw.managerId;
                      const parentName     = parentId ? personById.get(parentId)?.name : undefined;
                      const worksWithNames = p.worksWithPersonIds
                        .map(wid => personById.get(wid)?.name)
                        .filter((n): n is string => !!n);
                      const isHighlighted  = highlightedSet.has(p.id);
                      return (
                        <div
                          key={p.id}
                          data-pid={p.id}
                          onMouseEnter={() => setHoveredId(p.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          className={`rounded-lg transition-shadow duration-150 ${isHighlighted ? 'ring-2 ring-indigo-300 ring-offset-1' : ''}`}
                        >
                          <OrgPersonNode
                            person={p}
                            onEdit={() => onEdit(p)}
                            onCreateAction={() => onCreateAction(p)}
                            directReports={directReportCount.get(p.id) ?? 0}
                            managerName={parentName}
                            managerSource={p.parentSource ?? undefined}
                            worksWithNames={worksWithNames}
                          />
                        </div>
                      );
                    })}
                  </div>
                );

                if (!showSubGroups) return renderPersons(people);

                return (
                  <div className="space-y-3">
                    {[...groupMap.entries()].map(([grp, ps]) => (
                      <div key={grp || '_ungrouped'}>
                        <p className="text-[10px] font-semibold text-slate-500 tracking-wide mb-2 pl-2 border-l-2 border-slate-200">
                          {grp || '部署不明'}
                          <span className="font-normal text-slate-400 ml-1">（{ps.length}名）</span>
                        </p>
                        {renderPersons(ps)}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
      {/* 凡例フッター */}
      {(hasManagerLinks || hasWorksWithLinks) && (
        <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4 text-[9px] text-slate-400 bg-slate-50 flex-wrap">
          {hasManagerLinks && (
            <>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="10" className="flex-shrink-0">
                  <path d="M 2 5 C 8 5 12 5 18 5" fill="none" stroke="#7dd3fc" strokeWidth="1.5"/>
                </svg>
                reports_to（確定上長）
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="10" className="flex-shrink-0">
                  <path d="M 2 5 C 8 5 12 5 18 5" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,2"/>
                </svg>
                manager（SF由来・暫定）
              </span>
            </>
          )}
          {hasWorksWithLinks && (
            <span className="flex items-center gap-1.5">
              <svg width="20" height="10" className="flex-shrink-0">
                <path d="M 2 5 C 8 2 12 2 18 5" fill="none" stroke="#a5b4fc" strokeWidth="1.2" strokeDasharray="3,3"/>
              </svg>
              横断協働（hover で点線表示・カードハイライト）
            </span>
          )}
        </div>
      )}
      </div>{/* Content wrapper end */}
    </div>
  );
}

// ── Org chart tier view (decision influence ベース、fallback) ─────────────────

function OrgChartTree({
  vm,
  onEdit,
  onCreateAction,
}: {
  vm:             OrgChartVM;
  onEdit:         (p: OrgPersonVM) => void;
  onCreateAction: (p: OrgPersonVM) => void;
}) {
  const TIER_ORDER: Array<{ key: keyof typeof vm.tiers; labelCls: string; label: string }> = [
    { key: 'decision_maker', labelCls: 'text-amber-600', label: '意思決定者' },
    { key: 'influencer',     labelCls: 'text-sky-600',   label: '影響者' },
    { key: 'operator',       labelCls: 'text-slate-500', label: '実務担当' },
    { key: 'unclassified',   labelCls: 'text-slate-300', label: '未分類' },
  ];

  const populated = TIER_ORDER
    .map(t => ({ ...t, people: vm.tiers[t.key] ?? [] }))
    .filter(t => t.people.length > 0);

  return (
    <div className="space-y-3">
      {populated.map((tier, i) => (
        <div key={tier.key}>
          {i > 0 && (
            <div className="flex items-center gap-1 mb-3 text-slate-300">
              <div className="flex-1 border-t border-dashed border-slate-200" />
              <ChevronDown className="w-3 h-3" />
              <div className="flex-1 border-t border-dashed border-slate-200" />
            </div>
          )}
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${tier.labelCls}`}>
            {tier.label}（{tier.people.length}名）
          </p>
          <div className="flex flex-wrap gap-2">
            {tier.people.map(p => (
              <OrgPersonNode
                key={p.id}
                person={p}
                onEdit={() => onEdit(p)}
                onCreateAction={() => onCreateAction(p)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Org chart flat view (department-grouped) ──────────────────────────────────

function OrgChartFlat({
  vm,
  onEdit,
  onCreateAction,
}: {
  vm:             OrgChartVM;
  onEdit:         (p: OrgPersonVM) => void;
  onCreateAction: (p: OrgPersonVM) => void;
}) {
  const sorted = Object.entries(vm.byDepartment).sort(([a], [b]) => {
    if (a === '（部署不明）') return 1;
    if (b === '（部署不明）') return -1;
    return a.localeCompare(b, 'ja');
  });

  return (
    <div className="space-y-4">
      {sorted.map(([dept, people]) => (
        <div key={dept}>
          <p className="text-[10px] font-medium text-slate-400 mb-2">
            {dept}（{people.length}名）
          </p>
          <div className="flex flex-wrap gap-2">
            {people.map(p => (
              <OrgPersonNode
                key={p.id}
                person={p}
                onEdit={() => onEdit(p)}
                onCreateAction={() => onCreateAction(p)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Org chart section (outer wrapper with toggle) ─────────────────────────────
//
// モード選択ロジック:
//   manager_tree  — manager_id カバレッジ ≥ 60%（自動推奨）
//   layered       — 5レイヤー帯状表示（デフォルト for tier ありデータ）★新規
//   tier          — 意思決定影響度ティア別（従来のフォールバック）
//   flat          — 部署別（情報不足時のフォールバック）

type OrgDisplayModeUI = 'manager_tree' | 'layered' | 'tier' | 'flat';

function OrgChartSection({
  vm,
  onEdit,
  onCreateAction,
}: {
  vm:             OrgChartVM;
  onEdit:         (p: OrgPersonVM) => void;
  onCreateAction: (p: OrgPersonVM) => void;
}) {
  // デフォルトモード選択:
  //   manager_tree 推奨 → manager_tree
  //   階層あり → layered（新規デフォルト）
  //   それ以外 → flat
  const defaultMode: OrgDisplayModeUI =
    vm.displayMode === 'manager_tree' ? 'manager_tree'
    : vm.hasHierarchy                 ? 'layered'
    :                                   'flat';

  const [mode, setMode] = useState<OrgDisplayModeUI>(defaultMode);

  if (vm.persons.length === 0) return null;

  const hasManagerTree = vm.managerCoverage > 0;

  return (
    <section className="bg-white border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-slate-400" />
          Org Chart
          <span className="text-xs font-normal text-slate-400">（{vm.persons.length}名）</span>
        </h3>

        <div className="flex items-center gap-3">
          {/* Touchpoint legend */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />最近
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />30d+
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />90d+
            </span>
          </div>

          {/* View toggle */}
          <div className="flex border rounded overflow-hidden text-[10px]">
            {/* 階層 — manager_id 十分な場合のみ表示 */}
            {hasManagerTree && (
              <button
                className={`px-2 py-0.5 transition-colors ${
                  mode === 'manager_tree'
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
                onClick={() => setMode('manager_tree')}
                title={`Manager tree (coverage ${Math.round(vm.managerCoverage * 100)}%)`}
              >
                階層
              </button>
            )}
            <button
              className={`px-2 py-0.5 transition-colors ${
                mode === 'layered'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
              onClick={() => setMode('layered')}
            >
              レイヤー
            </button>
            <button
              className={`px-2 py-0.5 transition-colors ${
                mode === 'tier'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
              onClick={() => setMode('tier')}
            >
              ティア
            </button>
            <button
              className={`px-2 py-0.5 transition-colors ${
                mode === 'flat'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
              onClick={() => setMode('flat')}
            >
              部署別
            </button>
          </div>
        </div>
      </div>

      {/* People risk signals */}
      {vm.peopleRisks.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {vm.peopleRisks.map((risk, i) => {
            const person = vm.persons.find(p => p.id === risk.personId);
            return (
              <div
                key={i}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs border ${
                  risk.severity === 'high'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{risk.label}</span>
                {person && (
                  <button
                    className="text-[10px] underline flex-shrink-0"
                    onClick={() => onCreateAction(person)}
                  >
                    + Action
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <div className="overflow-x-auto">
        {mode === 'manager_tree' ? (
          <OrgChartManagerTree
            vm={vm}
            onEdit={onEdit}
            onCreateAction={onCreateAction}
          />
        ) : mode === 'layered' ? (
          <OrgChartLayered
            vm={vm}
            onEdit={onEdit}
            onCreateAction={onCreateAction}
          />
        ) : mode === 'tier' ? (
          <OrgChartTree
            vm={vm}
            onEdit={onEdit}
            onCreateAction={onCreateAction}
          />
        ) : (
          <OrgChartFlat
            vm={vm}
            onEdit={onEdit}
            onCreateAction={onCreateAction}
          />
        )}
      </div>

      {/* Context notes */}
      <div className="mt-2 flex flex-wrap gap-3 text-[9px] text-slate-400">
        {mode === 'layered' && (
          <span>
            レイヤーは decisionInfluence + 役職キーワードから暫定推定。
            {vm.managerCoverage > 0 && ' ↓N / ↑名 は manager_id ベースの関係。'}
          </span>
        )}
        {mode === 'manager_tree' && (
          <span>接続線は manager_id ベース（coverage {Math.round(vm.managerCoverage * 100)}%）</span>
        )}
        {!vm.hasHierarchy && mode === 'flat' && (
          <span>意思決定影響度の情報がないため部署別表示にフォールバックしています</span>
        )}
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Actions Tab
// ════════════════════════════════════════════════════════════════════════════

function ActionsTab({
  actions,
  onStatusChange,
  onCreateAction,
  onSfTodo,
}: {
  actions:        LocalAction[];
  onStatusChange: (id: string, status: ActionStatus) => void;
  onCreateAction: () => void;
  onSfTodo?:      (action: LocalAction) => void;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const { open, closed } = groupActionsByStatus(actions);

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Actions</h2>
          {open.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{open.length}</span>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onCreateAction}>
          <Plus className="w-3 h-3" />
          Action 作成
        </Button>
      </div>

      {/* Open actions */}
      {open.length > 0 ? (
        <div className="space-y-2">
          {open.map(a => (
            <ActionRow key={a.id} action={a} onStatusChange={onStatusChange} onSfTodo={onSfTodo} />
          ))}
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-8 text-center">
          <p className="text-sm text-slate-400">オープンなアクションなし</p>
          <button
            className="mt-2 text-xs text-indigo-600 hover:underline"
            onClick={onCreateAction}
          >
            + Action を作成する
          </button>
        </div>
      )}

      {/* Closed actions (collapsible) */}
      {closed.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-2"
            onClick={() => setShowClosed(v => !v)}
          >
            {showClosed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            完了 / キャンセル済み（{closed.length}件）
          </button>
          {showClosed && (
            <div className="space-y-2 opacity-70">
              {closed.map(a => (
                <ActionRow key={a.id} action={a} onStatusChange={onStatusChange} onSfTodo={onSfTodo} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionRow({
  action,
  onStatusChange,
  onSfTodo,
}: {
  action:         CompanyActionVM;
  onStatusChange: (id: string, status: ActionStatus) => void;
  onSfTodo?:      (action: LocalAction) => void;
}) {
  const [sfPushState, setSfPushState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sfPushError, setSfPushError] = useState('');

  async function handleSfPush() {
    if (!action.sfTodoId || sfPushState === 'loading') return;
    setSfPushState('loading');
    setSfPushError('');
    try {
      const res = await fetch(`/api/company/${action.companyUid}/actions/${action.id}/sf-push`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sfTaskId:    action.sfTodoId,
          title:       action.title,
          description: action.body,
          dueDate:     action.dueDate,
          ownerEmail:  action.owner,
          status:      action.status,
        }),
      });
      if (res.ok) {
        setSfPushState('success');
        setTimeout(() => setSfPushState('idle'), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSfPushError(data.error ?? 'SF更新失敗');
        setSfPushState('error');
      }
    } catch {
      setSfPushError('ネットワークエラー');
      setSfPushState('error');
    }
  }

  return (
    <div className={`bg-white border rounded-lg px-4 py-3 space-y-2 ${
      action.overdue ? 'border-red-200' : ''
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-2">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${action.statusDotCls}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800">{action.title}</span>
            <Badge variant="outline" className={`text-[10px] py-0 flex-shrink-0 ${action.statusCls}`}>
              {action.statusLabel}
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0 flex-shrink-0 bg-slate-50 text-slate-500">
              {action.fromLabel}
            </Badge>
          </div>
          {action.body && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{action.body}</p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 pl-4 flex-wrap">
        {action.sourceRef && (
          <span className="truncate max-w-[200px]" title={action.sourceRef}>
            元: {action.sourceRef}
          </span>
        )}
        {action.personRef && (
          <span className="text-sky-600">
            対象: {action.personRef}
          </span>
        )}
        {action.dueDateStr && (
          <span className={action.overdue ? 'text-red-500 font-medium' : ''}>
            期日: {action.dueDateStr}{action.overdue && ' (期限超過)'}
          </span>
        )}
        {action.owner && <span>担当: {action.owner}</span>}
        {/* SF ToDo 連動状態 */}
        {action.sfTodoStatus === 'synced' ? (
          <span className="text-green-600 flex items-center gap-0.5">
            <ExternalLink className="w-2.5 h-2.5" />SF連動済
          </span>
        ) : action.sfTodoStatus === 'sync_error' ? (
          <span className="text-red-500 flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />SF連動エラー
            {onSfTodo && (
              <button className="underline ml-1" onClick={() => onSfTodo(action)}>再試行</button>
            )}
          </span>
        ) : onSfTodo ? (
          <button
            className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
            onClick={() => onSfTodo(action)}
            title="Salesforce ToDo を作成する"
          >
            <ExternalLink className="w-2.5 h-2.5" />SF ToDo↗
          </button>
        ) : null}
        {/* SF push ボタン（連動済みの場合のみ） */}
        {action.sfTodoId && action.sfTodoStatus === 'synced' && (
          sfPushState === 'loading' ? (
            <span className="text-[10px] text-sky-400 flex items-center gap-0.5">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />SF更新中...
            </span>
          ) : sfPushState === 'success' ? (
            <span className="text-[10px] text-green-600 flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" />SF更新済
            </span>
          ) : sfPushState === 'error' ? (
            <span className="text-[10px] text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="max-w-[180px] truncate" title={sfPushError}>
                {sfPushError || 'SF更新エラー'}
              </span>
              <button className="underline hover:text-red-700 flex-shrink-0" onClick={handleSfPush}>再push</button>
            </span>
          ) : (
            <button
              className="text-[10px] text-sky-500 hover:text-sky-700 flex items-center gap-0.5"
              title={`CXM → SF push: title / description / due_date / owner / status\nTask ID: ${action.sfTodoId}`}
              onClick={handleSfPush}
            >
              ↑SF更新
            </button>
          )
        )}
        <span className="ml-auto">{action.createdAt.slice(0, 10)}</span>
      </div>

      {/* Status change actions */}
      {(action.status === 'open' || action.status === 'in_progress') && (
        <div className="flex items-center gap-2 pl-4">
          {action.status === 'open' && (
            <button
              className="text-[10px] text-amber-600 hover:underline"
              onClick={() => onStatusChange(action.id, 'in_progress')}
            >
              対応開始
            </button>
          )}
          <button
            className="text-[10px] text-green-600 hover:underline"
            onClick={() => onStatusChange(action.id, 'done')}
          >
            <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
            完了
          </button>
          <button
            className="text-[10px] text-slate-400 hover:underline ml-auto"
            onClick={() => onStatusChange(action.id, 'cancelled')}
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}

// ── SF 警告リスト ─────────────────────────────────────────────────────────────

function SfWarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-1 text-xs">
      <p className="font-medium text-amber-700 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> 警告
      </p>
      {warnings.map((w, i) => (
        <p key={i} className="text-amber-600">{w}</p>
      ))}
    </div>
  );
}

// ── SF Contact Dry-run 結果表示 ──────────────────────────────────────────────
// adapter_not_connected = SF OAuth（Connected App）が未設定の「制約」。不具合ではない。
// salesforce-contact-adapter.ts と sf-contacts/sync ルートは実装済みで、
// SF SALESFORCE_CLIENT_ID 等の環境変数が揃えば即時利用可能になる。

function SfDryRunResultView({ result, label }: { result: SfContactSyncResult; label?: string }) {
  if (!result.ok && result.syncResult === 'adapter_not_connected') {
    const mock = result.mockResult;
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Unplug className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-600">SF Contact 全体同期: 未接続</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-400 bg-white">制約 — 不具合ではありません</span>
        </div>
        <div className="text-slate-500 space-y-1">
          <p>Salesforce Connected App（OAuth）の設定が完了していません。</p>
          <p className="text-emerald-600">✓ 個別の連絡先編集 → 「SF push」ボタンで1件ずつ反映できます。</p>
          <p className="text-slate-400">接続後はこのボタンから全件の dry-run プレビュー → 本実行が可能になります。</p>
        </div>
        {/* カウント表 */}
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { label: 'SF取得', value: mock.sfTotal,       color: 'text-slate-600' },
            { label: '新規作成', value: mock.createdCount,  color: 'text-green-600' },
            { label: '更新',    value: mock.updatedCount,  color: 'text-sky-600'   },
            { label: '変更なし', value: mock.skippedCount,  color: 'text-slate-400' },
            { label: '競合',    value: mock.conflictCount, color: 'text-amber-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded p-1.5">
              <p className={`text-base font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">
          ※ 接続後は sfAccountId を指定して POST /api/company/[uid]/sf-contacts/sync を呼び出します。
        </p>
      </div>
    );
  }

  // sync_error
  if (!result.ok && result.syncResult === 'sync_error') {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <p className="font-medium">同期エラー</p>
          <p className="text-red-600 mt-1">{result.error}</p>
        </div>
        {result.warnings.length > 0 && <SfWarningList warnings={result.warnings} />}
      </div>
    );
  }

  // 成功（実接続後）
  if (result.ok) {
    const r = result.result as SalesforceContactSyncResult;
    const conflictItems = (r.items as ContactSyncItemResult[]).filter(i => i.outcome === 'conflicted');
    const isSync = !result.dryRun;
    const borderCls  = isSync ? 'border-sky-200'  : 'border-green-200';
    const bgCls      = isSync ? 'bg-sky-50'        : 'bg-green-50';
    const cardBorder = isSync ? 'border-sky-200'   : 'border-green-200';
    const headCls    = isSync ? 'text-sky-700'     : 'text-green-700';
    const displayLabel = label ?? (isSync ? '本実行' : 'Dry-run');
    return (
      <div className="space-y-2">
      <div className={`rounded-lg border ${borderCls} ${bgCls} p-3 space-y-3 text-xs`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isSync
            ? <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
            : <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-green-100 text-green-600 border border-green-200">DRY-RUN</span>
          }
          <span className={`font-medium ${headCls}`}>
            {displayLabel}{isSync ? ' — 同期完了' : ' — プレビュー'}
          </span>
          <span className={`font-mono text-[10px] ${isSync ? 'text-sky-500' : 'text-green-600'}`}>{r.sfAccountId}</span>
          {result.sfAccountIdSource === 'fallback' && (
            <span className="text-amber-600 text-[10px]">⚠ sf_account_id 未設定（companyUid を使用中）</span>
          )}
          {result.sfAccountIdSource === 'companies_table' && (
            <span className="text-slate-400 text-[10px]">companies テーブルより解決</span>
          )}
        </div>
        {/* カウント表 */}
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { label: 'SF取得',  value: r.sfTotal,       color: 'text-slate-600' },
            { label: '新規作成', value: r.createdCount,  color: isSync ? 'text-sky-700'   : 'text-green-700' },
            { label: '更新',    value: r.updatedCount,  color: isSync ? 'text-sky-600'   : 'text-sky-700'   },
            { label: '変更なし', value: r.skippedCount,  color: 'text-slate-400' },
            { label: '競合',    value: r.conflictCount, color: 'text-amber-600' },
          ].map(({ label: lbl, value, color }) => (
            <div key={lbl} className={`bg-white border ${cardBorder} rounded p-1.5`}>
              <p className={`text-base font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-400">{lbl}</p>
            </div>
          ))}
        </div>
        {/* 競合詳細 */}
        {conflictItems.length > 0 && (
          <div>
            <p className="font-medium text-amber-700 mb-1">競合の代表例</p>
            <div className="space-y-1">
              {conflictItems.slice(0, 3).map(item => (
                <div key={item.sfId} className="bg-white border border-amber-200 rounded px-2 py-1">
                  <span className="font-medium text-slate-700">{item.name}</span>
                  <span className="text-amber-600 ml-2 font-mono text-[10px]">{item.sfId}</span>
                  {item.conflicts && (
                    <p className="text-amber-500 text-[10px] mt-0.5">{item.conflicts.join(', ')}</p>
                  )}
                </div>
              ))}
              {conflictItems.length > 3 && (
                <p className="text-[10px] text-slate-400">他 {conflictItems.length - 3}件...</p>
              )}
            </div>
          </div>
        )}
      </div>
      {result.warnings.length > 0 && <SfWarningList warnings={result.warnings} />}
      </div>
    );
  }

  return null;
}
