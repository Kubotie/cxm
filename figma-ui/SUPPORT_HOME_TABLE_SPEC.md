# Support Home - Alert Feed / Alert Queue 設計仕様書

## 基本方針

Support Homeは、**Alert Feed / Alert Queue**として設計します。
- ダッシュボードではなく、運用フィードとして機能
- 最新のアラートが常に一番上の行に追加される
- 1行 = 1つの alert / insight / suggestion
- 上から順に見て対応判断できる
- AI提案も同じ一覧の中で扱える

---

## テーブルで扱う対象

以下のすべてを**同じ運用リスト**の中で扱います：
- **Urgent Alerts** (緊急対応が必要な案件)
- **Risk Alerts** (利用低下や解約の危機)
- **Opportunity Alerts** (利用拡大やアップセルのチャンス)
- **AI Suggestions** (AIによる改善提案)

---

## テーブルの並び順 (デフォルト)

優先順位：
1. **最新 Created At** (新しいものが上)
2. **Priority** (高いものが上)
3. **Unresolved / Untriaged** (未解決・未対応が上)

重要: 最新のアラートが常に一番上の行に追加されるイメージ

---

## テーブルカラム構成

### 表示カラム (左→右)

| カラム名 | 幅 | 内容 | 備考 |
|---------|-----|------|------|
| **Created At** | 100px | `2024-03-17 10:15` | 時刻でソート可能 |
| **Alert Type** | 120px | Badge形式で表示 | Urgent / Risk / Opportunity / FAQ Candidate / Help Candidate / Content Suggestion / Action Suggestion / Outbound Suggestion / Event Suggestion / Waiting on CSE |
| **Priority** | 80px | Badge形式 | Critical / High / Medium / Low |
| **Title** | 300px | アラート・提案のタイトル | クリック可能 (詳細パネル展開) |
| **Summary** | 200px | 1行サマリー | AI要約または主要内容 |
| **Company** | 150px | 関連企業名 | リンク付き |
| **Project** | 120px | 関連プロジェクト名 | リンク付き (あれば) |
| **Source** | 100px | チャネル | Intercom / Slack / Chatwork / CSE Ticket / System |
| **Linked Cases** | 80px | 関連Case数 | `3 cases` |
| **CSE Tickets** | 80px | 関連CSE Ticket数 | `2 tickets` |
| **Assigned** | 100px | アサイン先チーム | CSM / Support / Unassigned |
| **Owner** | 100px | 担当者名 | 未アサインなら `-` |
| **Status** | 100px | ルーティング状態 | Untriaged / In Progress / Resolved / Dismissed |
| **Suggested Action** | 150px | 推奨アクション | Badge形式 |
| **Evidence** | 80px | Evidence確認ボタン | アイコンボタン |
| **Actions** | 150px | CTAボタン群 | Quick Actions |

---

## Alert Type の種類と色分け

| Alert Type | 色 | 説明 |
|-----------|-----|------|
| **Urgent** | 赤 (bg-red-100 border-red-300 text-red-700) | 緊急対応が必要 |
| **Risk** | 橙 (bg-orange-100 border-orange-300 text-orange-700) | 利用低下・解約リスク |
| **Opportunity** | 緑 (bg-green-100 border-green-300 text-green-700) | 利用拡大・アップセル |
| **FAQ Candidate** | 青 (bg-blue-100 border-blue-300 text-blue-700) | FAQ化推奨 |
| **Help Candidate** | 青 (bg-blue-100 border-blue-300 text-blue-700) | Help化推奨 |
| **Content Suggestion** | 紫 (bg-purple-100 border-purple-300 text-purple-700) | Content作成推奨 |
| **Action Suggestion** | 紫 (bg-purple-100 border-purple-300 text-purple-700) | Action作成推奨 |
| **Outbound Suggestion** | 紫 (bg-purple-100 border-purple-300 text-purple-700) | Outbound準備推奨 |
| **Event Suggestion** | 紫 (bg-purple-100 border-purple-300 text-purple-700) | Event開催推奨 |
| **Waiting on CSE** | 黄 (bg-amber-100 border-amber-300 text-amber-700) | CSE待機中 |

---

## Priority の種類と色分け

| Priority | 色 | 説明 |
|---------|-----|------|
| **Critical** | 赤 (bg-red-700 text-white) | 最優先対応 |
| **High** | 橙 (bg-orange-600 text-white) | 高優先度 |
| **Medium** | 黄 (bg-amber-500 text-white) | 中優先度 |
| **Low** | 灰 (bg-slate-400 text-white) | 低優先度 |

---

## Routing Status の種類

