# Company / Unified Log / Audience 配下のCTA整理仕様

## 基本原則

### 役割分担
- **Company detail**: 特定企業1社の統合理解と次アクション判断
- **Unified Log**: その企業で何が起きたかを時系列で理解するEvidence画面
- **Audience**: クラスター/Project群/User群に対する一括施策設計
- **Outbound**: 顧客向け送信運用の起点
- **Compose**: 最終送信実行の場所（唯一の赤い危険操作ボタン）

### 送信系CTAのルール
1. **Company / Unified Log / Audience では送信実行しない**
2. **外部送信系CTAは通常色（赤色にしない）**
3. **「送信実行」ではなく「送信準備へ進む」意味にする**
4. **赤い危険操作ボタンは Compose の最終送信のみ**
5. **文脈を保持したまま Outbound / Compose に遷移**

---

## 1. Company Detail

### 現在のCTA状況

#### ✅ 残すCTA（そのまま維持）
```tsx
// ナビゲーション・理解系
<Button>Projectを見る</Button>
<Button>Userを見る</Button>
<Button>Orgを見る</Button>
<Button>Evidenceを見る</Button>
<Button>関連テンプレートを見る</Button>
<Button>次アクション候補を見る</Button>

// 業務フロー連携系
<Link to="/actions?context=company&id=comp_1">
  <Button>Actionsに送る</Button>
</Link>
<Link to="/content?context=company&id=comp_1">
  <Button>Contentに送る</Button>
</Link>
<Link to="/library">
  <Button>Libraryを参照する</Button>
</Link>

// 現在実装済み（維持）
<Link to="/company/${companyId}/log">
  <Button>Unified Logを見る</Button>
</Link>
```

#### ❌ 削るCTA（削除または変更）
```tsx
// ❌ 削除: 直接送信系（Company detailでは実行しない）
<Button className="bg-red-600">Email送信</Button>        // 存在しないが、今後も追加しない
<Button className="bg-red-600">Intercom送信</Button>     // 存在しないが、今後も追加しない
<Button className="bg-red-600">Slack送信</Button>        // 存在しないが、今後も追加しない
<Button className="bg-red-600">外部送信</Button>         // 存在しないが、今後も追加しない

// ❌ 変更: Salesforce送信（現在は危険操作表現）
// 現在のコード:
<Button 
  variant="destructive"
  onClick={() => {/* 実際の送信処理 */}}
>
  <Database className="w-4 h-4 mr-2" />
  Salesforceに送信する
</Button>

// 理由: Company detailでも送信実行はしない
// Salesforce同期も Outbound / Compose を経由すべき
```

#### ➕ 追加するCTA

##### 1. **「Outboundを起票する」**（既に実装済み・維持）
```tsx
// 現在のコード（/src/app/pages/company-detail.tsx:377）
<Link to={`/outbound/compose?fromCompany=${companyId}`}>
  <Button variant="outline" size="sm">
    <Send className="w-4 h-4 mr-2" />
    Outboundを起票
  </Button>
</Link>

// ✅ このまま維持
// variant="outline" で通常色（赤色にしない）
```

**遷移先**: `/outbound/compose?fromCompany=${companyId}`

**引き継ぐ文脈**:
```typescript
{
  sourceContext: 'company',
  sourceId: companyId,
  linkedCompany: [companyId],
  linkedProject: company.relatedProjects,
  linkedUser: company.relatedUsers,
  linkedEvidence: company.recentEvidence,
  audienceScope: 'company',
  companyPhase: company.phase,
  healthScore: company.healthScore,
  openAlerts: company.openAlerts,
  openActions: company.openActions
}
```

##### 2. **「会社全体施策を作る」**（新規追加推奨）
```tsx
// 追加推奨コード
<Link to={`/outbound/compose?fromCompany=${companyId}&scope=company_wide`}>
  <Button variant="default" size="sm">
    <Users className="w-4 h-4 mr-2" />
    会社全体施策を作る
  </Button>
</Link>
```

**遷移先**: `/outbound/compose?fromCompany=${companyId}&scope=company_wide`

