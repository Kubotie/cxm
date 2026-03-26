
11_Data_Schema_Master_v1.md（完成版・そのまま貼れるMD）

# 11 Data Schema Master v1（NocoDB / Salesforce）
（People / Org / Action / Content / Push&Sync / Audit）

---

## 0. このドキュメントの位置づけ（SSOT）
- **NocoDB**：CXMとしての「確定ログ（決定の証跡）」のSSOT  
  - People/Org/Action/Content/Sent/監査（Push済みの確定データ）
- **Salesforce**：CSM運用の名簿・ToDoのSSOT  
  - Contact / Task（ただしCXMは **Push→Sync** の二段階コミット）

> 重要：CXM側で Phase（M-Phase/A-Phase）を計算しない。  
> Phaseは既存の算出結果を参照し、**UI/提案/記録の文脈**として使う。

---

## 1. 命名規則（ブレ防止）
### 1.1 ID命名（NocoDB）
- `people_node_id`：`pn_` + 連番 or UUID短縮（例：`pn_000123`）
- `org_edge_id`：`oe_` + 連番（例：`oe_000045`）
- `org_chart_version_id`：`ocv_` + 連番（例：`ocv_000012`）
- `action_id`：`ac_` + 連番（例：`ac_000988`）
- `content_job_id`：`cj_` + 連番（例：`cj_000210`）
- `sync_event_id`：`se_` + 連番（例：`se_000701`）
- `audit_id`：`au_` + 連番（例：`au_001201`）

### 1.2 Salesforce側の命名（検索性）
- Task Subject推奨：`【CXM】{行動目的・内容}｜{顧客前進の目的（メモ要約）}`  
  - 例：`【CXM】アップセル提案｜Opportunity↑（議事録:20260305）`
- Contactのメモ先頭：`【CXM】`で統一（自由記述は崩さないが検索しやすく）

---

## 2. Salesforce（v1で“既存フィールド内で完結”する設計）
> 方針：Picklistは増やしすぎない。  
> - Taskの「行動目的・内容」を **顧客前進の目的（CXM）** として拡張利用  
> - Target（Risk↓/Opportunity↑など）は **メモの構造化**で保持  
> - 「行動分類」には **CXMの4ロール（CSM/Support/CRM/GTM）** を追加（手配済み前提）

---

### 2.1 Salesforce Contact（入力フィールド）
※添付の画面内で完結させる前提

| Salesforceフィールド（表示名） | 用途（CXM） | 必須 | 備考 |
|---|---|---:|---|
| 敬称 | 任意 | 任意 |  |
| 姓 / 名 | 表示名のSSOT（SF側） | 推奨 | NocoDBは display_name でもOK |
| メール | 名寄せキー（最優先） | 推奨 | 無い場合でもNocoDBで先に作る |
| ご契約アカウント（Checkbox） | 重要人物の識別補助 | 任意 |  |
| MRR Account | 契約/請求紐付け補助 | 任意 |  |
| 部署 | Org Chart要素 | 推奨 |  |
| 役職 | Org Chart要素 | 推奨 |  |
| 電話 / 携帯 | 連絡手段 | 任意 |  |
| 会社の中での担当範囲 | 自由記述（推奨入力例：*「EC本店（会員/LP）」*等） | 任意 | 自由記述でOK |
| メモ | CXMの構造化メモ（下記フォーマット推奨） | 推奨 | “属人情報”をメモで吸収 |

#### Contact「メモ」推奨フォーマット（コピペ用）

```text
【CXM】
役割: （決裁者/承認者/推進責任者/実務担当 など）
スタンス: （推進/中立/慎重/反対）
影響: 予算=（高/中/低）, 運用=（高/中/低）
接触: （直接/間接/未接触）
根拠: minutes_id=…, url=…
メモ: ...
```

---

### 2.2 Salesforce Task（ToDo）— v1運用（既存フィールドで完結）
※添付の画面内で完結させる前提

