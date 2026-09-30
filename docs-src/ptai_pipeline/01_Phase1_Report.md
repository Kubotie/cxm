# Ptengine AI パイプラインボード — Phase 1 完了報告

- 日付：2026-09-30
- 対象：HANDOVER_1.md 12-1 の **Phase 1（土台と完全再現）**
- 置き場所：`/ptai-pipeline`（CXM と同じ Next.js アプリ内、認証共通）

---

## 1. 何をどこに置いたか

```
src/app/
  (cxm)/                      … CXM 側。既存ルートを丸ごと移しただけで URL は不変
    layout.tsx                    ルートレイアウト（globals.css / Tailwind）
    apps/page.tsx                 プロダクト選択画面（ログイン後の着地）
    v2/layout.tsx                 サイドバーに PGA への切替を追加
  (ptai)/                     … PGA 側。**別のルートレイアウト**
    layout.tsx                    原本の CSS だけを読む <html><body>
    board.css                     原本 CSS 4〜1183 行（無編集 + Google Fonts の @import）
    shell.css                     プロダクト切替バーのみ（原本には無い追加）
    ptai-pipeline/
      page.tsx                    骨組みを流し込むだけ
      markup.ts                   原本 HTML 1185〜1351 行（無編集）
      board-scripts.tsx           RAW → shim → board.js の順に読む
  api/ptai/
    db/ me/ profiles/ ai/ mcp/ raw/

public/ptai-pipeline/
  board.js                    原本 JS 1354〜3898 行
  claude-shim.js              window.claude 互換レイヤー

src/lib/ptai/store.ts         NocoDB(pga_docs) の共有ドキュメントストア
scripts/ptai-seed.mjs         db-snapshot の投入
scripts/ptai-seed-raw.mjs     RAW スナップショットの投入
```

### ルートグループを分けた理由
原本の CSS は `body{…}` や素の要素を直接指定している。CXM 側は Tailwind v4 の
preflight が同じ document に効くので、同居させると見た目が変わる（12-1-1 に反する）。
Next.js のルートグループで `<html>`/`<body>` ごと分離した。**URL は変わらない**。
CXM ⇄ PGA の移動はフルリロードになる（別ドキュメントなので当然）。

---

## 2. `window.claude` の置き換え

| 原本 | 置き換え先 | 備考 |
|---|---|---|
| `use('db')` | `/api/ptai/db` ＋ NocoDB `pga_docs` | `onSnapshot` は 6 秒ポーリング + rev（内容ハッシュ）比較。変化が無ければ `{unchanged:true}` だけ返す。書き込み後はローカル状態を先に反映してから再取得（Firestore と同じ楽観反映）。`set` は全置換・後勝ちのまま（原本の挙動を維持） |
| `use('user')` | `/api/ptai/me`・`/api/ptai/profiles` | `id()` は CXM の `name2`（**署名済みセッションから取得**）。`isOwner()` は `staff_identify.name2 === 'Utty'`（`PGA_APPROVER_NAME2` / `PGA_APPROVER_EMAILS` で上書き可） |
| `use('sample')` | `/api/ptai/ai` → OpenRouter (`anthropic/claude-sonnet-4-5`) | CXM の既存 AI 経路を再利用。新しいキーは不要。`json()` は応答から JSON を抽出して parse、失敗は `invalid_json` |
| `use('mcp')` | `/api/ptai/mcp` | Notion（search / fetch / create-pages）と Intercom（search / get_conversation）を REST でコネクタ互換の payload に詰め替える。`host:twenty` は `twenty_key_missing` を返す |

### 認証（2026-09-30 セキュリティ是正を反映）

当初は CXM の平文 Cookie `cxm_user_uid` をそのまま読んでいたが、是正により次のようになった。

- セッションは Cookie **`cxm_session`** の **HMAC 署名付きトークン**（署名鍵 `CXM_SESSION_SECRET`）。
  **旧 `cxm_user_uid` / `cxm_user_role` は廃止済み**で、送っても未認証として扱う。
- `/api/ptai/*` の 6 本はすべて署名済みセッションを検証し、未認証には **JSON 401** を返す。
- **承認者判定（契約確定）は Cookie を信用しない。** セッションから `name2` を取り、
  `staff_identify` を引いて照合する。Cookie を書き換えても承認者にはなれない。
- `public/ptai-pipeline/board.js` などの静的ファイルも middleware の保護対象で、
  未認証だと `/login` にリダイレクトされる。
- ロールは `staff_identify` から引く（PGA 側では承認者判定にのみ使用）。

詳細は [../../docs/v2-architecture/01-runtime-and-auth.md](../../docs/v2-architecture/01-runtime-and-auth.md) §5。

### 共有 DB のテーブル
NocoDB `pga_docs`（`m0vfof8a1mwd75p`）1 枚。`collection / doc_id / data(JSON) / at / updated_at_s / deleted`。
`edits` `aplans` `orgs` `recent` `feed` `newcos` `settings` `plans` `chatwork` を収容。
2026-09-30 時点の `db-snapshot` 121 件を投入済み。

---

## 3. 原本コードへの変更（2 か所だけ）

1. **RAW の分離**（board.js 先頭）。`const RAW = window.__PGA_RAW;`
   原本 1353 行の 198KB は NocoDB の `_raw` コレクション（50KB 分割）に入れ、
   認証必須の `/api/ptai/raw` から返す。`public/` には置かない（12-6・下の 5 章）。
