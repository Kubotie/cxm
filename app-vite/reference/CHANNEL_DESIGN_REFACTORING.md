# 外部送信チャネル設計見直し - Slack/Chatwork対応

## 📋 現状分析

### 問題点
1. **Slackが単独チャネルとして扱われている箇所が多数**
   - Outbound選択肢にChatworkがない
   - Event AI提案で「Slack」のみ言及
   - SettingsにChatworkチャネル設定がない
   - AuditでSlack送信のみ記録
   
2. **整合性のない設計**
   - ある画面ではSlack/Chatworkを束ねて扱い、別の画面ではSlackのみ
   - Channel typeの定義が画面ごとに異なる

### 既に対応済みの箇所
- ✅ Library Create Form: chatwork が channel type に含まれる
- ✅ Rich Text Editor: chatwork 対応済み
- ✅ Content Jobs: "slack_chatwork" という束ねたタイプ使用
- ✅ Unified Company Log: chatwork が sourceType に含まれる
- ✅ Knowledge: "Slack/Chatwork" という表記を使用

---

## 🎯 設計方針

### チャネル表記の使い分け

#### 1. ユーザー向け選択肢（個別選択）
**使用画面**: Outbound, Compose, Settings
```
- Email
- Intercom  
- Slack
- Chatwork
```

#### 2. 束ねた表記（提案・推奨）
**使用画面**: Event AI提案, Content推奨
```
- Email
- In-App
- Messaging (Slack/Chatwork)
```

#### 3. Settings での管理
**チャネル設定**: 個別に管理
```
- Email設定
- Slack設定
- Chatwork設定
- Intercom設定
```

**Resolver設定**: 個別に管理
```
- Email Resolver
- Slack Channel Resolver
- Chatwork Channel Resolver  
- Intercom User Resolver
```

---

## 📝 修正対象ファイル一覧

### 🔴 優先度：高（必須修正）

#### 1. Outbound関連
**ファイル**: `/src/app/components/outbound/new-outbound-drawer.tsx`
- **現状**: `channelOptions` に Slack のみ
- **修正**: Chatwork を追加
```typescript
const channelOptions = [
  { value: "email", label: "Email", icon: Mail },
  { value: "intercom", label: "Intercom", icon: MessageSquare },
  { value: "slack", label: "Slack", icon: SlackIcon },
  { value: "chatwork", label: "Chatwork", icon: MessageSquare }, // 追加
];
```

**ファイル**: `/src/app/pages/outbound-result.tsx`
- **修正内容**: Results表示でChatwork集計を追加
- **追加項目**:
  - Chatwork送信成功数
  - Chatwork送信失敗数
  - Chatwork unresolved数

#### 2. Settings
**ファイル**: `/src/app/pages/settings.tsx`

**修正1**: Channel type定義
```typescript
// 現状
type: "email" | "slack" | "intercom"

// 修正後
type: "email" | "slack" | "chatwork" | "intercom"
```

**修正2**: Chatworkチャネル設定追加
```typescript
{
  id: "ch-4",
  name: "Customer Chatwork Group",
  type: "chatwork",
  status: "active",
  defaultSender: "CS Bot",
  config: "Group Chat API Token: cw_***",
}
```

**修正3**: Chatwork Resolver追加
```typescript
{
  id: "dest-4",
  resolverName: "Chatwork Room Resolver",
  targetType: "Chatwork",
  status: "active",
  fallbackRule: "Use default room",
  lastUpdated: "2026-03-15",
}
```

**修正4**: 文言修正
```typescript
// 現状
"Email / Slack / Intercom などの送信チャネルを設定します"

// 修正後
"Email / Slack / Chatwork / Intercom などの送信チャネルを設定します"
```

**修正5**: アイコン追加
```typescript
{channel.type === "chatwork" && <MessageSquare className="w-4 h-4 text-teal-600" />}
```

#### 3. Event
**ファイル**: `/src/app/components/event/event-create-drawer.tsx`

**修正箇所**: Outbound方針提案

**現状**:
```typescript
<span className="text-xs font-semibold text-slate-900">3. Slack（優先度: 中）</span>
// ...
name: "マルチチャネル戦略（Email + In-App + Slack）"
```

**修正後**:
```typescript
<span className="text-xs font-semibold text-slate-900">3. Messaging（Slack/Chatwork）（優先度: 中）</span>
// ...
name: "マルチチャネル戦略（Email + In-App + Messaging）"
description: "Email、In-App通知、Messaging（Slack/Chatwork）の3チャネル戦略"
```

#### 4. Audit
**ファイル**: `/src/app/pages/governance-audit.tsx`

**修正1**: Chatwork送信失敗例を追加
```typescript
{
  id: "aud-024",
  timestamp: "2026-03-17 11:20",
  eventType: "delivery_failed",
  targetType: "Outbound",
  targetName: "Chatwork通知送信",
  targetId: "out-235",
  linkedCompany: "テックイノベーション株式会社",
  userId: "山田 太郎",
  action: "outbound_delivery",
  result: "failed",
  riskLevel: "medium",
  summary: "Chatwork送信が失敗しました",
  channel: "Chatwork",
  failureReason: "Chatwork room not found: rid_12345",
}
```

