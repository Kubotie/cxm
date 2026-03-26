# Content / Outbound / Library の役割定義

## 概要

B2B SaaS CXM基盤において、**Content**、**Outbound**、**Library** の3機能は、顧客向けコンテンツのライフサイクル全体をカバーします。それぞれの役割を明確に分離し、適切な使い分けを実現します。

---

## 🎯 3機能の役割マトリックス

| 機能 | 役割 | 主な用途 | 最終成果物 |
|------|------|----------|-----------|
| **Content** | AIで作る / 磨く / カスタマイズする | 作業中コンテンツの生成・調整 | 下書き・Libraryへの登録・Outboundへの送信 |
| **Library** | 再利用のために残す | テンプレート・ナレッジ資産の管理 | 再利用可能な資産 |
| **Outbound** | 顧客に届ける | 送信実行の下書き・配信・結果管理 | 顧客への実際の送信物 |

---

## 📝 Content: AIで作る / 磨く場

### 役割
**顧客文脈つきの作業中コンテンツを、AIを使って生成・調整・カスタマイズする作業場**

### Contentの位置づけ
- 単発で使う作業中コンテンツ
- 顧客別にカスタマイズ中の資料や文面
- 未資産化のドラフト
- Outbound に流す前の作業中成果物
- AIを使って作る / 磨く / 変換する場

### Contentでできること

#### 新規作成できる種別
- **Message Draft**: 顧客向けメッセージの下書き
- **Proposal Draft**: 提案資料・セールス資料の素案
- **FAQ Draft**: FAQ記事の下書き
- **Help Draft**: ヘルプ記事の下書き
- **Onboarding Draft**: オンボーディング資料の下書き
- **Summary Draft**: 要約・レポートの下書き
- **Custom Draft**: カスタム下書き

#### 使えるAI機能
- ✨ AIで下書き生成
- 📄 AIで要約
- 🔄 AIで言い換え
- 🎨 AIでトーン調整
- ❓ AIでFAQ化
- 📚 AIでHelp記事化
- 💼 AIで提案文変換
- 👤 AIで対象別カスタマイズ
- 🔤 AIで変数候補抽出

#### AIが参照する文脈
- linked Evidence
- linked Action
- linked Company
- linked Project
- linked User
- Library の Template

#### Content → 次の行き先
1. **作業中のまま残す** → 下書き保存（Content内に保持）
2. **再利用資産にする** → Libraryに登録
3. **今回送る** → Outboundに渡す

### Contentに置かないもの
- ❌ 再利用テンプレート（→ Library）
- ❌ 正式ナレッジ資産（→ Library）
- ❌ Playbook（→ Library）
- ❌ 送信結果（→ Outbound）
- ❌ 送信運用そのもの（→ Outbound）
- ❌ 最終送信実行（→ Outbound/Compose）

---

## 📤 Outbound: 顧客に届ける

### 役割
**顧客向け接点を起票し、配信を管理し、結果を追跡する送信運用の場**

### Outboundの位置づけ
- 顧客向けアクションの作成・配信・結果管理
- 送信実行はComposeのみで行う
- 各画面からの送信系CTAは文脈を保持したままOutbound/Composeに流れ込む

### 新規Outbound作成フロー

#### Step 1: Type & Context Selection
送信タイプと文脈を選択
- **送信タイプ**:
  - **Reply**: 問い合わせやログに対する返信
  - **Follow-up**: 前回接点の続きのフォロー
  - **Announcement**: 案内・告知
  - **Nurture**: 活用促進・教育
  - **Check-in**: 様子確認・軽い接触
  - **Custom**: 文脈を持たない手動起票

- **チャネル**: Email / Intercom / Slack
- **対象スコープ**: Company / Project / User / Audience
- **紐付ける文脈**: Company / Project / User / Audience（任意）

#### Step 2: Content & Preview
内容を入力し、プレビューを確認
- Outbound名（必須）
- Template使用オプション
- 件名・本文（Template未使用時は必須）
- 受信者プレビュー
- Unresolved preview

#### CTA（Call To Action）
- **下書き保存**: Outbound一覧に保存
- **Composeで開く**: パラメータ付きでCompose画面へ遷移
- **キャンセル**: ドロワーを閉じる

### 重要な制約
- ❌ 新規Outbound作成では**送信実行しない**
- ✅ 送信実行は**Compose画面のみ**で行う
- ✅ 空のエディタを開くのではなく、**文脈を選ばせてから**作成

### Outboundで管理する情報
- 送信物の下書き状態
- Review状態（draft / review_required / approved）
- 配信状態（draft / ready / scheduled / sent / failed）
- 対象Audience
- Resolved / Unresolved Recipients
- 送信結果（Open / Click / Reply）
- 送信履歴

---

## 📚 Library: 再利用のために残す

### 役割
**再利用可能なテンプレート・ナレッジ資産を管理する資産庫**

### Libraryの位置づけ
- 再利用前提の文面 / 手順 / 資産
- Template / Playbook / ナレッジ記事
- 組織で共有する資産