| Status | 色 | 説明 |
|--------|-----|------|
| **Untriaged** | 赤 (bg-red-50 border-red-300 text-red-700) | 未対応・未振り分け |
| **In Progress** | 青 (bg-blue-50 border-blue-300 text-blue-700) | 対応中 |
| **Resolved** | 緑 (bg-green-50 border-green-300 text-green-700) | 解決済み |
| **Dismissed** | 灰 (bg-slate-50 border-slate-300 text-slate-700) | 却下・対応不要 |

---

## 1行で分かること

各行で以下の情報が一目で分かるようにします：
1. ✅ **何が起きたか** → Title + Summary
2. ✅ **どの顧客/Projectに関係するか** → Company + Project
3. ✅ **どのチャネル起点か** → Source
4. ✅ **どれくらい重要か** → Priority + Alert Type
5. ✅ **次に何をすべきか** → Suggested Action
6. ✅ **その根拠は何か** → Evidence (クリックで詳細)

---

## 行クリック時の挙動

### 詳細パネルの表示方式
- **右パネル (Slide-over)** 形式を採用
- 画面右側から詳細パネルがスライドイン
- テーブル表示は左側に残る (幅を縮小)
- パネルを閉じるとテーブルが全幅に戻る

### 詳細パネルの構成

#### 1. パネルヘッダ
- Alert Type Badge
- Priority Badge
- Title (大きく表示)
- 閉じるボタン (X)

#### 2. メインセクション

##### Why This Matters
- AIが判定した重要性の説明
- 緊急度・リスク・機会の理由
- 影響範囲と対応の必要性

##### AI Summary
- 問い合わせ内容の要約
- 関連パターン分析
- 発生傾向と影響範囲

##### Evidence Log (実際のログ)
- **Channel Badge**: Intercom / Slack / Chatwork / CSE Ticket
- **Timestamp**: `2024-03-17 01:30`
- **主語**: 誰が発言したか明確に表示
  - 顧客: 「田中太郎 (株式会社テクノロジーイノベーション)」
  - 内部: 「Support Team (内部)」
- **ログ内容**: 実際のメッセージ全文
- **Case詳細リンク**: 各ログから直接Case詳細へ遷移

##### Linked Cases
- 関連するCase一覧
- Case ID | Title | Status | Elapsed Time
- 各Caseへのリンク

##### Linked CSE Tickets
- 関連するCSE Ticket一覧
- Ticket ID | Status | Waiting Time
- 各Ticketへのリンク

##### Similar Cases (AIによる類似案件検索)
- 過去の類似案件
- パターン分析結果
- 解決までの平均時間

##### Related Company / Project / User
- Company詳細へのリンク
- Project詳細へのリンク
- 関連User一覧

##### Suggested Next Actions
- 推奨されるアクション一覧
- 各アクションの効果説明
- アクション実行ボタン

#### 3. フッターセクション (CTA)
- 主要アクションボタン群
  - Evidence確認完了
  - Company詳細を開く
  - Project詳細を開く
  - CSE Ticketを開く
  - FAQ Draftを作る
  - Help Draftを作る
  - Contentを作成
  - Actionを作成
  - Outboundを準備
  - ステータスを変更 (Untriaged → In Progress など)
  - アサイン変更

---

## 行ごとのCTA (Quick Actions)

各行の右端に配置するQuick Actionsボタン：

### CTAの種類
1. **Evidence確認** (Eye アイコン) → 詳細パネルを開く
2. **Company** (Building アイコン) → Company詳細へ遷移
3. **Project** (Briefcase アイコン) → Project詳細へ遷移
4. **CSE Ticket** (Ticket アイコン) → CSE Ticket詳細へ遷移
5. **FAQ Draft** (BookOpen アイコン) → FAQ Draft作成フォームへ
6. **Help Draft** (FileText アイコン) → Help Draft作成フォームへ
7. **Content作成** (FileText アイコン) → Content作成フォームへ
8. **Action作成** (Target アイコン) → Action作成フォームへ
9. **Outbound準備** (Send アイコン) → Outbound作成フォームへ
10. **More** (MoreVertical アイコン) → その他アクションメニュー

### Quick Actionsの表示ルール
- 常時表示: Evidence確認 (Eye アイコン)
- hover時に表示: その他のアクション
- Alert Typeに応じて適切なCTAを優先表示

---

## 上部フィルタ / 切替

### フィルタ配置
テーブル上部に以下のフィルタ・切替を配置：

#### 1行目: クイックフィルタ (タブ形式)
- **All** (全て)
- **Untriaged** (未対応のみ)
- **Urgent Only** (緊急のみ)
- **Risk Only** (リスクのみ)
- **Opportunity Only** (機会のみ)
- **Linked CSE Ticket** (CSE Ticket連携のみ)

