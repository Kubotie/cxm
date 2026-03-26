# Source Context別 Outbound/Compose/Results 表示情報仕様

## UI設計意図
- **source context が変われば、最初に見るべき文脈も変わる**
- **どの入口から来ても、Outbound 側で文脈が切れないようにする**
- **Outbound は単なる送信箱ではなく、文脈つきの顧客接点運用画面にする**
- **Compose は source context を踏まえた編集画面にする**
- **Results は source context を踏まえた結果解釈画面にする**

---

## 共通必須表示項目

すべての source context で最低限表示する項目:

### Outbound (一覧・詳細)
- ✅ **Source Context** - どこから来たか（Inbox / Company / Project / User / Audience / Actions / Content / Library）
- ✅ **Channel** - 配信チャネル（Email / Slack / Intercom / Chatwork）
- ✅ **Audience Scope** - 対象範囲（Company / Project / User）
- ✅ **Linked Company / Project / User** - 紐づく会社・プロジェクト・ユーザー
- ✅ **Linked Evidence** - 根拠となるEvidence数
- ✅ **Linked Action** - 関連Action
- ✅ **Linked Content** - 使用しているContent
- ✅ **Resolved Recipients Count** - 送信可能な対象数
- ✅ **Unresolved Recipients** - 送信できない対象と理由
- ✅ **Review State** - レビュー状態（Draft / Review Required / Approved / Rejected）
- ✅ **Delivery Status** - 配信状態（未送信 / 送信予定 / 送信中 / 送信完了 / 一部失敗 / 全て失敗）

### Compose (編集・確認)
- ✅ **Source Context** - どこから来たか
- ✅ **Channel** - 配信チャネル
- ✅ **Audience Scope** - 対象範囲
- ✅ **Linked Company / Project / User** - 紐づく会社・プロジェクト・ユーザー
- ✅ **Linked Evidence** - 根拠となるEvidence
- ✅ **Subject / Title** - 件名・タイトル
- ✅ **Body / Message** - 本文・メッセージ
- ✅ **Resolved Recipients Count** - 送信可能な対象数
- ✅ **Unresolved Recipients** - 送信できない対象と理由
- ✅ **Review State** - レビュー状態

### Results (結果確認)
- ✅ **Source Context** - どこから来たか
- ✅ **Channel** - 配信チャネル
- ✅ **Audience Scope** - 対象範囲
- ✅ **Sent Count** - 送信成功数
- ✅ **Failed Count** - 送信失敗数
- ✅ **Open Rate** - 開封率
- ✅ **Click Rate** - クリック率
- ✅ **Reply Count** - 返信数
- ✅ **Delivery Status** - 配信状態
- ✅ **Linked Company / Project / User** - 紐づく会社・プロジェクト・ユーザー

---

## 1. From Inbox

### 📋 Context
問い合わせ・アラート・チケットへの返信や対応

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Inquiry / Alert / Ticket 要約**
  - タイトル
  - 要約テキスト（1-2行）
  - タイプ（inquiry / alert / ticket）

- ✅ **Urgency（緊急度）**
  - High / Medium / Low
  - 視覚的なバッジ表示

- ✅ **Source Channel（受信チャネル）**
  - Email / Intercom / Slack / Chatwork
  - 受信元アイコン

- ✅ **受信日時**
  - タイムスタンプ
  - 経過時間（例: "3時間前"）

- ✅ **未対応理由**
  - なぜまだ対応していないか
  - 待機理由（情報不足 / 承認待ち / 技術調査中 / エスカレーション中）

- ✅ **Linked Company / Project / User 候補**
  - 確定済み / 推定 / 不明 のステータス
  - 推定根拠

- ✅ **返信 / 案内 / フォローの目的**
  - 対応タイプ（返信 / 情報案内 / 技術サポート / エスカレーション）
  - 意図の説明

#### 戻り導線
- 🔙 **「Inboxに戻る」ボタン** → `/inbox`
- 🔙 **「元の問い合わせを見る」リンク** → Inbox内の該当item

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**左サイドバー上部: 元問い合わせ文脈**
- ✅ **元問い合わせ要約**
  - 問い合わせ全文
  - 受信日時
  - Source channel
  - Urgency

