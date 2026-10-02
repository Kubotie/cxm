# Ptengine AI パイプラインダッシュボード — 操作フローと挙動の全量（Vercel 移植用）

**作成日**: 2026-09-30
**対象**: claude.ai アーティファクト版 Version 96（https://claude.ai/artifact/8Z8UYWwNdvrQcP6n5958wp）
**用途**: 別セッションで Claude Code が Vercel 版を構築するときの仕様書

この文書は次の3つからなります。
- 現行版でメンバーが行う操作をすべて洗い出し、各操作の「画面の挙動」「保存するデータ」「承認などの制約」を書いたもの
- その保存先を Vercel 版でどこに置き換えるかの対応表
- 対応表で使う、Twenty（test テーブル）と Notion の設計案

関数名・状態名は現行ソース（単一 HTML）に合わせています。

---

## 0. 前提と連携方針（Utty 決定、2026-09-30）

| データ | 正本 | Vercel 版での扱い |
|---|---|---|
| アカウント情報（企業名・Tier・業種・担当・MRR など） | Notion「🗂️ Ptengine AI 顧客管理DB」 | 読み書きとも Notion。ツールからの更新も**リアルタイムで Notion に反映**（双方向） |
| 目標数値（チーム目標・メンバー別目標・（目標）追加MRR） | Notion | Notion から読む（格納場所は §9 の未決事項 1） |
| 議事録 | Notion「JP_Docs DB」（Category＝議事録） | 読むだけ |
| 商談（Opportunity） | Twenty の test テーブル | ツールから作成・更新 |
| アクション（ネクストアクション、サクセス Todo） | Twenty の test テーブル | ツールから作成・更新・完了 |
| 人物（組織図の人） | Twenty の test テーブル | ツールから作成・更新 |
| 活動記録（アクション完了・フェーズ前進・障壁更新・打ち合わせ） | Twenty の test テーブル | ツールから追記 |
| 操作記録（誰がいつ何を変えたか） | Twenty の test テーブル | ツールから追記（監査ログ） |
| AI の出力（組織図案・サクセス案・サマリー・直近の動き） | ツール内 | UI で「保存・編集・削除」してから送信 → 同期 |

**Twenty の扱い**
- Twenty の既存ワークスペースのデータ（Company・Opportunity 等）は**参照しません**。
- すべて `test` を名前に付けた新しいオブジェクトを作って使います（§7）。
- 構築は Claude Code が Twenty の Metadata API／REST（または GraphQL）で行います。

**Notion の扱い**
- 顧客管理DB（data source `collection://25ef5c40-d968-45d7-9120-7f1878006682`）
- JP_Docs DB（data source `collection://5f583654-f021-4bb9-8661-01a75fe818c7`）

---

## 1. 画面構成

| 画面 | 主な要素 |
|---|---|
| トップ | 表示の切り替え（チーム全体／各メンバー）、KPI、目標到達ステージ、メンバー別の目標配分と進捗、申込完了予定月別パイプライン、フェーズ別パイプライン、担当者へのお知らせ、新着フィード、企業一覧（目標の積み上げゲージ付き） |
| 企業詳細（右ドロワー） | 見出し（現在MRR・（見込）追加MRR・合算MRR・期待値）、タブ6つ：要約／組織図／商談管理／サクセス管理／行動履歴／議事録 |
| 非表示（コードは残っている） | 1年間プランニング、イシュー、確認事項 |

**利用者と権限**
- 閲覧者は `user` capability（profile）で識別します。
- 承認者は `IS_APPROVER`（ページ所有者＝Utty）です。Vercel 版では、ロールを「承認者（Utty）」と「メンバー」の2つにします。

---

## 2. 操作フロー一覧

表記：
- **ID**：フロー番号
- **起点**：どこで何をするか
- **挙動**：画面で起きること
- **保存（現行）**：現行版の共有 DB（`window.claude` db）のコレクション
- **保存（Vercel）**：移植後の書き込み先（§7・§8 のオブジェクト名）

どの保存でも、共通の後処理として次の3つを行います（§6）。
- 画面の即時反映
- 操作記録（`testOperationLog`）の追記
- 新着フィード（`feed`）への差分の記録

### A. 共通操作

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| A-01 | 右上の「チーム全体／Paul／Baba…」 | 全セクションをそのメンバーの担当分に絞る（`view`）。KPI・ゲージ・お知らせ・一覧が連動 | なし（画面状態） | URL クエリまたはユーザー設定 |
| A-02 | 企業一覧の担当・フェーズ・Tier フィルタ（複数選択） | 一覧・ゲージ・お知らせの範囲が変わる。条件は閲覧者ごとに保存 | localStorage `pgaBoard.filters` | ユーザー設定（localStorage で可） |
| A-03 | 一覧の列見出しクリック | 並べ替え。「（目標）追加MRR」順では、目標に届く行の下に「ここまでで目標 N 万に到達」の区切り（`tr.gsep`） | なし | なし |
| A-04 | 一覧のページ送り・表示件数 | ページング | localStorage `pgaBoard.pageSize` | 同左 |
| A-05 | 企業名クリック | 企業詳細ドロワーを開く（`openDeal(id, tab)`） | なし | なし |
| A-06 | ドロワーの「⤢ 全画面」／左端のドラッグ | 全画面表示／幅の変更 | localStorage `pgaBoard.drawerFull`・`pgaBoard.drawerW` | 同左 |
| A-07 | お知らせの種類ボタン | 種類で絞り込み | localStorage `pgaBoard.alertCat` | 同左 |
| A-08 | ツールチップ（`data-tip`） | マウスを乗せると説明を表示 | なし | なし |

