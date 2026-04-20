import { sfFetch, sfQuery, isSalesforceConfigured, SF_API_BASE, resolveSfUserId } from './client';
import type { ActionSfPushPayload } from './sync-policy';
import { ACTION_TO_SF_STATUS } from './sync-policy';

// ─── Salesforce Task Adapter Boundary ────────────────────────────────────────
//
// CXM Action を Salesforce Task（ToDo）として同期するための接続境界を定義する。
// 現時点では型定義・プレースホルダー実装のみ。本接続時はこのファイルを差し替える。
//
// ── 責務の分担 ───────────────────────────────────────────────────────────────
//   このファイル（Salesforce側）:
//     - Salesforce Task レコードの形式定義
//     - Salesforce REST API との通信
//     - CXM Action ↔ SF Task フィールドマッピング
//     - sfTodoId / syncResult / syncedAt の設定責務
//
//   company_actions テーブル（CXM側）:
//     - title / owner / dueDate / status の管理（CSM が独自に更新）
//     - sfTodoId カラムで SF Task ID を保持
//     - CXM 側の status 変更を SF Task に反映するトリガー
//
// ── Action ↔ SF Task フィールドマッピング ─────────────────────────────────────
//   CXM Action                 │ SF Task
//   ─────────────────────────────────────────────────────────
//   title                      │ Subject
//   owner                      │ OwnerId (SF User ID への変換が必要)
//   dueDate                    │ ActivityDate (YYYY-MM-DD)
//   status                     │ Status (マッピングは SF_TASK_STATUS_MAP)
//   sourceRef (Signal/Evidence)│ Description に埋め込み
//   personRef (Contact ID)     │ WhoId (SF Contact ID への変換が必要)
//   companyUid → SF Account ID │ WhatId
//
// ── status マッピング ─────────────────────────────────────────────────────────
//   open        → Not Started
//   in_progress → In Progress
//   done        → Completed
//   deferred    → Deferred
//   cancelled   → Deferred  (SF に cancelled ステータスがないため Deferred で代用)
//
// 環境変数（将来実装時に使用）:
//   SALESFORCE_INSTANCE_URL   : https://xxx.my.salesforce.com
//   SALESFORCE_ACCESS_TOKEN   : OAuth2 アクセストークン
//   SALESFORCE_API_VERSION     : v60.0 等
// ─────────────────────────────────────────────────────────────────────────────

// ── Salesforce Task 型 ────────────────────────────────────────────────────────

/** Salesforce REST API が返す Task レコードの必要フィールド */
export interface SalesforceTask {
  Id:                  string;
  Subject:             string;
  /** 期日 YYYY-MM-DD */
  ActivityDate?:       string;
  /**
   * ステータス値（SF 側のピックリスト設定による）。
   * 標準: Not Started / In Progress / Completed / Deferred
   */
  Status:              string;
  /** Normal / High */
  Priority?:           string;
  Description?:        string;
  /** Salesforce User ID */
  OwnerId?:            string;
  /** 関連先オブジェクト（Account / Opportunity）ID */
  WhatId?:             string;
  /** 関連コンタクト（Contact / Lead）ID */
  WhoId?:              string;
  /** タスクが完了済みかどうか */
  IsClosed?:           boolean;
  CreatedDate?:        string;
  LastModifiedDate?:   string;
}

// ── CXM → SF ステータスマッピング ─────────────────────────────────────────────

/**
 * CXM Action の status → SF Task の Status への変換テーブル。
 * SF 側のピックリスト設定が異なる場合は ConnectedApp 設定でカスタマイズする。
 */
export const SF_TASK_STATUS_MAP: Record<string, string> = {
  open:        'Not Started',
  in_progress: 'In Progress',
  done:        'Completed',
  deferred:    'Deferred',
  cancelled:   'Deferred',  // SF に cancelled ステータスがないため Deferred で代用
} as const;

/** SF Task の Status → CXM Action status への逆変換テーブル */
export const CXM_ACTION_STATUS_FROM_SF: Record<string, string> = {
  'Not Started': 'open',
  'In Progress': 'in_progress',
  'Completed':   'done',
  'Deferred':    'deferred',
} as const;

// ── Request/Response 型 ───────────────────────────────────────────────────────

/** CXM Action → SF Task 作成時のリクエストペイロード */
export interface CreateSfTaskPayload {
  /** Action.title → Subject */
  subject:       string;
  /** SF User ID（CXM owner → SF UserId 変換が必要） */
  ownerId?:      string;
  /** 期日 YYYY-MM-DD */
  activityDate?: string;
  /**
   * SF Task Status（省略時は 'Not Started'）。
   * SF_TASK_STATUS_MAP で変換済みの値を渡す。
   */
  status?:       string;
  /** Normal / High（省略時は 'Normal'） */
  priority?:     string;
  /**
   * 補足情報。sourceRef（Signal/Evidence ID）を埋め込む。
   * 例: "CXM Signal: signal-abc123"
   */
  description?:  string;
  /** SF Account ID（companyUid → SF AccountId 変換が必要） */
  whatId?:       string;
  /** SF Contact ID（personRef → SF ContactId 変換が必要） */
  whoId?:        string;
}