**引き継ぐ文脈**:
```typescript
{
  sourceContext: 'company',
  sourceId: companyId,
  audienceScope: 'company',
  targetProjects: 'all',  // 全Projectに送信
  targetUsers: company.allUsers,
  campaignType: 'company_wide',
  linkedCompany: [companyId]
}
```

##### 3. **Salesforce同期の見直し**（実装変更推奨）
```tsx
// ❌ 現在のコード（削除または変更）
<Button variant="destructive" onClick={/* 送信処理 */}>
  Salesforceに送信する
</Button>

// ✅ 変更後のコード（推奨）
<Link to={`/outbound/compose?fromCompany=${companyId}&sync=salesforce&type=org_chart`}>
  <Button variant="outline" size="sm">
    <Database className="w-4 h-4 mr-2" />
    Salesforce同期を準備
  </Button>
</Link>
```

**理由**:
- Company detailでも送信実行はしない
- Salesforce同期も Compose で最終確認してから実行
- 危険操作（赤色ボタン）は Compose のみ

**遷移先**: `/outbound/compose?fromCompany=${companyId}&sync=salesforce&type=org_chart`

**引き継ぐ文脈**:
```typescript
{
  sourceContext: 'company',
  sourceId: companyId,
  syncType: 'salesforce',
  syncTarget: 'org_chart',
  confirmedPeople: confirmedPeople,  // 確定済みPeople
  syncFields: ['Name', 'Email', 'Phone', 'Title', 'Department', 'Role']
}
```

---

### Company Detail CTA まとめ

#### ✅ 残すCTA（9個）
1. Projectを見る
2. Userを見る
3. Orgを見る
4. Evidenceを見る
5. Unified Logを見る
6. Actionsに送る
7. Contentに送る
8. Libraryを参照する
9. 次アクション候補を見る

#### ❌ 削るCTA（1個）
1. ~~Salesforceに送信する~~（赤い危険操作ボタン）→ 「Salesforce同期を準備」に変更

#### ➕ 追加するCTA（2個）
1. **Outboundを起票する**（既に実装済み・維持）
2. **会社全体施策を作る**（新規追加推奨）

---

## 2. Unified Log

### 現在のCTA状況

#### ✅ 残すCTA（そのまま維持）
```tsx
// Evidence理解・確認系
<Button>原文を開く</Button>
<Button>Evidenceを見る</Button>
<Button>詳細を見る</Button>

// 紐付け・整理系
<Button>Peopleに紐付ける</Button>
<Button>Projectに紐付ける</Button>
<Button>Companyに紐付ける</Button>

// 関連エンティティ確認
<Button>関連Companyを開く</Button>
<Button>関連Projectを開く</Button>
<Button>関連Userを開く</Button>

// 業務フロー連携
<Button>Actionを作成</Button>
<Button>Contentに送る</Button>

// 状態確認
<Button>Resolver状態を確認</Button>
<Button>未解決Evidenceを確認</Button>
```

#### ❌ 削るCTA（削除または変更）
```tsx
// ❌ 削除: 直接送信系（Unified Logでは実行しない）
<Button className="bg-red-600">Email送信</Button>        // 存在しないが、今後も追加しない
<Button className="bg-red-600">Intercom送信</Button>     // 存在しないが、今後も追加しない
<Button className="bg-red-600">Slack送信</Button>        // 存在しないが、今後も追加しない
<Button className="bg-red-600">返信する</Button>         // 存在しないが、今後も追加しない
<Button className="bg-red-600">案内を送る</Button>       // 存在しないが、今後も追加しない

// ❌ 削除: ログから直接送信完了するCTA
<Button onClick={/* 送信処理 */}>
  この問い合わせに返信
</Button>
```

#### ➕ 追加するCTA

##### 1. **「Outbound対応を起票する」**（新規追加推奨）
```tsx
// 追加推奨コード
<Link to={`/outbound/compose?fromLog=${evidenceId}&type=inquiry_response`}>
  <Button variant="outline" size="sm">
    <Send className="w-4 h-4 mr-2" />
    Outbound対応を起票
  </Button>
</Link>
```

**遷移先**: `/outbound/compose?fromLog=${evidenceId}&type=inquiry_response`

