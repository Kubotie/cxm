"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchCaseDetail, fetchSupportCaseAIState, fetchCseTickets } from "@/lib/nocodb-client";
import type { CaseDetail, AppSupportCaseAIState, AppCseTicket } from "@/lib/nocodb-client";
import {
  CaseTypeBadge, SourceBadge, RoutingBadge, SeverityBadge, SourceStatusBadge,
  LifecycleStatusBadge,
} from "@/lib/support/badges";
import { canDismiss, canCreateCseTicket, getCaseAgingMinutes, formatAging } from "@/lib/support/lifecycle";
import { useCaseState } from "@/lib/support/case-state";
import {
  buildCaseViewModel,
  ACTION_STATUS_LABEL, ACTION_STATUS_COLOR, CSE_STATUS_LABEL, CSE_STATUS_COLOR,
} from "@/lib/support/view-model";
import type { QueueItem } from "@/lib/support/queue-adapter";
import type { SupportSummaryApiResponse } from "@/lib/prompts/support-summary";
import type { SupportTriageApiResponse } from "@/lib/prompts/support-triage";
import type { SupportDraftReplyApiResponse } from "@/lib/prompts/support-draft-reply";
import type { SupportAlertApiResponse } from "@/lib/prompts/support-alert";
import type { SummarizeRequestBody, TriageRequestBody, DraftReplyRequestBody } from "@/lib/support/ai-types";
import type { SupportCaseAiViewModel } from "@/lib/support/support-ai-state-view-model";
import { getDecisionRecommendation, resolveEffectiveState } from "@/lib/support/support-ai-state-merge";
import { getAiFreshnessStatus, AI_FRESHNESS_LABELS, REVIEW_STATUS_DESCRIPTIONS } from "@/lib/support/support-ai-state-policy";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Ticket,
  CheckCircle2,
  Building,
  FileText,
  ArrowRight,
  Send,
  Play,
  Lightbulb,
  Loader2,
  RefreshCw,
  Save,
  GitBranch,
  AlertTriangle,
  MessageSquare,
  Bell,
  Zap,
  XCircle,
  SkipForward,
  X,
  Clock,
  User,
  ExternalLink,
  Copy,
  Lock,
} from "lucide-react";

// ── Mock fallback ─────────────────────────────────────────────────────────────
// NocoDB 未設定時のフォールバック。実データ取得後は caseData で上書きされる。

const CASE_DETAIL = {
  id: "sup_1",
  title: "レポート出力時のデータ欠損",
  caseType: "Support",
  source: "Slack",
  company: "グローバルソリューションズ株式会社",
  companyId: "2",
  project: "プロジェクトB",
  projectId: "proj_2",
  owner: "Support Team",
  assignedTeam: "Support",
  routingStatus: "in progress",
  sourceStatus: null as string | null,
  severity: "medium",
  createdAt: "2026-03-17 13:45",
  firstResponseTime: "0h 45m",
  openDuration: "3h 32m",
  waitingDuration: null as string | null,
  linkedCSETicket: null as string | null,
  relatedContent: 2,
  originalMessage: `お世話になっております。

レポート機能について質問させてください。

先週から、月次レポートをエクスポートする際に、
一部のプロジェクトデータが欠損している状態が続いています。

具体的には、
- 2026年2月のプロジェクトA、Cのデータが表示されない
- 3月1日以降は正常に表示される
- フィルタを変更しても同じ状況

原因と対処方法を教えていただけますでしょうか。

よろしくお願いいたします。`,
  triageNote: "データ同期の問題の可能性あり。Support Team で初期調査を実施。CSE連携が必要か判断中。",
};

// ── Fallback VM adapter ───────────────────────────────────────────────────────
// Converts the mock CASE_DETAIL shape to QueueItem-compatible shape so that
// buildCaseViewModel() can always be called — even before real data arrives.
// This ensures `vm` is never null and all JSX reads from a single interface.
function mockToQueueItem(id: string): QueueItem {
  return {
    id,
    sourceTable:       'log_intercom',
    title:             CASE_DETAIL.title,
    bodyExcerpt:       '',
    caseType:          CASE_DETAIL.caseType,
    source:            CASE_DETAIL.source,
    companyUid:        CASE_DETAIL.companyId,
    companyName:       CASE_DETAIL.company,
    projectName:       CASE_DETAIL.project,
    projectId:         null,
    owner:             CASE_DETAIL.owner,
    assignedTeam:      CASE_DETAIL.assignedTeam,
    routingStatus:     CASE_DETAIL.routingStatus,
    sourceStatus:      CASE_DETAIL.sourceStatus,
    severity:          CASE_DETAIL.severity,
    createdAt:         CASE_DETAIL.createdAt,
    firstResponseTime: CASE_DETAIL.firstResponseTime,
    openDuration:      CASE_DETAIL.openDuration,
    waitingDuration:   CASE_DETAIL.waitingDuration,
    linkedCSETicket:   CASE_DETAIL.linkedCSETicket,
    relatedContent:    CASE_DETAIL.relatedContent,
    triageNote:        CASE_DETAIL.triageNote,
  };
}

const AI_STATE_FALLBACK = {
  summary:        "（AI サマリー未生成）",
  suggestedOwner: "—",
  suggestedTeam:  "—",
  urgency:        "—",
  nextSteps:      [] as string[],
};

// ── Main component ────────────────────────────────────────────────────────────

