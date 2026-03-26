# Outbound Editor CTA整理

## 目的
Outbound Editor のCTAを役割ごとに整理し、「編集」「確認」「レビュー」「最終送信」のレイヤーを明確化する。

---

## Outbound Editorの役割

### この画面でやること
- 件名 / 本文 / template / variables を確認・編集する
- 対象条件と audience_scope を確認する
- resolved / unresolved recipient を確認する
- linked evidence / linked action / linked content を確認する
- 必要ならレビュー依頼や確認依頼を行う
- 最終的に送信実行する

### この画面でやりすぎてはいけないこと
- 結果分析の主画面化
- 監査画面化
- 一覧管理画面化
- 複数Outboundの同時管理

---

## CTA分類（4種類）

### A. 編集系CTA
本文や設定を直すためのCTA

### B. 文脈確認系CTA
linked company / project / user / evidence / action / content を確認するCTA

### C. レビュー / 確認系CTA
AI案への承認 / 差し戻し、または人手編集後の確認依頼 / 最終確認に使うCTA

### D. 最終実行CTA
送信実行のみ

**重要:**
- D は1つだけを強い主CTAにする
- danger 表現は最終段階だけ
- A / B / C を飛ばしていきなり D に見えないようにする

---

## 現状の問題点

### ヘッダー部分
現在のCTA配置:
```tsx
<Button>Listに戻る</Button>
<Button>{sourceContext}に戻る</Button>
<Button>下書き保存</Button>
<Button>レビュー依頼</Button>
<Button className="bg-red-600">送信実行</Button>  // ❌ 早すぎる
```

**問題:**
1. 「送信実行」が最初から赤色で強く見える
2. 「レビュー依頼」と「送信実行」が同列に並んでいる
3. 文脈確認・unresolved確認を飛ばして送信できる
4. AI案と人手編集後の区別がない

### 本文エディタ部分
現在のCTA配置:
```tsx
<Button>テンプレート変更</Button>
<Button>AI改善</Button>
```

**問題:**
1. 役割は明確だが、適切
2. ただし、AI改善後の承認フローが不明確

### 左サイドバー
現在のCTA配置:
```tsx
<Button>手動解決</Button>  // Unresolved Recipients
<Button>Audience Workspaceに戻る</Button>
```

**問題:**
1. 「手動解決」の位置は適切
2. 戻る導線が重複（ヘッダーとサイドバー）

### 右サイドバー（未実装）
現在はEvidence/Actionの表示のみ。
レビュー・確認系CTAの配置場所がない。

---

## 整理後のCTA配置

### 1. ヘッダー部分（上部固定）

#### 左側：戻る導線
```tsx
<Button variant="ghost" size="sm">
  <ArrowLeft />
  Outbound一覧に戻る
</Button>
{sourceContext && (
  <Button variant="ghost" size="sm">
    <ExternalLink />
    {sourceContext}に戻る
  </Button>
)}
```

#### 右側：下書き保存のみ
```tsx
<Button variant="outline" size="sm">
  <Save />
  下書き保存
</Button>
```

**削除するCTA:**
- ❌ 「レビュー依頼」→ 右サイドバーへ移動
- ❌ 「送信実行」→ 右サイドバーまたは最下部へ移動

**理由:**
- ヘッダーは戻る導線と下書き保存のみに集約
- 重い操作（レビュー・送信）はヘッダーに置かない
- 文脈確認後にレビュー・送信を行うフローを徹底

---

### 2. 本文エディタエリア（中央）

#### エディタ上部
```tsx
<Label>本文</Label>
<div className="flex gap-2">
  <Button variant="outline" size="sm">
    <BookOpen />
    テンプレート変更
  </Button>
  <Button variant="outline" size="sm">
    <Sparkles />
    AI改善
  </Button>
  <Button variant="outline" size="sm">
    <Eye />
    プレビュー更新
  </Button>
</div>
```

**残すCTA:**
- ✅ テンプレート変更
- ✅ AI改善
- ✅ プレビュー更新（新設）

