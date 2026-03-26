# Automation Builder ノード設計書

## 概要
Automation Builder は Intercom Series のようなフロー設計UIです。
各ノードをクリックすると右パネル（Sheet）で詳細設定を行えます。
この設計書では、10種類のノードそれぞれの設定項目、UI、validation、AI提案を具体的に定義します。

---

## 共通設計方針

### 共通で見せる項目（全ノード）
- **Node Name** - ノードの名前（編集可能）
- **Node Type** - ノードの種類（表示のみ）
- **Description** - ノードの説明（編集可能、任意）
- **Enabled / Disabled** - ノードの有効/無効切り替え
- **Validation Status** - バリデーション状態（✅ Valid / ⚠️ Warning / ❌ Error）
- **Last Edited** - 最終編集日時
- **Upstream Step** - このノードに入ってくる前のステップ
- **Downstream Step** - このノードから出ていく次のステップ

### 共通CTA（全ノード）
- **保存** - ノード設定を保存（紫色ボタン）
- **キャンセル** - 変更を破棄してSheetを閉じる（outlineボタン）
- **テスト** - このノードをテスト実行（outlineボタン）
- **複製** - ノードを複製（ドロップダウン）
- **削除** - ノードを削除（ドロップダウン、danger）
- **下に追加** - このノードの下に新しいノードを追加（ドロップダウン）
- **Branch を追加** - ブランチを追加（ドロップダウン、必要なノードのみ）

### 設定Sheet UIの構成
```
┌─────────────────────────────────────────┐
│ [← Back]  Trigger Node Settings    [×] │  ← Header
├─────────────────────────────────────────┤
│ 📋 Basic Settings                       │  ← Section 1
│   Node Name: [____________]             │
│   Description: [___________]            │
│   Enabled: [✓]                          │
├─────────────────────────────────────────┤
│ ⚙️ Configuration                        │  ← Section 2（ノード固有設定）
│   [ノード固有の設定項目]                │
├─────────────────────────────────────────┤
│ ✨ AI Suggestion                        │  ← Section 3（AI提案）
│   [AI提案内容]                          │
├─────────────────────────────────────────┤
│ 📊 Preview & Validation                 │  ← Section 4（プレビュー）
│   [プレビュー内容]                      │
├─────────────────────────────────────────┤
│ [キャンセル]  [テスト]  [保存] [▼]    │  ← Footer（CTA）
└─────────────────────────────────────────┘
```

---

## 1. Trigger ノード

### 役割
Automation の開始条件を定義する。フローの最初に必ず配置される。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "Event開始時にトリガー"
- **Description** - 例: "ウェビナー開始1週間前に発動"
- **Enabled / Disabled** - トリガーの有効/無効

#### Configuration
##### 1. Trigger Type（必須）
- **Event Started** - Eventが開始された時
- **Event Ending Soon** - Event終了が近づいた時
- **Audience Matched** - Audienceが条件に合致した時
- **Support Alert Created** - Support Alertが作成された時
- **Risk Alert Created** - Risk Alertが発動した時
- **Opportunity Alert Created** - Opportunity Alertが発動した時
- **CSE Waiting Too Long** - CSEが長時間未対応の時
- **New Inquiry Detected** - 新しい問い合わせが検出された時
- **Product Update Published** - Product Updateが公開された時
- **Manual Start** - 手動で開始
- **Schedule Based** - スケジュールベース
- **Status Changed** - ステータスが変更された時

##### 2. Trigger Source（必須）
- **Event** - Event画面から選択
- **Support** - Support Alertから選択
- **Audience** - Audience画面から選択
- **Company** - Company画面から選択
- **Project** - Project画面から選択
- **Content** - Content画面から選択
- **Product Update** - Product Update画面から選択
- **Manual** - 手動実行

##### 3. Linked Resource（Trigger Sourceによって変わる）
- Trigger Source が "Event" の場合
  - **Select Event** - Eventを選択（ドロップダウン）
  - **Event Status** - どのステータスで発動するか（Upcoming / In Progress / Ended）
  - **Timing Offset** - イベント開始からの時間オフセット（例: -7 days）

- Trigger Source が "Support" の場合
  - **Alert Type** - Alert Rule から選択（Unresolved / Escalation / No Reply）
  - **Priority Filter** - Priority で絞り込み（High / Medium / Low）

- Trigger Source が "Schedule Based" の場合
  - **Schedule Type** - Daily / Weekly / Monthly
  - **Day of Week** - 曜日選択（Weeklyの場合）
  - **Day of Month** - 日付選択（Monthlyの場合）
  - **Time** - 時刻選択（HH:MM）
  - **Timezone** - タイムゾーン選択

##### 4. Advanced Settings
- **Manual Run Allowed** - 手動実行を許可するか（ON/OFF）
- **Debounce Window** - 同一条件での再発動を防ぐ期間（例: 1 hour / 24 hours）
- **Max Runs Per Day** - 1日の最大実行回数（0 = 無制限）

#### AI Suggestion
- **Trigger Suggestion** - 過去の類似Automationから推奨Triggerを提案
  - 例: "類似のEvent系Automationでは 'Event開始7日前' が最も使われています"
  - 例: "このAudienceには 'Weekly Schedule' が推奨されます"

#### Preview & Validation
- **Expected Trigger Count（予測発動回数）**
  - 過去30日のデータから今後の発動回数を予測
  - 例: "過去30日で15回発動。今後30日で約18回発動の見込み"
  
- **Last Matched Example（最近の発動例）**
  - 最近このTriggerが発動したケースを表示
  - 例: "最終発動: 2026-03-16 12:00 - Event: ウェビナー #45"
  
- **Recent Trigger Log（直近ログ）**
  - 直近5回の発動履歴を表示（日時、対象、結果）

#### Validation Rules
- ❌ **Trigger Type が未選択**
- ❌ **Trigger Source が未選択**
- ❌ **Linked Resource が未選択**（必要な場合）
- ⚠️ **Expected Trigger Count が 0**
- ⚠️ **Manual Start のみで Schedule がない**

---

## 2. Condition ノード

### 役割
対象や分岐条件を絞り込む。Triggerの後に配置し、フロー対象を制御する。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "Enterprise tier のみ"
- **Description** - 例: "EnterpriseとPremiumプランのみ対象"
- **Enabled / Disabled**

#### Configuration
##### 1. Condition Type（必須）
- **Simple Condition** - 単一の条件
- **Multiple Conditions** - 複数の条件（AND/OR）
- **Custom Expression** - カスタム条件式

##### 2. Condition Field（必須、複数追加可能）
各Conditionには以下を設定：
- **Field Name** - 条件フィールド
  - Company Tier（企業ティア）
  - Project Phase（プロジェクトフェーズ）
  - Support Volume（サポート件数）
  - Linked Event（関連Event）
  - Linked CSE Ticket（関連CSEチケット）
  - Unresolved Issue（未解決Issue）
  - Recent Inquiry（直近の問い合わせ）
  - Recent Outbound（直近の送信）
  - Owner Team（担当チーム）
  - Audience Size（Audience規模）
  - Region（地域）
  - Language（言語）
  - Risk Level（リスクレベル）
  - Send Policy Eligible（Send Policy適格性）
  - Active Project Count（アクティブなProject数）
  - Last Contact Date（最終接触日）
  - Product Usage（製品利用状況）

- **Operator** - 演算子
  - Equals（等しい）
  - Not Equals（等しくない）
  - Contains（含む）
  - Not Contains（含まない）
  - Greater Than（より大きい）
  - Less Than（より小さい）
  - Greater Than or Equal（以上）
  - Less Than or Equal（以下）
  - Exists（存在する）
  - Not Exists（存在しない）
  - In（いずれかに含まれる）
  - Not In（いずれにも含まれない）
  - Is Empty（空である）
  - Is Not Empty（空でない）

- **Value** - 比較値
  - フィールドに応じた入力形式（テキスト、数値、日付、選択肢など）

##### 3. Multiple Condition Logic（複数条件の場合）
- **Logic Type**
  - **AND** - 全ての条件を満たす
  - **OR** - いずれかの条件を満たす
  - **Custom** - カスタムロジック（例: "(A AND B) OR C"）

