// ─── ドキュメントのテキスト抽出 ───────────────────────────────────────────────
//
// URL またはアップロードされたファイルから、LLM に渡せるプレーンテキストを取り出す。
// 外部WHO情報の登録（§11）で「URLを貼るだけ」「PDFを投げるだけ」を成立させるために使う。
//
// 対応:
//   - HTML  … script/style/nav 等を落として本文テキストを抽出
//   - PDF   … unpdf（pdfjs ベース）で全ページのテキストを抽出
//   - テキスト系（txt / md / csv） … そのまま
//
// このファイルはサーバーサイド専用。unpdf を動的 import しているのでブラウザから import しないこと。

/** LLM に渡すテキストの上限。これを超える分は切り捨てる */
export const MAX_EXTRACTED_CHARS = 40_000;

export interface ExtractedDocument {
  text: string;
  /** ページタイトル / PDF の冒頭行 / ファイル名。出典名称の初期値に使う */
  title: string | null;
  kind: 'html' | 'pdf' | 'text';
  /** 元のサイズ（バイト）。UI で「大きすぎる」を伝えるため */
  bytes: number | null;
  /** 切り捨てが発生したか */
  truncated: boolean;
}

/**
 * URL の直接取得が拒否されたことを表すエラー。
 * 大手企業サイトは CDN の Bot 対策で 403 を返すことがあり、
 * その場合は呼び出し側で Web 検索経由の取得にフォールバックする。
 */
export class FetchBlockedError extends Error {
  constructor(public readonly status: number, public readonly url: string) {
    super(`URL の取得に失敗しました（HTTP ${status}）: ${url}`);
    this.name = 'FetchBlockedError';
  }
  /** 直接取得を諦めて別経路に切り替えるべき状態か */
  get isBlocked(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 429 || this.status >= 500;
  }
}

// ── URL から ────────────────────────────────────────────────────────────────

/**
 * URL を取得してテキスト化する。
 * User-Agent を付けないと弾くサイトがあるため、ブラウザ相当を名乗る。
 */
export async function extractTextFromUrl(url: string): Promise<ExtractedDocument> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/pdf,text/plain,*/*',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new FetchBlockedError(res.status, url);
  }

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const buf = new Uint8Array(await res.arrayBuffer());

  if (contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
    return await fromPdf(buf);
  }
  if (contentType.includes('html') || contentType === '') {
    return fromHtml(new TextDecoder('utf-8').decode(buf), buf.length);
  }
  return fromPlain(new TextDecoder('utf-8').decode(buf), buf.length);
}

// ── アップロードファイルから ─────────────────────────────────────────────────

export async function extractTextFromFile(file: File): Promise<ExtractedDocument> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const name = file.name || '';
  const type = (file.type || '').toLowerCase();

  if (type.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
    const doc = await fromPdf(buf);
    return { ...doc, title: doc.title ?? name };
  }
  if (type.includes('html') || /\.html?$/i.test(name)) {
    const doc = fromHtml(new TextDecoder('utf-8').decode(buf), buf.length);
    return { ...doc, title: doc.title ?? name };
  }
  const doc = fromPlain(new TextDecoder('utf-8').decode(buf), buf.length);
  return { ...doc, title: name || null };
}

// ── 形式別 ────────────────────────────────────────────────────────────────────

async function fromPdf(buf: Uint8Array): Promise<ExtractedDocument> {
  // unpdf はサーバーサイドでのみ読み込む（クライアントバンドルに載せない）
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  const raw = String(text ?? '').replace(/\r\n/g, '\n').trim();

  return clip({ text: raw, title: guessPdfTitle(raw), kind: 'pdf', bytes: buf.length });
}

function fromHtml(html: string, bytes: number): ExtractedDocument {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/\s+/g, ' ').trim() || null;

  let body = html
    .replace(/<(script|style|noscript|nav|header|footer|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  body = body.replace(/<[^>]+>/g, '\n');
  body = decodeEntities(body);

  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 4);
  // 連続する重複行（ナビの繰り返しなど）を畳む
  const dedup: string[] = [];
  for (const l of lines) if (dedup[dedup.length - 1] !== l) dedup.push(l);

  return clip({ text: dedup.join('\n'), title, kind: 'html', bytes });
}

/**
 * PDF の文書表題を推定する。
 *
 * 適時開示やプレスリリースの PDF は「日付 → 各位 → 会社名 → 連絡先 → 表題」の順に並ぶため、
 * 単純に「最初の意味のある行」を取ると日付が拾われる。
 * 定型の宛名・連絡先行を除外したうえで、表題らしい語を含む行を優先する。
 */
function guessPdfTitle(raw: string): string | null {
  const BOILERPLATE = /^(各\s*位|会\s*社\s*名|代表者名|問い?合わせ先|コード番号|TEL|FAX|記|以上|url|https?:)/i;
  const DATE_ONLY   = /^[\d\s　０-９年月日．.\-/（）()]+$/;

  const candidates = raw.split('\n')
    .map(l => l.trim())
    .slice(0, 40)
    .filter(l => l.length >= 8 && l.length <= 90)
    .filter(l => !DATE_ONLY.test(l))
    .filter(l => !BOILERPLATE.test(l));

  // 表題らしい語を含む行を優先
  const titled = candidates.find(l =>
    /お知らせ|のご案内|について|に関する|報告|計画|決算|方針|人事|異動|新設|開始/.test(l));

  return titled ?? candidates[0] ?? null;
}

function fromPlain(text: string, bytes: number): ExtractedDocument {
  const trimmed = text.trim();
  const title = trimmed.split('\n')[0]?.trim().slice(0, 120) || null;
  return clip({ text: trimmed, title, kind: 'text', bytes });
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function clip(doc: Omit<ExtractedDocument, 'truncated'>): ExtractedDocument {
  const truncated = doc.text.length > MAX_EXTRACTED_CHARS;
  return {
    ...doc,
    text: truncated ? doc.text.slice(0, MAX_EXTRACTED_CHARS) : doc.text,
    truncated,
  };
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}
