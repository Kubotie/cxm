# CTA配置整理：一覧 vs 詳細パネル

## 目的
各画面のCTAを「一覧上で置くべきCTA」と「詳細パネル内で置くべきCTA」に分け、UIの複雑さを軽減し、段階的な判断フローを実現する。

---

## 基本原則

### 一覧上で置くべきCTA（軽い操作）
- **目的**: 選ぶ・仕分ける・軽く判断する
- **特徴**: 
  - 即座に実行できる
  - 文脈が少なくても判断できる
  - 状態変更が軽い
  - UI上の専有面積が小さい

**具体例:**
- 開く（詳細を見る）
- 選択
- 保留
- クローズ
- 担当付け
- フィルタ
- ソート
- 軽い状態確認

### 詳細パネル内で置くべきCTA（重い操作）
- **目的**: 理解する・業務化する・Outboundに渡す
- **特徴**:
  - 文脈を十分に理解してから実行
  - 関連情報を見てから判断
  - Evidence を確認してから実行
  - 業務フローに影響する

**具体例:**
- 原文を開く
- Evidenceを見る
- 関連Company/Project/Userを開く
- Actionを作成
- Actionsに送る
- Contentに送る
- Outboundを起票する
- 長文編集
- 関連情報の詳細確認

### 一覧上で置かないCTA（避けるべき）
- 長文編集
- 外部送信を想起させる強いCTA
- 重い文脈判断が必要なCTA
- 危険操作の印象が強いCTA
- 送信実行
- 直接配信

---

## 1. Inbox（受信起点の対応判断画面）

### 現状の問題
- 一覧上に「返信/案内を準備」「Company詳細」「Project詳細」「承認」「却下」など多数のCTAが表示
- 送信系CTAが一覧の段階で強く見える
- 何を今ここでできるのか分かりにくい
- Alert詳細を見ずに重い判断ができてしまう

### 一覧上で残すCTA
```tsx
// Alert一覧カード上
- ✅ 「詳細を見る」（新設）
- ✅ 「保留」
- ✅ 「クローズ」
- ✅ Status表示（視認のみ）
- ✅ Priority表示（視認のみ）
```

**理由:**
- 一覧では「どのAlertを見るか」を選ぶことに集中
- 軽い仕分け操作のみ提供
- 詳細を開いてから重い判断を行う

### 詳細パネル内で置くCTA
```tsx
// Alert詳細Sheet/Drawer内
主CTA:
- ✅ 「返信/案内を準備」（送信準備導線）
- ✅ 「Actionsに回す」
- ✅ 「Contentに回す」

補助CTA:
- ✅ 「Company詳細を見る」
- ✅ 「Project詳細を見る」
- ✅ 「原文を開く」
- ✅ 「関連Evidenceを見る」
- ✅ 「担当を割り当てる」

状態変更CTA:
- ✅ 「承認」（AI提案の承認）
- ✅ 「却下」（AI提案の却下）
- ✅ 「処理開始」
```

**理由:**
- Alert内容・AI提案・Evidenceを確認してから判断
- 送信系CTAは文脈を理解した後に表示
- Company/Projectへの遷移も詳細で判断

### 一覧上から削るCTA
```tsx
❌ 「返信/案内を準備」→ 詳細パネルへ移動
❌ 「Company詳細」→ 詳細パネルへ移動
❌ 「Project詳細」→ 詳細パネルへ移動
❌ 「承認」→ 詳細パネルへ移動
❌ 「却下」→ 詳細パネルへ移動
❌ 「処理開始」→ 詳細パネルへ移動
```

### 詳細に移すCTA
- 「返信/案内を準備」（送信準備導線として最も重い）
- 「Actionsに回す」「Contentに回す」（業務化導線）
- 「Company詳細」「Project詳細」（文脈確認）
- 「承認」「却下」「処理開始」（状態変更）

### なぜこの配置にするか
1. **一覧の役割を明確化**: 「どれを見るか選ぶ」に集中
2. **段階的判断**: Alert内容を見てから→重い判断
3. **送信系CTAの適切な配置**: 文脈を理解してから表示
4. **視覚的な整理**: 一覧がシンプルになり、スキャン性向上

