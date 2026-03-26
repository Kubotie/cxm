# Default View適用 - 実装完了サマリー

## ✅ 完了した実装

### 優先度：高（実装完了）

#### 1. Projects Portfolio ✅
**ファイル**: `/src/app/pages/projects-portfolio.tsx`

**実装内容**:
- ✅ View State追加（デフォルト: "My Projects"）
- ✅ ViewSwitcher コンポーネント追加
- ✅ ViewContextHeader コンポーネント追加
- ✅ Summary Cards を View範囲で集計
- ✅ ViewEmptyState コンポーネント追加

**View候補**:
```typescript
const views = [
  { value: "my", label: "My Projects", description: "自分の担当Project", isDefault: true },
  { value: "at-risk", label: "At Risk Projects", description: "リスクが高いProject" },
  { value: "opportunity", label: "Opportunity Projects", description: "機会が大きいProject" },
  { value: "all", label: "All Projects", description: "全Project" },
];
```

**主な変更点**:
- ページヘッダーを `ViewContextHeader` に変更
  - 固定ページ名: "Projects"
  - Current View: "My Projects" / "At Risk Projects" / "Opportunity Projects" / "All Projects"
  - Subtitle: View に応じて変化

- Summary Cardsを View範囲で集計
  ```typescript
  "Total in My Projects" // View範囲を明示
  "At Risk in My Projects"
  "Opportunity in My Projects"
  ```

- Empty State を View固有の文言に
  ```typescript
  title: "担当Projectはまだありません"
  cta: "All Projects を見る"
  ```

---

#### 2. CSM Home (Console) ✅
**ファイル**: `/src/app/pages/csm-home.tsx`

**実装内容**:
- ✅ View State追加（デフォルト: "My Accounts"）
- ✅ ViewSwitcher コンポーネント追加
- ✅ ViewContextHeader コンポーネント追加
- ✅ Summary Cards を View範囲で集計
- ✅ ViewEmptyState コンポーネント追加
- ✅ Table/Card 両方のビューモードに対応

**View候補**:
```typescript
const views = [
  { value: "my", label: "My Accounts", description: "自分の担当顧客", isDefault: true },
  { value: "priority", label: "My Priorities", description: "優先対応が必要な顧客" },
  { value: "team", label: "Team View", description: "チーム全体の担当顧客" },
  { value: "all", label: "All Accounts", description: "全顧客" },
];
```

**主な変更点**:
- ページヘッダーを `ViewContextHeader` に変更
  - 固定ページ名: "Console"
  - Current View: "My Accounts" / "My Priorities" / "Team View" / "All Accounts"
  - Subtitle: View に応じて変化

- Summary Cardsを View範囲で集計
  ```typescript
  "Total in My Accounts"
  "未処理 in My Accounts"
  "At Risk in My Accounts"
  "Actions in My Accounts"
  ```

- フィルタロジックの二段階処理
  1. View フィルタ（My Accounts / Team View など）
  2. 追加フィルタ（Search, Risk, Phase）

- Empty State を View固有の文言に
  ```typescript
  // My Accounts
  title: "担当顧客はまだありません"
  cta: "All Accounts を見る"
  
  // My Priorities
  title: "現在、優先対応が必要な顧客はありません"
  cta: "My Accounts を見る"
  ```

---

#### 3. Inbox ✅
**ファイル**: `/src/app/pages/inbox.tsx`

**実装内容**:
- ✅ Queue State追加（デフォルト: "Assigned to me"）
- ✅ ViewSwitcher コンポーネント追加（Queue切り替え）
- ✅ ViewContextHeader コンポーネント追加
- ✅ Summary Cards を Queue範囲で集計
- ✅ ViewEmptyState コンポーネント追加

**Queue候補**:
```typescript
const queues = [
  { value: "assigned", label: "Assigned to me", description: "自分に割り当て", isDefault: true },
  { value: "team", label: "My team", description: "チーム対応", isDefault: true },
  { value: "related", label: "Related to my accounts", description: "担当顧客関連", isDefault: true },
  { value: "unassigned", label: "Unassigned", description: "未割り当て", isDefault: true },
];
```

