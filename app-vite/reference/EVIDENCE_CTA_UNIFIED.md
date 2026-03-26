# Evidence起点CTA統一 - 7画面横並び整理

## 目的
Inbox、Unified Log、Company detail、Project、User、Actions、Content の7画面におけるEvidence起点CTAを統一し、役割を明確化する。

---

## 基本原則

### 1. 送信実行の集約
- **どの画面も送信実行の場所ではない**
- 顧客向け送信は全て **Outbound / Compose** に集約
- 送信系CTAは「送信準備導線」として扱う
- 最終送信実行だけCompose画面で危険操作として扱う

### 2. CTAの4分類
全画面のCTAを以下の4種類に整理：

#### A. 原文・根拠確認
- 原文を開く
- Evidenceを見る
- Unified Logを見る
- 関連ログを見る

#### B. 文脈整理
- Companyを開く
- Projectを開く
- Userを開く
- Projectに紐付ける
- Userに紐付ける

#### C. 業務化
- Actionを作成
- Actionsに送る
- Contentに送る

#### D. 顧客対応準備（送信準備導線）
- 返信/案内を準備
- Outboundを起票する
- Outboundで使う
- Composeで確認

### 3. UI統一ルール
- 送信系CTAは赤色にしない（通常の主要CTA色）
- 危険操作の印象を出さない
- 赤いdanger表現はCompose内の最終送信実行のみ
- 「このEvidenceを送信文脈に使う」は独立CTAにせず、内部挙動に吸収

---

## 1. Inbox（受信起点の対応判断画面）

### 役割
- 受信・通知・アラートを確認する
- 優先順位と対応要否を判断する
- 必要な文脈へ振り分ける

### 残すCTA

#### 主CTA
- ✅ **返信/案内を準備** (`variant="default"`)
  - 表示条件: `type === "risk" || "opportunity" || "inquiry"`
  - 送信準備導線として扱う

#### 補助CTA
- ✅ **Company詳細** (`variant="ghost"`, 右寄せ)
- ✅ **Project詳細** (projectIdがある場合のみ)
- ✅ **承認** (status=pending_reviewのみ)
- ✅ **却下** (status=pending_reviewのみ)
- ✅ **処理開始** (status=unprocessedのみ)

### 削除したCTA
- ❌ Outbound対応を起票
- ❌ Email送信
- ❌ Intercom送信
- ❌ 外部送信
- ❌ 送信実行
- ❌ Inbox画面内で送信完結するCTA

### Composeに渡す文脈
```typescript
/outbound/compose?
  fromInbox=alert_1
  &evidence=alert_1
  &sourceContext=inbox
  &linkedCompany=comp-123
  &linkedProject=proj-1
  &summary=<Evidence要約>
```

**引き継ぐ文脈:**
- source context = "inbox"
- inquiry / alert / ticket 要約
- linked company / project / user
- linked evidence
- urgency
- 推奨返信意図
- audience候補

---

## 2. Unified Log（時系列Evidence理解画面）

### 役割
- いつ何が起きたかを時系列で理解する
- 今見ているEvidenceを根拠に次アクションを判断する
- 文脈整理と次対応への橋渡しをする

### 残すCTA

#### 主CTA
- ✅ **返信/案内を準備** (`variant="default"`)
  - 表示条件: `messageType === "inquiry" || "support_request" || "feature_request"` または `sourceType === "support_ticket" || "intercom"`
- ✅ **Actionを作成** (`variant="outline"`)

#### 補助CTA
- ✅ **原文を開く** (hasOriginalLink=trueのみ)
- ✅ **Projectに紐付ける** (linkedProject未設定のみ)
- ✅ **関連Alert**
- ✅ **関連Action**
- ✅ **Resolver詳細** (resolverResult存在時のみ)

### 削除したCTA
- ❌ Outbound対応を起票
- ❌ このEvidenceを送信文脈に使う（独立ボタン）
- ❌ 返信/案内対応に進む
- ❌ 送信実行
- ❌ 外部送信
- ❌ Unified Log画面内で送信完結するCTA

