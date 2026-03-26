# Default View 設計 - 各ホーム画面の統一ルール

## 🎯 基本方針

### 前提
- 各画面の初期表示は**自分に関係あるもの**に絞られた状態をデフォルトにする
- Current View、subtitle、summary cards、empty state が **default view に応じて変わる**
- 「何が表示されている画面か」が一目で分かるようにする

### UI要素の設計
1. **ページ名**：短く固定（例：Company, Projects, Actions）
2. **Current View**：現在のフィルタ範囲を明示（例：My Companies, All Companies）
3. **Subtitle**：現在のViewで何ができるかを説明
4. **Summary Cards**：現在のView範囲のみを集計
5. **Empty State**：現在のViewに合わせた自然な文言
6. **View Switcher**：他のViewへ簡単に切り替え

---

## 📊 画面別設計仕様

### 1. Console

#### 固定ページ名
```
Console
```

#### Current View 候補
| View | デフォルト | 説明 |
|------|-----------|------|
| **My Accounts** | ✅ | 自分の担当顧客のみ |
| My Priorities | | 優先度が高い顧客のみ |
| Team View | | チーム全体の担当顧客 |
| All Accounts | | 全顧客 |

#### Subtitle 候補
```typescript
const subtitles = {
  "My Accounts": "自分の担当顧客の状況と優先度を俯瞰する",
  "My Priorities": "今優先して見るべき顧客と案件を確認する",
  "Team View": "チーム全体で優先対応が必要な顧客を確認する",
  "All Accounts": "全顧客を横断して重要な動きを確認する",
};
```

#### Summary Cards の対象範囲
- **My Accounts**：自分担当顧客のみを集計
- **My Priorities**：優先度条件に合う顧客のみを集計
- **Team View**：チーム担当顧客のみを集計
- **All Accounts**：全顧客を集計

#### Empty State 文言
```typescript
const emptyStates = {
  "My Accounts": {
    title: "担当顧客はまだありません",
    description: "顧客が割り当てられると、ここに表示されます",
    cta: "All Accounts を見る",
  },
  "My Priorities": {
    title: "現在、優先対応が必要な顧客はありません",
    description: "優先度が高い顧客が発生すると、ここに表示されます",
    cta: "My Accounts を見る",
  },
  "Team View": {
    title: "チーム対象の顧客はまだありません",
    description: "チームに顧客が割り当てられると、ここに表示されます",
    cta: "All Accounts を見る",
  },
  "All Accounts": {
    title: "顧客がまだ登録されていません",
    description: "顧客データが同期されると、ここに表示されます",
    cta: null,
  },
};
```

---

### 2. Company

#### 固定ページ名
```
Company
```

#### Current View 候補
| View | デフォルト | 説明 |
|------|-----------|------|
| **My Companies** | ✅ | 自分の担当企業のみ |
| Assigned Companies | | 割り当てられた企業 |
| At Risk | | リスクが高い企業 |
| All Companies | | 全企業 |

#### Subtitle 候補
```typescript
const subtitles = {
  "My Companies": "自分の担当企業の状況と優先度を確認する",
  "Assigned Companies": "割り当てられた企業を優先度順に確認する",
  "At Risk": "リスクが高い企業を優先的に確認する",
  "All Companies": "全企業を横断で確認する",
};
```

#### Summary Cards の対象範囲
- **My Companies**：自分担当企業のみを集計
  - At Risk in My Companies: 3社
  - Need Follow-up in My Companies: 5社
  - Total in My Companies: 12社

- **Assigned Companies**：割り当て対象企業のみを集計
  - At Risk in Assigned: 8社
  - Need Follow-up in Assigned: 15社
  - Total Assigned: 35社

- **All Companies**：全企業を集計
  - At Risk (All): 25社
  - Need Follow-up (All): 50社
  - Total Companies: 150社

