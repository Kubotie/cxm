# 画面仕様 クイックリファレンス

## 📋 ドキュメント構成

- **詳細仕様**: `/SCREEN_SPECIFICATIONS.md`（Audience / Actions / Content）
- **詳細仕様Part2**: `/SCREEN_SPECIFICATIONS_PART2.md`（Outbound / Library）
- **本ファイル**: クイックリファレンス

---

## 🎯 一覧・新規作成・編集画面の役割

### 一覧画面の役割
- ✅ 見つける・比較する・選ぶ・状態を把握する
- ✅ 最小限のカラムのみ表示
- ❌ 重い編集を始めさせない
- ❌ 送信系CTAを置かない

### 新規作成画面の役割
- ✅ 必要な項目を入力して作る
- ✅ Source contextを引き継ぐ
- ✅ 基本情報 → 文脈 → 内容/条件 → 保存の順
- ❌ 空白だけのフォームにしない

### 編集画面の役割
- ✅ 既存内容を理解し、変更する
- ✅ 使用先や関連先が見える
- ✅ 次の導線を提供する
- ❌ 最終送信実行はしない（Composeのみ）

---

## 📊 一覧画面のカラム項目

### 1. Audience List

| 必須カラム | 任意カラム |
|-----------|-----------|
| • Status<br>• Audience Name<br>• Scope<br>• Target Count<br>• Owner<br>• Updated At | • Description<br>• Source Context<br>• Linked Company/Project<br>• Last Used<br>• Reusable Flag |

### 2. Actions List

| 必須カラム | 任意カラム |
|-----------|-----------|
| • Status<br>• Priority<br>• Action Title<br>• Owner<br>• Due Date<br>• Company/Project | • Action Type<br>• Evidence件数<br>• Updated At<br>• Flags（blocked/overdue） |

### 3. Content List

| 必須カラム | 任意カラム |
|-----------|-----------|
| • Status<br>• Title<br>• Content Type<br>• Owner<br>• Company/Project | • Review State<br>• Purpose<br>• Template<br>• Updated At |

### 4. Outbound List

| 必須カラム | 任意カラム |
|-----------|-----------|
| • Delivery Status<br>• Outbound Name<br>• Channel<br>• Recipients<br>• Owner | • Review State<br>• Audience Scope<br>• Source Context<br>• Unresolved<br>• Scheduled/Sent Date<br>• Reaction Summary |

### 5. Library List

| 必須カラム | 任意カラム |
|-----------|-----------|
| • Category<br>• Status<br>• Title<br>• Owner<br>• Updated At | • Type（Template）<br>• Applicable Scope<br>• Tags<br>• Linked Context<br>• Reusable Flag |

---

## 📝 新規作成で入力する項目

### 1. Audience Create

**基本情報**:
- Audience Name *
- Description
- Audience Scope *
- Reusable Flag

**条件設定**:
- Linked Company/Project
- Filters *（field / operator / value）

**プレビュー**:
- Target Count（自動計算）
- 代表対象（上位10件）

### 2. Action Create

**基本項目**:
- Title *
- Action Type *
- Purpose *
- Priority *
- Owner *
- Due Date *

**文脈項目**:
- Linked Company/Project/User
- Linked Evidence
- Next Step

### 3. Content Create

**基本項目**:
- Title *
- Content Type *
- Purpose *
- Owner *

**本文項目**:
- Subject（email時）
- Body *（Rich Text）
- Template
- Variables

**文脈項目**:
- Linked Company/Project/User
- Linked Evidence/Action

### 4. Outbound Create

**基本項目**:
- Outbound Name *
- Channel *
- Audience Scope *

**送信対象**:
- Audience Conditions
- Resolved Recipients
- Unresolved Recipients（警告表示）

**本文項目**:
- Subject *（email時）
- Body *（Rich Text）
- Template
- Variables

**文脈項目**:
- Linked Company/Project/User
- Linked Action/Content/Audience

### 5. Library Create

**ステップ1**: 種別選択（Template / Playbook / Knowledge / Asset）

**ステップ2**: 共通項目
- Title *
- Description *
- Owner *
- Status
- Tags
- Applicable Scope

**ステップ3**: 種別別項目
- **Template**: Subject / Body / Variables
- **Playbook**: Trigger Condition / Recommended Steps
- **Knowledge**: Summary / Body / Recommendation
- **Asset**: File Upload / File Type / Preview

---

## 🔧 編集画面で見せるもの

### 1. Audience Edit

