# 05. API リファレンス（v2 が使うもの）

`/api/**` は middleware を素通りし、各ハンドラが認証・エラーを返す。
`maxDuration` 未記載は Next.js/Vercel の既定。

---

## 1. 認証・ユーザー

| メソッド・パス | 用途 | 備考 |
|---|---|---|
| `POST /api/auth/login` | ログイン | `{email, password}`。個別ハッシュ優先 → 無ければ共有パスワード。成功で `cxm_user_uid` / `cxm_user_role` Cookie をセットしプロファイルを返す |
| `POST /api/auth/logout` | ログアウト | Cookie 破棄 |
| `GET /api/user/profile` | 自分のプロファイル | Cookie から `name2` を解決。**HttpOnly Cookie を読めないクライアントはこれを 1 回引く** |
| `PATCH /api/user/profile` | 表示スコープ・重点領域の保存 | `staff_identify` を PATCH |
| `GET /api/user/password` | 個別パスワードを設定済みか | `{hasPassword: boolean}` |
| `PUT /api/user/password` | パスワード変更 | scrypt でハッシュ化して保存 |

---

## 2. 横断一覧

### `GET /api/companies/proposal-board` （`maxDuration = 60`）

提案準備ボードとホームの共通データ源。

| クエリ | 意味 |
|---|---|
| `owner` | 担当者（`name2`）で絞る |
| `opportunity=true` | 全社一括で「外部機会あり」に倒す（既定は企業ごとの自動判定） |

返り値: `updatedAt` / `snapshotDate` / `trendFromDate` / `counts`（レーン別） / `owners` / `items[]`（`BoardItem`） / `notEvaluated[]`。
`BoardItem` は 企業属性・`lane`・`readiness`（4 要素 + caps + missing）・`play` / `playIfOpportunity`・外部機会・`usage`（施策 / 分析PV / PV率 / 運用人数 / モジュール判定 / 未使用製品 / 習慣化）・`paidProjectCount`・`blockers[]`。

### `GET /api/companies/tier3-dashboard` （`maxDuration = 60`）

`?limit`（既定 2000）。Tier 3 のみ。アラーム・重大度・優先度スコア付きの `items[]` と `summary` / `counts`。

### `GET /api/home/digest` （`revalidate = 300`）

保存済みの業界ニュース（`industry_intel_cache`）と日次バッチ状況（`project_metrics`）のみを読む。**Web 検索へフォールバックしない。**
返り値: `news[]`（企業ラウンドロビン済み・最大 120 件）/ `industries[]` / `owners[]` / `coverage` / `batch.daily` / `generatedAt`。

### `GET /api/actions?include_done=1`

Tier 3 画面の「本日の対応済み」用。アクション一覧（旧 UI と共用）。

---

## 3. 個社（`/api/company/[companyUid]/...`）

| メソッド・パス | maxDuration | 用途 |
|---|---|---|
| `GET .../usage` | 60 | 現在の利用状況。実体は `lib/company/company-usage.ts`（Server Component と共用） |
| `GET .../timeseries?days=90` | 60 | 日次スナップショット履歴（7〜365 に丸め） |
| `GET .../readiness?opportunity=true\|false` | — | 提案準備度（会社 + **プロジェクト別**）。実体は `lib/company/readiness-facts.ts` |
| `GET .../profile?refresh=1&industry=refresh` | 300 | 顧客理解プロファイル（LLM）。既定は `company_profile_cache` を読む |
| `GET .../communications` | 60 | 6 チャネルの統一ログ |
| `GET .../campaigns?refresh=1` | 120 | 施策から読む組織の動き。既定は日次バッチの保存済み |
| `GET .../proposal-intents` | 60 | 提案の狙いカード（決定的な順序）＋ 材料グループ ＋ activeSignals ＋ カタログ状態 |
| `POST .../proposal-outline` | 180 | 提案骨子の生成（9 章、出力上限 12,000 トークン） |
| `GET .../proposal-records`, `GET ?id=`, `POST`, `DELETE ?id=` | — | 骨子の記録（保存 / 復元 / 削除）。テーブル未設定でも 200 で空を返す |
| `GET .../situations`, `POST .../situations` | 120 | 議事録からの状況候補抽出（保存しない）と、担当者確認後の登録 |
| `GET .../external-intel`, `POST .../external-intel` | — | 外部シグナルの取得（保存済み + 議事録抽出）と保存（`items` = 承認済み候補、または貼り付けテキストの構造化。`dryRun` 可） |
| `POST .../external-intel/research` | — | 自然言語指示で Web 検索 → 候補を返す（**保存しない**）。段階 1 検索 / 段階 2 構造化の 2 段 |
| `POST .../external-intel/ingest` | — | URL / PDF・HTML・テキストファイルを取り込んで候補を返す（**保存しない**） |

