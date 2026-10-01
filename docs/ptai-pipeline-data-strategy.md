# PtAI Pipeline データ戦略（短期 NocoDB 運用 ＋ Twenty 利用可否判定）

- 作成日：2026-09-30
- 状態：**調査・設計まで。** NocoDB のテーブル作成／名称変更／スキーマ変更／データ移行／本番切り替えは未実施
- 例外：2026-09-30 に**利用者の明示承認のもと、Twenty への可逆な書き込みプローブを 1 回だけ実施**した（§4-2）。
  既存データには触れず、作成したものはすべて削除して原状復帰を確認済み
- 前提の変更：2026-09-30 に「Twenty へ全面集約」の方針を**保留**し、
  「短期は Pipeline 専用 NocoDB、Twenty は機能ごとに実測して段階的に採用」へ切り替えた
- 関連：[twenty-migration-plan.md](./twenty-migration-plan.md)、[twenty-phase1-validation.md](./twenty-phase1-validation.md)、[current-state-audit.md](./current-state-audit.md)

---

## 0. 適用範囲と CXM との境界

### 対象（PtAI Pipeline）

`/ptai-pipeline` ／ `/api/ptai/**` ／ `src/lib/ptai/**` ／ `src/lib/twenty/**` ／
Pipeline 用 NocoDB テーブル ／ Twenty Ops・診断 ／ Pipeline 関連ドキュメント

### 対象外（**変更しない**）

CXM の既存 NocoDB テーブル ／ `src/lib/nocodb/**` の CXM 用処理 ／ CXM の API・画面・バッチ ／
Salesforce 連携 ／ CXM の Notion 連携 ／ Metabase 連携 ／ 共通認証の `staff_identify`

> **共通認証は例外扱い。** Pipeline も `staff_identify` でログインとロール判定を行うが、
> これは社内アカウントであって Pipeline の業務データではない。分離の対象に含めない。

### 新方針の要点

| | |
|---|---|
| 短期 | Pipeline は NocoDB を使う。ただし**Pipeline 専用であることを名前で明示する** |
| Twenty | 全面集約は**確定しない**。オブジェクト・項目ごとに実測して利用可否を決める |
| 書き込み | 当面 Twenty へは**実装も実行もしない** |
| 使えない機能 | NocoDB で保持する。「将来使う前提」で設計を歪めない |

---

## 1. 現在の Pipeline 用 NocoDB（実測）

### 1-1. 物理情報

| 項目 | 実測値 |
|---|---|
| 物理テーブル名 | `pga_docs`（title も `pga_docs`） |
| NocoDB Table ID | `m0vfof8a1mwd75p` |
| Base | `pcng30q6j3dqrsk`（title **`EC`**）。**CXM の 93 テーブルと同じ base に同居している** |
| Source | `bps80wmfrffptu1` |
| 環境変数 | `NOCODB_PGA_DOCS_TABLE_ID` |
| 接続情報 | `NOCODB_BASE_URL` / `NOCODB_API_TOKEN` を **CXM と共有**（Pipeline 専用の資格情報は無い） |
| 総行数 | **127 行** |

> ⚠️ **コードに既定値がハードコードされている。**
> `src/lib/ptai/store.ts` は `process.env.NOCODB_PGA_DOCS_TABLE_ID ?? 'm0vfof8a1mwd75p'`。
> 環境変数を消しても無効化されず、**実データのテーブルへ書き続ける**。

### 1-2. スキーマ

| 列 | 型 | 用途 |
|---|---|---|
| `Id` | ID（PK, AutoIncrement） | 行 ID |
| `CreatedAt` / `UpdatedAt` | CreatedTime / LastModifiedTime | NocoDB 自動 |
| `nc_created_by` / `nc_updated_by` | CreatedBy / LastModifiedBy | NocoDB 自動（API トークン経由なので実質空） |
| `nc_order` | Order | NocoDB 自動 |
| `collection` | SingleLineText | Firestore 風の collection 名 |
| `doc_id` | SingleLineText | ドキュメント ID（企業 UUID など） |
| `data` | LongText | JSON 文字列。**1 セル 60KB 前後で 422** |
| `at` | SingleLineText | 並び替え用のタイムスタンプ |
| `updated_at_s` | SingleLineText | 更新時刻 |
| `deleted` | Checkbox | 論理削除フラグ（読み取り時に除外） |

> **`(collection, doc_id)` に一意制約が無い。** NocoDB の unique フラグは API 経由の
> 重複 INSERT を止められないため、同時実行で同じ doc が 2 行になりうる。
> `setDoc` は「1 行目を探して PATCH、無ければ POST」なので、重複が出ると後続の更新が
> 片方の行にしか当たらず、**読み取り時にどちらが返るかは並び順次第**になる。

### 1-3. collection 別の実データ（2026-09-30 実測）

