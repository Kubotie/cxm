# 10 Sent Action & Channel Directory（CXM v1）
（Slack/Chatwork/Email/Intercom/In-product 送信を漏れなくAction化する仕様）

---

## 0. 目的
本ドキュメントは、CXM v1において
- 生成したコンテンツ/メッセージを **複数チャネルで送信**できるようにしつつ
- 送信（Sent）を **必ず Action として記録**し、Evidence→介入→学習のループを壊さないために、
Sentのドメイン仕様・送信先管理・状態遷移・ログ設計を定義する。

対象チャネル：
- email
- intercom（mail / in-app）
- in_product（自社プロダクト内）
- slack
- chatwork

---

## 1. 基本原則（漏れ防止のための“鉄則”）
### 1.1 Sentは単独ログにしない
- Sentは必ず `actions.action_type = sent` として記録する
- 送信の発生点で Action を生成し、**送信結果まで同じActionに紐づける**
- 「送ったが記録されていない」をシステム的に起こさない

### 1.2 Draft → Approve → Send → Push（確定）を標準
- AIはDraftを生成（content_jobs）
- 人が編集し承認（Approve）
- 送信（Send）
- 送信内容・宛先・結果を含めて Push（NocoDB確定）
-（任意）CSM管理顧客は SF Taskへ同期（Sync）

> v1では「自動送信」はしない。必ず人が送信を実行する。

### 1.3 Scope/Projectの取り扱い
- Sent Actionは必ず `company_uid` を持つ（Company紐付け必須）
- `related_project_id` は原則必須（プロダクト利用文脈に紐づくため）
- 例外：Company戦略コミュニケーション（経営合意/更新交渉など）は project null 可

---

## 2. Domain Model（NocoDB拡張仕様）
`05_Domain_Model_People_Action_Sync.md` の actions/content_jobs を、Sent用途で拡張する。

### 2.1 content_jobs（message生成）
- content_type に `message` を追加（09で定義済）
- template_id は `SENT_*` を使用

必須フィールド：
- content_job_id
- company_uid
- action_id（推奨：紐付け先。無い場合は送信時に作成して紐づける）
- content_type = message
- template_id（例：SENT_SLACK_INTERNAL_UPDATE_V1）
- title（任意）
- body（生成本文）
- status（draft/generated/edited/approved）
- approved_by/approved_at
- prompt_snapshot
- inputs（evidence_refs等）

### 2.2 actions（sent記録）
sent Actionは以下のフィールドを必須とする。

必須（最小）
- action_id
- company_uid
- scope / scope_id
- related_project_id（原則必須）
- owner_role（CSM/Support/CRM/GTM）
- action_type = sent
- title（件名相当）
- target（Risk↓/Opp↑/Health↑/Phase→/Coverage↑）
- evidence_refs（なぜ送ったか）
- status（confirmed / executed など）


Sent拡張（必須）
- channel（email/intercom/in_product/slack/chatwork）
- destination_type（後述）
- destination_id（後述）
- destination_meta（thread_ts/message_id等）
- payload_ref（content_job_id または raw）
- send_status（queued/sent/failed）
- sent_at
- sent_by

Sent拡張（channel=intercom の場合は必須）
- audience_scope（company / project / user / segment）
- audience_id（company_uid / project_id / user_id / segment_id）
- resolved_recipients_count（解決された送信対象人数）
- destination_meta（intercom_campaign_id / message_id 等）

Sent拡張（推奨：結果）
- result_metrics（open/click/reply/emoji_reaction 等、取れる範囲）
- followup_action_ids（次に起票されたTask等）

---

## 3. Channel & Destination（送信先の型を固定）
### 3.1 channel enum（固定）
- `email`
- `intercom`
- `in_product`
- `slack`
- `chatwork`

### 3.2 destination_type enum（固定）
- `customer_individual`（顧客個人）
- `customer_group`（顧客内グループ：例 部署メーリングリスト）
- `internal_team`（Ptmind社内チーム）
- `internal_person`（Ptmind社内個人）
- `unknown`（暫定：v1では極力避ける）

### 3.3 destination_id の型（チャネル別）
- email：email_address（単一 or カンマ区切り）
- intercom（配信）：destination_id = intercom_delivery_job_id（配信ジョブID）
  - audience_scope / audience_id で「誰に送るか」を表現する（company/project/user/segment）
  - Intercom側の実体（campaign/message）のIDは destination_meta に保持する
- in_product：segment_id または user_id（統一は未決事項）
- slack：slack_channel_id（＋thread_ts/message_ts）
- chatwork：chatwork_channel_id（※ChatworkのRoom IDを本仕様では channel_id と呼ぶ）（＋message_id）