| Salesforceフィールド（表示名） | 用途（CXM） | 必須 | 備考 |
|---|---|---:|---|
| 名前（Who/Name） | 関連Contact（いれば） | 任意 | Contact未確定でもOK（後追い紐付け） |
| 件名（Subject） | 検索・一覧性の要 | 必須 | `【CXM】{行動目的・内容}｜{要約}` 推奨 |
| 形式（Picklist） | チャネル/種別の粗分類 | 推奨 | Email / Intercom / Chat(Chatwork,Slackなど) / Meeting / Call / Event / Other / Free Trial / Change Plan / Change Account / Training |
| 通話結果 | Call時の結果 | 任意 | Call以外は未設定でOK |
| 状況（Status） | 実行状態 | 必須 | Open/Completed等（現状運用に合わせる） |
| 期日（Due Date） | 期限 | 任意 |  |
| 関連先（Related To） | **Account**紐付け（会社） | 推奨 | 可能な範囲で必須運用推奨 |
| Project ID（テキスト） | Project紐付け（プロダクト利用単位） | 推奨 | CSM以外でも将来追えるように |
| 行動分類（Multi select / Picklist） | ロール分類（追加予定） | 推奨 | CSM/Support/CRM/GTM を追加して利用 |
| 行動目的・内容（Picklist） | **顧客前進の目的（CXM）** | 推奨 | 既存候補に追加して運用 |
| 接点者（Picklist） | ステークホルダー層 | 任意 | 経営層/部長/課長/メンバー 等 |
| 結果（Picklist） | 実行結果の粗分類 | 任意 | S/A/B/C/Dなど（現状運用に合わせる） |
| 活動形式（Picklist） | Web/訪問 等 | 任意 |  |
| メモ（Long） | **Target / Evidence / 詳細** をここに構造化 | 推奨 | Picklist増やさない方針の中核 |

#### Task「メモ」推奨フォーマット（Targetを吸収）

```text
【CXM】
Target: Risk↓ | Opportunity↑ | Health↑ | Phase→ | Coverage↑
Evidence: minutes_id=…, signal_id=…, ticket_id=…, url=…
Scope: company_uid=…, project_id=…, user_id=…
期待期間: 7d/14d/30d
内容: …
```

---

## 3. NocoDB（v1：確定ログ＋解決テーブル＋Evidenceログ拡張）
> “JSON型”は使わず、**Long text（JSON文字列）**に統一（迷い防止）。  
> Lookup/Linksは「紐付け」用途でOK。  
> v1では「担当者ID解決」のために **internal_users / user_identity_links** を追加する。  
> また、各 log_*（Evidence）にも actor 解決結果列を付与する（確定ログではないが、AI提案とTimelineの品質に直結するため）。

### 3.0 Lookup運用ルール（重要）
NocoDBでは **Lookup列は単独では使えず、事前に Links 列が必要**。

- 原則：`relation_{lookup_field}`（Links） + `{lookup_field}`（Lookup）の **2列セット**で定義する  
- Links列に「同期先（参照先テーブル）」を設定すると、Lookup列で参照できる

例：
- `relation_actor_internal_user_id`（Links → internal_users を指定）
- `actor_internal_user_id`（Lookup → internal_users が参照できる）



---

### 3.1 people_nodes（ステークホルダー人物ノード）
| フィールド | 項目名（日本語） | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| people_node_id | People Node ID | Single line text | 必須 | `pn_...` |
| company_uid | 会社ID | Single line text | 必須 | `sf_...` |
| display_name | 表示名 | Single line text | 必須 | メール無しOK |
| email | メール | Email | 任意 | 名寄せ最強 |
| phone | 電話 | Phone number | 任意 |  |
| dept_raw | 部署（原文） | Single line text | 任意 |  |
| dept_category | 部門カテゴリ | Single select | 任意 | 固定辞書 |
| stakeholder_role | ステークホルダー役割 | Single select | 推奨 | 固定辞書 |
| decision_position | 意思決定ポジション | Single select | 推奨 | 固定辞書 |
| stance | スタンス | Single select | 任意 | 固定辞書 |
| temperature | 温度感 | Single select | 任意 | 固定辞書 |
| budget_influence | 予算影響度 | Single select | 推奨 | 定義固定（属人回避） |
| ops_influence | 運用影響度 | Single select | 推奨 | 定義固定（属人回避） |
| coverage_state | 接触状態 | Single select | 推奨 | 接触済/特定済/未特定 等 |
| access_state | 接点状態 | Single select | 任意 | 直接/間接 等 |
| relation_reports_to_people_node_id | 上長参照（Links） | Links | 任意 | people_nodes を指定 |
| reports_to_people_node_id | 上長People Node ID | Lookup | 任意 | people_nodes参照 |
| notes | メモ | Long text | 任意 |  |
| evidence_refs_json | 根拠（JSON文字列） | Long text | 推奨 | minutes_quote等 |
| status | 状態 | Single select | 必須 | proposed/confirmed/synced/conflict/error |
| sf_contact_id | Salesforce Contact ID | Single line text | 任意 | Sync後に埋まる |
| created_at | 作成日時 | Date time | 推奨 |  |
| updated_at | 更新日時 | Date time | 推奨 |  |

