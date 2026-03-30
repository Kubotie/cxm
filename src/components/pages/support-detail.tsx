"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchCaseDetail, fetchSupportCaseAIState, fetchCseTickets } from "@/lib/nocodb-client";
import type { CaseDetail, AppSupportCaseAIState, AppCseTicket } from "@/lib/nocodb-client";
import { routingLabel, routingColor, severityLabel, severityBg } from "@/lib/support/labels";
import type { SupportSummaryApiResponse } from "@/lib/prompts/support-summary";
import type { SupportTriageApiResponse } from "@/lib/prompts/support-triage";
import type { SupportDraftReplyApiResponse } from "@/lib/prompts/support-draft-reply";
import type { SupportAlertApiResponse } from "@/lib/prompts/support-alert";
import type { SummarizeRequestBody, TriageRequestBody, DraftReplyRequestBody } from "@/lib/support/ai-types";
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
  BookOpen,
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
} from "lucide-react";

// ── Mock data ────────────────────────────────────────────────────────────────

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
  sourceStatus: null,
  severity: "medium",
  createdAt: "2026-03-17 13:45",
  firstResponseTime: "0h 45m",
  openDuration: "3h 32m",
  waitingDuration: null,
  linkedCSETicket: null,
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
  firstResponse: `ご連絡ありがとうございます。Support Teamの佐藤です。

レポート出力時のデータ欠損の件、承知いたしました。
初期調査を開始いたしますので、以下の情報をご共有いただけますでしょうか。

1. レポートの種類（月次、週次、カスタムなど）
2. エクスポート形式（CSV、Excel、PDFなど）
3. 使用しているブラウザとバージョン

また、同じ条件で他のプロジェクトのデータは正常に表示されますでしょうか。

ご確認をお願いいたします。`,
  routingHistory: [
    { timestamp: "2026-03-17 13:45", action: "Case created", user: "System", note: "Slack経由で自動作成" },
    { timestamp: "2026-03-17 14:10", action: "Triaged", user: "山本 一郎", note: "Support Teamにアサイン" },
    { timestamp: "2026-03-17 14:30", action: "First response sent", user: "佐藤 太郎 (Support Team)", note: "初期調査開始" },
  ],
};

const RELATED_ACTIONS = [
  { id: "act_1", title: "レポート機能のデータ同期状況確認", status: "in_progress", owner: "佐藤 太郎" },
];

const RELATED_CONTENT = [
  { id: "cnt_1", title: "レポート機能のトラブルシューティングガイド", type: "Help" },
  { id: "cnt_2", title: "データエクスポートのベストプラクティス", type: "Guide" },
];

const SIMILAR_CASES = [
  { id: "sup_5", title: "エクスポート時の日付範囲エラー", company: "株式会社テクノロジーイノベーション", companyId: "1", resolved: true, resolution: "データ同期のタイミング調整で解決" },
  { id: "sup_6", title: "特定期間のレポートデータ欠損", company: "クラウドインフラサービス", companyId: "5", resolved: true, resolution: "キャッシュクリアで解決" },
];

const AI_SUGGESTIONS = {
  summary: "レポート機能でのデータ欠損問題。2026年2月の特定プロジェクトデータが表示されない。データ同期またはキャッシュの問題の可能性が高い。",
  suggestedOwner: "Support Team（初期対応）",
  suggestedTeam: "Support → CSE（必要に応じて）",
  urgency: "Medium",
  nextSteps: [
    "顧客からブラウザ情報とレポート種類を確認",
    "バックエンドログで2月のデータ同期状態を確認",
    "類似ケースの解決方法を試行",
    "必要に応じてCSE Ticketを起票",
  ],
};

// ── Main component ────────────────────────────────────────────────────────────

