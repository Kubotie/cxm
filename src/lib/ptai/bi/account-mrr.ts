// ─── アカウント単位の MRR（Metabase の公開 CSV）──────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  1 社を複数行に分けて持ちたいとき（ビズリーチ ToB/ToC、マネーフォワード
//  アカウント1/2）に使う。会社単位の Company Database `mrr` では割れないため。
//
//  **鍵は Ptengine の Account ID（UUID）。** メールアドレスではない。
//  公開リンクは URL を知っていれば誰でも見られるので、顧客のメールを
//  載せない形にしてもらった（2026-10-02 Kubotie が question 8792 を作成）。
//
//  ⚠ プロジェクト単位（Project MRR）では**足りない**。アカウントには
//    どのプロジェクトにも載らない Other MRR があり、ビズリーチ ToC で
//    22,000 円ぶん取りこぼしていた（494,736 と 472,736 の差）。
//    アカウント単位なら、分けた行の合計が会社単位の額とぴたり一致する。
//
//  ⚠ 当月は更新の切り替わりで実績が 0 になることがある（2026-10 の
//    09d325f4 が該当）。その月は **Expect（見込）**を使う。
//    2026-10-02 Kubotie 了承。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログは件数だけ。会社名・アカウントは出さない。

const CSV_URL =
  'https://bi.ptmind.com/public/question/801717ed-4103-4d0b-86fd-26ed6d587dbc.csv';

/** Metabase はクエリをその場で実行するので遅い */
const TIMEOUT_MS = 120_000;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const num = (v: string | undefined): number => {
  const n = parseFloat((v ?? '').replace(/[,\s¥]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Account ID → MRR（円）。
 * 同じアカウントが複数月あるときは**いちばん新しい月**を採る。
 */
export async function fetchAccountMrr(): Promise<Map<string, number>> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let text: string;
  try {
    const res = await fetch(CSV_URL, { cache: 'no-store', signal: ac.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`CSV ${res.status}`);
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return new Map();

  const head = parseCsvLine(lines[0]);
  const iId     = head.findIndex(h => /account\s*id/i.test(h));
  const iMrr    = head.findIndex(h => /account\s*mrr/i.test(h));
  const iExpect = head.findIndex(h => /expect/i.test(h));
  const iMonth  = head.findIndex(h => /stat\s*month/i.test(h));
  if (iId < 0 || iMrr < 0) throw new Error(`[ptai/bi] 必要な列がありません: ${head.length} 列`);

  const latest = new Map<string, { month: string; mrr: number }>();
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const id = f[iId];
    if (!id) continue;
    const month = iMonth >= 0 ? (f[iMonth] ?? '') : '';
    const prev = latest.get(id);
    if (prev && prev.month > month) continue;
    // 更新の切り替わり中は実績が 0 になる。その月は見込みを使う
    const actual = num(f[iMrr]);
    const mrr = actual > 0 ? actual : (iExpect >= 0 ? num(f[iExpect]) : 0);
    latest.set(id, { month, mrr });
  }
  return new Map([...latest].map(([k, v]) => [k, v.mrr]));
}

/** 「c84c6211-…, 04887569-…」→ ['c84c6211-…','04887569-…']。区切りは , 、 空白 */
export function parseIds(v: string | null | undefined): string[] {
  return String(v ?? '').split(/[,、\s]+/).map(s => s.trim()).filter(Boolean);
}