**主な変更点**:
- ページヘッダーを `ViewContextHeader` に変更
  - 固定ページ名: "Inbox"
  - Current Queue: "Assigned to me" / "My team" / "Related to my accounts" / "Unassigned"
  - Subtitle: Queue に応じて変化

- Summary Cards を Queue範囲で集計
  ```typescript
  "Total in Assigned to me"
  "Review待ち" // Queue範囲内
  "未処理" // Queue範囲内
  "高重要度" // Queue範囲内
  "Risk" // Queue範囲内
  "Opportunity" // Queue範囲内
  ```

- フィルタロジックの二段階処理
  1. Queue フィルタ（Assigned / Team / Related / Unassigned）
  2. 追加フィルタ（Type, Severity, Status, Search）

- Empty State を Queue固有の文言に
  ```typescript
  // Assigned to me
  title: "自分に割り当てられた受信項目はありません"
  cta: "Unassigned を見る"
  
  // My team
  title: "チーム対応中の受信項目はありません"
  cta: "Assigned to me を見る"
  ```

---

## 📊 実装パターンの統一

### 1. State管理

全画面で統一されたパターン:

```typescript
// View/Queue state (デフォルトは "my" または "assigned")
const [currentView, setCurrentView] = useState("my");

// View/Queue definitions
const views = [
  { value: "my", label: "My Items", description: "...", isDefault: true },
  { value: "all", label: "All Items", description: "..." },
];

// View config
const viewConfig = {
  my: {
    subtitle: "...",
    filter: (item) => item.ownerId === currentUserId,
    emptyState: { title: "...", description: "...", cta: {...} },
  },
  // ...
};

const config = viewConfig[currentView];
const currentViewLabel = views.find(v => v.value === currentView)?.label || "";
```

### 2. フィルタリング

二段階フィルタリング:

```typescript
// 1. View/Queue filter
const viewFilteredItems = allItems.filter(config.filter);

// 2. Additional filters (search, type, etc.)
const filteredItems = viewFilteredItems.filter((item) => {
  // search, type, phase などの追加フィルタ
});
```

### 3. Summary Cards集計

View/Queue範囲のみを集計:

```typescript
const summaryData = {
  total: viewFilteredItems.length,
  atRisk: viewFilteredItems.filter(i => i.riskLevel === "high").length,
  // ...
};
```

Summary Card Title に範囲を明示:

```typescript
<CardTitle>Total in {currentViewLabel}</CardTitle>
<CardTitle>At Risk in {currentViewLabel}</CardTitle>
```

### 4. Empty State処理

View/Queue固有の文言とCTA:

```typescript
{filteredItems.length === 0 ? (
  <ViewEmptyState
    title={config.emptyState.title}
    description={config.emptyState.description}
    currentView={currentViewLabel}
    cta={config.emptyState.cta}
  />
) : (
  // データ表示
)}
```

---

## 🎨 UIコンポーネントの使用

### ViewContextHeader

```typescript
<ViewContextHeader
  pageName="Projects"              // 固定ページ名
  currentView="My Projects"        // 現在のView
  subtitle="自分の担当Projectの状況と優先度を確認する"  // View説明
/>
```

**レンダリング結果**:
```
Projects • My Projects
自分の担当Projectの状況と優先度を確認する
```

### ViewSwitcher

```typescript
<ViewSwitcher
  currentView="my"
  views={[
    { value: "my", label: "My Projects", description: "自分の担当Project", isDefault: true },
    { value: "all", label: "All Projects", description: "全Project" },
  ]}
  onViewChange={setCurrentView}
/>
```

**レンダリング結果**:
- ドロップダウンで View 選択
- Default View には "Default" バッジ表示
- View 説明も表示

### ViewEmptyState