**左サイドバー中部: 返信対象**
- ✅ **返信対象ユーザー**
  - ユーザー名
  - Email / 連絡先
  - 所属Company / Project

- ✅ **返信方法**
  - Same channel（同じチャネルで返信）
  - Alternative channel（別チャネルで返信）

**右サイドバー: 関連文脈**
- ✅ **関連Evidence**
  - この問い合わせに関連するEvidence一覧
  - 過去のやりとり履歴
  - 関連する技術情報・ドキュメント

**中央エディタ上部: 推奨返信意図**
- ✅ **AIが推奨する返信意図**
  - 返信トーン（謝罪 / 案内 / 技術支援 / エスカレーション）
  - 推奨理由

**左サイドバー下部: 送信準備状況**
- ✅ **Unresolved Recipient**
  - 送信に必要な情報が不足している項目
  - 解決方法の提案

**中央エディタ: メッセージ**
- ✅ **対応メッセージ案**
  - AIが生成した返信案
  - 編集可能
  - プレビュー表示

#### 戻り導線
- 🔙 **「Inboxに戻る」ボタン** → `/inbox`
- 🔙 **「元の問い合わせを見る」ボタン** → Inbox内の該当item
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す（Draft状態）

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **返信送信結果**
  - 配信成功 / 失敗
  - 送信日時
  - 送信channel

**左サイドバー: 失敗・未解決**
- ✅ **Unresolved / Failed**
  - 送信できなかった理由
  - 失敗した配信の詳細
  - リトライ可否

**中央タイムライン: 顧客反応**
- ✅ **返信後の反応**
  - 顧客からの再返信
  - 問い合わせの追加
  - チケットのクローズ
  - タイムスタンプ付きタイムライン

**右サイドバー上部: 状態変化**
- ✅ **チケットや問い合わせの状態変化**
  - Open → Resolved
  - Resolved → Reopened
  - 対応完了までの経過時間

**右サイドバー下部: 次アクション**
- ✅ **次対応候補**
  - Follow-up Actionの推奨
  - さらなる技術サポートの必要性
  - エスカレーションの推奨

#### 戻り導線
- 🔙 **「Inboxに戻る」ボタン** → `/inbox`
- 🔙 **「元の問い合わせを見る」ボタン** → Inbox内の該当item
- 📝 **「Follow-up Actionを作成」ボタン** → Actions画面でActionを起票

---

## 2. From Company

### 📋 Context
会社全体に対する施策・メッセージ配信

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Linked Company**
  - 会社名
  - Phase（Setup / Activation / Optimization / Engagement）
  - Health Score
  - Last Contact

- ✅ **会社全体の主要論点**
  - Open Alerts数
  - Open Actions数
  - 最近の重要なEvidence

- ✅ **Project横断傾向**
  - 複数Projectに共通する課題
  - 会社全体のリスク / 機会
  - 共通パターン

- ✅ **主要関係者**
  - 決裁者リスト
  - キーパーソン
  - 担当CSM

- ✅ **Company Scope の施策意図**
  - 会社全体に対して何を伝えたいか
  - 施策の目的（リスク回避 / 機会創出 / 定期報告 / QBR準備）

#### 戻り導線
- 🔙 **「Company Detailに戻る」ボタン** → `/company/${companyId}`

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**左サイドバー上部: Company文脈**
- ✅ **Company文脈カード**
  - 会社名
  - Phase
  - Health Score
  - Open Alerts / Actions数

**左サイドバー中部: 関連Project**
- ✅ **関連Project要約**
  - 複数Projectの一覧と状態
  - Project横断傾向
  - At Risk / Opportunity Projectの強調

**左サイドバー下部: 関連User**
- ✅ **関連User要約**
  - 主要関係者リスト
  - 役割（決裁者 / admin / member）
  - 送信対象候補のチェックボックス

**中央エディタ上部: メッセージ意図**
- ✅ **Company向けメッセージ意図**
  - 会社全体に対する施策意図
  - メッセージトーン（フォーマル / カジュアル / 緊急）

