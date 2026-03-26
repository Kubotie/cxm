# UI Blueprint — CXM Workflows v1（CSM Console + Project/User Inbox）
（Minutes起点 / Signal起点 / 非CSM起点 を同じOSとして回すためのUI仕様）

---

## 0. 目的
本ドキュメントは、CXMにおけるUIを「見るための画面」ではなく、
**顧客前進（観測→理解→判断→介入→学習）を回すための運用OS**として成立させるために、
主要ワークフローを **レーン/CTA/状態遷移**まで固定する。

CXM v1では、以下3つの入口が共存する：
- **Minutes起点（CSM Console）**：議事録から People/Org/Action/Content を確定し、必要に応じて Salesforceへ昇格
- **Signal/Score起点（CSM Console）**：Health/Risk/Opportunity の変化から即介入を起こす
- **Project/User起点（Inbox）**：Company未確定でも Support/CRM/GTM が A-Phase/User Stage/メール単位で動ける

---

## 1. 前提（SSOT / 二段階コミット）
### 1.1 二段階コミット（誤同期防止）
- **Push（NocoDB確定）**：CXMとしての「決定の証跡（confirmed）」を保存
- **Sync（Salesforce昇格）**：Salesforce Contact/Task へ同期（必要時のみ）
- 原則：**Push → Sync**（Push済みデータのみSync対象）

### 1.2 Scope（単位）
- Company / Project / User の3単位を必ず明示（表示・集計・介入の誤りを防ぐ）

### 1.3 Phase（参照専用：CXMでは計算しない）
- Phase（M-Phase/A-Phase/Phase6の習慣化判定）は外部算出がSSOTであり、CXMは **参照専用（read-only）** とする。
- CXMは Phaseを **表示・フィルタ・推奨行動の分岐**にのみ使う。

---

## 2. 画面構成（v1）
### 2.1 Global Navigation（v1）
- CSM Console（CSM中心）
- Inbox（Project/User：非CSM中心）
- Knowledge / Templates
- Settings / Governance

### 2.2 CSM Console（CSM中心）
- 入口：CSM Home（Company Cards）
- 詳細：Company Detail（CSM版）

### 2.3 Inbox（非CSM中心）
- 入口：Project Queue / User Queue / Unlinked Queue
- 詳細：Project Context / User Context（Company未確定でも成立）

---

## 3. CSM Console（CSM中心）
### 3.1 入口（CSM Home）
- 担当顧客一覧（Company Cards）
- 主要バッジ：
  - `未処理Minutes：N件`
  - `Risk：高/中/低`
  - `Opportunity：高/中/低`
  - `未完了Action：N件`

→ Company Detail（CSM版）へ遷移


### 3.1.3 Intercomログのmessage_typeによる担当レイヤー振り分け（v1必須）
log_intercom には message_type が存在し、CXMでは以下の意味で運用する。

- message_type = `support`：
  - 製品内チャット起点（いわゆる in-product support）
  - 一次担当：Support
  - CSM Consoleでは「参照はできるが、原則はSupportキューで処理する」

- message_type = `mail`：
  - CSMが主に対応しているメールツール由来のやりとり（Intercomに集約されたmailログ）
  - 一次担当：CSM
  - CSM Consoleの「未処理Evidence」として最優先で上げる（提案生成の起点になりやすい）

- message_type = `inquiry`：
  - Webサイトフォーム起点の問い合わせ
  - company/project未紐付けが多い前提（後からcompanyに紐付く）
  - 一次担当：Support（即応/摩擦除去）＋CRM（後追い育成/ナレッジ化）
  - CSM Consoleには「Company未解決のEvidence」として“参考”表示し、会社が紐付いたタイミングでCSMにも浮上可能にする

UI要件（Evidence Inboxのタブ/フィルタ）
- タブを次の3つに分割する：
  1) CSM（mail + minutes）
  2) Support（support + inquiry）
  3) CRM（inquiry）
- company_uid 未解決のinquiryは「Unlinked Queue」に入り、会社が判明したら該当Companyへ自動移動する

提案生成（AI）の起点
- CSM提案生成：mail と minutes を優先Evidenceとして使用
- Support提案生成：support と inquiry を優先Evidenceとして使用
- CRM提案生成：inquiry を優先Evidenceとして使用（project/company未解決でも提案は成立させる）


### 3.2 Company Detail（CSM版）のレーン構成（3レーン）
1) **Evidence Inbox（Minutes/ログ）**
2) **Org/People（組織図・人物管理）**
3) **Action/Content（行動とコンテンツ）**