**引き継ぐ文脈**:
```typescript
{
  sourceContext: 'unified_log',
  sourceId: evidenceId,
  linkedEvidence: [evidenceId],
  linkedCompany: evidence.companyId,
  linkedProject: evidence.projectId,
  linkedUser: evidence.userId,
  inquiryType: evidence.type,  // 'inquiry' / 'alert' / 'ticket'
  urgency: evidence.urgency,
  sourceChannel: evidence.channel,
  receivedAt: evidence.timestamp,
  responseType: 'reply' | 'guide' | 'support'
}
```

##### 2. **「このEvidenceを送信文脈に使う」**（新規追加推奨）
```tsx
// 追加推奨コード
<Link to={`/outbound/compose?evidence=${evidenceId}`}>
  <Button variant="outline" size="sm">
    <FileText className="w-4 h-4 mr-2" />
    このEvidenceを送信文脈に使う
  </Button>
</Link>
```

**遷移先**: `/outbound/compose?evidence=${evidenceId}`

**引き継ぐ文脈**:
```typescript
{
  sourceContext: 'unified_log',
  linkedEvidence: [evidenceId],
  evidenceContent: evidence.content,
  evidenceType: evidence.type,
  evidenceTimestamp: evidence.timestamp,
  linkedCompany: evidence.companyId,
  linkedProject: evidence.projectId
}
```

##### 3. **「返信/案内対応に進む」**（新規追加推奨）
```tsx
// 追加推奨コード（問い合わせ・アラート系Evidenceの場合のみ表示）
{evidence.type === 'inquiry' || evidence.type === 'alert' && (
  <Link to={`/outbound/compose?fromLog=${evidenceId}&responseType=reply`}>
    <Button variant="default" size="sm">
      <Reply className="w-4 h-4 mr-2" />
      返信/案内対応に進む
    </Button>
  </Link>
)}
```

**遷移先**: `/outbound/compose?fromLog=${evidenceId}&responseType=reply`

**引き継ぐ文脈**:
```typescript
{
  sourceContext: 'unified_log',
  sourceId: evidenceId,
  responseType: 'reply',  // または 'guide'
  linkedEvidence: [evidenceId],
  inquiryContent: evidence.content,
  urgency: evidence.urgency,
  ticketId: evidence.ticketId,
  linkedUser: evidence.userId
}
```

---

### Unified Log CTA まとめ

#### ✅ 残すCTA（12個）
1. 原文を開く
2. Evidenceを見る
3. 詳細を見る
4. Peopleに紐付ける
5. Projectに紐付ける
6. Companyに紐付ける
7. 関連Companyを開く
8. 関連Projectを開く
9. 関連Userを開く
10. Actionを作成
11. Contentに送る
12. Resolver状態を確認

#### ❌ 削るCTA（0個）
- 直接送信系CTAは現在存在しないため、削除対象なし
- 今後も追加しないことを明記

#### ➕ 追加するCTA（3個）
1. **Outbound対応を起票する**（新規追加推奨）
2. **このEvidenceを送信文脈に使う**（新規追加推奨）
3. **返信/案内対応に進む**（新規追加推奨・条件付き表示）

---

## 3. Audience

### 現在のCTA状況

#### ✅ 残すCTA（そのまま維持）
```tsx
// セグメント設計・確認系
<Button>対象を確認</Button>
<Button>対象件数を確認</Button>
<Button>セグメント条件を確認</Button>
<Button>Userを除外</Button>
<Button>除外リストを確認</Button>

// Insight・分析系
<Button>Insightを再生成</Button>
<Button>共通Insightを確認</Button>
<Button>反応傾向を分析</Button>

// 関連エンティティ確認
<Button>Projectを見る</Button>
<Button>Userを見る</Button>
<Button>Companyを見る</Button>

// 業務フロー連携
<Button>一括Action作成</Button>
<Button>一括Content作成</Button>

// 既に実装済み（維持）
<Link to={`/outbound/compose?fromAudience=${clusterId}`}>
  <Button>送信レビューへ</Button>
</Link>
```

