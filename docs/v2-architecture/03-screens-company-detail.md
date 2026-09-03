# 03. 個社ページ `/v2/companies/[companyUid]`

実装:
- `page.tsx`（Server Component / 42 行）
- `view.tsx`（Client / 2,263 行 — タブ本体とチャートを内包）
- `proposal-flow.tsx`（Client / 1,875 行 — 提案骨子フロー）
- `campaign-org.tsx`（Client / 365 行 — 施策から読む組織の動き）
- `loading.tsx`（ストリーミング用フォールバック）

---

## 1. 初期表示（Server Component）

```ts
const [initialUsage, initialTs, campaignOrg] = await Promise.all([
  loadCompanyUsage(companyUid),                    // 利用状況
  loadCompanyTimeseries(companyUid, 90),           // 90日の時系列
  fetchStoredCampaignOrg(companyUid),              // 日次バッチ済みの施策×組織
]);
```

3 本とも独立なので並列。すべて `.catch(() => null)` で握り、1 本落ちても画面は出る。
await 中は `loading.tsx` が表示される（ストリーミング）。

`?from=` で戻り先を出し分ける（`readiness`（既定）/ `tier3` / `projects` / `home`）。
個社ページは複数の一覧から開かれるため、ブラウザバック任せにせず明示的に持たせている。

---

## 2. ヘッダーとタブ

ヘッダーカード（`HeaderCard`）: 会社名 / Tier / 担当 / プラン（Insight・Experience・Bundle）/ MRR / 更新時期 / 重大度（`red 緊急` `amber 要対応` `blue 提案` `green 良好`）/ 主要 KPI。

タブは 4 つ。**初期表示は「顧客情報」**。

| タブ | 内容 | 取得タイミング |
|---|---|---|
| 顧客情報（`profile`） | 判断の要約 → 外部機会 → 顧客理解（LLM）→ 提案準備度の詳細 → 施策から読む組織の動き | タブを開いた時に `/profile` と `/readiness` を取得 |
| ダッシュボード（`dashboard`） | 利用状況 KPI・プロジェクト別テーブル・時系列チャート | Server から props で受領済み |
| 提案準備（`readiness`） | 提案骨子フロー（`ProposalFlow`） | フロー内で `/proposal-records` `/proposal-intents` 等 |
| コミュニケーション（`comm`） | 議事録・Slack・Chatwork・メール・Intercom・CSE の統一ログ | タブを開いた時に `/communications` |

---

## 3. 顧客情報タブ

商談・定例の前に読む「この顧客に何が起きているか」。上から:

### 3-1. 判断の要約（`StatusStrip`）

`/readiness` の結果から、準備度スコア・提案の型・更新時期を**顧客理解の生成（30 秒）を待たずに**先頭へ出す（2026-08-24 追加）。ここだけ読めば「提案を持ち込んでよいか」の結論が分かる。

### 3-2. 外部機会（`ExternalOpportunityCard`）

「今提案する理由」の外部根拠。提案の型を切り替える最上位の要因なので折りたたみに入れない。

- 保存済み外部シグナル（`company_external_intel`）＋ 議事録からのキーワード抽出候補。
- 担当者が自動判定を上書きできる（`?opportunity=true|false` を付けて `/readiness` を再取得）。
- 3 つの取り込み導線:
  1. **AI 調査**（`ResearchPanel` → `POST /external-intel/research`）— 自然言語の指示で Web 検索 → 候補を返すだけ。保存しない。
  2. **資料の取り込み**（`IngestPanel` → `POST /external-intel/ingest`）— URL を貼る / PDF・HTML・テキストをアップロード → テキスト化 → 構造化 → 候補を返すだけ。
  3. **候補の保存**（`POST /external-intel` に `items`）— 担当者がチェックしたものだけを保存する（human in the loop）。

### 3-3. 顧客理解（`ProfileUnderstanding`）

`GET /api/company/[uid]/profile` が返す LLM 生成の記述。セクションごとに箇条書き＋**出典チップ**（業界 / 外部情報 / 議事録 / 利用実態 / サポート / 契約 / 人物 / チャット）。

