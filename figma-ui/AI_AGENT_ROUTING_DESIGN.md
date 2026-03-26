# AI Agent Routing と Content 出力UI 設計書

## 1. 基本方針

### 役割分担
- **Kocoro**: 主系 / 標準ルート
  - 軽量処理から重量処理まで対応
  - Skill や各種連携を柔軟に組み込み可能
  - ファイル生成対応
  - 実務ワークフローに深く組み込む前提

- **OpenRouter**: 代替 / 簡易ルート / fallback
  - Kocoro不具合時の代替措置
  - または一定のLLM機能だけで十分な場合に利用
  - 軽量な直接生成や簡易処理向け
  - 主系ではなく補助的な位置づけ

## 2. AI Agent設定インターフェース

```typescript
interface AIAgent {
  id: string;
  functionName: string;
  description: string;
  
  // Routing configuration
  primaryRouteType: "kocoro" | "openrouter";
  primaryRouteName: string;
  fallbackRouteType?: "kocoro" | "openrouter" | "none";
  fallbackRouteName?: string;
  fallbackCondition?: "primary_failure" | "timeout" | "unavailable" | "manual_switch_only";
  
  // Primary Route - Kocoro specific
  kocoro?: {
    agentName: string;
    agentId: string;
    apiEndpoint: string;
    authSetting: string;
    inputMapping: string;
    outputMapping: string;
  };
  
  // Primary Route - OpenRouter specific
  openrouter?: {
    model: string;
    provider: string;
    systemInstruction: string;
    additionalInstruction?: string;
    temperature: number;
    maxTokens: number;
    structuredOutputSchema?: string;
  };
  
  // Fallback Route - Kocoro specific
  fallbackKocoro?: {
    agentName: string;
    agentId: string;
    apiEndpoint: string;
    authSetting: string;
  };
  
  // Fallback Route - OpenRouter specific
  fallbackOpenrouter?: {
    model: string;
    provider: string;
    systemInstruction: string;
    temperature: number;
    maxTokens: number;
  };
  
  // Output configuration
  outputType: "text" | "markdown" | "json" | "file" | "mixed";
  fileOutputEnabled: boolean;
  fileType?: "pdf" | "pptx" | "docx" | "md" | "csv" | "xlsx" | "html" | "other";
  
  // Common settings
  timeout: number;
  retryPolicy: string;
  environment: "production" | "staging" | "development";
  enabled: boolean;
  status: "active" | "inactive" | "error";
  lastUpdated: string;
  updatedBy: string;
}
```

## 3. 管理対象AI機能（12種類）

1. **Signal Detection** - OpenRouter主系（軽量処理特化）
2. **Evidence Extraction** - OpenRouter主系（軽量処理特化）
3. **Alert Generation** - OpenRouter主系（軽量処理特化）
4. **Action Drafting** - Kocoro主系 + OpenRouter fallback
5. **Content Drafting** - Kocoro主系 + OpenRouter fallback
6. **Cluster Detection** - Kocoro主系 + OpenRouter fallback
7. **Log Extraction** - Kocoro主系 + OpenRouter fallback
8. **Log Summarization** - Kocoro主系 + OpenRouter fallback
9. **FAQ Drafting** - Kocoro主系 + OpenRouter fallback
10. **Help Drafting** - Kocoro主系 + OpenRouter fallback
11. **Proposal Drafting** - Kocoro主系 + OpenRouter fallback
12. **Audience Generation** - Kocoro主系 + OpenRouter fallback

## 4. Settings画面 - AI Agents一覧表示項目

| 項目 | 説明 |
|------|------|
| Function Name | AI機能名 |
| Description | 機能説明 |
| Primary Route | Primary Route Type (Kocoro/OpenRouter) + Name |
| Fallback Route | Fallback Route Type + Name (または None) |
| Output Type | text / markdown / json / file / mixed |
| File Output | ファイル出力が有効な場合はファイルタイプ表示 |
| Status | Active / Error / Disabled |
| Last Updated | 最終更新日時 |
| Updated By | 更新者 |

### 表示例

```
Signal Detection
└ Primary: OpenRouter - GPT-4 Turbo
└ Fallback: None
└ Output: json
└ File: -
└ Status: Active

Content Drafting
└ Primary: Kocoro - Content Creator Pro
└ Fallback: OpenRouter - Claude 3 Opus
└ Output: mixed
└ File: docx
└ Status: Active
```

## 5. Settings画面 - Agent編集詳細

### Kocoro設定項目
- Route Type: Kocoro
- Agent Name
- Agent ID
- API Endpoint
- Auth Setting
- Input Mapping
- Output Mapping
- Output Type (text / markdown / json / file / mixed)
- File Output Enabled (true/false)
- File Type (pdf / pptx / docx / md / csv / xlsx / html / other)
- Timeout
- Retry Policy
- Environment (production / staging / development)
- Enabled / Disabled