---

## 2. Unified Log（時系列Evidence理解画面）

### 現状の問題
- Evidence一覧上に「原文を開く」「Actionを作成」「返信/案内を準備」など多数のCTA
- Evidenceの内容を十分に見ずに操作できてしまう
- 関連情報（Resolver詳細など）が一覧段階で見えにくい

### 一覧上で残すCTA
```tsx
// Evidence一覧カード上
- ✅ 「詳細を見る」（新設）
- ✅ Evidenceタイプ表示（視認のみ）
- ✅ 関連Company/Project表示（視認のみ）
- ✅ タイムスタンプ表示（視認のみ）
```

**理由:**
- 一覧では時系列でEvidenceを俯瞰
- どのEvidenceを深掘りするか選ぶ
- 詳細は開いてから確認

### 詳細パネル内で置くCTA
```tsx
// Evidence詳細Sheet/Drawer内
主CTA:
- ✅ 「返信/案内を準備」（inquiry/support系のみ）
- ✅ 「Actionを作成」

補助CTA（原文・根拠確認）:
- ✅ 「原文を開く」
- ✅ 「関連Alertを見る」
- ✅ 「関連Actionを見る」
- ✅ 「Resolver詳細を見る」

補助CTA（文脈整理）:
- ✅ 「Projectに紐付ける」
- ✅ 「Companyを開く」
- ✅ 「Projectを開く」
- ✅ 「Userを開く」
```

**理由:**
- Evidence詳細・文脈を見てから判断
- 関連情報を確認してからアクション
- 送信系は文脈理解後に表示

### 一覧上から削るCTA
```tsx
❌ 「返信/案内を準備」→ 詳細パネルへ移動
❌ 「Actionを作成」→ 詳細パネルへ移動
❌ 「原文を開く」→ 詳細パネルへ移動
❌ 「Projectに紐付ける」→ 詳細パネルへ移動
❌ 「関連Alert」→ 詳細パネルへ移動
❌ 「関連Action」→ 詳細パネルへ移動
❌ 「Resolver詳細」→ 詳細パネルへ移動
```

### 詳細に移すCTA
- すべての業務化CTA（Actionを作成、返信準備）
- すべての関連確認CTA（原文、関連Alert/Action、Resolver）
- すべての文脈整理CTA（紐付け、開く）

### なぜこの配置にするか
1. **時系列俯瞰の役割**: 一覧は「いつ何が起きたか」を把握
2. **Evidence理解の深化**: 詳細で内容を確認してから判断
3. **関連情報の集約**: 詳細パネルで関連Alert/Action/Resolverを一箇所で確認

---

## 3. Company Detail（企業1社の統合理解画面）

### 現状の問題
Company detail自体が詳細画面だが、その中に以下の一覧要素がある：
- Project一覧
- People一覧（組織図）
- Evidence一覧
- Alert一覧
- Action一覧

これらの一覧要素にCTAが多く配置されがち。

### Company detail内の一覧要素で残すCTA

#### Project一覧上
```tsx
- ✅ 「Project詳細を見る」
- ✅ Phase表示（視認のみ）
- ✅ Risk/Health表示（視認のみ）
```

#### People一覧上
```tsx
- ✅ 「Person詳細を見る」
- ✅ Role/Department表示（視認のみ）
- ✅ Confidence表示（視認のみ）
```

#### Evidence一覧上
```tsx
- ✅ 「Evidence詳細を見る」
- ✅ タイプ表示（視認のみ）
- ✅ タイムスタンプ表示（視認のみ）
```

**理由:**
- Company detail内の一覧も「選ぶ」機能に集中
- 詳細は別パネルまたは別画面で確認

### Company detail全体の詳細パネル（サイドパネル）で置くCTA
```tsx
// 右サイドパネル「次アクション判断」
主CTA:
- ✅ 「Outboundを起票」

補助CTA（業務文脈へ）:
- ✅ 「Actionsに送る」
- ✅ 「Contentに送る」

補助CTA（参照）:
- ✅ 「Unified Logを見る」
- ✅ 「Libraryを見る」

特殊CTA:
- ✅ 「Composeで確認」（Salesforce同期時）
```

