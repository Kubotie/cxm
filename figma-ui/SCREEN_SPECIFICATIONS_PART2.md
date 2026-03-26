# 画面仕様書Part2：Outbound と Library

## 4. Outbound

### 4-1. Outbound List（一覧画面）

#### 最低限表示すべきカラム

| カラム名 | データ型 | 表示形式 | 説明 |
|---------|---------|---------|------|
| **Delivery Status** | badge | `draft` / `scheduled` / `sent` / `failed` | 配信状態 |
| **Review State** | badge | `not_required` / `review_required` / `approved` / `rejected` | レビュー状態 |
| **Outbound Name** | text | 最大60文字表示 | Outbound名（クリックで詳細） |
| **Channel** | badge | `email` / `slack` | チャネル |
| **Audience Scope** | badge | `company` / `project` / `user` | 対象スコープ |
| **Source Context** | badge | `Actions` / `Content` / `Audience` / `Project` / `Company` | 起票元 |
| **Company/Project** | link | 会社名/プロジェクト名 | 関連entities |
| **Recipients** | number | `123 / 150件` | 確定/全体件数 |
| **Unresolved** | number | `27件` | 未解決件数（警告色） |
| **Owner** | text | ユーザー名 | 担当者 |
| **Scheduled / Sent** | date | `2026-03-20` | 送信予定日/送信日 |
| **Reaction** | summary | `Open: 45%` / `Click: 12%` | 反応サマリー（sent時のみ） |
| **Actions** | buttons | 詳細を見る | 操作ボタン |

#### 一覧画面で見たいこと
- **何を送る/送ったのか**: Outbound Name + Channel
- **どのチャネルか**: Channel badge
- **どの対象か**: Audience Scope + Recipients数
- **今どの状態か**: Delivery Status + Review State
- **unresolved や failed がないか**: Unresolved件数（強調表示）
- **反応はどうか**: Reaction Summary（sent時）

#### フィルタ・ソート
- **フィルタ**:
  - Delivery Status別（draft / scheduled / sent / failed）
  - Review State別
  - Channel別（email / slack）
  - Audience Scope別（company / project / user）
  - Source Context別
  - Owner別
  - Unresolved あり/なし
  - Failed あり/なし
- **ソート**:
  - Scheduled/Sent Date（近い順/遠い順）
  - Recipients数（多い順/少い順）
  - Reaction（高い順/低い順）
  - Updated At（新しい順/古い順）

