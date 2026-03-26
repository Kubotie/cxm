# 06 Salesforce Contact / Task Spec & SOP（CXM v1）
（項目定義・判定ルール・同期マッピング・運用テンプレ）

---

## 0. 目的
本ドキュメントは、CXM v1における
- Stakeholder（People）をSalesforce Contactへ同期するための項目仕様
- Action（介入）をSalesforce Taskへ同期するための項目仕様
- 入力の属人化を防ぐ判定ルール
- CXM（NocoDB）→ Salesforce（Contact/Task）のマッピング表
- 運用SOP（誰がいつ何を更新するか）

を定義する。

---

## 1. Salesforce Contact（顧客側人物）項目仕様

### 1.1 使い方の方針
- Salesforce Contactは **確定名簿（SSOT）** として扱う
- 情報が曖昧な段階（メール無し/氏名未確定等）は **NocoDB側で確定（Push）**し、必要に応じてContactへ昇格（Sync）する
- 組織図（Org Chart）用途のため、Contactには「構造（上長/部門/意思決定ポジション）」を保持する

### 1.2 Salesforce Contactは「標準項目＋メモ」で完結（v1確定）
> 方針：Salesforce Contactは既存項目の範囲で運用し、CXM固有の属性（役割/意思決定/スタンス/温度など）は **NocoDB側（people_nodes / org_edges / org_chart_versions）をSSOT** とする。  
> Salesforceには「必要最低限の名簿情報」と「同期/参照に必要な識別情報」だけを載せる。Picklist追加は行わない。

#### A. Salesforce Contact（標準項目）で必ず埋めたいもの（推奨）
- 氏名（Name）
- メール（Email）※無い場合はNocoDBで確定→必要時のみSFへ
- 電話（Phone）※任意
- 部署（Department）※任意
- 役職（Title）※任意
- Account紐付け（Account Name / AccountId）※同期時に必須

#### B. CXM固有属性は「メモ（構造化）」に寄せる（Picklist増やさない）
Salesforce側でどうしても参照したい場合は、Contactのメモ欄（例：Description/Notes相当）に以下の形式で格納する。

**推奨：Contactメモ（構造化テンプレ）**
- [CXM]
  - stakeholder_role: 推進者/意思決定者/経営スポンサー/現場責任者/ゲートキーパー/利用者/不明
  - decision_position: 最終承認者/推薦者/実務責任者/門番/利用者/不明
  - stance: 推進/中立/慎重/反対/不明
  - temperature: ポジ/ニュートラル/ネガ/不明
  - budget_influence: あり/一部あり/なし/不明
  - ops_influence: 高/中/低/不明
  - coverage_state: 接触済/特定済/未特定
  - notes: （自由記述）

> 重要：組織図（reports_to 等）は Salesforce 側で作り込まず、まずは NocoDB の org_edges / org_chart_versions を正とする。
> SFへは「必要になったノードだけ同期（昇格）」の運用にする。

### 1.3 判定ルール（属人化防止）
#### 影響度（CXM）の決め方（固定）
- 影響度=高：予算影響「あり」 **または** 運用影響「高」
- 影響度=中：予算影響「一部あり」 **または** 運用影響「中」
- 影響度=低：予算影響「なし」 **かつ** 運用影響「低」
- 影響度=不明：予算影響/運用影響が未確認

#### 温度感とスタンスの違い（固定）
- 温度感：直近の感情（ログ根拠に基づく）
- スタンス：意思決定上の立場（推進/反対/慎重）

---

## 2. Salesforce Task（CXM Action）項目仕様

### 2.1 使い方の方針
- CSM対応顧客のToDo/Activityは、原則Salesforce TaskをSSOTとする
- CXM側（NocoDB）では「提案→編集→Push」の確定ログを保持し、必要に応じてTaskへ同期する
- Taskは **Account（Company）必須**、Project紐付けも原則必須（例外あり：Company戦略タスク）

### 2.2 標準項目の運用固定
- 件名（Subject）【必須】
- ステータス（Status）【必須】
- 優先度（Priority）【必須】
- 期日（ActivityDate / Due Date）【推奨】
- 関連先（WhatId / Related To）【必須：Account】
- 取引先責任者（WhoId / Name）【推奨：Contact】
- 所有者（Owner）【必須】

### 2.3 Salesforce Taskは「既存項目＋メモ」で完結（v1確定）
> 方針：Taskは既存の標準項目で運用する。CXM固有の Target（Risk↓等）や Evidence、関連リンクは **メモ欄に構造化して格納**する。Picklist追加は最小化する。

#### A. 既存項目で使う（確定）
- 件名（Subject）【必須】
- ステータス（Status）【必須】
- 優先度（Priority）【必須】
- 期日（Due Date / ActivityDate）【推奨】
- 関連先（Related To / WhatId）【必須：Account】
- 取引先責任者（Name / WhoId）【任意：Contact】
- 所有者（Owner）【必須】
- 種類（Type）【既存の選択肢で運用】  
  - Meeting / Event / Call / Other（※Email等があるなら既存値の範囲で）
