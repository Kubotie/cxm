# 09 Content Templates（CXM v1）
（AI生成コンテンツのテンプレID辞書＋プロンプト雛形＋マルチチャネル配信仕様）

---

## 0. 目的
本ドキュメントは、CXM v1において
- Action提案からワンクリックで「資料化/記事化/ヘルプ化/テンプレ化」を生成し、
- 必要に応じて **Intercom/Email/In-product に加えて Slack/Chatwork** でも送信できるように、
  **テンプレID（辞書）** と **プロンプト雛形** と **配信（Sent）までの設計要件** を定義する。

方針：
- AIは「下書き」を生成する（自動送信しない）
- 生成は必ず Evidence（minutes/log/signal/ticket/usage）に基づく
- 品質担保は「編集→承認」フローで行う
- 送信（Sent）は **Actionとして記録**し、NocoDBへ確定（Push）した上で、CSM管理顧客は必要に応じてSF Taskへ同期する

---

## 1. テンプレID辞書（v1固定）
v1ではテンプレを **コンテンツ生成 9本** ＋ **配信メッセージ 8本（Slack/Chatwork対応含む）** に分ける。

### 1.1 CSM（生成：3）
- `CSM_EXEC_SUMMARY_V1`：経営/上長向け 1枚サマリー（意思決定者向け）
- `CSM_EXPAND_PROPOSAL_V1`：横展開（Expand）提案骨子（合意形成向け）
- `CSM_ONBOARDING_PLAN_V1`：オンボーディング計画（チェックリスト＋ToDo）

### 1.2 Support（生成：3）
- `SUPPORT_ANSWER_TO_FAQ_V1`：回答案 → FAQ記事ドラフト（再利用前提）
- `SUPPORT_TROUBLESHOOT_GUIDE_V1`：障害/不具合の切り分け手順ドラフト
- `SUPPORT_HELP_FLOW_IMPROVE_V1`：ヘルプ導線の改善案（問い合わせ削減）

### 1.3 CRM（生成：3）
- `CRM_SEGMENT_EMAIL_V1`：セグメント別メール文面（短く刺さる）
- `CRM_INPRODUCT_MESSAGE_V1`：In-product/Intercom短文（即時行動促進）
- `CRM_ARTICLE_SUMMARY_CTA_V1`：記事要約＋CTA（導線設計）

---

## 2. 送信（Sent）を漏らさないための追加テンプレ（チャネル別：8）
> 生成物（資料/記事/ヘルプ）を作ったあと、実際の顧客接点に「送る」ためのテンプレ。  
> Slack/Chatworkは **社内（Ptmind側）** と **顧客（外部）** の両用途があり得るため、用途を分ける。

### 2.1 顧客向け（外部送信）
- `SENT_EMAIL_SHORT_V1`：Email短文（導入/活用/障害いずれも対応）
- `SENT_INTERCOM_MESSAGE_V1`：Intercom（Mail/In-app）短文
- `SENT_INPRODUCT_NUDGE_V1`：In-productナッジ（CTA1つ）
- `SENT_SLACK_CUSTOMER_MESSAGE_V1`：顧客共同チャンネル（Slack）短文（論点/依頼/次アクション）
- `SENT_CHATWORK_CUSTOMER_MESSAGE_V1`：顧客共同チャンネル（Chatwork）短文（同上）

### 2.2 社内向け（Ptmind内の連携：Slack/Chatwork）
- `SENT_SLACK_INTERNAL_UPDATE_V1`：Slack社内共有（状況/論点/次アクション）
- `SENT_CHATWORK_INTERNAL_UPDATE_V1`：Chatwork社内共有（同上）
- `SENT_INTERNAL_HANDOFF_V1`：引き継ぎ用（CSM→Support/CRM/GTM）

> 注：顧客共同チャンネル（外部）への Slack/Chatwork 送信は v1 で対応する。  
> 送信先SSOTは `company_channel_identify`（10章）とし、該当レコードが存在する場合のみ外部送信を有効化する（誤送信防止）。  
> テンプレは `SENT_SLACK_CUSTOMER_MESSAGE_V1` / `SENT_CHATWORK_CUSTOMER_MESSAGE_V1` を v1辞書に含める。



