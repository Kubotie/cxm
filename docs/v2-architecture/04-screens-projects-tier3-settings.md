# 04. プロジェクト分析 / PJ 詳細 / Tier 3 管理 / 設定

---

## A. プロジェクト分析 `/v2/projects`

実装: `projects/page.tsx` → `dashboard-view.tsx`（Client, 393 行）
データ: `GET /api/projects/module-usage`（`maxDuration = 60`）

### A-1. この画面が答える問い

1. 契約しているのに使われていないプロジェクトはどれか（＝提案の入口）
2. 管理画面に来ていないプロジェクトはどれか（＝提案より前に手当てが要る）
3. どの機能が実際に使われているか（＝機能の採用状況）

**回遊（着地画面）を利用として数えない。** 数えると全員が使っている扱いになる。この前提を画面にも明記している。

### A-2. データの組み立て

- `project-signals`（CSV）× `project-modules`（CSV / 直近 30 日の URL モジュール別 PV）× `companies`（Tier 1,2,3,5）を突き合わせる。
- 対象は既定で有料プラン（`PTI` / `PTX` / `BUNDLE`）のみ。FREE は 8,897 件あり判断対象ではないため `?includeFree=1` のときだけ含める。
- **ID 形式の差に注意**: NocoDB の `company.id` は `sf_0017F...`、Metabase CSV は `0017F...`（接頭辞なし）。両形式でマップを引く（実測でこの差により担当者・Tier が 1 件も紐付いていなかった）。
- 並び順は危険なものが上: `dormant → unused → partial → shallow → unevaluated → healthy`、同判定内は実利用 PV 降順。
- 返すもの: 判定別件数 `counts`、プラン別 × 判定別 `byPlan`、モジュール採用状況 `adoption`（辞書 `MODULE_DICTIONARY` の `includeInApp` のみ）、明細 `rows`、**辞書に無く捨てた PV `droppedPv`**（集計から落としたものを黙って消すと PV の総和が合わず不審になるため出す）、CSV キャッシュ経過秒。

### A-3. 30 日の利用判定（6 値）

| 判定 | 表示 | 条件 | 色 |
|---|---|---|---|
| `dormant` | 休眠 | モジュールデータの行が無く、かつ L30 Active = 0 | 赤 |
| `unused` | 未使用 | 着地画面（回遊）のみ / 実利用 PV = 0 | 赤 |
| `partial` | 一部未使用 | 契約製品の一部が 30 日未使用 | amber |
| `shallow` | 浅い利用 | 触っているが分析・検証 PV が 5 未満 | amber |
| `healthy` | 活用中 | 契約製品を使い、分析・検証まで到達 | 緑 |
| `unevaluated` | 未評価 | モジュールデータが無いが計測は動いている（＝断定できない） | 灰 |

**`dormant` と `unevaluated` の切り分けが最重要。** モジュール CSV は PV>0 の行しか持たないため「行が無い」＝管理画面に来ていない。L30 Active も 0 なら休眠、L30 が動いていれば未評価に分ける。これを一緒くたに「未評価」で流すと有料 PJ の 53% を見逃す（実測）。

### A-4. UI

- フィルタ: 判定 / プラン / 担当 / フリーワード / 「担当企業のみ」トグル。
- 判定別のサマリータイル、プラン別の内訳バー、モジュール採用状況（折りたたみ）。
- 行から `/v2/projects/[projectId]` へ。

---

## B. プロジェクト詳細 `/v2/projects/[projectId]`

実装: `page.tsx`（Server, params だけ解決）→ `detail-view.tsx`（Client, 589 行）
データ: `GET /api/projects/[projectId]`（`maxDuration = 60`）

- **`headline`（1 段落の状態説明）と `actions`（手を入れられる点）を API 側が返す。** 数値タイルを並べただけでは読み解けないため、「何が言えるか」を先に置く。
- 機能ごとの内訳（PV 降順・総 PV に占める割合・確信度・注意書き・説明）、種別ごとの構成（分析利用 / 施策構築 / 施策検証 / 初期設定 / 転換シグナル / 購買シグナル / **回遊** / 未分類）、契約との差分、施策の直近の動き（`CampaignSignalVM`）、実測メトリクス（L30 / L7 / 最終活動 / ヒートマップ / Campaign / PV 上限・消化率 / 習慣化）。
- 回遊は「使っていない側」なので灰色に寄せる配色。
- **辞書に無いモジュールも「除外した」ことが分かる形で返す。**
- 戻り先は `?from=` で制御（`company:<uid>` → その会社の詳細ページ、`list`（既定）→ プロジェクト分析一覧）。

---

## C. Tier 3 管理 `/v2/tier3`

実装: `tier3/page.tsx` → `dashboard-view.tsx`（Client, 566 行）
データ: `GET /api/companies/tier3-dashboard?limit=2000`（`maxDuration = 60`）＋ `GET /api/actions?include_done=1`

