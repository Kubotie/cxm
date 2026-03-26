# 08 Governance & Audit（CXM v1）
（権限設計 / 誤操作ガード / 監査ログ / 運用ルール）

---

## 0. 目的
本ドキュメントは、CXM v1における
- **Push（NocoDB確定）**
- **Send（社内/外部送信）**
- **Sync（Salesforce Contact/Task 同期）**
といった不可逆/高リスク操作を、安全かつ再現性高く運用するためのガバナンスを定義する。

本CXMの基本方針：
- AIは提案まで（自動確定しない）
- 人が編集・承認し、Push/Send/Sync を実行する
- Evidence（根拠）と監査ログにより、説明可能性を担保する

---

## 1. 用語と前提
### 1.1 操作の定義
- **Propose**：AIが提案データ（people/org/action/content_jobs）を生成する
- **Edit**：提案をUI上で編集する（draft_patch）
- **Approve**：送信/同期に使う下書きを承認する
- **Push**：確定データとしてNocoDBへ保存する（以後、UI表示の基準）
- **Send_internal**：社内固定送信先へ送信（Slack/Chatwork：設定で固定）
- **Send_external**：顧客共同チャンネルへ送信（Slack/Chatwork：SSOT=company_channel_identify）
- **Sync_SF**：Salesforceへ同期（Contact/Task）

### 1.2 送信先SSOT
- **社内送信先（internal）**：DBに持たない。設定値で固定（10章）
- **外部送信先（external）**：`company_channel_identify` をSSOTとする  
  - company_uid ↔ slack_channel_id / chatwork_channel_id（顧客共同チャンネル）

### 1.3 Intercomの識別子
- Intercomは destination_id を持たず、audience_scope/audience_id を指定し、送信実行時に intercom_user_id 集合へ解決して intercom_delivery_job_id を destination_id として保存する（詳細は10章5.4）。
- conversation_idは destination_meta として保持（10章）

---

## 2. 権限モデル（RBAC）
### 2.1 ロール一覧（v1：確定）
- CSM
- CSM Manager
- Support
- CRM
- GTM
- Admin

> 補足：
> - v1は運用をブレさせないため、ロールはこの6つに固定する。
> - Salesforceのプロファイル/ロールとは独立（CXM内の運用ロール）。

### 2.2 操作カテゴリ
- **閲覧系**：View
- **編集系**：Propose / Edit / Approve
- **確定系**：Push（NocoDB確定）
- **送信系**：Send_internal / Send_external
- **同期系**：Sync_SF（Contact/Task）

---


## 3. 権限マトリクス（v1：確定表）
> ✅=許可 / ❌=禁止 / 🔒=条件付き（ガード必須：二段階確認＋監査ログ）

| Role | View | Propose | Edit | Approve | Push（NocoDB確定） | Send_internal | Send_external（Slack/Chatwork/Intercom） | Sync_SF（Contact/Task） |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CSM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 |
| CSM Manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 |
| Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| CRM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| GTM | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 |

### 3.1 条件付き（🔒）の必須ガード（共通）
- Send_external / Sync_SF は必ず **二段階確認＋監査ログ**を要求する
- Sync_SF は **Push済み（confirmed）データのみ対象**
- 外部送信（Slack/Chatwork）は `company_channel_identify` を参照し、存在しない場合はUI上で無効化する

---

## 4. 誤操作ガード（安全設計）
### 4.1 外部送信（Send_external）ガード
外部送信は「誤送信」が最大リスク。以下を必須とする。

**ガード条件（必須）**
1) company_uidに対して、`company_channel_identify` に送信先IDが存在する  
   - slack：slack_channel_idが存在
   - chatwork：chatwork_channel_idが存在
2) UIで **外部送信先は “選択” ではなく “自動表示”**（SSOT参照）  
   - つまり「外部送信」ボタンを押すと、会社に紐づくチャンネルだけが表示される
3) 二段階確認（Confirm #1 / Confirm #2）を必須

**Confirm #1（内容確認）**
- 送信チャネル（slack/chatwork）
- 送信先ID（channel_id/room_id）と表示名（channel_name）
- 送信本文（最終版）
- Evidence（最低1つ）

**Confirm #2（意図確認）**
- 「これは顧客共同チャンネル（外部）へ送信します」を明示
- チェックボックス（例：✅誤送信ではないことを確認しました）

（※確認文言はあなたの指定トーンで確定反映）

### 4.1.1 Intercom配信（外部送信）ガード
Intercomは顧客への外部配信であるため Send_external と同等に扱う。

必須ガード：
1) audience_scope / audience_id を明示（company/project/user/segment）
2) 解決された送信対象人数（resolved_recipients_count）を表示（未解決なら「未確定」と明示）
3) 二段階確認で「送信対象範囲」と「本文」を確認する
4) 送信後は sent Action に destination_meta（campaign/message識別子）と結果指標（open/click/reply等）を保存する


### 4.2 Salesforce同期（Sync_SF）ガード
SFはSSOT寄りの領域なので、同期は慎重に扱う。

**必須条件**
- 同期対象は **Push済み（confirmed）** データのみ
- 差分プレビュー（Before/After）を表示
- エラー時は “部分成功/失敗” を記録（再同期可能）

**二段階確認**
- Confirm #1：差分確認
- Confirm #2：同期先（Contact/Task）の明示＋チェック

---

## 5. 監査ログ（Audit）
### 5.1 監査ログの要件（必須）
Push/Send/Sync の3操作は必ず監査ログを残す。

**必須ログ項目**
- actor_user_id（実行者）
- actor_role（実行ロール）
- operation（push / send_internal / send_external / sync_sf_contact / sync_sf_task）
- company_uid / related_project_id
- timestamp
- payload_ref（content_job_id / action_id / people_node_id など）
- evidence_refs（最低1つ）
- result（success/failed）
- error_message（failed時）

### 5.2 保存先（v1）
- 監査ログはNocoDBの `audit_events`（新規テーブル）に保存する  
  （※保存先を別にする場合はここだけ差し替え）

---

## 6. 運用ルール（SOP）
### 6.1 Push（NocoDB確定）の運用
- Push前に、UIで “差分（draft_patch）” を確認する
- Push後の修正は「再提案→編集→再Push」で上書き（履歴はauditで追う）

### 6.2 Send（送信）の運用
- 送信は必ず `actions.action_type=sent` を生成/更新する（10章）
- 送信後、send_status / destination_meta を確定しPushする
- 社内送信は用途タグを必須（[CXM-TEST]/[CXM-SHARED]/[CXM-URGENT]）

### 6.3 Sync（Salesforce）の運用
- Contact/Task は “同期前に差分確認” を必須
- Sync失敗時は auditに残し、UIで再実行できる

---

## 7. 例外（Exception）
- 緊急（[CXM-URGENT]）は、二段階確認は維持しつつ、確認UIは簡略化してよい（ただしチェックは必須）
- 例外を作る場合は、例外条件と対象ロールを明記し、auditに “exception=true” を残す

---

## 8. 未決事項（このファイル内で必ず確定するもの）
- v1ロール一覧（2.1）
- 権限マトリクス（3）
- 外部送信/Syncの確認文言（4.1/4.2）
- audit_events の保存先（5.2）