※Signal/Score起点（Flow③）は Company Detail 内に「Alerts Queue」として表示され、Action/Content に統合される（別画面を増やさない）。

---

# Flow①：Minutes起点（CSM）→ People/Org → Push → Sync（Contact）
## 4. Flow①：Minutes → People提案 → Org Chart固定化 → Sync（Salesforce Contact）
### 4.1 状態遷移（People/Org）
- Minutes：`unprocessed → proposed → confirmed（pushed） → synced（optional）`
- People Node：`proposed → confirmed（pushed） → synced（optional）`
- Org Chart：`draft（preview） → confirmed（versioned）`

> UI表示の状態バッジ（日本語）は「10. UIテキスト（ボタン/状態名）」に準拠する。  
> 内部状態（英語）とUI表示（日本語）を分けて運用する。

### 4.2 Step 1：AIで抽出（提案生成）
Minutesカードの `AIで抽出（提案生成）` で生成：
- People候補（proposals）
- 関係（v1は reports_to 優先）
- Missing roles
- Evidenceリンク（Minutes該当段落）

### 4.3 Step 2：提案レビュー（People/Org Review）
左：People候補（編集）
右：Org Chart Preview（暫定）
- CTA：
  - `Push（NocoDBへ確定）`
  - `Sync（Salesforce Contact）`（Push後に有効化）

### 4.4 Step 3：Push（NocoDBへ確定）
- people_nodes を confirmed で保存
- org_chart_versions を versioned で保存
- pushed_by / pushed_at を監査ログに保存

### 4.5 Step 4：Sync（Salesforce Contact）
- Push済みノードのみ同期可能
- 差分プレビュー → 同期実行
- 成功：sf_contact_id を保存

---

# Flow②：Minutes起点（CSM）→ Action → Push → Sync（Task）→ Content
## 5. Flow②：Minutes → Action提案 → Push → Sync（Salesforce Task）→ Content生成
### 5.1 状態遷移（Action / Content）
- Action：`proposed → confirmed（pushed） → synced（optional） → executed → impact`
- Content：`draft → generated → edited → published`（自動公開しない）

> UI表示の状態バッジ（日本語）は「10. UIテキスト（ボタン/状態名）」に準拠する。  
> 内部状態（英語）とUI表示（日本語）を分けて運用する。

### 5.2 Step 1：AIでAction提案を生成
生成物（Action）
- target（Risk↓ / Opportunity↑ / Health↑ / Phase→ / Coverage↑）
- owner_role（CSM / Support / CRM / GTM）
- due_at（推奨）
- evidence_refs（Signal/Minutes/Logs/Tickets）
- 推奨content_type（slide/article/help/template/message）

### 5.3 Step 2：Actionレビュー（編集）
Actionカード必須項目：
- title / target / owner / due_at / evidence_refs
- CTA：
  - `Push（NocoDBへ確定）`
  - `Sync（Salesforce Task）`（Push後に有効化）
  - `コンテンツ作成`

### 5.4 Step 3：Push（NocoDBへ確定）
- actions に confirmed で保存
- pushed_by / pushed_at を保存
- evidence_refs は必須

### 5.5 Step 4：Sync（Salesforce Task）
- Push済みActionのみ同期可能
- Contact未同期でも Account紐付けで先に作成可

---

# Flow③：Signal/Score起点（CSM）→ AI提案 → Action（Push→任意Sync）
## 6. Flow③：Signal/Score（Health/Risk/Opportunity）→ AI提案 → Action確定
### 6.1 入口（CSM Home / Company Detail）
- CSM Home：Company Card の Risk/Opportunity バッジから遷移
- Company Detail：右側（または上部）に **Alerts Queue** を常時表示（未処理Signal）

### 6.2 Alerts Queue（未処理Signal一覧：Company/Project）
**CSMは以下2種類のAlertで動ける：**
- Company Alert（Company Scope）
- Project Alert（Company配下Project Scope）

Alertカード必須表示（02に準拠）：
- signal_id / category（Health/Risk/Opportunity）
- scope（company/project） + scope_id
- **phase_unit（M-Phase）/ phase_label（例：6.Engagement）/ phase_source（参照元）を必ず表示（CXMは計算しない）**
- severity（high/medium/low）
- evidence_refs（最低1）
- primary_layer（推奨介入レイヤー）
- recommended_action_types（todo/sent/meeting/ticket/content）
- recommended_content_types（slide/help/message等：0可）
- status（内部）：`open / proposed / confirmed / synced / snoozed / dismissed`
  - `dismissed` は理由必須（誤検知/不要の学習）

