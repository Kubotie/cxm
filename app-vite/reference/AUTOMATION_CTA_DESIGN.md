# Automation CTA 設計書

## 概要
Automation は Event / Audience / Content / Outbound / Action / Support を条件分岐つきで接続する上位オーケストレーション機能です。
送信実行は原則 Compose ですが、条件を満たすケースでは Automation から実行可能です。
ただし Auto Send は常に許可せず、role / policy / channel / recipient size / risk 条件で厳密に制御します。

---

## 1. Automation List の CTA 設計

### 主CTA（Primary Actions）
- **New Automation作成** - 新しいAutomationを作成（紫色ボタン、右上配置）
- **開く** - Automation Detailを開く（行クリック + ドロップダウンメニュー）
- **Runs を見る** - Automation Runsを開く（ドロップダウンメニュー）

### 補助CTA（Secondary Actions）
- **複製** - 既存Automationを複製（ドロップダウンメニュー）
- **有効化 / 一時停止** - 状態切り替え（ドロップダウンメニュー、状態に応じて表示）
- **設定** - Automation設定を開く（ドロップダウンメニュー）
- **Detail を見る** - 詳細表示（行クリックで遷移）

### 一覧上で表示する情報
- Automation name（名前 + 目的summary）
- Status badge（Active / Paused / Draft / Error）
- Trigger type badge
- Target summary（対象の簡易説明）
- Steps count（ステップ数）
- Active runs badge（実行中のRun数）
- **Send mode badge**（Draft Only / Review First / Auto Send - 重要な情報として表示）
- Performance（Entered / Completed / Sent）
- Last executed timestamp
- Owner

### 削除したCTA
- 本文を直接編集する
- Content を直接長文編集する
- Outbound の送信実行をここで行う
- 顧客向け送信をここで即時実行する
- Settings を直接変更する

### 強く見せたい状態
- **Active**（緑色badge）
- **Draft**（グレーbadge）
- **Paused**（黄色badge）
- **Needs Review**（該当する場合、Send Mode badgeで表示）
- **Send Restricted**（policyにより制限されている場合）
- **Auto Send Enabled**（紫色badge - policyで許可されている場合のみ）

---

## 2. Automation Builder の CTA 設計

### 主CTA（Primary Actions）
- **保存して有効化** - フローを保存しActiveに（紫色ボタン、右上）
- **下書き保存** - Draftとして保存（outlineボタン、右上）
- **テスト実行** - フローをテスト実行（outlineボタン、右上）
- **ノード を追加** - 新しいノードを追加（左パレット + キャンバス下部の大きいボタン）

### Builder 上部のCTA
- **Back** - Automation Listに戻る（左上）
- **保存して有効化** - 主CTAとして強調
- **下書き保存** - 補助CTA
- **テスト実行** - 補助CTA

### 左パネル（Node Palette）のCTA
- **Trigger を追加** - Triggerノードを追加（色分けされたボタン）
- **Condition を追加** - Conditionノードを追加
- **Audience を追加** - Audienceノードを追加
- **Content を追加** - Contentノードを追加
- **Outbound を追加** - Outboundノードを追加
- **Send を追加** - Sendノードを追加（重要：policy警告付き）
- **Action を追加** - Actionノードを追加
- **Wait を追加** - Waitノードを追加
- **Branch を追加** - Branchノードを追加
- **End を追加** - Endノードを追加

### キャンバス上のCTA
- **ノードをクリック** - ノード設定Sheetを開く
- **設定アイコン** - ノード編集（各ノードカード内）
- **下矢印** - フロー進行の可視化（非アクティブ）

### ノード単位のCTA（Sheet内）
- **保存** - ノード設定を保存
- **キャンセル** - 変更を破棄

### Send ノード専用のCTA（重要）
#### Sheet内で設定できる項目
- **Send Mode 変更** - Draft Only / Review Before Send / Auto Send選択
  - Auto Sendには警告表示「Settings の Automation Send Policies により制御されます。対象件数・リスク条件・権限を確認してください。」
