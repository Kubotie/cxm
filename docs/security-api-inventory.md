# API インベントリと認証・認可の区分

- 作成日：2026-09-30（Twenty 連携の前提となるセキュリティ是正の一環）
- 対象：`src/app/api/**/route.ts` 全 146 本
- 関連：[current-state-audit.md](./current-state-audit.md) §6、[public-repository-remediation.md](./public-repository-remediation.md)

---

## 0. 是正前後の要約

| | 是正前 | 是正後 |
|---|---|---|
| middleware | `if (pathname.startsWith('/api/')) return NextResponse.next();` で **API を全部素通し** | API も既定でセッション必須。通すのは allowlist の 2 プレフィックスのみ |
| 未認証で叩けた API | **92 / 146 本**（本番で顧客データが返ることを実測） | **0 本**（※ 下記の検証範囲に基づく） |
| 未認証時の応答 | 素通し → 200 で顧客データ | `{"error":"unauthenticated"}` の **JSON 401**（HTML リダイレクトにしない） |
| セッション | `cxm_user_uid` に name2 を平文保存（偽装可） | `cxm_session` に HMAC-SHA256 署名付きトークン |
| ロール判定 | `cxm_user_role` Cookie の自己申告値をフォールバックに使用 | **Cookie を使わない。** 必ず `staff_identify` から引く |
| ハンドラ側の認可 | 54 本のみ | **146 本すべてが middleware＋ハンドラのどちらかで担保**。書き込み系 39 本と Ops 10 本にはハンドラ側の判定を追加 |

> **「0 本」の根拠と範囲**
> この数字は **(a) 静的解析（全 `route.ts` の認証ヘルパー参照を機械的に走査）** と
> **(b) ローカル dev サーバーに対するスモークテスト（`scripts/security-smoke.mjs` 17 ケース）** で
> 確認した範囲のものです。**本番環境では未検証**（本番への未認証プローブは実施していません）。
> 全 146 本×全メソッドを個別に叩いたわけではないため、
> デプロイ後に `docs/security-manual-checklist.md` B-6 の確認を必ず行ってください。

### 廃止したエンドポイント

| Route | 対応 |
|---|---|
| `POST /api/user/session` | **認証なしで Cookie を発行していた POST を廃止。`DELETE` はセッション削除用として存続。** パスワード照合なしに任意ユーザーの Cookie を発行でき、middleware が `/api/*` を素通ししていたため未認証で到達できた。画面からの参照は無し |

## 1. middleware の allowlist（`src/middleware.ts`）

Cookie セッションを要求しないのは次の 2 つだけ。どちらも**ハンドラ側に別の認証がある**。

| プレフィックス | なぜ Cookie 不要か | 代わりの認証 |
|---|---|---|
| `/api/auth/` | ログインの入口。まだ Cookie が無い | ハンドラでメール＋パスワードを照合 |
| `/api/batch/` | Vercel Cron と外部バッチが `Authorization: Bearer` で来る | 全 19 本が `checkCronOrBatchAuth` / `checkBatchAuth` / `requireBatchTokenOrOps` を持つことを確認済み |

`/api/batch/*` を無条件公開にはしていない。middleware を通ったあと、**必ずハンドラでトークンかセッションを検証する**。

## 2. 認可ヘルパー（`src/lib/auth/guard.ts`）

| 関数 | 許可 | 用途 |
|---|---|---|
| `requireUser()` | ログイン済み全員 | 一般 API、書き込み系 |
| `requireRole(...roles)` | 指定ロール | 個別指定 |
| `requireAdmin()` | admin | AI 設定など |
| `requireOpsOrAdmin()` | admin / ops | 運用系・外部連携の実行 |
| `requireManagerOrAbove()` | admin / ops / manager | 運用系の閲覧 |
| `requireBatchTokenOrOps(req)` | Bearer（SUPPORT_BATCH_SECRET）または admin/ops セッション | 外部バッチと ops 画面の両方から呼ばれるもの |
| `requireCronTokenOrOps(req)` | Bearer（CRON/BATCH）または admin/ops セッション | 同上（Cron も含む） |