---

## 4. 送信先の管理（internalは設定、customerのみデータ）
### 4.1 internal（社内送信先）はデータに持たない
- 社内Slack/Chatworkの送信先は **環境変数 / 設定ファイル / コード定数**として管理する
- UI上は「社内送信先（固定）」として選択肢を出す（実体は設定）

**例（設定のイメージ）**
- SLACK_INTERNAL_DEFAULT_CHANNEL_ID
- SLACK_INTERNAL_ONBOARDING_CHANNEL_ID
- CHATWORK_INTERNAL_CHANNEL_ID_SUPPORT
- CHATWORK_INTERNAL_CHANNEL_ID_CSM

> 送信先が変わる場合は、設定の更新で対応する（DB更新は不要）


### 4.1.1 社内固定送信先（v1：具体ID）
v1では、社内送信先（Slack/Chatwork）はDBに持たず、設定として固定する。
用途は「テスト用／共有用／緊急用」の3種とするが、送信先IDは同一でも運用可能とする（用途は本文タグで識別）。

**Slack（社内固定）**
- チャンネルID（テスト用）：`C02M8TW0ME2`
- チャンネルID（共有用）：`C02M8TW0ME2`
- チャンネルID（緊急用）：`C02M8TW0ME2`

**Chatwork（社内固定）**
- チャンネルID（テスト用）：`425325470`
- チャンネルID（共有用）：`425325470`
- チャンネルID（緊急用）：`425325470`

#### 設定名（例：環境変数/設定ファイル）
- `SLACK_INTERNAL_CHANNEL_ID_TEST=C02M8TW0ME2`
- `SLACK_INTERNAL_CHANNEL_ID_SHARED=C02M8TW0ME2`
- `SLACK_INTERNAL_CHANNEL_ID_URGENT=C02M8TW0ME2`
- `CHATWORK_INTERNAL_CHANNEL_ID_TEST=425325470`
- `CHATWORK_INTERNAL_CHANNEL_ID_SHARED=425325470`
- `CHATWORK_INTERNAL_CHANNEL_ID_URGENT=425325470`

#### 用途タグ規約（本文の先頭に必ず付与）
同一送信先IDを用途別に運用するため、Slack/Chatwork投稿の本文先頭に用途タグを必ず付ける。

- テスト用：`[CXM-TEST]`
- 共有用：`[CXM-SHARED]`
- 緊急用：`[CXM-URGENT]`

（例）
- `[CXM-SHARED] TL;DR: 〜`
- `[CXM-URGENT] TL;DR: 〜（対応要）`





### 4.2 external（顧客との共同チャンネル）送信先は既存テーブルをSSOTとする
顧客との共同チャンネル（外部）へ送信する場合、送信先は新規テーブルを作らず、
既存の **company_channel_identify** テーブル（company_uid ↔ channel_id）をSSOTとして参照する。

このテーブルは「顧客へSlack/Chatworkで送ってよい送信先」を明示する“送信許可リスト”でもある。
したがって、外部送信は **company_channel_identify に該当レコードが存在する場合のみ** UIで有効化する。

#### SSOT: company_channel_identify（外部チャンネル紐付け：v1）
最低限利用するカラム：
- company_uid（参照キー）
- slack_channel_id（外部SlackチャンネルID）
- chatwork_channel_id（外部ChatworkチャンネルID）
- is_active（有効フラグ：誤送信防止）
- note（メモ：任意）

補助（必要な場合）：
- ext_slack_workspace（外部ワークスペース名）
- slack_team_id（外部SlackチームID）

#### 外部送信のガード（必須）
- channel=slack で外部送信する場合：company_channel_identify.slack_channel_id が存在すること
- channel=chatwork で外部送信する場合：company_channel_identify.chatwork_channel_id が存在すること
- 存在しない場合、UIでは外部送信先候補を表示しない（誤送信防止）

#### 外部送信時のdestination_id
- slack：destination_id = company_channel_identify.slack_channel_id
- chatwork：destination_id = company_channel_identify.chatwork_channel_id


---

## 5. 送信フロー（UI/Backend）
### 5.1 フロー概要
1) Actionカード/Contentカードから `メッセージ作成`（AI Draft）
2) 人が編集 → 承認（Approve）
3) `送信先選択`
- 社内：固定（設定から選択）
- 外部（顧客共同チャンネル）：company_channel_identify に存在する場合のみ選択可能
4) `送信`（Send）
5) `Sent Action` を Push（NocoDB confirmed）
6)（必要なら）SF Task同期（送信ログをタスク化する場合）

