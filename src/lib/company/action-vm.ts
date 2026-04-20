// ─── Company Action / SF ToDo ローカル VM ────────────────────────────────────
//
// NocoDB に action / sf_todo テーブルが存在しないため、
// 現在はクライアントローカル state で管理する。
//
// 将来実装予定:
//   - POST /api/company/[companyUid]/actions → NocoDB actions テーブル
//   - POST /api/company/[companyUid]/sf-todo → Salesforce ToDo API 連携
//
// このファイルはクライアント・サーバー両対応（副作用なし）。

// ── Action ────────────────────────────────────────────────────────────────────

/** Action の進捗状態 */
export type ActionStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

/**
 * どこから Action が起票されたか（詳細分類）。
 * 'manual':             ヘッダー等から手動起票
 * 'risk_signal':        Risk シグナル行の CTA
 * 'opportunity_signal': Opportunity シグナル行の CTA
 * 'support_case':       サポートケースからの起票（将来）
 * 'people_risk':        Org Chart / People リスクバナーからの起票
 */
export type ActionCreatedFrom =
  | 'manual'
  | 'risk_signal'
  | 'opportunity_signal'
  | 'support_case'
  | 'people_risk';

/**
 * Action 作成ダイアログのアイコン用。
 * LocalAction には createdFrom を使う。
 */
export type ActionSourceType = 'header' | 'signal' | 'summary' | 'people';

export interface LocalAction {
  /** NocoDB row Id（永続化後に設定。未保存の場合は undefined） */
  rowId?:       number;
  id:           string;
  companyUid:   string;
  title:        string;
  body:         string;
  owner:        string;
  dueDate:      string | null;
  /** 起票元タイプ（詳細分類） */
  createdFrom:  ActionCreatedFrom;
  /** signal / case title など（参照用） */
  sourceRef:    string | null;
  /** Org Chart 起票時の person 名（参照用） */
  personRef:    string | null;
  /** SF ToDo 連動状態（null = 連動なし） */
  sfTodoStatus: 'not_synced' | 'synced' | 'sync_error' | null;
  /** Salesforce Task ID（sf_push 時のキー）*/
  sfTodoId:     string | null;
  status:       ActionStatus;
  createdAt:    string;
}

export function createLocalAction(
  fields: Omit<LocalAction, 'id' | 'status' | 'createdAt'>,
): LocalAction {
  return {
    ...fields,
    id:        crypto.randomUUID(),
    status:    'open',
    createdAt: new Date().toISOString(),
  };
}

// ── Action badges / labels ────────────────────────────────────────────────────

export const ACTION_STATUS_BADGE: Record<ActionStatus, { label: string; cls: string; dotCls: string }> = {
  open:        { label: 'Open',       cls: 'bg-blue-50 text-blue-700 border-blue-200',    dotCls: 'bg-blue-400' },
  in_progress: { label: '対応中',     cls: 'bg-amber-50 text-amber-700 border-amber-200', dotCls: 'bg-amber-400' },
  done:        { label: '完了',       cls: 'bg-green-50 text-green-700 border-green-200', dotCls: 'bg-green-400' },
  cancelled:   { label: 'キャンセル', cls: 'bg-gray-50 text-gray-500 border-gray-200',   dotCls: 'bg-gray-300' },
};

export const ACTION_CREATED_FROM_LABEL: Record<ActionCreatedFrom, string> = {
  manual:             '手動',
  risk_signal:        'リスク起票',
  opportunity_signal: '機会起票',
  support_case:       'サポート起票',
  people_risk:        'People起票',
};

export const SF_TODO_STATUS_BADGE = {
  not_synced: { label: 'SF未連動',     cls: 'text-slate-400' },
  synced:     { label: 'SF連動済',     cls: 'text-green-600' },
  sync_error: { label: 'SF連動エラー', cls: 'text-red-500' },
} as const;

// ── SF ToDo ───────────────────────────────────────────────────────────────────

export type SfTodoSyncStatus = 'draft' | 'pending_sync' | 'synced' | 'sync_error';

export interface LocalSfTodo {
  id:               string;
  companyUid:       string;
  subject:          string;
  description:      string;
  dueDate:          string | null;
  priority:         'High' | 'Medium' | 'Low';
  sfOwner:          string;
  /** SF ToDo に紐づいた signal の id（signal 起票時のみ） */
  relatedSignalId:  string | null;
  /** signal 起票時の signal title（表示用） */
  relatedSignalRef: string | null;
  syncStatus:       SfTodoSyncStatus;
  createdAt:        string;
}

export function createLocalSfTodo(
  fields: Omit<LocalSfTodo, 'id' | 'syncStatus' | 'createdAt'>,
): LocalSfTodo {
  return {
    ...fields,
    id:         crypto.randomUUID(),
    syncStatus: 'draft',
    createdAt:  new Date().toISOString(),
  };
}

/** syncStatus の日本語ラベルとバッジスタイル */
export const SF_SYNC_STATUS_BADGE: Record<
  SfTodoSyncStatus,
  { label: string; className: string }
> = {
  draft:        { label: '下書き',     className: 'bg-slate-100 text-slate-600 border-slate-200' },
  pending_sync: { label: '同期中...',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  synced:       { label: 'SF同期済',   className: 'bg-green-100 text-green-700 border-green-200' },
  sync_error:   { label: '同期エラー', className: 'bg-red-100 text-red-700 border-red-200' },
};
