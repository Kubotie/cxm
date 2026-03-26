Appendix A：CSM Console Only（Minutes起点抜粋）
> この章は「CXM Workflows v1（統合版）」の抜粋であり、正本は統合版である。
> 本章はCSM Consoleのみ実装・議論する際の参照用に残す。


# UI Blueprint — CSM Workflow（Minutes起点：People/Org/Action/Content → Push → Sync）

## 0. 目的
本ドキュメントは、CXMにおける **CSM担当管理画面（CSM Console）** が、
**Minutes（議事録/Evidence）** を起点に、

- ステークホルダー（People）の追加・更新
- 組織図（Org Chart）の固定化（NocoDB確定）
- アクション（Action：todo/meeting/sent/ticket/content）の提案・実行決定
- 資料化・記事化・ヘルプ化などコンテンツ生成（Content）
- 必要に応じたSalesforce（Contact/Task）同期（Sync）

までを **一連の運用として迷いなく回せる**ように、UIの構成・状態遷移・操作定義を固定する。

### この画面が解く課題
- Minutes（議事録）はあるが、組織図・攻略戦略に落ちない（構造化されない）
- Salesforce Contact登録にはメール等が必要で入力工数が重い
- Actionが散在し、根拠（Evidence）と狙い（Target）が残らない
- AI提案が「生成して終わり」になり、確定（Push）と学習（Impact）が残らない

---

## 1. 前提（SSOT / 二段階コミット）
### 1.1 SSOT方針（People / Action）
- **NocoDB**：CXMとしての「確定ログ（決定の証跡）」を保存する（Pushの保存先）
- **Salesforce Contact / Task**：営業/CS運用上の名簿・ToDoのSSOT（Syncの同期先）
- People/Actionともに誤同期防止のため、原則は **Push（NocoDB確定）→ Sync（Salesforce昇格）** の二段階とする

### 1.2 Scope（単位）
- Company / Project / User の3単位を必ず明示し、表示・集計・介入の誤りを防ぐ
- People / Org Chart は **Company Scope** を基本とする（CSMの組織攻略の前提）

---

## 2. 画面全体構成（CSM Console）
### 2.1 入口（CSM Home）
- 担当顧客一覧（Company Cards）
- 重要表示：
  - 未処理Minutes（Minutes Inbox）
  - 要対応Signal（Health/Risk/Opportunity）
  - 未完了Action（Salesforce Task / NocoDB Action）

**Company Cardの主要バッジ**
- `未処理Minutes：N件`
- `Risk：高/中/低`
- `Opportunity：高/中/低`
- `未完了Action：N件`

→ Company Detail（CSM版）に遷移

---

## 3. Company Detail（CSM版）の主要コンポーネント
Company Detailは以下の **3レーン**で構成する。

1) **Evidence Inbox（Minutes/ログ）**
2) **Org/People（組織図・人物管理）**
3) **Action/Content（行動とコンテンツ）**

### 3.1 Evidence Inbox（Minutes起点の導線）
#### 3.1.1 未処理キュー（Minutes Queue）
- Notion Minutesの直近N件を表示
- 各Minutesカードに以下を表示：
  - 日付/タイトル
  - 重要タグ（例：更新/横展開/障害/決裁）
  - 状態（未処理 / 提案生成済 / 確定済 / 同期済）
  - CTA：`AIで抽出（提案生成）` または `レビューへ`

#### 3.1.2 統合タイムライン（Timeline）
- ログ統合ビュー（Intercom / Slack / Chatwork / Tickets / Minutes）
- Evidenceとして “原文リンク” を必ず保持

---

## 4. 主要フロー①：Minutes → People提案 → Org Chart固定化 → Sync（Salesforce Contact）
### 4.1 状態遷移（People/Org）
- Minutes：`unprocessed → proposed → confirmed（pushed） → synced（optional）`
- People Node：`proposed → confirmed（pushed） → synced（optional）`
- Org Chart：`draft（preview） → confirmed（versioned）`