- 出典の時点表示は 2 種類: `date`（議事録の開催日など社内データ）と `asOf`（外部記事の公開時期）。24 か月以上前は薄く表示し `⚠` を付ける。
- 末尾に「まだ分かっていないこと」を出す。欠損を隠さないことが次に何を聞くべきかを示す。
- 既定は**保存済み（`company_profile_cache`）を読む**。`?refresh=1` で作り直し、`?industry=refresh` で業界トレンドも Web 検索し直す。
- 生成は議事録 8 件の本文（各 2,500 字まで）＋利用実態＋外部情報＋サポート＋契約を材料に渡す。実測で本番 43 秒・ローカル 127 秒のため `maxDuration = 300`。

### 3-4. 提案準備度の詳細（折りたたみ `ReadinessDetailBody`）

- **部門（プロジェクト）別の準備度が判断の主対象。** 会社単位で平均すると「主契約部門は解約方向、別部門は拡張余地」のような差が消える。
- 会社全体のスコアは参考値（先頭の StatusStrip が出すのでここには重複させない）。
- 「他ツールで代替可能」の認知を検出した場合、該当箇所を根拠として表示（キーワード照合による推定である旨も併記）。
- 算出に使った入力（推移の起点日、最終接点日、90 日接点件数、オープンサポート件数、有料 PJ 数、除外した FREE 数）を一覧表示。

### 3-5. 施策から読む組織の動き（`CampaignOrgSection`）

`GET /api/company/[uid]/campaigns`。既定は**日次バッチが作った保存済み**（`company_campaign_org`）を読むだけ。`?refresh=1` でその場で明細（13.8MB / 本番コールド 28.8 秒）から作り直す。

施策名と作成者の時系列から「この会社で誰が何をしているか」を読む。読み違いを防ぐため画面に必ず出すもの:

- 無題を除いた件数（**24% は無題**）
- 削除の内訳（**DELETED の 70% は一度も公開されていない** → `everRan` で区別）
- 「このデータで答えられないこと」（`CAMPAIGN_LIMITATIONS`）:
  - 施策をいつ停止したかは分からない（停止時刻の列がない。PAUSED は現在の状態であって履歴ではない）
  - 最終更新日時は分からない
  - 成果（表示回数・ゴール到達数・CVR）は含まれない。ゴール数は設定数であって達成数ではない
  - 明細は直近 2 年が対象（RUNNING / SCHEDULED は期間外でも含む）

作成者ごとに `internal`（@ptmind.com）フラグ、直近 90/30 日の作成数、`isNew`（初登場が直近 90 日 = 新しく入った人）、`wentQuiet`（90 日以上作成なし = 抜けた可能性）を出す。

---

## 4. ダッシュボードタブ

`loadCompanyUsage` の結果（`CompanyUsageResponse`）と `loadCompanyTimeseries` の結果を表示。

- 企業レベル: プラン / MRR / PV 消費率（企業内 PJ 最大）/ 今週操作数と前週比 / 最終活動 / 休眠 / アラーム（`pv_over` `renewal_soon` `ops_drop` `inactive_30` `upsell`）と重大度。
- プロジェクト別テーブル: 稼働状態（`active` 稼働 / `stalled` 停滞 / `unused` 未活用 / `inactive` 無効）、L30、PV 消化率バー（90% 以上は赤 + ⚠）、ヒートマップ、Campaign、活用スコア（healthy / depth / breadth）、習慣化、30 日のモジュール判定。無料 PJ は畳んで表示。
- チャート（recharts）: 日次スナップショット由来の L7/L30・Campaign・MRR・スコア推移と、月次の施策公開本数（`CampaignMonthPoint`）。
- 各 PJ 行から `/v2/projects/[projectId]?from=company:<uid>` へ遷移できる。

`moduleSignal` は readiness に相乗りさせず `company-usage` 側で持つ（readiness はタブを開かないと取得されず、ダッシュボードで常に「—」になっていたため）。

---

## 5. コミュニケーションタブ

`GET /api/company/[uid]/communications`（`maxDuration = 60`）。6 チャネルを統一リスト化:

