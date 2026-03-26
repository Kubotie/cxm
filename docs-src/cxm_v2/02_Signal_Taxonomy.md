# 02 Signal Taxonomy（CXM v1）
（AIなし版 Signal定義 + Alert Card共通カラム + Phase参照（read-only）+ CSM/非CSMの動き方）

---

## 0. 目的
本ドキュメントは、CXM v1における Signal（Health / Risk / Opportunity）を
**AIなしでも検知できる最小セット**として定義し、さらに

- **CSM Console（Company中心）**
- **Inbox（Project/User中心：Company未確定でも成立）**

の両方で、**同じSignalが同じ表示カラム（Alert Card）**で扱えるように
UI/Backend/AI提案（07）を接続する。

---

## 1. 用語・前提

### 1.1 Category（3種）
- Health：健全性（維持/定着/運用が回っている）
- Risk：解約/停滞/摩擦/信頼毀損の兆候
- Opportunity：拡張/成果/価値理解の兆候

### 1.2 Scope（3単位）
- company（Company）＝ `company_uid`
- project（Project）＝ `project_id`
- user（User）＝ `user_id`（無い場合は email をキーとしてもよい：Inbox起点）

> Signalは必ず scope/scope_id を持つ（UI表示の誤り防止）

### 1.3 Phase（参照専用：CXMでは計算しない）
Phaseはすでに別系で算出済みであり、CXMは **Phaseを計算しない**。  
CXMでは Phaseを以下の用途に限定して参照する：
- 表示（ヘッダー・フィルタ・サマリー）
- 推奨行動（AI提案/非AI提案）の分岐
- KPI/レビューでのセグメント（Phase別に何が起きたか）

#### 1.3.1 Phaseの単位（CXMで扱う3種）
- **M-Phase（Company）**：Companyに紐づくフェーズ（1〜10）
- **A-Phase（Project）**：Projectに紐づくフェーズ（原則 3〜6が中心。将来拡張）
- **User Stage（User/Email）**：メール段階でも動くための軽い状態（例：New/Activated/Engaged/Stalled）
  - ※「Engagement」という語は Phase 6.Engagement と混同するため、User側は **User Stage** と呼ぶ

#### 1.3.2 Phase 6.Engagement と「習慣化率」
- `習慣化率（Yes/No）` は **Phase 6.Engagement の判定に利用される重要指標**である
- CXMは計算しないが、外部集計済みの以下を参照できる前提で設計する：
  - `habituation_yes_count_60d`（直近60日で習慣化率=Yes の回数）
  - `habituation_flag_latest`（直近スナップショット：Yes/No）
- Phase 6.Engagement の根拠が見えるように、Signal/AlertのEvidenceにも接続する（後述）

---

## 2. Alert Card Schema（共通カラム：UI/Backendで固定）
CXMでは「Signal定義」そのものとは別に、UIが表示する **Alert（通知/行動の入口）** を生成する。
Alertは **CSM Console / Inbox で共通のカラム**を持つ。

### 2.1 Alert Card（共通：必須カラム）
| カラム | 型 | 必須 | 説明 |
|---|---|---:|---|
| alert_id | string | ✓ | Alert識別子（例：`al_{signal_id}_{scope_id}_{yyyymmdd}`） |
| signal_id | string | ✓ | Signal識別子（例：`R2_Risk_UsageDrop_WoW`） |
| category | enum | ✓ | `Health / Risk / Opportunity` |
| scope | enum | ✓ | `company / project / user` |
| scope_id | string | ✓ | `company_uid / project_id / user_id(or email)` |
| phase_unit | enum | ✓ | `M-Phase / A-Phase / User Stage`（UI上のフェーズ解釈単位） |
| phase_label | string | ✓ | UI表示用：Company=`6.Engagement` / Project=`4.Setup` / User=`User Stage: Engaged` |
| phase_source | string | ✓ | 参照元（例：`notion / bi / nocodb_agg`）※CXMはread-only |
| severity | enum | ✓ | `high / medium / low`（検知ルール由来） |
| trend | enum | ✓ | `up / flat / down / unknown`（直近変化） |
| detected_at | datetime | ✓ | 検知時刻 |
| evidence_refs | array | ✓ | 根拠参照（logs/minutes/ticket/usage等：最低1件） |
| summary | string | ✓ | 1行要約（3秒理解用） |
| primary_layer | enum | ✓ | 推奨介入レイヤー（`CSM/Support/CRM/GTM`） |
| recommended_action_types | array | ✓ | `todo/meeting/sent/ticket/content`（最低1つ） |
| recommended_content_types | array | ✓ | `slide/article/help/template/message`（0可） |
| cooldown_days | int | ✓ | 同一signalの再通知制御 |
| status | enum | ✓ | `open / proposed / confirmed / snoozed / dismissed` |
| status_reason | string | △ | snooze/dismiss理由（必須化推奨） |