（追記：Intercom配信）
- Intercom送信は「宛先を audience_scope/audience_id で指定」→「送信対象（Intercom user）へ解決」→「配信ジョブとして送信」する


### 5.2 送信時に必ず作るもの（漏れ防止）
- content_job（message）が存在しない場合：
  - 送信画面で raw_text を入力して送る
  - その場合も content_job を自動生成（template_id=RAW_MESSAGE）して payload_ref を必ず持たせる
- actions（sent）は必ず作成・更新される
  - send_status / destination_meta を更新して確定

### 5.3 送信先の決定ロジック（v1）
送信（Send）は `channel` によって送信先の決まり方が異なる。

- Slack / Chatwork（社内）：
  - 送信先は **設定で固定**（DB参照なし）
  - 用途は本文タグ `[CXM-TEST]/[CXM-SHARED]/[CXM-URGENT]` で識別する

- Slack / Chatwork（外部：顧客共同チャンネル）：
  - 送信先は **SSOT=company_channel_identify** を参照して決定する
  - company_uid に紐づく channel_id が存在する場合のみ送信可能（誤送信ガード）
  - destination_id は外部 channel_id（slack_channel_id / chatwork_channel_id）

- Intercom（配信）：
  - 送信先は「1つのID」ではなく **audience_scope/audience_id** で指定する
  - 実行時に Intercom user の集合へ解決し、配信ジョブとして送る
  - destination_id は intercom_delivery_job_id（配信ジョブID）


## 5.4 Intercom Audience Resolver（宛先解決：v1最小仕様）

Intercom配信（channel=intercom）は「送信先ID（channel_id）」ではなく、
**audience_scope / audience_id** により「誰に送るか」を指定し、
送信実行時に Intercom配信対象（intercom_user_id の集合）へ解決する。

### 5.4.1 指定単位（UIで選べる単位：v1）
- audience_scope = `user`（ユーザー単位）
- audience_scope = `project`（プロジェクト単位）
- audience_scope = `company`（会社単位）

### 5.4.2 解決ルール（最小）
- user：
  - audience_id = user_id
  - user.intercom_user_id が存在する場合のみ配信対象
- project：
  - audience_id = project_id
  - `user_project_membership`（User⇄Project）から user_id を列挙
  - 各 user の intercom_user_id が存在するものだけ配信対象
- company：
  - audience_id = company_uid
  - company に紐づく user_id を列挙（company_user関係または project_membership のunion）
  - intercom_user_id が存在するものだけ配信対象

### 5.4.3 実行前の表示（必須：誤配信防止）
送信前に以下をUIで表示し、二段階確認の材料とする。
- audience_scope / audience_id
- resolved_recipients_count（解決された人数）
- 未解決件数（intercom_user_id が無い人数）
- 送信本文（最終版）
- Evidence（最低1つ）

### 5.4.4 記録（sent Actionへの保存）
- action.channel = `intercom`
- action.audience_scope / action.audience_id を保存
- resolved_recipients_count を保存
- destination_id は `intercom_delivery_job_id`（配信ジョブID）として保存
- destination_meta に intercom側の識別子（campaign_id/message_id等）を保存
- result_metrics（open/click/reply等：取得可能範囲）を保存



---

## 6. Slack/Chatwork送信の詳細
### 6.1 Slack
- destination_id：slack_channel_id
- thread_ts：継続議論なら指定（任意）
- 送信後：message_tsをdestination_metaに保存

### 6.2 Chatwork
- destination_id：chatwork_channel_id
- 送信後：message_idをdestination_metaに保存

---

## 7. Sent Action の評価指標（v1で取れる範囲）
- 共通：delivered（成功/失敗）、reply有無、followup_action
- email/intercom：open/click/reply（可能な範囲）
- slack/chatwork：reaction_count、thread_reply_count（可能な範囲）

---

## 8. エラー/再送/監査
- send_status：queued / sent / failed
- failed はUI上で「再送」可能（同一payload_refで再送）
- 監査：sent_by/sent_at/destination_id/payload_ref/evidence_refs を必ず残す

---

## 9. v1で決めるべき未決事項（チェックリスト）
- Intercom送信の単位（user / project / company（audience_scope））
- In-product送信の単位（segment_id or user_id）
- 社内固定送信先（設定）の初期セット（どのチャンネル/ルームを用意するか）
- 顧客向けSlack/Chatwork送信を v1で許可する（SSOT=company_channel_identify、外部送信ガード必須）




