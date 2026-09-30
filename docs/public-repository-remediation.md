# public リポジトリ衛生対策 — 実施内容と、履歴に残ったものへの手順

- 作成日：2026-09-30
- 前提：**リポジトリ `Kubotie/cxm` は public のまま運用する**（private 化はしない方針）
- 原則：秘密情報と実顧客情報を **追跡対象ファイルに置かない**。必要な値は環境変数か gitignore 済みのローカルファイルへ
- 本書には秘密値も顧客本文も転記していない（種類とファイルパスのみ）

---

## 1. 今回実施したこと

### 1-0. 検証の範囲について

本書と [security-api-inventory.md](./security-api-inventory.md) に記載した件数は、
**静的解析（追跡ファイルの機械的な走査）とローカル dev サーバーでの動作確認**に基づく。
**本番環境では未検証**（本番への未認証プローブは実施していない）。
デプロイ後に [security-manual-checklist.md](./security-manual-checklist.md) B-6 の確認を行うこと。

### 1-1. ソース直書きの共有パスワードを撤去

| 対象 | 内容 |
|---|---|
| `src/app/api/auth/login/route.ts` | `process.env.APP_PASSWORD ?? '<既定値>'` の**既定値を削除**。未設定なら共有パスワード経路を成立させず 503 |
| `src/app/api/user/password/route.ts` | 同上。初回設定（共有パスワードでの本人確認）が 503 になる。個別パスワード設定済みのユーザーは影響なし |
| `ONBOARDING.md` | 既定値を明記していた 2 箇所を削除し、「`APP_PASSWORD` は環境変数のみ。コード・ドキュメントに実値を置かない」に置換 |
| `docs/v2-architecture/01-runtime-and-auth.md` | 同上（§5 を全面改訂） |
| `docs/v2-architecture/10-constraints.md` | 同上 |

追跡ファイル全体を再走査し、**旧共有パスワードの記載は 0 件**であることを確認した（値は本書に転記していない）。

既定値は **すでに公開履歴に残っている**ため、値そのものの無効化が必要。→ §3 と手動チェックリスト。

### 1-2. ブラウザへ露出していたバッチシークレットの撤去

`NEXT_PUBLIC_*` はクライアントバンドルに焼き込まれる。参照を 3 ファイルから削除した。

| 対象 | 変更 |
|---|---|
| `src/components/pages/batch-logs.tsx` | `Authorization: Bearer` を廃止し `credentials: 'same-origin'` に |
| `src/components/pages/company-mutation-logs.tsx` | 同上 |
| `src/components/pages/company-summary-ops.tsx` | 同上 |
| `src/lib/auth/guard.ts` | `requireBatchTokenOrOps()` を新設。サーバー側で ops/admin ロールを検証 |

ビルド後の `.next/static` を走査し、`SUPPORT_BATCH_SECRET` / `CXM_SESSION_SECRET` / `APP_PASSWORD` /
`CRON_SECRET` の値が **0 件**であることを確認済み。

### 1-3. 実顧客の Salesforce Account ID をソースから排除

| 対象 | 内容 |
|---|---|
| `scripts/bulk-company-summary.mjs` | **実顧客 100 社の SF Account ID がハードコードされていた**。`scripts/.bulk-targets.json`（gitignore 済み）から読むよう変更し、`--targets=<path>` でも指定可に。読めないときは明示エラーで終了 |
| `src/lib/nocodb/project-info.ts`, `src/lib/nocodb/types.ts` | コメントの書式例に実 ID らしき値。`sf_001EXAMPLE0000001` 形式のダミーへ置換 |
| `docs-src/cxm_v2/07_AI_Proposal_Schema.md`, `app-vite/docs/07_AI_Proposal_Schema.md` | JSON スキーマ例の `company_uid`。同上 |

### 1-4. 実顧客名の匿名化

コード上の**コメント**と設計書に実名が入っていた。設計の根拠（なぜそのルールなのか）は
残す価値があるので、**文脈はそのままに社名だけを匿名化**した。

