# バッチを DolphinScheduler から動かす

作成: 2026-08-22

## なぜ DolphinScheduler に寄せるか

外部情報（市場・業界）の取得は **1社あたり約85秒**かかる。
Vercel の関数は **1回の実行が最大300秒**なので、1回で2〜3社しか処理できない。

Vercel Cron で10分間隔×36回といった多重発火もできるが、
発火頻度がプランに依存する。**DolphinScheduler なら
「remaining が 0 になるまで繰り返す」を1つのワークフローで書ける。**

内部系（`project-metrics`）は1回98秒で収まるので、Vercel Cron のままでも動く。
両方を DolphinScheduler に寄せてもよい。

---

## 前提: 認証

**`/api/*` は middleware を素通りする。** バッチは各ハンドラで認証している。

`checkCronOrBatchAuth()` が `CRON_SECRET` または `SUPPORT_BATCH_SECRET` を
`Authorization: Bearer <token>` で要求する。

> ⚠️ 両方とも未設定だと**認証をスキップして通す**（開発用）。
> 本番では必ずどちらかを設定すること。未設定のまま公開すると、
> 誰でも98秒のバッチや LLM 課金を伴う処理を叩ける。

動作確認:

```bash
curl -o /dev/null -w '%{http_code}\n' \
  'https://<host>/api/batch/project-metrics?limit=1'
# → 401

curl -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" \
  'https://<host>/api/batch/project-metrics?limit=1'
# → 200
```

---

## 叩くエンドポイント

### 1. 内部系（毎朝1回）

```
GET /api/batch/project-metrics
```

Metabase の CSV から有料プロジェクトの判定を計算し、NocoDB に落とす。
実測: **1,295件 / 98秒**。1回で完了する。

返り値: `{ ok, date, targets, created, updated, failed, errors, elapsedSec }`

### 2. 外部系（土日月の朝、繰り返し）

```
GET /api/batch/industry-intel-weekly?tiers=1,2,3&budgetSec=280
```

古い順に、**時間の許すかぎり**処理して止まる。次の呼び出しが続きから拾う。

返り値の要点:

| 項目 | 意味 |
|---|---|
| `processed` | 今回処理した社数 |
| `staleTotal` | 対象だった社数（7日以上古い or 未取得） |
| `remaining` | **まだ残っている社数。0 になるまで繰り返す** |

パラメータ:

| 名前 | 既定 | 説明 |
|---|---|---|
| `tiers` | `1,2` | 対象Tier |
| `budgetSec` | `240`（上限280） | 1回の実行に使う秒数 |
| `maxAgeDays` | `7` | この日数より新しいものは飛ばす |
| `limit` | なし | 件数上限（検証用） |

---

## DolphinScheduler のワークフロー

### A. 内部系: 毎朝1回

- タスク種別: **HTTP** または Shell
- URL: `https://<host>/api/batch/project-metrics`
- Header: `Authorization: Bearer ${CRON_SECRET}`
- タイムアウト: **300秒以上**（実測98秒）
- スケジュール: 毎日 05:30 (JST)

### B. 外部系: remaining が 0 になるまで繰り返す

Shell タスク1つで完結する。**HTTP タスクだとループが書けない。**

```bash
#!/bin/bash
set -u
HOST="https://<host>"
TOKEN="${CRON_SECRET}"
URL="$HOST/api/batch/industry-intel-weekly?tiers=1,2,3&budgetSec=280"

# 上限を必ず置く。remaining が減らない不具合で無限に回すのを防ぐ
MAX_LOOP=60
prev_remaining=-1
stuck=0

for i in $(seq 1 $MAX_LOOP); do
  body=$(curl -sS --max-time 320 -H "Authorization: Bearer $TOKEN" "$URL")
  echo "[$i] $body"

  remaining=$(echo "$body" | sed -n 's/.*"remaining":\([0-9-]*\).*/\1/p')
  [ -z "$remaining" ] && { echo "remaining を読めませんでした。中断します"; exit 1; }
  [ "$remaining" -le 0 ] && { echo "完了"; exit 0; }

  # 進んでいないなら止める（同じ社で失敗し続ける状態を検知する）
  if [ "$remaining" -eq "$prev_remaining" ]; then
    stuck=$((stuck+1))
    [ $stuck -ge 3 ] && { echo "3回連続で remaining が減りません。中断します"; exit 1; }
  else
    stuck=0
  fi
  prev_remaining=$remaining

  sleep 5
done

echo "上限 $MAX_LOOP 回に達しました（remaining=$remaining）"
```

- スケジュール: **土・日・月 06:00 (JST)**
- タイムアウト: 6時間程度（1社85秒 × 102社 ≒ 2.4時間）
- 失敗時リトライ: 1回程度。処理済みは保存されているので再実行は安全

**冪等性**: どちらのバッチも「同じキーがあれば更新」なので、
途中で落ちて再実行しても重複しない。

---

## 注意

- **`remaining` は次の実行時に再計算される。** 7日以内に取得済みのものは対象外に
  なるため、一巡すると自然に 0 になる。
- 1社あたりのコストは Web検索 + LLM。`tiers` を広げるほど費用が増える。
- DolphinScheduler の API を直接使う場合は認証（token）が別途必要。
  UI からワークフローを作るのが早い。

---

## 実際に作ったもの（2026-08-24）

DolphinScheduler（`jobs.ptmind.com` / ユーザー karry.zhang / tenant `ptbi`）に
**SHELL タスク1つのワークフローを2本**作成した。状態は `offline`。