#### Empty State 文言
```typescript
const emptyStates = {
  "My Companies": {
    title: "担当企業はまだありません",
    description: "企業が割り当てられると、ここに表示されます",
    cta: "All Companies を見る",
  },
  "Assigned Companies": {
    title: "割り当てられた企業はまだありません",
    description: "企業が割り当てられると、ここに表示されます",
    cta: "All Companies を見る",
  },
  "At Risk": {
    title: "現在、リスクが高い企業はありません",
    description: "リスク条件に該当する企業が発生すると、ここに表示されます",
    cta: "My Companies を見る",
  },
  "All Companies": {
    title: "企業がまだ登録されていません",
    description: "企業データが同期されると、ここに表示されます",
    cta: null,
  },
};
```

---

### 3. Projects

#### 固定ページ名
```
Projects
```

#### Current View 候補
| View | デフォルト | 説明 |
|------|-----------|------|
| **My Projects** | ✅ | 自分の担当Projectのみ |
| At Risk Projects | | リスクが高いProject |
| Opportunity Projects | | 機会が大きいProject |
| All Projects | | 全Project |

#### Subtitle 候補
```typescript
const subtitles = {
  "My Projects": "自分の担当Projectの状況と優先度を確認する",
  "At Risk Projects": "リスクが高いProjectを優先的に確認する",
  "Opportunity Projects": "機会が大きいProject群を把握する",
  "All Projects": "すべてのProjectを横断して確認する",
};
```

#### Summary Cards の対象範囲
- **My Projects**：自分担当顧客に紐づくProjectのみを集計
  - At Risk in My Projects: 2件
  - Opportunity in My Projects: 4件
  - Total in My Projects: 15件

- **At Risk Projects**：リスク条件に合うProjectのみを集計
  - Critical Risk: 5件
  - High Risk: 12件
  - Total At Risk: 17件

- **Opportunity Projects**：機会条件に合うProjectのみを集計
  - High Opportunity: 8件
  - Medium Opportunity: 15件
  - Total Opportunity: 23件

- **All Projects**：全Projectを集計
  - At Risk (All): 25件
  - Opportunity (All): 40件
  - Total Projects: 120件

#### Empty State 文言
```typescript
const emptyStates = {
  "My Projects": {
    title: "担当Projectはまだありません",
    description: "Projectが割り当てられると、ここに表示されます",
    cta: "All Projects を見る",
  },
  "At Risk Projects": {
    title: "現在、リスクが高いProjectはありません",
    description: "リスク条件に該当するProjectが発生すると、ここに表示されます",
    cta: "My Projects を見る",
  },
  "Opportunity Projects": {
    title: "現在、大きな機会があるProjectはありません",
    description: "機会条件に該当するProjectが発生すると、ここに表示されます",
    cta: "My Projects を見る",
  },
  "All Projects": {
    title: "Projectがまだ登録されていません",
    description: "Projectデータが同期されると、ここに表示されます",
    cta: null,
  },
};
```

---

### 4. Actions

#### 固定ページ名
```
Actions
```

#### Current View 候補
| View | デフォルト | 説明 |
|------|-----------|------|
| **My Actions** | ✅ | 自分が作成/担当 |
| Assigned to me | | 自分に割り当て |
| Overdue | | 期限超過 |
| All Actions | | 全Action |

#### Subtitle 候補
```typescript
const subtitles = {
  "My Actions": "自分が作成または担当しているActionを確認する",
  "Assigned to me": "自分に割り当てられたActionを確認する",
  "Overdue": "期限超過のActionを優先的に確認する",
  "All Actions": "すべてのActionを横断して確認する",
};
```

#### Summary Cards の対象範囲
- **My Actions**：自分が作成/ownerのActionのみを集計
  - Pending in My Actions: 8件
  - Overdue in My Actions: 2件
  - Completed in My Actions: 15件

- **Assigned to me**：自分に割り当てられたActionのみを集計
  - Pending (Assigned): 12件
  - Overdue (Assigned): 3件
  - Total Assigned: 15件

