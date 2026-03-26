# ナビゲーション設計サマリー

## 設計ドキュメント構成

本システムには3つの主要設計ドキュメントがあります：

### 1. `/CTA_LIST_VS_DETAIL.md`
**テーマ**: 一覧 vs 詳細パネルのCTA配置整理

**内容**:
- 一覧画面では「選ぶ・仕分ける・軽く判断する」CTA
- 詳細パネルでは「理解する・業務化する・Outboundに渡す」CTA
- 送信系CTAは詳細パネル内に配置（一覧には置かない）
- 7画面（Inbox/Unified Log/Company/Project/User/Actions/Content）の整理
- 新規作成CTAの役割分担（Actions/Content/Outbound/Library）

**適用対象**:
- Inbox、Unified Log、Company Detail、Project、User、Actions、Content、Outbound、Library

---

### 2. `/CREATE_CTA_DESIGN.md`
**テーマ**: 新規作成CTAの役割分担と未設計部分の補完

**内容**:
- Actions: 業務を作る
- Content: 作業物を作る
- Outbound: 顧客接点を作る
- Library: 再利用資産を作る
- 単発実行 vs 再利用資産の分離
- Source contextからの接続フロー
- 各機能の新規作成フォーム設計

**適用対象**:
- Actions、Content、Outbound、Library

**主要設計**:
- Library種別選択（Template/Playbook/Knowledge/Asset）
- Variables設定UI（Template用）
- Recommended Steps設定UI（Playbook用）
- File UploadUI（Asset用）
- Playbook化フロー（Actions→Library）
- Libraryに登録フロー（Content→Library）

---

### 3. `/LIST_DETAIL_CREATE_DESIGN.md`
**テーマ**: 一覧 → 詳細 → 新規作成の3段階導線設計（Audience追加）

**内容**:
- Actions / Content / Outbound / Library / Audience の5機能
- 各機能の一覧・詳細・新規作成の3段階を明確化
- Audienceの新規設計（List/Detail/Builder）
- Source contextからの引き継ぎパターン
- UI実装パターン（コード例付き）

**適用対象**:
- Actions、Content、Outbound、Library、Audience

**主要設計**:
- Audience List画面（新規）
- Audience Detail Sheet（新規）
- Audience Builder拡張（保存・登録機能追加）
- 各機能の作成フォーム詳細仕様

---

## 設計原則の統合

### 基本原則

#### 一覧の役割
- 見つける・比較する・選ぶ・状態を把握する
- 軽いCTAのみ配置（詳細を見る、選択、軽い状態変更）
- 重い編集・送信系CTAは置かない

#### 詳細の役割
- 文脈を理解する・確認する・関連情報を見る
- 次の画面に渡す導線を提供する
- 重いCTA配置（Outbound起票、編集、業務化）

#### 新規作成の役割
- 入力する・条件を定義する・作る・保存する
- 再利用可能にする（Libraryの場合）
- Source contextを引き継ぐ

### 単発実行 vs 再利用資産

#### 単発実行用（Actions/Content/Outbound/Audience）
- 1回限りの実行を想定
- 各画面で作成・管理
- 基本的には再利用しない
- 必要に応じてLibraryに登録可能

#### 再利用資産（Library）
- 複数回の再利用を想定
- Libraryで一元管理
- Template / Playbook / Knowledge / Asset の4種別
- 承認ワークフロー付き

---

## 画面構成マップ

### Actions
```
/actions (一覧)
  → Action Detail Sheet (詳細)
    → 「Outbound起票」 → /outbound/compose
    → 「Follow-upを作成」 → Action Create Form
    → 「Playbook化する」 → Library Create (Playbook)
  → 「新規Action作成」 → Action Create Form
```

### Content
```
/content (一覧)
  → Content Detail Sheet (詳細)
    → 「Outboundで使う」 → /outbound/compose
    → 「Libraryに登録」 → Library Create (Template)
  → 「新規Content作成」 → Content Create Form
```

### Outbound
```
/outbound (一覧)
  → 「詳細を見る」
    → /outbound/editor/:id (draft/scheduled)
      → 「送信対象を調整」 → /audience (Workspace)
      → 「送信実行」 → 送信実行
    → /outbound/results/:id (sent/failed)
      → 「Follow-up送信を作成」 → /outbound/compose
  → 「新規Outbound作成」 → /outbound/compose
```

### Library
```
/library (一覧)
  → Library Detail Sheet (詳細)
    → Template: 「Outboundで使う」 → /outbound/compose
    → Template: 「Contentで使う」 → /content/create
    → Playbook: 「Actionで使う」 → /actions/create
    → Asset: 「ダウンロード」
  → 「+新規作成」 → 種別選択モーダル
    → Template → Template Create Form
    → Playbook → Playbook Create Form
    → Knowledge → Knowledge Create Form
    → Asset → Asset Create Form (File Upload)
```

