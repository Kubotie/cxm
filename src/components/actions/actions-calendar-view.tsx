"use client";

// ─── アクションカレンダービュー ────────────────────────────────────────────────
// 月ごとのカレンダーグリッドにアクションをドット/チップ表示する。
// 日付セルをクリックするとその日のアクション一覧をポップオーバー表示し、
// 個別アクションをクリックすると onActionClick コールバックを呼ぶ。

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import type { ActionListItem } from "@/app/api/actions/route";
import { ACTION_STATUS_BADGE, RESULT_BADGE } from "@/lib/company/action-vm";

// ── ユーティリティ ────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const days: Date[] = [];
  // 前月の余白（週の始まり: 月曜）
  const startDow = (first.getDay() + 6) % 7; // 0=Mon, 6=Sun
  for (let i = startDow - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  // 翌月の余白（6行 × 7列 = 42セル）
  while (days.length < 42) {
    days.push(new Date(year, month + 1, days.length - last.getDate() - startDow + 1));
  }
  return days;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── フェーズ別ドットカラー ─────────────────────────────────────────────────────

function getDotColor(action: ActionListItem, today: string): string {
  if (action.status === 'done' || action.status === 'cancelled') return 'bg-slate-300';
  if (action.dueDate && action.dueDate < today) return 'bg-red-400';
  if (action.dueDate === today)                 return 'bg-amber-400';
  if (action._source === 'sf')                  return 'bg-blue-400';
  if (action.status === 'in_progress')          return 'bg-amber-300';
  return 'bg-slate-400';
}

// ── アクションチップ（セル内の短縮表示） ─────────────────────────────────────

function ActionChip({ action, today, onClick }: {
  action: ActionListItem;
  today:  string;
  onClick: (action: ActionListItem) => void;
}) {
  const dot = getDotColor(action, today);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(action); }}
      className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] hover:bg-slate-100 truncate group"
      title={action.title}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="truncate text-slate-700">{action.title}</span>
    </button>
  );
}

// ── 日付セルのポップオーバー（その日のアクション詳細リスト） ──────────────────

function DayPopover({ actions, today, onActionClick, onClose }: {
  actions:       ActionListItem[];
  today:         string;
  onActionClick: (action: ActionListItem) => void;
  onClose:       () => void;
}) {
  return (
    <div
      className="absolute z-50 left-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">{actions.length} 件のアクション</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
        {actions.map(action => {
          const badge = ACTION_STATUS_BADGE[action.status];
          return (
            <button
              key={action.id}
              onClick={() => { onActionClick(action); onClose(); }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] px-1 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                {action._source === 'sf' && (
                  <span className="text-[9px] text-blue-500">SF</span>
                )}
                {action.result && RESULT_BADGE[action.result] && (
                  <span className={`text-[9px] px-1 py-0.5 rounded ${RESULT_BADGE[action.result].cls}`}>
                    {action.result}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-800 font-medium truncate">{action.title}</p>
              {action.companyName && (
                <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                  <Building2 className="w-2.5 h-2.5" />
                  {action.companyName}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ActionsCalendarViewProps {
  actions:       ActionListItem[];
  today:         string;
  onActionClick: (action: ActionListItem) => void;
}

// ── メインコンポーネント ───────────────────────────────────────────────────────

export function ActionsCalendarView({ actions, today, onActionClick }: ActionsCalendarViewProps) {
  const todayDate = new Date(today + 'T00:00:00');
  const [currentMonth, setCurrentMonth] = useState(
    new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
  );
  const [openDayStr, setOpenDayStr] = useState<string | null>(null);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days  = useMemo(() => getDaysInMonth(year, month), [year, month]);

  // dateStr → actions のマップ
  const actionsByDate = useMemo(() => {
    const map = new Map<string, ActionListItem[]>();
    for (const action of actions) {
      if (!action.dueDate) continue;
      const list = map.get(action.dueDate) ?? [];
      list.push(action);
      map.set(action.dueDate, list);
    }
    return map;
  }, [actions]);

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
    setOpenDayStr(null);
  }
  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
    setOpenDayStr(null);
  }

  const DOW_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* ── カレンダーヘッダー ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {year}年 {month + 1}月
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── 曜日ヘッダー ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 border-b">
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            className={[
              'text-center text-[10px] py-2 font-medium',
              i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-slate-400',
            ].join(' ')}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── カレンダーグリッド ────────────────────────────────────────────── */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayStr      = toDateStr(day);
          const isThisMonth = day.getMonth() === month;
          const isToday     = dayStr === today;
          const dow         = (day.getDay() + 6) % 7; // 0=Mon
          const dayActions  = actionsByDate.get(dayStr) ?? [];
          const isOpen      = openDayStr === dayStr;
          const hasMore     = dayActions.length > 2;

          return (
            <div
              key={idx}
              className={[
                'relative min-h-[80px] border-b border-r p-1 cursor-pointer transition-colors',
                !isThisMonth   ? 'bg-slate-50/60'           : 'bg-white hover:bg-slate-50/50',
                isOpen         ? 'ring-2 ring-inset ring-slate-300' : '',
              ].join(' ')}
              onClick={() => setOpenDayStr(isOpen ? null : dayStr)}
            >
              {/* 日付番号 */}
              <div className="flex justify-end mb-1">
                <span className={[
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px]',
                  isToday
                    ? 'bg-slate-900 text-white font-bold'
                    : !isThisMonth
                    ? 'text-slate-300'
                    : dow === 5
                    ? 'text-blue-400'
                    : dow === 6
                    ? 'text-red-400'
                    : 'text-slate-700',
                ].join(' ')}>
                  {day.getDate()}
                </span>
              </div>

              {/* アクションチップ（最大2件表示）*/}
              <div className="space-y-0.5">
                {dayActions.slice(0, 2).map(action => (
                  <ActionChip
                    key={action.id}
                    action={action}
                    today={today}
                    onClick={onActionClick}
                  />
                ))}
                {hasMore && (
                  <div className="text-[10px] text-slate-400 px-1">
                    +{dayActions.length - 2} 件
                  </div>
                )}
              </div>

              {/* ポップオーバー */}
              {isOpen && dayActions.length > 0 && (
                <DayPopover
                  actions={dayActions}
                  today={today}
                  onActionClick={onActionClick}
                  onClose={() => setOpenDayStr(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── 凡例 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t bg-slate-50">
        {[
          { cls: 'bg-red-400',   label: '期限超過' },
          { cls: 'bg-amber-400', label: '今日期限' },
          { cls: 'bg-amber-300', label: '計画中' },
          { cls: 'bg-blue-400',  label: 'SF行動' },
          { cls: 'bg-slate-400', label: '未着手' },
          { cls: 'bg-slate-300', label: '実施済み' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cls}`} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
