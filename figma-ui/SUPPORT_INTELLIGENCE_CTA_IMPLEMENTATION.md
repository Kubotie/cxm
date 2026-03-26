# Support Intelligence Settings - CTA 実装ガイド

## 概要
このドキュメントは、Support Intelligence Settings 画面の CTA（Call To Action）実装における具体的な変更点をまとめたものです。

詳細な設計仕様は `/SUPPORT_INTELLIGENCE_CTA_DESIGN.md` を参照してください。

---

## 実装の優先度

### 必須実装（Phase 1）
1. ✅ Alert Rules のアクション列の更新
2. ✅ Suggestion Rules のアクション列の更新
3. ✅ Summary Rules のアクション列の更新（編集を主CTAに）
4. ✅ Threshold Presets のアクション列の更新
5. ✅ Feed Display Rules のアクション列の更新（編集を主CTAに）

### 推奨実装（Phase 2）
6. 各ルールの詳細/編集モーダルの作成
7. テスト機能の実装
8. 変更履歴表示の実装

### オプション実装（Phase 3）
9. 権限制御の実装
10. Applied Rules 表示機能
11. Recent Matched Examples 表示機能

---

## 共通コンポーネントの追加

### 必要なインポート

```tsx
// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

// DropdownMenu
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

// アイコン
import {
  // 既存のアイコンに追加
  MoreVertical,  // メニュー用
  Play,          // テスト用
  // その他は既にインポート済み: Edit3, Copy, History
} from "lucide-react";
```

---

## 1. Alert Rules のアクション列

### 現状
```tsx
<TableCell>
  <div className="flex gap-1">
    <Button variant="ghost" size="sm">
      <Edit3 className="w-4 h-4" />
    </Button>
    <Button variant="ghost" size="sm">
      <Copy className="w-4 h-4" />
    </Button>
  </div>
</TableCell>
```

### 変更後
```tsx
<TableCell>
  <div className="flex gap-1">
    {/* 編集 - 主CTA */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Edit3 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>編集</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* テスト - 検証CTA */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Play className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>テスト</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* 複製 - 補助CTA */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Copy className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>複製</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* その他メニュー */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <History className="w-4 h-4 mr-2" />
          変更履歴
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</TableCell>
```

### 適用対象
- High Priority CSE Waiting（行1）
- Recurring Issue Detection（行2）
- High-Value Customer Inquiry（行3）
- Volume Spike Detection（行4）

---

## 2. Suggestion Rules のアクション列

### 変更内容
Alert Rules と同じパターンを適用します。

### CTAの違い
- 編集: 主CTA（同じ）
- テスト: サンプルアラートで AI 提案を生成→プレビュー表示
- 複製: 補助CTA（同じ）
- その他メニュー: 変更履歴（同じ）

### 適用対象
- FAQ Creation for Recurring Issues（行1）
- Help Article Draft Suggestion（��2）
- Proactive Outbound Suggestion（行3）
- Event Suggestion for High Priority（行4）

---

## 3. Summary Rules のアクション列

### 現状
```tsx
<TableCell>
  <div className="flex gap-1">
    <Button variant="ghost" size="sm">
      <Edit3 className="w-4 h-4" />
    </Button>
    <Button variant="ghost" size="sm">
      <Copy className="w-4 h-4" />
    </Button>
  </div>
</TableCell>
```

### 変更後
```tsx
<TableCell>
  <div className="flex gap-1">
    {/* 編集 - 主CTA（Summary Rules では新規作成より編集が主） */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Edit3 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>編集</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* テスト（出力例生成） - 検証CTA */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Play className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>出力例を生成</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* 複製 - 補助CTA */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Copy className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>複製</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* その他メニュー */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <History className="w-4 h-4 mr-2" />
          変更履歴
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</TableCell>
```

### 適用対象
- AI Summary - Executive Style（行1）
- Why This Matters - Risk Focused（行2）
- Suggested Next Step - Action Oriented（行3）
- Similar Case Summary - Pattern Highlight（行4）

---

## 4. Threshold Presets のアクション列

### 現状
```tsx
<TableCell>
  <Button variant="ghost" size="sm">
    <Edit3 className="w-4 h-4" />
  </Button>
</TableCell>
```

### 変更後
```tsx
<TableCell>
  <div className="flex gap-1">
    {/* 編集 - 主CTA */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Edit3 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>編集</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* 複製 - 補助CTA */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Copy className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>複製</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    {/* その他メニュー（オプション） */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <ExternalLink className="w-4 h-4 mr-2" />
          適用中のルールを見る
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</TableCell>
```

### 特記事項
- Threshold Presets にはテストボタンは不要（単体でのテストは意味がない）
- 「適用中のルールを見る」はオプション機能