**理由:**
- 本文編集に関連するCTAをエディタ近くに配置
- 編集フローを直感的にする

---

### 3. 左サイドバー（Audience / Delivery Scope）

#### Unresolved Recipients セクション
```tsx
<div>
  <h3>Unresolved Recipients</h3>
  <Badge variant="outline" className="text-orange-600">
    {unresolvedCount}
  </Badge>
</div>
<ScrollArea>
  {/* Unresolved一覧 */}
</ScrollArea>
<Button variant="outline" size="sm" className="w-full">
  <Edit3 />
  手動解決
</Button>
```

#### 文脈確認エリア
```tsx
<Separator />
<div className="space-y-2">
  <Button variant="ghost" size="sm" className="w-full justify-start">
    <Building2 />
    Linked Companyを見る
  </Button>
  <Button variant="ghost" size="sm" className="w-full justify-start">
    <Target />
    Linked Projectを見る
  </Button>
  <Button variant="ghost" size="sm" className="w-full justify-start">
    <User />
    Linked Userを見る
  </Button>
</div>
```

#### Audience調整エリア
```tsx
<Separator />
<Button variant="outline" size="sm" className="w-full" asChild>
  <Link to={`/audience?returnTo=/outbound/editor/${id}`}>
    <Edit3 />
    送信対象を調整
  </Link>
</Button>
```

**残すCTA:**
- ✅ 手動解決（Unresolved対応）
- ✅ Linked Company/Project/Userを見る（新設）
- ✅ 送信対象を調整（新設、Audience編集へ遷移）

**削除するCTA:**
- ❌ 「Audience Workspaceに戻る」→ 「送信対象を調整」に変更

**理由:**
- Audience / Delivery Scopeの確認場所として明確化
- 文脈確認CTAを集約
- Unresolvedの解決を促す
- Audience調整の目的を明確化（「戻る」ではなく「調整」）
- `returnTo`パラメータでEditorへの戻り導線を確保

---

### 4. 右サイドバー（新設: Review & Confirmation）

#### 構成
```tsx
<div className="w-96 border-l bg-slate-50 overflow-y-auto">
  <div className="p-6">
    <h2>Review & Confirmation</h2>
    
    {/* 文脈確認セクション */}
    <Card>
      <CardHeader>
        <CardTitle>Linked Context</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {linkedAction && (
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <CheckSquare />
              Action: {linkedAction}
            </Button>
          )}
          {linkedContent && (
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <FileText />
              Content: {linkedContent}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <Database />
            Evidenceを見る（{evidenceCount}件）
          </Button>
        </div>
      </CardContent>
    </Card>

    <Separator />

    {/* 状態別のCTA配置 */}
    {reviewState === "ai_draft" && (
      <Card>
        <CardHeader>
          <CardTitle>AI提案レビュー</CardTitle>
          <CardDescription>
            AIが生成した内容を確認してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
            <CheckCircle2 />
            AI提案を承認
          </Button>
          <Button variant="outline" size="sm" className="w-full">
            <Edit3 />
            修正する
          </Button>
          <Button variant="outline" size="sm" className="w-full text-orange-600 border-orange-300">
            <XCircle />
            差し戻し
          </Button>
        </CardContent>
      </Card>
    )}

    {reviewState === "draft" && (
      <Card>
        <CardHeader>
          <CardTitle>確認・レビュー</CardTitle>
          <CardDescription>
            内容を確認してレビューに進んでください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button size="sm" className="w-full">
            <CheckCircle2 />
            レビュー依頼
          </Button>
          <Button variant="outline" size="sm" className="w-full">
            <Edit3 />
            修正する
          </Button>
        </CardContent>
      </Card>
    )}

    {reviewState === "review_required" && (
      <Card>
        <CardHeader>
          <CardTitle>送信前確認</CardTitle>
          <CardDescription>
            すべての項目を確認してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 確認チェックリスト */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Checkbox id="check-content" />
              <label htmlFor="check-content">内容を確認</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="check-audience" />
              <label htmlFor="check-audience">対象を確認（{resolvedCount}件）</label>
            </div>
            {unresolvedCount > 0 && (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-4 h-4" />
                <span>Unresolved: {unresolvedCount}件が未解決</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="check-evidence" />
              <label htmlFor="check-evidence">Evidenceを確認</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="check-variables" />
              <label htmlFor="check-variables">Variablesを確認</label>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button size="sm" className="w-full">
              <Eye />
              送信前確認
            </Button>
            <Button size="sm" className="w-full bg-red-600 hover:bg-red-700">
              <Send />
              送信実行
            </Button>
          </div>
        </CardContent>
      </Card>
    )}

    {reviewState === "ready" && (
      <Card>
        <CardHeader>
          <CardTitle>最終確認</CardTitle>
          <CardDescription className="text-orange-600">
            送信実行の最終段階です
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-sm text-orange-800 space-y-1">
              <div>• 対象: {resolvedCount}件</div>
              <div>• Channel: {channel}</div>
              <div>• Scope: {audienceScope}</div>
            </div>
          </div>

          <Button 
            size="sm" 
            className="w-full bg-red-600 hover:bg-red-700"
            onClick={() => setShowSendModal(true)}
          >
            <Send />
            送信実行
          </Button>
          
          <Button variant="outline" size="sm" className="w-full">
            <Edit3 />
            修正する
          </Button>
        </CardContent>
      </Card>
    )}

    <Separator />

    {/* Source Context確認 */}
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Source Context</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-slate-600">{sourceContext}</div>
        {getSourceContextGuidance(sourceContext)}
      </CardContent>
    </Card>
  </div>
</div>
```