### OpenRouter設定項目
- Route Type: OpenRouter
- Model
- Provider
- System Instruction
- Additional Instruction
- Temperature
- Max Tokens
- Structured Output Schema (optional)
- Timeout
- Retry Policy
- Environment
- Enabled / Disabled

### Fallback設定項目
- Fallback Route Type (kocoro / openrouter / none)
- Fallback Agent/Model Name
- Fallback Condition
  - primary_failure: Primary失敗時
  - timeout: タイムアウト時
  - unavailable: 利用不可時
  - manual_switch_only: 手動切替のみ

## 6. Content側 - 出力受け取りUI設計

### インターフェース

```typescript
interface ContentDraft {
  id: string;
  name: string;
  draftType: string;
  status: string;
  company: string;
  companyId: string;
  linkedProject: string | null;
  linkedUser: string | null;
  owner: string;
  lastEdited: string;
  aiGenerated: boolean;
  
  aiOutput?: {
    // Primary Route info
    primaryRouteType: "kocoro" | "openrouter";
    primaryRouteName: string;
    
    // Fallback info
    fallbackUsed: boolean;
    fallbackRouteType?: "kocoro" | "openrouter";
    fallbackRouteName?: string;
    
    // Output
    outputType: "text" | "markdown" | "json" | "file" | "mixed";
    textOutput?: string;
    rawOutput?: string; // JSON or raw API response
    
    files?: Array<{
      id: string;
      name: string;
      type: "pdf" | "pptx" | "docx" | "md" | "csv" | "xlsx" | "html" | "other";
      size: string;
      createdAt: string;
      downloadUrl: string;
    }>;
    
    // Run info
    runInfo: {
      executedAt: string;
      duration: string;
      status: "success" | "failed" | "running";
      cost?: string;
      sourceContext?: string;
      linkedCompany?: string;
      linkedProject?: string;
      linkedUser?: string;
      linkedEvidence?: string[];
    };
  };
}
```

### タブ構成

Content編集Drawerで以下の4タブを表示：

#### 1. Preview タブ
- テキスト/Markdownの整形表示
- 人が読むメイン表示
- エディタで編集可能

#### 2. Raw Output タブ
- JSONや元の返却値を表示
- コードブロックで整形
- Manager向けデバッグ情報

#### 3. Files タブ
- 生成ファイル一覧
- ファイル名、タイプ、サイズ、作成日時
- プレビュー（可能な場合）
- ダウンロードボタン

#### 4. Run Info タブ
- Primary Route Type & Name
- Fallback Used: Yes/No
  - Yes の場合: Fallback Route Type & Name
- Execution Time
- Status
- Cost (if available)
- Source Context
- Linked Company / Project / User
- Linked Evidence / Actions

### UI例

```
┌─────────────────────────────────────────┐
│ Content Drafting Result                 │
├─────────────────────────────────────────┤
│ [Preview] [Raw Output] [Files] [Run Info]│
├─────────────────────────────────────────┤
│ Preview タブ内容:                        │
│                                         │
│ 【オンボーディング進捗確認】            │
│ 山田様、いつもお世話になっております。 │
│ ...                                     │
│                                         │
│ [編集エリア]                            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Run Info タブ内容:                      │
│                                         │
│ Primary Route                           │
│ ├ Type: Kocoro                         │
│ └ Name: Content Creator Pro            │
│                                         │
│ Fallback Used: No                       │
│                                         │
│ Execution                               │
│ ├ Time: 45.2秒                         │
│ ├ Status: Success                      │
│ └ Cost: ¥120                           │
│                                         │
│ Source Context                          │
│ ├ Company: テクノロジーイノベーション    │
│ ├ Project: プロジェクトA                │
│ ├ User: 山田 太郎（決裁者）            │
│ └ Evidence: 3 items                    │
└─────────────────────────────────────────┘
```

## 7. Content側CTA

### 残すCTA
- ✅ 実行する
- ✅ 再実行
- ✅ プレビューを見る
- ✅ ダウンロード（ファイル出力時）
- ✅ Libraryに登録
- ✅ Outboundで使う
- ✅ Linked Contextを見る

### 追加CTA
- ✅ Routeを確認（Run Infoタブへ）
- ✅ 実行ログを見る
- ✅ Fallback使用有無を確認
- ✅ Assetとして保存（ファイル出力時）

### 削除CTA
- ❌ 最終送信実行（Outboundに移譲）
- ❌ 監査設定変更（Settingsで実施）
- ❌ Agent routingの直接編集（Settingsで実施）

## 8. 権限管理

### Settings - AI Agents / Agent Routing
- **編集可能**: Admin, Manager
- **閲覧のみ**: Lead (必要に応じて)
- **非表示**: 一般ユーザー

### Content - 出力閲覧
- **自分の実行結果**: 全ユーザーが閲覧可能
- **Route詳細編集**: 不可（Settingsで実施）

## 9. Audit連携

### 追跡対象イベント