##### 4. Scope Settings
- **Scope** - 条件を適用する範囲
  - Current Trigger（現在のTrigger対象のみ）
  - All Companies（全企業）
  - All Projects（全プロジェクト）
  - Current Context（現在のコンテキスト）

##### 5. Fallback Settings
- **Fallback Path Enabled** - 条件不一致時の代替パス（ON/OFF）
- **Fallback Behavior** - 不一致時の動作
  - Stop Run（実行停止）
  - Continue to Default Branch（デフォルトブランチへ）
  - Skip to End（Endへスキップ）
  - Move to Draft（Draftへ）

#### AI Suggestion
- **Condition Suggestion** - 過去の類似Automationから推奨条件を提案
  - 例: "このTriggerでは 'Company Tier = Enterprise' が最も使われています"
  - 例: "Audience Size > 100 の場合、Review Before Send が推奨されます"
  
- **Branch Suggestion** - ブランチ追加の提案
  - 例: "Support Volume が高い場合、別フローへの分岐を推奨します"

#### Preview & Validation
- **Matched Records Preview（合致レコード数）**
  - 現在の条件で何件が合致するかを表示
  - 例: "現在の条件で 142 companies が合致"
  
- **Estimated Audience Count（推定Audience数）**
  - 最終的なAudience規模の推定
  - 例: "推定Audience: 約 280 contacts"
  
- **Recent Example（最近の例）**
  - この条件に最近合致したレコードの例
  - 例: "最近の合致例: ABC Corp, XYZ Inc, DEF Ltd"

#### Validation Rules
- ❌ **Condition Field が未選択**
- ❌ **Operator が未選択**
- ❌ **Value が未入力**（必要な場合）
- ⚠️ **Matched Records が 0**
- ⚠️ **Fallback Path が未設定** （推奨設定）

---

## 3. Audience ノード

### 役割
Audience を作成、更新、または既存Audienceを適用する。送信対象を確定する重要なノード。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "Enterprise ウェビナー参加者"
- **Description** - 例: "ウェビナー登録済みのEnterprise顧客"
- **Enabled / Disabled**

#### Configuration
##### 1. Audience Mode（必須）
- **Use Existing Audience** - 既存のAudienceを使用
- **Create New Audience** - 新しいAudienceを作成
- **Update Existing Audience** - 既存のAudienceを更新
- **Dynamic Audience** - 動的にAudienceを生成（フィルター条件で毎回生成）

##### 2. Audience Settings（Modeによって変わる）

###### Use Existing Audience の場合
- **Select Audience** - Audience画面から既存Audienceを選択（ドロップダウン）
- **Refresh Before Use** - 使用前に再計算するか（ON/OFF）

###### Create New Audience の場合
- **Audience Name** - 新しいAudienceの名前（必須）
- **Description** - 説明
- **Audience Scope** - スコープ
  - Companies（企業単位）
  - Contacts（担当者単位）
  - Projects（プロジェクト単位）
  - Mixed（混合）
  
- **Source** - ソース
  - From Trigger（Triggerから）
  - From Upstream Condition（上流のConditionから）
  - From Custom Filter（カスタムフィルター）
  
- **Filters** - フィルター条件（複数追加可能）
  - Condition ノードと同様のフィールド/演算子/値を設定
  
- **Reusable Flag** - 他のAutomationで再利用可能にするか（ON/OFF）
- **Save as Audience Asset** - Audience画面に保存するか（ON/OFF）
- **Owner** - Audienceの所有者（User選択）

###### Update Existing Audience の場合
- **Select Audience to Update** - 更新対象のAudience選択
- **Update Mode** - 更新方法
  - Add New Records（新規レコード追加）
  - Remove Records（レコード削除）
  - Replace All（全置換）
  - Merge（マージ）

###### Dynamic Audience の場合
- **Filters** - 毎回実行時に適用するフィルター条件
- **Snapshot Mode** - スナップショットを保存するか（ON/OFF）
  - ON: 各Run時のAudienceを保存
  - OFF: 保存しない

##### 3. Advanced Settings
- **Target Preview Count** - 対象件数のプレビュー上限（デフォルト: 100）
- **Exclude Recently Contacted** - 最近接触した対象を除外（ON/OFF）
  - Exclude Period（除外期間）: 例: 7 days / 30 days
- **Deduplicate** - 重複排除（ON/OFF）
  - Deduplicate By（重複排除キー）: Email / Company ID / Contact ID

#### AI Suggestion
- **Audience Suggestion** - 過去の類似Automationから推奨Audienceを提案
  - 例: "このTriggerでは 'Enterprise tier + Active projects' が最も使われています"
  - 例: "最近接触した対象の除外を推奨します（過去7日）"
  
- **Filter Suggestion** - フィルター条件の提案
  - 例: "Risk Level = High の企業を除外することを推奨します"

#### Preview & Validation
- **Audience Preview（Audienceプレビュー）**
  - 最大100件の対象レコードを表示
  - 列: Company Name / Contact Name / Email / Tier / Last Contact
  
- **Target Count（対象件数）**
  - 現在の条件での対象件数
  - 例: "対象件数: 342 contacts (from 156 companies)"
  
- **Related Summary（関連サマリー）**
  - Company Tier分布（Enterprise: 45%, Premium: 30%, Standard: 25%）
  - Region分布（APAC: 60%, NA: 25%, EU: 15%）
  - Risk Level分布（High: 10, Medium: 80, Low: 52）

#### Linked Resource CTA
- **Preview Audience** - Audienceプレビューを大きく表示（モーダル）
- **Open Audience** - Audience画面で開く（既存Audience選択時のみ）
- **Export Preview** - プレビューをCSV出力

#### Validation Rules
- ❌ **Audience Mode が未選択**
- ❌ **Audience が未選択**（Use Existing の場合）
- ❌ **Audience Name が未入力**（Create New の場合）
- ❌ **Filters が未設定**（Create New / Dynamic の場合）
- ⚠️ **Target Count が 0**
- ⚠️ **Target Count > 500**（Send Policy確認推奨）
- ⚠️ **High Risk企業が含まれている**

---

## 4. Content ノード

### 役割
AIでContentを作成、または既存Content/Templateを使用する。送信本文を準備する。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "ウェビナー案内メール生成"
- **Description** - 例: "AIでウェビナー案内メールを生成"
- **Enabled / Disabled**

#### Configuration
##### 1. Content Mode（必須）
- **Create New Content** - 新しいContentを作成
- **Use Existing Content** - 既存のContentを使用
- **Generate from Template** - Templateから生成
- **Generate with AI** - AIで生成

##### 2. Content Type（必須）
- **Message Draft** - メッセージ下書き
- **Proposal Draft** - 提案書下書き
- **FAQ Draft** - FAQ下書き
- **Help Draft** - ヘルプ下書き
- **Onboarding Draft** - オンボーディング下書き
- **Summary Draft** - サマリー下書き
- **Event Invitation** - イベント招待
- **Follow-up Message** - フォローアップメッセージ
- **Custom Draft** - カスタム下書き

##### 3. Content Source Settings（Modeによって変わる）

###### Use Existing Content の場合
- **Select Content** - Content画面から既存Contentを選択（ドロップダウン）
- **Content Version** - バージョン選択（Latest / Specific Version）

###### Generate from Template の場合
- **Select Template** - Library画面からTemplateを選択
- **Template Variables** - Templateの変数を設定
  - 例: {{company_name}}, {{event_name}}, {{date}} など
  - 各変数に対応する値を設定（手動入力 or Context自動挿入）

###### Generate with AI の場合
- **Generation Source** - AIが参照するソース
  - **Linked Event** - Eventを選択（イベント情報を参照）
  - **Linked Support** - Support Alertを選択（サポート履歴を参照）
  - **Linked Alert** - Alertを選択（Alert内容を参照）
  - **Linked Audience** - Audience情報を参照
  - **Custom Context** - カスタムコンテキストを入力
  
- **AI Assistance Mode** - AI使用方式
  - **Kocoro Primary** - Kocoro AI を優先使用
  - **OpenRouter Fallback** - OpenRouter をフォールバック
  - **Kocoro Only** - Kocoro のみ使用（フォールバックなし）
  - **OpenRouter Only** - OpenRouter のみ使用
  
