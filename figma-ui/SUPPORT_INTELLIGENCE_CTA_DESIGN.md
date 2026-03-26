# Support Intelligence Settings - CTA 設計仕様書

## 概要
Support Intelligence Settings は、Support Home の Alert Feed の動作を制御する管理画面です。
運用画面ではなく、Manager 以上が設定を調整する場所であるため、以下の原則に従います。

### 基本原則
- ✅ ルール/設定の管理に徹する
- ✅ テスト/検証機能を提供する
- ✅ 変更履歴を追跡可能にする
- ❌ 顧客対応や送信実行はしない
- ❌ Content/Outbound/Action を直接作成しない
- ❌ Support case を直接操作しない

---

## 1. Support AI Settings 全体一覧

### 一覧上に残すCTA

#### 主CTA（Primary Actions）
- **新規ルール作成**（各カテゴリごと）
  - Button: Primary, size="sm"
  - アイコン: Plus
  - ラベル: 「新規ルール作成」
  - 権限: Manager以上

- **詳細を見る**
  - Button: Ghost, size="sm"
  - アイコン: Eye
  - ラベル: 「詳細」
  - 権限: Lead以上

#### 補助CTA（Secondary Actions）
- **ルール一覧を見る**
  - Link または Button: Ghost
  - アイコン: List
  - 権限: Lead以上

- **変更履歴を見る**
  - Button: Ghost, size="sm"
  - アイコン: History
  - 権限: Lead以上

### 削るCTA
- ❌ Support Queue に直接飛んで対応するCTA
- ❌ 顧客ログを見る
- ❌ 送信する
- ❌ 本文作成

### 権限ごとの表示差分
| 権限 | 新規作成 | 編集 | 詳細表示 | 変更履歴 |
|------|----------|------|----------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ |
| Lead | ❌ | ❌ | ✅ | ✅ |
| User | ❌ | ❌ | ❌ | ❌ |

---

## 2. Support Alert Rules

### 一覧上に残すCTA

#### 主CTA（Primary Actions）
- **新規作成**
  - Button: Primary, size="sm"
  - アイコン: Plus
  - ラベル: 「新規ルール作成」
  - 位置: 右上
  - 権限: Manager以上

- **編集**
  - Button: Ghost, size="sm"
  - アイコン: Edit3
  - ラベル: なし（アイコンのみ）
  - 位置: Actions列
  - 権限: Manager以上
  - アクション: モーダル/ドロワーで詳細編集画面を開く

#### 補助CTA（Secondary Actions）
- **テスト**
  - Button: Ghost, size="sm"
  - アイコン: Play
  - ラベル: なし（アイコンのみ）またはTooltip: 「テスト実行」
  - 位置: Actions列
  - 権限: Manager以上
  - アクション: テストモーダルを開く

- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - ラベル: なし（アイコンのみ）
  - 位置: Actions列
  - 権限: Manager以上
  - アクション: 複製確認→新規作成画面を開く（内容コピー済み）

- **有効化/無効化**
  - Toggle または Button: Ghost
  - アイコン: Power または ToggleLeft/ToggleRight
  - 位置: Status列またはActions列
  - 権限: Manager以上
  - アクション: インライン切り替え（確認なし）

- **変更履歴を見る**
  - Button: Ghost, size="sm"
  - アイコン: History
  - ラベル: なし（アイコンのみ）またはメニュー内
  - 位置: Actions列のドロップダウンメニュー内
  - 権限: Lead以上

- **詳細を見る**（読み取り専用）
  - Button: Ghost, size="sm"
  - アイコン: Eye
  - 位置: Actions列
  - 権限: Lead（編集権限がない場合）

### 詳細/編集画面に残すCTA

#### 主CTA（編集モード）
- **保存**
  - Button: Primary
  - アイコン: Save
  - ラベル: 「保存」
  - 位置: 右下フッター
  - 権限: Manager以上

- **キャンセル**
  - Button: Ghost
  - ラベル: 「キャンセル」
  - 位置: 保存ボタンの左
  - 権限: Manager以上