---

### 3.2 org_edges（組織の関係）
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| org_edge_id | Edge ID | Single line text | 必須 | `oe_...` |
| company_uid | 会社ID | Single line text | 必須 |  |
| edge_type | 関係タイプ | Single select | 必須 | reports_to / works_with / gatekeeps_for |
| relation_from_people_node_id | From参照（Links） | Links | 必須 | people_nodes を指定 |
| from_people_node_id | From | Lookup | 必須 | people_nodes |
| relation_to_people_node_id | To参照（Links） | Links | 必須 | people_nodes を指定 |
| to_people_node_id | To | Lookup | 必須 | people_nodes |
| confidence | 信頼度 | Decimal | 任意 | 0〜1 |
| evidence_refs_json | 根拠（JSON文字列） | Long text | 任意 |  |
| status | 状態 | Single select | 必須 | proposed/confirmed |

---

### 3.3 org_chart_versions（確定組織図バージョン）
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| org_chart_version_id | Version ID | Single line text | 必須 | `ocv_...` |
| company_uid | 会社ID | Single line text | 必須 |  |
| version | バージョン | Single line text | 必須 | v1/v2… |
| graph_json | 組織図JSON（文字列） | Long text | 必須 | nodes/edges |
| confirmed_by | 確定者 | User or Single line text | 任意 | User型推奨 |
| confirmed_at | 確定日時 | Date time | 推奨 |  |

---

### 3.4 actions（CXM Action：todo/meeting/sent/ticket/content）
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| action_id | Action ID | Single line text | 必須 | `ac_...` |
| owner_role | Owner Role | Single select | 必須 | CSM/Support/CRM/GTM |
| action_type | Action種別 | Single select | 必須 | todo/meeting/sent/ticket/content |
| scope | Scope | Single select | 必須 | company/project/user |
| scope_id | Scope ID | Single line text | 必須 | company_uid等 |
| related_project_id | 関連Project ID | Single line text | 任意 | 原則入れる推奨 |
| relation_related_people | 関連人物参照（Links） | Links | 任意 | people_nodes を指定 |
| related_people | 関連人物 | Lookup（複数） | 任意 | people_nodes |
| priority | 優先度 | Single select | 任意 | high/medium/low |
| title | タイトル | Single line text | 必須 |  |
| due_at | 期限 | Date time | 任意 |  |
| expected_window | 期待期間 | Single select | 任意 | 7d/14d/30d |
| evidence_refs_json | 根拠（JSON文字列） | Long text | 必須 | minutes_id等 |
| suggested_next_steps_json | 次ステップ（JSON文字列） | Long text | 任意 | 配列 |
| target_memo | 顧客前進の目的（メモ） | Long text | 推奨 | SF側「行動目的・内容」＋補足 |
| channel | 送信チャネル | Single select | 任意 | sentのみ：email/intercom/slack/chatwork/in_product |
| purpose_tag | 用途タグ | Single select | 任意 | [CXM-TEST]/[CXM-SHARED]/[CXM-URGENT] |
| payload_ref | 本文参照 | Single line text | 任意 | content_job_id or RAW_MESSAGE |
| send_status | 送信状態 | Single select | 任意 | draft/approved/sent/failed |
| destination_id | 送信先ID | Single line text | 任意 | slack_channel_id / chatwork_channel_id 等 |
| destination_meta_json | 送信先メタ（JSON文字列） | Long text | 任意 | thread_ts 等 |
| result_metrics_json | 結果指標（JSON文字列） | Long text | 任意 | open/click/reply等 |
| status | 状態 | Single select | 必須 | proposed/confirmed/synced/executed/impact |
| sf_task_id | Salesforce Task ID | Single line text | 任意 | Sync後 |
| created_at | 作成日時 | Date time | 推奨 |  |
| updated_at | 更新日時 | Date time | 推奨 |  |
| relation_actor_internal_user_id | 実行者参照（Links） | Links | 任意 | internal_users を指定 |
| actor_internal_user_id | 実行者（社内ユーザ） | Lookup | 任意 | internal_users参照（ログ/送信/同期のactor統一） |