**右サイドバー: Evidence**
- ✅ **Linked Evidence**
  - 会社全体に関するEvidence
  - Project横断Evidence
  - Health Score根拠

**中央エディタ下部: 送信対象条件**
- ✅ **送信対象条件**
  - 送信対象の絞り込み条件
  - Project単位 / User単位
  - Resolved / Unresolved内訳

#### 戻り導線
- 🔙 **「Company Detailに戻る」ボタン** → `/company/${companyId}`
- 🔙 **「Companyを見る」ボタン** → Company Detail画面
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **Company起点施策の結果**
  - 配信成功件数
  - 対象Project数
  - 対象User数
  - 全体反応率

**中央タブ: セグメント分析**
- ✅ **対象Project / Userごとの反応差**
  - Projectごとの反応率テーブル
  - Userごとの反応率テーブル
  - 反応の偏り分析
  - 高反応 / 低反応セグメントの特定

**左サイドバー: 全体傾向**
- ✅ **Company全体としての反応傾向**
  - 会社全体の反応率
  - 主要関係者の反応状況
  - Phase別傾向
  - Health Scoreへの影響

**右サイドバー: 次アクション**
- ✅ **次アクション候補**
  - Follow-up Action推奨
  - さらなる会社全体施策の必要性
  - 個別Project / Userへのフォローアップ推奨

#### 戻り導線
- 🔙 **「Company Detailに戻る」ボタン** → `/company/${companyId}`
- 🔙 **「Companyを見る」ボタン** → Company Detail画面
- 📝 **「Follow-up Actionを作成」ボタン** → Actions画面

---

## 3. From Project

### 📋 Context
プロジェクト単位の施策・メッセージ配信

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Linked Project**
  - Project名
  - Linked Company
  - Project Phase（A-Phase: Adoption / Activation / Optimization / Expansion）
  - Health Metrics

- ✅ **A-Phase**
  - 現在のPhase（Setup / Activation / Optimization / Engagement）
  - Phase遷移履歴
  - 次のマイルストーン

- ✅ **Project Insight**
  - AIが生成したProject Insight
  - 主要な課題 / 機会
  - リスク要因

- ✅ **Linked Users**
  - このProjectの関係者一覧
  - 役割（admin / member / viewer）
  - アクティビティ状況

- ✅ **Project Risk / Opportunity**
  - リスク要因リスト
  - 機会要因リスト
  - 優先度

- ✅ **Project起点の施策意図**
  - このProjectに対して何を伝えたいか
  - 施策の目的（オンボーディング支援 / リエンゲージメント / 機能紹介）

#### 戻り導線
- 🔙 **「Project Detailに戻る」ボタン** → `/project/${projectId}`

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**左サイドバー上部: Project文脈**
- ✅ **Project文脈カード**
  - Project名
  - Phase
  - Health Metrics
  - Linked Company

**左サイドバー中部: Linked Users**
- ✅ **Linked Users**
  - Project関係者リスト
  - 役割とアクティビティ
  - 送信対象候補のチェックボックス

**右サイドバー: Evidence**
- ✅ **Projectに紐づくEvidence**
  - Project関連Evidence一覧
  - Signals（Health / Risk / Opportunity）
  - アクティビティログ

**中央エディタ上部: 送信意図**
- ✅ **Project単位の送信意図**
  - このProjectに対する施策意図
  - メッセージトーン
  - 期待される結果

**中央エディタ下部: 対象条件**
- ✅ **対象条件**
  - 送信対象の絞り込み条件
  - User role別
  - Resolved / Unresolved内訳

**左サイドバー下部: 未解決**
- ✅ **Unresolved Recipient**
  - 送信に必要な情報が不足している項目
  - 解決方法

#### 戻り導線
- 🔙 **「Project Detailに戻る」ボタン** → `/project/${projectId}`
- 🔙 **「Projectを見る」ボタン** → Project Detail画面
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **Project起点送信の結果**
  - 配信成功件数
  - 対象User数
  - 全体反応率

**中央タイムライン: User別反応**
- ✅ **対象ユーザーごとの反応**
  - Userごとの反応状況テーブル
  - Open / Click / Reply
  - 反応の偏り
  - 高反応 / 低反応Userの特定

