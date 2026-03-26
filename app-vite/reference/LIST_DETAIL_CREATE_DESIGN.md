# 一覧 → 詳細 → 新規作成 導線設計書

## 目的
Actions / Content / Outbound / Library / Audience の5機能について、「一覧 → 詳細 → 新規作成」の3段階導線を明確にし、未設計部分を補完する。

---

## 基本原則

### 一覧の役割
- **見つける**: 目的のitemを探す
- **比較する**: 複数のitemを比較する
- **選ぶ**: どのitemを触るか選ぶ
- **状態を把握する**: 全体の状態を俯瞰する

### 詳細の役割
- **文脈を理解する**: item全体の文脈を理解する
- **確認する**: 内容を詳細に確認する
- **関連情報を見る**: linked entities を確認する
- **次の画面に渡す**: 他画面への導線を提供する

### 新規作成の役割
- **入力する**: 必要な情報を入力する
- **条件を定義する**: filters や variables を設定する
- **作る**: 新しいitemを作成する
- **保存する**: 下書き保存または正式保存する
- **再利用可能にする**: 再利用資産として登録する

### 重要な分離原則
- **一覧に重い編集を置かない**
- **詳細で全部を作り始めない**
- **作成画面でだけ必要な入力を見せる**
- **単発実行用と再利用資産を混同しない**

---

## 1. Actions の3段階導線

### 1.1 Actions List（一覧画面）

#### 画面名
`/actions`

#### 一覧で見るもの
- Action一覧（全Action or フィルタ済み）
- Status（proposed / in_progress / completed / paused）
- Priority（high / medium / low）
- Owner（担当者）
- Due Date（期限）
- Action Type（send_external / send_internal / meeting / task / escalation）
- Company名
- Project名
- Evidence件数
- AI提案フラグ

#### 一覧上のCTA
```tsx
画面右上:
- 「新規Action作成」ボタン

各行（軽い操作のみ）:
- 「詳細を見る」（Sheet起動）
- 「完了」（軽い状態変更）
- 「保留」（軽い状態変更）
- Status badge（視認のみ）
- Priority badge（視認のみ）
```

#### フィルタ・ソート
- Status別フィルタ
- Priority別フィルタ
- Owner別フィルタ
- Company別フィルタ
- Project別フィルタ
- Due Date範囲フィルタ
- AI提案のみ表示

