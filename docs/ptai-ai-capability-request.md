# Utty の Claude Code へ渡す調査依頼（AI 実行基盤の仕様抽出）

- 目的: アーティファクト上で動いている 5 つの AI 機能を、**Vercel ＋ OpenRouter で同じ水準に再現する**
- 状態: プロンプト本文（`ORG_INSTR` ほか 5 つ）は board.js にあるので**こちらで把握済み**。
  不足しているのは **`window.claude.use('sample')` / `use('mcp')` の実行時仕様**
- 送り先: アーティファクト作成者 Utty の Claude Code
- 注意: **秘密情報（API キー・トークン・顧客名・議事録本文）は 1 文字も書かせない**

---

以下をそのまま貼り付けてください。

---

```
Ptengine AI パイプラインダッシュボード（Claude アーティファクト、現在 V96）を
Vercel の Next.js アプリへ移植しています。AI 部分は claude.ai の
`window.claude.use('sample')` ではなく **OpenRouter 経由**で動かします。

同じ水準の出力を再現したいので、**AI 実行基盤の仕様**を文書にしてください。
プロンプト本文（ORG_INSTR / CARD_INSTR / RECENT_INSTR / AI_INSTR / APLAN_INSTR）は
board.js から読めているので不要です。欲しいのは「その周りの条件」です。

## 絶対に守ること
- API キー・トークン・Cookie・セッション ID を書かない（名前と用途だけ）
- 顧客名・担当者名・議事録やチャットの本文を書かない。例が要るときは架空の値にする
- **推測を事実のように書かない。** 各項目に必ず `実測` / `ドキュメント` / `推測` / `不明`
  のいずれかを付ける。分からないものは「不明」と書く。埋めなくてよい

## 書いてほしいこと

### 1. sample 名前空間の実行時仕様
`await window.claude.use('sample')` で得られるオブジェクトについて。

1-1. `json(promptOrTurns, opts)` が内部で呼ぶモデル
  - 既定のモデル名（バージョンまで）
  - `opts.modelTier` に渡せる値の一覧と、それぞれどのモデルになるか。
    board.js は `'default'` しか使っていないが、他に何があるか
  - 推論の設定: max output tokens / temperature / top_p / stop /
    thinking（extended thinking）の有無と予算

1-2. JSON を強制している仕組み
  - システムプロンプトを足しているか。足しているなら**その全文**
  - tool use / structured outputs / response_format / assistant prefill の
    どれを使っているか
  - 応答がフェンス付き（```json）で返ることはあるか
  - パースに失敗したときの自動リトライや修復の有無

1-3. `limits()` が返す実際の値
  - `maxPromptBytes` の実値と、それが「バイト」か「トークン」か
  - 超過したときの挙動（エラーコード / 切り詰め / どちらでもない）
  - `images` の `maxCount`・1枚あたりの上限サイズ・受け付ける MIME
  - 画像を何として送っているか（base64 data URL / URL / その他）

1-4. ストリーミング
  - `opts.onText` はいつ・何回・何を引数に呼ばれるか
  - `json()` でも途中テキストが流れるのか、最終 JSON だけか
  - `opts.signal` による中断は、サーバー側の生成も止まるのか

1-5. キャッシュ
  - `opts.cache:false` と `opts.cache:{staleTime: N}` の違い
  - キャッシュキーは何で決まるか（プロンプト全文 / ハッシュ / ユーザー）
  - prompt caching（Anthropic の cache_control）を使っているか

1-6. 暗黙のコンテキスト
  - アーティファクトのソース、会話履歴、ユーザー情報などを
    **こちらが渡したプロンプト以外に**付け足しているか。付けているなら何を

1-7. エラーコードの一覧
  board.js が握っているのは次。これで全部か、他にもあるか。
  それぞれ「いつ出るか」「リトライすべきか」を書いてください。
    not_granted / sampling_disabled / not_declared / capability_disabled /
    capability_removed / cancelled / invalid_json / no_images /
    rate_limited / prompt_too_large / tool_error / unavailable

