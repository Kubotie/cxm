# 新規作成CTA 設計書

## 目的
Actions / Content / Outbound / Library における「新規作成CTA」の役割を明確に分離し、何をどこで作るべきかを具体化する。

---

## 基本原則

### A. 業務を作る（Actions）
- Actionを作る
- Follow-upを作る
- 次対応を作る

### B. 作業物を作る（Content）
- Contentを作る
- Draftを作る
- 説明資料/文面/配布物を作る

### C. 顧客接点を作る（Outbound）
- Outboundを起票する
- Composeで送信内容を作る

### D. 再利用資産を作る（Library）
- Templateを作る
- Playbookを作る
- Knowledgeを作る
- Assetを作る

---

## 1. Actions の新規作成CTA設計

### 新規作成CTAとして残すもの
- ✅ **新規Action作成**
- ✅ **Follow-upを作成**

### 削るもの
- ❌ 新規送信
- ❌ 新規テンプレート
- ❌ 送信実行
- ❌ 新規Content（Content画面で作る）

### 追加するもの
- ✅ **Outbound起票**（詳細パネル内）
- ✅ **Playbook化する**（将来的な再利用資産化の入口）

### 新規作成で作る対象
- Action（やること）
- Follow-up Action（既存Actionからの派生）
- 改善Action
- 提案Action
- エスカレーションAction

### 新規Action作成フォームで必要な項目

#### 基本情報
- **title** (必須): Action名
- **action_type** (必須): `send_external` | `send_internal` | `meeting` | `task` | `escalation`
- **priority** (必須): `high` | `medium` | `low`
- **status** (必須): `proposed` | `in_progress` | `completed` | `paused`
- **owner** (必須): 担当者
- **due_date** (必須): 期限

#### 業務文脈
- **objective** (必須): 目的
- **suggested_next_step**: 推奨される次の一手
- **notes**: 備考

#### リンク情報
- **linked_company**: 関連Company
- **linked_project**: 関連Project
- **linked_user**: 関連User
- **linked_evidence**: 根拠Evidence（複数選択可能）
- **linked_action**: 親Action（Follow-upの場合）

#### AI提案の場合
- **source_type**: `AI` | `manual`
- **confidence**: `high` | `medium` | `low`
- **ai_rationale**: AI判断根拠
- **missing_fields**: 不足項目リスト

### 他画面との接続

#### From Actions → Outbound
```
Action詳細パネル内
→ 「Outbound起票」ボタン
→ `/outbound/compose?fromAction=${actionId}`
→ Action文脈が引き継がれる
```

#### From Actions → Content
```
Action詳細パネル内
→ 「Content作成」ボタン（将来追加）
→ `/content?fromAction=${actionId}`
→ Action文脈が引き継がれる
```

#### From Actions → Library（Playbook化）
```
Action詳細パネル内
→ 「Playbook化する」ボタン（将来追加）
→ モーダルまたはDrawer
→ Playbook作成フォーム
→ Actionの内容を再利用可能な手順として登録
```

### 未設計部分の補完

#### 1. Follow-up Action作成フロー
```
既存Action詳細パネル内
→ 「Follow-upを作成」ボタン
→ 新規Actionフォームが開く
→ 親Actionの情報を引き継ぐ
  - linked_company
  - linked_project
  - linked_user
  - linked_evidence
  - owner
→ 新しいtitle, objective, next_stepを入力
→ 保存
```

#### 2. Playbook化フロー（未実装）
```
既存Action詳細パネル内
→ 「Playbook化する」ボタン
→ Playbook作成フォームDrawer
→ 必須項目:
  - playbook_title
  - trigger_condition（どういう時に使うか）
  - recommended_steps（推奨手順）
  - escalation_rule（エスカレーション条件）
  - evidence_requirement（必要なEvidence）
→ Actionの内容を再利用可能な手順として登録
→ Library/Playbooksに保存
```

---

## 2. Content の新規作成CTA設計

### 新規作成CTAとして残すもの
- ✅ **新規Content作成**
- ✅ **下書きを作成**