---

### 3.5 content_jobs（AI生成コンテンツ）
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| content_job_id | Content Job ID | Single line text | 必須 | `cj_...` |
| relation_linked_action_id | Action参照（Links） | Links | 推奨 | actions を指定 |
| linked_action_id | 紐づくAction | Lookup | 推奨 | actions |
| company_uid | 会社ID | Single line text | 必須 |  |
| content_type | 種別 | Single select | 必須 | slide/article/help/template/message |
| template_id | テンプレID | Single line text | 必須 | 09の辞書 |
| prompt_snapshot | 生成時プロンプト | Long text | 任意 |  |
| output_ref | 出力参照 | URL or Links | 任意 | Notion/Drive/ファイルURL |
| status | 状態 | Single select | 必須 | draft/generated/edited/published |
| approved_by | 承認者 | User or Single line text | 任意 | User型推奨 |
| approved_at | 承認日時 | Date time | 任意 |  |

---

### 3.6 sync_events（統合イベント：Push/Sync の実行ログ）
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| sync_event_id | Sync Event ID | Single line text | 必須 | `se_...` |
| entity_type | 対象種別 | Single select | 必須 | people_node / action / content_job 等 |
| entity_id | 対象ID | Single line text | 必須 |  |
| operation | 操作 | Single select | 必須 | push / sync_contact / sync_task / send_message 等 |
| performed_by | 実行者 | User or Single line text | 任意 | User型推奨 |
| performed_at | 実行日時 | Date time | 推奨 |  |
| result | 結果 | Single select | 必須 | success / conflict / error |
| diff_snapshot | 差分（JSON文字列） | Long text | 任意 |  |
| message | メッセージ | Long text | 任意 |  |
| sf_object_id | SF Object ID | Single line text | 任意 | Contact/Task ID |
| payload_json | 送信payload（JSON文字列） | Long text | 任意 | APIに投げた中身 |
| error_message | エラーメッセージ | Long text | 任意 |  |
| retryable | リトライ可否 | Checkbox | 任意 |  |
| relation_actor_internal_user_id | 実行者参照（Links） | Links | 任意 | internal_users を指定 |
| actor_internal_user_id | 実行者（社内ユーザ） | Lookup | 任意 | internal_users参照（performed_byが曖昧でも追える） |



---

### 3.7 company_channel_identify（顧客共同チャンネル：外部送信用SSOT）
> Intercomは混ぜない  
> 推奨：列テーブル化（slack_channel_id / chatwork_channel_id）

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| company_uid | 会社ID | Single line text | 必須 |  |
| slack_channel_id | Slack Channel ID | Single line text | 任意 | `Cxxxx...` |
| chatwork_channel_id | Chatwork Channel ID | Single line text | 任意 | ルームID相当（運用名に合わせて統一） |
| is_active | 有効 | Checkbox | 推奨 | 誤送信防止 |
| note | メモ | Long text | 任意 |  |

---

### 3.8 audit_logs（アプリ内操作の監査ログ：人の操作中心）
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| audit_id | Audit ID | Single line text | 必須 | `au_...` |
| event_type | イベント種別 | Single select | 必須 | create/update/delete/approve/push等 |
| actor | 実行者 | User or Single line text | 必須 | User型推奨 |
| target_table | 対象テーブル | Single line text | 必須 | actions/people_nodes等 |
| target_id | 対象ID | Single line text | 必須 |  |
| detail_json | 詳細（JSON文字列） | Long text | 任意 |  |
| created_at | 作成日時 | Date time | 推奨 |  |
| relation_actor_internal_user_id | 実行者参照（Links） | Links | 任意 | internal_users を指定 |
| actor_internal_user_id | 実行者（社内ユーザ） | Lookup | 任意 | internal_users参照（actor表記揺れを吸収） |