- **テスト**
  - Button: Secondary（Outline）
  - アイコン: Play
  - ラベル: 「ルールをテスト」
  - 位置: 右上またはフッター左
  - 権限: Manager以上
  - アクション: 現在の設定内容でテスト実行→結果表示

#### 補助CTA（編集モード）
- **最近の一致例を見る**
  - Button: Ghost
  - アイコン: List
  - ラベル: 「最近の一致例」
  - 位置: サイドバーまたはセクション内
  - 権限: Manager以上
  - アクション: 直近24h/7dでこのルールに一致したアラート一覧を表示

- **ルールを複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - ラベル: 「複製」
  - 位置: ヘッダー右上
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - ラベル: 「このルールを有効にする」
  - 位置: ヘッダーまたは設定セクション
  - 権限: Manager以上

#### 詳細表示モード（読み取り専用）
- **閉じる**
  - Button: Ghost
  - ラベル: 「閉じる」
  - 位置: 右下フッター
  - 権限: Lead以上

- **変更履歴を見る**
  - Button: Ghost
  - アイコン: History
  - ラベル: 「変更履歴」
  - 位置: ヘッダー右上
  - 権限: Lead以上

### 削るCTA
- ❌ Support case を開く
- ❌ FAQ Draft を作る
- ❌ Outbound を準備
- ❌ Content を作成
- ❌ このルールに一致したアラートから直接対応開始するCTA

### Danger 扱いにするCTA
- **無効化**（既に有効な場合）
  - Status列のToggleまたはボタン
  - 色: danger（red）は使わず、通常の Toggle デザイン
  - 理由: 無効化は破壊的操作ではなく、設定の一部

- **削除**（もし実装する場合）
  - Button: Outline, variant="destructive"
  - アイコン: Trash2
  - ラベル: 「削除」
  - 位置: ドロップダウンメニュー最下部
  - 権限: Admin のみ
  - アクション: 確認モーダル→削除

### 権限ごとの表示差分
| 権限 | 新規作成 | 編集 | テスト | 複製 | 有効化/無効化 | 変更履歴 | 削除 |
|------|----------|------|--------|------|--------------|----------|------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lead | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## 3. Support Suggestion Rules

### 一覧上に残すCTA

#### 主CTA（Primary Actions）
- **新規作成**
  - Button: Primary, size="sm"
  - アイコン: Plus
  - ラベル: 「新規ルール作成」
  - 位置: 右上
  - 権限: Manager以上

- **編集**
  - Button: Ghost, size="sm"
  - アイコン: Edit3
  - 位置: Actions列
  - 権限: Manager以上

#### 補助CTA（Secondary Actions）
- **テスト**
  - Button: Ghost, size="sm"
  - アイコン: Play
  - 位置: Actions列
  - 権限: Manager以上
  - アクション: テストモーダル→サンプル入力でAI提案を生成

- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - 位置: Actions列
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - 位置: Status列
  - 権限: Manager以上

- **変更履歴を見る**
  - Button: Ghost, size="sm"
  - アイコン: History
  - 位置: ドロップダウンメニュー内
  - 権限: Lead以上

### 詳細/編集画面に残すCTA

#### 主CTA（編集モード）
- **保存**
  - Button: Primary
  - アイコン: Save
  - ラベル: 「保存」
  - 位置: 右下フッター
  - 権限: Manager以上

- **テスト**
  - Button: Secondary（Outline）
  - アイコン: Play
  - ラベル: 「提案ルールをテスト」
  - 位置: フッター左または右上
  - 権限: Manager以上
  - アクション: サンプルアラートを入力→AI提案を生成→プレビュー表示

- **キャンセル**
  - Button: Ghost
  - ラベル: 「キャンセル」
  - 位置: フッター
  - 権限: Manager以上

#### 補助CTA（編集モード）
- **Recent Matched Example を見る**
  - Button: Ghost
  - アイコン: List
  - ラベル: 「最近の適用例」
  - 位置: サイドバー
  - 権限: Manager以上
  - アクション: このルールで生成された提案一覧を表示

- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - ラベル: 「複製」
  - 位置: ヘッダー右上
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - ラベル: 「このルールを有効にする」
  - 位置: ヘッダー
  - 権限: Manager以上

### 削るCTA
- ❌ FAQ Draft を直接生成する
- ❌ Content を直接作成する
- ❌ Outbound を直接起票する
- ❌ Event を直接作成する
- ❌ Support case を開いて対応するCTA

重要:
- この画面は「提案ルールを設定する場所」であり、「提案先画面の代替」ではない
- テスト機能は提供するが、実際の提案生成は Support Home / Alert Detail で行われる

### Danger 扱いにするCTA
- **削除**（もし実装する場合）
  - Button: Outline, variant="destructive"
  - アイコン: Trash2
  - 位置: ドロップダウンメニュー最下部
  - 権限: Admin のみ

### 権限ごとの表示差分
| 権限 | 新規作成 | 編集 | テスト | 複製 | 有効化/無効化 | 変更履歴 |
|------|----------|------|--------|------|--------------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lead | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 4. Support Evidence Summary Rules

### 一覧上に残すCTA

#### 主CTA（Primary Actions）
- **編集**
  - Button: Ghost, size="sm"
  - アイコン: Edit3
  - ラベル: なし
  - 位置: Actions列
  - 権限: Manager以上
  - 補足: Summary Rules は事前定義された型（AI Summary, Why This Matters, etc.）のスタイル調整が中心のため、「新規作成」より「編集」が主CTA

- **新規作成**（カスタムサマリー型を追加する場合）
  - Button: Primary, size="sm"
  - アイコン: Plus
  - ラベル: 「新規サマリールール作成」
  - 位置: 右上
  - 権限: Admin のみ

#### 補助CTA（Secondary Actions）
- **テスト**
  - Button: Ghost, size="sm"
  - アイコン: Play
  - ラベル: なし
  - 位置: Actions列
  - 権限: Manager以上
  - アクション: サンプルデータでサマリーを生成→出力例を表示

- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - 位置: Actions列
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - 位置: Status列
  - 権限: Manager以上

- **変更履歴を見る**
  - Button: Ghost, size="sm"
  - アイコン: History
  - 位置: ドロップダウンメニュー内
  - 権限: Lead以上

### 詳細/編集画面に残すCTA

#### 主CTA（編集モード）
- **保存**
  - Button: Primary
  - アイコン: Save
  - ラベル: 「保存」
  - 位置: 右下フッター
  - 権限: Manager以上

- **テスト**
  - Button: Secondary（Outline）
  - アイコン: Play
  - ラベル: 「出力例を生成」
  - 位置: フッター左または右上
  - 権限: Manager以上
  - アクション: サンプルアラートでサマリーを生成→プレビュー表示

- **キャンセル**
  - Button: Ghost
  - ラベル: 「キャンセル」
  - 位置: フッター
  - 権限: Manager以上

#### 補助CTA（編集モード）
- **出力例を見る**
  - Button: Ghost
  - アイコン: FileText
  - ラベル: 「最近の出力例」
  - 位置: サイドバー
  - 権限: Manager以上
  - アクション: 直近でこのルールが生成したサマリーを一覧表示

- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - ラベル: 「複製」
  - 位置: ヘッダー右上
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - ラベル: 「このルールを有効にする」
  - 位置: ヘッダー
  - 権限: Manager以上

### 削るCTA
- ❌ 実際の summary から直接 Support case を変更するCTA
- ❌ 顧客向け送信導線
- ❌ Content 編集
- ❌ Support Detail ページへの直接遷移

重要:
- この画面は「summary style を調整する場所」であり、「運用そのものの画面」ではない
- サマリーの実際の表示は Alert Detail / Support Detail で行われる

### Danger 扱いにするCTA
- なし（Summary Rules は基本的に削除しない）