export function SupportDetail() {
  const params = useParams();
  const id = params.caseId as string;

  // ── ソース: 実ケースデータ ─────────────────────────────────────────────────
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [aiState, setAiState]   = useState<AppSupportCaseAIState | null>(null);
  const [cseTickets, setCseTickets] = useState<AppCseTicket[]>([]);

  // ── Global case state ─────────────────────────────────────────────────────
  const { isDismissed, dismissCase, undismissCase, createAction, createCseTicket, getCaseRecord, loadCaseState } = useCaseState();

  // ── Dismiss confirm UI ────────────────────────────────────────────────────
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [dismissNote, setDismissNote]               = useState("");

  // ── Internal note ─────────────────────────────────────────────────────────
  const [internalNote, setInternalNote] = useState("");

  // ── AI Summary ────────────────────────────────────────────────────────────
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult]   = useState<SupportSummaryApiResponse | null>(null);
  const [summaryError, setSummaryError]     = useState<string | null>(null);

  // ── AI Triage ─────────────────────────────────────────────────────────────
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult]   = useState<SupportTriageApiResponse | null>(null);
  const [triageError, setTriageError]     = useState<string | null>(null);

  // ── AI Draft Reply ────────────────────────────────────────────────────────
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftResult, setDraftResult]   = useState<SupportDraftReplyApiResponse | null>(null);
  const [draftError, setDraftError]     = useState<string | null>(null);
  const [draftTone, setDraftTone]       = useState<'formal' | 'friendly' | 'technical'>('formal');

  // ── AI Alert ──────────────────────────────────────────────────────────────
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertResult, setAlertResult]   = useState<SupportAlertApiResponse | null>(null);
  const [alertError, setAlertError]     = useState<string | null>(null);

  // ── New AI state (support_case_ai_state) ─────────────────────────────────
  const [newAiVm, setNewAiVm]         = useState<SupportCaseAiViewModel | null>(null);
  const [newAiVmLoaded, setNewAiVmLoaded] = useState(false);

  // ── Human Review ──────────────────────────────────────────────────────────
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSaveError, setReviewSaveError] = useState<string | null>(null);

  // ── Batch 一括更新 ────────────────────────────────────────────────────────
  type BatchStepStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped';
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchSteps, setBatchSteps]     = useState<{
    summary: BatchStepStatus; triage: BatchStepStatus;
    draft: BatchStepStatus;   alert: BatchStepStatus;
  }>({ summary: 'idle', triage: 'idle', draft: 'idle', alert: 'idle' });
  const [batchDoneAt, setBatchDoneAt] = useState<Date | null>(null);

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    fetchCaseDetail(id)
      .then(data => { if (data) setCaseData(data); })
      .catch(err => console.warn('[SupportDetail] case fetch failed:', err));
    fetchCseTickets({ caseId: id })
      .then(data => { if (data.length > 0) setCseTickets(data); })
      .catch(err => console.warn('[SupportDetail] CSE tickets fetch failed:', err));
    // ── 永続化済み case state をロード ─────────────────────────────────────
    loadCaseState(id).catch(err => console.warn('[SupportDetail] state load failed:', err));
  }, [id, loadCaseState]);

  useEffect(() => {
    if (!id) return;
    const sourceTable = caseData?.sourceTable === 'cse_tickets' ? 'cseticket_queue' : 'support_queue';
    fetchSupportCaseAIState(id, sourceTable)
      .then(data => { if (data) setAiState(data); })
      .catch(err => console.warn('[SupportDetail] AI state fetch failed:', err));
    // 新 AI state (support_case_ai_state) を取得
    // hasAiState=false の VM も保持して「AI 未分析」プレースホルダーを表示するため
    // hasAiState チェックを外してすべて setNewAiVm に渡す
    const sourceQueue = caseData?.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom';
    fetch(`/api/support/cases/${id}/ai-state?source_queue=${sourceQueue}`)
      .then(r => r.ok ? r.json() : null)
      .then((vm: SupportCaseAiViewModel | null) => {
        if (vm) setNewAiVm(vm);
        setNewAiVmLoaded(true);
      })
      .catch(err => {
        console.warn('[SupportDetail] new AI state fetch failed:', err);
        setNewAiVmLoaded(true);
      });
  }, [id, caseData?.sourceTable]);

  const aiSuggestions = aiState
    ? { summary: aiState.summary, suggestedOwner: aiState.suggestedOwner,
        suggestedTeam: aiState.suggestedTeam, urgency: aiState.urgency, nextSteps: aiState.nextSteps }
    : AI_STATE_FALLBACK;

  // ── Lifecycle state (VM-based when caseData is available) ─────────────────
  const caseRecord    = getCaseRecord(id);
  const actionRecord  = caseRecord?.action    ?? null;
  const cseRecord     = caseRecord?.cseTicket ?? null;
  const dismissRecord = caseRecord?.dismiss   ?? null;

  // vm is always defined — real data when available, mock fallback when loading.
  // Single source of truth for all derived/lifecycle state in this component.
  const vm            = buildCaseViewModel(caseData ?? mockToQueueItem(id), caseRecord);
  const dismissed     = vm.isDismissed;
  const lifecycleStatus = vm.lifecycleStatus;
  const homeReasons   = vm.homeReasons;
  const agingMinutes  = vm.agingMinutes;

  // ── AI context — always vm-based ──────────────────────────────────────────

  const caseCtx = {
    title:           vm.title,
    caseType:        vm.caseType,
    source:          vm.sourceType,
    company:         vm.companyName,
    project:         vm.projectName ?? undefined,
    severity:        vm.severity,
    routingStatus:   vm.routingStatus,
    assignedTeam:    vm.assignedTeam ?? undefined,
    openDuration:    vm.openDuration,
    linkedCSETicket: vm.linkedCSETicket ?? undefined,
    originalMessage: vm.originalMessage,
    triageNote:      vm.triageNote,
    lifecycleStatus: vm.lifecycleStatus,
    homeReasons:     vm.homeReasons.map(r => r.label),
    actionStatus:    vm.actionStatus ?? undefined,
    actionOwner:     vm.actionOwner  ?? undefined,
    cseTicketStatus: vm.cseTicketStatus ?? undefined,
    isDismissed:     vm.isDismissed,
  };

  async function generateSummary(save: boolean): Promise<boolean> {
    setSummaryLoading(true); setSummaryError(null);
    try {
      const body: SummarizeRequestBody = { sourceTable: 'support_queue', save, caseContext: caseCtx };
      const res  = await fetch(`/api/support/${id}/summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSummaryResult(data as SupportSummaryApiResponse);
      return true;
    } catch (err) { setSummaryError(err instanceof Error ? err.message : String(err)); return false; }
    finally      { setSummaryLoading(false); }
  }

  async function generateTriage(save: boolean): Promise<boolean> {
    setTriageLoading(true); setTriageError(null);
    try {
      const body: TriageRequestBody = { sourceTable: 'support_queue', save, caseContext: caseCtx };
      const res  = await fetch(`/api/support/${id}/triage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTriageResult(data as SupportTriageApiResponse);
      return true;
    } catch (err) { setTriageError(err instanceof Error ? err.message : String(err)); return false; }
    finally      { setTriageLoading(false); }
  }

  async function generateDraftReply(save: boolean): Promise<boolean> {
    setDraftLoading(true); setDraftError(null);
    try {
      const body: DraftReplyRequestBody = { tone: draftTone, language: 'ja', save, caseContext: caseCtx };
      const res  = await fetch(`/api/support/${id}/draft-reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDraftResult(data as SupportDraftReplyApiResponse);
      return true;
    } catch (err) { setDraftError(err instanceof Error ? err.message : String(err)); return false; }
    finally      { setDraftLoading(false); }
  }

  async function generateAlert(save: boolean): Promise<boolean> {
    setAlertLoading(true); setAlertError(null);
    try {
      const body = { sourceTable: 'support_queue', save, caseContext: caseCtx };
      const res  = await fetch(`/api/support/${id}/alert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAlertResult(data as SupportAlertApiResponse);
      return true;
    } catch (err) { setAlertError(err instanceof Error ? err.message : String(err)); return false; }
    finally      { setAlertLoading(false); }
  }

  async function refreshAllAI() {
    setBatchRunning(true); setBatchDoneAt(null);
    setBatchSteps({ summary: 'idle', triage: 'idle', draft: 'idle', alert: 'idle' });
    const setStep = (step: keyof typeof batchSteps, status: BatchStepStatus) =>
      setBatchSteps(prev => ({ ...prev, [step]: status }));
    setStep('summary', 'running');
    setStep('summary', await generateSummary(true) ? 'done' : 'failed');
    setStep('triage', 'running');
    setStep('triage', await generateTriage(true) ? 'done' : 'failed');
    setStep('draft', 'running');
    setStep('draft', await generateDraftReply(true) ? 'done' : 'failed');
    setStep('alert', 'running');
    setStep('alert', await generateAlert(true) ? 'done' : 'failed');
    setBatchRunning(false); setBatchDoneAt(new Date());
  }

  function confirmDismiss() {
    dismissCase(id, { reason: dismissNote || undefined });
    setShowDismissConfirm(false);
  }

  // ── AI decision recommendation ────────────────────────────────────────────
  const decisionRec = getDecisionRecommendation(newAiVm);
  const sourceQueue = caseData?.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom';
  const eff         = resolveEffectiveState(caseData ?? mockToQueueItem(id), newAiVm);
  const freshness   = getAiFreshnessStatus(
    newAiVm
      ? { hasAiState: newAiVm.hasAiState, humanReviewStatus: newAiVm.humanReviewStatus, lastAiUpdatedAt: newAiVm.lastAiUpdatedAt }
      : { hasAiState: false, humanReviewStatus: 'pending', lastAiUpdatedAt: null },
  );
  const freshnessInfo = AI_FRESHNESS_LABELS[freshness];

  async function saveHumanReview(status: string) {
    setReviewSaving(true); setReviewSaveError(null);
    try {
      const res = await fetch(`/api/support/cases/${id}/ai-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_review_status: status, source_queue: sourceQueue }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      // ViewModel を更新してバッジを即時反映
      setNewAiVm(prev => prev ? { ...prev, humanReviewStatus: status as SupportCaseAiViewModel['humanReviewStatus'] } : prev);
    } catch (err) {
      setReviewSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support Detail" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-6 space-y-5">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="bg-white border rounded-xl p-5 space-y-4">
              {/* Row 1: back + title + action buttons */}
              <div className="flex items-start gap-3">
                <Link href="/support/queue" className="flex-shrink-0 mt-0.5">
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-slate-900 leading-tight">{vm.title}</h1>
                  {/* Row 2: type / source / routing / severity / source_status / lifecycle */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <CaseTypeBadge type={vm.caseType} />
                    <SourceBadge source={vm.sourceType} />
                    <RoutingBadge status={vm.routingStatus} />
                    <SeverityBadge severity={vm.severity} />
                    {vm.sourceStatus && <SourceStatusBadge status={vm.sourceStatus} />}
                    <LifecycleStatusBadge status={lifecycleStatus} />
                    {vm.homeReasons[0] && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${vm.homeReasons[0].className}`}>
                        {vm.homeReasons[0].label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline" size="sm"
                    onClick={refreshAllAI}
                    disabled={batchRunning || !decisionRec.canRegenerate}
                    title={!decisionRec.canRegenerate ? 'AI提案が承認済みのため再生成できません' : undefined}
                    className={`${decisionRec.canRegenerate ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {batchRunning
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Zap className="w-4 h-4 mr-2" />
                    }
                    Refresh AI
                  </Button>
                  {vm.companyUid && (
                    <Link href={`/companies/${vm.companyUid}`}>
                      <Button variant="outline" size="sm">
                        <Building className="w-4 h-4 mr-2" />Company
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Row 3: metadata strip */}
              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 flex-wrap text-xs text-slate-500">
                {/* Company */}
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  {vm.companyUid ? (
                    <Link href={`/companies/${vm.companyUid}`} className="text-blue-600 hover:underline font-medium">
                      {vm.companyName}
                    </Link>
                  ) : (
                    <span className="text-slate-700 font-medium">{vm.companyName}</span>
                  )}
                </span>
                {/* Project */}
                {vm.projectName && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>{vm.projectName}</span>
                  </span>
                )}
                {/* Owner */}
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{vm.ownerDisplayName}</span>
                  {vm.assignedTeam && <span className="text-slate-400">/ {vm.assignedTeam}</span>}
                </span>
                {/* Timestamps */}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{vm.createdAt}</span>
                </span>
                {vm.openDuration && (
                  <span className="text-slate-500">Open: {vm.openDuration}</span>
                )}
                {vm.waitingDuration && (
                  <span className="text-amber-600">待機: {vm.waitingDuration}</span>
                )}
                {agingMinutes !== null && agingMinutes > 2880 && (
                  <span className="text-rose-600 font-medium">
                    経過: {formatAging(agingMinutes)} ⚠
                  </span>
                )}
                {/* Linked CSE */}
                {vm.linkedCSETicket && (
                  <span className="flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-amber-700">{vm.linkedCSETicket}</span>
                  </span>
                )}
                {/* Case ID + copy */}
                <button
                  onClick={() => navigator.clipboard.writeText(id)}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-600 ml-auto"
                  title="Case ID をコピー"
                >
                  <Copy className="w-3 h-3" /> {id}
                </button>
              </div>
            </div>

            {/* ── Batch progress ──────────────────────────────────────────── */}
            {(batchRunning || batchDoneAt) && (() => {
              const steps: { key: keyof typeof batchSteps; label: string }[] = [
                { key: 'summary', label: 'AI Summary' }, { key: 'triage', label: 'AI Triage' },
                { key: 'draft',   label: 'Draft Reply' }, { key: 'alert',  label: 'Alert' },
              ];
              const anyFailed = steps.some(s => batchSteps[s.key] === 'failed');
              const allFailed = steps.every(s => batchSteps[s.key] === 'failed');
              return (
                <div className={`rounded-lg border p-4 ${
                  batchRunning ? 'bg-amber-50 border-amber-200' :
                  allFailed    ? 'bg-red-50 border-red-200' :
                  anyFailed    ? 'bg-yellow-50 border-yellow-200' :
                                 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      {batchRunning
                        ? <><Loader2 className="w-4 h-4 animate-spin text-amber-600" /> AI 一括更新中...</>
                        : allFailed
                          ? <><XCircle className="w-4 h-4 text-red-600" /> 全ステップが失敗しました</>
                          : anyFailed
                            ? <><AlertTriangle className="w-4 h-4 text-yellow-600" /> 一部のステップが失敗しました</>
                            : <><CheckCircle2 className="w-4 h-4 text-green-600" /> AI 一括更新が完了しました</>
                      }
                    </span>
                    {batchDoneAt && (
                      <span className="text-xs text-slate-400">{batchDoneAt.toLocaleTimeString('ja-JP')}</span>
                    )}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {steps.map(({ key, label }) => {
                      const status = batchSteps[key];
                      const cfg = {
                        idle:    { bg: 'bg-slate-100 text-slate-400',   icon: null },
                        running: { bg: 'bg-amber-100 text-amber-700',   icon: <Loader2 className="w-3 h-3 animate-spin" /> },
                        done:    { bg: 'bg-green-100 text-green-700',   icon: <CheckCircle2 className="w-3 h-3" /> },
                        failed:  { bg: 'bg-red-100 text-red-700',       icon: <XCircle className="w-3 h-3" /> },
                        skipped: { bg: 'bg-slate-100 text-slate-500',   icon: <SkipForward className="w-3 h-3" /> },
                      }[status];
                      return (
                        <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>
                          {cfg.icon}{label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ══ DECISION PANEL ══════════════════════════════════════════════ */}
            <div className="space-y-3">

              {/* ── DISMISSED ─────────────────────────────────────────────── */}
              {vm.showDismissBanner && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-slate-700">「対応不要」としてアーカイブしました</p>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-2">
                        {dismissRecord?.dismissed_at && (
                          <>
                            <span className="text-slate-400">いつ</span>
                            <span className="col-span-2">{new Date(dismissRecord.dismissed_at).toLocaleString('ja-JP')}</span>
                          </>
                        )}
                        {dismissRecord?.dismissed_by && (
                          <>
                            <span className="text-slate-400">誰が</span>
                            <span className="col-span-2">{dismissRecord.dismissed_by}</span>
                          </>
                        )}
                        {dismissRecord?.dismissed_reason && (
                          <>
                            <span className="text-slate-400">理由</span>
                            <span className="col-span-2">{dismissRecord.dismissed_reason}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 pt-1">Queue では dismissed として管理されます。</p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="text-xs text-slate-500 hover:text-slate-700 flex-shrink-0"
                      onClick={() => { undismissCase(id); setDismissNote(""); }}
                    >
                      取り消す
                    </Button>
                  </div>
                </div>
              )}

              {/* ── ACTION STATUS PANEL ────────────────────────────────────── */}
              {vm.showActionPanel && actionRecord && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
                  <Play className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-teal-800">
                        {actionRecord.title ?? 'Action を作成しました'}
                      </p>
                      {actionRecord.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${ACTION_STATUS_COLOR[actionRecord.status] ?? ''}`}>
                          {ACTION_STATUS_LABEL[actionRecord.status] ?? actionRecord.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-teal-600 mt-0.5">
                      {new Date(actionRecord.created_at).toLocaleString('ja-JP')}
                      {actionRecord.owner && ` · ${actionRecord.owner}`}
                      {actionRecord.action_id && ` · ID: ${actionRecord.action_id}`}
                    </p>
                  </div>
                </div>
              )}

              {/* ── CSE TICKET STATUS PANEL ────────────────────────────────── */}
              {vm.showCsePanel && cseRecord && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Ticket className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-amber-800">
                        {cseRecord.title ?? 'CSE Ticket を作成しました'}
                      </p>
                      {cseRecord.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CSE_STATUS_COLOR[cseRecord.status] ?? ''}`}>
                          {CSE_STATUS_LABEL[cseRecord.status] ?? cseRecord.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-600 mt-0.5">
                      作成: {new Date(cseRecord.created_at).toLocaleString('ja-JP')}
                      {cseRecord.updated_at !== cseRecord.created_at && (
                        <> · 更新: {new Date(cseRecord.updated_at).toLocaleString('ja-JP')}</>
                      )}
                      {cseRecord.owner && ` · ${cseRecord.owner}`}
                      {cseRecord.ticket_id && ` · Ticket ID: ${cseRecord.ticket_id}`}
                    </p>
                  </div>
                </div>
              )}

              {/* ── ACTIVE PANEL (not dismissed) ───────────────────────────── */}
              {!vm.showDismissBanner && (
                <div className={`bg-white rounded-xl p-5 space-y-4 ${vm.isReadOnlyLike ? 'border border-slate-200' : 'border-2 border-slate-200'}`}>

                  {/* Resolved state — read-only, no mutations */}
                  {vm.isReadOnlyLike ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700">この案件は解決済みです</p>
                        <p className="text-xs text-slate-400 mt-0.5">新たな Action や Dismiss は行えません。内容の確認のみ可能です。</p>
                      </div>
                    </div>
                  ) : (
                    <>
                  {/* AI バナー: approved / pending */}
                  {decisionRec.aiApproved && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      AI提案が承認済みです
                    </div>
                  )}
                  {decisionRec.aiPending && !decisionRec.aiApproved && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      AI提案を確認してください
                    </div>
                  )}

                  {/* Title + recommended reason */}
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-slate-900">この案件をどう扱いますか？</h2>
                    {homeReasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {homeReasons.map(r => (
                          <span key={r.id} className={`text-xs px-2 py-0.5 rounded-full border ${r.className}`}>
                            {r.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Primary CTAs */}
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      className="flex-1 min-w-[140px] bg-slate-900 hover:bg-slate-700 text-white gap-2"
                      onClick={() => createAction(id)}
                    >
                      <Play className="w-4 h-4" />
                      {actionRecord ? 'Action を追加' : 'Action を作成'}
                    </Button>
                    {canCreateCseTicket(vm) && (
                      <Button
                        variant={decisionRec.emphasizeCseTicket ? "default" : "outline"}
                        className={`flex-1 min-w-[140px] gap-2 ${
                          decisionRec.emphasizeCseTicket
                            ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                            : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                        }`}
                        onClick={() => createCseTicket(id)}
                      >
                        <Ticket className="w-4 h-4" />
                        {cseRecord ? 'CSE Ticket を追加' : 'CSE Ticket を作成'}
                        {decisionRec.emphasizeCseTicket && (
                          <span className="text-[10px] font-bold">← AI推奨</span>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* AI suggestedAction ヒント */}
                  {decisionRec.suggestedActionHint && (
                    <div className="flex items-start gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                      <Zap className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <span>AI推奨: {decisionRec.suggestedActionHint}</span>
                    </div>
                  )}

                  {/* その他 CTAs (Dismiss) */}
                  <div className="flex gap-3 flex-wrap">{/* ← 下の Dismiss ボタンをラップするため */}
                    {canDismiss(vm, vm.isDismissed) && (
                      <Button
                        variant="outline"
                        className="flex-1 min-w-[140px] border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 gap-2"
                        onClick={() => setShowDismissConfirm(v => !v)}
                      >
                        <X className="w-4 h-4" />
                        対応不要
                      </Button>
                    )}
                  </div>
                    </>
                  )}

                  {/* Secondary CTAs — available regardless of resolved state */}
                  <div className="flex gap-2 flex-wrap pt-1 border-t border-slate-100">
                    <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-700 gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />内部メモを追加
                    </Button>
                    {!vm.isReadOnlyLike && (
                      <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-700 gap-1.5">
                        <Send className="w-3.5 h-3.5" />Outbound を準備
                      </Button>
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/support/${id}`)}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-50"
                    >
                      <Copy className="w-3 h-3" />リンクをコピー
                    </button>
                    {vm.linkedCSETicket && (
                      <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-700 gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />CSE Ticket を開く
                      </Button>
                    )}
                  </div>

                  {/* Dismiss confirm */}
                  {showDismissConfirm && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-slate-700">
                        この案件を <strong>「対応不要」</strong> としてアーカイブしますか？<br />
                        <span className="text-slate-500 text-xs">Support Home から除外されます。Queue では dismissed として確認できます。</span>
                      </p>
                      <Textarea
                        placeholder="理由を入力（任意）..."
                        value={dismissNote}
                        onChange={e => setDismissNote(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm" variant="outline"
                          className="border-slate-400 text-slate-700 hover:bg-slate-100"
                          onClick={confirmDismiss}
                        >
                          アーカイブする
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="text-slate-500"
                          onClick={() => { setShowDismissConfirm(false); setDismissNote(""); }}
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Main 2/3 + 1/3 grid ──────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-6">

              {/* ── Left column: Evidence + AI ─────────────────────────────── */}
              <div className="col-span-2 space-y-5">

                {/* Original Message / Evidence */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Original Message / Ticket Summary</CardTitle>
                    <CardDescription>{vm.sourceType} • {vm.createdAt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 border rounded-lg p-4">
                      {vm.originalMessage
                        ? <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{vm.originalMessage}</pre>
                        : <p className="text-sm text-slate-400 italic">（本文なし）</p>
                      }
                    </div>
                  </CardContent>
                </Card>

                {/* Triage Note（実データがある場合のみ表示）*/}
                {vm.triageNote && (
                  <Card className="border-slate-200 bg-slate-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Triage Note
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-700">{vm.triageNote}</p>
                    </CardContent>
                  </Card>
                )}

                {/* ── AI Summary ───────────────────────────────────────────── */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-blue-600" />
                        AI Summary
                        {summaryResult && (
                          <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-700 font-normal">
                            {summaryResult.model}
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white" onClick={() => generateSummary(false)} disabled={summaryLoading}>
                          {summaryLoading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                          {summaryResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => generateSummary(true)} disabled={summaryLoading}>
                          <Save className="w-3 h-3 mr-1.5" />Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {summaryLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700">AI でサマリーを生成中...</span>
                    </CardContent>
                  )}
                  {!summaryLoading && summaryError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">⚠ {summaryError}</div>
                      <Button size="sm" variant="outline" onClick={() => generateSummary(false)}>
                        <RefreshCw className="w-3 h-3 mr-1.5" />再試行
                      </Button>
                    </CardContent>
                  )}
                  {!summaryLoading && summaryResult && (
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={summaryResult.severity === 'high' ? 'bg-red-600 text-white text-xs' : summaryResult.severity === 'medium' ? 'bg-amber-500 text-white text-xs' : 'bg-slate-400 text-white text-xs'}>
                          {summaryResult.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-800">{summaryResult.product_area}</Badge>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">AI サマリー</div>
                        <p className="text-sm text-blue-800">{summaryResult.ai_summary}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">顧客の意図</div>
                        <p className="text-sm text-blue-800">{summaryResult.customer_intent}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-2">推奨ネクストアクション</div>
                        <ul className="space-y-1.5">
                          {summaryResult.suggested_next_steps.map((step, idx) => (
                            <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />{step}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="text-xs text-blue-700 italic border-t border-blue-200 pt-3">{summaryResult.urgency_reasoning}</div>
                      <div className="flex items-center justify-between text-xs text-blue-400 border-t border-blue-200 pt-3">
                        <span>生成: {new Date(summaryResult.generated_at).toLocaleString('ja-JP')}</span>
                        {summaryResult.saved && <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 className="w-3 h-3" />保存済み</span>}
                      </div>
                    </CardContent>
                  )}
                  {!summaryLoading && !summaryResult && !summaryError && (
                    <CardContent>
                      {aiState ? (
                        <div className="space-y-3 opacity-60">
                          <p className="text-sm text-blue-800">{aiSuggestions.summary}</p>
                          <p className="text-xs text-blue-600">↑ 「Generate Only」を押すとリアルタイムで生成します</p>
                        </div>
                      ) : (
                        <div className="py-4 text-center opacity-60">
                          <Lightbulb className="w-7 h-7 mx-auto text-blue-400 mb-1.5" />
                          <p className="text-xs text-blue-600">「Generate Only」または「Generate &amp; Save」を押してください</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>

                {/* ── AI Triage ─────────────────────────────────────────────── */}
                <Card className="border-violet-200 bg-violet-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-violet-600" />
                        AI Triage
                        {triageResult && (
                          <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-700 font-normal">{triageResult.model}</Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white" onClick={() => generateTriage(false)} disabled={triageLoading}>
                          {triageLoading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                          {triageResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white border-violet-300 text-violet-700 hover:bg-violet-50" onClick={() => generateTriage(true)} disabled={triageLoading}>
                          <Save className="w-3 h-3 mr-1.5" />Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {triageLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                      <span className="text-sm text-violet-700">AI でトリアージを生成中...</span>
                    </CardContent>
                  )}
                  {!triageLoading && triageError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">⚠ {triageError}</div>
                      <Button size="sm" variant="outline" onClick={() => generateTriage(false)}><RefreshCw className="w-3 h-3 mr-1.5" />再試行</Button>
                    </CardContent>
                  )}
                  {!triageLoading && triageResult && (
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={triageResult.severity === 'high' ? 'bg-red-600 text-white text-xs' : triageResult.severity === 'medium' ? 'bg-amber-500 text-white text-xs' : 'bg-slate-400 text-white text-xs'}>
                          {triageResult.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-800">→ {triageResult.suggested_team}</Badge>
                        <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-700">{triageResult.category}</Badge>
                        {triageResult.escalation_needed && (
                          <Badge className="bg-orange-500 text-white text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />Escalation
                          </Badge>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-violet-900 mb-1">トリアージ所見</div>
                        <p className="text-sm text-violet-800">{triageResult.triage_note}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-violet-900 mb-1">推奨アクション</div>
                        <p className="text-sm text-violet-800">{triageResult.suggested_action}</p>
                      </div>
                      <div className="text-xs text-violet-700 italic border-t border-violet-200 pt-3">{triageResult.routing_reason}</div>
                      <div className="flex items-center justify-between text-xs text-violet-400 border-t border-violet-200 pt-3">
                        <span>生成: {new Date(triageResult.generated_at).toLocaleString('ja-JP')}</span>
                        {triageResult.saved && <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 className="w-3 h-3" />保存済み</span>}
                      </div>
                    </CardContent>
                  )}
                  {!triageLoading && !triageResult && !triageError && (
                    <CardContent className="py-4 text-center opacity-60">
                      <GitBranch className="w-7 h-7 mx-auto text-violet-400 mb-1.5" />
                      <p className="text-xs text-violet-600">「Generate Only」または「Generate &amp; Save」を押してトリアージを実行します</p>
                    </CardContent>
                  )}
                </Card>

                {/* ── AI Draft Reply ────────────────────────────────────────── */}
                <Card className="border-teal-200 bg-teal-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-teal-600" />
                        AI Draft Reply
                        {draftResult && (
                          <Badge variant="outline" className="text-xs bg-teal-100 border-teal-300 text-teal-700 font-normal">{draftResult.model}</Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1.5">
                        <Select value={draftTone} onValueChange={(v) => setDraftTone(v as typeof draftTone)}>
                          <SelectTrigger className="h-7 text-xs w-28 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="technical">Technical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white" onClick={() => generateDraftReply(false)} disabled={draftLoading}>
                          {draftLoading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                          {draftResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white border-teal-300 text-teal-700 hover:bg-teal-50" onClick={() => generateDraftReply(true)} disabled={draftLoading}>
                          <Save className="w-3 h-3 mr-1.5" />Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {draftLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      <span className="text-sm text-teal-700">AI で返信ドラフトを生成中...</span>
                    </CardContent>
                  )}
                  {!draftLoading && draftError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">⚠ {draftError}</div>
                      <Button size="sm" variant="outline" onClick={() => generateDraftReply(false)}><RefreshCw className="w-3 h-3 mr-1.5" />再試行</Button>
                    </CardContent>
                  )}
                  {!draftLoading && draftResult && (
                    <CardContent className="space-y-4">
                      <Badge variant="outline" className="text-xs bg-teal-100 border-teal-300 text-teal-800">{draftResult.reply_tone}</Badge>
                      <div>
                        <div className="text-xs font-semibold text-teal-900 mb-2">返信ドラフト</div>
                        <div className="bg-white border border-teal-200 rounded-lg p-4">
                          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{draftResult.draft_reply}</pre>
                        </div>
                      </div>
                      {draftResult.key_points.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-teal-900 mb-2">カバーしたポイント</div>
                          <ul className="space-y-1">
                            {draftResult.key_points.map((pt, idx) => (
                              <li key={idx} className="text-sm text-teal-800 flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-teal-500" />{pt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-teal-400 border-t border-teal-200 pt-3">
                        <span>生成: {new Date(draftResult.generated_at).toLocaleString('ja-JP')}</span>
                        {draftResult.saved && <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 className="w-3 h-3" />保存済み</span>}
                      </div>
                    </CardContent>
                  )}
                  {!draftLoading && !draftResult && !draftError && (
                    <CardContent className="py-4 text-center opacity-60">
                      <MessageSquare className="w-7 h-7 mx-auto text-teal-400 mb-1.5" />
                      <p className="text-xs text-teal-600">トーンを選んで「Generate Only」または「Generate &amp; Save」を押してください</p>
                    </CardContent>
                  )}
                </Card>

                {/* ── AI Alert ──────────────────────────────────────────────── */}
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="w-4 h-4 text-orange-600" />
                        Support Alert
                        {alertResult && (
                          <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-700 font-normal">{alertResult.model}</Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white" onClick={() => generateAlert(false)} disabled={alertLoading}>
                          {alertLoading ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
                          {alertResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 bg-white border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => generateAlert(true)} disabled={alertLoading}>
                          <Save className="w-3 h-3 mr-1.5" />Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {alertLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                      <span className="text-sm text-orange-700">AI でアラートを生成中...</span>
                    </CardContent>
                  )}
                  {!alertLoading && alertError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">⚠ {alertError}</div>
                      <Button size="sm" variant="outline" onClick={() => generateAlert(false)}><RefreshCw className="w-3 h-3 mr-1.5" />再試行</Button>
                    </CardContent>
                  )}
                  {!alertLoading && alertResult && (
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={alertResult.priority === 'Critical' ? 'bg-red-700 text-white text-xs' : alertResult.priority === 'High' ? 'bg-red-500 text-white text-xs' : alertResult.priority === 'Medium' ? 'bg-amber-500 text-white text-xs' : 'bg-slate-400 text-white text-xs'}>
                          {alertResult.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-800">{alertResult.alert_type}</Badge>
                        <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-600">{alertResult.status}</Badge>
                        {alertResult.escalation_needed && (
                          <Badge className="bg-red-600 text-white text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />Escalation
                          </Badge>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-orange-900 mb-1">タイトル</div>
                        <p className="text-sm font-medium text-orange-800">{alertResult.title}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-orange-900 mb-1">サマリー</div>
                        <p className="text-sm text-orange-800">{alertResult.summary}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-orange-900 mb-1">重要な理由</div>
                        <p className="text-sm text-orange-800">{alertResult.why_this_matters}</p>
                      </div>
                      <div className="text-xs text-orange-700 italic border-t border-orange-200 pt-3">推奨アクション: {alertResult.suggested_action}</div>
                      <div className="flex items-center justify-between text-xs text-orange-400 border-t border-orange-200 pt-3">
                        <span>生成: {new Date(alertResult.generated_at).toLocaleString('ja-JP')}</span>
                        {alertResult.saved && <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 className="w-3 h-3" />保存済み</span>}
                      </div>
                    </CardContent>
                  )}
                  {!alertLoading && !alertResult && !alertError && (
                    <CardContent className="py-4 text-center opacity-60">
                      <Bell className="w-7 h-7 mx-auto text-orange-400 mb-1.5" />
                      <p className="text-xs text-orange-600">「Generate Only」または「Generate &amp; Save」を押してアラートを生成します</p>
                    </CardContent>
                  )}
                </Card>

                {/* Internal Note */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />Add Internal Note
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="内部メモを入力..."
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      rows={3}
                      className="mb-3"
                    />
                    <Button size="sm" variant="outline">
                      <Send className="w-4 h-4 mr-2" />Save Note
                    </Button>
                  </CardContent>
                </Card>

              </div>

              {/* ── Right column: Details + Actions ────────────────────────── */}
              <div className="space-y-5">

                {/* Case Details */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Case Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">担当者</span>
                      <span className="font-medium text-slate-900">{vm.ownerDisplayName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">チーム</span>
                      <Badge variant="outline" className="text-xs">{vm.assignedTeamDisplay}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">対応ステータス</span>
                      <RoutingBadge status={vm.routingStatus} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">重要度</span>
                      <SeverityBadge severity={vm.severity} />
                    </div>
                    {vm.sourceStatus && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Source Status</span>
                        <SourceStatusBadge status={vm.sourceStatus} />
                      </div>
                    )}
                    {vm.firstResponseTime && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">初回応答</span>
                        <span className="font-medium text-slate-900">{vm.firstResponseTime}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Open</span>
                      <span className="font-medium text-slate-900">{vm.openDuration}</span>
                    </div>
                    {vm.waitingDuration && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">待機</span>
                        <span className="font-medium text-amber-700">{vm.waitingDuration}</span>
                      </div>
                    )}
                    {vm.linkedCSETicket && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Linked CSE</span>
                        <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                          <Ticket className="w-3 h-3 mr-1" />{vm.linkedCSETicket}
                        </Badge>
                      </div>
                    )}
                    {cseTickets.length > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        <div className="text-xs font-semibold text-slate-600">CSE Tickets</div>
                        {cseTickets.map(t => (
                          <div key={t.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700 truncate max-w-[140px]">{t.title}</span>
                            <Badge variant="outline" className="text-xs ml-2">{t.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 border-t text-xs text-slate-400">{vm.createdAt} 作成</div>
                  </CardContent>
                </Card>

                {/* Company / Project */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Company / Project</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {vm.companyUid ? (
                      <Link
                        href={`/companies/${vm.companyUid}`}
                        className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors"
                      >
                        <Building className="w-4 h-4 text-slate-500" />
                        <span className="flex-1 text-sm font-medium text-slate-900">{vm.companyName}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border">
                        <Building className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{vm.companyName}</span>
                      </div>
                    )}
                    {vm.projectName && (
                      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{vm.projectName}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── AI Assist Panel (support_case_ai_state) ─────────────── */}
                {/* newAiVmLoaded=true 後に表示。hasAiState=false → 「AI 未分析」プレースホルダー */}
                {newAiVmLoaded && newAiVm && !newAiVm.hasAiState && (
                  <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Zap className="w-3.5 h-3.5" />
                        <span className="text-sm font-medium text-slate-500">AI 未分析</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        「Refresh AI」でこのケースの AI 分析を実行できます
                      </p>
                    </CardContent>
                  </Card>
                )}
                {newAiVm && newAiVm.hasAiState && (
                  <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Zap className="w-4 h-4 text-purple-600" />
                          AI Assist
                          {newAiVm.aiVersion && (
                            <Badge variant="outline" className="text-xs bg-purple-100 border-purple-200 text-purple-700 font-normal">
                              {newAiVm.aiVersion}
                            </Badge>
                          )}
                          {/* Freshness バッジ */}
                          <Badge
                            variant="outline"
                            className={`text-xs font-normal ${freshnessInfo.badgeClass}`}
                            title={freshnessInfo.description}
                          >
                            {freshnessInfo.label}
                          </Badge>
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            newAiVm.humanReviewStatus === 'approved'  ? 'bg-green-100 border-green-300 text-green-700' :
                            newAiVm.humanReviewStatus === 'reviewed'  ? 'bg-blue-100 border-blue-300 text-blue-700' :
                            newAiVm.humanReviewStatus === 'corrected' ? 'bg-amber-100 border-amber-300 text-amber-700' :
                            'bg-slate-100 border-slate-300 text-slate-600'
                          }`}
                          title={REVIEW_STATUS_DESCRIPTIONS[newAiVm.humanReviewStatus]?.description}
                        >
                          {REVIEW_STATUS_DESCRIPTIONS[newAiVm.humanReviewStatus]?.label ?? newAiVm.humanReviewStatus}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* ── Freshness バナー ──────────────────────────────── */}
                      {freshness === 'stale' && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>AI state が古くなっています。最新の情報を反映するため再生成を推奨します。</span>
                        </div>
                      )}
                      {freshness === 'locked' && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2 text-xs text-green-800">
                          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>承認済みです。AI 値は effective 値として固定採用されています。再生成はブロックされています。</span>
                        </div>
                      )}
                      {/* ── Effective values（UI で実際に使う値） ─────────── */}
                      <div>
                        <div className="text-xs font-semibold text-purple-800 mb-1.5 flex items-center gap-1">
                          Effective
                          {eff.adoptAiValues
                            ? <span className="text-[10px] font-normal text-purple-500">（AI 採用中）</span>
                            : <span className="text-[10px] font-normal text-slate-400">（Source 値）</span>
                          }
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <SeverityBadge severity={eff.effectiveSeverity} />
                          <Badge variant="outline" className="text-xs text-slate-600">{eff.effectiveRoutingStatus}</Badge>
                          <Badge variant="outline" className="text-xs">{eff.effectivePriority}</Badge>
                          {newAiVm.escalationNeeded && (
                            <Badge className="bg-orange-500 text-white text-xs flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />Escalation
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* ── Source / AI diff（値が異なる場合のみ表示） ───── */}
                      {(eff.sourceSeverity !== eff.aiSeverity || eff.sourceRoutingStatus !== eff.aiRoutingStatus) && (
                        <div className="bg-white border border-purple-100 rounded p-2 space-y-1">
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Source vs AI</div>
                          {eff.sourceSeverity !== eff.aiSeverity && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="text-slate-400">severity:</span>
                              <span className="line-through text-slate-400">{eff.sourceSeverity}</span>
                              <span>→</span>
                              <span className="text-purple-700 font-medium">{eff.aiSeverity}</span>
                            </div>
                          )}
                          {eff.sourceRoutingStatus !== eff.aiRoutingStatus && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="text-slate-400">routing:</span>
                              <span className="line-through text-slate-400">{eff.sourceRoutingStatus}</span>
                              <span>→</span>
                              <span className="text-purple-700 font-medium">{eff.aiRoutingStatus}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Summary */}
                      {newAiVm.summary && (
                        <div>
                          <div className="text-xs font-semibold text-purple-800 mb-1">AI サマリー</div>
                          <p className="text-xs text-purple-700">{newAiVm.summary}</p>
                        </div>
                      )}

                      {/* Triage Note */}
                      {newAiVm.triageNote && (
                        <div>
                          <div className="text-xs font-semibold text-purple-800 mb-1">トリアージ</div>
                          <p className="text-xs text-purple-700">{newAiVm.triageNote}</p>
                        </div>
                      )}

                      {/* Suggested Action */}
                      {newAiVm.suggestedAction && (
                        <div>
                          <div className="text-xs font-semibold text-purple-800 mb-1">推奨アクション</div>
                          <p className="text-xs text-purple-700">{newAiVm.suggestedAction}</p>
                        </div>
                      )}

                      {/* Draft Reply */}
                      {newAiVm.draftReply && (
                        <div>
                          <div className="text-xs font-semibold text-purple-800 mb-1">下書き返信</div>
                          <Textarea
                            defaultValue={newAiVm.draftReply}
                            rows={3}
                            className="text-xs resize-none"
                            readOnly
                          />
                        </div>
                      )}

                      {/* Escalation detail */}
                      {newAiVm.escalationNeeded && newAiVm.escalationReason && (
                        <div className="bg-orange-50 border border-orange-200 rounded p-2 space-y-1">
                          <div className="flex items-center gap-1 text-xs font-semibold text-orange-800">
                            <AlertTriangle className="w-3 h-3" />
                            エスカレーション先: {newAiVm.escalationTarget ?? '—'}
                          </div>
                          <p className="text-xs text-orange-700">{newAiVm.escalationReason}</p>
                        </div>
                      )}

                      {/* Human Review セレクター */}
                      <div className="pt-2 border-t border-purple-200 space-y-1.5">
                        <div className="text-xs font-semibold text-purple-800">Human Review</div>
                        <Select
                          value={newAiVm.humanReviewStatus}
                          onValueChange={saveHumanReview}
                          disabled={reviewSaving || eff.isLocked}
                        >
                          <SelectTrigger className="h-7 text-xs bg-white border-purple-200">
                            {reviewSaving
                              ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />保存中...</>
                              : <SelectValue />
                            }
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending"   title={REVIEW_STATUS_DESCRIPTIONS.pending?.description}>
                              pending — 未確認
                            </SelectItem>
                            <SelectItem value="reviewed"  title={REVIEW_STATUS_DESCRIPTIONS.reviewed?.description}>
                              reviewed — 確認済み（補正なし）
                            </SelectItem>
                            <SelectItem value="corrected" title={REVIEW_STATUS_DESCRIPTIONS.corrected?.description}>
                              corrected — 人が補正済み
                            </SelectItem>
                            <SelectItem value="approved"  title={REVIEW_STATUS_DESCRIPTIONS.approved?.description}>
                              approved — 最終採用済み（再生成不可）
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {eff.isLocked && (
                          <p className="text-[10px] text-green-600">承認済みのため変更不可</p>
                        )}
                        {reviewSaveError && (
                          <p className="text-xs text-red-600">{reviewSaveError}</p>
                        )}
                      </div>

                      {/* Last updated */}
                      {newAiVm.lastAiUpdatedAt && (
                        <div className="text-xs text-purple-400 pt-1 border-t border-purple-100">
                          最終更新: {new Date(newAiVm.lastAiUpdatedAt.replace(' ', 'T')).toLocaleString('ja-JP')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Quick Operations */}
                {!vm.isReadOnlyLike && (
                  <Card>
                    <CardHeader><CardTitle className="text-base text-slate-700">Quick Operations</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <Select defaultValue="none">
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Assign to..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- チームを選択 --</SelectItem>
                          <SelectItem value="csm">CSM Team</SelectItem>
                          <SelectItem value="support">Support Team</SelectItem>
                          <SelectItem value="cse">CSE Team</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                        <Send className="w-4 h-4 mr-2" />Outbound を準備
                      </Button>
                      {canDismiss(vm, vm.isDismissed) && (
                        <Button
                          variant="outline"
                          className="w-full justify-start text-sm text-slate-500 hover:text-slate-700"
                          size="sm"
                          onClick={() => setShowDismissConfirm(v => !v)}
                        >
                          <X className="w-4 h-4 mr-2" />対応不要にする
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
