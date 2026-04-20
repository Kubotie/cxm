// ─── Company Action ViewModel ─────────────────────────────────────────────────
//
// LocalAction[] → CompanyActionVM[] へ変換し、
// アクション一覧 UI に必要な表示値を事前計算する。
//
// 消費箇所: company-detail.tsx (ActionsTab)

import type { LocalAction, ActionStatus } from './action-vm';
import {
  ACTION_STATUS_BADGE,
  ACTION_CREATED_FROM_LABEL,
  SF_TODO_STATUS_BADGE,
} from './action-vm';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompanyActionVM extends LocalAction {
  /** ステータスの日本語ラベル */
  statusLabel:  string;
  /** ステータスバッジの Tailwind cls */
  statusCls:    string;
  /** ステータスドットの Tailwind cls */
  statusDotCls: string;
  /** 起票元の日本語ラベル */
  fromLabel:    string;
  /** SF 連動状態ラベル（null = 連動設定なし） */
  sfTodoLabel:  string | null;
  /** SF 連動状態テキスト色 cls */
  sfTodoCls:    string | null;
  /** YYYY-MM-DD 形式の期日（null = 未設定） */
  dueDateStr:   string | null;
  /** 期限切れ（open/in_progress かつ dueDate < now） */
  overdue:      boolean;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function toCompanyActionVM(a: LocalAction): CompanyActionVM {
  const statusCfg = ACTION_STATUS_BADGE[a.status];
  const sfCfg     = a.sfTodoStatus
    ? SF_TODO_STATUS_BADGE[a.sfTodoStatus as keyof typeof SF_TODO_STATUS_BADGE]
    : null;

  const dueDate = a.dueDate ? new Date(a.dueDate) : null;
  const overdue = !!dueDate
    && dueDate < new Date()
    && (a.status === 'open' || a.status === 'in_progress');

  return {
    ...a,
    statusLabel:  statusCfg.label,
    statusCls:    statusCfg.cls,
    statusDotCls: statusCfg.dotCls,
    fromLabel:    ACTION_CREATED_FROM_LABEL[a.createdFrom],
    sfTodoLabel:  sfCfg?.label  ?? null,
    sfTodoCls:    sfCfg?.cls    ?? null,
    dueDateStr:   a.dueDate?.slice(0, 10) ?? null,
    overdue,
  };
}

/**
 * LocalAction[] を Open / Closed に分けて CompanyActionVM[] に変換する。
 * open = status が 'open' または 'in_progress'
 * closed = status が 'done' または 'cancelled'
 */
export function groupActionsByStatus(actions: LocalAction[]): {
  open:   CompanyActionVM[];
  closed: CompanyActionVM[];
} {
  const open:   CompanyActionVM[] = [];
  const closed: CompanyActionVM[] = [];

  for (const a of actions) {
    const vm = toCompanyActionVM(a);
    if (a.status === 'open' || a.status === 'in_progress') {
      open.push(vm);
    } else {
      closed.push(vm);
    }
  }

  // open は createdAt 降順、closed も降順
  const byCreated = (a: CompanyActionVM, b: CompanyActionVM) =>
    b.createdAt.localeCompare(a.createdAt);
  open.sort(byCreated);
  closed.sort(byCreated);

  return { open, closed };
}
