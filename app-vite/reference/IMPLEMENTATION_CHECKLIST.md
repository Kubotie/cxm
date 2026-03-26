# 実装チェックリスト

## Audience機能実装（Phase 1: High Priority）

### 1. Audience List画面（新規作成）

**ファイル**: `/src/app/pages/audience-list.tsx`

- [ ] 一覧画面の作成
  - [ ] Table実装（Name / Scope / Target Count / Owner / Used In / Last Updated）
  - [ ] フィルタ実装（Scope / Status / Owner / Reusable Flag）
  - [ ] ソート実装（Target Count / Last Updated）
  - [ ] 「新規Audience作成」ボタン（→ `/audience`）
  - [ ] 「詳細を見る」ボタン（→ Audience Detail Sheet）
  - [ ] 「Outboundで使う」クイックアクション（→ `/outbound/compose?fromAudience=${id}`）
  - [ ] 「複製」クイックアクション

**データモデル**:
```typescript
interface Audience {
  id: string;
  name: string;
  description: string;
  scope: 'company' | 'project' | 'user' | 'cluster' | 'segment';
  filters: Filter[];
  targetCount: number;
  resolvedRecipients: User[];
  unresolvedRecipients: User[];
  owner: string;
  status: 'draft' | 'active' | 'archived';
  reusableFlag: boolean;
  sourceContext: string;
  linkedCluster?: string;
  linkedSegment?: string;
  linkedCompany?: string;
  linkedProject?: string;
  usedInOutbounds: string[];
  createdAt: string;
  updatedAt: string;
}

interface Filter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string | number;
}
```

**ルート追加**: `/src/app/routes.ts`
```typescript
{
  path: "audience/list",
  Component: AudienceList,
},
```

---

### 2. Audience Detail Sheet（新規作成）

**ファイル**: `/src/app/components/audience/audience-detail-sheet.tsx`

- [ ] Sheet実装
  - [ ] 基本情報表示（Name / Description / Scope / Target Count）
  - [ ] Audience条件表示（Filters一覧）
  - [ ] 代表対象表示（上位10件のTable）
  - [ ] リンク情報表示（Linked entities）
  - [ ] 使用履歴表示（Used in Outbounds）
  - [ ] 「Outboundで使う」ボタン（→ `/outbound/compose?fromAudience=${id}`）
  - [ ] 「編集」ボタン（→ `/audience?edit=${id}`）
  - [ ] 「複製」ボタン
  - [ ] 「全件Export」ボタン（CSV/Excel出力）
  - [ ] 「アーカイブ」ボタン
  - [ ] 「削除」ボタン

**State管理**:
```typescript
const [selectedAudience, setSelectedAudience] = useState<Audience | null>(null);
const [detailOpen, setDetailOpen] = useState(false);

const openDetail = (audienceId: string) => {
  const audience = audiences.find(a => a.id === audienceId);
  setSelectedAudience(audience);
  setDetailOpen(true);
};
```

---

### 3. Audience Builder拡張（既存画面の強化）

**ファイル**: `/src/app/pages/audience.tsx`

#### 現在の状態
- Audience Workspaceとして実装済み
- User選択・フィルタ機能あり
- クラスター情報表示あり

#### 追加機能
- [ ] 基本情報入力フォーム
  - [ ] Audience Name入力
  - [ ] Description入力
  - [ ] Audience Scope選択
  - [ ] Reusable Flag チェックボックス
  - [ ] Owner選択

- [ ] 保存・登録機能
  - [ ] 「下書き保存」ボタン（status: draft）
  - [ ] 「Audienceとして登録」ボタン（status: active, reusable: true）
  - [ ] 「Outboundで使う」ボタン（→ `/outbound/compose?fromAudience=${id}`）

- [ ] Source context引き継ぎ
  - [ ] `?fromProject=${projectId}` → Project文脈引き継ぎ
  - [ ] `?fromCompany=${companyId}` → Company文脈引き継ぎ
  - [ ] `?fromCluster=${clusterId}` → Cluster文脈引き継ぎ
  - [ ] `?edit=${audienceId}` → 編集モード

- [ ] ViewMode切り替え
  - [ ] 「新規作成」モード（create）
  - [ ] 「保存済みAudience」モード（saved）→ Audience List表示

**State追加**:
```typescript
const [audienceName, setAudienceName] = useState('');
const [audienceDescription, setAudienceDescription] = useState('');
const [reusableFlag, setReusableFlag] = useState(false);
const [viewMode, setViewMode] = useState<'create' | 'saved'>('create');

// Source context取得
const [searchParams] = useSearchParams();
const fromProject = searchParams.get('fromProject');
const fromCompany = searchParams.get('fromCompany');
const fromCluster = searchParams.get('fromCluster');
const editId = searchParams.get('edit');
```

