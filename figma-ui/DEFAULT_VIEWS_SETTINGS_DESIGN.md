# Default Views 管理画面 設計ドキュメント

## 概要
Default Views / Personal Default Filters は、単なるフィルタ保存機能ではなく、**各画面の初期体験全体を定義する包括的な設定機能**です。

この設定により、以下が決定されます：
- 初期フィルタ
- 初期ソート
- 初期表示モード
- Current View label
- Subtitle
- Summary cards の対象範囲
- Empty state の文言（Title / Body / CTA）
- Filter chips の初期状態

---

## 役割と責務

### Default View の役割
各画面（Console、Company、Projects、Actions、Content、Outbound、Audience、Inbox）において、ユーザーが最初に目にする体験を定義します。

### 責務
1. **フィルタリング**: どのデータを表示するか
2. **ソート**: データをどの順序で表示するか
3. **表示モード**: テーブル、Overview、Kanban など
4. **UI文言**: Current View Label、Subtitle、Empty State
5. **サマリー**: Summary Cards の集計対象範囲
6. **プレビュー**: Filter Chips の表示内容

---

## Scope Type と優先順位ルール

### Scope Type の種類
| Scope Type | 優先順位 | 説明 | 編集権限 |
|-----------|---------|------|---------|
| **Personal** | 1 (最優先) | 個人専用の設定 | 本人のみ |
| **Role-based** | 2 | ロール（CSM、Manager等）に基づく設定 | Admin、Manager |
| **Team** | 3 | チーム単位の設定 | Team Lead、Manager、Admin |
| **Workspace** | 4 (最低) | ワークスペース全体のデフォルト | Admin |

### 競合時の優先順位
複数のDefault Viewが競合する場合、以下の優先順位で適用されます：

```
1. Personal > 2. Role-based > 3. Team > 4. Workspace
```

**例:**
- ユーザーが Personal 設定を持っている → Personal を使用
- Personal がない場合、Role-based があれば → Role-based を使用
- Role-based もない場合、Team があれば → Team を使用
- 最後に Workspace のデフォルトを使用

---

## Default Views 一覧画面

### 表示カラム
| カラム名 | 説明 | 表示形式 |
|---------|------|---------|
| **ビュー名** | View の名前 | テキスト + Default バッジ |
| **対象画面** | 適用先の画面 | Badge (Console, Company, Projects等) |
| **スコープ** | Personal / Role-based / Team / Workspace | 色分けBadge |
| **オーナー/ロール** | 作成者 / 適用ロール | テキスト (2行表示) |
| **Current View Label** | 画面に表示される View 名 | テキスト (中太字) |
| **Subtitle** | View の説明文 | テキスト (小) |
| **有効/無効** | 現在の状態 | Badge (緑: 有効 / グレー: 無効) |
| **最終更新** | 更新日 | 日付 |
| **更新者** | 更新したユーザー | テキスト |
| **アクション** | プレビュー / 編集 | アイコンボタン |

### フィルタ・ソート機能
- 対象画面でフィルタ
- スコープでフィルタ
- 有効/無効でフィルタ
- 検索（View名、Current View Label、Subtitle）

---

## Default View 新規作成 / 編集ドロワー

### セクション A: 基本情報
| 項目 | 必須 | 説明 | 入力形式 |
|-----|------|------|---------|
| **View Name** | ✅ | View の識別名 | テキスト入力 |
| **Target Screen** | ✅ | 適用対象画面 | セレクトボックス (Console, Company, Projects等) |
| **Scope Type** | ✅ | スコープ種別 | セレクトボックス (Personal, Role-based, Team, Workspace) |
| **Applicable Roles** | | 適用ロール | チェックボックス (CSM, Manager, Admin等) |
| **デフォルト設定** | | このスコープの Default View とする | チェックボックス |
| **有効化** | | View を有効化 | チェックボックス |

### セクション B: 初期表示条件
| 項目 | 必須 | 説明 | 入力形式 |
|-----|------|------|---------|
| **Default Filter Condition** | ✅ | フィルタ条件 | テキストエリア (例: owner = 自分 AND status = active) |
| **Default Sort** | | ソート順 | テキスト入力 (例: Last Activity Desc) |
| **Default Display Mode** | | 表示モード | セレクトボックス (table, overview, clusters, kanban) |
| **Default Grouping** | | グルーピング | テキスト入力 (例: Phase) |
| **Default Density** | | 行の密度 | セレクトボックス (compact, comfortable, spacious) |