### B. トップ画面

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| B-01 | KPI の「目標を編集」 | チーム目標額・期限・メンバー別目標の編集フォーム（`#targetEditor`）。保存でゲージ・配分が再計算 | `settings/targets`（`targetMrr`, `targetDue`, `targets{member:円}`） | **Notion**（§9-1） |
| B-02 | メンバー名クリック | そのメンバーの個人ビューへ（A-01 と同じ） | なし | なし |
| B-03 | 申込完了予定月別パイプラインの「申込完了日／課金開始日」「期待値／想定」「累積と目標ライン」 | グラフの基準・指標・累積表示の切り替え | なし | なし |
| B-04 | 「作成できない項目を見る ↓」 | 入力不足の一覧（`#gaps`）へスクロール | なし | なし |
| B-05 | フェーズ別パイプラインのカード | そのフェーズで一覧を絞り込み（`phaseFilter`） | なし | なし |
| B-06 | お知らせの項目クリック | 該当企業の詳細を、該当タブで開く | なし | なし |
| B-07 | 新着フィードの項目 | 直近14日の変更（誰が・どの会社の・何を）を表示。クリックで企業詳細 | `feed`（追記のみ） | `testOperationLog` から表示 |

**お知らせの発生条件**（`renderAlerts`、すべて画面側で計算し、保存はしません）

| 種類 | 条件 |
|---|---|
| 承認待ち | `pendingPhase` がある、または受注済み商談に `pendingEdit`・`pendingDelete` がある |
| 予定より遅れ | 到達予定（`ms`）の日を過ぎても、そのフェーズに未到達（`msLate`）。障壁の内容も表示 |
| 期限超過 | ネクストアクションの期日が今日より前、またはサクセス Todo の期日が今日より前 |
| 今週すべきこと | 上記の期日が今日〜7日後 |
| 未解決イシュー | 旧プランの ISSUE が未完了 |
| 商談の入力不足 | 商談中なのに（見込）追加MRR・申込完了日・ネクストアクション・アクション期日のどれかが空 |
| 目標MRR未入力 | 商談中で（目標）追加MRR が空、かつ（見込）追加MRR が10万未満 |
| サクセスプラン未作成 | 商談中で `aplans` に四半期の狙いも Todo もない |
| 組織図未作成 | 商談中で `orgs` がない |

### C. 企業一覧

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| C-01 | 「（目標）追加MRR」列の「＋目標」／金額クリック（`aimCell`） | 金額（万円）を入れて確定。一覧上部の目標ゲージが再計算 | `edits/<cid>.company.aim`（円） | **Notion 顧客管理DB**（§8 の対応表：`想定追加MRR` 案） |
| C-02 | 企業名の左の ▶（`data-caret`） | 会社の下に商談の行を開閉 | なし | なし |
| C-03 | フェーズのチップ（`data-phedit`） | その場でフェーズを変更（F-04 と同じ処理。承認ルールあり） | `edits/<cid>` | `testOpportunity.stage` |
| C-04 | 「＋商談を追加」 | 企業詳細の商談管理タブを開き、新規商談フォームを表示（F-02） | — | — |
| C-05 | 一覧上部の「企業を追加」（`#ncOpen`） | 会社名・ドメイン・業種・Tier・きっかけ・担当・メモを入れて保存。重複（同名・同ドメイン）は警告（`ncDup`）。保存するとダッシュボードに即時追加し、Notion と Twenty にも作成 | `newcos/<id>`、Notion `notion-create-pages`、Twenty `create_one_company` | **Notion 顧客管理DB にページ作成**（正本）＋ Twenty には作らない（§0）。同期状態の印を表示 |

### D. 企業詳細：見出し・要約タブ

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| D-01 | 基本情報の Tier・業種をクリック（`data-coed`、`saveCompanyField`） | 選択肢から変更。元の値と違うと「同期待ち」の印（`twentyPending`） | `edits/<cid>.company.tier/ind` | **Notion 顧客管理DB `Tier`・`業種`** に即時書き込み |
| D-02 | 「✦ AI でサマリーを作成」（取り組みサマリー） | 議事録・チャット・CRM・商談の入力・組織図を集め、AI が要約を作る | 要約のキャッシュ（`recent/<cid>` 等） | AI 出力 → UI で確認して保存（§5） |
| D-03 | 直近の動きの「✦ AI で推計」（`data-recent`） | 議事録・チャットから直近の動きを AI が整理 | `recent/<cid>` | AI 出力 → 確認して保存 → `testActivity`（種類＝AI推計）として送信 |
| D-04 | 商談カード（要約内） | 商談ごとの要点。クリックで商談管理タブへ | — | — |
| D-05 | キー日程（決算月・予算策定時期・契約更新）の編集（`data-kdin`/`data-kdok`、`saveKeyDates`） | 月・期間、または「情報なし」を入れて保存。サクセスの逆算の前提になる | `edits/<cid>.company.keyDates` | Notion 顧客管理DB に項目を追加するか、Twenty `testAccountPlan`（§9-4） |
| D-06 | 「Notion 顧客ページ ↗」 | Notion の顧客ページを開く | — | — |