**新設するCTA:**
- ✅ AI提案を承認（ai_draft状態のみ）
- ✅ 差し戻し（ai_draft状態のみ）
- ✅ レビュー依頼（draft状態のみ）
- ✅ 送信前確認（review_required状態）
- ✅ 送信実行（ready状態、最も下部）

**理由:**
- レビュー・確認系CTAを右サイドバーに集約
- 状態に応じてCTAを切り替え
- 文脈確認→チェックリスト→送信実行の自然なフロー
- 送信実行は最下部に配置し、いきなり見えないようにする

---

### 5. 送信実行確認Modal

#### 最終確認Modal
```tsx
<Dialog open={showSendModal} onOpenChange={setShowSendModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        送信実行の最終確認
      </DialogTitle>
      <DialogDescription>
        この操作は取り消せません。内容を再確認してください。
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-sm text-red-800 space-y-2">
          <div><strong>Channel:</strong> {channel}</div>
          <div><strong>対象:</strong> {resolvedCount}件</div>
          <div><strong>Scope:</strong> {audienceScope}</div>
          {unresolvedCount > 0 && (
            <div className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Unresolved: {unresolvedCount}件が未解決のまま</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="confirm-content" />
          <label htmlFor="confirm-content" className="text-sm">
            件名・本文を確認しました
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="confirm-audience" />
          <label htmlFor="confirm-audience" className="text-sm">
            送信対象を確認しました
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="confirm-responsibility" />
          <label htmlFor="confirm-responsibility" className="text-sm">
            <strong>送信の責任を理解しました</strong>
          </label>
        </div>
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowSendModal(false)}>
        キャンセル
      </Button>
      <Button 
        variant="destructive" 
        onClick={confirmSend}
        // disabled={!allChecked}
      >
        <Send />
        送信実行
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**理由:**
- 最終確認として2段階のチェック
- 危険操作として明確に表現
- チェックボックスで意図的な操作を強制

---

## 状態ごとのCTA切り替え

### draft（下書き）
```tsx
主CTA: レビュー依頼
補助CTA: 修正する、下書き保存
```

### ai_draft（AI生成直後）
```tsx
主CTA: AI提案を承認
補助CTA: 修正する、差し戻し
```

### review_required（レビュー待ち）
```tsx
主CTA: 送信前確認
補助CTA: 修正する
確認チェックリスト: 内容、対象、Evidence、Variables
```

### ready（送信準備完了）
```tsx
主CTA: 送信実行（danger）
補助CTA: 修正する
最終確認Modal起動
```

### sent（送信済み）
```tsx
主CTA: Resultsを見る
補助CTA: follow-up Actionを作成、Outbound一覧に戻る
```

---

## Source Contextに応じた確認CTA

### From Inbox / Unified Log
```tsx
<Card>
  <CardTitle>送信前確認（返信）</CardTitle>
  <CardContent>
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Checkbox id="check-reply-content" />
        <label>返信内容を確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-evidence" />
        <label>根拠Evidenceを確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-inquiry" />
        <label>問い合わせ内容との整合性を確認</label>
      </div>
    </div>
  </CardContent>
