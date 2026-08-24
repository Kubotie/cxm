// ─── ページ AI アシスタントのエージェントループ（サーバーサイド専用）──────────
//
// 既存の OpenRouter クライアント（src/lib/anthropic/client.ts）をそのまま使う。
// 新しい SDK / プロバイダを増やさないのは、このリポジトリの AI 呼び出しが
// すべて OpenRouter + OpenAI SDK 形式で通っており、
// ストリーミングとツール呼び出しの実装済みパターンがあるため。
//
// 流れ:
//   1. 画面が申告した snapshot をシステムプロンプトに載せる
//   2. モデルは足りなければ fetch_page_data で内部 API を叩いて深掘りする
//   3. ツール結果を会話に足して再度モデルへ。テキストが出たら終了
//
// 内部 API を叩くときは **リクエストの Cookie をそのまま転送する**。
// この API 群は cxm_user_uid Cookie でユーザーを解決するため、
// 転送しないと「担当顧客」系のエンドポイントが空を返す。

import type OpenAI from 'openai';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import { resolveDataSourcePath, renderDataSourceCatalog } from './data-sources';
import type { AiChatMessage, AiChatToolCall } from './chat-store';
import type { AiChatRequestContext } from './page-context';
import { MAX_INSTRUCTIONS_LEN, type UserAiPrefs } from './user-ai-prefs';

// ── 制限値 ────────────────────────────────────────────────────────────────────

/** 画面スナップショットをプロンプトに載せる上限（文字数）。超過分は切って深掘りに回す */
const SNAPSHOT_CHAR_BUDGET = 80_000;
/** ツール1回の結果をモデルに渡す上限（文字数） */
const TOOL_RESULT_CHAR_BUDGET = 40_000;
/** ツール呼び出しの往復上限。無限ループと課金暴発の両方を止める */
const MAX_TOOL_ROUNDS = 6;
/** 会話履歴としてモデルに渡す直近メッセージ数 */
const HISTORY_LIMIT = 20;

// ── SSE イベント ──────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'thread';   threadId: string; title: string }
  | { type: 'thinking'; delta: string }
  | { type: 'text';     delta: string }
  | { type: 'tool';     path: string; status: 'start' | 'ok' | 'error'; summary?: string }
  | { type: 'done';     message: AiChatMessage }
  | { type: 'error';    message: string };

// ── ツール定義 ────────────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_page_data',
      description:
        'この画面のデータ取得元（内部 API）を GET して生の JSON を読む。'
        + '画面スナップショットに無い項目・切り詰められた部分・別条件での再集計が必要なときに使う。'
        + 'システムプロンプトのデータ源カタログに載っているパスだけ指定できる。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              '内部 API パス。クエリ込みで指定する。例: /api/company/abc123/timeseries?days=30',
          },
          reason: {
            type: 'string',
            description: 'なぜこれを読む必要があるかを一文で。UI に表示される。',
          },
        },
        required: ['path'],
      },
    },
  },
];

// ── システムプロンプト ────────────────────────────────────────────────────────

function truncate(value: string, limit: number): { text: string; truncated: boolean } {
  if (value.length <= limit) return { text: value, truncated: false };
  return { text: value.slice(0, limit), truncated: true };
}