export function SupportDetail() {
  const params = useParams();
  const id = params.caseId as string;
  const [internalNote, setInternalNote] = useState("");

  // ── source: 実ケースデータ（NocoDB log_intercom / cse_tickets から）─────
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);

  // ── derived: AI state（NocoDB から）─────────────────────────────────────
  const [aiState, setAiState] = useState<AppSupportCaseAIState | null>(null);

  // ── source: linked CSE tickets ────────────────────────────────────────────
  const [cseTickets, setCseTickets] = useState<AppCseTicket[]>([]);

  // ── AI Summary 生成（OpenAI 経由）────────────────────────────────────────
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SupportSummaryApiResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── AI Triage 生成（OpenAI 経由）─────────────────────────────────────────
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<SupportTriageApiResponse | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);

  // ── AI Draft Reply 生成（OpenAI 経由）────────────────────────────────────
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftResult, setDraftResult] = useState<SupportDraftReplyApiResponse | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftTone, setDraftTone] = useState<'formal' | 'friendly' | 'technical'>('formal');

  // ── Alert 生成（OpenAI 経由）────────────────────────────────────────────
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertResult, setAlertResult] = useState<SupportAlertApiResponse | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // ── Batch 一括更新 ────────────────────────────────────────────────────
  type BatchStepStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped';
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchSteps, setBatchSteps] = useState<{
    summary: BatchStepStatus;
    triage: BatchStepStatus;
    draft: BatchStepStatus;
    alert: BatchStepStatus;
  }>({ summary: 'idle', triage: 'idle', draft: 'idle', alert: 'idle' });
  const [batchDoneAt, setBatchDoneAt] = useState<Date | null>(null);

  async function generateSummary(save: boolean): Promise<boolean> {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const body: SummarizeRequestBody = {
        sourceTable: 'support_queue',
        save,
        // NocoDB 未設定時のフォールバック: mock の case データを渡す
        caseContext: {
          title:           c.title,
          caseType:        c.caseType,
          source:          c.source,
          company:         c.company,
          severity:        c.severity,
          routingStatus:   c.routingStatus,
          assignedTeam:    c.assignedTeam ?? undefined,
          openDuration:    c.openDuration,
          linkedCSETicket: c.linkedCSETicket ?? undefined,
          originalMessage: c.originalMessage,
          triageNote:      c.triageNote,
        },
      };
      const res = await fetch(`/api/support/${id}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSummaryResult(data as SupportSummaryApiResponse);
      return true;
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSummaryLoading(false);
    }
  }

  async function generateTriage(save: boolean): Promise<boolean> {
    setTriageLoading(true);
    setTriageError(null);
    try {
      const body: TriageRequestBody = {
        sourceTable: 'support_queue',
        save,
        caseContext: {
          title:           c.title,
          caseType:        c.caseType,
          source:          c.source,
          company:         c.company,
          severity:        c.severity,
          routingStatus:   c.routingStatus,
          assignedTeam:    c.assignedTeam ?? undefined,
          openDuration:    c.openDuration,
          linkedCSETicket: c.linkedCSETicket ?? undefined,
          originalMessage: c.originalMessage,
          triageNote:      c.triageNote,
        },
      };
      const res = await fetch(`/api/support/${id}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setTriageResult(data as SupportTriageApiResponse);
      return true;
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setTriageLoading(false);
    }
  }

  async function generateDraftReply(save: boolean): Promise<boolean> {
    setDraftLoading(true);
    setDraftError(null);
    try {
      const body: DraftReplyRequestBody = {
        tone: draftTone,
        language: 'ja',
        save,
        caseContext: {
          title:           c.title,
          caseType:        c.caseType,
          source:          c.source,
          company:         c.company,
          severity:        c.severity,
          routingStatus:   c.routingStatus,
          assignedTeam:    c.assignedTeam ?? undefined,
          openDuration:    c.openDuration,
          linkedCSETicket: c.linkedCSETicket ?? undefined,
          originalMessage: c.originalMessage,
          triageNote:      c.triageNote,
        },
      };
      const res = await fetch(`/api/support/${id}/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setDraftResult(data as SupportDraftReplyApiResponse);
      return true;
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setDraftLoading(false);
    }
  }

  async function generateAlert(save: boolean): Promise<boolean> {
    setAlertLoading(true);
    setAlertError(null);
    try {
      const body = {
        sourceTable: 'support_queue',
        save,
        caseContext: {
          title:           c.title,
          caseType:        c.caseType,
          source:          c.source,
          company:         c.company,
          severity:        c.severity,
          routingStatus:   c.routingStatus,
          assignedTeam:    c.assignedTeam ?? undefined,
          openDuration:    c.openDuration,
          linkedCSETicket: c.linkedCSETicket ?? undefined,
          originalMessage: c.originalMessage,
          triageNote:      c.triageNote,
        },
      };
      const res = await fetch(`/api/support/${id}/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setAlertResult(data as SupportAlertApiResponse);
      return true;
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setAlertLoading(false);
    }
  }

  async function refreshAllAI() {
    setBatchRunning(true);
    setBatchDoneAt(null);
    setBatchSteps({ summary: 'idle', triage: 'idle', draft: 'idle', alert: 'idle' });

    const setStep = (step: 'summary' | 'triage' | 'draft' | 'alert', status: BatchStepStatus) =>
      setBatchSteps(prev => ({ ...prev, [step]: status }));

    // 1. Summary
    setStep('summary', 'running');
    const summaryOk = await generateSummary(true);
    setStep('summary', summaryOk ? 'done' : 'failed');

    // 2. Triage
    setStep('triage', 'running');
    const triageOk = await generateTriage(true);
    setStep('triage', triageOk ? 'done' : 'failed');

    // 3. Draft Reply
    setStep('draft', 'running');
    const draftOk = await generateDraftReply(true);
    setStep('draft', draftOk ? 'done' : 'failed');

    // 4. Alert
    setStep('alert', 'running');
    const alertOk = await generateAlert(true);
    setStep('alert', alertOk ? 'done' : 'failed');

    setBatchRunning(false);
    setBatchDoneAt(new Date());
  }

  useEffect(() => {
    if (!id) return;

    // source: ケースデータ（log_intercom / cse_tickets — CaseDetail adapter 経由）
    fetchCaseDetail(id)
      .then(data => { if (data) setCaseData(data); })
      .catch(err => console.warn('[SupportDetail] case fetch failed, using mock:', err));

    // source: リンクされた CSE Ticket（cseticket_queue テーブル）
    fetchCseTickets({ caseId: id })
      .then(data => { if (data.length > 0) setCseTickets(data); })
      .catch(err => console.warn('[SupportDetail] CSE tickets fetch failed:', err));
  }, [id]);

  // derived: AI解析状態（support_case_ai_state テーブル）
  // caseData が取得できてから sourceTable を判定して fetch する。
  // log_intercom → 'support_queue' / cse_tickets → 'cseticket_queue'
  useEffect(() => {
    if (!id) return;
    const sourceTable = caseData?.sourceTable === 'cse_tickets' ? 'cseticket_queue' : 'support_queue';
    fetchSupportCaseAIState(id, sourceTable)
      .then(data => { if (data) setAiState(data); })
      .catch(err => console.warn('[SupportDetail] AI state fetch failed:', err));
  }, [id, caseData?.sourceTable]);

  // 実ケースデータ（NocoDB）優先。未取得時は mock にフォールバック。
  // firstResponse / routingHistory など NocoDB にないフィールドは mock のまま。
  // CaseDetail は companyName/companyUid/projectName を使うが、
  // c オブジェクトは CASE_DETAIL（company/companyId/project）との互換を維持するため
  // ここでリマップする。JSX 側は変更不要。
  const c = caseData
    ? {
        ...CASE_DETAIL,             // firstResponse / routingHistory は mock を維持
        id:               caseData.id,
        title:            caseData.title,    // adapter 解決済み（body excerpt fallback 含む）
        caseType:         caseData.caseType,
        source:           caseData.source,
        company:          caseData.companyName,   // CaseDetail.companyName → c.company
        companyId:        caseData.companyUid,    // CaseDetail.companyUid  → c.companyId
        project:          caseData.projectName,   // CaseDetail.projectName → c.project
        projectId:        caseData.projectId,
        owner:            caseData.owner,
        assignedTeam:     caseData.assignedTeam,
        routingStatus:    caseData.routingStatus,
        sourceStatus:     caseData.sourceStatus,
        severity:         caseData.severity,
        createdAt:        caseData.createdAt,
        firstResponseTime: caseData.firstResponseTime,
        openDuration:     caseData.openDuration,
        waitingDuration:  caseData.waitingDuration,
        linkedCSETicket:  caseData.linkedCSETicket,
        relatedContent:   caseData.relatedContent,
        originalMessage:  caseData.originalMessage,          // 常に string（空文字もあり得る）
        triageNote:       caseData.triageNote ?? undefined,  // QueueItem は string | null
      }
    : CASE_DETAIL;

  // derived: AI サジェスト（取得済みなら API データ、なければ mock）
  const aiSuggestions = aiState
    ? {
        summary:        aiState.summary,
        suggestedOwner: aiState.suggestedOwner,
        suggestedTeam:  aiState.suggestedTeam,
        urgency:        aiState.urgency,
        nextSteps:      aiState.nextSteps,
      }
    : AI_SUGGESTIONS;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support Detail" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-6 space-y-6">

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/support/queue">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Support Queue
                  </Button>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  {/* タイトル優先順: AI display_title → adapter解決済みタイトル（source title / body excerpt / fallback）*/}
                  <h1 className="text-xl font-bold text-slate-900">
                    {aiState?.displayTitle ?? c.title}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{c.caseType}</Badge>
                    <Badge variant="outline" className="text-xs">{c.source}</Badge>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{c.id}</span>
                    {aiState?.displayTitle && (
                      <span className="text-xs text-violet-500">AI タイトル</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAllAI}
                  disabled={batchRunning}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  {batchRunning
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Zap className="w-4 h-4 mr-2" />
                  }
                  Refresh AI Case
                </Button>
                <Link href={`/companies/${c.companyId}`}>
                  <Button variant="outline" size="sm">
                    <Building className="w-4 h-4 mr-2" />
                    Company
                  </Button>
                </Link>
              </div>
            </div>

            {/* Batch 進捗パネル（実行中 or 完了時に表示）*/}
            {(batchRunning || batchDoneAt) && (() => {
              const steps: { key: keyof typeof batchSteps; label: string }[] = [
                { key: 'summary', label: 'AI Summary' },
                { key: 'triage',  label: 'AI Triage' },
                { key: 'draft',   label: 'Draft Reply' },
                { key: 'alert',   label: 'Support Alert' },
              ];
              const allDone   = steps.every(s => batchSteps[s.key] !== 'idle' && batchSteps[s.key] !== 'running');
              const anyFailed = steps.some(s => batchSteps[s.key] === 'failed');
              const allFailed = steps.every(s => batchSteps[s.key] === 'failed');

              return (
                <div className={`rounded-lg border p-4 ${
                  batchRunning
                    ? 'bg-amber-50 border-amber-200'
                    : allFailed
                      ? 'bg-red-50 border-red-200'
                      : anyFailed
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-green-50 border-green-200'
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
                      <span className="text-xs text-slate-400">
                        {batchDoneAt.toLocaleTimeString('ja-JP')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {steps.map(({ key, label }) => {
                      const status = batchSteps[key];
                      const cfg = {
                        idle:    { bg: 'bg-slate-100 text-slate-400', icon: null },
                        running: { bg: 'bg-amber-100 text-amber-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
                        done:    { bg: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
                        failed:  { bg: 'bg-red-100 text-red-700',     icon: <XCircle className="w-3 h-3" /> },
                        skipped: { bg: 'bg-slate-100 text-slate-500', icon: <SkipForward className="w-3 h-3" /> },
                      }[status];
                      return (
                        <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg}`}>
                          {cfg.icon}
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-6">

              {/* Left column */}
              <div className="col-span-2 space-y-6">

                {/* Original Message */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Original Message / Ticket Summary</CardTitle>
                    <CardDescription>{c.source} • {c.createdAt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 border rounded-lg p-4">
                      {/* originalMessage は adapter で優先順位解決済み */}
                      {/* source.display_message → aiState.displayMessage → raw body */}
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{c.originalMessage}</pre>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Summary */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-blue-600" />
                        AI Summary & Suggestions
                        {summaryResult && (
                          <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-700 font-normal">
                            {summaryResult.model}
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white"
                          onClick={() => generateSummary(false)}
                          disabled={summaryLoading}
                        >
                          {summaryLoading
                            ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                            : <RefreshCw className="w-3 h-3 mr-1.5" />
                          }
                          {summaryResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => generateSummary(true)}
                          disabled={summaryLoading}
                        >
                          <Save className="w-3 h-3 mr-1.5" />
                          Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* ── 取得中 ── */}
                  {summaryLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700">AI でサマリーを生成中...</span>
                    </CardContent>
                  )}

                  {/* ── エラー ── */}
                  {!summaryLoading && summaryError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">
                        ⚠ {summaryError}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => generateSummary(false)}>
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        再試行
                      </Button>
                    </CardContent>
                  )}

                  {/* ── AI 生成結果 ── */}
                  {!summaryLoading && summaryResult && (
                    <CardContent className="space-y-4">
                      {/* severity + product_area バッジ */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={
                          summaryResult.severity === 'high'   ? 'bg-red-600 text-white text-xs' :
                          summaryResult.severity === 'medium' ? 'bg-amber-500 text-white text-xs' :
                          'bg-slate-400 text-white text-xs'
                        }>
                          {summaryResult.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-800">
                          {summaryResult.product_area}
                        </Badge>
                      </div>
                      {/* ai_summary */}
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">AI サマリー</div>
                        <p className="text-sm text-blue-800">{summaryResult.ai_summary}</p>
                      </div>
                      {/* customer_intent */}
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">顧客の意図</div>
                        <p className="text-sm text-blue-800">{summaryResult.customer_intent}</p>
                      </div>
                      {/* suggested_next_steps */}
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-2">推奨ネクストアクション</div>
                        <ul className="space-y-1.5">
                          {summaryResult.suggested_next_steps.map((step, idx) => (
                            <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* urgency_reasoning */}
                      <div className="text-xs text-blue-700 italic border-t border-blue-200 pt-3">
                        {summaryResult.urgency_reasoning}
                      </div>
                      <div className="flex items-center justify-between text-xs text-blue-400 border-t border-blue-200 pt-3 mt-0">
                        <span>生成日時: {new Date(summaryResult.generated_at).toLocaleString('ja-JP')}</span>
                        {summaryResult.saved && (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            NocoDB に保存済み
                          </span>
                        )}
                        {summaryResult.save_skipped && (
                          <span className="flex items-center gap-1 text-amber-600" title={summaryResult.save_skip_reason}>
                            ⚠ 保存スキップ
                          </span>
                        )}
                      </div>
                    </CardContent>
                  )}

                  {/* ── 未生成（初期状態）── */}
                  {!summaryLoading && !summaryResult && !summaryError && (
                    <CardContent>
                      {aiState ? (
                        // NocoDB に保存済みの AI state があれば薄く表示
                        <div className="space-y-4 opacity-60">
                          <div>
                            <div className="text-xs font-semibold text-blue-900 mb-1">要約</div>
                            <p className="text-sm text-blue-800">{aiSuggestions.summary}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs font-semibold text-blue-900 mb-1">推奨オーナー</div>
                              <p className="text-sm text-blue-800">{aiSuggestions.suggestedOwner}</p>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-blue-900 mb-1">推奨チーム</div>
                              <p className="text-sm text-blue-800">{aiSuggestions.suggestedTeam}</p>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-blue-900 mb-2">Next Steps</div>
                            <ul className="space-y-1">
                              {aiSuggestions.nextSteps.map((step, idx) => (
                                <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  {step}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-xs text-blue-600">↑ 「Generate AI Summary」を押すとリアルタイムで生成します</p>
                        </div>
                      ) : (
                        // AI state 未保存 → モックを出さずにプロンプトだけ表示
                        <div className="py-6 text-center opacity-60">
                          <Lightbulb className="w-8 h-8 mx-auto text-blue-400 mb-2" />
                          <p className="text-xs text-blue-600">「Generate Only」または「Generate &amp; Save」を押してサマリーを生成します</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>

                {/* AI Triage */}
                <Card className="border-violet-200 bg-violet-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-violet-600" />
                        AI Triage
                        {triageResult && (
                          <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-700 font-normal">
                            {triageResult.model}
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white"
                          onClick={() => generateTriage(false)}
                          disabled={triageLoading}
                        >
                          {triageLoading
                            ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                            : <RefreshCw className="w-3 h-3 mr-1.5" />
                          }
                          {triageResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white border-violet-300 text-violet-700 hover:bg-violet-50"
                          onClick={() => generateTriage(true)}
                          disabled={triageLoading}
                        >
                          <Save className="w-3 h-3 mr-1.5" />
                          Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* ── 取得中 ── */}
                  {triageLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                      <span className="text-sm text-violet-700">AI でトリアージを生成中...</span>
                    </CardContent>
                  )}

                  {/* ── エラー ── */}
                  {!triageLoading && triageError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">
                        ⚠ {triageError}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => generateTriage(false)}>
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        再試行
                      </Button>
                    </CardContent>
                  )}

                  {/* ── AI 生成結果 ── */}
                  {!triageLoading && triageResult && (
                    <CardContent className="space-y-4">
                      {/* severity + suggested_team + escalation バッジ */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={
                          triageResult.severity === 'high'   ? 'bg-red-600 text-white text-xs' :
                          triageResult.severity === 'medium' ? 'bg-amber-500 text-white text-xs' :
                          'bg-slate-400 text-white text-xs'
                        }>
                          {triageResult.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-violet-100 border-violet-300 text-violet-800">
                          → {triageResult.suggested_team}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-700">
                          {triageResult.category}
                        </Badge>
                        {triageResult.escalation_needed && (
                          <Badge className="bg-orange-500 text-white text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Escalation
                          </Badge>
                        )}
                      </div>
                      {/* triage_note */}
                      <div>
                        <div className="text-xs font-semibold text-violet-900 mb-1">トリアージ所見</div>
                        <p className="text-sm text-violet-800">{triageResult.triage_note}</p>
                      </div>
                      {/* suggested_action */}
                      <div>
                        <div className="text-xs font-semibold text-violet-900 mb-1">推奨アクション</div>
                        <p className="text-sm text-violet-800">{triageResult.suggested_action}</p>
                      </div>
                      {/* routing_reason */}
                      <div className="text-xs text-violet-700 italic border-t border-violet-200 pt-3">
                        {triageResult.routing_reason}
                      </div>
                      {/* footer */}
                      <div className="flex items-center justify-between text-xs text-violet-400 border-t border-violet-200 pt-3">
                        <span>生成日時: {new Date(triageResult.generated_at).toLocaleString('ja-JP')}</span>
                        {triageResult.saved && (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            NocoDB に保存済み
                          </span>
                        )}
                        {triageResult.save_skipped && (
                          <span className="flex items-center gap-1 text-amber-600" title={triageResult.save_skip_reason}>
                            ⚠ 保存スキップ
                          </span>
                        )}
                      </div>
                    </CardContent>
                  )}

                  {/* ── 未生成（初期状態）── */}
                  {!triageLoading && !triageResult && !triageError && (
                    <CardContent className="py-6 text-center opacity-60">
                      <GitBranch className="w-8 h-8 mx-auto text-violet-400 mb-2" />
                      <p className="text-xs text-violet-600">「Generate Only」または「Generate &amp; Save」を押してトリアージを実行します</p>
                    </CardContent>
                  )}
                </Card>

                {/* AI Draft Reply */}
                <Card className="border-teal-200 bg-teal-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-teal-600" />
                        AI Draft Reply
                        {draftResult && (
                          <Badge variant="outline" className="text-xs bg-teal-100 border-teal-300 text-teal-700 font-normal">
                            {draftResult.model}
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1.5">
                        {/* Tone selector */}
                        <Select
                          value={draftTone}
                          onValueChange={(v) => setDraftTone(v as typeof draftTone)}
                        >
                          <SelectTrigger className="h-7 text-xs w-28 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="technical">Technical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white"
                          onClick={() => generateDraftReply(false)}
                          disabled={draftLoading}
                        >
                          {draftLoading
                            ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                            : <RefreshCw className="w-3 h-3 mr-1.5" />
                          }
                          {draftResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white border-teal-300 text-teal-700 hover:bg-teal-50"
                          onClick={() => generateDraftReply(true)}
                          disabled={draftLoading}
                        >
                          <Save className="w-3 h-3 mr-1.5" />
                          Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* ── 取得中 ── */}
                  {draftLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      <span className="text-sm text-teal-700">AI で返信ドラフトを生成中...</span>
                    </CardContent>
                  )}

                  {/* ── エラー ── */}
                  {!draftLoading && draftError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">
                        ⚠ {draftError}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => generateDraftReply(false)}>
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        再試行
                      </Button>
                    </CardContent>
                  )}

                  {/* ── AI 生成結果 ── */}
                  {!draftLoading && draftResult && (
                    <CardContent className="space-y-4">
                      {/* tone バッジ */}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs bg-teal-100 border-teal-300 text-teal-800">
                          {draftResult.reply_tone}
                        </Badge>
                      </div>
                      {/* draft_reply */}
                      <div>
                        <div className="text-xs font-semibold text-teal-900 mb-2">返信ドラフト</div>
                        <div className="bg-white border border-teal-200 rounded-lg p-4">
                          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{draftResult.draft_reply}</pre>
                        </div>
                      </div>
                      {/* key_points */}
                      {draftResult.key_points.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-teal-900 mb-2">カバーしたポイント</div>
                          <ul className="space-y-1">
                            {draftResult.key_points.map((pt, idx) => (
                              <li key={idx} className="text-sm text-teal-800 flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-teal-500" />
                                {pt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* footer */}
                      <div className="flex items-center justify-between text-xs text-teal-400 border-t border-teal-200 pt-3">
                        <span>生成日時: {new Date(draftResult.generated_at).toLocaleString('ja-JP')}</span>
                        {draftResult.saved && (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            NocoDB に保存済み
                          </span>
                        )}
                        {draftResult.save_skipped && (
                          <span className="flex items-center gap-1 text-amber-600" title={draftResult.save_skip_reason}>
                            ⚠ 保存スキップ
                          </span>
                        )}
                      </div>
                    </CardContent>
                  )}

                  {/* ── 未生成（初期状態）── */}
                  {!draftLoading && !draftResult && !draftError && (
                    <CardContent className="py-6 text-center opacity-60">
                      <MessageSquare className="w-8 h-8 mx-auto text-teal-400 mb-2" />
                      <p className="text-xs text-teal-600">トーンを選んで「Generate Only」または「Generate &amp; Save」を押してください</p>
                    </CardContent>
                  )}
                </Card>

                {/* Generate Support Alert */}
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="w-4 h-4 text-orange-600" />
                        Support Alert
                        {alertResult && (
                          <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-700 font-normal">
                            {alertResult.model}
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white"
                          onClick={() => generateAlert(false)}
                          disabled={alertLoading}
                        >
                          {alertLoading
                            ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                            : <RefreshCw className="w-3 h-3 mr-1.5" />
                          }
                          {alertResult ? '再生成' : 'Generate Only'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 bg-white border-orange-300 text-orange-700 hover:bg-orange-50"
                          onClick={() => generateAlert(true)}
                          disabled={alertLoading}
                        >
                          <Save className="w-3 h-3 mr-1.5" />
                          Generate &amp; Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* ── 取得中 ── */}
                  {alertLoading && (
                    <CardContent className="flex items-center justify-center gap-3 py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                      <span className="text-sm text-orange-700">AI でアラートを生成中...</span>
                    </CardContent>
                  )}

                  {/* ── エラー ── */}
                  {!alertLoading && alertError && (
                    <CardContent className="space-y-3">
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 break-all">
                        ⚠ {alertError}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => generateAlert(false)}>
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        再試行
                      </Button>
                    </CardContent>
                  )}

                  {/* ── AI 生成結果 ── */}
                  {!alertLoading && alertResult && (
                    <CardContent className="space-y-4">
                      {/* alert_type + priority + escalation バッジ */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={
                          alertResult.priority === 'Critical' ? 'bg-red-700 text-white text-xs' :
                          alertResult.priority === 'High'     ? 'bg-red-500 text-white text-xs' :
                          alertResult.priority === 'Medium'   ? 'bg-amber-500 text-white text-xs' :
                          'bg-slate-400 text-white text-xs'
                        }>
                          {alertResult.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-orange-100 border-orange-300 text-orange-800">
                          {alertResult.alert_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-600">
                          {alertResult.status}
                        </Badge>
                        {alertResult.escalation_needed && (
                          <Badge className="bg-red-600 text-white text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Escalation
                          </Badge>
                        )}
                      </div>
                      {/* title */}
                      <div>
                        <div className="text-xs font-semibold text-orange-900 mb-1">タイトル</div>
                        <p className="text-sm font-medium text-orange-800">{alertResult.title}</p>
                      </div>
                      {/* summary */}
                      <div>
                        <div className="text-xs font-semibold text-orange-900 mb-1">サマリー</div>
                        <p className="text-sm text-orange-800">{alertResult.summary}</p>
                      </div>
                      {/* why_this_matters */}
                      <div>
                        <div className="text-xs font-semibold text-orange-900 mb-1">重要な理由</div>
                        <p className="text-sm text-orange-800">{alertResult.why_this_matters}</p>
                      </div>
                      {/* suggested_action */}
                      <div className="text-xs text-orange-700 italic border-t border-orange-200 pt-3">
                        推奨アクション: {alertResult.suggested_action}
                      </div>
                      {/* footer */}
                      <div className="flex items-center justify-between text-xs text-orange-400 border-t border-orange-200 pt-3">
                        <span>生成日時: {new Date(alertResult.generated_at).toLocaleString('ja-JP')}</span>
                        {alertResult.saved && (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            NocoDB に保存済み
                          </span>
                        )}
                        {alertResult.save_skipped && (
                          <span className="flex items-center gap-1 text-amber-600" title={alertResult.save_skip_reason}>
                            ⚠ 保存スキップ
                          </span>
                        )}
                      </div>
                    </CardContent>
                  )}

                  {/* ── 未生成（初期状態）── */}
                  {!alertLoading && !alertResult && !alertError && (
                    <CardContent className="py-6 text-center opacity-60">
                      <Bell className="w-8 h-8 mx-auto text-orange-400 mb-2" />
                      <p className="text-xs text-orange-600">「Generate Only」または「Generate &amp; Save」を押してアラートを生成します</p>
                    </CardContent>
                  )}
                </Card>

                {/* Triage Note */}
                {c.triageNote && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Triage Note</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-700">{c.triageNote}</p>
                    </CardContent>
                  </Card>
                )}

                {/* First Response: NocoDB にないフィールド。実データ取得時はモックを表示しない。*/}
                {!caseData && c.firstResponse && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">First Response</CardTitle>
                      <CardDescription>{c.firstResponseTime} で応答</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{c.firstResponse}</pre>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Routing History: NocoDB にないフィールド。実データ取得時はモックを表示しない。*/}
                {!caseData && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Routing History</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {c.routingHistory.map((event, idx) => (
                        <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                          <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-900">{event.action}</span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-500">{event.timestamp}</span>
                            </div>
                            <div className="text-sm text-slate-700">by {event.user}</div>
                            {event.note && <div className="text-xs text-slate-500 mt-1">{event.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Similar Cases: モックデータのみ。実データ取得時は非表示。*/}
                {!caseData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Similar Cases</CardTitle>
                    <CardDescription>類似した問い合わせ・サポート案件</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {SIMILAR_CASES.map((similar) => (
                        <div key={similar.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border">
                          <div className="flex-1">
                            <Link href={`/support/${similar.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                              {similar.title}
                            </Link>
                            <div className="text-xs text-slate-500 mt-1">
                              <Link href={`/companies/${similar.companyId}`} className="hover:text-blue-600 hover:underline">
                                {similar.company}
                              </Link>
                            </div>
                            {similar.resolved && similar.resolution && (
                              <div className="text-xs text-green-700 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                解決方法: {similar.resolution}
                              </div>
                            )}
                          </div>
                          <Badge className="bg-green-600 text-white text-xs ml-3">Resolved</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Internal Note */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Add Internal Note</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="内部メモを入力..."
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      rows={4}
                      className="mb-3"
                    />
                    <Button size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      Save Note
                    </Button>
                  </CardContent>
                </Card>

              </div>

              {/* Right column */}
              <div className="space-y-6">

                {/* Case Details */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Case Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">担当者</span>
                      {c.owner
                        ? <span className="font-medium text-slate-900">{c.owner}</span>
                        : <span className="text-slate-400 italic text-xs">未アサイン</span>
                      }
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">担当チーム</span>
                      <Badge variant="outline" className="text-xs">{c.assignedTeam ?? '—'}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">対応ステータス</span>
                      <Badge variant="outline" className={`text-xs ${routingColor(c.routingStatus)}`}>
                        {routingLabel(c.routingStatus)}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">重要度</span>
                      <Badge className={`${severityBg(c.severity)} text-white text-xs`}>
                        {severityLabel(c.severity)}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Open Duration</span>
                      <span className="font-medium text-slate-900">{c.openDuration}</span>
                    </div>
                    {c.linkedCSETicket && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Linked CSE Ticket</span>
                        <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                          <Ticket className="w-3 h-3 mr-1" />{c.linkedCSETicket}
                        </Badge>
                      </div>
                    )}
                    {/* API から取得した CSE Ticket（テーブルID設定後に表示） */}
                    {cseTickets.length > 0 && (
                      <div className="pt-2 border-t space-y-1">
                        <div className="text-xs font-semibold text-slate-600">CSE Tickets (API)</div>
                        {cseTickets.map(t => (
                          <div key={t.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700 truncate max-w-[140px]">{t.title}</span>
                            <Badge variant="outline" className="text-xs ml-2">{t.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Linked Company */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Linked Company / Project</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Link
                          href={`/companies/${c.companyId}`}
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors"
                    >
                      <Building className="w-4 h-4 text-slate-500" />
                      <div className="flex-1 text-sm font-medium text-slate-900">{c.company}</div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </Link>
                    {c.project && (
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <div className="flex-1 text-sm font-medium text-slate-900">{c.project}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Select defaultValue="none">
                      <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Select --</SelectItem>
                        <SelectItem value="csm">CSM Team</SelectItem>
                        <SelectItem value="support">Support Team</SelectItem>
                        <SelectItem value="cse">CSE Team</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Ticket className="w-4 h-4 mr-2" />
                      CSE Ticketを起票
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Actionを作成
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <FileText className="w-4 h-4 mr-2" />
                      Contentを作成
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <BookOpen className="w-4 h-4 mr-2" />
                      FAQ/Help候補にする
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      Outboundを準備
                    </Button>
                  </CardContent>
                </Card>

                {/* Related Actions / Related Content: モックデータのみ。実データ取得時は非表示。*/}
                {!caseData && RELATED_ACTIONS.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Related Actions</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {RELATED_ACTIONS.map((action) => (
                          <div key={action.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                            <Play className="w-4 h-4 text-slate-500" />
                            <div className="flex-1">
                              <div className="text-sm text-slate-900">{action.title}</div>
                              <div className="text-xs text-slate-500">{action.owner}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!caseData && RELATED_CONTENT.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Related Content</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {RELATED_CONTENT.map((content) => (
                          <div key={content.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                            <BookOpen className="w-4 h-4 text-slate-500" />
                            <div className="flex-1">
                              <div className="text-sm text-slate-900">{content.title}</div>
                              <Badge variant="outline" className="text-xs mt-1">{content.type}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
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