---

### 4. Project → Audience導線

**ファイル**: `/src/app/pages/project.tsx`

- [ ] 「Audience作成」ボタン追加
  - [ ] 配置: Project画面の適切な位置（例: User一覧の上部）
  - [ ] Link: `/audience?fromProject=${projectId}`
  - [ ] ラベル: 「Audience作成」

**UI例**:
```tsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold">Users</h2>
  <Link to={`/audience?fromProject=${projectId}`}>
    <Button size="sm">
      <Users className="w-4 h-4 mr-2" />
      Audience作成
    </Button>
  </Link>
</div>
```

---

### 5. Company → Audience導線

**ファイル**: `/src/app/pages/company-detail.tsx`

- [ ] 「Audience作成」ボタン追加
  - [ ] 配置: Company画面の適切な位置
  - [ ] Link: `/audience?fromCompany=${companyId}`
  - [ ] ラベル: 「Audience作成」

---

### 6. Outbound → Audience引き継ぎ

**ファイル**: `/src/app/pages/outbound-editor.tsx`

- [ ] Source context受け取り
  - [ ] `?fromAudience=${audienceId}` パラメータ処理
  - [ ] Audience情報の引き継ぎ
    - [ ] audience_scope
    - [ ] audience_conditions（filters）
    - [ ] resolved_recipients
    - [ ] linked entities

**State追加**:
```typescript
const [searchParams] = useSearchParams();
const fromAudience = searchParams.get('fromAudience');

useEffect(() => {
  if (fromAudience) {
    // Audience情報を取得して設定
    const audience = getAudienceById(fromAudience);
    setAudienceScope(audience.scope);
    setFilters(audience.filters);
    setResolvedRecipients(audience.resolvedRecipients);
    setLinkedCompany(audience.linkedCompany);
    setLinkedProject(audience.linkedProject);
    // ...
  }
}, [fromAudience]);
```

---

## CTA配置整理（Phase 1: High Priority）

### 7. Actions詳細Sheet実装

**ファイル**: `/src/app/pages/action-review.tsx`

#### 現在の状態
- Action一覧あり
- 詳細パネルはDrawer形式

#### 修正内容
- [ ] 一覧上のCTA整理
  - [ ] ❌ 「Outbound起票」削除（詳細Sheetへ移動）
  - [ ] ✅ 「詳細を見る」残す
  - [ ] ✅ 「完了」「保留」残す（軽い状態変更）

- [ ] 詳細Sheet内のCTA
  - [ ] ✅ 「Outbound起票」追加（主CTA）
  - [ ] ✅ 「編集」追加
  - [ ] ✅ 「Follow-upを作成」追加
  - [ ] ✅ 「Evidenceを見る」追加
  - [ ] ✅ 「Companyを見る」追加
  - [ ] ✅ 「Projectを見る」追加

---

### 8. Content詳細Sheet実装

**ファイル**: `/src/app/pages/content-jobs.tsx`

#### 現在の状態
- Content一覧あり
- 詳細パネルはSheet形式

#### 修正内容
- [ ] 一覧上のCTA整理
  - [ ] ❌ 「Outboundで使う」削除（詳細Sheetへ移動）
  - [ ] ✅ 「詳細を見る」残す

- [ ] 詳細Sheet内のCTA
  - [ ] ✅ 「Outboundで使う」追加（主CTA）
  - [ ] ✅ 「Libraryに登録」追加
  - [ ] ✅ 「編集」追加
  - [ ] ✅ 「プレビュー」追加

---

## Source Context引き継ぎ（Phase 1: High Priority）

### 9. Actions Create: Source context引き継ぎ

**ファイル**: `/src/app/pages/action-review.tsx`

- [ ] URLパラメータ処理
  - [ ] `?fromEvidence=${evidenceId}`
  - [ ] `?fromProject=${projectId}`
  - [ ] `?fromCompany=${companyId}`
  - [ ] `?followUp=${actionId}`

- [ ] 引き継ぎロジック
```typescript
const [searchParams] = useSearchParams();
const fromEvidence = searchParams.get('fromEvidence');
const fromProject = searchParams.get('fromProject');
const fromCompany = searchParams.get('fromCompany');
const followUp = searchParams.get('followUp');

useEffect(() => {
  if (fromEvidence) {
    const evidence = getEvidenceById(fromEvidence);
    setLinkedEvidence([fromEvidence]);
    setLinkedCompany(evidence.company_id);
    setLinkedProject(evidence.project_id);
    setObjective(evidence.excerpt);
  }
  
  if (followUp) {
    const parentAction = getActionById(followUp);
    setLinkedAction(followUp);
    setLinkedCompany(parentAction.company_id);
    setLinkedProject(parentAction.project_id);
    setLinkedEvidence(parentAction.evidence_ids);
    setOwner(parentAction.owner);
    setTitle(`Follow-up: ${parentAction.title}`);
  }
  
  // 他のsource contextも同様
}, [fromEvidence, fromProject, fromCompany, followUp]);
```

