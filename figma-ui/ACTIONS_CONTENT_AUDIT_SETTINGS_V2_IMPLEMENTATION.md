# Actions、Content、Audit、Settings のV2方針実装完了

## 実装日
2026-03-14

## 実装内容

### 1. Actions画面（action-review.tsx）の修正

#### 削除したもの
- ❌ 外部送信確認ダイアログ（`showSendExternalDialog`）
- ❌ 外部送信state（`sendExternalConfirm`）
- ❌ 「外部送信を実行」ボタン（危険操作・赤色ボタン）

#### 追加したもの
- ✅ **「Outbound起票へ」ボタン**（通常色・Primaryボタン）
- ✅ 外部送信が必要なActionに対する案内メッセージ
- ✅ Link to `/outbound/compose`

#### 画面説明の変更
```
Before: "AIが生成したAction案を、Evidenceを見ながらレビューし、承認・Push・Syncを判断します"
After:  "やることを進める業務フロー • 優先順位づけ • 着手・完了・保留 • Evidence確認 • 外部連絡が必要な場合はOutbound起票"
```

---

### 2. Content画面（content-jobs.tsx）の修正

#### 削除したもの
- ❌ 外部送信確認ダイアログ（`showSendExternalDialog`）
- ❌ 外部送信state（`sendExternalConfirm`）
- ❌ 「外部送信を実行」ボタン（危険操作・赤色ボタン）
- ❌ 通常送信ボタン

#### 追加したもの
- ✅ **「Outbound起票へ」ボタン**（通常色・Primaryボタン）
- ✅ 外部送信が必要なContentに対する案内メッセージ
- ✅ Link to `/outbound/compose`

#### 画面説明の変更
```
Before: "Actionに紐づくContent作成・承認・送信を管理します"
After:  "作るものを整える業務フロー • Content作成・修正 • Template適用 • Evidence参照 • 配信準備 • 外部送信はOutbound起票"
```

---

### 3. Audit画面（governance-audit.tsx）の修正

#### 変更内容
- ✅ 既にV2方針に準拠していたため、画面説明のみ更新

#### 画面説明の変更
```
Before: "Push・Send・Sync・Resolver・承認操作の履歴を監査し、危険操作や不整合を追跡します"
After:  "送信・承認・高リスク操作・失敗の追跡 • 誰が何を送ったか確認 • ポリシー確認 • 監査ログ出力 • 送信実行はOutboundで行う"
```

#### 維持している機能
- ✅ 監査ログ確認
- ✅ 失敗詳細確認
- ✅ unresolved確認
- ✅ Export CSV
- ✅ フィルタ機能（Event Type / Result / Risk / Actor / Date）

#### やらないこと（V2方針準拠）
- ❌ 新規送信
- ❌ 送信実行
- ❌ 本文編集
- ❌ コンテンツ作成

---

### 4. Settings画面（settings.tsx）の修正

#### 変更内容
- ✅ 既にV2方針に準拠していたため、修正不要

#### 維持している機能
- ✅ Resolver設定
- ✅ Channel設定
- ✅ Sync設定
- ✅ Governance設定
- ✅ Secrets管理
- ✅ Templates管理

#### やらないこと（V2方針準拠）
- ❌ 新規送信
- ❌ 送信実行
- ❌ 配信結果確認（→ Auditへ）
- ❌ 顧客文脈への深い導線

---

## V2方針の分離原則

### 職責の明確化

| 画面 | 職責 | 主要アクション | 送信実行 |
|------|------|--------------|---------|
| **Actions** | やることを進める | 着手・完了・保留・Outbound起票 | ❌ 実行しない |
| **Content** | 作るものを整える | 作成・修正・準備・Outbound起票 | ❌ 実行しない |
| **Outbound** | 送るものを送る | 承認・送信実行 | ✅ ここだけ |
| **Audit** | 送ったものを追跡 | 監査・確認・Export | ❌ 実行しない |
| **Settings** | 動くものを設定 | Channel/Resolver/権限設定 | ❌ 実行しない |