| チャネル | テーブル | 本文カラムの実体 |
|---|---|---|
| `notion` 議事録 | `log_notion_minutes` | 本文・参加者・アクションアイテム |
| `chatwork` | `log_chatwork` | 会話（`sent_at_jst` でソート） |
| `slack` | `log_slack` | 会話 |
| `mail` / `intercom` | `log_intercom` | **`raw_body`**（`body` / `original_message` は存在しない） |
| `cse` | `cse_tickets` | `display_message`（AI 整形済み）→ `describe`（起票内容）。`description` は存在しない |

- Intercom は現行形式の管理画面 URL（`https://app.intercom.com/a/inbox/cfiqb37k/inbox/conversation/{id}`）を組む。旧形式は 301 するため踏まない。
- 議事録・CSE は Notion ページ URL（ハイフンを抜いた 32 桁）へリンク。
- **未クローズのまま 90 日以上動いていないもの**を「長期滞留」として区別する。日付が読めない行は「古い」とみなす（`cse_tickets` は `created_at` が空の行が多く、新しい側に倒すと摩擦が過大に出る）。
- `cse_tickets` は 1 チケット = 複数行で蓄積されるため `source_record_id` で畳み込む（畳まないと件数が 2 桁膨らむ）。
- 表示する severity は `high` / `critical` / `urgent` のみ（medium・low は全行に並ぶだけで判断材料にならない）。

---

## 6. 提案準備タブ ＝ 提案骨子フロー（`ProposalFlow`）

このタブは**提案骨子を作る作業だけ**を担う（判断材料は顧客情報タブへ移設済み / 2026-08-21）。

### 6-1. 4 つの段階

```
[提案準備Top]
  保存済みの記録一覧（開き直す / 削除）
        ↓「新しく作る」
[狙いを選ぶ]
  B1「提案の狙い」カードをおすすめ順で表示 ＋ カタログ外の狙いを自分で立てる
        ↓
[情報を選ぶ]
  自動収集した材料（Evidence）を確認し、外す・足す
        ↓「骨子を作る」
[骨子（メイン）＋ コンテキスト（サイド）]
  9章の骨子。サイドのチェックを外して再生成すると、そのコンテキストが実際に抜ける
```

設計上の要:

1. **材料を先に選ばせない。** 15 枚のチェックボックスを最初に見せても何を選ぶべきか判断できない。まず骨子を出し、外したいものを外す順にする。
2. **カードはおすすめ順（決定的・LLM を使わない）。** 実装の並びは `適合度ランク（recommended → possible → not_advised）→ 一致した状況の数の多い順 → Notion B1 の既定順`。ここに LLM を挟むと表示が 20 秒以上遅れる。
   （ヘッダーコメントには「打合せ設定率」を掛ける旨が残っているが、`meetingRate` は現在 `null` 固定で並びには効いていない）
3. **サイドのチェックが実際に効く。** サーバーはクライアントが送った材料しか使わない。効かない操作を置くと、担当者は再生成を信じなくなる。
4. **章立ては固定。** 案件で変わるのは比重だけ。

### 6-2. 狙いカードの適合度（`IntentFit`）

| 値 | 表示 | 意味 |
|---|---|---|
| `recommended` | おすすめ | 効く条件（状況）が一致している |
| `possible` | 選べる | 一致する状況は無いが妨げる状況も無い。担当者の判断で選べる |
| `not_advised` | 非推奨 | 逆効果になる状況が立っている。当てるなら理由が必要 |

**一覧から消さない。** 消すと「今できること」の全体が見えず、担当者が自分で判断できなくなる。

各カードには、観測された状況がその狙いにおいて持つ役割（`tailwind` 追い風 / `blocker` 先に解消 / `prerequisite` 前提 / `related` 関連）を表示する。**同じシグナルでも狙いによって反転する**（例: 習慣化は Bundle 化では追い風、FDE 伴走では「自走できている」という断り材料）。

提案の型は `fde`（FDE 型 = 一緒に解をつくる）と `product`（製品型 = すでにある解を早く使う）。

### 6-3. 材料（Evidence）

`buildEvidenceGroups()`（`src/lib/company/proposal-inputs.ts`）が自動収集する。種類:

`readiness` 準備度4要素 / `play` 提案の型 / `renewal` 契約更新 / `behavior` 行動シグナル（R/O/H）/ `external` 外部情報 / `manual` 手動登録の状況 / `case` 事例 / `playbook` 施策・問い / `usage` 利用実態の生値 / `communication` 議事録本文 / `profile` 顧客理解プロファイル