- **Channel 選択** - Email / Slack / Chatwork / In-app notification
- **Policy 確認** - 現在のpolicyに基づく制限を表示（警告box）

#### 表示しない / 強く置かないCTA
- **今すぐ送信** - Send nodeに配置しない
- **Auto send を雑に即時有効化するCTA** - 配置しない
- **無条件の即時送信** - 配置しない

### 右パネル（Summary）のCTA
- **AI Flow Suggestion** - AIによるフロー提案を表示（補助CTA）

### 削除したCTA
- 設定画面を直接編集するCTA
- Content 本文をここで長文編集完結するCTA
- Company / Project の運用画面化するCTA
- 無条件の今すぐ送信
- Auto send を雑に即時有効化するCTA

### AI Suggestion Dialog のCTA
- **この提案を適用** - AI提案を適用
- **閉じる** - ダイアログを閉じる

---

## 3. Automation Detail の CTA 設計

### 主CTA（Primary Actions）
- **編集** - Builderで編集（右上、大きいボタン）
- **Runs を見る** - Automation Runsを開く（右上ボタン）
- **一時停止 / 再開** - 状態切り替え（右上、状態に応じて表示）

### 補助CTA（Secondary Actions）
- **複製** - Automationを複製（ドロップダウンメニュー）
- **有効化 / 無効化** - 状態切り替え（ドロップダウンメニュー）
- **send policy を確認** - Send Policies詳細を表示
- **linked event を開く** - 関連Eventを開く（Linked Resources内）
- **linked audience を開く** - 関連Audienceを開く
- **linked content を開く** - 関連Contentを開く
- **linked outbound を開く** - 関連Outboundを開く
- **linked actions を開く** - 関連Actionsを開く

### タブ構成とCTA
#### Overview タブ
- サマリーカード表示（Steps / Active Runs / Entered / Completed / Sent / Failed）
- Flow summary 表示
- Send mode summary 表示
- Risk / Restriction 確認

#### Flow タブ
- Flow可視化（Builderと同じビジュアル、読み取り専用）
- **編集** - Builderで編集（タブ内ボタン）

#### Performance タブ
- Funnel表示（Conversion率）
- Branch summary 表示
- Performance metrics

#### Linked Resources タブ
- Event / Audience / Content / Outbound / Actions のリンクを表示
- 各リソースを開くCTA

### 削除したCTA
- ここで直接本文編集
- ここで直接顧客送信
- Settings を直接上書き変更
- 実行中 run を直接無理に書き換えるCTA

---

## 4. Automation Runs の CTA 設計

### 主CTA（Primary Actions）
- **Run detail を開く** - Run詳細を表示（行クリック）
- **failed run を見る** - 失敗したRunのフィルター（タブ）
- **review pending を見る** - Review待ちのRunを表示（必要に応じて）

### 一覧上のCTA
- **Run IDをクリック** - Run detailを開く
- **Status filter** - All / Running / Completed / Failed（タブ切り替え）

### Run detail でのCTA（条件付き）
#### 表示できるCTA
- **step log を見る** - 各ステップの実行ログを表示
- **current step を見る** - 現在実行中のステップを表示
- **failed reason を見る** - 失敗理由を表示
- **recipients summary を見る** - 対象者のサマリーを表示
- **linked outbound を開く** - 関連Outboundを開く
- **linked content を開く** - 関連Contentを開く
- **linked audience を開く** - 関連Audienceを開く

#### 条件付きで置けるCTA
- **retry failed step** - 失敗したステップを再実行（Admin / Managerのみ）
- **draft に落とす** - Runを中断しDraftに（条件付き）
- **review queue に送る** - Review Queueに送る（条件付き）

### 削除したCTA
- Settings のポリシーを直接変更するCTA
- Content を長文編集するCTA
- 顧客に即時送信するCTAを run detail の主役にすること

---

## 5. Send Mode ごとの CTA 差分

### Draft Only
#### 強くするCTA
- **draft に保存** - Composeに下書きとして送る
- **Compose で確認** - Composeを開く
- **review queue に送る** - Review Queueに送る（必要に応じて）