---

## なぜこの分離が必要か

### 1. 高リスク操作の統制
- 外部送信は「危険操作」として統制が必要
- 複数画面から送信可能にすると、監査が困難
- **Outboundに集約**することで、承認フロー・監査ログ・失敗追跡が一元化

### 2. 認知負荷の軽減
- 「どこから送るか」で迷わない
- 送信は**Outbound**、業務は**Actions/Content**、監査は**Audit**、設定は**Settings**
- 各画面の役割が明確になり、操作ミスが減る

### 3. 承認フローの一貫性
- 外部送信は全て**Outbound**で承認フローを通る
- Actions/Contentから直接送信すると、承認フローを迂回するリスク
- Governance/Audit要件を満たせる

### 4. Evidence駆動の徹底
- **Actions/Content**: Evidenceを見ながら「何をすべきか」を判断
- **Outbound**: Evidenceを見ながら「誰に何を送るか」を判断
- 各画面でEvidenceを確認できるが、送信実行は**Outboundのみ**

---

## CTAデザインルール

### 外部送信系CTAの扱い

| 画面 | 旧CTA | 新CTA | デザイン |
|------|-------|-------|---------|
| Actions | ❌ 外部送信を実行（赤・Destructive） | ✅ Outbound起票へ（青・Primary） | 通常色 |
| Content | ❌ 外部送信を実行（赤・Destructive） | ✅ Outbound起票へ（青・Primary） | 通常色 |
| Outbound | - | ✅ 送信実行（赤・Destructive） | **危険操作色** |

### 重要原則
- ✅ **Outbound起票**: 通常色（Primary Blue）
- ✅ **Composeへ進む**: 通常色（Primary Blue）
- ❌ **送信実行**: 赤い危険操作表現は **Compose画面内の最終送信実行だけ**

---

## 遷移時のデータ保持

Actions/ContentからOutbound起票する際、以下を保持：
- ✅ 元のAction ID / Content ID
- ✅ 対象（Company/Project/User）
- ✅ 推奨チャネル
- ✅ テンプレート（あれば）
- ✅ Evidence参照

---

## サイドバーナビゲーション

既に正しく設定済み：
- ✅ Actions
- ✅ Content
- ✅ Outbound
- ✅ Audit
- ✅ Settings

---

## まとめ

### 修正済みファイル
1. ✅ `/src/app/pages/action-review.tsx`
2. ✅ `/src/app/pages/content-jobs.tsx`
3. ✅ `/src/app/pages/governance-audit.tsx`

### V2方針準拠済み
- ✅ **Actions**: 外部送信CTA削除、Outbound起票に変更
- ✅ **Content**: 外部送信CTA削除、Outbound起票に変更
- ✅ **Audit**: 監査専用画面として機能
- ✅ **Settings**: 設定専用画面として機能
- ✅ **Outbound**: 送信実行の唯一の場所（既存実装）

### 達成した分離
- ✅ 「やる」「作る」「送る」「追跡」「設定」が明確に分離
- ✅ Evidence駆動のワークフローが一貫して機能
- ✅ 高リスク操作の統制が可能
- ✅ 認知負荷の軽減
- ✅ 承認フローの一貫性

---

## 今後の推奨事項

1. **Outbound画面の実装確認**
   - `/outbound/compose`が正しく動作しているか確認
   - Action/Contentからの遷移時にデータを引き継げるか確認

2. **承認フローの実装**
   - Outbound画面内で承認フローが機能しているか確認
   - Manager承認が必要な操作を識別

3. **監査ログの完全性**
   - Auditログに全ての外部送信・Sync操作が記録されるか確認

4. **Evidence連携**
   - Actions/Content/OutboundでEvidenceを適切に参照できるか確認
