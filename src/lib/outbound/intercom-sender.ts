// ─── Intercom メール送信（Outbound）─────────────────────────────────────────────
// Intercom Conversations API を使用して、メールアドレス宛にメッセージを送信する。
// 環境変数: TOKEN_INTERCOM
//
// 送信先: SF contacts（company_people.email）のメールアドレスを使用。
// Intercom 内に該当連絡先が存在すれば紐付け、なければリードとして新規作成される。
//
// 送信者: fromAdminId が指定された場合はそのAdmin、なければトークン紐付けのデフォルトAdmin。

const INTERCOM_API_BASE = 'https://api.intercom.io';

export interface IntercomSendResult {
  ok:             boolean;
  error?:         string;
  conversationId?: string;
}

export async function sendIntercomMail(
  target:       { email: string },
  subject:      string,
  body:         string,
  fromAdminId?: string | null,
): Promise<IntercomSendResult> {
  const token = process.env.TOKEN_INTERCOM;
  if (!token) {
    return { ok: false, error: 'TOKEN_INTERCOM が未設定です' };
  }
  if (!target.email) {
    return { ok: false, error: 'メールアドレスが空です' };
  }
  if (!fromAdminId) {
    return { ok: false, error: 'intercom_admin_id が未設定です。NocoDB staff_identify テーブルを確認してください。' };
  }

  const from = { type: 'admin', id: fromAdminId };

  try {
    const res = await fetch(`${INTERCOM_API_BASE}/messages`, {
      method:  'POST',
      headers: {
        'Authorization':    `Bearer ${token}`,
        'Content-Type':     'application/json',
        'Accept':           'application/json',
        'Intercom-Version': '2.11',
      },
      body: JSON.stringify({
        message_type: 'email',
        subject,
        body,
        template:    'plain',
        from,
        to: { type: 'contact', email: target.email },
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      return { ok: false, error: `Intercom HTTP ${res.status}: ${errorBody || res.statusText}` };
    }

    const json = await res.json() as { id?: string };
    return { ok: true, conversationId: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
