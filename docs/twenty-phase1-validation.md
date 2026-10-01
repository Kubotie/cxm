# Twenty 連携 Phase 1 — 読み取り専用接続の検証記録

- 実施日：2026-09-30
- 対象：**PtAI Pipeline のみ。** CXM のデータ基盤（NocoDB）は対象外で、変更もしていない
- 範囲：**読み取りのみ。** Twenty への POST / PATCH / DELETE、Phase 2 の初回インポート、
  `pga_docs` への保存はいずれも行っていない
- 関連：[current-state-audit.md](./current-state-audit.md)、`src/lib/twenty/sync-policy.ts`

> **このファイルには件数だけを記載する。** 顧客名・UUID・商談名・Note 本文は書かない。
> 差分の明細もファイルに出力していない。

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


> **方針（2026-09-30 確定）— 適用範囲は PtAI Pipeline のみ**
> **PtAI Pipeline の業務データは Twenty を唯一の正本とし、ダッシュボードは Twenty を操作する UI である。**
> **CXM は引き続き NocoDB を主要データストアとして利用する（対象外）。**
> 廃止するのは Pipeline の `pga_docs` および `NOCODB_PGA_DOCS_TABLE_ID` への依存だけで、
> 共通認証の `staff_identify` と CXM の NocoDB テーブルは対象外。
> 移行計画は [twenty-migration-plan.md](./twenty-migration-plan.md)。

## 1. 接続

| 項目 | 値 |
|---|---|
| API base（実測で確定） | `https://crm.ptengine.com` |
| 引き継ぎ資料の値 | `https://crm.ptengine.com/api` → **SPA の HTML が返る。API ではない** |
| フロントエンド | `crm.ptmind.com`（API パスを叩いてもアプリの HTML） |
| 認証 | `Authorization: Bearer <API key>`（OAuth ではない） |
| 環境変数 | `TWENTY_API_URL`（省略可）/ `TWENTY_API_KEY` |
| appVersion | 0.2.1 |

クライアントは候補を順に叩いて base を実測で決める（`resolveBaseUrl`）。
候補ごとに `ok` / `auth_failed` / `not_api` / `unreachable` を判別するので、
「URL が違う」のか「キーが違う」のかを切り分けられる。

> 🚨 **【2026-09-30 追記】このキーは Admin キーだった（書き込み可能）。**
> 当初「権限は未確認（監査 Q17）」としていたが、利用者への確認で確定した。
> アプリは GET しか発行しないため現時点で事故は起きていないが、
> **読み取り専用キーを発行して差し替えるまで、書き込みを伴う実装に着手しないこと。**

---

## 2. 件数（2026-09-30 実測）

| Object | 件数 | 備考 |
|---|---:|---|
| companies（**PtAI フィルタ適用**） | **126** | `or(pgaStatus[is]:NOT_NULL,customerSource[in]:[PGA_TARGET,BOTH])` |
| companies（フィルタ無し） | **5,134** | **混同しないこと。** 実装で一度フィルタが落ちてこの値になった |
| opportunities | 49 | |
| notes | 114 | |
| workspaceMembers | 15 | |
| tasks | **0** | 運用実績なし |
| noteTargets | 24 | Note との紐付け。カバー率が低い |

---

## 3. スキーマ検証

### Company — 17 項目すべて実在

`id` `name` `tier` `pgaStatus` `mrr` `industryJp` `industrySlug` `companySizeLayer`
`pgaOwner` `icpJudgment` `issueAwareness` `customerSource` `nextAction` `updatedAt`
`notionLinks` `domainName` `qiYueZhuangKuang`

監査で「要確認」だった 2 つが確定した。

| 項目 | 結果 |
|---|---|
| 契約状況の列名 | **`qiYueZhuangKuang`**（SELECT） |
| 金額の型 | `mrr` は CURRENCY（`amountMicros` ÷ 1e6） |

### Opportunity — 訂正が 3 件

| 誤っていた記述 | 実際 |
|---|---|
| `companyId` というフィールドがある | **存在しない。** 正しくは `company`（RELATION） |
| `ownerId` というフィールドがある | **存在しない。** 正しくは `owner`（RELATION） |
| stage は 4 段階 | **5 段階**（`CUSTOMER` を含む） |

取得スクリプトが `companyId` / `ownerId` を読んでいたため「全件 null」に見えていたが、
正しいフィールド名で読んでも**実測で全件空**だった。結論（社名照合が必要）は変わらない。

### Opportunity 49 件の充足率

| フィールド | 埋まっている件数 |
|---|---:|
| `needsSummary` | 48 / 49 |
| `pointOfContact` | 46 / 49 |
| `company` | **0 / 49** |
| `owner` | **0 / 49** |
| `closeDate` | **0 / 49** |
| `netMrr` | **0 / 49** |
| `amount` | **0 / 49** |
| `opportunityType` | 0 / 49 |
| `salesChannel` | 0 / 49 |

