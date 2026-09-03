# CXM v2 アーキテクチャ ─ 全体像と索引

対象: `src/app/v2/**` で公開されている画面と、それが実際に使っている API・ライブラリ・データ源・バッチのみ。
アーカイブ（旧 UI: `/legacy`, `/companies`, `/console/**`, `/support/**`, `/ops/**`, `/actions`, `/assets`, `/documents`, `/outbound`, `/settings`）は対象外。

作成: 2026-09-02 / 出典: リポジトリ `cxm-next-app`（ブランチ `feat/v2-settings-and-account-prefs`）の実装

---

## 1. これは何のアプリか

Ptengine の CSM / マーケティング支援業務のための社内 Web アプリ（コード名 CXM、サイドバー表記は「CXM 顧客前進 OS」）。

v2 の中心にある問いは 1 つだけ:

> **今この顧客に提案を持ち込んでよいか。持ち込めないなら、先に何を片付けるか。**

そのため v2 の主動線は次の 3 段になっている。

```
ホーム（/v2）
  今日どこから手をつけるか
        │
        ▼
提案準備ボード（/v2/readiness）
  誰に提案できるか（4レーン × 提案準備度）
        │
        ▼
個社ページ（/v2/companies/[companyUid]）
  この顧客をどう前進させるか（顧客理解 → 判定 → 提案骨子）
```

これを横から支える 2 画面（プロジェクト分析 `/v2/projects`、Tier 3 管理 `/v2/tier3`）と、
全画面に常駐する AI サイドパネルがある。

---

## 2. 技術スタック（実測値ベース）

| 層 | 採用技術 | 補足 |
|---|---|---|
| フレームワーク | Next.js 15.3.9 App Router / React 18.3.1 | Server Component + Client Component 併用 |
| 言語 | TypeScript 5.8.3 | |
| スタイル | Tailwind CSS v4.1.12（`@tailwindcss/postcss`）+ tw-animate-css + typography | v2 画面はほぼ Tailwind 直書き（shadcn/ui は旧 UI 由来で `src/components/ui/**` に残存） |
| UI 部品 | Radix UI 各種、lucide-react（アイコン）、recharts（チャート）、sonner（トースト）、tiptap（旧 Outbound 用） | v2 が実際に使うのは lucide-react / recharts / 自前 `InfoTip` が中心 |
| ホスティング | Vercel（プロジェクト `cxm_x`） | `vercel.json` に Cron 6 本 |
| 業務データ | NocoDB（`https://odtable.ptmind.ai`） | 約 40 テーブルを ID 指定で読み書き |
| BI データ | Metabase 公開質問の CSV（`https://bi.ptmind.com/public/question/*.csv`） | 認証なしの public question を fetch してパース |
| 提供物カタログ | Notion API（What管理 配下の 6 DB） | 読み取り専用。Notion が正本 |
| LLM | OpenRouter（OpenAI SDK 形式）。既定 `anthropic/claude-sonnet-4-5` | 一部で Extended Thinking / Web 検索プラグイン |
| ファイル/履歴 | Vercel Blob | AI チャット履歴・AI 設定・生成資料 |
| 外部連携 | Salesforce / Intercom / Notion / Slack / Chatwork | v2 画面が直接触るのは Notion と Intercom（リンク生成）程度 |

---

## 3. データフローの一枚図