---

### 10. Content Create: Source context引き継ぎ

**ファイル**: `/src/app/pages/content-jobs.tsx`

- [ ] URL パラメータ処理
  - [ ] `?fromEvidence=${evidenceId}`
  - [ ] `?fromAction=${actionId}`
  - [ ] `?fromTemplate=${templateId}`

- [ ] 引き継ぎロジック（Actionsと同様のパターン）

---

### 11. Outbound Compose: Source context引き継ぎ

**ファイル**: `/src/app/pages/outbound-editor.tsx`（Compose画面）

- [ ] URL パラメータ処理
  - [ ] `?fromAction=${actionId}`
  - [ ] `?fromContent=${contentId}`
  - [ ] `?fromTemplate=${templateId}`
  - [ ] `?fromAudience=${audienceId}`
  - [ ] `?fromProject=${projectId}`
  - [ ] `?fromCompany=${companyId}`
  - [ ] `?fromEvidence=${evidenceId}`
  - [ ] `?followUp=${outboundId}`

- [ ] 引き継ぎロジック（各source contextに応じた処理）

---

## Library機能実装（Phase 2: Medium Priority）

### 12. Library種別選択モーダル

**ファイル**: `/src/app/components/library/type-select-modal.tsx`

- [ ] Modal実装
  - [ ] Template選択ボタン
  - [ ] Playbook選択ボタン
  - [ ] Knowledge選択ボタン
  - [ ] Asset選択ボタン
  - [ ] 各ボタンに説明文追加

- [ ] 選択後の処理
  - [ ] 選択種別をStateに保存
  - [ ] ソース選択モーダルを開く

**State管理**:
```typescript
const [showTypeSelectModal, setShowTypeSelectModal] = useState(false);
const [selectedType, setSelectedType] = useState<'template' | 'playbook' | 'knowledge' | 'asset' | null>(null);

const handleTypeSelect = (type: 'template' | 'playbook' | 'knowledge' | 'asset') => {
  setSelectedType(type);
  setShowTypeSelectModal(false);
  setShowSourceSelectModal(true); // 次のステップへ
};
```

---

### 13. Library ソース選択モーダル

**ファイル**: `/src/app/components/library/source-select-modal.tsx`

- [ ] Modal実装
  - [ ] 「空から作成」ボタン
  - [ ] 「Evidenceから作成」ボタン → Evidence選択リスト
  - [ ] 「Actionから作成」ボタン → Action選択リスト
  - [ ] 「Contentから作成」ボタン → Content選択リスト

- [ ] 選択後の処理
  - [ ] 選択ソースをStateに保存
  - [ ] 作成フォームDrawerを開く

---

### 14. Template作成フォーム

**ファイル**: `/src/app/components/library/template-create-form.tsx`

- [ ] フォーム実装
  - [ ] 共通項目（Title / Description / Intended Use / Owner / Tags）
  - [ ] Channel選択
  - [ ] Type選択（external / internal）
  - [ ] Subject入力
  - [ ] Body入力（Rich Text Editor）
  - [ ] Variables設定UI
    - [ ] 変数追加ボタン
    - [ ] 変数編集（name / label / description / defaultValue / required）
    - [ ] 変数削除ボタン
  - [ ] Sample Output（プレビュー）

- [ ] 保存処理
  - [ ] 下書き保存
  - [ ] レビュー依頼
  - [ ] 承認済みとして保存（権限必要）

---

### 15. Playbook作成フォーム

**ファイル**: `/src/app/components/library/playbook-create-form.tsx`

- [ ] フォーム実装
  - [ ] 共通項目
  - [ ] Trigger Condition入力
  - [ ] Recommended Steps設定UI
    - [ ] ステップ追加ボタン
    - [ ] ステップ編集（name / description / recommendedAction / checkpoint）
    - [ ] ステップ削除ボタン
    - [ ] ステップ並び替え機能
  - [ ] Escalation Rule入力
  - [ ] Evidence Requirement入力
  - [ ] Expected Outcome入力

---

### 16. Knowledge作成フォーム

**ファイル**: `/src/app/components/library/knowledge-create-form.tsx`

- [ ] フォーム実装
  - [ ] 共通項目
  - [ ] Summary入力
  - [ ] Body入力（Rich Text Editor）
  - [ ] Recommendation入力
  - [ ] Reusable Insight Flag チェックボックス
  - [ ] Related Playbooks選択
  - [ ] Related Templates選択