### 4.2 Step 1：AIで抽出（提案生成）
Minutesカードの `AIで抽出（提案生成）` を押すと、以下を生成して「レビュー画面」に遷移する。

生成物（People/Org）
- People候補リスト（People proposals）
- 関係（reports_to / works_with / gatekeeps_for のうち v1は reports_to優先）
- Missing roles（例：経営スポンサー不在、門番不明）
- Evidenceリンク（Minutes内の該当段落）

### 4.3 Step 2：提案レビュー（People/Org Review）
UIは左右レイアウトを推奨。

**左：People候補リスト（編集可能）**
- 表示名（暫定OK）
- 部署名 / 部門カテゴリ
- ステークホルダーロール
- 意思決定ポジション
- スタンス（推進/慎重/反対）
- 影響（予算影響 / 運用影響）※原則：定義に沿った選択肢＋自動補助
- カバレッジ（接触済/特定済/未特定）
- 上長（候補ノードから選択）
- Evidence（引用）パネル：短い抜粋＋リンク

**右：Org Chart Preview（暫定組織図）**
- 編集が即時反映
- ノードスタイル：
  - proposed：点線枠
  - confirmed：実線枠（Push後）
  - synced：Salesforceアイコン（Sync後）
- ノードクリックでサイドペイン：
  - Evidenceリンク一覧
  - 既存Salesforce候補（同姓同名等）
  - CTA：
    - `Push（NocoDBへ確定）`
    - `Sync（Salesforce Contact）`（Push後に有効化）

### 4.4 Step 3：Push（NocoDBへ確定）
`Push（NocoDBへ確定）` を押すと以下を実行する。
- Peopleノードを NocoDB `people_nodes` に `confirmed` として保存
- Org Chartを `org_chart_versions` として保存（version付与）
- 監査ログ（pushed_by / pushed_at）を保存

**Push後のUX**
- Org Chart Preview → Org Chart（確定版）へ切替
- 各ノードに `Sync（Salesforce Contact）` が出現（有効化）
- “確定しました” トースト＋「次におすすめ：Missing rolesを埋めるAction」

### 4.5 Step 4：Sync（Salesforce Contact）
Push済みノードに対して、1クリックで同期可能にする。

**同期ボタンの挙動**
1) `差分プレビュー（mini）` を表示
   - 新規作成 or 更新
   - 更新なら変更差分
2) `同期実行` でSalesforceへAPI送信
3) 成功時：
   - `sf_contact_id` をNocoDBに保存
   - ノードにSalesforceアイコン表示
4) 失敗/競合時：
   - `conflict` / `error` 状態
   - 解消フローを提示

**新規/更新判定**
- `sf_contact_id` があれば update
- 無ければ検索して候補提示（優先順）：
  1) email一致（あれば最優先）
  2) company + name + dept 近似
  3) company + name

---

## 5. 主要フロー②：Minutes → Action提案 → Push → Sync（Salesforce Task）→ Content生成
### 5.1 状態遷移（Action / Content）
- Action：`proposed → confirmed（pushed） → synced（optional） → executed → impact`
- Content：`draft → generated → edited → published`（自動公開しない）

### 5.2 Step 1：AIでAction提案を生成
Minutes解析時に同時生成（または別ボタンでも可）。

生成物（Action）
- 推奨Actionカード（複数）
  - Target（Risk↓ / Opportunity↑ / Health↑ / Phase→ / Coverage↑）
  - owner_role（CSM / Support / CRM / GTM）
  - due_at（推奨）
  - Evidence（Signal / Minutes / Logs / Tickets）
  - 推奨Content type（slide/article/help/template/message）
  - “刺さる理由”（1行）