### Composeに渡す文脈
```typescript
/outbound/compose?
  fromLog=log-1
  &evidence=log-1
  &sourceContext=unified_log
  &linkedCompany=comp-123
  &linkedProject=<Project名>
  &summary=<Evidence要約>
```

**引き継ぐ文脈:**
- source context = "unified_log"
- linked evidence
- linked company / project / user
- evidence summary
- inquiry / alert / ticket 要約
- 推奨返信意図
- audience候補

---

## 3. Company Detail（企業1社の統合理解画面）

### 役割
- 特定企業1社の状態を統合して理解する
- 複数Project / 複数User / 複数Evidence をまとめて見る
- 会社としての Risk / Opportunity / 次アクションを判断する

### 残すCTA

#### 主CTA
- ✅ **Outboundを起票** (`variant="default"`)
  - Company scope の施策導線

#### 補助CTA（業務文脈へ）
- ✅ **Actionsに送る** (`variant="outline"`)
- ✅ **Contentに送る** (`variant="outline"`)

#### 補助CTA（参照）
- ✅ **Unified Logを見る** (`variant="outline"`)
- ✅ **Libraryを見る** (`variant="outline"`)

#### 特殊CTA
- ✅ **Composeで確認** (Salesforce同期時)

### 削除したCTA
- ❌ 送信実行
- ❌ Email送信
- ❌ Intercom送信
- ❌ Slack送信
- ❌ Company detail画面内で送信完結するCTA

### Composeに渡す文脈

#### Outbound起票時
```typescript
/outbound/compose?
  sourceContext=company
  &linkedCompany=comp-123
  &companyName=<会社名>
  &phase=<Phase>
```

#### Salesforce同期時
```typescript
/outbound/compose?
  fromCompany=comp-123
  &sync=salesforce
  &type=org_chart
```

**引き継ぐ文脈:**
- source context = "company"
- linked company
- 関連Project要約
- 関連User要約
- linked evidence
- company scope の施策意図
- audience候補

---

## 4. Project（個別Project深掘り画面）

### 役割
- 1つのProjectの状態を深掘りする
- A-Phase、利用状況、Evidence、Users、Insight をもとに判断する
- 個別Project単位で次の対応を決める

### 残すCTA

#### 主CTA
- ✅ **Outboundを起票** (`variant="default"`)
  - status="pushed"のActionから遷移
  - Project施策導線

#### 補助CTA（文脈整理）
- ✅ **Companyを見る**
- ✅ **Userを見る**
- ✅ **Evidenceを見る**
- ✅ **Unified Logを見る**

#### 補助CTA（業務化）
- ✅ **Actionを作成** (`onClick={onPush}`)
- ✅ **Actionsに送る**
- ✅ **Contentに送る**

#### 特殊CTA
- ✅ **Composeで確認** (Sync時)

### 削除したCTA
- ❌ Intercom送信準備
- ❌ Email送信準備
- ❌ 送信実行
- ❌ Project画面内で送信完結するCTA

### Composeに渡す文脈
```typescript
/outbound/compose?
  fromProject=<action_id>
  &sourceContext=project
  &actionType=send
  &linkedAction=<action_id>
```

**引き継ぐ文脈:**
- source context = "project"
- linked project
- A-Phase
- project insight
- linked users
- linked evidence
- project risk / opportunity
- audience候補

---

## 5. User（個別User深掘り画面）

### 役割
- 特定Userの接点・利用状況・問い合わせ・関連Projectを理解する
- 個別対応を判断する

### 残すCTA（設計）

#### 主CTA
- ✅ **Outboundを起票** (`variant="default"`)
  - User個別対応導線

#### 補助CTA（文脈整理）
- ✅ **Companyを見る**
- ✅ **Projectを見る**
- ✅ **Evidenceを見る**

#### 補助CTA（業務化）
- ✅ **Actionsに送る**
- ✅ **Contentに送る**

#### 特殊CTA
- ✅ **Composeで確認**