```
   [Metabase CSV]              [NocoDB]                  [Notion]        [Web検索/LLM]
  signals 4MB                companies                 A 状況カタログ    OpenRouter
  modules 590KB              project_info              B WHATカタログ    + web plugin
  campaigns 800KB            company_daily_snapshot    B1 提案の狙い
  campaign明細 13.8MB        project_user_snapshots    C 文脈フレーム
  accounts / mrr             log_chatwork/slack/       活用ギャラリー
                             notion_minutes            施策・問い
        │                    log_intercom / cse_tickets     │                │
        │                    company_situations             │                │
        │                    external_intel                 │                │
        ▼                           │                       │                │
 ┌──────────────────┐                │                       │                │
 │ 夜間/朝バッチ     │                │                       │                │
 │ project-metrics  │──────► project_metrics（事前計算）      │                │
 │ campaign-org     │──────► company_campaign_org            │                │
 │ industry-intel   │──────► industry_intel_cache ◄──────────┼────────────────┘
 │ company-profile  │──────► company_profile_cache ◄─────────┘（LLM生成物）
 │ company-snapshot │──────► company_daily_snapshot
 └──────────────────┘
        │
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Route Handlers（/api/**）＋ lib/company/*（判定ロジック）      │
 │  ・事前計算があればそれを読む → 無ければ CSV に落ちる          │
 │  ・提案準備度 / モジュール判定 / 施策判定 / 行動シグナル       │
 └───────────────────────────────────────────────────────────────┘
        │
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ /v2 画面（Server Component で初期データ + Client で遅延取得）  │
 │  ホーム / 提案準備ボード / 個社 / PJ分析 / Tier3 / 設定        │
 │  ＋ AI サイドパネル（画面が snapshot を申告し、AI が深掘り）   │
 └───────────────────────────────────────────────────────────────┘
```

---

## 4. 設計を貫いている 6 つの原則

実装のコメントに繰り返し現れる方針。これを知らないと個々のコードが読み解けない。

1. **重い計算はリクエスト経路から外す。** Metabase CSV（合計 5MB 超、明細は 13.8MB）を画面表示のたびに引くとコールドスタートで 4〜29 秒かかる。朝のバッチで NocoDB（`project_metrics` 等）に落とし、画面は読むだけにする。
2. **ただしフォールバックを必ず持つ。** 事前計算のカバー率が 50% を切ったら、その場で CSV から計算する（`loadProjectFacts`）。バッチが落ちた日に画面が空になることは許容しない。
3. **「立たなかった」と「見ていない」を区別する。** 算出できない要素は `null` のまま返し、`missing` / `notEvaluated` / `pvNote` として画面に理由を出す。推定で埋めない。
4. **推定であることを隠さない。** 準備度は `reasons`（配点内訳）と `caps`（上限適用理由）を必ず持ち、UI がそのまま表示する。凡例の文言は `FACTOR_META` / `BLOCKER_META` などコード側の定数が正本で、画面には書き写さない。
5. **AI は提案までで、採否は人が押す。** 外部情報の調査・議事録からの状況抽出は候補を返すだけで、保存は担当者が選んだものだけ（human in the loop）。
6. **動線に乗らないものは運用されない。** サイドバーには実データで動く画面だけを置き、未実装・旧 UI は下部「アーカイブ」に畳む（`src/app/v2/layout.tsx`）。

---

## 5. ドキュメントの構成

| ファイル | 内容 |
|---|---|
| [01-runtime-and-auth.md](01-runtime-and-auth.md) | ランタイム構成・ルーティング・middleware・認証・レイアウト・レンダリング戦略 |
| [02-screens-home-readiness.md](02-screens-home-readiness.md) | ホームと提案準備ボードの画面仕様（データ源・表示ルール・フィルタ） |
| [03-screens-company-detail.md](03-screens-company-detail.md) | 個社ページ（4 タブ）と提案骨子フローの詳細 |
| [04-screens-projects-tier3-settings.md](04-screens-projects-tier3-settings.md) | プロジェクト分析・PJ 詳細・Tier 3 管理・設定・ComingSoon |
| [05-api-reference.md](05-api-reference.md) | v2 が使う API の一覧（メソッド・クエリ・maxDuration・依存） |
| [06-data-sources-and-cache.md](06-data-sources-and-cache.md) | NocoDB / Metabase / Notion / Blob / LLM の扱いとキャッシュ階層 |
| [07-scoring-logic.md](07-scoring-logic.md) | 提案準備度・モジュール判定・施策判定・行動シグナル・WHAT マッチングの計算式 |
| [08-batch-and-schedule.md](08-batch-and-schedule.md) | Vercel Cron と DolphinScheduler、各バッチの役割と時間予算 |
| [09-ai-assistant.md](09-ai-assistant.md) | 画面内 AI アシスタント（申告 → 深掘り → 履歴）の仕組み |
| [10-constraints.md](10-constraints.md) | 既知の制約・落とし穴・未実装（読む前に知っておくべきこと） |
