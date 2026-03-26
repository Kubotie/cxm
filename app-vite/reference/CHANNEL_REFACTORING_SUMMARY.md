# 外部送信チャネル設計見直し - 実装完了サマリー

## ✅ 完了した修正

### 1. Settings（優先度：高）✅
**ファイル**: `/src/app/pages/settings.tsx`

#### 修正内容:
- ✅ Channel type定義に `chatwork` 追加
  ```typescript
  type: "email" | "slack" | "chatwork" | "intercom"
  ```
  
- ✅ Chatworkチャネル設定を追加
  ```typescript
  {
    id: "ch-3",
    name: "Customer Chatwork Group",
    type: "chatwork",
    status: "active",
    defaultSender: "CS Bot",
    lastChecked: "2026-03-17 14:45",
    hasFailure: false,
    destinationSummary: "1 resolver configured",
    resolverStatus: "active",
  }
  ```

- ✅ Chatwork Resolverを追加
  ```typescript
  {
    id: "dest-3",
    resolverName: "Chatwork Room Resolver",
    targetType: "Chatwork",
    status: "active",
    fallbackRule: "Use default room",
    lastChecked: "2026-03-17 14:45",
    failureCount: 1,
    updatedAt: "2026-03-15",
    matchingRule: "Project-specific room or Company room",
    retryBehavior: "Retry 2 times with 1min interval",
    unresolvedHandling: "Fallback to Email",
  }
  ```

- ✅ UI文言を修正
  ```
  変更前: "Email / Slack / Intercom などの送信チャネルを設定します"
  変更後: "Email / Slack / Chatwork / Intercom などの送信チャネルを設定します"
  ```

- ✅ Chatworkアイコンを追加（teal色）
  ```typescript
  {channel.type === "chatwork" && <MessageSquare className="w-4 h-4 text-teal-600" />}
  ```

---

### 2. Outbound（優先度：高）✅
**ファイル**: `/src/app/components/outbound/new-outbound-drawer.tsx`

#### 修正内容:
- ✅ チャネル選択肢にChatworkを追加
  ```typescript
  const channelOptions = [
    { value: "email", label: "Email", icon: Mail },
    { value: "intercom", label: "Intercom", icon: MessageSquare },
    { value: "slack", label: "Slack", icon: SlackIcon },
    { value: "chatwork", label: "Chatwork", icon: MessageSquare }, // 追加
  ];
  ```

**影響範囲**:
- ✅ 新規Outbound作成時にChatworkを選択可能
- ✅ Slack/Chatworkを個別に管理

---

### 3. Event（優先度：高）✅
**ファイル**: `/src/app/components/event/event-create-drawer.tsx`

#### 修正内容:
- ✅ Outbound方針提案のChannel推奨を修正
  ```
  変更前: "3. Slack（優先度: 中）"
  変更後: "3. Messaging（Slack/Chatwork）（優先度: 中）"
  ```

- ✅ マルチチャネル戦略の名称と説明を修正
  ```
  変更前: 
    name: "マルチチャネル戦略（Email + In-App + Slack）"
    description: "3つのチャネルを組み合わせた配信戦略"
    
  変更後:
    name: "マルチチャネル戦略（Email + In-App + Messaging）"
    description: "Email、In-App通知、Messaging（Slack/Chatwork）の3チャネル戦略"
  ```

**影響範囲**:
- ✅ Event Create/Edit DrawerのAI支援（施策提案）で自然な表記に
- ✅ Event Detail画面でも同じDrawerを使用しているため自動的に対応

---

### 4. Audit（優先度：高）✅
**ファイル**: `/src/app/pages/governance-audit.tsx`

#### 修正内容:
- ✅ Chatwork送信失敗の履歴例を追加
  ```typescript
  {
    id: "evt-4b",
    timestamp: "2026-03-17 11:20:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "delivery_failed",
    targetType: "Outbound",
    targetName: "Chatwork通知送信",
    targetId: "out-235",
    linkedCompany: "グローバルソリューションズ株式会社",
    linkedCompanyId: "2",
    result: "failed",
    riskLevel: "medium",
    summary: "Chatwork送信が失敗しました",
    channel: "Chatwork",
    failureReason: "Chatwork room not found: rid_12345",
  }
  ```

