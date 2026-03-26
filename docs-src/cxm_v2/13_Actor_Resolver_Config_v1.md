# 13 Actor Resolver Config v1（担当者ID解決：internal_users 正規化）
（log_* / actions / sync_events / audit_logs の actor を “同一人物” に一本化する）

---

## 0. 目的
本ドキュメントは、Slack / Chatwork / Intercom / Notion minutes / CSE など各所に分断された
**社内担当者（actor）** を、NocoDB上の `internal_users` に正規化して参照できるようにするための
**解決（resolve）ルール・入出力・設定値** を固定する。

- “同一人物判定” を **NocoDB（internal_users / user_identity_links）で吸収**する
- 既存ログを壊さず、log_* に **解決結果（actor_internal_user_id等）を後付けする**
- 解決結果は、Sent / Action / SF Task Sync / 監査ログまで一貫して使う

---

## 1. データソース（NocoDB Table IDs）
> NocoDBのAPIは v2 を前提（あなたの動作確認済み形式）

### 1.1 NocoDB API 形式（固定）
- `TOKEN_NOCODB = "<xc-token>"`
- `NOCODB_BASE_URL = f"https://odtable.ptmind.ai/api/v2/tables/{TABLE_ID}/records"`
- `headers_noco = {"xc-token": TOKEN_NOCODB, "Content-Type": "application/json"}`

### 1.2 Table ID 一覧（最新版）
| logical_name | table_id |
|---|---|
| log_chatwork | `m5jyl07u9pt9gjk` |
| log_notion_minutes | `m8kjmz8kjqb7ko5` |
| log_slack | `mldb8xywgbm9j09` |
| log_intercom | `mcwp0o7l2vovnqy` |
| cse_tickets | `m8fj8jebkno80bj` |
| project_info | `mse3eosn7551z82` |
| companies | `mlwfjmp43n6ofwb` |
| company_channel_identify | `m8ssbcn7d8rzzu0` |
| people_nodes | `mn3lxq2pa9kzif3` |
| org_edges | `mr3m4i1ph9fxsr6` |
| org_chart_versions | `mcrcq6ax9jtvky3` |
| actions | `mirc5vbre52mg92` |
| content_jobs | `mrdbndiyxpou95j` |
| sync_events | `m4oq7im2w93ylii` |
| audit_logs | `m832cqcum4jgi4q` |
| internal_users | `m5ld1vr57eh3g5p` |
| user_identity_links | `mq8cbaki7112qym` |

---

## 2. SSOT（担当者の正規化）
### 2.1 internal_users（社内担当者のSSOT）
- 1人＝1行
- 代表メール（primary_email）や role_default を持つ
- すべての解決結果は最終的に **internal_user_id** に収束する

### 2.2 user_identity_links（外部ID ↔ internal_users）
- 1人が複数システムで複数IDを持つ前提（多対1）
- actor解決の最優先参照先

#### system 値（固定）
- `salesforce_user`
- `slack_user`
- `chatwork_user`
- `intercom_admin`
- `notion_user`
- `email_sender`

#### match_rule 値（固定）
- `exact_external_id`（ID直指定）
- `exact_email`（メール完全一致）
- `manual_confirmed`（人が確定）
- `name_fuzzy`（名前近似：最後の手段、仮扱い）
- `imported_mapping`（既存名簿から一括）

---

## 3. 解決結果の出力先（log_* に追加する列）
> すでに各ログCSV上では以下の列が存在している前提（= 現状の形でOK）

### 3.1 log_* 共通（後付け列）
- `relation_actor_internal_user_id`（Links：internal_users を指定するための列）
- `actor_internal_user_id`（Lookup：internal_users の参照列）
- `actor_resolution_status`（Single select）
  - `resolved` / `ambiguous` / `unresolved`
- `actor_resolution_confidence`（Decimal：0〜1）

### 3.2 log_* における “actor元情報” の列（現状）
| log_table | actor_source_field（元のID） | actor_name_field（元の表示名） |
|---|---|---|
| log_slack | `account_id` | `account_name` |
| log_chatwork | `account_id` | `account_name` |
| log_intercom | `account_id` | `account_name` |
| log_notion_minutes | `account_id` | `account_name` |
| cse_tickets | `created_by` | （必要なら comment/body から補助抽出） |

---

## 4. Actor Resolver（担当者解決）ルール
### 4.1 入力（Resolverが受け取る最小セット）


