# 08. バッチとスケジュール

v2 の画面が速いのは、**重い計算を朝までに終わらせているから**。ここが止まると画面は「古い数字を出す」か「フォールバックして遅くなる」。

---

## 1. 実行経路は 2 つ

| 経路 | 認証 | 特徴 |
|---|---|---|
| **Vercel Cron**（`vercel.json`） | `CRON_SECRET`（Vercel が自動で `Authorization: Bearer` を付与） | 発火頻度がプランに依存。ループが書けない |
| **DolphinScheduler**（社内スケジューラ） | `SUPPORT_BATCH_SECRET` または `CRON_SECRET` | Shell タスクで「`remaining` が 0 になるまで繰り返す」が書ける |

認証は `checkCronOrBatchAuth()`（`src/lib/batch/auth.ts`）。
**両 secret が未設定だと認証をスキップして通す**（開発用）。本番で未設定のまま公開すると、誰でも 98 秒のバッチや LLM 課金を伴う処理を叩けるので必ず設定する。

`/api/**` は middleware を素通りするため、バッチの保護はハンドラ側の責務。

---

## 2. Vercel Cron（`vercel.json` に定義されている 6 本）

schedule は UTC。

| パス | cron (UTC) | JST | 役割 |
|---|---|---|---|
| `/api/batch/company-summary-staleness` | `0 2 * * *` | 毎日 11:00 | 企業サマリの陳腐化チェック（旧 UI） |
| `/api/batch/tier-sync` | `0 17 * * *` | 毎日 02:00 | Tier 同期（v2 の母集合に効く） |
| `/api/batch/paid-watched-sync` | `30 17 * * *` | 毎日 02:30 | 有料監視フラグ同期（Tier 3 画面に効く） |
| `/api/batch/company-snapshot-light` | `30 18 * * *` | 毎日 03:30 | Tier 3 + Light watch の日次スナップショット |
| `/api/batch/churn-analysis-weekly` | `0 19 * * 0` | 月曜 04:00 | 解約遡及分析（旧 UI） |
| `/api/batch/intercom-reconcile` | `0 21 * * *` | 毎日 06:00 | Intercom 同期の突合（Hobby プランは日次 cron のみのため日次化） |

---

## 3. DolphinScheduler 側（`docs-src/cxm_v2/18_DolphinScheduler_Batch.md` の運用）

### 3-1. `/api/batch/project-metrics` — 内部系（毎朝 1 回 / 05:30 JST）

- Metabase の CSV 4 本（signals 4MB / modules 590KB / campaigns 800KB / accounts）を読み、**有料 PJ のみ**の判定と生指標を `project_metrics` に upsert する。FREE 8,897 件は対象外。
- 実測: 1,295 件 / 98 秒（ローカル）。ただし Vercel 上では NocoDB への往復がリージョン差で遅く、300 秒上限に当たって `FUNCTION_INVOCATION_TIMEOUT` になった実績がある（2026-08-24）。→ **書き込みを並列化し、時間予算内で処理して `remaining` を返す**設計。
- 返り値: `{ ok, date, targets, created, updated, failed, errors, elapsedSec }`。
- **明細 CSV（13.8MB）はここでは触らない。**
- ホームの「利用データ（日次） 05:30」の表示はこのバッチを指す。

### 3-2. `/api/batch/industry-intel-weekly` — 外部系（土日月の朝、ループ）

- 1 社あたり **約 85 秒**（Web 検索 + LLM）。1 回の関数実行 300 秒では 2〜3 社しか処理できない。
- `?tiers=1,2,3&budgetSec=280&maxAgeDays=7` を **`remaining` が 0 になるまで繰り返す**。
- 10 分間隔で JST 06:00–12:00 に走らせると 1 朝あたり 36 回 × 約 2.8 社 ≒ 100 社。**3 朝で Tier1–3 を一巡**。
- 古い順に埋める。既に新しいものは飛ばす。
- ホームの「業界ニュース（週次） 日曜 06:00」はこれ。

### 3-3. `/api/batch/company-profile-weekly` — 顧客理解の週次事前生成

- 1 社 30 秒前後（実測: 本番 43 秒 / ローカル 127 秒）。見積もりは倍の 90 秒/社（`PER_COMPANY_SEC`）で、次の 1 社が予算内に収まらなければ止める。
- 古い順に埋め、`remaining` が 0 になるまで DolphinScheduler がループする。
- 生成物は `company_profile_cache`。個社ページの顧客情報タブは既定でこれを読む。

### 3-4. `/api/batch/campaign-org` — 施策 × 組織の日次事前計算

- 明細 CSV（13.8MB / 本番コールド 28.8 秒）を**この実行の中で 1 回だけ**落とし、全社分をまとめて作って `company_campaign_org` に保存する。
- 以降は会社ごとの索引と集計なので軽い。個社ページはボタンを押さずに保存済みを読む。

### 3-5. その他（v2 に間接的に効くもの）

`company-snapshot`（Tier 1/2 の Deep スナップショット、`overall_health` の AI 生成を含む）、`chronic-silent-sync`、`unified-log-signals`、`policy-alerts`、`company-summary*` は旧 UI 中心。
ただし **`company_daily_snapshot` と `project_user_snapshots` は v2 の実行体制推移・時系列チャート・更新時期の土台**なので、止まると v2 の `execution` が `null` になり準備度の重みが変わる。

> `vercel.json` に載っているのは light 版のみ。Deep（Tier 1/2）スナップショットは外部スケジューラまたは手動実行が前提。

---

## 4. 「時間予算内で処理して残りを返す」パターン

300 秒の関数上限を超える仕事は、すべてこの形に統一されている。

```
GET /api/batch/xxx?budgetSec=280&limit=N
  → { processed, staleTotal, remaining, elapsedSec, errors }
```

呼び出し側（DolphinScheduler の Shell タスク）が `remaining` を見てループする。無限ループ防止のため:

- `MAX_LOOP`（例 60）を必ず置く
- `remaining` が減らない回数（`stuck`）を数え、進まなければ中断する（同じ社で失敗し続ける状態の検知）

---

## 5. バッチが止まったときに何が起きるか

| 止まったもの | v2 への影響 | 画面での見え方 |
|---|---|---|
| `project-metrics` | `loadProjectFacts` のカバー率が 50% を切ると **CSV live にフォールバック**（正しいが遅い。ボードで 7 秒級） | ホームの「利用データ（日次）」チップが amber になり「今日の集計がまだ入っていません」 |
| `industry-intel-weekly` | ホームの業界ニュースが増えない / 古くなる | 「業界ニュース（週次）」チップが amber、`coverage.missing` を明示 |
| `company-profile-weekly` | 顧客情報タブで初回に 30〜120 秒待つ（その場生成） | 生成中スピナー。StatusStrip は先に出る |
| `campaign-org` | 個社の「施策から読む組織の動き」が空。`?refresh=1` で 28.8 秒かけて作れる | 「保存済みが無い」旨と再取得導線 |
| `company-snapshot(-light)` | 実行体制の推移が比較不能（`execution = null`）、時系列チャートが伸びない | 準備度の理由文に「30日前との比較データなし」 |
| `tier-sync` / `paid-watched-sync` | 対象企業の増減が反映されない | 母集合が古いまま |

**バッチが落ちた日に画面が黙って古い数字を出すのがいちばん危ない**という判断から、ホームは鮮度チップをヘッダー直下に置いている。