補助表示（推奨）：
- summary（1行要約：3秒理解）
  - **summaryは phase_label と矛盾しない（例：6.Engagementなら「定着運用の維持/低下」に寄せる）**
- next_best_action_hint（AIなしでも出せる場合）

> UI表示名（日本語）は「10.2 推奨状態バッジ」に準拠する（例：open＝未処理、proposed＝提案あり、confirmed＝確定済）。

### 6.3 CTA：`AIで提案生成`
Alertカードから `AIで提案生成` を押すと、AIは以下を入力に提案を返す：
- signals_snapshot（対象Signal）
- context（既存People/Org/Projects）
- constraints（phase_ssot_policy=readonly 等）

AI出力：
- actions（最大12）
- content_jobs（必要に応じて）
- missing_fields / warnings

### 6.4 Review → Push（確定）
- 提案カードを編集 → `Push（NocoDBへ確定）`
- 以降、必要なら `Sync（Salesforce Task）` が有効化

### 6.5 スコアの扱い（v1）
- Health/Risk/Opportunity “スコア”は **優先順位付け**に使用
- 実行は必ず **Signal（Evidence付き）** に落として Action を確定する（説明可能性の担保）

---

# Flow④：Project/User起点（非CSM）→ Alert起点 → AI提案 → Action → Push（→後追いCompany紐付け）
## 7. Flow④：Inbox（Project/User）→ Alert → AI提案 → Send/Ticket/Todo → Push → Link Company
### 7.1 目的
Support/CRM/GTMは、Companyが未確定でも顧客前進を止めずに動ける必要がある。
このフローは以下を成立させる：
- Company未確定でも **Project（A-Phase）/ User（User Stage）** 単位で介入できる
- Alert起点で AI提案→実行→記録（Push）まで迷わず到達できる
- 後からCompanyが判明したら、記録済みのAction/Logsを Company に吸収できる（Link Company）

### 7.2 Inbox画面（3ペイン）
- 左：Queue
- 中：Context
- 右：Actions（AI提案→実行決定）

### 7.3 左ペイン：Queue（v1）
#### 7.3.1 Project Queue（A-Phase / Alerts）
- project_name / project_id
- **A-Phase（参照）：phase_label（例：4.Setup）**
- Open Alerts（Risk / Opportunity / Health）
- 優先度（severity最大 + recency）

#### 7.3.2 User Queue（User Stage / Alerts）
- email（user_idがあれば併記）
- **User Stage（参照）：New/Activated/Engaged/Stalled 等**
- Open Alerts（Risk / Opportunity / Health）
- 最終接触（open/click/reply 等）

#### 7.3.3 Unlinked Queue（company_uid=null）
- Company未確定のProject/Userを集約（通常状態として扱う）
- Link Company導線へ誘導

### 7.4 中ペイン：Context（3秒把握）
#### 7.4.1 Project Context
- **A-Phase（参照）：phase_label（例：4.Setup）/ phase_source**
- Usage summary（L7/L14）
- Open Alerts（上位5）
- Recent evidence（logs/tickets/reactions）
- Company候補（あれば confidence 付き）

#### 7.4.2 User Context
- email / intercom_user_id（あれば）
- **User Stage（参照）：New/Activated/Engaged/Stalled 等（※Phase6と混同防止のためEngagement表記を使わない）**
- Open Alerts（上位5）
- Recent evidence（email反応、問い合わせ、ログ）
- 所属Project候補（分かる場合のみ）

### 7.5 右ペイン：Actions（Alert → AI提案）
#### 7.5.1 Alertカード（Project/User共通：02に準拠）
- signal_id / category（Health/Risk/Opportunity）
- scope（project/user） + scope_id
- phase_unit（A-Phase / User Stage） + phase_label + phase_source（参照専用）
- severity / trend（↑→↓）
- evidence_refs（最低1）
- primary_layer（Support/CRM/GTM/CSM）
- recommended_action_types / content_types

#### 7.5.2 CTA：`AIで提案生成`
入力は Minutes を必須にしない（Alert起点で成立させる）。
- signals_snapshot + context を中心に提案を生成

### 7.6 非CSMの提案カード（最低3種）
#### 7.6.1 Sent（配信）
- channel候補：email / intercom / in_product / slack / chatwork
- ガード：
  - project_id無し：in_product不可 → email推奨
  - intercom_user_id無し：intercom不可 → email推奨