### 削るもの
- ❌ 送信実行（Outboundで行う）
- ❌ Template資産をここで正式登録（Libraryで行う）
- ❌ 新規Outbound作成（Outbound画面で行う）

### 追加するもの
- ✅ **Libraryに登録**（Content詳細パネル内、再利用資産化の入口）
- ✅ **Outboundで使う**（Content詳細パネル内、送信実行への導線）

### 新規作成で作る対象
- Content Job（作業としての文面/資料作成）
- 文面ドラフト
- 説明資料
- FAQ改訂案
- ヘルプ案内文
- 提案資料ドラフト

### 新規Content作成フォームで必要な項目

#### 基本情報
- **title** (必須): Content名
- **content_type** (必須): `email` | `document` | `faq` | `guide` | `proposal`
- **purpose** (必須): 目的
- **channel** (想定): `email` | `slack` | `in_person` | `document`
- **status** (必須): `draft` | `in_review` | `approved` | `completed`
- **owner** (必須): 担当者

#### 内容
- **subject**: 件名（メール/ドキュメントの場合）
- **body** (必須): 本文
- **attachments**: 添付ファイル（将来追加）

#### リンク情報
- **linked_company**: 関連Company
- **linked_project**: 関連Project
- **linked_user**: 関連User
- **linked_evidence**: 根拠Evidence（複数選択可能）
- **linked_action**: 元になったAction

#### レビュー
- **review_state**: `not_required` | `review_required` | `approved` | `rejected`
- **reviewer**: レビュアー
- **review_notes**: レビューコメント

### 他画面との接続

#### From Content → Outbound
```
Content詳細パネル内
→ 「Outboundで使う」ボタン
→ `/outbound/compose?fromContent=${contentId}`
→ Content内容（subject, body）が引き継がれる
```

#### From Content → Library
```
Content詳細パネル内
→ 「Libraryに登録」ボタン
→ Template登録フォームDrawer
→ 必須項目:
  - template_title
  - category
  - intended_use
  - variables設定
→ Content内容をテンプレート化して保存
→ Library/Templatesに登録
```

### 未設計部分の補完

#### 1. Content作成フロー
```
Content画面
→ 「新規Content作成」ボタン
→ Content作成Drawer
→ 基本情報入力
  - title
  - content_type
  - purpose
  - channel
→ リンク情報選択
  - linked_company
  - linked_project
  - linked_user
  - linked_evidence
  - linked_action
→ 本文作成
  - subject
  - body（Rich Text Editor）
→ 保存オプション
  - 下書き保存
  - レビュー依頼
  - 承認済みとして保存
```

#### 2. Libraryに登録フロー（未実装）
```
Content詳細パネル内
→ 「Libraryに登録」ボタン
→ Template作成フォームDrawer
→ ステップ1: 基本情報
  - template_title
  - category: Email / Document / FAQ / Guide
  - intended_use（説明）
  - applicable_scope: Company / Project / User
→ ステップ2: Variables設定
  - Content内の可変部分を特定
  - {{user_name}}, {{company_name}} などの変数に変換
  - 変数の説明・デフォルト値を設定
→ ステップ3: サンプル出力
  - 変数を埋めた時のプレビュー
→ 保存
  - Library/Templatesに登録
  - status: draft → review_required → approved
```

#### 3. Outboundで使うフロー
```
Content詳細パネル内
→ 「Outboundで使う」ボタン
→ `/outbound/compose?fromContent=${contentId}`
→ Outbound Compose画面が開く
→ 以下が自動引き継ぎ:
  - subject
  - body
  - linked_company
  - linked_project
  - linked_user
  - linked_evidence
  - linked_action
→ ユーザーは送信先・送信タイミングを設定
→ 送信実行
```

---

## 3. Outbound の新規作成CTA設計

### 新規作成CTAとして残すもの
- ✅ **新規Outbound作成**
- ✅ **送信ドラフトを作成**

### 削るもの
- ❌ 新規Template（Libraryで作る）
- ❌ 新規Playbook（Libraryで作る）
- ❌ 新規Knowledge資産（Libraryで作る）

