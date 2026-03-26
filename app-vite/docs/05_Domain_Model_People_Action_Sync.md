# 05 Domain Model — People / Org Chart / Action / Content / Sync（CXM v1）

## 0. 目的
本ドキュメントは、CXMにおける
- People（ステークホルダー/組織図）
- Action（Task/Sent/Meeting/Ticket/Content）
- Push（NocoDB確定）
- Sync（Salesforce昇格：Contact/Task）

を破綻なく実装・運用するための **データモデルと同期仕様** を定義する。

本仕様は `04_UI_Blueprint_CSM_Workflow.md` を実装可能な形に落とす “真実の層（SSOT/Schema/State）” である。

---

## 1. SSOT（信頼できる唯一の情報源）と二段階コミット
### 1.1 SSOT方針
- NocoDB：CXMとしての **確定ログ（決定の証跡）** の保管先（PushのSSOT）
- Salesforce：
  - Contact：名簿/組織情報のSSOT（ただしCXMの確定履歴はNocoDBに残す）
  - Task：CSM対応顧客のToDo/Activity SSOT（同上）

### 1.2 二段階コミット
- **Push**：AI提案を人が編集し、NocoDBへ `confirmed` として確定保存（監査ログ含む）
- **Sync**：Push済みレコードのみ、Salesforceへ create/update する（差分確認・競合処理あり）

---

## 2. Scope と参照キー（絶対ルール）
### 2.1 Scope
- Company / Project / User

### 2.2 参照キー（統一）
- Company：`company_uid`（例：sf_0017F...）を統一キーとする
- Project：`project_id`（例：1049531d 等）を統一キーとする
- User：`user_id`（Account ID等）を統一キーとする

> すべてのモデルは scope と scope_id を持つ。

---

## 3. NocoDB Domain Tables（v1最小）
以下は「必須テーブル」。v1はこの5つで成立する。

### 3.1 minutes_sources（入力Evidence）
議事録/ログを “提案生成の入力” として参照可能にする。

**Columns**
- minutes_id（PK）
- company_uid（FK）
- source_type（notion_minutes / other）
- source_ref（notion page_id 等）
- title
- occurred_at（会議日：DateTime）
- captured_at（取込日時：DateTime）
- url
- raw_text（任意：保存する場合）
- status（unprocessed / proposed / confirmed）

### 3.2 people_nodes（人物ノード：確定版）
**Columns**
- people_node_id（PK）
- company_uid（FK）
- display_name（暫定可）
- email（nullable）
- phone（nullable）
- dept_raw（nullable）
- dept_category（nullable：Picklist）
- stakeholder_role（Picklist）
- decision_position（Picklist：承認者/推薦者/実務責任/門番/利用者/不明）
- stance（Picklist：推進/中立/慎重/反対/不明）
- budget_influence（Picklist：あり/一部/なし/不明）
- ops_influence（Picklist：高/中/低/不明）
- influence_level（計算列：高/中/低/不明）
- coverage_state（Picklist：接触済/特定済/未特定）
- reports_to_node_id（nullable：FK self）
- evidence_refs（minutes_id / log_id 等の配列 or 改行テキスト）
- status（proposed / confirmed）
- pushed_by / pushed_at（監査）

**Salesforce Sync**
- sf_contact_id（nullable）
- sf_sync_status（not_synced / synced / conflict / error）
- sf_sync_last_at
- sf_sync_mode（create / update）
- sf_sync_message（エラーや競合理由）

### 3.3 org_chart_versions（組織図：固定スナップショット）
people_nodes から生成した “時点の組織図” を固定化して再現可能にする。

**Columns**
- org_chart_id（PK）
- company_uid（FK）
- source_minutes_id（FK minutes_sources）
- version（v1, v2, ...）
- graph_json（nodes/edgesの固定JSON）
- status（confirmed）
- created_by / created_at

> v1では minutesごとに versionを刻む運用が推奨（「いつの組織図か」が説明可能）。

### 3.4 actions（介入：確定ログ）
**Columns**
- action_id（PK）
- company_uid（FK）
- scope（company / project / user）
- scope_id（company_uid / project_id / user_id）
- related_project_id（nullableだが原則必須：後述）
- owner_role（CSM / Support / CRM / GTM）
- action_type（todo / meeting / sent / ticket / content）
- title（1行）
- target（Risk↓ / Opportunity↑ / Health↑ / Phase→ / Coverage↑）
- due_at（nullable）
- expected_window（7d / 14d / 30d）
- evidence_refs（signal_id / minutes_id / log_id / ticket_id 等）
- status（proposed / confirmed / executed / canceled）
- pushed_by / pushed_at（監査）