- **Overdue**：期限超過のActionのみを集計
  - Critical Overdue: 5件
  - Overdue 1-7 days: 8件
  - Total Overdue: 13件

- **All Actions**：全Actionを集計
  - Pending (All): 45件
  - Overdue (All): 13件
  - Total Actions: 120件

#### Empty State 文言
```typescript
const emptyStates = {
  "My Actions": {
    title: "自分のActionはまだありません",
    description: "Actionを作成すると、ここに表示されます",
    cta: "新規Action作成",
  },
  "Assigned to me": {
    title: "自分に割り当てられたActionはありません",
    description: "Actionが割り当てられると、ここに表示されます",
    cta: "My Actions を見る",
  },
  "Overdue": {
    title: "期限超過のActionはありません",
    description: "期限超過のActionが発生すると、ここに表示されます",
    cta: "My Actions を見る",
  },
  "All Actions": {
    title: "Actionがまだ作成されていません",
    description: "Actionが作成されると、ここに表示されます",
    cta: "新規Action作成",
  },
};
```

---

### 5. Content

#### 固定ページ名
```
Content
```

#### Current View 候補
| View | デフォルト | 説明 |
|------|-----------|------|
| **My Content** | ✅ | 自分が作成/管理 |
| My Drafts | | 下書き状態 |
| Review Queue | | 確認が必要 |
| All Content | | 全Content |

#### Subtitle 候補
```typescript
const subtitles = {
  "My Content": "自分が作成・管理している作業中コンテンツを確認する",
  "My Drafts": "下書き状態のコンテンツを優先して確認する",
  "Review Queue": "確認が必要なコンテンツを確認する",
  "All Content": "すべての作業中コンテンツを横断して確認する",
};
```

#### Summary Cards の対象範囲
- **My Content**：自分が作成/ownerのContentのみを集計
  - Draft in My Content: 5件
  - In Review in My Content: 3件
  - Total in My Content: 12件

- **My Drafts**：自分の下書きContentのみを集計
  - Drafts created today: 2件
  - Drafts older than 7 days: 3件
  - Total Drafts: 8件

- **Review Queue**：確認待ちContentのみを集計
  - Needs Review: 6件
  - In Review: 4件
  - Total Review Queue: 10件

- **All Content**：全Contentを集計
  - Draft (All): 25件
  - In Review (All): 15件
  - Total Content: 80件

#### Empty State 文言
```typescript
const emptyStates = {
  "My Content": {
    title: "自分のContentはまだありません",
    description: "Contentを作成すると、ここに表示されます",
    cta: "新規Content作成",
  },
  "My Drafts": {
    title: "下書き中のContentはありません",
    description: "下書きを保存すると、ここに表示されます",
    cta: "新規Content作成",
  },
  "Review Queue": {
    title: "確認待ちのContentはありません",
    description: "確認が必要なContentが発生すると、ここに表示されます",
    cta: "My Content を見る",
  },
  "All Content": {
    title: "Contentがまだ作成されていません",
    description: "Contentが作成されると、ここに表示されます",
    cta: "新規Content作成",
  },
};
```

---

### 6. Outbound

#### 固定ページ名
```
Outbound
```

#### Current View 候補
| View | デフォルト | 説明 |
|------|-----------|------|
| **My Outbound** | ✅ | 自分が作成/担当 |
| Drafts | | 下書き中 |
| Ready to Send | | 送信準備完了 |
| Sent | | 送信済み |
| Failed | | 配信失敗 |

#### Subtitle 候補
```typescript
const subtitles = {
  "My Outbound": "自分が作成・担当しているOutboundを確認する",
  "Drafts": "下書き中のOutboundを確認する",
  "Ready to Send": "送信準備が整ったOutboundを確認する",
  "Sent": "送信済みのOutboundを確認する",
  "Failed": "配信失敗や要確認のOutboundを確認する",
};
```

