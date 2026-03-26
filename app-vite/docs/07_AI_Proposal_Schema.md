# 07 AI Proposal Schema（CXM v1）
（Minutes → People/Org → Action → Content 提案の入出力仕様）

---

## 0. 目的
本ドキュメントは、CXM v1におけるAI提案（Proposal）の **入出力データ構造（JSON）** を固定し、
フロント（提案レビューUI）・バックエンド（Push/Sync）・AI（生成）間の齟齬を防ぐ。

- 提案は “確定（Push）” ではない  
- 人が編集した上で Push（NocoDB確定）する  
- Sync（Salesforce昇格）は Push済みの確定データのみ対象

---

## 1. 共通原則
### 1.1 すべての提案は Evidence を持つ
AI提案は必ず「根拠（Evidence）」を持つ。根拠のない提案は `confidence` を低くする。

### 1.2 “曖昧さ” を許容する（v1の実務要件）
- 名前が曖昧、メールが無い、部署が不明でも提案は成立させる
- その代わり、`confidence` と `missing_fields` を明示し、UIで編集誘導する

### 1.3 参照キーの絶対ルール
- Company：`company_uid`
- Minutes：`minutes_id`
- Project：`project_id`（分かる場合）
- User：`user_id`（分かる場合）

---

## 2. 入力（AIへの入力Payload）
AIは minutes（議事録/ログ）を中心に、必要な補助情報（既存Org/People/Signal）を受け取る。

### 2.1 Input Envelope

```json
{
  "request_id": "req_20260309_0001",
  "company_uid": "sf_0017F00002cwBDsQAM",
  "minutes_id": "31a6643a-9819-8052-8cdb-c3f93789c0e3",
  "minutes": {
    "title": "20260305_マッシュビューティーラボ様_引き継ぎ挨拶",
    "occurred_at": "2026-03-05T14:00:00+09:00",
    "url": "https://www.notion.so/....",
    "raw_text": "（議事録全文テキスト）"
  },


  "evidence_logs": {
    "intercom": [
      {
        "conversation_id": "412844274_2026-03-06",
        "sent_at": "2026-03-06T19:41:53+09:00",
        "message_type": "mail",
        "company_uid": "sf_001Q900000yFa0cIAC",
        "project_id": null,
        "user_id": null,
        "actor_external": {
          "system": "intercom_admin",
          "external_id": "9549122",
          "display_name": "松藤 美奈子"
        },
        "body": "（本文）",
        "evidence_ref": { "ref_type": "intercom_conversation", "ref_id": "412844274_2026-03-06" }
      }
    ]
  },




  "context": {
    "known_projects": [
      { "project_id": "1049531d", "project_name": "muji.com-JP" }
    ],
    "existing_people_nodes": [
      {
        "people_node_id": "pn_001",
        "display_name": "西山 実穂",
        "email": null,
        "sf_contact_id": null
      }
    ],
    "existing_org_chart": {
      "version": "v3",
      "graph_json": { "nodes": [], "edges": [] }
    },
    "signals_snapshot": [
      { "signal_id": "R2_UsageDrop_WoW", "scope": "project", "scope_id": "1049531d", "severity": "high" }
    ]
  },
  "constraints": {
    "phase_ssot_policy": "readonly",
    "language": "ja",
    "allowed_outputs": ["people", "org_edges", "actions", "content_jobs"],
    "max_people": 20,
    "max_actions": 12,
    "purpose_tag_default": "[CXM-SHARED]"
    "routing_hint": {
      "intercom_message_type_to_owner_role": {
        "support": "Support",
        "mail": "CSM",
        "inquiry": "Support"
      },
      "intercom_message_type_to_secondary_owner_role": {
        "inquiry": ["CRM"]
      },
      "intercom_message_type_scope_policy": {
        "support": "project_preferred",
        "mail": "company_or_project",
        "inquiry": "user_or_project_or_unlinked"
      }
    }
  }
}
```







⸻

## 3. 出力（AIからの提案Payload）

AI出力は、以下4カテゴリの提案を含む。
	1.	People提案（人物候補）
	2.	Org提案（レポートライン/関係）
	3.	Action提案（ToDo/Meeting/Sent/Ticket/Content）
	4.	Content提案（資料化/記事化/ヘルプ化）

### 3.1 Output Envelope（最上位）