#### 削る / 下げるCTA
- Auto send 実行
- そのまま送信

### Review Before Send
#### 強くするCTA
- **review queue に送る** - Review Queueに送る
- **Compose で確認** - Composeで最終確認
- **review status を見る** - Reviewステータスを確認

#### 下げるCTA
- Auto send 有効化
- 即時送信

### Auto Send
#### 強くするCTA
- **send policy を確認** - 現在のpolicyと制限を確認（最重要）
- **recipients preview** - 送信対象者をプレビュー
- **content preview** - 送信内容をプレビュー
- **fallback を確認** - 失敗時のfallback pathを確認
- **last auto run を見る** - 最後の自動実行を確認

#### 重要な表示方針
- **Auto send でも、雑な「送信する」主CTAにしない**
- **自動送信条件と制限が見えることを優先する**
- **policyによる制限を明示する**（警告box、badge、制限summaryなど）

---

## 6. CTA の強弱（視覚的優先度）

### 強いCTA（Primary Button - 紫色、大きい）
- 新規Automation作成
- 保存して有効化
- 編集
- Runs を見る

### 中くらいのCTA（Secondary Button - outline、通常サイズ）
- 下書き保存
- テスト実行
- 複製
- 一時停止 / 再開
- policy を確認
- preview を見る
- review queue に送る

### 弱いCTA（Text Link / Small Button）
- linked record を開く
- branch summary を見る
- change log を見る
- ノード詳細表示

### Danger 扱い（赤色、警告付き）
- 無効化（確認ダイアログ必須）
- 削除（確認ダイアログ必須）
- **Auto send を有効化**（必要なら warning 付き - policyチェック必須）
- 即時再実行（条件付き、確認ダイアログ推奨）

---

## 7. Role ごとの CTA 出し分け

### Admin / Manager
#### 許可されるCTA
- 新規作成 ✅
- 編集 ✅
- 有効化 / 無効化 ✅
- 一時停止 / 再開 ✅
- テスト ✅
- send mode 設定 ✅
- auto send 設定 ✅（policyチェック後）
- rerun / retry ✅

### Lead（必要なら）
#### 許可されるCTA
- 詳細を見る ✅
- Runs を見る ✅
- テスト ✅
- 一部編集 ✅（自分が所有するもののみ）
- auto send 設定は制限可 ⚠️

### 一般ユーザー（CSM）
#### 許可されるCTA
- 閲覧中心 👁️
- 自分が関係する automation の detail / runs のみ
- auto send / policy 変更は不可 ❌

---

## 8. 削るべき CTA（明示的な禁止リスト）

Automation 画面からは、以下を**削除**してください：

❌ Settings の詳細設定を直接上書きするCTA
❌ Company / Project / Support の日常運用をここで完結するCTA
❌ Content の長文編集をここで完結するCTA
❌ 無条件の即時送信
❌ policy を無視した auto send 実行
❌ Send node に「今すぐ送信」だけを強く置く
❌ Auto send の雑な即時有効化
❌ Settings 画面で行うべき設定を Automation 画面に持ち込む
❌ Outbound の送信実行を List 画面で直接行う
❌ 実行中 Run を無理に書き換える

---

## 9. 各画面のCTA配置まとめ

### Automation List
| CTA | 配置場所 | 優先度 | 色 | 条件 |
|-----|---------|--------|-----|------|
| New Automation | 右上 | Primary | 紫色 | Admin/Manager |
| 開く | 行クリック + dropdown | Primary | - | All |
| Runs を見る | dropdown | Primary | - | All |
| 複製 | dropdown | Secondary | - | Admin/Manager |
| 有効化 / 一時停止 | dropdown | Secondary | - | Admin/Manager |
| 設定 | dropdown | Secondary | - | Admin/Manager |