#### Summary Cards の対象範囲
- **My Outbound**：自分が作成/ownerのOutboundのみを集計
  - Draft in My Outbound: 3件
  - Ready in My Outbound: 2件
  - Sent in My Outbound: 15件

- **Drafts**：下書きOutboundのみを集計
  - Drafts created today: 1件
  - Drafts older than 3 days: 2件
  - Total Drafts: 5件

- **Ready to Send**：送信準備完了Outboundのみを集計
  - Ready today: 3件
  - Ready this week: 5件
  - Total Ready: 8件

- **Sent**：送信済みOutboundのみを集計
  - Sent today: 5件
  - Sent this week: 20件
  - Total Sent: 80件

- **Failed**：配信失敗Outboundのみを集計
  - Failed (Retrying): 2件
  - Failed (Needs Action): 3件
  - Total Failed: 5件

#### Empty State 文言
```typescript
const emptyStates = {
  "My Outbound": {
    title: "自分のOutboundはまだありません",
    description: "Outboundを作成すると、ここに表示されます",
    cta: "新規Outbound作成",
  },
  "Drafts": {
    title: "下書き中のOutboundはありません",
    description: "下書きを保存すると、ここに表示されます",
    cta: "新規Outbound作成",
  },
  "Ready to Send": {
    title: "送信準備が整ったOutboundはありません",
    description: "送信準備が完了すると、ここに表示されます",
    cta: "Drafts を見る",
  },
  "Sent": {
    title: "送信済みのOutboundはまだありません",
    description: "Outboundを送信すると、ここに表示されます",
    cta: "My Outbound を見る",
  },
  "Failed": {
    title: "現在、配信失敗中のOutboundはありません",
    description: "配信失敗が発生すると、ここに表示されます",
    cta: "My Outbound を見る",
  },
};
```

---

### 7. Audience

#### 固定ページ名
```
Audience
```

#### Current View 候補
| View | デフォルト | 説明 |
|------|-----------|------|
| **My Audiences** | ✅ | 自分が作成 |
| Recently Used | | 最近使用 |
| Shared Audiences | | 共有Audience |
| All Audiences | | 全Audience |

#### Subtitle 候補
```typescript
const subtitles = {
  "My Audiences": "自分が作成したAudienceを確認する",
  "Recently Used": "最近使用したAudienceを確認する",
  "Shared Audiences": "共有Audienceを確認する",
  "All Audiences": "すべてのAudienceを横断して確認する",
};
```

#### Summary Cards の対象範囲
- **My Audiences**：自分が作成したAudienceのみを集計
  - Active in My Audiences: 8件
  - Total in My Audiences: 12件
  - Total Recipients: 450人

- **Recently Used**：最近使用したAudienceのみを集計
  - Used this week: 5件
  - Used this month: 10件
  - Total Recently Used: 10件

- **Shared Audiences**：共有Audienceのみを集計
  - Team Shared: 6件
  - Organization Shared: 8件
  - Total Shared: 14件

- **All Audiences**：全Audienceを集計
  - Active (All): 35件
  - Total Audiences: 50件
  - Total Recipients: 2,500人

#### Empty State 文言
```typescript
const emptyStates = {
  "My Audiences": {
    title: "自分のAudienceはまだありません",
    description: "Audienceを作成すると、ここに表示されます",
    cta: "新規Audience作成",
  },
  "Recently Used": {
    title: "最近使用したAudienceはありません",
    description: "Audienceを使用すると、ここに表示されます",
    cta: "My Audiences を見る",
  },
  "Shared Audiences": {
    title: "共有Audienceはありません",
    description: "共有Audienceが作成されると、ここに表示されます",
    cta: "My Audiences を見る",
  },
  "All Audiences": {
    title: "Audienceがまだ作成されていません",
    description: "Audienceが作成されると、ここに表示されます",
    cta: "新規Audience作成",
  },
};
```

---