---

## 3. Enum辞書（AI/実装で値を固定）
### 3.1 owner_role（介入レイヤー）
- `CSM`
- `Support`
- `CRM`
- `GTM`

### 3.2 action_type（介入種別）
- `todo`
- `meeting`
- `sent`
- `ticket`
- `content`

### 3.3 target（狙い）
- `Risk↓`
- `Opportunity↑`
- `Health↑`
- `Phase→`
- `Coverage↑`

### 3.4 content_type（生成物種別）
- `slide`
- `article`
- `help`
- `template`
- `message`  ←（追加：送信文面テンプレ）

### 3.5 channel（配信チャネル）
- `email`
- `intercom`
- `in_product`
- `slack`
- `chatwork`

---

## 4. 「送信（Sent）」の設計要件（漏れ防止：ここが重要）
### 4.1 Sentは“単独ログ”にしない（Actionに統合）
- 送信は必ず `actions.action_type = sent` として記録する
- 送信Actionは最低限以下を持つ：
  - `owner_role`（誰が送るか）
  - `scope/scope_id/related_project_id`（どの単位の顧客に送ったか）
  - `target`（何を狙って送ったか）
  - `evidence_refs`（なぜ送ったか）
  - `channel`（どこで送ったか）
  - `payload_ref`（送信した本文/生成物への参照）
  - `result_metrics`（open/click/reply等：取得できる範囲で）

### 4.2 送信前のステップ
- Draft生成（AI）
- 人が編集
- 承認（Approve）
- 送信（Send）
- Action確定（Push）
-（必要なら）CSM管理顧客はSF Task同期（Sync）

> 送信後に記録するのではなく、**送信と同時にActionが生成される**形を推奨（漏れ防止）

### 4.3 Slack/Chatwork送信の扱い（v1）
- Slack/Chatworkは「社内（Ptmind内連携）」と「外部（顧客共同チャンネル）」の両方を v1 で扱う
- 社内送信先：設定で固定（DBに持たない）
- 外部送信先：SSOT=`company_channel_identify`（company_uidに紐づくIDが存在する場合のみ有効）
  - Slack：`slack_channel_id`（例：C06TF20MD4J）
  - Chatwork：`chatwork_channel_id`（例：425325470）
- 送信Actionには `channel=slack/chatwork` を必ず入れる

#### 4.3.1 送信先ID（destination_id / destination_meta）
- Slack
  - destination_id：`slack_channel_id`
  - destination_meta：`thread_ts`（任意）, `message_ts`（送信後に保存）
- Chatwork
  - destination_id：`chatwork_channel_id`
  - destination_meta：`message_id`（送信後に保存）

#### 4.3.2 外部送信（顧客共同チャンネル）の有効化ルール（誤送信防止：v1必須）
外部送信ボタン/選択肢は、以下を満たす場合のみ UI 上で有効化する（満たさない場合は非活性）
1) `company_uid` が存在する
2) `company_channel_identify` に `company_uid` のレコードが存在する
3) 選択チャネルに対応する送信先IDが存在する  
   - Slack送信：`slack_channel_id` が存在  
   - Chatwork送信：`chatwork_channel_id` が存在

#### 4.3.3 送信前の二段階確認（v1必須）
送信直前に、以下を確認画面で表示して確定する（Confirm → Send）
- 送信先（channel / destination_id）
- 本文（最終版）
- `evidence_refs`（最低1つ）
- 用途タグ（purpose_tag：`[CXM-TEST] / [CXM-SHARED] / [CXM-URGENT]`：任意）

#### 4.3.4 Sent Actionの保存（v1必須）
Slack/Chatwork送信は必ず `actions.action_type = sent` として保存し、最低限以下を保持する：
- `company_uid`（必須）
- `related_project_id`（原則必須。会社戦略の共有など例外のみ null 可）
- `channel`：`slack` / `chatwork`
- `destination_id`：`slack_channel_id` / `chatwork_channel_id`
- `destination_meta`：`thread_ts`（Slack任意）, `message_ts`（Slack送信結果）, `message_id`（Chatwork送信結果）
- `payload_ref`：`content_job_id` または `RAW_MESSAGE`
- `evidence_refs`：最低1つ
- `send_status`：`queued / sent / failed`
---

