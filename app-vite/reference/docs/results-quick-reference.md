# Results画面 Source Context別クイックリファレンス

> **実装者向け**: 各Source Contextで何を優先表示し、どう判断するかの簡潔なガイド

---

## 効果の3段階評価（全Source Context共通）

```
1. 配信結果     → Sent / Failed / Unresolved
2. 接点反応     → Reply / Open / Click / Status Change
3. 次アクション → Follow-up / 再設計 / 深掘り
```

---

## 1. From Inbox

**効果 = 問い合わせ解消**

```typescript
// 優先表示順序
1. チケット状態変化        // Open → Resolved が最重要
2. 顧客返信有無           // Reply内容プレビュー
3. 解決時間              // 受信〜解決までの時間
4. 再オープン可能性       // リスク評価
```

**クイックスタット例**
```
✅ 送信成功: 1件
💬 顧客返信: あり (2時間後)
📊 状態: Open → Resolved
⚠️ 再オープンリスク: 低
```

**次アクション優先順**
```
1. [Inboxに戻る]
2. [Follow-up Actionを作成]  ← 未解決時
3. [Help/FAQ化]             ← よくある質問時
4. [Userを見る]
```

**避けるべき表示**
- ❌ Open Rate を最優先表示
- ❌ キャンペーン指標中心
- ❌ セグメント分析

---

## 2. From Company

**効果 = Company全体の温度感向上**

```typescript
// 優先表示順序
1. Company全体反応率      // 全体サマリー
2. 反応Project数/User数   // 内訳
3. Health Score変化       // 65 → 72 (+7)
4. Project別反応差        // どこが高反応か
```

**クイックスタット例**
```
✅ 送信: 12名/12名
📊 反応率: 58% (7名)
💼 反応Project: 2/3件
📈 Health: 65→72 (+7)
```

**次アクション優先順**
```
1. [Company Detailに戻る]
2. [高反応Projectへ深掘る]
3. [無反応Userへ個別フォロー]
4. [Audienceで再設計]
```

**避けるべき表示**
- ❌ User個票のみで評価
- ❌ Project単独の結果だけ強調
- ❌ Health Score変化を表示しない

---

## 3. From Project

**効果 = Project前進**

```typescript
// 優先表示順序
1. Project Status変化     // Health, Phase
2. User別反応率          // 誰が反応したか
3. Phase遷移有無         // Adoption→Activation
4. Risk/Opportunity変化  // 改善兆候
```

**クイックスタット例**
```
✅ 送信: 5名/5名
📊 反応率: 80% (4名)
📈 Health: 68→75 (+7)
🎯 Phase: Adoption→Activation
```

**次アクション優先順**
```
1. [Project Detailに戻る]
2. [Follow-up Actionを作成]
3. [無反応Userへ個別対応]
4. [Audienceで横展開]
```

**避けるべき表示**
- ❌ Company全体評価のみ
- ❌ Project Status変化が見えない
- ❌ User個別反応が不明

---

## 4. From User

**効果 = User状態改善**

```typescript
// 優先表示順序
1. Reply有無              // 返信内容
2. User状態変化           // ログイン再開、利用開始
3. 反応時間              // Open/Click時刻
4. 次回接触タイミング     // 1週間後推奨
```

**クイックスタット例**
```
✅ 送信成功: 1件
💬 返信: あり (3時間後)
📊 状態変化: ログイン再開
🎯 次回接触: 1週間後
```

**送信前後の状態比較表示**
```
送信前:
• Last Login: 15日前
• 機能利用: なし

送信後:
• ✅ ログイン: 翌日
• ✅ 機能利用: 3件
```

**次アクション優先順**
```
1. [Userへ再接触]
2. [Follow-up Action作成]
3. [Projectに戻る]
4. [Action更新]
```

**避けるべき表示**
- ❌ 集団指標が主役
- ❌ 状態変化が見えない
- ❌ セグメント分析中心

---

## 5. From Audience

**効果 = Segment最適化**

```typescript
// 優先表示順序
1. Segment全体反応率     // 31% (13/42名)
2. 反応の偏り           // Setup 67%, Engagement 13%
3. 高反応群の共通特徴    // 契約3-6ヶ月
4. Segment再設計候補    // 分割/統合提案
```