### 権限ごとの表示差分
| 権限 | 新規作成 | 編集 | テスト | 複製 | 有効化/無効化 | 変更履歴 |
|------|----------|------|--------|------|--------------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lead | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 5. Threshold Presets

### 一覧上に残すCTA

#### 主CTA（Primary Actions）
- **新規作成**
  - Button: Primary, size="sm", variant="outline"
  - アイコン: Plus
  - ラベル: 「新規プリセット作成」
  - 位置: 右上
  - 権限: Manager以上

- **編集**
  - Button: Ghost, size="sm"
  - アイコン: Edit3
  - 位置: Actions列
  - 権限: Manager以上

#### 補助CTA（Secondary Actions）
- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - 位置: Actions列
  - 権限: Manager以上

- **有効化/無効化**
  - 表示のみ（編集画面で切り替え）
  - Badge で Status 表示
  - 理由: Threshold は他のルールが参照するため、一覧上での即時切り替えは混乱を招く

- **Applied Rules を見る**
  - Button: Ghost, size="sm"またはLink
  - アイコン: ExternalLink または Link2
  - ラベル: 「X rules」（適用中のルール数）
  - 位置: Applied Rules 列
  - 権限: Lead以上
  - アクション: このプリセットを使用しているルール一覧をモーダル表示

### 詳細/編集画面に残すCTA

#### 主CTA（編集モード）
- **保存**
  - Button: Primary
  - アイコン: Save
  - ラベル: 「保存」
  - 位置: 右下フッター
  - 権限: Manager以上

- **キャンセル**
  - Button: Ghost
  - ラベル: 「キャンセル」
  - 位置: フッター
  - 権限: Manager以上

#### 補助CTA（編集モード）
- **Applied Rules を見る**
  - Button: Ghost
  - アイコン: List
  - ラベル: 「適用中のルール（X件）」
  - 位置: サイドバーまたはヘッダー
  - 権限: Manager以上
  - アクション: このプリセットを参照しているルール一覧を表示

- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - ラベル: 「複製」
  - 位置: ヘッダー右上
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - ラベル: 「このプリセットを有効にする」
  - 位置: ヘッダー
  - 権限: Manager以上
  - 警告: 無効化すると、使用中のルールに影響が出る旨を表示

### 削るCTA
- ❌ テスト対象 case を直接開く
- ❌ Support item を直接変更するCTA
- ❌ このプリセットを使っているアラートを直接表示するCTA

重要:
- Threshold Presets はルールの構成要素であり、単体でのテストは不要
- 変更の影響範囲（Applied Rules）を明示することが重要

### Danger 扱いにするCTA
- **削除**（使用中のルールがある場合は不可）
  - Button: Outline, variant="destructive"
  - アイコン: Trash2
  - 位置: ドロップダウンメニュー最下部
  - 権限: Admin のみ
  - 条件: Applied Rules = 0 の場合のみ有効
  - アクション: 確認モーダル→削除

### 権限ごとの表示差分
| 権限 | 新規作成 | 編集 | 複製 | 有効化/無効化 | Applied Rules 表示 | 削除 |
|------|----------|------|------|--------------|-------------------|------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lead | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## 6. Feed Display Rules

### 一覧上に残すCTA

#### 主CTA（Primary Actions）
- **編集**
  - Button: Ghost, size="sm"
  - アイコン: Edit3
  - ラベル: なし
  - 位置: Actions列
  - 権限: Manager以上
  - 補足: Feed Display Rules は主要なタブ（All, Urgent, Risk等）ごとに事前定義されているため、「編集」が主CTA

- **新規作成**（カスタムタブを追加する場合）
  - Button: Primary, size="sm", variant="outline"
  - アイコン: Plus
  - ラベル: 「新規ルール作成」
  - 位置: 右上
  - 権限: Admin のみ

#### 補助CTA（Secondary Actions）
- **テスト表示**
  - Button: Ghost, size="sm"
  - アイコン: Eye
  - ラベル: なし
  - 位置: Actions列
  - 権限: Manager以上
  - アクション: このルールを適用した状態の Feed プレビューをモーダル表示

- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - 位置: Actions列
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - 位置: Status列
  - 権限: Manager以上

- **変更履歴を見る**
  - Button: Ghost, size="sm"
  - アイコン: History
  - 位置: ドロップダウンメニュー内
  - 権限: Lead以上

### 詳細/編集画面に残すCTA

#### 主CTA（編集モード）
- **保存**
  - Button: Primary
  - アイコン: Save
  - ラベル: 「保存」
  - 位置: 右下フッター
  - 権限: Manager以上

- **テスト表示**
  - Button: Secondary（Outline）
  - アイコン: Eye
  - ラベル: 「表示プレビュー」
  - 位置: フッター左または右上
  - 権限: Manager以上
  - アクション: 現在の設定でSupport Home の Alert Feed をシミュレート表示

- **キャンセル**
  - Button: Ghost
  - ラベル: 「キャンセル」
  - 位置: フッター
  - 権限: Manager以上

#### 補助CTA（編集モード）
- **複製**
  - Button: Ghost, size="sm"
  - アイコン: Copy
  - ラベル: 「複製」
  - 位置: ヘッダー右上
  - 権限: Manager以上

- **有効化/無効化**
  - Toggle
  - ラベル: 「このルールを有効にする」
  - 位置: ヘッダー
  - 権限: Manager以上

### 削るCTA
- ❌ 実運用 feed にそのまま遷移して対応開始するCTA
- ❌ Outbound 準備
- ❌ Content 作成
- ❌ Action 作成
- ❌ Support Home への直接遷移ボタン

重要:
- Feed Display Rules は「見え方の管理」であり、「Support Home 自体の代替」ではない
- テスト表示はプレビューのみで、実際の運用は Support Home で行う

### Danger 扱いにするCTA
- **削除**（デフォルトタブは削除不可）
  - Button: Outline, variant="destructive"
  - アイコン: Trash2
  - 位置: ドロップダウンメニュー最下部
  - 権限: Admin のみ
  - 条件: カスタムルールのみ削除可能

### 権限ごとの表示差分
| 権限 | 新規作成 | 編集 | テスト表示 | 複製 | 有効化/無効化 | 変更履歴 |
|------|----------|------|-----------|------|--------------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lead | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

---

## 7. CTA の強弱とデザイン指針

### 強いCTA（Primary）
使用場面: 画面の主要アクション
- **新規作成**
- **保存**
- **テスト**（編集画面内）
- **テスト表示**（編集画面内）

デザイン:
- Button variant: "default" (Primary)
- size: "default" または "sm"
- 色: Indigo/Blue系（ブランドカラー）

### 中程度のCTA（Secondary）
使用場面: 補助的だが重要なアクション
- **複製**
- **有効化/無効化**（Toggle）
- **最近の一致例を見る**
- **出力例を見る**
- **Applied Rules を見る**
- **変更履歴を見る**

デザイン:
- Button variant: "ghost" または "outline"
- size: "sm"
- アイコン付き

### 弱いCTA（Tertiary）
使用場面: 補足的な情報参照
- **詳細を見る**（読み取り専用モード）
- **関連設定を見る**
- **閉じる**

デザイン:
- Button variant: "ghost"
- size: "sm"
- 色: Slate/Gray系

### Danger 表現を使うCTA
使用場面: 破壊的操作（最小限）
- **削除**（Admin のみ、条件付き）
- **無効化**（ただし通常のToggleデザインでOK、danger色は不要）

デザイン:
- Button variant: "destructive" または "outline" + text-red
- アイコン: Trash2
- 確認モーダル必須