#### ❌ 削るCTA（削除または変更）
```tsx
// ❌ 削除: 直接送信系（Audienceでは実行しない）
<Button className="bg-red-600">Email送信</Button>        // 存在しないが、今後も追加しない
<Button className="bg-red-600">Intercom送信</Button>     // 存在しないが、今後も追加しない
<Button className="bg-red-600">Slack送信</Button>        // 存在しないが、今後も追加しない
<Button className="bg-red-600">一括送信</Button>         // 存在しないが、今後も追加しない
<Button className="bg-red-600">配信実行</Button>         // 存在しないが、今後も追加しない

// ❌ 削除: Audience画面内でそのまま送るCTA
<Button onClick={/* 送信処理 */}>
  このまま送信
</Button>

// ❌ 削除: 送信確定モーダル
<Dialog>
  <DialogTitle>送信確認</DialogTitle>
  <Button variant="destructive">送信実行</Button>
</Dialog>
```

#### ➕ 追加するCTA

##### 1. **「送信レビューへ」**（既に実装済み・維持）
```tsx
// 現在のコード（/src/app/pages/audience-workspace.tsx:931-936）
<Link to={`/outbound/compose?fromAudience=${sourceClusterInfo.id}`}>
  <Button 
    variant="default"
    size="sm"
    className="w-full justify-start"
  >
    <Send className="w-3 h-3 mr-2" />
    送信レビューへ
  </Button>
</Link>

// ✅ このまま維持
// variant="default" で通常色（赤色にしない）
```

**遷移先**: `/outbound/compose?fromAudience=${clusterId}`

**引き継ぐ文脈**:
```typescript
{
  sourceContext: 'audience',
  sourceId: clusterId,
  linkedCluster: clusterId,
  clusterName: cluster.name,
  segmentType: cluster.type,  // 'risk' / 'opportunity' / 'health'
  audienceScope: 'user' | 'project',
  audienceConditions: cluster.conditions,
  targetProjectCount: cluster.projectCount,
  targetUserCount: cluster.userCount,
  resolvedRecipients: cluster.resolvedUsers,
  unresolvedRecipients: cluster.unresolvedUsers,
  commonInsight: cluster.insight,
  linkedCompany: cluster.companies,
  linkedProject: cluster.projects,
  linkedUser: cluster.users
}
```

##### 2. **「Outboundを起票する」**（新規追加推奨）
```tsx
// 追加推奨コード
<Link to={`/outbound?fromAudience=${clusterId}`}>
  <Button variant="outline" size="sm">
    <Send className="w-4 h-4 mr-2" />
    Outboundを起票する
  </Button>
</Link>
```

**遷移先**: `/outbound?fromAudience=${clusterId}`

**説明**: 
- まず Outbound 一覧に遷移
- Audience条件を保持したまま新規Outbound作成
- Outbound一覧から Compose へ進む流れ

**引き継ぐ文脈**: 上記「送信レビューへ」と同じ

##### 3. **「このAudience条件で送信を準備する」**（新規追加推奨・説明文言）
```tsx
// 追加推奨コード（「送信レビューへ」の説明テキスト）
<div className="text-xs text-slate-600 mb-2">
  このAudience条件で送信を準備します。
  Compose画面で最終確認してから送信されます。
</div>
<Link to={`/outbound/compose?fromAudience=${clusterId}`}>
  <Button variant="default" size="sm" className="w-full">
    <Send className="w-3 h-3 mr-2" />
    送信レビューへ
  </Button>
</Link>
```

**目的**: 
- ユーザーに「ここで送信実行しない」ことを明示
- Composeで最終確認することを伝える

---

### Audience CTA まとめ

#### ✅ 残すCTA（13個）
1. 対象を確認
2. 対象件数を確認
3. セグメント条件を確認
4. Userを除外
5. 除外リストを確認
6. Insightを再生成
7. 共通Insightを確認
8. 反応傾向を分析
9. Projectを見る
10. Userを見る
11. Companyを見る
12. 一括Action作成
13. 一括Content作成

#### ❌ 削るCTA（0個）
- 直接送信系CTAは現在存在しないため、削除対象なし
- 今後も追加しないことを明記

#### ➕ 追加するCTA（2個 + 説明文言）
1. **送信レビューへ**（既に実装済み・維持）
2. **Outboundを起票する**（新規追加推奨）
3. **説明文言の追加**（「Compose画面で最終確認」を明示）