### Libraryに登録するもの
- ✅ 再利用テンプレート
- ✅ Playbook
- ✅ FAQ / Help記事
- ✅ オンボーディング資料
- ✅ ベストプラクティス
- ✅ 標準的な文面パターン

### Library → 次の利用方法
- Content で Template として適用
- Outbound で Template として適用
- AI生成の元資料として参照

---

## 🔀 判断基準フローチャート

```
コンテンツを作成したい
    ↓
┌─────────────────────────────────────┐
│ 何度も使う？                         │
│ Yes → Library                       │
│ No  → 次へ                          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 今回すぐ送る？                       │
│ Yes → Outbound                      │
│ No  → 次へ                          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ まだ作業中 / 顧客別調整中？          │
│ Yes → Content                       │
└─────────────────────────────────────┘
```

### より詳細な判断基準

| 状況 | 適切な機能 | 理由 |
|------|-----------|------|
| 繰り返し使える文面を作りたい | Library | 再利用資産として保存 |
| 顧客に今すぐ送りたい | Outbound | 送信実行・配信管理 |
| AIで下書きを生成したい | Content | AI作業場 |
| 顧客別にカスタマイズ中 | Content | 作業中コンテンツ |
| 要約・言い換え・トーン調整したい | Content | AI加工機能 |
| 完成した資料を資産化したい | Content → Library | 完成後にLibraryへ |
| 作成した文面を送信したい | Content → Outbound | 完成後にOutboundへ |
| Templateから送信物を作りたい | Library → Outbound | Templateを元にOutbound作成 |

---

## 💡 実際のユースケース

### ケース1: 顧客向けフォローアップメールを送りたい
1. **Outbound** で新規作成
2. Type: **Follow-up** を選択
3. Channel: **Email** を選択
4. 対象を設定
5. 本文を入力 or Templateを適用
6. **Composeで開く** → 送信実行

### ケース2: AIで提案資料の素案を作りたい
1. **Content** で新規作成
2. Type: **Proposal Draft** を選択
3. 文脈（Company/Project）を紐付け
4. AI機能: **AIで下書き生成** を選択
5. AIが生成した素案を調整
6. 完成後 → **Libraryに登録** or **Outboundに渡す**

### ケース3: よく使うメールテンプレートを作りたい
1. **Library** で新規Template作成
2. 再利用可能な文面を作成
3. 変数を設定
4. 保存
5. 次回以降、OutboundやContentで利用

### ケース4: 既存の長文を顧客向けに要約したい
1. **Content** で新規作成
2. Type: **Summary Draft** を選択
3. 元テキストを貼り付け
4. AI機能: **AIで要約** を選択
5. 顧客文脈に合わせて調整
6. **Outboundに渡す** → 送信

---

## 🎨 UI/UX の統一ルール

### Content
- **アイコン**: ✨ Sparkles（AI作業を強調）
- **カラー**: Blue / Purple（AIと創造性）
- **主CTA**: "AIで新規作成"
- **説明文**: "AIで作る / 磨く / カスタマイズする作業場"

### Outbound
- **アイコン**: 📤 Send
- **カラー**: Blue / Indigo
- **主CTA**: "New Outbound"
- **説明文**: "顧客向けアクションの作成・配信・結果管理"

### Library
- **アイコン**: 📚 Database / Library
- **カラー**: Purple / Slate
- **主CTA**: "新規Template作成"
- **説明文**: "再利用可能な資産を管理"

---

## 🚫 やってはいけないこと

### Content
- ❌ Contentで直接送信実行する（→ Outboundへ）
- ❌ 再利用前提の資産をContentに置きっぱなし（→ Libraryへ）
- ❌ AI機能を使わずに手動で全部書く（→ Outboundで直接作成すべき）

### Outbound
- ❌ 新規作成時に空のエディタをいきなり開く（→ 文脈を先に選択）
- ❌ Outbound以外の場所で送信実行する（→ Composeのみ）
- ❌ Templateをここで管理する（→ Libraryへ）

### Library
- ❌ 作業中の下書きをLibraryに入れる（→ Contentへ）
- ❌ 単発利用の文面をLibraryに入れる（→ Contentへ）
- ❌ Libraryから直接送信する（→ Outboundへ）

---

## 📊 まとめ

| 機能 | 一言で表すと | 主な利用者 | 平均滞在時間 |
|------|-------------|----------|-------------|
| **Content** | AI作業場 | CSM / AM | 15-30分（作業・調整） |
| **Library** | 資産庫 | 全員（参照）/ 管理者（編集） | 3-5分（検索・適用） |
| **Outbound** | 送信運用 | CSM / AM | 10-20分（作成・配信・確認） |

### 黄金ルール
1. **何度も使う** → **Library**
2. **今回送る** → **Outbound**
3. **まだ作業中 / 顧客別調整中** → **Content**

この3つの役割を明確に区別することで、ユーザーは迷わず適切な機能を選択でき、効率的に顧客向けコンテンツを作成・配信できます。