### 追加するもの
- ✅ **Source contextから作成**（各画面からの文脈引き継ぎ）
- ✅ **既存Contentから作成**
- ✅ **既存Templateから作成**
- ✅ **Follow-up送信を作成**

### 新規作成で作る対象
- Outbound Item（送信予定/送信実行済みの記録）
- 送信ドラフト（1回限りの送信用文面）
- Follow-up送信（既存送信からの派生）
- Audience起点の一括送信下書き
- Company/Project/User起点の送信下書き

### 新規Outbound作成フォームで必要な項目

#### 基本情報
- **name** (必須): Outbound名
- **channel** (必須): `email` | `slack` | `in_person`
- **delivery_status** (必須): `draft` | `scheduled` | `sent` | `failed`

#### Audience/Delivery Scope
- **audience_scope** (必須): `company` | `project` | `user`
- **audience_conditions**: Audience条件（Audience Workspaceで設定）
- **resolved_recipients**: 送信先確定リスト
- **unresolved_recipients**: 送信先未確定リスト

#### リンク情報
- **linked_company**: 関連Company
- **linked_project**: 関連Project
- **linked_user**: 関連User
- **linked_action**: 元になったAction
- **linked_content**: 元になったContent
- **linked_evidence**: 根拠Evidence
- **linked_cluster**: 元になったクラスター
- **linked_segment**: 元になったセグメント

#### 送信内容
- **subject** (必須): 件名
- **body** (必須): 本文
- **template_id**: 使用Template
- **variables**: 変数値

#### レビュー・承認
- **review_state**: `not_required` | `review_required` | `approved` | `rejected`
- **reviewer**: レビュアー
- **review_notes**: レビューコメント

#### メタ情報
- **owner** (必須): 担当者
- **source_context**: 起票元（Actions / Content / Audience / Company / Project / User）

### 他画面との接続

#### From Outbound → Audience Workspace
```
Outbound Editor
→ 「送信対象を調整」ボタン
→ `/audience?returnTo=/outbound/editor/${id}`
→ Audience Workspace
→ 対象を調整
→ 「Editorに戻る」ボタン
→ Outbound Editorに戻る
```

#### From Outbound → Library
```
Outbound Editor
→ 送信実行後
→ 「Templateとして保存」ボタン（将来追加）
→ Template登録フォームDrawer
→ Library/Templatesに登録
```

### 未設計部分の補完

#### 1. Source contextから作成フロー
```
各画面（Actions/Content/Company/Project/User/Evidence）
→ 「Outbound起票」ボタン
→ `/outbound/compose?from${Context}=${id}`
→ Outbound Compose画面
→ 文脈が自動引き継ぎ:
  - source_context
  - linked_company
  - linked_project
  - linked_user
  - linked_action
  - linked_content
  - linked_evidence
→ ユーザーは以下を設定:
  - channel
  - audience_scope
  - subject
  - body
→ 下書き保存 or レビュー依頼 or 送信実行
```

#### 2. 既存Contentから作成フロー
```
Outbound List
→ 「新規Outbound作成」ボタン
→ モーダル: ソース選択
  - 空から作成
  - Contentから作成
  - Templateから作成
→ 「Contentから作成」選択
→ Content選択リスト
→ Content選択
→ `/outbound/compose?fromContent=${contentId}`
→ Content内容が引き継がれる
```

#### 3. 既存Templateから作成フロー
```
Outbound List
→ 「新規Outbound作成」ボタン
→ モーダル: ソース選択
  - 空から作成
  - Contentから作成
  - Templateから作成
→ 「Templateから作成」選択
→ Template選択リスト（Library）
→ Template選択
→ `/outbound/compose?fromTemplate=${templateId}`
→ Template内容が引き継がれる
→ 変数の値を入力するフォーム表示
```

#### 4. Follow-up送信作成フロー
```
Outbound Results
→ 既存の送信結果詳細
→ 「Follow-up送信を作成」ボタン
→ `/outbound/compose?followUp=${outboundId}`
→ 以下が引き継がれる:
  - audience_scope
  - resolved_recipients
  - linked_company
  - linked_project
  - linked_user
→ 新しいsubject, bodyを作成
→ 送信実行
```