#### 一覧画面のUI
```tsx
<div className="space-y-4">
  <div className="flex gap-2">
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="scheduled">Scheduled</SelectItem>
        <SelectItem value="sent">Sent</SelectItem>
        <SelectItem value="failed">Failed</SelectItem>
      </SelectContent>
    </Select>
    
    <Select value={channelFilter} onValueChange={setChannelFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Channel" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Channels</SelectItem>
        <SelectItem value="email">Email</SelectItem>
        <SelectItem value="slack">Slack</SelectItem>
      </SelectContent>
    </Select>
    
    <Select value={scopeFilter} onValueChange={setScopeFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Scope" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Scope</SelectItem>
        <SelectItem value="company">Company</SelectItem>
        <SelectItem value="project">Project</SelectItem>
        <SelectItem value="user">User</SelectItem>
      </SelectContent>
    </Select>
    
    <Input 
      placeholder="Search outbound..." 
      value={searchQuery} 
      onChange={e => setSearchQuery(e.target.value)}
      className="flex-1"
    />
  </div>
  
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Status</TableHead>
        <TableHead>Review</TableHead>
        <TableHead>Outbound Name</TableHead>
        <TableHead>Channel</TableHead>
        <TableHead>Scope</TableHead>
        <TableHead>Source</TableHead>
        <TableHead>Recipients</TableHead>
        <TableHead>Date</TableHead>
        <TableHead>Reaction</TableHead>
        <TableHead></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {filteredOutbounds.map(outbound => (
        <TableRow 
          key={outbound.id}
          className={outbound.unresolvedCount > 0 ? 'bg-yellow-50' : ''}
        >
          <TableCell>
            <Badge variant={getStatusVariant(outbound.deliveryStatus)}>
              {outbound.deliveryStatus}
            </Badge>
          </TableCell>
          <TableCell>
            {outbound.reviewState !== 'not_required' && (
              <Badge variant={getReviewVariant(outbound.reviewState)}>
                {getReviewLabel(outbound.reviewState)}
              </Badge>
            )}
          </TableCell>
          <TableCell>
            <button 
              onClick={() => openDetail(outbound.id)}
              className="text-left hover:underline"
            >
              <div className="font-medium">{outbound.name}</div>
              {outbound.unresolvedCount > 0 && (
                <Badge variant="warning" className="mt-1">
                  ⚠️ {outbound.unresolvedCount}件未解決
                </Badge>
              )}
            </button>
          </TableCell>
          <TableCell>
            <Badge variant="outline">{outbound.channel}</Badge>
          </TableCell>
          <TableCell>
            <Badge variant="outline">{outbound.audienceScope}</Badge>
          </TableCell>
          <TableCell>
            <Badge variant="secondary">{outbound.sourceContext}</Badge>
          </TableCell>
          <TableCell>
            <div className="text-sm">
              <span className="font-semibold">{outbound.resolvedCount}</span>
              <span className="text-slate-500"> / {outbound.totalRecipients}件</span>
              {outbound.unresolvedCount > 0 && (
                <p className="text-yellow-600 text-xs mt-1">
                  未解決: {outbound.unresolvedCount}件
                </p>
              )}
            </div>
          </TableCell>
          <TableCell>
            <span className="text-sm">
              {outbound.deliveryStatus === 'sent' ? (
                formatDate(outbound.sentDate)
              ) : outbound.deliveryStatus === 'scheduled' ? (
                <span className="text-blue-600">
                  {formatDate(outbound.scheduledDate)}
                </span>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </span>
          </TableCell>
          <TableCell>
            {outbound.deliveryStatus === 'sent' && outbound.reaction && (
              <div className="text-xs space-y-1">
                <div>Open: {outbound.reaction.openRate}%</div>
                <div>Click: {outbound.reaction.clickRate}%</div>
              </div>
            )}
          </TableCell>
          <TableCell>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                if (outbound.deliveryStatus === 'draft' || outbound.deliveryStatus === 'scheduled') {
                  navigate(`/outbound/editor/${outbound.id}`);
                } else {
                  navigate(`/outbound/results/${outbound.id}`);
                }
              }}
            >
              {outbound.deliveryStatus === 'sent' || outbound.deliveryStatus === 'failed' ? 'Results' : '編集'}
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

### 4-2. Outbound Create / Compose（新規作成画面）

#### 画面形式
フルページ（`/outbound/compose`）

#### 入力項目

##### 基本項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Outbound Name** | text input | ✓ | なし（Source contextから提案） | Outbound名（最大200文字） |
| **Channel** | select | ✓ | Source contextに応じて推奨 | `email` / `slack` |
| **Audience Scope** | select | ✓ | Source contextに応じて自動設定 | `company` / `project` / `user` |
| **Source Context** | display only | - | 自動設定 | 起票元（Actions / Content / Audience / Project など） |
| **Owner** | select | ✓ | 現在のユーザー | 担当者 |

##### 文脈項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Linked Company** | select | - | Source contextから引き継ぎ | 関連Company |
| **Linked Project** | select | - | Source contextから引き継ぎ | 関連Project |
| **Linked User** | multi-select | - | Source contextから引き継ぎ | 関連User |
| **Linked Action** | select | - | Source contextから引き継ぎ | 元になったAction |
| **Linked Content** | select | - | Source contextから引き継ぎ | 元になったContent |
| **Linked Evidence** | multi-select | - | Source contextから引き継ぎ | 関連Evidence |
| **Linked Audience** | select | - | Source contextから引き継ぎ | 元になったAudience |

##### Audience/Delivery Scope項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Audience Conditions** | complex | - | Audienceから引き継ぎ | Audience条件（Audience Workspaceで設定） |
| **Resolved Recipients** | list | - | Audience/条件から計算 | 送信先確定リスト |
| **Unresolved Recipients** | list | - | 自動検出 | 送信先未確定リスト（警告表示） |
| **Target Count** | number | - | 自動計算 | 対象件数 |

##### 本文項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Subject** | text input | ✓（emailの場合） | Content/Templateから引き継ぎ | 件名 |
| **Body** | Rich Text Editor | ✓ | Content/Templateから引き継ぎ | 本文 |
| **Template** | select | - | Content/Templateから引き継ぎ | 使用Template |
| **Variables** | key-value pairs | - | Templateから引き継ぎ | 変数値 |

##### レビュー・承認項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Review State** | select | - | `not_required` | `not_required` / `review_required` / `approved` / `rejected` |
| **Reviewer** | select | - | なし | レビュアー |
| **Review Notes** | textarea | - | なし | レビューコメント |

#### UI補助機能

**Source Context表示**:
```tsx
{sourceContext && (
  <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
    <div className="flex items-center gap-2 mb-2">
      <Info className="w-5 h-5 text-blue-600" />
      <span className="text-sm font-semibold text-blue-900">
        {sourceContext}から作成
      </span>
    </div>
    <div className="text-sm text-blue-700 space-y-1">
      {linkedAction && <p>• Action: {linkedAction.title}</p>}
      {linkedContent && <p>• Content: {linkedContent.title}</p>}
      {linkedAudience && <p>• Audience: {linkedAudience.name} ({linkedAudience.targetCount}件)</p>}
    </div>
  </div>
)}
```

**Recipient Preview**:
```tsx
<div className="border rounded p-4">
  <div className="flex items-center justify-between mb-3">
    <Label className="text-base font-semibold">送信対象</Label>
    <Link to={`/audience?returnTo=/outbound/compose&edit=${audienceId}`}>
      <Button variant="outline" size="sm">
        <Edit3 className="w-3 h-3 mr-1" />
        送信対象を調整
      </Button>
    </Link>
  </div>
  
  <div className="grid grid-cols-3 gap-4 mb-4">
    <div className="text-center p-3 bg-slate-50 rounded">
      <p className="text-xs text-slate-600">確定</p>
      <p className="text-2xl font-bold text-green-600">{resolvedCount}件</p>
    </div>
    
    <div className="text-center p-3 bg-slate-50 rounded">
      <p className="text-xs text-slate-600">全体</p>
      <p className="text-2xl font-bold text-blue-600">{totalRecipients}件</p>
    </div>
    
    <div className="text-center p-3 bg-yellow-50 rounded">
      <p className="text-xs text-slate-600">未解決</p>
      <p className="text-2xl font-bold text-yellow-600">{unresolvedCount}件</p>
    </div>
  </div>
  
  {unresolvedCount > 0 && (
    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        <span className="text-sm font-medium text-yellow-900">
          {unresolvedCount}件の送信先が未解決です
        </span>
      </div>
      <div className="text-xs text-yellow-700">
        <p>未解決の理由:</p>
        <ul className="list-disc list-inside mt-1">
          <li>Emailアドレスが未登録: {unresolvedReasons.noEmail}件</li>
          <li>無効なEmailアドレス: {unresolvedReasons.invalidEmail}件</li>
          <li>配信停止設定: {unresolvedReasons.optedOut}件</li>
        </ul>
      </div>
    </div>
  )}
  
  <div className="mt-4">
    <Label className="text-sm">代表対象（上位5件）</Label>
    <div className="border rounded mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resolvedRecipients.slice(0, 5).map(recipient => (
            <TableRow key={recipient.id}>
              <TableCell>{recipient.name}</TableCell>
              <TableCell>{recipient.email}</TableCell>
              <TableCell>{recipient.company}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