---

## 4. 共通実装ルール

### 送信系CTAの色

#### ❌ NG: 赤色ボタン（Company / Unified Log / Audience では使わない）
```tsx
// ❌ NG
<Button variant="destructive">送信する</Button>
<Button className="bg-red-600">Email送信</Button>
<Button className="bg-red-600 hover:bg-red-700">Salesforce送信</Button>
```

#### ✅ OK: 通常色ボタン（青色・グレー）
```tsx
// ✅ OK
<Button variant="default">送信レビューへ</Button>
<Button variant="outline">Outboundを起票する</Button>
<Button variant="default">Composeで確認</Button>
```

---

### URL パラメータ設計

#### Company Detail → Outbound / Compose
```
/outbound/compose?fromCompany={companyId}
/outbound/compose?fromCompany={companyId}&scope=company_wide
/outbound/compose?fromCompany={companyId}&sync=salesforce&type=org_chart
```

#### Unified Log → Outbound / Compose
```
/outbound/compose?fromLog={evidenceId}&type=inquiry_response
/outbound/compose?fromLog={evidenceId}&responseType=reply
/outbound/compose?evidence={evidenceId}
```

#### Audience → Outbound / Compose
```
/outbound/compose?fromAudience={clusterId}
/outbound?fromAudience={clusterId}
```

---

### 引き継ぐ文脈の実装

#### TypeScript型定義
```typescript
interface ComposeTransitionContext {
  // Source Context
  sourceContext: 'company' | 'unified_log' | 'audience' | 'inbox' | 'project' | 'actions' | 'content' | 'library';
  sourceId: string;
  
  // Linked Entities
  linkedCompany?: string[];
  linkedProject?: string[];
  linkedUser?: string[];
  linkedEvidence?: string[];
  linkedAction?: string;
  linkedContent?: string;
  linkedCluster?: string;
  
  // Audience Scope
  audienceScope?: 'company' | 'project' | 'user';
  
  // Audience Conditions (Audience起点時)
  audienceConditions?: {
    characteristics?: string[];
    risks?: string[];
    opportunities?: string[];
  };
  
  // Company Context (Company起点時)
  companyPhase?: string;
  healthScore?: number;
  openAlerts?: number;
  openActions?: number;
  
  // Evidence Context (Unified Log起点時)
  inquiryType?: 'inquiry' | 'alert' | 'ticket';
  urgency?: 'high' | 'medium' | 'low';
  sourceChannel?: 'email' | 'slack' | 'intercom' | 'chatwork';
  receivedAt?: string;
  responseType?: 'reply' | 'guide' | 'support';
  
  // Recipients
  targetProjectCount?: number;
  targetUserCount?: number;
  resolvedRecipients?: string[];
  unresolvedRecipients?: { userId: string; reason: string }[];
  
  // Sync Settings (Salesforce同期時)
  syncType?: 'salesforce';
  syncTarget?: 'org_chart' | 'contact' | 'account';
  syncFields?: string[];
  confirmedPeople?: any[];
}
```

#### React実装例
```tsx
// Company Detail → Compose
const navigateToCompose = () => {
  const context: ComposeTransitionContext = {
    sourceContext: 'company',
    sourceId: companyId,
    linkedCompany: [companyId],
    linkedProject: company.relatedProjects,
    linkedUser: company.relatedUsers,
    linkedEvidence: company.recentEvidence,
    audienceScope: 'company',
    companyPhase: company.phase,
    healthScore: company.healthScore,
    openAlerts: company.openAlerts,
    openActions: company.openActions
  };
  
  navigate(`/outbound/compose?fromCompany=${companyId}`, {
    state: context
  });
};

// Unified Log → Compose
const navigateToComposeFromLog = (evidence: Evidence) => {
  const context: ComposeTransitionContext = {
    sourceContext: 'unified_log',
    sourceId: evidence.id,
    linkedEvidence: [evidence.id],
    linkedCompany: evidence.companyId,
    linkedProject: evidence.projectId,
    linkedUser: evidence.userId,
    inquiryType: evidence.type,
    urgency: evidence.urgency,
    sourceChannel: evidence.channel,
    receivedAt: evidence.timestamp
  };
  
  navigate(`/outbound/compose?fromLog=${evidence.id}`, {
    state: context
  });
};

// Audience → Compose
const navigateToComposeFromAudience = (cluster: Cluster) => {
  const context: ComposeTransitionContext = {
    sourceContext: 'audience',
    sourceId: cluster.id,
    linkedCluster: cluster.id,
    audienceScope: cluster.scope,
    audienceConditions: cluster.conditions,
    targetProjectCount: cluster.projectCount,
    targetUserCount: cluster.userCount,
    resolvedRecipients: cluster.resolvedUsers,
    unresolvedRecipients: cluster.unresolvedUsers,
    linkedCompany: cluster.companies,
    linkedProject: cluster.projects,
    linkedUser: cluster.users
  };
  
  navigate(`/outbound/compose?fromAudience=${cluster.id}`, {
    state: context
  });
};
```

