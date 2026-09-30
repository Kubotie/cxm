# 01. ランタイム構成・ルーティング・認証

## 1. ランタイム

- Next.js 15.3.9 App Router、Node.js ランタイム（`runtime = 'edge'` は使っていない）。
- `next.config.ts`:
  - `serverExternalPackages: ["unpdf"]` — PDF テキスト抽出（外部資料の取り込み）で pdfjs のワーカー解決が壊れるため、バンドルせず require させる。
  - `rewrites`: `/nocodb-proxy/:path*` → `${NOCODB_BASE_URL}/:path*`（既定 `https://odtable.ptmind.ai`）。ブラウザから NocoDB を直接見るための開発用経路で、v2 画面は使っていない。
- `vercel.json` には Cron 定義のみ（→ [08-batch-and-schedule.md](08-batch-and-schedule.md)）。
- API ハンドラは処理時間に応じて `export const maxDuration` を個別指定（60 / 120 / 180 / 300 秒）。Vercel の当プランの上限は 300 秒で、これを超えるものは「時間予算内で処理して残件数を返す」設計にしている。

## 2. ルートグループ（2026-09 変更）

`src/app` 直下は**ルートグループ 2 つ**に分かれている。URL には現れない。

```
src/app/
├── (cxm)/          CXM 本体。ルートレイアウトが AI サイドパネルを載せる
│   ├── layout.tsx
│   └── v2/...
├── (ptai)/         Ptengine AI パイプラインボード（独立した別アプリ）
│   ├── layout.tsx
│   └── ptai-pipeline/
├── api/            両者が共有
└── globals.css
```

分けた理由は **CSS の分離**。`(ptai)` は取り込んだ原本のスタイルをそのまま使うため、
CXM 側のグローバル CSS と混ぜられない。それぞれが独自の `layout.tsx`（`<html>` から書く）を持つ。

> ⚠️ ファイルパスは `src/app/(cxm)/v2/...` だが、**URL は `/v2/...` のまま**。

## 3. ルート一覧（`/v2` 配下）

| パス | 実装（`src/app/(cxm)/` 配下） | 種別 | 状態 |
|---|---|---|---|
| `/v2` | `v2/page.tsx` → `home-view.tsx` | Client | 稼働（ホーム） |
| `/v2/readiness` | `v2/readiness/page.tsx` → `board-view.tsx` | Client | 稼働（提案準備ボード） |
| `/v2/companies` | `v2/companies/page.tsx` | Server | `/v2/readiness` へ redirect |
| `/v2/companies/[companyUid]` | `page.tsx`（Server）→ `view.tsx`（Client）＋ `proposal-flow.tsx` / `campaign-org.tsx` | Server + Client | 稼働（個社ページ） |
| `/v2/projects` | `v2/projects/page.tsx` → `dashboard-view.tsx` | Client | 稼働（プロジェクト分析） |
| `/v2/projects/[projectId]` | `page.tsx`（Server）→ `detail-view.tsx`（Client） | Server + Client | 稼働（PJ 詳細） |
| **`/v2/radar`** | `v2/radar/page.tsx` → `scope-view.tsx` | Client | 稼働（解約レーダー / → [11](11-churn-radar.md)） |
| **`/v2/radar/[companyUid]`** | `page.tsx` → `drill-view.tsx` | Client | 稼働（個社ドリル） |
| **`/v2/radar/voices`** | `page.tsx` → `voices-view.tsx` | Client | 稼働（言質レビュー） |
| **`/v2/radar/accuracy`** | `page.tsx` → `accuracy-view.tsx` | Client | 稼働（精度パネル） |
| `/v2/tier3` | `v2/tier3/page.tsx` → `dashboard-view.tsx` | Client | 稼働（Tier 3 管理） |
| `/v2/settings` | `v2/settings/page.tsx` → `settings-view.tsx` | Client | 稼働（設定） |
| `/v2/actions` `/v2/support` `/v2/ai` `/v2/assets` `/v2/churn` `/v2/documents` `/v2/outbound` | 各 `page.tsx` → `_components/coming-soon.tsx` | Server | プレースホルダ（サイドバー非掲載） |

`/v2` 以外のルートグループ:

| パス | 実装 | 内容 |
|---|---|---|
| `/apps` | `src/app/(cxm)/apps/page.tsx` | **ログイン後の着地点**。CXM と Ptengine AI パイプラインの入口 |
| `/ptai-pipeline` | `src/app/(ptai)/ptai-pipeline/` | Ptengine AI パイプラインボード。原本をまるごと取り込んだもの |

2 つのアプリは**入口（認証）だけを共有し、データは独立**している。
`/api/ptai/*`（ai / db / mcp / me / profiles / raw）はすべて署名済みセッション（`cxm_session`）を検証し、
未ログインには 401 を返す。

サイドバーに出るのは **ホーム / 提案準備ボード / プロジェクト分析 / 解約レーダー / Tier 3 管理 / 設定** の 6 つ。
個社ページは「提案準備ボードの子」として扱われ、開いている間だけボードの下に階層表示され、親（ボード）も active になる。

## 4. レイアウト