| Collection | 用途 | 読み込み箇所 | 書き込み箇所 | 正本 | リスク |
|---|---|---|---|---|---|
| `_raw`（5 行 / 198KB） | Twenty＋Notion＋repo から作った企業・商談・議事録のスナップショット。50KB ごとに 5 分割 | `/api/ptai/raw` → `board.js` の全画面 | `scripts/ptai-seed-raw.mjs`（手動）。UI からは書かない | **Twenty ＋ Notion**（NocoDB は写し） | 固定スナップショット。Twenty の更新が反映されない。**現在 2026-09-28 時点で停止** |
| `edits`（104 行 / 43KB） | 商談の入力全般（フェーズ・追加MRR・申込完了日・課金開始日・契約期間・到達予定・障壁・商談NA・経過ログ・承認状態）＋会社の上書き（Tier・業種・目標追加MRR・キー日程） | `db.collection('edits').onSnapshot` → 商談管理・企業一覧・KPI・お知らせ | `db.doc('edits/<cid>').set`（3 箇所） | **NocoDB**（Twenty に受け皿が無い） | **全置換・後勝ち。** 同じ企業を 2 人が同時編集すると片方が消える |
| `aplans`（2 行 / 4.4KB） | サクセス管理（四半期ロードマップ・月/週 Todo・AI 案） | `db.collection('aplans').onSnapshot` → サクセス管理 | `db.doc('aplans/<cid>').set` | **NocoDB** | 同上。Twenty に器が無い |
| `orgs`（3 行 / 11KB） | 組織図（ノード・役割・決裁者・影響力・スタンス・接触状況・会話メモ） | `db.collection('orgs').onSnapshot` → 組織図 | `db.doc('orgs/<cid>').set` | **NocoDB** | 同上。1 社ぶんが 1 行 4.7KB で、ノードが増えると 60KB 制限に近づく |
| `recent`（6 行 / 7KB） | AI 生成の「直近の動き」サマリー | `db.collection('recent').onSnapshot` → 要約 | `db.doc('recent/<cid>').set` | **再生成可能なキャッシュ**（正本ではない） | 消えても再生成できる。優先度は低い |
| `feed`（5 行 / 1.3KB） | 変更ログ（誰が何を変えたか） | `db.collection('feed').orderBy` → 新着・更新 | `db.collection('feed').add`（追記のみ） | **NocoDB** | 追記のみなので競合しない。上限管理が無く無限に増える |
| `newcos`（1 行） | ダッシュボードで追加した企業と同期状態 | `db.collection('newcos').onSnapshot` → 企業一覧「新規・未同期」 | `db.doc('newcos/<id>').set` | **NocoDB** | Twenty へ同期する前提の `sync.twenty` フラグを持つが、同期処理は未実装 |
| `settings`（1 行） | チーム目標（合算MRR・期限・メンバー別目標）。doc は `settings/targets` 固定 | `db.doc('settings/targets').onSnapshot` → 目標設定エディタ・KPI | `tgtRef.set` | **NocoDB**（顧客データではなくアプリ設定） | 全置換。1 ドキュメントに全員の目標が入るので、同時保存で他人の目標が消える |
| `plans`（**0 行**） | 旧プランニング（未使用） | `db.collection('plans').onSnapshot` | `db.doc('plans/<id>').set` / `.delete()` | — | 実データ 0。機能ごと廃止の候補 |
| `chatwork`（**0 行**） | Chatwork 取り込み枠（未実装） | `db.collection('chatwork').onSnapshot` | なし | — | 実データ 0。廃止の候補 |

### 1-4. 参照経路（Pipeline 以外から参照されていないか）

| 参照元 | 種別 | 備考 |
|---|---|---|
| `src/app/api/ptai/db/route.ts` | 読み書き | `listAllDocs` / `setDoc` / `addDoc` / `deleteDoc`。`_raw` は除外して返す |
| `src/app/api/ptai/raw/route.ts` | 読み | `getRawSnapshot`（legacy 経路） |
| `src/app/api/ops/twenty/raw-diff/route.ts` | 読み | 移行確認用の一時ツール。**書き込みなし** |
| `scripts/ptai-seed.mjs` / `scripts/ptai-seed-raw.mjs` | 書き | 初期投入用の手動スクリプト |

- **CXM からの参照は 0 件。** `src/lib/nocodb/client.ts` の `TABLE_IDS` に `pga_docs` は無く、
  `src/lib/nocodb/**` に `pga` / `ptai` の文字列も無い（実測）。
- Pipeline 以外の参照は上記 Ops 診断とシードスクリプトだけ。いずれも Pipeline の周辺。
- `/api/ptai/profiles` は `staff_identify` を読むが、これは**共通認証**であり Pipeline データではない。

### 1-5. 環境別の設定（Vercel。値は参照せず名前と対象環境のみ）

| 変数 | Production | Preview | Development |
|---|---|---|---|
| `NOCODB_PGA_DOCS_TABLE_ID` | あり | あり | あり |
| `NOCODB_BASE_URL` / `NOCODB_API_TOKEN` | あり（**CXM と共用**） | あり | あり |
| `PTAI_DATA_SOURCE` | **未設定** | **未設定** | **未設定** → 既定 `legacy_nocodb` |
| `TWENTY_API_KEY` | あり | **無し** | **無し**（ローカルの `.env.local` のみ） |

> ⚠️ **ローカル（Development）の `NOCODB_PGA_DOCS_TABLE_ID` は、コードのハードコード既定値と
> 同一の値＝実データが入っている本番テーブルを指している**（実測で一致を確認）。
> つまり **`npm run dev` で開いた画面の保存操作が、そのまま実データを書き換える。**
> Preview と Production の値は Vercel 上で Hidden のため未確認だが、
> base もトークンも共通なので**3 環境が同じ 1 テーブルを共有している可能性が高い**。
>
> ⚠️ Preview に `TWENTY_API_KEY` が無いため、**Preview では Twenty の疎通確認ができない。**

### 1-6. バックアップ・復旧

- **仕組みは無い。** アプリ側にエクスポート機能もスナップショット世代管理も無い。
- 復旧手段は NocoDB（`odtable.ptmind.ai`）側のバックアップに依存するが、
  その有無・保持期間・復旧手順は**未確認**。
- `setRawSnapshot` は「既存チャンクを DELETE してから POST」する。
  **DELETE 後 POST 前に落ちると `_raw` が消えたままになる。** ロールバックは無い。

### 1-7. 同時更新と全置換のリスク

| 論点 | 現状 |
|---|---|
| 楽観ロック | **無い。** `updated_at_s` は書くだけで、更新時に検証していない |
| 保存粒度 | **ドキュメント全置換。** 1 企業ぶんの `edits` をまるごと上書きする |
| 競合の見え方 | A と B が同じ企業を開いていると、後に保存した側の内容で**前の入力が消える**。警告も出ない |
| 反映の遅れ | サーバー側 2.5 秒メモ ＋ クライアント 6 秒ポーリング。**最大 8.5 秒は古い値を見て編集しうる** |
| 影響の大きい collection | `settings`（1 ドキュメントに全員の目標）、`edits`（1 企業の全入力）、`orgs`（1 社の組織図全体） |

---

## 2. Pipeline 専用の命名規則（**提案。実行しない**）

### 2-1. 推奨する名前