#### UI実装パターン
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Status</TableHead>
      <TableHead>Priority</TableHead>
      <TableHead>Title</TableHead>
      <TableHead>Owner</TableHead>
      <TableHead>Due Date</TableHead>
      <TableHead>Company</TableHead>
      <TableHead>Evidence</TableHead>
      <TableHead></TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {actions.map(action => (
      <TableRow key={action.id}>
        <TableCell><Badge>{action.status}</Badge></TableCell>
        <TableCell><Badge>{action.priority}</Badge></TableCell>
        <TableCell>{action.title}</TableCell>
        <TableCell>{action.owner}</TableCell>
        <TableCell>{action.dueDate}</TableCell>
        <TableCell>{action.company}</TableCell>
        <TableCell>{action.evidenceCount}件</TableCell>
        <TableCell>
          <Button size="sm" variant="outline" onClick={() => openDetail(action.id)}>
            詳細を見る
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### 1.2 Action Detail（詳細パネル）

#### 画面形式
Sheet（右側から開く）

#### 詳細で見るもの
- Action基本情報
  - Title
  - Objective（目的）
  - Suggested Next Step（推奨次アクション）
  - Action Type
  - Status
  - Priority
  - Owner
  - Due Date
  - Notes（メモ）
  
- 関連情報
  - Linked Company（会社）
  - Linked Project（プロジェクト）
  - Linked User（ユーザー）
  - Linked Evidence（根拠Evidence一覧）
  - Linked Action（親Action、Follow-up元）
  
- AI提案情報（source_type=AIの場合）
  - Confidence（信頼度）
  - AI Rationale（AI判断根拠）
  - Missing Fields（不足項目）

- 履歴・変更ログ
  - 作成日時・作成者
  - 最終更新日時・更新者
  - 状態変更履歴

#### 詳細パネル内のCTA

##### 主CTA（重い操作）
```tsx
主CTA:
- 「Outbound起票」（status=approved かつ action_type=send_external のみ）
- 「Push実行」（status=approved かつ action_type=push のみ）

補助CTA（業務フロー）:
- 「編集」
- 「Follow-upを作成」
- 「Playbook化する」（将来実装）
- 「Owner変更」
- 「Priority変更」
- 「Status変更」

補助CTA（文脈参照）:
- 「Evidenceを見る」（Evidence詳細へ遷移）
- 「Companyを見る」（Company詳細へ遷移）
- 「Projectを見る」（Project詳細へ遷移）
- 「Template参照」（Library参照）

状態変更CTA:
- 「完了」
- 「保留」
- 「再開」
- 「削除」

特殊CTA:
- 「Composeで確認」（Outbound起票後の確認用）
```

#### UI実装パターン
```tsx
<Sheet open={detailOpen} onOpenChange={setDetailOpen}>
  <SheetContent className="w-[700px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{selectedAction.title}</SheetTitle>
      <SheetDescription>
        Action詳細 • {selectedAction.status} • {selectedAction.priority}
      </SheetDescription>
    </SheetHeader>
    
    {/* 基本情報 */}
    <div className="space-y-4 mt-6">
      <div>
        <Label>Objective</Label>
        <p>{selectedAction.objective}</p>
      </div>
      <div>
        <Label>Suggested Next Step</Label>
        <p>{selectedAction.suggestedNextStep}</p>
      </div>
      {/* ... その他の項目 ... */}
    </div>
    
    {/* 関連Evidence */}
    <div className="mt-6">
      <Label>関連Evidence</Label>
      {selectedAction.relatedEvidence.map(ev => (
        <div key={ev.id} className="border rounded p-3">
          <p>{ev.title}</p>
          <Button size="sm" variant="outline">Evidenceを見る</Button>
        </div>
      ))}
    </div>
    
    {/* 主CTA */}
    <div className="mt-6 flex gap-2">
      {selectedAction.actionType === 'send_external' && selectedAction.status === 'approved' && (
        <Link to={`/outbound/compose?fromAction=${selectedAction.id}`}>
          <Button className="bg-blue-600">
            <Send className="w-4 h-4 mr-2" />
            Outbound起票
          </Button>
        </Link>
      )}
      <Button variant="outline" onClick={() => setIsEditing(true)}>編集</Button>
      <Button variant="outline" onClick={() => createFollowUp()}>Follow-upを作成</Button>
    </div>
  </SheetContent>
</Sheet>
```

---

### 1.3 Action Create（新規作成画面）

#### 画面形式
Drawer（下から開く）または Sheet（右から開く）

#### 新規作成で作るもの
新しいAction

#### 作成フォームで必要な項目

##### 基本情報（必須）
- **Title** (text, 必須): Action名
- **Action Type** (select, 必須): 
  - `send_external` - 顧客向け送信
  - `send_internal` - 社内向け送信
  - `meeting` - MTG設定
  - `task` - タスク実行
  - `escalation` - エスカレーション
- **Priority** (select, 必須): `high` / `medium` / `low`
- **Status** (select, 必須): `proposed` / `in_progress` / `completed` / `paused`
- **Owner** (select, 必須): 担当者選択
- **Due Date** (date, 必須): 期限

##### 業務文脈（必須）
- **Objective** (textarea, 必須): 目的
- **Suggested Next Step** (textarea): 推奨される次の一手
- **Notes** (textarea): 備考

##### リンク情報（任意）
- **Linked Company** (select): 関連Company
- **Linked Project** (select): 関連Project
- **Linked User** (multi-select): 関連User
- **Linked Evidence** (multi-select): 根拠Evidence
- **Linked Action** (select): 親Action（Follow-upの場合）

##### AI提案の場合（自動設定）
- **Source Type**: `AI` / `manual`
- **Confidence**: `high` / `medium` / `low`
- **AI Rationale**: AI判断根拠
- **Missing Fields**: 不足項目リスト

#### 新規作成CTA
```tsx
画面右上（Actions List）:
- 「新規Action作成」ボタン

詳細パネル内（Action Detail）:
- 「Follow-upを作成」ボタン

他画面から:
- Evidence詳細 → 「Actionを作る」
- Unified Log詳細 → 「Actionを作成」
- Company詳細 → 「Actionsに送る」
- Project詳細 → 「Actionを作成」
```

#### Source Contextからの引き継ぎ

##### From Evidence
```
URL: /actions/create?fromEvidence=${evidenceId}

引き継ぎ項目:
- linked_evidence: [evidenceId]
- linked_company: evidence.company_id
- linked_project: evidence.project_id
- linked_user: evidence.user_id
- objective: evidence.excerpt（初期値として提案）
```

##### From Action（Follow-up）
```
URL: /actions/create?followUp=${actionId}

引き継ぎ項目:
- linked_action: actionId（親Action）
- linked_company: action.company_id
- linked_project: action.project_id
- linked_user: action.user_id
- linked_evidence: action.evidence_ids
- owner: action.owner
- title: "Follow-up: " + action.title（初期値）
```

##### From Project
```
URL: /actions/create?fromProject=${projectId}

引き継ぎ項目:
- linked_project: projectId
- linked_company: project.company_id
```

#### UI実装パターン
```tsx
<Sheet open={createOpen} onOpenChange={setCreateOpen}>
  <SheetContent className="w-[700px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>新規Action作成</SheetTitle>
      <SheetDescription>
        {sourceContext && `${sourceContext}から作成`}
      </SheetDescription>
    </SheetHeader>
    
    <form className="space-y-4 mt-6">
      {/* 基本情報 */}
      <div>
        <Label>Title *</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      
      <div>
        <Label>Action Type *</Label>
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="send_external">顧客向け送信</SelectItem>
            <SelectItem value="send_internal">社内向け送信</SelectItem>
            <SelectItem value="meeting">MTG設定</SelectItem>
            <SelectItem value="task">タスク実行</SelectItem>
            <SelectItem value="escalation">エスカレーション</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Priority *</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Objective *</Label>
        <Textarea value={objective} onChange={e => setObjective(e.target.value)} />
      </div>
      
      {/* リンク情報 */}
      <div>
        <Label>Linked Company</Label>
        <Select value={linkedCompany} onValueChange={setLinkedCompany}>
          {/* Company選択 */}
        </Select>
      </div>
      
      <div>
        <Label>Linked Evidence</Label>
        {/* Multi-select Evidence */}
      </div>
      
      {/* 保存ボタン */}
      <div className="flex gap-2">
        <Button type="submit" className="bg-blue-600">作成</Button>
        <Button type="button" variant="outline" onClick={() => saveDraft()}>下書き保存</Button>
        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>キャンセル</Button>
      </div>
    </form>
  </SheetContent>
</Sheet>
```

---

### 1.4 Actions の他画面との接続

#### From Actions → Outbound
```
Action詳細パネル内
→ 「Outbound起票」ボタン
→ `/outbound/compose?fromAction=${actionId}`
→ Outbound Compose画面が開く
→ Action文脈が引き継がれる:
  - linked_action: actionId
  - linked_company: action.company_id
  - linked_project: action.project_id
  - linked_user: action.user_id
  - linked_evidence: action.evidence_ids
```

#### From Actions → Library（Playbook化）
```
Action詳細パネル内
→ 「Playbook化する」ボタン（将来実装）
→ Playbook作成フォームDrawer
→ Action内容を再利用可能な手順として登録
→ Library/Playbooksに保存
```

#### From Actions → Content
```
Action詳細パネル内
→ 「Content作成」ボタン（将来実装）
→ `/content/create?fromAction=${actionId}`
→ Content作成フォーム
→ Action文脈が引き継がれる
```

---

### 1.5 Actions の未実装部分

#### 必要な新規実装
1. **Actions List画面の強化**
   - フィルタ・ソートUIの追加
   - Bulk操作（複数選択→一括完了など）
   - Exportボタン（CSV/Excel出力）

2. **Action Detail Sheet**
   - 現在はDrawerで実装されているが、Sheetに統一
   - 関連Evidence一覧の表示改善
   - 変更履歴の表示

3. **Action Create Form**
   - Source contextからの引き継ぎロジック
   - Follow-up作成時の親Action情報引き継ぎ
   - 下書き保存機能

4. **Playbook化フロー（未実装）**
   - Action → Library/Playbook への変換機能
   - 再利用可能な手順としての登録

---

## 2. Content の3段階導線

### 2.1 Content List（一覧画面）

#### 画面名
`/content`

#### 一覧で見るもの
- Content一覧（全Content or フィルタ済み）
- Status（draft / in_review / approved / completed）
- Content Type（email / document / faq / guide / proposal）
- Title（件名）
- Owner（担当者）
- Last Updated（最終更新日）
- Linked Company名
- Linked Project名
- Review State（review_required / approved / rejected）

#### 一覧上のCTA
```tsx
画面右上:
- 「新規Content作成」ボタン

各行（軽い操作のみ）:
- 「詳細を見る」（Sheet起動）
- Status badge（視認のみ）
- Type badge（視認のみ）
- Owner表示（視認のみ）
```

#### フィルタ・ソート
- Status別フィルタ
- Content Type別フィルタ
- Owner別フィルタ
- Company別フィルタ
- Project別フィルタ
- Review State別フィルタ
- 最終更新日範囲フィルタ

#### UI実装パターン
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Status</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Title</TableHead>
      <TableHead>Owner</TableHead>
      <TableHead>Company</TableHead>
      <TableHead>Last Updated</TableHead>
      <TableHead></TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {contents.map(content => (
      <TableRow key={content.id}>
        <TableCell><Badge>{content.status}</Badge></TableCell>
        <TableCell><Badge>{content.contentType}</Badge></TableCell>
        <TableCell>{content.title}</TableCell>
        <TableCell>{content.owner}</TableCell>
        <TableCell>{content.company}</TableCell>
        <TableCell>{content.lastUpdated}</TableCell>
        <TableCell>
          <Button size="sm" variant="outline" onClick={() => openDetail(content.id)}>
            詳細を見る
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### 2.2 Content Detail（詳細パネル）

#### 画面形式
Sheet（右側から開く）

#### 詳細で見るもの
- Content基本情報
  - Title
  - Content Type
  - Purpose（目的）
  - Channel（想定チャネル）
  - Status
  - Owner
  - Created / Updated
  
- Content内容
  - Subject（件名）
  - Body（本文、Rich Text）
  - Attachments（添付ファイル、将来実装）
  
- Template・Variables
  - Template ID（使用Template）
  - Variables（変数値）
  
- 関連情報
  - Linked Company
  - Linked Project
  - Linked User
  - Linked Evidence
  - Linked Action
  
- レビュー情報
  - Review State
  - Reviewer
  - Review Notes
  - Review History

#### 詳細パネル内のCTA

##### 主CTA（重い操作）
```tsx
主CTA:
- 「Outboundで使う」（status=approved のみ）
- 「Libraryに登録」（status=approved のみ、Template化）

補助CTA（作成・編集）:
- 「編集」
- 「プレビュー」
- 「Template適用」
- 「複製」

補助CTA（文脈参照）:
- 「Companyを見る」
- 「Projectを見る」
- 「Evidenceを見る」
- 「Actionを見る」

状態変更CTA:
- 「承認申請」（status=draft のみ）
- 「承認」（status=in_review かつ reviewer権限）
- 「差し戻し」（status=in_review かつ reviewer権限）
- 「削除」

特殊CTA:
- 「Composeで確認」
```

#### UI実装パターン
```tsx
<Sheet open={detailOpen} onOpenChange={setDetailOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{selectedContent.title}</SheetTitle>
      <SheetDescription>
        Content詳細 • {selectedContent.status} • {selectedContent.contentType}
      </SheetDescription>
    </SheetHeader>
    
    {/* 基本情報 */}
    <div className="space-y-4 mt-6">
      <div>
        <Label>Purpose</Label>
        <p>{selectedContent.purpose}</p>
      </div>
      <div>
        <Label>Subject</Label>
        <p>{selectedContent.subject}</p>
      </div>
      <div>
        <Label>Body</Label>
        <div className="border rounded p-4 bg-slate-50">
          <div dangerouslySetInnerHTML={{ __html: selectedContent.body }} />
        </div>
      </div>
    </div>
    
    {/* 主CTA */}
    <div className="mt-6 flex gap-2">
      {selectedContent.status === 'approved' && (
        <>
          <Link to={`/outbound/compose?fromContent=${selectedContent.id}`}>
            <Button className="bg-blue-600">
              <Send className="w-4 h-4 mr-2" />
              Outboundで使う
            </Button>
          </Link>
          <Button variant="outline" onClick={() => registerToLibrary()}>
            <Database className="w-4 h-4 mr-2" />
            Libraryに登録
          </Button>
        </>
      )}
      <Button variant="outline" onClick={() => setIsEditing(true)}>編集</Button>
    </div>
  </SheetContent>
</Sheet>
```

---

### 2.3 Content Create（新規作成画面）

#### 画面形式
Sheet（右から開く）

#### 新規作成で作るもの
新しいContent Job

#### 作成フォームで必要な項目

##### 基本情報（必須）
- **Title** (text, 必須): Content名
- **Content Type** (select, 必須):
  - `email` - メール
  - `document` - ドキュメント
  - `faq` - FAQ
  - `guide` - ガイド
  - `proposal` - 提案資料
- **Purpose** (textarea, 必須): 目的
- **Channel** (select): `email` / `slack` / `in_person` / `document`
- **Owner** (select, 必須): 担当者
- **Status** (select, 必須): `draft` / `in_review` / `approved` / `completed`

##### Content内容（必須）
- **Subject** (text): 件名（メール/ドキュメントの場合）
- **Body** (rich text, 必須): 本文（Rich Text Editor）
- **Attachments** (file upload): 添付ファイル（将来実装）

##### Template・Variables（任意）
- **Template ID** (select): 使用Template
- **Variables** (key-value pairs): 変数値

##### リンク情報（任意）
- **Linked Company** (select): 関連Company
- **Linked Project** (select): 関連Project
- **Linked User** (multi-select): 関連User
- **Linked Evidence** (multi-select): 根拠Evidence
- **Linked Action** (select): 元になったAction

##### レビュー（任意）
- **Review State**: `not_required` / `review_required` / `approved` / `rejected`
- **Reviewer** (select): レビュアー
- **Review Notes** (textarea): レビューコメント

#### 新規作成CTA
```tsx
画面右上（Content List）:
- 「新規Content作成」ボタン
- 「下書きを作成」ボタン

他画面から:
- Evidence詳細 → 「Contentを作る」
- Action詳細 → 「Content作成」
- Template詳細 → 「Contentで使う」
```

#### Source Contextからの引き継ぎ

##### From Evidence
```
URL: /content/create?fromEvidence=${evidenceId}

引き継ぎ項目:
- linked_evidence: [evidenceId]
- linked_company: evidence.company_id
- linked_project: evidence.project_id
- linked_user: evidence.user_id
- purpose: evidence.excerpt（初期値）
```

##### From Action
```
URL: /content/create?fromAction=${actionId}

引き継ぎ項目:
- linked_action: actionId
- linked_company: action.company_id
- linked_project: action.project_id
- linked_user: action.user_id
- linked_evidence: action.evidence_ids
- purpose: action.objective
```

##### From Template
```
URL: /content/create?fromTemplate=${templateId}

引き継ぎ項目:
- template_id: templateId
- content_type: template.content_type
- subject: template.subject（変数未埋め）
- body: template.body（変数未埋め）
- variables: template.variables（空のkey-value pairs）
```

#### UI実装パターン
```tsx
<Sheet open={createOpen} onOpenChange={setCreateOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>新規Content作成</SheetTitle>
      <SheetDescription>
        {sourceContext && `${sourceContext}から作成`}
      </SheetDescription>
    </SheetHeader>
    
    <form className="space-y-4 mt-6">
      <div>
        <Label>Title *</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      
      <div>
        <Label>Content Type *</Label>
        <Select value={contentType} onValueChange={setContentType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email">メール</SelectItem>
            <SelectItem value="document">ドキュメント</SelectItem>
            <SelectItem value="faq">FAQ</SelectItem>
            <SelectItem value="guide">ガイド</SelectItem>
            <SelectItem value="proposal">提案資料</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Subject</Label>
        <Input value={subject} onChange={e => setSubject(e.target.value)} />
      </div>
      
      <div>
        <Label>Body *</Label>
        <RichTextEditor value={body} onChange={setBody} />
      </div>
      
      {/* リンク情報 */}
      <div>
        <Label>Linked Company</Label>
        <Select value={linkedCompany} onValueChange={setLinkedCompany}>
          {/* Company選択 */}
        </Select>
      </div>
      
      {/* 保存ボタン */}
      <div className="flex gap-2">
        <Button type="submit" className="bg-blue-600">作成</Button>
        <Button type="button" variant="outline" onClick={() => saveDraft()}>下書き保存</Button>
        <Button type="button" variant="outline" onClick={() => requestReview()}>レビュー依頼</Button>
      </div>
    </form>
  </SheetContent>
</Sheet>
```

---

### 2.4 Content の他画面との接続

#### From Content → Outbound
```
Content詳細パネル内
→ 「Outboundで使う」ボタン
→ `/outbound/compose?fromContent=${contentId}`
→ Outbound Compose画面が開く
→ Content内容が引き継がれる:
  - linked_content: contentId
  - subject: content.subject
  - body: content.body
  - linked_company: content.company_id
  - linked_project: content.project_id
  - linked_user: content.user_id
  - linked_evidence: content.evidence_ids
  - linked_action: content.action_id
```

#### From Content → Library
```
Content詳細パネル内
→ 「Libraryに登録」ボタン
→ Template作成フォームDrawer
→ 必須項目:
  - template_title
  - category
  - intended_use
  - variables設定（Content内の可変部分を特定）
→ Content内容をテンプレート化して保存
→ Library/Templatesに登録
```

---

### 2.5 Content の未実装部分

#### 必要な新規実装
1. **Content List画面の強化**
   - フィルタ・ソートUIの改善
   - プレビューモード（hover時に本文プレビュー）
   - Bulk操作（複数選択→一括承認など）

2. **Content Detail Sheet**
   - Rich Text表示の改善
   - Attachments表示（将来）
   - Version履歴表示

3. **Content Create Form**
   - Rich Text Editorの実装
   - Template選択UI
   - Variables入力UI
   - 下書き自動保存機能

4. **Libraryに登録フロー（未実装）**
   - Content → Template への変換機能
   - Variables自動抽出機能
   - Template preview機能

---

## 3. Outbound の3段階導線

### 3.1 Outbound List（一覧画面）

#### 画面名
`/outbound`

#### 一覧で見るもの
- Outbound一覧（全Outbound or フィルタ済み）
- Delivery Status（draft / scheduled / sent / failed）
- Name（Outbound名）
- Channel（email / slack）
- Audience Scope（company / project / user）
- Source Context（Actions / Content / Audience / Company / Project）
- Review State（not_required / review_required / approved / rejected）
- Owner（担当者）
- Created / Scheduled Date
- Resolved Recipients数
- Unresolved Recipients数
- Failed Recipients数

#### 一覧上のCTA
```tsx
画面右上:
- 「新規Outbound作成」ボタン

各行（軽い操作のみ）:
- 「詳細を見る」（Sheet起動またはEditor/Results遷移）
- 「選択」（複数選択用チェックボックス）
- Status badge（視認のみ）
- Channel badge（視認のみ）
```

#### フィルタ・ソート
- Delivery Status別フィルタ
- Channel別フィルタ
- Audience Scope別フィルタ
- Source Context別フィルタ
- Review State別フィルタ
- Owner別フィルタ
- 作成日範囲フィルタ
- 送信予定日範囲フィルタ

#### UI実装パターン
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>
        <Checkbox />
      </TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Name</TableHead>
      <TableHead>Channel</TableHead>
      <TableHead>Audience</TableHead>
      <TableHead>Source</TableHead>
      <TableHead>Recipients</TableHead>
      <TableHead></TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {outbounds.map(outbound => (
      <TableRow key={outbound.id}>
        <TableCell>
          <Checkbox />
        </TableCell>
        <TableCell><Badge>{outbound.deliveryStatus}</Badge></TableCell>
        <TableCell>{outbound.name}</TableCell>
        <TableCell><Badge>{outbound.channel}</Badge></TableCell>
        <TableCell>{outbound.audienceScope}</TableCell>
        <TableCell>{outbound.sourceContext}</TableCell>
        <TableCell>
          {outbound.resolvedRecipients} / {outbound.totalRecipients}
          {outbound.unresolvedRecipients > 0 && (
            <Badge variant="warning">{outbound.unresolvedRecipients} 未解決</Badge>
          )}
        </TableCell>
        <TableCell>
          <Button size="sm" variant="outline" onClick={() => openDetail(outbound.id)}>
            詳細を見る
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### 3.2 Outbound Detail（詳細画面）

#### 画面形式
実質的には Outbound Editor（`/outbound/editor/:id`）または Outbound Results（`/outbound/results/:id`）に遷移

Outbound Listから「詳細を見る」をクリックした場合:
- `delivery_status = draft / scheduled` → Outbound Editorへ遷移
- `delivery_status = sent / failed` → Outbound Resultsへ遷移

#### Outbound Editor で見るもの
- Outbound基本情報
  - Name
  - Channel
  - Audience Scope
  - Source Context
  - Review State
  - Owner
  
- Audience情報
  - Audience条件
  - Resolved Recipients一覧
  - Unresolved Recipients一覧
  - Target Count
  
- 送信内容
  - Subject
  - Body（Rich Text）
  - Template ID
  - Variables
  
- 関連情報
  - Linked Company
  - Linked Project
  - Linked User
  - Linked Action
  - Linked Content
  - Linked Evidence
  - Linked Cluster
  - Linked Segment

#### Outbound Editor のCTA

##### 主CTA（重い操作）
```tsx
主CTA:
- 「送信対象を調整」（Audience Workspaceへ遷移）
- 「送信実行」（status=approved のみ）
- 「レビュー依頼」（status=draft のみ）

補助CTA（編集）:
- 「編集」
- 「プレビュー」
- 「Template適用」
- 「複製」

補助CTA（文脈参照）:
- 「Audience詳細を見る」
- 「Template参照」
- 「Companyを見る」
- 「Projectを見る」

状態変更CTA:
- 「下書き保存」
- 「承認」（reviewer権限）
- 「差し戻し」（reviewer権限）
- 「削除」
```

#### Outbound Results で見るもの
- 送信結果サマリ
  - Total Sent
  - Delivered
  - Opened
  - Clicked
  - Bounced
  - Failed
  
- Recipients別結果
  - User名
  - Email
  - Delivery Status
  - Opened Date
  - Clicked Date
  - Error Message（failed時）
  
- 関連情報
  - 元のAudience
  - 元のContent
  - 元のAction

#### Outbound Results のCTA
```tsx
主CTA:
- 「Follow-up送信を作成」

補助CTA:
- 「結果をExport」
- 「Audienceを見る」
- 「Contentを見る」
- 「Actionを見る」
```

---

### 3.3 Outbound Create / Compose（新規作成画面）

#### 画面名
`/outbound/compose`

#### 新規作成で作るもの
新しいOutbound Item（送信予定/送信実行済みの記録）

#### 作成フォームで必要な項目

##### 基本情報（必須）
- **Name** (text, 必須): Outbound名
- **Channel** (select, 必須): `email` / `slack`
- **Delivery Status** (select): `draft` / `scheduled` / `sent` / `failed`
- **Owner** (select, 必須): 担当者

##### Audience/Delivery Scope（必須）
- **Audience Scope** (select, 必須): `company` / `project` / `user`
- **Audience Conditions**: Audience条件（Audience Workspaceで設定）
- **Resolved Recipients**: 送信先確定リスト
- **Unresolved Recipients**: 送信先未確定リスト

##### 送信内容（必須）
- **Subject** (text, 必須): 件名
- **Body** (rich text, 必須): 本文（Rich Text Editor）
- **Template ID** (select): 使用Template
- **Variables** (key-value pairs): 変数値

##### リンク情報（任意）
- **Linked Company** (select): 関連Company
- **Linked Project** (select): 関連Project
- **Linked User** (multi-select): 関連User
- **Linked Action** (select): 元になったAction
- **Linked Content** (select): 元になったContent
- **Linked Evidence** (multi-select): 根拠Evidence
- **Linked Cluster** (select): 元になったクラスター
- **Linked Segment** (select): 元になったセグメント
- **Linked Audience** (select): 元になったAudience

##### レビュー・承認（任意）
- **Review State**: `not_required` / `review_required` / `approved` / `rejected`
- **Reviewer** (select): レビュアー
- **Review Notes** (textarea): レビューコメント

##### メタ情報
- **Source Context**: 起票元（Actions / Content / Audience / Company / Project / User）

#### 新規作成CTA
```tsx
画面右上（Outbound List）:
- 「新規Outbound作成」ボタン

詳細パネル内（他画面から）:
- Action詳細 → 「Outbound起票」
- Content詳細 → 「Outboundで使う」
- Company詳細 → 「Outboundを起票」
- Project詳細 → 「Outboundを起票」
- User詳細 → 「Outboundを起票」
- Evidence詳細 → 「Outbound起票」
- Audience詳細 → 「Outboundで使う」
- Template詳細 → 「Outboundで使う」
```

#### Source Contextからの引き継ぎ

##### From Action
```
URL: /outbound/compose?fromAction=${actionId}

引き継ぎ項目:
- source_context: "Actions"
- linked_action: actionId
- linked_company: action.company_id
- linked_project: action.project_id
- linked_user: action.user_id
- linked_evidence: action.evidence_ids
- name: action.title + " - Outbound"
- channel: action.recommended_channel
```

##### From Content
```
URL: /outbound/compose?fromContent=${contentId}

引き継ぎ項目:
- source_context: "Content"
- linked_content: contentId
- subject: content.subject
- body: content.body
- linked_company: content.company_id
- linked_project: content.project_id
- linked_user: content.user_id
- linked_evidence: content.evidence_ids
- linked_action: content.action_id
- channel: content.channel
```

##### From Template
```
URL: /outbound/compose?fromTemplate=${templateId}

引き継ぎ項目:
- source_context: "Library"
- template_id: templateId
- subject: template.subject（変数未埋め）
- body: template.body（変数未埋め）
- variables: template.variables（空のkey-value pairs）
- channel: template.channel
```

##### From Audience
```
URL: /outbound/compose?fromAudience=${audienceId}

引き継ぎ項目:
- source_context: "Audience"
- linked_audience: audienceId
- audience_scope: audience.scope
- audience_conditions: audience.filters
- resolved_recipients: audience.target_users
- linked_company: audience.company_id
- linked_project: audience.project_id
- linked_cluster: audience.cluster_id
```

##### From Project
```
URL: /outbound/compose?fromProject=${projectId}

引き継ぎ項目:
- source_context: "Project"
- linked_project: projectId
- linked_company: project.company_id
- audience_scope: "project"
```

##### Follow-up送信
```
URL: /outbound/compose?followUp=${outboundId}

引き継ぎ項目:
- source_context: "Outbound Follow-up"
- audience_scope: original.audience_scope
- resolved_recipients: original.resolved_recipients
- linked_company: original.company_id
- linked_project: original.project_id
- linked_user: original.user_id
- name: "Follow-up: " + original.name
- channel: original.channel
```

#### UI実装パターン
```tsx
// Outbound Compose画面（既存の実装を活用）
<div className="flex h-screen">
  <SidebarNav />
  <div className="flex-1 flex flex-col">
    <GlobalHeader />
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h1>Outbound作成</h1>
        {sourceContext && (
          <Badge>{sourceContext}から作成</Badge>
        )}
        
        <form className="space-y-6 mt-6">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          
          <div>
            <Label>Channel *</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Audience Scope *</Label>
            <Select value={audienceScope} onValueChange={setAudienceScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>送信対象</Label>
            <div className="border rounded p-4">
              <p>確定: {resolvedRecipients.length}件</p>
              <p>未確定: {unresolvedRecipients.length}件</p>
              <Button variant="outline" onClick={() => navigateToAudienceWorkspace()}>
                送信対象を調整
              </Button>
            </div>
          </div>
          
          <div>
            <Label>Subject *</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          
          <div>
            <Label>Body *</Label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>
          
          {/* 保存・送信ボタン */}
          <div className="flex gap-2">
            <Button type="button" onClick={() => saveDraft()}>下書き保存</Button>
            <Button type="button" variant="outline" onClick={() => requestReview()}>レビュー依頼</Button>
            <Button type="submit" className="bg-red-600" onClick={() => sendNow()}>送信実行</Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
```

---

### 3.4 Outbound の他画面との接続

#### From Outbound → Audience Workspace
```
Outbound Editor
→ 「送信対象を調整」ボタン
→ `/audience?returnTo=/outbound/editor/${id}`
→ Audience Workspace
→ 対象を調整
→ 「Editorに戻る」ボタン
→ Outbound Editorに戻る
→ 調整結果が反映される
```

#### From Outbound → Library（Template化）
```
Outbound Editor（送信後）
→ 「Templateとして保存」ボタン（将来実装）
→ Template作成フォームDrawer
→ 必須項目:
  - template_title
  - category
  - intended_use
  - variables設定
→ Outbound内容をテンプレート化
→ Library/Templatesに登録
```

---

### 3.5 Outbound の未実装部分

#### 必要な新規実装
1. **Outbound List画面の強化**
   - フィルタ・ソートUIの改善
   - Bulk操作（複数選択→一括削除など）
   - Exportボタン

2. **Source選択モーダル（新規Outbound作成時）**
   - 空から作成
   - Contentから作成（Content選択リスト）
   - Templateから作成（Template選択リスト）
   - Audienceから作成（Audience選択リスト）

3. **Follow-up送信作成フロー**
   - Outbound Results → 「Follow-up送信を作成」
   - 元のAudience・Recipients引き継ぎ
   - 新しいsubject/body作成

4. **Templateとして保存フロー（未実装）**
   - Outbound → Library/Template への変換
   - Variables自動抽出
   - Template preview

---

## 4. Library の3段階導線

### 4.1 Library List（一覧画面）

#### 画面名
`/library`

#### 一覧で見るもの
- Library資産一覧（Template / Playbook / Knowledge / Asset）
- Category（種別: Template / Playbook / Knowledge / Asset）
- Title（資産名）
- Type（external / internal）
- Intended Use（使用目的）
- Status（draft / review_required / approved）
- Owner（担当者）
- Last Updated（最終更新日）
- Tags（タグ）
- Applicable Scope（Company / Project / User）

#### 一覧上のCTA
```tsx
画面右上:
- 「+新規作成」ボタン（種別選択モーダル起動）

各行（軽い操作のみ）:
- 「詳細を見る」（Sheet起動）
- Category badge（視認のみ）
- Status badge（視認のみ）
- Type badge（視認のみ）
```

#### フィルタ・ソート
- Category別フィルタ（Template / Playbook / Knowledge / Asset）
- Status別フィルタ
- Type別フィルタ（external / internal）
- Owner別フィルタ
- Tags別フィルタ
- Applicable Scope別フィルタ
- 最終更新日範囲フィルタ

#### UI実装パターン
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Category</TableHead>
      <TableHead>Title</TableHead>
      <TableHead>Type</TableHead>
      <TableHead>Intended Use</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Owner</TableHead>
      <TableHead>Last Updated</TableHead>
      <TableHead></TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {libraryItems.map(item => (
      <TableRow key={item.id}>
        <TableCell><Badge>{item.category}</Badge></TableCell>
        <TableCell>{item.title}</TableCell>
        <TableCell><Badge>{item.type}</Badge></TableCell>
        <TableCell>{item.intendedUse}</TableCell>
        <TableCell><Badge>{item.status}</Badge></TableCell>
        <TableCell>{item.owner}</TableCell>
        <TableCell>{item.lastUpdated}</TableCell>
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

---

### 4.2 Library Detail（詳細パネル）

#### 画面形式
Sheet（右側から開く）

#### 詳細で見るもの（種別共通）
- Library資産基本情報
  - Title
  - Category
  - Description
  - Intended Use
  - Applicable Scope
  - Owner
  - Status
  - Tags
  - Version
  - Created / Updated
  
- 関連情報
  - Linked Company
  - Linked Project
  - Linked User
  - Linked Evidence
  - Linked Action
  - Linked Content
  
- 再利用先情報
  - 使用されたOutbound一覧
  - 使用されたContent一覧
  - 使用されたAction一覧

#### 詳細で見るもの（Template固有）
- Template内容
  - Subject
  - Body（Rich Text）
  - Variables（変数定義一覧）
  - Sample Output（変数埋めサンプル）
  - Channel

#### 詳細で見るもの（Playbook固有）
- Playbook内容
  - Trigger Condition（トリガー条件）
  - Recommended Steps（推奨手順一覧）
  - Escalation Rule（エスカレーション条件）
  - Evidence Requirement（必要なEvidence）
  - Expected Outcome（期待される成果）
  - Checkpoints（チェックポイント）

#### 詳細で見るもの（Knowledge固有）
- Knowledge内容
  - Summary（要約）
  - Body（本文、Rich Text）
  - Recommendation（推奨事項）
  - Reusable Insight Flag
  - Related Playbooks
  - Related Templates
  - Source Evidence

#### 詳細で見るもの（Asset固有）
- Asset情報
  - File Name
  - File Type（PDF / Excel / PowerPoint / Image / Video）
  - File Size
  - Preview（プレビュー画像/サムネイル）
  - Asset Purpose（資料の目的）
  - Download Count

#### 詳細パネル内のCTA（種別共通）

##### 主CTA（重い操作）
```tsx
主CTA（Template）:
- 「Outboundで使う」（status=approved のみ）
- 「Contentで使う」（status=approved のみ）

主CTA（Playbook）:
- 「Actionで使う」（status=approved のみ）

主CTA（Asset）:
- 「ダウンロード」
- 「共有リンクをコピー」

補助CTA（編集）:
- 「編集」
- 「複製」
- 「プレビュー」

補助CTA（文脈参照）:
- 「再利用先を見る」
- 「Companyを見る」
- 「Projectを見る」
- 「Evidenceを見る」

状態変更CTA:
- 「承認申請」（status=draft のみ）
- 「承認」（status=review_required かつ reviewer権限）
- 「差し戻し」（status=review_required かつ reviewer権限）
- 「削除」
```

#### UI実装パターン
```tsx
<Sheet open={detailOpen} onOpenChange={setDetailOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{selectedLibraryItem.title}</SheetTitle>
      <SheetDescription>
        {selectedLibraryItem.category} • {selectedLibraryItem.status}
      </SheetDescription>
    </SheetHeader>
    
    {/* 基本情報 */}
    <div className="space-y-4 mt-6">
      <div>
        <Label>Description</Label>
        <p>{selectedLibraryItem.description}</p>
      </div>
      <div>
        <Label>Intended Use</Label>
        <p>{selectedLibraryItem.intendedUse}</p>
      </div>
      
      {/* Category別の内容表示 */}
      {selectedLibraryItem.category === 'Template' && (
        <>
          <div>
            <Label>Subject</Label>
            <p>{selectedLibraryItem.subject}</p>
          </div>
          <div>
            <Label>Body</Label>
            <div className="border rounded p-4 bg-slate-50">
              <div dangerouslySetInnerHTML={{ __html: selectedLibraryItem.body }} />
            </div>
          </div>
          <div>
            <Label>Variables</Label>
            <div className="space-y-2">
              {selectedLibraryItem.variables.map(v => (
                <div key={v.name} className="border rounded p-3">
                  <p className="font-semibold">{v.name}</p>
                  <p className="text-sm text-slate-600">{v.description}</p>
                  <p className="text-sm">デフォルト: {v.defaultValue || "なし"}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      {selectedLibraryItem.category === 'Playbook' && (
        <>
          <div>
            <Label>Trigger Condition</Label>
            <p>{selectedLibraryItem.triggerCondition}</p>
          </div>
          <div>
            <Label>Recommended Steps</Label>
            <ol className="list-decimal list-inside space-y-2">
              {selectedLibraryItem.recommendedSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}
      
      {selectedLibraryItem.category === 'Asset' && (
        <>
          <div>
            <Label>File Info</Label>
            <p>Type: {selectedLibraryItem.fileType}</p>
            <p>Size: {selectedLibraryItem.fileSize}</p>
          </div>
          <div>
            <Label>Preview</Label>
            <img src={selectedLibraryItem.preview} alt="Preview" className="max-w-full" />
          </div>
        </>
      )}
    </div>
    
    {/* 主CTA */}
    <div className="mt-6 flex gap-2">
      {selectedLibraryItem.category === 'Template' && selectedLibraryItem.status === 'approved' && (
        <>
          <Link to={`/outbound/compose?fromTemplate=${selectedLibraryItem.id}`}>
            <Button className="bg-blue-600">
              <Send className="w-4 h-4 mr-2" />
              Outboundで使う
            </Button>
          </Link>
          <Link to={`/content/create?fromTemplate=${selectedLibraryItem.id}`}>
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Contentで使う
            </Button>
          </Link>
        </>
      )}
      
      {selectedLibraryItem.category === 'Playbook' && selectedLibraryItem.status === 'approved' && (
        <Link to={`/actions/create?fromPlaybook=${selectedLibraryItem.id}`}>
          <Button className="bg-blue-600">
            <Target className="w-4 h-4 mr-2" />
            Actionで使う
          </Button>
        </Link>
      )}
      
      {selectedLibraryItem.category === 'Asset' && (
        <>
          <Button onClick={() => downloadAsset()}>
            <Download className="w-4 h-4 mr-2" />
            ダウンロード
          </Button>
          <Button variant="outline" onClick={() => copyShareLink()}>
            <Link className="w-4 h-4 mr-2" />
            共有リンクをコピー
          </Button>
        </>
      )}
      
      <Button variant="outline" onClick={() => setIsEditing(true)}>編集</Button>
    </div>
  </SheetContent>
</Sheet>
```

---

### 4.3 Library Create（新規作成画面）

#### 画面形式
モーダル（種別選択）→ Drawer/Sheet（作成フォーム）

#### 新規作成で作るもの
- Template
- Playbook
- Knowledge
- Asset

#### 新規作成フロー

##### ステップ1: 種別選択
```tsx
<Dialog open={showTypeSelectModal} onOpenChange={setShowTypeSelectModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Library資産の種別を選択</DialogTitle>
      <DialogDescription>
        作成する再利用資産の種別を選択してください
      </DialogDescription>
    </DialogHeader>
    
    <div className="grid grid-cols-2 gap-4">
      <Button 
        variant="outline" 
        className="h-24 flex-col"
        onClick={() => handleTypeSelect('template')}
      >
        <FileText className="w-8 h-8 mb-2" />
        <span>Template</span>
        <span className="text-xs text-slate-500">文面テンプレート</span>
      </Button>
      
      <Button 
        variant="outline" 
        className="h-24 flex-col"
        onClick={() => handleTypeSelect('playbook')}
      >
        <Target className="w-8 h-8 mb-2" />
        <span>Playbook</span>
        <span className="text-xs text-slate-500">業務手順</span>
      </Button>
      
      <Button 
        variant="outline" 
        className="h-24 flex-col"
        onClick={() => handleTypeSelect('knowledge')}
      >
        <Sparkles className="w-8 h-8 mb-2" />
        <span>Knowledge</span>
        <span className="text-xs text-slate-500">知見・ベストプラクティス</span>
      </Button>
      
      <Button 
        variant="outline" 
        className="h-24 flex-col"
        onClick={() => handleTypeSelect('asset')}
      >
        <Database className="w-8 h-8 mb-2" />
        <span>Asset</span>
        <span className="text-xs text-slate-500">ファイル・資料</span>
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

##### ステップ2: ソース選択（文脈接続）
```tsx
<Dialog open={showSourceSelectModal} onOpenChange={setShowSourceSelectModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>作成元を選択</DialogTitle>
      <DialogDescription>
        既存の文脈から作成するか、空から作成するか選択してください
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-2">
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('empty')}
      >
        空から作成
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('evidence')}
      >
        Evidenceから作成（Evidence選択リスト表示）
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('action')}
      >
        Actionから作成（Action選択リスト表示）
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('content')}
      >
        Contentから作成（Content選択リスト表示）
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

##### ステップ3: 作成フォーム（種別共通項目）

###### 共通項目
- **Title** (text, 必須): 資産名
- **Category** (auto): 種別（ステップ1で選択済み）
- **Description** (textarea, 必須): 説明
- **Intended Use** (textarea): 使用目的
- **Applicable Scope** (select): `Company` / `Project` / `User`
- **Owner** (select, 必須): 担当者
- **Status** (select): `draft` / `review_required` / `approved`
- **Tags** (multi-select): タグ
- **Version** (text): バージョン番号

###### リンク情報
- **Linked Company** (select): 関連Company
- **Linked Project** (select): 関連Project
- **Linked User** (multi-select): 関連User
- **Linked Evidence** (multi-select): 根拠Evidence
- **Linked Action** (select): 元になったAction
- **Linked Content** (select): 元になったContent

##### ステップ4: 種別別追加項目

###### Template作成フォーム
```tsx
<div className="space-y-4">
  {/* 共通項目 */}
  {/* ... */}
  
  {/* Template固有項目 */}
  <div>
    <Label>Channel *</Label>
    <Select value={channel} onValueChange={setChannel}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="email">Email</SelectItem>
        <SelectItem value="slack">Slack</SelectItem>
        <SelectItem value="document">Document</SelectItem>
      </SelectContent>
    </Select>
  </div>
  
  <div>
    <Label>Type *</Label>
    <Select value={type} onValueChange={setType}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="external">顧客向け</SelectItem>
        <SelectItem value="internal">社内向け</SelectItem>
      </SelectContent>
    </Select>
  </div>
  
  <div>
    <Label>Subject *</Label>
    <Input value={subject} onChange={e => setSubject(e.target.value)} />
  </div>
  
  <div>
    <Label>Body *</Label>
    <RichTextEditor value={body} onChange={setBody} />
  </div>
  
  <div>
    <Label>Variables</Label>
    <div className="space-y-2">
      {variables.map((v, idx) => (
        <div key={idx} className="border rounded p-3 space-y-2">
          <Input 
            placeholder="変数名（例: user_name）" 
            value={v.name} 
            onChange={e => updateVariable(idx, 'name', e.target.value)} 
          />
          <Input 
            placeholder="表示ラベル（例: ユーザー名）" 
            value={v.label} 
            onChange={e => updateVariable(idx, 'label', e.target.value)} 
          />
          <Textarea 
            placeholder="説明" 
            value={v.description} 
            onChange={e => updateVariable(idx, 'description', e.target.value)} 
          />
          <Input 
            placeholder="デフォルト値" 
            value={v.defaultValue} 
            onChange={e => updateVariable(idx, 'defaultValue', e.target.value)} 
          />
          <Checkbox 
            checked={v.required} 
            onCheckedChange={checked => updateVariable(idx, 'required', checked)}
          >
            必須
          </Checkbox>
        </div>
      ))}
      <Button variant="outline" onClick={() => addVariable()}>
        <Plus className="w-4 h-4 mr-2" />
        変数を追加
      </Button>
    </div>
  </div>
  
  <div>
    <Label>Sample Output</Label>
    <div className="border rounded p-4 bg-slate-50">
      <p className="text-sm text-slate-500 mb-2">プレビュー（変数を埋めたサンプル）</p>
      <div dangerouslySetInnerHTML={{ __html: generatePreview() }} />
    </div>
  </div>
</div>
```

###### Playbook作成フォーム
```tsx
<div className="space-y-4">
  {/* 共通項目 */}
  {/* ... */}
  
  {/* Playbook固有項目 */}
  <div>
    <Label>Trigger Condition *</Label>
    <Textarea 
      placeholder="どういう時に使うか" 
      value={triggerCondition} 
      onChange={e => setTriggerCondition(e.target.value)} 
    />
  </div>
  
  <div>
    <Label>Recommended Steps *</Label>
    <div className="space-y-2">
      {recommendedSteps.map((step, idx) => (
        <div key={idx} className="border rounded p-3 space-y-2">
          <Input 
            placeholder={`ステップ${idx + 1}の名前`} 
            value={step.name} 
            onChange={e => updateStep(idx, 'name', e.target.value)} 
          />
          <RichTextEditor 
            placeholder="詳細説明" 
            value={step.description} 
            onChange={val => updateStep(idx, 'description', val)} 
          />
          <Input 
            placeholder="推奨アクション" 
            value={step.recommendedAction} 
            onChange={e => updateStep(idx, 'recommendedAction', e.target.value)} 
          />
          <Textarea 
            placeholder="チェックポイント" 
            value={step.checkpoint} 
            onChange={e => updateStep(idx, 'checkpoint', e.target.value)} 
          />
        </div>
      ))}
      <Button variant="outline" onClick={() => addStep()}>
        <Plus className="w-4 h-4 mr-2" />
        ステップを追加
      </Button>
    </div>
  </div>
  
  <div>
    <Label>Escalation Rule</Label>
    <Textarea 
      placeholder="エスカレーション条件" 
      value={escalationRule} 
      onChange={e => setEscalationRule(e.target.value)} 
    />
  </div>
  
  <div>
    <Label>Evidence Requirement</Label>
    <Textarea 
      placeholder="必要なEvidence" 
      value={evidenceRequirement} 
      onChange={e => setEvidenceRequirement(e.target.value)} 
    />
  </div>
  
  <div>
    <Label>Expected Outcome</Label>
    <Textarea 
      placeholder="期待される成果" 
      value={expectedOutcome} 
      onChange={e => setExpectedOutcome(e.target.value)} 
    />
  </div>
</div>
```

###### Knowledge作成フォーム
```tsx
<div className="space-y-4">
  {/* 共通項目 */}
  {/* ... */}
  
  {/* Knowledge固有項目 */}
  <div>
    <Label>Summary *</Label>
    <Textarea 
      placeholder="要約" 
      value={summary} 
      onChange={e => setSummary(e.target.value)} 
    />
  </div>
  
  <div>
    <Label>Body *</Label>
    <RichTextEditor value={body} onChange={setBody} />
  </div>
  
  <div>
    <Label>Recommendation</Label>
    <Textarea 
      placeholder="推奨事項" 
      value={recommendation} 
      onChange={e => setRecommendation(e.target.value)} 
    />
  </div>
  
  <div>
    <Checkbox 
      checked={reusableInsightFlag} 
      onCheckedChange={setReusableInsightFlag}
    >
      再利用可能な知見としてマークする
    </Checkbox>
  </div>
  
  <div>
    <Label>Related Playbooks</Label>
    <MultiSelect 
      options={playbookOptions} 
      value={relatedPlaybooks} 
      onChange={setRelatedPlaybooks} 
    />
  </div>
  
  <div>
    <Label>Related Templates</Label>
    <MultiSelect 
      options={templateOptions} 
      value={relatedTemplates} 
      onChange={setRelatedTemplates} 
    />
  </div>
</div>
```

###### Asset作成フォーム
```tsx
<div className="space-y-4">
  {/* 共通項目 */}
  {/* ... */}
  
  {/* Asset固有項目 */}
  <div>
    <Label>File Upload *</Label>
    <div 
      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => fileInputRef.current?.click()}
    >
      <Upload className="w-12 h-12 mx-auto mb-2 text-slate-400" />
      <p className="text-sm text-slate-600">
        ファイルをドラッグ&ドロップ、またはクリックして選択
      </p>
      <p className="text-xs text-slate-500 mt-1">
        対応形式: PDF, XLSX, PPTX, PNG, JPG, MP4（最大10MB）
      </p>
      <input 
        ref={fileInputRef} 
        type="file" 
        className="hidden" 
        accept=".pdf,.xlsx,.pptx,.png,.jpg,.mp4"
        onChange={handleFileSelect}
      />
    </div>
    
    {uploadedFiles.length > 0 && (
      <div className="space-y-2 mt-4">
        {uploadedFiles.map((file, idx) => (
          <div key={idx} className="border rounded p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => removeFile(idx)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    )}
  </div>
  
  <div>
    <Label>Asset Purpose</Label>
    <Textarea 
      placeholder="この資料の目的" 
      value={assetPurpose} 
      onChange={e => setAssetPurpose(e.target.value)} 
    />
  </div>
  
  {uploadedFiles[0] && (uploadedFiles[0].type.startsWith('image/') || uploadedFiles[0].type === 'application/pdf') && (
    <div>
      <Label>Preview</Label>
      <div className="border rounded p-4 bg-slate-50">
        {uploadedFiles[0].type.startsWith('image/') && (
          <img 
            src={URL.createObjectURL(uploadedFiles[0])} 
            alt="Preview" 
            className="max-w-full max-h-64 mx-auto" 
          />
        )}
        {uploadedFiles[0].type === 'application/pdf' && (
          <p className="text-sm text-slate-500">PDFプレビュー（サムネイル生成中）</p>
        )}
      </div>
    </div>
  )}
</div>
```

##### ステップ5: 保存オプション
```tsx
<div className="flex gap-2 mt-6">
  <Button type="submit" className="bg-blue-600">
    {selectedType === 'asset' ? 'アップロードして保存' : '保存'}
  </Button>
  <Button type="button" variant="outline" onClick={() => saveDraft()}>
    下書き保存
  </Button>
  <Button type="button" variant="outline" onClick={() => requestReview()}>
    レビュー依頼
  </Button>
  <Button type="button" variant="outline" onClick={() => setShowCreateDrawer(false)}>
    キャンセル
  </Button>
</div>
```

#### 新規作成CTA
```tsx
画面右上（Library List）:
- 「+新規作成」ボタン

詳細パネル内（他画面から）:
- Content詳細 → 「Libraryに登録」
- Action詳細 → 「Playbook化する」
```

#### Source Contextからの引き継ぎ

##### From Content（Template化）
```
Content詳細パネル内 → 「Libraryに登録」
→ Library Create（種別: Template）
→ 引き継ぎ項目:
  - category: "Template"
  - title: content.title
  - subject: content.subject
  - body: content.body
  - channel: content.channel
  - type: external or internal
  - linked_content: contentId
  - linked_company: content.company_id
  - linked_project: content.project_id
  - linked_evidence: content.evidence_ids
  - linked_action: content.action_id
→ Variables自動抽出（{{xxx}}パターンを検出）
```

##### From Action（Playbook化）
```
Action詳細パネル内 → 「Playbook化する」
→ Library Create（種別: Playbook）
→ 引き継ぎ項目:
  - category: "Playbook"
  - title: action.title + " - Playbook"
  - trigger_condition: action.objective
  - recommended_steps: action.suggested_next_step（初期値）
  - linked_action: actionId
  - linked_company: action.company_id
  - linked_project: action.project_id
  - linked_evidence: action.evidence_ids
```

---

### 4.4 Library の他画面との接続

#### From Library (Template) → Outbound
```
Library/Template詳細パネル内
→ 「Outboundで使う」ボタン
→ `/outbound/compose?fromTemplate=${templateId}`
→ Outbound Compose画面が開く
→ Template内容が引き継がれる:
  - template_id: templateId
  - subject: template.subject（変数未埋め）
  - body: template.body（変数未埋め）
  - variables: template.variables（空のkey-value pairs）
  - channel: template.channel
```

#### From Library (Template) → Content
```
Library/Template詳細パネル内
→ 「Contentで使う」ボタン
→ `/content/create?fromTemplate=${templateId}`
→ Content作成フォーム
→ Template内容が引き継がれる
```

#### From Library (Playbook) → Action
```
Library/Playbook詳細パネル内
→ 「Actionで使う」ボタン
→ Action作成フォームDrawer
→ Playbook手順が引き継がれる:
  - title: playbook.title
  - objective: playbook.trigger_condition
  - suggested_next_step: playbook.recommended_steps
```

---

### 4.5 Library の未実装部分

#### 必要な新規実装
1. **種別選択モーダル**
   - Template / Playbook / Knowledge / Asset の4種別選択UI

2. **ソース選択モーダル**
   - 空から / Evidence / Action / Content からの作成選択
   - 各ソースの選択リスト表示

3. **Variables設定UI（Template用）**
   - 変数追加・編集・削除
   - プレビュー機能

4. **Recommended Steps設定UI（Playbook用）**
   - ステップ追加・編集・削除・並び替え
   - Rich Text Editor統合

5. **File UploadUI（Asset用）**
   - ドラッグ&ドロップ
   - プレビュー生成
   - ファイルサイズ・種別制限

6. **適用CTA（Template/Playbook）**
   - Outbound/Content/Actionへの適用導線
   - 適用時のvariables入力UI

---

## 5. Audience の3段階導線（新規設計）

### 5.1 Audience List（一覧画面）

#### 画面名
`/audience/list`（新規作成）

#### 一覧で見るもの
- Audience一覧（保存済みAudience）
- Name（Audience名）
- Audience Scope（company / project / user / cluster / segment）
- Target Count（対象件数）
- Owner（作成者）
- Status（draft / active / archived）
- Reusable Flag（再利用可能フラグ）
- Last Updated（最終更新日）
- Used In（使用されたOutbound/Action件数）
- Source Context（Project / Company / Cluster など）

#### 一覧上のCTA
```tsx
画面右上:
- 「新規Audience作成」ボタン

各行（軽い操作のみ）:
- 「詳細を見る」（Sheet起動）
- 「Outboundで使う」（クイックアクション）
- 「複製」（クイックアクション）
- Scope badge（視認のみ）
- Status badge（視認のみ）
- Target Count表示（視認のみ）
```

#### フィルタ・ソート
- Scope別フィルタ（company / project / user / cluster / segment）
- Status別フィルタ
- Owner別フィルタ
- Reusable Flagフィルタ
- Source Context別フィルタ
- Target Count範囲フィルタ
- 最終更新日範囲フィルタ

#### UI実装パターン
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Status</TableHead>
      <TableHead>Name</TableHead>
      <TableHead>Scope</TableHead>
      <TableHead>Target Count</TableHead>
      <TableHead>Owner</TableHead>
      <TableHead>Used In</TableHead>
      <TableHead>Last Updated</TableHead>
      <TableHead></TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {audiences.map(audience => (
      <TableRow key={audience.id}>
        <TableCell><Badge>{audience.status}</Badge></TableCell>
        <TableCell>{audience.name}</TableCell>
        <TableCell><Badge>{audience.scope}</Badge></TableCell>
        <TableCell>{audience.targetCount}件</TableCell>
        <TableCell>{audience.owner}</TableCell>
        <TableCell>
          {audience.usedInOutbound}件のOutbound
        </TableCell>
        <TableCell>{audience.lastUpdated}</TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openDetail(audience.id)}>
              詳細を見る
            </Button>
            <Button size="sm" variant="outline" onClick={() => useInOutbound(audience.id)}>
              Outboundで使う
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

### 5.2 Audience Detail（詳細パネル）

#### 画面形式
Sheet（右側から開く）

#### 詳細で見るもの
- Audience基本情報
  - Name
  - Description
  - Audience Scope
  - Owner
  - Status
  - Reusable Flag
  - Source Context
  - Created / Updated
  
- Audience条件
  - Filters（条件一覧）
    - Company条件
    - Project条件
    - User条件
    - Signal条件（Health / Risk / Opportunity）
    - Activity条件
    - Phase条件
  - Target Count（対象件数）
  
- 対象リスト
  - Resolved Recipients（確定対象一覧）
    - Company名 / Project名 / User名
    - Email
    - Role
    - Last Activity
  - 代表対象（上位10件など）
  
- リンク情報
  - Linked Cluster
  - Linked Segment
  - Linked Company
  - Linked Project
  
- 使用履歴
  - 使用されたOutbound一覧
  - 使用されたAction一覧
  - 使用されたContent一覧

#### 詳細パネル内のCTA

##### 主CTA（重い操作）
```tsx
主CTA:
- 「Outboundで使う」（status=active のみ）
- 「編集」（Audience Builderへ遷移）
- 「複製」

補助CTA（文脈参照）:
- 「Resultsを見る」（使用されたOutbound結果）
- 「Linked Projectを見る」
- 「Linked Companyを見る」
- 「Linked Clusterを見る」

補助CTA（対象確認）:
- 「対象を全件Export」（CSV/Excel出力）
- 「対象を絞り込む」（Audience Builder編集）

状態変更CTA:
- 「アーカイブ」（使用終了後）
- 「再利用可能にする」（reusable_flag切り替え）
- 「削除」
```

#### UI実装パターン
```tsx
<Sheet open={detailOpen} onOpenChange={setDetailOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{selectedAudience.name}</SheetTitle>
      <SheetDescription>
        Audience詳細 • {selectedAudience.scope} • {selectedAudience.targetCount}件
      </SheetDescription>
    </SheetHeader>
    
    {/* 基本情報 */}
    <div className="space-y-4 mt-6">
      <div>
        <Label>Description</Label>
        <p>{selectedAudience.description}</p>
      </div>
      
      <div>
        <Label>Audience Scope</Label>
        <Badge>{selectedAudience.scope}</Badge>
      </div>
      
      <div>
        <Label>Target Count</Label>
        <p className="text-2xl font-bold">{selectedAudience.targetCount}件</p>
      </div>
    </div>
    
    {/* Audience条件 */}
    <div className="mt-6">
      <Label>Audience条件</Label>
      <div className="space-y-2">
        {selectedAudience.filters.map((filter, idx) => (
          <div key={idx} className="border rounded p-3 bg-slate-50">
            <p className="font-semibold">{filter.field}</p>
            <p className="text-sm">{filter.operator} {filter.value}</p>
          </div>
        ))}
      </div>
    </div>
    
    {/* 代表対象 */}
    <div className="mt-6">
      <Label>対象（上位10件）</Label>
      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedAudience.sampleRecipients.map(recipient => (
              <TableRow key={recipient.id}>
                <TableCell>{recipient.name}</TableCell>
                <TableCell>{recipient.email}</TableCell>
                <TableCell>{recipient.company}</TableCell>
                <TableCell>{recipient.lastActive}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => exportAllRecipients()}>
        全件Export
      </Button>
    </div>
    
    {/* 使用履歴 */}
    <div className="mt-6">
      <Label>使用履歴</Label>
      <div className="space-y-2">
        {selectedAudience.usedInOutbounds.map(outbound => (
          <div key={outbound.id} className="border rounded p-3">
            <Link to={`/outbound/results/${outbound.id}`} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{outbound.name}</p>
                <p className="text-sm text-slate-600">{outbound.sentDate}</p>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
    
    {/* 主CTA */}
    <div className="mt-6 flex gap-2">
      {selectedAudience.status === 'active' && (
        <Link to={`/outbound/compose?fromAudience=${selectedAudience.id}`}>
          <Button className="bg-blue-600">
            <Send className="w-4 h-4 mr-2" />
            Outboundで使う
          </Button>
        </Link>
      )}
      <Link to={`/audience?edit=${selectedAudience.id}`}>
        <Button variant="outline">編集</Button>
      </Link>
      <Button variant="outline" onClick={() => duplicateAudience()}>複製</Button>
    </div>
  </SheetContent>
</Sheet>
```

---

### 5.3 Audience Builder / Create（新規作成画面）

#### 画面名
`/audience`（既存画面）または `/audience/create`

#### 新規作成で作るもの
新しいAudience（対象群・セグメント条件定義）

#### 作成フォームで必要な項目

##### 基本情報（必須）
- **Name** (text, 必須): Audience名
- **Description** (textarea): 説明
- **Audience Scope** (select, 必須): `company` / `project` / `user` / `cluster` / `segment`
- **Owner** (select, 必須): 作成者
- **Status** (select): `draft` / `active` / `archived`
- **Reusable Flag** (checkbox): 再利用可能フラグ
- **Source Context** (auto): 起票元（Project / Company / Cluster など）

##### Audience条件（必須）
- **Filters** (complex): 条件定義
  - Company条件
    - Company名
    - Industry
    - Size
    - Plan
  - Project条件
    - Project Phase
    - Health Score範囲
    - Risk Score範囲
    - Opportunity Score範囲
    - Activity範囲（l30_active など）
  - User条件
    - Permission（admin / member）
    - User Stage（Engaged / At-Risk / Churned）
    - Last Active範囲
    - Email Domain
  - Signal条件
    - Health Signal種別
    - Risk Signal種別
    - Opportunity Signal種別
  - Activity条件
    - Activity Type
    - Activity Date範囲
    - Activity Frequency

##### リンク情報（任意）
- **Linked Cluster** (select): 元になったクラスター
- **Linked Segment** (select): 元になったセグメント
- **Linked Company** (select): 関連Company
- **Linked Project** (select): 関連Project

##### プレビュー情報（自動計算）
- **Target Count**: 対象件数（リアルタイム計算）
- **Resolved Recipients**: 確定対象リスト
- **Unresolved Recipients**: 未確定対象リスト
- **Sample Recipients**: 代表対象（上位10件）

#### 新規作成CTA
```tsx
画面右上（Audience List）:
- 「新規Audience作成」ボタン

他画面から:
- Project詳細 → 「Audience作成」ボタン
- Company詳細 → 「Audience作成」ボタン
- Cluster詳細 → 「Audience作成」ボタン
```

#### Source Contextからの引き継ぎ

##### From Project
```
URL: /audience?fromProject=${projectId}

引き継ぎ項目:
- source_context: "Project"
- linked_project: projectId
- linked_company: project.company_id
- audience_scope: "project"（初期値）
- filters: 
  - project_id = projectId（初期条件）
```

##### From Company
```
URL: /audience?fromCompany=${companyId}

引き継ぎ項目:
- source_context: "Company"
- linked_company: companyId
- audience_scope: "company"（初期値）
- filters:
  - company_id = companyId（初期条件）
```

##### From Cluster
```
URL: /audience?fromCluster=${clusterId}

引き継ぎ項目:
- source_context: "Cluster"
- linked_cluster: clusterId
- audience_scope: "project"（初期値）
- filters:
  - cluster_id = clusterId（初期条件）
  - cluster特性に基づく条件（自動設定）
```

#### UI実装パターン（既存のaudience.tsxを拡張）
```tsx
<div className="flex h-screen">
  <SidebarNav />
  <div className="flex-1 flex flex-col">
    <GlobalHeader />
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Audience Builder</h1>
            {sourceContext && (
              <Badge className="mt-2">{sourceContext}から作成</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewMode('saved')}>
              保存済みAudience
            </Button>
            <Button onClick={() => setViewMode('create')}>
              新規作成
            </Button>
          </div>
        </div>
        
        {viewMode === 'create' && (
          <div className="space-y-6">
            {/* 基本情報 */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">基本情報</h2>
              <div className="space-y-4">
                <div>
                  <Label>Audience Name *</Label>
                  <Input 
                    value={audienceName} 
                    onChange={e => setAudienceName(e.target.value)}
                    placeholder="例: At-Riskユーザー（Q1 2026）"
                  />
                </div>
                
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={audienceDescription} 
                    onChange={e => setAudienceDescription(e.target.value)}
                    placeholder="このAudienceの目的や背景"
                  />
                </div>
                
                <div>
                  <Label>Audience Scope *</Label>
                  <Select value={audienceScope} onValueChange={setAudienceScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="cluster">Cluster</SelectItem>
                      <SelectItem value="segment">Segment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Checkbox 
                    checked={reusableFlag} 
                    onCheckedChange={setReusableFlag}
                  >
                    再利用可能なAudienceとして保存する
                  </Checkbox>
                </div>
              </div>
            </div>
            
            {/* Audience条件 */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Audience条件</h2>
              <div className="space-y-4">
                {filters.map((filter, idx) => (
                  <div key={idx} className="border rounded p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>条件 {idx + 1}</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeFilter(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Field</Label>
                        <Select 
                          value={filter.field} 
                          onValueChange={val => updateFilter(idx, 'field', val)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="health_score">Health Score</SelectItem>
                            <SelectItem value="risk_score">Risk Score</SelectItem>
                            <SelectItem value="l30_active">L30 Active</SelectItem>
                            <SelectItem value="user_stage">User Stage</SelectItem>
                            <SelectItem value="permission">Permission</SelectItem>
                            <SelectItem value="last_active">Last Active</SelectItem>
                            {/* ... 他の条件 ... */}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Operator</Label>
                        <Select 
                          value={filter.operator} 
                          onValueChange={val => updateFilter(idx, 'operator', val)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">等しい</SelectItem>
                            <SelectItem value="not_equals">等しくない</SelectItem>
                            <SelectItem value="greater_than">より大きい</SelectItem>
                            <SelectItem value="less_than">より小さい</SelectItem>
                            <SelectItem value="contains">含む</SelectItem>
                            {/* ... 他のoperator ... */}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Value</Label>
                        <Input 
                          value={filter.value} 
                          onChange={e => updateFilter(idx, 'value', e.target.value)}
                          placeholder="値"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button variant="outline" onClick={() => addFilter()}>
                  <Plus className="w-4 h-4 mr-2" />
                  条件を追加
                </Button>
              </div>
            </div>
            
            {/* プレビュー */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">プレビュー</h2>
              <div className="space-y-4">
                <div>
                  <Label>対象件数</Label>
                  <p className="text-3xl font-bold text-blue-600">
                    {targetCount}件
                  </p>
                </div>
                
                <div>
                  <Label>代表対象（上位10件）</Label>
                  <div className="border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <Checkbox 
                              checked={selectedUsers.length === sampleRecipients.length}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Last Active</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleRecipients.map(recipient => (
                          <TableRow key={recipient.id}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedUsers.includes(recipient.id)}
                                onCheckedChange={() => toggleUserSelection(recipient.id)}
                              />
                            </TableCell>
                            <TableCell>{recipient.name}</TableCell>
                            <TableCell>{recipient.email}</TableCell>
                            <TableCell>{recipient.company}</TableCell>
                            <TableCell>{recipient.lastActive}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                <Button variant="outline" onClick={() => refreshPreview()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  プレビューを更新
                </Button>
              </div>
            </div>
            
            {/* 保存・次へ */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => saveDraft()}>
                下書き保存
              </Button>
              <Button onClick={() => saveAsReusable()}>
                Audienceとして登録
              </Button>
              <Link to={`/outbound/compose?fromAudience=${audienceId}`}>
                <Button className="bg-blue-600">
                  <Send className="w-4 h-4 mr-2" />
                  Outboundで使う
                </Button>
              </Link>
            </div>
          </div>
        )}
        
        {viewMode === 'saved' && (
          <div>
            {/* Audience List表示 */}
            <AudienceList />
          </div>
        )}
      </div>
    </div>
  </div>
</div>
```

---

### 5.4 Audience の他画面との接続

#### From Audience → Outbound
```
Audience詳細パネル内 または Audience Builder
→ 「Outboundで使う」ボタン
→ `/outbound/compose?fromAudience=${audienceId}`
→ Outbound Compose画面が開く
→ Audience情報が引き継がれる:
  - linked_audience: audienceId
  - audience_scope: audience.scope
  - audience_conditions: audience.filters
  - resolved_recipients: audience.target_users
  - linked_company: audience.company_id
  - linked_project: audience.project_id
  - linked_cluster: audience.cluster_id
```

#### From Project → Audience
```
Project詳細画面
→ 「Audience作成」ボタン
→ `/audience?fromProject=${projectId}`
→ Audience Builder画面が開く
→ Project文脈が引き継がれる
```

#### From Outbound Editor → Audience
```
Outbound Editor
→ 「送信対象を調整」ボタン
→ `/audience?returnTo=/outbound/editor/${id}`
→ Audience Workspace（既存機能）
→ 対象を調整
→ 「Editorに戻る」ボタン
→ Outbound Editorに戻る
```

---

### 5.5 Audience の未実装部分

#### 必要な新規実装
1. **Audience List画面（新規）**
   - `/audience/list` 画面の新規作成
   - 保存済みAudience一覧表示
   - フィルタ・ソート機能
   - Outboundで使う/複製のクイックアクション

2. **Audience Detail Sheet（新規）**
   - Audience詳細パネルの新規作成
   - Audience条件の詳細表示
   - 代表対象の表示
   - 使用履歴の表示

3. **Audience Builder拡張**
   - 既存の`audience.tsx`を拡張
   - 基本情報入力フォーム追加
   - Source context引き継ぎロジック
   - 保存・登録機能追加

4. **Audienceとして登録機能（新規）**
   - 下書き保存 vs Audienceとして登録の分離
   - Reusable Flag設定
   - Status管理（draft / active / archived）

5. **Audience再利用機能（新規）**
   - Audience List → Outboundへの導線
   - Audience Detail → Outboundへの導線
   - Audience複製機能

---

## まとめ

### 各機能の3段階導線

| 機能 | 一覧画面 | 詳細画面 | 新規作成画面 |
|------|----------|----------|--------------|
| **Actions** | `/actions`<br>Action一覧 | Sheet（Action Detail）<br>Evidence/Company/Project参照 | Drawer/Sheet<br>Action Create Form |
| **Content** | `/content`<br>Content一覧 | Sheet（Content Detail）<br>プレビュー/Template参照 | Sheet<br>Content Create Form（Rich Text） |
| **Outbound** | `/outbound`<br>Outbound一覧 | `/outbound/editor/:id`<br>または `/outbound/results/:id` | `/outbound/compose`<br>Outbound Create/Compose |
| **Library** | `/library`<br>Template/Playbook/Knowledge/Asset一覧 | Sheet（Library Detail）<br>種別別の詳細表示 | Modal（種別選択）→ Drawer/Sheet（種別別フォーム） |
| **Audience** | `/audience/list`（新規）<br>保存済みAudience一覧 | Sheet（Audience Detail、新規）<br>条件/対象/使用履歴 | `/audience`または`/audience/create`<br>Audience Builder |

### 新規作成CTAの役割分担

| 機能 | 新規作成CTA | 作成するもの | 保存先 | 再利用 |
|------|-------------|--------------|--------|--------|
| **Actions** | 新規Action作成<br>Follow-upを作成 | Action（やること） | Actions | 基本的には単発 |
| **Content** | 新規Content作成<br>下書きを作成 | Content Job（作業物） | Content | 基本的には単発 |
| **Outbound** | 新規Outbound作成<br>送信ドラフトを作成 | Outbound Item（送信記録） | Outbound | 基本的には単発 |
| **Library** | +新規作成（種別選択） | Template/Playbook/Knowledge/Asset | Library | 積極的に再利用 |
| **Audience** | 新規Audience作成 | Audience（対象群定義） | Audience | 必要に応じて再利用 |

### Source Context引き継ぎパターン

```
Evidence → Actions/Content/Outbound/Library
Action → Content/Outbound/Library(Playbook)
Content → Outbound/Library(Template)
Project → Actions/Content/Outbound/Audience
Company → Actions/Content/Outbound/Audience
Cluster → Audience
Audience → Outbound
Library(Template) → Content/Outbound
Library(Playbook) → Actions
```

### 未実装部分の優先度

#### 優先度 High（即座に実装）
1. Audience List画面（新規）
2. Audience Detail Sheet（新規）
3. Audience Builder拡張（保存・登録機能）
4. Outbound → Source選択モーダル

#### 優先度 Medium（次のフェーズ）
1. Library種別選択モーダル
2. Library Variables設定UI（Template用）
3. Content → Libraryに登録フロー
4. Audience複製機能

#### 優先度 Low（将来的に）
1. Library File UploadUI（Asset用）
2. Library Recommended Steps UI（Playbook用）
3. Actions → Playbook化フロー
4. Audience使用履歴詳細

---

この設計により、各機能の「一覧 → 詳細 → 新規作成」の導線が明確になり、特にAudienceを新たに整理することで、Project等からの自然な導線と、Audienceの再利用・管理が可能になります。