### 8. Inbox

#### 固定ページ名
```
Inbox
```

#### Current View / Queue 候補
| Queue | デフォルト | 説明 |
|------|-----------|------|
| **Assigned to me** | ✅ | 自分に割り当て |
| My team | ✅ | チーム対応 |
| Related to my accounts | ✅ | 担当顧客関連 |
| Unassigned | ✅ | 未割り当て |

#### Subtitle 候補
```typescript
const subtitles = {
  "Assigned to me": "自分に割り当てられた受信項目を確認する",
  "My team": "チームで対応すべき受信項目を確認する",
  "Unassigned": "まだ担当が決まっていない受信項目を確認する",
  "Related to my accounts": "自分の担当顧客に関連する受信項目を確認する",
};
```

#### Summary Cards の対象範囲
- **Assigned to me**：自分に割り当てられた項目のみを集計
  - Unread (Assigned to me): 5件
  - Needs Response (Assigned to me): 3件
  - Total Assigned to me: 12件

- **My team**：チーム対応項目のみを集計
  - Unread (Team): 15件
  - Needs Response (Team): 8件
  - Total Team Inbox: 35件

- **Unassigned**：未割り当て項目のみを集計
  - Unread (Unassigned): 8件
  - Needs Triage: 10件
  - Total Unassigned: 18件

- **Related to my accounts**：担当顧客関連項目のみを集計
  - From My Accounts: 20件
  - Needs Attention: 5件
  - Total Related: 25件

#### Empty State 文言
```typescript
const emptyStates = {
  "Assigned to me": {
    title: "自分に割り当てられた受信項目はありません",
    description: "項目が割り当てられると、ここに表示されます",
    cta: "Unassigned を見る",
  },
  "My team": {
    title: "チーム対応中の受信項目はありません",
    description: "チーム対応項目が発生すると、ここに表示されます",
    cta: "Assigned to me を見る",
  },
  "Unassigned": {
    title: "未割り当ての受信項目はありません",
    description: "新しい受信項目が発生すると、ここに表示されます",
    cta: null,
  },
  "Related to my accounts": {
    title: "担当顧客に関連する受信項目はありません",
    description: "担当顧客からの受信項目が発生すると、ここに表示されます",
    cta: "Assigned to me を見る",
  },
};
```

---

## 🎨 UI コンポーネント設計

### View Switcher Component

```typescript
interface ViewSwitcherProps {
  currentView: string;
  availableViews: string[];
  onViewChange: (view: string) => void;
}

// 使用例
<ViewSwitcher 
  currentView="My Companies"
  availableViews={["My Companies", "Assigned Companies", "At Risk", "All Companies"]}
  onViewChange={(view) => setCurrentView(view)}
/>
```

### Summary Card Component

```typescript
interface SummaryCardProps {
  title: string; // 現在のView範囲を含む (例: "At Risk in My Projects")
  value: number;
  change?: {
    value: number;
    direction: "up" | "down";
    period: string;
  };
  viewScope: string; // 現在のView
}

// 使用例
<SummaryCard 
  title="At Risk in My Projects"
  value={3}
  change={{ value: 1, direction: "up", period: "vs last week" }}
  viewScope="My Projects"
/>
```

### Empty State Component

```typescript
interface EmptyStateProps {
  title: string;
  description: string;
  cta?: {
    label: string;
    action: () => void;
  };
  currentView: string;
}

// 使用例
<EmptyState 
  title="担当企業はまだありません"
  description="企業が割り当てられると、ここに表示されます"
  cta={{ 
    label: "All Companies を見る", 
    action: () => setView("All Companies") 
  }}
  currentView="My Companies"
/>
```

### View Context Breadcrumb

```typescript
interface ViewContextProps {
  pageName: string; // 固定ページ名
  currentView: string; // 現在のView
  subtitle: string; // 現在のViewのsubtitle
}

// 使用例
<ViewContext 
  pageName="Company"
  currentView="My Companies"
  subtitle="自分の担当企業の状況と優先度を確認する"
/>
```