/** SF Task ステータス更新リクエスト */
export interface UpdateSfTaskStatusPayload {
  /** SF Task ID */
  sfTaskId:   string;
  /** SF Task Status（SF_TASK_STATUS_MAP で変換済みの値） */
  status:     string;
}

/** SF Task 作成結果 */
export interface SfTaskCreateResult {
  /** 作成された Salesforce Task ID */
  sfId:        string;
  /** 'synced' = 保存成功 / 'sync_error' = 保存失敗 */
  syncResult:  'synced' | 'sync_error';
  /** sync_error 時のエラーメッセージ */
  error?:      string;
}

/** SF Task ステータス更新結果 */
export interface SfTaskStatusUpdateResult {
  /** 'synced' = 更新成功 / 'sync_error' = 更新失敗 */
  syncResult: 'synced' | 'sync_error';
  /** sync_error 時のエラーメッセージ */
  error?:     string;
}

/** SF Task フィールド一括更新結果（sync-policy の ACTION_SYNC_FIELDS に対応）*/
export interface SfTaskUpdateResult {
  syncResult: 'synced' | 'sync_error';
  error?:     string;
}

/** CXM Action と SF Task の紐付け情報 */
export interface ActionSfTaskLink {
  /** CXM Action ID */
  actionId:   string;
  /** Salesforce Task ID */
  sfTaskId:   string;
  /** 最終同期時刻 ISO8601 */
  syncedAt:   string;
  /** 同期状態 */
  syncStatus: 'synced' | 'pending' | 'sync_error';
}

// ── ヘルパー関数 ──────────────────────────────────────────────────────────────

/**
 * CXM Action の status 文字列を SF Task Status に変換する。
 * 未知のステータスは 'Not Started' にフォールバックする。
 */
export function toSfTaskStatus(cxmStatus: string): string {
  return SF_TASK_STATUS_MAP[cxmStatus] ?? 'Not Started';
}

/**
 * CXM Action から SF Task 作成ペイロードを構築する。
 * WhatId / WhoId は SF Account/Contact ID への変換が必要なため呼び出し元が設定する。
 */
export function buildCreateSfTaskPayload(action: {
  title:     string;
  status:    string;
  dueDate:   string | null;
  sourceRef: string | null;
  priority?: string;
}): Omit<CreateSfTaskPayload, 'whatId' | 'whoId' | 'ownerId'> {
  const parts: string[] = [];
  if (action.sourceRef) {
    parts.push(`CXM Ref: ${action.sourceRef}`);
  }

  return {
    subject:       action.title,
    status:        toSfTaskStatus(action.status),
    activityDate:  action.dueDate ?? undefined,
    priority:      action.priority ?? 'Normal',
    ...(parts.length > 0 && { description: parts.join('\n') }),
  };
}

// ── Salesforce Task API インターフェース ──────────────────────────────────────

export interface SalesforceTaskAdapter {
  /**
   * SF Task を新規作成する。
   * @returns 作成結果（sfId を含む）
   */
  createTask(payload: CreateSfTaskPayload): Promise<SfTaskCreateResult>;

  /**
   * 既存 SF Task のステータスを更新する。
   * CXM Action status 変更時に呼び出す。
   */
  updateTaskStatus(payload: UpdateSfTaskStatusPayload): Promise<SfTaskStatusUpdateResult>;

  /**
   * CXM Action の全同期対象フィールドを SF Task に push する。
   * sync-policy.ts の ACTION_SYNC_FIELDS（title / description / due_date / owner / status）を対象とする。
   * CXM Action が正本であり、SF Task を従として上書きする。
   */
  updateTask(payload: ActionSfPushPayload): Promise<SfTaskUpdateResult>;

  /**
   * Account（companyUid 対応）に紐づく Task 一覧を取得する。
   * @param sfAccountId  Salesforce Account ID
   * @returns SalesforceTask[]（空の場合は []）
   */
  fetchTasksByAccount(sfAccountId: string): Promise<SalesforceTask[]>;

  /**
   * SF Task を CXM Action に紐付ける情報を取得する。
   * sfTaskId → ActionSfTaskLink を返す。
   */
  getTaskLink(sfTaskId: string, actionId: string): ActionSfTaskLink;
}

// ── REST 実装 ────────────────────────────────────────────────────────────────

/**
 * Salesforce REST API を使った Task Adapter 本実装。
 * `isSalesforceConfigured() === true` の場合に `activeSalesforceTaskAdapter` として使われる。
 */
