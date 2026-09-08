// ─── 代理ログイン（superLogin）────────────────────────────────────────────────
//
// 顧客の管理画面をこちら側から開くためのリンクを作る。
// Ptengine の superLogin は**プロジェクトIDではなく代表メールアドレス**を受け取る
// （`project_info.master_account_email` / NocoDB の実カラム）。
//
// 会社にプロジェクトが複数あるとき、代表メールは1つのこともあれば分かれてもいる。
//   実測（2026-09-08 / project_info 4,000行）:
//     有料PJが複数で代表メール共通 … 27社（例: 株式会社マイナビ）
//     代表メールが分かれている     …  9社（例: 株式会社ポストスケイプ = 3アドレス）
// そこで**メールアドレスで束ねて**、1つならボタン1つ、分かれていればその数だけ出す。
//
// ⚠️ 無料PJ（paid_type = FREE）は完全に除外する。実測で project_info の 88% が FREE で、
//   混ぜるとボタンが十数個並んで有料の入口が埋もれる。
//
// 副作用なし。サーバー・クライアント両対応。

/** superLogin のエンドポイント。email クエリを付けて開く */
const SUPER_LOGIN_URL = 'https://www.ptengine.jp/app/superLogin';

/**
 * ラベルにプロジェクト名を並べる上限。
 * これを超える塊は名前を並べても読めないので、アカウント名（メールのローカル部）で呼ぶ。
 * 実測: 株式会社ポストスケイプは1アドレスに33PJ紐づいており、
 * 名前を2つ出しても「ADワークス/ARISTO・翔悠会（…） 他31件」で意味を失う。
 */
const MAX_NAMES_IN_LABEL = 2;

export interface SuperLoginTarget {
  /** 代表メールアドレス（表示・重複判定用に元の表記のまま） */
  email:        string;
  url:          string;
  /** このアドレスで入れるプロジェクト名（無料PJは含まない） */
  projectNames: string[];
  /**
   * リンクの文言。**会社名の下の1行（担当・Tier の並び）に置く前提で短く持つ。**
   * アドレスが1つなら「ログインする」、分かれているときは対象の名前だけ
   * （画面側が「ログイン:」の見出しを添える）。
   */
  label:        string;
}

export function superLoginUrl(email: string): string {
  return `${SUPER_LOGIN_URL}?email=${encodeURIComponent(email.trim())}`;
}

/**
 * 無料PJの判定。実データの paid_type は "FREE" / "PTI-PAID" / "PTX-PAID" / "BUNDLE-PAID"。
 * **判定は「PAID を含まないものは無料」**にする（会社詳細画面の `isFreeProject` と同じ）。
 * 同じ画面で「無料版」に分類されているPJにログインボタンが出ると、区分が矛盾する。
 */
function isFree(paidType: string | null): boolean {
  return !(paidType ?? '').toUpperCase().includes('PAID');
}

/**
 * 代表メールごとのログイン先を返す。
 *
 * - 有料PJが1アドレスに収まる場合は「ログインする」1つ
 * - 分かれている場合は「{プロジェクト名}にログインする」を各アドレスに1つ
 * - 対象が無ければ空配列（代表メールが未登録・有料PJなしの会社）
 */
export function buildSuperLoginTargets(
  projects: Array<{ name: string; paidType: string | null; masterAccountEmail: string | null }>,
): SuperLoginTarget[] {
  const groups = new Map<string, { email: string; names: string[] }>();

  for (const p of projects) {
    if (isFree(p.paidType)) continue;
    const email = (p.masterAccountEmail ?? '').trim();
    if (!email) continue;
    // 大文字小文字だけ違うアドレスは同じアカウント。束ねるキーは小文字で持つ
    const key = email.toLowerCase();
    const g = groups.get(key) ?? { email, names: [] };
    if (!g.names.includes(p.name)) g.names.push(p.name);
    groups.set(key, g);
  }

  const list = [...groups.values()];

  return list.map(g => ({
    email:        g.email,
    url:          superLoginUrl(g.email),
    projectNames: g.names,
    // アドレスが1つなら、どのプロジェクトかを言う必要がない
    label: list.length === 1 ? 'ログインする' : shortLabelOf(g.email, g.names),
  }));
}

/**
 * アドレスが分かれているときのリンク文言。**対象の名前だけを短く返す。**
 *
 * プロジェクトが2つまでなら名前で呼ぶのが一番分かりやすい。
 * 3つ以上をひとつのアドレスが抱えている（代理店に多い）場合は名前を並べても
 * 読めないので、アカウント名で呼んで件数を添える。全件はツールチップに出す。
 */
function shortLabelOf(email: string, names: string[]): string {
  if (names.length <= MAX_NAMES_IN_LABEL) return names.join('・');
  const account = email.split('@')[0] || email;
  return `${account}（${names.length}件）`;
}