---

## 4. Library の新規作成CTA設計

### 新規作成CTAとして残すもの
- ✅ **+新規作成**（種別選択式）

### 削るもの
- ❌ 新規送信（Outboundで行う）
- ❌ 送信実行（Outboundで行う）
- ❌ 単発返信作成（Contentで行う）

### 追加するもの
- ✅ **種別選択モーダル**（Template / Playbook / Knowledge / Asset）
- ✅ **文脈接続選択**（空から / Evidenceから / Actionから / Contentから）
- ✅ **Variables設定UI**
- ✅ **ファイルアップロードUI**
- ✅ **Content/Outbound/Actionsへの適用CTA**

### 新規作成で作る対象
- Template（再利用可能な文面テンプレート）
- Playbook（再利用可能な業務手順）
- Knowledge（再利用可能な知見・ベストプラクティス）
- Asset（再利用可能なファイル・資料）

### 新規Library資産作成フロー（全体設計）

#### ステップ1: 種別選択
```
Library画面
→ 「+新規作成」ボタン
→ 種別選択モーダル
→ 以下から選択:
  - Template（文面テンプレート）
  - Playbook（業務手順）
  - Knowledge（知見・ベストプラクティス）
  - Asset（ファイル・資料）
```

#### ステップ2: ソース選択（文脈接続）
```
種別選択後
→ ソース選択モーダル
→ 以下から選択:
  - 空から作成
  - Evidenceから作成（Evidence選択リスト）
  - Actionから作成（Action選択リスト）
  - Contentから作成（Content選択リスト）
```

#### ステップ3: 作成フォーム（種別共通項目）
```
共通項目:
- title (必須)
- category (必須): カテゴリ選択
- description (必須): 説明
- intended_use: 使用目的
- applicable_scope: Company / Project / User
- owner (必須)
- status: draft / review_required / approved
- tags: タグ（複数）
- version: バージョン番号

リンク情報:
- linked_company
- linked_project
- linked_user
- linked_evidence
- linked_action
- linked_content
```

#### ステップ4: 種別別追加項目

##### Template作成フォーム
```
Template固有項目:
- channel: email / slack / document
- type: external / internal
- subject (必須): 件名
- body (必須): 本文（Rich Text Editor）
- variables (必須): 変数設定
  - 変数名: {{user_name}}, {{company_name}} など
  - 説明: この変数の意味
  - デフォルト値: 省略可能
  - 必須/任意: 必須 or 任意
- sample_output: サンプル出力（変数を埋めたプレビュー）

Variables設定UI:
→ 「+変数を追加」ボタン
→ 変数設定フォーム:
  - 変数名（例: user_name）
  - 表示ラベル（例: ユーザー名）
  - 説明（例: 送信先ユーザーの名前）
  - デフォルト値（例: お客様）
  - 必須/任意
→ 本文内で {{user_name}} として使用
→ プレビュー画面で変数を埋めたサンプルを表示
```

##### Playbook作成フォーム
```
Playbook固有項目:
- trigger_condition (必須): トリガー条件（どういう時に使うか）
- recommended_steps (必須): 推奨手順（ステップバイステップ）
- escalation_rule: エスカレーション条件
- evidence_requirement: 必要なEvidence
- expected_outcome: 期待される成果
- checkpoints: チェックポイント（確認事項）

Recommended Steps設定UI:
→ 「+ステップを追加」ボタン
→ ステップ設定フォーム:
  - ステップ番号（自動）
  - ステップ名（例: 初回連絡）
  - 詳細説明（Rich Text）
  - 推奨アクション（例: メール送信 / MTG設定）
  - チェックポイント（例: 返信があったか確認）
→ ステップの順序を並び替え可能
```

##### Knowledge作成フォーム
```
Knowledge固有項目:
- summary (必須): 要約
- body (必須): 本文（Rich Text）
- recommendation: 推奨事項
- reusable_insight_flag: 再利用可能な知見フラグ
- related_playbooks: 関連Playbook
- related_templates: 関連Template
- source_evidence: 元になったEvidence
```

