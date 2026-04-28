// ─── Slack メッセージ送信 ──────────────────────────────────────────────────────
// Slack Bot API (chat.postMessage) を使用してメッセージを投稿する。
// 環境変数: SLACK_BOT_TOKEN (xoxb-... 形式の Bot Token)

const SLACK_API_URL = 'https://slack.com/api/chat.postMessage';

export interface SlackSendResult {
  ok:     boolean;
  error?: string;
  ts?:    string;  // 送信成功時のタイムスタンプ
}

export async function sendSlackMessage(
  channelId: string,
  text: string,
  botToken?: string | null,
): Promise<SlackSendResult> {
  const token = botToken?.trim() || process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: 'SLACK_BOT_TOKEN が未設定です' };
  }
  if (!channelId) {
    return { ok: false, error: 'channelId が空です' };
  }

  try {
    const res = await fetch(SLACK_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ channel: channelId, text }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { ok: false, error: `Slack HTTP ${res.status}: ${res.statusText}` };
    }

    const json = await res.json() as { ok: boolean; error?: string; ts?: string };
    if (!json.ok) {
      return { ok: false, error: json.error ?? 'Slack API error' };
    }
    return { ok: true, ts: json.ts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
