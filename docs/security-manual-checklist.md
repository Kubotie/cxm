# セキュリティ是正 — 手動作業チェックリスト

Claude Code 側では実行していない作業。**上から順に**実施すること。
`CXM_SESSION_SECRET` を Vercel に設定するまで、デプロイしても**誰もログインできない**（ログインは 503）。

> **Twenty 連携の開始可否**
> コード上の前提条件（署名付きセッション / API 認証ゲート / サーバー側 RBAC /
> 既定パスワードの撤去 / バンドルからの秘密撤去 / 型チェック・ビルド）は満たしている。
> ただし実際に着手できるのは、**A の環境変数設定と B の Preview 検証が完了したあと**。
> それまでは本番が動作しないため、連携の検証もできない。

---

## 実施状況（2026-09-30 時点）

| セクション | 状態 |
|---|---|
| A. 環境変数の設定 | ✅ **完了**（Vercel CLI で設定済み） |
| B. Preview での動作確認 | ✅ **完了**（結果は下記） |
| C. 本番反映 | ✅ **完了**（2026-09-30。`cxm-85odn1gcd`。検証結果は下記） |
| D. セッション失効 | ✅ 完了（反映時に自動。全員が再ログインになる） |
| E. 外部 API キーのローテーション | ⏳ 判断待ち |
| F. Git 履歴・公開リポジトリ | ⏳ 判断待ち |

新しい秘密値は **`SECRETS-HANDOVER.local.md`**（.gitignore 済み）に置いてある。
**1Password へ移したら削除すること。**

---

## A. デプロイ前（必須・この順で）

- [x] **1. `CXM_SESSION_SECRET` を生成して Vercel に設定する**（Production / Preview / Development）
      ✅ 完了。**環境ごとに別の値**にしてある（Preview のセッションで Production には入れない）
      ```bash
      node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
      ```
      ```bash
      npx vercel env add CXM_SESSION_SECRET production
      ```
      未設定だとログインが 503 になる。**これを忘れると全員が入れない。**

- [x] **2. 共有パスワードを変更し、`APP_PASSWORD` を Vercel に設定する**
      ✅ 完了。Production と Preview に同じ新しい値を設定済み（値は `SECRETS-HANDOVER.local.md`）
      旧パスワードはソースに直書きされており、**public リポジトリの Git 履歴に残っている**。
      必ず別の値にすること。
      ```bash
      node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
      ```
      ```bash
      npx vercel env add APP_PASSWORD production
      ```
      - [ ] 新しい値を 1Password に登録し、メンバーへ共有する ← **残作業**
      - [ ] チャットやメールに平文で貼らない
      - [ ] `SECRETS-HANDOVER.local.md` を削除する ← **残作業**

- [x] **3. `SUPPORT_BATCH_SECRET` / `CRON_SECRET` が Production に設定済みか確認する**
      ✅ 両方 Production に設定済み（既存値は**変更していない**ので DolphinScheduler 等はそのまま動く）。
      Preview にも新しい値を追加し、Preview でも fail-closed を検証できるようにした
      本是正で、production では**未設定だと 503 で拒否**するようになった（旧実装は素通し）。
      ```bash
      npx vercel env ls | grep -E "SUPPORT_BATCH_SECRET|CRON_SECRET"
      ```

- [x] **4. `NEXT_PUBLIC_SUPPORT_BATCH_SECRET` が Vercel に存在しないことを確認する**
      ✅ `NEXT_PUBLIC` を含む変数は **0 件**
      存在したら削除する。`NEXT_PUBLIC_` はクライアントバンドルに焼き込まれる。
      ```bash
      npx vercel env ls | grep NEXT_PUBLIC
      ```

---

## B. 動作確認（Vercel Preview）— ✅ 完了

Preview: `https://cxm-oo8um4fwo-kuboties-projects.vercel.app`（2026-09-30）