### Audience
```
/audience/list (一覧、新規実装)
  → Audience Detail Sheet (詳細、新規実装)
    → 「Outboundで使う」 → /outbound/compose
    → 「編集」 → /audience (Builder)
  → 「新規Audience作成」 → /audience (Builder)

/audience (Builder、既存拡張)
  → Audience作成・編集
  → 「Audienceとして登録」 → 保存
  → 「Outboundで使う」 → /outbound/compose
```

---

## Source Context引き継ぎパターン

### Evidence → 各機能
```
Evidence詳細パネル
  → 「Actionを作る」 → /actions/create?fromEvidence=${evidenceId}
  → 「Contentを作る」 → /content/create?fromEvidence=${evidenceId}
  → 「Outbound起票」 → /outbound/compose?fromEvidence=${evidenceId}
  → 「Library資産を作る」 → Library種別選択
```

### Action → 各機能
```
Action詳細パネル
  → 「Outbound起票」 → /outbound/compose?fromAction=${actionId}
  → 「Playbook化する」 → Library Create (Playbook)
  → 「Follow-upを作成」 → /actions/create?followUp=${actionId}
```

### Content → 各機能
```
Content詳細パネル
  → 「Outboundで使う」 → /outbound/compose?fromContent=${contentId}
  → 「Libraryに登録」 → Library Create (Template)
```

### Project → 各機能
```
Project詳細画面
  → 「Actionを作成」 → /actions/create?fromProject=${projectId}
  → 「Contentを作成」 → /content/create?fromProject=${projectId}
  → 「Outboundを起票」 → /outbound/compose?fromProject=${projectId}
  → 「Audience作成」 → /audience?fromProject=${projectId}
```

### Company → 各機能
```
Company詳細画面
  → 「Actionを作成」 → /actions/create?fromCompany=${companyId}
  → 「Contentを作成」 → /content/create?fromCompany=${companyId}
  → 「Outboundを起票」 → /outbound/compose?fromCompany=${companyId}
  → 「Audience作成」 → /audience?fromCompany=${companyId}
```

### Cluster → Audience
```
Cluster詳細画面
  → 「Audience作成」 → /audience?fromCluster=${clusterId}
```

### Audience → Outbound
```
Audience詳細パネル または Audience Builder
  → 「Outboundで使う」 → /outbound/compose?fromAudience=${audienceId}
```

### Library (Template) → 各機能
```
Template詳細パネル
  → 「Outboundで使う」 → /outbound/compose?fromTemplate=${templateId}
  → 「Contentで使う」 → /content/create?fromTemplate=${templateId}
```

### Library (Playbook) → Action
```
Playbook詳細パネル
  → 「Actionで使う」 → /actions/create?fromPlaybook=${playbookId}
```

### Outbound → Audience
```
Outbound Editor
  → 「送信対象を調整」 → /audience?returnTo=/outbound/editor/${id}
  → Audience調整
  → 「Editorに戻る」 → Outbound Editorに戻る
```

### Outbound Results → Follow-up
```
Outbound Results
  → 「Follow-up送信を作成」 → /outbound/compose?followUp=${outboundId}
```

---

## 実装優先度マトリクス

### 優先度 High（即座に実装）

#### Audience機能（新規）
- [ ] Audience List画面（`/audience/list`）
- [ ] Audience Detail Sheet
- [ ] Audience Builder拡張（保存・登録機能）
- [ ] Audience → Outbound導線

#### CTA配置整理
- [ ] Actions: 「Outbound起票」を詳細Sheetへ移動
- [ ] Content: 「Outboundで使う」を詳細Sheetへ移動
- [ ] Inbox: 「返信/案内を準備」を詳細Sheetへ移動

#### Source Context引き継ぎ
- [ ] Actions Create: Source context引き継ぎロジック
- [ ] Content Create: Source context引き継ぎロジック
- [ ] Outbound Compose: Source context引き継ぎロジック

### 優先度 Medium（次のフェーズ）

#### Library機能
- [ ] Library種別選択モーダル
- [ ] Template作成フォーム（Variables設定UI）
- [ ] Playbook作成フォーム（Recommended Steps UI）
- [ ] Knowledge作成フォーム
- [ ] Asset作成フォーム（File UploadUI）

#### 再利用資産化フロー
- [ ] Content → Libraryに登録フロー
- [ ] Actions → Playbook化フロー
- [ ] Outbound → Template化フロー（将来）

#### Audience機能拡張
- [ ] Audience複製機能
- [ ] Audience Export機能
- [ ] Audience使用履歴詳細

### 優先度 Low（将来的に）

#### 高度な機能
- [ ] Variables自動抽出機能
- [ ] Template preview機能
- [ ] Playbook version管理
- [ ] Asset preview生成
- [ ] Audience Analytics