### 2.2 Alert Card（推奨：実行に必要な補助カラム）
| カラム | 型 | 必須 | 説明 |
|---|---|---:|---|
| related_company_uid | string | △ | scope=project/user でも判明していれば保持（後追いLink用） |
| related_project_id | string | △ | scope=user の場合に紐づくproject候補 |
| unresolved_count | int | △ | 未解決要素（未解決チケット数など） |
| next_best_action_hint | string | △ | AIなしでも出せる「次の一手」 |

### 2.3 Alert → AI提案（07）への接続（v1）
Alertカードから `AIで提案生成` を押した場合、AI入力には最低限以下を渡す：
- signals_snapshot（このAlertを含む）
- context（既存People/Org/Projects があれば）
- constraints（phase_ssot_policy=readonly 等）

AI出力は `07_AI_Proposal_Schema.md` に従う（People/Org/Action/Content）。  
特に `actions` は **Push（NocoDB確定）** されて初めて “実行の証跡” になる。

---

## 3. Signal Definition Schema（Signal側の定義：v1固定）
各Signalは、以下の項目を持つ（Signal定義から Alert Card を生成する）。

| 項目 | 必須 | 説明 |
|---|---:|---|
| signal_id | ✓ | `R2_Risk_UsageDrop_WoW` 等 |
| category | ✓ | Health/Risk/Opportunity |
| scope | ✓ | company/project/user |
| description | ✓ | 何の兆候か |
| detection_rule | ✓ | どう検知するか |
| threshold | ✓ | しきい値（severity分岐があるなら併記） |
| evidence_source | ✓ | どのデータで根拠を作るか |
| primary_layer | ✓ | 推奨介入レイヤー |
| recommended_action_types | ✓ | todo/sent/meeting/ticket/content |
| recommended_content_types | ✓ | slide/article/help/template/message |
| cooldown_days | ✓ | 再通知の最小間隔 |
| notes | △ | データ不足時の代替/例外 |

---

## 4. Risk（v1：6 + 習慣化）
### R1. Risk_NoLogin_ConsecutiveDays（Project）
- category: Risk
- scope: project
- description: 利用停止の早期兆候
- detection_rule: Last Active Date からの経過日数
- threshold:
  - high: >=14d / medium: >=7d / low: >=3d
- evidence_source: Project（Last Active Date / L7 Active / L14 Active）
- primary_layer: CRM
- recommended_action_types: [sent, todo]
- recommended_content_types: [message, article, template]
- cooldown_days: 7

### R2. Risk_UsageDrop_WoW（Project）
- category: Risk
- scope: project
- description: 直近で利用が急落
- detection_rule: L7 Active / L7 PV などの前週比
- threshold:
  - high: -60% / medium: -40% / low: -20%（調整）
- evidence_source: Project（L7/L14/L30）
- primary_layer: CSM
- recommended_action_types: [todo, sent, meeting]
- recommended_content_types: [template, message, slide]
- cooldown_days: 7

### R3. Risk_UnresolvedTicket_Aging（Project）
- category: Risk
- scope: project
- description: 未解決チケット長期化による体験毀損
- detection_rule: status!=Closed かつ created_at 経過
- threshold:
  - high: >7d / medium: >3d / low: >1d
