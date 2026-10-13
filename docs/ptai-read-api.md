# PtAI Pipeline 読み取り API

Ptengine AI Pipeline Board のデータを外から読むための API。
分析ツールや AI エージェントに渡して、進捗の報告や商談の分析をさせるためのもの。

**読むことしかできない。** この鍵でデータが書き換わることはない。

---

## 1. 鍵

ヘッダーに `Authorization: Bearer <PTAI_READ_TOKEN>` を付ける。
鍵は `ptai_ro_` で始まる 40 文字。Vercel の環境変数 `PTAI_READ_TOKEN` にある。

```bash
npx vercel@62.1.0 env pull .env.production.local --environment=production
```

> **運用のバッチ鍵（`SUPPORT_BATCH_SECRET`）を代わりに使わないこと。**
> あちらは 25 本の API を開ける鍵で、その大半が書き込み・再計算を走らせる
> （現在MRR の上書き、Salesforce の取り込み、Tier の書き換えなど）。
> 外に出してよいのは `PTAI_READ_TOKEN` だけ。

---

## 2. 読めるのはこの 3 つだけ

**これ以外のパスは、正しい鍵を付けても必ず 401 になる。**
`/api/pipeline` や `/api/ptai/raw` などを探しても見つからない。

| | 用途 |
|---|---|
| `GET /api/ptai/export` | 会社・商談・障壁・ネクストアクション・進捗・失注。**いちばん情報量が多い** |
| `GET /api/ptai/kpi` | 上部 8 指標の日ごとの推移と前日差分 |
| `GET /api/ptai/kpi?live=1` | 上部 8 指標のいまの値 |

ベース URL は `https://cxmx.vercel.app`。

パスを間違えると、`endpoints` に正しい行き先を入れて 401 を返す。

---

## 3. `GET /api/ptai/export`

```bash
curl -H "Authorization: Bearer $PTAI_READ_TOKEN" \
  "https://cxmx.vercel.app/api/ptai/export?include=all"
```

### クエリ

| | |
|---|---|
| `include` | 既定 `deals,kpi`。`all` で全部。個別指定は `deals,kpi,logs,success,org,minutes,notes,docs,recent,feed` から選ぶ |
| `owner` | 担当者で絞る（`Paul` `Baba` `Eri` `Kubotie` `Ava` `Utty`） |
| `stage` | そのフェーズの商談を持つ会社だけ |
| `cid` | 会社の Notion ページ ID |
| `q` | 社名の部分一致 |
| `withDeals` | `1` で商談のある会社だけ |
| `allowPartial` | `1` で、取りこぼしがあっても 200 で返す（調査用。通常は使わない） |

既定でおよそ 140KB、`include=all` で 250KB〜1.3MB。

### 返るもの

```
target        目標 合算MRR・達成期限・担当者ごとの配分
members       担当者の一覧
stages        フェーズの定義（英語名・表示名・社内の言い方・係数）
totals        チーム全体＋担当者 6 名の 8 指標
progress      誰がどれだけ動かしたか（後述）
lost          失注した商談（後述）
counts        社数・商談数
companies[]   会社ごとの中身
```

会社 1 件:

```
cid name tier industry status owners
currentMrr baseMrr aimMrr      現在MRR / 期初MRR / ①（目標）追加MRR
sfAccountId url domain keyDates
kpi {}                         この会社のパイプライン・コミット・チャレンジ・確定・計画
deals[] success org minutes notes docs aiSummary
```

商談 1 件:

```
key name stage stageLabel stageNote    stageNote は社内の言い方
addMrr forecast expected               ②金額 / 係数 / ③見込額
applyDate billingDate termMonths
barrier need                           障壁・ニーズ
nextAction nextActionDate overdue      ネクストアクションと期限超過の判定
lostReason lostDetail                  失注理由
milestones sfPending pendingStage
fromSalesforce updatedAt
stageHistory[]                         include=logs のとき。フェーズの変遷
logs[]                                 include=logs のとき。障壁・ネクストアクションの経過
```

---

## 4. `GET /api/ptai/kpi`

```bash
curl -H "Authorization: Bearer $PTAI_READ_TOKEN" \
  "https://cxmx.vercel.app/api/ptai/kpi?scope=team&days=30"
```

| | |
|---|---|
| `scope` | `team`（既定）／担当者名／`all`（7 対象まとめて） |
| `days` または `from`・`to` | 既定は直近 90 日 |
| `live=1` | 保存済みの推移ではなく、いまの値を計算して返す |