**影響範囲**:
- ✅ Audit履歴でChatwork送信失敗を追跡可能
- ✅ SlackとChatworkを別々にトラッキング

---

### 5. Unified Company Log（優先度：中）✅
**ファイル**: `/src/app/pages/unified-company-log.tsx`

#### 修正内容:
- ✅ Chatworkの色定義を修正（teal色）
  ```typescript
  chatwork: { label: "Chatwork", icon: MessageSquare, color: "bg-teal-100 text-teal-800" }
  ```

- ✅ Source Filterに Chatwork と Intercom を追加
  ```typescript
  <SelectItem value="slack">Slack</SelectItem>
  <SelectItem value="chatwork">Chatwork</SelectItem>  // 追加
  <SelectItem value="email">Email</SelectItem>
  <SelectItem value="intercom">Intercom</SelectItem>  // 追加
  ```

**影響範囲**:
- ✅ Unified Company LogでChatworkとIntercomのログを正しく表示
- ✅ Filterで絞り込み可能

---

## 🎨 採用したカラーパレット

| Channel | Background | Text | Icon |
|---------|-----------|------|------|
| Email | `bg-blue-100` | `text-blue-800` | `text-blue-600` |
| Slack | `bg-purple-100` | `text-purple-800` | `text-purple-600` |
| **Chatwork** | `bg-teal-100` | `text-teal-800` | `text-teal-600` |
| Intercom | `bg-indigo-100` | `text-indigo-800` | `text-indigo-600` |

---

## 📊 画面別対応状況

| 画面 | 対応状況 | 対応内容 |
|------|----------|----------|
| **Settings** | ✅ 完了 | Channel type追加、Chatwork設定追加、Resolver追加、文言修正、アイコン追加 |
| **Outbound Drawer** | ✅ 完了 | Chatwork選択肢追加 |
| **Event Create/Edit** | ✅ 完了 | AI提案で "Messaging (Slack/Chatwork)" 表記に変更 |
| **Audit** | ✅ 完了 | Chatwork送信失敗例追加 |
| **Unified Company Log** | ✅ 完了 | Chatwork色定義追加、Filter追加 |
| Outbound Editor | 🔄 未確認 | Chatwork対応が必要かチェック |
| Outbound List | 🔄 未確認 | Chatwork表示が必要かチェック |
| Outbound Results | 🔄 未確認 | Chatwork集計追加が必要 |
| Content Create | 🔄 未確認 | Chatwork選択肢追加が必要かチェック |
| Audience Workspace | 🔄 未確認 | recommendedChannels修正が必要かチェック |
| Company Detail | 🔄 未確認 | Chatwork対応が必要かチェック |
| Project Detail | 🔄 未確認 | Messaging対応が必要かチェック |
| Knowledge | ✅ 既存OK | 既に "Slack/Chatwork" 表記使用 |
| Library | ✅ 既存OK | 既に chatwork 含まれる |
| Content Jobs | ✅ 既存OK | 既に "slack_chatwork" type使用 |

---

## 📋 次のステップ（推奨）

### Phase 2: 重要修正（優先度：中）

#### 1. Outbound Results
**ファイル**: `/src/app/pages/outbound-result.tsx`
- [ ] Chatwork送信成功数を集計
- [ ] Chatwork送信失敗数を集計
- [ ] Chatwork unresolved数を集計
- [ ] Channel別グラフにChatworkを追加

#### 2. Content Create
**ファイル**: `/src/app/components/content/content-create-sheet.tsx`
- [ ] チャネル選択肢にChatworkを追加、またはMessagingに統一

#### 3. Audience Workspace
**ファイル**: `/src/app/pages/audience-workspace.tsx`
- [ ] recommendedChannels に Chatwork を追加
  ```typescript
  // オプション1: 個別追加
  recommendedChannels: ["Email", "Slack", "Chatwork"]
  
  // オプション2: 束ねる
  recommendedChannels: ["Email", "Messaging"]
  ```

### Phase 3: 確認・検証

#### ファイル確認リスト
- [ ] `/src/app/pages/outbound-editor.tsx` - Chatwork対応確認
- [ ] `/src/app/pages/outbound-list.tsx` - Chatwork表示確認
- [ ] `/src/app/pages/company-detail.tsx` - Chatwork対応確認
- [ ] `/src/app/pages/project-detail.tsx` - Messaging対応確認