**理由:**
- Company全体の文脈を理解してから業務化
- 一覧要素を見てから次アクション判断

### 一覧上で置かないCTA
```tsx
❌ Project一覧上で「Outboundを起票」
❌ People一覧上で「メール送信」
❌ Evidence一覧上で「返信準備」
❌ 一覧段階での送信系CTA
```

### なぜこの配置にするか
1. **階層的な情報理解**: 一覧で俯瞰→詳細で深掘り→アクション判断
2. **Company全体視点の維持**: 送信系CTAはCompany全体を見てから
3. **視覚的な整理**: 一覧が情報表示に集中

---

## 4. Project（個別Project深掘り画面）

### 現状の問題
Project画面自体が詳細画面だが、その中に以下の一覧要素がある：
- Signals/Evidence Timeline（左カラム）
- Users/Segments一覧（中央カラム）
- Action/Content/Sent一覧（右カラム）

これらの一覧要素にCTAが配置されている。

### Project内の一覧要素で残すCTA

#### Evidence Timeline一覧上
```tsx
- ✅ 「Evidence詳細を見る」
- ✅ Signal表示（視認のみ）
- ✅ タイムスタンプ表示（視認のみ）
```

#### Users一覧上
```tsx
- ✅ 「User詳細を見る」
- ✅ 選択チェックボックス（Audience選択用）
- ✅ Activity表示（視認のみ）
```

#### Action一覧上（右カラム）
```tsx
- ✅ 「Action詳細を見る」
- ✅ Status表示（視認のみ）
- ✅ Priority表示（視認のみ）
```

**理由:**
- Project内の一覧も「選ぶ」機能に集中
- 軽い選択操作のみ提供

### Action詳細Sheet内で置くCTA
```tsx
// Action詳細Sheet/Drawer内
主CTA:
- ✅ 「Push実行」（status="ready"のみ）
- ✅ 「Outboundを起票」（status="pushed"のみ）

補助CTA:
- ✅ 「詳細を見る」
- ✅ 「承認へ」（status="draft"のみ）
- ✅ 「編集」
```

**理由:**
- Action内容を確認してから実行
- Push/送信準備は詳細を見てから

### Project全体のアクションパネルで置くCTA
```tsx
// 画面全体のアクション
- ✅ 「Insight生成」（Drawer起動）
- ✅ 「User選択」（Panel起動）
- ✅ 「Action作成」（Modal起動）
```

**理由:**
- Project全体の文脈を見てから判断

### 一覧上で置かないCTA
```tsx
❌ Evidence一覧上で「Actionを作成」
❌ Users一覧上で「メール送信」
❌ Action一覧上で「Push実行」
❌ Action一覧上で「Outboundを起票」
❌ 一覧段階での送信系CTA
```

### 詳細に移すCTA
- 「Outboundを起票」（Action詳細Sheet内へ）
- 「Push実行」（Action詳細Sheet内へ）
- 「承認へ」（Action詳細Sheet内へ）

### なぜこの配置にするか
1. **Project文脈の維持**: 一覧で俯瞰してから詳細判断
2. **Action実行の慎重性**: 内容確認後に実行
3. **3カラムレイアウトの整理**: 各カラムの役割を明確化

---

## 5. User（個別User深掘り画面）

### 現状の問題
User専用画面は未実装だが、実装時に考慮すべき設計。

### User内の一覧要素で残すCTA（設計）

#### Activity一覧上
```tsx
- ✅ 「Activity詳細を見る」
- ✅ タイプ表示（視認のみ）
- ✅ タイムスタンプ表示（視認のみ）
```

#### 関連Project一覧上
```tsx
- ✅ 「Project詳細を見る」
- ✅ Phase表示（視認のみ）
- ✅ Role表示（視認のみ）
```

#### 問い合わせ履歴一覧上
```tsx
- ✅ 「問い合わせ詳細を見る」
- ✅ Status表示（視認のみ）
- ✅ タイムスタンプ表示（視認のみ）
```

**理由:**
- User画面内の一覧も「選ぶ」機能に集中