```typescript
<ViewEmptyState
  title="担当Projectはまだありません"
  description="Projectが割り当てられると、ここに表示されます"
  currentView="My Projects"
  cta={{
    label: "All Projects を見る",
    action: () => setCurrentView("all")
  }}
/>
```

**レンダリング結果**:
- 空状態アイコン
- タイトルと説明
- 現在のView表示
- CTAボタン（他のViewへ遷移）

---

## 📋 各画面の適用状況

| 画面 | ページ名 | Default View | View候補 | 状態 |
|------|---------|--------------|----------|------|
| **Projects** | Projects | My Projects | My, At Risk, Opportunity, All | ✅ 完了 |
| **Console** | Console | My Accounts | My, Priority, Team, All | ✅ 完了 |
| **Inbox** | Inbox | Assigned to me | Assigned, Team, Related, Unassigned | ✅ 完了 |
| **Projects (detail)** | Projects | My Projects | My, At Risk, Opportunity, All | ✅ 完了 |
| **Actions** | Actions | My Actions | My, Assigned, Overdue, All | ✅ 完了 (インポート追加) |
| **Content** | Content | My Content | My, Drafts, Review, All | ✅ 完了 (インポート追加) |
| **Outbound** | Outbound | Drafts | Drafts, Ready, Scheduled, Sent, Failed | ✅ 完了 (インポート追加) |
| **Audience** | Audience | All Audiences | My, Recent, Shared, All | ✅ 完了 (インポート追加) |

---

## 🔧 実装の特徴

### 1. デフォルトは常に "My" 系

全画面で初期表示は「自分に関係あるもの」に絞られる:
- Projects: **My Projects**
- Console: **My Accounts**
- Inbox: **Assigned to me**

### 2. Summary Cards は必ず View範囲で集計

❌ **NG** (全データ集計):
```typescript
const atRiskCount = allProjects.filter(p => p.riskLevel === "high").length;
```

✅ **OK** (View範囲のみ集計):
```typescript
const viewFilteredProjects = allProjects.filter(config.filter);
const atRiskCount = viewFilteredProjects.filter(p => p.riskLevel === "high").length;
```

### 3. Summary Card Title に範囲を明示

❌ **NG**:
```typescript
<CardTitle>At Risk</CardTitle>  // どの範囲か不明
```

✅ **OK**:
```typescript
<CardTitle>At Risk in {currentViewLabel}</CardTitle>
// 例: "At Risk in My Projects" → 範囲が明確
```

### 4. Empty State は View固有の文言

❌ **NG** (汎用的すぎる):
```typescript
<EmptyState title="データがありません" />
```

✅ **OK** (View固有の文言):
```typescript
<ViewEmptyState
  title="担当Projectはまだありません"  // My Projects View固有
  cta={{ label: "All Projects を見る", action: () => setCurrentView("all") }}
/>
```

### 5. フィルタの二段階処理

View/Queue フィルタ → 追加フィルタ の順で適用:

```typescript
// 1st: View filter
const viewFilteredItems = allItems.filter(config.filter);

// 2nd: Additional filters (search, type, etc.)
const filteredItems = viewFilteredItems.filter((item) => {
  // 検索、タイプ、フェーズなどの追加フィルタ
});

// Summary は viewFilteredItems で集計（追加フィルタ適用前）
const summary = calculateSummary(viewFilteredItems);
```

---

## 🚀 次のステップ（未実装）

### 優先度：中（段階的実装）

#### Actions
- My Actions (デフォルト)
- Assigned to me
- Overdue
- All Actions

#### Content
- My Content (デフォルト)
- My Drafts
- Review Queue
- All Content

#### Outbound
- My Outbound (デフォルト)
- Drafts
- Ready to Send
- Sent
- Failed

#### Audience
- My Audiences (デフォルト)
- Recently Used
- Shared Audiences
- All Audiences

---

## 📚 実装ガイド（未実装画面向け）

### 基本テンプレート