ロールの区分は `src/lib/auth/role.ts` の `AppRole`（admin / manager / ops / csm / viewer）に従う。
`canAccess()` は UI の出し分け専用で、**認可には使わない**（サーバー側はこのヘルパーが唯一の判断者）。

## 3. 一覧

「現在の認証」はハンドラ内で検出した代表的な仕組み。`middleware のみ` は
ハンドラに固有の判定が無く、middleware のセッション必須だけで守られているもの
（読み取り専用 GET が中心）。

<!-- このファイルは scripts で生成した内容をもとに手で補記している。ルートを増やしたら追記すること -->

### 認証API（2 本）

| Route | Methods | 現在の認証 | 必要な認証 | 必要ロール | 対応 |
|---|---|---|---|---|---|
| `/api/auth/login` | POST | `middleware のみ` | なし（入口）＋ハンドラ内で資格情報を照合 | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/auth/logout` | POST | `middleware のみ` | なし（入口）＋ハンドラ内で資格情報を照合 | ログイン済み（middleware のみ） | middleware で担保 |

### 一般ユーザーAPI（104 本）

| Route | Methods | 現在の認証 | 必要な認証 | 必要ロール | 対応 |
|---|---|---|---|---|---|
| `/api/actions` | GET | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/actions/[actionId]` | PATCH | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/actions/[actionId]/review` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/actions/ai-plan` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/ai/chat` | POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/ai/chat/threads` | DELETE,GET | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/ai/chat/threads/[threadId]` | DELETE,GET,PATCH | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/ai/prefs` | GET,PUT | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/assets` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/assets/[id]` | GET,PATCH | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/assets/[id]/categorize` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/assets/[id]/reference` | PATCH | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/assets/analyze` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/assets/tags` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/assets/upload` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/companies/[companyUid]/log` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/companies/[companyUid]/log/signals` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/companies/light-watch` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/companies/proposal-board` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/companies/tier3-dashboard` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company-summary-list` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]` | GET | `checkBatchAuth` | 署名済みセッション | —（トークン） | 既存のまま |
| `/api/company/[companyUid]/actions` | GET,POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/actions/[actionId]` | PATCH | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/actions/[actionId]/sf-push` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/campaigns` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]/communications` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]/contact-candidates` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/core` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]/external-intel` | GET,POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/external-intel/ingest` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/external-intel/research` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/people` | GET,POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/people/[personId]` | PATCH | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/people/[personId]/sf-push` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/profile` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]/proposal-intents` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]/proposal-outline` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/proposal-records` | DELETE,GET,POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/readiness` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]/sf-contacts/sync` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/sf-todos` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/situations` | GET,POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/company/[companyUid]/summary` | GET,POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/summary/regenerate` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/summary/review` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/summary/save` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/company/[companyUid]/timeseries` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/company/[companyUid]/usage` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/deck-templates` | DELETE,GET,POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/documents` | GET | `getUserUidFromCookie` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/documents/[id]` | DELETE | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/documents/generate` | POST | `getUserUidFromCookie` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/home/digest` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/home/project-signals` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/alerts` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/companies` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/cseticket-queue` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/evidence` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/inquiry-queue` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/people` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/support-alerts` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/support-case-ai-state` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/nocodb/support-queue` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/outbound/audiences` | GET,POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/outbound/audiences/[id]` | DELETE,PATCH | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/outbound/campaigns` | GET,POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/outbound/campaigns/[id]` | DELETE,PATCH | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/outbound/channels` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/outbound/debug` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/outbound/send` | POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/outbound/setup` | POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/package-events-summary` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/projects/[projectId]` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/projects/module-usage` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/radar/accuracy` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/radar/ack` | POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/radar/board` | GET | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/radar/churn-report` | GET,POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/radar/company/[companyUid]` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/radar/voice/[voiceId]` | POST | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/radar/voices` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/support/[caseId]/alert` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/[caseId]/draft-reply` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/[caseId]/summary` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/[caseId]/triage` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/ai-states` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/support/alerts/[alertId]` | PATCH | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保（501 スタブ） |
| `/api/support/cases/[caseId]` | PATCH | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保（501 スタブ） |
| `/api/support/cases/[caseId]/action` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/cases/[caseId]/ai-review` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/cases/[caseId]/ai-state` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/support/cases/[caseId]/cse-ticket` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/cases/[caseId]/dismiss` | DELETE,POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/cases/[caseId]/state` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/support/cases/bulk` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/cases/bulk-regenerate` | POST | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/support/rebuild-ai-state` | POST | `checkBatchAuth` | 署名済みセッション | —（トークン） | 既存のまま |
| `/api/support/rebuild-alerts` | POST | `checkBatchAuth` | 署名済みセッション | —（トークン） | 既存のまま |
| `/api/support/rebuild-display-fields` | POST | `checkBatchAuth` | 署名済みセッション | —（トークン） | 既存のまま |
| `/api/user/password` | GET,PUT | `getUserUidFromCookie` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/user/profile` | GET,PATCH | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/user/session` | DELETE | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |
| `/api/users` | GET | `middleware のみ` | 署名済みセッション | ログイン済み（middleware のみ） | middleware で担保 |

### 一般ユーザーAPI（PGA）（6 本）

| Route | Methods | 現在の認証 | 必要な認証 | 必要ロール | 対応 |
|---|---|---|---|---|---|
| `/api/ptai/ai` | POST | `getUserUidFromCookie` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/ptai/db` | DELETE,GET,POST,PUT | `requireUser` | 署名済みセッション | ログイン済み | 是正済み |
| `/api/ptai/mcp` | POST | `getUserUidFromCookie` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/ptai/me` | GET | `getCurrentUserProfile` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/ptai/profiles` | POST | `getUserUidFromCookie` | 署名済みセッション | ログイン済み | 既存のまま |
| `/api/ptai/raw` | GET | `getUserUidFromCookie` | 署名済みセッション | ログイン済み | 既存のまま |