### 5.3 Step 2：Actionレビュー（編集）
**Actionカード構造（必須）**
- title（1行）
- target（上記固定）
- owner（人/ロール）
- due_at
- evidence_refs（リンク）
- CTA：
  - `Push（NocoDBへ確定）`
  - `Sync（Salesforce Task）`（Push後に有効化）
  - `コンテンツ作成`（資料化/記事化/ヘルプ化/テンプレ化）

### 5.4 Step 3：Push（NocoDBへ確定）
- NocoDB `actions` に `confirmed` 保存
- pushed_by / pushed_at を保存
- evidence_refs（minutes/log/signal/ticket）を必須として保存

### 5.5 Step 4：Sync（Salesforce Task）
Push済みActionの `Sync（Salesforce Task）` でSalesforce Taskを作成/更新する。

**Taskマッピング（概要）**
- Subject：`[SignalID] {target} / {title}`
- Due Date：Action.due_at
- Related To：Account（Company）＋可能ならProject
- Name（Contact）：該当Peopleが synced（sf_contact_idあり）なら紐付け
- カスタム項目：target / evidence_refs / expected_window / result_note

**Contact未同期の場合**
- Account紐付けのみで作成 → 後からContact同期後に更新可能

---

## 6. Content生成（資料化/記事化/ヘルプ化/テンプレ化）
### 6.1 入口
Actionカードの `コンテンツ作成` から作成する。
- 資料化（QBR/上長報告/横展開提案）
- 記事化（活用Tips/事例/運用ガイド）
- ヘルプ化（FAQ/手順/トラブルシュート）
- テンプレ化（Email/Intercom文面/チェックリスト）
- メッセージ化（Slack/Chatwork共有文）

### 6.2 基本ステップ
1) `Draft生成（AI）`：Evidence＋対象者＋目的（target）を必ず含める
2) `編集（人）`：ブランド/言い回し/機密を整える
3) `保存`：NocoDB `content_jobs` に保存（output_ref付与）
4) `配信/共有`：
   - Sent（email/intercom/in_product/slack/chatwork）を **Action（sent）として記録**する（別Actionでも可）

---

## 7. 例外・競合・エラー処理（最低限）
### 7.1 People：メール無し/同名問題
- NocoDBでは登録可能（display_nameのみでもOK）
- Salesforce同期時に候補が複数出たら：
  - `候補に紐付け` / `新規作成` を選択
- 決められない場合は `同期保留` とし、ノードに警告表示

### 7.2 Org Chart：矛盾（上長が二人等）
- NocoDBに `conflict` フラグ
- UIで「矛盾候補」一覧を出し、編集へ誘導

### 7.3 Task：Contact未同期
- Account紐付けで作成して先に前進させる
- Contact同期後にNameを更新できる

---

## 8. 権限・ガバナンス（v1最低ライン）
- Push権限：CSM（担当）＋ CSM Manager
- Sync権限：
  - Contact Sync：CSM（担当）＋ CSM Manager
  - Task Sync：CSM（担当）＋ CSM Manager
- 監査ログ：Push/Syncは必ず記録（誰がいつ何を）

---

## 9. UIテキスト（ボタン/状態名）
### 9.1 推奨ボタン文言
- `AIで抽出（提案生成）`
- `レビューして確定（Push）`
- `Sync（Salesforce Contact）`
- `Sync（Salesforce Task）`

### 9.2 推奨状態バッジ（日本語表示）
- `未処理`（unprocessed）
- `提案あり`（proposed）
- `確定済（NocoDB）`（confirmed/pushed）
- `同期済（Salesforce）`（synced）
- `競合あり`（conflict）
- `同期エラー`（error）

---

## 10. 完了条件（Blueprintが満たすべきこと）
- Minutes 1件から People / Org Chart / Action が一貫フローで確定できる
- PushによりCXM側の証跡が残り、UIに固定表示される
- Syncがノード/Actionからワンクリックで可能（差分確認あり）
- メール無しPeopleでもワークフローが止まらない
- ActionからContent生成まで繋がり、成果（Impact）が残る