- **Content Tone** - 文体
  - Formal（フォーマル）
  - Friendly（フレンドリー）
  - Professional（プロフェッショナル）
  - Casual（カジュアル）
  - Custom（カスタム）
  
- **Content Length** - 長さ
  - Short（短い: ~100 words）
  - Medium（中程度: ~300 words）
  - Long（長い: ~500 words）
  - Custom（カスタム）
  
- **Language** - 言語
  - Japanese（日本語）
  - English（英語）
  - Auto Detect（自動検出）

###### Create New Content の場合
- **Content Name** - Content名（必須）
- **Subject/Title** - 件名/タイトル
- **Body** - 本文（テキストエリア）
- **Use AI Assist** - AI補助を使用するか（ON/OFF）
  - ON: 上記の "Generate with AI" 設定が追加表示される

##### 4. Output Settings
- **Output Format** - 出力形式
  - Text（テキスト）
  - Markdown（マークダウン）
  - HTML（HTML）
  - PDF（PDF）※ Generate時のみ
  - DOCX（Word文書）※ Generate時のみ
  - Mixed（複数形式）
  
- **File Output Enabled** - ファイル出力を有効化（ON/OFF）
  - Output File Name Template（ファイル名テンプレート）
    - 例: "{{event_name}}_invitation_{{date}}.pdf"

##### 5. Workspace Settings
- **Save as Draft** - 下書きとして保存（ON/OFF）
- **Save to Content Workspace** - Content画面に保存（ON/OFF）
  - Workspace Folder（保存フォルダ）: 選択
  - Reusable（再利用可能）: ON/OFF
- **Owner** - Contentの所有者（User選択）

#### AI Suggestion
- **Content Suggestion** - 過去の類似Contentから推奨を提案
  - 例: "類似のEvent案内では 'Friendly + Medium length' が最も効果的でした"
  
- **Template Suggestion** - 推奨Templateの提案
  - 例: "このEvent typeには 'ウェビナー招待テンプレート v2' が推奨されます"
  
- **Tone & Length Suggestion** - 文体と長さの提案
  - 例: "Enterprise tier には Professional tone が推奨されます"

#### Preview & Validation
- **Preview Output（出力プレビュー）**
  - 生成されたContentのプレビュー表示
  - Subject/Title + Body の最初の200文字
  - 「全文を見る」ボタンで全体表示（モーダル）
  
- **Linked Context Summary（関連コンテキストサマリー）**
  - Linked Event: "ウェビナー #45 - AI活用セミナー"
  - Linked Audience: "342 contacts"
  - Template: "Event Invitation Template v3"
  
- **Expected Deliverable（期待される成果物）**
  - Output Format: "Text + PDF"
  - Estimated Length: "約 320 words"
  - File Size: "約 45 KB"

#### Linked Resource CTA
- **Preview Content** - Contentプレビューを大きく表示（モーダル）
- **Open Content** - Content画面で開く（既存Content選択時のみ）
- **Open Template** - Library画面でTemplateを開く（Template使用時のみ）
- **Regenerate** - AIで再生成（AI生成時のみ）

#### Validation Rules
- ❌ **Content Mode が未選択**
- ❌ **Content Type が未選択**
- ❌ **Content が未選択**（Use Existing の場合）
- ❌ **Template が未選択**（Generate from Template の場合）
- ❌ **Generation Source が未選択**（Generate with AI の場合）
- ❌ **Content Name が未入力**（Create New の場合）
- ⚠️ **AI Assistance Mode が OpenRouter Only**（Kocoro推奨）
- ⚠️ **Preview Output が生成されていない**

---

## 5. Outbound ノード

### 役割
Outboundを起票、Draftを作成、Composeに渡す。送信前の最終準備を行う。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "Compose に送信Draft作成"
- **Description** - 例: "Composeで最終確認後に送信"
- **Enabled / Disabled**

#### Configuration
##### 1. Outbound Mode（必須）
- **Create Outbound Draft** - Outbound Draftを作成（Compose送り）
- **Send to Compose** - Composeに送る（編集可能状態）
- **Review Queue Only** - Review Queueに送る（承認待ち）
- **Direct Handoff** - 次のSend nodeに直接渡す

##### 2. Channel（必須）
- **Email** - メール送信
- **Intercom** - Intercom経由送信
- **Slack** - Slack経由送信（External Send Channelで設定済みの場合）
- **Chatwork** - Chatwork経由送信（External Send Channelで設定済みの場合）

##### 3. Source Settings
- **Audience Source** - Audience取得元
  - From Upstream Audience Node（上流のAudience nodeから）
  - From Trigger（Triggerから）
  - Custom Selection（手動選択）
  
- **Content Source** - Content取得元
  - From Upstream Content Node（上流のContent nodeから）
  - From Library Template（Libraryから）
  - Custom Input（手動入力）

##### 4. Message Settings
###### Subject（Emailの場合のみ）
- **Subject Template** - 件名テンプレート
  - 例: "【{{event_name}}】ご案内"
  - 変数: {{event_name}}, {{company_name}}, {{date}}, etc.

###### Body
- **Body Source** - 本文ソース
  - From Content Node（Content nodeから取得）
  - From Template（Templateから取得）
  - Custom Body（手動入力）
  
- **Body Template** - 本文テンプレート（Custom Bodyの場合）
  - テキストエリアで入力
  - 変数挿入可能

###### Variables
- **Template Variables** - テンプレート変数一覧
  - 各変数の値を設定（手動 or Context自動挿入）
  - 例:
    - {{company_name}} → "ABC Corporation"
    - {{event_name}} → "AI活用セミナー"
    - {{event_date}} → "2026-04-15"

##### 5. Outbound Settings
- **Draft Save** - 下書き保存（ON/OFF）
  - Draft Name Template（下書き名テンプレート）
    - 例: "{{event_name}}_{{date}}_draft"
  
- **Review Queue** - Review Queueに送る（ON/OFF）
  - Reviewer（レビュアー）: User選択
  - Review Deadline（レビュー期限）: 例: 2 days
  
- **Compose Handoff** - Composeに渡す（ON/OFF）
  - Compose Mode（Composeモード）
    - Edit Mode（編集可能）
    - Review Mode（確認のみ）
    - Send Ready（送信準備完了）

##### 6. Advanced Settings
- **Unresolved Placeholder Handling** - 未解決変数の扱い
  - Show Warning（警告表示）
  - Block Send（送信ブロック）
  - Use Default Value（デフォルト値使用）
  - Skip Record（該当レコードをスキップ）
  
- **Attachment Settings** - 添付ファイル設定
  - Attach File from Content Node（Content nodeからファイル添付）: ON/OFF
  - Custom Attachment（カスタム添付）: ファイル選択

#### AI Suggestion
- **Channel Suggestion** - 推奨チャネルの提案
  - 例: "このAudience tierには Email が最も効果的です"
  
- **Template Suggestion** - 推奨Templateの提案
  - 例: "類似のEvent案内では 'Template v3' が最も使われています"
  
- **Variable Value Suggestion** - 変数値の提案
  - 例: "{{event_date}} には 'YYYY-MM-DD' 形式が推奨されます"

#### Preview & Validation
- **Recipient Preview（受信者プレビュー）**
  - 最大20件の受信者を表示
  - 列: Company / Contact / Email / Tier
  - 総件数表示: "Total: 342 recipients"
  
- **Unresolved Preview（未解決変数プレビュー）**
  - 未解決の変数一覧を表示
  - 例: "⚠️ {{event_location}} が 45件で未解決"
  
- **Content Preview（本文プレビュー）**
  - Subject + Body の最初の200文字を表示
  - 「全文を見る」ボタンで全体表示（モーダル）
  - 変数が解決された状態でプレビュー
  
- **Linked Outbound Summary（関連Outboundサマリー）**
  - 既存のOutbound Draft: "3件の下書きが存在"
  - Recent Outbound: "最終送信: 2026-03-10"

