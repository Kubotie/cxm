# 14 Project / User Workflow v1（A-Phase起点：Project→User→Insight→Action→Send）
（Project単位・User単位の運用設計／CRM・GTM・Supportも回る）

---

## 0. 目的
本ドキュメントは、CXM v1 において **Project単位**・**User単位**で

- A-Phase（プロジェクトフェーズ）を前提に、
- 利用状況（project_info / user_info）と関係（user_project_relation）から
- Risk / Opportunity を判断し、
- AI提案（Action / Content / Sent）を作り、
- Intercom（製品内）/ Email（必要なら）で **プロジェクトに紐づくユーザーへコミュニケーション**する

までの **UI導線・データ参照・運用ルール**を固定する。

> 前提：A-Phase / M-Phase は **既存で別計算済み**。CXMでは計算しない。  
> CXMは「参照して提案・記録に使う」だけ。

---

## 1. 役割分担（CSM中心からの拡張）
### 1.1 CSM と 非CSM の違い（運用上の要点）
- **CSM**
  - 会社（M-Phase） + 会社/Projectアラートで動く
  - People/Org（組織図）を更新し、意思決定者攻略・合意形成へ
- **非CSM（Support / CRM / GTM）**
  - **Project（A-Phase）起点**で動く（会社が紐づかないケースを許容）
  - コミュニケーション対象は **Projectに紐づくUser**
  - “会社が後から判明する” 前提で、まず前進（プロダクト活用 / 問い合わせ解決 / ナーチャリング）

---

## 2. データ参照（v1の最低限）
### 2.1 参照するNocoDBテーブル（既存）
- `project_info`（Projectの利用状況・フェーズ文脈）
  - 例：healthy_score / l30_active / running_campaign_with_goal_count / l7_event_count / paid_type / habituation_status など
- `User-project_relation`（Project⇄Userの所属）
  - Account Email, Project ID, 権限（ANALYZER/ADMINなど）
- `User_info`（Userの属性・利用状況・Salesforce/Company情報の補助）
  - Account Email / Account Status / Last Active Date / Project Count / Salesforce Contact ID / Salesforce Company ID など

> **コミュニケーション対象Userの特定**：  
> `User-project_relation.Project ID` → `Account Email` を列挙 → `User_info` を引いて「ユーザー状態」を理解する。

### 2.2 “会社が無い”ケースの扱い（重要）
- ProjectやUserに **master_company_sf_id / Salesforce Company ID が空**でも運用を止めない
- v1は以下の優先順で “Scopeの確からしさ” を扱う
  1) project がある（project_idがある） → Project起点で前進
  2) user はある（emailがある） → User起点で前進
  3) company は後から付与（判明したら actions.scope=company に “移管” しても良いが、既存ログは残す）

---

## 3. UI（新規）：Project Console / User Console
### 3.1 Project Console（一覧：Project Home）
**表示単位**：Projectカード

**Projectカードに出す（最低限）**
- Project名（project_name / domain）
- A-Phase（既存計算結果を参照：CXMでは計算しない）
- Healthy Score（healthy_score）
- 利用指標の要点（l30_active / running_campaign_with_goal_count / l7_event_count）
- 習慣化（habituation_status ※Engagementの文脈）
- Risk / Opportunity バッジ（下記4章のルールで判定した結果）

**CTA**
- `プロジェクト詳細へ`
- `AI提案を生成（Project）`（＝4章の提案生成へ）

---

### 3.2 Project Detail（Project単位：中核画面）
Project Detailは 3レーン構成。

1) **Project Health & Alerts**
2) **Users on Project（所属ユーザー）**
3) **Actions / Content / Sent（実行と送信）**

---

### 3.3 User Console（一覧：User Home）
**表示単位**：Userカード（Account Email）

**Userカードに出す（最低限）**
- Email / Account Name
- Last Active Date / L7-L30 Active（user_info由来）
- 所属Project数（Project Count）
- SF Contact/Lead の有無（あればリンク、無ければ空でOK）
- Risk / Opportunity（User視点：利用停滞・未活用など）

**CTA**
- `ユーザー詳細へ`
- `AI提案を生成（User）`

---

### 3.4 User Detail（User単位）
**構成（最低限）**
- プロフィール：Email / 会社名（あれば）/ Role / Signup Source
- 利用状況：Last Active / L7-L30 Active / 初回作成系の履歴（あれば）
- 所属Project一覧（User-project_relation）
- Sent履歴（actions.action_type=sent, scope=user or project）
- 推奨アクション（AI Proposal → Draft → Push）

---

## 4. Risk / Opportunity 判定（v1最小ルール）
> ここは “実運用でブレない” ことが最優先。  
> 数値の閾値は後で変えて良いので、まずルールの枠だけ固定する。

### 4.1 Project Risk（例：v1）
- **Risk: 高**
  - healthy_score が低い（例：<4） *または*
  - l30_active が低い（例：<5）かつ paid_type=PAID