```
{
“system”: “slack_user | chatwork_user | intercom_admin | notion_user | salesforce_user”,
“external_id”: “Uxxxx / 数値ID / 005xxxx / …”,
“external_email”: “任意（取れる場合）”,
“external_name”: “任意（取れる場合）”,
“context”: {
“company_uid”: “任意”,
“source_table”: “log_slack など”,
“source_record_id”: “NocoDB row id など（任意）”
}
}
```

### 4.2 優先順位（固定）
1) **完全一致：system + external_id**
- `user_identity_links.system == system AND external_id == external_id`
- → `resolved`（confidence=1.00）

2) **完全一致：email**
- 取れる場合のみ（external_email / ログ本文から抽出できたメール等）
- `user_identity_links.match_rule = exact_email` の候補を優先
- → `resolved`（confidence=0.95）

3) **名前近似（最後の手段）**
- external_name が取れる場合のみ
- `display_name` / `display_name_en` / `external_name` の近似
- → `ambiguous`（confidence=0.40〜0.60）
- **原則：UIで manual_confirmed へ昇格させるまで “仮” 扱い**

4) 解決不能
- → `unresolved`（confidence=0.00）

---

## 5. 解決結果の書き込み（Write-back）
### 5.1 log_*（各ログテーブル）への書き込み
- `relation_actor_internal_user_id`：Links列に internal_users を指定（運用上は列定義で固定済み想定）
- `actor_internal_user_id`：Lookup列に internal_user をセット
- `actor_resolution_status`：`resolved / ambiguous / unresolved`
- `actor_resolution_confidence`：0〜1

### 5.2 actions / sync_events / audit_logs への適用（推奨）
- `actions.relation_actor_internal_user_id`（Links） + `actions.actor_internal_user_id`（Lookup）
- `sync_events.relation_actor_internal_user_id`（Links） + `sync_events.actor_internal_user_id`（Lookup）
- `audit_logs.relation_actor_internal_user_id`（Links） + `audit_logs.actor_internal_user_id`（Lookup）

> これにより、  
> - “誰が送ったか（Sent）”  
> - “誰が同期したか（Sync）”  
> - “誰が確定したか（Push/Approve）”  
> がすべて internal_users に揃う。

---

## 6. UI運用（未解決Actor Inbox：必須）
### 6.1 Inboxに出す条件
- `actor_resolution_status != resolved` のログ
- もしくは `actor_internal_user_id is null`

### 6.2 Inboxでできること（最短導線）
- 「この人は誰？」を開く
- 候補提示（順）
  1. email一致候補
  2. 名前一致/近似候補
  3. internal_users 全件検索
- 1クリック確定：
  - `user_identity_links` に `manual_confirmed` を1行追加（system + external_id）
  - 該当ログへ `resolved` で write-back
- まとめて適用：
  - 同じ `system + external_id` を持つ未解決ログに一括反映

---

## 7. バッチ運用（推奨：日次 + 随時）
### 7.1 バッチの対象
- log_slack / log_chatwork / log_intercom / log_notion_minutes / cse_tickets のうち
  - `actor_internal_user_id is null` または `actor_resolution_status != resolved`

### 7.2 実行頻度
- **日次1回**（夜間）
- 追加で、ログ取り込み直後に **随時**（可能なら）

---

## 8. 監査（任意だが強い）
### 8.1 sync_events に残す（推奨）
- operation：`resolve_actor`
- entity_type：`log_record`
- entity_id：該当ログのレコードID
- result：success / conflict / error
- payload_json：入力（system/external_id/external_name）
- diff_snapshot：解決結果（internal_user_id/confidence）

> audit_logs は “人が押した” 系、sync_events は “外部/処理結果” 系なので、resolve_actor は sync_events に寄せるのが一貫。

---

## 9. テストケース（最低限）
1) Slackの `account_id` が user_identity_links に存在 → resolved=1.0
2) Chatworkも同様
3) Intercom admin の `account_id` が存在 → resolved=1.0
4) Notion minutes の `account_id` が存在 → resolved=1.0
5) cse_tickets.created_by が未登録 → unresolved → Inboxで手動確定できる

---

## 10. 既知の注意点
- `name_fuzzy` を常用しない（誤紐付けが致命傷になりやすい）
- 外部IDが変わるシステム（Slackの表示名変更等）は、**external_id（固定ID）優先**で吸収
- “同姓同名” は manual_confirmed 前提で安全運用する

---