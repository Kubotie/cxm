# Twenty 集約 移行計画（**PtAI Pipeline 限定**）

- 作成日：2026-09-30
- 状態：**設計と読み取り経路の実装まで。** スキーマ変更・データ移行・Twenty への書き込みは未実施
- 関連：[twenty-phase1-validation.md](./twenty-phase1-validation.md)、[current-state-audit.md](./current-state-audit.md)、`src/lib/twenty/sync-policy.ts`

---

> ## 🔄 【2026-09-30 追記】方針変更中
>
> **「Twenty へ全面集約」は保留になった。** 現在の方針は
> **「短期は PtAI Pipeline 専用の NocoDB を使い、Twenty はオブジェクト・項目ごとに
> 実測して利用可否を判定し、使える機能だけ段階的に採用する」**。
> 実測の結果、Twenty で現時点から読み取り元にできるのは
> **企業マスタ・PtAI 担当・議事録本文の 3 つだけ**だった。
>
> **正本は [ptai-pipeline-data-strategy.md](./ptai-pipeline-data-strategy.md)。**
> 本ファイルの「Twenty を唯一の正本にする」「移行後に `pga_docs` 依存を除去する」
> という前提は、その判定が済むまで**保留**として読むこと。
> CXM が引き続き NocoDB を利用する点は変わらない。

---

## 0. 適用範囲（最初に読むこと）

> **この移行計画の対象は PtAI Pipeline のみである。**
> **CXM は引き続き NocoDB を主要データストアとして利用する。**
> **本計画で廃止するのは、Pipeline の業務データを保持する `pga_docs` および
> `NOCODB_PGA_DOCS_TABLE_ID` への依存だけである。**
> **共通認証の `staff_identify` や CXM の NocoDB テーブルは対象外とする。**

### 対象（PtAI Pipeline）

- `/ptai-pipeline` の画面と `/api/ptai/**`
- Pipeline が読み書きしている `pga_docs` の各 collection
- Pipeline が参照している Notion 上の業務データ（現在MRR・担当3 など）

### 対象外（**変更しない**）

| 範囲 | 扱い |
|---|---|
| `src/lib/nocodb/**` | CXM のアクセス層。触らない |
| CXM の NocoDB 46 テーブル | 廃止も移行もしない |
| CXM の企業・人物・案件・解約レーダーの API と画面 | 変更しない |
| CXM のバッチ（Cron・外部バッチ） | 変更しない |
| CXM の Salesforce 連携 | 変更しない |
| CXM の Notion 連携 | 変更しない（本計画の Notion は Pipeline 領域に限る） |
| Metabase 連携 | 変更しない |
| 認証方式・`staff_identify` | 変更しない。共通認証が NocoDB を使い続けることを許容する |
| `NOCODB_PGA_DOCS_TABLE_ID` 以外の NocoDB 環境変数 | 削除・改名しない |

> **用語の注意。** 本計画では「NocoDB を廃止する」「NocoDB 依存をすべて除去する」とは言わない。
> 言えるのは **「PtAI Pipeline の業務データから `pga_docs` 依存を除去する」** までである。

---

## 0-1. 原則（PtAI Pipeline について）

> **PtAI Pipeline の業務データは Twenty を唯一の正本とし、ダッシュボードは Twenty を操作する UI である。**

したがって Pipeline では次を採らない。

| 採らない設計 | 理由 |
|---|---|
| RAW 互換 JSON を `pga_docs/_raw` へ保存する | Twenty を正本にするなら、取得したものを別の場所へ複製する必要がない |
| ダッシュボードを正本として扱う | ダッシュボードは UI。保存後の正本は Twenty |
| Pipeline の永続保存先として NocoDB を採用する | 目標設計では Pipeline に NocoDB を採用しない |
| Notion を Pipeline の恒久的な正本として使う | 現在MRR・担当3 も最終的には Twenty へ集約する |
| `twenty_link` の対応表を作る | Twenty の id をそのまま使う。対応表が要るのは二重正本のときだけ |
| Twenty と `pga_docs` を継続同期する | 移行が終わったら Pipeline の依存を消す。同期は移行期間の一時的なもの |

移行期間だけ `PTAI_DATA_SOURCE` で取得元を切り替えられるが、**これは一時的なもの**で
Phase 2D に削除する。

### 現状と目標設計を混同しないこと

| | 現在の事実 | 目標設計 |
|---|---|---|
| Pipeline の RAW | `pga_docs/_raw` を読んでいる | `/api/ptai/raw` が Twenty から直接 ViewModel を生成する |
| Pipeline の入力保存 | `pga_docs/edits` ほかへ保存している | Twenty へ書く |
| `PTAI_DATA_SOURCE` | 既定は `legacy_nocodb` | 分岐ごと削除し `twenty` 一本にする |
| CXM | NocoDB を利用 | **変わらず NocoDB を利用** |