### Ops専用API（14 本）

| Route | Methods | 現在の認証 | 必要な認証 | 必要ロール | 対応 |
|---|---|---|---|---|---|
| `/api/ops/ai-config` | DELETE,GET,PUT | `getCurrentUserProfile` | 署名済みセッション＋ロール | ログイン済み | 既存のまま |
| `/api/ops/ai-config/default` | GET | `getCurrentUserProfile` | 署名済みセッション＋ロール | ログイン済み | 既存のまま |
| `/api/ops/batch-logs` | GET | `requireBatchTokenOrOps` | 署名済みセッション＋ロール | admin / ops（またはバッチトークン） | 是正済み |
| `/api/ops/churn-reports` | GET | `requireManagerOrAbove` | 署名済みセッション＋ロール | admin / ops / manager | 是正済み |
| `/api/ops/churn-reports/[reportId]` | GET | `requireManagerOrAbove` | 署名済みセッション＋ロール | admin / ops / manager | 是正済み |
| `/api/ops/churn-reports/regenerate` | POST | `requireOpsOrAdmin` | 署名済みセッション＋ロール | admin / ops | 是正済み |
| `/api/ops/churn-retrospective` | GET | `requireManagerOrAbove` | 署名済みセッション＋ロール | admin / ops / manager | 是正済み |
| `/api/ops/company-mutation-logs` | GET | `requireBatchTokenOrOps` | 署名済みセッション＋ロール | admin / ops（またはバッチトークン） | 是正済み |
| `/api/ops/company-people/deduplicate` | POST | `requireOpsOrAdmin` | 署名済みセッション＋ロール | admin / ops | 是正済み |
| `/api/ops/radar-backtest` | GET | `requireOpsOrAdmin` | 署名済みセッション＋ロール | admin / ops | 是正済み |
| `/api/ops/salesforce/health` | GET | `requireOpsOrAdmin` | 署名済みセッション＋ロール | admin / ops | 是正済み |
| `/api/ops/sf-contacts/batch-sync` | POST | `requireOpsOrAdmin` | 署名済みセッション＋ロール | admin / ops | 是正済み |
| `/api/ops/sf-data-prep/report` | GET | `requireOpsOrAdmin` | 署名済みセッション＋ロール | admin / ops | 是正済み |
| `/api/ops/snapshot-progress` | GET | `requireManagerOrAbove` | 署名済みセッション＋ロール | admin / ops / manager | 是正済み |

### Vercel Cron API（8 本）

