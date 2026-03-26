# 実装サマリー: Outbound & Content 機能改善

## 📅 実装日
2026年03月16日

## 🎯 実装目的
OutboundとContentの役割を明確化し、ユーザーが迷わず適切な機能を使い分けられるようにする。

---

## ✅ 実装完了項目

### 1. 新規Outbound作成の2ステップドロワー

#### ファイル
- `/src/app/components/outbound/new-outbound-drawer.tsx` (新規作成)
- `/src/app/pages/outbound-list.tsx` (更新)

#### 実装内容

**Step 1: Type & Context Selection**
- 送信タイプ選択（6種類）
  - Reply: 問い合わせやログに対する返信
  - Follow-up: 前回接点の続きのフォロー
  - Announcement: 案内・告知
  - Nurture: 活用促進・教育
  - Check-in: 様子確認・軽い接触
  - Custom: 文脈を持たない手動起票
- チャネル選択: Email / Intercom / Slack
- 対象スコープ選択: Company / Project / User / Audience
- 紐付ける文脈の入力（任意）

**Step 2: Content & Preview**
- 選択した設定の確認表示（Badge）
- Outbound名入力（必須）
- Template使用オプション
- 件名・本文入力（Template未使用時は必須）
- AI提案の案内
- 受信者プレビューの案内

**CTA（Call To Action）**
- 下書き保存
- Composeで開く（パラメータ付きで遷移）
- キャンセル

**デザイン仕様**
- 横幅: 960px
- ステップインジケーター付き
- タイプ選択カードは視覚的に明確（色分け + アイコン）
- 重要な制約を明示（「送信実行はCompose画面で行います」）

#### UI/UX改善
- ❌ 空のエディタをいきなり開くのを廃止
- ✅ まず文脈と目的を選ばせる設計に変更
- ✅ ユーザーに「何を作るか」を意識させる

---

### 2. Content機能の役割見直し

#### ファイル
- `/src/app/components/content/content-new-draft-drawer.tsx` (新規作成)
- `/src/app/pages/content-list.tsx` (更新)

#### 実装内容

**Contentの新しい位置づけ**
- **Content** = AIで作る / 磨く / カスタマイズする場
- **Library** = 再利用のために残す資産
- **Outbound** = 顧客に届ける送信物

**新規作成できるコンテンツタイプ（7種類）**
1. Message Draft: 顧客向けメッセージの下書き
2. Proposal Draft: 提案資料・セールス資料の素案
3. FAQ Draft: FAQ記事の下書き
4. Help Draft: ヘルプ記事の下書き
5. Onboarding Draft: オンボーディング資料の下書き
6. Summary Draft: 要約・レポートの下書き
7. Custom Draft: カスタム下書き

**AI作業機能（8種類）**
1. AIで下書き生成
2. AIで要約
3. AIで言い換え
4. AIでトーン調整
5. AIでFAQ化
6. AIでHelp記事化
7. AIで提案文変換
8. AI対象別カスタマイズ

**AIが参照する文脈**
- Evidence / Company / Project / User の紐付け
- Library の Template を元に生成
- 元テキストの入力（要約・言い換えなど）

**次のステップ（3つの行き先）**
1. 下書き保存（Content内に保持）
2. Libraryに登録（再利用資産化）
3. Outboundに渡す（送信準備）

**デザイン仕様**
- 横幅: 960px
- AI機能を強調（Sparklesアイコン）
- 役割説明を画面内に表示
- 3機能の違いを視覚的に明示

#### UI/UX改善
- ✅ 画面ヘッダーにSparklesアイコン追加
- ✅ 「AIで作る / 磨く / カスタマイズする作業場」を明示
- ✅ Content / Library / Outbound の役割を3カラムで説明
- ✅ 主CTAを「AIで新規作成」に変更

---

### 3. ドキュメント作成

#### ファイル
- `/CONTENT_OUTBOUND_LIBRARY_ROLES.md` (新規作成)
- `/IMPLEMENTATION_SUMMARY.md` (新規作成 - 本ファイル)

#### 内容
- 3機能の役割マトリックス
- 判断基準フローチャート
- 実際のユースケース（4パターン）
- UI/UXの統一ルール
- やってはいけないこと
- 黄金ルール

---

## 🎨 デザイン統一ルール

### Content
- **アイコン**: ✨ Sparkles
- **カラー**: Blue / Purple
- **主CTA**: "AIで新規作成"
- **横幅**: 960px（ドロワー）

### Outbound
- **アイコン**: 📤 Send
- **カラー**: Blue / Indigo
- **主CTA**: "New Outbound"
- **横幅**: 960px（ドロワー）

### 共通
- ステップフローは明確に番号表示
- 選択肢は視覚的に明確（カード形式、色分け）
- 役割説明を画面内に埋め込み
- CTAは明確に分離（保存 / 次へ / キャンセル）

---