> **「Pipeline はもともと NocoDB を使っていない」は誤り。** 現行実装は実際に `pga_docs` を
> 読み書きしている。これは原本アーティファクトを移植する過程で作られた**一時的な互換実装**で、
> 正しい言い方は **「目標設計では Pipeline に NocoDB を採用しない」** である。

---

## 1. PtAI Pipeline の `pga_docs` 依存一覧

Pipeline 専用の `pga_docs` テーブル（collection / doc_id / JSON）に入っているもの。
**CXM の 46 テーブルはここに含まれない。**
実データ件数は 2026-09-30 時点。

| Collection | 保存内容 | UI での利用箇所 | Twenty 移行先候補 | 移行難易度 | 移行後の扱い |
|---|---|---|---|---|---|
| `_raw` | Twenty＋Notion＋repo のスナップショット（125 社・5 分割） | `/api/ptai/raw` → board.js の全画面 | **不要。** Twenty から直接取得して変換する | 低 | **削除。** `PTAI_DATA_SOURCE=twenty` で読まなくなる |
| `edits`（104 件） | 商談の入力全般（フェーズ・追加MRR・申込完了日・課金開始日・到達予定・障壁・商談NA・経過ログ・承認状態）＋会社の上書き（Tier・業種・目標追加MRR・キー日程） | 商談管理タブ、企業一覧、KPI、お知らせ | Opportunity（標準＋新カスタム）／Company（標準＋新カスタム）／Task | **高** | 削除。ただしカスタムフィールドの承認が前提 |
| `aplans`（2 件） | サクセス管理（四半期ロードマップ・月/週 Todo・AI 案） | サクセス管理タブ | **カスタムオブジェクト** ＋ Task | **高** | 削除。器の設計が要る |
| `orgs`（3 件） | 組織図（ノード・役割・決裁者・影響力・スタンス・接触状況・会話メモ） | 組織図タブ | Person ＋ 新カスタムフィールド（＋上下関係のリレーション） | **高** | 削除。Person 間リレーションの可否が未確認 |
| `recent`（6 件） | AI 生成の「直近の動き」サマリー | 要約タブ | **Twenty に保存しない案を推奨**（再生成可能なキャッシュ） | 低 | アプリ側キャッシュへ。または破棄 |
| `feed`（5 件） | 変更ログ（誰が何を変えたか） | 新着・更新 | **Twenty の timelineActivities で代替**する案 | 中 | 削除。timelineActivities が UI から読めるか要確認 |
| `newcos`（1 件） | ダッシュボードで追加した企業と同期状態 | 企業一覧の「新規・未同期」 | Company（作成時に直接） | 低 | 削除。同期フラグ（`sync.twenty` / `twentyPending` / `syncedAt`）ごと不要になる |
| `settings`（1 件） | チーム目標（合算MRR・期限・メンバー別目標） | 目標設定エディタ、KPI | **Twenty に入れない案を推奨**（顧客データではなくアプリ設定） | 低 | アプリ設定として残す。要判断 |
| `plans`（0 件） | 旧プランニング（未使用） | 画面に出ない | — | — | **削除**（機能ごと廃止） |
| `chatwork`（0 件） | Chatwork 取り込み枠（未実装） | なし | — | — | **削除** |

### Pipeline が触る `pga_docs` 以外の NocoDB

| 依存 | 用途 | 扱い |
|---|---|---|
| `staff_identify` | **共通認証**（ログインとロール判定。`/api/ptai/me` の承認者判定を含む） | **対象外。** 顧客の業務データではなく社内アカウント。**移行後も NocoDB のまま残す** |
| `/api/ptai/profiles` | フィード表示の「誰が」。`staff_identify` を引く | `feed` を廃止すれば Pipeline からの参照は不要になる。テーブル自体は残る |

> **Health API（`/api/ops/twenty/health`）は NocoDB のデータを読まない。**
> import しているのは認証ガードだけで、Twenty 単体の疎通確認は NocoDB なしで完結する。
> 移行元を読むのは `/api/ops/twenty/raw-diff` だけで、これは Phase 2D で削除する。

> **Ops 画面の置き場所について。** `/ops/twenty` は `src/app/(cxm)/ops/twenty/` にあるが、
> これは **CXM のデータ機能ではなく、共通の管理 UI レイアウトを間借りしているだけ**である。
> 画面が読むのは Twenty と Pipeline の移行元だけで、CXM のテーブルには一切触れない。