### 削除予定CTA
- ❌ Email送信
- ❌ Intercom送信
- ❌ 送信実行
- ❌ User画面内で送信完結するCTA

### Composeに渡す文脈（設計）
```typescript
/outbound/compose?
  sourceContext=user
  &linkedUser=<user_id>
  &recentActivity=<summary>
  &linkedProject=<project_id>
  &linkedCompany=<company_id>
```

**引き継ぐ文脈:**
- source context = "user"
- linked user
- recent activity
- linked project
- linked company
- support context
- linked evidence
- audience候補

---

## 6. Actions（業務アクション遂行画面）

### 役割
- 顧客対応・改善・フォローアップなど、アクション遂行の業務フローを管理する
- やるべきことを進める

### 残すCTA

#### 主CTA
- ✅ **Outbound起票** (`variant="default"`, `bg-blue-600`)
  - 表示条件: `status === "approved" && actionType === "send_external"`
  - Actions業務からの送信準備導線

#### 補助CTA（業務フロー）
- ✅ **詳細**
- ✅ **編集**
- ✅ **完了**
- ✅ **保留**
- ✅ **再設定**

#### 補助CTA（文脈参照）
- ✅ **Evidenceを見る**
- ✅ **Companyを見る**
- ✅ **Projectを見る**

#### 業務実行CTA
- ✅ **Push実行** (actionType="push"のみ)
  - 内部更新系の実行

### 削除したCTA
- ❌ Email送信
- ❌ Intercom送信
- ❌ 外部送信
- ❌ Actions画面内で外部送信を完結するCTA

### Composeに渡す文脈
```typescript
/outbound/compose?
  fromAction=<action_id>
  &sourceContext=actions
  &linkedAction=<action_id>
```

**引き継ぐ文脈:**
- source context = "actions"
- linked action
- action purpose
- owner
- due
- linked company / project / user
- linked evidence
- audience候補

---

## 7. Content（コンテンツ作成・編集画面）

### 役割
- 提案資料、説明資料、ナーチャリング文面、FAQ案、配布物などを作成・編集する
- 配信準備を行う

### 残すCTA

#### 主CTA
- ✅ **Outboundで使う** (`variant="default"`, `bg-blue-600`)
  - 表示条件: `status === "approved"`
  - Content完成後の配信準備導線

#### 補助CTA（作成・編集）
- ✅ **新規作成**
- ✅ **編集**
- ✅ **プレビュー**
- ✅ **Library参照**

#### 補助CTA（文脈参照）
- ✅ **Companyを見る**
- ✅ **Projectを見る**
- ✅ **Evidenceを見る**

#### 特殊CTA
- ✅ **Composeで確認**

### 削除したCTA
- ❌ Email送信
- ❌ Intercom送信
- ❌ 外部送信
- ❌ Content画面内で送信完結するCTA

### Composeに渡す文脈
```typescript
/outbound/compose?
  fromContent=<content_id>
  &sourceContext=content
  &linkedContent=<content_id>
```

**引き継ぐ文脈:**
- source context = "content"
- linked content
- content type
- title
- template
- body
- variables
- linked company / project / user
- linked evidence

---

## 送信系CTA文言の統一表

| 画面 | 送信系CTA文言 | 意味 |
|------|---------------|------|
| **Inbox** | 返信/案内を準備 | Evidenceへの返信・案内を準備する |
| **Unified Log** | 返信/案内を準備 | Evidenceへの返信・案内を準備する |
| **Company Detail** | Outboundを起票 | Company施策を送信準備に進める |
| **Project** | Outboundを起票 | Project施策を送信準備に進める |
| **User** | Outboundを起票 | User個別対応を送信準備に進める |
| **Actions** | Outbound起票 | Action実行を送信準備に進める |
| **Content** | Outboundで使う | Contentを配信に使う |

### 文言の使い分けルール
- **Inbox / Unified Log**: 「返信/案内を準備」
  - Evidence起点の受信対応という文脈
  - 顧客への直接的な返信・案内が自然
  