### E. 企業詳細：組織図タブ

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| E-01 | 表示 | 人・グループ・部署の木（子は人→グループ→部署の順）。決裁者はオレンジ枠、★は影響力、色の点は態度（推進・中立・慎重・反対・不明）、点線は未接触。上部に「未接触の決裁・影響者」「慎重・反対」の帯 | `orgs/<cid>.nodes[]` | `testPerson`（＋グループ・部署は `testOrgUnit` か `testPerson.nodeType`） |
| E-02 | ★（`data-star`） | 影響力フラグの切り替え。即保存 | `orgs/<cid>` | `testPerson.influential` |
| E-03 | カードをドラッグ → 別カードに落とす | 親子関係の変更案を作る（`ui.pend`）。「確定する」で保存、「取り消す」で破棄 | `orgs/<cid>`（確定時） | `testPerson.parentId` を更新 |
| E-04 | カードの編集（`#oe*`：`oeChild`・`oeDel`・`oeClose`） | 名前・役職・態度・決裁者・接点・情報源（公開／社内／推定）の編集、子の追加、削除 | `orgs/<cid>` | `testPerson` の作成・更新・削除 |
| E-05 | 「名刺を読み込む」／写真のドロップ（複数枚可） | 画像を AI が読み取り、変更案（追加・更新）として表示。確認して反映 | 反映時に `orgs/<cid>` | AI 出力 → 確認 → `testPerson` 作成／更新 |
| E-06 | AI 相談（`orgGenerate`、会話で継続） | 資料・議事録・チャット・担当者メモから組織図の変更案（`ai.draft`）と質問を生成。✓（採用）・✎（直して採用）・×（採用しない）。メモは `orgs/<cid>.memos` に残る | 採用時に `orgs/<cid>` | AI 出力 → 確認 → 送信（§5） |
| E-07 | 変更の履歴 | 直近15件の変更の要約（`history`） | `orgs/<cid>.history` | `testOperationLog` |

### F. 企業詳細：商談管理タブ

**商談カードの表示（`dealSum`・`jrRow`・`jrList`）**
- **件数表示**：商談が2件以上なら、先頭に「商談 N件　進行中 N　受注 N」。
- **見出し**：商談番号（2件以上のとき）・商談名（「Ptengine AI - 」を省く）・フェーズ・追加MRR・申込・課金。承認待ちがあれば印を付ける。
- **道のり**：スタート → 過去の節目 → 今日 → これからの節目 → ゴール（申込用紙回収）。
  - 実績は青の実線、予定は点線。
  - 到達済みは ✓、次の節目は青の輪、予定を過ぎて未到達は赤の「!」。
  - 線の上に、アクション完了の点・障壁更新のひし形・次のネクストアクションの点線の丸を置く。点にマウスを乗せると内容が出る。
