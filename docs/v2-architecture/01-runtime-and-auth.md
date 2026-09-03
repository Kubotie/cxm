# 01. ランタイム構成・ルーティング・認証

## 1. ランタイム

- Next.js 15.3.9 App Router、Node.js ランタイム（`runtime = 'edge'` は使っていない）。
- `next.config.ts`:
  - `serverExternalPackages: ["unpdf"]` — PDF テキスト抽出（外部資料の取り込み）で pdfjs のワーカー解決が壊れるため、バンドルせず require させる。
  - `rewrites`: `/nocodb-proxy/:path*` → `${NOCODB_BASE_URL}/:path*`（既定 `https://odtable.ptmind.ai`）。ブラウザから NocoDB を直接見るための開発用経路で、v2 画面は使っていない。
- `vercel.json` には Cron 定義のみ（→ [08-batch-and-schedule.md](08-batch-and-schedule.md)）。
- API ハンドラは処理時間に応じて `export const maxDuration` を個別指定（60 / 120 / 180 / 300 秒）。Vercel の当プランの上限は 300 秒で、これを超えるものは「時間予算内で処理して残件数を返す」設計にしている。

## 2. ルート一覧（`/v2` 配下）

| パス | 実装 | 種別 | 状態 |
|---|---|---|---|
| `/v2` | `page.tsx` → `home-view.tsx` | Client | 稼働（ホーム） |
| `/v2/readiness` | `readiness/page.tsx` → `board-view.tsx` | Client | 稼働（提案準備ボード） |
| `/v2/companies` | `companies/page.tsx` | Server | `/v2/readiness` へ redirect |
| `/v2/companies/[companyUid]` | `page.tsx`（Server）→ `view.tsx`（Client）＋ `proposal-flow.tsx` / `campaign-org.tsx` | Server + Client | 稼働（個社ページ） |
| `/v2/projects` | `projects/page.tsx` → `dashboard-view.tsx` | Client | 稼働（プロジェクト分析） |
| `/v2/projects/[projectId]` | `page.tsx`（Server）→ `detail-view.tsx`（Client） | Server + Client | 稼働（PJ 詳細） |
| `/v2/tier3` | `tier3/page.tsx` → `dashboard-view.tsx` | Client | 稼働（Tier 3 管理） |
| `/v2/settings` | `settings/page.tsx` → `settings-view.tsx` | Client | 稼働（設定） |
| `/v2/actions` `/v2/support` `/v2/ai` `/v2/assets` `/v2/churn` `/v2/documents` `/v2/outbound` | 各 `page.tsx` → `_components/coming-soon.tsx` | Server | プレースホルダ（サイドバー非掲載） |

サイドバーに出るのは **ホーム / 提案準備ボード / プロジェクト分析 / Tier 3 管理 / 設定** の 5 つだけ。
個社ページは「提案準備ボードの子」として扱われ、開いている間だけボードの下に階層表示され、親（ボード）も active になる。

## 3. レイアウト

### ルートレイアウト `src/app/layout.tsx`

```
<html lang="ja">
  <body>
    <AiAssistantShell>{children}</AiAssistantShell>   ← 全ページ共通の AI サイドパネル
  </body>
</html>
```

`AiAssistantShell` はラッパー `div` の `padding-right` + `box-sizing: content-box` で本文を押し出す。
（`html`/`body` の padding・margin ではスクロール可能領域が作られず、本文がパネルの下に潜って到達できなくなる問題を 3 回作り直した末の実装。詳細は `src/components/ai/index.tsx` のコメント）

### v2 レイアウト `src/app/v2/layout.tsx`（Client Component）

- グリッド `204px | 1fr`。左が固定サイドバー（`sticky top-0 h-screen`、背景 `#0b1220`）、右が本文（背景 `#f1f5f9`）。
- `NAV` 配列に主動線 4 件（ホーム / 提案準備ボード `Tier 1–3` / プロジェクト分析 `30日` / Tier 3 管理）、下部に `設定`。
- `ARCHIVE` 配列（14 件）は折りたたみ。旧 UI と未整備画面へのリンクを残すが、動線からは外している。
- active 判定: ホームのみ完全一致（前方一致にすると `/v2` 配下すべてが光る）。`/v2/readiness` は個社ページ滞在中も active。

各画面のヘッダーは共通コンポーネント化されておらず、画面ごとに `sticky top-0 z-20 bg-white/95 backdrop-blur border-b` のヘッダーを持つ（ホーム・ボード・PJ 分析）か、`TopBar`（個社ページ内のローカル関数）を使う。

## 4. 認証

### middleware（`src/middleware.ts`）

```
matcher: '/((?!_next/static|_next/image|favicon.ico).*)'
```