### Automation Builder
| CTA | 配置場所 | 優先度 | 色 | 条件 |
|-----|---------|--------|-----|------|
| 保存して有効化 | 右上 | Primary | 紫色 | Admin/Manager |
| 下書き保存 | 右上 | Secondary | outline | Admin/Manager |
| テスト実行 | 右上 | Secondary | outline | Admin/Manager |
| ノード追加 | 左パレット + キャンバス下部 | Primary | 色分け | Admin/Manager |
| ノード設定 | ノードクリック | - | - | Admin/Manager |
| Send Mode 変更 | Send node sheet内 | Secondary | - | Admin/Manager（policy制御）|
| Policy 確認 | Send node sheet内 | Warning | 黄色box | All（表示のみ）|
| AI Flow Suggestion | 右パネル | Secondary | outline | All |

### Automation Detail
| CTA | 配置場所 | 優先度 | 色 | 条件 |
|-----|---------|--------|-----|------|
| 編集 | 右上 | Primary | 紫色 | Admin/Manager |
| Runs を見る | 右上 | Primary | outline | All |
| 一時停止 / 再開 | 右上 | Secondary | - | Admin/Manager |
| 複製 | dropdown | Secondary | - | Admin/Manager |
| Linked resource を開く | Linked Resources tab | Secondary | link | All |
| Send policy 確認 | Overview tab | Info | - | All |

### Automation Runs
| CTA | 配置場所 | 優先度 | 色 | 条件 |
|-----|---------|--------|-----|------|
| Run detail を開く | 行クリック | Primary | - | All |
| Failed filter | タブ | Primary | - | All |
| Retry failed step | Run detail内 | Danger | outline | Admin/Manager |
| Draft に落とす | Run detail内 | Secondary | outline | Admin/Manager（条件付き）|

---

## 10. Policy による Auto Send 制御の可視化

### Builder の Send Node で表示すべき内容
```
⚠️ Auto Send 制限
このチャネルでのAuto Sendは、Settings の Automation Send Policies により制御されます。
対象件数・リスク条件・権限を確認してください。

現在の制限:
- Email: 最大500件、Enterprise tier は Review必須
- Slack: 最大200件、件数 > 50 で Review必須
- High Risk 企業への Auto Send 制限中
```

### List / Detail で表示すべきバッジ
- **Auto Send Enabled**（紫色）- policyで許可されている
- **Send Restricted**（赤色）- policyで制限されている
- **Review Required**（青色）- Review Before Send
- **Draft Only**（グレー）- Draft Only

### Send Node の設定UIイメージ
```
[ Send Mode ]
○ Draft Only
○ Review Before Send  
○ Auto Send（要policy確認）

⚠️ Auto Send を選択すると、以下の条件が適用されます：
- 対象件数 > 100 の場合、Manager承認必須
- High Risk 企業への送信は Draft Only に変更されます
- Enterprise tier は Review Queue に送られます

[ Policy Status ]
✅ このフローは Auto Send が許可されています
   - チャネル: Email（最大500件）
   - 現在の対象件数: 約120件
   - Review条件: なし
```

---

## まとめ

**Automation の CTA 設計の核心原則:**

1. ✅ **送信実行は可能だが、無制限ではない**
   - Auto Send は policy / role / channel / size / risk で厳密に制御
   
2. ✅ **Send Mode と Policy が一目で分かる**
   - Badge、警告box、設定sheetで常に可視化
   
3. ✅ **設定画面でやるべきことは持ち込まない**
   - Policy設定は Settings タブで行う
   - Automation画面では現在のpolicyを確認・参照するのみ
   
4. ✅ **主CTAは明確に**
   - List: New Automation作成、開く、Runs見る
   - Builder: 保存、テスト実行、ノード追加
   - Detail: 編集、Runs見る、一時停止/再開
   - Runs: Run detail開く、Failed見る
   
5. ✅ **Danger CTAは慎重に**
   - Auto send有効化には警告とpolicyチェック
   - 無効化・削除は確認ダイアログ必須
   
6. ✅ **Roleごとに適切に制限**
   - Admin/Manager: 全権限
   - Lead: 閲覧+一部編集
   - CSM: 閲覧中心

この設計により、Automation を日常運用で**安全かつ使いやすく**します。