- **経過**：フェーズごとのまとまり。過去は畳み、いまのフェーズは直近3件。欄は最大高さ 300px。
- **ネクストアクション行と障壁行**
- **受注済みの商談**：1行の要約（「✓ 受注しました」・日付・金額）。
- **並び順**：進行中 → 受注 → 失注

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| F-01 | 商談カードの見出しクリック（`data-dsel`） | 入力欄の開閉（`DEAL_OPEN`） | なし | なし |
| F-02 | 「＋ 商談を追加」（`data-dsel="new"`） | 新規フォーム。商談名・フェーズ・（見込）追加MRR・申込完了日など。保存で商談が追加される | `edits/<cid>.deals[]`（key を採番） | `testOpportunity` 作成 |
| F-03 | 入力欄の各項目を変えて「保存」（`efForm` submit） | 商談名、フェーズ、追加MRR（万円）、申込完了日、課金開始日、到達予定、契約期間、障壁の内容、ニーズ、ネクストアクション、アクション期日、失注理由・詳細を保存。フェーズ・障壁が変わると経過に自動記録。変更は新着フィードにも出る | `edits/<cid>`（main は `opp`、他は `deals[]`） | `testOpportunity` 更新。ネクストアクションは `testAction`、経過は `testActivity` |
| F-04 | フェーズの変更（入力欄・チップ・`setPhase`） | 契約締結済みに入れる／外す変更は、Utty 以外だと `pendingPhase`（承認待ち）になる。Utty はすぐ反映。反映時に経過へ `{t:'ph',from,to}` | `edits/<cid>` | `testOpportunity.stage`／`pendingStage` |
| F-05 | 承認待ちの「承認」（`data-approve`、`approvePhase`） | Utty のみ。`pendingPhase` をフェーズに反映し、`approvedAt` を記録 | `edits/<cid>` | 同上＋`testOperationLog`（承認） |
| F-06 | 到達予定（`#msBox`、`wireMs`） | 申込完了日（または課金開始日−14日）から、トライアル 49・最終見積 35・口頭合意 10 日前を自動で入れる（土日は金曜、短いときは圧縮）。基準の切り替え（`msBase`）、日付の直接入力・カレンダー（2020〜2099年）、手で変えた日付は「変更済み」、「↺ 基準から引き直す」（`#msReset`） | `ms{TRIAL,QUOTE,VERBAL_COMMIT}`, `msBase` | `testOpportunity.msTrial` / `msQuote` / `msVerbal` / `msBase` |
| F-07 | ネクストアクションの「✓ 完了」（`data-nadone`、`completeNa`） | 結果メモ（任意）を入れて「完了にする」。経過に `{t:'na',text,due,note,ph}` を追加し、ネクストアクションを空にして、次の入力欄にフォーカス | `edits/<cid>` の `log[]` | `testAction.status=DONE`（＋`result`）、`testActivity`（種類＝アクション完了） |
| F-08 | 障壁の内容を書き換えて保存 | 経過に `{t:'br',text}`。道のりにひし形 | `log[]` | `testOpportunity.barrier` 更新＋`testActivity`（種類＝障壁更新） |
| F-09 | 経過のまとまりの見出し（`data-jg`） | 過去フェーズのまとまりの開閉、いまのフェーズの「ほか N件を表示」 | なし | なし |
| F-10 | 「この商談を削除」（`#efDel`） | 確認欄（「削除する」「やめる」、最初は「やめる」が選ばれた状態）。main の商談には表示しない | `edits/<cid>.deals[]` から除く | `testOpportunity` を論理削除（`deletedAt`） |
| F-11 | 受注済み商談の変更・削除（Utty 以外、`wonLocked`） | 入力欄の上に注意を表示。保存しても値は変えず `pendingEdit`（変更後の値＋`requestedAt`・`requestedBy`）。削除は `pendingDelete`。変更がなければ「変更はありません」 | `edits/<cid>` | `testOpportunity.pendingEdit`（JSON）／`pendingDelete` |
| F-12 | 承認待ちの欄（`aprBox`）：「変更を承認／削除を承認」「却下」「申請を取り消す」（`data-peok`/`data-peno`、`decidePe`） | 承認で反映（変わったフェーズ・障壁は経過にも記録）、却下・取り消しで申請を消す。承認は Utty のみ | `edits/<cid>` | 同上＋`testOperationLog` |
| F-13 | 失注（フェーズ＝失注） | 失注理由・詳細を入力。フォロー間隔（1/3/6か月）を入れると、定期フォローの予定を自動作成（`ensureFollowUps`） | `edits/<cid>`、`plans` | `testOpportunity.lostReason`、`testAction`（種類＝フォロー） |

**フェーズ（Salesforce と同じ）と確率**

| キー | 表示名 | 確率（暫定） |
|---|---|---|
| NOT_STARTED | 初回アポ実施前 | 0% |
| FIRST_MEETING | 初回アポ実施済み | 10% |
| TRIAL | トライアル開始済み | 30% |
| QUOTE | 最終見積もり提示済み | 55% |
| VERBAL_COMMIT | 口頭合意獲得済み | 80% |
| APPLICATION | 申込用紙回収済み | 95% |
| CLOSED_WON | 契約締結済み | 100% |
| CLOSED_LOST | 失注 | 0% |

旧キーは読み込み時に置き換えます（`PH_LEGACY`）：RE_PROPOSAL・EVALUATION → TRIAL、APPROVAL → QUOTE。

### G. 企業詳細：サクセス管理タブ

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| G-01 | 表示：合計MRR の推移（最上部） | 現在 → 各四半期末の合計MRR を棒で表示。上限（グレー）・目標（金色）の点線。上限超過は赤で警告、目標到達の棒は金色 | 計算のみ | 計算のみ |
| G-02 | 四半期カードの ✎（`data-qedit`、`qsave`/`qcancel`） | その四半期のサクセス状態（goal）と狙う追加MRR（aim）を編集 | `aplans/<cid>.quarters['YYYY-Qn']` | `testAccountPlan`（四半期ごと）（§7） |
| G-03 | ‹ › | 表示する四半期をずらす | なし | なし |
| G-04 | 月のプランに Todo を追加（`data-iadd`、`data-addt`） | 「活用・サクセス」「アカウント攻略」の2レーン。週（`data-iweek`）かカレンダーの日付（`data-idate`）で期日を指定 | `aplans/<cid>.items[]` | `testAction`（種類＝サクセス、`lane=use/exp`） |
| G-05 | Todo のチェック（`data-idone`）・編集（`data-iedit`/`iedf`）・削除（`data-idel`） | 完了・編集・削除。完了で `doneAt` を記録し、行動履歴に出る | `aplans/<cid>.items[]` | `testAction` 更新／論理削除、完了時に `testActivity` |
| G-06 | 「AI で作成」（`aplanGenerate`） | 会社情報・商談・組織図・キー日程・上限から、四半期の狙いと月の Todo の案を AI が生成 | `aplans/<cid>.ai` | AI 出力 → 確認 → 送信（§5） |
| G-07 | AI 案の ✓（`data-itake`/`qtake`）・✎（`data-imod`/`qmod`）・×（`data-ino`/`qno`）、まとめて採用（`data-itakeall`） | 採用・直して採用で本データへ。不採用で案を閉じる（`closed`） | `aplans/<cid>` | 採用時に `testAction`／`testAccountPlan` 作成 |
| G-08 | 進捗の表示 | 選択中の月・その四半期・計画全体の完了率。遅れは期日で判定（`itemDue`） | 計算のみ | 計算のみ |