---


## 3.9 internal_users（社内ユーザSSOT）
> 目的：SF / Slack / Chatwork / Intercom / Notion 等で分断された “担当者” を、CXM内で1人に正規化するSSOT。  
> ここに紐づけば、ログ・Sent・SF Task・監査が「同じ担当者」で一本化できる。

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| internal_user_id | 内部ユーザID | Single line text | 必須 | `iu_...` |
| display_name | 表示名（日本語） | Single line text | 必須 | 例：永井 慎一 |
| display_name_en | 表示名（英語/ローマ字） | Single line text | 任意 |  |
| primary_email | 代表メール | Email | 推奨 | 名寄せ最優先 |
| secondary_emails_json | 追加メール（JSON文字列） | Long text | 任意 | `["a@","b@"]` |
| role_default | 既定ロール | Single select | 推奨 | CSM / CSM Manager / Support / CRM / GTM / Admin |
| is_active | 有効 | Checkbox | 推奨 | 退職・異動はOFF |
| note | メモ | Long text | 任意 |  |
| created_at | 作成日時 | Date time | 推奨 |  |
| updated_at | 更新日時 | Date time | 推奨 |  |



---

## 3.10 user_identity_links（外部ID ↔ internal_users 照合）
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| link_id | 紐付けID | Single line text | 必須 | `uil_...` |
| relation_internal_user_id | 内部ユーザ参照（Links） | Links | 必須 | internal_users を指定 |
| internal_user | 内部ユーザ | Lookup | 必須 | internal_users参照（Lookup列名は internal_user に統一） |
| system | システム種別 | Single select | 必須 | `salesforce_user` / `slack_user` / `chatwork_user` / `intercom_admin` / `notion_user` / `email_sender` |
| external_id | 外部ID | Single line text | 必須 | 例：U01... / 005... |
| external_email | 外部メール | Email | 任意 | 取れる場合 |
| external_name | 外部表示名 | Single line text | 任意 | 取れる場合 |
| match_rule | 一致ルール | Single select | 必須 | `exact_email` / `exact_external_id` / `manual_confirmed` / `name_fuzzy` / `imported_mapping` |
| confidence | 確信度 | Decimal | 推奨 | 0〜1 |
| is_primary | 代表ID | Checkbox | 任意 | system内での代表 |
| is_active | 有効 | Checkbox | 推奨 |  |
| evidence_json | 根拠（JSON文字列） | Long text | 任意 | URL/ログなど |
| created_at | 作成日時 | Date time | 推奨 |  |
| updated_at | 更新日時 | Date time | 推奨 |  |




---

## 3.11 log_*（Evidenceログ）— Actor解決結果の付与（v1必須）
目的：Slack/Chatwork/Intercom/Minutes/CSE などで分断された “担当者” を internal_users に正規化し、  
Sent / Action / SF Task / Audit まで同じactorで一本化する。

共通方針：
- 各logテーブルに「Links + Lookup（internal_users参照）」と、解決結果（status/confidence）を追加する
- NocoDBのLookupはLinksが必要なため、必ず **relation_actor_internal_user_id（Links） + actor_internal_user_id（Lookup）** の2列セットで作る

共通で追加する列（全ログ共通）：
| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| relation_actor_internal_user_id | actor参照（Links） | Links | 任意 | internal_users を指定 |
| actor_internal_user_id | actor（社内ユーザ） | Lookup | 任意 | internal_users参照 |
| actor_resolution_status | actor解決状態 | Single select | 推奨 | resolved / ambiguous / unresolved |
| actor_resolution_confidence | actor解決確信度 | Decimal | 任意 | 0〜1 |

---

### 3.11.1 log_slack
既存キー例：account_id（Slack user id）, account_name

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| relation_actor_internal_user_id | actor参照（Links） | Links | 任意 | internal_users |
| actor_internal_user_id | actor（社内ユーザ） | Lookup | 任意 | internal_users |
| actor_resolution_status | 解決状態 | Single select | 推奨 | resolved/ambiguous/unresolved |
| actor_resolution_confidence | 確信度 | Decimal | 任意 | 0〜1 |

---