`netMrr` と `amount` は**どちらも存在し、どちらも空**。
「`amount` は無い」ではなく「両方あって両方未使用」が正確。

### stage の分布

| stage | 件数 |
|---|---:|
| PROPOSAL | 20 |
| NEW | 13 |
| MEETING | 13 |
| SCREENING | 3 |
| CUSTOMER | 0 |

ダッシュボードは 8 段階。**対応は未確定（監査 Q6）。決めるまで同期しない。**

### 未使用だが存在するフィールド

| フィールド | 選択肢 | 扱い |
|---|---|---|
| `opportunityType` | NEW_ACQUISITION / PRICING_MIGRATION / EXPANSION / RENEWAL | PtAI は全件アップセルなので `EXPANSION` が Phase 3 の候補。**今回は書き込まない** |
| `salesChannel` | DIRECT / INBOUND / REFERRAL / PARTNER_HAKUHODO / PARTNER_OTHER | 運用ルール未確定 |

---

## 4. 移行元スナップショットとの差分（件数のみ）

`GET /api/ops/twenty/raw-diff`（admin / ops 限定）の結果。**取り込みは行っていない。**

### 企業

| 項目 | 件数 |
|---|---:|
| Twenty（PtAI 対象） | 126 |
| 移行元スナップショット | 125 |
| ID で一致 | 125 |
| Twenty にのみ存在 | **1** |
| RAW にのみ存在 | 0 |
| 社名フォールバックで一致 | 0 |
| どちらでも一致しない | 0 |

RAW（2026-09-28）以降に 1 社増えている。**ID の振り直しや欠落は無い**ので、
Phase 2 の初回インポートは ID で素直に突き合わせられる。

### Opportunity の紐付け方法

| 方法 | 件数 |
|---|---:|
| 合計 | 49 |
| `company` リレーション | **0** |
| 社名の完全一致 | 48 |
| 社名の部分一致 | 0 |
| 紐付かない | 1 |

**リレーションは使えない。** 社名の完全一致で 48/49 が解決し、残り 1 件は手当てが要る。
監査 R-6（名前照合が壊れると商談が会社に付かない）は引き続き有効。

### Note の紐付け方法

| 方法 | 件数 |
|---|---:|
| 合計 | 114 |
| `noteTargets` | 22（19%） |
| タイトル照合 | 68 |
| 紐付かない | 24 |

`noteTargets` だけでは 8 割が紐付かない。タイトル照合が暫定的に必要。
両方を使っても 24 件（21%）は会社に付かない。

---

## 5. 実施したテスト

### 単体（`node --experimental-strip-types --test scripts/twenty-client.test.mts`）

依存を増やさず Node 標準の `node:test` を使い、`fetch` をスタブして**実 API には接続しない**。

| 観点 | 結果 |
|---|---|
| URL 正規化（末尾スラッシュ / 誤った `/api` `/rest` `/metadata` / 空） | ✅ |
| API キー未設定 | ✅ `config` エラー。設定状態にキーが含まれない |
| 401 / 403 | ✅ 再試行せず `auth`。プローブ結果にキーが漏れない |
| 429 リトライ | ✅ 1 回再試行して成功 |
| 5xx リトライ | ✅ 2 回再試行して成功 |
| その他 4xx | ✅ 再試行しない |
| タイムアウト（AbortError） | ✅ `network` に分類。4 回で断念。例外にキーが漏れない |
| 応答不正（HTML） | ✅ `not_api` |
| 封筒 new / legacy | ✅ どちらも配列を取り出せる |
| pagination | ✅ カーソルを辿って全件。`pageSize` は 200 に丸める |
| **`countRecords` のフィルタ引き渡し** | ✅ **回帰テストあり。** filter が URL に載る／`null` なら載らない |
| 読み取り専用 | ✅ 汎用 `request` も書き込み関数も export していない。発行メソッドは GET のみ |

**21 件成功 / 0 件失敗**

### API（`node scripts/twenty-health.test.mjs`）

ローカル dev サーバーに **GET のみ**。

| 観点 | 結果 |
|---|---|
| 未認証 | ✅ 401 |
| csm ロール（health / raw-diff） | ✅ どちらも 403。本文も漏れない |
| admin 正常系 | ✅ 200・`status=ok`・base は `https://crm.ptengine.com` |
| キャッシュ | ✅ `Cache-Control: no-store, max-age=0` |
| PtAI フィルタ | ✅ 126 件（全社 5,134 と混同していない） |
| スキーマ検証 | ✅ Company / Opportunity ともに一致 |
| 応答に API キー・Authorization | ✅ 含まれない |
| 応答に UUID・社名 | ✅ 含まれない |
| warnings の内容 | ✅ 集計情報のみ |
| raw-diff | ✅ 200。件数のみで顧客データを含まない |
| health / client / adapters の依存 | ✅ `lib/nocodb/` も `lib/ptai/store` も import していない |
| Twenty 経路の書き込み | ✅ `pga_docs` への保存呼び出しが無い |
| **CXM 保護**：`src/lib/nocodb/**` | ✅ 差分なし |
| **CXM 保護**：CXM の画面・API・バッチ・Salesforce / Notion | ✅ 差分なし |
| **CXM 保護**：共通認証（`staff_identify` / セッション） | ✅ 差分なし。従来どおり動作 |
| **CXM 保護**：NocoDB 環境変数 | ✅ 40 件すべて維持（`NOCODB_PGA_DOCS_TABLE_ID` も削除していない） |