### H. 企業詳細：行動履歴タブ

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| H-01 | 表示（`actHist`） | 商談の経過（アクション完了・フェーズ前進・障壁更新）、サクセス Todo の完了、打ち合わせ（Notion・Mii・Twenty）、CRM の記録を、月ごとに新しい順で1本にまとめる。予定のネクストアクションは「これから」 | 読むだけ | `testActivity`（＋予定は `testAction`）から表示 |
| H-02 | 種類のボタン（`data-hf`） | すべて／商談／サクセス／議事録／CRM で絞り込み | なし | なし |

### I. 企業詳細：議事録タブ

| ID | 起点 | 挙動 | 保存（現行） | 保存（Vercel） |
|---|---|---|---|---|
| I-01 | 表示（`minutesTab`） | Mii・Notion・Twenty の議事録を日付の新しい順に並べ、最新だけを開く。どこから来た議事録かの印、「Notion で開く ↗」 | `minutes/<cid>` を読む | JP_Docs DB を直接読む（キャッシュ可） |
| I-02 | 「↻ 最新に更新」（`minutesRefresh`） | 閲覧者の Notion 接続で検索（`notion-search`）。対象は、タイトルに日付（YYYYMMDD）または MTG・議事録・定例・打合せを含むページ。Company Database・account planning・Research は除外。上位6件を取得（`notion-fetch`）し、本文を整形（`notionBody`、1件 6,000 字）して共有に保存 | `minutes/<cid>` | **JP_Docs DB を API で照会**（§8-2）。取り込んだ議事録は `testActivity`（種類＝打ち合わせ）として紐づけ |
| I-03 | Mii の議事録 | ページからは取り込めない。Claude が同期した `minutes/<cid>.mii` を表示 | `minutes/<cid>.mii` | サーバー側で Mii API（個人トークン、`mii_…`）から取得するジョブ（§9-5） |

---

## 3. 自動計算のルール（保存しない値）

| 値 | 計算 |
|---|---|
| 合算MRR | 現在MRR ＋ 追加MRR。追加MRR が10万円以上の会社だけ算入（足切り `AI_MIN`） |
| 確定MRR | フェーズ＝**申込用紙回収済み または 契約締結済み**の追加MRR（10万以上）。課金開始日を過ぎたら現在MRR に上乗せ ※§9-6 の回答（2026-10-01）で申込用紙回収済みを追加 |
| 期待値MRR | 現在MRR × フェーズの確率（10万の足切りあり） |
| 商談中の合算MRR | 初回アポ実施済み〜**口頭合意獲得済み**で、（見込）追加MRR が10万以上 ※§9-6 で申込用紙回収済みを確定に移したため、二重計上を避けて除外 |
| 目標の積み上げ | 各社の計上額 ＝ 現在MRR ＋ max（（見込）追加MRR,（目標）追加MRR）（10万以上のみ）× 担当の持分（共同担当は均等割）。内訳は 確定 → 商談中 → 狙い |
| ポテンシャル | 業界適合度（3〜15）と ARPA 上限（業界 × 規模層。規模層が不明なら Mid） |
| 到達予定の逆算 | 申込完了日（または課金開始日−14日）から 49／35／10 日前。土日は金曜、短いときは圧縮 |
| 遅れの判定 | 到達予定の日を過ぎてもそのフェーズに未到達 → 「予定より遅れ」 |
| ネクストアクションの状態 | 期日が今日より前 → 期限超過、7日以内 → 今週すべきこと |

---

## 4. 状態遷移

### 4-1. フェーズ
- 左から順に進みます：初回アポ実施前 → 初回アポ実施済み → トライアル開始済み → 最終見積もり提示済み → 口頭合意獲得済み → 申込用紙回収済み → 契約締結済み。
- どのフェーズからでも失注にできます。
- 前のフェーズへ戻すこともできます。記録は同じく `t:'ph'` です。
- **承認が必要な変更**：契約締結済みに入れる、契約締結済みから外す（Utty 以外が操作したとき）。

### 4-2. 承認
- **フェーズの承認**：`pendingPhase` を立てる → Utty が承認するとフェーズに反映・`approvedAt` を記録。
- **受注済み商談の変更**：`pendingEdit` を立てる → 承認で値を反映。却下・取り消しで `pendingEdit` を消す。
- **受注済み商談の削除**：`pendingDelete` を立てる → 承認で削除。却下・取り消しで `pendingDelete` を消す。
- ⚠ 現行は画面側だけのチェックです。**Vercel 版ではサーバー（API ルート）で承認者を確認してください。**

