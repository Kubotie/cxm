"use client";

// ─── アクション管理画面 /actions ──────────────────────────────────────────────
//
// 目的: Home / Company Detail から起票された Action を集約し、
//       フェーズ（未着手 → 計画中 → 実施済み）別に整理して
//       自分が今やるべきことに集中できる実行画面。
//
// フェーズ分類:
//   未着手: status=open かつ _source≠sf
//   計画中: status=in_progress OR (sf かつ dueDate≥today)
//   実施済み: status=done|cancelled OR (sf かつ dueDate<today)

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import {
  CheckCircle2, AlertTriangle, ChevronRight,
  RefreshCw, Loader2, CalendarClock, Building2, Phone,
  Mail, MessageCircle, Hash, Check, CalendarPlus, RotateCcw,
  ChevronDown, ChevronUp, ListTodo, Calendar, Plus, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCreateDialog } from "@/components/company/action-create-dialog";
import { ActionDetailSheet }  from "@/components/actions/action-detail-sheet";
import { ActionsCalendarView } from "@/components/actions/actions-calendar-view";
import type { LocalAction } from "@/lib/company/action-vm";
import type { AppCompanyAction } from "@/lib/nocodb/types";
import type { ActionListItem }   from "@/app/api/actions/route";
import {
  ACTION_STATUS_BADGE,
  ACTION_CREATED_FROM_LABEL,
  CHANNEL_LABEL,
  RESULT_BADGE,
  POC_SHORT,
  type ActionStatus,
  type RecommendedChannel,
} from "@/lib/company/action-vm";

// ── フェーズ型 ────────────────────────────────────────────────────────────────

type Phase = 'not_started' | 'planning' | 'done';

function getPhase(action: ActionListItem, today: string): Phase {
  void today; // 将来の拡張用
  if (action.status === 'done' || action.status === 'cancelled') return 'done';
  if (action.status === 'in_progress') return 'planning';
  return 'not_started';
}

// ── フィルタ型 ────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'not_started' | 'planning' | 'done' | 'overdue' | 'result_d' | 'support' | 'risk' | 'expansion';

interface SummaryStats {
  notStarted: number;
  planning:   number;
  overdue:    number;
  resultD:    number;
}

// ── ユーティリティ ─────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(action: ActionListItem, today: string): boolean {
  return !!(action.dueDate && action.dueDate < today && (action.status === 'open' || action.status === 'in_progress'));
}

function isToday(action: ActionListItem, today: string): boolean {
  return action.dueDate === today;
}