| セクション | 編集可能 | 表示のみ |
|-----------|---------|---------|
| 基本情報 | ✓ Name<br>✓ Description<br>✓ Scope<br>✓ Status | - Owner<br>- Created/Updated |
| 条件 | ✓ Filters<br>✓ Linked entities | - Target Count |
| 使用履歴 | - | - Linked Outbound<br>- Last Used<br>- Total Uses |

### 2. Action Edit

| セクション | 編集可能 | 表示のみ |
|-----------|---------|---------|
| 基本情報 | ✓ Title<br>✓ Type<br>✓ Purpose<br>✓ Priority<br>✓ Owner<br>✓ Due<br>✓ Status | - Created/Updated |
| 関連文脈 | ✓ Linked entities<br>✓ Next Step | - Linked Action（親） |
| Status履歴 | - | - 変更履歴 |

### 3. Content Edit

| セクション | 編集可能 | 表示のみ |
|-----------|---------|---------|
| 基本情報 | ✓ Title<br>✓ Purpose<br>✓ Status | - Content Type |
| 本文 | ✓ Subject<br>✓ Body<br>✓ Variables | - Template |
| 使用履歴 | - | - Used In Outbound<br>- Total Uses |

### 4. Outbound Edit

Outbound Composeと同じ画面。送信済みの場合は`/outbound/results/:id`にリダイレクト。

### 5. Library Edit

| セクション | 編集可能 | 表示のみ |
|-----------|---------|---------|
| 基本情報 | ✓ Title<br>✓ Description<br>✓ Owner<br>✓ Status<br>✓ Tags<br>✓ Applicable Scope | - Category |
| 資産内容 | ✓ （種別別の内容） | - |
| 再利用先 | - | - Used In Content/Outbound<br>- Total Uses<br>- Last Used |

---

## ⚡ 主要なCTA一覧

### 一覧画面のCTA

| 画面 | 主CTA | 軽いCTA |
|------|------|---------|
| Audience | 新規Audience作成 | 詳細・Outboundで使う・複製 |
| Actions | 新規Action作成 | 詳細・完了・保留 |
| Content | 新規Content作成 | 詳細 |
| Outbound | 新規Outbound作成 | 詳細（or 編集/Results） |
| Library | +新規作成（種別選択） | 詳細 |

### 詳細/編集画面のCTA

| 画面 | 主CTA | 補助CTA |
|------|------|---------|
| Audience | Outboundで使う | 編集・複製・Export・アーカイブ・削除 |
| Actions | Outbound起票・保存 | Follow-up作成・Playbook化・完了・保留・削除 |
| Content | Outboundで使う・保存 | Libraryに登録・プレビュー・複製・削除 |
| Outbound | 送信実行（Composeのみ） | 下書き保存・レビュー依頼・送信対象調整 |
| Library | 保存・適用CTA | 複製・ダウンロード（Asset）・削除 |

**適用CTA（Library）**:
- Template → Outboundで使う / Contentで使う
- Playbook → Actionで使う
- Asset → ダウンロード / 共有リンクをコピー

---

## 🔗 Source Context引き継ぎパターン

### From Evidence
```
Evidence詳細 → Actions/Content/Outbound/Library
引き継ぎ: linked_evidence / linked_company / linked_project / linked_user
```

### From Action
```
Action詳細 → Content/Outbound/Library(Playbook)
引き継ぎ: linked_action / linked_company / linked_project / linked_evidence
```

### From Content
```
Content詳細 → Outbound/Library(Template)
引き継ぎ: linked_content / subject / body / variables / linked_company / linked_project
```

### From Project
```
Project詳細 → Actions/Content/Outbound/Audience
引き継ぎ: linked_project / linked_company / audience_scope=project（Audienceの場合）
```

### From Audience
```
Audience詳細 → Outbound
引き継ぎ: linked_audience / audience_scope / filters / resolved_recipients / linked_company / linked_project
```

### From Template (Library)
```
Template詳細 → Content/Outbound
引き継ぎ: template_id / subject / body / variables / channel
```

### From Playbook (Library)
```
Playbook詳細 → Actions
引き継ぎ: playbook手順 / trigger_condition / recommended_steps
```

---

## 🎨 UI実装パターン

