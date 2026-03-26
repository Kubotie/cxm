# Default View実装サマリー

## ✅ 完了した作業

### 1. 設計ドキュメント作成
**ファイル**: `/DEFAULT_VIEW_DESIGN.md`

全8画面（Console, Company, Projects, Actions, Content, Outbound, Audience, Inbox）の以下を定義：
- 固定ページ名
- Current View候補
- Subtitle候補
- Summary Cardsの対象範囲
- Empty State文言
- UI要素の連動ルール

### 2. 共通UIコンポーネント作成

#### ViewSwitcher Component ✅
**ファイル**: `/src/app/components/ui/view-switcher.tsx`

**機能**:
- View選択ドロップダウン
- Default Viewバッジ表示
- View説明表示

**使用例**:
```typescript
<ViewSwitcher
  currentView="My Companies"
  views={[
    { value: "my", label: "My Companies", description: "自分の担当企業", isDefault: true },
    { value: "all", label: "All Companies", description: "全企業" },
  ]}
  onViewChange={(view) => setCurrentView(view)}
/>
```

#### ViewContextHeader Component ✅
**ファイル**: `/src/app/components/ui/view-context-header.tsx`

**機能**:
- ページ名とCurrent Viewを並べて表示
- Subtitleで現在のViewの説明

**使用例**:
```typescript
<ViewContextHeader
  pageName="Company"
  currentView="My Companies"
  subtitle="自分の担当企業の状況と優先度を確認する"
/>
```

#### ViewEmptyState Component ✅
**ファイル**: `/src/app/components/ui/view-empty-state.tsx`

**機能**:
- 現在のViewに合わせた空状態メッセージ
- 次のアクションへのCTA

**使用例**:
```typescript
<ViewEmptyState
  title="担当企業はまだありません"
  description="企業が割り当てられると、ここに表示されます"
  currentView="My Companies"
  cta={{
    label: "All Companies を見る",
    action: () => setCurrentView("all")
  }}
/>
```

---

## 📋 次のステップ：各画面への適用

### 優先度：高（必須実装）

#### 1. Projects Portfolio ⏳
**ファイル**: `/src/app/pages/projects-portfolio.tsx`

**修正内容**:
- [ ] View State追加（デフォルト: "My Projects"）
- [ ] ViewSwitcher追加
- [ ] ViewContextHeader追加
- [ ] Summary Cardsをフィルタ範囲で集計
- [ ] ViewEmptyState追加

**View候補**:
```typescript
const views = [
  { value: "my", label: "My Projects", description: "自分の担当Project", isDefault: true },
  { value: "at-risk", label: "At Risk Projects", description: "リスクが高いProject" },
  { value: "opportunity", label: "Opportunity Projects", description: "機会が大きいProject" },
  { value: "all", label: "All Projects", description: "全Project" },
];
```

**フィルタロジック**:
```typescript
const filterProjects = (projects, view, currentUser) => {
  switch (view) {
    case "my":
      return projects.filter(p => p.ownerId === currentUser.id);
    case "at-risk":
      return projects.filter(p => p.riskLevel === "high");
    case "opportunity":
      return projects.filter(p => p.opportunityLevel === "high");
    case "all":
    default:
      return projects;
  }
};
```

#### 2. CSM Home (Console) ⏳
**ファイル**: `/src/app/pages/csm-home.tsx`

**修正内容**:
- [ ] View State追加（デフォルト: "My Accounts"）
- [ ] ViewSwitcher追加
- [ ] ViewContextHeader追加
- [ ] Summary Cardsをフィルタ範囲で集計
- [ ] ViewEmptyState追加

**View候補**:
```typescript
const views = [
  { value: "my", label: "My Accounts", description: "自分の担当顧客", isDefault: true },
  { value: "priority", label: "My Priorities", description: "優先対応が必要な顧客" },
  { value: "team", label: "Team View", description: "チーム全体の担当顧客" },
  { value: "all", label: "All Accounts", description: "全顧客" },
];
```

#### 3. Inbox ⏳
**ファイル**: `/src/app/pages/inbox.tsx`

**修正内容**:
- [ ] Queue State追加（デフォルト: "Assigned to me"）
- [ ] ViewSwitcher追加（Queue切り替え）
- [ ] ViewContextHeader追加
- [ ] Summary CardsをQueue範囲で集計
- [ ] ViewEmptyState追加

