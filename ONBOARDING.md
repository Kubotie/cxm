# CXM 共同開発オンボーディング

対象: 新しく参加するメンバー（Leo）と、受け入れる側（窪田）
最終更新: 2026-09-30

このファイルは「参加初日に必要な情報」だけを置く。
アプリの中身の設計は [docs/v2-architecture/](docs/v2-architecture/00-overview.md) を読むこと。

---

## 0. このリポジトリは public です（最重要）

`Kubotie/cxm` は **public リポジトリのまま運用する**方針です（2026-09-02 決定）。
つまり **push した瞬間に誰でも読める**ので、次を必ず守ってください。

### コミットしてはいけないもの

| 種別 | 例 | 状態 |
|---|---|---|
| 実顧客データ | 企業名 × MRR × 準備度スコア × 解約検討の背景、SF ID、担当者名 | `docs-src/cxm_v2/samples/` と `17_WHO_WHAT_Matching_Plan.md` は**未追跡のまま**にしてある。共有は Slack/Notion 等リポジトリ外で |
| 認証情報 | `.env` / `.env.local` / API トークン | `.gitignore` 済み |
| 社内 MCP | `ptengine-analytics-mcp/`（154MB・秘密情報を含む） | `.gitignore` に追加済み |
| 一時スクリプト | `w.mts` | `.gitignore` に追加済み |

迷ったら**コミットする前に窪田に聞く**。public では取り消しが効きません（履歴に残る）。

### 既に公開されているもの（把握しておくこと）

- NocoDB のホスト名とテーブル ID の既定値（`src/lib/nocodb/client.ts`）
- Metabase の**認証不要 public question の CSV URL**（`src/lib/metabase/*.ts`）
- **共有パスワードの既定値がソースに直書きされていた**（`src/app/api/auth/login/route.ts`）。
  2026-09-30 の是正で**既定値は撤去済み**だが、**Git 履歴には残っている**。
  → 値そのものを変更し、`APP_PASSWORD` を Vercel 側で設定すること（`docs/security-manual-checklist.md` A-2）。
  → **`APP_PASSWORD` は環境変数のみ。コードにもドキュメントにも実値を書かない。**
- **実顧客 100 社の Salesforce Account ID**（`scripts/bulk-company-summary.mjs`）。
  2026-09-30 に gitignore 済みファイルへ退避したが、**Git 履歴には残っている**。
- 解約レーダーの設計書（`docs-src/cxm_v2/19_Churn_Radar_Design.md`）と `src/lib/churn/**` のコメントに
  実在企業名・SF ID・発言の引用が含まれていた。**2026-09-30 に匿名化済み**（履歴には残る）。
  → 今後コメントに実例を書くときは、企業名を伏せるか社内ドキュメント側に置くこと

対応状況と手順は [docs/public-repository-remediation.md](docs/public-repository-remediation.md) を参照。

### 残っている準備作業（窪田）

| # | 状態 | やること |
|---|---|---|
| 1 | Leo の GitHub アカウント名が未共有 | collaborator に追加（現在は `Kubotie` のみ）。public でも **push には collaborator 権限が必要** |
| 2 | `.DS_Store` と `cxm_v2.zip` が追跡されている | `git rm --cached` で外す（10 章にコマンド） |
| 3 | `app-vite/`(314ファイル)・`figma-ui/`(207ファイル) が残骸として同居 | 別リポジトリへ移すか削除の判断 |
| 4 | リモート名が `neworigin` のみ（`origin` が無い） | `origin` にリネーム推奨。このファイルは `origin` 前提で書いてある |

> ✅ v2 のコードは 2026-09-02 に `main` へマージ済み（それまでローカルのみでバックアップが無い状態でした）。

---

## 1. これは何のアプリか

Ptengine の CSM 業務用 社内 Web アプリ（CXM / 「顧客前進 OS」）。
中心の問いは 1 つ: **今この顧客に提案を持ち込んでよいか。ダメなら先に何を片付けるか。**

主動線（`/v2` 配下が CSM 向けの現行 UI）:

