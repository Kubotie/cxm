# 画面仕様書：一覧・新規作成・編集

## 1. Audience

### 1-1. Audience List（一覧画面）

#### 最低限表示すべきカラム

| カラム名 | データ型 | 表示形式 | 説明 |
|---------|---------|---------|------|
| **Status** | badge | `draft` / `active` / `archived` | Audienceの状態 |
| **Audience Name** | text | 最大50文字表示 | Audience名（クリックで詳細Sheet） |
| **Description** | text | 最大100文字表示 | 説明（省略表示） |
| **Scope** | badge | `company` / `project` / `user` / `cluster` / `segment` | 対象スコープ |
| **Target Count** | number | `1,234件` | 対象件数（太字強調） |
| **Source Context** | badge | `Project` / `Company` / `Cluster` / `Manual` | 起票元 |
| **Linked Company** | link | 会社名 | 関連Company（クリックで遷移） |
| **Linked Project** | link | プロジェクト名 | 関連Project（クリックで遷移） |
| **Owner** | text | ユーザー名 | 作成者 |
| **Last Used** | date | `2026-03-15` | 最終使用日 |
| **Updated At** | date | `2日前` | 最終更新日 |
| **Reusable** | icon | ✓ / - | 再利用可能フラグ |
| **Actions** | buttons | 詳細を見る / Outboundで使う | 操作ボタン |

#### 一覧画面で見たいこと
- **どんなAudienceか**: Name + Description
- **何件対象か**: Target Count（強調表示）
- **どこから作られたか**: Source Context + Linked entities
- **誰が持っているか**: Owner
- **今使える状態か**: Status + Reusable Flag
- **最近使われているか**: Last Used

#### フィルタ・ソート
- **フィルタ**:
  - Status別（draft / active / archived）
  - Scope別（company / project / user / cluster / segment）
  - Owner別
  - Source Context別
  - Reusable Flagあり/なし
  - Target Count範囲（例: 100件以上）
- **ソート**:
  - Target Count（降順/昇順）
  - Last Used（新しい順/古い順）
  - Updated At（新しい順/古い順）
  - Audience Name（昇順/降順）