| 対象 | 現在 | 推奨 |
|---|---|---|
| 物理テーブル | `pga_docs` | **`ptai_pipeline_store`** |
| 環境変数 | `NOCODB_PGA_DOCS_TABLE_ID` | **`NOCODB_PTAI_PIPELINE_STORE_TABLE_ID`** |
| コード上の層 | `src/lib/ptai/store.ts` | `src/lib/ptai/`（後述の構造） |

**`ptai_pipeline_store` を推す理由**

- `ptai_pipeline` を含むので、93 テーブルが並ぶ base の一覧でも Pipeline のものだと一目で分かる
- `documents` / `records` は「何の」が抜けていて、CXM の `csm_documents` と紛らわしい
- `store` は「Pipeline の保存先」であることを表し、collection/doc_id/JSON という中身の形にも合う

**避けるべき名前**

| 避ける | 理由 |
|---|---|
| `PtAI_DOCS` | 略称の意味が社内で共有されていない。`docs` も何の文書か分からない |
| `STORE_TABLE_ID` / `NOCODB_STORE_TABLE_ID` | 汎用的すぎる。どの製品のものか分からない |
| `documents` / `records` 単体 | CXM の `csm_documents` と誤認する |
| `shared_*` / `common_*` | CXM と共有しているように読める |

### 2-2. 案A（単一 JSON テーブル維持）と 案B（用途別に正規化）の比較

| 評価項目 | 案A：`ptai_pipeline_store` 1 テーブル | 案B：用途別 6 テーブル |
|---|---|---|
| 移行コスト | **小。** テーブル名と環境変数名の変更のみ。データは同じ形 | **大。** collection ごとに列設計・型変換・移行スクリプト・検証が要る |
| 現行 UI との互換性 | **完全。** `window.claude.use('db')` の collection/doc モデルがそのまま載る | **要改修。** `board.js`（原本 2,500 行）が collection/doc 前提。shim で吸収しても差異が残る |
| 検索性 | **低い。** JSON 文字列なので「フェーズが見積中の商談」を DB 側で絞れない。全件取得してアプリで絞る | **高い。** 列で絞れる。NocoDB の画面でも読める |
| 整合性 | **低い。** 型はアプリ任せ。壊れた JSON を入れても DB は止めない | **高い。** 型・必須・選択肢を DB が守る |
| 同時更新 | **弱い。** ドキュメント全置換で後勝ち | **強くできる。** 行・列単位で更新でき、項目ごとの競合に絞れる |
| バックアップ | テーブル 1 本のエクスポートで完結 | 6 本の整合を取る必要がある |
| 将来の Twenty 連携 | 項目の所在が JSON の中なので、対応付けをコード（`sync-policy.ts`）で持つ必要がある | 列が Twenty のフィールドに 1:1 で対応し、移行しやすい |
| 60KB 制限 | **残る。** `orgs` が 1 行 4.7KB、`_raw` は分割が必要 | 解消する |

### 2-3. 推奨：**短期は 案A**

理由は 3 つ。

1. **今回の目的が「現在の画面と入力機能を安定して利用できること」だから。**
   案B は `board.js` の改修を伴い、UI の挙動を変えるリスクが移行の利得を上回る。
2. **正規化の設計が Twenty の判定に依存するから。** 8 段階フェーズ・到達予定・担当3 は
   まだ「Twenty に持つか Pipeline に持つか」が決まっていない（§4・§6）。
   先に列を切ると、判定が変わったときに 2 回移行することになる。
3. **案A でも今のリスクの大半は潰せる。** 競合と全置換は、テーブル構造ではなく
   **保存 API の作り**（後述の楽観ロック・差分保存）で改善できる。

ただし **`settings` だけは案B 寄りに分けることを推奨する。** 1 ドキュメントに全員の目標が
入っており、同時保存で他人の目標が消える。`ptai_pipeline_settings`（または
同一テーブル内で `doc_id` をメンバー単位に割る）にして、競合範囲を 1 人ぶんに狭める。

> **今回は提案まで。物理テーブルの作成・名称変更は行っていない。**

---

## 3. CXM との分離条件

| # | 条件 | 現状 | 対応 |
|---|---|---|---|
| 1 | Pipeline 用テーブル名に `ptai_pipeline` を含める | ❌ `pga_docs` | §2 の改名（**要承認**） |
| 2 | Pipeline 用環境変数名に `PTAI_PIPELINE` を含める | ❌ `NOCODB_PGA_DOCS_TABLE_ID` | §2 の改名（**要承認**） |
| 3 | CXM の `TABLE_IDS` へ混在させない | ✅ 既に入っていない（実測） | 維持。テストで固定する |
| 4 | Pipeline 用のクライアント／型／リポジトリを `src/lib/ptai/` に置く | △ `store.ts` 1 本のみ | §3-2 の構造へ整理 |
| 5 | CXM の `src/lib/nocodb/**` を変更しない | ✅ 今回も差分 0 | 維持 |
| 6 | Pipeline のデータアクセス経路を一覧化する | ✅ §1-4 | ドキュメントで維持 |
| 7 | Pipeline の NocoDB 利用がコード検索で特定できる | △ `pga_docs` で引ける | 改名後は `ptai_pipeline` で引ける |
| 8 | Pipeline 専用テーブルへ CXM データを書かない | ✅ 書いていない | `collections.ts` の許可リストで固定 |
| 9 | CXM テーブルへ Pipeline データを書かない | ✅ 書いていない | 維持 |
| 10 | `staff_identify` は共通認証として例外 | ✅ | 明文化済み |

> **同じ base に同居している点は残る。** `pga_docs` は CXM の 93 テーブルと同じ base
> `pcng30q6j3dqrsk` にあり、API トークンも共通。**論理的な分離は名前とコードで達成できるが、
> 物理的な分離（別 base・別トークン）は別途判断が要る。**

### 3-2. 推奨する構造（必要以上に抽象化しない）

```
src/lib/ptai/
  collections.ts   collection 名の許可リストと型。今の PtAI_COLLECTIONS をここへ移す
  schema.ts        各 collection の JSON 形状（type のみ。ランタイム検証は最小限）
  store.ts         NocoDB への薄い HTTP 層（現状の store.ts から HTTP 部分だけ残す）
  repository.ts    collection 単位の読み書き（listAll / get / set / add / delete / RAW）
```

