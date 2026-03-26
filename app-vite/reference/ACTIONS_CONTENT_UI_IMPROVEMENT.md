# Actions と Content の画面構成改善

## 実装日
2026-03-14

## 改善方針

### 問題点
- Actions / Content を開いた直後に編集フォームが主役になっている
- 最初から長文エディタや詳細が表示され、閲覧・把握がしにくい
- 何の文脈のAction / Contentか分からない
- 「選ぶ」→「作業する」の流れが不明確

### 改善内容
- **閲覧起点の画面構成**に変更
- 最初は一覧が主役、アイテム選択後に詳細・編集に入る
- 未選択時は一覧が広く表示される
- Summary情報をヘッダーに配置

---

## 1. Actions画面の改善

### Before (旧構成)
```
[Header]
[左: Action一覧(380px)] [中央: 詳細/編集(可変)] [右: Evidence/Approval(420px)]
```

- 最初から中央に詳細が表示される
- 編集フォームが常時表示
- 3カラムで情報が多い

### After (新構成)
```
[Header + Summary Cards + Filter Bar]
[左: Action一覧(未選択時:100%、選択時:450px)] [右: 詳細(選択時のみ表示)]
```

- 最初はAction未選択 → 一覧が主役
- 選択後に右側に詳細パネルが開く
- Summary Cardsで状況を一目で把握

### 追加機能

#### Summary Cards (ヘッダー内)
- 未レビュー: AI提案の件数
- 期限超過: Overdue Actions
- 承認済: Approved Actions
- 全Action: 総件数

#### Filter Bar (ヘッダー内)
- 検索フィールド
- Statusフィルタ (all / proposed / reviewed / approved / pushed)
- Priorityフィルタ (all / high / medium / low)
- フィルタクリアボタン

#### 未選択時の表示
```
┌─────────────────────────────────────┐
│                                     │
│          📄                          │
│   Actionを選択してください           │
│   左の一覧からActionを選択すると、    │
│   詳細を確認・編集できます           │
│                                     │
└─────────────────────────────────────┘
```

#### 選択後の詳細パネル
- Action詳細
- Evidence確認
- 編集機能
- Status変更
- Outbound起票
- 保留/完了/再設定

---

## 2. Content画面の改善

### Before (旧構成)
```
[Header]
[左: Content一覧(350px)] [中央: Editor(可変)] [右: Template/Evidence(400px)]
```

- 最初から中央にエディタが表示される
- 長文エディタが常時表示
- 3カラムで情報が多い

### After (新構成)
```
[Header + Summary Cards + Filter Bar]
[左: Content一覧(未選択時:100%、選択時:400px)] [右: 詳細/Editor(選択時のみ表示)]
```

- 最初はContent未選択 → 一覧が主役
- 選択後に右側に詳細/エディタが開く
- Summary Cardsで状況を一目で把握

### 追加機能

#### Summary Cards (ヘッダー内)
- 下書き: Draft Content
- レビュー中: In Review Content
- 承認済: Approved Content
- 全Content: 総件数

#### Filter Bar (ヘッダー内)
- 検索フィールド
- Statusフィルタ (all / draft / in_review / approved / sent)
- Typeフィルタ (all / email / slack_chatwork / internal_note / support_reply)
- フィルタクリアボタン

#### 未選択時の表示
```
┌─────────────────────────────────────┐
│                                     │
│          📄                          │
│   Contentを選択してください          │
│   左の一覧からContentを選択すると、   │
│   詳細を確認・編集できます           │
│                                     │
└─────────────────────────────────────┘
```

#### 選択後の詳細/エディタ
- Content詳細
- 本文エディタ (Edit / Preview タブ)
- Template適用
- Evidence確認
- Review依頼
- Outbound起票

---

## 3. UI/UX改善のポイント

### 閲覧から作業への自然な流れ
1. **Top画面**: 一覧で状況を把握
2. **選択**: アイテムをクリック
3. **詳細確認**: 右側に詳細パネルが開く
4. **作業**: 必要に応じて編集・作業

### 情報密度の最適化
- 最初は一覧とSummaryに集中
- 選択後に詳細情報を表示
- 3カラムから2カラムに変更（未選択時は1カラム）

### CTAの整理

#### Top画面のCTA
- 新規作成
- フィルタ
- Summary Cards（クリックでフィルタ適用可能）

#### 詳細画面のCTA
- 編集
- Status変更
- Outbound起票
- Evidence確認
- Template適用（Content）
- Review依頼（Content）

---

## 4. 技術的な実装ポイント

### State管理
```typescript
// 初期値を null に変更
const [selectedAction, setSelectedAction] = useState<string | null>(null);
const [selectedJob, setSelectedJob] = useState<string | null>(null);

// フィルタ用State追加
const [filterStatus, setFilterStatus] = useState<string>("all");
const [filterPriority, setFilterPriority] = useState<string>("all");
const [filterType, setFilterType] = useState<string>("all");
const [searchQuery, setSearchQuery] = useState("");
```

### フィルタリングロジック
```typescript
const filteredActions = mockActions.filter(action => {
  if (filterStatus !== "all" && action.status !== filterStatus) return false;
  if (filterPriority !== "all" && action.priority !== filterPriority) return false;
  if (searchQuery && !action.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
  return true;
});
```

### レスポンシブレイアウト
```typescript
// 未選択時: 一覧が100%
// 選択時: 一覧450px + 詳細(残り)
<div className={`h-full flex gap-4 transition-all ${selectedAction ? 'grid grid-cols-[450px_1fr]' : ''}`}>
```

---

## 5. 今後の展開

### 可能な拡張
- Summary Cardsクリックでフィルタ適用
- ソート機能追加
- 一覧のグループ化表示
- 複数選択機能
- Bulk操作

### UX向上
- キーボードナビゲーション
- 一覧の無限スクロール
- リアルタイム検索
- 最近開いたアイテムのクイックアクセス

---

## まとめ

### 達成したこと
✅ 閲覧起点の画面構成に変更
✅ 未選択時は一覧が主役
✅ Summary Cardsで状況を一目で把握
✅ Filter Barで効率的な絞り込み
✅ 選択後に詳細・編集に入る自然なフロー
✅ 情報密度の最適化（3カラム → 2カラム）
✅ CTAの整理と配置の最適化

### B2B SaaS管理画面としての完成度
- ✅ 運用しやすい情報密度
- ✅ 状況把握 → 選択 → 作業の明確な流れ
- ✅ 重い作業を最初から見せない
- ✅ 文脈を常に明示
- ✅ Evidenceへのアクセスが容易