function buildSystemPrompt(ctx: AiChatRequestContext, userLabel: string, instructions: string): string {
  const rawSnapshot = ctx.snapshot === undefined
    ? '(この画面はスナップショットを申告していない)'
    : JSON.stringify(ctx.snapshot, null, 0);
  const snap = truncate(rawSnapshot, SNAPSHOT_CHAR_BUDGET);

  // 取得済みと未取得を分けて見せる。
  // 一緒に並べると「画面が持っているデータ」と「まだ読んでいないデータ」の区別がつかず、
  // モデルが未取得のものを取らずに総合判断を書き始める（実際に起きた）。
  const loaded   = ctx.sources.filter(s => s.loaded !== false);
  const notLoaded = ctx.sources.filter(s => s.loaded === false);

  const fmt = (s: typeof ctx.sources[number]) =>
    `- ${s.label}: ${s.endpoint}${s.description ? ` — ${s.description}` : ''}`;

  const loadedBlock = loaded.length > 0
    ? loaded.map(fmt).join('\n')
    : '(なし)';

  const notLoadedBlock = notLoaded.length > 0
    ? notLoaded.map(fmt).join('\n')
    : '(なし。この画面のデータはすべてスナップショットに入っている)';

  return `あなたは CXM（顧客前進 OS）の画面内アシスタントです。
利用者は Ptengine の CSM / マーケティング担当です。現在の利用者: ${userLabel}

# 役割
利用者が今見ている画面について、自然言語で何でも答える。
数字の意味、どこから来たデータか、何をすべきかを、**このアプリの実データに基づいて**説明する。

# 現在の画面
- 画面名: ${ctx.title}
- パス: ${ctx.pathname}
- 画面の役割: ${ctx.description}
${ctx.hints ? `- 画面の状態: ${JSON.stringify(ctx.hints)}` : ''}

# データ源 A: 取得済み（下のスナップショットに入っている）
${loadedBlock}

# データ源 B: **未取得**（スナップショットに入っていない）
${notLoadedBlock}

B は「この画面が持ちうるが、まだ読んでいないデータ」である。
**B が空でない状態で総合判断を書くと、必ず判断材料が欠ける。** 下の質問タイプの規則に従うこと。

# 画面が今表示しているデータ（スナップショット）
${snap.truncated
  ? `※ 全体が大きいため先頭 ${SNAPSHOT_CHAR_BUDGET} 文字で切っています。切れた部分が必要なら fetch_page_data で取得元から読み直してください。`
  : ''}
\`\`\`json
${snap.text}
\`\`\`

# 深掘りに使えるデータ源カタログ（fetch_page_data の path に指定できるもの）
${renderDataSourceCatalog()}

# 質問タイプごとの手順（最重要）

質問を2種類に分けて、**手順を変える**。

## 点の質問 — 単一の事実を聞かれている
例: 「この数字は何？」「PV消化率は？」「この画面は何を見る画面？」「更新日はいつ？」
→ スナップショットに答えがあればそのまま答える。ツールは呼ばない。

## 面の質問 — 判断・推奨・優先順位・原因を聞かれている
例: 「何を提案すればいい？」「優先度が高いのはどれ？」「なぜこうなっている？」
　　「次に何をすべき？」「この顧客の状況をまとめて」「リスクは？」
→ **答えを書き始める前に、判断に効く未取得ソース（データ源 B）を fetch_page_data で揃える。**
　 1回のターンで複数のツールを並列に呼んでよい。むしろそうすべき。
　 揃えてから初めて結論を書く。

面の質問での必須チェック:
1. データ源 B に、その判断に関係するものが残っていないか。残っていれば取る。
2. **「〜すべき」「〜を登録してください」と行動を勧める前に、既存のアクション・
　 予定・履歴を必ず読む**（例: 個社なら /api/company/{uid}/actions）。
　 既にあるものを「新規にやれ」と勧めるのは、この画面で最も価値を落とす失敗である。
3. 人物名を出すなら、連絡先データ（people）で実在と役割を確認する。
4. 「外部機会なし」「接点なし」のような **不在の主張** は、判定スコアの文言を
　 転記するのではなく、該当ソースを自分で読んで確認したうえで書く。

# 回答のルール
0. **上の「点の質問 / 面の質問」は内部の手順である。回答文に書かない。**
   「この質問は面の質問です」「まず未取得データを確認します」のような前置き・実況を
   一切書かず、いきなり結論から始める。データ取得の実行状況は UI 側が表示している。
1. 必ず日本語で答える。結論を先に書き、簡潔に要点だけ述べる。
2. 数字を出すときは必ずどのデータから読んだかを示す（例: 「提案準備の readiness.score」）。
3. データが無いことは「無い」と言う。推測で数字を作らない。事実と解釈は分けて書く。
4. 判定 API の説明文（「外部機会は観測されていません」等）を、自分で確認した事実として
   書かない。転記なら「提案準備の判定文では〜」と出典を明示する。
5. 件数が多いエンドポイントはクエリで絞る。無関係なソースを網羅的に取る必要はない。
   **効くものを取る。取らなかった理由が説明できる状態にする。**
6. このアシスタントは**読み取り専用**。データの作成・更新・削除・送信はできない。
   依頼されたら「画面のどのボタンから操作するか」を案内する。
7. Markdown で書く。表・箇条書きを使ってよい。見出しは ### 以下にする。
${instructions.trim() ? `
# 利用者本人の指示（設定画面で登録されたもの）

この利用者は次の前提・スタイルを指定している。上のルールと矛盾しない範囲で従うこと。
矛盾する場合は上のルール（特に「推測で数字を作らない」「読み取り専用」）を優先する。

"""
${instructions.trim().slice(0, MAX_INSTRUCTIONS_LEN)}
"""
` : ''}`;
}

