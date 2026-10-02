// ─── プロジェクト単位の MRR（Metabase の公開 CSV）────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  1 社を複数行に分けて持ちたいとき（ビズリーチ ToB/ToC、マネーフォワード
//  アカウント1/2）に使う。会社単位の Company Database `mrr` では割れないため。
//
//  ⚠ **「Total Mrr の最大値」を採る。合計値ではない。**（2026-10-02 実測）
//    1 プロジェクトに期間の重なる注文が 2 本あることがあり、合計すると
//    二重になる。BI の正本（Project MRR テーブル）と突き合わせた結果:
//      1c53hb20  正本 472,736 ／ 最大値 472,736 ○ ／ 合計値 494,736 ×
//      5d7bb68e  正本 395,780 ／ 最大値 395,780 ○
//      617hym4x  正本 439,780 ／ 最大値 439,780 ○
//
//  ⚠ 更新の切り替わり中は正本の当月 MRR が 0 になる（55kd4ac7 が該当）。
//    この CSV は**いま有効な注文**を返すので 207,504 のまま。
//    0 円に落とさないほうがよい、という判断（2026-10-02 Kubotie 了承）に合う。
//
//  CXM 側にも同じ CSV を読む src/lib/metabase/mrr.ts があるが、あちらは
//  **合計値**を使っていて意味が違うので、相乗りせず別に持つ。
// ═══════════════════════════════════════════════════════════════════════════
//
// ログは件数だけ。会社名・プロジェクト名は出さない。

const CSV_URL =
  'https://bi.ptmind.com/public/question/ac9183fd-b0f0-497f-8d1c-55a3e037b330.csv';

/** Metabase はクエリをその場で実行するので遅い。1 回 20 秒ほどかかる */
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

/** project_id → MRR（円） */
export async function fetchProjectMrr(): Promise<Map<string, number>> {
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
  const idId = head.indexOf('Project ID');
  // ロケールで英語・日本語が混ざる。**最大値**の列を取る（合計値ではない）
  const idMax = head.findIndex(h =>
    (h.includes('Total MRR') || h.includes('Total Mrr')) &&
    (h.toLowerCase().includes('max') || h.includes('最大')));
  if (idId < 0 || idMax < 0) {
    throw new Error(`[ptai/bi] 必要な列がありません: ${head.length} 列`);
  }

  const out = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const pid = f[idId];
    if (!pid) continue;
    const n = parseFloat((f[idMax] ?? '').replace(/[,\s¥]/g, ''));
    out.set(pid, Number.isFinite(n) ? n : 0);
  }
  return out;
}

/** 「5d7bb68e, 1c53hb20」→ ['5d7bb68e','1c53hb20'] */
export function parseProjectIds(v: string | null | undefined): string[] {
  return String(v ?? '').split(/[,、\s]+/).map(s => s.trim()).filter(Boolean);
}