### セクション C: 表示文言
| 項目 | 必須 | 説明 | 入力形式 |
|-----|------|------|---------|
| **Current View Label** | ✅ | ページタイトルに表示される View 名 | テキスト入力 (例: My Projects) |
| **Subtitle** | ✅ | View の説明文 | テキスト入力 (例: 自分の担当Projectの状況と優先度を確認する) |
| **Empty State Title** | | データがない時のタイトル | テキスト入力 (例: 担当Projectはまだありません) |
| **Empty State Body** | | データがない時の説明文 | テキストエリア (例: Projectが割り当てられると、ここに表示されます) |
| **Empty State CTA Label** | | CTAボタンのラベル | テキスト入力 (例: All Projects を見る) |
| **Empty State CTA Destination** | | CTA遷移先の View ID | テキスト入力 (例: all) |

### セクション D: サマリー連動
| 項目 | 必須 | 説明 | 入力形式 |
|-----|------|------|---------|
| **Summary Cards Target Scope** | | サマリーカードの集計対象範囲 | テキストエリア (例: Filtered by owner = 自分) |
| **Summary Card Title Presets** | | サマリーカードタイトルのプリセット | タグ入力 |
| **Filter Chips Preview** | | 適用されるフィルタチップ | タグ入力・プレビュー表示 |

### アクションボタン
| ボタン | 説明 | 位置 |
|-------|------|------|
| **プレビュー** | 設定を適用した画面をプレビュー | 左下 |
| **複製** | 現在の View を複製して新規作成 | 左下 |
| **キャンセル** | 変更を破棄してドロワーを閉じる | 右下 |
| **下書き保存** | 有効化せずに保存 | 右下 |
| **保存して適用** | 保存して即座に有効化 | 右下 (Primary) |

---

## 画面ごとの推奨 Default View

### Console
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| My Accounts | Workspace | My Accounts | owner = 自分 | 自分が担当する顧客のみを表示する |
| My Priorities | Role-based | My Priorities | priority = high AND owner = 自分 | 優先度の高い担当顧客を確認する |
| Team View | Team | Team View | team = 自分のチーム | チームが担当する顧客を確認する |
| All Accounts | Workspace | All Accounts | (なし) | すべての顧客を横断して確認する |

### Company
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| My Companies | Workspace | My Companies | owner = 自分 | 自分が担当する企業のみを表示する |
| Assigned Companies | Workspace | Assigned Companies | assigned_to = 自分 | アサインされた企業を確認する |
| At Risk Companies | Workspace | At Risk | signal = risk | リスクシグナルが発生している企業を確認する |
| All Companies | Workspace | All Companies | (なし) | すべての企業を横断して確認する |

### Projects
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| My Projects | Workspace | My Projects | owner = 自分 | 自分の担当Projectの状況と優先度を確認する |
| At Risk Projects | Workspace | At Risk | signal = risk | リスクが高いProjectを優先的に確認する |
| Opportunity Projects | Workspace | Opportunity | signal = opportunity | 機会が大きいProject群を把握する |
| All Projects | Workspace | All Projects | (なし) | すべてのProjectを横断して確認する |

### Actions
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| My Actions | Workspace | My Actions | owner = 自分 | 自分が作成したActionを確認する |
| Assigned to me | Workspace | Assigned to me | assigned_to = 自分 | 自分にアサインされたActionを確認する |
| Overdue | Team | Overdue | status = overdue | 期限切れのActionを優先的に確認する |
| All Actions | Workspace | All Actions | (なし) | すべてのActionを横断して確認する |

### Content
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| My Content | Workspace | My Content | owner = 自分 | 自分が作成したContentを確認する |
| My Drafts | Personal | My Drafts | owner = 自分 AND status = draft | 下書き状態のContentを確認する |
| Review Queue | Team | Review Queue | status = review AND reviewer = 自分 | レビュー待ちのContentを確認する |
| All Content | Workspace | All Content | (なし) | すべてのContentを横断して確認する |

### Outbound
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| My Outbound | Workspace | My Outbound | owner = 自分 | 自分が作成したOutboundを確認する |
| Drafts | Workspace | Drafts | status = draft | 下書き状態のOutboundを確認する |
| Ready to Send | Team | Ready to Send | status = ready | 送信準備が完了したOutboundを確認する |
| Sent | Workspace | Sent | status = sent | 送信済みのOutboundを確認する |
| Failed | Workspace | Failed | status = failed | 送信失敗したOutboundを確認する |

### Audience
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| My Audiences | Workspace | My Audiences | owner = 自分 | 自分が作成したAudienceを確認する |
| Recently Used | Personal | Recently Used | last_used_at > 7days_ago | 最近使用したAudienceを確認する |
| Shared Audiences | Team | Shared Audiences | shared = true | チームで共有されたAudienceを確認する |
| All Audiences | Workspace | All Audiences | (なし) | すべてのAudienceを横断して確認する |