- evidence_source: CSE tickets
- primary_layer: Support
- recommended_action_types: [ticket, sent, content]
- recommended_content_types: [help, template, message]
- cooldown_days: 3

### R4. Risk_TicketBurst_L7（Company）
- category: Risk
- scope: company
- description: 短期間に問い合わせが増加（摩擦急増）
- detection_rule: 直近7日 ticket件数が平均より急増（調整）
- threshold: 平均比 +X（調整）
- evidence_source: CSE tickets
- primary_layer: Support
- recommended_action_types: [todo, content, sent]
- recommended_content_types: [help, article, message]
- cooldown_days: 7

### R5. Risk_CommunicationSilent（Company）
- category: Risk
- scope: company
- description: 返信が止まり関係性が冷えた兆候
- detection_rule: last_contact_date の古さ（v1最小）／将来はintercom directionで精緻化
- threshold: >72h（調整）
- evidence_source: Company(last_contact_date) + log_intercom（将来拡張）
- primary_layer: CSM
- recommended_action_types: [sent, todo, meeting]
- recommended_content_types: [template, message]
- cooldown_days: 7
- notes: direction/author_typeが無い場合は「最終接触の古さ」で代替

### R6. Risk_PVQuotaNearCeiling（Project）
- category: Risk
- scope: project
- description: PV/イベント上限逼迫による計測停止/施策停止リスク
- detection_rule: 月次PV / PV ceiling（または current PV 比率）
- threshold:
  - high: >80% / medium: >50% / low: >30%
- evidence_source: Project（PV, ceiling）
- primary_layer: CSM
- recommended_action_types: [todo, sent]
- recommended_content_types: [template, message, slide]
- cooldown_days: 14

### R7. Risk_HabituationDrop_60d（Company / Project：どちらで持つかはデータ都合で選択）
- category: Risk
- scope: company（推奨）※Project単位に落とす場合は scope=project
- description: 定着（Phase6）の根拠が崩れ始めている兆候
- detection_rule: habituation_yes_count_60d が 4回を割る、または 4回→3回に低下
- threshold:
  - high: <=2 / medium: 3 / low: 4だが減少傾向（調整）
- evidence_source: Company/Project（habituation_yes_count_60d, habituation_flag_latest）
- primary_layer: CRM（CSM顧客はCSM連動）
- recommended_action_types: [sent, todo]
- recommended_content_types: [message, article, template]
- cooldown_days: 14
- notes: CXMは計算しない。外部集計値を参照する。

---

## 5. Opportunity（v1：4）
### O1. Opp_ProjectIncrease_Company（Company）
- category: Opportunity
- scope: company
- description: プロジェクト数/部署数が増え横展開の芽
- detection_rule: active_project などの増分
- threshold: 増分>0
- evidence_source: Company
- primary_layer: CSM
- recommended_action_types: [meeting, content, todo]
- recommended_content_types: [slide, template]
- cooldown_days: 30

### O2. Opp_UsageExpansion_BreadthUp（Company）
- category: Opportunity
- scope: company
- description: 利用の広がり（Breadth）が上昇
- detection_rule: breadth_score 上昇
- threshold: WoW +X（調整）
- evidence_source: Company
- primary_layer: CSM
- recommended_action_types: [sent, todo, meeting]
- recommended_content_types: [slide, message]
- cooldown_days: 14

### O3. Opp_HealthyScoreUp（Project）
- category: Opportunity
- scope: project
- description: 健全性上昇＝成功パターン化の芽
- detection_rule: Healthy Score 上昇
- threshold: WoW +X（調整）
- evidence_source: Project
- primary_layer: CRM
- recommended_action_types: [content, sent]
- recommended_content_types: [article, template, message]
- cooldown_days: 14

### O4. Opp_FeatureReady_NotUsed（Project）
- category: Opportunity
- scope: project
- description: 前提は揃っているのに未利用の機能がある
- detection_rule: 設定数成立 + 特定機能利用ゼロ（調整）
- threshold: 条件一致で通知
- evidence_source: Project（set count / progress / active）
- primary_layer: GTM
- recommended_action_types: [sent, content, todo]
- recommended_content_types: [article, tip, message]
- cooldown_days: 14