**クイックスタット例**
```
✅ 送信: 42/45名 (93%)
📊 反応率: 31% (13名)
🎯 高反応: Setup 67%
⚠️ 低反応: Engagement 13%
```

**反応分析テーブル**
```
┌─────────────────────────┐
│ Phase別反応率           │
├─────────────────────────┤
│ Setup: 8/12名 (67%)     │
│ Activation: 3/15 (20%)  │
│ Engagement: 2/15 (13%)  │
└─────────────────────────┘
```

**次アクション優先順**
```
1. [Audienceで再設計]
2. [高反応群にFollow-up]
3. [低反応群を別施策に]
4. [Companyへ深掘る]
```

**避けるべき表示**
- ❌ 個票のみで終わる
- ❌ Segment条件が見えない
- ❌ 偏り分析がない

---

## 6. From Actions

**効果 = Action前進**

```typescript
// 優先表示順序
1. Action Status変化     // In Progress→Completed
2. 目的達成度           // ミーティング日時確定
3. Follow-up必要性      // 完了/保留/継続
4. 完了判断材料         // 顧客反応、証跡
```

**クイックスタット例**
```
✅ 送信成功: 1件
💬 返信: あり (4時間後)
📊 Status: In Progress→Completed
🎯 目的達成: ✅ 日時確定
```

**Action完了判断UI**
```
┌─────────────────────────┐
│ Action完了判断          │
├─────────────────────────┤
│ ✅ 顧客返信: あり       │
│ ✅ 日時確定: 3/20 14:00 │
│ ✅ 目的達成             │
│                         │
│ 🤖 推奨: Action完了可   │
└─────────────────────────┘
```

**次アクション優先順**
```
1. [Actionを完了]
2. [Actionを保留]
3. [Follow-up Outbound作成]
4. [Actionsに戻る]
```

**避けるべき表示**
- ❌ Action情報が消える
- ❌ 送信 = 完了とする
- ❌ 目的達成度が不明

---

## 7. From Content

**効果 = Content有効性**

```typescript
// 優先表示順序
1. 反応率（業界比較）     // Open 68% (平均42%)
2. 再利用推奨度          // ★★★★★
3. Template効果         // Weekly Report効果的
4. 改善候補             // Subject/Body提案
```

**クイックスタット例**
```
✅ 送信: 45/45名
📊 Open: 68% (平均42%)
🖱️ Click: 24% (平均8%)
⭐ 再利用: ★★★★★
```

**業界比較グラフ**
```
Open Rate:  ████████████████ 68%
業界平均:   ████████ 42%

Click Rate: ██████ 24%
業界平均:   ██ 8%
```

**次アクション優先順**
```
1. [Contentを更新]
2. [Libraryに昇格]
3. [別Templateを試す]
4. [Contentに戻る]
```

**避けるべき表示**
- ❌ Content情報が不明
- ❌ 再利用評価がない
- ❌ 改善提案がない

---

## 8. From Library

**効果 = Template資産価値**

```typescript
// 優先表示順序
1. 過去実績との比較      // 今回75% vs 平均58%
2. Template評価更新     // ★★★★★
3. Variables効果       // {{user_name}}効果大
4. Scope別効果         // Project Level最適
```

**クイックスタット例**
```
✅ 送信: 12/12名
📊 Open: 75% (平均58%)
📈 過去最高実績更新!
⭐ 評価: ★★★★★
```

**過去実績比較**
```
┌─────────────────────────┐
│ Template実績            │
├─────────────────────────┤
│ 使用回数: 8回           │
│ 平均Open: 58%           │
│ 今回Open: 75% (+17pt)   │
│ 📈 過去最高!            │
└─────────────────────────┘
```

**次アクション優先順**
```
1. [Libraryを更新]
2. [Contentに落とす]
3. [横展開]
4. [Libraryに戻る]
```

**避けるべき表示**
- ❌ 過去実績比較なし
- ❌ Template評価更新なし
- ❌ 使い捨てで終わる

---

## 実装チェックリスト

### 🔴 P0: 最優先実装