##### Asset作成フォーム
```
Asset固有項目:
- file_upload (必須): ファイルアップロード
- file_type: PDF / Excel / PowerPoint / Image / Video
- file_name: ファイル名
- file_size: ファイルサイズ
- preview: プレビュー画像/サムネイル
- asset_purpose: 資料の目的
- download_count: ダウンロード数（自動）

File Upload UI:
→ ドラッグ&ドロップエリア
→ または「ファイルを選択」ボタン
→ 複数ファイル対応
→ ファイル種別制限: PDF, XLSX, PPTX, PNG, JPG, MP4
→ ファイルサイズ制限: 10MB以下
→ プレビュー表示（画像/PDFの場合）
```

#### ステップ5: 保存オプション
```
保存ボタン:
- 下書き保存（status: draft）
- レビュー依頼（status: review_required）
- 承認済みとして保存（status: approved、権限必要）

保存後:
→ Library一覧に追加
→ 詳細パネルで確認可能
→ 編集/削除可能
→ Content/Outbound/Actionsへの適用CTA表示
```

### Library資産の適用フロー（未実装）

#### Template → Outboundに適用
```
Library/Template詳細パネル
→ 「Outboundで使う」ボタン
→ `/outbound/compose?fromTemplate=${templateId}`
→ Template内容が引き継がれる
→ 変数の値を入力
→ 送信実行
```

#### Template → Contentに適用
```
Library/Template詳細パネル
→ 「Contentで使う」ボタン
→ `/content?fromTemplate=${templateId}`
→ Template内容が引き継がれる
→ Content作成フォーム
→ 保存
```

#### Playbook → Actionに適用
```
Library/Playbook詳細パネル
→ 「Actionで使う」ボタン
→ Action作成フォームDrawer
→ Playbook手順が引き継がれる
→ Action作成
→ 保存
```

#### Knowledge → 各画面で参照
```
各画面（Actions/Content/Outbound）
→ 「関連Knowledge」パネル
→ Library/Knowledgeから検索・選択
→ Knowledge内容を参照しながら作業
```

#### Asset → ダウンロード・共有
```
Library/Asset詳細パネル
→ 「ダウンロード」ボタン
→ ファイルダウンロード
→ 「共有リンクをコピー」ボタン
→ クリップボードにコピー
```

---

## 5. 画面横断の新規作成CTA一覧表

| 画面 | 残すCTA | 削るCTA | 追加するCTA |
|------|---------|---------|-------------|
| **Actions** | • 新規Action<br>• Follow-upを作成 | • 新規送信<br>• 新規テンプレート<br>• 送信実行 | • Outbound起票<br>• Playbook化する |
| **Content** | • 新規Content<br>• 下書きを作成 | • 送信実行<br>• Template資産登録<br>• 新規Outbound | • Libraryに登録<br>• Outboundで使う |
| **Outbound** | • 新規Outbound作成<br>• 送信ドラフトを作成 | • 新規Template<br>• 新規Playbook<br>• 新規Knowledge | • Contentから作成<br>• Templateから作成<br>• Follow-up送信を作成 |
| **Library** | • +新規作成（種別選択式） | • 新規送信<br>• 送信実行<br>• 単発返信作成 | • 種別選択UI<br>• Variables設定UI<br>• File UploadUI<br>• 適用CTA |

---

## 6. Source Contextからの接続フロー

### From Evidence / Unified Log
```
Evidence/Unified Log詳細パネル
→ 以下のCTAを配置:
  - Actionを作る → `/actions?fromEvidence=${evidenceId}`
  - Contentを作る → `/content?fromEvidence=${evidenceId}`
  - Outbound起票 → `/outbound/compose?fromEvidence=${evidenceId}`
  - Library資産を作る → Library種別選択モーダル
```

### From Company / Project / User
```
Company/Project/User詳細パネル
→ 以下のCTAを配置:
  - Actionを作る → Action作成フォーム
  - Contentを作る → Content作成フォーム
  - Outbound起票 → `/outbound/compose?from${Context}=${id}`
```

