// ─── HTML / Slack / Chatwork フォーマット変換 ─────────────────────────────────
// Slack のメッセージ記法を Chatwork の記法に変換する。
// メッセージは Slack 形式で入力し、Chatwork 送信時にこの関数で変換する。
//
// Slack    → Chatwork
// *bold*   → [b]bold[/b]
// _italic_ → [i]italic[/i]
// ~strike~ → [s]strike[/s]
// `code`   → [code]code[/code]
// ```block``` → [code]block[/code]
// <URL|text> → text ( URL )
// <URL>    → URL
// • / - (行頭) → ・

/**
 * メッセージ先頭行を件名として抽出する。
 * 先頭行（最初の \n まで）を subject、残りを body として返す。
 * 先頭行が空・短すぎる場合は subject を空文字で返す。
 */
export function extractSubjectFromBody(text: string): { subject: string; body: string } {
  const idx = text.indexOf('\n');
  if (idx === -1) return { subject: text.trim(), body: '' };
  const subject = text.slice(0, idx).trim();
  const body    = text.slice(idx + 1).trimStart();
  return { subject, body };
}

/**
 * Slack 記法をプレーンテキストに変換する（メール本文用）。
 * Markdown 記号を除去し、読みやすいプレーンテキストにする。
 */
export function slackToPlainText(text: string): string {
  return text
    // コードブロック → そのままの中身
    .replace(/```([^`]*)```/gs, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    // 太字・斜体・打ち消し → 中身のみ
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~([^~\n]+)~/g, '$1')
    // リンク <URL|text> → text（URL）
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2（$1）')
    // リンク <URL> → URL のみ
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // メンション
    .replace(/<!here>/g, '（全員）')
    .replace(/<!channel>/g, '（全員）')
    // 箇条書き
    .replace(/^[•·]\s*/gm, '・')
    .replace(/^-\s+/gm, '・');
}

/**
 * 件名を Slack メッセージのタイトルとして付加する（先頭行として挿入）。
 * Slack: *{subject}*\n\n{body}
 */
export function addSubjectToSlack(subject: string, body: string): string {
  if (!subject) return body;
  return `*${subject}*\n\n${body}`;
}

/**
 * 件名を Chatwork メッセージのタイトルとして付加する。
 * Chatwork: [info][title]{subject}[/title]{body}[/info]
 */
export function addSubjectToChatwork(subject: string, body: string): string {
  if (!subject) return body;
  return `[info][title]${subject}[/title]\n${body}[/info]`;
}

// ─── HTML (Tiptap 出力) → 各チャンネル変換 ───────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function processListItems(inner: string, prefix: (i: number) => string): string {
  let i = 0;
  // リストアイテム先頭の箇条書き文字（ユーザーが手入力した場合も考慮）を除去
  const clean = (s: string) => s.trim().replace(/^[•·・]\s*/, '');
  let out = inner.replace(
    /<li[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/gi,
    (_, c) => `${prefix(++i)}${clean(c)}\n`,
  );
  out = out.replace(
    /<li[^>]*>([\s\S]*?)<\/li>/gi,
    (_, c) => `${prefix(++i)}${clean(c)}\n`,
  );
  return out;
}

/**
 * Tiptap が出力する HTML を Slack 記法に変換する。
 */
export function htmlToSlack(html: string): string {
  let t = html;
  // コードブロック（pre > code）—— 先に処理
  t = t.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, c) => '```\n' + decodeHtmlEntities(c.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')) + '\n```');
  // インラインコード
  t = t.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,
    (_, c) => '`' + decodeHtmlEntities(c.replace(/<[^>]+>/g, '')) + '`');
  // 太字・斜体
  t = t.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '*$1*');
  t = t.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '_$1_');
  // リンク
  t = t.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '<$1|$2>');
  // 見出し
  t = t.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '*$1*\n');
  // 番号付きリスト
  t = t.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_, inner) => processListItems(inner, i => `${i}. `));
  // 箇条書き
  t = t.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, inner) => processListItems(inner, () => '• '));
  // 残り li（安全網）
  t = t.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n');
  // 段落
  t = t.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n');
  // 改行・水平線
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<hr[^>]*\/?>/gi, '---\n');
  // 残りタグ除去
  t = t.replace(/<[^>]+>/g, '');
  t = decodeHtmlEntities(t);
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Tiptap が出力する HTML を Chatwork 記法に変換する。
 */
export function htmlToChatwork(html: string): string {
  let t = html;
  t = t.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, c) => '[code]\n' + decodeHtmlEntities(c.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')) + '\n[/code]');
  t = t.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,
    (_, c) => '[code]' + decodeHtmlEntities(c.replace(/<[^>]+>/g, '')) + '[/code]');
  t = t.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '[b]$1[/b]');
  t = t.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '[i]$1[/i]');
  t = t.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2（$1）');
  t = t.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '[b]$1[/b]\n');
  t = t.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_, inner) => processListItems(inner, i => `${i}. `));
  t = t.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, inner) => processListItems(inner, () => '・'));
  t = t.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '・$1\n');
  t = t.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<hr[^>]*\/?>/gi, '------\n');
  t = t.replace(/<[^>]+>/g, '');
  t = decodeHtmlEntities(t);
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Tiptap が出力する HTML をプレーンテキストに変換する（メール本文用）。
 */
export function htmlToPlainText(html: string): string {
  let t = html;
  t = t.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, c) => decodeHtmlEntities(c.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')) + '\n');
  t = t.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,
    (_, c) => decodeHtmlEntities(c.replace(/<[^>]+>/g, '')));
  t = t.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '$1');
  t = t.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '$1');
  t = t.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => href === text ? href : `${text}（${href}）`);
  t = t.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '$1\n');
  t = t.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_, inner) => processListItems(inner, i => `${i}. `));
  t = t.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, inner) => processListItems(inner, () => '・'));
  t = t.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '・$1\n');
  t = t.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<hr[^>]*\/?>/gi, '---\n');
  t = t.replace(/<[^>]+>/g, '');
  t = decodeHtmlEntities(t);
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * メッセージ内の変数を実際の値に置換する。
 * {{company_name}} → 企業名
 * {{name}}         → 受信者名（省略時は空文字）
 */
export function applyVariables(
  text: string,
  companyName: string,
  recipientName = '',
): string {
  return text
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{name\}\}/g, recipientName);
}

// ─── 従来の Slack 記法変換（後方互換） ────────────────────────────────────────

export function slackToChatwork(text: string): string {
  return text
    // コードブロック（```...```）→ [code]...[/code]  ※先に処理
    .replace(/```([^`]*)```/gs, '[code]$1[/code]')
    // インラインコード
    .replace(/`([^`\n]+)`/g, '[code]$1[/code]')
    // 太字
    .replace(/\*([^*\n]+)\*/g, '[b]$1[/b]')
    // 斜体
    .replace(/_([^_\n]+)_/g, '[i]$1[/i]')
    // 打ち消し
    .replace(/~([^~\n]+)~/g, '[s]$1[/s]')
    // リンク <URL|text> → text（URL）
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2（$1）')
    // リンク <URL> → URL のみ
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // Slack 絵文字メンション <!here> <!channel>
    .replace(/<!here>/g, '[To(all)]')
    .replace(/<!channel>/g, '[To(all)]')
    // 箇条書き: 行頭の • または - をChatwork の ・ に
    .replace(/^[•·]\s*/gm, '・')
    .replace(/^-\s+/gm, '・');
}