- `migrations/` は**今は作らない。** 移行スクリプトが 1 本も無い段階でディレクトリだけ
  用意しても意味が無く、`scripts/ptai-seed*.mjs` と二重になる。必要になってから作る。
- 既存の `store.ts` は 1 ファイル 8KB で、HTTP・collection 定義・RAW 分割が混ざっている。
  分けるのは**この 3 責務までで十分**。リポジトリ層を汎用化しない。

---

## 4. Twenty 利用可否マトリクス（2026-09-30 実測。**GET のみ**）

判定は `usable` / `usable_with_workaround` / `not_ready` の 3 段階。

| 対象 | 判定 | 実測事実 | 不足 | 暫定策 | 再判定条件 |
|---|---|---|---|---|---|
| **Company** | **usable** | PtAI 対象 126 件。`mrr` 120/126、`tier` 121、`pgaStatus` 125、`pgaOwner` 125、`industryJp` 122、`customerSource` 100。フィールド 114 個 | `companySizeLayer` 26/126、`icpJudgment` 11、`issueAwareness` 10、`qiYueZhuangKuang` 8 と、判断系は薄い | 空欄は「未入力」として表示し、**推測で埋めない** | 判断系 4 項目が 8 割以上埋まったら、それらも Twenty 読み取りへ |
| **Opportunity** | **not_ready** | 49 件。`company` **0/49**、`owner` **0/49**、`netMrr` **0/49**、`amount` **0/49**、`closeDate` **0/49**。`pointOfContact` 46、`needsSummary` 48 | 会社・担当・金額・日付がすべて空。商談として成立していない | **商談は Pipeline 側（`edits`）を正本にする。** Twenty からは `needsSummary` と `pointOfContact` だけを補助表示 | `company` リレーションが 8 割以上埋まり、`netMrr` または `amount` の運用が決まったら再評価 |
| **Person** | **not_ready** | 2,368 件。**`companyId` が 200 件サンプルで 0 件**。Company 側の `people` も 0 件。Person↔Person の上下関係リレーションは**存在しない**（`manager` 等の項目なし） | 会社との紐付けが無く、階層も表現できない | **組織図は Pipeline（`orgs`）を正本にする** | Person の `companyId` が埋まり、かつ上下関係を持つ手段（自己参照リレーション or カスタムオブジェクト）ができたら再評価 |
| **Note** | **usable_with_workaround** | 114 件。`title` と `bodyV2`(RICH_TEXT) は全件あり | 会社への紐付けが無い（下記 NoteTarget） | 議事録の**本文は Twenty を読む**。会社への割り当てはタイトル照合（暫定）で行い、付かないものは件数で明示 | NoteTarget が会社を指すようになったら照合を廃止 |
| **NoteTarget** | **not_ready** | 24 件。**内訳は `targetPerson` 24 件 / `targetCompany` 0 件 / `targetOpportunity` 0 件** | **Note→Company の紐付けは 1 件も無い。** Person 経由も、Person に会社が無いので辿れない | タイトル照合のみ | `targetCompany` が付き始めたら再判定 |
| **Task** | **not_ready** | **0 件**。`taskTargets` も 0 件。スキーマ（`title` / `bodyV2` / `dueAt` / `status` / `assignee`）は存在する | 運用実績ゼロ。誰も使っていない | 商談 NA は Pipeline（`edits.opp.na`）に保持 | Twenty 側で Task 運用が始まり、100 件規模になったら再評価 |
| **WorkspaceMember** | **usable** | 15 件。id → 表示名の解決に使える | Baba / Eri / Kubotie が未登録 | 未登録メンバーは Pipeline 側の呼称マップで補う | 全メンバーが登録されたらマップを廃止 |
| **Timeline / Activity** | **usable_with_workaround** | `timelineActivity` **15,650 件**、REST で読める。`targetCompany` 87/200。イベント名は `company.created` `person.deleted` `note.updated` などの**レコード CRUD のみ** | 「誰が」が入らない（`workspaceMemberId` 2/200）。Pipeline の画面操作（フェーズ変更・目標更新）は当然記録されない | **Pipeline の `feed` は置き換えない。** Timeline は「Twenty 側で何が起きたか」の参考表示に留める | Pipeline が Twenty へ書くようになり、その操作が Timeline に載るようになったら再評価 |
| **カスタムフィールド** | **usable（技術的に）／承認待ち** | **実測：`POST /rest/metadata/fields` が HTTP 201。TEXT フィールドを追加し、`DELETE` で削除できた**（§4-2）。Company は 114 フィールドあり拡張済み。ただし **REST の metadata 応答に `isCustom` キーが無い**（object・field とも） | 技術的な障害は無い。残るのは**組織的な承認**（Q7）と、**API から「標準かカスタムか」を判別できない**こと | 必要なフィールドは**名前で存在確認**する。分類はドキュメント側で持つ | Leevis の承認が下りたら `aimMrr` ほかの追加案（§6 で `not_ready` としたもの）を実行できる |
| **カスタムオブジェクト** | **usable（技術的に）／承認待ち** | **実測：`POST /rest/metadata/objects` が HTTP 201。作成 → レコード投入 → `DELETE` で完全に削除できた**（§4-2）。既存のオブジェクトは 29 個で、**独自に追加されたものは 0 件** | 技術的な障害は無い。残るのは**組織的な承認**と、器の設計そのもの | 短期はサクセスプランを Pipeline（`aplans`）に保持。設計が固まってから作る | 承認が下りて器の設計が決まったら、`successPlan` などを作成できる |
| **Webhook** | **not_ready（未検証）** | `/rest/webhooks` は 200 で読めるが **登録 0 件**。Metadata OpenAPI に `POST /webhooks` が存在するので、Admin キーなら**登録できる可能性が高い**（未実行） | 受け口となるエンドポイントがアプリ側に無い。配送保証・リトライの挙動も未確認 | ポーリングで代替（現行どおり 6 秒） | 受け口を作ってから 1 本登録し、実際に届くことを確認する |
| **API キーの権限** | **🚨 書き込み可能（Admin キー）** | `/rest/apiKeys` が読め、**8 件**返る＝PtAI に絞られたキーではない。**利用者への確認で、Production の `TWENTY_API_KEY` は Admin キーだと確定した（2026-09-30）** | **読み取り専用キーが無い。** Admin キーが本番アプリの環境変数に入っている。Twenty 側に監査ログ API も無い（`/rest/auditLogs` は 4xx） | アプリ側で GET しか発行しない実装を維持する（`client.ts` に書き込み関数を置かない）。**これが唯一の歯止め** | **読み取り専用キーを発行して差し替える。** 差し替えるまで、書き込みを伴う実装に着手しない |
| **監査ログ** | **not_ready** | `/rest/auditLogs` は 4xx。metadata に `auditLog` オブジェクトも無い | Twenty 側に監査ログの API が無い | **Pipeline 側で監査ログを持つ**（誰が何を変えたか）。現行の `feed` がその役割 | Twenty が監査ログ API を提供したら再評価 |
| **レート制限** | **usable_with_workaround** | 応答に `X-RateLimit-*` / `Retry-After` の**ヘッダーが付かない**（実測で 0 個） | 残量が分からない。上限は仕様値の約 10 req/s しか根拠が無い | クライアント側で 10 req/s に自主制限し、429 と 5xx を 2/4/8 秒でリトライする（実装済み） | ヘッダーが返るようになったら残量ベースの制御へ |
| **バッチ処理** | **not_ready** | REST は `limit` 最大 200（超えると**黙って切り詰め**）、既定 60、`depth` は 0/1 のみ、`fields` パラメータ無し。一括書き込みの検証は未実施 | 一括 upsert の挙動・上限・部分失敗時の扱いが不明 | 読み取りはカーソルページングで実装済み。書き込みは実装しない | 書き込みを始める前に、検証用データで一括 POST の挙動を確認する |
| **リレーション** | **not_ready** | 定義は揃っている（Opportunity→Company/Person/WorkspaceMember、NoteTarget→Company/Person/Opportunity、Company→People）。**しかし実データがほぼ全部空**（Opportunity.company 0/49、Person.company 0/2368、NoteTarget→Company 0/24） | データが入っていない | 社名照合・タイトル照合を**暫定策として明示**し、付かないものは unresolved として件数に出す | 各リレーションの充足率が 8 割を超えたら照合を廃止 |
| **更新・削除** | **usable** | **実測：`PATCH /rest/{plural}/{id}` が HTTP 200 で、送った項目だけが更新された（部分更新できる）。`DELETE /rest/{plural}/{id}` も HTTP 200**（§4-2） | 無し（技術面） | — | — |
| **冪等性** | **not_ready（実測で否定された）** | **実測：同じ内容を 2 回 POST すると、別 id のレコードが 2 件できた（HTTP 201 / 201）。重複を止める仕組みは無い**（§4-2） | **一意制約も upsert キーも無い。** リトライやダブルクリックがそのまま重複になる | 書き込みを実装するときは、**アプリ側で「作る前に検索」＋自前の冪等キー**を必ず入れる。`newcos` の Twenty 作成はこれ無しに実装しない | Twenty が upsert を提供したら再評価 |

