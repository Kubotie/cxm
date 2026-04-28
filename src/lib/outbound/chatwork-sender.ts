// ─── Chatwork メッセージ送信 ───────────────────────────────────────────────────
// Chatwork API v2 を使用してメッセージをルームに投稿する。
// 環境変数: CHATWORK_API_TOKEN

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';

export interface ChatworkSendResult {
  ok:         boolean;
  error?:     string;
  messageId?: number;
}

export async function sendChatworkMessage(
  roomId: string,
  body: string,
): Promise<ChatworkSendResult> {
  const token = process.env.CHATWORK_API_TOKEN;
  if (!token) {
    return { ok: false, error: 'CHATWORK_API_TOKEN が未設定です' };
  }
  if (!roomId) {
    return { ok: false, error: 'roomId が空です' };
  }

  try {
    // Chatwork API は form-urlencoded を要求する
    const formData = new URLSearchParams({ body });
    const res = await fetch(`${CHATWORK_API_BASE}/rooms/${roomId}/messages`, {
      method:  'POST',
      headers: {
        'X-ChatWorkToken': token,
        'Content-Type':    'application/x-www-form-urlencoded',
      },
      body:  formData.toString(),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      return { ok: false, error: `Chatwork HTTP ${res.status}: ${errorBody || res.statusText}` };
    }

    const json = await res.json() as { message_id?: number };
    return { ok: true, messageId: json.message_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
