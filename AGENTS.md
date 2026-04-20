<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

---

## CXM 運用ルール（Single Source of Truth）

### データ主従

| フィールド | 正本 | 備考 |
|-----------|------|------|
| name / title / department / email / phone | **Salesforce** | SF sync で上書きされる。CXM 編集後に "SF push" しても次回 SF sync で上書き |
| role / role_type / decision_influence | **CXM** | SF には存在しない CSM 評価軸 |
| reports_to_person_id / works_with_person_ids / layer_role / display_group / stakeholder_note | **CXM** | 組織図・関係性は CXM 専用。SF には同期しない |
| action (title / status / due_date / owner) | **CXM** | "↑SF更新" ボタンで SF Task に片方向 push |

### 組織図（Org Chart）

- **縦関係**: `reports_to_person_id` 優先 → `manager_id` fallback（旧フィールド、SF sync で上書きされる場合あり）
- **横関係**: `works_with_person_ids` は**片方向保存**、VM で双方向に表示補完される
- **グルーピング**: `display_group` 優先 → `department` fallback
- **レイヤー**: `layer_role` 明示 → `is_executive` / `is_department_head` フラグ → title キーワード推定 の順

---

## CXM 簡易 SOP

### 1. Company 設定
1. Company List から対象を選択 → Company Detail を開く
2. Overview タブ: sf_account_id が空なら SF連携不可。Account 担当に確認
3. SF Summary が古い場合: "AI Summary 再生成" ボタンで更新（Generate and Save で保存）

### 2. People 編集
1. People タブ → 対象人物の "…" → 編集ダイアログを開く
2. 「SF主フィールド（title / dept / email / phone）」はラベルに "↑SF" マークあり
3. 変更後に "SF push" で Salesforce に反映（次回 SF sync で上書きされないよう注意）
4. 「役職」「関与度」「layer_role」「display_group」はCXM専用 — 好きに編集してよい

### 3. Org Chart 関係性更新
1. People タブ → 編集ダイアログ → 「組織上の関係性」セクション
2. **上長設定**: "上長 (reports_to)" セレクトで直属上長を選択（`reports_to_person_id` に保存）
3. **横断協働**: "横断協働 (works_with)" チェックリストで複数選択（`works_with_person_ids` に保存）
4. 保存後: Org Chart タブに切り替えると即座に反映（ページリロード不要）
5. B 側から設定しなくても A → B に設定すれば B のカードにも表示される（VM補完）

### 4. Action 作成
1. Actions タブ → "アクションを追加" または Evidence から "+ Action"
2. 担当者 owner はメールアドレス形式（`name@example.com`）で入力
3. SF ToDo 連動: "SF ToDo 作成" ボタン → SF Task ID が付与される
4. 内容変更後に "↑SF更新" ボタンで SF Task に反映

### 5. SF push
- **Action push** (`↑SF更新`): title / description / due_date / owner / status の5項目を SF Task に上書き
- **Contact push** (編集ダイアログ内「SF push」): title / department / email / phone を SF Contact に上書き
- push 失敗時: エラーメッセージをホバーで確認 → "再push" で再試行

### 6. Sync error 対応
| 症状 | 原因候補 | 対処 |
|------|---------|------|
| "SF連動エラー" バッジ | SF Task が削除された / sfTodoId 不整合 | SF で Task を確認。必要なら「SF ToDo 再作成」→ 旧 sfTodoId を上書き |
| "adapter_not_connected" | SALESFORCE_* 環境変数未設定 | Vercel Dashboard → Environment Variables を確認 |
| Contact sync後に編集値が消える | SF主フィールドを直接編集した | 次回 SF sync で戻るのは仕様。変更を残したいなら先に SF 側を変更 |
| NocoDB 404 | TABLE_ID 未設定またはトークン期限切れ | Vercel Dashboard の NOCODB_* 変数を確認。ローカル curl で疎通確認 |

---

## UI レイアウトルール — Dialog / Sheet

> 定数ファイル: `src/lib/ui/layout-classes.ts`

### 必須3点セット（欠けると崩れる）

| 要素 | 理由 |
|------|------|
| `overflow-hidden` on Content | `max-h-[90vh]` だけでは flex 子要素がクリップされない |
| `min-h-0` on ScrollArea | flex アイテムのデフォルト `min-h: auto` が `flex-1` の縮小を阻害する |
| `flex-shrink-0` on Header/Footer | flex 容量が不足したとき Header/Footer が縮んでしまう |

### Dialog

```tsx
<DialogContent className="sm:max-w-[480px] flex flex-col max-h-[90vh] overflow-hidden">
  <DialogHeader className="flex-shrink-0">...</DialogHeader>
  <ScrollArea className="flex-1 min-h-0">
    <div className="px-0.5 py-2">...本文...</div>
  </ScrollArea>
  <DialogFooter className="flex-shrink-0 border-t pt-3">...</DialogFooter>
</DialogContent>
```

### Sheet

```tsx
<SheetContent className="w-[520px] sm:max-w-[520px] flex flex-col overflow-hidden">
  <SheetHeader className="flex-shrink-0">...</SheetHeader>
  <ScrollArea className="flex-1 min-h-0 mt-4">
    <div className="px-1">...本文...</div>
  </ScrollArea>
  {/* footer が必要な場合 */}
  <div className="flex-shrink-0 border-t pt-3 px-4 flex gap-2">...</div>
</SheetContent>
```

### 禁止パターン

```tsx
/* ❌ 固定高さ — ビューポートサイズによって Footer が見切れる */
<ScrollArea className="h-[calc(100vh-160px)]">

/* ❌ overflow-hidden なし — max-h が効かず画面外にはみ出る */
<DialogContent className="flex flex-col max-h-[90vh]">

/* ❌ min-h-0 なし — コンテンツが多いと縮まらず Footer が押し出される */
<ScrollArea className="flex-1">
```