v2 画面からは直接呼ばないが、AI アシスタントが深掘り先として使うもの: `.../people`, `.../actions`, `.../summary`, `/api/nocodb/companies?uid=`。

---

## 4. プロジェクト

| メソッド・パス | maxDuration | 用途 |
|---|---|---|
| `GET /api/projects/module-usage?includeFree=1` | 60 | プロジェクト分析ダッシュボード |
| `GET /api/projects/[projectId]` | 60 | プロジェクト詳細（headline / actions / モジュール内訳 / 種別構成 / 施策の動き） |

---

## 5. AI アシスタント

| メソッド・パス | maxDuration | 用途 |
|---|---|---|
| `POST /api/ai/chat` | 300 | SSE ストリーム。イベント: `thread` / `thinking` / `text` / `tool` / `done` / `error`。未ログインは 401 |
| `GET /api/ai/chat/threads` | — | スレッド一覧（Blob の pathname から復元。本文は読まない） |
| `DELETE /api/ai/chat/threads` | — | 自分の履歴を全削除 |
| `GET /api/ai/chat/threads/[threadId]` | — | スレッド 1 件（全メッセージ） |
| `PATCH /api/ai/chat/threads/[threadId]` | — | 改名 |
| `DELETE /api/ai/chat/threads/[threadId]` | — | 削除 |
| `GET /api/ai/prefs` | — | 回答スタイル / 保持期間 / モデル ＋ 選択可能モデル一覧 |
| `PUT /api/ai/prefs` | — | 上記の保存（Vercel Blob） |

---

## 6. バッチ（v2 のデータを作るもの）

すべて `checkCronOrBatchAuth`（`CRON_SECRET` または `SUPPORT_BATCH_SECRET` の Bearer）。GET/POST どちらでも起動する。

| パス | maxDuration | 生成物 |
|---|---|---|
| `/api/batch/project-metrics` | 300 | `project_metrics`（有料 PJ の日次事前計算） |
| `/api/batch/campaign-org` | 300 | `company_campaign_org`（施策 × 組織） |
| `/api/batch/industry-intel-weekly` | 300 | `industry_intel_cache`（業界ニュース） |
| `/api/batch/company-profile-weekly` | 300 | `company_profile_cache`（顧客理解） |
| `/api/batch/company-snapshot` / `company-snapshot-light` | 300 | `company_daily_snapshot` / `project_user_snapshots` |
| `/api/batch/tier-sync`, `paid-watched-sync`, `intercom-reconcile`, `chronic-silent-sync`, `churn-analysis-weekly`, `company-summary-*`, `policy-alerts`, `unified-log-signals` | 各種 | 主に旧 UI 用。v2 は Tier / 有料監視 / スナップショット / 休眠に間接的に依存 |

詳細は [08-batch-and-schedule.md](08-batch-and-schedule.md)。

> ⚠️ **これらのバッチは GET でも本体が走る。** 「GET だから安全」は成り立たないため、AI アシスタントのデータ源は allowlist 方式にしている（→ [09](09-ai-assistant.md)）。