### アイコン一覧
| CTA | アイコン | 補足 |
|-----|----------|------|
| 新規作成 | Plus | |
| 編集 | Edit3 | Pencil も可 |
| 保存 | Save | |
| キャンセル | X | アイコン不要の場合も |
| テスト | Play | TestTube も可 |
| テスト表示 | Eye | Monitor も可 |
| 複製 | Copy | |
| 有効化/無効化 | ToggleLeft/Right または Power | |
| 変更履歴 | History | Clock も可 |
| 詳細 | Eye | ChevronRight も可 |
| 削除 | Trash2 | |
| 最近の一致例 | List | FileText も可 |
| Applied Rules | Link2 | ExternalLink も可 |

---

## 8. モーダル/ドロワー設計

### 編集画面の表示方法
- **Alert Rules**: モーダル（中〜大サイズ）
- **Suggestion Rules**: モーダル（大サイズ）またはドロワー（右から）
- **Summary Rules**: モーダル（中サイズ）
- **Threshold Presets**: モーダル（小〜中サイズ）
- **Feed Display Rules**: モーダル（中サイズ）

### テスト結果の表示方法
- **Alert Rules**: モーダル内にテスト結果セクションを展開
- **Suggestion Rules**: モーダル内にAI提案プレビューを表示
- **Summary Rules**: モーダル内にサマリー出力例を表示
- **Feed Display Rules**: 別モーダルで Feed プレビューを表示

### 変更履歴の表示方法
- サイドパネル（右から）またはモーダル
- Timeline 形式で変更内容を表示
- diff ビューで変更箇所を強調

---

## 9. 一覧とアクションの配置パターン

### 推奨レイアウト

#### パターンA: Actions列にアイコンボタン集約
```
| Rule Name | Alert Type | ... | Status | Actions |
|-----------|------------|-----|--------|---------|
| xxx       | Urgent     | ... | Active | [Edit][Test][Copy][⋮] |
```

- 主要アクション（Edit, Test, Copy）: 常時表示
- その他アクション（History, Delete）: ドロップダウンメニュー（⋮）内

#### パターンB: Status列にToggle、Actions列にボタン
```
| Rule Name | Alert Type | ... | Status  | Actions |
|-----------|------------|-----|---------|---------|
| xxx       | Urgent     | ... | [Toggle]| [Edit][⋮] |
```

- Status列: Toggle で有効/無効を即時切り替え
- Actions列: Edit が主CTA、その他はメニュー内

### 推奨パターン
- **Alert Rules, Suggestion Rules**: パターンA（テストボタンを常時表示したい）
- **Summary Rules, Feed Display Rules**: パターンB（テストは編集画面内で十分）
- **Threshold Presets**: パターンB（テスト不要）

---

## 10. 権限制御の実装方針

### 権限レベル
1. **Admin**: すべての操作が可能
2. **Manager**: ルールの作成・編集・テスト・有効化が可能（削除は不可）
3. **Lead**: 読み取り専用（詳細表示・変更履歴のみ）
4. **User**: アクセス不可

### 実装パターン

#### ボタンの出し分け
```tsx
// 例: 編集ボタン
{(userRole === 'Admin' || userRole === 'Manager') && (
  <Button variant="ghost" size="sm">
    <Edit3 className="w-4 h-4" />
  </Button>
)}

// 例: 詳細ボタン（読み取り専用）
{userRole === 'Lead' && (
  <Button variant="ghost" size="sm">
    <Eye className="w-4 h-4" />
  </Button>
)}
```

#### Toggle の無効化
```tsx
<Switch
  checked={rule.enabled}
  disabled={userRole !== 'Admin' && userRole !== 'Manager'}
  onCheckedChange={handleToggle}
/>
```

---

## 11. 実装チェックリスト

### Alert Rules
- [ ] 一覧: 新規作成ボタン（Primary, 右上）
- [ ] 一覧: 編集ボタン（Actions列）
- [ ] 一覧: テストボタン（Actions列）
- [ ] 一覧: 複製ボタン（Actions列）
- [ ] 一覧: 有効/無効Toggle（Status列またはActions列）
- [ ] 一覧: 変更履歴ボタン（メニュー内）
- [ ] 編集: 保存ボタン（Primary, フッター右）
- [ ] 編集: テストボタン（Secondary, フッター左または右上）
- [ ] 編集: キャンセルボタン（Ghost, フッター）
- [ ] 編集: 最近の一致例を見るボタン（Ghost, サイドバー）
- [ ] 編集: 複製ボタン（Ghost, ヘッダー右上）
- [ ] 編集: 有効/無効Toggle（ヘッダー）