### 3.11.2 log_chatwork
既存キー例：account_id（ChatworkアカウントID）, account_name

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| relation_actor_internal_user_id | actor参照（Links） | Links | 任意 | internal_users |
| actor_internal_user_id | actor（社内ユーザ） | Lookup | 任意 | internal_users |
| actor_resolution_status | 解決状態 | Single select | 推奨 | resolved/ambiguous/unresolved |
| actor_resolution_confidence | 確信度 | Decimal | 任意 | 0〜1 |

---

### 3.11.3 log_intercom
既存キー例：account_id（Intercom admin id）, account_name

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| relation_actor_internal_user_id | actor参照（Links） | Links | 任意 | internal_users |
| actor_internal_user_id | actor（社内ユーザ） | Lookup | 任意 | internal_users |
| actor_resolution_status | 解決状態 | Single select | 推奨 | resolved/ambiguous/unresolved |
| actor_resolution_confidence | 確信度 | Decimal | 任意 | 0〜1 |
| message_type | 問い合わせ種別 | Single select | 推奨 | support / inquiry / mail |


---

### 3.11.4 log_notion-minutes
既存キー例：account_id（Notion user id相当）, account_name

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| relation_actor_internal_user_id | actor参照（Links） | Links | 任意 | internal_users |
| actor_internal_user_id | actor（社内ユーザ） | Lookup | 任意 | internal_users |
| actor_resolution_status | 解決状態 | Single select | 推奨 | resolved/ambiguous/unresolved |
| actor_resolution_confidence | 確信度 | Decimal | 任意 | 0〜1 |

---

### 3.11.5 cse_tickets
既存キー例：created_by（作成者名/ID）, ticket_holder, model 等
※ created_by がIDでない場合は ambiguous/unresolved が出やすい前提でOK

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| relation_actor_internal_user_id | actor参照（Links） | Links | 任意 | internal_users |
| actor_internal_user_id | actor（社内ユーザ） | Lookup | 任意 | internal_users |
| actor_resolution_status | 解決状態 | Single select | 推奨 | resolved/ambiguous/unresolved |
| actor_resolution_confidence | 確信度 | Decimal | 任意 | 0〜1 |



---

## Appendix A. Log Tables（参照系：CXMが統合表示するEvidence）
※これらは「確定ログ」ではないが、AI提案とTimeline表示の一次ソースとなるため、最低限の追加カラムを定義する。

### A.1 log_intercom（Evidence：Intercomログ）
> 注：本セクションは 3.11.3（log_intercom）で定義した追加列の “再掲＋運用ルール” です（スキーマは1つに統一）。
既存テーブルを前提に、CXMで必要な追加フィールドのみ定義する。

| フィールド | 項目名 | NocoDB型 | 必須 | メモ |
|---|---|---|---:|---|
| message_type | メッセージ種別 | Single select | 必須 | support / inquiry / mail |
| relation_actor_internal_user_id | 実行者参照（Links） | Links | 任意 | internal_users を指定 |
| actor_internal_user_id | 実行者（社内ユーザ） | Lookup | 任意 | internal_users参照（担当者を一本化） |
| actor_resolution_status | 担当者解決状態 | Single select | 推奨 | resolved / ambiguous / unresolved |
| actor_resolution_confidence | 担当者解決確信度 | Decimal | 任意 | 0〜1 |
| scope_hint | scope推定 | Single select | 任意 | company / project / user / unknown |
| owner_role_hint | 推奨Owner Role | Single select | 推奨 | CSM / Support / CRM |
| company_uid | 会社ID | Single line text | 任意 | 不明なら空でOK（後から紐付け） |
| project_id | Project ID | Single line text | 任意 | 不明なら空でOK |
| user_id | User ID | Single line text | 任意 | 不明なら空でOK |
| evidence_refs_json | 根拠（JSON文字列） | Long text | 任意 | intercom_conversation 等 |

推奨の自動セット（ルール）
- message_type = support → owner_role_hint=Support, scope_hint=project（取れなければunknown）
- message_type = mail → owner_role_hint=CSM, scope_hint=company（取れなければunknown。projectが分かるならproject）
- message_type = inquiry → owner_role_hint=Support（secondary=CRM）, scope_hint=user（取れなければunknown。projectが分かるならproject）