### 4-2. 書き込み可否の実測（2026-09-30。**利用者の明示承認に基づく可逆プローブ**）

Production の `TWENTY_API_KEY` が Admin キーだと確定したため、**既存データに触れない形**で
書き込み可否を実測した。検証専用のカスタムオブジェクトを作り、その中だけで
作成・更新・削除を試し、最後にオブジェクトごと削除して原状復帰させている。
**Company / Opportunity / Person / Note には一切触れていない。**

| # | 操作 | 結果 |
|---|---|---|
| 1 | `POST /rest/metadata/objects`（検証用オブジェクト `ptaiWriteProbe` を作成） | **HTTP 201。テーブルを作れる** |
| 2 | `POST /rest/metadata/fields`（TEXT フィールドを追加） | **HTTP 201。フィールドを追加できる** |
| 3 | `POST /rest/ptaiWriteProbes`（レコード作成） | **HTTP 201** |
| 4 | `PATCH /rest/ptaiWriteProbes/{id}`（部分更新） | **HTTP 200。送った項目だけが更新された** |
| 5 | 同じ内容を再度 `POST` | **HTTP 201。別 id で 2 件目ができた＝冪等ではない** |
| 6 | `DELETE`（レコード ×2 → フィールド → オブジェクト） | **すべて HTTP 200** |

**後始末の確認**

| 項目 | 結果 |
|---|---|
| `/rest/ptaiWriteProbes` | HTTP 400（エンドポイントごと消えた） |
| オブジェクト数 | **29 個**（プローブ前と同じ） |
| Company / Opportunity / Person / Note / Task の件数 | **5,134 / 49 / 2,368 / 114 / 0 — プローブ前と完全に一致** |
| 残存物 | object / field / record とも **0** |

> ⚠️ **`timelineActivity` に 3 件（`ptaiWriteProbe.created` ×2、`ptaiWriteProbe.updated`）が残る。**
> 15,650 → 15,653 件。Twenty の Timeline は削除できない追記ログで、
> 参照先のオブジェクトはすでに消えている。**実害は無いが、痕跡は消せない。**

**この結果が意味すること**

1. **技術的な制約はもう無い。** Q7（カスタムフィールドの追加可否）の技術面は解決した。
   残っているのは**組織的な承認**と、**Company を他チームと共有していること**への配慮だけ。
2. **冪等性が無いことが確定した。** これは書き込み設計の前提を変える。
   「作る前に検索する」「アプリ側で冪等キーを持つ」を必ず入れる必要がある。
   とくに `newcos`（ダッシュボードで追加した企業）の Twenty 作成は、
   これ無しに実装すると**リトライのたびに企業が増える**。
3. **Admin キーが本番アプリの環境変数に入っている危険性が裏付けられた。**
   コードから 1 行呼べば、この手順がそのまま本番の Company に対して実行できる。
   **読み取り専用キーへの差し替えを最優先にすること。**