| 名前 | 中身 |
|---|---|
| `cxm_project_metrics` | `/api/batch/project-metrics` を1回叩く |
| `cxm_industry_intel` | `/api/batch/industry-intel-weekly` を remaining が0になるまで最大60回 |

既存の `CSM_minutes_notice` に合わせて SHELL タスクを使った
（Resources にファイルを上げる方式もあるが、短いのでスクリプト直書き）。

### エディタの癖: 改行が潰れる

Script 欄に複数行を貼ると**改行が一部落ちる**（`set -u` の直後の改行が消えて
`set -uHOST="..."` になった）。**`;` で1行に繋いで書くこと。**

### 設定完了（2026-08-24）

| ワークフロー | 状態 | スケジュール | cron |
|---|---|---|---|
| `cxm_project_metrics` | online | 毎日 05:30 (JST) | `0 30 5 * * ? *` |
| `cxm_industry_intel` | online | 毎週 日曜 06:00 (JST) | `0 0 6 ? * SUN *` |

いずれも SHELL タスク1つ、リトライ1回、tenant `ptbi`、worker group `default`。

### 途中で踏んだ問題

**1. Vercel の関数上限（300秒）に当たった。**
初回実行が `FUNCTION_INVOCATION_TIMEOUT` で失敗した。
1,295件を1件ずつ「SELECT → UPDATE」していたため、
ローカル98秒に対し Vercel では270秒超かかっていた。

対処:
- 当日分の行IDを**一括プリフェッチ**して SELECT を廃止
- NocoDB への書き込みを**並列化**（同時6）
- 時間予算（既定240秒）と `remaining` を追加して分割実行もできるように

結果: **270秒超 → 66秒**（1,295件を1回で完走。本番実測）。

`maxDuration = 600` も試したが**プラン上限300秒で打ち切られた**（323秒で応答なし）。
関数の上限は延ばせない前提で設計すること。

**2. cron はテキスト入力では反映されない。**
Timing 欄に直接打っても表示が変わるだけで、内部のモデルは古いままだった
（「Next five execution times」が毎時のまま）。
**必ずビルダー（second/minute/hour/day タブ）で設定し、
「Execute time」で次回実行時刻を確認すること。**

**3. プロセスを offline にすると、スケジュールも offline に落ちる。**
タイムアウト設定のためにプロセス定義を一度 offline → 編集 → online に戻したところ、
Cron Manage 側の State が `offline` のままだった。
プロセスが online でも**スケジュールが offline なら発火しない**。
**定義を編集したら Cron Manage を開いて State が `online` か必ず確認すること。**

**4. 一覧の行順は保存のたびに変わる。**
Update Time 順に並び替わるため、座標で power アイコンを押すと**別のジョブを落とす**。
実際に `cxm_project_metrics` を誤って offline にした。行名を毎回確認すること。

### 実行実績（2026-08-24）

| ジョブ | 結果 |
|---|---|
| `cxm_project_metrics` | 12:57 / 13:03 失敗（高速化デプロイ前）、14:08 手動実行 **成功** |
| `cxm_industry_intel` | 14:07 手動実行開始。1周目 201秒で2社処理、staleTotal 97 / remaining 95 |

`cxm_industry_intel` は 1社あたり約100秒。1周（budgetSec=280）で**2社**しか進まない。

### cxm_company_profile を追加（2026-08-24）

顧客理解プロファイルの週次事前生成（§41）。`cxm_industry_intel` と同じループ形。

| | 値 |
|---|---|
| cron | `0 0 10 ? * SUN *`（毎週日曜 10:00） |
| タスクタイムアウト | 360分（Timeout alarm + Timeout failure） |
| エンドポイント | `/api/batch/company-profile-weekly?tiers=1,2,3&budgetSec=280` |
| 1社の所要 | 約43秒（本番実測） |
| 対象 | Tier1–3 約101社 → 全社一巡に約1.5時間 |

**業界インテル（06:00開始・約2.9時間）の後に走るよう 10:00 にしてある。**
顧客理解は業界トレンドを材料の1つとして読むため、先に業界を埋めておきたい。
ただし依存はさせていない（industry が遅れても profile は前週分を使って動く）。

⚠️ **スクリプト中の `__PUT_TOKEN_HERE__` は未置換のまま。**
そのままでは 401 で失敗する。`CRON_SECRET` に置き換えてから初回を流すこと。

### cxm_campaign_org（未登録・2026-08-24 時点）

「施策から読む組織の動き」の日次事前計算（§42）。**まだ DolphinScheduler に登録していない**
（登録作業中に DS のセッションが切れたため）。手動実行で全社分は入っている。

| | 値 |
|---|---|
| 想定 cron | `0 50 5 * * ? *`（毎朝 05:50 / `cxm_project_metrics` の 05:30 の後） |
| エンドポイント | `/api/batch/campaign-org?tiers=1,2,3&budgetSec=280` |
| 実測 | 102社を **14秒**で全社完了（明細CSV 13.8MB の取得は1回だけ） |

ループは不要だが、budgetSec で切れた場合の保険として他と同じ形で登録してよい。

### 残っている作業

- **`cxm_industry_intel` のループ上限が薄い。**
  スクリプトは `for i in $(seq 1 60)` = 最大60周 → 最大120社分。
  対象97社なので足りてはいるが余裕がない。**`seq 1 150` へ引き上げる**のが安全。
  （編集時は上記の落とし穴3・4に注意）
