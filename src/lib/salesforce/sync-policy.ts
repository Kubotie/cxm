// ─── Salesforce ↔ CXM 同期ポリシー（Single Source of Truth）─────────────────
//
// このファイルは CXM と Salesforce の全フィールド同期ポリシーを定義する。
// adapter / route / UI コンポーネントはここの型・定数を参照し、独自判断を持たないこと。
//
// 更新ルール:
//   - ポリシー変更はこのファイルを先に更新し、adapter / route / UI の順に反映する
//   - フィールドの主従を変更する際は、必ず NocoDB テーブル設計との整合を確認する
//
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 1. Action 同期ポリシー
// ─────────────────────────────────────────────────────────────────────────────
//
//   正本: CXM Action
//   従:   Salesforce Task（ToDo）
//   方向: CXM → SF 片方向同期（SF → CXM は未実装）
//   キー: company_actions.sf_todo_id = Salesforce Task ID
//
//   トリガー:
//     - 手動: UI の "SF Task を更新" ボタン / PATCH /api/.../actions/[actionId]/sf-push
//     - 自動（将来）: PATCH /api/.../actions/[actionId] で sf_todo_id が存在する場合
//
//   同期対象フィールド（CXM Action → SF Task）:
//   ┌──────────────────────┬──────────────────┬────────────────────────────────┐
//   │ CXM column           │ SF Task field    │ 備考                           │
//   ├──────────────────────┼──────────────────┼────────────────────────────────┤
//   │ title                │ Subject          │ 必須                           │
//   │ description          │ Description      │ "CXM Ref: ..." prefix を付与   │
//   │ due_date             │ ActivityDate     │ YYYY-MM-DD 形式                │
//   │ owner (email)        │ OwnerId          │ email → SF UserId 変換が必要   │
//   │ status               │ Status           │ ACTION_TO_SF_STATUS_MAP 参照   │
//   └──────────────────────┴──────────────────┴────────────────────────────────┘
//
//   SF → CXM 逆方向: 今回は実装しない
//   理由: CXM を正本とするため、SF からの上書きでデータ破損リスクがある
//
// ─────────────────────────────────────────────────────────────────────────────

/** CXM Action status → Salesforce Task Status 変換テーブル */
export const ACTION_TO_SF_STATUS: Record<string, string> = {
  open:        'Not Started',
  in_progress: 'In Progress',
  done:        'Completed',
  deferred:    'Deferred',
  cancelled:   'Deferred',   // SF に cancelled がないため Deferred で代用
} as const;

/** SF Task Status → CXM Action status 逆変換テーブル（将来の逆方向同期用） */
export const SF_TO_ACTION_STATUS: Record<string, string> = {
  'Not Started': 'open',
  'In Progress': 'in_progress',
  'Completed':   'done',
  'Deferred':    'deferred',
} as const;

/**
 * CXM → SF に同期する Action フィールド名リスト。
 * UI の "同期対象" 表示はこれを参照する。
 */
export const ACTION_SYNC_FIELDS = [
  'title',
  'description',
  'due_date',
  'owner',
  'status',
] as const;
export type ActionSyncField = typeof ACTION_SYNC_FIELDS[number];

