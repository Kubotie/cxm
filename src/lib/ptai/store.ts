// ─── PtAI 共有ドキュメントストア（サーバー専用）────────────────────────────────
//
// アーティファクトの `window.claude.use('db')`（Firestore 風の collection/doc）を
// NocoDB の 1 テーブル `pga_docs` で置き換えるための薄い層。
//
//   collection / doc_id / data(JSON文字列) / at / updated_at_s / deleted
//
// set は「全置換・後勝ち」。原本の挙動（HANDOVER 10-1-1）をそのまま踏襲する。
// 楽観ロックは入れない（Phase 4 の検討事項）。
//
// ブラウザから import しないこと。

const BASE_URL  = process.env.NOCODB_BASE_URL ?? 'https://odtable.ptmind.ai';
const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const TABLE_ID  = process.env.NOCODB_PGA_DOCS_TABLE_ID ?? 'm0vfof8a1mwd75p';

/**
 * RAW スナップショット置き場。
 * 顧客名・MRR・議事録を含むので **public/ には置かない**（HANDOVER 12-6）。
 * NocoDB の LongText は 1 セル 60KB 前後で 422 になるため、分割して持つ。
 */
export const RAW_COLLECTION = '_raw';
const RAW_CHUNK = 50_000;

/**
 * 原本が購読している collection。これ以外は受け付けない。
 * `minutes` は Version 96 の議事録タブが使う（Notion から取り込んだ本文のキャッシュ）。
 */
/**
 * 移行元（pga_docs）に入っているコレクション。
 *
 * ⚠ `plans` と `chatwork` は **Twenty へ引き継がない**（2026-10-01 の決定）。
 *   plans   … 旧プランニング（GATES・ピン）。いまの画面はサクセス管理（aplans）が主体で、
 *             原本に残っていた旧構造。二重の計画は持たない
 *   chatwork… 取り込み経路を議事録（Notion／Mii）に寄せる
 *   ここに残してあるのは、**移行元を読む legacy_nocodb 経路のため**だけ。
 *   twenty 経路では db-view が作らず、db-write が 501(retired) を返す。
 */
export const PTAI_COLLECTIONS = [
  'edits', 'aplans', 'orgs', 'recent', 'feed', 'newcos', 'settings', 'plans', 'chatwork',
  'minutes',
] as const;
export type PtaiCollection = (typeof PTAI_COLLECTIONS)[number];

export function isPtaiCollection(v: string): v is PtaiCollection {
  return (PTAI_COLLECTIONS as readonly string[]).includes(v);
}

export interface PtaiRow {
  Id:            number;
  collection:    string;
  doc_id:        string;
  data:          string | null;
  at:            string | null;
  updated_at_s:  string | null;
  deleted?:      boolean | null;
}

export interface PtaiDoc {
  collection: string;
  id:         string;
  data:       unknown;
  at:         string | null;
}

function headers(): Record<string, string> {
  return { 'xc-token': API_TOKEN, 'Content-Type': 'application/json' };
}

function recordsUrl(qs = ''): string {
  return `${BASE_URL}/api/v2/tables/${TABLE_ID}/records${qs}`;
}

export function isPtaiStoreConfigured(): boolean {
  return Boolean(API_TOKEN && TABLE_ID);
}