### ルートレイアウト `src/app/(cxm)/layout.tsx`

```
<html lang="ja">
  <body>
    <AiAssistantShell>{children}</AiAssistantShell>   ← 全ページ共通の AI サイドパネル
  </body>
</html>
```

`AiAssistantShell` はラッパー `div` の `padding-right` + `box-sizing: content-box` で本文を押し出す。
（`html`/`body` の padding・margin ではスクロール可能領域が作られず、本文がパネルの下に潜って到達できなくなる問題を 3 回作り直した末の実装。詳細は `src/components/ai/index.tsx` のコメント）

### v2 レイアウト `src/app/(cxm)/v2/layout.tsx`（Client Component）

- グリッド `204px | 1fr`。左が固定サイドバー（`sticky top-0 h-screen`、背景 `#0b1220`）、右が本文（背景 `#f1f5f9`）。
- `NAV` 配列に主動線 5 件（ホーム / 提案準備ボード `Tier 1–3` / プロジェクト分析 `30日` / **解約レーダー `予兆`** / Tier 3 管理）、下部に `設定`。
- `ARCHIVE` 配列（14 件）は折りたたみ。旧 UI と未整備画面へのリンクを残すが、動線からは外している。
- active 判定: ホームのみ完全一致（前方一致にすると `/v2` 配下すべてが光る）。`/v2/readiness` は個社ページ滞在中も active。

各画面のヘッダーは共通コンポーネント化されておらず、画面ごとに `sticky top-0 z-20 bg-white/95 backdrop-blur border-b` のヘッダーを持つ（ホーム・ボード・PJ 分析）か、`TopBar`（個社ページ内のローカル関数）を使う。

## 5. 認証（2026-09-30 セキュリティ是正で全面改訂）

### 要約

| | 旧 | 現行 |
|---|---|---|
| セッション Cookie | `cxm_user_uid` に `name2` を**平文**で保存 | `cxm_session` に **HMAC-SHA256 署名付きトークン** |
| ロール | `cxm_user_role` Cookie（自己申告値） | **Cookie では扱わない。`staff_identify` から引く** |
| API | middleware が `/api/*` を**素通し** | **原則すべて署名済みセッション必須**。バッチだけ Bearer |
| 未認証の応答 | 各ハンドラ任せ | API は **JSON 401**、ページは `/login` へリダイレクト |

`cxm_user_uid` と `cxm_user_role` は**廃止済み**。読み取りコードは存在せず、
ログイン・ログアウト時に `Max-Age=0` で削除する。旧 Cookie だけを送っても未認証として扱う。

### セッショントークン（`src/lib/auth/session-token.ts`）

```
v1.<base64url(payload)>.<base64url(HMAC-SHA256)>
payload = { u: name2, iat: 発行時刻(秒), exp: 失効時刻(秒) }
```

- 署名鍵は環境変数 **`CXM_SESSION_SECRET`**（32 バイト以上）。**実値はコードにもドキュメントにも置かない。**
- Web Crypto（`crypto.subtle`）だけで実装しており、**Edge ランタイムの middleware でも検証できる**。
- ペイロードに**ロールを入れない**。権限は毎回サーバー側で引く。
- 次のいずれも「未認証」として扱う: 署名不一致 / `exp` 超過 / 形式不正（旧平文 Cookie を含む）/ 鍵未設定。
- 鍵を変えると全セッションが失効する（ローテーション手段を兼ねる）。

### Cookie（`src/lib/auth/session.ts`）

| 属性 | 値 |
|---|---|
| 名前 | `cxm_session` |
| `HttpOnly` | あり（クライアント JS から読めない。自分の名前は `GET /api/user/profile` を 1 回引く） |
| `SameSite` | `Lax` |
| `Secure` | **production のみ付与**（localhost の http では落ちるため） |
| `Path` | `/` |
| 有効期限 | 7 日。`Max-Age` と `Expires` の両方を明示 |

### middleware（`src/middleware.ts`）

```
matcher: '/((?!_next/static|_next/image|favicon.ico).*)'
```

- **API も既定でセッション必須。** 未認証は `{"error":"unauthenticated"}` の **JSON 401**
  （HTML リダイレクトを返すと fetch が壊れるため）。
- Cookie を要求しないのは次の allowlist だけ。どちらも**ハンドラ側に別の認証がある**。

  | プレフィックス | なぜ Cookie 不要か | 代わりの認証 |
  |---|---|---|
  | `/api/auth/` | ログインの入口。まだ Cookie が無い | ハンドラでメール＋パスワードを照合 |
  | `/api/batch/` | Vercel Cron と外部バッチが `Authorization: Bearer` で来る | 全 19 本が `checkCronOrBatchAuth` / `checkBatchAuth` / `requireBatchTokenOrOps` を持つ |

- `/login` は常に通過。ただし有効なセッションがあれば **`/apps`**（プロダクト選択）へリダイレクト。
- それ以外のページは、セッションが無効なら `/login` へリダイレクトし、残っている Cookie を削除する。
- **middleware だけに頼らない。** 書き込み系と運用系はハンドラ側でも認可する（下記）。

### 認可ヘルパー（`src/lib/auth/guard.ts`）