| 置換前の種類 | 置換後 | 対象ファイル |
|---|---|---|
| 製造業 Tier1 の解約顧客名（13 箇所超） | `A社` | `docs-src/cxm_v2/19_Churn_Radar_Design.md`, `src/lib/churn/radar-rules.ts`, `src/lib/churn/radar-input.ts`, `src/lib/churn/voice-run.ts`, `src/lib/churn/churn-report.ts`, `src/lib/prompts/churn-voice.ts`, `src/app/api/batch/churn-voice/route.ts`, `src/app/api/ops/radar-backtest/route.ts` |
| Tier3 顧客名 | `B社` | `src/app/(cxm)/v2/companies/[companyUid]/view.tsx`, `src/lib/churn/churn-report.ts`, `docs-src/cxm_v2/19_Churn_Radar_Design.md` |
| 大手人材企業名 | `C社` | `src/lib/company/super-login.ts` |
| 上記 A社 の SF Account ID | `sf_XXXXXXXXXXXXXXXXXX` | `src/app/api/ops/radar-backtest/route.ts`, `docs-src/cxm_v2/19_Churn_Radar_Design.md` |

置換後、追跡ファイル全体を再走査して **残存 0 件**を確認した。

**判断が必要で手を付けなかったもの**

| ファイル | 種類 | 論点 |
|---|---|---|
| `docs-src/cxm_v2/19_Churn_Radar_Design.md` | 顧客の**発言の引用**（議事録から。日付つき） | 社名を消したので個社の特定はできなくなったが、発言そのものを public に置き続けるかは業務判断。原文が必要なら社内 Notion へ移し、本書からは要約に置き換えることを推奨 |
| `docs/current-state-audit.md` | 同上（本セッションで作成、**未コミット**） | 保護対象のため触っていない。**commit する前に §1-4 と同じ匿名化を行うこと** |
| `docs-src/cxm_v2/15〜18_*.md` | 未確認（**未コミット**） | 保護対象のため走査対象外。commit 前に確認すること |

### 1-5. `.gitignore` の確認と追記

既存で押さえられていたもの：`.env` / `.env.local` / `.env.*` / `.env*.local`（`!.env.example` で例外）、
`.next/`、`*.tsbuildinfo`、`ptengine-analytics-mcp/`、`docs-src/cxm_v2/samples/`、
`public/ptai-pipeline/raw.js`（PGA の顧客スナップショット）。

今回追記：

```
# 一括実行スクリプトの対象顧客 UID（実顧客の SF ID。公開リポジトリに入れない）
scripts/.bulk-targets.json
```

`.env.example` は**キー名と生成方法だけ**を載せ、値は書いていない（走査で確認済み）。

---

## 2. 追跡ファイルの走査結果（2026-09-30 時点）

走査したパターンと結果。**検出した値そのものは本書に転記していない。**

| 種類 | パターン | 結果 |
|---|---|---|
| Notion トークン | `secret_…` / `ntn_…` | 0 件 |
| OpenAI / OpenRouter | `sk-…` / `sk-or-…` | 0 件 |
| Slack トークン | `xox[baprs]-…` | 0 件 |
| Vercel Blob | `vercel_blob_rw_…` | 0 件 |
| AWS アクセスキー | `AKIA…` | 0 件 |
| 秘密鍵 | `-----BEGIN … PRIVATE KEY-----` | 0 件 |
| Bearer リテラル | `Bearer <24文字以上>` | 0 件 |
| セッション Cookie 値 | `cxm_session=v1.…` | 0 件 |
| Salesforce Account ID | `sf_00…` / 素の 18 桁 | **是正前 117 件 → 0 件** |
| 実顧客名（3 社） | 固定文字列 | **是正前 32 件 → 0 件** |

---

## 3. Git 履歴に残った情報への対応（**実行していない。手順のみ**）

履歴の書き換えは行っていない。以下は判断・実行ともに人の作業。

### 3-1. 何が履歴に残っているか

| 種類 | 入っているコミット |
|---|---|
| 共有パスワードの既定値 | `src/app/api/auth/login/route.ts` と `src/app/api/user/password/route.ts` の全履歴 |
| 実顧客 100 社の SF Account ID | `scripts/bulk-company-summary.mjs` の全履歴 |
| 実顧客名・SF ID・議事録の引用 | `docs-src/cxm_v2/19_Churn_Radar_Design.md` ほか §1-4 のファイル群 |

`git log -p -- <path>` で確認できる。**public リポジトリなので、フォークやクローン、
GitHub のイベント API、各種ミラーにも残っている前提で考えること。**

### 3-2. 推奨順序

1. **値を無効化する（最優先・履歴書き換えより先）**
   - 共有パスワードを変更する（→ 手動チェックリスト）
   - Salesforce Account ID は**無効化できない**ので、履歴削除か「公開されている前提での運用」を選ぶ
2. **これ以上増やさない**
   - §4 の secret scanning を有効にする
3. **履歴の書き換えを行うか決める**
   - public リポジトリでは、書き換えても既にクローンした人の手元からは消えない
   - 実行するなら以下。**全員の作業を止めて調整してから**