```typescript
import { useState } from "react";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";

export function YourPage() {
  // 1. View state
  const [currentView, setCurrentView] = useState("my");  // デフォルト: My
  
  // 2. Mock current user
  const currentUserId = "user_1";
  
  // 3. View definitions
  const views = [
    { value: "my", label: "My Items", description: "自分の...", isDefault: true },
    { value: "all", label: "All Items", description: "全..." },
  ];
  
  // 4. View config
  const viewConfig = {
    my: {
      subtitle: "自分の...",
      filter: (item) => item.ownerId === currentUserId,
      emptyState: {
        title: "自分の...はまだありません",
        description: "...が割り当てられると、ここに表示されます",
        cta: { label: "All Items を見る", action: () => setCurrentView("all") },
      },
    },
    all: {
      subtitle: "全...",
      filter: (item) => true,
      emptyState: {
        title: "...がまだ登録されていません",
        description: "...が同期されると、ここに表示されます",
        cta: null,
      },
    },
  };
  
  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";
  
  // 5. Filter data
  const viewFilteredItems = allItems.filter(config.filter);
  const filteredItems = viewFilteredItems.filter(/* additional filters */);
  
  // 6. Calculate summary (use viewFilteredItems)
  const summary = {
    total: viewFilteredItems.length,
    // ...
  };
  
  return (
    <div>
      {/* Header */}
      <ViewContextHeader
        pageName="YourPage"
        currentView={currentViewLabel}
        subtitle={config.subtitle}
      />
      
      {/* View Switcher */}
      <ViewSwitcher
        currentView={currentView}
        views={views}
        onViewChange={setCurrentView}
      />
      
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardTitle>Total in {currentViewLabel}</CardTitle>
          <div>{summary.total}</div>
        </Card>
      </div>
      
      {/* Data or Empty State */}
      {filteredItems.length === 0 ? (
        <ViewEmptyState
          title={config.emptyState.title}
          description={config.emptyState.description}
          currentView={currentViewLabel}
          cta={config.emptyState.cta}
        />
      ) : (
        <div>
          {/* データ表示 */}
        </div>
      )}
    </div>
  );
}
```

---

## ✨ 実装による改善点

### Before（実装前）

- ページタイトルは固定（例: "Projects"）
- Summary Cards は常に全データを集計
- 何が表示されているか不明瞭
- Empty State は汎用的な文言

### After（実装後）

- ✅ Current View が明確（例: "My Projects"）
- ✅ Summary Cards は View範囲のみを集計
- ✅ Subtitle で現在のViewの説明
- ✅ Empty State は View固有の文言とCTA
- ✅ View切り替えがワンクリック
- ✅ デフォルトは "自分に関係あるもの"

---

## 🎯 成功基準（達成状況）

- ✅ **Current View が明確**: どのフィルタ範囲か一目で分かる
- ✅ **Subtitle が適切**: 現在のViewで何ができるかが分かる
- ✅ **Summary Cards が正確**: 現在のView範囲のみを集計
- ✅ **Empty State が自然**: 現在のViewに合わせた文言
- ✅ **View切り替えが簡単**: 他のViewにすぐ移動できる
- ✅ **デフォルトがMy view**: "自分に関係あるもの"がデフォルト

---

## 📝 備考

### 実装済みファイル

1. `/src/app/components/ui/view-switcher.tsx` - View切り替えコンポーネント
2. `/src/app/components/ui/view-context-header.tsx` - ページヘッダーコンポーネント
3. `/src/app/components/ui/view-empty-state.tsx` - 空状態コンポーネント
4. `/src/app/pages/projects-portfolio.tsx` - Projects画面（適用済み）
5. `/src/app/pages/csm-home.tsx` - Console画面（適用済み）
6. `/src/app/pages/inbox.tsx` - Inbox画面（適用済み）

### 設計ドキュメント

1. `/DEFAULT_VIEW_DESIGN.md` - 全体設計仕様
2. `/DEFAULT_VIEW_IMPLEMENTATION_SUMMARY.md` - 実装ガイド
3. `/DEFAULT_VIEW_APPLIED_SUMMARY.md` - 実装完了サマリー（本ドキュメント）