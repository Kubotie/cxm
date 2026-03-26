# 12 Config & Tokens Master v1（NocoDB / Salesforce / Intercom）
（Base URL / Base ID / Table ID / Token管理 / envテンプレ / 管理者確認事項）

---

## 0. 方針
- **機密（TOKEN/SECRET）は、原則 env で管理**（MDには「変数名」と「用途」まで）
- v1はまず “動くこと” を最優先し、実装が要求する URL 形式に合わせる
- **Notion Minutes は NocoDB log_notion-minutes をSSOT**（Notion DB IDは保持しない）

---

## 1. NocoDB 設定（必須）

### 1.1 NocoDB Base URL（API v2）
- Base Host: `https://odtable.ptmind.ai`
- Records API（v2 / table_id指定）：
  - `https://odtable.ptmind.ai/api/v2/tables/{TABLE_ID}/records`

> ✅ あなたの実動作確認済み形式（この形以外だと動かないケースあり）

### 1.2 認証ヘッダー（xc-token）
```python
TOKEN_NOCODB = "<<<SET_IN_ENV>>>"

headers_noco = {
  "xc-token": TOKEN_NOCODB,
  "Content-Type": "application/json"
}

# records endpoint
NOCODB_BASE_URL = f"https://odtable.ptmind.ai/api/v2/tables/{TABLE_ID}/records"
```
---

### 1.2 Table ID一覧（v1）
| logical_name | table_id | memo |
|---|---|---|
| log_chatwork | m5jyl07u9pt9gjk |  |
| log_notion_minutes | m8kjmz8kjqb7ko5 | NotionはこのログをSSOTにする |
| log_slack | mldb8xywgbm9j09 |  |
| log_intercom | mcwp0o7l2vovnqy |  |
| cse_tickets | m8fj8jebkno80bj |  |
| project_info | mse3eosn7551z82 |  |
| companies | mlwfjmp43n6ofwb |  |
| company_channel_identify | m8ssbcn7d8rzzu0 | Slack/Chatwork の顧客共同チャンネルSSOT |
| people_nodes | mn3lxq2pa9kzif3 |  |
| org_edges | mr3m4i1ph9fxsr6 | ※org_chart_versions も同IDになっているが要確認 |
| org_chart_versions | mr3m4i1ph9fxsr6 | ※本当に同一テーブルか / 転記ミスか確認 |
| actions | mirc5vbre52mg92 |  |
| content_jobs | mrdbndiyxpou95j |  |
| sync_events | m4oq7im2w93ylii |  |
| audit_logs | m832cqcum4jgi4q |  |
| internal_users | m5ld1vr57eh3g5p |  |
| user_identity_links | mq8cbaki7112qym |  |

### 1.3 “使い方” の共通スニペット（Python）
```python
import os
import requests

TOKEN_NOCODB = os.environ["TOKEN_NOCODB"]
NOCODB_HOST = os.environ.get("NOCODB_HOST", "https://odtable.ptmind.ai")

def table_records_url(table_id: str) -> str:
    return f"{NOCODB_HOST}/api/v2/tables/{table_id}/records"

headers_noco = {"xc-token": TOKEN_NOCODB, "Content-Type": "application/json"}
```
---

## 2. Salesforce（管理者への確認事項）
※ここは **管理者に一括で確認**して埋める（下記「質問テンプレ」参照）

### 2.1 環境
- 環境：`prod / sandbox`
- Login URL：
  - prod: `https://login.salesforce.com`
  - sandbox: `https://test.salesforce.com`

### 2.2 Auth方式（推奨：JWT Bearer）
- 方式：`JWT Bearer Flow`（推奨）
- Connected App：
  - Consumer Key：`<SF_CLIENT_ID>`
  - JWT証明書：
    - Private Key（Secret Managerに保存）：`SF_JWT_PRIVATE_KEY_PEM`
    - 証明書の有効期限：`<DATE>`
- 対象ユーザ：
  - Integration User の Username：`<SF_USERNAME>`
  - Profile / PermissionSet：`<NAME>`
- API Version：`vXX.X`

### 2.3 Task / Contact の運用前提（このMDの参照先）
- Contact/Task のフィールド設計：`06_Salesforce_Contact_Task_Spec_and_SOP.md`
- CXMのPush→Sync：`11_Data_Schema_Master_v1.md`

---

## 3. Intercom

### 3.1 Access Token
- Tokenの格納先（Secret Manager名）：`<INTERCOM_ACCESS_TOKEN_SECRET_NAME>`
- Tokenスコープ（要確認）：
  - 送信（message）に必要な権限
  - user参照/検索に必要な権限

### 3.2 Intercom 送信単位（v1）
- audience_scope：`company / project / user`
- 宛先解決（Resolver）：
  - `user`：user.intercom_user_id がある人のみ
  - `project`：membershipでuser列挙 → intercom_user_id がある人のみ
  - `company`：company紐づきuserを列挙 → intercom_user_id がある人のみ

---

## 4. Slack / Chatwork（送信）

### 4.1 社内固定送信先（テスト/共有/緊急）
- Slack Channel ID（社内固定）：`C02M8TW0ME2`
- Chatwork Channel ID（社内固定）：`425325470`
- 用途タグ（共通）：
  - `[CXM-TEST]` / `[CXM-SHARED]` / `[CXM-URGENT]`

### 4.2 顧客共同チャンネル（外部）
- SSOT：`company_channel_identify`
  - slack_channel_id / chatwork_channel_id
  - is_active=true のみ送信可能（誤送信防止）

### 4.3 Token/Key
- Slack Bot Token secret：`<SLACK_BOT_TOKEN_SECRET_NAME>`
- Chatwork API Token secret：`<CHATWORK_API_TOKEN_SECRET_NAME>`

---