#### 一覧画面のUI
```tsx
<div className="space-y-4">
  {/* フィルタ・ソートバー */}
  <div className="flex gap-2">
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="archived">Archived</SelectItem>
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
      placeholder="Search by name..." 
      value={searchQuery} 
      onChange={e => setSearchQuery(e.target.value)}
      className="flex-1"
    />
  </div>
  
  {/* テーブル */}
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Status</TableHead>
        <TableHead>Audience Name</TableHead>
        <TableHead>Scope</TableHead>
        <TableHead>Target Count</TableHead>
        <TableHead>Source</TableHead>
        <TableHead>Company/Project</TableHead>
        <TableHead>Owner</TableHead>
        <TableHead>Last Used</TableHead>
        <TableHead></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {filteredAudiences.map(audience => (
        <TableRow key={audience.id}>
          <TableCell>
            <Badge variant={audience.status === 'active' ? 'default' : 'secondary'}>
              {audience.status}
            </Badge>
          </TableCell>
          <TableCell>
            <button 
              onClick={() => openDetail(audience.id)}
              className="text-left hover:underline"
            >
              <div className="font-medium">{audience.name}</div>
              <div className="text-sm text-slate-500 truncate max-w-[200px]">
                {audience.description}
              </div>
            </button>
            {audience.reusableFlag && (
              <Badge variant="outline" className="ml-2">再利用可</Badge>
            )}
          </TableCell>
          <TableCell>
            <Badge variant="outline">{audience.scope}</Badge>
          </TableCell>
          <TableCell>
            <span className="font-bold text-blue-600">{audience.targetCount}件</span>
          </TableCell>
          <TableCell>
            <Badge variant="secondary">{audience.sourceContext}</Badge>
          </TableCell>
          <TableCell>
            <div className="text-sm">
              {audience.linkedCompany && (
                <Link to={`/company/${audience.linkedCompanyId}`} className="hover:underline">
                  {audience.linkedCompany}
                </Link>
              )}
              {audience.linkedProject && (
                <div className="text-slate-500">
                  <Link to={`/project/${audience.linkedProjectId}`} className="hover:underline">
                    {audience.linkedProject}
                  </Link>
                </div>
              )}
            </div>
          </TableCell>
          <TableCell>{audience.owner}</TableCell>
          <TableCell>
            <span className="text-sm text-slate-600">
              {audience.lastUsed ? formatDate(audience.lastUsed) : '未使用'}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openDetail(audience.id)}>
                詳細
              </Button>
              {audience.status === 'active' && (
                <Link to={`/outbound/compose?fromAudience=${audience.id}`}>
                  <Button size="sm" className="bg-blue-600">
                    <Send className="w-3 h-3 mr-1" />
                    使う
                  </Button>
                </Link>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

### 1-2. Audience Create（新規作成ドロワー）

#### 画面形式
Sheet（右側から開く、幅800px）

#### 入力項目（3ステップ構成）

##### ステップ1: 基本情報

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Audience Name** | text input | ✓ | なし（Source contextから提案） | Audience名（最大100文字） |
| **Description** | textarea | - | なし | 説明（最大500文字） |
| **Audience Scope** | select | ✓ | Source contextに応じて自動設定 | `company` / `project` / `user` / `cluster` / `segment` |
| **Reusable Flag** | checkbox | - | `false` | 再利用可能フラグ |
| **Owner** | select | ✓ | 現在のユーザー | 作成者 |

##### ステップ2: 条件設定

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Linked Company** | select | - | Source contextから引き継ぎ | 関連Company |
| **Linked Project** | select | - | Source contextから引き継ぎ | 関連Project |
| **Linked Cluster** | select | - | Source contextから引き継ぎ | 関連Cluster |
| **Linked Segment** | select | - | なし | 関連Segment |
| **Filters** | 複合UI | ✓ | Source contextから初期条件設定 | 条件定義（後述） |

##### Filters（条件定義）

各Filterは以下の構造：
```typescript
interface Filter {
  field: string;        // 条件対象フィールド
  operator: string;     // 演算子
  value: string | number; // 条件値
}
```

**利用可能なField**:
- `health_score`: Health Score（数値）
- `risk_score`: Risk Score（数値）
- `opportunity_score`: Opportunity Score（数値）
- `l30_active`: L30 Active（数値）
- `user_stage`: User Stage（`Engaged` / `At-Risk` / `Churned`）
- `permission`: Permission（`admin` / `member`）
- `last_active`: Last Active（日付）
- `project_phase`: Project Phase（Phase値）
- `company_plan`: Company Plan（Plan名）
- `company_industry`: Company Industry（業種）

**利用可能なOperator**:
- 数値: `equals` / `not_equals` / `greater_than` / `less_than` / `between`
- 文字列: `equals` / `not_equals` / `contains` / `starts_with`
- 日付: `before` / `after` / `between` / `within_last_n_days`

**Filters UI**:
```tsx
<div className="space-y-3">
  <Label>Audience条件</Label>
  {filters.map((filter, idx) => (
    <div key={idx} className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">条件 {idx + 1}</Label>
        <Button variant="ghost" size="sm" onClick={() => removeFilter(idx)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <Select value={filter.field} onValueChange={val => updateFilter(idx, 'field', val)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="health_score">Health Score</SelectItem>
            <SelectItem value="risk_score">Risk Score</SelectItem>
            <SelectItem value="l30_active">L30 Active</SelectItem>
            <SelectItem value="user_stage">User Stage</SelectItem>
            <SelectItem value="permission">Permission</SelectItem>
            <SelectItem value="last_active">Last Active</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filter.operator} onValueChange={val => updateFilter(idx, 'operator', val)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {getOperatorsForField(filter.field).map(op => (
              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {filter.field && renderValueInput(filter.field, filter.value, val => updateFilter(idx, 'value', val))}
      </div>
    </div>
  ))}
  
  <Button variant="outline" onClick={addFilter}>
    <Plus className="w-4 h-4 mr-2" />
    条件を追加
  </Button>
</div>
```

##### ステップ3: プレビュー・保存

**プレビュー表示**:
- **Target Count**: 条件に一致する対象件数（リアルタイム計算）
- **代表対象（上位10件）**: Table形式で表示
  - User名
  - Email
  - Company
  - Project
  - Last Active
  - User Stage

**保存オプション**:
- **下書き保存**: `status: draft`、再編集可能
- **Audienceとして登録**: `status: active`、`reusable_flag: true`
- **Outboundで使う**: 保存後、`/outbound/compose?fromAudience=${id}`に遷移
- **キャンセル**: 作成中止

#### UI補助機能

**Source Context表示**:
```tsx
{sourceContext && (
  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
    <div className="flex items-center gap-2">
      <Info className="w-4 h-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-900">
        {sourceContext}から作成
      </span>
    </div>
    {linkedProject && (
      <p className="text-sm text-blue-700 mt-1">
        Project: {linkedProject} の文脈を引き継いでいます
      </p>
    )}
  </div>
)}
```

**Conditions Summary**:
```tsx
<div className="bg-slate-50 border rounded p-3">
  <Label className="text-sm font-medium">条件サマリー</Label>
  <ul className="mt-2 space-y-1 text-sm text-slate-700">
    {filters.map((filter, idx) => (
      <li key={idx}>
        • {getFieldLabel(filter.field)} {getOperatorLabel(filter.operator)} {filter.value}
      </li>
    ))}
  </ul>
</div>
```

**Target Preview**:
```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label>対象プレビュー</Label>
    <Button variant="outline" size="sm" onClick={refreshPreview}>
      <RefreshCw className="w-3 h-3 mr-1" />
      更新
    </Button>
  </div>
  
  <div className="text-center py-6 bg-blue-50 rounded">
    <p className="text-sm text-slate-600">対象件数</p>
    <p className="text-4xl font-bold text-blue-600">{targetCount}件</p>
  </div>
  
  <div>
    <Label className="text-sm">代表対象（上位10件）</Label>
    <div className="border rounded mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Last Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sampleRecipients.slice(0, 10).map(recipient => (
            <TableRow key={recipient.id}>
              <TableCell>{recipient.name}</TableCell>
              <TableCell>{recipient.email}</TableCell>
              <TableCell>{recipient.company}</TableCell>
              <TableCell>{formatDate(recipient.lastActive)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
</div>
```

#### 新規作成Sheet全体UI
```tsx
<Sheet open={createOpen} onOpenChange={setCreateOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>新規Audience作成</SheetTitle>
      <SheetDescription>
        対象条件を定義して、送信対象群を作成します
      </SheetDescription>
    </SheetHeader>
    
    {/* Source Context表示 */}
    {sourceContext && (
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            {sourceContext}から作成
          </span>
        </div>
      </div>
    )}
    
    <form className="space-y-6 mt-6">
      {/* ステップ1: 基本情報 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">基本情報</h3>
        
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
            rows={3}
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
        
        <div className="flex items-center gap-2">
          <Checkbox 
            id="reusable" 
            checked={reusableFlag} 
            onCheckedChange={setReusableFlag}
          />
          <Label htmlFor="reusable" className="font-normal cursor-pointer">
            再利用可能なAudienceとして保存する
          </Label>
        </div>
      </div>
      
      <Separator />
      
      {/* ステップ2: 条件設定 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">条件設定</h3>
        
        <div>
          <Label>Linked Company</Label>
          <Select value={linkedCompany} onValueChange={setLinkedCompany}>
            <SelectTrigger><SelectValue placeholder="Company選択" /></SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Linked Project</Label>
          <Select value={linkedProject} onValueChange={setLinkedProject}>
            <SelectTrigger><SelectValue placeholder="Project選択" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filters UI（前述） */}
        {/* ... */}
        
        {/* Conditions Summary */}
        {filters.length > 0 && (
          <div className="bg-slate-50 border rounded p-3">
            <Label className="text-sm font-medium">条件サマリー</Label>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {filters.map((filter, idx) => (
                <li key={idx}>
                  • {getFieldLabel(filter.field)} {getOperatorLabel(filter.operator)} {filter.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <Separator />
      
      {/* ステップ3: プレビュー・保存 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">プレビュー</h3>
        
        {/* Target Preview（前述） */}
        {/* ... */}
      </div>
      
      {/* 保存ボタン */}
      <div className="flex gap-2 pt-4">
        <Button type="button" onClick={saveDraft} variant="outline">
          下書き保存
        </Button>
        <Button type="button" onClick={saveAsAudience} className="bg-green-600">
          Audienceとして登録
        </Button>
        <Link to={`/outbound/compose?fromAudience=${audienceId}`}>
          <Button type="button" className="bg-blue-600">
            <Send className="w-4 h-4 mr-2" />
            Outboundで使う
          </Button>
        </Link>
        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
          キャンセル
        </Button>
      </div>
    </form>
  </SheetContent>
</Sheet>
```

---

### 1-3. Audience Edit（編集画面）

#### 画面形式
Sheet（右側から開く、幅800px）

#### 編集で見せるもの

| セクション | 表示項目 | 編集可能 |
|-----------|---------|---------|
| **基本情報** | Audience Name<br>Description<br>Audience Scope<br>Owner<br>Status<br>Reusable Flag | ✓<br>✓<br>✓<br>-<br>✓<br>✓ |
| **現在の条件** | Linked Company<br>Linked Project<br>Linked Cluster<br>Filters一覧<br>Conditions Summary | ✓<br>✓<br>✓<br>✓<br>（自動生成） |
| **対象情報** | Target Count<br>Resolved Recipients一覧<br>Unresolved Recipients一覧 | -<br>-<br>- |
| **使用履歴** | Linked Outbound一覧<br>Last Used<br>Total Uses | -<br>-<br>- |
| **メタ情報** | Created At<br>Created By<br>Updated At<br>Updated By | -<br>-<br>-<br>- |

#### 編集でできること

| アクション | 説明 | UI |
|-----------|------|-----|
| **条件変更** | Filters追加・編集・削除 | Filter編集UI（新規作成と同じ） |
| **Scope変更** | Audience Scopeを変更 | Select |
| **Description更新** | 説明文を更新 | Textarea |
| **Status変更** | draft ⇔ active ⇔ archived | Select |
| **Reusable Flag変更** | 再利用可能フラグを切り替え | Checkbox |
| **複製** | 現在のAudienceを複製して新規作成 | ボタン |
| **Outboundで使う** | `/outbound/compose?fromAudience=${id}`に遷移 | ボタン |
| **全件Export** | 対象一覧をCSV/Excel出力 | ボタン |
| **保存** | 変更を保存 | ボタン |
| **削除** | Audienceを削除（確認モーダル） | ボタン |

#### 編集Sheet UI
```tsx
<Sheet open={editOpen} onOpenChange={setEditOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Audience編集</SheetTitle>
      <SheetDescription>
        {selectedAudience.name}
      </SheetDescription>
    </SheetHeader>
    
    <form className="space-y-6 mt-6">
      {/* 基本情報 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">基本情報</h3>
        
        <div>
          <Label>Audience Name</Label>
          <Input value={audienceName} onChange={e => setAudienceName(e.target.value)} />
        </div>
        
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Audience Scope</Label>
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
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Checkbox 
            id="reusable-edit" 
            checked={reusableFlag} 
            onCheckedChange={setReusableFlag}
          />
          <Label htmlFor="reusable-edit" className="font-normal cursor-pointer">
            再利用可能なAudienceとして保存する
          </Label>
        </div>
      </div>
      
      <Separator />
      
      {/* 現在の条件 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">現在の条件</h3>
        
        {/* Linked entities */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Linked Company</Label>
            <Select value={linkedCompany} onValueChange={setLinkedCompany}>
              <SelectTrigger><SelectValue placeholder="Company選択" /></SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Linked Project</Label>
            <Select value={linkedProject} onValueChange={setLinkedProject}>
              <SelectTrigger><SelectValue placeholder="Project選択" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Filters（新規作成と同じUI） */}
        {/* ... */}
        
        {/* Conditions Summary */}
        <div className="bg-slate-50 border rounded p-3">
          <Label className="text-sm font-medium">条件サマリー</Label>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {filters.map((filter, idx) => (
              <li key={idx}>
                • {getFieldLabel(filter.field)} {getOperatorLabel(filter.operator)} {filter.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <Separator />
      
      {/* 対象情報 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">対象情報</h3>
        
        <div className="text-center py-6 bg-blue-50 rounded">
          <p className="text-sm text-slate-600">現在の対象件数</p>
          <p className="text-4xl font-bold text-blue-600">{targetCount}件</p>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>対象一覧（上位10件）</Label>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download className="w-3 h-3 mr-1" />
              全件Export
            </Button>
          </div>
          
          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedRecipients.slice(0, 10).map(recipient => (
                  <TableRow key={recipient.id}>
                    <TableCell>{recipient.name}</TableCell>
                    <TableCell>{recipient.email}</TableCell>
                    <TableCell>{recipient.company}</TableCell>
                    <TableCell>{formatDate(recipient.lastActive)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      
      <Separator />
      
      {/* 使用履歴 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">使用履歴</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <p className="text-sm text-slate-600">最終使用日</p>
            <p className="text-lg font-semibold">
              {lastUsed ? formatDate(lastUsed) : '未使用'}
            </p>
          </div>
          
          <div className="border rounded p-3">
            <p className="text-sm text-slate-600">使用回数</p>
            <p className="text-lg font-semibold">{totalUses}回</p>
          </div>
        </div>
        
        <div>
          <Label>使用されたOutbound</Label>
          <div className="border rounded mt-2">
            {usedInOutbounds.length > 0 ? (
              <div className="divide-y">
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
            ) : (
              <p className="p-3 text-sm text-slate-500">まだ使用されていません</p>
            )}
          </div>
        </div>
      </div>
      
      {/* アクションボタン */}
      <div className="flex gap-2 pt-4">
        <Button type="button" onClick={save} className="bg-blue-600">
          <Save className="w-4 h-4 mr-2" />
          保存
        </Button>
        
        {status === 'active' && (
          <Link to={`/outbound/compose?fromAudience=${selectedAudience.id}`}>
            <Button type="button" className="bg-green-600">
              <Send className="w-4 h-4 mr-2" />
              Outboundで使う
            </Button>
          </Link>
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

## 2. Actions

### 2-1. Actions List（一覧画面）

#### 最低限表示すべきカラム

| カラム名 | データ型 | 表示形式 | 説明 |
|---------|---------|---------|------|
| **Status** | badge | `proposed` / `in_progress` / `completed` / `paused` | Action状態 |
| **Priority** | badge | `high` / `medium` / `low` | 優先度（色分け） |
| **Action Title** | text | 最大60文字表示 | Action名（クリックで詳細Sheet） |
| **Action Type** | badge | `send_external` / `send_internal` / `meeting` / `task` / `escalation` | アクション種別 |
| **Owner** | text | ユーザー名 | 担当者 |
| **Due Date** | date | `2026-03-20` | 期限（過ぎたら赤色） |
| **Company** | link | 会社名 | 関連Company |
| **Project** | link | プロジェクト名 | 関連Project |
| **Evidence** | number | `3件` | 関連Evidence件数 |
| **Updated At** | date | `1時間前` | 最終更新 |
| **Flags** | icons | 🚨 / ⏰ | blocked / overdue |
| **Actions** | buttons | 詳細を見る / 完了 / 保留 | 操作ボタン |

#### 一覧画面で見たいこと
- **何をやるのか**: Action Title + Action Type
- **誰が持っているか**: Owner
- **いつまでか**: Due Date（過ぎているものを強調）
- **どの顧客文脈か**: Company + Project
- **詰まっていないか**: Status + Flags（blocked / overdue）
- **根拠はあるか**: Evidence件数

#### フィルタ・ソート
- **フィルタ**:
  - Status別（proposed / in_progress / completed / paused）
  - Priority別（high / medium / low）
  - Action Type別
  - Owner別
  - Company別
  - Project別
  - Overdue（期限切れ）
  - Blocked（ブロック中）
- **ソート**:
  - Due Date（近い順/遠い順）
  - Priority（高い順/低い順）
  - Updated At（新しい順/古い順）
  - Evidence件数（多い順/少ない順）

#### 一覧画面のUI
```tsx
<div className="space-y-4">
  {/* フィルタ・ソートバー */}
  <div className="flex gap-2">
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="proposed">Proposed</SelectItem>
        <SelectItem value="in_progress">In Progress</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="paused">Paused</SelectItem>
      </SelectContent>
    </Select>
    
    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Priority</SelectItem>
        <SelectItem value="high">High</SelectItem>
        <SelectItem value="medium">Medium</SelectItem>
        <SelectItem value="low">Low</SelectItem>
      </SelectContent>
    </Select>
    
    <Select value={ownerFilter} onValueChange={setOwnerFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Owner" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Owners</SelectItem>
        <SelectItem value="me">自分</SelectItem>
        {/* 他のOwner */}
      </SelectContent>
    </Select>
    
    <Input 
      placeholder="Search actions..." 
      value={searchQuery} 
      onChange={e => setSearchQuery(e.target.value)}
      className="flex-1"
    />
  </div>
  
  {/* テーブル */}
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Status</TableHead>
        <TableHead>Priority</TableHead>
        <TableHead>Action Title</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Owner</TableHead>
        <TableHead>Due Date</TableHead>
        <TableHead>Company/Project</TableHead>
        <TableHead>Evidence</TableHead>
        <TableHead></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {filteredActions.map(action => (
        <TableRow key={action.id} className={action.isOverdue ? 'bg-red-50' : ''}>
          <TableCell>
            <Badge variant={getStatusVariant(action.status)}>
              {action.status}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant={getPriorityVariant(action.priority)}>
              {action.priority}
            </Badge>
          </TableCell>
          <TableCell>
            <button 
              onClick={() => openDetail(action.id)}
              className="text-left hover:underline"
            >
              <div className="font-medium">{action.title}</div>
              {action.isBlocked && (
                <Badge variant="destructive" className="mt-1">🚨 Blocked</Badge>
              )}
              {action.isOverdue && (
                <Badge variant="destructive" className="mt-1">⏰ Overdue</Badge>
              )}
            </button>
          </TableCell>
          <TableCell>
            <Badge variant="outline">{getActionTypeLabel(action.actionType)}</Badge>
          </TableCell>
          <TableCell>{action.owner}</TableCell>
          <TableCell>
            <span className={action.isOverdue ? 'text-red-600 font-semibold' : ''}>
              {formatDate(action.dueDate)}
            </span>
          </TableCell>
          <TableCell>
            <div className="text-sm">
              {action.company && (
                <Link to={`/company/${action.companyId}`} className="hover:underline">
                  {action.company}
                </Link>
              )}
              {action.project && (
                <div className="text-slate-500">
                  <Link to={`/project/${action.projectId}`} className="hover:underline">
                    {action.project}
                  </Link>
                </div>
              )}
            </div>
          </TableCell>
          <TableCell>
            <span className="text-sm">{action.evidenceCount}件</span>
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openDetail(action.id)}>
                詳細
              </Button>
              {action.status !== 'completed' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => markCompleted(action.id)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    完了
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markPaused(action.id)}>
                    <PauseCircle className="w-3 h-3 mr-1" />
                    保留
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

### 2-2. Action Create（新規作成ドロワー）

#### 画面形式
Sheet（右側から開く、幅700px）

#### 入力項目

##### 基本項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Title** | text input | ✓ | なし（Source contextから提案） | Action名（最大200文字） |
| **Action Type** | select | ✓ | Source contextに応じて推奨 | `send_external` / `send_internal` / `meeting` / `task` / `escalation` |
| **Purpose** | textarea | ✓ | なし | 目的（最大1000文字） |
| **Priority** | select | ✓ | `medium` | `high` / `medium` / `low` |
| **Owner** | select | ✓ | 現在のユーザー | 担当者 |
| **Due Date** | date picker | ✓ | 1週間後 | 期限 |
| **Status** | select | ✓ | `proposed` | `proposed` / `in_progress` / `completed` / `paused` |

##### 文脈項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Linked Company** | select | - | Source contextから引き継ぎ | 関連Company |
| **Linked Project** | select | - | Source contextから引き継ぎ | 関連Project |
| **Linked User** | multi-select | - | Source contextから引き継ぎ | 関連User |
| **Linked Evidence** | multi-select | - | Source contextから引き継ぎ | 関連Evidence |
| **Linked Action** | select | - | Follow-upの場合のみ | 親Action |
| **Next Step** | textarea | - | なし | 推奨される次の一手 |

#### UI補助機能

**Source Context表示**:
```tsx
{sourceContext && (
  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
    <div className="flex items-center gap-2">
      <Info className="w-4 h-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-900">
        {sourceContext}から作成
      </span>
    </div>
    {linkedEvidence && linkedEvidence.length > 0 && (
      <p className="text-sm text-blue-700 mt-1">
        Evidence {linkedEvidence.length}件の文脈を引き継いでいます
      </p>
    )}
  </div>
)}
```

**Linked Context Summary**:
```tsx
<div className="bg-slate-50 border rounded p-3">
  <Label className="text-sm font-medium">関連文脈</Label>
  <div className="mt-2 space-y-1 text-sm">
    {linkedCompany && (
      <p>• Company: {linkedCompany}</p>
    )}
    {linkedProject && (
      <p>• Project: {linkedProject}</p>
    )}
    {linkedEvidence && linkedEvidence.length > 0 && (
      <p>• Evidence: {linkedEvidence.length}件</p>
    )}
  </div>
</div>
```

**Evidence Summary**:
```tsx
{linkedEvidence && linkedEvidence.length > 0 && (
  <div className="space-y-2">
    <Label className="text-sm">関連Evidence</Label>
    <div className="border rounded divide-y">
      {linkedEvidence.map(ev => (
        <div key={ev.id} className="p-3">
          <p className="font-medium text-sm">{ev.title}</p>
          <p className="text-xs text-slate-500">{ev.date}</p>
          <p className="text-sm text-slate-700 mt-1">{ev.excerpt}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

**Recommended Template/Playbook**:
```tsx
{recommendedPlaybook && (
  <div className="bg-green-50 border border-green-200 rounded p-3">
    <div className="flex items-center gap-2 mb-2">
      <Sparkles className="w-4 h-4 text-green-600" />
      <span className="text-sm font-medium text-green-900">
        推奨Playbook
      </span>
    </div>
    <p className="text-sm text-green-700">{recommendedPlaybook.title}</p>
    <Button 
      size="sm" 
      variant="outline" 
      className="mt-2"
      onClick={() => applyPlaybook(recommendedPlaybook.id)}
    >
      このPlaybookを適用
    </Button>
  </div>
)}
```

#### 新規作成Sheet UI
```tsx
<Sheet open={createOpen} onOpenChange={setCreateOpen}>
  <SheetContent className="w-[700px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>新規Action作成</SheetTitle>
      <SheetDescription>
        {isFollowUp ? 'Follow-up Actionを作成します' : 'やることを定義します'}
      </SheetDescription>
    </SheetHeader>
    
    {/* Source Context表示 */}
    {sourceContext && (
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
        {/* ... */}
      </div>
    )}
    
    <form className="space-y-6 mt-6">
      {/* 基本項目 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">基本情報</h3>
        
        <div>
          <Label>Title *</Label>
          <Input 
            value={title} 
            onChange={e => setTitle(e.target.value)}
            placeholder="例: 決裁者へのフォローアップメール送信"
          />
        </div>
        
        <div>
          <Label>Action Type *</Label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Label>Purpose *</Label>
          <Textarea 
            value={purpose} 
            onChange={e => setPurpose(e.target.value)}
            placeholder="このActionの目的"
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Priority *</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Owner *</Label>
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
            <Label>Due Date *</Label>
            <DatePicker value={dueDate} onChange={setDueDate} />
          </div>
        </div>
      </div>
      
      <Separator />
      
      {/* 文脈項目 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">関連文脈</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Linked Company</Label>
            <Select value={linkedCompany} onValueChange={setLinkedCompany}>
              <SelectTrigger><SelectValue placeholder="Company選択" /></SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Linked Project</Label>
            <Select value={linkedProject} onValueChange={setLinkedProject}>
              <SelectTrigger><SelectValue placeholder="Project選択" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label>Linked Evidence</Label>
          <MultiSelect 
            options={evidences} 
            value={linkedEvidence} 
            onChange={setLinkedEvidence}
            placeholder="Evidence選択"
          />
        </div>
        
        <div>
          <Label>Next Step</Label>
          <Textarea 
            value={nextStep} 
            onChange={e => setNextStep(e.target.value)}
            placeholder="推奨される次の一手"
            rows={3}
          />
        </div>
        
        {/* Linked Context Summary */}
        {(linkedCompany || linkedProject || linkedEvidence.length > 0) && (
          <div className="bg-slate-50 border rounded p-3">
            {/* ... */}
          </div>
        )}
        
        {/* Evidence Summary */}
        {linkedEvidence.length > 0 && (
          <div className="space-y-2">
            {/* ... */}
          </div>
        )}
      </div>
      
      {/* Recommended Playbook */}
      {recommendedPlaybook && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          {/* ... */}
        </div>
      )}
      
      {/* 保存ボタン */}
      <div className="flex gap-2 pt-4">
        <Button type="button" onClick={createAction} className="bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Actionを作成
        </Button>
        
        {isFollowUp && (
          <Button type="button" onClick={createAsFollowUp} className="bg-green-600">
            Follow-upとして作成
          </Button>
        )}
        
        <Button type="button" variant="outline" onClick={saveDraft}>
          下書き保存
        </Button>
        
        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
          キャンセル
        </Button>
      </div>
    </form>
  </SheetContent>
</Sheet>
```

---

### 2-3. Action Edit（編集画面）

#### 画面形式
Sheet（右側から開く、幅700px）

#### 編集で見せるもの

| セクション | 表示項目 | 編集可能 |
|-----------|---------|---------|
| **基本情報** | Title<br>Action Type<br>Purpose<br>Priority<br>Owner<br>Due Date<br>Status | ✓<br>✓<br>✓<br>✓<br>✓<br>✓<br>✓ |
| **関連文脈** | Linked Company<br>Linked Project<br>Linked User<br>Linked Evidence<br>Linked Action（親） | ✓<br>✓<br>✓<br>✓<br>- |
| **次アクション** | Next Step<br>Recommended Template<br>Linked Outbound | ✓<br>-<br>- |
| **Status履歴** | Status変更履歴<br>Owner変更履歴<br>Priority変更履歴 | -<br>-<br>- |
| **メタ情報** | Created At<br>Created By<br>Updated At<br>Updated By<br>Source Type（AI/manual） | -<br>-<br>-<br>-<br>- |

#### 編集でできること

| アクション | 説明 | UI |
|-----------|------|-----|
| **Title修正** | Action名を変更 | Input |
| **Status変更** | proposed → in_progress → completed / paused | Select |
| **Owner変更** | 担当者を変更 | Select |
| **Due変更** | 期限を変更 | DatePicker |
| **Priority変更** | 優先度を変更 | Select |
| **保留** | Statusを`paused`に変更 | ボタン |
| **完了** | Statusを`completed`に変更 | ボタン |
| **再設定** | StatusをリセットしてDue延長 | ボタン |
| **Outbound起票** | `/outbound/compose?fromAction=${id}`に遷移 | ボタン |
| **Follow-up作成** | 新規Action作成Sheetを開く | ボタン |
| **Playbook化** | Library/Playbook作成Drawerを開く | ボタン |
| **保存** | 変更を保存 | ボタン |
| **削除** | Actionを削除（確認モーダル） | ボタン |

#### 編集Sheet UI
```tsx
<Sheet open={editOpen} onOpenChange={setEditOpen}>
  <SheetContent className="w-[700px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Action編集</SheetTitle>
      <SheetDescription>
        {selectedAction.title}
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
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Action Type</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proposed">Proposed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label>Purpose</Label>
          <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={3} />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
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
            <Label>Due Date</Label>
            <DatePicker value={dueDate} onChange={setDueDate} />
          </div>
        </div>
      </div>
      
      <Separator />
      
      {/* 関連文脈 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">関連文脈</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Linked Company</Label>
            <div className="flex items-center gap-2">
              {linkedCompany ? (
                <>
                  <Link to={`/company/${linkedCompanyId}`} className="text-blue-600 hover:underline flex-1">
                    {linkedCompany}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => setLinkedCompany(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </>
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
          </div>
          
          <div>
            <Label>Linked Project</Label>
            <div className="flex items-center gap-2">
              {linkedProject ? (
                <>
                  <Link to={`/project/${linkedProjectId}`} className="text-blue-600 hover:underline flex-1">
                    {linkedProject}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => setLinkedProject(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </>
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
        
        <div>
          <Label>Linked Evidence ({linkedEvidence.length}件)</Label>
          <div className="border rounded mt-2 divide-y">
            {linkedEvidence.map(ev => (
              <div key={ev.id} className="p-3 flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm">{ev.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(ev.date)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => unlinkEvidence(ev.id)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <div className="p-3">
              <Button variant="outline" size="sm" onClick={() => setShowEvidenceSelector(true)}>
                <Plus className="w-3 h-3 mr-1" />
                Evidence追加
              </Button>
            </div>
          </div>
        </div>
        
        <div>
          <Label>Next Step</Label>
          <Textarea value={nextStep} onChange={e => setNextStep(e.target.value)} rows={3} />
        </div>
      </div>
      
      <Separator />
      
      {/* Status履歴 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">変更履歴</h3>
        
        <div className="border rounded">
          <div className="p-3 space-y-2">
            {statusHistory.map((history, idx) => (
              <div key={idx} className="text-sm">
                <span className="text-slate-500">{formatDateTime(history.timestamp)}</span>
                <span className="mx-2">•</span>
                <span className="font-medium">{history.user}</span>
                <span className="mx-2">が</span>
                <span className="font-medium">{history.field}</span>
                <span className="mx-2">を</span>
                <Badge variant="outline">{history.oldValue}</Badge>
                <span className="mx-2">→</span>
                <Badge variant="outline">{history.newValue}</Badge>
                <span className="mx-2">に変更</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <Separator />
      
      {/* Linked Outbound */}
      {linkedOutbound && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">関連Outbound</h3>
          
          <div className="border rounded p-3">
            <Link to={`/outbound/results/${linkedOutbound.id}`} className="flex items-center justify-between hover:bg-slate-50 p-2 rounded">
              <div>
                <p className="font-medium">{linkedOutbound.name}</p>
                <p className="text-sm text-slate-600">
                  送信日: {formatDate(linkedOutbound.sentDate)} • {linkedOutbound.deliveryStatus}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>
      )}
      
      {/* アクションボタン */}
      <div className="flex gap-2 pt-4">
        <Button type="button" onClick={save} className="bg-blue-600">
          <Save className="w-4 h-4 mr-2" />
          保存
        </Button>
        
        {actionType === 'send_external' && status === 'approved' && (
          <Link to={`/outbound/compose?fromAction=${selectedAction.id}`}>
            <Button type="button" className="bg-green-600">
              <Send className="w-4 h-4 mr-2" />
              Outbound起票
            </Button>
          </Link>
        )}
        
        <Button type="button" variant="outline" onClick={createFollowUp}>
          <Plus className="w-4 h-4 mr-2" />
          Follow-up作成
        </Button>
        
        {status !== 'completed' && (
          <Button type="button" variant="outline" onClick={markCompleted}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            完了
          </Button>
        )}
        
        {status === 'in_progress' && (
          <Button type="button" variant="outline" onClick={markPaused}>
            <PauseCircle className="w-4 h-4 mr-2" />
            保留
          </Button>
        )}
        
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

## 3. Content

### 3-1. Content List（一覧画面）

#### 最低限表示すべきカラム

| カラム名 | データ型 | 表示形式 | 説明 |
|---------|---------|---------|------|
| **Status** | badge | `draft` / `in_review` / `approved` / `completed` | Content状態 |
| **Review State** | badge | `not_required` / `review_required` / `approved` / `rejected` | レビュー状態 |
| **Title** | text | 最大60文字表示 | Content名（クリックで詳細Sheet） |
| **Content Type** | badge | `email` / `document` / `faq` / `guide` / `proposal` | コンテンツ種別 |
| **Purpose** | text | 最大100文字表示 | 目的（省略表示） |
| **Owner** | text | ユーザー名 | 担当者 |
| **Company** | link | 会社名 | 関連Company |
| **Project** | link | プロジェクト名 | 関連Project |
| **Template** | badge | Template名 | 使用Template |
| **Updated At** | date | `2時間前` | 最終更新 |
| **Actions** | buttons | 詳細を見る | 操作ボタン |

#### 一覧画面で見たいこと
- **何のコンテンツか**: Title + Content Type
- **どの文脈のものか**: Company + Project
- **draft か ready か**: Status + Review State
- **誰が作っているか**: Owner
- **テンプレ起点かどうか**: Template有無

#### フィルタ・ソート
- **フィルタ**:
  - Status別
  - Review State別
  - Content Type別
  - Owner別
  - Company別
  - Project別
  - Template使用あり/なし
- **ソート**:
  - Updated At（新しい順/古い順）
  - Title（昇順/降順）

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
        <SelectItem value="in_review">In Review</SelectItem>
        <SelectItem value="approved">Approved</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
      </SelectContent>
    </Select>
    
    <Select value={typeFilter} onValueChange={setTypeFilter}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Types</SelectItem>
        <SelectItem value="email">Email</SelectItem>
        <SelectItem value="document">Document</SelectItem>
        <SelectItem value="faq">FAQ</SelectItem>
        <SelectItem value="guide">Guide</SelectItem>
        <SelectItem value="proposal">Proposal</SelectItem>
      </SelectContent>
    </Select>
    
    <Input 
      placeholder="Search content..." 
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
        <TableHead>Title</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Owner</TableHead>
        <TableHead>Company/Project</TableHead>
        <TableHead>Template</TableHead>
        <TableHead>Updated</TableHead>
        <TableHead></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {filteredContents.map(content => (
        <TableRow key={content.id}>
          <TableCell>
            <Badge variant={getStatusVariant(content.status)}>
              {content.status}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant={getReviewVariant(content.reviewState)}>
              {getReviewLabel(content.reviewState)}
            </Badge>
          </TableCell>
          <TableCell>
            <button 
              onClick={() => openDetail(content.id)}
              className="text-left hover:underline"
            >
              <div className="font-medium">{content.title}</div>
              <div className="text-sm text-slate-500 truncate max-w-[300px]">
                {content.purpose}
              </div>
            </button>
          </TableCell>
          <TableCell>
            <Badge variant="outline">{content.contentType}</Badge>
          </TableCell>
          <TableCell>{content.owner}</TableCell>
          <TableCell>
            <div className="text-sm">
              {content.company && (
                <Link to={`/company/${content.companyId}`} className="hover:underline">
                  {content.company}
                </Link>
              )}
              {content.project && (
                <div className="text-slate-500">
                  <Link to={`/project/${content.projectId}`} className="hover:underline">
                    {content.project}
                  </Link>
                </div>
              )}
            </div>
          </TableCell>
          <TableCell>
            {content.template && (
              <Badge variant="secondary">{content.template}</Badge>
            )}
          </TableCell>
          <TableCell>
            <span className="text-sm text-slate-600">{formatDate(content.updatedAt)}</span>
          </TableCell>
          <TableCell>
            <Button size="sm" variant="outline" onClick={() => openDetail(content.id)}>
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

### 3-2. Content Create（新規作成ドロワー）

#### 画面形式
Sheet（右側から開く、幅800px）

#### 入力項目

##### 基本項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Title** | text input | ✓ | なし（Source contextから提案） | Content名（最大200文字） |
| **Content Type** | select | ✓ | Source contextに応じて推奨 | `email` / `document` / `faq` / `guide` / `proposal` |
| **Purpose** | textarea | ✓ | なし | 目的（最大1000文字） |
| **Channel想定** | select | - | なし | `email` / `slack` / `in_person` / `document` |
| **Owner** | select | ✓ | 現在のユーザー | 担当者 |
| **Review State** | select | ✓ | `not_required` | `not_required` / `review_required` / `approved` / `rejected` |

##### 文脈項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Linked Company** | select | - | Source contextから引き継ぎ | 関連Company |
| **Linked Project** | select | - | Source contextから引き継ぎ | 関連Project |
| **Linked User** | multi-select | - | Source contextから引き継ぎ | 関連User |
| **Linked Evidence** | multi-select | - | Source contextから引き継ぎ | 関連Evidence |
| **Linked Action** | select | - | Source contextから引き継ぎ | 元になったAction |

##### 本文項目

| 項目名 | 入力形式 | 必須 | デフォルト値 | 説明 |
|--------|---------|------|-------------|------|
| **Subject** | text input | - | なし（Templateから引き継ぎ） | 件名（メール/ドキュメントの場合） |
| **Body** | Rich Text Editor | ✓ | なし（Templateから引き継ぎ） | 本文 |
| **Template** | select | - | なし | 使用Template |
| **Variables** | key-value pairs | - | Templateから引き継ぎ | 変数値 |

#### UI補助機能

**Template Preview**:
```tsx
{selectedTemplate && (
  <div className="bg-slate-50 border rounded p-3">
    <div className="flex items-center justify-between mb-2">
      <Label className="text-sm font-medium">Template: {selectedTemplate.title}</Label>
      <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>
        <X className="w-3 h-3" />
      </Button>
    </div>
    
    <div className="text-sm space-y-2">
      <div>
        <p className="text-slate-600">Subject:</p>
        <p className="font-medium">{selectedTemplate.subject}</p>
      </div>
      <div>
        <p className="text-slate-600">Variables: {selectedTemplate.variables.length}件</p>
      </div>
    </div>
    
    <Button variant="outline" size="sm" className="mt-2" onClick={applyTemplate}>
      このTemplateを適用
    </Button>
  </div>
)}
```

**Variables入力UI**:
```tsx
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
          placeholder={v.defaultValue || `${v.name}を入力`}
        />
      </div>
    ))}
  </div>
)}
```

**Sample Output**:
```tsx
{(subject || body) && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label>プレビュー</Label>
      <Button variant="outline" size="sm" onClick={refreshPreview}>
        <RefreshCw className="w-3 h-3 mr-1" />
        更新
      </Button>
    </div>
    
    <div className="border rounded p-4 bg-white">
      {subject && (
        <div className="mb-3">
          <p className="text-xs text-slate-500">Subject:</p>
          <p className="font-semibold">{renderWithVariables(subject)}</p>
        </div>
      )}
      {body && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Body:</p>
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderWithVariables(body) }}
          />
        </div>
      )}
    </div>
  </div>
)}
```

#### 新規作成Sheet UI
```tsx
<Sheet open={createOpen} onOpenChange={setCreateOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>新規Content作成</SheetTitle>
      <SheetDescription>
        文面や資料を作成します
      </SheetDescription>
    </SheetHeader>
    
    {sourceContext && (
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            {sourceContext}から作成
          </span>
        </div>
      </div>
    )}
    
    <form className="space-y-6 mt-6">
      {/* 基本項目 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">基本情報</h3>
        
        <div>
          <Label>Title *</Label>
          <Input 
            value={title} 
            onChange={e => setTitle(e.target.value)}
            placeholder="例: QBR資料（Q1 2026）"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Content Type *</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
                <SelectItem value="guide">Guide</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Channel想定</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="in_person">対面</SelectItem>
                <SelectItem value="document">ドキュメント</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label>Purpose *</Label>
          <Textarea 
            value={purpose} 
            onChange={e => setPurpose(e.target.value)}
            placeholder="このContentの目的"
            rows={3}
          />
        </div>
      </div>
      
      <Separator />
      
      {/* Template選択 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Template（任意）</h3>
        
        <div>
          <Label>Template選択</Label>
          <Select value={templateId} onValueChange={handleTemplateSelect}>
            <SelectTrigger><SelectValue placeholder="Templateを選択（または空から作成）" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">空から作成</SelectItem>
              {templates.filter(t => t.contentType === contentType).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Template Preview */}
        {selectedTemplate && (
          <div className="bg-slate-50 border rounded p-3">
            {/* ... */}
          </div>
        )}
      </div>
      
      <Separator />
      
      {/* 本文項目 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">本文</h3>
        
        {contentType === 'email' && (
          <div>
            <Label>Subject</Label>
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
            {/* ... */}
          </div>
        )}
        
        {/* Sample Output */}
        {(subject || body) && (
          <div className="space-y-3">
            {/* ... */}
          </div>
        )}
      </div>
      
      <Separator />
      
      {/* 文脈項目 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">関連文脈</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Linked Company</Label>
            <Select value={linkedCompany} onValueChange={setLinkedCompany}>
              <SelectTrigger><SelectValue placeholder="Company選択" /></SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Linked Project</Label>
            <Select value={linkedProject} onValueChange={setLinkedProject}>
              <SelectTrigger><SelectValue placeholder="Project選択" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* 保存ボタン */}
      <div className="flex gap-2 pt-4">
        <Button type="button" onClick={createContent} className="bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Contentを作成
        </Button>
        
        <Button type="button" variant="outline" onClick={saveDraft}>
          下書き保存
        </Button>
        
        <Button type="button" variant="outline" onClick={requestReview}>
          レビュー依頼
        </Button>
        
        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
          キャンセル
        </Button>
      </div>
    </form>
  </SheetContent>
</Sheet>
```

---

### 3-3. Content Edit（編集画面）

#### 画面形式
Sheet（右側から開く、幅800px）

#### 編集で見せるもの

| セクション | 表示項目 | 編集可能 |
|-----------|---------|---------|
| **基本情報** | Title<br>Content Type<br>Purpose<br>Channel<br>Owner<br>Status<br>Review State | ✓<br>-<br>✓<br>✓<br>✓<br>✓<br>- |
| **本文** | Subject<br>Body<br>Template<br>Variables | ✓<br>✓<br>-<br>✓ |
| **関連文脈** | Linked Company<br>Linked Project<br>Linked User<br>Linked Evidence<br>Linked Action | ✓<br>✓<br>✓<br>✓<br>- |
| **使用履歴** | Used In Outbound一覧<br>Total Uses | -<br>- |
| **Version履歴** | Version変更履歴<br>変更差分 | -<br>- |

#### 編集でできること

| アクション | 説明 | UI |
|-----------|------|-----|
| **本文修正** | Subject/Bodyを編集 | Input/RichTextEditor |
| **Template変更** | 使用Templateを変更 | Select |
| **Variables修正** | 変数値を変更 | Input |
| **Review依頼** | Review Stateを`review_required`に変更 | ボタン |
| **Outboundで使う** | `/outbound/compose?fromContent=${id}`に遷移 | ボタン |
| **Libraryに登録** | Library/Template作成Drawerを開く | ボタン |
| **プレビュー** | 変数埋め込み後のプレビュー表示 | ボタン |
| **複製** | 現在のContentを複製 | ボタン |
| **保存** | 変更を保存 | ボタン |
| **削除** | Contentを削除（確認モーダル） | ボタン |

#### 編集Sheet UI
```tsx
<Sheet open={editOpen} onOpenChange={setEditOpen}>
  <SheetContent className="w-[800px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Content編集</SheetTitle>
      <SheetDescription>
        {selectedContent.title}
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
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Content Type</Label>
            <Badge variant="outline">{contentType}</Badge>
          </div>
          
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label>Purpose</Label>
          <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={3} />
        </div>
      </div>
      
      <Separator />
      
      {/* 本文 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">本文</h3>
        
        {contentType === 'email' && (
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
        )}
        
        <div>
          <Label>Body</Label>
          <RichTextEditor value={body} onChange={setBody} />
        </div>
        
        {template && (
          <div>
            <Label>使用Template</Label>
            <Badge variant="secondary">{template.title}</Badge>
          </div>
        )}
        
        {/* Variables */}
        {variables.length > 0 && (
          <div className="space-y-3">
            <Label>Variables</Label>
            {variables.map((v, idx) => (
              <div key={idx} className="border rounded p-3">
                <Label className="text-sm">{v.label}</Label>
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
      
      <Separator />
      
      {/* 使用履歴 */}
      {usedInOutbounds.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">使用履歴</h3>
          
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
        </div>
      )}
      
      {/* アクションボタン */}
      <div className="flex gap-2 pt-4">
        <Button type="button" onClick={save} className="bg-blue-600">
          <Save className="w-4 h-4 mr-2" />
          保存
        </Button>
        
        {status === 'approved' && (
          <>
            <Link to={`/outbound/compose?fromContent=${selectedContent.id}`}>
              <Button type="button" className="bg-green-600">
                <Send className="w-4 h-4 mr-2" />
                Outboundで使う
              </Button>
            </Link>
            
            <Button type="button" variant="outline" onClick={registerToLibrary}>
              <Database className="w-4 h-4 mr-2" />
              Libraryに登録
            </Button>
          </>
        )}
        
        {status === 'draft' && (
          <Button type="button" variant="outline" onClick={requestReview}>
            レビュー依頼
          </Button>
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

（続きは次のメッセージで送信します。OutboundとLibraryの詳細仕様を記述します）