- `/api/**` は**素通し**（fetch が HTML を受け取るのを防ぐため。各 API ハンドラが 401/404 を返す）。
- `/login` は常に通過。ただし Cookie があれば `/v2` にリダイレクト（ログイン後のトップは `/v2`）。
- それ以外のページリクエストは Cookie `cxm_user_uid` が無ければ `/login` へリダイレクト。

### セッション（`src/lib/auth/session.ts`）

- Cookie `cxm_user_uid` に **`staff_identify.name2`**（Roman/nickname）を保存。`companies.owner_name` と一致する値で、これが「担当者フィルタ」の鍵になる。
- Cookie `cxm_user_role` にロールを保存。
- **HttpOnly なのでクライアント JS から読めない。** 画面で自分の名前を出すときは `GET /api/user/profile` を 1 回引く。
- 有効期限 30 日。本格認証（SSO / NextAuth）導入時はこのファイルだけ差し替える想定。

### ログイン（`POST /api/auth/login`）

2 段階のパスワード照合:

1. `staff_identify.password_hash` が設定済み → **そのハッシュだけで判定**（個別パスワードを設定した人は共有パスワードでは入れない）。
2. 未設定 → 共有パスワード `APP_PASSWORD`（既定 `ptengine2026`）。移行のための経過措置。

ハッシュは Node 標準 `scrypt`（`src/lib/auth/password.ts`）。保存形式 `scrypt$N$r$p$<salt b64url>$<hash b64url>`（N=16384, r=8, p=1, keylen=32）。最低 10 文字。
ユーザーの存在有無を漏らさないため、失敗メッセージは常に「メールアドレスまたはパスワードが違います」。

### ロール（`src/lib/auth/role.ts`）

`admin` / `manager` / `ops` / `csm` / `viewer`。`canAccess(route, role)` で旧 UI の `/ops/**` 系を制御する。
**v2 画面は現時点でロールによる出し分けをしていない**（設定画面がロールを表示するだけ）。

## 5. レンダリング戦略

| 画面 | 初期データの取り方 | 理由 |
|---|---|---|
| 個社ページ | **Server Component が並列 3 本を await** して Client に props で渡す（`loadCompanyUsage` / `loadCompanyTimeseries` / `fetchStoredCampaignOrg`）。await 中は `loading.tsx` がストリーミング表示 | 「JS バンドル → mount → fetch」のクライアント・ウォーターフォールを排除するため |
| ホーム | Client から 3 本を独立に fetch（`/api/user/profile`, `/api/home/digest`, `/api/companies/proposal-board`） | 1 本遅くても他を先に出す |
| 提案準備ボード | Client から `/api/companies/proposal-board` 1 本 | |
| PJ 分析 / PJ 詳細 / Tier 3 / 設定 | Client から fetch | |
| 個社ページのタブ | **タブを開いた時だけ**取得（顧客理解プロファイル・準備度・コミュニケーション） | プロファイル生成は 30 秒、コミュニケーションは全ログ取得のため初期表示をブロックさせない |

キャッシュ指定は限定的:

- `GET /api/home/digest` に `export const revalidate = 300`（5 分）。
- NocoDB フェッチは既定 TTL 300 秒（`NOCO_DEFAULT_TTL`）＋ Metabase CSV はプロセスメモリキャッシュ 1 時間。
- 設定画面の読み取り系 fetch は `cache: "no-store"`。

## 6. 環境変数（v2 の稼働に関わるもの）

| 変数 | 用途 |
|---|---|
| `NOCODB_API_TOKEN` / `NOCODB_BASE_URL` | NocoDB アクセス |
| `NOCODB_*_TABLE_ID`（約 40 本） | テーブル ID。**未設定のテーブルは機能ごと graceful degradation**（例: `NOCODB_PROPOSAL_OUTLINES_TABLE_ID` 未設定なら骨子の保存ボタンを出さない） |
| `OPENROUTER_API_KEY` / `ANTHROPIC_MODEL` | LLM（既定 `anthropic/claude-sonnet-4-5`） |
| `OPENAI_API_KEY` | 旧サポート系（v2 は未使用） |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob（AI チャット履歴・AI 設定） |
| `APP_PASSWORD` | 共有パスワード（経過措置） |
| `CRON_SECRET` / `SUPPORT_BATCH_SECRET` | バッチ認証。**両方未設定だと認証をスキップして通す**（開発用。本番では必須） |
| `TOKEN_NOTION` (+ `TOKEN_NOTION_2`) | Notion What管理カタログ |
| `TOKEN_INTERCOM` | Intercom（サポート同期） |
| `SALESFORCE_*` | Salesforce（v2 画面からは未使用） |