**左サイドバー: Project影響**
- ✅ **Project Statusへの影響**
  - Health Scoreの変化
  - Phase遷移の有無
  - リスク / 機会の変化
  - アクティビティ変化

**右サイドバー: Follow-up**
- ✅ **Follow-up候補**
  - Follow-up Action推奨
  - さらなるProject施策の必要性
  - 個別Userへのフォローアップ推奨

#### 戻り導線
- 🔙 **「Project Detailに戻る」ボタン** → `/project/${projectId}`
- 🔙 **「Projectを見る」ボタン** → Project Detail画面
- 📝 **「Follow-up Actionを作成」ボタン** → Actions画面

---

## 4. From User

### 📋 Context
個別ユーザーへの支援・トレーニング・フォローアップ

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Linked User**
  - User名
  - Email / Phone
  - Role / Permission

- ✅ **Recent Activity**
  - 最近のアクティビティ一覧
  - ログイン状況
  - 機能利用状況
  - アクティビティトレンド

- ✅ **Linked Project**
  - このUserが所属するProject一覧
  - Project内の役割

- ✅ **Linked Company**
  - このUserが所属するCompany
  - 会社内の役割（決裁者 / admin / member）

- ✅ **Support Context**
  - 過去のサポート履歴
  - 問い合わせ履歴
  - トレーニング受講歴

- ✅ **このユーザーへ送る意図**
  - 個別支援の目的
  - サポート / トレーニング / フォローアップ / オンボーディング

#### 戻り導線
- 🔙 **「User Detailに戻る」ボタン** → `/user/${userId}` （User詳細画面）
- 🔙 **「Companyに戻る」ボタン** → `/company/${companyId}` （所属Company画面）

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**左サイドバー上部: User文脈**
- ✅ **User文脈カード**
  - User名
  - Role / Permission
  - Linked Company / Project
  - 最終ログイン

**左サイドバー中部: Activity**
- ✅ **Activity要約**
  - 最近のアクティビティタイムライン
  - ログイン状況
  - 機能利用傾向

**右サイドバー: Support履歴**
- ✅ **Support History**
  - 過去のサポート履歴
  - 問い合わせ履歴
  - 過去のやりとり
  - トレーニング受講歴

**中央エディタ上部: 送信理由**
- ✅ **送信理由**
  - このUserに送る理由
  - 目的（サポート / トレーニング / フォローアップ / オンボーディング）
  - パーソナライゼーション方針

**中央エディタ: メッセージ**
- ✅ **User向けメッセージ内容**
  - 個別メッセージ案
  - パーソナライズ変数
  - プレビュー表示

**左サイドバー下部: 送信準備**
- ✅ **Unresolved Recipient 状況**
  - 送信に必要な情報が不足している項目
  - Email / Phone の確認状況

#### 戻り導線
- 🔙 **「User Detailに戻る」ボタン** → `/user/${userId}`
- 🔙 **「Userを見る」ボタン** → User Detail画面
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **Userへの送信結果**
  - 配信成功 / 失敗
  - 送信日時
  - Channel

**中央タイムライン: 反応**
- ✅ **返信 / Reaction**
  - Userからの返信
  - Open / Click / Reply
  - 返信内容
  - タイムスタンプ

**右サイドバー上部: 次回接触**
- ✅ **次回接触候補**
  - Follow-up Action推奨
  - 次回トレーニング / サポートの提案
  - 推奨タイミング

**左サイドバー: 影響分析**
- ✅ **Linked Project / Company への影響**
  - このUserの行動変化
  - Projectへの影響（アクティビティ増加 / 減少）
  - Companyへの影響

#### 戻り導線
- 🔙 **「User Detailに戻る」ボタン** → `/user/${userId}`
- 🔙 **「Userを見る」ボタン** → User Detail画面
- 📝 **「Follow-up Actionを作成」ボタン** → Actions画面

---

## 5. From Audience

### 📋 Context
クラスター・セグメント単位の一括施策

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Linked Cluster / Segment**
  - クラスター名
  - セグメント名
  - クラスタータイプ（risk / opportunity / health / engagement）