</Card>
```

### From Company / Project / User
```tsx
<Card>
  <CardTitle>送信前確認（施策）</CardTitle>
  <CardContent>
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Checkbox id="check-target" />
        <label>送信対象を確認（{resolvedCount}件）</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-context" />
        <label>文脈（Company/Project/User）を確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-content" />
        <label>内容を確認</label>
      </div>
    </div>
  </CardContent>
</Card>
```

### From Audience Workspace
```tsx
<Card>
  <CardTitle>送信前確認（一括送信）</CardTitle>
  <CardContent>
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Checkbox id="check-segment" />
        <label>セグメント条件を確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-count" />
        <label>対象件数を確認（{resolvedCount}件）</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-bulk" />
        <label><strong>一括送信の影響を理解</strong></label>
      </div>
    </div>
  </CardContent>
</Card>
```

### From Actions
```tsx
<Card>
  <CardTitle>送信前確認（Action実行）</CardTitle>
  <CardContent>
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Checkbox id="check-action-purpose" />
        <label>Action目的を確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-content" />
        <label>内容を確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-linked-action" />
        <label>Linked Actionとの整合性を確認</label>
      </div>
    </div>
  </CardContent>
</Card>
```

### From Content / Library
```tsx
<Card>
  <CardTitle>送信前確認（Content配信）</CardTitle>
  <CardContent>
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Checkbox id="check-template" />
        <label>テンプレートを確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-variables" />
        <label>Variablesを確認</label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="check-content" />
        <label>内容を確認</label>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## CTA一覧表（整理後）

### 残すCTA

| カテゴリ | CTA名 | 配置場所 | 表示条件 | 色 | 強弱 |
|---------|-------|---------|----------|-----|------|
| **戻り導線** | Outbound一覧に戻る | ヘッダー左 | 常時 | ghost | 弱 |
| **編集系** | 下書き保存 | ヘッダー右 | 常時 | outline | 中 |
| **編集系** | テンプレート変更 | エディタ上部 | 常時 | outline | 中 |
| **編集系** | AI改善 | エディタ上部 | 常時 | outline | 中 |
| **編集系** | プレビュー更新 | エディタ上部 | 常時 | outline | 中 |
| **編集系** | 修正する | 右サイドバー | 常時 | outline | 中 |
| **編集系** | 手動解決 | 左サイドバー | unresolved > 0 | outline | 中 |
| **文脈確認** | Linked Companyを見る | 左サイドバー | linkedCompany存在時 | ghost | 弱 |
| **文脈確認** | Linked Projectを見る | 左サイドバー | linkedProject存在時 | ghost | 弱 |
| **文脈確認** | Linked Userを見る | 左サイドバー | linkedUser存在時 | ghost | 弱 |
| **文脈確認** | Actionを見る | 右サイドバー | linkedAction存在時 | ghost | 弱 |
| **文脈確認** | Contentを見る | 右サイドバー | linkedContent存在時 | ghost | 弱 |
| **文脈確認** | Evidenceを見る | 右サイドバー | evidence存在時 | ghost | 弱 |
| **レビュー** | AI提案を承認 | 右サイドバー | reviewState=ai_draft | default(green) | 強 |
| **レビュー** | 差し戻し | 右サイドバー | reviewState=ai_draft | outline(orange) | 中 |
| **レビュー** | レビュー依頼 | 右サイドバー | reviewState=draft | default | 強 |
| **確認** | 送信前確認 | 右サイドバー | reviewState=review_required | default | 強 |
| **実行** | 送信実行 | 右サイドバー最下部 | reviewState=ready | destructive | 最強 |
| **実行** | 送信実行（Modal内） | 最終確認Modal | Modal表示時 | destructive | 最強 |

