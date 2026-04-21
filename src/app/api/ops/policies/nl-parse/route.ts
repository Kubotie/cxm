// ─── POST /api/ops/policies/nl-parse ──────────────────────────────────────────
//
// 自然言語のアラートポリシー記述を受け取り、構造化条件に変換する。
// フォールバック: OpenAI が未設定の場合は 503 を返す。
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
// {
//   nl_input:        string            // 例: "45日以上連絡のない会社に high アラートを出す"
//   object_type:     AlertObjectType   // 'company' | 'support_case' | 'support_queue'
//   signal_category: AlertSignalCategory // 'risk' | 'opportunity'
// }
//
// ── レスポンス ────────────────────────────────────────────────────────────────
// NlParseResponse {
//   proposed_conditions: StructuredCondition[]
//   proposed_output:     AlertPolicyOutput
//   condition_logic:     'AND' | 'OR'
//   interpretation_note: string
//   confidence:          'high' | 'medium' | 'low'
// }

import { NextRequest, NextResponse }  from 'next/server';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import { ALERT_CONDITION_FIELDS }     from '@/lib/policy/templates';
import type { NlParseRequest, NlParseResponse } from '@/lib/policy/types';

// ── JSON Schema for structured output ────────────────────────────────────────

const NL_PARSE_SCHEMA = {
  name: 'nl_parse_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      proposed_conditions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id:       { type: 'string' },
            field:    { type: 'string' },
            operator: {
              type: 'string',
              enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'not_in', 'contains', 'not_contains', 'is_null', 'is_not_null', 'regex'],
            },
            value:    { type: ['number', 'string', 'null'] },
            label:    { type: 'string' },
          },
          required: ['id', 'field', 'operator', 'value', 'label'],
          additionalProperties: false,
        },
      },
      proposed_output: {
        type: 'object',
        properties: {
          severity:           { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          title:              { type: 'string' },
          description:        { type: 'string' },
          recommended_action: { type: 'string' },
          category_tag:       { type: 'string' },
        },
        required: ['severity', 'title', 'description', 'recommended_action', 'category_tag'],
        additionalProperties: false,
      },
      condition_logic:     { type: 'string', enum: ['AND', 'OR'] },
      interpretation_note: { type: 'string' },
      confidence:          { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['proposed_conditions', 'proposed_output', 'condition_logic', 'interpretation_note', 'confidence'],
    additionalProperties: false,
  },
};

// ── システムプロンプト ─────────────────────────────────────────────────────────

function buildSystemPrompt(objectType: string): string {
  const availableFields = Object.entries(ALERT_CONDITION_FIELDS)
    .filter(([, v]) => v.objectTypes.includes(objectType))
    .map(([k, v]) => `  - ${k} (${v.type}): ${v.label}`)
    .join('\n');

  return `You are a policy condition parser for a Customer Success Management platform.
Your job is to convert a natural language alert policy description into structured conditions.

Object type being evaluated: ${objectType}

Available fields for this object type:
${availableFields}

Rules:
1. Map the user's intent to the closest available field(s).
2. Choose the most appropriate operator and numeric/string value.
3. Generate a human-readable label for each condition.
4. For output title/description, use {{variable}} placeholders where appropriate (e.g., {{company_name}}, {{blank_days}}, {{count}}).
5. Choose severity based on the urgency language used (critical/high/medium/low/info).
6. Set confidence to 'high' if the mapping is clear, 'medium' if approximate, 'low' if the intent is ambiguous.
7. Set condition_logic to 'AND' if all conditions must be true simultaneously, 'OR' if any one suffices.
8. interpretation_note must be in Japanese — explain your mapping decisions briefly.
9. All output strings (title, description, recommended_action, category_tag) should be in Japanese.
10. Always return valid JSON matching the schema exactly.`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Partial<NlParseRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  const { nl_input, object_type, signal_category } = body;

  if (!nl_input || !object_type || !signal_category) {
    return NextResponse.json(
      { error: 'nl_input / object_type / signal_category は必須です' },
      { status: 400 },
    );
  }

  if (nl_input.trim().length < 5) {
    return NextResponse.json(
      { error: '入力が短すぎます（5文字以上）' },
      { status: 400 },
    );
  }

  let openai: ReturnType<typeof getOpenAIClient>;
  let model: string;
  try {
    openai = getOpenAIClient();
    model  = getOpenAIModel();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const userPrompt = `対象: ${object_type} / シグナル分類: ${signal_category}

ユーザーの意図:
${nl_input.trim()}

上記を構造化条件に変換してください。`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system',  content: buildSystemPrompt(object_type) },
        { role: 'user',    content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: NL_PARSE_SCHEMA,
      },
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'AI から空のレスポンスが返りました' }, { status: 502 });
    }

    const parsed = JSON.parse(raw) as NlParseResponse;
    return NextResponse.json(parsed);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[nl-parse] OpenAI エラー:', err);
    return NextResponse.json({ error: `AI解析エラー: ${msg}` }, { status: 502 });
  }
}