---

## UI実装パターン

### 一覧画面
```tsx
<Table>
  <TableHeader>
    {/* カラムヘッダー */}
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id}>
        {/* 視認項目（Badge、Text） */}
        <TableCell>
          <Button size="sm" variant="outline" onClick={() => openDetail(item.id)}>
            詳細を見る
          </Button>
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
    <SheetHeader>
      <SheetTitle>{item.title}</SheetTitle>
      <SheetDescription>{item.description}</SheetDescription>
    </SheetHeader>
    
    {/* 詳細情報表示 */}
    <div className="space-y-4 mt-6">
      {/* 基本情報 */}
      {/* 関連情報 */}
      {/* Evidence一覧 */}
    </div>
    
    {/* 主CTA */}
    <div className="mt-6 flex gap-2">
      <Button className="bg-blue-600">主CTA</Button>
      <Button variant="outline">補助CTA</Button>
    </div>
  </SheetContent>
</Sheet>
```

### 新規作成フォーム（Sheet/Drawer）
```tsx
<Sheet open={createOpen} onOpenChange={setCreateOpen}>
  <SheetContent className="w-[700px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>新規作成</SheetTitle>
      <SheetDescription>
        {sourceContext && `${sourceContext}から作成`}
      </SheetDescription>
    </SheetHeader>
    
    <form className="space-y-4 mt-6">
      {/* 基本情報 */}
      {/* リンク情報 */}
      {/* 保存ボタン */}
      <div className="flex gap-2">
        <Button type="submit" className="bg-blue-600">作成</Button>
        <Button type="button" variant="outline" onClick={saveDraft}>下書き保存</Button>
      </div>
    </form>
  </SheetContent>
</Sheet>
```

### 種別選択モーダル（Library用）
```tsx
<Dialog open={showTypeSelectModal} onOpenChange={setShowTypeSelectModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Library資産の種別を選択</DialogTitle>
    </DialogHeader>
    
    <div className="grid grid-cols-2 gap-4">
      <Button variant="outline" className="h-24 flex-col" onClick={() => handleTypeSelect('template')}>
        <FileText className="w-8 h-8 mb-2" />
        <span>Template</span>
      </Button>
      {/* 他の種別 */}
    </div>
  </DialogContent>
</Dialog>
```

---

## 用語統一

### 画面種別
- **一覧（List）**: 複数itemを表形式で表示
- **詳細（Detail）**: 単一itemの詳細をSheet/Panelで表示
- **新規作成（Create）**: 新しいitemを作成するフォーム

### UI要素
- **Sheet**: 右側から開く詳細パネル（推奨）
- **Drawer**: 下から開く詳細パネル
- **Modal/Dialog**: 選択肢や確認を促すポップアップ
- **Panel**: 固定サイドパネル

### CTA種別
- **主CTA**: 最も重要な操作（青色ボタン）
- **補助CTA**: 補助的な操作（outline ボタン）
- **危険CTA**: 危険な操作（赤色ボタン、Composeの送信実行のみ）

### Source Context
- **fromEvidence**: Evidenceから起票
- **fromAction**: Actionから起票
- **fromContent**: Contentから起票
- **fromProject**: Projectから起票
- **fromCompany**: Companyから起票
- **fromCluster**: Clusterから起票
- **fromAudience**: Audienceから起票
- **fromTemplate**: Templateから起票
- **fromPlaybook**: Playbookから起票
- **followUp**: Follow-upとして作成
- **returnTo**: 戻り先URL指定

---

## 次のステップ

### Phase 1: Audience機能実装
1. Audience List画面の新規作成
2. Audience Detail Sheetの新規作成
3. Audience Builderの拡張（保存・登録機能）
4. Project/Company/Cluster → Audience導線実装

### Phase 2: CTA配置整理
1. Actions/Content/Inbox の詳細Sheet実装
2. 重いCTAの詳細Sheetへの移動
3. 一覧画面のシンプル化

### Phase 3: Library機能実装
1. 種別選択モーダル実装
2. Template/Playbook/Knowledge/Asset作成フォーム実装
3. Variables設定UI実装
4. File UploadUI実装

### Phase 4: 再利用資産化フロー
1. Content → Libraryに登録フロー実装
2. Actions → Playbook化フロー実装
3. Template/Playbook → 各機能への適用導線実装

---

## 参考リンク

- **CTA配置整理**: `/CTA_LIST_VS_DETAIL.md`
- **新規作成CTA設計**: `/CREATE_CTA_DESIGN.md`
- **3段階導線設計**: `/LIST_DETAIL_CREATE_DESIGN.md`

---

このサマリーは、3つの設計ドキュメントを統合し、全体像を把握しやすくするためのナビゲーションガイドです。