```json
{
  "request_id": "req_20260309_0001",
  "company_uid": "sf_0017F00002cwBDsQAM",
  "minutes_id": "31a6643a-9819-8052-8cdb-c3f93789c0e3",
  "generated_at": "2026-03-09T15:00:00+09:00",
  "model_version": "kocoro-proposal-v1",
  "summary": {
    "one_liner": "新体制移行に伴うキーマン更新と、サイト統合（モール化）に向けた合意形成が最重要。",
    "top_risks": ["決裁ラインの不透明さ", "施策枠不足による運用停滞"],
    "top_opportunities": ["横展開（ブランド横断）", "新機能デモ起点の期待醸成"]
  },
  "proposals": {
    "people": [],
    "org_edges": [],
    "actions": [],
    "content_jobs": []
  },
  "missing_info": [
    { "type": "people_email", "hint": "下村様のメールが未取得。署名・名刺・CC情報から補完推奨。" }
  ],
  "warnings": [
    { "type": "low_confidence_mapping", "message": "『谷様』の役職が議事録内で明示されていないため、決裁ポジションは仮置きです。" }
  ]
}
```

⸻

## 4. People Proposal Schema（人物候補）

### 4.1 People Proposal（1件）

```json
{
  "proposal_id": "pp_001",
  "op": "upsert",
  "identity": {
    "display_name": "下村（リテール部部長）",
    "email": null,
    "phone": null
  },
  "attributes": {
    "dept_raw": "リテール部",
    "dept_category": "EC",
    "stakeholder_role": "経営スポンサー",
    "decision_position": "最終承認者",
    "stance": "推進",
    "temperature": "ポジティブ",
    "budget_influence": "あり",
    "ops_influence": "中",
    "coverage_state": "接触済",
    "access_state": "直接接点あり",
    "notes": "新体制キーマン。モール化/CRM強化を推進。次回は決裁ラインと予算枠の合意を取りに行く。"
  },
  "relations": {
    "reports_to": {
      "target_display_name": "谷",
      "confidence": 0.45,
      "evidence_refs": [
        { "ref_type": "minutes_quote", "ref_id": "q_012", "url": "https://www.notion.so/...#block-xxx" }
      ]
    }
  },
  "confidence": 0.78,
  "missing_fields": ["email"],
  "evidence_refs": [
    { "ref_type": "minutes_quote", "ref_id": "q_001", "url": "https://www.notion.so/...#block-aaa" },
    { "ref_type": "minutes_quote", "ref_id": "q_002", "url": "https://www.notion.so/...#block-bbb" }
  ]
}
```
### 4.2 op（操作種別）
	•	create：新規人物として提案
	•	update：既存人物への更新提案（people_node_idがわかる場合）
	•	upsert：新規/既存どちらでも良い（人が確定する）

⸻

## 5. Org Edge Proposal Schema（組織関係）

### 5.1 Org Edge（1件）
```
{
  "edge_id": "oe_001",
  "edge_type": "reports_to",
  "from": { "proposal_ref": "pp_003", "display_name": "西山 実穂" },
  "to": { "proposal_ref": "pp_001", "display_name": "下村（リテール部部長）" },
  "confidence": 0.72,
  "evidence_refs": [
    { "ref_type": "minutes_quote", "ref_id": "q_006", "url": "https://www.notion.so/...#block-ccc" }
  ]
}
```
5.2 edge_type（v1で扱う種類）
	•	reports_to（上長）
	•	works_with（連携：横並び、必要なら）
	•	gatekeeps_for（門番：例 情シスが承認を握る）

v1は reports_to を最優先。works_with / gatekeeps_for は任意。

⸻

## 6. Action Proposal Schema（介入提案）

### 6.1 Action Proposal（1件）
```json
{
  "proposal_id": "ap_001",
  "op": "create",
  "action": {
    "scope": "company",
    "scope_id": "sf_0017F00002cwBDsQAM",
    "related_project_id": "1049531d",
    "owner_role": "CSM",
    "action_type": "meeting",
    "title": "決裁ライン（谷様/下村様）とモール化ロードマップの合意形成MTG設定",
    "target": "Opportunity↑",
    "priority": "high",
    "due_at": "2026-03-18T18:00:00+09:00",
    "expected_window": "30d",
    "assignees": [
      { "assignee_type": "role", "value": "CSM" }
    ],
    "related_people": [
      { "display_name": "下村（リテール部部長）", "proposal_ref": "pp_001" },
      { "display_name": "西山 実穂", "proposal_ref": "pp_003" }
    ],
    "evidence_refs": [
      { "ref_type": "minutes_id", "ref_id": "31a6643a-9819-8052-8cdb-c3f93789c0e3" }
    ],
    "suggested_next_steps": [
      "会食（谷様同席）を早期に設定し、合意形成の場を作る",
      "体験枠運用ルールと追加費用を整理した1枚資料を準備"
    ]
  },
  "confidence": 0.8,
  "missing_fields": [],
  "content_suggestions": [
    { "content_type": "slide", "template_id": "CSM_EXPAND_PROPOSAL_V1", "reason": "横展開提案と決裁合意に必要" }
  ]
}
```