### 一覧画面
```tsx
<Table>
  <TableHeader>{/* カラムヘッダー */}</TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow>
        {/* Badge・Link・Text */}
        <TableCell>
          <Button size="sm" variant="outline">詳細</Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 詳細パネル（Sheet）
```tsx
<Sheet open={detailOpen} onOpenChange={setDetailOpen}>
  <SheetContent className="w-[700px] overflow-y-auto">
    <SheetHeader>{/* タイトル・説明 */}</SheetHeader>
    <div className="space-y-6 mt-6">
      {/* セクション別に表示 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">セクション名</h3>
        {/* 項目表示 */}
      </div>
      <Separator />
    </div>
    <div className="flex gap-2 pt-4">
      {/* 主CTA・補助CTA */}
    </div>
  </SheetContent>
</Sheet>
```

### 新規作成Sheet
```tsx
<Sheet open={createOpen} onOpenChange={setCreateOpen}>
  <SheetContent className="w-[700px] overflow-y-auto">
    <SheetHeader>{/* タイトル */}</SheetHeader>
    {sourceContext && (
      <div className="bg-blue-50 border rounded p-3 mt-4">
        {/* Source context表示 */}
      </div>
    )}
    <form className="space-y-6 mt-6">
      {/* 基本情報 */}
      <Separator />
      {/* 文脈項目 */}
      <Separator />
      {/* 内容/条件 */}
      <div className="flex gap-2 pt-4">
        {/* 保存ボタン */}
      </div>
    </form>
  </SheetContent>
</Sheet>
```

### 種別選択モーダル（Library）
```tsx
<Dialog open={showTypeSelectModal} onOpenChange={setShowTypeSelectModal}>
  <DialogContent>
    <DialogHeader>{/* タイトル */}</DialogHeader>
    <div className="grid grid-cols-2 gap-4">
      <Button variant="outline" className="h-32 flex-col">
        <Icon className="w-12 h-12" />
        <div>種別名</div>
        <div className="text-xs">説明</div>
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## ⚠️ 重要なルール

### 送信系ルール
1. ❌ Actions / Content / Libraryでは送信実行しない
2. ❌ Outbound一覧でも送信完結しない
3. ✅ 最終送信実行はComposeのみ
4. ✅ 外部送信系CTAはComposeに来るまでは通常色
5. ✅ danger表現は最終送信実行だけ

### 一覧画面ルール
1. ✅ 最小限のカラムのみ
2. ✅ 軽いCTAのみ（詳細・選択・軽い状態変更）
3. ❌ 重い編集CTA置かない
4. ❌ 送信系CTA置かない

### 新規作成ルール
1. ✅ Source contextを最初に見せる
2. ✅ 基本情報 → 文脈 → 内容の順
3. ✅ プレビュー・サマリーを提供
4. ❌ 空白だけのフォームにしない

### 編集画面ルール
1. ✅ 既存内容がまず分かる
2. ✅ 何が変更可能か分かる
3. ✅ 使用先や関連先が見える
4. ✅ 次の導線を提供

---

## 📦 実装優先度

### Phase 1（即座に）
1. ✅ Audience List画面
2. ✅ Audience Detail Sheet
3. ✅ Audience Builder拡張
4. ✅ Actions/Content詳細Sheet CTA整理
5. ✅ Source context引き継ぎロジック

### Phase 2（次のフェーズ）
1. ✅ Library種別選択モーダル
2. ✅ Template作成フォーム（Variables UI）
3. ✅ Playbook作成フォーム（Steps UI）
4. ✅ Content→Library登録フロー
5. ✅ Actions→Playbook化フロー

### Phase 3（将来的に）
1. ✅ Knowledge作成フォーム
2. ✅ Asset作成フォーム（File Upload UI）
3. ✅ Template/Playbook→各機能への適用導線
4. ✅ Audience複製機能

---

## 🚀 実装時のチェックリスト

### 一覧画面実装時
- [ ] 必須カラムを全て表示
- [ ] フィルタ・ソートを実装
- [ ] 軽いCTAのみ配置
- [ ] 「詳細を見る」ボタンで詳細Sheet起動
- [ ] 送信系CTA置かない

### 新規作成画面実装時
- [ ] Source context表示
- [ ] 基本情報→文脈→内容の順
- [ ] 引き継ぎロジック実装
- [ ] プレビュー・サマリー表示
- [ ] 保存オプション（下書き・作成・登録）

### 編集画面実装時
- [ ] 既存値を全て表示
- [ ] 編集可能項目を明示
- [ ] 使用履歴を表示
- [ ] 次の導線CTA配置
- [ ] 削除確認モーダル

---

このクイックリファレンスを手元に置いて、各画面の実装を進めてください。