---

## 2. Twenty スキーマ拡張案（**提案のみ。実行しない**）

現在ダッシュボードまたは Notion にしかない項目の格納案。

| 項目 | Twenty 格納先 | 型 | リレーション | 必須性 | 移行元 | 判断事項 |
|---|---|---|---|---|---|---|
| 8 段階フェーズ | Opportunity.stage を拡張／または新カスタム `pgaPhase` | SELECT | — | **必須** | `edits.opp.phase` | **stage を 8 段階に増やすか、別フィールドで持つか（Q6）。** 既存 5 段階の運用への影響 |
| 追加MRR目標 | Company `aimMrr` | CURRENCY | — | 高 | `edits.company.aim` | 会社単位でよいか、商談単位も要るか |
| 追加MRR実績 | Opportunity.netMrr（既存） | CURRENCY | — | **必須** | `edits.opp.addMrr` | `netMrr` と `amount` のどちらを使うか（両方空） |
| 課金開始日 | Opportunity `billingStartDate` | DATE | — | 高 | `edits.opp.billingDate` | closeDate（申込完了日）との使い分けを明文化 |
| 到達予定 | Opportunity `msEvaluation` / `msQuote` / `msApproval` / `msVerbalCommit` ＋ `msBase` | DATE ×4 ＋ SELECT | — | 中 | `edits.opp.ms` | **8 段階が未確定なのでフィールド名も確定できない。** Q6 の後 |
| 障壁 | Opportunity `barrier` | TEXT | — | 高 | `edits.opp.barrier` | 状態（未把握/把握済/解消済）は V74 で廃止済み。内容だけ |
| 次のアクション | Task（`taskTargets` で Opportunity に紐付け） | — | Task → Opportunity | **必須** | `edits.opp.na` | **Twenty の tasks は実測 0 件。** Task にするか Opportunity のカスタムにするか |
| 次のアクション期限 | Task.dueAt | DATE_TIME | 同上 | **必須** | `edits.opp.naDate` | 同上 |
| 失注理由 | Opportunity `lostReason` ＋ `lostDetail` | SELECT ＋ TEXT | — | 中 | `edits.opp.lostReason` | 選択肢の一覧を確定する |
| 担当3（主担当） | Company `primaryOwner` | SELECT または RELATION | → WorkspaceMember | **必須** | Notion 顧客DB＋取得スクリプトの固定マップ | **pgaOwner の先頭で代用できるか。** Baba / Eri / Kubotie が Twenty 未登録 |
| 組織図 | Person ＋ カスタムフィールド（`isDecisionMaker` / `influence` / `stance` / `contactStatus`）＋ 上下関係リレーション | BOOLEAN / SELECT ほか | Person → Company、Person → Person | 中 | `pga_docs/orgs` | **Person 間の上下関係リレーションが Twenty にあるか未確認。** グループ／部署ノードの受け皿も要る |
| サクセスプラン | **カスタムオブジェクト**（例 `successPlan`）＋ Task | — | → Company | 中 | `pga_docs/aplans` | 四半期の状態・狙う額を持つ器が要るか、Task だけで足りるか |
| AI 生成サマリー | **保存しない**（推奨）。保存するなら Note | — | → Company | 低 | `pga_docs/recent` | **再生成可能。** AI 生成物を人の議事録と混ぜてよいか |
| 活動フィード | **Twenty の timelineActivities で代替**（推奨） | — | — | 低 | `pga_docs/feed` | timelineActivities が API から読めるか未確認 |
| 承認状態 | Opportunity `pendingStage` ＋ `approvedAt`、または Twenty Workflow | SELECT ＋ DATE_TIME | — | 中 | `edits.opp.pendingPhase` | カスタムフィールドで持つか Workflow にするか |
| 同期／移行状態 | **不要** | — | — | — | `newcos.sync` / `edits.syncedAt` / `company.twentyPending` | Twenty が正本になれば「同期待ち」という概念自体が消える |

### 分類のまとめ

| 分類 | 件数 | 例 |
|---|---:|---|
| Twenty 標準フィールドで保持可能 | 13 | name / tier / mrr / closeDate / netMrr / needsSummary / pointOfContact ほか |
| 既存カスタムフィールドで保持可能 | 5 | pgaOwner / icpJudgment / issueAwareness / customerSource / qiYueZhuangKuang |
| **新しいカスタムフィールドが必要** | 9 | aimMrr / billingStartDate / 到達予定 4 つ / barrier / lostReason / keyDates / 担当3 / 承認状態 |
| **カスタムオブジェクト／リレーションが必要** | 3 | 組織図（Person 間リレーション）／サクセスプラン／商談NA（Task 運用） |
| Twenty に保存しなくてよい | 4 | AI サマリー / 活動フィード / チーム目標 / 旧未使用 collection |