- ✅ **Audience条件**
  - Characteristics（特徴）
  - Risks（リスク要因）
  - Opportunities（機会要因）
  - セグメント定義条件

- ✅ **対象Project数**
  - クラスターに含まれるProject数
  - Project一覧プレビュー

- ✅ **対象User数**
  - クラスターに含まれるUser数
  - User一覧プレビュー

- ✅ **共通Insight**
  - クラスター全体に共通するInsight
  - 主要な傾向
  - 共通課題 / 機会

- ✅ **一括施策意図**
  - このクラスターに対して何を伝えたいか
  - 施策の目的（リエンゲージメント / アップセル / オンボーディング支援 / リスク軽減）

#### 戻り導線
- 🔙 **「Audience Workspaceに戻る」ボタン** → `/audience?clusterId=${clusterId}`

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**左サイドバー上部: Audience文脈**
- ✅ **クラスター名 / セグメント名**
  - クラスター / セグメントの識別情報
  - タイプ（risk / opportunity / health）

- ✅ **Audience Scope**
  - Project Level / User Level
  - セグメント定義

**左サイドバー中部: 対象条件**
- ✅ **対象条件**
  - Characteristics
  - Risks
  - Opportunities
  - 対象Project数 / User数
  - 条件マッチング状況

**右サイドバー: 共通Evidence**
- ✅ **共通Evidence**
  - クラスター全体に共通するEvidence
  - 主要なInsight
  - 共通パターン

**中央エディタ上部: メッセージ意図**
- ✅ **一括メッセージ文脈**
  - このクラスターに対する施策意図
  - メッセージトーン
  - パーソナライゼーション方針

**左サイドバー下部: 送信準備**
- ✅ **Resolved / Unresolved**
  - 送信可能な対象数
  - 送信できない対象数と理由
  - 解決方法

#### 戻り導線
- 🔙 **「Audience Workspaceに戻る」ボタン** → `/audience?clusterId=${clusterId}`
- 🔙 **「Audienceを見る」ボタン** → Audience画面
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **一括施策の配信結果**
  - 配信成功件数
  - 対象Project数 / User数
  - 全体反応率

**中央タブ: セグメント分析**
- ✅ **Segment内の反応差**
  - セグメントごとの反応率テーブル
  - Project別 / User別反応率
  - 反応の偏り分析

**左サイドバー: 反応傾向**
- ✅ **Reactionの偏り**
  - どのセグメントが高反応か
  - どのセグメントが低反応か
  - 傾向の可視化（グラフ）

**右サイドバー上部: 再設計推奨**
- ✅ **再設計すべき対象**
  - 反応なしユーザーの再分析
  - 新しいセグメント候補
  - セグメント定義の改善提案

**右サイドバー下部: Audience再設計**
- ✅ **Audienceへ戻る導線**
  - 「Audienceで再設計」ボタン
  - 反応結果を踏まえたクラスター再定義
  - 新しいセグメント作成

#### 戻り導線
- 🔙 **「Audience Workspaceに戻る」ボタン** → `/audience?clusterId=${clusterId}`
- 🔙 **「Audienceを見る」ボタン** → Audience画面
- 🔄 **「Audienceで再設計」ボタン** → Audience画面（結果を反映）

---

## 6. From Actions

### 📋 Context
内部Actionを顧客接点に変換

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Linked Action**
  - Action タイトル
  - Action タイプ（send_external / send_internal / push / sync）
  - Action ID

- ✅ **Action Purpose**
  - このActionの目的
  - 期待される結果
  - ビジネス文脈

- ✅ **Owner**
  - Action担当者
  - 担当チーム

- ✅ **Due**
  - 期限
  - 緊急度
  - 残り時間

- ✅ **Linked Company / Project / User**
  - このActionに紐づく会社・プロジェクト・ユーザー
  - 関連性の強さ

- ✅ **Actionを顧客接点に変換した意図**
  - 内部Actionを外部送信に変換した理由
  - 顧客に伝えるべき内容
  - 変換ロジック