### User詳細のアクションパネルで置くCTA（設計）
```tsx
// 右サイドパネルまたはアクションバー
主CTA:
- ✅ 「Outboundを起票」

補助CTA（文脈整理）:
- ✅ 「Companyを見る」
- ✅ 「Projectを見る」
- ✅ 「Evidenceを見る」

補助CTA（業務化）:
- ✅ 「Actionsに送る」
- ✅ 「Contentに送る」

特殊CTA:
- ✅ 「Composeで確認」
```

**理由:**
- User全体の文脈を理解してから判断

### 一覧上で置かないCTA（設計）
```tsx
❌ Activity一覧上で「返信準備」
❌ Project一覧上で「施策起票」
❌ 一覧段階での送信系CTA
```

### なぜこの配置にするか
1. **User理解の深化**: 一覧で行動履歴を俯瞰してから判断
2. **個別対応の慎重性**: User全体を見てから対応判断
3. **関連情報の統合**: 詳細パネルで一箇所にまとめる

---

## 6. Actions（業務アクション遂行画面）

### 現状の問題
- Action一覧上でそのまま「Outbound起票」が見える
- Action詳細を開かずに重い操作ができてしまう
- 編集・確認が一覧段階でできてしまう

### 一覧上で残すCTA
```tsx
// Action一覧カード上
- ✅ 「詳細を見る」（Sheet起動）
- ✅ 「完了」（軽い状態変更）
- ✅ 「保留」（軽い状態変更）
- ✅ Status表示（視認のみ）
- ✅ Priority表示（視認のみ）
- ✅ Owner表示（視認のみ）
```

**理由:**
- 一覧では「どのActionを処理するか」を選ぶ
- 軽い状態変更のみ提供
- 重い操作は詳細Sheet内で実行

### 詳細Sheet内で置くCTA
```tsx
// Action詳細Sheet内
主CTA:
- ✅ 「Outbound起票」（send_external + approvedのみ）
- ✅ 「Push実行」（push + approvedのみ）

補助CTA（業務フロー）:
- ✅ 「編集」
- ✅ 「再設定」
- ✅ 「Owner変更」
- ✅ 「Priority変更」

補助CTA（文脈参照）:
- ✅ 「Evidenceを見る」
- ✅ 「Companyを見る」
- ✅ 「Projectを見る」
- ✅ 「Template参照」

特殊CTA:
- ✅ 「Composeで確認」
```

**理由:**
- Action詳細・Evidence・関連情報を確認してから実行
- 送信系は文脈を理解してから表示
- 編集も詳細を見てから

### 一覧上から削るCTA
```tsx
❌ 「Outbound起票」→ 詳細Sheetへ移動
❌ 「編集」→ 詳細Sheetへ移動
❌ 「再設定」→ 詳細Sheetへ移動
❌ 「Owner変更」→ 詳細Sheetへ移動（またはクイック編集）
❌ 「Priority変更」→ 詳細Sheetへ移動（またはクイック編集）
```

### 詳細に移すCTA
- 「Outbound起票」（最も重い操作）
- 「Push実行」（重い操作）
- 「編集」（長文編集の可能性）
- すべての文脈参照CTA

### なぜこの配置にするか
1. **Action内容の確認**: 詳細を見てから実行
2. **業務フローの明確化**: 一覧で選ぶ→詳細で確認→実行
3. **誤操作の防止**: 重い操作は詳細Sheet内のみ

---

## 7. Content（コンテンツ作成・編集画面）

### 現状の問題
- Content一覧上でそのまま「Outboundで使う」が見える
- Content詳細を開かずに配信準備ができてしまう
- 編集・プレビューが一覧段階でできてしまう

### 一覧上で残すCTA
```tsx
// Content一覧カード上
- ✅ 「詳細を見る」（Sheet起動）
- ✅ Status表示（視認のみ）
- ✅ Type表示（視認のみ）
- ✅ Owner表示（視認のみ）
- ✅ 最終更新日表示（視認のみ）
```

**理由:**
- 一覧では「どのContentを処理するか」を選ぶ
- 視認性を優先
- 重い操作は詳細Sheet内で実行