- 送信前に content_job（message）を必ず生成（RAW_MESSAGE含む）

#### 7.6.2 Ticket（Support）
- 既存Ticketがある：追加情報/切り分け/返信案
- 無い：新規起票案（title/steps/expected）

#### 7.6.3 Todo（内部作業）
- “Project登録を促す”
- “Link Company候補を確定する”
- “ヘルプ記事の更新案を作る”
など、送信以外の前進タスク

### 7.7 実行と状態遷移（v1固定）
#### 7.7.1 Action状態（内部）
- proposed → drafted → approved → executed → **confirmed（pushed）** → linked（→ synced optional）

#### 7.7.2 実行ボタン（漏れ防止）
- `送信する`：送信と同時に actions(sent) を生成/更新し、payload_ref を必ず持つ
- `チケット起票`：起票と同時に actions(ticket) を生成/更新
- `ToDo確定`：Owner/Due/Evidenceを持って actions(todo) を確定

### 7.8 Link Company（後追い紐付け）
#### 7.8.1 CTA（常時表示）
Contextに `会社を紐付ける（候補）` を常時表示

#### 7.8.2 候補提示（自動）
- emailドメイン一致
- Salesforce Account候補
- 過去ログの一致
- Projectに紐づく既知Company（あれば）

#### 7.8.3 確定後の挙動
- company_uid確定後、過去のAction/Logs/Alertsは Company Timeline に吸収表示できる
- CSM/CSM Manager に “要レビュー” を通知可能（任意）

### 7.9 Phase参照の分岐（非CSM：推奨行動の性質を揃える）
※CXMは計算しない。`phase_label / phase_unit` を参照して推奨を分岐する。
- `A-Phase 3-4（Active/Setup）`：
  - Project登録・計測/設定完了・初回成功体験を最優先（手順/チェックリスト/短い案内）
- `A-Phase 5（Activation）`：
  - 価値実感の再現（PDCA/運用回数/イベント）に寄せる（次の一手提示）
- `A-Phase 6（Engagement）`：
  - 習慣維持（habituation_yes_count_60d）と運用の型化（教育/権限/役割）に寄せる
- `User Stage（Project未登録/Company未確定）`：
  - 登録・接続・最短の価値提示（email/intercom中心、in_productは不可）

---

## 8. Content生成（共通）
Actionカードの `コンテンツ作成` から作成する：
- slide / article / help / template / message

基本ステップ：
1) Draft生成（AI）
2) 編集（人）
3) 保存（content_jobs）
4) 配信（sent Actionとして記録）

---

## 9. 権限・ガバナンス（要点）
### 9.1 権限（v1の要点）
- Push：CSM + CSM Manager  
  - ※非CSMのPush許可は 08で確定する。v1では原則「CXMに記録が残る」ため、非CSMもPush可能とする設計が望ましいが、運用決定に委ねる。
- Sync（Salesforce）：原則 CSM + CSM Manager（Push済みのみ）

### 9.2 監査ログ（必須）
- Push/Sync/Send は必ず監査ログに残す（誰がいつ何を）
- **外部送信（External Send）の定義（v1）**
  - Email / Intercom / In-product / 顧客共同チャンネル（Slack/Chatwork）を含む
  - 外部送信は必ず `actions(action_type=sent)` を **Push（NocoDB確定）**し、以下を保存する：
    - channel
    - destination_id / destination_meta
    - payload_ref
    - evidence_refs
    - result_metrics（取得可能範囲）

---

## 10. UIテキスト（ボタン/状態名）
### 10.1 推奨ボタン文言
- `AIで抽出（提案生成）`
- `AIで提案生成`
- `レビューして確定（Push）`
- `Push（NocoDBへ確定）`
- `Sync（Salesforce Contact）`
- `Sync（Salesforce Task）`

### 10.2 推奨状態バッジ（UI表示：日本語）
- `未処理`（open / unprocessed）
- `提案あり`（proposed）
- `確定済（NocoDB）`（confirmed/pushed）
- `同期済（Salesforce）`（synced）
- `保留`（snoozed）
- `却下`（dismissed）
- `競合あり`（conflict）
- `同期エラー`（error）

---

## 11. 完了条件（このBlueprintが満たすべきこと）
- Minutes起点：People/Org/Actionが一貫フローで確定できる
- Signal起点：AlertからAI提案→Action確定が迷わず回る
- 非CSM起点：Company未確定でも Project/User 単位で介入しPushまで到達できる
- 後追いでCompany紐付けしても、過去の証拠/介入がCompanyに吸収される