// ── ツール実行 ────────────────────────────────────────────────────────────────

interface ToolOutcome {
  /** モデルに返す内容 */
  content: string;
  record:  AiChatToolCall;
}

async function runFetchPageData(
  rawArgs: string,
  origin: string,
  cookieHeader: string,
): Promise<ToolOutcome> {
  let parsed: { path?: string; reason?: string };
  try {
    parsed = JSON.parse(rawArgs || '{}') as { path?: string; reason?: string };
  } catch {
    return {
      content: 'エラー: 引数の JSON をパースできませんでした。',
      record:  { name: 'fetch_page_data', path: '(不正な引数)', ok: false, summary: '引数パース失敗' },
    };
  }

  const resolved = resolveDataSourcePath(parsed.path ?? '');
  if (!resolved.ok || !resolved.path) {
    return {
      content: `エラー: ${resolved.reason}`,
      record:  { name: 'fetch_page_data', path: parsed.path ?? '', ok: false, summary: resolved.reason ?? '不許可' },
    };
  }

  try {
    const res = await fetch(`${origin}${resolved.path}`, {
      method:  'GET',
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache:   'no-store',
    });

    const text = await res.text();
    if (!res.ok) {
      const brief = text.slice(0, 500);
      return {
        content: `エラー: ${resolved.path} が ${res.status} を返しました。${brief}`,
        record:  { name: 'fetch_page_data', path: resolved.path, ok: false, summary: `HTTP ${res.status}` },
      };
    }

    const { text: body, truncated } = truncate(text, TOOL_RESULT_CHAR_BUDGET);
    const note = truncated
      ? `\n\n（※ 応答が大きいため先頭 ${TOOL_RESULT_CHAR_BUDGET} 文字で切っています。必要ならクエリで絞って再取得してください）`
      : '';

    return {
      content: `${resolved.path} の応答:\n${body}${note}`,
      record:  {
        name: 'fetch_page_data',
        path: resolved.path,
        ok:   true,
        summary: `${(text.length / 1024).toFixed(1)}KB 取得${truncated ? '（切り詰めあり）' : ''}`,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: `エラー: ${resolved.path} の取得に失敗しました。${msg}`,
      record:  { name: 'fetch_page_data', path: resolved.path, ok: false, summary: msg.slice(0, 120) },
    };
  }
}

// ── エージェントループ ────────────────────────────────────────────────────────

export interface RunAgentInput {
  /** 保存済みの会話（今回のユーザー発言を含む） */
  messages: AiChatMessage[];
  context:  AiChatRequestContext;
  userLabel: string;
  /** 内部 API を叩くためのオリジン */
  origin:   string;
  /** 転送する Cookie ヘッダー */
  cookie:   string;
  /** SSE 送信 */
  emit:     (event: AgentEvent) => void;
  signal?:  AbortSignal;
  /** 利用者ごとの AI 設定（回答スタイル / モデル）。未指定なら既定で動く */
  prefs?:   UserAiPrefs | null;
}

/**
 * ツール呼び出し込みでアシスタント応答を1件生成する。
 * 戻り値は保存対象の assistant メッセージ。
 */
export async function runChatAgent(input: RunAgentInput): Promise<AiChatMessage> {
  const { messages, context, userLabel, origin, cookie, emit, signal, prefs } = input;

  const client = getAnthropicClient();
  // 利用者が選んだモデルを優先。未選択なら環境変数の既定（ANTHROPIC_MODEL）
  const model  = prefs?.model || getAnthropicModel();

  const convo: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context, userLabel, prefs?.instructions ?? '') },
    ...messages.slice(-HISTORY_LIMIT).map(m => ({
      role:    m.role,
      content: m.content,
    }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ];

  const toolRecords: AiChatToolCall[] = [];
  let answer = '';

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // 最終ラウンドはツールを外して必ず文章で締めさせる
    const lastRound = round === MAX_TOOL_ROUNDS;

    const stream = await client.chat.completions.create({
      model,
      messages:   convo,
      max_tokens: 4_000,
      stream:     true,
      ...(lastRound ? {} : { tools: TOOLS, tool_choice: 'auto' as const }),
    }, { signal });

    let text = '';
    // index ごとに tool_call を組み立てる（複数同時呼び出しに対応）
    const pending = new Map<number, { id: string; name: string; args: string }>();
    let finish = '';

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      // OpenRouter は思考を reasoning フィールドで流す
      const reasoning = (choice.delta as { reasoning?: string } | undefined)?.reasoning;
      if (reasoning) emit({ type: 'thinking', delta: reasoning });

      const content = choice.delta?.content;
      if (content) {
        text += content;
        emit({ type: 'text', delta: content });
      }

      for (const tc of choice.delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        const cur = pending.get(idx) ?? { id: '', name: '', args: '' };
        if (tc.id)                 cur.id   = tc.id;
        if (tc.function?.name)     cur.name = tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        pending.set(idx, cur);
      }

      if (choice.finish_reason) finish = choice.finish_reason;
    }

    answer += text;

    // ツール呼び出しが無ければ完了
    if (pending.size === 0) {
      if (finish === 'length') {
        answer += '\n\n（※ 応答が上限に達したため途中で切れています）';
        emit({ type: 'text', delta: '\n\n（※ 応答が上限に達したため途中で切れています）' });
      }
      break;
    }

    const calls = Array.from(pending.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

    convo.push({
      role:      'assistant',
      content:   text || null,
      tool_calls: calls.map(c => ({
        id:       c.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        type:     'function' as const,
        function: { name: c.name, arguments: c.args },
      })),
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    // ツールは並列に実行する（互いに独立した GET）
    const outcomes = await Promise.all(calls.map(async call => {
      if (call.name !== 'fetch_page_data') {
        return {
          call,
          outcome: {
            content: `エラー: 未知のツール ${call.name} は呼べません。`,
            record:  { name: call.name, path: '', ok: false, summary: '未知のツール' },
          } satisfies ToolOutcome,
        };
      }
      let shownPath = '';
      try {
        shownPath = (JSON.parse(call.args || '{}') as { path?: string }).path ?? '';
      } catch { /* 表示用なので失敗は無視 */ }
      emit({ type: 'tool', path: shownPath, status: 'start' });

      const outcome = await runFetchPageData(call.args, origin, cookie);
      emit({
        type:    'tool',
        path:    outcome.record.path || shownPath,
        status:  outcome.record.ok ? 'ok' : 'error',
        summary: outcome.record.summary,
      });
      return { call, outcome };
    }));

    for (const { call, outcome } of outcomes) {
      toolRecords.push(outcome.record);
      convo.push({
        role:         'tool',
        tool_call_id: call.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        content:      outcome.content,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
    }
  }

  if (!answer.trim()) {
    answer = '回答を生成できませんでした。質問を変えてもう一度お試しください。';
    emit({ type: 'text', delta: answer });
  }

  return {
    role:      'assistant',
    content:   answer,
    createdAt: new Date().toISOString(),
    ...(toolRecords.length > 0 ? { toolCalls: toolRecords } : {}),
  };
}