### Inbox
| View Name | Scope | Current View Label | Filter Condition | Subtitle |
|-----------|-------|-------------------|------------------|----------|
| Assigned to me | Workspace | Assigned to me | assigned_to = 自分 | 自分にアサインされたInboxアイテムを確認する |
| My team | Team | My team | team = 自分のチーム | チームのInboxアイテムを確認する |
| Unassigned | Team | Unassigned | assigned_to = null | 未アサインのInboxアイテムを確認する |
| Related to my accounts | Personal | Related to my accounts | company.owner = 自分 | 担当顧客に関連するInboxアイテムを確認する |

---

## Preview 機能

### プレビューで表示する内容
Default View 設定の保存前に、以下をプレビューできるようにします：

1. **Current View Label**
   - ページタイトル部分のプレビュー

2. **Subtitle**
   - View の説明文のプレビュー

3. **Summary Cards**
   - Summary Cards Target Scope に基づく集計範囲のプレビュー
   - サンプルデータでの集計結果イメージ

4. **Empty State**
   - データがない場合の Empty State 全体のプレビュー
   - Title、Body、CTA のレイアウト確認

5. **Filter Chips**
   - 適用されるフィルタチップの一覧
   - 視覚的なチップ表示

6. **対象レコード数イメージ**
   - フィルタ条件に基づく対象レコード数の推定値
   - サンプルデータを使った件数表示

### プレビューモーダル/ドロワー構成
```
┌─────────────────────────────────────┐
│ Preview: My Projects                │
├─────────────────────────────────────┤
│                                     │
│ [Current View Label]                │
│ My Projects                         │
│                                     │
│ [Subtitle]                          │
│ 自分の担当Projectの状況と優先度を   │
│ 確認する                            │
│                                     │
│ [Summary Cards] (3件)               │
│ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │ 142  │ │  12  │ │  23  │       │
│ │Total │ │ Risk │ │Oppor.│       │
│ └──────┘ └──────┘ └──────┘       │
│                                     │
│ [Filter Chips]                      │
│ [owner: 自分]                       │
│                                     │
│ [Empty State]                       │
│ 🔍 担当Projectはまだありません      │
│ Projectが割り当てられると、         │
│ ここに表示されます                  │
│ [All Projects を見る →]            │
│                                     │
│ [推定対象レコード数]                │
│ 約 142 件                           │
│                                     │
└─────────────────────────────────────┘
```

---

## 権限制御

### スコープ別の編集権限
| Scope Type | 編集可能なロール |
|-----------|----------------|
| **Personal** | 本人のみ |
| **Role-based** | Admin、Manager |
| **Team** | Team Lead、Manager、Admin |
| **Workspace** | Admin |

### 閲覧権限
| ロール | 閲覧可能な範囲 |
|-------|---------------|
| **一般ユーザー** | 自分の Personal View のみ |
| **Lead** | Personal + 自分が所属する Team View |
| **Manager** | Personal + Team + Role-based |
| **Admin** | すべての View |

### 制限事項
- 一般ユーザーは Personal Default View のみ編集可能
- Team / Workspace / Role-based の Default View は閲覧のみ（編集不可）
- Admin と Manager は、すべてのスコープの View を編集可能

---

## Audit 連携

### 記録すべき変更履歴
Default Views の変更は、Audit ログに記録されます。

| イベント名 | 説明 | 記録内容 |
|----------|------|---------|
| **Default View Created** | 新規作成 | View Name、Target Screen、Scope、作成者 |
| **Default View Updated** | 更新 | 変更前後の差分、更新者 |
| **Default View Enabled** | 有効化 | View Name、有効化者 |
| **Default View Disabled** | 無効化 | View Name、無効化者 |
| **Current View Label Changed** | Current View Label 変更 | 変更前後の値、変更者 |
| **Subtitle Changed** | Subtitle 変更 | 変更前後の値、変更者 |
| **Summary Scope Changed** | Summary Cards Target Scope 変更 | 変更前後の値、変更者 |
| **Empty State Changed** | Empty State 設定変更 | 変更前後の値、変更者 |
| **Filter Condition Changed** | フィルタ条件変更 | 変更前後の条件、変更者 |
| **Default Sort Changed** | デフォルトソート変更 | 変更前後の値、変更者 |
| **Default View Deleted** | 削除 | View Name、削除者 |