#### Linked Resource CTA
- **Preview Recipients** - 受信者プレビューを大きく表示（モーダル）
- **Preview Outbound** - Outbound全体プレビュー（モーダル）
- **Open Outbound** - Outbound画面で開く（Draft作成後）
- **Open Compose** - Composeを開く（Compose Handoff時）
- **Resolve Variables** - 未解決変数を解決（ダイアログ）

#### Validation Rules
- ❌ **Outbound Mode が未選択**
- ❌ **Channel が未選択**
- ❌ **Audience Source が未選択**
- ❌ **Content Source が未選択**
- ❌ **Subject Template が未入力**（Email, Channelの場合）
- ❌ **Body が未入力**
- ⚠️ **Unresolved Variables が存在する**（件数表示）
- ⚠️ **Recipient Count > 500**（Send Policy確認推奨）
- ⚠️ **Review Queue が無効** （推奨設定）

---

## 6. Send ノード（最重要）

### 役割
Automation内で送信実行まで行う。**最も慎重に扱うべきノード**。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "Email自動送信（Policy制御）"
- **Description** - 例: "条件を満たす場合のみ自動送信"
- **Enabled / Disabled**

#### Configuration
##### 1. Send Mode（必須、最重要）
- **Draft Only** - Draftに保存のみ（送信しない）
  - 説明: "Composeに下書きとして保存されます。手動で送信が必要です。"
  - Badge: グレー
  
- **Review Before Send** - Review後に送信
  - 説明: "Review Queueに送られます。承認後に送信されます。"
  - Badge: 青色
  
- **Auto Send** - 自動送信（Policy制御）
  - 説明: "⚠️ 条件を満たす場合、自動的に送信されます。Send Policyにより厳密に制御されます。"
  - Badge: 紫色（警告アイコン付き）

