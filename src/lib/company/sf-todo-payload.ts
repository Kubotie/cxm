// ─── SF ToDo Payload / Adapter Boundary ──────────────────────────────────────
//
// Salesforce ToDo 連動の型確定とアダプター境界を定義する。
//
// 現状:
//   API 未接続 — sf-todo-dialog.tsx でシミュレーション（1.5s delay → synced）
//
// 将来の実装経路:
//   POST /api/company/[companyUid]/sf-todo
//     → Salesforce REST API (Tasks endpoint)
//     → NocoDB に syncStatus を保存
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

// ── Request ───────────────────────────────────────────────────────────────────

/**
 * SF ToDo 作成リクエストペイロード。
 * sf-todo-dialog.tsx が組み立て、将来的に API に POST する。
 */
export interface SfTodoCreatePayload {
  companyUid:       string;
  subject:          string;
  description:      string;
  dueDate:          string | null;
  priority:         'High' | 'Medium' | 'Low';
  /** Salesforce User 名 or ID */
  sfOwner:          string;
  /** signal 起票時の NocoDB signal レコード id */
  relatedSignalId:  string | null;
  /** signal 起票時の表示テキスト */
  relatedSignalRef: string | null;
  /** Org Chart 起票時の person id */
  relatedPersonId:  string | null;
  /** Org Chart 起票時の person 名（表示用） */
  relatedPersonRef: string | null;
}

// ── Response ──────────────────────────────────────────────────────────────────

export interface SfTodoCreateResult {
  ok:       boolean;
  /** Salesforce が返す Task レコード ID（成功時） */
  sfTodoId: string | null;
  error:    string | null;
}

// ── Adapter (placeholder) ─────────────────────────────────────────────────────

/**
 * SF ToDo 作成アダプター。
 *
 * TODO: 実装時は以下に置き換える:
 *   const res = await fetch(`/api/company/${payload.companyUid}/sf-todo`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 *   return res.json();
 *
 * 現在はシミュレーション: 1.5秒後に成功を返す。
 */
export async function createSfTodo(
  payload: SfTodoCreatePayload,
): Promise<SfTodoCreateResult> {
  // Intentional delay to simulate network
  await new Promise(r => setTimeout(r, 1500));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void payload; // ← 将来実装時に payload を使用する
  return {
    ok:       true,
    sfTodoId: `SF-TODO-SIM-${Date.now()}`,
    error:    null,
  };
}

// ── Prefill Builders ──────────────────────────────────────────────────────────

/** signal から SF ToDo ペイロードの雛形を作る */
export function buildSfTodoPayloadFromSignal(
  companyUid:  string,
  subject:     string,
  signalId?:   string,
  signalRef?:  string,
): Partial<SfTodoCreatePayload> {
  return {
    companyUid,
    subject,
    priority:         'Medium',
    relatedSignalId:  signalId  ?? null,
    relatedSignalRef: signalRef ?? null,
    relatedPersonId:  null,
    relatedPersonRef: null,
  };
}

/** Org Chart の person から SF ToDo ペイロードの雛形を作る */
export function buildSfTodoPayloadFromPerson(
  companyUid: string,
  subject:    string,
  personId?:  string,
  personRef?: string,
): Partial<SfTodoCreatePayload> {
  return {
    companyUid,
    subject,
    priority:         'Medium',
    relatedSignalId:  null,
    relatedSignalRef: null,
    relatedPersonId:  personId  ?? null,
    relatedPersonRef: personRef ?? null,
  };
}