### 削除・移動したCTA

| CTA名 | 削除理由 |
|-------|---------|
| ヘッダーの「レビュー依頼」 | 右サイドバーに移動し、状態に応じて表示 |
| ヘッダーの「送信実行」 | 右サイドバー最下部に移動し、段階的な確認後にのみ表示 |
| ヘッダーの「{sourceContext}に戻る」 | 削除（導線は左サイドバーの「送信対象を調整」で代替） |
| 左サイドバーの「Audience Workspaceに戻る」 | 「送信対象を調整」に変更 |

### 統合・変更するCTA

| 旧CTA | 新CTA | 変更理由 |
|-------|-------|---------|
| 「レビュー依頼」（ヘッダー） | 「レビュー依頼」（右サイドバー・draft状態） | 状態別に配置を最適化 |
| 「送信実行」（ヘッダー） | 「送信実行」（右サイドバー・ready状態） | 段階的確認フローの徹底 |
| - | 「AI提案を承認」（新設） | AI生成物の承認フローを明確化 |
| - | 「送信前確認」（新設） | 人手編集後の最終確認を明確化 |

---

## CTAの強弱分類

### 強い主CTA
```tsx
// AI案の段階
<Button className="bg-green-600">AI提案を承認</Button>

// Draft段階
<Button>レビュー依頼</Button>

// Review Required段階
<Button>送信前確認</Button>

// Ready段階
<Button className="bg-red-600">送信実行</Button>
```

### 中くらいのCTA
```tsx
<Button variant="outline">下書き保存</Button>
<Button variant="outline">修正する</Button>
<Button variant="outline">手動解決</Button>
<Button variant="outline">テンプレート変更</Button>
<Button variant="outline">AI改善</Button>
<Button variant="outline">差し戻し</Button>
```

### 弱いCTA / テキストリンク寄り
```tsx
<Button variant="ghost" size="sm">Linked Companyを見る</Button>
<Button variant="ghost" size="sm">Linked Projectを見る</Button>
<Button variant="ghost" size="sm">Evidenceを見る</Button>
<Button variant="ghost" size="sm">Outbound一覧に戻る</Button>
<Button variant="ghost" size="sm">{sourceContext}に戻る</Button>
```

---

## 色のルール

### 編集系CTA
```tsx
variant="outline"  // 通常の灰色枠
```

### レビュー系CTA
```tsx
// AI提案承認
className="bg-green-600 hover:bg-green-700"

// レビュー依頼
variant="default"  // 通常の青色

// 差し戻し
variant="outline" className="text-orange-600 border-orange-300"
```

### 確認系CTA
```tsx
// 送信前確認
variant="default"  // 通常の青色
```

### 最終実行CTA
```tsx
// 送信実行（ready状態のみ）
variant="destructive"  // 赤色
className="bg-red-600 hover:bg-red-700"
```

### 文脈確認系CTA
```tsx
variant="ghost"  // 透明背景
```

---

## 画面内の配置（4エリア構成）

### ヘッダーエリア（上部固定）
```
[← Outbound一覧] [← sourceContext] .... [下書き保存]
```

**役割:**
- 戻る導線
- 下書き保存のみ

### 左サイドバー（Audience / Delivery Scope）
```
Audience Scope
Resolved Recipients
Unresolved Recipients [手動解決]
---
[Linked Companyを見る]
[Linked Projectを見る]
[Linked Userを見る]
[送信対象を調整]
```

**役割:**
- 対象確認
- Unresolved解決
- 文脈確認（Company/Project/User）