export const salesforceRestTaskAdapter: SalesforceTaskAdapter = {
  async createTask(payload: CreateSfTaskPayload): Promise<SfTaskCreateResult> {
    try {
      // B4: OwnerId 解決（ownerEmail → SF UserId）
      let ownerId = payload.ownerId;
      if (!ownerId && payload.ownerId !== undefined) {
        ownerId = await resolveSfUserId(payload.ownerId);
      }

      const sfBody = {
        Subject:      payload.subject,
        Status:       payload.status       ?? 'Not Started',
        Priority:     payload.priority     ?? 'Normal',
        ActivityDate: payload.activityDate ?? undefined,
        Description:  payload.description  ?? undefined,
        WhatId:       payload.whatId       ?? undefined,
        WhoId:        payload.whoId        ?? undefined,
        ...(ownerId && { OwnerId: ownerId }),
      };

      const result = await sfFetch<{ id: string; success: boolean }>(
        'POST',
        `${SF_API_BASE}/sobjects/Task`,
        sfBody,
      );
      return { sfId: result.id, syncResult: 'synced' };
    } catch (err) {
      return { sfId: '', syncResult: 'sync_error', error: String(err) };
    }
  },

  async updateTaskStatus(payload: UpdateSfTaskStatusPayload): Promise<SfTaskStatusUpdateResult> {
    try {
      await sfFetch(
        'PATCH',
        `${SF_API_BASE}/sobjects/Task/${payload.sfTaskId}`,
        { Status: payload.status },
      );
      return { syncResult: 'synced' };
    } catch (err) {
      return { syncResult: 'sync_error', error: String(err) };
    }
  },

  async updateTask(payload: ActionSfPushPayload): Promise<SfTaskUpdateResult> {
    try {
      // ownerEmail → SF UserId 解決
      let ownerId: string | undefined;
      if (payload.ownerEmail) {
        ownerId = await resolveSfUserId(payload.ownerEmail).catch(() => undefined);
      }

      // 変更があるフィールドのみ SF に送る
      const sfPatch: Record<string, string | null | undefined> = {};
      if (payload.title       !== undefined) sfPatch.Subject      = payload.title;
      if (payload.description !== undefined) sfPatch.Description  = payload.description ?? null;
      if (payload.dueDate     !== undefined) sfPatch.ActivityDate = payload.dueDate ?? null;
      if (payload.status      !== undefined) sfPatch.Status       = ACTION_TO_SF_STATUS[payload.status] ?? 'Not Started';
      if (ownerId)                           sfPatch.OwnerId      = ownerId;

      if (Object.keys(sfPatch).length === 0) return { syncResult: 'synced' };

      await sfFetch('PATCH', `${SF_API_BASE}/sobjects/Task/${payload.sfTaskId}`, sfPatch);
      return { syncResult: 'synced' };
    } catch (err) {
      return { syncResult: 'sync_error', error: String(err) };
    }
  },

  async fetchTasksByAccount(sfAccountId: string): Promise<SalesforceTask[]> {
    const soql = [
      'SELECT Id,Subject,Status,ActivityDate,Priority,Description,OwnerId,WhoId,WhatId,IsClosed',
      ' FROM Task',
      ` WHERE WhatId='${sfAccountId}' AND IsClosed=false`,
      ' ORDER BY ActivityDate ASC NULLS LAST',
    ].join('');
    return sfQuery<SalesforceTask>(soql);
  },

  getTaskLink(sfTaskId: string, actionId: string): ActionSfTaskLink {
    return {
      actionId,
      sfTaskId,
      syncedAt:   new Date().toISOString(),
      syncStatus: 'synced',
    };
  },
};

// ── Placeholder 実装 ──────────────────────────────────────────────────────────

/**
 * 未接続状態のプレースホルダー実装。
 * SALESFORCE_* 環境変数が未設定の場合に activeSalesforceTaskAdapter として使われる。
 */
export const placeholderSalesforceTaskAdapter: SalesforceTaskAdapter = {
  async createTask(_payload: CreateSfTaskPayload): Promise<SfTaskCreateResult> {
    throw new Error('Salesforce Task adapter is not yet connected. Implement SalesforceRestTaskAdapter.');
  },

  async updateTaskStatus(_payload: UpdateSfTaskStatusPayload): Promise<SfTaskStatusUpdateResult> {
    throw new Error('Salesforce Task adapter is not yet connected.');
  },

  async updateTask(_payload: ActionSfPushPayload): Promise<SfTaskUpdateResult> {
    throw new Error('Salesforce Task adapter is not yet connected.');
  },

  async fetchTasksByAccount(_sfAccountId: string): Promise<SalesforceTask[]> {
    throw new Error('Salesforce Task adapter is not yet connected.');
  },

  getTaskLink(sfTaskId: string, actionId: string): ActionSfTaskLink {
    return {
      actionId,
      sfTaskId,
      syncedAt:   new Date().toISOString(),
      syncStatus: 'pending',
    };
  },
};

// ── アクティブ adapter ────────────────────────────────────────────────────────
//
// 環境変数が設定済みなら REST 実装、未設定なら placeholder を使う。
// 呼び出し元はこれを import して使う（直接 placeholder は参照しない）。

export const activeSalesforceTaskAdapter: SalesforceTaskAdapter =
  isSalesforceConfigured() ? salesforceRestTaskAdapter : placeholderSalesforceTaskAdapter;