function formatDueDate(action: ActionListItem, today: string): { label: string; cls: string } {
  const { dueDate, status } = action;
  if (!dueDate) return { label: '期日未設定', cls: 'text-slate-400' };

  // 完了済みは日付のみ表示
  if (status === 'done' || status === 'cancelled') {
    return { label: dueDate.slice(5).replace('-', '/'), cls: 'text-slate-400' };
  }

  if (dueDate < today) {
    const days = Math.ceil((new Date(today).getTime() - new Date(dueDate).getTime()) / 86400000);
    return { label: `${days}日超過`, cls: 'text-red-600 font-semibold' };
  }
  if (dueDate === today) return { label: '今日期限', cls: 'text-amber-600 font-semibold' };
  const days = Math.ceil((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000);
  if (days <= 3) return { label: `${days}日後`, cls: 'text-amber-500' };
  return { label: dueDate.slice(5).replace('-', '/'), cls: 'text-slate-500' };
}

const CHANNEL_ICON: Record<RecommendedChannel, React.ReactNode> = {
  call:     <Phone     className="w-3 h-3" />,
  mail:     <Mail      className="w-3 h-3" />,
  intercom: <MessageCircle className="w-3 h-3" />,
  slack:    <Hash      className="w-3 h-3" />,
};

// ── SF同期バッジ ──────────────────────────────────────────────────────────────

function SfBadge({ status, source }: { status: AppCompanyAction['sfTodoStatus']; source: ActionListItem['_source'] }) {
  if (source === 'sf' || source === 'both') {
    return <span className="text-[10px] text-blue-500 font-medium">SF連携</span>;
  }
  if (!status || status === 'not_synced') {
    return <span className="text-[10px] text-slate-300">SF未同期</span>;
  }
  if (status === 'synced') {
    return <span className="text-[10px] text-green-500">SF同期済</span>;
  }
  return <span className="text-[10px] text-red-400">SF同期エラー</span>;
}

// ── アクション行 ──────────────────────────────────────────────────────────────

interface ActionRowProps {
  action:        ActionListItem;
  phase:         Phase;
  today:         string;
  onPlan:        (action: ActionListItem) => void;
  onDone:        (action: ActionListItem) => void;
  onReopen:      (action: ActionListItem) => void;
  onSnooze:      (action: ActionListItem) => void;
  onSfSync:      (action: ActionListItem) => void;
  onRowClick:    (action: ActionListItem) => void;
  processing:    Set<string>;
  showOwner?:    boolean;
}

function ActionRow({ action, phase, today, onPlan, onDone, onReopen, onSnooze, onSfSync, onRowClick, processing, showOwner }: ActionRowProps) {
  const overdue     = isOverdue(action, today);
  const due         = formatDueDate(action, today);
  const statusBadge = ACTION_STATUS_BADGE[action.status];
  const contextLabel = ACTION_CREATED_FROM_LABEL[action.createdFrom];
  const isSfOnly    = action._source === 'sf';
  const isSyncing   = processing.has(action.id);
  const canSfSync   = !isSfOnly && !!action.companyUid;

  return (
    <div
      className={[
        'group border rounded-lg bg-white transition-all cursor-pointer',
        overdue  ? 'border-red-200 bg-red-50/30' :
        isSfOnly ? 'border-blue-100 bg-blue-50/20 hover:border-blue-200' :
                   'border-slate-200 hover:border-slate-300',
      ].join(' ')}
      onClick={() => onRowClick(action)}
    >
      {/* 1行目: 主要情報 */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* 期日 */}
        <span className={`text-xs w-20 flex-shrink-0 ${due.cls}`}>{due.label}</span>

        {/* 顧客名 */}
        {action.companyUid ? (
          <Link
            href={`/companies/${action.companyUid}`}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 flex-shrink-0 w-32 truncate"
            title={action.companyName}
          >
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{action.companyName || action.companyUid}</span>
          </Link>
        ) : (
          <span className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0 w-32 truncate">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">—</span>
          </span>
        )}

        {/* 担当者（admin表示時）*/}
        {showOwner && action.owner && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 flex-shrink-0 max-w-[80px] truncate" title={action.owner}>
            {action.owner}
          </span>
        )}

        {/* タイトル */}
        <span className="flex-1 text-sm font-medium text-slate-800 truncate min-w-0" title={action.title}>
          {action.title}
        </span>

        {/* result グレードバッジ */}
        {action.result && RESULT_BADGE[action.result] && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${RESULT_BADGE[action.result].cls}`}>
            {action.result}
          </span>
        )}

        {/* ステータスバッジ */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>

        {/* SF同期 */}
        <div className="flex-shrink-0 w-14 text-right">
          <SfBadge status={action.sfTodoStatus} source={action._source} />
        </div>

        {/* アクションボタン */}
        <div
          className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          {/* CXMアクションのみ: 計画する / 延期 */}
          {!isSfOnly && phase === 'not_started' && (
            <button
              onClick={() => onPlan(action)}
              title="計画する"
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded hover:bg-amber-50 hover:text-amber-700 text-slate-400 border border-transparent hover:border-amber-200 transition-colors"
            >
              <Calendar className="w-3 h-3" />
              計画する
            </button>
          )}
          {!isSfOnly && phase === 'planning' && (
            <button
              onClick={() => onSnooze(action)}
              title="1日延期"
              className="p-1.5 rounded hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
            </button>
          )}
          {/* 実施済みボタン: SF含む全アクションで計画中 / 期限超過時に表示 */}
          {phase !== 'done' && (
            <button
              onClick={() => onDone(action)}
              title="実施済みにする"
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded hover:bg-green-50 hover:text-green-700 text-slate-400 border border-transparent hover:border-green-200 transition-colors"
            >
              <Check className="w-3 h-3" />
              実施済み
            </button>
          )}
          {/* 再開: CXMのみ */}
          {!isSfOnly && phase === 'done' && (
            <button
              onClick={() => onReopen(action)}
              title="再開する"
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded hover:bg-blue-50 hover:text-blue-700 text-slate-400 border border-transparent hover:border-blue-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              再開
            </button>
          )}
          {/* SF同期ボタン */}
          {canSfSync && (
            <button
              onClick={() => onSfSync(action)}
              disabled={isSyncing}
              title={action.sfTodoId ? 'SFへ更新を反映' : 'SFにTaskとして登録'}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded hover:bg-blue-50 hover:text-blue-700 text-slate-400 border border-transparent hover:border-blue-200 transition-colors disabled:opacity-40"
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span className="text-[10px]">↑SF</span>
              )}
              {action.sfTodoId ? '更新' : '同期'}
            </button>
          )}
          {action.companyUid && (
            <Link
              href={`/companies/${action.companyUid}`}
              title="企業詳細"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* 2行目: 補足情報 */}
      {(action.body || action.recommendedChannel || action.activityType || action.actionPurpose || action.poc || action.eventFormat) && (
        <div className="flex items-start gap-3 px-4 pb-2.5 pt-0">
          <div className="w-20 flex-shrink-0" />
          <div className="w-32 flex-shrink-0" />

          <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-[10px] text-slate-400 flex-shrink-0">{contextLabel}</span>

            {action.activityType && (
              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                {action.activityType}
              </span>
            )}
            {action.actionPurpose && (
              <span
                className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[160px]"
                title={action.actionPurpose}
              >
                {action.actionPurpose}
              </span>
            )}
            {action.poc && (
              <span className="text-[10px] text-slate-400 flex-shrink-0">
                {POC_SHORT[action.poc] ?? action.poc}
              </span>
            )}
            {action.eventFormat && (
              <span className="text-[10px] text-slate-400 flex-shrink-0">{action.eventFormat}</span>
            )}
            {action.body && (
              <span className="text-xs text-slate-500 truncate" title={action.body}>
                · {action.body}
              </span>
            )}
          </div>

          {action.recommendedChannel && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0">
              {CHANNEL_ICON[action.recommendedChannel]}
              <span>{CHANNEL_LABEL[action.recommendedChannel]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── フェーズセクション ─────────────────────────────────────────────────────────

interface PhaseSectionProps {
  title:       string;
  icon:        React.ReactNode;
  actions:     ActionListItem[];
  today:       string;
  defaultOpen: boolean;
  processing:  Set<string>;
  onPlan:      (action: ActionListItem) => void;
  onDone:      (action: ActionListItem) => void;
  onReopen:    (action: ActionListItem) => void;
  onSnooze:    (action: ActionListItem) => void;
  onSfSync:    (action: ActionListItem) => void;
  onRowClick:  (action: ActionListItem) => void;
  phase:       Phase;
  accentCls?:  string;
  showOwner?:  boolean;
}

function PhaseSection({
  title, icon, actions, today, defaultOpen, processing,
  onPlan, onDone, onReopen, onSnooze, onSfSync, onRowClick, phase, accentCls = 'text-slate-600', showOwner,
}: PhaseSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      {/* セクションヘッダー */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 py-2 px-1 text-left group"
      >
        <span className={`flex items-center gap-1.5 text-xs font-medium ${accentCls}`}>
          {icon}
          {title}
        </span>
        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
          {actions.length}
        </span>
        <div className="flex-1 h-px bg-slate-100 ml-1" />
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />}
      </button>

      {/* アクション一覧 */}
      {open && (
        <div className="space-y-1.5 mt-1">
          {actions.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-3 text-center">なし</p>
          ) : (
            actions.map(action => (
              <div key={action.id} className={processing.has(action.id) ? 'opacity-50 pointer-events-none' : ''}>
                <ActionRow
                  action={action}
                  phase={phase}
                  today={today}
                  onPlan={onPlan}
                  onDone={onDone}
                  onReopen={onReopen}
                  onSnooze={onSnooze}
                  onSfSync={onSfSync}
                  onRowClick={onRowClick}
                  processing={processing}
                  showOwner={showOwner}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────────────────

type ViewMode = 'list' | 'calendar';

export function ActionsPage() {
  const [actions,        setActions]        = useState<ActionListItem[]>([]);
  const [sfEventCount,   setSfEventCount]   = useState<number | null>(null);
  const [isAdminView,    setIsAdminView]    = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [filter,         setFilter]         = useState<FilterKey>('all');
  const [processing,     setProcessing]     = useState<Set<string>>(new Set());
  const [createOpen,     setCreateOpen]     = useState(false);
  const [viewMode,       setViewMode]       = useState<ViewMode>('list');
  const [selectedAction, setSelectedAction] = useState<ActionListItem | null>(null);
  const [sheetOpen,      setSheetOpen]      = useState(false);

  const today = getTodayStr();

  // ── データ取得（常にdone含む） ─────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/actions?include_done=1');
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { actions: ActionListItem[]; sfEventCount?: number; isAdminView?: boolean };
      setActions(data.actions);
      if (data.sfEventCount !== undefined) setSfEventCount(data.sfEventCount);
      setIsAdminView(data.isAdminView === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── ステータス更新ヘルパー ─────────────────────────────────────────────────

  async function patchStatus(action: ActionListItem, status: ActionStatus) {
    // SF-only（NocoDB未登録）は PATCH できないのでスキップ
    if (action._source === 'sf') return;
    setProcessing(prev => new Set(prev).add(action.id));
    try {
      const res = await fetch(`/api/actions/${action.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId: action.rowId, status }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      setActions(prev => prev.map(a => a.id === action.id ? { ...a, status } : a));
    } catch (e) {
      console.error('[patchStatus] failed:', e, { actionId: action.id, rowId: action.rowId, status });
      setError(e instanceof Error ? e.message : 'ステータスの更新に失敗しました');
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(action.id); return s; });
    }
  }

  // SF-only アクションを完了にする（NocoDB に新規作成して status=done）
  async function markSfDone(action: ActionListItem) {
    if (!action.companyUid) return;
    setProcessing(prev => new Set(prev).add(action.id));
    try {
      const newId = crypto.randomUUID();
      const res = await fetch(`/api/company/${action.companyUid}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id:      newId,
          company_name:   action.companyName,
          title:          action.title ?? '（SF行動）',
          description:    action.body,
          owner:          action.owner,
          owner_sf_id:    action.ownerSfId,
          due_date:       action.dueDate,
          status:         'done',
          created_from:   'manual',
          sf_todo_status: 'synced',
          sf_todo_id:     action.sfTodoId,
          created_at:     new Date().toISOString(), // SF行動の古い日時でなく現在時刻で登録（fetch limit内に収めるため）
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      // ローカル: SF行動を done に更新
      setActions(prev => prev.map(a =>
        a.id === action.id ? { ...a, status: 'done' as const, _source: 'both' as const } : a,
      ));
    } catch (e) {
      console.error('[markSfDone] failed:', e, { actionId: action.id, companyUid: action.companyUid });
      setError(e instanceof Error ? e.message : 'SFアクションの完了登録に失敗しました');
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(action.id); return s; });
    }
  }

  const handlePlan   = (action: ActionListItem) => patchStatus(action, 'in_progress');
  const handleDone   = (action: ActionListItem) =>
    action._source === 'sf' ? markSfDone(action) : patchStatus(action, 'done');
  const handleReopen = (action: ActionListItem) => patchStatus(action, 'open');

  // ── 1日延期 ───────────────────────────────────────────────────────────────

  async function handleSnooze(action: ActionListItem) {
    if (action._source === 'sf') return;
    const base    = action.dueDate ?? today;
    const newDate = new Date(base);
    newDate.setDate(newDate.getDate() + 1);
    const newDue  = newDate.toISOString().slice(0, 10);

    setProcessing(prev => new Set(prev).add(action.id));
    try {
      const res = await fetch(`/api/actions/${action.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId: action.rowId, due_date: newDue }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      setActions(prev => prev.map(a => a.id === action.id ? { ...a, dueDate: newDue } : a));
    } catch (e) {
      console.error('[handleSnooze] failed:', e, { actionId: action.id, rowId: action.rowId });
      setError(e instanceof Error ? e.message : '期日の更新に失敗しました');
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(action.id); return s; });
    }
  }

  // ── 新規アクション作成 ────────────────────────────────────────────────────

  async function handleActionCreated(action: LocalAction) {
    try {
      await fetch(`/api/company/${action.companyUid}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id:      action.id,
          company_name:   action.companyName ?? action.companyUid,
          title:          action.title,
          description:    action.body,
          owner:          action.owner,
          owner_sf_id:    action.ownerSfId,
          due_date:       action.dueDate,
          status:         action.status,
          created_from:   action.createdFrom,
          source_ref:     action.sourceRef,
          person_ref:     action.personRef,
          sf_todo_status: action.sfTodoStatus,
          sf_todo_id:     null,
          poc:            action.poc,
          activity_type:  action.activityType,
          result:         action.result,
          event_format:   action.eventFormat,
          action_purpose: action.actionPurpose,
          created_at:     action.createdAt,
        }),
      });
    } catch (e) {
      console.error('[actions create]', e);
    }
    load();
  }

  // ── SF同期 ────────────────────────────────────────────────────────────────

  async function handleSfSync(action: ActionListItem) {
    if (action._source === 'sf' || !action.companyUid) return;
    setProcessing(prev => new Set(prev).add(action.id));
    try {
      if (!action.sfTodoId) {
        // 新規 SF Task 作成
        const res = await fetch(`/api/company/${action.companyUid}/sf-todos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId:      action.id,
            subject:       action.title,
            description:   action.body,
            status:        action.status,
            dueDate:       action.dueDate,
            ownerEmail:    action.owner,
            sourceRef:     action.sourceRef,
            confirmCreate: true,
          }),
        });
        const data = await res.json() as { ok: boolean; sfTodoId?: string; syncedAt?: string; error?: string };
        if (data.ok && data.sfTodoId) {
          // NocoDB に sfTodoId / sfTodoStatus を保存
          await fetch(`/api/actions/${action.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rowId:             action.rowId,
              sf_todo_id:        data.sfTodoId,
              sf_todo_status:    'synced',
              sf_last_synced_at: data.syncedAt ?? new Date().toISOString(),
            }),
          });
          setActions(prev => prev.map(a =>
            a.id === action.id
              ? { ...a, sfTodoId: data.sfTodoId!, sfTodoStatus: 'synced' as const }
              : a,
          ));
        } else {
          console.error('[SF同期] 作成失敗:', data.error);
          setActions(prev => prev.map(a =>
            a.id === action.id ? { ...a, sfTodoStatus: 'sync_error' as const } : a,
          ));
        }
      } else {
        // 既存 SF Task を更新
        const res = await fetch(
          `/api/company/${action.companyUid}/actions/${action.id}/sf-push`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sfTaskId:    action.sfTodoId,
              title:       action.title,
              description: action.body,
              dueDate:     action.dueDate,
              ownerEmail:  action.owner,
              status:      action.status,
            }),
          },
        );
        const data = await res.json() as { ok: boolean };
        setActions(prev => prev.map(a =>
          a.id === action.id
            ? { ...a, sfTodoStatus: data.ok ? 'synced' as const : 'sync_error' as const }
            : a,
        ));
      }
    } catch (e) {
      console.error('[SF同期]', e);
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(action.id); return s; });
    }
  }

  // ── 詳細シート ────────────────────────────────────────────────────────────

  function handleRowClick(action: ActionListItem) {
    setSelectedAction(action);
    setSheetOpen(true);
  }

  function handleActionUpdated(updated: Partial<ActionListItem> & { id: string }) {
    setActions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    setSelectedAction(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
  }

  function handleSheetDone(action: ActionListItem) {
    void (action._source === 'sf' ? markSfDone(action) : patchStatus(action, 'done'));
  }

  function handleSheetReopen(action: ActionListItem) {
    void patchStatus(action, 'open');
  }

  // ── 集計 ──────────────────────────────────────────────────────────────────

  const stats: SummaryStats = {
    notStarted: actions.filter(a => getPhase(a, today) === 'not_started').length,
    planning:   actions.filter(a => getPhase(a, today) === 'planning').length,
    overdue:    actions.filter(a => isOverdue(a, today)).length,
    resultD:    actions.filter(a => getPhase(a, today) !== 'done' && a.result === 'D').length,
  };

  // ── フィルタ ──────────────────────────────────────────────────────────────

  const filtered = (() => {
    switch (filter) {
      case 'not_started': return actions.filter(a => getPhase(a, today) === 'not_started');
      case 'planning':    return actions.filter(a => getPhase(a, today) === 'planning');
      case 'done':        return actions.filter(a => getPhase(a, today) === 'done');
      case 'overdue':     return actions.filter(a => isOverdue(a, today));
      case 'result_d':    return actions.filter(a => a.result === 'D');
      case 'support':     return actions.filter(a => a.createdFrom === 'support_case');
      case 'risk':        return actions.filter(a => a.createdFrom === 'risk_signal');
      case 'expansion':   return actions.filter(a => a.createdFrom === 'opportunity_signal');
      default:            return actions; // 'all' → グループ表示で使うため全件
    }
  })();

  const FILTERS: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'all',         label: 'すべて' },
    { key: 'not_started', label: '未着手',       count: stats.notStarted },
    { key: 'planning',    label: '計画中',        count: stats.planning },
    { key: 'done',        label: '実施済み' },
    { key: 'overdue',     label: '期限超過',      count: stats.overdue },
    { key: 'result_d',    label: '要フォロー',    count: stats.resultD },
    { key: 'support',     label: 'サポート起点' },
    { key: 'risk',        label: 'リスク対応' },
    { key: 'expansion',   label: '拡張機会' },
  ];

  // ── フェーズ別グループ ─────────────────────────────────────────────────────

  const notStartedActions = actions.filter(a => getPhase(a, today) === 'not_started');
  const planningActions   = actions.filter(a => getPhase(a, today) === 'planning');
  const doneActions       = actions.filter(a => getPhase(a, today) === 'done');

  // ── レンダリング ──────────────────────────────────────────────────────────

  const sharedRowProps = { today, onPlan: handlePlan, onDone: handleDone, onReopen: handleReopen, onSnooze: handleSnooze, onSfSync: handleSfSync, onRowClick: handleRowClick, processing, showOwner: isAdminView };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-auto">

          {/* ── ヘッダー ─────────────────────────────────────────────────── */}
          <div className="border-b bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold text-slate-900">アクション</h1>
                  {isAdminView && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200 font-medium">
                      全ユーザー表示
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAdminView ? '全ユーザーのアクション一覧' : '担当アクションの優先キュー'}
                  {sfEventCount !== null && sfEventCount > 0 && (
                    <span className="ml-2 text-blue-500">· SF行動 {sfEventCount}件含む</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* ビュー切り替え */}
                <div className="flex items-center border border-slate-200 rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    title="リスト表示"
                    className={[
                      'px-2.5 py-1.5 transition-colors',
                      viewMode === 'list'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    title="カレンダー表示"
                    className={[
                      'px-2.5 py-1.5 transition-colors border-l border-slate-200',
                      viewMode === 'calendar'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  新規作成
                </Button>
                <button
                  onClick={() => load()}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  更新
                </button>
              </div>
            </div>

            {/* ── StatPills ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-4 mt-4">
              <StatPill
                icon={<ListTodo className="w-3.5 h-3.5 text-blue-500" />}
                label="未着手"
                value={stats.notStarted}
                active={filter === 'not_started'}
                onClick={() => setFilter(f => f === 'not_started' ? 'all' : 'not_started')}
                valueCls={stats.notStarted > 0 ? 'text-blue-600 font-semibold' : 'text-slate-400'}
              />
              <StatPill
                icon={<Calendar className="w-3.5 h-3.5 text-amber-500" />}
                label="計画中"
                value={stats.planning}
                active={filter === 'planning'}
                onClick={() => setFilter(f => f === 'planning' ? 'all' : 'planning')}
                valueCls={stats.planning > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}
              />
              <StatPill
                icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                label="期限超過"
                value={stats.overdue}
                active={filter === 'overdue'}
                onClick={() => setFilter(f => f === 'overdue' ? 'all' : 'overdue')}
                valueCls={stats.overdue > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}
              />
              <StatPill
                icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                label="要フォロー"
                value={stats.resultD}
                active={filter === 'result_d'}
                onClick={() => setFilter(f => f === 'result_d' ? 'all' : 'result_d')}
                valueCls={stats.resultD > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}
              />
            </div>
          </div>

          {/* ── フィルタータブ ───────────────────────────────────────────── */}
          <div className="border-b bg-white px-6">
            <div className="flex items-center gap-0 overflow-x-auto">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={[
                    'px-3 py-2.5 text-xs border-b-2 transition-colors whitespace-nowrap',
                    filter === f.key
                      ? 'border-slate-900 text-slate-900 font-medium'
                      : 'border-transparent text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  {f.label}
                  {f.count !== undefined && (
                    <span className={[
                      'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                      f.count > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400',
                    ].join(' ')}>
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── メインコンテンツ ────────────────────────────────────────── */}
          <div className="px-6 py-4">

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                読み込み中…
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && (
              <>
                {/* カレンダービュー */}
                {viewMode === 'calendar' && (
                  <ActionsCalendarView
                    actions={actions}
                    today={today}
                    onActionClick={handleRowClick}
                  />
                )}

                {/* リストビュー */}
                {viewMode === 'list' && (
                  <>
                    {/* テーブルヘッダー */}
                    <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                      <div className="w-20 flex-shrink-0">期日</div>
                      <div className="w-32 flex-shrink-0">顧客</div>
                      <div className="flex-1">アクション</div>
                      <div className="w-14 flex-shrink-0">状態</div>
                      <div className="w-14 flex-shrink-0 text-right">SF同期</div>
                      <div className="w-24 flex-shrink-0" />
                    </div>

                    {/* すべてタブ: フェーズ別グループ表示 */}
                    {filter === 'all' && (
                      <>
                        <PhaseSection
                          title="未着手"
                          icon={<ListTodo className="w-3.5 h-3.5" />}
                          actions={notStartedActions}
                          phase="not_started"
                          defaultOpen={true}
                          accentCls="text-blue-700"
                          {...sharedRowProps}
                        />
                        <PhaseSection
                          title="計画中"
                          icon={<CalendarClock className="w-3.5 h-3.5" />}
                          actions={planningActions}
                          phase="planning"
                          defaultOpen={true}
                          accentCls="text-amber-700"
                          {...sharedRowProps}
                        />
                        <PhaseSection
                          title="実施済み"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          actions={doneActions}
                          phase="done"
                          defaultOpen={false}
                          accentCls="text-slate-500"
                          {...sharedRowProps}
                        />
                      </>
                    )}

                    {/* 特定タブ: フラットリスト表示 */}
                    {filter !== 'all' && (
                      <>
                        {filtered.length === 0 ? (
                          <div className="text-center py-16">
                            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-slate-700">該当するアクションはありません</p>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              {filtered.map(action => (
                                <div key={action.id} className={processing.has(action.id) ? 'opacity-50 pointer-events-none' : ''}>
                                  <ActionRow
                                    action={action}
                                    phase={getPhase(action, today)}
                                    today={today}
                                    onPlan={handlePlan}
                                    onDone={handleDone}
                                    onReopen={handleReopen}
                                    onSnooze={handleSnooze}
                                    onSfSync={handleSfSync}
                                    onRowClick={handleRowClick}
                                    processing={processing}
                                    showOwner={isAdminView}
                                  />
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-4 text-center">{filtered.length} 件表示</p>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* 新規アクション作成ダイアログ */}
      <ActionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleActionCreated}
      />

      {/* アクション詳細シート */}
      <ActionDetailSheet
        action={selectedAction}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={handleActionUpdated}
        onDone={handleSheetDone}
        onReopen={handleSheetReopen}
      />
    </div>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────

interface StatPillProps {
  icon:     React.ReactNode;
  label:    string;
  value:    number;
  active:   boolean;
  onClick:  () => void;
  valueCls: string;
}

function StatPill({ icon, label, value, active, onClick, valueCls }: StatPillProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border transition-colors',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
      ].join(' ')}
    >
      {icon}
      <span className={active ? 'text-white' : 'text-slate-500'}>{label}</span>
      <span className={active ? 'text-white font-semibold' : valueCls}>{value}</span>
    </button>
  );
}