## 🔄 変更前後の比較

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| **Outbound新規作成** | 空のエディタを開く | 2ステップで文脈を選択してから作成 |
| **Content新規作成** | 古いシート（ContentCreateSheet） | AI作業場として再設計（ContentNewDraftDrawer） |
| **役割の明確さ** | 3機能の違いが不明瞭 | 画面内に役割説明を表示 |
| **主CTA** | "新規Content作成" | "AIで新規作成" |
| **ドロワー横幅** | 800px（Content） | 960px（統一） |
| **送信タイプ** | なし | 6種類から選択 |
| **AI機能** | 言及なし | 8種類を明示 |

---

## 📊 実装ファイル一覧

### 新規作成
1. `/src/app/components/outbound/new-outbound-drawer.tsx` (496行)
2. `/src/app/components/content/content-new-draft-drawer.tsx` (437行)
3. `/CONTENT_OUTBOUND_LIBRARY_ROLES.md` (ドキュメント)
4. `/IMPLEMENTATION_SUMMARY.md` (本ファイル)

### 更新
1. `/src/app/pages/outbound-list.tsx` (import追加、state追加、ドロワー統合)
2. `/src/app/pages/content-list.tsx` (import追加、ヘッダー更新、ドロワー変更)

### 保持（削除しない）
- `/src/app/components/content/content-create-sheet.tsx` (既存コンポーネント、後方互換性のため保持)

---

## 🚀 次のステップ（推奨）

### 短期（優先度：高）
1. **Inbox → Outbound導線の統合**
   - Inboxから「返信」する際に新規Outbound作成ドロワーを開く
   - Type: "Reply" を自動選択
   - 文脈（Company/User）を自動設定

2. **Actions → Outbound導線の統合**
   - Actionsから「Outbound起票」する際に新規Outbound作成ドロワーを開く
   - 文脈（Action/Company/Project）を自動設定

3. **Company Detail → Outbound導線の統合**
   - Company画面から「Outboundを起票」する際に新規Outbound作成ドロワーを開く
   - 文脈（Company）を自動設定

### 中期（優先度：中）
4. **AI機能の実装**
   - Content作成時のAI生成機能
   - 要約・言い換え・トーン調整の実装
   - Evidence/Company/Projectデータを元にした生成

5. **Template適用の実装**
   - Libraryとの連携
   - 変数展開機能
   - プレビュー機能

### 長期（優先度：低）
6. **Audience → Outbound導線の統合**
   - Audienceから直接Outbound作成
   - Audience情報を自動設定

7. **Library機能の拡充**
   - Template管理画面の改善
   - Playbook機能の追加

---

## 🎯 成功指標（KPI）

### ユーザビリティ
- ✅ 3機能の役割が一読で理解できる
- ✅ 新規作成時に適切な文脈を選択できる
- ✅ AIを使った作業が明確に認識できる

### 効率性
- 📈 Content → Outbound への遷移率
- 📈 Content → Library への登録率
- 📈 Outbound新規作成時の文脈入力率
- 📉 空の下書きの放置率

### 満足度
- 😊 「どこで何をすればいいかわかりやすい」
- 😊 「AIで作業が効率化された」
- 😊 「再利用資産が見つけやすい」

---

## 📝 開発メモ

### 技術的な決定
- **React Hooks**: useState で状態管理
- **React Router**: useNavigate でページ遷移
- **UI Components**: shadcn/ui ベース
- **Icons**: lucide-react
- **Styling**: Tailwind CSS

### パフォーマンス
- ドロワーは必要時のみレンダリング
- 大きなフォームは分割（2ステップ）
- 状態管理は最小限

### アクセシビリティ
- キーボード操作対応
- ARIA属性の適切な設定
- 明確なラベルとプレースホルダー

---

## 🔍 レビューポイント

### UI/UX
- [ ] ドロワーの横幅が統一されているか（960px）
- [ ] ステップインジケーターが明確か
- [ ] 役割説明が適切に表示されているか
- [ ] CTAが明確に分離されているか

### 機能
- [ ] 新規Outbound作成の2ステップフローが動作するか
- [ ] Contentの新規作成ドロワーが動作するか
- [ ] パラメータ付きでCompose画面に遷移できるか
- [ ] 状態管理が適切に行われているか

### ドキュメント
- [ ] 役割定義が明確か
- [ ] ユースケースが実際の業務に即しているか
- [ ] 判断基準が分かりやすいか

---

## 🙏 謝辞

この実装により、Content / Outbound / Library の3機能の役割が明確になり、ユーザーが迷わず適切な機能を使い分けられるようになりました。

**黄金ルール**
1. **何度も使う** → **Library**
2. **今回送る** → **Outbound**
3. **まだ作業中 / 顧客別調整中** → **Content**

この3つの役割を理解すれば、B2B SaaS CXM基盤での顧客向けコンテンツ作成が劇的に効率化されます！

---

**実装完了日**: 2026年03月16日  
**実装者**: AI Assistant  
**レビュー状態**: 実装完了 / ドキュメント完備