- [x] 5. ログイン
      - [x] 新しい共有パスワードでログイン → 200（`name2=Kubotie` / `role=admin`）
      - [x] 誤ったパスワード → 401
      - [x] ログアウト → 200
      - [x] Cookie 属性を実測: `Path=/` `Max-Age=604800` `Expires` `SameSite=Lax` `HttpOnly` **`Secure`**
      - [x] 旧 `cxm_user_uid` / `cxm_user_role` が `Max-Age=0` で削除される
- [x] 5-2. なりすまし防止
      - [x] 旧平文 Cookie だけを送る → **401**
- [x] 5-3. CXM 画面: `/apps` `/v2` `/v2/readiness` `/v2/radar` `/v2/tier3` `/v2/settings` すべて 200。サイドバーに PGA 切替も表示
- [x] 5-4. PGA: `/ptai-pipeline` 200（ボード DOM 4/4）・`board.js` 200・`/api/ptai/raw` 200（**125 社**）・`/api/ptai/db` 200
      - [x] 書き込み（PUT）→ 200、削除（DELETE）→ 200。件数が元に戻ることを確認
      - [x] `/api/ptai/me` → `isOwner:false`（Kubotie は承認者ではない＝期待どおり）
- [x] 5-5. Ops の RBAC
      - [x] admin: `/api/ops/batch-logs` `/api/ops/sf-data-prep/report` `/api/ops/ai-config` すべて 200
      - [x] **csm（BB）: `/api/ops/batch-logs` `/api/ops/ai-config` ともに 403**
      - [x] csm でも一般 API（`/api/nocodb/companies`）は 200
      - [x] ops 画面 `/ops/batch-logs` が **Authorization ヘッダーなし**で 200
- [x] 5-6. Cron
      - [x] 正しい Bearer → 200 / 誤った Bearer → 401 / Bearer なし → 401
- [x] 5-7. 外部バッチ
      - [x] 正しい Bearer → 200 / 誤った Bearer → 401
      - [x] admin セッション → 200 / **csm セッション → 403**
- [x] 6. 未認証で顧客データが取れない
      - [x] `/api/nocodb/companies` → **401**（`{"error":"unauthenticated"}`）
      - [x] `/v2` → 307 `/login`
      - [x] `/ptai-pipeline/board.js` → 307 `/login`
      - [x] `/api/ptai/raw` → 401

## C. 本番反映 — ✅ 完了（2026-09-30）

デプロイ: `cxm-85odn1gcd-kuboties-projects.vercel.app` → `https://cxmx.vercel.app`

- [x] 7. 本番反映の承認
- [ ] 8. **全員が再ログインになることを事前に周知する** ← **残作業（最優先）**
      → 文面は [security-rollout-notice.md](./security-rollout-notice.md)（A: 事前告知 / B: 実施直後 / C: 個別パスワード案内 / D: 技術メンバー向け）
      **すでに反映済みなので、テンプレート B（実施直後）から送ること。**
- [x] 9. 本番デプロイ
- [x] 10. 本番の未認証チェック — **是正前は 200 で顧客データが返っていたものが、すべて 401 になった**

      | エンドポイント | 是正前 | 是正後 |
      |---|---|---|
      | `/api/nocodb/companies` | 200（19KB） | **401** |
      | `/api/companies/proposal-board` | 200（192KB） | **401** |
      | `/api/company-summary-list` | 200（114KB） | **401** |
      | `/api/home/digest` | 200 | **401** |
      | `/api/ptai/raw` | 401 | 401 |
      | `/apps` `/v2` `/ptai-pipeline` `/ptai-pipeline/board.js` `/ops/batch-logs` | — | **307 → /login** |

- [x] 10-2. ログイン
      新しい共有パスワード → 200（`Kubotie` / `admin`）／誤ったパスワード → 401／
      旧平文 Cookie のみ → **401**／Cookie 属性に **`Secure`** あり、旧 Cookie は `Max-Age=0` で削除
- [x] 10-3. CXM 画面: `/apps` `/v2` `/v2/readiness` `/v2/radar` `/v2/tier3` `/v2/projects` `/v2/settings` すべて 200
- [x] 10-4. PGA: ボード 200（DOM 4/4・**126 社**表示）／`board.js` 200／RAW 200（125 社）／
      共有 DB 200（edits 104 ほか）／**6 秒ポーリングがブラウザで継続動作**／コンソールエラーなし