- **Company / Project / User**: 「Outboundを起票」
  - 施策・対応の企画という文脈
  - より広い対応を検討する段階
  
- **Actions**: 「Outbound起票」
  - 業務タスクからの派生という文脈
  - 簡潔な表現
  
- **Content**: 「Outboundで使う」
  - 完成したContentの利用という文脈
  - Contentを配信に流すという意図

---

## UI統一ルール

### 1. 色の使い分け

#### 主CTA（送信準備導線）
```typescript
variant="default"
className="bg-blue-600 hover:bg-blue-700"
```
- 通常の青色
- 赤色は使わない
- 危険操作の印象を出さない

#### 補助CTA
```typescript
variant="outline"
```
- グレー枠
- 参照・文脈移動に使用

#### 危険操作（Composeのみ）
```typescript
variant="destructive"
className="bg-red-600 hover:bg-red-700"
```
- 最終送信実行のみ
- この7画面では使用しない

### 2. アイコンの使い分け
- **返信/案内を準備**: `<Reply />`
- **Outboundを起票**: `<Send />`
- **Outbound起票**: `<Send />`
- **Outboundで使う**: `<Send />`
- **Composeで確認**: `<ArrowRight />` または `<Database />`

---

## 文脈引き継ぎ共通仕様

### URLパラメータ
すべてCompose画面に以下の形式で渡す：

```typescript
/outbound/compose?
  sourceContext=<画面識別>
  &from<画面名>=<ID>
  &evidence=<evidence_id>
  &linkedCompany=<company_id>
  &linkedProject=<project_id>
  &linkedUser=<user_id>
  &linkedAction=<action_id>
  &linkedContent=<content_id>
  &summary=<要約>
  &<その他画面固有パラメータ>
```

### 画面識別子（sourceContext）
- `inbox` - Inbox
- `unified_log` - Unified Log
- `company` - Company Detail
- `project` - Project
- `user` - User
- `actions` - Actions
- `content` - Content

### Compose画面での利用
Compose画面は`sourceContext`を見て：
1. どの画面から来たかを理解
2. 適切なデフォルト値を設定
3. 文脈に応じたUI表示
4. 必要なEvidence/Company/Project/Userを自動リンク
5. Audience候補を提案

---

## 実装状況

### ✅ 完了
1. **Inbox** - 「返信/案内を準備」に統一
2. **Unified Log** - 「返信/案内を準備」「Actionを作成」に整理
3. **Company Detail** - 「Outboundを起票」に統一
4. **Project** - 「Outboundを起票」に修正（action-content-sent.tsx）
5. **Actions** - 「Outbound起票」に統一済み
6. **Content** - 「Outboundで使う」に統一済み

### 🚧 未実装
7. **User** - User専用画面がまだ未実装
   - 設計は完了
   - 実装時に「Outboundを起票」を適用

---

## まとめ

### 達成した統一
1. **送信実行の完全集約**: すべての送信実行をCompose画面に集約
2. **CTA文言の統一**: 7画面で役割に応じた適切な文言を使用
3. **色の統一**: 送信準備は青色、危険操作はCompose内のみ赤色
4. **文脈引き継ぎの標準化**: URLパラメータで一貫した文脈引き継ぎ
5. **4分類の明確化**: A. 原文確認、B. 文脈整理、C. 業務化、D. 送信準備

### ユーザーメリット
- どの画面でも「次にどうするか」が明確
- 送信実行はCompose画面だけで行うことが自然に理解できる
- 画面を跨いでも文脈が引き継がれる
- 似た名前の重複CTAが削減され、迷いが少ない
- Evidence起点の業務フローが一貫している

### システムメリット
- 送信ロジックがCompose画面に集約され、保守しやすい
- 危険操作の最終確認が1箇所に集約
- 各画面は「送信準備まで」と責務が明確
- 文脈引き継ぎが標準化され、拡張しやすい
- Audit logが取りやすい（すべての送信がComposeを経由）