- 行動分類【既存Picklistを利用】  
  - （あなたが追加予定の4ロール）CSM / Support / CRM / GTM
- 行動目的・内容【既存欄で拡張】  
  - “顧客前進の目的” をここに書く（あなたの採用方針）

#### B. CXM固有情報は「メモ（構造化）」に入れる（Picklist増やさない）
Target（Risk↓等）やEvidence、project_id等は Taskメモ欄で保持する。

**推奨：Taskメモ（構造化テンプレ）**
- [CXM]
  - scope: company / project / user
  - company_uid: sf_xxxxx
  - related_project_id: xxxxx（無い場合 null）
  - target: Risk↓ / Opportunity↑ / Health↑ / Phase→ / Coverage↑
  - expected_window: 7d / 14d / 30d（任意）
  - evidence:
    - minutes_id: xxxx（任意）
    - ticket_id: xxxx（任意）
    - urls:
      - https://...
  - next_steps:
    - （箇条書き）
  - result:
    - （実施後に追記）

> これにより「Picklistを増やさず」CXMの運用データをSalesforce Task内でも回収できる。

### 2.4  ### Task件名（Subject）の命名規則（CXM運用の固定）
> 目的：Salesforce上でも「何のための行動か」が一目で分かり、検索・集計できる状態にする。
> 方針：Picklistを増やさず、件名に最小の分類情報を埋め込む。

**推奨フォーマット（固定）**
【CXM】{Role}｜{顧客前進の目的}｜{行動の具体}

例：
- 【CXM】CSM｜決裁ライン合意｜モール化ロードマップMTG設定
- 【CXM】Support｜摩擦除去｜iframeフォームCV計測方法の案内
- 【CXM】CRM｜Engagement促進｜初期活用Tipsの配信（対象：未習慣化）

> RoleはあなたがTaskの「行動分類」に追加する 4ロール（CSM/Support/CRM/GTM）を使用。

---


## 1章、2章の補足

### Salesforce標準項目の「どこにCXMメモを書くか」（v1確定）
> 目的：CXM固有情報（Target / Evidence / scope / related_project_id 等）を、Picklistを増やさずにSalesforce側でも参照できる状態にする。  
> 方針：**Contact/Taskともに「説明（Description）」をCXMメモの格納先SSOTとして固定**する。  
> 例外：既にDescriptionを別用途で使っている場合のみ「メモ（Notes）」等へ寄せるが、その場合も“1フィールドに固定”する。

---

### 1) Contact：CXMメモ格納先
- **格納先（標準）：説明（Description）**
- 書式：先頭に `[CXM]` を付与し、ブロック形式で追記（既存文章があっても共存可能）

**Contact Description 例**
[CXM]
stakeholder_role: 推進者/意思決定者/経営スポンサー/現場責任者/ゲートキーパー/利用者/不明
decision_position: 最終承認者/推薦者/実務責任者/門番/利用者/不明
stance: 推進/中立/慎重/反対/不明
temperature: ポジ/ニュートラル/ネガ/不明
budget_influence: あり/一部あり/なし/不明
ops_influence: 高/中/低/不明
coverage_state: 接触済/特定済/未特定
notes: （自由記述）

---

### 2) Task：CXMメモ格納先
- **格納先（標準）：コメント（Comments）ではなく、説明（Description）に固定**
  - Commentsは履歴が流れやすく、構造化に不向き
- 書式：先頭に `[CXM]` を付与し、キー/値で保持

**Task Description 例**
[CXM]
scope: company / project / user
company_uid: sf_xxxxx
related_project_id: xxxxx（無い場合 null）
target: Risk↓ / Opportunity↑ / Health↑ / Phase→ / Coverage↑
expected_window: 7d / 14d / 30d（任意）
evidence:
  minutes_id: xxxx（任意）
  ticket_id: xxxx（任意）
  urls:
    - https://...
next_steps:
  - （箇条書き）
result:
  - （実施後に追記）

---

### 3) 同期時の上書きルール（事故防止）
- Salesforce Description には人が自由記述する可能性があるため、同期は **「全文上書き」しない**
- 推奨：Description内の `[CXM]` ブロックのみを更新する（他の文章は残す）
  - 実装例：`[CXM]` から次の空行まで、または `[CXM-END]` までを置換
- `[CXM]` ブロックが無い場合のみ、新規に末尾へ追記する

---

### 4) 既存運用でDescriptionが使えない場合（代替）
- Contact：メモ（Notes）相当のフィールドを1つ決めてそこに固定
- Task：Descriptionが不可なら「メモ」系の1フィールドに固定
> 重要：代替を使う場合も、**“必ず1フィールドに固定”**する（分散すると運用が崩れる）


----

## 3. CXM（NocoDB）→ Salesforce マッピング表