### 詳細Sheet内で置くCTA
```tsx
// Content詳細Sheet内
主CTA:
- ✅ 「Outboundで使う」（approvedのみ）

補助CTA（作成・編集）:
- ✅ 「編集」
- ✅ 「プレビュー」
- ✅ 「Template適用」
- ✅ 「Library参照」
- ✅ 「複製」

補助CTA（文脈参照）:
- ✅ 「Companyを見る」
- ✅ 「Projectを見る」
- ✅ 「Evidenceを見る」

状態変更CTA:
- ✅ 「承認申請」（draftのみ）
- ✅ 「承認」（in_reviewのみ）
- ✅ 「差し戻し」（in_reviewのみ）

特殊CTA:
- ✅ 「Composeで確認」
```

**理由:**
- Content内容・プレビューを確認してから配信準備
- 編集も詳細を見てから
- 長文エディタは詳細Sheet内で展開

### 一覧上から削るCTA
```tsx
❌ 「Outboundで使う」→ 詳細Sheetへ移動
❌ 「編集」→ 詳細Sheetへ移動
❌ 「プレビュー」→ 詳細Sheetへ移動
❌ 「承認申請」→ 詳細Sheetへ移動
❌ 「承認」→ 詳細Sheetへ移動
```

### 詳細に移すCTA
- 「Outboundで使う」（最も重い操作）
- 「編集」（長文編集）
- 「プレビュー」（詳細確認）
- すべての状態変更CTA
- すべての文脈参照CTA

### なぜこの配置にするか
1. **Content確認の徹底**: 内容を確認してから配信準備
2. **編集フローの明確化**: 一覧で選ぶ→詳細で編集→承認→配信
3. **誤配信の防止**: 重い操作は詳細Sheet内のみ

---

## 8. Outbound（送信準備画面）

### 現状の問題
- Outbound一覧上でそのまま「送信実行」が見える
- Outbound詳細を開かずに送信準備ができてしまう
- 編集・プレビューが一覧段階でできてしまう

### 一覧上で残すCTA
```tsx
// Outbound一覧カード上
- ✅ 「詳細を見る」（Sheet起動）
- ✅ 「選択」（複数選択用）
- ✅ Status表示（視認のみ）
- ✅ Type表示（視認のみ）
- ✅ Owner表示（視認のみ）
- ✅ 最終更新日表示（視認のみ）
```

**理由:**
- 一覧では「どのOutboundを処理するか」を選ぶ
- 視認性を優先
- 重い操作は詳細Sheet内で実行

### 詳細Sheet内で置くCTA
```tsx
// Outbound詳細Sheet内
主CTA:
- ✅ 「送信対象を調整」
- ✅ 「送信実行」（approvedのみ）
- ✅ 「編集」

補助CTA（文脈参照）:
- ✅ 「Audience詳細を見る」
- ✅ 「Template参照」
- ✅ 「レビュー」

特殊CTA:
- ✅ 「Composeで確認」
```

**理由:**
- Outbound内容・プレビューを確認してから送信準備
- 編集も詳細を見てから
- 長文エディタは詳細Sheet内で展開

### 一覧上から削るCTA
```tsx
❌ 「送信実行」→ 詳細Sheetへ移動
❌ 「編集」→ 詳細Sheetへ移動
❌ 「プレビュー」→ 詳細Sheetへ移動
```

### 詳細に移すCTA
- 「送信実行」（最も重い操作）
- 「編集」（長文編集）
- 「プレビュー」（詳細確認）
- すべての文脈参照CTA

### なぜこの配置にするか
1. **Outbound確認の徹底**: 内容を確認してから送信準備
2. **編集フローの明確化**: 一覧で選ぶ→詳細で編集→送信
3. **誤送信の防止**: 重い操作は詳細Sheet内のみ

---

## 9. Library（再利用資産管理画面）

### 現状の問題
- Library一覧上でそのまま「Outboundで使う」が見える
- Library詳細を開かずに配信準備ができてしまう
- 編集・プレビューが一覧段階でできてしまう

### 一覧上で残すCTA
```tsx
// Library一覧カード上
- ✅ 「詳細を見る」（Sheet起動）
- ✅ Status表示（視認のみ）
- ✅ Type表示（視認のみ）
- ✅ Owner表示（視認のみ）
- ✅ 最終更新日表示（視認のみ）
```