</div>
```

**Unresolved Preview**:
```tsx
{unresolvedRecipients.length > 0 && (
  <div className="border border-yellow-300 rounded p-4 bg-yellow-50">
    <Label className="text-base font-semibold text-yellow-900">
      未解決の送信先 ({unresolvedRecipients.length}件)
    </Label>
    <div className="mt-3 max-h-[200px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>理由</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {unresolvedRecipients.map(recipient => (
            <TableRow key={recipient.id}>
              <TableCell>{recipient.name}</TableCell>
              <TableCell>
                <Badge variant="warning">{getUnresolvedReason(recipient)}</Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => fixRecipient(recipient.id)}>
                  修正
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
)}
```

**Variables入力UI**（Contentと同じ）

**Sample Output**（Contentと同じ）

#### 新規作成画面UI
```tsx
<div className="flex h-screen">
  <SidebarNav />
  <div className="flex-1 flex flex-col">
    <GlobalHeader />
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Outbound作成</h1>
            <p className="text-sm text-slate-600 mt-1">
              顧客向け送信を準備します
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveDraft}>
              下書き保存
            </Button>
            <Button variant="outline" onClick={requestReview}>
              レビュー依頼
            </Button>
            {reviewState === 'approved' && (
              <Button className="bg-red-600" onClick={() => setShowSendConfirm(true)}>
                <Send className="w-4 h-4 mr-2" />
                送信実行
              </Button>
            )}
          </div>
        </div>
        
        {/* Source Context表示 */}
        {sourceContext && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            {/* ... */}
          </div>
        )}
        
        <form className="space-y-6">
          {/* 基本情報 */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">基本情報</h2>
            
            <div>
              <Label>Outbound Name *</Label>
              <Input 
                value={outboundName} 
                onChange={e => setOutboundName(e.target.value)}
                placeholder="例: Q1キャンペーン送信"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>
          
          {/* 送信対象 */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">送信対象</h2>
            
            {/* Recipient Preview */}
            {/* ... */}
            
            {/* Unresolved Preview */}
            {/* ... */}
          </div>
          
          {/* 本文 */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">本文</h2>
            
            {channel === 'email' && (
              <div>
                <Label>Subject *</Label>
                <Input 
                  value={subject} 
                  onChange={e => setSubject(e.target.value)}
                  placeholder="件名"
                />
              </div>
            )}
            
            <div>
              <Label>Body *</Label>
              <RichTextEditor 
                value={body} 
                onChange={setBody}
                placeholder="本文を入力してください"
              />
            </div>
            
            {/* Variables */}
            {variables.length > 0 && (
              <div className="space-y-3">
                <Label>Variables</Label>
                {variables.map((v, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <Label className="text-sm">{v.label}</Label>
                    <p className="text-xs text-slate-500 mb-2">{v.description}</p>
                    <Input 
                      value={v.value} 
                      onChange={e => updateVariable(idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Preview */}
            <div>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="w-3 h-3 mr-1" />
                プレビュー
              </Button>
            </div>
          </div>
          
          {/* 関連文脈 */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">関連文脈</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Linked Company</Label>
                {linkedCompany ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Link to={`/company/${linkedCompanyId}`} className="text-blue-600 hover:underline">
                      {linkedCompany}
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setLinkedCompany(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Select value={linkedCompany} onValueChange={setLinkedCompany}>
                    <SelectTrigger><SelectValue placeholder="Company選択" /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div>
                <Label>Linked Project</Label>
                {linkedProject ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Link to={`/project/${linkedProjectId}`} className="text-blue-600 hover:underline">
                      {linkedProject}
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setLinkedProject(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Select value={linkedProject} onValueChange={setLinkedProject}>
                    <SelectTrigger><SelectValue placeholder="Project選択" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          
          {/* レビュー・承認 */}
          {reviewState !== 'not_required' && (
            <div className="bg-white border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold">レビュー・承認</h2>
              
              <div>
                <Label>Review State</Label>
                <Badge variant={getReviewVariant(reviewState)}>
                  {getReviewLabel(reviewState)}
                </Badge>
              </div>
              
              {reviewState === 'review_required' && (
                <div>
                  <Label>Reviewer</Label>
                  <Select value={reviewer} onValueChange={setReviewer}>
                    <SelectTrigger><SelectValue placeholder="Reviewer選択" /></SelectTrigger>
                    <SelectContent>
                      {reviewers.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {reviewNotes && (
                <div>
                  <Label>Review Notes</Label>
                  <div className="border rounded p-3 bg-slate-50 text-sm">
                    {reviewNotes}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  </div>
</div>

{/* 送信確認モーダル */}
<Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>送信実行の確認</DialogTitle>
      <DialogDescription>
        以下の内容で送信を実行します。よろしいですか？
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-3">
      <div className="border rounded p-3 bg-slate-50">
        <p className="text-sm text-slate-600">送信先件数</p>
        <p className="text-2xl font-bold">{resolvedCount}件</p>
      </div>
      
      {unresolvedCount > 0 && (
        <div className="border border-yellow-300 rounded p-3 bg-yellow-50">
          <p className="text-sm text-yellow-900 font-medium">
            ⚠️ {unresolvedCount}件の未解決がありますが、確定分のみ送信します
          </p>
        </div>
      )}
      
      <div className="text-sm text-slate-700">
        <p>件名: {subject}</p>
        <p>Channel: {channel}</p>
        <p>Scope: {audienceScope}</p>
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowSendConfirm(false)}>
        キャンセル
      </Button>
      <Button className="bg-red-600" onClick={executeSend}>
        送信実行
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 4-3. Outbound Edit（編集画面）

Outbound Editは実質的に Outbound Compose と同じ画面を使用します。

#### 画面形式
フルページ（`/outbound/editor/:id`）

#### 編集で見せるもの

Outbound Composeと同じ項目を表示し、以下の点が異なります：

| 差分 | 説明 |
|------|------|
| **既存値の表示** | 全ての項目に既存値が入力済み |
| **Delivery Status表示** | 現在の配信状態を表示 |
| **Review State表示** | レビュー状態を表示 |
| **送信済みの場合** | `/outbound/results/:id` にリダイレクト |

#### 編集でできること

| アクション | 説明 | UI |
|-----------|------|-----|
| **Composeで編集** | 本文・対象を編集 | Compose画面そのもの |
| **条件確認** | Audience条件を確認 | Audience Workspace遷移 |
| **下書き保存** | 変更を下書き保存 | ボタン |
| **Review依頼** | Review Stateを変更 | ボタン |
| **送信実行** | 最終送信（review approved時のみ） | ボタン（危険色） |
| **保存** | 変更を保存 | ボタン |

重要:
- **最終送信実行は Compose 側で行う**
- **一覧や軽い編集画面では送信完結しない**

---

## 5. Library

### 5-1. Library List（一覧画面）

#### 最低限表示すべきカラム

| カラム名 | データ型 | 表示形式 | 説明 |
|---------|---------|---------|------|
| **Category** | badge | `Template` / `Playbook` / `Knowledge` / `Asset` | 種別 |
| **Status** | badge | `draft` / `review_required` / `approved` | 状態 |
| **Title** | text | 最大60文字表示 | 資産名（クリックで詳細Sheet） |
| **Type** | badge | `external` / `internal` | 用途（Templateのみ） |
| **Applicable Scope** | badge | `Company` / `Project` / `User` | 適用範囲 |
| **Tags** | badges | タグ一覧 | タグ |
| **Owner** | text | ユーザー名 | 担当者 |
| **Linked Context** | icons | 🔗 | Linked evidence/action/content有無 |
| **Updated At** | date | `3日前` | 最終更新 |
| **Reusable** | icon | ✓ / - | 再利用可能フラグ |
| **Actions** | buttons | 詳細を見る | 操作ボタン |

#### 一覧画面で見たいこと
- **何の資産か**: Title + Category
- **どこで使えるか**: Applicable Scope + Type
- **どの文脈から生まれたか**: Linked Context
- **今使えるか**: Status + Reusable Flag

#### フィルタ・ソート
- **フィルタ**:
  - Category別（Template / Playbook / Knowledge / Asset）
  - Status別（draft / review_required / approved）
  - Type別（external / internal、Templateのみ）
  - Applicable Scope別（Company / Project / User）
  - Tags別
  - Owner別
  - Linked Context あり/なし
- **ソート**:
  - Updated At（新しい順/古い順）
  - Title（昇順/降順）
  - Category（種別順）

#### 一覧画面のUI
```tsx
<div className="space-y-4">
  <div className="flex gap-2">
    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Categories</SelectItem>
        <SelectItem value="Template">Template</SelectItem>
        <SelectItem value="Playbook">Playbook</SelectItem>
        <SelectItem value="Knowledge">Knowledge</SelectItem>
        <SelectItem value="Asset">Asset</SelectItem>
      </SelectContent>
    </Select>
    
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="review_required">Review Required</SelectItem>
        <SelectItem value="approved">Approved</SelectItem>
      </SelectContent>
    </Select>
    
    <Input 
      placeholder="Search library..." 
      value={searchQuery} 
      onChange={e => setSearchQuery(e.target.value)}
      className="flex-1"
    />
  </div>
  
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Category</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Title</TableHead>
        <TableHead>Type/Scope</TableHead>
        <TableHead>Tags</TableHead>
        <TableHead>Owner</TableHead>
        <TableHead>Context</TableHead>
        <TableHead>Updated</TableHead>
        <TableHead></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {filteredLibraryItems.map(item => (
        <TableRow key={item.id}>
          <TableCell>
            <Badge variant={getCategoryVariant(item.category)}>
              {item.category}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant={getStatusVariant(item.status)}>
              {item.status}
            </Badge>
          </TableCell>
          <TableCell>
            <button 
              onClick={() => openDetail(item.id)}
              className="text-left hover:underline"
            >
              <div className="font-medium">{item.title}</div>
              {item.reusableFlag && (
                <Badge variant="outline" className="mt-1">再利用可</Badge>
              )}
            </button>
          </TableCell>
          <TableCell>
            <div className="space-y-1">
              {item.type && (
                <Badge variant="outline">{item.type}</Badge>
              )}
              {item.applicableScope && (
                <Badge variant="secondary">{item.applicableScope}</Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 2).map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{item.tags.length - 2}
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell>{item.owner}</TableCell>
          <TableCell>
            <div className="flex gap-1">
              {item.linkedEvidence && item.linkedEvidence.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  🔗 Ev
                </Badge>
              )}
              {item.linkedAction && (
                <Badge variant="outline" className="text-xs">
                  🔗 Ac
                </Badge>
              )}
              {item.linkedContent && (
                <Badge variant="outline" className="text-xs">
                  🔗 Co
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell>
            <span className="text-sm text-slate-600">{formatDate(item.updatedAt)}</span>
          </TableCell>
          <TableCell>
            <Button size="sm" variant="outline" onClick={() => openDetail(item.id)}>
              詳細
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

### 5-2. Library Create（新規作成ドロワー）

#### 画面形式
ステップ1: Modal（種別選択）
ステップ2-4: Sheet（作成フォーム、幅800px）

#### ステップ1: 種別選択モーダル

```tsx
<Dialog open={showTypeSelectModal} onOpenChange={setShowTypeSelectModal}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Library資産の種別を選択</DialogTitle>
      <DialogDescription>
        作成する再利用資産の種別を選択してください
      </DialogDescription>
    </DialogHeader>
    
    <div className="grid grid-cols-2 gap-4 py-4">
      <Button 
        variant="outline" 
        className="h-32 flex flex-col items-center justify-center gap-3"
        onClick={() => handleTypeSelect('template')}
      >
        <FileText className="w-12 h-12 text-blue-600" />
        <div className="text-center">
          <p className="font-semibold">Template</p>
          <p className="text-xs text-slate-500">文面テンプレート</p>
        </div>
      </Button>
      
      <Button 
        variant="outline" 
        className="h-32 flex flex-col items-center justify-center gap-3"
        onClick={() => handleTypeSelect('playbook')}
      >
        <Target className="w-12 h-12 text-green-600" />
        <div className="text-center">
          <p className="font-semibold">Playbook</p>
          <p className="text-xs text-slate-500">業務手順</p>
        </div>
      </Button>
      
      <Button 
        variant="outline" 
        className="h-32 flex flex-col items-center justify-center gap-3"
        onClick={() => handleTypeSelect('knowledge')}
      >
        <Sparkles className="w-12 h-12 text-purple-600" />
        <div className="text-center">
          <p className="font-semibold">Knowledge</p>
          <p className="text-xs text-slate-500">知見・ベストプラクティス</p>
        </div>
      </Button>
      
      <Button 
        variant="outline" 
        className="h-32 flex flex-col items-center justify-center gap-3"
        onClick={() => handleTypeSelect('asset')}
      >
        <Database className="w-12 h-12 text-orange-600" />
        <div className="text-center">
          <p className="font-semibold">Asset</p>
          <p className="text-xs text-slate-500">ファイル・資料</p>
        </div>
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

#### ステップ2: ソース選択モーダル（任意）

```tsx
<Dialog open={showSourceSelectModal} onOpenChange={setShowSourceSelectModal}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>作成元を選択</DialogTitle>
      <DialogDescription>
        既存の文脈から作成するか、空から作成するか選択してください
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-2 py-4">
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('empty')}
      >
        <Plus className="w-4 h-4 mr-2" />
        空から作成
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('evidence')}
      >
        <FileText className="w-4 h-4 mr-2" />
        Evidenceから作成
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('action')}
      >
        <Target className="w-4 h-4 mr-2" />
        Actionから作成
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleSourceSelect('content')}
      >
        <FileText className="w-4 h-4 mr-2" />
        Contentから作成
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

#### ステップ3-4: 作成フォーム（種別別）

詳細は `/CREATE_CTA_DESIGN.md` の「Library Create」セクションを参照してください。

ここでは主要な入力項目のみ記載します。

##### Template作成フォーム

**共通項目**: title / description / owner / status / tags / applicable_scope

**Template固有項目**:
- **Channel**: `email` / `slack` / `document`
- **Type**: `external` / `internal`
- **Subject**: 件名
- **Body**: 本文（Rich Text Editor）
- **Variables**: 変数定義（name / label / description / defaultValue / required）
- **Sample Output**: プレビュー

##### Playbook作成フォーム

**共通項目**: title / description / owner / status / tags / applicable_scope

**Playbook固有項目**:
- **Trigger Condition**: トリガー条件
- **Recommended Steps**: 推奨手順（配列）
  - Step Name
  - Step Description
  - Recommended Action
  - Checkpoint
- **Escalation Rule**: エスカレーション条件
- **Evidence Requirement**: 必要なEvidence

##### Knowledge作成フォーム

**共通項目**: title / description / owner / status / tags / applicable_scope

**Knowledge固有項目**:
- **Summary**: 要約
- **Body**: 本文（Rich Text Editor）
- **Recommendation**: 推奨事項
- **Reusable Insight Flag**: 再利用可能な知見フラグ
- **Related Playbooks**: 関連Playbook（multi-select）
- **Related Templates**: 関連Template（multi-select）

##### Asset作成フォーム

**共通項目**: title / description / owner / status / tags / applicable_scope

**Asset固有項目**:
- **File Upload**: ファイルアップロード（ドラッグ&ドロップ対応）
- **File Type**: `PDF` / `Excel` / `PowerPoint` / `Image` / `Video`
- **Asset Purpose**: 資料の目的
- **Preview**: プレビュー（自動生成）

---

### 5-3. Library Edit（編集画面）

#### 画面形式
Sheet（右側から開く、幅800px）

#### 編集で見せるもの

| セクション | 表示項目 | 編集可能 |
|-----------|---------|---------|
| **基本情報** | Title<br>Category<br>Description<br>Owner<br>Status<br>Tags<br>Applicable Scope | ✓<br>-<br>✓<br>✓<br>✓<br>✓<br>✓ |
| **資産内容** | （種別別の内容） | ✓ |
| **関連文脈** | Linked Company<br>Linked Project<br>Linked Evidence<br>Linked Action<br>Linked Content | ✓<br>✓<br>✓<br>-<br>- |
| **再利用先** | Used In Content一覧<br>Used In Outbound一覧<br>Total Uses | -<br>-<br>- |
| **メタ情報** | Created At<br>Updated At<br>Version | -<br>-<br>✓ |

#### 編集でできること

| アクション | 説明 | UI |
|-----------|------|-----|
| **内容修正** | 資産内容を編集 | 種別別のフォーム |
| **Variables修正** | 変数定義を変更（Templateのみ） | Variables設定UI |
| **適用範囲修正** | Applicable Scopeを変更 | Select |
| **Contentに適用** | Content作成画面へ遷移（Templateのみ） | ボタン |
| **Outboundで使う** | Outbound Compose画面へ遷移（Templateのみ） | ボタン |
| **Actionで使う** | Action作成画面へ遷移（Playbookのみ） | ボタン |
| **ダウンロード** | ファイルダウンロード（Assetのみ） | ボタン |
| **共有リンクをコピー** | 共有リンクをクリップボードにコピー（Assetのみ） | ボタン |
| **複製** | 現在の資産を複製 | ボタン |
| **保存** | 変更を保存 | ボタン |
| **削除** | 資産を削除（確認モーダル） | ボタン |

#### 編集Sheet UI（Template例）

```tsx
<Sheet open={editOpen} onOpenChange={setEditOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>{selectedLibraryItem.category}編集</SheetTitle>
      <SheetDescription>
        {selectedLibraryItem.title}
      </SheetDescription>
    </SheetHeader>
    
    <form className="space-y-6 mt-6">
      {/* 基本情報 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">基本情報</h3>
        
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        
        <div>
          <Label>Category</Label>
          <Badge variant="outline">{category}</Badge>
        </div>
        
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Owner</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review_required">Review Required</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label>Tags</Label>
          <MultiSelect 
            options={tagOptions} 
            value={tags} 
            onChange={setTags}
            placeholder="Tags選択"
          />
        </div>
        
        <div>
          <Label>Applicable Scope</Label>
          <Select value={applicableScope} onValueChange={setApplicableScope}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <Separator />
      
      {/* Template固有の内容 */}
      {category === 'Template' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Template内容</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Channel</Label>
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
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          
          <div>
            <Label>Body</Label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>
          
          {/* Variables設定UI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Variables</Label>
              <Button variant="outline" size="sm" onClick={addVariable}>
                <Plus className="w-3 h-3 mr-1" />
                変数を追加
              </Button>
            </div>
            
            {variables.map((v, idx) => (
              <div key={idx} className="border rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">変数 {idx + 1}</Label>
                  <Button variant="ghost" size="sm" onClick={() => removeVariable(idx)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">変数名</Label>
                    <Input 
                      placeholder="例: user_name" 
                      value={v.name} 
                      onChange={e => updateVariable(idx, 'name', e.target.value)} 
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs">表示ラベル</Label>
                    <Input 
                      placeholder="例: ユーザー名" 
                      value={v.label} 
                      onChange={e => updateVariable(idx, 'label', e.target.value)} 
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">説明</Label>
                  <Textarea 
                    placeholder="この変数の説明" 
                    value={v.description} 
                    onChange={e => updateVariable(idx, 'description', e.target.value)} 
                    rows={2}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">デフォルト値</Label>
                    <Input 
                      placeholder="省略可能" 
                      value={v.defaultValue} 
                      onChange={e => updateVariable(idx, 'defaultValue', e.target.value)} 
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 mt-5">
                    <Checkbox 
                      id={`required-${idx}`}
                      checked={v.required} 
                      onCheckedChange={checked => updateVariable(idx, 'required', checked)}
                    />
                    <Label htmlFor={`required-${idx}`} className="text-xs cursor-pointer">
                      必須
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Sample Output */}
          <div>
            <Label>Sample Output</Label>
            <div className="border rounded p-4 bg-slate-50 mt-2">
              <p className="text-xs text-slate-500 mb-2">プレビュー</p>
              <div className="space-y-2">
                <p className="font-semibold">{renderWithVariables(subject)}</p>
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderWithVariables(body) }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      <Separator />
      
      {/* 再利用先 */}
      {(usedInContents.length > 0 || usedInOutbounds.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">再利用先</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <p className="text-sm text-slate-600">使用回数</p>
              <p className="text-2xl font-bold">{totalUses}回</p>
            </div>
            
            <div className="border rounded p-3">
              <p className="text-sm text-slate-600">最終使用日</p>
              <p className="text-lg font-semibold">
                {lastUsed ? formatDate(lastUsed) : '未使用'}
              </p>
            </div>
          </div>
          
          {usedInContents.length > 0 && (
            <div>
              <Label>使用されたContent ({usedInContents.length}件)</Label>
              <div className="border rounded mt-2 divide-y">
                {usedInContents.map(content => (
                  <Link 
                    key={content.id} 
                    to={`/content?id=${content.id}`}
                    className="block p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{content.title}</p>
                        <p className="text-sm text-slate-600">
                          更新日: {formatDate(content.updatedAt)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {usedInOutbounds.length > 0 && (
            <div>
              <Label>使用されたOutbound ({usedInOutbounds.length}件)</Label>
              <div className="border rounded mt-2 divide-y">
                {usedInOutbounds.map(outbound => (
                  <Link 
                    key={outbound.id} 
                    to={`/outbound/results/${outbound.id}`}
                    className="block p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{outbound.name}</p>
                        <p className="text-sm text-slate-600">
                          送信日: {formatDate(outbound.sentDate)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* アクションボタン */}
      <div className="flex gap-2 pt-4">
        <Button type="button" onClick={save} className="bg-blue-600">
          <Save className="w-4 h-4 mr-2" />
          保存
        </Button>
        
        {category === 'Template' && status === 'approved' && (
          <>
            <Link to={`/outbound/compose?fromTemplate=${selectedLibraryItem.id}`}>
              <Button type="button" className="bg-green-600">
                <Send className="w-4 h-4 mr-2" />
                Outboundで使う
              </Button>
            </Link>
            
            <Link to={`/content/create?fromTemplate=${selectedLibraryItem.id}`}>
              <Button type="button" variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Contentで使う
              </Button>
            </Link>
          </>
        )}
        
        {category === 'Playbook' && status === 'approved' && (
          <Link to={`/actions/create?fromPlaybook=${selectedLibraryItem.id}`}>
            <Button type="button" className="bg-green-600">
              <Target className="w-4 h-4 mr-2" />
              Actionで使う
            </Button>
          </Link>
        )}
        
        {category === 'Asset' && (
          <>
            <Button type="button" onClick={downloadAsset}>
              <Download className="w-4 h-4 mr-2" />
              ダウンロード
            </Button>
            
            <Button type="button" variant="outline" onClick={copyShareLink}>
              <LinkIcon className="w-4 h-4 mr-2" />
              共有リンクをコピー
            </Button>
          </>
        )}
        
        <Button type="button" variant="outline" onClick={duplicate}>
          <Copy className="w-4 h-4 mr-2" />
          複製
        </Button>
        
        <Button 
          type="button" 
          variant="outline" 
          className="text-red-600 border-red-300"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          削除
        </Button>
        
        <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
          キャンセル
        </Button>
      </div>
    </form>
  </SheetContent>
</Sheet>
```

---

## まとめ

### 共通ルール

#### 一覧画面
- **比較・選択・把握に必要な最小限のカラムにする**
- **1画面で全部を見せすぎない**
- **一覧で重い編集を始めさせない**

#### 新規作成ドロワー/モーダル
- **最初から空白だけのフォームにしない**
- **基本情報 → 文脈 → 内容/条件 → 保存の順で理解しやすくする**
- **可能ならsource contextを最初に見せる**

#### 編集画面
- **既存設定/既存内容がまず分かる**
- **何が変更可能か分かる**
- **使用先や関連先が見える**
- **保存/複製/適用/Outbound接続などの次導線を持つ**

#### 送信系ルール
- **Actions / Content / Libraryでは送信実行しない**
- **Outbound一覧でも送信完結しない**
- **最終送信実行はComposeのみ**
- **外部送信系CTAはComposeに来るまでは通常色**
- **danger表現は最終送信実行だけ**

### 次のステップ
これらの仕様書を元に、各画面の実装を進めてください。