**Salesforce Sync**
- sf_task_id（nullable）
- sf_sync_status（not_synced / synced / conflict / error）
- sf_sync_last_at
- sf_sync_mode（create / update）
- sf_sync_message

#### related_project_id の必須ルール（重要）
- **必須**：scope=project / scope=user の action は `related_project_id` 必須
- **原則必須**：scope=company も related_project_id を持つ（影響の起点PJがあるため）
- **例外（許容）**：scope=company かつ「経営合意/更新交渉/横展開の純戦略タスク」は null 可  
  → UI上で「Company戦略タスク（PJなし）」ラベルを出す

### 3.5 content_jobs（資料化/記事化/ヘルプ化）
Actionから生成されたコンテンツの作業単位。

**Columns**
- content_job_id（PK）
- action_id（FK）
- company_uid（FK）
- content_type（slide / article / help / template / message）
- template_id（例：CSM_EXEC_SUMMARY_V1 / SENT_SLACK_CUSTOMER_MESSAGE_V1 / RAW_MESSAGE）
- prompt_snapshot（生成時プロンプト）
- output_ref（notion url / file url / id / raw_text）
- status（draft / generated / edited / approved / sent / published）
- approved_by / approved_at
- purpose_tag（任意：[CXM-TEST] / [CXM-SHARED] / [CXM-URGENT]）

### 3.6 sync_events（監査ログ）
Push/Sync の “誰が・いつ・何を” を確実に残す。

**Columns**
- sync_event_id（PK）
- entity_type（people_node / action）
- entity_id
- operation（push / sync_contact / sync_task）
- performed_by
- performed_at
- result（success / conflict / error）
- diff_snapshot（任意：差分JSON）
- message


### 3.7 company_channel_identify（顧客共同チャンネル：外部送信用SSOT）
Slack/Chatworkの「顧客共同チャンネル」送信先を company_uid に紐付けて固定するSSOT。

**Columns（推奨）**
- company_uid（PK/FK）
- slack_channel_id（nullable）
- chatwork_channel_id（nullable）
- intercom_*（※Intercomはchannel_id運用ではないため、ここには“宛先解決に必要なキーのみ”を置く。詳細は 10章に従う）
- status（active / inactive）
- updated_by / updated_at（監査）


---

## 4. Salesforce 同期（Contact / Task）仕様
### 4.1 共通原則
- Sync可能条件：NocoDB側 status=confirmed のみ
- Syncは create/update の2種類
- Sync前に差分プレビュー（mini）をUIに表示できること（必須ではないが推奨）
- 同期結果は必ず sync_events に残す

### 4.2 Contact Sync（people_nodes → SF Contact）
#### 4.2.1 create/update判定
- `sf_contact_id` がある → update
- 無い → match検索 → attach or create

#### 4.2.2 match検索優先順位
1) email一致（最優先）
2) company + display_name + dept_raw（近似）
3) company + display_name（近似）

#### 4.2.3 conflictポリシー（v1）
- SF側が「より新しい」かつ「人が編集した可能性が高い」場合：
  - conflict として差分提示 → 人が選択
- v1は自動マージをしない（事故防止）

### 4.3 Task Sync（actions → SF Task）
#### 4.3.1 create/update判定
- `sf_task_id` がある → update
- 無い → create

#### 4.3.2 Account/Project 紐付け必須方針
- Account（Company）紐付け：常に必須
- Project紐付け：
  - scope=project/user：必須
  - scope=company：原則必須、例外でnull可

#### 4.3.3 Contact紐付け
- action が people_node に紐づく場合：
  - people_node が synced（sf_contact_idあり）なら TaskのNameへ紐付け
  - 未同期なら Accountのみで作成し、後から更新可能

---

## 5. Push / Sync 状態遷移（State Machine）
### 5.1 People Node
- proposed（AI提案）  
  → confirmed（Push）  
  → synced（Sync成功）
- confirmed → conflict（Sync時に競合）
- confirmed → error（Sync失敗）

### 5.2 Action
- proposed（AI提案）  
  → confirmed（Push）  
  → synced（Sync成功）  
  → executed（実施済）
- confirmed → conflict / error（Sync時）
- executed → impact（別途計測 or 手入力で追記）

---

## 6. 既存MDとの接続点（参照）
- UI操作フロー：`04_UI_Blueprint_CSM_Workflow.md`
- Signalの定義：`02_Signal_Taxonomy.md`
- ロール/JTBD：`03_user_JTBD.md`

---

## 7. v1で“必ず決める”実装パラメータ（未決事項）
- SF Projectオブジェクトの参照先（Taskの関連先の実体）
- company_uid と SF Account のマッピング（既存のsf id体系を前提に固定）
- Taskの件名フォーマット（SignalIDの付与ルール）
- Sync権限（誰がContact/Task同期ボタンを押せるか）