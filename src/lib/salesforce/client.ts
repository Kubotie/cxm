// ─── Salesforce REST API クライアント（サーバーサイド専用）────────────────────────
//
// 認証方式: OAuth2 Client Credentials Grant
//   - /services/oauth2/token に client_id + client_secret だけを POST
//   - username / password / security_token は不要
//   - access_token はモジュールレベルでキャッシュし、401 時に自動再取得
//   - instance_url は SALESFORCE_LOGIN_URL から直接使う
//     （Client Credentials レスポンスに instance_url が含まれる場合はそちらを優先）
//
// ── 必要な環境変数 ────────────────────────────────────────────────────────────
//   SALESFORCE_CLIENT_ID       (必須) Connected App の Consumer Key
//   SALESFORCE_CLIENT_SECRET   (必須) Connected App の Consumer Secret
//   SALESFORCE_LOGIN_URL       (任意) デフォルト https://ptmind.my.salesforce.com
//   SALESFORCE_API_VERSION     (任意) デフォルト v60.0
//
// ── 未設定時の挙動 ────────────────────────────────────────────────────────────
//   isSalesforceConfigured() === false
//   → sfFetch / sfQuery は呼ばれない（adapter 側で未設定チェックを行うこと）
//   → adapter は placeholder のまま動作し、"not yet connected" エラーを返す

const CLIENT_ID     = process.env.SALESFORCE_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET ?? '';
const LOGIN_URL     = process.env.SALESFORCE_LOGIN_URL     ?? 'https://ptmind.my.salesforce.com';
export const SF_API_VERSION = process.env.SALESFORCE_API_VERSION ?? 'v60.0';

/** SF REST API のベースパス（バージョン込み）  例: /services/data/v60.0 */
export const SF_API_BASE = `/services/data/${SF_API_VERSION}`;

// ── 設定チェック ─────────────────────────────────────────────────────────────

/**
 * Salesforce 接続に必要な環境変数がすべて設定されているかを返す。
 * adapter 側の実装切り替え判定に使用する。
 */
export function isSalesforceConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

/** 診断用: 設定状態の詳細を返す（health route 向け）*/
export interface SalesforceConfigStatus {
  configured:  boolean;
  missing:     string[];
  warnings:    string[];
  loginUrl:    string;
  apiVersion:  string;
}

export function getSalesforceConfigStatus(): SalesforceConfigStatus {
  const missing: string[] = [];
  if (!CLIENT_ID)     missing.push('SALESFORCE_CLIENT_ID');
  if (!CLIENT_SECRET) missing.push('SALESFORCE_CLIENT_SECRET');
  return {
    configured: missing.length === 0,
    missing,
    warnings:   [],
    loginUrl:   LOGIN_URL,
    apiVersion: SF_API_VERSION,
  };
}

// ── Token Cache ──────────────────────────────────────────────────────────────
//
// access_token は実際には ~2時間有効。
// Vercel Serverless Function はコールドスタートごとにモジュールが再ロードされるため、
// キャッシュは JVM/プロセス内メモリのみ（Redis 等の外部ストアは不使用）。
// TTL を 115分に設定し、有効期限内であれば再取得しない。

interface TokenCache {
  accessToken: string;
  instanceUrl: string;
  expiresAt:   number;  // Date.now() + TTL_MS
}

let _tokenCache: TokenCache | null = null;
const TOKEN_TTL_MS = 115 * 60 * 1000;  // 115分

// ── Token 取得（Client Credentials Grant）────────────────────────────────────

interface TokenResponse {
  access_token: string;
  instance_url?: string;  // Client Credentials レスポンスで返される場合もある
  token_type:   string;
}

/**
 * Salesforce OAuth2 Client Credentials Grant でアクセストークンを取得する。
 * 成功したらモジュールキャッシュに保存して返す。
 *
 * POST {LOGIN_URL}/services/oauth2/token
 *   grant_type=client_credentials
 *   &client_id={CLIENT_ID}
 *   &client_secret={CLIENT_SECRET}
 */