コードからは `schemaChangesNeeded()` で一覧が取れる（`src/lib/twenty/sync-policy.ts`）。

---

## 3. 読み取り経路（Phase 2B で切り替える）

```
Twenty API
  ↓ GET（client.ts。読み取り専用・ページング完結・レート制御）
src/lib/twenty/adapters/{company,opportunity,note}.ts
  ↓
src/lib/twenty/adapters/ptai-raw.ts   ← RAW 互換 ViewModel を組み立てる
  ↓                                     **pga_docs へ保存しない**
GET /api/ptai/raw                     ← PTAI_DATA_SOURCE で分岐
  ↓
board.js（原本のまま）
```

| 要件 | 実装 |
|---|---|
| Twenty から取得して直接変換 | `buildPtaiRawFromTwenty()` |
| Pipeline から `pga_docs` へ保存しない | twenty 経路は `@/lib/ptai/store` を呼ばない |
| 現行 RAW 形式を維持 | `adapters/types.ts` の `RawSnapshot` が契約 |
| アダプターを独立させる | company / opportunity / note / pga-raw に分離 |
| API キーをブラウザへ渡さない | キーはサーバーの env のみ。応答にも入らない |
| 顧客データをログへ出さない | ログは件数と紐付け方式だけ |
| ページングを完全に処理 | `listRecords` がカーソルを辿る。`pageSize` は 200 に丸める |
| 部分的な取得失敗を明示 | `diagnostics.partialFailures` ＋ `X-Ptai-Partial-Failures` ヘッダ |
| キャッシュ方針 | twenty: `private, max-age=60`（プロセス内キャッシュなし）／legacy: `max-age=300` |
| 反映遅延 | `X-Ptai-Staleness-Seconds: 66`（HTTP 60 秒＋board.js のポーリング 6 秒） |
| 戻せる Feature Flag | `PTAI_DATA_SOURCE=legacy_nocodb`（既定）／`twenty` |

### 紐付け方式は結果に含める

アダプターは各レコードについて `relation` / `exact_name` / `title` / `unresolved` のどれで
紐付いたかを返し、`diagnostics` に件数を積む。**紐付かないものは捨てない。**

- 商談：`company` リレーション → 正規化社名の完全一致 → unresolved（`unmatchedOpps` に残す）
- 議事録：`noteTargets` → タイトル照合 → unresolved（件数のみ）
- **部分一致は使わない。** 誤って別の会社に付くほうが害が大きい

### 8 段階フェーズは変換しない

`STAGE_MAPPING_DECIDED = false`。Twenty の `stage` を `RawOpportunity.st` にそのまま入れる。
board.js は「8 段階のどれでもない値」を**未入力として扱う**（原本の「フェーズを推定しない」方針と一致）。
Q6 が決まるまでこのままにする。

---

### 実測（2026-09-30。`PTAI_DATA_SOURCE=twenty` で 1 回だけ検証。保存はしていない）

| 項目 | 値 |
|---|---|
| 応答 | HTTP 200 / 249KB / 7.7 秒 |
| 企業 | **126 社**（移行元スナップショットは 125 社） |
| メンバー | 15 |
| 商談を持つ会社 | 45 |
| 議事録を持つ会社 | 59 |
| 紐付かない商談 | 4 |
| 紐付かない議事録 | 35 |
| 部分的な取得失敗 | 0 |
| 出現した stage | `PROPOSAL` / `MEETING` / `SCREENING` / `NEW`（**8 段階へ変換していない**） |
| ヘッダ | `X-Ptai-Data-Source: twenty`、`X-Ptai-Staleness-Seconds: 66`、`Cache-Control: private, max-age=60` |

> **`raw-diff` の数字（商談 1 件・議事録 24 件が未紐付）と食い違うのは仕様。**
> アダプターは**正規化後に社名が重複する会社を照合表に登録しない**（誤って別の会社に
> 付くのを避けるため）。実測で 3 種類・6 社が重複しており、そのぶん unresolved が増える。
> `raw-diff` は重複を考慮しない素朴な照合なので、見かけ上の一致が多くなる。
> **どちらが正しいかではなく、アダプター側が安全側に倒している。**
> Phase 2C で Twenty の `company` リレーションを埋めれば、この差は消える。

## 4. 改訂 Phase 2 ロードマップ

### Phase 2A — スキーマ確定（**次にやること**）