---

## 5. AI 出力の扱い（Vercel 版の共通ルール）

対象は、組織図案（E-05・E-06）、サクセス案（G-06）、取り組みサマリー（D-02）、直近の動き（D-03）です。

1. **生成**：サーバーで Claude API を呼び、材料（議事録・チャット・商談・組織図）とプロンプトを渡します。現行のプロンプトは移植パッケージの付録 D にあります。
2. **下書き**：結果はツール内の下書き（`aiDraft`）として保存し、この時点では外部に送りません。
3. **確認**：UI で項目ごとに ✓（採用）・✎（直して採用）・×（採用しない）を選びます。削除・並べ替えもできます。
4. **送信**：「送信」で、採用した項目だけを Twenty の test テーブル（人物・アクション・活動）や Notion に書き込みます。
5. **記録**：送信した内容と、その元になった AI 出力の ID を `testOperationLog` に残します（あとから追跡するため）。

---

## 6. 保存時の共通処理

1. **画面の即時反映**：楽観的更新。失敗したら元に戻し、「保存できませんでした」と表示します。
2. **差分の記録**：変更前後の差分を取り（`dealDiff`・`orgDiff`）、`testOperationLog` に1件ずつ追記します。
   - 記録する項目：actor（閲覧者）、at、object、recordId、field、from、to、source（`ui`・`ai`・`sync`）
3. **活動への変換**：アクション完了・フェーズ変更・障壁更新・打ち合わせの取り込みは、`testActivity` にも追記します。
4. **Notion への書き込み**：Notion の正本にあたる項目は、その場で Notion API に書き込みます（§8-1）。
5. **お知らせ・フィードの再計算**

---

## 7. Twenty の test オブジェクト設計案

- Claude Code が Metadata API で作成します。
- 名前には `test` を付けます。
- 既存の Company・Opportunity・Person・Task とは関連を張りません。会社は Notion のページ ID で結びます。

| オブジェクト | 用途 | 主なフィールド |
|---|---|---|
| `testOpportunity` | 商談 | `notionCompanyId`（Notion 顧客管理DB のページ ID）、`companyName`、`name`、`stage`（§F の8値）、`pendingStage`、`addMrr`（円）、`applyDate`、`billingDate`、`termMonths`、`msTrial`、`msQuote`、`msVerbal`、`msBase`（apply/bill）、`barrier`、`need`、`lostReason`、`lostDetail`、`followUpMonths`、`isMain`、`pendingEdit`（JSON）、`pendingDelete`（JSON）、`approvedAt`、`approvedBy`、`owner`、`deletedAt` |
| `testAction` | ネクストアクションとサクセス Todo | `kind`（NEXT_ACTION／SUCCESS／FOLLOW_UP）、`opportunityId`（商談のとき）、`notionCompanyId`、`title`、`dueDate`、`week`、`lane`（use/exp、サクセスのとき）、`month`、`status`（OPEN／DONE／CANCELED）、`doneAt`、`result`（結果メモ）、`stageAtDone`、`source`（ui/ai）、`aiDraftId`、`owner` |
| `testActivity` | 活動記録（行動履歴の元） | `type`（ACTION_DONE／STAGE_CHANGE／BARRIER_UPDATE／MEETING／AI_RECENT）、`occurredAt`、`notionCompanyId`、`opportunityId`、`fromStage`、`toStage`、`text`、`note`、`sourceUrl`（議事録の URL）、`actor` |
| `testPerson` | 組織図の人・グループ・部署 | `notionCompanyId`、`nodeType`（person/group/dept）、`parentId`、`order`、`name`、`title`、`department`、`attitude`（推進・中立・慎重・反対・不明）、`isDecisionMaker`、`influential`、`contact`（接点あり／未接触）、`infoSource`（公開・社内・推定）、`memo`、`email`、`phone`、`source`（ui/ai/名刺） |
| `testAccountPlan` | 四半期の狙い・キー日程 | `notionCompanyId`、`quarter`（YYYY-Qn）、`goal`（サクセス状態）、`aimMrr`、`source`、または会社単位の `fiscalMonth`・`budgetMonths`・`renewal`（§9-4） |
| `testOperationLog` | 操作記録（監査・新着フィード） | `at`、`actor`、`action`（create/update/delete/approve/reject/request/sync）、`object`、`recordId`、`field`、`from`、`to`、`source`（ui/ai/sync）、`aiDraftId`、`message` |

**同期の仕方**
- **ツール → Twenty**：保存のたびに REST（または GraphQL）で即時に書き込みます。承認が必要な変更は、承認されるまで `pending*` 列にだけ書きます。
- **Twenty → ツール**：Twenty 側で人が直すことも想定する場合は、Webhook（record.updated）で受けます。直さない運用なら不要です（§9-3）。

---

## 8. Notion 連携

### 8-1. 🗂️ Ptengine AI 顧客管理DB（アカウント情報の正本、双方向・リアルタイム）