#### purpose_tag（任意・sent専用）
- action_type が `sent` の場合のみ、用途タグ `purpose_tag` を指定できる
- 値は次のいずれか：`[CXM-TEST]` / `[CXM-SHARED]` / `[CXM-URGENT]`
- 未指定の場合は `[CXM-SHARED]` を既定値とする


#### Action Proposalの例


```json
{
  "proposal_id": "ap_010",
  "op": "create",
  "action": {
    "scope": "company",
    "scope_id": "sf_0017F00002cwBDsQAM",
    "related_project_id": "1049531d",
    "owner_role": "CSM",
    "action_type": "sent",
    "channel": "slack",
    "purpose_tag": "[CXM-SHARED]",
    "title": "社内共有：状況/論点/依頼（Slack）",
    "target": "Coverage↑",
    "priority": "medium",
    "due_at": null,
    "expected_window": "7d",
    "assignees": [
      { "assignee_type": "role", "value": "CSM" }
    ],
    "evidence_refs": [
      { "ref_type": "minutes_id", "ref_id": "31a6643a-9819-8052-8cdb-c3f93789c0e3" }
    ],
    "suggested_next_steps": [
      "Supportへチケット背景整理を依頼",
      "CRMへオンボ導線案の叩き台作成を依頼"
    ]
  },
  "confidence": 0.7,
  "missing_fields": [],
  "content_suggestions": [
    { "content_type": "message", "template_id": "SENT_SLACK_INTERNAL_UPDATE_V1", "reason": "社内共有を統一フォーマット化" }
  ]
}

```



### 6.2 target（v1）
	•	Risk↓
	•	Opportunity↑
	•	Health↑
	•	Phase→
	•	Coverage↑


action_type ごとの必須/禁止フィールド：
- action_type = sent：channel 必須、purpose_tag 任意（未指定なら [CXM-SHARED]）
- action_type ≠ sent：channel は持たない（禁止）


#### owner_role 決定ルール（Intercom由来Evidenceが主根拠の場合）
- evidence_refs の主根拠が intercom で、かつ message_type が取れる場合：
  - support → owner_role = Support
  - mail → owner_role = CSM
  - inquiry → owner_role = Support（secondary: CRM を許容）
- company_uid / project_id が未解決でも提案は成立させる（scope=user または scope=project または scope=unlinked扱い）
  - ただし Push時の scope は必ず company/project/user のいずれかに正規化する（unlinkedは仮保持のみ）


## 6.3 Action.action フィールド一覧（v1）

> 目的：action_typeごとの必須/任意/禁止フィールドを固定し、UI/BE/AIの齟齬を防ぐ。

### 共通フィールド（全 action_type で使用）
| フィールド | 型 | 必須 | 説明 |
|---|---|---:|---|
| scope | string | ✅ | `company` / `project` / `user` |
| scope_id | string | ✅ | scopeに対応するID（company_uid等） |
| related_project_id | string/null | ✅（原則） | 原則必須。Company戦略のみnull可 |
| owner_role | string | ✅ | `CSM` / `Support` / `CRM` / `GTM` |
| action_type | string | ✅ | `todo` / `meeting` / `sent` / `ticket` / `content` |
| title | string | ✅ | Actionタイトル（要約） |
| target | string | ✅ | `Risk↓` / `Opportunity↑` / `Health↑` / `Phase→` / `Coverage↑` |
| priority | string | ✅ | `high` / `medium` / `low` |
| due_at | string/null | △ | ISO8601。期限があるなら入れる |
| expected_window | string/null | △ | `7d` / `14d` / `30d` 等（Impact観測窓） |
| assignees | array | △ | Ownerの割当（role/person） |
| related_people | array | △ | 関連人物（proposal_ref/display_name） |
| evidence_refs | array | ✅ | 最低1つ。minutes/ticket/signal等 |
| suggested_next_steps | array | △ | 次の一手候補（最大5） |