### 中央エリア（Message Editor）
```
件名
[テンプレート変更] [AI改善] [プレビュー更新]
本文エディタ
Variables一覧
Sample Preview
```

**役割:**
- 本文編集
- Template/Variables確認
- プレビュー

### 右サイドバー（Review & Confirmation）新設
```
Linked Context
[Actionを見る]
[Contentを見る]
[Evidenceを見る]
---
状態別CTA:
  [AI提案を承認] or
  [レビュー依頼] or
  [送信前確認] + チェックリスト
---
[送信実行]  ← 最下部
```

**役割:**
- 文脈確認（Action/Content/Evidence）
- 状態別レビュー・確認CTA
- 最終送信実行

---

## 実装の優先順位

### Phase 1: 必須（送信実行の移動）
1. ヘッダーから「送信実行」を削除
2. 右サイドバーを新設
3. 右サイドバーに状態別CTAを実装
4. 送信実行を右サイドバー最下部に配置

### Phase 2: 重要（状態別CTA切り替え）
5. reviewStateに応じたCTA切り替えロジック実装
6. AI提案承認フローの実装
7. 送信前確認チェックリストの実装
8. 最終確認Modalの強化

### Phase 3: 追加（Source Context対応）
9. Source Context別の確認CTAカスタマイズ
10. 文脈確認CTAの充実
11. Linked Entity確認機能の実装

---

## ユーザーメリット

### ✅ 段階的な判断フロー
- 編集→確認→レビュー→送信実行の順序が明確
- いきなり送信実行が見えない
- 各段階で必要な確認を促される

### ✅ 状態に応じた適切なCTA
- AI案と人手編集後で文言が変わる
- 承認/差し戻しとレビュー依頼を使い分け
- 送信準備が整ってから送信実行が表示される

### ✅ 文脈確認の徹底
- Linked Evidence/Action/Contentを確認できる
- Source Contextに応じた確認項目
- Unresolvedの解決を促す

### ✅ 誤送信の防止
- 送信実行は最下部に配置
- 最終確認Modalで2段階チェック
- チェックボックスで意図的な操作を強制

---

## システムメリット

### ✅ 責務の明確化
- ヘッダー: 戻る・保存のみ
- 左サイドバー: 対象確認・文脈確認
- 中央: 編集
- 右サイドバー: レビュー・確認・実行

### ✅ 状態管理の一貫性
- reviewStateに応じたCTA切り替え
- 状態遷移が明確
- フロー制御が容易

### ✅ 拡張性
- Source Context別のカスタマイズが容易
- 新しい確認項目の追加が容易
- 監査ログの取得が容易

---

## まとめ

### 実現すること
1. **ヘッダー**: 戻る導線と下書き保存のみ
2. **左サイドバー**: Audience/Delivery Scope確認
3. **中央**: 本文編集
4. **右サイドバー（新設）**: レビュー・確認・実行

### 統一ルール
- 送信実行は右サイドバー最下部のみ
- 状態に応じてCTAを切り替え
- AI案と人手編集後で文言を変える
- danger色は最終送信実行のみ
- 段階的な確認フローを徹底

### 削除・移動したCTA
- ❌ ヘッダーの「レビュー依頼」→ 右サイドバーへ
- ❌ ヘッダーの「送信実行」→ 右サイドバー最下部へ
- ❌ ヘッダーの「{sourceContext}に戻る」→ 削除（導線は左サイドバーの「送信対象を調整」で代替）

### 新設したCTA
- ✅ AI提案を承認（ai_draft状態）
- ✅ 送信前確認（review_required状態）
- ✅ Linked Entity確認CTA
- ✅ Source Context別確認チェックリスト
- ✅ 送信対象を調整（左サイドバー、Audience Workspaceへの導線）

### Audience Workspace ⇄ Editor 導線
- Editor → Audience: 「送信対象を調整」ボタン（`/audience?returnTo=/outbound/editor/${id}`）
- Audience → Editor: `returnTo`パラメータがある場合に「Editorに戻る」ボタンを表示
- 往復可能な設計で、文脈を保持したまま対象調整が可能