### 3.1 People Node（NocoDB）→ Salesforce Contact
| NocoDB（people_nodes） | Salesforce Contact | 備考 |
|---|---|---|
| company_uid | Account（所属） | company_uid→SF Accountのマッピングが必要 |
| display_name | 氏名（Last/First or Name） | 暫定名の場合はNocoDB優先、SF同期は承認後 |
| email | Email | 空でも可（SF必須制約がある場合は同期保留） |
| phone | Phone | 任意 |
| dept_raw | Department（標準） | 表記揺れは許容、カテゴリで吸収 |
| dept_category | 部門カテゴリ（CXM） | Picklist |
| stakeholder_role | ステークホルダー役割（CXM） | Picklist |
| decision_position | 意思決定ポジション（CXM） | Picklist |
| stance | スタンス（CXM） | Picklist |
| budget_influence | 予算影響（CXM） | Picklist |
| ops_influence | 運用影響（CXM） | Picklist |
| influence_level | 影響度（CXM） | 予算×運用から算出（SF側で算式でも可） |
| coverage_state | カバレッジ状態（CXM） | Picklist |
| reports_to_node_id | 上長（CXM） | 参照。同期順序注意（上長が先にSFに存在する必要） |
| last_seen_at | 最終接触日（CXM） | ログから更新可能なら自動 |
| notes | 攻略メモ（CXM） | 機密は別欄で管理推奨 |

#### 上長（CXM）の同期順序（重要）
- reports_to を同期するには、上長側Contactが先にSF上に存在する必要がある
- v1は以下の運用を推奨：
  1) 上位（経営/承認者）から先にSync
  2) その後で部下ノードをSync（reports_toをセット）

---

### 3.2 Action（NocoDB actions）→ Salesforce Task（v1確定：既存項目＋メモ）
| NocoDB（actions） | Salesforce Task | 備考 |
|---|---|---|
| company_uid | Related To（Account） | **必須** |
| related_project_id | Taskメモ（[CXM].related_project_id） | 原則必須（例外：Company戦略） |
| owner_role | 行動分類（Picklist） | CSM / Support / CRM / GTM（あなたが追加予定） |
| action_type | 種類（Type） | Meeting / Event / Call / Other（既存選択肢で寄せる） |
| title | Subject（件名） | 推奨フォーマットは 2.4 を参照 |
| due_at | Due Date | 推奨 |
| priority | Priority | 既存値 |
| status | Status | 既存値 |
| target | Taskメモ（[CXM].target） | **Picklistにしない**（あなたの方針） |
| scope/scope_id | Taskメモ（[CXM].scope / scope_id） |  |
| expected_window | Taskメモ（[CXM].expected_window） |  |
| evidence_refs | Taskメモ（[CXM].evidence） | minutes_id / ticket_id / url 等を集約 |
| related_people（sf_contact_idがある場合） | Name（WhoId / Contact） | 任意。無ければAccountのみで前進 |

#### TaskのRelated To（Account/Project）必須方針（v1）
- Account：常に必須
- related_project_id：
  - scope=project/user：原則必須
  - scope=company：原則入れるが、「Company戦略タスク（PJなし）」は例外で null 可
  - 例外は Taskメモに `related_project_id: null` と明記する

---

## 4. 運用SOP（誰がいつ何をするか）

### 4.1 日次（CSM担当：5〜10分/社）
1) Company Detailで「未処理議事録」を確認
2) AI提案（People/Action）をレビュー
3) 必要な修正をして `Push（NocoDB確定）`
4) 必要なものだけ `Sync（Salesforce）`
   - People：重要ノード（承認者/推進者/門番）を優先
   - Task：今週動くものを優先

### 4.2 週次（CSMチーム：30分）
- Tier上位顧客だけ、Org Chartの穴を埋める
  - Missing：経営スポンサー / 門番 / 意思決定者
- 「影響度=高」かつ「未特定/特定済」の人物が残っていないか確認
- Taskで “確認アクション” を起票し、次の接点で埋める

### 4.3 重要ルール（崩れないために）
- Salesforceへの同期は **Push後のみ**
- Taskは **根拠リンク（CXM）を空欄にしない**
- 影響度は「予算影響×運用影響」から決める（主観禁止）
- 組織図のreports_toは、上長側から先に同期する

---

## 5. テンプレ（すぐ運用できるTask例）
### 5.1 組織図更新（決裁ライン確認）
- 件名：`[Coverage] 接触強化 / 決裁ライン（承認者・門番・推進者）の確認`
- 狙い：接触強化
- 根拠リンク：該当minutes URL
- 期待期間：14日

### 5.2 利用急落（Risk）
- 件名：`[R2_UsageDrop_WoW] リスク低減 / 利用急落の状況確認と復帰導線案内`
- 狙い：リスク低減
- 根拠リンク：SignalID + 利用ログ + minutes
- 期待期間：7日

### 5.3 横展開（Opportunity）
- 件名：`[O2_ProjectIncrease] 機会獲得 / 横展開の合意形成MTG設定`
- 狙い：機会獲得
- 根拠リンク：minutes + Org Chart（承認者/推進者）
- 期待期間：30日