#### **共通基盤**
- [ ] Source Context表示（上部カード）
- [ ] 配信結果サマリー（Sent/Failed/Unresolved）
- [ ] 接点反応サマリー（Open/Click/Reply）
- [ ] 元の文脈への戻りボタン

#### **Source Context別表示**
- [ ] Inbox: チケット状態変化
- [ ] Company: Health Score変化 + Project別差分
- [ ] Project: Project Status変化 + User別反応
- [ ] User: User状態変化（送信前後比較）
- [ ] Audience: Segment別反応 + 偏り分析
- [ ] Actions: Action Status変化 + 完了判断UI
- [ ] Content: 業界平均比較 + 再利用推奨度
- [ ] Library: 過去実績比較 + Template評価

---

### 🟡 P1: 推奨実装

- [ ] AI推奨: 次のアクション
- [ ] Follow-up Action作成導線
- [ ] 再設計導線（Audience/Content/Library）
- [ ] 詳細分析タブ

---

### 🟢 P2: 追加機能

- [ ] A/Bテスト結果分析
- [ ] 統計的有意性検定
- [ ] 自動Segment再設計提案

---

## コンポーネント設計案

```typescript
// Results画面コンポーネント構造

<ResultsPage>
  {/* 上部: Source Context情報カード */}
  <SourceContextCard 
    sourceContext={sourceContext}
    sourceId={sourceId}
  />
  
  {/* 配信結果サマリー */}
  <DeliverySummary
    sent={42}
    failed={0}
    unresolved={3}
  />
  
  {/* Source Context別の効果表示 */}
  {sourceContext === 'inbox' && (
    <InboxEffectiveness
      ticketStatusChange="Open → Resolved"
      reply={replyData}
      resolutionTime="2時間"
    />
  )}
  
  {sourceContext === 'company' && (
    <CompanyEffectiveness
      overallEngagement={58}
      projectBreakdown={projectData}
      healthScoreChange={+7}
    />
  )}
  
  {sourceContext === 'audience' && (
    <AudienceEffectiveness
      segmentAnalysis={segmentData}
      responseDeviation={deviationData}
      redesignSuggestions={suggestions}
    />
  )}
  
  {/* ... 他のSource Context */}
  
  {/* 次アクション推奨 */}
  <NextActionHints
    sourceContext={sourceContext}
    aiRecommendations={recommendations}
  />
  
  {/* アクションボタン */}
  <ActionButtons
    sourceContext={sourceContext}
    onBackToSource={() => navigate(sourceUrl)}
    onCreateFollowUp={() => createAction()}
    onRedesign={() => navigateToRedesign()}
  />
</ResultsPage>
```

---

## データ構造案

```typescript
interface ResultsData {
  // 共通必須
  sourceContext: 'inbox' | 'company' | 'project' | 'user' | 'audience' | 'actions' | 'content' | 'library';
  sourceId: string;
  channel: 'email' | 'slack' | 'intercom' | 'chatwork';
  audienceScope: 'company' | 'project' | 'user';
  sentTime: string;
  
  // 配信結果
  targetCount: number;
  resolvedRecipientsCount: number;
  sentCount: number;
  failedCount: number;
  unresolvedRecipients: UnresolvedRecipient[];
  
  // 接点反応
  openRate: number;
  clickRate: number;
  replyCount: number;
  reactions: Reaction[];
  
  // Linked entities
  linkedCompany?: string[];
  linkedProject?: string[];
  linkedUser?: string[];
  linkedAction?: string;
  linkedContent?: string;
  linkedEvidence?: string[];
  
  // Source Context別データ
  sourceContextData: 
    | InboxEffectivenessData
    | CompanyEffectivenessData
    | ProjectEffectivenessData
    | UserEffectivenessData
    | AudienceEffectivenessData
    | ActionsEffectivenessData
    | ContentEffectivenessData
    | LibraryEffectivenessData;
  
  // 次アクション
  nextActionHints: NextActionHint[];
}

// Source Context別データ型

interface InboxEffectivenessData {
  ticketId: string;
  statusBefore: 'open' | 'in_progress' | 'resolved';
  statusAfter: 'open' | 'in_progress' | 'resolved' | 'reopened';
  reply?: {
    hasReply: boolean;
    replyTime?: string;
    replyContent?: string;
  };
  resolutionTime?: number; // minutes
  reopenRisk: 'high' | 'medium' | 'low';
}

interface CompanyEffectivenessData {
  companyId: string;
  companyName: string;
  overallEngagementRate: number;
  projectsEngaged: number;
  totalProjects: number;
  usersEngaged: number;
  totalUsers: number;
  healthScoreBefore: number;
  healthScoreAfter: number;
  projectBreakdown: {
    projectId: string;
    projectName: string;
    engagementRate: number;
  }[];
}

interface AudienceEffectivenessData {
  clusterId: string;
  clusterName: string;
  segmentType: 'risk' | 'opportunity' | 'health' | 'engagement';
  overallEngagementRate: number;
  responseDeviation: {
    dimension: 'phase' | 'role' | 'company' | 'project';
    breakdown: {
      label: string;
      count: number;
      engagementRate: number;
    }[];
  }[];
  highEngagementCharacteristics: string[];
  lowEngagementCharacteristics: string[];
  redesignSuggestions: string[];
}

interface ActionsEffectivenessData {
  actionId: string;
  actionTitle: string;
  actionPurpose: string;
  statusBefore: 'draft' | 'in_progress' | 'on_hold' | 'completed';
  statusAfter: 'draft' | 'in_progress' | 'on_hold' | 'completed';
  goalAchieved: boolean;
  goalEvidence: string;
  followUpNeeded: boolean;
  completionRecommendation: 'complete' | 'on_hold' | 'continue' | 'reassign';
}

// ... 他のSource Context別データ型
```