```bash
# 参考手順（未実行）。必ずバックアップを取ってから
git clone --mirror https://github.com/Kubotie/cxm.git cxm-mirror.git
cd cxm-mirror.git

# git-filter-repo（推奨。git filter-branch より安全・高速）
pipx install git-filter-repo

# (a) ファイルごと履歴から消す場合
git filter-repo --invert-paths --path scripts/.bulk-targets.json

# (b) 文字列を置換する場合（replacements.txt に literal:<旧>==><新> を並べる）
#     replacements.txt 自体もリポジトリに置かないこと
git filter-repo --replace-text replacements.txt

git push --force --mirror
```

4. **書き換え後にやること**
   - 全員がクローンし直す（`git pull` では追随できない）
   - オープンな PR は作り直し
   - GitHub サポートにキャッシュ済みビューの削除を依頼する
   - タグ・リリースの再作成

### 3-3. 書き換えない場合の代替

| 対象 | 代替策 |
|---|---|
| 共有パスワード | 値を変更すれば履歴のものは無意味になる。全員を個別パスワードへ移行し `APP_PASSWORD` を廃止すれば根本解決 |
| SF Account ID | 単独では Salesforce にアクセスできない（認証は別）。「社名と紐づく識別子が公開されている」リスクとして受容するか判断する |
| 顧客名・議事録の引用 | 現在の HEAD からは消えている。履歴にアクセスするには意図的な操作が要るため、リスクは下がっている |

---

## 4. secret scanning の導入案（未実行・新規依存なし）

### 4-1. GitHub 側（推奨・最優先。コード変更ゼロ）

public リポジトリなら **GitHub Secret Scanning と Push Protection を無料で使える**。

- Settings → Code security → **Secret scanning** を Enable
- **Push protection** も Enable（コミットを push する時点で弾く）
- Settings → Code security → **Dependabot alerts** も同時に

### 4-2. pre-commit（依存を増やさない版）

`gitleaks` や `detect-secrets` を入れる手もあるが、まずは**追加依存ゼロ**で足りる。
`.git/hooks/pre-commit`（リポジトリには入らない）か、`scripts/` に置いて各自が設定する。

```bash
#!/bin/sh
# 追加ステージ分だけを走査する。ヒットしたらコミットを中止
if git diff --cached -U0 | grep -nE \
  'secret_[A-Za-z0-9]{30,}|ntn_[A-Za-z0-9]{30,}|sk-(or-)?[A-Za-z0-9-]{30,}|xox[baprs]-|vercel_blob_rw_|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|sf_00[0-9A-Za-z]{15,16}' \
  >/dev/null; then
  echo "秘密情報または実顧客 ID らしき文字列が含まれています。コミットを中止しました。"
  echo "意図的な場合のみ --no-verify を使ってください。"
  exit 1
fi
```

導入するなら、この内容を `scripts/pre-commit.sample` として置き、
README に `ln -s ../../scripts/pre-commit.sample .git/hooks/pre-commit` を書くのが軽い。

### 4-3. CI（`.github/workflows/` は現在存在しない）

CI が無いので、まず「型チェックとビルドだけ」の最小ワークフローから始めるのがよい。
その中に上と同じ走査を 1 ステップ足せば、追加サービスなしで secret scanning になる。

```yaml
# .github/workflows/ci.yml（案・未作成）
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit -p tsconfig.json
      - run: npm run build
        env:
          CXM_SESSION_SECRET: ${{ secrets.CXM_SESSION_SECRET }}
      - name: secret scan
        run: |
          ! grep -rInE 'secret_[A-Za-z0-9]{30,}|sk-(or-)?[A-Za-z0-9-]{30,}|xox[baprs]-|AKIA[0-9A-Z]{16}|sf_00[0-9A-Za-z]{15,16}' \
            --exclude-dir=node_modules --exclude-dir=.next .
```

**新しい依存は追加していない。** 上記はいずれも提案であり、本セッションでは作成していない。

---

## 5. 運用ルール（public 前提）

1. **顧客データはコードに書かない。** 一覧・ID・氏名・議事録は NocoDB か gitignore 済みのローカルファイルへ
2. **秘密は環境変数のみ。** `NEXT_PUBLIC_` を付けた時点でブラウザに出ると考える
3. **コメントに実名を書かない。** 設計の根拠は「A社（Tier1・製造業）」のように匿名で書けば十分に伝わる
4. **`.env.example` にはキー名と生成方法だけ。** 新しいキーを足したら必ず追記する
5. **スナップショット・出力物は `.gitignore` に入れてから作る**