**材料は「状況 ID を運ぶもの」と「運ばないもの」に分かれる。**
運ぶもの（行動シグナル・準備度・外部情報・手動登録）を外すと WHAT の候補が実際に変わる。運ばないもの（議事録本文・顧客理解・利用実態の生値）はストーリーの材料としてだけ効く。**この違いを UI で隠さない**（隠すと「チェックを外したのに候補が変わらない」が不具合に見える）。

各材料は確度（`confidence`）を必ず持つ:

| 値 | 表示 | 骨子での扱い |
|---|---|---|
| `measured` | 観測 | 断定して書かれる |
| `inferred` | 推論 | 出所付きで、断定せずに書かれる |
| `stated` | 申告 | 事実としてではなく「伺っている」として書かれる |

ID は行番号や配列順ではなく**内容から決まる安定キー**（再生成・再選択で同じ材料を追跡するため）。鮮度（`asOf`）も持たせ、古い材料で「今」を語らせない。

### 6-4. 骨子の生成（`POST /proposal-outline`, `maxDuration = 180`）

固定 9 章:

| # | 章 | English | 材料ID必須 |
|---|---|---|---|
| 1 | いま何が起きているか | Context | ✔ |
| 2 | なぜ今取り組むか | Why Now | ✔ |
| 3 | どの状態を目指すか | Goal | |
| 4 | なぜ現状では実現できないか | Gap / Root Cause | ✔ |
| 5 | どう解くべきか | Strategic Approach | |
| 6 | どう実現するか | Solution | |
| 7 | なぜ実現できると言えるか | Proof | |
| 8 | どう始め、どう進めるか | Execution | |
| 9 | 投資判断と次の一歩 | Decision | |

第 4 章の Gap は「データ・顧客理解 / 打ち手の設計 / 実装・検証の速度 / 学習の蓄積」の 4 層で捉えさせる。
第 8 章は「小さく価値を証明する → 成功パターンを確立する → 対象範囲を拡張する」の 3 段。
第 9 章は「ご検討ください」で終わらせず、誰がいつまでに何を決めるかまで書かせる。

システムプロンプトが守らせていること（`OUTLINE_SYSTEM`）:

1. 材料に無いことを事実として書かない。想定は `assumptions`、不足は `missingEvidence` に出す。
2. 顧客の事実を述べる章（Context / Why Now / Gap）は材料 ID を必ず挙げる。
3. 相手を評価・断定しない（「〜ができていない」ではなく「〜という状態」）。
4. Approach では提供物の名前を出さない。提供物が登場するのは Solution から。
5. 社内用語を持ち込まない（対外呼称ルールを適用）。
6. これは骨子。担当者が「この筋で進める」と判断できる密度で止める。
7. `text`（結論 1〜2 文）と `bullets`（裏づけ）で同じことを言わない。

生成後、**選んでいない商材名・社内語の混入を機械検査**する。出力上限 12,000 トークン（9 章 + Executive Summary を JSON で返させるため、足りないと途中で切れて `JSON.parse` が失敗する）。担当者の追記は 1 件 8,000 字まで。

骨子は Markdown へエクスポート（`outlineToMarkdown`）でき、`proposal_outlines` テーブルが設定されていれば保存・再オープン・削除ができる（未設定なら保存ボタンを出さずに生成だけ動く）。

### 6-5. 議事録から状況を拾う（`SituationCandidates`）

`GET /api/company/[uid]/situations` が議事録 8 件（各 3,000 字）を LLM に読ませ、状況カタログ A の語彙の**候補**を返す。`POST` で担当者が確認したものだけ `company_situations` に登録する。

**自動登録しない。** 議事録 948 件の横断実測（2026-08-24）で「担当が変わると知見が引き継がれない」が 84 件・51 社に出現したが、その大半が **Ptmind 側の説明文**（「他のお客様からも伺う声」という枕）だった。自社のトークを顧客の状況として登録すると、提案が「相手が言っていないこと」を根拠にし始める。
そのため LLM に発言者を判定させたうえ、確信度 0.6 未満は候補にも出さない（0.3 では逆向きの誤検知が混ざった）。