```
/apps          ログイン後の着地。CXM と Ptengine AI パイプラインの入口
/v2            ホーム（今日どこから手をつけるか）
/v2/readiness  提案準備ボード（誰に提案できるか / 4レーン）
/v2/companies/[companyUid]  個社ページ（顧客理解 → 判定 → 提案骨子）
/v2/projects   プロジェクト分析（契約と実利用のズレ）
/v2/radar      解約レーダー（更新前に解約の予兆を名指しする）
/v2/tier3      Tier 3 管理
/v2/settings   設定
```

`/v2` 以外（`/legacy`, `/console/**`, `/support/**`, `/ops/**` など）は旧 UI。動線からは外してあるが動く。**新規開発は `/v2` に対して行う。**

> ⚠️ **ファイルの置き場所は `src/app/(cxm)/v2/...`**（ルートグループ。URL は `/v2/...` のまま）。
> `src/app/(ptai)/` は Ptengine AI パイプラインボードで、CSS を分離するために別グループにしてある。

---

## 2. リポジトリと環境

| 項目 | 値 |
|---|---|
| GitHub | `https://github.com/Kubotie/cxm`（**public**。0 章を必ず読むこと） |
| 既定ブランチ | `main`（v2 を含む最新） |
| ホスティング | Vercel プロジェクト `cxm_x` / チーム `kuboties-projects` |
| 本番 URL | https://cxmx.vercel.app |
| Node | ローカル v22.17.1 / Vercel 24.x（`engines` 未指定 — **20 以上なら可**） |
| パッケージ管理 | **npm**（`package-lock.json` が正。pnpm/yarn を使わない） |
| フレームワーク | Next.js 15.3.9 App Router / React 18 / TypeScript 5.8 / Tailwind v4 |

外部依存（それぞれアクセス権が要る）:

| サービス | 用途 | Leo に必要か |
|---|---|---|
| NocoDB（`odtable.ptmind.ai`） | 業務データの正本 | **必須**（API トークン） |
| Metabase（`bi.ptmind.com`） | BI の CSV。public question なので認証不要 | 不要 |
| OpenRouter | LLM 呼び出し（顧客理解・提案骨子・AI パネル） | **必須**（キー。課金が走る） |
| Vercel Blob | AI チャット履歴・AI 設定 | 必須（`BLOB_READ_WRITE_TOKEN`） |
| Notion | WHAT カタログ（提案の狙い） | 提案フローを触るなら必要 |
| Intercom / Salesforce | 旧 UI 側の同期 | 当面不要 |

---

## 3. セットアップ手順（Leo）

```bash
# 1. clone
git clone https://github.com/Kubotie/cxm.git
cd cxm

# 2. 依存関係（npm 固定）
npm ci

# 3. 環境変数（下の 4 章。窪田から受け取る）
#    .env.local を置く

# 4. 開発サーバー
npm run dev        # http://localhost:3000 → /login → /apps → /v2
```

スクリプトは 4 つだけ。

| コマンド | 用途 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（型エラーはここで出る） |
| `npm run start` | ビルド結果の起動 |
| `npm run lint` | ESLint |

> ⚠️ `npm run build` の後に `npm run dev` を起動すると `.next` の混在で**古いバンドルが出る**。
> ソースと矛盾するエラーが出たら `rm -rf .next` してから起動し直す。

テストは無い（テストフレームワーク未導入）。動作確認はブラウザで `/v2` を触る。

---

## 4. 環境変数の受け渡し

`.env` / `.env.local` は `.gitignore` 済み。**Slack や DM に貼らない。**

Vercel は Hobby プランでメンバー招待ができないため、**Leo は Vercel を使わない**（下の 6 章）。
`.env.local` は 1Password などの安全な経路で窪田から受け取る。

> 窪田側で最新を書き出す場合: `npx vercel env pull .env.local`

**キー名の一覧はリポジトリの `.env.example` が正本です。**

```bash
cp .env.example .env.local   # そのあと値を埋める
```

機能追加でキーが増えたときは `.env.example` にも追記してコミットしてください。
NocoDB のテーブル ID は**未設定でもエラーにならず、その機能だけ静かに無効化される**ので、
ここに書いておかないと他のメンバーは増えたことに気づけません（実際に解約レーダーで起きました）。

最低限これが無いと `/v2` が動きません: `NOCODB_API_TOKEN` / `NOCODB_BASE_URL` / `OPENROUTER_API_KEY` / `BLOB_READ_WRITE_TOKEN` / 各 `NOCODB_*_TABLE_ID`（約 45 本）。
`TOKEN_INTERCOM` と `SALESFORCE_*` は旧 UI 用で、無くても v2 は動きます。