async function noco<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: headers(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`NocoDB ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ── 読み取り ─────────────────────────────────────────────────────────────────

/**
 * 全ドキュメントを返す。件数は数百のオーダー（社数 125 + feed 上限）なので
 * ページングしつつ一括で取る。deleted は落とす。
 */
export async function listAllDocs(): Promise<PtaiDoc[]> {
  const out: PtaiDoc[] = [];
  const PAGE = 1000;                     // NocoDB の上限（memory: limit は 2000 で黙って切られる）
  for (let offset = 0; ; offset += PAGE) {
    const qs = `?limit=${PAGE}&offset=${offset}&sort=Id`;
    const json = await noco<{ list: PtaiRow[]; pageInfo?: { isLastPage?: boolean } }>(recordsUrl(qs));
    for (const r of json.list) {
      if (r.deleted) continue;
      if (r.collection === RAW_COLLECTION) continue;   // RAW は /api/ptai/raw で別に返す
      out.push({
        collection: r.collection,
        id:         r.doc_id,
        data:       safeParse(r.data),
        at:         r.at,
      });
    }
    if (json.list.length < PAGE || json.pageInfo?.isLastPage) break;
  }
  return out;
}

function safeParse(s: string | null): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

// ── 書き込み ─────────────────────────────────────────────────────────────────

async function findRowId(collection: string, docId: string): Promise<number | null> {
  const qs = `?where=${encodeURIComponent(`(collection,eq,${collection})~and(doc_id,eq,${docId})`)}&limit=1&fields=Id`;
  const json = await noco<{ list: Array<{ Id: number }> }>(recordsUrl(qs));
  return json.list[0]?.Id ?? null;
}

/** doc.set(body) 相当。既存行があれば全置換、無ければ作成 */
export async function setDoc(collection: string, docId: string, data: unknown): Promise<void> {
  const now = new Date().toISOString();
  const at  = pickAt(data) ?? now;
  const payload = { collection, doc_id: docId, data: JSON.stringify(data ?? null), at, updated_at_s: now, deleted: false };

  const rowId = await findRowId(collection, docId);
  if (rowId == null) {
    await noco(recordsUrl(), { method: 'POST', body: JSON.stringify([payload]) });
  } else {
    await noco(recordsUrl(), { method: 'PATCH', body: JSON.stringify([{ Id: rowId, ...payload }]) });
  }
}

/** collection.add(body) 相当。自動 ID を振って作成し、その ID を返す */
export async function addDoc(collection: string, data: unknown): Promise<string> {
  const now = new Date().toISOString();
  const docId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const at = pickAt(data) ?? now;
  await noco(recordsUrl(), {
    method: 'POST',
    body: JSON.stringify([{ collection, doc_id: docId, data: JSON.stringify(data ?? null), at, updated_at_s: now, deleted: false }]),
  });
  return docId;
}

/** doc.delete() 相当。物理削除する（原本は plans でしか使わない） */
export async function deleteDoc(collection: string, docId: string): Promise<void> {
  const rowId = await findRowId(collection, docId);
  if (rowId == null) return;
  await noco(recordsUrl(), { method: 'DELETE', body: JSON.stringify([{ Id: rowId }]) });
}

/** feed の並び替えに使う `at`。body に at があればそれを正とする */
function pickAt(data: unknown): string | null {
  if (data && typeof data === 'object') {
    const v = (data as Record<string, unknown>).at ?? (data as Record<string, unknown>).updatedAt;
    if (typeof v === 'string') return v;
  }
  return null;
}

// ── RAW スナップショット ──────────────────────────────────────────────────────

/** 分割保存された RAW を連結して 1 本の JSON 文字列で返す。未投入なら null */
export async function getRawSnapshot(): Promise<string | null> {
  const qs = `?where=${encodeURIComponent(`(collection,eq,${RAW_COLLECTION})`)}&limit=200&sort=doc_id`;
  const json = await noco<{ list: PtaiRow[] }>(recordsUrl(qs));
  if (!json.list.length) return null;
  return json.list.map(r => r.data ?? '').join('');
}

/** RAW を入れ替える（既存チャンクを消してから分割投入）*/
export async function setRawSnapshot(jsonText: string): Promise<number> {
  const qs = `?where=${encodeURIComponent(`(collection,eq,${RAW_COLLECTION})`)}&limit=500&fields=Id`;
  const old = await noco<{ list: Array<{ Id: number }> }>(recordsUrl(qs));
  if (old.list.length) {
    await noco(recordsUrl(), { method: 'DELETE', body: JSON.stringify(old.list.map(r => ({ Id: r.Id }))) });
  }

  const now = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i * RAW_CHUNK < jsonText.length; i++) {
    rows.push({
      collection:   RAW_COLLECTION,
      doc_id:       String(i).padStart(4, '0'),
      data:         jsonText.slice(i * RAW_CHUNK, (i + 1) * RAW_CHUNK),
      at:           now,
      updated_at_s: now,
      deleted:      false,
    });
  }
  for (let i = 0; i < rows.length; i += 5) {
    await noco(recordsUrl(), { method: 'POST', body: JSON.stringify(rows.slice(i, i + 5)) });
  }
  return rows.length;
}