---

### 4-1. 2026-09-28 の記録からの訂正

| これまでの記述 | 実測で分かったこと |
|---|---|
| 「NoteTarget で 22/114 が紐付いている」 | **会社に紐付いているのは 0 件。** 24 件はすべて Person 向け。Person にも会社が無いので、会社へは到達できない |
| 「カスタムフィールドが 5 つ既存」 | **API では判別できない。** `isCustom` が応答に無い。「既存フィールドとして名前で確認できる」が正確 |
| 「Person に上下関係があるか未確認」 | **無い。** Person のリレーションは company / noteTargets / taskTargets など 9 個で、自己参照は無い |
| 「timelineActivities が読めるか未確認」 | **読める。** ただし内容はレコード CRUD のログで、活動フィードの代替にはならない |
| 「Task は運用実績なし」 | 変わらず 0 件。`taskTargets` も 0 件 |

> **実装の不具合を 1 件検出した。** `src/lib/twenty/adapters/note.ts` の `linkNote` は
> noteTarget の `companyId` / `company` を見ているが、Twenty の NoteTarget が返すのは
> **`targetCompanyId` / `targetCompany`**。relation 経路は**常に不成立**になる。
> 実データ側も `targetCompany` が 0 件なので結果は変わらないが、
> フィールド名は誤り。修正は§8 の「変更候補」に挙げる（**今回は直していない**）。

---

## 5. 実測値（2026-09-30 再確認。件数のみ）

| 対象 | 件数 |
|---|---|
| Company（PtAI フィルタ） | 126 |
| Company（フィルタ無し） | 5,134 |
| Opportunity | 49 |
| Person | **2,368** |
| Note | 114 |
| NoteTarget | 24（**うち会社向け 0**） |
| Task / TaskTarget | 0 / 0 |
| WorkspaceMember | 15 |
| TimelineActivity | **15,650** |
| Attachment | 0 |
| Webhook | 0 |
| API キー | 8 |
| Opportunity `stage` | NEW 13 / SCREENING 3 / MEETING 13 / PROPOSAL 20 / CUSTOMER 0（**5 段階**。UI は 8 段階） |

Company の充足率（126 件中）：`pgaStatus` 125、`pgaOwner` 125、`industryJp` 122、`tier` 121、
`mrr` 120、`customerSource` 100、`nextAction` 53、`companySizeLayer` 26、`icpJudgment` 11、
`issueAwareness` 10、`qiYueZhuangKuang` 8。

---

## 6. 機能ごとの短期保存先

判断原則：**Twenty のデータが十分なら Twenty を読み取り元にする。空・不完全・紐付かないなら
Pipeline の NocoDB を正本にする。推測で埋めない。照合は暫定策と明示する。二重書き込みはしない。
項目ごとに正本は 1 つ。**

| 機能・項目 | 短期の正本 | Twenty 利用可否 | 理由 | 将来の移行条件 |
|---|---|---|---|---|
| 企業一覧（社名・Tier・業種・規模・MRR・担当・ICP・契約状況） | **Twenty**（読み取り） | usable | 126 件中 120〜125 件が埋まっており、Twenty が実質の正本として機能している | — （すでに Twenty） |
| 商談（存在・名称） | **Pipeline NocoDB** | not_ready | Twenty の 49 件は会社にも担当にも紐付いておらず、金額も日付も空 | `company` リレーションが 8 割埋まる |
| 8 段階フェーズ | **Pipeline NocoDB** | not_ready | Twenty は 5 段階。対応表は未確定（Q6）。**変換しない** | Q6 が決まり、Twenty 側に 8 段階を保持する器ができる |
| 追加MRR（目標・実績） | **Pipeline NocoDB** | not_ready | `netMrr` / `amount` とも 0/49。目標（`aimMrr` 相当）は Twenty に項目が無い | 金額の運用ルールが決まり、実績が入り始める |
| 課金開始日 | **Pipeline NocoDB** | not_ready | Twenty に該当フィールドが無い | カスタムフィールドを追加できる |
| 到達予定（フェーズ別の予定日） | **Pipeline NocoDB** | not_ready | Twenty に項目が無く、8 段階が未確定なので項目名も決められない | Q6 の後 |
| 障壁 | **Pipeline NocoDB** | not_ready | Twenty に項目が無い | カスタムフィールドを追加できる |
| 次のアクション（商談 NA・期限） | **Pipeline NocoDB** | not_ready | Twenty Task が 0 件で運用実績ゼロ | Task 運用が始まる |
| 失注理由 | **Pipeline NocoDB** | not_ready | Twenty に項目が無い | カスタムフィールドを追加できる |
| 担当者（PtAI 担当） | **Twenty**（読み取り） | usable | `pgaOwner` が 125/126。未登録メンバーだけ Pipeline 側の呼称マップで補う | 全メンバーが WorkspaceMember に登録される |
| 担当3（主担当） | **Notion → Pipeline へ取り込み** | not_ready | Twenty に該当フィールドが無い。現在は取得スクリプトの固定マップ | 主担当を持つフィールドが決まる |
| 議事録 | **本文は Twenty、会社への割り当ては Pipeline 側の暫定照合** | usable_with_workaround | 本文 114 件は Twenty にある。会社紐付けは**API 上 0 件**なのでタイトル照合に頼る（暫定策） | NoteTarget が `targetCompany` を持つ |
| 組織図 | **Pipeline NocoDB** | not_ready | Person 2,368 件すべて会社未設定。上下関係のリレーションも無い | Person の会社紐付けと階層表現ができる |
| サクセスプラン | **Pipeline NocoDB** | not_ready | 器になるカスタムオブジェクトが存在しない | カスタムオブジェクトを作れる |
| AI 生成サマリー | **Pipeline NocoDB（キャッシュ扱い。正本ではない）** | not_needed | 再生成できる派生物。Twenty に置く必要が無い | — |
| 活動フィード | **Pipeline NocoDB** | not_ready | Twenty の Timeline はレコード CRUD ログで、「誰が画面で何を変えたか」は残らない | Pipeline が Twenty へ書き、その操作が Timeline に載る |
| チーム目標 | **Pipeline NocoDB（アプリ設定）** | not_needed | 顧客データではない。Twenty に持つ理由が無い | — |
| 承認状態（承認待ちフェーズ・承認日時） | **Pipeline NocoDB** | not_ready | Twenty に項目が無い。Workflow で作る案も未検証 | カスタムフィールドまたは Workflow を検証できる |