/** CXM Action の SF push ペイロード */
export interface ActionSfPushPayload {
  /** SF Task ID */
  sfTaskId:     string;
  /** CXM Action のフィールド値（変更があるものだけ渡せばよい）*/
  title?:       string;
  description?: string;
  dueDate?:     string | null;
  ownerEmail?:  string;
  status?:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Contact 同期ポリシー
// ─────────────────────────────────────────────────────────────────────────────
//
//   SF → CXM: 継続同期（syncContactsToCompanyPeople）
//   CXM → SF: 手動 push のみ（pushCxmFieldsToSalesforce）
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SF主フィールド — Salesforce が正本。SF sync 時に CXM を上書きする。
 * CXM 画面でユーザーが編集しても次回 SF sync で SF 値に戻る。
 *
 * CXM → SF push を行う場合は、この範囲内のフィールドのみを対象とする。
 */
export const SF_WINS_CONTACT_FIELDS = [
  'name',
  'title',
  'department',
  'email',
  'phone',
  'sf_id',
  'sync_status',
  'sf_last_synced_at',
] as const;
export type SfWinsContactField = typeof SF_WINS_CONTACT_FIELDS[number];

/**
 * CXM主フィールド — CXM が正本。SF sync 時に上書きしない。
 * CSM が独自に管理する関係性・評価・組織情報。
 */
export const CXM_WINS_CONTACT_FIELDS = [
  'role',
  'role_type',
  'decision_influence',
  'contact_status',
  'owner',
  'last_touchpoint',
  // ── 組織図関係（Org Chart）────────────────────────────────────────────────
  'layer_role',           // 組織レイヤー (executive / department_head / manager / operator)
  'is_executive',         // 経営層フラグ
  'is_department_head',   // 部門長フラグ
  'reports_to_person_id', // 直属上長 person_id（CXM UUID。縦関係の起点）
  'works_with_person_ids',// 横断協働 person_id JSON配列（横関係）
  'display_group',        // 表示グルーピングラベル（department より細かい任意分類）
  'stakeholder_note',     // CSM 主観メモ（SF に送らない）
] as const;
export type CxmWinsContactField = typeof CXM_WINS_CONTACT_FIELDS[number];

/**
 * CXM → SF に push できる Contact フィールド。
 * SF主フィールドの中で CXM で変更されたものを SF に反映する目的。
 * SF Contact API で受け付けられるフィールドのみに限定する。
 *
 * NOTE: stakeholder_note / layer_role 等 CXM独自フィールドは SF に存在しないため含まない。
 */
export const CONTACT_CXM_TO_SF_PUSH_FIELDS = [
  'title',
  'department',
  'email',
  'phone',
] as const;
export type ContactCxmToSfPushField = typeof CONTACT_CXM_TO_SF_PUSH_FIELDS[number];

/** CXM Contact を SF に push するペイロード型 */
export interface ContactSfPushPayload {
  /** Salesforce Contact ID（sf_id カラムの値） */
  sfContactId: string;
  /** 更新するフィールド（変更があるもののみ）*/
  Title?:      string;
  Department?: string;
  Email?:      string;
  Phone?:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Org Chart ポリシー
// ─────────────────────────────────────────────────────────────────────────────
//
//   縦関係（報告ライン）:
//     reports_to_person_id 優先 → manager_id fallback
//     → manager_id は旧フィールド。新規データは reports_to_person_id を使うこと。
//
//   横関係（協働関係）:
//     works_with_person_ids（JSON 配列 of person_id）
//
//   レイヤー決定優先順位:
//     1. layer_role 明示（CSM が UI で設定）
//     2. is_executive フラグ → 'executive'
//     3. is_department_head フラグ → 'department_head'
//     4. title / role キーワード推定（暫定。データが揃うまでの補完）
//     5. decisionInfluence ベース推定
//     6. 'unclassified'
//
//   グルーピング優先順位:
//     display_group 優先 → department → '（グループ不明）'
//     → display_group は CSM が自由に設定できるラベル（部署より細かい分類が可能）
//
//   メモ:
//     stakeholder_note は CSM 主観情報。同期対象外。UI 内のみで参照する。
//
// ─────────────────────────────────────────────────────────────────────────────

/** Org chart の縦関係解決ポリシー（優先順位） */
export const ORG_PARENT_RESOLUTION_PRIORITY = [
  'reports_to_person_id',  // 優先: CXM で明示的に設定した直属上長 UUID
  'manager_id',            // fallback: 旧フィールド（SF ReportsToId 由来）
] as const;

/** Org chart のグルーピングキー解決ポリシー（優先順位）*/
export const ORG_GROUP_RESOLUTION_PRIORITY = [
  'display_group',    // 優先: CSM が自由設定したラベル
  'department',       // fallback: SF/CXM 由来の部署名
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 4. 将来の双方向同期に向けた注意事項
// ─────────────────────────────────────────────────────────────────────────────
//
// 【CXM_WINS フィールドの保護】
//   CXM_WINS_CONTACT_FIELDS に含まれるフィールド（role / layer_role / reports_to など）は
//   SF sync 処理（syncContactsToCompanyPeople）で絶対に上書きしないこと。
//   SF → CXM の逆同期を実装する場合も、この制約を引き継ぐこと。
//   違反すると CSM が手動で設定した組織構造・評価情報が失われる。
//
// 【SF Task 削除時の扱い】
//   SF 側で Task が削除された場合、updateTask は 404 を返す。
//   この場合は company_actions.sf_todo_status を 'sync_error' に更新すること。
//   sf_todo_id はクリアせず残す（audit trail として保持）。
//   将来の再連動は新規 Task 作成 → sf_todo_id 上書き のフローで対応。
//
// 【owner (email → UserId) 変換のキャッシュ】
//   salesforce-task-adapter.ts の resolveSfUserId は現在毎回 SOQL を発行している。
//   ユーザー数が増えた場合、同一 email のリクエストが並列発行されるとレート制限に当たる。
//   改善策: モジュールレベルの Map<email, userId> キャッシュを追加し、
//           TTL（例: 1時間）付きで保持する。
//
// 【bidirectional sync の設計原則（実装時に参照）】
//   - SF → CXM: SF が変更されたフィールドのみを CXM に反映（SFDC Change Data Capture）
//   - CXM → SF: UI アクションまたは batch job で push（現在の片方向同期を継続）
//   - コンフリクト解決: CXM_WINS フィールドは CXM 優先、SF_WINS フィールドは SF 優先
//   - 自動同期を有効にする前に、sync_status = 'manual_override' フラグを実装し
//     「CSM が意図的に SF 値と異なる値をセットした」場合に自動上書きを止める仕組みが必要
//
// ─────────────────────────────────────────────────────────────────────────────