| ダッシュボードの項目 | Notion のプロパティ | 向き | 備考 |
|---|---|---|---|
| 企業名 | `企業名`（title） | 読む／企業追加時に作成 | C-05 |
| Tier | `Tier`（未顧客・Tier1・Tier2・Tier3・Tier5） | 双方向 | D-01。現行コードの TIER1 等との変換が必要 |
| 業種 | `業種`（18択） | 双方向 | D-01。現行の業種コード（`IND_JP`）との対応表が必要 |
| 主担当 | `担当3`（multi_select） | 読む（編集するなら双方向） | 現行も担当3 を主担当として使用。`担当1`・`担当2` は参照のみ |
| 現在MRR | `⚠️MRR`（円） | 読む | 現行も Notion の値を使用 |
| （目標）追加MRR | `想定追加MRR`（円）**案** | 双方向 | C-01。意味が「想定」か「狙い」かは要確認（§9-2） |
| 課金開始月 | `課金開始予定月`（date） | 書く（main の商談から） | 案 |
| フェーズ | `課金ステージ`（S0〜S5）**案** | 書く（main の商談から） | 対応の案：初回アポ前・初回アポ済 → S0、トライアル → S1、最終見積 → S3、口頭合意・申込用紙回収 → S4、契約締結 → S5。要確認 |
| 障壁 | `阻害の中身/これがあれば課金する`（text） | 書く（main の商談から） | `障壁状態` は V74 で廃止したため書かない |
| 次の一手 | `次回Action`・`Action日` | 書く（main の商談のネクストアクション）**案** | これまでは「履歴として読むだけ」と決めていた欄。書き込む場合は方針変更になる（§9-2） |
| 新ソリューション状態 | `新ソリューション状態` | 読む | フェーズの自動判定（FDE・PoC 進行 → トライアル 等）に使う |
| 顧客ページ | ページ URL・`Company Database`（relation） | 読む | D-06 |

**リアルタイム同期の実装案**
- **ツール → Notion**
  - 保存時に API ルートから `PATCH /v1/pages/{id}` で即時に書き込みます。
  - 書く前に `last_edited_time` を読み、ツールが最後に読んだ時刻より新しければ、上書きせずに警告します（楽観ロック）。
- **Notion → ツール**
  - Notion の Webhook（`page.properties_updated`、`page.created`）を Vercel の API ルートで受け、該当する会社のキャッシュを更新して画面に通知します（SSE など）。
  - Webhook が届かなかったときのために、5分ごとの差分取得（`last_edited_time` でフィルタ）も併用します。
- **競合したとき**：あとから書いた方を優先し、上書きされた側には `testOperationLog` で変更を残します。

### 8-2. JP_Docs DB（議事録、読むだけ）
- **照会**：data source を `関連顧客`（Company Database への relation）で絞り、`Category` に「議事録」を含むページを `作成日付` の新しい順に取得します。
  - 現行はタイトル検索です。Vercel 版では relation で絞る方が正確です。
- **使う項目**：タイトル（`お知らせ`）、`作成日付`、`Scope`（社内／社外）、`参加者(顧客)`、`決定事項`、`次回アクション`、`反応`、本文（blocks）
- **行動履歴への反映**：取り込んだ議事録は `testActivity`（type＝MEETING、`sourceUrl`＝Notion の URL）に1回だけ記録します。重複はページ ID で防ぎます。

---

## 9. 未決事項（Vercel 版の着手前に確認）

