# 06. データ源とキャッシュ戦略

v2 の性能設計はほぼ 1 つの事実から出ている:

> **Metabase の CSV を画面のリクエスト経路で引くと、Vercel のコールドスタートごとに数秒〜30 秒を払う。**
> プロセス内キャッシュはインスタンスをまたげないので解決にならない。

そのため「**朝のバッチで NocoDB に落とし、画面は読むだけ。ただし必ずフォールバックを持つ**」という 2 層構造になっている。

---

## 1. Metabase（BI）— 公開質問の CSV

すべて `https://bi.ptmind.com/public/question/<uuid>.csv` を fetch してパースする（認証なし）。
**プロセスメモリキャッシュ TTL は各 1 時間。**

| モジュール | 内容 | 規模・実測 | 使いどころ |
|---|---|---|---|
| `project-signals` | PJ の基本指標（Paid Type / 稼働キャンペーン数 / ヒートマップ累計 / L30・L7 / PV 上限・実績・着地予測・集計期間 / 最終活動日 / 習慣化 / Master Company SF ID） | 約 4MB | ほぼすべての判定の土台 |
| `project-modules` | 直近 30 日の URL モジュール別 PV | 約 590KB | 30 日の利用判定 |
| `project-campaigns`（サマリ） | 1 PJ 1 行 | 5,255 行 / 約 800KB / 2.6 秒。**常時参照してよい** | 施策の直近の動き |
| `project-campaigns`（明細） | 施策 1 件 1 行 | 76,833 行 / **約 13.8MB** / 5 秒（本番コールド 28.8 秒）。**一覧では絶対に読まない** | 個社の「施策から読む組織の動き」と日次バッチのみ |
| `project-accounts` | アカウント別の週次稼働 | — | 運用人数（顧客側 / 社内の区別） |
| `project-user-activity` | PJ 単位のアクティブユーザー | — | Tier 3 の今週操作数 |
| `mrr` | PJ 別 MRR | — | スナップショット |
| `tier-info` / `paid-companies` / `package-events` | Tier・有料監視・パッケージイベント | — | 主にバッチ |

補助辞書 `src/lib/metabase/module-dictionary.ts` が URL モジュールを「製品（Insight / Experience / 共通）× 種別（分析利用 / 施策構築 / 施策検証 / 初期設定 / 転換シグナル / 購買シグナル / 回遊 / 未分類）」に分類する。辞書に無いモジュールの PV は `droppedPv` として捨てた量を明示する。

**CSV は PV>0 の行しか持たない**（最小値 1）。したがって「行が無い」＝管理画面に来ていない、であって「データ欠損」ではない。この解釈が `dormant` 判定の根拠になっている。

---

## 2. NocoDB — 業務データの正本

`https://odtable.ptmind.ai`（`NOCODB_API_TOKEN`）。テーブル ID は `src/lib/nocodb/client.ts` の `TABLE_IDS` に集約し、env で上書きする。**未設定のテーブルは機能単位で無効化されるだけで、他は動く。**

### v2 が読み書きする主なテーブル