### Audit ログ表示例
```
2026-03-17 14:32:15 | Default View Updated
- View: "My Projects"
- Target Screen: Projects
- Changed by: 山本 一郎
- Changes:
  - Current View Label: "My Projects" → "My Active Projects"
  - Filter Condition: "owner = 自分" → "owner = 自分 AND status = active"
  - Subtitle: "自分の担当Projectの状況と優先度を確認する" 
             → "自分のアクティブなProjectを優先的に確認する"
```

---

## データモデル

### DefaultView テーブル構造
```typescript
interface DefaultView {
  // 基本情報
  id: string;
  name: string;
  targetScreen: "Console" | "Company" | "Projects" | "Actions" | 
                "Content" | "Outbound" | "Audience" | "Inbox";
  scope: "personal" | "team" | "workspace" | "role-based";
  owner: string; // User ID
  isDefault: boolean;
  enabled: boolean;
  priority: number; // 1=personal, 2=role-based, 3=team, 4=workspace
  
  // 初期表示条件
  filterCondition: string;
  defaultSort?: string;
  defaultDisplayMode?: "overview" | "table" | "kanban" | "clusters";
  defaultGrouping?: string;
  defaultDensity?: "compact" | "comfortable" | "spacious";
  
  // 表示文言
  currentViewLabel: string;
  subtitle: string;
  emptyStateTitle?: string;
  emptyStateBody?: string;
  emptyStateCtaLabel?: string;
  emptyStateCtaDestination?: string;
  
  // サマリー連動
  summaryCardsTargetScope?: string;
  summaryCardTitlePresets?: string[];
  filterChipsPreview?: string[];
  
  // メタデータ
  applicableRoles?: string[];
  visibilityScope?: string;
  updatedAt: string;
  updatedBy?: string;
  createdAt: string;
  createdBy: string;
}
```

---

## UI/UX ガイドライン

### 一覧画面
- **検索**: View名、Current View Label、Subtitle で検索可能
- **フィルタ**: 対象画面、スコープ、有効/無効でフィルタ
- **ソート**: 更新日、作成日、優先度でソート
- **アクション**: プレビュー（目アイコン）、編集（鉛筆アイコン）

### ドロワー（作成/編集）
- **セクション分割**: A～D の4セクションで整理
- **必須項目**: アスタリスク（*）で明示
- **ヘルプテキスト**: 各入力項目の下に小さな説明文を表示
- **プレビューボタン**: リアルタイムでプレビュー表示
- **保存オプション**: 下書き保存 / 保存して適用の2つを提供

### プレビュー
- **モーダル表示**: ドロワーとは別ウィンドウで表示
- **実際の画面に近い形**: 可能な限り実際の画面レイアウトを再現
- **サンプルデータ使用**: フィルタ条件に基づくサンプルデータを表示

---

## 実装優先順位

### Phase 1: 基礎機能 (完了)
- ✅ DefaultView 型定義拡張
- ✅ mockDefaultViews データ拡張（全画面分）
- ✅ 一覧テーブルのカラム拡張
- ✅ スコープ別の色分けBadge
- ✅ 新規作成/編集ドロワーの実装

### Phase 2: 高度な機能 (今後)
- ⏳ プレビュー機能の実装
- ⏳ 権限制御の実装
- ⏳ Audit ログ連携
- ⏳ フィルタ条件のバリデーション
- ⏳ 複製機能の実装
- ⏳ 有効化/無効化のトグル機能

### Phase 3: 最適化 (今後)
- ⏳ Default View の自動適用ロジック
- ⏳ 競合解決の自動化
- ⏳ パフォーマンス最適化
- ⏳ バルク編集機能

---

## まとめ

Default Views 管理画面は、各画面の初期体験を包括的に定義する重要な設定機能です。

### 主要なポイント
1. **単なるフィルタ保存ではない**: Current View Label、Subtitle、Empty State など、UI文言も一括管理
2. **優先順位ルール**: Personal > Role-based > Team > Workspace の優先順位で適用
3. **プレビュー機能**: 設定変更前に実際の画面イメージを確認可能
4. **権限制御**: スコープ別に編集権限を制御
5. **Audit 連携**: すべての変更履歴を記録

### 実装済み機能
- ✅ 拡張された型定義
- ✅ 包括的なサンプルデータ（全8画面）
- ✅ 詳細なカラム表示を持つ一覧テーブル
- ✅ セクション分割された新規作成/編集ドロワー
- ✅ スコープ別の色分け表示

### 今後の拡張
- プレビュー機能の完全実装
- 権限制御の実装
- Audit ログとの完全連携
- フィルタ条件のリアルタイムバリデーション