### 適用対象
- CSE Waiting Time - High Priority（行1）
- Recurring Issue Count（行2）
- High-Value Customer Threshold（行3）

---

## 5. Feed Display Rules のアクション列

### 変更内容
Summary Rules と同じパターンを適用します。

### CTAの違い
- 編集: 主CTA（Feed Display Rules も事前定義型が中心）
- テスト: Feed プレビューを表示（「表示プレビュー」）
- 複製: 補助CTA
- その他メニュー: 変更履歴

### 適用対象
- All Alerts - Default Feed（行1）
- Urgent Tab - Priority Boost（行2）
- Risk Tab - Pattern Grouping（行3）
- Opportunity Tab - Value Sort（行4）

---

## 削除するCTA（念押し）

以下のCTAは、Support Intelligence Settings に実装しません：

### 運用系CTA（削除対象）
- ❌ Support Queue / Support Home への直接遷移
- ❌ Support case を開く
- ❌ 顧客ログを直接見る
- ❌ 送信する
- ❌ 本文作成

### 作成系CTA（削除対象）
- ❌ FAQ Draft を直接生成
- ❌ Content を直接作成
- ❌ Outbound を直接起票
- ❌ Event を直接作成
- ❌ Action を直接作成

### 理由
この画面は「ルール/設定の管理画面」であり、「運用画面の代替」ではありません。
実際の運用は Support Home / Alert Detail / Support Detail で行われます。

---

## 実装チェックリスト

### Phase 1: アクション列の更新（必須）
- [ ] MoreVertical アイコンをインポート
- [ ] Tooltip コンポーネントをインポート
- [ ] DropdownMenu コンポーネントをインポート
- [ ] Alert Rules: 3つの行のアクション列を更新（Edit, Test, Copy, Menu）
- [ ] Suggestion Rules: 3つの行のアクション列を更新（Edit, Test, Copy, Menu）
- [ ] Summary Rules: 3つの行のアクション列を更新（Edit, Test, Copy, Menu）
- [ ] Threshold Presets: 3つの行のアクション列を更新（Edit, Copy, Menu）
- [ ] Feed Display Rules: 3つの行のアクション列を更新（Edit, Test, Copy, Menu）

### Phase 2: 詳細画面の作成（推奨）
- [ ] Alert Rules 編集モーダル
- [ ] Suggestion Rules 編集モーダル
- [ ] Summary Rules 編集モーダル
- [ ] Threshold Presets 編集モーダル
- [ ] Feed Display Rules 編集モーダル

### Phase 3: 検証機能の実装（推奨）
- [ ] Alert Rules テストモーダル
- [ ] Suggestion Rules テストモーダル（AI提案プレビュー）
- [ ] Summary Rules テストモーダル（出力例生成）
- [ ] Feed Display Rules テストモーダル（Feedプレビュー）

### Phase 4: 補助機能の実装（オプション）
- [ ] 変更履歴表示
- [ ] Applied Rules 表示（Threshold Presets）
- [ ] Recent Matched Examples 表示（Alert/Suggestion Rules）
- [ ] 出力例一覧表示（Summary Rules）

---

## コード例: TooltipProvider の最適化

現状の実装では各ボタンごとに TooltipProvider を配置していますが、
パフォーマンス最適化のため、親要素で一度だけ提供することも可能です。

### 最適化版（オプション）

```tsx
<TooltipProvider>
  <TableCell>
    <div className="flex gap-1">
      {/* 編集 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Edit3 className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>編集</TooltipContent>
      </Tooltip>

      {/* テスト */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Play className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>テスト</TooltipContent>
      </Tooltip>

      {/* 複製 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm">
            <Copy className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>複製</TooltipContent>
      </Tooltip>

      {/* メニュー */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <History className="w-4 h-4 mr-2" />
            変更履歴
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </TableCell>
</TooltipProvider>
```

---

## まとめ

Support Intelligence Settings の CTA 設計は、以下の原則に基づいています：

1. **ルール管理に徹する**: 作成・編集・テスト・検証・履歴管理のみ
2. **運用CTAを置かない**: 送信・対応・作成などの日常業務CTAは除外
3. **テスト機能を充実**: プレビュー・出力例・一致例で動作確認を支援
4. **Tooltipで分かりやすく**: アイコンのみでも何のボタンか理解可能に
5. **メニューで整理**: 頻度の低いアクションはドロップダウンメニューに集約

この実装により、Manager以上が Support - Alert Feed の動作を安全かつ効率的に調整できる環境が整います。

詳細な設計仕様は `/SUPPORT_INTELLIGENCE_CTA_DESIGN.md` を参照してください。