#### 戻り導線
- 🔙 **「Actionsに戻る」ボタン** → `/actions`
- 🔙 **「Actionを見る」ボタン** → Actions画面の該当Action

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**左サイドバー上部: Action文脈**
- ✅ **Actionの目的**
  - Action タイトル
  - Action タイプ
  - 目的とビジネス文脈
  - Owner / Due

**右サイドバー: Evidence**
- ✅ **Linked Evidence**
  - このActionの根拠となるEvidence
  - 関連するSignals
  - ビジネス背景

**中央エディタ上部: 変換意図**
- ✅ **それをどういう送信内容に変換したか**
  - 内部Actionを外部メッセージに変換した内容
  - メッセージ意図
  - トーン選択理由

**左サイドバー中部: 対象**
- ✅ **Audience候補**
  - 送信対象候補
  - Linked Company / Project / User
  - 対象の絞り込み条件

**左サイドバー下部: 送信準備**
- ✅ **Unresolved Recipient**
  - 送信に必要な情報が不足している項目
  - 解決方法

#### 戻り導線
- 🔙 **「Actionsに戻る」ボタン** → `/actions`
- 🔙 **「Actionを見る」ボタン** → Actions画面
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **Action起点の送信結果**
  - 配信成功件数
  - 送信日時
  - 全体反応率

**右サイドバー上部: Follow-up**
- ✅ **Follow-up必要性**
  - このActionに対するFollow-upの必要性
  - さらなるActionの推奨
  - 推奨タイミング

**中央タブ: Action完了判断**
- ✅ **Action完了判断に必要な結果**
  - 顧客からの反応
  - Actionの達成状況
  - 成功 / 失敗の判定
  - 次ステップ

**左サイドバー: Action状態**
- ✅ **Actionステータス変化**
  - 送信前 → 送信後のActionステータス
  - 完了条件の達成度
  - Actionクローズ可否

#### 戻り導線
- 🔙 **「Actionsに戻る」ボタン** → `/actions`
- 🔙 **「Actionを見る」ボタン** → Actions画面
- ✅ **「Actionを完了にする」ボタン** → Actionをクローズ

---

## 7. From Content

### 📋 Context
作成済みContentの配信

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Linked Content**
  - Content タイトル
  - Content ID
  - 作成日 / 更新日

- ✅ **Content Type**
  - Email / Intercom / Slack / Chatwork
  - Template種別

- ✅ **Title**
  - 件名 / タイトル
  - プレビュー

- ✅ **Template**
  - 使用しているテンプレート名
  - Template Category

- ✅ **Linked Context**
  - このContentに紐づく会社・プロジェクト・ユーザー
  - 想定対象

- ✅ **このコンテンツを配信に使う意図**
  - 配信目的
  - 期待される結果
  - ターゲット

#### 戻り導線
- 🔙 **「Contentに戻る」ボタン** → `/content`
- 🔙 **「Contentを見る」ボタン** → Content詳細画面

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**中央エディタ上部: 件名**
- ✅ **Subject**
  - 件名 / タイトル
  - 編集可能

**中央エディタ: 本文**
- ✅ **Body**
  - 本文
  - 編集可能
  - リッチテキストエディタ

**左サイドバー中部: 変数**
- ✅ **Variables**
  - 変数リスト
  - 変数の埋め込み状況
  - 埋め込み可能な変数一覧

**中央エディタ下部: プレビュー**
- ✅ **Sample Output**
  - プレビュー表示
  - 変数埋め込み後の実際の出力
  - 複数サンプルの切り替え

**右サイドバー: Evidence**
- ✅ **Evidence**
  - このContentの根拠となるEvidence
  - 参照ドキュメント

**左サイドバー下部: 対象条件**
- ✅ **対象条件**
  - 送信対象の絞り込み条件
  - Resolved / Unresolved

#### 戻り導線
- 🔙 **「Contentに戻る」ボタン** → `/content`
- 🔙 **「Contentを見る」ボタン** → Content詳細画面
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **どのContentを使ったか**
  - Content タイトル
  - Template名
  - 送信日時

**中央タブ: 反応分析**
- ✅ **その結果どう反応が出たか**
  - 反応率（Open / Click / Reply）
  - セグメント別反応
  - 時系列の反応推移