---

### 17. Asset作成フォーム

**ファイル**: `/src/app/components/library/asset-create-form.tsx`

- [ ] フォーム実装
  - [ ] 共通項目
  - [ ] File Upload UI
    - [ ] ドラッグ&ドロップエリア
    - [ ] ファイル選択ボタン
    - [ ] 複数ファイル対応
    - [ ] ファイル種別制限（PDF, XLSX, PPTX, PNG, JPG, MP4）
    - [ ] ファイルサイズ制限（10MB）
  - [ ] Preview生成（画像/PDFの場合）
  - [ ] Asset Purpose入力

---

## 再利用資産化フロー（Phase 2: Medium Priority）

### 18. Content → Libraryに登録フロー

**ファイル**: `/src/app/pages/content-jobs.tsx`

- [ ] Content詳細Sheet内のCTA
  - [ ] 「Libraryに登録」ボタン追加

- [ ] Template作成Drawer起動
  - [ ] Content情報の引き継ぎ
    - [ ] title → template_title
    - [ ] subject → template.subject
    - [ ] body → template.body
    - [ ] channel → template.channel
    - [ ] linked entities
  - [ ] Variables自動抽出（`{{xxx}}`パターン検出）

---

### 19. Actions → Playbook化フロー

**ファイル**: `/src/app/pages/action-review.tsx`

- [ ] Action詳細Sheet内のCTA
  - [ ] 「Playbook化する」ボタン追加

- [ ] Playbook作成Drawer起動
  - [ ] Action情報の引き継ぎ
    - [ ] title → playbook_title
    - [ ] objective → trigger_condition
    - [ ] suggested_next_step → recommended_steps
    - [ ] linked entities

---

## データ永続化・API連携（将来）

### 20. Audience API連携
- [ ] GET `/api/audiences` - Audience一覧取得
- [ ] GET `/api/audiences/:id` - Audience詳細取得
- [ ] POST `/api/audiences` - Audience作成
- [ ] PUT `/api/audiences/:id` - Audience更新
- [ ] DELETE `/api/audiences/:id` - Audience削除
- [ ] POST `/api/audiences/:id/duplicate` - Audience複製

### 21. Library API連携
- [ ] GET `/api/library` - Library資産一覧取得
- [ ] GET `/api/library/:id` - Library資産詳細取得
- [ ] POST `/api/library/templates` - Template作成
- [ ] POST `/api/library/playbooks` - Playbook作成
- [ ] POST `/api/library/knowledge` - Knowledge作成
- [ ] POST `/api/library/assets` - Asset作成（File Upload含む）

---

## テスト項目

### Audience機能
- [ ] Audience List画面の表示
- [ ] Audience Detail Sheetの表示
- [ ] Audience Builder（新規作成）
- [ ] Project → Audience作成（文脈引き継ぎ）
- [ ] Audience → Outbound（文脈引き継ぎ）
- [ ] Audience保存・登録
- [ ] Audience複製

### CTA配置
- [ ] Actions一覧で重いCTAが非表示
- [ ] Actions詳細Sheetで重いCTAが表示
- [ ] Content一覧で重いCTAが非表示
- [ ] Content詳細Sheetで重いCTAが表示

### Source Context引き継ぎ
- [ ] Evidence → Actions（引き継ぎ）
- [ ] Actions → Outbound（引き継ぎ）
- [ ] Content → Outbound（引き継ぎ）
- [ ] Template → Outbound（引き継ぎ）
- [ ] Audience → Outbound（引き継ぎ）

### Library機能
- [ ] 種別選択モーダル表示
- [ ] Template作成フォーム表示・保存
- [ ] Playbook作成フォーム表示・保存
- [ ] Variables設定UI動作
- [ ] Recommended Steps設定UI動作
- [ ] File Upload UI動作

---

## 実装順序（推奨）

### Week 1
1. Audience List画面作成
2. Audience Detail Sheet作成
3. Audience Builder拡張（基本情報入力）

### Week 2
4. Audience Builder拡張（保存・登録機能）
5. Project → Audience導線実装
6. Audience → Outbound導線実装

### Week 3
7. Actions詳細Sheet CTA整理
8. Content詳細Sheet CTA整理
9. Source context引き継ぎロジック（Actions/Content）

### Week 4
10. Outbound Source context引き継ぎロジック
11. Library種別選択モーダル実装
12. Template作成フォーム実装

### Week 5-6
13. Playbook作成フォーム実装
14. Knowledge/Asset作成フォーム実装
15. Content → Library登録フロー実装
16. Actions → Playbook化フロー実装

---

このチェックリストに従って実装を進めてください。各項目にチェックを入れることで、進捗を管理できます。