#### 2行目: 詳細フィルタ (ドロップダウン形式)
- **Alert Type** (Urgent / Risk / Opportunity / AI Suggestion など)
- **Priority** (Critical / High / Medium / Low)
- **Source Channel** (Intercom / Slack / Chatwork / CSE Ticket / System)
- **Assigned Team** (CSM / Support / Unassigned)
- **Owner** (担当者名)
- **Company** (会社名で検索)
- **Project** (プロジェクト名で検索)
- **Status** (Untriaged / In Progress / Resolved / Dismissed)

#### 右端: アクション
- **Export** (CSVエクスポート)
- **Refresh** (更新)
- **Settings** (表示カラム設定)

---

## テーブルのインタラクション

### ソート
- 各カラムのヘッダーをクリックでソート
- デフォルト: Created At (降順)
- ソート可能カラム: Created At / Priority / Company / Linked Cases / CSE Tickets / Status

### 行選択
- 行クリック → 詳細パネル展開
- Checkbox (複数選択) → バルクアクション可能
  - 一括アサイン
  - 一括ステータス変更
  - 一括エクスポート

### ページネーション
- 1ページあたり: 50件 (変更可能: 25 / 50 / 100)
- 無限スクロール対応 (オプション)

---

## UI意図

### Support Homeの役割
- ❌ ダッシュボード (集計・グラフ中心)
- ✅ **Alert Feed / Alert Queue** (運用フィード)

### 特徴
- ✅ 常に最新の重要事象から見られる
- ✅ AI提案も同じ一覧の中で扱える
- ✅ 各行からすぐEvidenceと次アクションへ進める
- ✅ 1画面で全体像を把握できる
- ✅ フィルタで必要な情報に素早く絞り込める
- ✅ テーブル形式で多くの情報を一覧できる

---

## モックデータ例

### Alert 1
```
Created At: 2024-03-17 10:15
Alert Type: Urgent
Priority: Critical
Title: 株式会社テクノロジーイノベーションがプラン上限に到達
Summary: Standard Plan（上限50名）で利用ユーザー数48名。追加メンバー招待の問い合わせあり
Company: 株式会社テクノロジーイノベーション
Project: -
Source: Intercom
Linked Cases: 1
CSE Tickets: 0
Assigned: Unassigned
Owner: -
Status: Untriaged
Suggested Action: アップグレード提案
Evidence: ログ1件
```

### Alert 2
```
Created At: 2024-03-17 09:45
Alert Type: Opportunity
Priority: High
Title: グローバルソリューションズが高度な機能への興味を示している
Summary: Advanced Analytics機能について3回問い合わせ。導入事例を知りたいとのこと
Company: グローバルソリューションズ
Project: -
Source: Intercom
Linked Cases: 3
CSE Tickets: 0
Assigned: CSM
Owner: 山田太郎
Status: In Progress
Suggested Action: 機能デモMTG設定
Evidence: ログ1件
```

### Alert 3
```
Created At: 2024-03-17 08:30
Alert Type: Risk
Priority: High
Title: クラウドインフラサービスのサポート件数が42%急増
Summary: 先週比で18件増加。API連携とパフォーマンス関連の問い合わせ集中
Company: クラウドインフラサービス
Project: API統合プロジェクト
Source: System
Linked Cases: 18
CSE Tickets: 2
Assigned: Support
Owner: 佐藤花子
Status: In Progress
Suggested Action: ヘルスチェックMTG設定
Evidence: ログ複数
```

### Alert 4
```
Created At: 2024-03-17 07:15
Alert Type: Content Suggestion
Priority: Medium
Title: 「API連携トラブルシューティングガイド」Content作成を推奨
Summary: API連携関連の問い合わせが月間45件。詳細ガイドで初回応答時間短縮可能
Company: -
Project: -
Source: System (AI)
Linked Cases: 45
CSE Tickets: 0
Assigned: Unassigned
Owner: -
Status: Untriaged
Suggested Action: Content作成
Evidence: 統計データ
```

### Alert 5
```
Created At: 2024-03-16 22:30
Alert Type: Waiting on CSE
Priority: High
Title: CSE-1234 データ同期エラーの調査が48時間超過
Summary: クラウドインフラサービスのCSE Ticket待機時間が52h。中間報告が必要
Company: クラウドインフラサービス
Project: データ同期システム
Source: CSE Ticket
Linked Cases: 1
CSE Tickets: 1
Assigned: CSM
Owner: 鈴木一郎
Status: In Progress
Suggested Action: 中間報告送付
Evidence: CSE Ticketログ
```

---

## 次のステップ

1. ✅ 設計仕様書作成完了
2. ⏳ Support Home テーブルコンポーネント実装
3. ⏳ 詳細パネル (Slide-over) コンポーネント実装
4. ⏳ フィルタ機能実装
5. ⏳ モックデータ作成
6. ⏳ インタラクション実装 (ソート・選択・ページネーション)