## 5. テンプレ雛形（生成9本：既存）＋ 送信6本（追加）
以下、既存9本はそのまま（4.1〜4.9）として、送信テンプレのみ追加する。

---

# 5-A. 送信テンプレ（追加：6本）

## 5A-1 SENT_EMAIL_SHORT_V1（顧客向け：Email短文）
**用途**：導入/活用/障害/提案のいずれにも使える“短くて丁寧”な本文。

**出力**
- 件名案（2つ）
- 本文（〜250字）
- 次アクション（CTA1つ）
- 添付/リンク（あれば）

**Prompt（雛形）**
あなたはCSMです。Evidenceを根拠に、顧客向けの短いメール文面を作成してください。
条件：
- 250字程度、丁寧
- CTAは1つ
- 何を確認/依頼/提案したいかを明確に
入力：
- 顧客：{{company_name}}
- 宛先（わかれば）：{{to_name}}
- 目的（狙い）：{{target}}
- 根拠：{{evidence_refs}}
- 添付/リンク：{{links}}
出力：
1) 件名案（2）
2) 本文
3) CTA（文言＋URL/次の行動）

---

## 5A-2 SENT_INTERCOM_MESSAGE_V1（顧客向け：Intercom短文）
**用途**：Intercom（Mail/In-app）で即時に前進を促す。

**出力**
- タイトル（任意）
- 本文（1〜3文）
- CTA（1つ）

**Prompt（雛形）**
あなたはCSM/Supportです。Intercomで送る短文を作ってください。
条件：
- 1〜3文、短い
- CTAは1つ
- 顧客状態（Signal/Usage）に合わせる
入力：
- 顧客：{{company_name}}
- 目的：{{target}}
- 状態：{{state_summary}}
- 根拠：{{evidence_refs}}
- CTA URL：{{cta_url}}
出力：
1) 本文
2) CTA文言
3) CTA URL

---

## 5A-3 SENT_INPRODUCT_NUDGE_V1（顧客向け：In-productナッジ）
**用途**：UI上で“次の一手”を促す。

**出力**
- タイトル（短）
- 本文（1〜2文）
- CTAボタン文言（短）
- リンク/遷移先

**Prompt（雛形）**
あなたはCRM担当です。In-productで表示するナッジ文を作ってください。
条件：
- 1〜2文、具体、専門用語を避ける
- CTAは1つ
入力：
- トリガー：{{trigger}}
- 目的：{{target}}
- 表示場所：{{placement}}
- CTA URL：{{cta_url}}
出力：
1) タイトル
2) 本文
3) CTAボタン
4) CTA URL

---

## 5A-4 SENT_SLACK_INTERNAL_UPDATE_V1（社内：Slack共有）
**用途**：CSM/Support/CRM間の社内連携を高速化する。  
（顧客向けではなく、Ptmind内チャンネル向け）

**出力（構造）**
- TL;DR（1行）
- 背景（Evidence）
- いまの論点（3つまで）
- 依頼/次アクション（Owner/Due）
- リンク（minutes/ticket/signal）

**Prompt（雛形）**
あなたはCSMマネージャです。社内Slackに投稿する「状況共有」を作ってください。
条件：
- TL;DRを先頭に1行
- 論点は最大3つ
- 依頼事項はOwnerとDueを付ける
追加条件：
- 本文の先頭に用途タグを必ず付ける（{{purpose_tag}}）
  - purpose_tagは次のいずれか： [CXM-TEST] / [CXM-SHARED] / [CXM-URGENT]
入力：
- 顧客：{{company_name}}（company_uid={{company_uid}}）
- 状況：{{state_summary}}
- 根拠：{{evidence_refs}}
- 関係者：{{key_people}}
- 依頼したいこと：{{asks}}
- 用途タグ：{{purpose_tag}}  （[CXM-TEST] / [CXM-SHARED] / [CXM-URGENT]）
出力：
- {{purpose_tag}} TL;DR:
- 背景:
- 論点:
- 依頼/次アクション:
- Links:


---

## 5A-5 SENT_CHATWORK_INTERNAL_UPDATE_V1（社内：Chatwork共有）
**用途**：Chatwork運用のチーム向け共有（Slackと同等内容だがトーンを合わせる）

**Prompt（雛形）**
あなたはCSMマネージャです。社内Chatworkに投稿する「状況共有」を作ってください。
条件：
- 先頭に【要点】を1行
- 論点は最大3つ
- 依頼事項は担当と期限を明記
追加条件：
- 先頭に用途タグを必ず付ける（{{purpose_tag}}）
  - purpose_tagは次のいずれか： [CXM-TEST] / [CXM-SHARED] / [CXM-URGENT]
入力：
- 顧客：{{company_name}}
- 状況：{{state_summary}}
- 根拠：{{evidence_refs}}
- 依頼：{{asks}}
- 用途タグ：{{purpose_tag}}  （[CXM-TEST] / [CXM-SHARED] / [CXM-URGENT]）
出力：
{{purpose_tag}}【要点】
【背景】
【論点（最大3）】
【依頼/次アクション（担当/期限）】
【リンク】





---

## 5A-6 SENT_INTERNAL_HANDOFF_V1（社内：引き継ぎ）
**用途**：CSM→Support/CRM/GTMへ “文脈欠落なく” 渡す。
（推奨）緊急エスカレーション目的で引き継ぐ場合は、冒頭に [CXM-URGENT] を付与する。

**出力（構造）**
- 1分サマリー
- 顧客状態（Phase/Signal）
- 重要人物（Org）
- 依頼内容（何をしてほしいか）
- NG（避けるべきこと）
- 参考リンク

**Prompt（雛形）**
あなたはCSMです。別ロール（Support/CRM/GTM）に引き継ぐためのメモを作ってください。
条件：
- 1分で読める
- 依頼内容を具体に（何を/いつまでに）
- NG（避けるべき言い方/触れてはいけない事項）を明記
入力：
- 顧客：{{company_name}}
- Phase：{{phase}}
- Signal：{{signals}}
- Org：{{org_chart_summary}}
- 依頼：{{handoff_asks}}
- Evidence：{{evidence_refs}}
出力：
1) 1分サマリー
2) 顧客状態
3) 重要人物
4) 依頼内容
5) NG
6) Links

---

## 6. 実装メモ（Sent Action の保存）
### 6.1 content_jobs と actions の関係
- メッセージ生成（SENT_*）は `content_jobs.content_type = message`
- 実際に送信されたら、その送信イベントを `actions.action_type = sent` として保存し、以下を持つ：

**actions（sent）追加フィールド（推奨）**
- channel（email/intercom/in_product/slack/chatwork）
- destination_id（emailアドレス / intercom_delivery_job_id / slack_channel_id / chatwork_channel_id（=room id））（Intercomの実体IDは destination_metaへ）
- destination_meta（thread_ts, message_id等）
- payload_ref（content_job_id or raw_text）
- result_metrics（open/click/reply など）

### 6.2 Slack/Chatworkの“送信先”データ要件
v1の社内用途では以下を最低限保持する：
- Slack：`slack_channel_id`（＋thread_ts任意）
- Chatwork：`chatwork_channel_id`（=room id）

> 顧客向けSlack/Chatwork送信（外部）は v1 で対応する。  
> 送信先SSOTは `company_channel_identify` とし、存在しない場合はUI上で外部送信を無効化する（誤送信防止）。  
> 送信の結果は `actions(action_type=sent)` に destination_id / destination_meta / result_metrics として確定保存する。

---



（注）既存の生成9本（CSM/Support/CRM各3）は、前版の4.1〜4.9をそのまま維持する。
必要に応じて本ファイル下部へ統合してもよいが、運用上は「生成9本」＋「送信6本」を分けて管理する方が更新しやすい。