**重要**: Send Mode選択時に警告boxを必ず表示
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Auto Send 制限事項                           │
│                                                 │
│ Auto Send は Settings の Automation Send       │
│ Policies により厳密に制御されます。            │
│                                                 │
│ 以下の条件が適用されます:                       │
│ • 対象件数 > 100: Manager承認必須               │
│ • High Risk企業: Draft Onlyに変更              │
│ • Enterprise tier: Review必須                  │
│ • チャネル別上限: Email=500, Slack=200         │
│                                                 │
│ [Send Policy を確認] ボタン                    │
└─────────────────────────────────────────────────┘
```

##### 2. Channel（必須）
- **Email** - メール送信
- **Intercom** - Intercom経由送信
- **Slack** - Slack経由送信
- **Chatwork** - Chatwork経由送信

##### 3. Target Settings
- **Target Audience** - 送信対象
  - From Upstream Audience Node（上流のAudience nodeから）
  - From Upstream Outbound Node（上流のOutbound nodeから）
  - Custom Selection（手動選択）
  
- **Content Source** - 本文ソース
  - From Upstream Content Node（上流のContent nodeから）
  - From Upstream Outbound Node（上流のOutbound nodeから）
  - From Template（Templateから）

##### 4. Send Policy Settings（最重要）
**Send Policy Eligibility Check（送信可否チェック）**
```
┌─────────────────────────────────────────────────┐
│ 📋 Send Policy Status                          │
│                                                 │
│ ✅ この Automation は Auto Send が許可されています │
│                                                 │
│ 現在の条件:                                     │
│ • チャネル: Email（最大500件）                  │
│ • 現在の対象件数: 約342件                       │
│ • Risk Level: Medium（自動送信可）              │
│ • Tier: Enterprise（Review推奨、但し許可済み） │
│ • Review条件: なし                              │
│                                                 │
│ 制限事項:                                       │
│ • 対象件数が500件を超える場合、Review必須       │
│ • High Risk企業が含まれる場合、Draft Onlyに変更 │
│                                                 │
│ [詳細を確認] ボタン                            │
└─────────────────────────────────────────────────┘
```

または、Auto Sendが**許可されない**場合:
```
┌─────────────────────────────────────────────────┐
│ ❌ Send Restricted                              │
│                                                 │
│ このAutomationはAuto Sendが制限されています     │
│                                                 │
│ 理由:                                           │
│ • High Risk企業が45件含まれています             │
│ • 対象件数が上限(500件)を超えています(642件)   │
│                                                 │
│ 推奨されるSend Mode:                            │
│ • Draft Only または Review Before Send         │
│                                                 │
│ [Send Policy を確認] ボタン                    │
└─────────────────────────────────────────────────┘
```

##### 5. Review Settings（Send Mode = Review Before Send の場合）
- **Review Requirement** - Review要件
  - None（なし）※ Draft Only / Auto Sendの場合
  - Review Queue（Review Queue送り）
  - Approval Required（承認必須）※ Policyに応じて
  
- **Reviewer** - レビュアー（User選択）
- **Review Deadline** - レビュー期限（例: 2 days）
- **Auto Approve on Timeout** - タイムアウト時に自動承認（ON/OFF）※ 危険設定

##### 6. Threshold Settings
- **Max Recipient Threshold** - 最大受信者数の閾値
  - 例: 500
  - 超過時の動作を設定（Fallback Behaviorで）
  
- **Per-Day Send Limit** - 1日あたりの送信上限
  - 例: 1000
  - 超過時の動作を設定

##### 7. Fallback Settings（重要）
**Fallback Behavior** - 失敗時の動作
- **Move to Draft** - Draftに落とす
  - 説明: "送信失敗時、Composeに下書きとして保存されます"
  
- **Move to Review Queue** - Review Queueに送る
  - 説明: "送信失敗時、Review Queueで人間が確認します"
  
- **Skip Send** - 送信をスキップ
  - 説明: "送信せず、次のステップに進みます"
  
- **Stop Run** - 実行停止
  - 説明: "送信失敗時、このRunを停止します"
  
- **Continue Next Step** - 次のステップに続行
  - 説明: "送信失敗を無視して次に進みます（非推奨）"

**Fallback Conditions** - Fallback発動条件
- Send Policy Violation（Send Policy違反）
- Recipient Threshold Exceeded（受信者数超過）
- High Risk Detected（High Risk検出）
- Unresolved Variables（未解決変数あり）
- Channel Error（チャネルエラー）
- API Failure（API失敗）

##### 8. Failure Handling Settings
- **Delivery Retry** - 配信リトライ（ON/OFF）
  - Retry Count（リトライ回数）: 例: 3
  - Retry Interval（リトライ間隔）: 例: 5 minutes
  
- **Failure Notification** - 失敗通知（ON/OFF）
  - Notify Owner（オーナーに通知）: ON/OFF
  - Notify Reviewer（レビュアーに通知）: ON/OFF
  - Notification Channel（通知チャネル）: Email / Slack

##### 9. Advanced Settings
- **Batch Send** - バッチ送信（ON/OFF）
  - Batch Size（バッチサイズ）: 例: 50
  - Batch Interval（バッチ間隔）: 例: 10 minutes
  
- **Rate Limiting** - レート制限（ON/OFF）
  - Max Sends Per Minute（分あたり最大送信数）: 例: 60
  
- **Tracking** - トラッキング（ON/OFF）
  - Open Tracking（開封追跡）: ON/OFF
  - Click Tracking（クリック追跡）: ON/OFF

#### AI Suggestion
- **Send Mode Suggestion** - 推奨Send Modeの提案
  - 例: "このAudienceには 'Review Before Send' が推奨されます（High Risk企業が含まれています）"
  
- **Channel Suggestion** - 推奨チャネルの提案
  - 例: "このAudience tierには Email が最も効果的です"
  
- **Send Policy Suggestion** - Send Policy適合性の提案
  - 例: "Auto Send を使用するには、対象件数を342件以下に削減してください"
  
- **Fallback Suggestion** - Fallback設定の提案
  - 例: "Policy違反時は 'Move to Review Queue' が推奨されます"

#### Preview & Validation（最重要）
##### Recipients Preview（受信者プレビュー）
```
┌─────────────────────────────────────────────────┐
│ 📧 Recipients Preview (342 contacts)          │
│                                                 │
│ Company         Contact       Tier    Risk     │
│ ─────────────────────────────────────────────  │
│ ABC Corp        田中太郎      Enterprise  Low  │
│ XYZ Inc         佐藤花子      Premium    Medium│
│ DEF Ltd         鈴木一郎      Enterprise  High ⚠️│
│ ...                                             │
│                                                 │
│ ⚠️ Warning: 45件の High Risk企業が含まれています │
│                                                 │
│ [全件を見る] ボタン                            │
└─────────────────────────────────────────────────┘
```

##### Send Restriction Summary（送信制限サマリー）
```
┌─────────────────────────────────────────────────┐
│ 🚦 Send Restriction Summary                    │
│                                                 │
│ Send Mode: Auto Send（Policy制御）             │
│ Channel: Email                                  │
│ Target Count: 342 contacts                      │
│                                                 │
│ Policy Status:                                  │
│ ✅ チャネル上限内 (Email: 500件以内)            │
│ ⚠️ High Risk企業が45件含まれています            │
│    → これらは自動的にDraft Onlyに変更されます   │
│ ✅ Tier制限クリア                               │
│ ✅ 送信レート制限内                             │
│                                                 │
│ 最終判定:                                       │
│ 🟢 送信可能（297件自動送信、45件Draft）         │
│                                                 │
│ [Policy詳細を確認] ボタン                      │
└─────────────────────────────────────────────────┘
```

##### Risk Warning（リスク警告）
High Risk企業が含まれる場合、目立つ警告を表示:
```
┌─────────────────────────────────────────────────┐
│ ⚠️ HIGH RISK WARNING                            │
│                                                 │
│ 以下のHigh Risk企業が含まれています:            │
│ • DEF Ltd（未解決Issue: 5件）                   │
│ • GHI Corp（Escalation中: 2件）                 │
│ • JKL Inc（Churn Risk: High）                   │
│ ... 他42社                                      │
│                                                 │
│ 推奨アクション:                                 │
│ • これらの企業は Draft Only に変更されます      │
│ • または Review Before Send に変更してください │
│                                                 │
│ [High Risk企業を除外] ボタン                   │
│ [Draft Onlyに変更] ボタン                      │
└─────────────────────────────────────────────────┘
```

##### Content Preview（本文プレビュー）
```
┌─────────────────────────────────────────────────┐
│ 📄 Content Preview                              │
│                                                 │
│ Subject: 【AI活用セミナー】ご案内               │
│                                                 │
│ Body:                                           │
│ ABC Corporation 御中                            │
│                                                 │
│ いつもお世話になっております。                  │
│ 来る4月15日に開催される「AI活用セミナー」...   │
│                                                 │
│ [全文を見る] ボタン                            │
└─────────────────────────────────────────────────┘
```

##### Fallback Preview（Fallback確認）
```
┌─────────────────────────────────────────────────┐
│ 🔄 Fallback Configuration                      │
│                                                 │
│ 以下の条件でFallbackが発動します:               │
│                                                 │
│ • Policy違反検出時                              │
│   → Move to Review Queue                       │
│                                                 │
│ • 受信者数が500件超過時                         │
│   → Stop Run                                   │
│                                                 │
│ • High Risk企業検出時                           │
│   → Move to Draft（該当レコードのみ）          │
│                                                 │
│ • API失敗時                                     │
│   → Retry 3 times, then Move to Draft          │
│                                                 │
│ [Fallback設定を編集] ボタン                    │
└─────────────────────────────────────────────────┘
```

#### Linked Resource CTA（重要）
- **Preview Recipients** - 受信者全件プレビュー（モーダル、フィルター可能）
- **Preview Content** - 本文全文プレビュー（モーダル、変数解決済み）
- **Policy を確認** - Send Policy詳細を表示（モーダル）
- **Fallback を確認** - Fallback設定確認（モーダル）
- **Test Send** - テスト送信（自分のみ or 指定したテストユーザー）
- **Simulate Run** - Run全体をシミュレート（送信せず、結果をプレビュー）

#### Validation Rules（最重要、厳しくチェック）
##### エラー（送信不可）
- ❌ **Send Mode が未選択**
- ❌ **Channel が未選択**
- ❌ **Target Audience が未選択**
- ❌ **Content Source が未選択**
- ❌ **Policy Status が NG**（Auto Sendの場合）
- ❌ **Recipient Count = 0**
- ❌ **Unresolved Variables が存在**（Critical変数の場合）
- ❌ **High Risk企業が含まれる + Auto Send**（Fallback未設定の場合）

##### 警告（送信可能だが要確認）
- ⚠️ **Recipient Count > 100**（Review推奨）
- ⚠️ **Recipient Count > 500**（Policy上限接近）
- ⚠️ **High Risk企業が含まれる**（件数表示）
- ⚠️ **Fallback が未設定**（推奨設定）
- ⚠️ **Review Requirement が None**（Auto Sendの場合）
- ⚠️ **Delivery Retry が無効**（推奨設定）
- ⚠️ **Last Test Send が 7日以上前**（テスト推奨）

---

## 7. Action ノード

### 役割
次アクションを作成し、CSM/GTMチームにフォローアップタスクを割り当てる。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "フォローアップAction作成"
- **Description** - 例: "送信後2日でフォローアップAction作成"
- **Enabled / Disabled**

#### Configuration
##### 1. Action Type（必須）
- **Follow-up** - 一般フォローアップ
- **Support Follow-up** - サポートフォローアップ
- **CSM Action** - CSMアクション
- **GTM Action** - GTMアクション
- **CRM Action** - CRM連携アクション
- **Escalation Follow-up** - エスカレーションフォローアップ
- **Custom Action** - カスタムアクション

##### 2. Action Details
- **Title Template** - アクションタイトルのテンプレート
  - 例: "{{company_name}} - {{event_name}} フォローアップ"
  - 変数使用可能
  
- **Purpose** - アクションの目的（テキストエリア）
  - 例: "ウェビナー参加後のフォローアップを行う"
  
- **Priority** - 優先度
  - High（高）
  - Medium（中）
  - Low（低）
  - Auto（自動判定 - Contextから）

##### 3. Owner Settings
- **Owner Rule** - 担当者ルール
  - **Specific User** - 特定のユーザー（User選択）
  - **From Company Owner** - Companyの担当CSMから
  - **From Project Owner** - Projectの担当者から
  - **From Trigger Context** - Trigger元のコンテキストから
  - **Round Robin** - ラウンドロビン（チーム全体で分散）
  - **Auto Assign by Tier** - Tierに応じて自動割り当て
    - Enterprise → Senior CSM
    - Premium → CSM
    - Standard → CSM or Support
  
- **Fallback Owner** - 担当者が決まらない場合のフォールバック（User選択）

##### 4. Due Settings
- **Due Rule** - 期限ルール
  - **Immediately** - 即時（Runと同時）
  - **After Wait** - Wait nodeの後
  - **Fixed Days Later** - 固定日数後
    - Days（日数）: 例: 3 days
  - **Based on Trigger Date** - Trigger日時基準
    - Offset（オフセット）: 例: +7 days
  - **Based on Event Date** - Event日時基準（Event系の場合）
    - Offset（オフセット）: 例: -3 days（3日前）
  - **Custom Date** - カスタム日付（日付選択）
  
- **Due Time** - 期限時刻（HH:MM）
  - 例: 17:00

##### 5. Linked Resources
- **Linked Company** - 関連Company（Context自動 or 手動選択）
- **Linked Project** - 関連Project（Context自動 or 手動選択）
- **Linked Event** - 関連Event（Context自動 or 手動選択）
- **Linked Support** - 関連Support Alert（Context自動 or 手動選択）
- **Linked Alert** - 関連Alert（Context自動 or 手動選択）
- **Linked Outbound** - 関連Outbound（Context自動 or 手動選択）

##### 6. Follow-up Settings
- **Follow-up Type** - フォローアップ種別
  - Email Follow-up（メールフォローアップ）
  - Call Follow-up（電話フォローアップ）
  - Meeting Follow-up（MTGフォローアップ）
  - In-app Follow-up（アプリ内フォローアップ）
  - Custom（カスタム）
  
- **Follow-up Content Hint** - フォローアップ内容のヒント（テキストエリア）
  - 例: "ウェビナー参加御礼と次回案内を含める"

##### 7. Workspace Settings
- **Save as Action** - Action画面に保存（ON/OFF）
  - Action Board（保存先ボード）: 選択
  - Reusable（再利用可能）: ON/OFF
- **Owner** - Actionの所有者（User選択）

#### AI Suggestion
- **Follow-up Suggestion** - フォローアップ内容の提案
  - 例: "このEvent typeでは '参加御礼 + 資料送付 + 個別MTG提案' が効果的です"
  
- **Owner Suggestion** - 担当者の提案
  - 例: "このCompanyには 田中CSM が最適です（過去の関係性から）"
  
- **Due Date Suggestion** - 期限日の提案
  - 例: "Event終了後2日以内のフォローアップが推奨されます"

#### Preview & Validation
- **Resulting Action Preview（作成されるActionのプレビュー）**
  ```
  ┌───────────────────────────────────────────────┐
  │ 📋 Action Preview                             │
  │                                               │
  │ Title: ABC Corp - AI活用セミナー フォローアップ│
  │ Type: Follow-up                               │
  │ Priority: High                                │
  │ Owner: 田中太郎（CSM）                        │
  │ Due: 2026-04-17 17:00                         │
  │                                               │
  │ Purpose:                                      │
  │ ウェビナー参加後のフォローアップを行う。      │
  │ 参加御礼と次回案内を含める。                  │
  │                                               │
  │ Linked Resources:                             │
  │ • Company: ABC Corp                           │
  │ • Event: AI活用セミナー #45                   │
  │ • Outbound: Email Draft #1234                 │
  │                                               │
  │ [詳細を見る] ボタン                          │
  └───────────────────────────────────────────────┘
  ```

- **Due Date Preview（期限日プレビュー）**
  - 現在の設定での期限日を表示
  - 例: "Due: 2026-04-17 17:00 (3 days after event)"
  
- **Owner Rule Summary（担当者ルールサマリー）**
  - Owner Rule の適用結果を表示
  - 例: "From Company Owner → 田中太郎（Senior CSM）"

#### Linked Resource CTA
- **Preview Action** - Action全体プレビュー（モーダル）
- **Open Linked Company** - 関連Companyを開く
- **Open Linked Event** - 関連Eventを開く

#### Validation Rules
- ❌ **Action Type が未選択**
- ❌ **Title Template が未入力**
- ❌ **Owner Rule が未設定**
- ❌ **Due Rule が未設定**
- ⚠️ **Fallback Owner が未設定**（推奨設定）
- ⚠️ **Linked Resources が未設定**（推奨設定）
- ⚠️ **Purpose が未入力**（推奨設定）

---

## 8. Wait ノード

### 役割
一定時間待つ、または特定の条件が成立するまで待つ。フローの時間制御を行う。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "3日間待機"
- **Description** - 例: "送信後3日間の反応を待つ"
- **Enabled / Disabled**

#### Configuration
##### 1. Wait Type（必須）
- **Fixed Duration** - 固定期間待つ
- **Until Event** - イベントが発生するまで待つ
- **Until Reply** - 返信があるまで待つ
- **Until No Engagement** - エンゲージメントがなくなるまで待つ
- **Until Date** - 特定の日時まで待つ
- **Until Condition Met** - 条件が満たされるまで待つ

##### 2. Wait Settings（Wait Typeによって変わる）

###### Fixed Duration の場合
- **Duration** - 待機時間（数値入力）
  - 例: 3
- **Unit** - 単位
  - Minutes（分）
  - Hours（時間）
  - Days（日）
  - Weeks（週）
  
###### Until Event の場合
- **Event Type** - 待機するEventの種類
  - Email Opened（メール開封）
  - Email Clicked（メールクリック）
  - Page Visited（ページ訪問）
  - Support Reply（サポート返信）
  - Meeting Scheduled（MTG予定設定）
  - Custom Event（カスタムEvent）
  
- **Timeout** - タイムアウト期間（Event発生しない場合）
  - Duration（期間）: 例: 7 days
  - Timeout Behavior（タイムアウト時の動作）: 後述

###### Until Reply の場合
- **Reply Type** - 返信タイプ
  - Email Reply（メール返信）
  - Intercom Reply（Intercom返信）
  - Support Reply（サポート返信）
  - Any Reply（任意の返信）
  
- **Timeout** - タイムアウト期間（返信がない場合）
  - Duration（期間）: 例: 5 days

###### Until No Engagement の場合
- **No Engagement Period** - エンゲージメントなし期間
  - Duration（期間）: 例: 14 days
  - 説明: "この期間エンゲージメントがなければ次に進む"
  
- **Engagement Types** - エンゲージメントの種類
  - Email Open/Click
  - Page Visit
  - Support Contact
  - Product Usage
  - Any Activity

###### Until Date の場合
- **Target Date** - 目標日時（日付+時刻選択）
  - 例: 2026-04-15 09:00
  
- **If Past Date** - 過去日時の場合の動作
  - Skip Wait（待機スキップ）
  - Continue Immediately（即座に続行）
  - Stop Run（実行停止）

###### Until Condition Met の場合
- **Condition Field** - 条件フィールド（Condition nodeと同様）
- **Operator** - 演算子
- **Value** - 比較値
- **Check Interval** - 条件チェック間隔
  - 例: Every 1 hour
- **Timeout** - タイムアウト期間
  - Duration（期間）: 例: 7 days

##### 3. Timeout Handling（タイムアウト時の動作）
- **Continue Next Step** - 次のステップに続行
  - 説明: "タイムアウト後、次のステップに進みます"
  
- **Branch to Fallback** - Fallbackブランチへ
  - 説明: "タイムアウト後、Fallbackブランチに分岐します"
  - Fallback Branch（Fallbackブランチ）: 選択
  
- **Stop Run** - 実行停止
  - 説明: "タイムアウト後、このRunを停止します"
  
- **Move to Draft** - Draftに落とす
  - 説明: "タイムアウト後、Composeに下書きとして送ります"
  
- **Notify Owner** - オーナーに通知
  - 説明: "タイムアウト後、オーナーに通知します"
  - Notification Message（通知メッセージ）: テキスト入力

##### 4. Advanced Settings
- **Business Hours Only** - 営業時間のみ（ON/OFF）
  - Business Hours（営業時間）: 例: 09:00-18:00
  - Timezone（タイムゾーン）: Asia/Tokyo
  - Weekends Excluded（週末除外）: ON/OFF
  
- **Wait Bypass Condition** - Wait省略条件（ON/OFF）
  - Bypass If（省略条件）: 条件設定（Condition nodeと同様）
  - 例: "Priority = High の場合は待機せず即座に進む"

#### AI Suggestion
- **Timing Suggestion** - 待機時間の提案
  - 例: "このEvent typeでは '送信後3日' が最も効果的です"
  
- **Wait Type Suggestion** - Wait Typeの提案
  - 例: "Email送信後は 'Until Reply' または 'Fixed Duration: 5 days' が推奨されます"
  
- **Timeout Handling Suggestion** - Timeout動作の提案
  - 例: "タイムアウト時は 'Branch to Fallback' が推奨されます"

#### Preview & Validation
- **Expected Wait Summary（予想待機時間サマリー）**
  ```
  ┌───────────────────────────────────────────────┐
  │ ⏱️ Wait Summary                                │
  │                                               │
  │ Wait Type: Fixed Duration                     │
  │ Duration: 3 days                              │
  │                                               │
  │ Expected Resume:                              │
  │ • Start: 2026-03-17 14:30                     │
  │ • Resume: 2026-03-20 14:30                    │
  │                                               │
  │ Timeout: なし（Fixed Durationのため）         │
  │                                               │
  │ Business Hours Only: ON                       │
  │ • 営業時間外は待機時間に含まれません          │
  │ • 実際の再開: 2026-03-21 09:00（月曜9時）    │
  └───────────────────────────────────────────────┘
  ```

- **Timeout Summary（タイムアウトサマリー）**
  - Timeout設定がある場合、タイムアウト時の動作を表示
  - 例: "Timeout: 7 days → Branch to Fallback (No Reply Branch)"

#### Validation Rules
- ❌ **Wait Type が未選択**
- ❌ **Duration が未入力**（Fixed Durationの場合）
- ❌ **Target Date が未選択**（Until Dateの場合）
- ❌ **Event Type が未選択**（Until Eventの場合）
- ❌ **Condition が未設定**（Until Condition Metの場合）
- ⚠️ **Timeout Handling が未設定**（Until系の場合、推奨設定）
- ⚠️ **Duration > 30 days**（長すぎる待機時間）
- ⚠️ **Business Hours Only が無効**（営業時間考慮推奨）

---

## 9. Branch ノード

### 役割
条件によってフローを複数の経路に分ける。A/Bテストや条件分岐を実現する。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "返信有無で分岐"
- **Description** - 例: "返信があればフォローアップ、なければリマインド"
- **Enabled / Disabled**

#### Configuration
##### 1. Branch Type（必須）
- **Condition Based** - 条件ベース
- **Send Result Based** - 送信結果ベース
- **Engagement Based** - エンゲージメントベース
- **Reply Detected** - 返信検出ベース
- **Unresolved Remains** - 未解決残存ベース
- **Manual Review Result** - 手動レビュー結果ベース
- **A/B Test** - A/Bテスト
- **Random Split** - ランダム分割

##### 2. Branch Conditions（Branch Typeによって変わる）

###### Condition Based の場合
- **Branch Rules** - ブランチルール（複数追加可能）
  - 各ルールに以下を設定：
    - **Branch Name** - ブランチ名（例: "Enterprise Branch"）
    - **Condition** - 条件（Condition nodeと同様）
    - **Target Node** - 分岐先ノード選択
  
- **Default Branch** - デフォルトブランチ（どのルールにも合致しない場合）
  - Target Node（分岐先ノード）: 選択

###### Send Result Based の場合
- **Success Branch** - 送信成功時のブランチ
  - Target Node（分岐先ノード）: 選択
  
- **Failure Branch** - 送信失敗時のブランチ
  - Target Node（分岐先ノード）: 選択
  
- **Partial Success Branch** - 一部成功時のブランチ（任意）
  - Target Node（分岐先ノード）: 選択
  - Partial Success Threshold（一部成功閾値）: 例: 50%

###### Engagement Based の場合
- **Engaged Branch** - エンゲージメントありのブランチ
  - Engagement Types（エンゲージメント種別）
    - Email Opened
    - Email Clicked
    - Page Visited
    - Support Reply
    - Meeting Scheduled
  - Target Node（分岐先ノード）: 選択
  
- **Not Engaged Branch** - エンゲージメントなしのブランチ
  - Target Node（分岐先ノード）: 選択
  
- **Engagement Check Period** - エンゲージメント確認期間
  - 例: 7 days

###### Reply Detected の場合
- **Reply Branch** - 返信ありのブランチ
  - Target Node（分岐先ノード）: 選択
  
- **No Reply Branch** - 返信なしのブランチ
  - Target Node（分岐先ノード）: 選択
  
- **Reply Check Period** - 返信確認期間
  - 例: 5 days

###### Unresolved Remains の場合
- **Unresolved Branch** - 未解決残存のブランチ
  - Unresolved Types（未解決タイプ）
    - Support Ticket Unresolved
    - CSE Unresolved
    - Issue Unresolved
  - Target Node（分岐先ノード）: 選択
  
- **Resolved Branch** - 解決済みのブランチ
  - Target Node（分岐先ノード）: 選択

###### Manual Review Result の場合
- **Approved Branch** - 承認時のブランチ
  - Target Node（分岐先ノード）: 選択
  
- **Rejected Branch** - 却下時のブランチ
  - Target Node（分岐先ノード）: 選択
  
- **Pending Branch** - 保留時のブランチ（任意）
  - Target Node（分岐先ノード）: 選択

###### A/B Test の場合
- **Variant A** - バリアントA
  - Variant Name（名前）: 例: "Subject A"
  - Split Percentage（分割割合）: 例: 50%
  - Target Node（分岐先ノード）: 選択
  
- **Variant B** - バリアントB
  - Variant Name（名前）: 例: "Subject B"
  - Split Percentage（分割割合）: 例: 50%
  - Target Node（分岐先ノード）: 選択
  
- **Control Group** - コントロールグループ（任意）
  - Split Percentage（分割割合）: 例: 10%
  - Target Node（分岐先ノード）: 選択

###### Random Split の場合
- **Split Branches** - 分割ブランチ（複数追加可能）
  - 各ブランチに以下を設定：
    - **Branch Name** - ブランチ名
    - **Split Percentage** - 分割割合（合計100%になるよう）
    - **Target Node** - 分岐先ノード選択

##### 3. Branch Labels
各ブランチに表示用のラベルを設定：
- **Success Label** - 成功ラベル（例: "✅ 送信成功"）
- **Failure Label** - 失敗ラベル（例: "❌ 送信失敗"）
- **Default Label** - デフォルトラベル（例: "→ その他"）

##### 4. Advanced Settings
- **Branch Evaluation Timing** - ブランチ評価タイミング
  - Immediate（即座）
  - After Wait（Wait後）
  - After Upstream Completion（上流完了後）
  
- **Fallback on Error** - エラー時のフォールバック
  - Target Node（フォールバック先ノード）: 選択

#### AI Suggestion
- **Branch Suggestion** - ブランチ条件の提案
  - 例: "Email送信後は 'Engagement Based' ブランチが推奨されます"
  
- **Split Percentage Suggestion** - 分割割合の提案
  - 例: "A/Bテストの場合、50:50の分割が推奨されます"

#### Preview & Validation
- **Matched Count Preview（合致件数プレビュー）**
  ```
  ┌───────────────────────────────────────────────┐
  │ 🔀 Branch Preview                             │
  │                                               │
  │ Branch Type: Reply Detected                   │
  │                                               │
  │ 予測分布（過去データから）:                   │
  │ • Reply Branch: 約 120 contacts (35%)         │
  │ • No Reply Branch: 約 222 contacts (65%)      │
  │                                               │
  │ Total: 342 contacts                           │
  └───────────────────────────────────────────────┘
  ```

- **Path Summary（経路サマリー）**
  - 各ブランチの分岐先を表示
  - 例:
    - "Reply Branch → Follow-up Action Node"
    - "No Reply Branch → Reminder Email Node"

- **Recent Branch Example（最近のブランチ例）**
  - 過去の同様のブランチでの分岐結果を表示
  - 例: "最近の実行では Reply: 32%, No Reply: 68%"

#### Validation Rules
- ❌ **Branch Type が未選択**
- ❌ **Branch Conditions が未設定**
- ❌ **Target Node が未選択**（各ブランチ）
- ❌ **Split Percentage の合計が 100% でない**（A/B Test / Random Splitの場合）
- ⚠️ **Default Branch が未設定**（推奨設定）
- ⚠️ **Matched Count が 0** （いずれかのブランチ）

---

## 10. End ノード

### 役割
Automationを終了する。実行結果を記録し、Runをクローズする。

### 設定項目

#### Basic Settings
- **Node Name** - 例: "正常終了"
- **Description** - 例: "送信完了後に終了"
- **Enabled / Disabled**

#### Configuration
##### 1. End Label（必須）
- **Label** - 終了ラベル（表示用）
  - 例: "✅ 送信完了"、"⏸️ Draft保存完了"、"❌ 失敗終了"
  
##### 2. End Reason（必須）
- **Completed** - 正常完了
  - 説明: "全てのステップが正常に完了しました"
  
- **Stopped** - 手動停止
  - 説明: "手動で停止されました"
  
- **Failed** - 失敗終了
  - 説明: "エラーにより失敗しました"
  
- **Moved to Draft** - Draft移動
  - 説明: "Composeに下書きとして保存されました"
  
- **Moved to Review** - Review移動
  - 説明: "Review Queueに送られました"
  
- **Manual Stop** - 手動停止
  - 説明: "ユーザーにより手動停止されました"
  
- **Policy Violation** - Policy違反
  - 説明: "Send Policyに違反したため停止されました"
  
- **Timeout** - タイムアウト
  - 説明: "待機時間がタイムアウトしました"

##### 3. Result Settings
- **Save Result Summary** - 結果サマリーを保存（ON/OFF）
  - Summary Fields（サマリー項目）
    - Total Entered（総エントリー数）
    - Total Completed（総完了数）
    - Total Sent（総送信数）
    - Total Failed（総失敗数）
    - Total Dropped（総ドロップ数）
    - Execution Time（実行時間）
  
- **Result Storage Location** - 結果保存場所
  - Automation Run History（Automation実行履歴）
  - Custom Storage（カスタム保存場所）

##### 4. Notification Settings
- **Notify Owner** - オーナーに通知（ON/OFF）
  - Notification Trigger（通知トリガー）
    - Always（常に）
    - On Success Only（成功時のみ）
    - On Failure Only（失敗時のみ）
    - On Policy Violation（Policy違反時のみ）
  
  - Notification Channel（通知チャネル）
    - Email
    - Slack
    - In-app Notification
  
  - Notification Message Template（通知メッセージテンプレート）
    - 例: "Automation '{{automation_name}}' が完了しました。送信数: {{sent_count}}"

##### 5. Archive Settings
- **Archive Run** - 実行を アーカイブ（ON/OFF）
  - Archive After（アーカイブまでの期間）: 例: 30 days
  - Archive Location（アーカイブ場所）: 選択
  
- **Cleanup Settings** - クリーンアップ設定
  - Delete Temporary Data（一時データ削除）: ON/OFF
  - Delete Draft Content（下書きContent削除）: ON/OFF

##### 6. Post-End Actions（任意）
- **Trigger Another Automation** - 別のAutomationをトリガー（ON/OFF）
  - Automation（トリガーするAutomation）: 選択
  - Trigger Condition（トリガー条件）: 例: "On Success Only"
  
- **Create Follow-up Action** - フォローアップAction作成（ON/OFF）
  - Action Template（Actionテンプレート）: 選択

#### AI Suggestion
- **End Reason Suggestion** - 終了理由の提案
  - 例: "このフローは 'Completed' での終了が推奨されます"
  
- **Notification Suggestion** - 通知設定の提案
  - 例: "失敗時はオーナーへの通知を推奨します"

#### Preview & Validation
- **End Summary Preview（終了サマリープレビュー）**
  ```
  ┌───────────────────────────────────────────────┐
  │ 🏁 End Summary                                │
  │                                               │
  │ End Label: ✅ 送信完了                        │
  │ End Reason: Completed                         │
  │                                               │
  │ 保存される結果サマリー:                       │
  │ • Total Entered: {{entered_count}}           │
  │ • Total Sent: {{sent_count}}                 │
  │ • Total Failed: {{failed_count}}             │
  │ • Execution Time: {{execution_time}}         │
  │                                               │
  │ 通知設定:                                     │
  │ • Notify Owner: ON（成功時のみ）             │
  │ • Channel: Email + Slack                     │
  │                                               │
  │ アーカイブ設定:                               │
  │ • Archive After: 30 days                     │
  └───────────────────────────────────────────────┘
  ```

#### Validation Rules
- ❌ **End Label が未入力**
- ❌ **End Reason が未選択**
- ⚠️ **Save Result Summary が無効**（推奨設定）
- ⚠️ **Notify Owner が無効**（失敗時は推奨設定）

---

## 11. Validation の考え方

### Validation レベル
各ノードのvalidation statusを3段階で管理：

#### ✅ Valid（有効）
- 全ての必須項目が設定済み
- 警告なし
- このノードは正常に機能する

#### ⚠️ Warning（警告）
- 必須項目は設定済み
- ただし推奨設定が未設定、または潜在的な問題がある
- このノードは機能するが、確認推奨

#### ❌ Error（エラー）
- 必須項目が未設定
- 設定に矛盾がある
- このノードは機能しない、Automation全体の公開/有効化がブロックされる

### Builder全体でのValidation UI
```
┌─────────────────────────────────────────────────┐
│ Automation Builder - Event案内自動送信          │
│                                                 │
│ Validation Status: ❌ 2 Errors, ⚠️ 3 Warnings  │
│                                                 │
│ [詳細を確認] ボタン                            │
└─────────────────────────────────────────────────┘
```

「詳細を確認」をクリックすると、Validation Summary Dialogが表示される：
```
┌─────────────────────────────────────────────────┐
│ 🔍 Validation Summary                           │
│                                                 │
│ ❌ Errors (2)                                   │
│ • Send Node: Send Mode が未選択                │
│ • Audience Node: Target Count が 0             │
│                                                 │
│ ⚠️ Warnings (3)                                 │
│ • Send Node: High Risk企業が45件含まれています  │
│ • Condition Node: Fallback Path が未設定        │
│ • End Node: Notify Owner が無効                │
│                                                 │
│ [各ノードに移動] ボタン                        │
│ [エラーを修正] ボタン                          │
│ [警告を無視して保存] ボタン（Admin/Managerのみ）│
└─────────────────────────────────────────────────┘
```

### Node上でのValidation表示
各ノードカードの右上に小さいバッジで表示：
- ✅ 緑チェックマーク（Valid）
- ⚠️ 黄色警告マーク（Warning）
- ❌ 赤エラーマーク（Error）

### Publish/Activateボタンの制御
- **Error が1つでもある場合** → Publish/Activateボタンが無効化
- **Warning のみの場合** → Publish/Activateボタンが有効、但し確認ダイアログ表示
- **全てValid の場合** → Publish/Activateボタンが有効

---

## 12. AI提案の入れ方

### AI提案の表示方法
各ノードの設定Sheet内に「✨ AI Suggestion」セクションを配置。

#### AI Suggestion セクションの構成
```
┌─────────────────────────────────────────────────┐
│ ✨ AI Suggestion                                │
│                                                 │
│ 過去の類似Automationから推奨設定を提案します    │
│                                                 │
│ 💡 Trigger Suggestion                          │
│ このEvent typeでは 'Event開始7日前' が最も      │
│ 使われています（類似Automation 15件）          │
│                                                 │
│ [この提案を適用] ボタン                        │
│                                                 │
│ 💡 Timing Suggestion                           │
│ 過去データから、火曜日10時の送信が最も          │
│ 効果的です（開封率: 42%）                       │
│                                                 │
│ [この提案を適用] ボタン                        │
│                                                 │
│ [他の提案を見る] リンク                        │
└─────────────────────────────────────────────────┘
```

### AI提案のタイミング
- **ノード作成時** - 初期値として提案を表示
- **ノード編集時** - 現在の設定に基づいた最適化提案を表示
- **Validation Warning時** - 警告を解決するための提案を表示

### AI提案の種類

#### 1. 設定値提案（Value Suggestion）
- 具体的な設定値を提案
- 例: "Duration: 3 days"、"Owner: 田中CSM"
- 「この提案を適用」ボタンで即座に設定に反映

#### 2. 推奨アクション提案（Action Suggestion）
- 次に行うべきアクションを提案
- 例: "High Risk企業を除外することを推奨します"
- 「実行」ボタンで提案されたアクションを実行

#### 3. 最適化提案（Optimization Suggestion）
- 現在の設定を最適化する提案
- 例: "Send Mode を 'Review Before Send' に変更すると、リスクが低減します"
- 「適用」ボタンで設定を変更

#### 4. 学習データベースの提案（Learning-based Suggestion）
- 過去の類似Automationから学習した提案
- 例: "類似のEvent系Automationでは平均開封率 38% です。あなたのAutomationも同様の結果が期待できます。"
- 参考情報として表示

### AI Agentの使用
- **Kocoro AI** を優先的に使用
- **OpenRouter** をフォールバック
- 既存の agent-18〜21（Automation AI Agents）を活用

---

## まとめ

この設計書により、Automation Builderの各ノードで設定できる項目、UI、validation、AI提案が具体的に定義されました。

### 重要ポイント
1. **Send ノードの慎重な設計** - Send Mode / Policy / Recipient Preview / Fallback / Validation を丁寧に設計
2. **Validation の明確化** - ✅ Valid / ⚠️ Warning / ❌ Error の3段階で管理
3. **AI提案の積極活用** - 各ノードでKocoro AIによる提案を表示
4. **既存機能との整合性** - Audience / Content / Outbound / Support / Event 画面と整合
5. **Policy制御の可視化** - Auto Send時のPolicy制限を必ず可視化

この設計により、Automation Builderは実運用で安全かつ使いやすいツールになります。