---

## 🔧 実装パターン

### 各画面の基本構造

```typescript
function CompanyPage() {
  const [currentView, setCurrentView] = useState("My Companies"); // デフォルトView
  
  // View定義
  const viewConfig = {
    "My Companies": {
      subtitle: "自分の担当企業の状況と優先度を確認する",
      filter: (company) => company.ownerId === currentUser.id,
      summaryScope: "my",
      emptyState: {
        title: "担当企業はまだありません",
        description: "企業が割り当てられると、ここに表示されます",
        cta: "All Companies を見る",
      },
    },
    "All Companies": {
      subtitle: "全企業を横断で確認する",
      filter: (company) => true,
      summaryScope: "all",
      emptyState: {
        title: "企業がまだ登録されていません",
        description: "企業データが同期されると、ここに表示されます",
        cta: null,
      },
    },
    // ... 他のView
  };
  
  const config = viewConfig[currentView];
  const filteredData = allData.filter(config.filter);
  const summaryData = calculateSummary(filteredData, config.summaryScope);
  
  return (
    <div>
      {/* Header */}
      <PageHeader 
        title="Company"
        currentView={currentView}
        subtitle={config.subtitle}
      />
      
      {/* View Switcher */}
      <ViewSwitcher 
        currentView={currentView}
        availableViews={Object.keys(viewConfig)}
        onViewChange={setCurrentView}
      />
      
      {/* Summary Cards */}
      <SummaryCards data={summaryData} viewScope={currentView} />
      
      {/* Data List or Empty State */}
      {filteredData.length > 0 ? (
        <DataList data={filteredData} />
      ) : (
        <EmptyState {...config.emptyState} currentView={currentView} />
      )}
    </div>
  );
}
```

---

## 📋 実装チェックリスト

### 優先度：高
- [ ] Company: Current View / subtitle / summary cards / empty state
- [ ] Projects: Current View / subtitle / summary cards / empty state
- [ ] Console: Current View / subtitle / summary cards / empty state
- [ ] Inbox: Current Queue / subtitle / summary cards / empty state

### 優先度：中
- [ ] Actions: Current View / subtitle / summary cards / empty state
- [ ] Content: Current View / subtitle / summary cards / empty state
- [ ] Outbound: Current View / subtitle / summary cards / empty state
- [ ] Audience: Current View / subtitle / summary cards / empty state

### 共通コンポーネント
- [ ] ViewSwitcher component
- [ ] ViewContext breadcrumb component
- [ ] EmptyState component (view-aware)
- [ ] SummaryCard component (view-scope aware)

---

## 🎯 成功基準

各画面で以下が達成されていること：

1. ✅ **Current Viewが明確**：どのフィルタ範囲か一目で分かる
2. ✅ **Subtitleが適切**：現在のViewで何ができるかが分かる
3. ✅ **Summary Cardsが正確**：現在のView範囲のみを集計
4. ✅ **Empty Stateが自然**：現在のViewに合わせた文言
5. ✅ **View切り替えが簡単**：他のViewにすぐ移動できる
6. ✅ **デフォルトがMy view**："自分に関係あるもの"がデフォルト

---

## 📚 補足

### なぜ Current View が重要か

- ユーザーは「自分に関係あるもの」と「全体」を頻繁に切り替える
- 今どの範囲を見ているかが明確でないと、データ解釈を誤る
- Summary Cardsが全体集計だと、My viewとの乖離が大きく混乱する

### View設計の原則

1. **デフォルトは My view**：初期表示は自分に関係あるものに絞る
2. **切り替えは簡単に**：View切り替えはワンクリック
3. **範囲を明示**：Current Viewラベルで範囲を明確にする
4. **集計は連動**：Summary CardsはView範囲に連動
5. **Empty Stateは親切**：次のアクションを示唆する