**Queue候補**:
```typescript
const queues = [
  { value: "assigned", label: "Assigned to me", description: "自分に割り当て", isDefault: true },
  { value: "team", label: "My team", description: "チーム対応", isDefault: true },
  { value: "related", label: "Related to my accounts", description: "担当顧客関連", isDefault: true },
  { value: "unassigned", label: "Unassigned", description: "未割り当て", isDefault: true },
];
```

---

### 優先度：中（段階的実装）

#### 4. Actions ⏳
**ファイル**: `/src/app/pages/action-review.tsx`

**View候補**:
- My Actions（デフォルト）
- Assigned to me
- Overdue
- All Actions

#### 5. Content ⏳
**ファイル**: `/src/app/pages/content-jobs.tsx`

**View候補**:
- My Content（デフォルト）
- My Drafts
- Review Queue
- All Content

#### 6. Outbound ⏳
**ファイル**: `/src/app/pages/outbound-list.tsx`

**View候補**:
- My Outbound（デフォルト）
- Drafts
- Ready to Send
- Sent
- Failed

#### 7. Audience ⏳
**ファイル**: `/src/app/pages/audience.tsx` または `/src/app/pages/audience-workspace.tsx`

**View候補**:
- My Audiences（デフォルト）
- Recently Used
- Shared Audiences
- All Audiences

---

## 🔧 実装パターン

### 基本構造

```typescript
import { useState } from "react";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";

function ProjectsPortfolio() {
  // View State
  const [currentView, setCurrentView] = useState("my"); // デフォルト: My Projects
  
  // View定義
  const views = [
    { value: "my", label: "My Projects", description: "自分の担当Project", isDefault: true },
    { value: "at-risk", label: "At Risk Projects", description: "リスクが高いProject" },
    { value: "opportunity", label: "Opportunity Projects", description: "機会が大きいProject" },
    { value: "all", label: "All Projects", description: "全Project" },
  ];
  
  // View設定
  const viewConfig = {
    my: {
      subtitle: "自分の担当Projectの状況と優先度を確認する",
      filter: (project) => project.ownerId === currentUser.id,
      emptyState: {
        title: "担当Projectはまだありません",
        description: "Projectが割り当てられると、ここに表示されます",
        cta: { label: "All Projects を見る", action: () => setCurrentView("all") },
      },
    },
    "at-risk": {
      subtitle: "リスクが高いProjectを優先的に確認する",
      filter: (project) => project.riskLevel === "high",
      emptyState: {
        title: "現在、リスクが高いProjectはありません",
        description: "リスク条件に該当するProjectが発生すると、ここに表示されます",
        cta: { label: "My Projects を見る", action: () => setCurrentView("my") },
      },
    },
    opportunity: {
      subtitle: "機会が大きいProject群を把握する",
      filter: (project) => project.opportunityLevel === "high",
      emptyState: {
        title: "現在、大きな機会があるProjectはありません",
        description: "機会条件に該当するProjectが発生すると、ここに表示されます",
        cta: { label: "My Projects を見る", action: () => setCurrentView("my") },
      },
    },
    all: {
      subtitle: "すべてのProjectを横断して確認する",
      filter: (project) => true,
      emptyState: {
        title: "Projectがまだ登録されていません",
        description: "Projectデータが同期されると、ここに表示されます",
        cta: null,
      },
    },
  };
  
  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";
  
  // データフィルタリング
  const filteredProjects = allProjects.filter(config.filter);
  
  // Summary Cards集計（フィルタ後のデータのみ）
  const summaryData = {
    atRisk: filteredProjects.filter(p => p.riskLevel === "high").length,
    opportunity: filteredProjects.filter(p => p.opportunityLevel === "high").length,
    total: filteredProjects.length,
  };
  
  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
            
            {/* Header with Current View */}
            <ViewContextHeader
              pageName="Projects"
              currentView={currentViewLabel}
              subtitle={config.subtitle}
            />
            
            {/* View Switcher */}
            <ViewSwitcher
              currentView={currentView}
              views={views}
              onViewChange={setCurrentView}
            />
            
            {/* Summary Cards（フィルタ範囲のみ集計） */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-600">
                    At Risk in {currentViewLabel}
                  </CardTitle>
                  <div className="text-2xl font-bold">{summaryData.atRisk}</div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Opportunity in {currentViewLabel}
                  </CardTitle>
                  <div className="text-2xl font-bold">{summaryData.opportunity}</div>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Total in {currentViewLabel}
                  </CardTitle>
                  <div className="text-2xl font-bold">{summaryData.total}</div>
                </CardHeader>
              </Card>
            </div>
            
            {/* Data List or Empty State */}
            {filteredProjects.length > 0 ? (
              <div className="space-y-4">
                {filteredProjects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <ViewEmptyState
                title={config.emptyState.title}
                description={config.emptyState.description}
                currentView={currentViewLabel}
                cta={config.emptyState.cta}
              />
            )}
            
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## 📊 View設定の構造化

### viewConfig オブジェクト

各Viewに対して以下を定義：

```typescript
interface ViewConfig {
  subtitle: string; // Viewの説明
  filter: (item: any) => boolean; // フィルタ関数
  emptyState: {
    title: string;
    description: string;
    cta: {
      label: string;
      action: () => void;
    } | null;
  };
}
```

---

## 🎯 実装のポイント

### 1. Summary Cardsは必ずフィルタ範囲で集計

❌ **NG**:
```typescript
// 常に全データを集計（Viewに関係なく）
const atRiskCount = allProjects.filter(p => p.riskLevel === "high").length;
```

✅ **OK**:
```typescript
// フィルタ後のデータのみを集計
const filteredProjects = allProjects.filter(config.filter);
const atRiskCount = filteredProjects.filter(p => p.riskLevel === "high").length;
```

### 2. Summary Card Titleに範囲を明示

❌ **NG**:
```typescript
<CardTitle>At Risk</CardTitle>
```

✅ **OK**:
```typescript
<CardTitle>At Risk in {currentViewLabel}</CardTitle>
// 例: "At Risk in My Projects"
```

### 3. Empty StateはView固有の文言

❌ **NG**:
```typescript
<EmptyState title="データがありません" />
```

✅ **OK**:
```typescript
<ViewEmptyState
  title="担当Projectはまだありません"
  description="Projectが割り当てられると、ここに表示されます"
  currentView="My Projects"
  cta={{ label: "All Projects を見る", action: () => setCurrentView("all") }}