**まとめ：Twenty を読み取り元にできるのは「企業マスタ」「PtAI 担当」「議事録本文」の 3 つだけ。
商談以下の入力系はすべて短期は Pipeline の NocoDB が正本。**

---

## 7. 推奨する短期アーキテクチャ

### 7-1. 3 案の比較

| | 案1：NocoDB 中心 | 案2：項目別ハイブリッド | 案3：Twenty 中心 |
|---|---|---|---|
| 企業マスタ | NocoDB に複製して保持 | **Twenty から読む** | Twenty |
| 商談・入力系 | NocoDB | **NocoDB** | Twenty（要スキーマ拡張） |
| Twenty の位置づけ | 参照・比較のみ | **項目ごとに読み取り元** | 唯一の正本 |
| 企業マスタの鮮度 | 手動同期に依存（現在は 2026-09-28 で停止） | 常に最新 | 常に最新 |
| Twenty 障害時 | 影響なし | **キャッシュが無いと画面が空になる** | 全機能停止 |
| 二重正本 | 企業マスタが Twenty と NocoDB に二重化する | 項目ごとに 1 つに定まる | 起きない |
| 実現可能性 | 可能 | **可能** | **不可能。** Opportunity の会社・担当・金額・日付が全件空で、8 段階フェーズの器も無い |
| 現行実装からの距離 | 近い（今がこれ） | 近い（アダプターは実装済み） | 遠い |

### 7-2. 推奨：**案2（項目別ハイブリッド）**

```
Twenty（企業マスタ・PtAI 担当・議事録本文）
  ↓ GET のみ（src/lib/twenty/client.ts）
Pipeline Adapter（src/lib/twenty/adapters/）
  ↓                        ↘ 取得に失敗したら
Pipeline API               Twenty 読み取りキャッシュ（Pipeline 専用テーブル・**正本ではない**）
  ↓ ↑ 入力・未整備項目
Pipeline 専用 NocoDB（edits / aplans / orgs / feed / settings / newcos）
  ↓
Pipeline UI（board.js）
```

**なぜこの案か**

- Twenty が実際に使える範囲（§4 で `usable` と判定した Company・WorkspaceMember・Note 本文）だけを
  読み取り元にする。**使えない機能を無理に載せない**という新方針にそのまま合う。
- 現在すでにアダプターが実装済みで、**新規実装なしに到達できる**。
- 案1 に戻すと企業マスタが固定スナップショットのままになり、
  「2026-09-28 で止まっている」という現在の問題が残る。

**データ消失リスクと対策**

| リスク | 対策 |
|---|---|
| 同時編集で他人の入力が消える（現在の最大リスク） | 保存 API に `updated_at_s` の照合を入れ、食い違ったら 409 を返す。UI は再読込を促す |
| `settings` の全置換で他人の目標が消える | `doc_id` をメンバー単位に割る（§2-3） |
| `_raw` 入れ替え中の落下で消える | 入れ替えを「新しい世代を書いてから旧世代を消す」順序に変える |
| ローカル開発が実データを壊す | **環境ごとにテーブルを分ける。** ハードコード既定値を外し、未設定なら 503 で止める |
| Twenty 障害で画面が空になる | 直近の取得結果を Pipeline 専用テーブルにキャッシュし、失敗時はそれを返す（**正本ではない**ことをヘッダで明示） |

**運用負荷**

- Twenty 側の整備を待たずに Pipeline を使い続けられる。運用負荷は現状と同じ。
- 追加で必要なのは「Twenty のどの項目が使えるようになったか」の定期確認だけ（§9）。

**Twenty 整備後の移行容易性**

- 項目ごとに正本が 1 つに決まっているので、**項目単位で正本を移せる**。
  `sync-policy.ts` の 1 行を書き換えれば読み取り元が変わる構造にしておく。

**二重正本を避ける方法**

| ルール | 実装での担保 |
|---|---|
| 1 項目 1 正本 | `sync-policy.ts` の `sourceOfTruth` を項目ごとに必ず 1 つ持たせる |
| Twenty が正本の項目は Pipeline に保存しない | アダプターの出力を保存経路に渡さない（現状どおり） |
| Pipeline が正本の項目は Twenty へ書かない | `client.ts` に書き込み関数を置かない（現状どおり） |
| キャッシュは正本と呼ばない | キャッシュ由来の応答に `X-Ptai-Cache: hit` を付け、UI に鮮度を出す |

---

## 8. 現在の実装の分類

**今回は削除しない。分類のみ。**