- **Risk: 中**
  - healthy_score が中程度（例：4〜6）かつ habituation_status=False
- **Risk: 低**
  - healthy_score が高い（例：>=7）かつ l30_active が一定以上

### 4.2 Project Opportunity（例：v1）
- **Opportunity: 有**
  - paid_type=PAID かつ
  - running_campaign_with_goal_count が増加傾向 / depth_score が上がりそう
- **Opportunity: 有（拡張候補）**
  - habitutation_status=True で Engagement文脈が強い（高度活用・拡張の入口）

> ※実装上は `signals_snapshot`（02_Signal_Taxonomy）と繋ぐが、v1は “UIバッジ” と “提案生成のトリガー” が作れればOK。

---

## 5. 主要フロー：Project/User → Insight → Action → Send
### 5.1 状態遷移（Action）
- Action：`proposed → confirmed(pushed) → (optional)synced → executed → impact`

### 5.2 Step 1：AI提案生成（Project起点）
Project Detail の `AI提案を生成（Project）` を押下すると、以下を生成。

生成物：
- Action提案（todo/meeting/sent/content）
- Content提案（メール文面 / In-product / ヘルプ / 1枚資料 など）
- 推奨送信先（project所属ユーザーの候補リスト）
- Evidence（project_infoの数値、必要ならログリンク）

### 5.3 Step 2：提案レビュー（人が編集）
UIで必ず編集できるようにする（特に送信系）。

- 送信対象（User選択）
- 送信チャネル（intercom / email）
- 本文（編集）
- Evidence（最低1つ）
- 期待期間（7d/14d/30d）

### 5.4 Step 3：Push（NocoDB確定）
- `actions` に confirmed 保存（scope=project 推奨）
- `content_jobs` も保存（message生成の場合も content_jobs を必ず作る）
- actor（担当者）は internal_users に正規化（11のactor運用に従う）

### 5.5 Step 4：Send（Intercom / Email）
- `actions.action_type = sent` で必ず記録（送信ログを漏らさない）
- destination_id / destination_meta_json / result_metrics_json を更新
  - destination_id は channelによる（Intercomは delivery/job id、Emailは宛先メール等）

---

## 6. Intercom送信の“宛先解決”（Project/User単位）
### 6.1 v1でまずやる単位
- user 単位：Account Email が特定できる
- project 単位：User-project_relation から Account Email を列挙できる

### 6.2 解決ロジック（v1最小）
**入力**
- audience_scope = `user` or `project`
- audience_id = `Account Email`（user） / `project_id`（project）

**解決**
- user：
  - `Account Email` をキーに Intercom側ユーザーを検索（email一致）
- project：
  - `User-project_relation` で Account Email を列挙
  - それぞれを Intercomで email検索して recipient集合を作る

**送信前に必ずUI表示（誤配信防止）**
- resolved_recipients_count（解決できた人数）
- unresolved_emails（Intercomに見つからないEmail）
- 送信本文（最終版）
- Evidence（最低1つ）

---

## 7. log_intercom の message_type と Owner Role（運用ルール）
あなたの運用定義を v1の “Owner判定” に反映する。

### 7.1 message_type の意味（確定）
- `support`：製品内チャットの問い合わせ（Support領域）
- `inquiry`：Webフォーム問い合わせ（Support + CRM領域、project/company無しが多い）
- `mail`：CSMが主に対応するメールツールのやりとり（CSM領域）

### 7.2 owner_role_hint の付与ルール（v1）
- message_type = `support`
  - owner_role_hint = `Support`
  - scope_hint = `project`（無ければ unknown）
- message_type = `mail`
  - owner_role_hint = `CSM`
  - scope_hint = `company`（無ければ project/unknown）
- message_type = `inquiry`
  - owner_role_hint = `Support`（secondary = `CRM`）
  - scope_hint = `user`（無ければ unknown）

> これらは **log_intercom 側の補助列（owner_role_hint / scope_hint）**として保持してOK。  
> Action提案時の “初期の担当ロール推定” に使う。

---

## 8. 既存ドキュメントとの関係（どこに置くか）
- 04_UI_Blueprint_CSM_Workflow.md  
  - CSM Consoleの運用として維持（会社・議事録・People/Org中心）
- 本ドキュメント（14）  
  - **Project/User起点の運用を補完**（非CSMも回る）

推奨リンク追記（任意）：
- 04の冒頭「Scope（Company/Project/User）」の節に、
  - `Project/User起点は 14_Project_User_Workflow_v1.md を参照` を1行追加

---

## 9. v1の完了条件（Project/User運用）
- Project一覧で Risk / Opportunity が見える
- Project→所属Userが列挙できる
- AI提案から Action / Content が作れ、Pushで確定できる
- Intercom送信（user/project単位）で、送信前に人数/未解決を確認できる
- sent が actions として必ず残る（漏れない）
- actor が internal_users に正規化され、担当者別のログ/実績が追える

---