/>
```

### 4. デフォルトViewは "My" 系

```typescript
const [currentView, setCurrentView] = useState("my"); // デフォルト
```

---

## ✅ 実装チェックリスト

各画面で以下を確認：

- [ ] View State が "my" 系デフォルト
- [ ] ViewSwitcher コンポーネント設置
- [ ] ViewContextHeader コンポーネント設置
- [ ] Summary Cards がフィルタ範囲で集計
- [ ] Summary Card Title に範囲明示（"in {currentViewLabel}"）
- [ ] ViewEmptyState コンポーネント設置
- [ ] Empty State がView固有の文言
- [ ] CTAで他のViewへ遷移可能

---

## 📚 補足資料

### Settings との連携（将来実装）

Settings画面の "Default Views / Personal Default Filters" で設定したデフォルトViewを、各画面の初期表示に反映：

```typescript
// 将来の実装例
const userSettings = useUserSettings();
const [currentView, setCurrentView] = useState(
  userSettings.defaultViews?.projects || "my"
);
```

### URL State との連携（将来実装）

URLパラメータでViewを保持し、共有可能に：

```typescript
// 将来の実装例
const [searchParams, setSearchParams] = useSearchParams();
const currentView = searchParams.get("view") || "my";

const handleViewChange = (view) => {
  setSearchParams({ view });
};
```

---

## 🚀 次のアクション

1. **Projects Portfolio** から実装開始（優先度：高）
2. **CSM Home (Console)** を実装（優先度：高）
3. **Inbox** を実装（優先度：高）
4. 他の画面を段階的に実装（優先度：中）
5. Settings連携を追加（将来）
6. URL State連携を追加（将来）

---

## 📝 実装済み

- ✅ 設計ドキュメント作成
- ✅ ViewSwitcher Component
- ✅ ViewContextHeader Component
- ✅ ViewEmptyState Component

## 🔄 実装中

現在作業なし

## ⏳ 実装待ち

- Projects Portfolio への適用
- CSM Home への適用
- Inbox への適用
- Actions への適用
- Content への適用
- Outbound への適用
- Audience への適用