### From Actions
```
Action詳細パネル
→ 以下のCTAを配置:
  - Outbound起票 → `/outbound/compose?fromAction=${actionId}`
  - Playbook化する → Playbook作成フォーム
  - Follow-upを作成 → 新規Action作成（親Actionの情報引き継ぎ）
```

### From Content
```
Content詳細パネル
→ 以下のCTAを配置:
  - Outboundで使う → `/outbound/compose?fromContent=${contentId}`
  - Libraryに登録 → Template登録フォーム
```

### From Library
```
Library/Template詳細パネル
→ 以下のCTAを配置:
  - Outboundで使う → `/outbound/compose?fromTemplate=${templateId}`
  - Contentで使う → `/content?fromTemplate=${templateId}`

Library/Playbook詳細パネル
→ 以下のCTAを配置:
  - Actionで使う → Action作成フォーム

Library/Asset詳細パネル
→ 以下のCTAを配置:
  - ダウンロード → ファイルダウンロード
  - 共有リンクをコピー → クリップボードにコピー
```

---

## 7. 実装優先度

### 優先度 High（即座に実装）
1. **Actions**: Outbound起票CTA
2. **Content**: Outboundで使うCTA
3. **Outbound**: Source contextからの作成フロー
4. **Library**: 種別選択モーダル

### 優先度 Medium（次のフェーズ）
1. **Actions**: Playbook化するCTA
2. **Content**: Libraryに登録CTA
3. **Outbound**: Templateから作成フロー
4. **Library**: Variables設定UI

### 優先度 Low（将来的に）
1. **Library**: File UploadUI（Asset作成）
2. **Library**: Playbook詳細設計（recommended_steps UI）
3. **Library**: Knowledge詳細設計

---

## 8. UI設計原則

### 新規作成CTAの配置
- **一覧画面**: 画面右上に配置（全体の新規作成）
- **詳細パネル**: パネル内に配置（文脈を引き継いだ新規作成）

### ボタン文言
- **明確な動詞**: 「作成」「起票」「登録」「適用」
- **対象を明示**: 「Actionを作成」「Outbound起票」「Libraryに登録」
- **曖昧な表現を避ける**: ❌「新規作成」→ ✅「新規Action作成」

### アイコン
- **Plus**: 新規作成全般
- **Send**: Outbound起票
- **FileText**: Content作成
- **Database**: Library登録
- **ArrowRight**: 適用・接続

### モーダル vs Drawer vs ページ遷移
- **モーダル**: 選択肢（種別選択、ソース選択）
- **Drawer**: 作成フォーム（Action、Content、Library）
- **ページ遷移**: 複雑な作成（Outbound Compose）

---

## 9. まとめ

### 役割分担の明確化
- **Actions**: 業務を作る
- **Content**: 作業物を作る
- **Outbound**: 顧客接点を作る
- **Library**: 再利用資産を作る

### 単発実行 vs 再利用資産の分離
- **単発実行用**: Actions/Content/Outboundで作成
- **再利用資産**: Libraryで作成・管理

### 文脈の引き継ぎ
- 各画面から他画面への新規作成時に、文脈（linked entities）を自動引き継ぎ
- クエリパラメータ（`?from${Context}=${id}`）で文脈を保持

### 未設計部分の補完
- Library種別選択モーダル
- Variables設定UI
- File UploadUI
- Playbook化フロー
- Libraryに登録フロー
- 適用CTA（Template→Outbound/Content）

---

## 10. 次のステップ

### Phase 1: 基本導線の実装
1. Actions → Outbound起票
2. Content → Outboundで使う
3. Library → 種別選択モーダル

### Phase 2: 再利用資産化の実装
1. Content → Libraryに登録
2. Actions → Playbook化
3. Template → Outbound/Contentで使う

### Phase 3: 高度な機能の実装
1. Variables設定UI
2. File UploadUI
3. Playbook詳細設計
4. Knowledge詳細設計