---

### sent専用フィールド（action_type=sent のみ）
| フィールド | 型 | 必須 | 説明 |
|---|---|---:|---|
| channel | string | ✅ | `email` / `intercom` / `in_product` / `slack` / `chatwork` |
| purpose_tag | string | △ | `[CXM-TEST]` / `[CXM-SHARED]` / `[CXM-URGENT]`（未指定はdefault） |

#### channel=intercom の追加必須フィールド（action_type=sent）
- audience_scope：`company` / `project` / `user` / `segment`
- audience_id：scopeに対応するID（company_uid / project_id / user_id / segment_id）
- resolved_recipients_count：AI推定または事前解決した人数（未解決ならnull可）


#### sent時の禁止事項
- action_type=sent 以外では `channel` を **持たない（禁止）**
- purpose_tag も sent 以外では **持たない（禁止）**

---

### meeting専用フィールド（action_type=meeting のみ：推奨）
| フィールド | 型 | 必須 | 説明 |
|---|---|---:|---|
| meeting_type | string | △ | `regular` / `onboarding` / `exec` / `support` 等（任意） |
| agenda | array/string | △ | 論点（最大5） |
| desired_attendees | array | △ | 参加者候補（people_ref/display_name） |

---

### todo専用フィールド（action_type=todo のみ：推奨）
| フィールド | 型 | 必須 | 説明 |
|---|---|---:|---|
| todo_category | string | △ | `followup` / `setup` / `analysis` / `content` 等 |
| checklist | array | △ | チェックリスト（最大10） |

---

### ticket専用フィールド（action_type=ticket のみ：推奨）
| フィールド | 型 | 必須 | 説明 |
|---|---|---:|---|
| ticket_system | string | △ | `cse` / `intercom` / `other` |
| ticket_id | string | △ | チケット識別子 |
| severity | string | △ | `high` / `medium` / `low` |

---

### content専用フィールド（action_type=content のみ：推奨）
| フィールド | 型 | 必須 | 説明 |
|---|---|---:|---|
| content_type | string | △ | `slide` / `article` / `help` / `template` / `message` |
| template_id | string | △ | `09_Content_Templates.md` のテンプレID |
| linked_content_job_ref | string | △ | content_job提案（cp_xxx）への参照 |

---

### 実装ルール（重要）
- `action_type=sent` の場合は `content_suggestions` に `message` 系テンプレ（SENT_*）を必ず1つ含める（推奨）
- `content_jobs.prompt_hints.purpose_tag` は、`action.purpose_tag` を継承し、無ければ `purpose_tag_default` を使用する

⸻


## 7. Content Job Proposal Schema（コンテンツ生成提案）
content_jobs の purpose_tag ルール：
- action.purpose_tag が存在する場合、content_job.prompt_hints.purpose_tag はそれを継承する
- 無い場合は constraints.purpose_tag_default を使用する（既定：[CXM-SHARED]）

### 7.1 Content Job（1件）

```json
{
  "proposal_id": "cp_001",
  "op": "create",
  "content_job": {
    "linked_action_proposal_ref": "ap_001",
    "content_type": "slide",
    "template_id": "CSM_EXEC_SUMMARY_V1",
    "title": "経営向け：サイト統合（モール化）×CRM強化の支援方針サマリー（1枚）",
    "inputs": {
      "company_uid": "sf_0017F00002cwBDsQAM",
      "minutes_id": "31a6643a-9819-8052-8cdb-c3f93789c0e3",
      "signals": ["O2_ProjectIncrease_Company"],
      "people_refs": ["pp_001", "pp_003"]
    },
    "prompt_hints": {
      "purpose_tag": "[CXM-SHARED]",
      "tone": "簡潔・意思決定者向け・論点先出し",
      "must_include": ["現状", "課題", "合意したいこと", "次アクション", "費用/枠の論点"],
      "do_not_include": ["不確定な断定", "機密情報"]
    }
  },
  "confidence": 0.75,
  "missing_fields": []
}
```
※同様にChatwork用なら template_id を `SENT_CHATWORK_INTERNAL_UPDATE_V1` にし、purpose_tagも渡します。


### 7.2 Content Job（社内Slack共有メッセージ例）