| | |
|---|---|
| 目的 | Twenty に足りない器を確定し、承認を得る |
| 内容 | §2 の拡張案を Leevis と詰める／stage 8 段階の保持方法を決定／担当3 の保持方法を決定／Opportunity↔Company リレーションの修復方針／Note↔Company の修復方針 |
| 完了条件 | カスタムフィールド一覧が承認され、`sync-policy.ts` の `open` が空になる |
| リスク | 承認が下りないと Phase 2C の範囲が縮む。stage が決まらないとフェーズ同期ができない |
| 依存 | Leevis の判断、Twenty の管理者権限 |

### Phase 2B — 読み取り切り替え

| | |
|---|---|
| 目的 | Twenty から取った ViewModel で現行画面が成立することを確認する |
| 内容 | Preview だけ `PTAI_DATA_SOURCE=twenty`／旧画面と並べて比較／件数・KPI・企業詳細の突き合わせ／**`pga_docs` へは保存しない** |
| 完了条件 | 企業数・KPI・個社の表示が旧画面と一致（差分は説明できるものだけ） |
| リスク | 商談の紐付けが社名照合頼りなので、1 件が付かない。議事録は 24 件が付かない |
| 依存 | Phase 2A は**不要**（フェーズだけ同期対象外にすれば進められる） |

### Phase 2C — 既存データ移行（**今回は実行しない**）

| | |
|---|---|
| 目的 | Pipeline が `pga_docs` / Notion に溜めてきた入力を Twenty へ移す |
| 内容 | 移行計画／**dry-run**／差分レポート／承認／バックアップ／本番移行 |
| 完了条件 | `edits` の全項目が Twenty 側で参照でき、ダッシュボードが `pga_docs` を読まなくても表示が変わらない |
| リスク | 上書き事故。`needsSummary`（48/49 件）と `pointOfContact`（46/49 件）は **Twenty 側が埋まっているので上書きしない** |
| 依存 | Phase 2A のスキーマ承認 |

### Phase 2D — PtAI Pipeline から `pga_docs` 依存を除去

| | |
|---|---|
| 目的 | Pipeline の二重正本を終わらせる（**CXM の NocoDB 利用は継続する**） |
| 内容 | Pipeline からの `pga_docs` 読み書き停止／旧同期コード削除／`PTAI_DATA_SOURCE` フラグ削除／`raw-diff` 削除／`data-source.ts` 削除／**`NOCODB_PGA_DOCS_TABLE_ID` のみ**削除 |
| リスク | なし（範囲が Pipeline に閉じている） |
| 依存 | Phase 2C |

**完了条件**（対象範囲を明示する）

- `/api/ptai/**` の業務データの取得・保存が `pga_docs` を使用しない
- Pipeline UI の保存操作が Twenty へ向く
- `/api/ptai/raw` が Twenty だけで生成できる
- `NOCODB_PGA_DOCS_TABLE_ID` を削除できる
- `src/lib/ptai/store.ts` が Pipeline から参照されなくなる、または安全に削除できる
- `removableLegacyDeps()` の全項目が消えている

**完了条件に含めないもの**（満たされていなくてよい）

- `staff_identify` など共通認証の NocoDB 利用は**残ってよい**
- CXM の `src/lib/nocodb/**` には**影響がない**こと（差分ゼロであるべき）
- `NOCODB_PGA_DOCS_TABLE_ID` 以外の NocoDB 環境変数は**残す**

> **`grep -r "lib/ptai/store" src/` が 0 件、という完了条件は使わない。**
> 対象範囲が曖昧で、CXM 側まで巻き込んだ検査に見えるため。

---

## 5. 未解決事項

| # | 内容 | 影響するフェーズ |
|---|---|---|
| **Q6** | stage 5 段階 ⇄ 8 段階の対応 | 2A / 2C |
| **Q1** | API キーを個人が発行できるか | 書き込み方式（2C 以降） |
| **Q17** | 現在のキーが読み取り専用か（**未確認**） | 全般 |
| Q7 | カスタムフィールドの追加承認 | 2A |
| — | 担当3 を Twenty のどこに持つか | 2A |
| — | Person 間の上下関係リレーションが Twenty にあるか | 2A（組織図） |
| — | サクセスプランにカスタムオブジェクトが要るか | 2A |
| — | `timelineActivities` が API から読めるか | feed の廃止可否 |
| — | チーム目標を Twenty に入れるか（顧客の業務データではないので、Pipeline のアプリ設定として残す案がある） | 2D |
| — | AI サマリーを Twenty に保存するか | 2D |
| — | `netMrr` と `amount` の使い分け | 2A |
| — | 紐付かない商談 1 件・議事録 24 件の扱い | 2B / 2C |