> ⚠️ **`CXM_SESSION_SECRET` が無いとログインできません**（ログインは 503 を返す）。
> 32 バイト以上のランダム値を `.env.local` に入れてください。生成例:
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
>
> ⚠️ `APP_PASSWORD` が未設定だと、個別パスワード未設定のユーザーはログインできません
> （共有パスワードの既定値は**持っていません**）。
>
> ⚠️ `CRON_SECRET` と `SUPPORT_BATCH_SECRET` が両方未設定だと、**ローカルでは**バッチ認証がスキップされます。
> **production（`VERCEL_ENV=production`）では 503 で拒否**されるので、公開環境では必ず設定してください。

### 認証のしくみ（2026-09-30 改訂）

- セッションは Cookie **`cxm_session`** に入る **HMAC-SHA256 署名付きトークン**。
  署名鍵は `CXM_SESSION_SECRET`。改ざん・期限切れ・鍵未設定はすべて未認証として扱う。
- 旧 **`cxm_user_uid` / `cxm_user_role` は廃止済み**。送っても認証には使われない。
- **ロールは Cookie に入れない。** 認可のたびに `staff_identify` から引く。
- **`/api/*` は原則すべて署名済みセッションが必要。** 例外は `/api/auth/*` と `/api/batch/*` だけで、
  後者は `Authorization: Bearer` で認証する。
- 書き込み系・運用系は `src/lib/auth/guard.ts`（`requireUser` / `requireOpsOrAdmin` / `requireAdmin` ほか）で
  ハンドラ側でも認可する。
- 詳細は [docs/v2-architecture/01-runtime-and-auth.md](docs/v2-architecture/01-runtime-and-auth.md) §5、
  ルート単位の区分は [docs/security-api-inventory.md](docs/security-api-inventory.md)。

---

## 5. ブランチ・コミット・PR の運用

### ブランチ

```
main                          … 常にデプロイ可能な状態
feat/<領域>-<短い説明>         … 機能追加
fix/<領域>-<短い説明>          … 修正
```

- `main` に直接 push しない。PR 経由にする。
- 1 PR = 1 目的。v2 は 1 ファイルが 2,000 行級のものがあるので、**大きな PR は必ずコンフリクトする**（8 章参照）。

### コミットメッセージ

既存の履歴に合わせる。**Conventional Commits + 日本語の本文**:

```
fix(communications): CSE も未クローズ枠を確保し、長期滞留を区別して出す
feat(settings): v2設定画面 + アカウント単位のAI設定/パスワード変更
chore(deploy): add .vercelignore (exclude MCP with secrets, docs, .claude)
```

scope は領域名（`readiness` `communications` `snapshot` `outbound` `cron` など）。
**「何をしたか」ではなく「何が変わったか / 何が直ったか」**を書く。

### PR

- タイトルはコミットと同じ書式。
- 本文に「変更前どうだったか」「実測値（あるなら）」「画面のどこで確認できるか」を書く。
- レビューは相互。設計判断が絡むものは `docs/v2-architecture/` の該当章も更新する。

### コードの書き方（このリポジトリ固有）

コメントの密度と口調は既存ファイルに合わせる。特に:

- **判定ロジックには「なぜその閾値か」を実測値付きで書く**（既存コードがすべてそうなっている）。
- **算出できない値を推定で埋めない。** `null` のまま返し、理由を UI に出す。
- 画面に出す説明文は `FACTOR_META` などの**定数側が正本**。UI に書き写さない。

---

## 6. デプロイ

- Vercel の Git 連携で、`main` への push が本番、ブランチ push がプレビュー。
- 本番の cron は `vercel.json` に 8 本（UTC 指定）。**Hobby プランでは日次 cron のみ**。
- 重いバッチ（`project-metrics` など）は社内 DolphinScheduler から叩く運用（[08-batch-and-schedule.md](docs/v2-architecture/08-batch-and-schedule.md)）。

**デプロイは窪田だけが行う**（決定 / 2026-09-02）。Vercel が Hobby プランでメンバー招待ができないため。
Leo は clone → 開発 → PR まで。マージとデプロイ後の確認は窪田が担当する。

窪田が CLI から出す場合:

```bash
npx vercel            # プレビュー
npx vercel --prod     # 本番
npx vercel logs <deployment-url> --follow
```

---

## 7. 最初に読むもの（順番どおり）

| # | ドキュメント | 何が分かるか |
|---|---|---|
| 1 | [docs/v2-architecture/00-overview.md](docs/v2-architecture/00-overview.md) | 全体像・技術スタック・設計原則 6 つ |
| 2 | [10-constraints.md](docs/v2-architecture/10-constraints.md) | **落とし穴と実測値。ここを読まずに数字を信じない** |
| 3 | [06-data-sources-and-cache.md](docs/v2-architecture/06-data-sources-and-cache.md) | NocoDB / Metabase の癖とキャッシュ階層 |
| 4 | [07-scoring-logic.md](docs/v2-architecture/07-scoring-logic.md) | 提案準備度などの計算式 |
| 5 | 触る画面の章（02 / 03 / 04 / **11**） | 画面仕様。11 は解約レーダー |
| 6 | [AGENTS.md](AGENTS.md) | データ主従（SF と CXM のどちらが正本か）と運用 SOP |

特に効く 3 つの制約:

- **NocoDB の `limit` は最大 2000。** 超えると黙って切り詰められる。全件はページング。
- **Metabase CSV は PV>0 の行しか持たない。** 「行が無い」は欠損ではなく「使っていない」。
- **重い計算はリクエスト経路に置かない。** 朝のバッチで NocoDB に落とし、画面は読むだけ。

---

## 8. 分担とコンフリクト回避

同じファイルを同時に触ると確実に揉める大物:

| ファイル | 行数 | 内容 |
|---|---|---|
| `src/app/(cxm)/v2/companies/[companyUid]/view.tsx` | 2,263 | 個社ページ全タブ + チャート |
| `src/app/(cxm)/v2/companies/[companyUid]/proposal-flow.tsx` | 1,875 | 提案骨子フロー |
| `src/app/(cxm)/v2/settings/settings-view.tsx` | 715 | 設定 |
| `src/app/(cxm)/v2/readiness/board-view.tsx` | 651 | 提案準備ボード |
| `src/lib/company/proposal-readiness.ts` | 946 | 判定ロジックの正本 |
| `src/lib/churn/radar-rules.ts` | 590 | 解約レーダーの判定（純粋関数） |

分担の目安:

- **画面担当と判定ロジック担当を分ける**（`src/app/(cxm)/v2/**` と `src/lib/{company,churn}/**`）。
- 同じ画面を触るなら、先に「どのタブ・どのセクションか」を宣言する。
- `src/lib/company/proposal-readiness.ts` と `what-matching.ts` は**判定の正本**。ここを触る PR は必ずレビューを通す。

---

## 9. 困ったときの窓口

| 症状 | 対処 |
|---|---|
| ソースと矛盾するエラー | `rm -rf .next` して `npm run dev` |
| NocoDB が 404 / 422 | 存在しない列を参照している（幻のカラム）。`src/lib/nocodb/types.ts` の実カラムを確認 |
| 画面が空・数字が古い | バッチが動いていない可能性。ホームの鮮度チップを見る |
| LLM が 400 | モデル ID が OpenRouter に存在しない。`ANTHROPIC_MODEL` を確認 |
| 権限・アクセス | 窪田（kubota@ptmind.com） |

---

## 10. 招待作業のコマンド（窪田用）

```bash
# Leo を collaborator に追加（<leo-github-id> を差し替え）
gh api -X PUT repos/Kubotie/cxm/collaborators/<leo-github-id> -f permission=push

# 追跡してしまっている不要ファイルを外す
git rm --cached .DS_Store cxm_v2.zip
git commit -m "chore: 追跡対象から .DS_Store と cxm_v2.zip を外す"

# remote 名を origin に揃える
git remote rename neworigin origin
```

public リポジトリのままにするなら、あわせて検討:

- 共有パスワードの既定値をコードから外す → **2026-09-30 に対応済み**（未設定なら 503）。
  ただし**値そのものの変更**と `APP_PASSWORD` の Vercel 設定は未実施。
- GitHub の **Secret scanning / Push protection** を有効にする（public リポジトリは無料）。

残作業は [docs/security-manual-checklist.md](docs/security-manual-checklist.md) にまとめてある。