**24 件成功 / 0 件失敗**

### その他

| コマンド | 結果 |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | エラー 0 |
| `npm run build` | 成功 |
| `git diff --check` | 問題なし |

---

## 6. 未解決事項

| # | 内容 | 影響 |
|---|---|---|
| **Q1** | API キーを個人が発行できるか、管理者のみか | Phase 3 の書き込みを「個人キー」でやるか「共有キー＋アプリ側の監査ログ」でやるかが決まらない |
| **Q6** | Twenty の stage（5 段階）とダッシュボードの 8 段階の対応 | **フェーズを同期できない。** Phase 3 の中心 |
| ~~**Q17**~~ | このキーが読み取り専用か → **解決。Admin キー（書き込み可能）だった** | **読み取り専用キーへの差し替えが必要。** それまで書き込み実装に着手しない |
| Q7 | カスタム項目の追加承認（`aimMrr` / 障壁 / 課金開始日 / 到達予定 / 失注理由） | ダッシュボードにしかない項目を書き戻せない |
| — | `netMrr` と `amount` の使い分け | どちらも空。Twenty 側の運用ルールが要る |
| — | `opportunityType` に `EXPANSION` を入れるか | Phase 3 の候補。運用の合意が要る |
| — | `salesChannel` の運用ルール | 未確定 |
| — | Notion 顧客DB「担当3」の取得方法 | Twenty に該当項目が無い。取得スクリプトは 2026-09-28 の固定マップを内蔵 |
| — | Opportunity 1 件が社名で紐付かない | Phase 2 で個別に手当てが要る |
| — | Note 24 件（21%）がどちらの方法でも紐付かない | 議事録が個社ページに出ない |

---

## 7. Phase 2 に進むために必要な判断

1. **Q6（stage の対応）** — これが決まらないとフェーズを同期できない。
   Twenty の stage を 8 段階に増やすか、Company 側のカスタム項目で持つか。
2. ~~**Q17（キーの権限）**~~ → **Admin キーと判明。** 読み取り専用キーへ差し替えるまで、事故の余地が残り続ける。
3. **担当3 の扱い** — Notion から実行時に引くか、固定マップを外部ファイルにするか。
4. **紐付かない Opportunity 1 件と Note 24 件** — 放置するか、Twenty 側を直すか。

> **【2026-09-30 追記・撤回】** 当初ここには「RAW 互換の JSON を組み立てて `pga_docs/_raw` を
> 置き換える」と書いていたが、**この設計は撤回した。** Pipeline は Twenty から取得した内容を
> その場で RAW 互換へ変換して返し、`pga_docs` へは保存しない。

Phase 2（読み取り切り替え）自体は、上記が未決でも
「Twenty から取得して RAW 互換 ViewModel をその場で組み立てる」ところまでは着手できる。
フェーズだけ同期対象から外せばよい。

---

## 8. 既存の Python 取得スクリプトの扱い

`pga_dashboard_fetch.py`（Utty のローカルにある RAW 再構築スクリプト）は
**リポジトリに追加していない。** 理由:

1. **マッピングが二重管理になる。** 同じ対応表を `sync-policy.ts` と Python の両方に
   持つと、片方だけ直したときに静かにずれる。TypeScript 側が正本。
2. **データ本体を含んでいる。** `ASSIGN3_BUILTIN` に Twenty の企業 UUID が 100 件超
   直書きされている。公開リポジトリに入れられない（`scripts/.bulk-targets.json` と同じ問題）。
3. **書き込み能力を持っている。** `create_records_batch` / `update_record` /
   `delete_record` を備えており、Phase 1 の「読み取り専用」という制約と合わない。
4. **同じ処理を TypeScript 側で再利用できる。** Phase 2 の初回インポートは
   `src/lib/twenty/client.ts`＋`sync-policy.ts` で組めるので、Python を残す必要がない。

**スクリプトから得た知見はすべてコードとこの記録に取り込んである**（REST の制約、
フィールド対応、紐付け規則、担当3 の扱い）。原本は Utty のローカルに保管し、
Phase 2 の実装時に参照するだけにする。

Phase 2 で RAW を組み立てるときは、`ASSIGN3_BUILTIN` 相当の「担当3」マップを
どう供給するかを決める必要がある（Notion から実行時に引く／gitignore 済みファイルに置く）。