毎朝 8:15 に記録した 1 日 1 行が返る。各行の `delta` に**前の行からの増減**が入る。
記録は 2026-10-13 からなので、それ以前は無い。

指標は 8 つ: `targetMrr` `plan` `expected` `overdue` `won` `commit` `challenge` `pipeline`。
計画は内訳（`planBase` 既契約／`planWon` 受注／`planDeal` 商談中／`planAim` まだ商談なし）も返る。

---

## 5. 読み違えやすいところ

### `progress` は稼働量ではない

ダッシュボードと Salesforce に**記録が残った回数**であって、面談・メール・電話は入っていない。
まとめて入力する人は、入力した日だけ数字が跳ねる。

### Salesforce 由来は「推定」

Salesforce 側でフェーズを動かしても、**誰が動かしたかは記録に残らない**
（Salesforce の OwnerId は社内ユーザーの体系が別で、画面の担当者と対応しない）。
そこで会社の担当者に割り当てている。取り違えないよう、必ず分けて返す。

- `actorKind: "person"` … 画面で本人が操作した。実測
- `actorKind: "system"` … Salesforce 側で動いた。**会社の担当者に割り当てた推定**
- `progress.byMember[].self` / `.viaSalesforce` も同じ分け方

`activeDays` は本人の画面操作だけで数えている。

### Salesforce 由来の日付は「気づいた日」

取り込みで検出した日時であって、Salesforce で変わった日ではない。
同じ時刻に固まっているものは 1 回の取り込み。`progress.syncRuns` に切れ目が入る。

**とくに最初の取り込みは、それまでの推定値を Salesforce の実態に合わせ直しただけ。**
その日に商談が動いたわけではないので、「後退 N 件」として読まないこと。

### 失注理由は `lostDetail` を見る

`lostReason`（画面の選択肢）は運用されておらず、2026-10-13 時点で全商談が空。
中身があるのは `lostDetail` で、Salesforce の `Dead_Detail_Reason__c` から自動で入る。

### ニーズは空

`need` は項目としてはあるが、進行中の商談では使われていない。

---

## 6. エラー

| | |
|---|---|
| `401 unauthorized` | 鍵が違う |
| `401 unauthenticated` | 鍵もセッションも無い |
| `401 unknown_endpoint` | パスが違う。`endpoints` に正しい行き先が入っている |
| `400 bad_include` / `bad_scope` | クエリの値が違う |
| **`503 incomplete`** | **取りこぼしあり。数字を使わないこと**（後述） |
| `502 upstream_unavailable` | 取得元に繋がらない |

### 503 を 0 件と取り違えないこと

元データの Twenty にはレート制限があり、短時間に叩くと 429 で弾かれる。
そのとき一部が空で返るので、**そのまま計算すると「商談ゼロ・パイプライン 0 円」に見える。**
正常値と区別がつかないため、取りこぼしがあるときは 200 を返さず 503 にしている。

少し間を空けて取り直すこと。`include` を絞れば当たりにくい。

---

## 7. 答えられないこと

- 実際の営業活動量（面談・メール・電話の回数）。ダッシュボードに残った記録しか無い
- Salesforce 側で誰がフェーズを動かしたか。推定しかできない
- 2026-10-01 より前の動き。操作ログは Twenty 移行後しか無い
- 失注の傾向。母数が足りない

---

## 8. 実装

| | |
|---|---|
| 鍵の判定 | `src/lib/ptai/read-auth.ts` |
| 組み立て | `src/lib/ptai/export.ts` |
| 指標の式 | `src/lib/ptai/kpi.ts`（**画面と同じ式。`calc.ts` は旧版で合わない**） |
| 毎朝の記録 | `src/lib/ptai/kpi-snapshot.ts` ＋ `/api/batch/ptai-kpi-snapshot`（8:15 JST） |
| 入口 | `src/app/api/ptai/export/route.ts` / `src/app/api/ptai/kpi/route.ts` |
| 通過の許可 | `src/middleware.ts` の `API_ALLOWLIST` |
| テスト | `scripts/ptai-kpi.test.mts` |

新しい読み取り API を足すときは `requirePtaiRead()` を通し、`API_ALLOWLIST` にパスを足す
（middleware が先に 401 を返すため）。**書き込む経路でこの鍵を受け付けてはいけない。**