async function fetchAccessToken(): Promise<TokenCache> {
  if (!isSalesforceConfigured()) {
    throw new Error(
      'Salesforce は未設定です。SALESFORCE_CLIENT_ID と SALESFORCE_CLIENT_SECRET を ' +
      '.env.local に追加してください。',
    );
  }

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch(`${LOGIN_URL}/services/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
    cache:   'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(body read failed)');
    throw new Error(`Salesforce token fetch failed ${res.status}: ${body}`);
  }

  const data = await res.json() as TokenResponse;
  // instance_url がレスポンスにない場合は LOGIN_URL をそのまま使う
  const instanceUrl = data.instance_url ?? LOGIN_URL;
  const cache: TokenCache = {
    accessToken: data.access_token,
    instanceUrl,
    expiresAt:   Date.now() + TOKEN_TTL_MS,
  };
  _tokenCache = cache;
  return cache;
}

async function getAccessToken(): Promise<TokenCache> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache;
  }
  return fetchAccessToken();
}

// ── sfFetch ──────────────────────────────────────────────────────────────────

/**
 * Salesforce REST API への汎用 fetch。
 * - access_token を自動取得・キャッシュ
 * - 401（token expired）の場合はキャッシュを破棄して1回だけ再取得・再試行
 * - 204 No Content（PATCH/DELETE 成功）は undefined を返す
 *
 * @param method  HTTP メソッド
 * @param path    SF REST API パス（例: '/services/data/v60.0/sobjects/Task' or フル URL）
 * @param body    POST/PATCH 時のリクエストボディ（オブジェクト → JSON 変換）
 */
export async function sfFetch<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: object,
): Promise<T> {
  const doRequest = async (token: TokenCache): Promise<Response> => {
    const url = path.startsWith('http') ? path : `${token.instanceUrl}${path}`;
    return fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
  };

  let token = await getAccessToken();
  let res   = await doRequest(token);

  // 401: access_token が失効 → キャッシュを破棄して再取得・1回だけ再試行
  if (res.status === 401) {
    _tokenCache = null;
    token = await fetchAccessToken();
    res   = await doRequest(token);
  }

  // 204 No Content (PATCH DELETE 成功)
  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(body read failed)');
    throw new Error(`Salesforce API ${res.status} [${method} ${path}]: ${errBody}`);
  }

  return res.json() as Promise<T>;
}

// ── sfQuery ──────────────────────────────────────────────────────────────────

interface SoqlResponse<T> {
  records:   T[];
  totalSize: number;
  done:      boolean;
  nextRecordsUrl?: string;
}

/**
 * SOQL クエリを実行して結果レコードを返す。
 * nextRecordsUrl を自動でページングし、全件を返す（最大 2000件）。
 *
 * @param soql  SOQL 文字列（例: "SELECT Id,Name FROM Contact WHERE AccountId='...'"）
 */
export async function sfQuery<T>(soql: string): Promise<T[]> {
  const path = `${SF_API_BASE}/query?q=${encodeURIComponent(soql)}`;
  const first = await sfFetch<SoqlResponse<T>>('GET', path);

  const records = [...first.records];

  // ページング（2000件超の場合）
  let next = first.nextRecordsUrl;
  while (next && records.length < 2000) {
    const page = await sfFetch<SoqlResponse<T>>('GET', next);
    records.push(...page.records);
    next = page.nextRecordsUrl;
  }

  return records;
}

// ── SF User ID ルックアップ ─────────────────────────────────────────────────
//
// action.owner（メールアドレス文字列）→ Salesforce User ID 変換。
// キャッシュを持ち、同一プロセス内は再クエリしない。
//
// 設計方針:
//   - action.owner の値はメールアドレス（"xxx@ptmind.com" 等）を前提とする
//   - SF User テーブルに Email 一致の IsActive=true ユーザーを検索
//   - 見つからない場合は undefined を返す（Task の OwnerId は省略可能）

const _userIdCache = new Map<string, string>();

/**
 * メールアドレス文字列から Salesforce User ID を解決する。
 *
 * @param ownerEmail  CXM action.owner（メールアドレス形式を想定）
 * @returns  SF User ID、またはメール形式でない / 見つからない場合は undefined
 */
export async function resolveSfUserId(ownerEmail: string): Promise<string | undefined> {
  if (!ownerEmail || !ownerEmail.includes('@')) return undefined;

  const cached = _userIdCache.get(ownerEmail);
  if (cached) return cached;

  try {
    const soql = `SELECT Id FROM User WHERE Email='${ownerEmail.replace(/'/g, "\\'")}' AND IsActive=true LIMIT 1`;
    const rows = await sfQuery<{ Id: string }>(soql);
    if (rows.length > 0) {
      _userIdCache.set(ownerEmail, rows[0].Id);
      return rows[0].Id;
    }
  } catch {
    // ルックアップ失敗は非致命的 — OwnerId なしで Task を作成する
  }

  return undefined;
}