**理由:**
- 一覧では「どのLibraryを処理するか」を選ぶ
- 視認性を優先
- 重い操作は詳細Sheet内で実行

### 詳細Sheet内で置くCTA
```tsx
// Library詳細Sheet内
主CTA:
- ✅ 「Outboundで使う」（approvedのみ）
- ✅ 「Contentで使う」（approvedのみ）

補助CTA（作成・編集）:
- ✅ 「編集」
- ✅ 「プレビュー」
- ✅ 「Template適用」
- ✅ 「Library参照」
- ✅ 「複製」

補助CTA（文脈参照）:
- ✅ 「Companyを見る」
- ✅ 「Projectを見る」
- ✅ 「Evidenceを見る」

状態変更CTA:
- ✅ 「承認申請」（draftのみ）
- ✅ 「承認」（in_reviewのみ）
- ✅ 「差し戻し」（in_reviewのみ）

特殊CTA:
- ✅ 「Composeで確認」
```

**理由:**
- Library内容・プレビューを確認してから配信準備
- 編集も詳細を見てから
- 長文エディタは詳細Sheet内で展開

### 一覧上から削るCTA
```tsx
❌ 「Outboundで使う」→ 詳細Sheetへ移動
❌ 「編集」→ 詳細Sheetへ移動
❌ 「プレビュー」→ 詳細Sheetへ移動
❌ 「承認申請」→ 詳細Sheetへ移動
❌ 「承認」→ 詳細Sheetへ移動
```

### 詳細に移すCTA
- 「Outboundで使う」（最も重い操作）
- 「編集」（長文編集）
- 「プレビュー」（詳細確認）
- すべての状態変更CTA
- すべての文脈参照CTA

### なぜこの配置にするか
1. **Library確認の徹底**: 内容を確認してから配信準備
2. **編集フローの明確化**: 一覧で選ぶ→詳細で編集→承認→配信
3. **誤配信の防止**: 重い操作は詳細Sheet内のみ

---

## 送信系CTAの配置ルール（全画面共通）

### 一覧上では
- ❌ 送信系CTAを主役にしない
- ❌ 「返信/案内を準備」を一覧に出さない
- ❌ 「Outboundを起票」を一覧に出さない
- ❌ 「Outboundで使う」を一覧に出さない

### 詳細パネル内では
- ✅ 送信系CTAを適切に配置
- ✅ 文脈が十分見えた状態で表示
- ✅ Evidence/Company/Projectなどの関連情報と一緒に表示
- ✅ 通常色（青色）で表示（赤色にしない）

### 送信実行は
- ✅ Compose画面のみ
- ✅ Compose画面内で危険操作として表示

---

## 色と見せ方の統一ルール

### 一覧上のCTA
```tsx
// 詳細を見る（主要）
variant="ghost" or variant="outline"
size="sm"

// 軽い状態変更（完了・保留など）
variant="outline"
size="sm"
```

### 詳細パネル内のCTA
```tsx
// 送信準備導線（主CTA）
variant="default"
className="bg-blue-600 hover:bg-blue-700"
size="sm"

// 補助CTA
variant="outline"
size="sm"

// 危険な状態変更（却下など）
variant="outline"
className="text-red-600 border-red-300"
size="sm"
```

### Compose画面内のみ
```tsx
// 最終送信実行
variant="destructive"
className="bg-red-600 hover:bg-red-700"
```

---

## UI実装パターン

### パターン1: Sheet（推奨）
```tsx
<Sheet open={detailOpen} onOpenChange={setDetailOpen}>
  <SheetContent>
    {/* 詳細情報表示 */}
    {/* 重いCTA配置 */}
  </SheetContent>
</Sheet>
```

**使用画面**: Inbox、Actions、Content

### パターン2: Drawer
```tsx
<Drawer open={detailOpen} onOpenChange={setDetailOpen}>
  <DrawerContent>
    {/* 詳細情報表示 */}
    {/* 重いCTA配置 */}
  </DrawerContent>
</Drawer>
```

**使用画面**: Unified Log、Project

### パターン3: サイドパネル（固定）
```tsx
<div className="flex">
  <div className="flex-1">{/* 一覧 */}</div>
  <div className="w-[400px]">{/* アクションパネル */}</div>
</div>
```