1-8. レート制限とタイムアウト
  - 1 分あたり・1 日あたりの呼び出し上限
  - 1 リクエストのタイムアウト秒数
  - 自動リトライ（回数・バックオフ）の有無

### 2. mcp 名前空間
`await window.claude.use('mcp')` の `callTool(server, tool, input, opts)` について。

2-1. このアーティファクトで**宣言している**サーバーとツールの一覧
  （board.js から見えているのは Notion の notion-create-pages、
   host:twenty の execute_tool、あと汎用の callTool 経路）
2-2. マニフェスト（`not_in_manifest` の判定元）の実物。どこに何を書いているか
2-3. `host:twenty` が何に繋がっているか。Twenty の MCP サーバーか、
     それとも別のもの。認証は誰のキーか（**値は書かない**）
2-4. `opts.cache:{staleTime}` の意味
2-5. 返り値 `{payload}` の形。ツールごとに違うか
2-6. 承認（approval_required）が出る条件

### 3. 5 つの AI 機能ごとの運用メモ
次の 5 つについて、**プロンプト以外**で効いていることを書いてください。

| # | 機能 | board.js の場所 |
|---|---|---|
| 1 | 組織図（パワーマップ）の生成 | `orgGenerate` / `ORG_INSTR` |
| 2 | 名刺画像の読み取り → 組織図反映 | `orgGenerate(cards)` / `CARD_INSTR` |
| 3 | 直近の動きの要約 | `RECENT_INSTR` |
| 4 | 商談・サクセスの計画相談（チャット） | `aiAsk` / `AI_INSTR` |
| 5 | アカウントプラン（12か月）の生成 | `APLAN_INSTR` |

各機能について:
- 期待する JSON スキーマ（必須キー・型・列挙値）。board.js の検証より
  厳しい条件があるなら書く
- **実際に起きた失敗パターン**と、どう直したか
  （例: 「ノード数が多いと parent が壊れる」「JSON が途中で切れる」）
- 出力が安定するまでに効いた調整（材料の削り方・順番・文字数の上限など）
- 「この機能だけモデルやトークン上限を変えている」などの差分

### 4. 材料（materials）の作り方で効いていること
- `gatherSources` が集めた資料を `build(sc)` で縮めていますが、
  **スケールを下げたときに品質がどこから落ちるか**の肌感
- 画像つきのときに特に気をつけている点

### 5. OpenRouter へ移すときに「ここは落ちる」と思う点
あなた（Utty の Claude Code）の見立てで、claude.ai の sample に
依存していて素直には移せない部分を挙げてください。優先度付きで。

## 出力の形
Markdown 1 ファイル。見出しは上の 1〜5 をそのまま使う。
表が使えるところは表にする。各行に `実測` / `ドキュメント` / `推測` / `不明` を付ける。
分量は気にしなくてよいので、**「不明」を正直に残す**ことを優先してください。
```

---

## この依頼で埋めたい穴（こちら側の整理）

| 移植済み | 穴 |
|---|---|
| `sample.json()` → `/api/ptai/ai` → OpenRouter | モデル・温度・max_tokens・JSON 強制の方式が原本と同じか不明 |
| `limits()` → 固定値 180,000 bytes / 画像 8 枚 | **こちらが決め打ちした値**。原本の実値を知らない |
| 画像 → data URL で添付 | 原本が何形式で送っていたか不明 |
| `modelTier:'default'` | **無視している**。他の tier があるなら対応が要る |
| `onText`（ストリーミング） | **未実装**。チャットの「案をまとめています…」が出ない |
| `cache:{staleTime}` | **未実装**（毎回呼ぶ） |
| MCP `Notion` / `Intercom` | 実装済み |
| MCP `host:twenty` | `twenty_key_missing` で固定。**test\* の書き込み経路ができたので繋ぎ直せる** |