---

## 5. 実装チェックリスト

### 🔴 P0: 最優先実装

#### Company Detail
- [ ] ✅ 「Outboundを起票する」ボタン維持（既存）
- [ ] ❌ Salesforce送信の赤色ボタン削除
- [ ] ➕ Salesforce同期を「送信準備」に変更
- [ ] ➕ 「会社全体施策を作る」ボタン追加

#### Unified Log
- [ ] ➕ 「Outbound対応を起票する」ボタン追加
- [ ] ➕ 「このEvidenceを送信文脈に使う」ボタン追加
- [ ] ➕ 「返信/案内対応に進む」ボタン追加（条件付き）

#### Audience
- [ ] ✅ 「送信レビューへ」ボタン維持（既存）
- [ ] ➕ 「Outboundを起票する」ボタン追加
- [ ] ➕ 説明文言追加（「Composeで最終確認」）

---

### 🟡 P1: 推奨実装

#### 文脈引き継ぎ
- [ ] ComposeTransitionContext 型定義作成
- [ ] URLパラメータから文脈復元
- [ ] React Router state で文脈引き継ぎ

#### UI改善
- [ ] 送信系CTAの色統一（赤色削除）
- [ ] 「送信準備」「送信レビュー」文言統一
- [ ] ツールチップで「Composeで最終確認」説明

---

### 🟢 P2: 追加機能

- [ ] 文脈保持のバリデーション
- [ ] 文脈不足時の警告表示
- [ ] 文脈自動補完機能

---

## 6. まとめ

### 役割分担の明確化

| 画面 | 役割 | 送信実行 | 危険操作ボタン |
|-----|------|---------|--------------|
| **Company Detail** | 統合理解・次アクション判断 | ❌ しない | ❌ 使わない |
| **Unified Log** | Evidence理解・根拠確認 | ❌ しない | ❌ 使わない |
| **Audience** | 一括施策設計 | ❌ しない | ❌ 使わない |
| **Outbound** | 送信運用起点 | ❌ しない | ❌ 使わない |
| **Compose** | 最終送信実行 | ✅ する | ✅ 使う（赤色） |

### CTAの色ルール

| CTA種別 | Company Detail | Unified Log | Audience | Compose |
|---------|---------------|-------------|----------|---------|
| **送信準備系** | 通常色（青/グレー） | 通常色（青/グレー） | 通常色（青/グレー） | 通常色（青/グレー） |
| **最終送信実行** | ❌ 存在しない | ❌ 存在しない | ❌ 存在しない | **赤色** |
| **Salesforce同期** | 通常色（準備のみ） | - | - | **赤色**（実行） |

### 文脈引き継ぎの重要性

**文脈が失われると起きる問題**:
- どこから来たか分からない
- 何を送るべきか分からない
- 対象が誰か分からない
- 根拠が何か分からない

**文脈を保持することで実現できること**:
- Source Context別の初期表示
- 適切な初期文面生成
- 対象条件の自動設定
- Evidence自動添付
- 元の画面への戻り導線

---

これで、**Company / Unified Log / Audience配下のCTAが、送信準備導線として整理され、最終送信はComposeのみに集約される設計**が完成しました！