| 対象 | 分類 | 理由 |
|---|---|---|
| `src/lib/twenty/client.ts` | **維持** | GET 専用で安全。案2 の読み取り経路の土台 |
| `src/lib/twenty/sync-policy.ts` | **変更** | 「Twenty 集約」前提の記述を「項目別の正本管理」へ。`sourceOfTruth` に Pipeline 側の正本を正しく反映する（現在は多くが `legacy_nocodb` = 移行元扱いになっている） |
| `src/lib/twenty/adapters/company.ts` | **維持** | Company は `usable`。そのまま使える |
| `src/lib/twenty/adapters/note.ts` | **変更**（不具合あり） | noteTarget のフィールド名が `companyId` になっている。正しくは `targetCompanyId`。§4-1 参照 |
| `src/lib/twenty/adapters/opportunity.ts` | **維持**（扱いは降格） | コードは正しいが、Opportunity は `not_ready`。出力は「補助表示」に格下げする |
| `src/lib/twenty/adapters/ptai-raw.ts` | **変更** | 商談・議事録の扱いを「補助」に変え、Pipeline 側の入力と混ぜない |
| `src/lib/twenty/data-source.ts` | **変更** | 「移行が終わったら消す一時フラグ」という説明を「項目別の読み取り元を切り替える設定」に改める。当面は残す |
| `/api/ops/twenty/health` | **維持** | 利用可否の定期確認（§9）にそのまま使える |
| `/api/ops/twenty/raw-diff` | **維持**（位置づけ変更） | 「移行確認用の一時ツール」から「Twenty と Pipeline の差分監視」へ。削除予定を取り下げる |
| `/ops/twenty` | **変更** | 文言を「Twenty 集約の疎通確認」から「Twenty 利用可否のモニタ」へ。§4 のマトリクスを表示するのが望ましい |
| `PTAI_DATA_SOURCE` | **維持** | 既定は `legacy_nocodb` のまま。3 環境とも未設定であることを確認済み |
| `/api/ptai/raw` の Twenty 経路 | **維持** | 案2 の企業マスタ読み取りに使う。ただしキャッシュとフォールバックの追加が要る |
| `src/lib/ptai/store.ts` | **変更** | ①ハードコード既定値を外す ②`collections.ts` / `repository.ts` へ分割 ③楽観ロックを入れる |
| `pga_docs` | **変更（改名候補）** | `ptai_pipeline_store` へ。**要承認** |
| `scripts/ptai-seed.mjs` / `ptai-seed-raw.mjs` | **維持** | 初期投入用。改名時にテーブル名の参照を変える |

---

## 9. Twenty の再評価条件

四半期に 1 回、または次のいずれかが起きたら再評価する。

| 対象 | 再評価のトリガー | 確認方法 |
|---|---|---|
| Opportunity | `company` リレーションの充足率 ≥ 80% | `/api/ops/twenty/health` の警告が消える |
| Person / 組織図 | `companyId` の充足率 ≥ 80% かつ階層を持つ手段ができる | metadata に自己参照リレーションが現れる |
| Note | `NoteTarget.targetCompany` が 1 件以上 | `raw-diff` の紐付け内訳 |
| Task | Task が 100 件以上 | `health` の件数 |
| カスタムフィールド | 追加権限の確認（Leevis） | 管理画面。API では判別できない |
| カスタムオブジェクト | 1 つ作れることの確認 | metadata に非標準オブジェクトが現れる |
| Webhook | 1 本登録して届くこと | 検証用エンドポイント |
| API キー | **確認済み＝Admin キー。** 次は読み取り専用キーへの差し替え完了 | Vercel の環境変数を差し替え、`health` が 200 のままであることを確認 |

---

## 10. 移行ロードマップ（改訂）

| 段階 | 内容 | 前提 | 今回 |
|---|---|---|---|
| **S0（次）** | Pipeline 専用テーブルの改名（`ptai_pipeline_store`）と環境変数の改名。環境ごとにテーブルを分ける。ハードコード既定値の撤去 | 承認 | **未実施** |
| **S1** | `src/lib/ptai/` の分割（collections / schema / store / repository）と楽観ロック。`settings` の doc 分割 | S0 | 未実施 |
| **S2** | 案2 の読み取り経路を有効化（企業マスタ・担当・議事録本文を Twenty から）。キャッシュとフォールバックを追加 | S1、Preview に `TWENTY_API_KEY` | 未実施 |
| **S3** | バックアップ手順の整備（エクスポート＋復旧の手順書） | S0 | 未実施 |
| **S4** | Twenty の再評価（§9）。usable になった項目だけ読み取り元を移す | 四半期ごと | — |
| **S5** | Twenty への書き込み。**前提：①読み取り専用キーへの差し替え完了 ②冪等性が無いので「作る前に検索」＋冪等キーを実装 ③Company の共有相手の合意**（技術的な可否は §4-2 で確認済み） | S0〜S3、Leevis の承認 | — |

---

## 11. 未解決事項

| # | 内容 | 影響 | 次のアクション |
|---|---|---|---|
| 1 | **Preview / Production / Development が同じ `pga_docs` を共有しているか** | ローカル開発が実データを壊す。**実測で Development は実データのテーブルを指していた** | Vercel の値を確認し、環境ごとにテーブルを分ける |
| 2 | NocoDB のバックアップ有無・保持期間・復旧手順 | 事故時に戻せない | インフラ担当に確認 |
| 3 | ~~**Q17** Twenty API キーが読み取り専用か~~ → **解決（悪い方に）。Production のキーは Admin キー。** 残る課題は「読み取り専用キーへの差し替え」 | **書き込み事故の余地が現実にある。** コード 1 行で本番 CRM を壊せる | 読み取り専用キーを発行し、Production / Preview に設定する |
| 4 | **Q6** stage 5 段階と 8 段階の対応 | フェーズを Twenty に持てない | 合意が要る |
| 5 | Q1 API キーを個人が発行できるか | 書き込み方式（S5） | Leevis に確認 |
| 6 | Q7 カスタムフィールドの追加 → **技術面は解決（API で追加・削除できた）。残るのは組織的な承認** | 入力項目を Twenty に持てるか | Leevis の承認。**API では標準／カスタムの判別ができない点は残る** |
| 7 | ~~カスタムオブジェクトを作れるか~~ → **解決。作れる（実測 §4-2）** | サクセスプランの器 | 器の設計と承認。技術的な障害は無い |
| 8 | Company の 114 フィールドを**他チームと共有している**可能性 | Pipeline が書くと他チームの運用に影響する | 書き込み前に所有者を確認 |
| 9 | ~~更新・削除・冪等性~~ → **解決（§4-2）。更新・削除はできる。冪等性は無い**。未検証で残るのは**一括書き込み（bulk POST）とレート制限下での挙動** | 冪等性が無いので、書き込み実装には「作る前に検索」＋自前の冪等キーが必須 | 一括書き込みだけ別途検証する |
| 10 | `plans` / `chatwork`（実データ 0）の廃止可否 | 機能削除の判断 | 利用者に確認 |
| 11 | 議事録がどちらの方法でも会社に付かない件数の扱い | 個社ページに議事録が出ない | 運用判断 |
| 12 | Preview に `TWENTY_API_KEY` が無い | Preview で Twenty 経路を検証できない | 読み取り専用キーの発行後に設定 |