2. **`ncSyncTwenty` の失敗文言**（board.js 324 行付近）。HANDOVER 12-4 の読み替えどおり、
   `twenty_key_missing` → 「同期待ち（Twenty キー未設定）」、
   `twenty_key_invalid` → 「Twenty に接続できません（キーを確認してください）」を追加。
   分岐の結果（`queued:true` で保存は残す）は変えていない。

CSS・HTML・その他の JS・計算式・プロンプト・文言は一切触っていない。

---

## 4. 置いた仮定（12-1-3）

| # | 仮定 | 理由 |
|---|---|---|
| 1 | 共有 DB は Supabase ではなく **NocoDB** | CXM が既に使っていて、新規プロビジョニングが要らない。ドキュメント志向の `set` 全置換なので 1 テーブルで足りる |
| 2 | リアルタイム購読は **6 秒ポーリング** | 利用者が 1 桁人数で、rev 比較のため差分が無い間はレスポンスが数十バイト。Realtime 基盤を足す必要がない |
| 3 | 認証は **CXM の既存セッション**をそのまま流用 | ユーザーの指定（入口だけ共通）。SSO は導入していない |
| 4 | Claude は **OpenRouter 経由**（`OPENROUTER_API_KEY`） | CXM の既存経路。`ANTHROPIC_API_KEY` は未設定だった |
| 5 | 承認者は `staff_identify.name2 === 'Utty'`（`PGA_APPROVER_NAME2` / `PGA_APPROVER_EMAILS` で上書き可） | 10-4-5「契約確定の承認は Utty」。公開リポジトリなので既定値にメールは書かない |
| 6 | 営業系ロールは追加しない | ユーザーの指定。ログイン済みなら全員が閲覧・編集できる（原本と同じ） |
| 7 | `limits()` は固定値（プロンプト 180KB / 画像 8 枚） | ホスト内部仕様の代替（7-2） |

---

## 5. 未解決・要対応

| # | 事項 | 影響 | 必要な対応 |
|---|---|---|---|
| 1 | **`Kubotie/cxm` が public リポジトリ** | 顧客データを commit すると外部に出る | private 化を推奨。当面 `public/ptai-pipeline/raw.js` は .gitignore 済み。RAW は NocoDB 経由なので、private 化しなくても動作はする |
| 2 | ~~Notion 連携が未接続~~ → **接続済み（2026-09-30）** | — | `TOKEN_NOTION` 側のインテグレーションに共有された。PGA の Notion 呼び出しだけ `PGA_NOTION_TOKEN` → `TOKEN_NOTION` → `TOKEN_NOTION_2` の順で解決する（CXM 本体とは優先順が逆）。検索・本文取得・Intercom 会話検索まで実機確認済み |
| 3 | **Twenty は未接続（Phase 3）** | 企業追加・Tier/業種の書き戻しが「同期待ち」のまま | 12-2〜12-3 の連携設定画面と `user_credentials` を作る |
| 4 | Intercom 会話検索を `source.body` の部分一致にマッピング | MCP 版と件数が変わる可能性 | 実データで突き合わせ（AI の資料が減るだけで画面は壊れない） |
| 5 | フィードの `by` に旧 claude.ai ユーザー ID が残っている | 「誰が」の欄が空欄になる | 実害なし。今後の変更は CXM の `name2` で記録される |
| 6 | RAW は 2026-09-28 のスナップショットのまま | データが古い | Phase 2（Twenty Read の実行時取得） |

---

## 6. 確認済みの動作（HANDOVER 9-1 に対応）

| シナリオ | 結果 |
|---|---|
| 1 初期表示 | KPI 5 枚・目標到達ステージ・メンバー別・予定月別・ステージ別・お知らせ・新着・企業一覧が並ぶ。**126 社**（125 + KDDI の新規・未同期） |
| 2 ビュー切替 | チーム／各メンバーのタブが出る |
| 6 ドロワー | 行クリックで開き、タブ 6 種（要約・組織図 9・商談管理・サクセス管理 4・行動履歴・議事録 1）すべて描画 |
| 7 到達予定 | エプソンの保存済み `ms`（11/12・11/26・12/10・12/21）がそのまま出る |
| 17/18 の保存先 | `recent` `aplans` の既存データが読めている |
| 19 ダークモード | `prefers-color-scheme:dark` で背景 `#0f0f0e` に切り替わる |
| 20 スマホ幅 375px | KPI 2 列、切替バーは折り返し |
| — DB 書き込み | `doc.set` / `collection.add` / `doc.delete` を実機で往復確認 |
| — AI | `sample.json()` が JSON を返すことを確認 |
| — Twenty | `twenty_key_missing` を返し、原本の「同期待ち」経路に落ちることを確認 |
| — Notion / Intercom | `notion-search`（議事録 5 件ヒット）→ `notion-fetch`（表・トグルの中身まで 3,235 文字）→ Intercom `search`（5 件）を実機確認 |

未確認：企業追加（Notion 顧客 DB に実データを作ってしまうため実行していない）、
契約確定の承認（Utty のアカウントが必要）、組織図 AI・サクセス AI の実行（実データへの副作用を避けたため）。