**使用画面**: Company Detail、Project

---

## 画面別CTAマトリクス

| 画面 | 一覧上の主CTA | 詳細パネルの主CTA | 詳細パネルの補助CTA |
|------|--------------|------------------|-------------------|
| **Inbox** | 詳細を見る、保留、クローズ | 返信/案内を準備、Actionsに回す | Company/Project詳細、原文、担当割当 |
| **Unified Log** | 詳細を見る | 返信/案内を準備、Actionを作成 | 原文、関連Alert/Action、Resolver、紐付け |
| **Company** | Project/People/Evidence詳細 | Outboundを起票 | Actionsに送る、Contentに送る、Unified Log |
| **Project** | Evidence/User/Action詳細、選択 | Outboundを起票、Push実行 | 承認へ、編集、詳細 |
| **User** | Activity/Project/問合せ詳細 | Outboundを起票 | Company/Project/Evidence、Actionsに送る |
| **Actions** | 詳細を見る、完了、保留 | Outbound起票、Push実行、編集 | Evidence/Company/Project、Template |
| **Content** | 詳細を見る | Outboundで使う、編集、プレビュー | Company/Project/Evidence、Template、承認 |
| **Outbound** | 詳細を見る、選択 | 送信対象を調整、送信実行、編集 | Audience詳細、Template、レビュー |
| **Library** | 詳細を見る | Outboundで使う、Contentで使う、編集 | 変数確認、適用履歴、バージョン管理 |

---

## 新規作成CTAの役割分担

### 基本原則
各画面における「新規作成CTA」の役割を明確に分離し、何をどこで作るべきかを具体化する。

#### A. 業務を作る（Actions）
- Actionを作る
- Follow-upを作る
- 次対応を作る

#### B. 作業物を作る（Content）
- Contentを作る
- Draftを作る
- 説明資料/文面を作る

#### C. 顧客接点を作る（Outbound）
- Outboundを起票する
- Composeで送信内容を作る

#### D. 再利用資産を作る（Library）
- Templateを作る
- Playbookを作る
- Knowledgeを作る
- Assetを作る

### 画面別 新規作成CTA一覧

| 画面 | 残すCTA | 削るCTA | 追加するCTA |
|------|---------|---------|-------------|
| **Actions** | • 新規Action<br>• Follow-upを作成 | • 新規送信<br>• 新規テンプレート<br>• 送信実行 | • Outbound起票（詳細パネル内）<br>• Playbook化する（詳細パネル内） |
| **Content** | • 新規Content<br>• 下書きを作成 | • 送信実行<br>• Template資産登録<br>• 新規Outbound | • Libraryに登録（詳細パネル内）<br>• Outboundで使う（詳細パネル内） |
| **Outbound** | • 新規Outbound作成<br>• 送信ドラフトを作成 | • 新規Template<br>• 新規Playbook<br>• 新規Knowledge | • Contentから作成<br>• Templateから作成<br>• Follow-up送信を作成 |
| **Library** | • +新規作成（種別選択式） | • 新規送信<br>• 送信実行<br>• 単発返信作成 | • 種別選択UI<br>• Variables設定UI<br>• File UploadUI<br>• 適用CTA（詳細パネル内） |

### 新規作成の配置ルール

#### 一覧画面上の新規作成CTA
- **配置**: 画面右上
- **目的**: 空から新規作成する
- **ラベル**: 具体的な作成対象を明示（例: 「新規Action作成」「新規Content」）

#### 詳細パネル内の新規作成CTA
- **配置**: 詳細パネルの主CTAエリア
- **目的**: 文脈を引き継いで新規作成する
- **ラベル**: 接続先を明示（例: 「Outbound起票」「Libraryに登録」）