| テーブル | 役割 | v2 での用途 |
|---|---|---|
| `companies` | 企業マスタ（Tier / 担当 `owner_name` = `staff_identify.name2` / 契約） | 全画面の母集合 |
| `project_info` | プロジェクト（＝部門・予算単位） | 有料 PJ の抽出 |
| `company_daily_snapshot` | 企業日次（MRR / L30 合計 / Campaign 合計 / PV 超過 PJ 数 / active・stalled PJ 数 / open_support / 更新バケット・更新日 / overall_health） | 実行体制の推移・更新時期・摩擦 |
| `project_user_snapshots` | PJ 日次（L7/L30 / Campaign / H・D・B スコア） | 時系列チャート・前週比 |
| `project_metrics` | **事前計算**（有料 PJ の判定と生指標） | ボード・準備度・個社の高速化 |
| `company_campaign_org` | **事前計算**（施策 × 組織） | 個社の顧客情報タブ |
| `industry_intel_cache` | **キャッシュ**（業界ニュース / 週次） | ホームの業界ニュース、顧客理解の材料 |
| `company_profile_cache` | **キャッシュ**（顧客理解プロファイル / 週次） | 個社の顧客情報タブ |
| `log_notion_minutes` / `log_chatwork` / `log_slack` / `log_intercom` / `cse_tickets` | 接点ログ | コミュニケーションタブ・関係の温度・摩擦・状況抽出 |
| `external_intel` | 外部 WHO 情報（IR / 組織 / 求人 / 競合） | 外部機会 |
| `company_situations` | 手動登録の状況（自動検出できない語彙） | WHAT マッチング |
| `proposal_outlines` | 提案骨子の記録 | 提案準備タブ |
| `staff_identify` | ユーザー（`name2` / role / password_hash / 表示設定） | 認証・担当フィルタ |
| `chronic_silent_snapshots` | Ptengine 側の持続休眠スナップショット | Tier 3 / 利用状況 |

### アクセス上の注意（実装に埋まっている落とし穴）

- `limit` は **最大 2000**。それ以上を渡してもサーバー側で黙って切り詰められるので、全件取得は必ず offset ページング（`nocoFetchAll` / `nocoFetchAllByUids`）。
- フィルタ構文 `( ) , ~` を percent-encode すると NocoDB がフィルタを無視して全件返すため、`URLSearchParams` を使わず手でクエリ文字列を組む。
- Number カラムが文字列で返ることがあるので `num()` で安全に数値化する。
- `company_daily_snapshot` は 7.9MB/クエリ × 3 クエリで Next.js の 2MB 制限を超えるため、プロセスキャッシュ（TTL 5 分）を挟む。キャッシュキーには**問い合わせ済み uid 集合**も持つ（少ない uid の結果が居座るのを防ぐ）。
- `cse_tickets` は append 書き込みで 1 チケットが複数行になる（実測: Tier1/2 の 69,698 行 = 実チケット 578 件 / 約 120 倍）。`source_record_id` で畳み込み、`CreatedAt` 最新行を現在の状態とする。
- 既定 TTL は 300 秒（`NOCO_DEFAULT_TTL`）。書き込み系のあとは `revalidateTag` で無効化する。

---

## 3. Notion — WHAT カタログ（読み取り専用）

`src/lib/notion/what-catalog.ts`。「What管理」配下の 6 データベースを取得して正規化する。

| 記号 | DB | 内容 |
|---|---|---|
| A | 状況カタログ | 状況 ID（WHO 語彙）が title。**コード側（`docs-src/cxm_v2/02_Signal_Taxonomy.md`）が正本で Notion はミラー** |
| B | WHAT カタログ | 提供できるもの |
| B1 | 提案の狙い | **個社ページのカードに出るのはこれ** |
| C | 文脈フレーム | どう語るか |
| — | 活用ギャラリー | 事例（Proof の材料） |
| — | 施策・問いライブラリ | Approach / Execution の材料 |

正本の分担（崩さない）:
- 語彙（状況 ID）… コードが正本
- カタログ（B/C）… **Notion が正本。CXM から編集しない**
- 個社の状況・準備度 … CXM / NocoDB が正本。**Notion には書かない**

実装上の要点:

1. リレーションは page id ではなく**状況 ID の文字列配列**に解決する（CXM の `signal_id` と文字列一致させるのが唯一の契約）。
2. 候補に含める条件をここでフィルタする（状態=利用可 / 提供段階≠構想 / **逆効果が非空**）。逆効果が空の行を入れると全商材が全顧客にマッチしてしまう。
3. **黙って無視しない。** A に存在しない状況 ID を参照する行は候補から外し、`issues` に理由を積んで返す。
4. 0 件でも落ちない（未共有・未設定なら空カタログで継続）。

> ⚠️ ID は **database ID** を使う。Notion は database と data source を分離しており、URL や MCP で見える `collection://…` の data source ID を REST API に渡すと 404 になる。