- [x] 10-5. Ops の RBAC: admin は 4 本とも 200、**csm は 3 本とも 403**、csm でも一般 API は 200
- [x] 10-6. バッチ認証: Bearer なし → **401**（503 ではない＝ production に secret が入っている）／
      誤った Bearer → 401／admin セッション → 200／**csm セッション → 403**
- [ ] 11. **Vercel Cron が翌日正常に動いたか `/ops/batch-logs` で確認する** ← **残作業**
      （churn-radar は 20:00 UTC。fail-closed 化したので、secret の取り違えがあると 503 になる）
- [ ] 12. **DolphinScheduler など外部バッチが 401/503 になっていないか確認する** ← **残作業**
      （production の `SUPPORT_BATCH_SECRET` は変更していないので、そのまま動くはず）

## D. 現在有効なセッションの失効

- [ ] 13. 特別な操作は不要。**Cookie 名が `cxm_user_uid` → `cxm_session` に変わるため、
      デプロイ時点で既存セッションはすべて無効になる。** 旧 Cookie はログイン・ログアウト時に削除される
- [ ] 14. 途中で `CXM_SESSION_SECRET` をローテーションしたい場合も、値を変えるだけで全セッションが失効する

---

## E. 外部 API キーのローテーション（必要に応じて判断）

Git 履歴に露出した形跡は無いが、期間が長い場合は棚卸ししておくとよい。

- [ ] 15. `NOCODB_API_TOKEN`
- [ ] 16. `TOKEN_NOTION` / `TOKEN_NOTION_2`
- [ ] 17. `TOKEN_INTERCOM`
- [ ] 18. `OPENROUTER_API_KEY` / `OPENAI_API_KEY`
- [ ] 19. `SALESFORCE_CLIENT_SECRET`
- [ ] 20. `BLOB_READ_WRITE_TOKEN`

---

## F. Git 履歴と公開リポジトリ

詳細と実行手順は [public-repository-remediation.md](./public-repository-remediation.md) §3。

- [ ] 21. **GitHub の Secret scanning と Push protection を有効にする**
      Settings → Code security → Secret scanning / Push protection（public リポジトリは無料）
- [ ] 22. Dependabot alerts も有効にする
- [ ] 23. Git 履歴に残った共有パスワードへの対応を決める
      → A-2 で値を変えていれば実害は消える。履歴書き換えを行うかは別途判断
- [ ] 24. Git 履歴に残った実顧客 100 社の Salesforce Account ID への対応を決める
      → 現 HEAD からは削除済み。履歴を書き換えるかは業務判断
- [ ] 25. `docs/current-state-audit.md` を commit する前に、実顧客名を匿名化する
      （本セッションでは保護対象のため触っていない）
- [ ] 26. `docs-src/cxm_v2/15〜18_*.md`（未コミット）に実顧客情報が無いか確認してから commit する
- [ ] 27. `docs-src/cxm_v2/19_Churn_Radar_Design.md` に残る**顧客発言の引用**を public に置き続けるか判断する
      （社名は匿名化済み。原文が必要なら社内 Notion へ移す）

---

## G. 積み残し（Twenty 連携より前に決めたいもの）

- [ ] 28. `scripts/.bulk-targets.json`（実顧客 100 社の UID）をメンバー間でどう共有するか決める
- [ ] 29. 企業単位・組織単位のデータ分離を入れるか決める
      → 現状はログインすれば全ユーザーが全企業を読み書きできる
- [ ] 30. `/api/batch/*` の共有シークレットを実行者ごとに分けるか決める
- [ ] 31. 認可失敗・同期失敗の監査ログ（`audit_logs` テーブルは存在するが未使用）を入れるか決める
- [ ] 32. CI（型チェック＋ビルド＋secret scan）を入れるか決める
      → 案は public-repository-remediation.md §4-3