**修正2**: Channel フィルター追加
- Slackフィルター → Slack/Chatwork両方
- Channel別集計にChatwork追加

### 🟡 優先度：中（重要だが段階的対応可）

#### 5. Content
**ファイル**: `/src/app/components/content/content-create-sheet.tsx`
- **現状**: Slackのみ選択肢
- **修正**: Chatwork追加、または "Messaging (Slack/Chatwork)" に統一

#### 6. Audience  
**ファイル**: `/src/app/pages/audience-workspace.tsx`

**修正箇所**:
```typescript
// 現状
recommendedChannels: ["Email", "Slack"]

// 修正後（選択肢1）
recommendedChannels: ["Email", "Slack", "Chatwork"]

// 修正後（選択肢2: 束ねる）
recommendedChannels: ["Email", "Messaging"]
```

#### 7. Company Detail / Project
**ファイル**: 
- `/src/app/pages/company-detail.tsx`
- `/src/app/pages/project-detail.tsx`

**確認・修正内容**:
- Intercom送信モーダル → 外部チャネル送信モーダルに汎化
- Slack固有の表記を「Messaging」に変更

#### 8. Unified Company Log
**ファイル**: `/src/app/pages/unified-company-log.tsx`
- **現状**: sourceType に chatwork 含まれる（✅対応済み）
- **追加修正**: sourceTypeConfig に chatwork 定義追加

```typescript
const sourceTypeConfig = {
  slack: { label: "Slack", icon: MessageSquare, color: "bg-purple-100 text-purple-800" },
  chatwork: { label: "Chatwork", icon: MessageSquare, color: "bg-teal-100 text-teal-800" }, // 追加
  // ...
}
```

### 🟢 優先度：低（表示のみの修正）

#### 9. Knowledge
**ファイル**: `/src/app/pages/knowledge.tsx`
- **現状**: 既に "Slack/Chatwork" 表記使用（✅良好）
- **修正不要**: 現状維持

#### 10. Library
**ファイル**: `/src/app/components/library/create-form.tsx`
- **現状**: chatwork 含まれる（✅対応済み）
- **修正不要**: 現状維持

---

## 🔧 具体的な修正内容

### 1. 共通Type定義の統一

すべてのファイルで使用する Channel type を統一:

```typescript
type Channel = "email" | "slack" | "chatwork" | "intercom";
type MessagingChannel = "slack" | "chatwork";
```

### 2. 文言の置き換えルール

| 現状 | 修正後 | 使用場面 |
|------|--------|----------|
| Slack送信 | Messaging送信 または Slack/Chatwork送信 | 一般的な説明 |
| Slack向け | Messaging向け または Slack/Chatwork向け | Content作成 |
| Slack通知 | Messaging通知 または Slack/Chatwork通知 | 通知文言 |
| Slack | Slack / Chatwork | 選択肢の列挙 |
| Slack channel | Messaging channel または Slack/Chatwork channel | Resolver説明 |

### 3. UI要素の追加

#### アイコン
```typescript
import { MessageSquare } from "lucide-react";

// Slack: purple
<MessageSquare className="w-4 h-4 text-purple-600" />

// Chatwork: teal
<MessageSquare className="w-4 h-4 text-teal-600" />

// Messaging（束ねる場合）: indigo
<MessageSquare className="w-4 h-4 text-indigo-600" />
```

#### バッジ色
```typescript
// Slack
className="bg-purple-100 text-purple-800"

// Chatwork  
className="bg-teal-100 text-teal-800"

// Messaging（束ねる場合）
className="bg-indigo-100 text-indigo-800"
```

---

## 📊 画面別修正サマリー

### Outbound系
| 画面 | 現状 | 修正内容 | 束ね方 |
|------|------|----------|--------|
| New Outbound Drawer | Slackのみ選択肢 | Chatwork追加 | **個別** |
| Outbound Editor | 確認必要 | Chatwork対応 | **個別** |
| Outbound List | 確認必要 | Chatwork表示 | **個別** |
| Outbound Results | Slackのみ集計 | Chatwork集計追加 | **個別** |

### Settings系
| 画面 | 現状 | 修正内容 | 束ね方 |
|------|------|----------|--------|
| Channel Config | Slackのみ | Chatwork設定追加 | **個別** |
| Resolver Config | Slackのみ | Chatwork Resolver追加 | **個別** |

### Event系
| 画面 | 現状 | 修正内容 | 束ね方 |
|------|------|----------|--------|
| Event Create/Edit | "Slack" 固定表記 | "Messaging (Slack/Chatwork)" | **束ねる** |
| Event Detail | 確認必要 | 同上 | **束ねる** |
| Event AI提案 | "Slack" 言及 | "Messaging" に変更 | **束ねる** |