---

## 4. LLM — OpenRouter

`src/lib/anthropic/client.ts`（名前は anthropic だが実体は OpenRouter + OpenAI SDK）。既定モデル `anthropic/claude-sonnet-4-5`（`ANTHROPIC_MODEL` で上書き）。
Extended Thinking は `extra_body` の `thinking`（既定 budget 8,000 トークン）で渡す。Web 検索は OpenRouter の web プラグイン（`src/lib/anthropic/web-search.ts`）。

v2 で LLM を使う箇所:

| 用途 | 実装 | 保存 |
|---|---|---|
| 顧客理解プロファイル生成 | `prompts/company-profile.ts` | `company_profile_cache` |
| 業界トレンド取得（Web 検索 → 構造化） | `lib/company/industry-intel.ts` | `industry_intel_cache` |
| 外部情報の調査 / 取り込み構造化 | `prompts/external-intel-extract.ts` | 保存しない（候補のみ） |
| 議事録からの状況抽出 | `prompts/situation-extract.ts` | 人が承認したものだけ `company_situations` |
| 提案骨子の生成 | `prompts/proposal-outline.ts` | 任意で `proposal_outlines` |
| 画面内 AI アシスタント | `lib/ai/chat-agent.ts` | Blob |

### 出典ポリシー（業界トレンド）

`SOURCE_POLICY`:
- 鮮度の上限 36 か月。これより古い情報は採用しない
- **時点が特定できない情報は採用しない**（`allowUnknownDate: false`）
- **リンク切れは記述ごと除外**（`keepDeadLinks: false`）

「出典が開けない」「いつの情報か分からない」記述は担当者が顧客に話せないため、少なく正確を選ぶ。

---

## 5. Vercel Blob

- AI チャット履歴（`ai-chat/{userKey}/{threadId}/{seq}.{updatedAtMs}.{msgCount}.{titleB64}.json`）
- AI 設定（`ai-prefs/...`）
- 生成資料（旧 UI の Documents）

**追記専用（append-only）**。Blob の `cacheControlMaxAge` は最小 60 秒なので、同じ pathname を上書きすると保存直後の最大 1 分間は古い内容が返る（チャット履歴としては壊れている）。毎回 `seq+1` の新しい pathname に put し、`list()`（API 直・キャッシュ無し）で最新版を選ぶ。一覧はタイトル・更新時刻・件数を pathname に埋めているので本文を 1 件も取りに行かない。
環境ごとに `scopedRoot()` でルートを分ける。

---

## 6. キャッシュ階層まとめ

```
① Vercel の Route Cache        …  /api/home/digest のみ revalidate = 300
② NocoDB fetch キャッシュ       …  既定 TTL 300 秒（tag で無効化）
③ プロセスメモリ                …  Metabase CSV 各 1 時間 / スナップショット 5 分 / Notion 業界トレンド 24 時間
④ NocoDB 上の事前計算・キャッシュ …  project_metrics（日次）/ company_campaign_org（日次）
                                   industry_intel_cache（週次）/ company_profile_cache（週次）
⑤ ブラウザ localStorage         …  AI パネルの幅と既定挙動、表示スコープ・重点領域
```

③ は**インスタンスをまたげない**ので、遅さの本質的な解決は ④ の事前計算にある。

### 事前計算のフォールバック規則（`loadProjectFacts`）

1. `project_metrics` を引き、`isFresh` な行が対象 PJ の **50% 以上**あればそれだけで進む（`source: 'precomputed'`）。
2. 50% 未満なら「バッチが動いていない」と判断して CSV から計算し直す（`source: 'live'`、`fallbackReason` 付き）。
3. **欠けている数件のために 5MB を落とさない。** 実測（2026-08-22）: 有料 PJ 260 件中 243 件（93%）が事前計算にあり、欠けた 17 件は Metabase 側にも存在しなかった＝ live に落ちても同じく空になる。
4. 欠けた ID は `missingIds` として返し、黙って落とさない。