```ts
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;   // 401 か 403
  const { profile } = gate;             // 検証済みプロファイル
}
```

| 関数 | 許可 |
|---|---|
| `requireUser()` | ログイン済み全員 |
| `requireRole(...roles)` | 指定ロール |
| `requireAdmin()` | admin |
| `requireOpsOrAdmin()` | admin / ops |
| `requireManagerOrAbove()` | admin / ops / manager |
| `requireBatchTokenOrOps(req)` | Bearer（`SUPPORT_BATCH_SECRET`）または admin/ops セッション |
| `requireCronTokenOrOps(req)` | Bearer（Cron/Batch）または admin/ops セッション |

**ロールは必ず `staff_identify.role` から引く。** Cookie の自己申告値は使わない。
区分ごとの適用状況は [security-api-inventory.md](../security-api-inventory.md) が正本。

### ログイン（`POST /api/auth/login`）

2 段階のパスワード照合:

1. `staff_identify.password_hash` が設定済み → **そのハッシュだけで判定**（個別パスワードを設定した人は共有パスワードでは入れない）。
2. 未設定 → 共有パスワード **`APP_PASSWORD`**（移行のための経過措置）。

**`APP_PASSWORD` は環境変数のみで管理する。コードにもドキュメントにも実値を置かない。**
未設定のときは共有パスワード経路を成立させず、秘密値を含まないサーバーログを残して **503** を返す
（旧実装はソースに既定値を直書きしていた。2026-09-30 に撤去）。
`CXM_SESSION_SECRET` が未設定のときも同様に 503（平文へフォールバックしない）。

ハッシュは Node 標準 `scrypt`（`src/lib/auth/password.ts`）。保存形式 `scrypt$N$r$p$<salt b64url>$<hash b64url>`（N=16384, r=8, p=1, keylen=32）。最低 10 文字。
ユーザーの存在有無を漏らさないため、失敗メッセージは常に「メールアドレスまたはパスワードが違います」。

### ログアウト（`POST /api/auth/logout`）

`cxm_session` と、旧 `cxm_user_uid` / `cxm_user_role` をまとめて削除する。

`DELETE /api/user/session` も同じ結果になる（セッション削除用として存続）。
同エンドポイントの **`POST` は廃止済み**。パスワード照合なしに任意ユーザーの Cookie を発行でき、
middleware が `/api/*` を素通ししていたため未認証で到達できたため。

### ロール（`src/lib/auth/role.ts`）

`admin` / `manager` / `ops` / `csm` / `viewer`。

`canAccess(route, role)` は**旧 UI のメニュー出し分け専用**。**認可には使わない**
（サーバー側の判断者は `guard.ts` だけ）。
**v2 画面は現時点でロールによる出し分けをしていない**（設定画面がロールを表示するだけ）。

### まだ無いもの

- **企業単位・組織単位のデータ分離。** ログインすれば全ユーザーが全企業を読み書きできる。
- 監査ログ（`audit_logs` テーブルはあるが認可失敗を記録していない）。

## 6. レンダリング戦略

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

## 7. 環境変数（v2 の稼働に関わるもの）

キー名の一覧は**リポジトリの `.env.example` が正本**。`cp .env.example .env.local` して値を埋める。
キーを増やしたら `.env.example` にも追記してコミットすること（未設定でもエラーにならず静かに無効化されるため、
書いておかないと他のメンバーは増えたことに気づけない）。

| 変数 | 用途 |
|---|---|
| `NOCODB_API_TOKEN` / `NOCODB_BASE_URL` | NocoDB アクセス |
| `NOCODB_*_TABLE_ID`（約 45 本） | テーブル ID。**未設定のテーブルは機能ごと graceful degradation**（例: `NOCODB_PROPOSAL_OUTLINES_TABLE_ID` 未設定なら骨子の保存ボタンを出さない） |
| `NOCODB_CHURN_RADAR_{STATE,EVENTS,VOICE}_TABLE_ID` | 解約レーダー（2026-09 追加）。**未設定だと `/v2/radar` が静かに空になる** |
| `OPENROUTER_API_KEY` / `ANTHROPIC_MODEL` | LLM（既定 `anthropic/claude-sonnet-4-5`） |
| `OPENAI_API_KEY` | 解約レーダーの言質抽出（`voice-run.ts`）と旧サポート系 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob（AI チャット履歴・AI 設定） |
| `CXM_SESSION_SECRET` | **セッション署名鍵（必須）。32 バイト以上。未設定だとログインが 503 になり、既存セッションもすべて無効** |
| `APP_PASSWORD` | 共有パスワード（経過措置）。**既定値は持たない。未設定なら共有パスワードでは入れない** |
| `CRON_SECRET` / `SUPPORT_BATCH_SECRET` | バッチ認証。**production では未設定だと 503 で拒否**する。開発時のみスキップ（警告つき） |
| `TOKEN_NOTION` (+ `TOKEN_NOTION_2`) | Notion What管理カタログ |
| `TOKEN_INTERCOM` | Intercom（サポート同期） |
| `SALESFORCE_*` | Salesforce（v2 画面からは未使用） |