#### 新規作成の文脈引き継ぎ
```
Evidence/Log詳細パネル
→ 「Actionを作る」→ Action作成フォーム（Evidence文脈引き継ぎ）
→ 「Contentを作る」→ Content作成フォーム（Evidence文脈引き継ぎ）
→ 「Outbound起票」→ Compose画面（Evidence文脈引き継ぎ）

Action詳細パネル
→ 「Outbound起票」→ Compose画面（Action文脈引き継ぎ）
→ 「Playbook化する」→ Playbook作成フォーム（Action内容引き継ぎ）
→ 「Follow-upを作成」→ 新規Action作成（親Action情報引き継ぎ）

Content詳細パネル
→ 「Outboundで使う」→ Compose画面（Content内容引き継ぎ）
→ 「Libraryに登録」→ Template作成フォーム（Content内容引き継ぎ）

Library詳細パネル
→ 「Outboundで使う」→ Compose画面（Template内容引き継ぎ）
→ 「Contentで使う」→ Content作成フォーム（Template内容引き継ぎ）
```

### 単発実行 vs 再利用資産の分離

#### 単発実行用（Actions/Content/Outbound）
- **特徴**: 1回限りの実行を想定
- **保存先**: Actions/Content/Outbound各画面
- **再利用**: 基本的には想定しない
- **例**: 
  - Action: 特定顧客への個別対応
  - Content: 特定案件向けの説明資料
  - Outbound: 1回限りの送信

#### 再利用資産（Library）
- **特徴**: 複数回の再利用を想定
- **保存先**: Library
- **再利用**: 積極的に想定
- **例**:
  - Template: 標準的なメールテンプレート
  - Playbook: 標準的な対応手順
  - Knowledge: ベストプラクティス
  - Asset: 提案資料のひな形

### 実装詳細

詳細な設計仕様は `/CREATE_CTA_DESIGN.md` を参照してください。

---

## 実装の優先順位

### Phase 1: 高優先度（送信系CTAの移動）
1. **Inbox** - 「返信/案内を準備」を詳細Sheetへ移動
2. **Actions** - 「Outbound起票」を詳細Sheetへ移動
3. **Content** - 「Outboundで使う」を詳細Sheetへ移動

### Phase 2: 中優先度（業務化CTAの移動）
4. **Unified Log** - 「Actionを作成」「返信/案内を準備」を詳細Drawerへ移動
5. **Project** - Action一覧の「Push実行」「Outboundを起票」を詳細Sheetへ移動

### Phase 3: 低優先度（参照CTAの整理）
6. **Inbox** - 「Company詳細」「Project詳細」を詳細Sheetへ移動
7. **Company** - 一覧要素のCTA整理
8. **Project** - 一覧要素のCTA整理

---

## ユーザーメリット

### 一覧がシンプルに
- ✅ 何を選ぶべきか明確
- ✅ スキャン性が向上
- ✅ 視覚的なノイズが減少
- ✅ 優先順位が分かりやすい

### 段階的な判断フロー
- ✅ 一覧で選ぶ→詳細で理解→アクション
- ✅ 文脈を確認してから重い操作
- ✅ Evidence/関連情報を見てから判断
- ✅ 誤操作の防止

### 送信系CTAの適切な配置
- ✅ 文脈を理解してから送信準備
- ✅ 一覧段階で送信を意識しすぎない
- ✅ 詳細パネルで関連情報と一緒に確認
- ✅ Compose画面への自然な導線

---

## システムメリット

### UI/UXの一貫性
- ✅ すべての画面で「一覧→詳細→アクション」のフロー統一
- ✅ CTA配置ルールの明確化
- ✅ 保守性の向上

### 誤操作の防止
- ✅ 重い操作は詳細確認後のみ
- ✅ 送信系CTAは文脈理解後のみ
- ✅ 危険操作はCompose画面のみ

### パフォーマンス
- ✅ 一覧はレンダリング負荷が軽い
- ✅ 詳細パネルは必要な時のみ表示
- ✅ 遅延ロードの活用可能

---

## まとめ

### 実現すること
1. **一覧**: 選ぶ・仕分ける・軽く判断する
2. **詳細パネル**: 理解する・業務化する・Outboundに渡す
3. **Compose**: 送信実行のみ

### 統一ルール
- 一覧上では送信系CTAを置かない
- 送信系CTAは詳細パネル内に配置
- 送信実行はCompose画面のみ
- 段階的な判断フローを徹底

### 次のステップ
各画面に詳細Sheet/Drawer/Panelを実装し、CTAを適切に配置する。