#### 文言チェック
- [ ] すべての "Slack送信" → "Messaging送信" or "Slack/Chatwork送信"
- [ ] すべての "Slack向け" → "Messaging向け" or "Slack/Chatwork向け"
- [ ] すべての "Slack通知" → "Messaging通知" or "Slack/Chatwork通知"

---

## 🔍 既に対応済みの箇所（変更不要）

### ✅ Library Create Form
**ファイル**: `/src/app/components/library/create-form.tsx`
- Channel type に chatwork 含まれる
- UI選択肢に "Chatwork" あり

### ✅ Rich Text Editor
**ファイル**: `/src/app/components/outbound/rich-text-editor.tsx`
- Channel type に chatwork 含まれる
- Chatwork用のフォーマット対応済み

### ✅ Content Jobs
**ファイル**: `/src/app/components/content-jobs/create-content-job-drawer.tsx`
- "slack_chatwork" という束ねたタイプ使用
- テンプレートに "Slack/Chatwork通知テンプレート" あり

### ✅ Knowledge
**ファイル**: `/src/app/pages/knowledge.tsx`
- 既に "製品アップデート通知（Slack/Chatwork）" という表記
- linkedChannel: "slack/chatwork" 使用

---

## 🎯 設計判断の整理

### Slack と Chatwork を分ける箇所
✅ **Settings**: API認証、Resolver設定が異なるため個別管理
✅ **Outbound**: ユーザーが明示的に選択、配信実績を個別追跡
✅ **Audit**: 配信成功/失敗を個別記録、トラブルシューティング用
✅ **Results**: 配信結果を個別集計

### Slack と Chatwork を束ねる箇所  
✅ **Event AI提案**: 戦略レベルの提案、"Messaging (Slack/Chatwork)" と表記
✅ **Content推奨**: 汎用的なメッセージング用途、"Slack/Chatwork" と併記
✅ **Knowledge**: テンプレート名で "Slack/Chatwork" 表記

---

## 📚 参考資料

### 型定義の統一
すべてのファイルで以下の型定義を使用することを推奨:

```typescript
type Channel = "email" | "slack" | "chatwork" | "intercom";
type MessagingChannel = "slack" | "chatwork";
```

### アイコンの統一
すべてのMessaging系チャネルは `MessageSquare` アイコンを使用

### 文言パターン

| 状況 | 推奨表記 |
|------|----------|
| 一般的な説明 | "Messaging送信" または "Slack/Chatwork送信" |
| Content作成 | "Messaging向け" または "Slack/Chatwork向け" |
| 通知文言 | "Messaging通知" または "Slack/Chatwork通知" |
| 選択肢の列挙 | "Slack" と "Chatwork" を個別表示 |
| Resolver説明 | "Slack Channel Resolver" と "Chatwork Room Resolver" を個別 |

---

## ✨ 今回の修正による改善点

1. **Chatworkユーザーへの対応**
   - Slackだけでなく、Chatworkも正式にサポート
   - 日本企業で多く使われているChatworkに対応

2. **チャネル管理の一貫性**
   - Settings で Slack と Chatwork を個別設定可能
   - Resolver も個別に管理し、エラーハンドリングを最適化

3. **ユーザー体験の向上**
   - Outbound作成時にChatworkを選択可能
   - Event AI提案で自然な "Messaging" 表記

4. **追跡可能性の向上**
   - Audit履歴でChatwork送信失敗を記録
   - Unified LogでChatworkログを正しく表示

5. **将来の拡張性**
   - 新しいMessagingチャネル追加が容易
   - Type定義が明確で保守しやすい

---

## 🚀 実装順序（今回実施済み）

1. ✅ **Settings修正** → 基盤を整えた
2. ✅ **Outbound Drawer修正** → 選択肢を増やした
3. ✅ **Event AI提案修正** → 文言を自然にした
4. ✅ **Audit修正** → 履歴追跡を完全にした
5. ✅ **Unified Log修正** → 表示を統一した

---

## 📝 備考

- 今回の修正は既存機能を壊さない後方互換性のある変更
- 既にChatworkに対応していた箇所（Library, Rich Text Editor等）との整合性も確保
- Phase 2, 3の修正は段階的に実施可能