**右サイドバー: 再利用判断**
- ✅ **再利用判断に必要な結果**
  - このContentの有効性
  - 再利用推奨度（⭐⭐⭐⭐☆）
  - 改善点
  - 成功パターン / 失敗パターン

**左サイドバー: Content更新**
- ✅ **Content改善提案**
  - 反応結果に基づく改善提案
  - A/Bテスト候補
  - 次回配信への推奨

#### 戻り導線
- 🔙 **「Contentに戻る」ボタン** → `/content`
- 🔙 **「Contentを見る」ボタン** → Content詳細画面
- ✏️ **「Contentを改善する」ボタン** → Content編集画面

---

## 8. From Library

### 📋 Context
テンプレートライブラリからの新規作成

### Outboundで見せる情報

#### 必須表示項目（共通項目に加えて）
- ✅ **Selected Template**
  - テンプレート名
  - テンプレートID
  - 作成日

- ✅ **Template Category**
  - カテゴリ（オンボーディング / リエンゲージメント / アップセル / トレーニング / QBR / レポート）
  - サブカテゴリ

- ✅ **Applicable Scope**
  - 適用可能なScope（Company / Project / User）
  - 推奨ユースケース

- ✅ **Sample Output**
  - サンプル出力
  - プレビュー

- ✅ **利用意図**
  - このテンプレートを使う理由
  - 期待される結果
  - ベストプラクティス

#### 戻り導線
- 🔙 **「Libraryに戻る」ボタン** → `/library`
- 🔙 **「Templateを見る」ボタン** → Library内のTemplate詳細

---

### Composeで見せる情報

#### 必須表示項目（共通項目に加えて）

**中央エディタ: Template本文**
- ✅ **Template本文**
  - テンプレート本文
  - 編集可能
  - カスタマイズ可能箇所の強調

**左サイドバー中部: 変数**
- ✅ **Variables**
  - 変数リスト
  - 変数の埋め込み状況
  - 必須変数 / 任意変数

**中央エディタ下部: プレビュー**
- ✅ **適用後プレビュー**
  - プレビュー表示
  - 変数埋め込み後の実際の出力
  - 複数ケースのプレビュー

**左サイドバー上部: Linked Context**
- ✅ **Linked Context**
  - このテンプレートに紐づく会社・プロジェクト・ユーザー
  - 適用対象の設定

**左サイドバー下部: 対象条件**
- ✅ **対象条件**
  - 送信対象の絞り込み条件
  - Scope設定
  - Resolved / Unresolved

#### 戻り導線
- 🔙 **「Libraryに戻る」ボタン** → `/library`
- 🔙 **「Templateを見る」ボタン** → Library内のTemplate詳細
- 🔙 **「差し戻し」ボタン** → Outbound一覧に戻す

---

### Resultsで見せる情報

#### 必須表示項目（共通項目に加えて）

**クイックスタット（上部）**
- ✅ **どのテンプレを使ったか**
  - Template名
  - Category
  - 送信日時

**中央タブ: 結果傾向分析**
- ✅ **テンプレごとの結果傾向**
  - このテンプレートの過去の使用結果
  - 平均反応率（Open / Click / Reply）
  - セグメント別反応
  - 成功率の推移

**右サイドバー: 再利用評価**
- ✅ **再利用の有効性**
  - このテンプレートの有効性（⭐⭐⭐⭐⭐）
  - 再利用推奨度
  - 改善提案
  - ベストプラクティス抽出

**左サイドバー: Template改善**
- ✅ **Template改善提案**
  - 反応結果に基づく改善提案
  - 高反応バリエーション
  - A/Bテスト候補

#### 戻り導線
- 🔙 **「Libraryに戻る」ボタン** → `/library`
- 🔙 **「Templateを見る」ボタン** → Library内のTemplate詳細
- ✏️ **「Templateを改善する」ボタン** → Template編集画面（新バージョン作成）

---

## 実装優先度

### 🔴 P0: 最優先（必須）

#### **共通基盤**
- [ ] URLクエリパラメータから source context を取得
- [ ] source context に応じた表示切り替えロジック
- [ ] 共通必須表示項目の実装