| Route | Methods | 現在の認証 | 必要な認証 | 必要ロール | 対応 |
|---|---|---|---|---|---|
| `/api/batch/churn-analysis-weekly` | GET,POST | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |
| `/api/batch/churn-radar` | — | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |
| `/api/batch/churn-voice` | — | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |
| `/api/batch/company-snapshot-light` | GET,POST | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |
| `/api/batch/company-summary-staleness` | POST | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |
| `/api/batch/intercom-reconcile` | GET,POST | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |
| `/api/batch/paid-watched-sync` | GET,POST | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |
| `/api/batch/tier-sync` | GET,POST | `checkCronOrBatchAuth` | Bearer CRON_SECRET / SUPPORT_BATCH_SECRET | —（トークン） | 既存のまま |

### 外部バッチAPI（11 本）

| Route | Methods | 現在の認証 | 必要な認証 | 必要ロール | 対応 |
|---|---|---|---|---|---|
| `/api/batch/campaign-org` | GET,POST | `checkCronOrBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/chronic-silent-sync` | POST | `checkCronOrBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/company-profile-weekly` | GET,POST | `checkCronOrBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/company-snapshot` | POST | `checkCronOrBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/company-summary` | POST | `requireBatchTokenOrOps` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | admin / ops（またはバッチトークン） | 是正済み |
| `/api/batch/company-summary-event` | POST | `checkBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/company-summary-review` | POST | `requireBatchTokenOrOps` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | admin / ops（またはバッチトークン） | 是正済み |
| `/api/batch/industry-intel-weekly` | GET,POST | `checkCronOrBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/policy-alerts` | POST | `checkBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/project-metrics` | GET,POST | `checkCronOrBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |
| `/api/batch/unified-log-signals` | POST | `checkBatchAuth` | Bearer SUPPORT_BATCH_SECRET（画面からは ops セッション） | —（トークン） | 既存のまま |

### 用途不明（1 本）

| Route | Methods | 現在の認証 | 必要な認証 | 必要ロール | 対応 |
|---|---|---|---|---|---|
| `/api/debug/support-raw` | GET | `middleware のみ` | 署名済みセッション（要確認） | ログイン済み（middleware のみ） | middleware で担保 |


---

## 4. 要確認（業務判断が必要なもの）

勝手に権限を決めず、ここに残す。現状は**安全側（ログイン必須、運用系は admin/ops）**に倒してある。

| Route | 論点 | 暫定の扱い |
|---|---|---|
| `/api/ops/churn-reports`, `/api/ops/churn-reports/[reportId]`, `/api/ops/churn-retrospective`, `/api/ops/snapshot-progress` | `role.ts` のポリシー上 manager も読める想定だったので `requireManagerOrAbove` にした。ops 限定に絞るか | manager も可 |
| `/api/ops/radar-backtest`, `/api/ops/sf-data-prep/report`, `/api/ops/salesforce/health` | `role.ts` が manager を除外している 4 ルートに準じて `requireOpsOrAdmin` | admin / ops のみ |
| `/api/debug/support-raw` | デバッグ用。本番に残す必要があるか | ログイン必須（middleware） |
| `/api/support/cases/[caseId]`, `/api/support/alerts/[alertId]` | **501 スタブ**（未実装）。実装時に `requireUser` を入れること | ログイン必須（middleware） |
| `/api/nocodb/*`（9 本） | NocoDB の生データを返す薄いプロキシ。ロール制限を付けるか | ログイン必須（middleware） |
| `/api/company/[companyUid]/**` | **担当企業かどうかの絞り込みが無い**。ログインすれば全社見える（テナント分離なし） | ログイン必須。企業単位の認可は未実装 |
| 将来の `/api/twenty/**` | Twenty の個人 API キーを扱う。`requireUser()`＋本人のキーのみ使用、管理系は `requireOpsOrAdmin()` | 未実装 |

## 5. 既知の残課題

1. **企業単位・組織単位のデータ分離が無い。** ログインすれば全ユーザーが全企業を読める。
   Twenty 連携で「誰のキーで書くか」を扱う前に、方針を決める必要がある。
2. **`/api/batch/*` のトークンは共有シークレット 1 本。** 誰が実行したかは区別できない。
3. **監査ログが同期・認可の失敗を記録していない。** `audit_logs` テーブルはあるが未使用。