> ### 【2026-10-01 追記】1・2・7 に回答があった
>
> | # | 回答 | 実装状況 |
> |---|---|---|
> | **1** | **専用 DB を作成する。** 置き場所は「Ptengine AI Project Board（JP）」 | **作成済み**：DB「Ptengine AI 目標（Pipeline）」（`scripts/notion-targets-db.mjs`）。列は 対象／種別／name2／目標MRR／期限／有効／備考。初期値 6 行を投入済み |
> | **2** | **書いてよい。** `想定追加MRR`・`次回Action`・`課金ステージ` へ書き込む | 設計のみ。実装は Notion 連携の回で |
> | **6** | **確率（0/10/30/55/80/95/100%）はこのまま使う。「申込用紙回収済み」を確定MRR に含める** | **実装済み**：`src/lib/ptai/calc.ts` の `WON_STAGES = {APPLICATION, CLOSED_WON}`。確率は据え置き。**二重計上を避けるため、申込用紙回収済みは「商談中の合算MRR」から外した**（§3 の表の記述より、この回答を優先） |
> | **7** | **固定ではなくロールにする。Utty と Kubotie を管理者** | **実装済み**：`src/lib/ptai/approver-policy.ts`。既定 `['Utty','Kubotie']`、`PGA_APPROVER_NAME2` で上書き可。§4-2 のサーバー側チェックも `/api/ptai/db` に実装済み |
>
> | **3** | **Twenty を人が直接編集する想定は無いが、イレギュラーで必要かもしれない** | **Webhook は作らない。**代わりに `updateRecordSafely()` で楽観ロックをかけた（`updatedAt` が食い違えば書かずに相手の値を返す）。人が Twenty で直したぶんは、読み取りキャッシュ（最大 60 秒）が切れれば画面に出る。通知が要るようになったら Webhook を検討 |
> | **4** | **キー日程は Notion に置く** | **実装済み**：顧客管理DB に `決算月`（select）／`予算策定時期`（rich_text）／`契約更新月`（select）の 3 列を追加（73 → 76）。原本と同じく**日付ではなく月（1〜12）＋「情報なし」**で持つ |
>
> **§9-4 の注記**：原本は各キー日程に確度フラグ（`st`：確認済み／推定）を持っていたが、
> **Notion 側には持たせていない**。Notion が正本なので、人が入れた値は確認済みとして扱う。
> 推定値を区別したくなったら列を足す。
>
> **§9-6 の波及**：申込用紙回収済みは「確定MRR に入るが、期待値は 95%」という扱いになる。
> また、現在画面に出ている数字は原本 board.js 側の計算（確定＝契約締結済みのみ）なので、
> **新しいデータ経路が画面を駆動するまで表示は変わらない**。
> 原本側にも反映するなら、アーティファクトの `won` を直して次の版を出す必要がある。
>
> | **8** | **移行する。** 会社の紐付けは社名一致のぶんもそのまま進める／到達予定の欠落は許容／会話メモと変更履歴はログのテーブルへ／AI サマリーの扱いは任せる | **dry-run 済み**（`scripts/ptai-migration-dryrun.mjs`）。`testComment` を新設（会話メモ用）、変更履歴は `testOperationLog`、AI サマリーは `testActivity(AI_RECENT)` へ**移す**判断にした |
>
> **5（Mii のトークン）は不要になった**（Mii は Twenty の Note から読めるため）。**§9 はすべて回答済み。**
>
> **§9-8 の実測（2026-10-01 dry-run）**：`edits` 104 行のうち **103 行はキー日程だけ**で、
> 商談の入力があるのは 1 社（＋追加商談 1 件）。Twenty へ作るのは約 86 行、
> Notion は 103 社ぶんのキー日程。会社の鍵は 104 社すべて解決でき、
> うち 21 社は社名一致だが**社名・MRR とも完全一致**を確認済み。


| # | 事項 | 選択肢・論点 |
|---|---|---|
| 1 | チーム目標・メンバー別目標（今は `settings/targets`）を Notion のどこに置くか | 顧客管理DB にはメンバー目標の項目がない。専用のページか DB（メンバー・目標額・期限）を新しく作る案 |
| 2 | （目標）追加MRR と `想定追加MRR`、ネクストアクションと `次回Action`、フェーズと `課金ステージ` の対応 | 意味が合うか、書き込んでよいか。`次回Action` 欄は「履歴として読むだけ」の決定を変えることになる |
| 3 | Twenty の test テーブルを人も直接編集するか | 直すなら Twenty → ツールの Webhook が必要 |
| 4 | キー日程（決算月・予算策定時期・契約更新）の保存先 | Notion 顧客管理DB に項目を足すか、Twenty `testAccountPlan` か |
| 5 | Mii の議事録の取り込み | サーバー側で Mii API を呼ぶ場合、トークンの持ち方（個人用か共用のサービス用か） |
| 6 | 確率（0/10/30/55/80/95/100%）と、「申込用紙回収済み」を確定に含めるか | 期待値MRR・確定MRR の計算が変わる |
| 7 | 承認者 | Utty 固定か、ロールとして複数人にするか |
| 8 | 旧データの移行 | 現行の共有 DB（edits・aplans・orgs・minutes・newcos・feed・settings・plans・recent・chatwork）を test テーブルへ一度だけ移すか |

---

## 付録：現行の共有 DB コレクションと移行先

| 現行 | 中身 | 移行先 |
|---|---|---|
| `edits/<cid>` | opp（main の商談）、deals[]（追加の商談・`log[]`・`ms`・`pending*`）、company（aim・tier・ind・keyDates・twentyPending） | `testOpportunity`、`testAction`、`testActivity`、Notion 顧客管理DB |
| `aplans/<cid>` | quarters、items、ai | `testAccountPlan`、`testAction`（SUCCESS）、AI 下書き |
| `orgs/<cid>` | nodes、memos、questions、history | `testPerson`、AI 下書き、`testOperationLog` |
| `minutes/<cid>` | notion、mii | JP_Docs DB の直接照会、`testActivity`（MEETING） |
| `newcos/<id>` | ダッシュボードで追加した会社 | Notion 顧客管理DB |
| `feed` | 変更の記録 | `testOperationLog` |
| `settings/targets` | チーム目標・メンバー目標 | Notion（§9-1） |
| `plans` | 旧プラン（MILESTONE・FOLLOW_UP・ISSUE） | `testAction`（FOLLOW_UP）、ISSUE は廃止か `testAction` |
| `recent/<cid>` | 直近の動きの AI 推計 | `testActivity`（AI_RECENT） |
| `chatwork/<cid>` | 枠のみ（空） | 取り込みが決まったら `testActivity` |
| localStorage `pgaBoard.*` | 絞り込み、ページサイズ、ドロワー、お知らせの種類 | 同じく localStorage |