---

## UI実装パターン

### **クイックスタットカード（共通）**
```tsx
function QuickStats({ sourceContext, data }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        {getSourceIcon(sourceContext)}
        <h2 className="font-semibold">
          {getSourceLabel(sourceContext)}の結果
        </h2>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <StatItem
          label="送信成功"
          value={`${data.sentCount}/${data.targetCount}名`}
          trend={data.sentCount === data.targetCount ? 'success' : 'warning'}
        />
        
        {/* Source Context別の主要指標 */}
        {sourceContext === 'inbox' && (
          <StatItem
            label="チケット状態"
            value={`${data.statusBefore} → ${data.statusAfter}`}
            trend={data.statusAfter === 'resolved' ? 'success' : 'neutral'}
          />
        )}
        
        {sourceContext === 'company' && (
          <StatItem
            label="Health Score"
            value={`${data.healthScoreBefore} → ${data.healthScoreAfter}`}
            trend={data.healthScoreAfter > data.healthScoreBefore ? 'success' : 'warning'}
            delta={data.healthScoreAfter - data.healthScoreBefore}
          />
        )}
        
        {/* ... 他のSource Context */}
      </div>
    </div>
  );
}
```

### **次アクション推奨UI**
```tsx
function NextActionHints({ sourceContext, hints }: Props) {
  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-blue-900 mb-3">
        🤖 AI推奨: 次のアクション
      </h3>
      
      <div className="space-y-3">
        {hints.map((hint, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-blue-700">{hint.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-blue-900">{hint.title}</div>
              <div className="text-sm text-blue-700">{hint.description}</div>
            </div>
            {hint.action && (
              <Button
                variant="outline"
                size="sm"
                onClick={hint.action}
              >
                {hint.actionLabel}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## まとめ: 実装時の判断フロー

```
Results画面を開く
    ↓
Source Contextを取得
    ↓
    ├─ Inbox      → チケット状態変化を最優先表示
    ├─ Company    → Health Score + Project別差分を表示
    ├─ Project    → Project Status + User別反応を表示
    ├─ User       → User状態変化（前後比較）を表示
    ├─ Audience   → Segment反応 + 偏り分析を表示
    ├─ Actions    → Action Status + 完了判断UIを表示
    ├─ Content    → 業界比較 + 再利用推奨度を表示
    └─ Library    → 過去実績比較 + Template評価を表示
    ↓
配信結果 + 接点反応 + 次アクション示唆を3段階表示
    ↓
次アクションボタン表示（Source Context別）
```

---

**重要**: 各Source Contextで「何を効果とみなすか」が異なるため、表示の重みづけを必ず変えること。単なる配信成功率ではなく、Source Context固有の効果指標を最優先表示する。