### Suggestion Rules
- [ ] 一覧: 新規作成ボタン
- [ ] 一覧: 編集ボタン
- [ ] 一覧: テストボタン
- [ ] 一覧: 複製ボタン
- [ ] 一覧: 有効/無効Toggle
- [ ] 一覧: 変更履歴ボタン
- [ ] 編集: 保存ボタン
- [ ] 編集: テストボタン
- [ ] 編集: キャンセルボタン
- [ ] 編集: Recent Matched Example ボタン
- [ ] 編集: 複製ボタン
- [ ] 編集: 有効/無効Toggle

### Summary Rules
- [ ] 一覧: 編集ボタン（主CTA）
- [ ] 一覧: テストボタン
- [ ] 一覧: 複製ボタン
- [ ] 一覧: 有効/無効Toggle
- [ ] 一覧: 変更履歴ボタン
- [ ] 編集: 保存ボタン
- [ ] 編集: テストボタン（出力例生成）
- [ ] 編集: キャンセルボタン
- [ ] 編集: 出力例を見るボタン
- [ ] 編集: 複製ボタン
- [ ] 編集: 有効/無効Toggle

### Threshold Presets
- [ ] 一覧: 新規作成ボタン（Outline）
- [ ] 一覧: 編集ボタン
- [ ] 一覧: 複製ボタン
- [ ] 一覧: Applied Rulesリンク
- [ ] 編集: 保存ボタン
- [ ] 編集: キャンセルボタン
- [ ] 編集: Applied Rulesボタン
- [ ] 編集: 複製ボタン
- [ ] 編集: 有効/無効Toggle（警告付き）

### Feed Display Rules
- [ ] 一覧: 編集ボタン（主CTA）
- [ ] 一覧: テスト表示ボタン
- [ ] 一覧: 複製ボタン
- [ ] 一覧: 有効/無効Toggle
- [ ] 一覧: 変更履歴ボタン
- [ ] 編集: 保存ボタン
- [ ] 編集: テスト表示ボタン（プレビュー）
- [ ] 編集: キャンセルボタン
- [ ] 編集: 複製ボタン
- [ ] 編集: 有効/無効Toggle

---

## 12. 削除したCTAの確認リスト

以下のCTAは、Support Intelligence Settings には実装しません。

### 削除対象CTA
- ❌ Support Queue / Support Home への直接遷移ボタン
- ❌ Support case を開く
- ❌ 顧客ログを直接見る
- ❌ 送信する
- ❌ 本文作成
- ❌ FAQ Draft を直接生成
- ❌ Content を直接作成
- ❌ Outbound を直接起票
- ❌ Event を直接作成
- ❌ Action を直接作成
- ❌ アラートから直接対応開始
- ❌ 顧客向け送信導線
- ❌ Content 編集画面への直接遷移

### 理由
この画面は「ルール/設定の管理画面」であり、「運用画面」ではありません。
実際の運用は Support Home / Alert Detail / Support Detail で行われます。

---

## まとめ

Support Intelligence Settings のCTA設計は、以下の原則に従います。

1. **ルール管理に徹する**: 作成・編集・テスト・検証・履歴管理のみ
2. **運用CTAを置かない**: 送信・対応・作成などの日常業務CTAは除外
3. **テスト機能を充実**: プレビュー・出力例・一致例で動作確認を支援
4. **変更の影響範囲を明示**: Applied Rules, 最近の一致例で透明性を確保
5. **権限制御を徹底**: Admin/Manager/Lead で明確に機能を分離

この設計により、Manager以上が Support - Alert Feed の動作を安全かつ効率的に調整できる環境を提供します。
