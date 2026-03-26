# Support 機能 設計仕様書

## 目次
1. [概要](#概要)
2. [画面構成](#画面構成)
3. **[Support Home - Alert Feed / Alert Queue](#support-home---alert-feed--alert-queue)** ⭐ NEW
4. [Support Queue](#support-queue)
5. [Support Detail](#support-detail)
6. [Support Analytics](#support-analytics)

---

## 概要

Supportは、顧客からのInquiry（問い合わせ）とSupport（サポート案件）を一元管理し、**アラート・AI提案・Evidence確認**を通じて優先対応を判断する機能です。

### 基本方針（アップデート完了）
- ✅ **運用KPI中心ではなく、アラート・AI提案・Evidence確認を主役にする**
- ✅ **Alert Feed / Alert Queue形式**で、最新の重要事象から対応できる
- ✅ AI提案も同じ一覧の中で扱える
- ✅ 各行からすぐEvidenceと次アクションへ進める
- ✅ 実際のログを主語・時刻・経緯を明確に表示
- ✅ 1アラート=1ログのシンプルな構成

---

## Support Home - Alert Feed / Alert Queue

### 基本設計

Support Homeは、**Alert Feed / Alert Queue**として設計されています。
- ❌ ダッシュボード（集計・グラフ中心）
- ✅ **運用フィード**（最新のアラートから順に表示）
- ✅ 最新のアラートが常に一番上の行に追加される
- ✅ 1行 = 1つの alert / insight / suggestion
- ✅ 上から順に見て対応判断できる

### テーブルで扱う対象

以下のすべてを**同じ運用リスト**の中で扱います：
- **Urgent Alerts** (緊急対応が必要な案件)
- **Risk Alerts** (利用低下や解約の危機)
- **Opportunity Alerts** (利用拡大やアップセルのチャンス)
- **AI Suggestions** (AIによる改善提案)

### テーブルの並び順 (デフォルト)

優先順位：
1. **最新 Created At** (新しいものが上)
2. **Priority** (高いものが上)
3. **Unresolved / Untriaged** (未解決・未対応が上)

### テーブルカラム構成

| カラム名 | 幅 | 内容 |
|---------|-----|------|
| **Created At** | 120px | `2024-03-17 10:15` |
| **Alert Type** | 140px | Urgent / Risk / Opportunity / Content Suggestion など (Badge形式) |
| **Priority** | 90px | Critical / High / Medium / Low (Badge形式) |
| **Title** | 280px | アラート・提案のタイトル (クリック可能) |
| **Summary** | 200px | 1行サマリー |
| **Company** | 150px | 関連企業名 (リンク付き) |
| **Source** | 100px | Intercom / Slack / Chatwork / CSE Ticket / System |
| **Cases** | 80px | 関連Case数 |
| **CSE** | 80px | 関連CSE Ticket数 |
| **Status** | 100px | Untriaged / In Progress / Resolved / Dismissed (Badge形式) |
| **Suggested** | 140px | 推奨アクション |
| **Actions** | 150px | CTAボタン群 (Eye / Building / More) |

### Alert Type の種類

| Alert Type | 色 | 説明 |
|-----------|-----|------|
| **Urgent** | 赤 | 緊急対応が必要 |
| **Risk** | 橙 | 利用低下・解約リスク |
| **Opportunity** | 緑 | 利用拡大・アップセル |
| **FAQ Candidate** | 青 | FAQ化推奨 |
| **Help Candidate** | 青 | Help化推奨 |
| **Content Suggestion** | 紫 | Content作成推奨 |
| **Action Suggestion** | 紫 | Action作成推奨 |
| **Outbound Suggestion** | 紫 | Outbound準備推奨 |
| **Event Suggestion** | 紫 | Event開催推奨 |
| **Waiting on CSE** | 黄 | CSE待機中 |

### 行クリック時の挙動 - 詳細パネル (Slide-over)

#### 表示方式
- **右パネル (Slide-over)** 形式
- 画面右側から詳細パネルがスライドイン
- テーブル表示は左側に残る (幅を縮小)
- パネルを閉じるとテーブルが全幅に戻る

#### パネル構成

##### パネルヘッダ
- Alert Type Badge
- Priority Badge
- Title (大きく表示)
- Created At / Company / Source
- 閉じるボタン (X)

##### パネルコンテンツ

**1. Why This Matters**
- AIが判定した重要性の説明
- 緊急度・リスク・機会の理由
- 影響範囲と対応の必要性

**2. AI Summary**
- 問い合わせ内容の要約
- 関連パ���ーン分析
- 発生傾向と影響範囲

**3. Evidence Log (実際のログ)**
- **Channel Badge**: Intercom / Slack / Chatwork / CSE Ticket (色分け)
- **Timestamp**: `2024-03-17 01:30`
- **主語**: 誰が発言したか明確に表示
  - 顧客: 「田中太郎 (株式会社テクノロジーイノベーション)」
  - 内部: 「Support Team (内部)」「CSMチーム → エンジニアリングチーム」
- **ログ内容**: 実際のメッセージ全文
- **Case詳細リンク**: 各ログから直接Case詳細へ遷移

**4. Related Issues**
- 関連issue一覧 (Badge形式)

**5. Linked CSE Tickets**
- 関連CSE Ticket一覧 (Badge形式)

**6. Metrics**
- 関連案件数
- 平均解決時間
- 改善見込み

**7. Suggested Actions**
- 推奨されるアクション一覧 (ボタン形式)

##### パネルフッター (Main CTAs)
- Company詳細を開く
- 関連Casesを見る
- CSE Ticketを開く
- Action作成
- Outbound準備
- FAQ Draft作成
- ステータス変更 (Untriaged → In Progress)

### 上部フィルタ / 切替

#### クイックフィルタ (タブ形式)
- **All** (全て)
- **Untriaged** (未対応のみ)
- **Urgent Only** (緊急のみ)
- **Risk Only** (リスクのみ)
- **Opportunity Only** (機会のみ)
- **Linked CSE** (CSE Ticket連携のみ)

#### 詳細フィルタ (ドロップダウン形式)
- Alert Type
- Priority
- Source Channel
- Assigned Team
- Status

#### 右端アクション
- Export (CSVエクスポート)
- Refresh (更新)
- Settings (表示カラム設定)

### 1行で分かること

各行で以下の情報が一目で分かります：
1. ✅ **何が起きたか** → Title + Summary
2. ✅ **どの顧客/Projectに関係するか** → Company
3. ✅ **どのチャネル起点か** → Source
4. ✅ **どれくらい重要か** → Priority + Alert Type
5. ✅ **次に何をすべきか** → Suggested Action
6. ✅ **その根拠は何か** → Evidence (クリックで詳細)

---

## Support Queue 画面

### 一覧カラム
- **必須表示**:
  - Title | Case Type | Source | Company | Project | Owner | Assigned Team
  - Routing Status | Source Status | Severity | Created At
  - First Response Time | Open Duration | Waiting Duration
  - Linked CSE Ticket | Related Content

- **補助表示**:
  - User | Issue Category | Repeated Issue Flag | Event Related Flag | Outbound Related Flag

### フィルター
- Case Type | Source | Assigned Team | Routing Status | Severity
- Owner | Company | Project
- Unresolved Only | Linked CSE Ticket Only | FAQ Candidate Only

### CTA
- 開く | CSMにアサイン | Supportにアサイン | CSEに連携 | Mark as triaged
- Reassign | Actionを作成 | Contentを作成 | FAQ/Help候補にする | Outboundを準備

---

## Support Detail 画面

### 上部メタデータ
- Title | Case Type | Source | Company | Project | Owner | Assigned Team
- Routing Status | Severity | Created At | First Response Time | Open Duration | Waiting Duration

### メインコンテンツ
- Original Message | AI Summary & Suggestions | Triage Note
- First Response | Routing History | Similar Cases | Internal Note

### 右パネル / Insight Panel
- AI Summary
- Issue Category | Suggested Owner / Team | Suggested Next Step
- Recurring Issue Flag | FAQ / Help Candidate
- Related Action | Related Content | Related Library | Similar Cases

### 下部 / 関連タブ
- Routing History | Triage Note
- Linked Company / Project / User | Linked CSE Ticket 詳細
- Related Outbound | Related Event | Related Product Issue

### CTA
- CSMにアサイン | Supportにアサイン | CSEに連携 | Reassign | Mark as triaged
- Actionを作成 | Contentを作成 | FAQ Draft作成 | Help Draft作成 | Outboundを準備
- 区切り済みにする | 保留 | Companyを見る | Projectを見る

---

## Support Analytics 画面

### 上部サマリーカード
- Total Inquiries | Total Support | Linked CSE Tickets
- Avg First Response | Avg Resolution | Avg Ticket Aging
- Waiting on CSE | Reopened Rate
- FAQ / Help Candidate Count | Proactive Support Candidate Count

### チャート (Day/Week/Month 粒度切替)
- **Inquiry Volume Trend**
- **Support Volume Trend**
- **Linked CSE Ticket Trend**
- **Avg First Response Time Trend**
- **Avg Resolution Time Trend**
- **Avg Ticket Aging Trend**
- **Waiting on CSE Trend**

### 内訳チャート
- Company Breakdown | Project Breakdown
- Issue Category Breakdown | Channel Breakdown
- Assigned Team Breakdown

### AI Insights & Recommendations
- **Accounts with Rising Support Volume**
- **Projects with Growing Friction**
- **Repeated Question Themes**
- **FAQ / Help Candidates**
- **Cases Needing Proactive Support**
- **Product Feedback Candidates**
- **Event / Webinar Opportunity Candidates**
- **Outbound Follow-up Candidates**

### Recurring Issues
- 発生件数 | 影響顧客数 | 平均解決時間
- FAQ候補フラグ | Product改善フラグ

### CTA
- Queue確認 | Company詳細 | Project詳細
- FAQ/Help候補確認 | Content案を見る | Action案を見る | Outbound案を見る | Event候補を見る

---

## 重要な設計原則

### ✅ 遵守事項
1. **Slack/Chatworkにclose概念を持ち込まない**
   - triaged / assigned / waiting / archived で運用状態管理
   - close件数ではなく active / archived / waiting ベースで扱う

2. **CSE Ticketを主要データとして扱う**
   - Linked CSE Tickets カード
   - Waiting on CSE メトリクス
   - CSE Ticket Trend チャート

3. **Inquiry/Support/CSE Linkedの違いが明確**
   - Badge表示で視覚的に区別
   - カラム分離
   - フィルター機能

4. **時系列チャートはDay固定にしない**
   - Day / Week / Month 切替UI実装済み
   - 対象: Volume Trend, Response Time Trend, CSE Ticket Trend

5. **送信実行はOutbound/Composeに委譲**
   - Support画面では送信ボタンを置かない
   - Outbound準備 → Compose画面で送信

### 🎯 強化したCTA
- Evidence確認 (各アラート・提案から直接展開)
- Company詳細 | Project詳細 | CSE Ticket詳細
- Queue確認 (関連案件をフィルタ)
- FAQ Draft作成 | Help Draft作成
- Content作成 | Action作成 | Outbound準備
- CSMにアサイン | Supportにアサイン | CSEに連携

### 🔻 下げたCTA
- 健康度の詳細だけを見るCTA (折りたたみに移動)
- 単純な件数確認だけのCTA
- 送信実行 (Outbound/Composeに委譲)
- Close系のCTA (Slack/Chatworkには適用しない)
- トレンドチャート (Analyticsに移動)

---

## Evidence Preview の構成

### 1. Why This Matters (全アラート共通)
- **目的**: AIが判定した緊急度・リスク・機会の理由を明確に説明
- **表示内容**:
  - なぜこのアラートが発生したのか
  - 顧客満足度への影響
  - エスカレーション率などの根拠データ
- **デザイン**: 黄色のハイライトで警告として表示

### 2. Evidence Logs (実際のログ) - 主語・時刻・経緯を明確化
- **目的**: 実際のやりとりを時系列で確認し、状況を正確に把握
- **表示内容**:
  - **Channel Badge**: Intercom / Slack / Chatwork / CSE Ticket を色分け表示
  - **Timestamp**: `2024-03-17 01:30` 形式で時刻を明記
  - **主語**: 誰が発言したか明確に表示
    - 顧客ユーザー名: 「田中太郎 (株式会社テクノロジーイノベーション)」
    - 内部チーム: 「Support Team (内部)」「CSMチーム → エンジニアリングチーム」
  - **ログ内容**: 実際のメッセージ全文を表示
  - **Case詳細リンク**: 各ログから直接Case詳細へ遷移可能
- **経緯の明確化**:
  ```
  ① 2024-03-17 01:30 - 田中太郎（顧客）: 初回問い合わせ
     「API連携処理を実行すると、タイムアウトエラー（504 Gateway Timeout）が発生...」
  
  ② 2024-03-17 02:15 - Support Team（内部）: 初回応答なし（8時間経過）
  
  ③ 2024-03-14 19:15 - CSMチーム → エンジニアリングチーム: CSE Ticket起票
     「CSE-1234 起票: データ同期タイムアウトの原因調査...」
  
  ④ 2024-03-15 10:30 - エンジニアリングチーム: 進捗更新
     「CSE-1234 更新: ログ調査中。データベース側のクエリパフォーマンス問題の可能性...」
  
  ⑤ 2024-03-16 14:20 - 鈴木一郎（顧客）: フォローアップ
     「起票いただいた件、その後の進捗はいかがでしょうか...」
  ```
- **色分け**:
  - Intercom: 青系 (顧客からの問い合わせ)
  - Slack: 紫系 (内部コミュニケーション)
  - Chatwork: 緑系 (内部コミュニケーション)
  - CSE Ticket: 黄色系 (エンジニアリング連携)
- **スクロール**: ログが多い場合は max-height で縦スクロール可能

### 3. Statistical Evidence (統計的エビデンス)
- **目的**: 過去データに基づく定量的な根拠を提供
- **表示内容**:
  - **過去30日の類似案件**: 12件
  - **遅延時の平均解決時間**: 28.5h (通常より40%増)
  - **CSAT低下率**: -45% (12時間超過時)
  - **エスカレーション率**: 67% (放置案件の場合)
  - **エスカレーション前の平均待機時間**: 48h
  - **48h超過後のエスカレーション率**: 78%
  - **CSAT影響**: -32%
- **デザイン**: カード形式、リスク度に応じて色分け
  - 警告レベル: 赤系背景
  - 注意レベル: 黄色系背景
  - 通常レベル: グレー系背景

### 4. AI Summary (AI要約)
- **目的**: AIが分析した問い合わせ内容のサマリーを提供
- **表示内容**:
  - 問い合わせ内容の要約
  - 関連するissue・ログのパターン分析
  - 発生傾向と影響範囲
  - 例: 「先週比で18件増加。API連携とパフォーマンス関連の問い合わせが集中しています」
- **デザイン**: 青系ハイライトでAI生成コンテンツを明示

### 5. Related Issues / Cases
- **目的**: 関連する案件・issueを一覧表示
- **表示内容**:
  - Issue Category別の発生件数
    - 「API連携エラー (8件)」
    - 「パフォーマンス劣化 (6件)」
    - 「データ同期遅延 (4件)」
  - 影響を受けている案件一覧
    - Title | Company | User | Created At | Elapsed Time
    - 未解決日数: 「18日間未解決」「21日間未解決」
  - CSE Ticket連携状況
    - CSE-1234 | CSE-1245 など
- **デザイン**: Badge表示とテーブル表示の併用

### 6. Related Cases (詳細)
- **目的**: 該当する案件の詳細情報を提供
- **表示内容**:
  - **Case Title**: リンク付き
  - **Company**: リンク付き
  - **User**: ユーザー名を明記
  - **Created At**: `2024-03-17 01:30` 形式
  - **Last Updated**: 最終更新日時
  - **Elapsed Time**: 「8h 34m 経過」を強調表示
  - **CSE Ticket**: CSE-1234 など、待機時間を併記「待機 52h」
  - **Last CSE Update**: CSE Ticketの最終更新日時
- **CTA**:
  - CSMにアサイン
  - 詳細を見る
- **デザイン**: カード形式、重要度に応じて境界線の色を変更

### 7. Suggested Actions (推奨アクション)
- **目的**: 次に取るべきアクションを明示
- **表示内容**:
  - アクションタイプ別のCTAボタン
    - FAQ Draft作成 (BookOpenアイコン)
    - Help Draft作成 (FileTextアイコン)
    - Content作成 (FileTextアイコン)
    - Action作成 (Targetアイコン)
    - Outbound準備 (Sendアイコン)
    - ヘルスチェックMTG設定 (Zapアイコン)
    - Product Feedback (Targetアイコン)
    - CSE状況確認 (Sendアイコン)
    - フォローアップ送付 (Sendアイコン)
    - Reassign (Usersアイコン)
- **デザイン**: アイコン付きボタンで視認性向上

### 8. Evidence Metrics (数値エビデンス)
- **目的**: 改善見込みや影響範囲を数値で明示
- **表示内容**:
  - 関連案件数: 45件
  - 平均解決時間: 22.5h
  - 改善見込み: 「初回応答時間を50%短縮、解決時間を30%短縮見込み」
  - 影響顧客数: 8社
  - 発生件数: 23件
  - Linked CSE Tickets: Badge形式で一覧表示
  - 最古Ticket: 28日
  - 顧客センチメント: 「不安・懸念が複数ログに出現」
  - 平均待機時間: 62h
  - エスカレーションリスク: 高 / 中 / 低
- **デザイン**: Grid形式、リスク度に応じて色分け

### UI要件
- **展開・折りたたみ**: 「Evidence確認」ボタンでトグル
- **スクロール**: ログが長い場合は縦スクロール (max-height: 96)
- **色分け**:
  - Urgent Alerts: 赤系
  - Risk Alerts: 橙系
  - Opportunity Alerts: 緑系
  - AI Suggestions: 青系
- **リンク**: Company / Project / Case / CSE Ticket へ直接遷移可能
- **CTA配置**: Evidence確認後、すぐにアクションを実行できる配置

---

## AI機能

### 要約・分類
- 問い合わせ内容の自動要約
- Issue Category の自動分類
- Severity / Priority の自動判定

### 振り分け提案
- 推奨オーナー / チーム
- Next Steps
- Routing 提案

### 還元提案
- FAQ / Help 候補の抽出
- Content Draft 候補の抽出
- Action 候補の抽出
- Outbound Follow-up 候補の抽出
- Event / Webinar 候補の抽出

### 傾向分析
- Support Volume の急増検知
- Recurring Issue の検知
- 長期未解決案件の検知
- CSE待機長期化の検知
- 顧客センチメント分析

---

## トレンドチャート粒度切り替え

### 対象チャート
#### Support Home
- Support Volume Trend
- Response Time Trend

#### Support Analytics
- Inquiry Volume Trend
- Support Volume Trend
- Linked CSE Ticket Trend
- Avg First Response Time Trend
- Avg Resolution Time Trend
- Avg Ticket Aging Trend
- Waiting on CSE Trend

### UI要件
- チャート右上または上部に粒度切替タブを配置
- Day / Week / Month を切り替えても、同じチャート枠内で再描画
- 現在の粒度が分かるようにハイライト
- デフォルトは Day

---

## 画面遷移CTA

### Support Home
- Support Queue
- Analytics
- Company詳細 (各アラートから)
- Project詳細 (各アラートから)
- Support Detail (各案件から)

### Support Queue
- Support Detail
- Company詳細
- Project詳細
- CSE Ticket詳細

### Support Detail
- Company詳細
- Project詳細
- CSE Ticket詳細
- Similar Cases
- Content作成
- Action作成
- Outbound作成

### Support Analytics
- Support Queue
- Company詳細
- Project詳細
- FAQ/Help候補確認
- Content案確認
- Action案確認
- Outbound案確認
- Event候補確認

---

## 実装状況

### ✅ 完了
- Support Home: アラート・AI提案・Evidence確認中心の設計
- Support Queue: 一覧カラム、フィルター、CTA
- Support Detail: メタデータ、AI機能、CTA
- Support Analytics: サマリーカード、チャート、AI Insights
- トレンドチャート粒度切り替え (Day/Week/Month)
- Evidence Preview 機能
- Health Summary の折りたたみ化

### 📝 モック実装
- Urgent Alerts データ
- Risk Alerts データ
- Opportunity Alerts データ
- AI Suggestions データ
- Evidence データ

---

## まとめ

Support画面は、運用KPI中心から**アラート・AI提案・Evidence確認を主役**にする形へ完全にアップデートされました。

運用者は「今すぐ対応すべき案件」と「その根拠」をワンクリックで確認し、適切なアクション(FAQ/Content/Action/Outbound作成)を即座に実行できます。

健康度・KPIはサブ的に配置され、必要な時だけ確認できる構造になっています。