### C-1. 対象

`fetchLightWatchCompanies(limit)` の結果から **`tier === 3` のみ**（tier 未設定の Light watch 企業は除外）。

### C-2. その場で計算しているもの

スナップショット（`company_daily_snapshot`）から流用: MRR / 更新バケット・更新日 / オープンサポート件数 / chronic silent。
API 層で計算:

- 契約プラン: `project_info.paidType` の集合から導出（`PTI-PAID` と `PTX-PAID` 両方 → `bundle`）
- PV 消費率: 企業内プロジェクトの**最大値**（`monthPvCount / pvCeiling`）
- 今週操作数 = `l7ActiveUsers` 合計（無ければ `l7EventCount`）、前週は 7 日前の `project_user_snapshots` から。前週比 `wowPct`
- 最終活動日 / 無活動日数

### C-3. アラーム・重大度・優先度

| アラーム | 条件 |
|---|---|
| `pv_over` | PV 消費率 ≥ 90% |
| `renewal_soon` | 更新まで 60 日以内 |
| `ops_drop` | 前週比 ≤ −50% |
| `inactive_30` | 最終活動 30 日以上前、または chronic silent |
| `upsell` | Bundle 未満の単一プラン契約で、ある程度稼働している |

重大度: `pv_over` → **red（緊急）** / `renewal_soon`・`ops_drop`・`inactive_30` → **amber（要対応）** / `upsell` → **blue（提案）** / それ以外 **green**。
契約更新（`0-30` / `expired`）は解約不可期間または更新交渉フェーズなので緊急扱いにしない（amber）。

優先度スコア = `重大度ランク × 1,000,000 + アラーム数 × 100,000 + MRR 等`。この降順で並べる。

### C-4. 「本日の対応済み」

`/api/actions?include_done=1` の `done` を「本日完了 ∧ Tier 3 企業」で絞って表示。
SF 行動を完了登録すると `title` が「（SF行動）」固定になり中身が分からないため、その場合は SF Event の属性（形式 / 活動形式 / 目的 / 結果）からラベルを組み立てる。Event Type は日本語化（Call → 電話 など）。

---

## D. 設定 `/v2/settings`

実装: `settings/page.tsx` → `settings-view.tsx`（Client, 715 行）

旧 UI（`/settings`）は独自のサイドバー＋ヘッダーを描くため v2 レイアウト内では二重になる。ここでは v2 の他画面と同じ「トップバー + コンテンツ」形で最小限だけ移植している。

| セクション | 保存先 | 備考 |
|---|---|---|
| アカウント（表示名 / メール / ロール）・ログアウト | 表示のみ / `POST /api/auth/logout` | |
| 表示スコープ `default_home_scope`（自分担当のみ / チーム / 全社） | localStorage ＋ `PATCH /api/user/profile`（`staff_identify`） | **旧 UI の一覧にしか効かない**（v2 画面は独自の担当フィルタを持つ） |
| 重点領域 `focus_areas` | 同上 | **保存されるだけで読み手がいない**（grep 済み） |
| パスワード変更 | `PUT /api/user/password` → `staff_identify.password_hash`（scrypt） | 最低 10 文字。サーバー側 `MIN_PASSWORD_LENGTH` と一致 |
| AI パネルの既定挙動（起動時に開く 等） | localStorage（`src/lib/prefs/ai-panel.ts`） | ブラウザ側で完結 |
| 回答スタイル（最大 600 字）/ 履歴の保持期間（0=無期限, 30, 90, 180, 365 日）/ 使用モデル | `GET|PUT /api/ai/prefs` → **Vercel Blob** | サーバーが読む必要があるため localStorage 不可。`staff_identify` に列を増やすと 422 で落ちるので Blob に置く |
| チャット履歴の件数表示・全削除 | `GET|DELETE /api/ai/chat/threads` | 実体は Blob 上のユーザー単位ディレクトリ |

保存は **localStorage（即時・確実）＋ NocoDB PATCH の二重書き**。旧 UI と同じキーを使うので設定は相互に引き継がれる。
モデル候補は OpenRouter `/models` から「`anthropic/` かつ tools 対応かつ variant 無し」を抽出（カタログが取れなければ既定モデル 1 件のみ）。

---

## E. ComingSoon（サイドバー非掲載）

`/v2/actions` `/v2/support` `/v2/ai` `/v2/assets` `/v2/churn` `/v2/documents` `/v2/outbound` は `ComingSoon` プレースホルダのみ。
これらの機能自体は旧 UI（`/actions`, `/support`, `/ops/ai`, `/assets`, `/console/churn-analysis`, `/documents`, `/outbound`）に存在し、v2 レイアウトのアーカイブメニューから開ける。