#### Agent Routing変更
- **agent_routing_changed**: Agent Routingが変更された
- **primary_route_changed**: Primary Routeが変更された
- **fallback_route_changed**: Fallback Routeが変更された
- **kocoro_agent_changed**: Kocoro Agent設定が変更された
- **openrouter_model_changed**: OpenRouter Model設定が変更された
- **fallback_condition_changed**: Fallback Conditionが変更された

#### Content実行結果
- **content_ai_executed**: Content AIが実行された
  - route_used: kocoro / openrouter
  - fallback_used: true / false
  - file_generated: true / false
  - execution_result: success / failed

### Audit表示例

```
Event: Primary Route Changed
Actor: 山本 一郎 (Manager)
Target: Content Drafting (AI Agent)
Timestamp: 2026-03-17 14:30:00
Result: Success

Changes:
  Primary Route Type: openrouter → kocoro
  Primary Route Name: Claude 3 Opus → Content Creator Pro
```

## 10. モックデータ例

### Signal Detection (OpenRouter主系)
```typescript
{
  id: "agent-1",
  functionName: "Signal Detection",
  description: "顧客データからHealth/Risk/Opportunityシグナルを抽出",
  primaryRouteType: "openrouter",
  primaryRouteName: "GPT-4 Turbo",
  fallbackRouteType: "none",
  fallbackCondition: "primary_failure",
  openrouter: {
    model: "gpt-4-turbo-2024-04-09",
    provider: "OpenAI",
    systemInstruction: "Analyze customer data and extract Health/Risk/Opportunity signals.",
    additionalInstruction: "Focus on health, risk, and opportunity signals with high precision.",
    temperature: 0.3,
    maxTokens: 2000,
  },
  outputType: "json",
  fileOutputEnabled: false,
  timeout: 30,
  retryPolicy: "3回リトライ",
  environment: "production",
  enabled: true,
  status: "active",
  lastUpdated: "2026-03-15",
  updatedBy: "山本 一郎",
}
```

### Content Drafting (Kocoro主系 + OpenRouter fallback)
```typescript
{
  id: "agent-5",
  functionName: "Content Drafting",
  description: "顧客文脈つきコンテンツ作成",
  primaryRouteType: "kocoro",
  primaryRouteName: "Content Creator Pro",
  fallbackRouteType: "openrouter",
  fallbackRouteName: "Claude 3 Opus",
  fallbackCondition: "primary_failure",
  kocoro: {
    agentName: "Content Creator Pro",
    agentId: "kocoro-agent-005",
    apiEndpoint: "https://api.kocoro.ai/agents/content-draft/execute",
    authSetting: "Bearer token configured",
    inputMapping: "company, project, user, evidence → context",
    outputMapping: "content_text, subject_line, cta, attachments",
  },
  fallbackOpenrouter: {
    model: "claude-3-opus-20240229",
    provider: "Anthropic",
    systemInstruction: "Create customer-context content drafts with professional tone.",
    additionalInstruction: "Maintain personalization and relevance to customer context.",
    temperature: 0.6,
    maxTokens: 4000,
  },
  outputType: "mixed",
  fileOutputEnabled: true,
  fileType: "docx",
  timeout: 60,
  retryPolicy: "3回リトライ",
  environment: "production",
  enabled: true,
  status: "active",
  lastUpdated: "2026-03-15",
  updatedBy: "山本 一郎",
}
```

## 11. 実装チェックリスト

### Settings側
- [x] AIAgent インターフェース更新
- [x] mockAIAgents データ更新（12機能）
- [ ] テーブル表示更新（Primary/Fallback表示）
- [ ] 詳細Drawer更新（Kocoro/OpenRouter切替）
- [ ] 説明文更新（Kocoro主系の明示）

### Content側
- [ ] ContentDraft インターフェース更新
- [ ] タブ構成実装（Preview/Raw/Files/RunInfo）
- [ ] Run Info表示実装
- [ ] Fallback使用有無表示
- [ ] CTA整理

### Audit側
- [ ] Agent Routing変更イベント追加
- [ ] Content実行結果イベント追加

## 12. まとめ

この設計により、以下が実現されます：

1. **Kocoroを主系として明確に位置づけ**
   - 軽量〜重量処理まで対応
   - ファイル生成対応
   - 実務ワークフローの中核

2. **OpenRouterを代替/簡易ルートとして位置づけ**
   - Fallback機能
   - 軽量処理特化（Signal Detection等）
   - 補助的な役割

3. **Primary + Fallback の明確なRouting構造**
   - 各機能ごとに設定可能
   - Fallback条件の管理
   - 実行結果の追跡

4. **Content側で実行結果を詳細確認**
   - Preview, Raw Output, Files, Run Info
   - Route使用状況の確認
   - Fallback使用の可視化

5. **権限とAuditの適切な管理**
   - Settings編集はManager/Adminのみ
   - 変更履歴の追跡
   - 実行結果の記録