### Content系
| 画面 | 現状 | 修正内容 | 束ね方 |
|------|------|----------|--------|
| Content Create | Slackのみ | Chatwork追加 | **個別** |
| Content Jobs | slack_chatwork使用 | 現状維持 | **束ねる**（✅） |
| Knowledge | Slack/Chatwork表記 | 現状維持 | **束ねる**（✅） |

### Results/Audit系
| 画面 | 現状 | 修正内容 | 束ね方 |
|------|------|----------|--------|
| Governance Audit | Slack送信例のみ | Chatwork送信例追加 | **個別** |
| Channel別履歴 | Slackのみ | Chatwork追加 | **個別** |

### その他
| 画面 | 現状 | 修正内容 | 束ね方 |
|------|------|----------|--------|
| Audience Workspace | Slack推奨 | Slack/Chatwork推奨 | **どちらでも可** |
| Company Detail | 確認必要 | Chatwork対応 | **個別** |
| Project Detail | Intercomのみ | Messaging対応 | **個別** |
| Unified Company Log | chatwork含む | アイコン・色定義追加 | **個別**（✅） |

---

## ✅ チェックリスト

### Phase 1: 必須修正（優先度：高）
- [ ] Outbound Drawer: Chatwork選択肢追加
- [ ] Settings: Channel type に chatwork 追加
- [ ] Settings: Chatwork channel設定追加
- [ ] Settings: Chatwork Resolver追加
- [ ] Settings: 文言修正
- [ ] Event: Outbound方針提案を "Messaging" に変更
- [ ] Audit: Chatwork送信失敗例追加
- [ ] Audit: Channel別履歴でChatwork対応

### Phase 2: 重要修正（優先度：中）
- [ ] Content Create: Chatwork選択肢追加
- [ ] Audience: recommendedChannels にChatwork追加
- [ ] Outbound Results: Chatwork集計追加
- [ ] Unified Log: chatwork の色・アイコン定義

### Phase 3: 確認・検証（優先度：中）
- [ ] Outbound Editor 確認
- [ ] Outbound List 確認
- [ ] Company Detail 確認
- [ ] Project Detail 確認

### Phase 4: 表示調整（優先度：低）
- [ ] すべての "Slack送信" 文言チェック
- [ ] すべての "Slack向け" 文言チェック
- [ ] すべての "Slack通知" 文言チェック

---

## 🎨 UIガイドライン

### カラーパレット
```css
/* Email */
--email-bg: #DBEAFE;      /* blue-100 */
--email-text: #1E40AF;    /* blue-800 */
--email-icon: #2563EB;    /* blue-600 */

/* Slack */
--slack-bg: #F3E8FF;      /* purple-100 */
--slack-text: #6B21A8;    /* purple-800 */
--slack-icon: #9333EA;    /* purple-600 */

/* Chatwork */
--chatwork-bg: #CCFBF1;   /* teal-100 */
--chatwork-text: #115E59; /* teal-800 */
--chatwork-icon: #0D9488; /* teal-600 */

/* Intercom */
--intercom-bg: #E0E7FF;   /* indigo-100 */
--intercom-text: #3730A3; /* indigo-800 */
--intercom-icon: #4F46E5; /* indigo-600 */

/* Messaging（束ねる場合） */
--messaging-bg: #E0E7FF;  /* indigo-100 */
--messaging-text: #3730A3;/* indigo-800 */
--messaging-icon: #6366F1;/* indigo-500 */
```

### アイコン使用
すべてのMessaging系チャネルは `MessageSquare` アイコンを使用

---

## 📌 重要な設計判断

### なぜSlackとChatworkを分けるのか？

1. **Settings/Resolver**: 
   - API認証情報が異なる
   - Destination解決ロジックが異なる
   - エラーハンドリングが異なる
   → **必ず個別管理**

2. **Outbound/Compose**:
   - ユーザーが明示的にチャネルを選択
   - 配信実績を個別に追跡
   → **個別選択可能にする**

3. **Results/Audit**:
   - 配信成功/失敗を個別に記録
   - トラブルシューティングに必要
   → **個別表示**

### なぜ束ねる場面があるのか？

1. **Event AI提案**:
   - 戦略レベルの提案
   - 具体的なチャネルは後で選択
   → **"Messaging" と束ねてOK**

2. **Content推奨**:
   - 汎用的なメッセージング用途
   - どちらでも使える想定
   → **"Slack/Chatwork" と併記**

---

## 🚀 実装順序の推奨

1. **Settings修正** → 基盤を整える
2. **Outbound Drawer修正** → 選択肢を増やす
3. **Event AI提案修正** → 文言を自然にする
4. **Audit修正** → 履歴追跡を完全にする
5. **Results修正** → 集計を完全にする
6. **その他画面修正** → 全体の統一感を出す

---

## 📖 参考：現在の実装状況

### ✅ 既に適切に実装されている箇所
- Library Create Form
- Rich Text Editor
- Content Jobs (slack_chatwork type)
- Unified Company Log (sourceType)
- Knowledge (Slack/Chatwork併記)

### ❌ 修正が必要な箇所
- Outbound選択肢
- Settings Channel/Resolver
- Event AI提案
- Audit履歴
- 各種文言（"Slack送信" など）
