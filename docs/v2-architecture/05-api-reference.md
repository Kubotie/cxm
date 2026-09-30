# 05. API リファレンス（v2 が使うもの）

## 認証の前提（2026-09-30 改訂）

`/api/**` は **middleware で署名済みセッション（`cxm_session`）を必須**にしている。
未認証は `{"error":"unauthenticated"}` の **JSON 401**（HTML リダイレクトは返さない）。

Cookie を要求しないのは次の 2 つだけで、どちらもハンドラ側に別の認証がある。

| プレフィックス | 代わりの認証 |
|---|---|
| `/api/auth/*` | ハンドラでメール＋パスワードを照合 |
| `/api/batch/*` | `Authorization: Bearer`（`CRON_SECRET` または `SUPPORT_BATCH_SECRET`） |

書き込み系と運用系は、middleware に加えて**ハンドラ側でも** `src/lib/auth/guard.ts` の
`requireUser()` / `requireOpsOrAdmin()` / `requireAdmin()` などで認可する（多層防御）。
**ロールは `staff_identify` から引く。Cookie には入れない。**
ルート単位の区分は [security-api-inventory.md](../security-api-inventory.md) が正本。

旧 `cxm_user_uid` / `cxm_user_role` Cookie は**廃止済み**。送っても未認証として扱う。

`maxDuration` 未記載は Next.js/Vercel の既定。

---

## 1. 認証・ユーザー

| メソッド・パス | 用途 | 備考 |
|---|---|---|
| `POST /api/auth/login` | ログイン | `{email, password}`。個別ハッシュ優先 → 無ければ共有パスワード（`APP_PASSWORD`。**未設定なら 503**）。成功で署名付き `cxm_session` Cookie をセットし、旧 Cookie を削除してプロファイルを返す |
| `POST /api/auth/logout` | ログアウト | `cxm_session` と旧 Cookie を削除 |
| `DELETE /api/user/session` | セッション削除 | ログアウトと同じ。**`POST` は廃止済み**（認証なしに任意ユーザーの Cookie を発行できたため） |
| `GET /api/user/profile` | 自分のプロファイル | 検証済みセッションから `name2` を解決。**HttpOnly Cookie を読めないクライアントはこれを 1 回引く** |
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

## 3.5. 解約レーダー（→ [11](11-churn-radar.md)）

| メソッド・パス | 用途 |
|---|---|
| `GET /api/radar/board` | スコープの全データ。**判定しない** — `churn_radar_state` を読んで整形するだけ |
| `GET /api/radar/company/[companyUid]` | 個社ドリル。立ったシグナルと根拠レコードへのリンク |
| `GET /api/radar/voices` | 言質のレビュー待ち一覧 |
| `PATCH /api/radar/voice/[voiceId]` | 言質の採否（承認するとスコアに入る） |
| `POST /api/radar/ack` | 対応状況の更新（`ack` / `working` / `watching` / `dismissed`） |
| `GET /api/radar/accuracy` | 精度パネル（検知リードタイム / 誤検知率）。`maxDuration = 300` |
| `POST /api/radar/churn-report` | 解約報告。確定した解約を危険圏から外す |
| `GET /api/ops/radar-backtest` | バックテスト（閾値調整用） |

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

すべて `Authorization: Bearer`（`CRON_SECRET` または `SUPPORT_BATCH_SECRET`）で認証する。GET/POST どちらでも起動する。
**production では secret が未設定だと 503 で拒否**する（旧実装は素通ししていた）。

ops 画面のボタンからも呼ぶもの（`/api/batch/company-summary`・`/api/batch/company-summary-review`）は
`requireBatchTokenOrOps()` を使い、**Bearer か admin/ops セッションのどちらか**を受け付ける。
ブラウザにはバッチシークレットを渡さない。

| パス | maxDuration | 生成物 |
|---|---|---|
| `/api/batch/project-metrics` | 300 | `project_metrics`（有料 PJ の日次事前計算） |
| `/api/batch/campaign-org` | 300 | `company_campaign_org`（施策 × 組織） |
| `/api/batch/industry-intel-weekly` | 300 | `industry_intel_cache`（業界ニュース） |
| `/api/batch/company-profile-weekly` | 300 | `company_profile_cache`（顧客理解） |
| `/api/batch/company-snapshot` / `company-snapshot-light` | 300 | `company_daily_snapshot` / `project_user_snapshots` |
| `/api/batch/churn-radar` | 300 | `churn_radar_state`（全社を再判定して上書き） |
| `/api/batch/churn-voice` | 300 | `churn_radar_voice`（言質抽出 / `dry_run`・`uid`・`window_days` で制御） |
| `/api/batch/tier-sync`, `paid-watched-sync`, `intercom-reconcile`, `chronic-silent-sync`, `churn-analysis-weekly`, `company-summary-*`, `policy-alerts`, `unified-log-signals` | 各種 | 主に旧 UI 用。v2 は Tier / 有料監視 / スナップショット / 休眠に間接的に依存 |

詳細は [08-batch-and-schedule.md](08-batch-and-schedule.md)。

> ⚠️ **これらのバッチは GET でも本体が走る。** 「GET だから安全」は成り立たないため、AI アシスタントのデータ源は allowlist 方式にしている（→ [09](09-ai-assistant.md)）。