```json
{
  "proposal_id": "cp_010",
  "op": "create",
  "content_job": {
    "linked_action_proposal_ref": "ap_010",
    "content_type": "message",
    "template_id": "SENT_SLACK_INTERNAL_UPDATE_V1",
    "title": "社内共有：状況/論点/依頼（Slack）",
    "inputs": {
      "company_uid": "sf_0017F00002cwBDsQAM",
      "minutes_id": "31a6643a-9819-8052-8cdb-c3f93789c0e3",
      "signals": ["O2_ProjectIncrease_Company"],
      "people_refs": ["pp_001", "pp_003"],
      "asks": ["Supportにチケット背景の整理依頼", "CRMにオンボ用導線案の叩き台依頼"]
    },
    "prompt_hints": {
      "purpose_tag": "[CXM-SHARED]",
      "tone": "社内共有・短く・依頼は明確に",
      "must_include": ["TL;DR", "背景", "論点(最大3)", "依頼(Owner/Due)", "Links"],
      "do_not_include": ["顧客の個人情報", "不確定な断定"]
    }
  },
  "confidence": 0.7,
  "missing_fields": []
}

```

```json
{
  "proposal_id": "ap_011",
  "op": "create",
  "action": {
    "scope": "project",
    "scope_id": "1049531d",
    "related_project_id": "1049531d",
    "owner_role": "CRM",
    "action_type": "sent",
    "channel": "intercom",
    "purpose_tag": "[CXM-SHARED]",
    "audience_scope": "project",
    "audience_id": "1049531d",
    "title": "（Intercom配信）オンボーディング：次にやるべき設定の案内",
    "target": "Health↑",
    "priority": "medium",
    "due_at": null,
    "expected_window": "14d",
    "assignees": [
      { "assignee_type": "role", "value": "CRM" }
    ],
    "evidence_refs": [
      { "ref_type": "minutes_id", "ref_id": "31a6643a-9819-8052-8cdb-c3f93789c0e3" },
      { "ref_type": "signal_id", "ref_id": "R2_UsageDrop_WoW" }
    ],
    "suggested_next_steps": [
      "Intercomでプロジェクト利用者へ「次の設定手順」案内を送付",
      "反応と利用変化（14d）を確認し、次のコンテンツを改善"
    ]
  },
  "confidence": 0.7,
  "missing_fields": [],
  "content_suggestions": [
    { "content_type": "message", "template_id": "SENT_INTERCOM_MESSAGE_V1", "reason": "Intercom配信文面を統一" }
  ]
}
```


⸻

## 8. Evidence Reference Schema（根拠参照の型）

すべての提案は evidence_refs[] を持てる。

```json
{
  "ref_type": "minutes_id | minutes_quote | intercom_channel | intercom_conversation | slack_thread | ticket_id | signal_id | url",
  "ref_id": "string",
  "url": "string (optional)",
  "note": "optional"
}
```



⸻

## 9. UI編集に必要な差分管理（Proposal → Draft → Push）

### 9.1 推奨：UI編集は “draft_patch” として保存

提案に対する編集は、提案元JSONを壊さず、差分として保持する（監査・再生成に有利）。

```json
{
  "proposal_id": "pp_001",
  "draft_patch": [
    { "path": "/identity/display_name", "op": "replace", "value": "下村 〇〇" },
    { "path": "/identity/email", "op": "add", "value": "xxx@mashbeautylab.com" },
    { "path": "/relations/reports_to/target_display_name", "op": "replace", "value": "谷 〇〇" }
  ],
  "edited_by": "user_123",
  "edited_at": "2026-03-09T15:10:00+09:00"
}
```
Push時は “提案＋patch適用後” を NocoDB confirmed として保存する。

⸻

## 10. v1の出力制約（品質を担保する）
	•	People提案は最大 max_people 件（推奨20）
	•	Action提案は最大 max_actions 件（推奨12）
	•	すべての提案に confidence を付与（0〜1）
	•	missing_fields を必ず出力（UIで入力誘導するため）
	•	重要：Phaseの自動更新提案は出しても良いが、書き換えはしない（SSOT read-only）

⸻

## 11. 最低限のテスト観点（実装受け入れ）
	•	minutes 1件で People/Org/Action/Content が必ずJSONとして返る
	•	email無しの人物提案が成立する
	•	reports_to が曖昧な場合、confidenceが下がりmissing_infoに出る
	•	Action提案に related_project_id が入る（scope=companyでも原則）
	•	content_jobs が action に紐付く（linked_action_proposal_ref）

---