#### **Outbound (outbound-list.tsx)**
- [ ] source context 表示（バッジ / ラベル）
- [ ] 「○○から作成」ヘッダー表示
- [ ] source context別フィルタリング

#### **Compose (outbound-editor.tsx)**
- [ ] source context 情報カード（左サイドバー上部）
- [ ] 「○○に戻る」ボタン（source context依存）
- [ ] source contextに応じた必須表示項目の表示

#### **Results (outbound-result.tsx)**
- [ ] source context 情報カード（左サイドバー上部）
- [ ] 「○○に戻る」ボタン（source context依存）
- [ ] source contextに応じた結果解釈の表示

---

### 🟡 P1: 推奨（優先度中）

#### **Outbound**
- [ ] source context別サマリー統計
- [ ] linked company/project/user カード

#### **Compose**
- [ ] linked company/project/user カード（右サイドバー）
- [ ] Evidence一覧表示
- [ ] 変数埋め込み状況の詳細表示

#### **Results**
- [ ] segment別反応分析（中央タブ）
- [ ] follow-up候補の推奨
- [ ] 影響分析（Project / Company status変化）

---

### 🟢 P2: 追加機能（優先度低）

#### **Results**
- [ ] テンプレート別結果傾向分析
- [ ] A/Bテスト候補提案
- [ ] 再利用評価システム

#### **Compose**
- [ ] リアルタイムプレビュー
- [ ] 複数サンプルの切り替え
- [ ] AIによる改善提案

---

## データ構造案

### Outbound データモデル

```typescript
interface OutboundItem {
  id: string;
  
  // Source Context
  sourceContext: 'inbox' | 'company' | 'project' | 'user' | 'audience' | 'actions' | 'content' | 'library';
  sourceId: string; // 元のitem ID（inbox item / company ID / project ID など）
  
  // 共通必須項目
  channel: 'email' | 'slack' | 'intercom' | 'chatwork';
  audienceScope: 'company' | 'project' | 'user';
  
  // Linked entities
  linkedCompany?: string[];
  linkedProject?: string[];
  linkedUser?: string[];
  linkedEvidence?: string[];
  linkedAction?: string;
  linkedContent?: string;
  
  // Recipients
  resolvedRecipientsCount: number;
  unresolvedRecipients: {
    userId: string;
    reason: string;
    resolutionSuggestion?: string;
  }[];
  
  // State
  reviewState: 'draft' | 'review_required' | 'approved' | 'rejected';
  deliveryStatus: 'not_sent' | 'scheduled' | 'sending' | 'sent' | 'partial_failure' | 'failed';
  
  // Source Context別の追加データ
  sourceContextData: InboxSourceData | CompanySourceData | ProjectSourceData | ... ;
  
  // Message
  subject?: string;
  body: string;
  variables?: Record<string, any>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  sentAt?: string;
}

// Source Context別データ型
interface InboxSourceData {
  inquiryTitle: string;
  inquirySummary: string;
  urgency: 'high' | 'medium' | 'low';
  sourceChannel: string;
  receivedAt: string;
  unresolvedReason: string;
  responseType: 'reply' | 'guide' | 'support' | 'escalate';
}

interface CompanySourceData {
  companyName: string;
  phase: string;
  healthScore: number;
  openAlerts: number;
  openActions: number;
  campaignIntent: string;
  crossProjectTrends: string[];
}

// ... その他のsource context別データ型
```

---

## まとめ

この仕様書により、以下が明確化されます:

1. **Source Context ごとに何を表示すべきか**
   - 8つのsource context × 3つの画面（Outbound / Compose / Results）
   - 各組み合わせで表示すべき情報を詳細に定義

2. **共通必須表示項目**
   - すべてのsource contextで必ず表示する項目
   - 一貫性のあるUI/UX

3. **戻り導線**
   - どこから来たかを常に意識
   - 元の画面への適切な戻り導線

4. **実装優先度**
   - P0: 共通基盤 + 基本表示
   - P1: 詳細情報表示 + 分析機能
   - P2: 高度な分析 + AI提案

これにより、**「文脈が失われない顧客接点運用」** が実現できます。