---

## 6. Health（v1：5 + 習慣化）
> Healthは「維持できている」だけでなく、v1では “変化” をアラート化する（上がった/落ちた/停滞）。

### H1. Health_HighHabituation_60d（Company / Project）
- category: Health
- scope: company（推奨）
- description: 習慣化が維持され Phase6 を支える（定着運用の根拠）
- detection_rule: habituation_yes_count_60d >= 4
- threshold: high: >=6 / medium: 4-5（調整）
- evidence_source: Company/Project（habituation_yes_count_60d）
- primary_layer: CRM
- recommended_action_types: [sent, content]
- recommended_content_types: [tip, article, message]
- cooldown_days: 30

### H2. Health_FirstGuideProgress_Complete（Project）
- category: Health
- scope: project
- description: 初回ガイドが進みオンボが前進
- detection_rule: First Guide Progress
- threshold: >=80%（調整）
- evidence_source: Project
- primary_layer: CRM
- recommended_action_types: [sent]
- recommended_content_types: [message, tip]
- cooldown_days: 14

### H3. Health_DepthScoreUp（Company）
- category: Health
- scope: company
- description: 深さ（Depth）が上がり使い込みが進む
- detection_rule: depth_score 上昇
- threshold: WoW +X（調整）
- evidence_source: Company
- primary_layer: CSM
- recommended_action_types: [content, sent]
- recommended_content_types: [slide, message]
- cooldown_days: 14

### H4. Health_ActiveUsersUp_L14（Company）
- category: Health
- scope: company
- description: アクティブ比率が上がり定着が進む
- detection_rule: l14_active_user_rate 上昇
- threshold: WoW +X（調整）
- evidence_source: Company
- primary_layer: CRM
- recommended_action_types: [sent]
- recommended_content_types: [message, article]
- cooldown_days: 14

### H5. Health_StableNoRiskAlerts_30d（Project）
- category: Health
- scope: project
- description: Risk系Alertが一定期間発火していない（安定）
- detection_rule: Risk系Alert非発火期間
- threshold: >=30d（調整）
- evidence_source: Alerts（内部）
- primary_layer: CRM
- recommended_action_types: [sent]
- recommended_content_types: [tip]
- cooldown_days: 30

---

## 7. Alert生成・表示の実装ルール（v1：UI共通化の本体）
### 7.1 Signal → Alert生成
- Signalがしきい値を満たしたら Alertを生成する（cooldownを尊重）
- Alertは必ず「2. Alert Card Schema」の共通カラムを持つ
- phase_label / phase_unit / phase_source は **外部算出結果を参照して埋める**（CXMで計算しない）

### 7.2 表示先（共通）
- **CSM Console**
  - Companyカード上のバッジ（Risk/Opportunity/未処理）
  - Company Detail 内の Alerts Queue（company/project scope）
- **Inbox（Project/User）**
  - Project Queue / User Queue
  - Context内のOpen Alerts（上位5）

### 7.3 CSM/非CSMの動き方（UIの違いは “入口” だけ）
- CSM：Company中心。M-Phase（参照）と company/project Alerts から Action確定へ
- 非CSM：Project/User中心。A-Phase（参照）/User Stage（参照）と Alerts から Action確定へ
  - Companyは後追いLink（別フロー）で吸収

### 7.4 Alert → Action（漏れ防止）
- Alertは「通知で終わらせない」
- `AIで提案生成` もしくは `即Action作成` のどちらかを必ず持つ
- 生成されたActionは Push（NocoDB確定）して初めて “運用の証跡” になる

---

## 8. v1.1以降の拡張（AI）
- Confusion/Trust/Expectation/Expansion Intent等の体験ラベルは、
  ログ分類→AI抽出→Signal化の順で拡張する
- AIは根拠リンクを提示し、Actionで使うコンテンツ（記事/資料/ヘルプ/テンプレ/メッセージ）をドラフト生成する

---