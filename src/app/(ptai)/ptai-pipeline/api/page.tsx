// ─── /ptai-pipeline/api ───────────────────────────────────────────────────────
//
// データの取り出し方の案内。**ログインした人にだけ鍵を見せる**。
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ画面に鍵を出すのか（2026-10-13 Kubotie 判断）
//
//  リポジトリ（Kubotie/cxm）は public なので、鍵を書いた手引きを置けない。
//  一方で「URL ひとつ渡せば使い始められる」ようにしたい。
//  ここはログイン必須なので、社内の人にだけ見せられる。
//
//  **読み取り専用の鍵しか出さない。** この鍵で取れるのは、その人が
//  ログインすれば画面で見られるデータと同じもので、権限は増えない。
//  書き込みができる SUPPORT_BATCH_SECRET は**絶対にここに出さない**。
// ═══════════════════════════════════════════════════════════════════════════
//
// 手引きの本文は docs/ptai-read-api.md と同じ内容。
// 仕様を変えたら両方直すこと。

import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { CopyToken } from "./copy";

export const dynamic = "force-dynamic";

export const metadata = { title: "データの取り出し方 — Ptengine AI Pipeline Board" };

const DOC_URL = "https://github.com/Kubotie/cxm/blob/main/docs/ptai-read-api.md";
const RAW_URL = "https://raw.githubusercontent.com/Kubotie/cxm/main/docs/ptai-read-api.md";

export default async function ApiPage() {
  const profile = await getCurrentUserProfile();
  const token = (process.env.PTAI_READ_TOKEN ?? "").trim();

  return (
    <>
      <div className="pshell">
        <Link href="/apps">アプリ一覧</Link>
        <Link href="/ptai-pipeline">パイプライン</Link>
        <Link href="/ptai-pipeline/guide">使い方</Link>
        <span className="pshell-here">データの取り出し方</span>
        <Link href="/ptai-pipeline/updates">更新履歴</Link>
        <span className="pshell-sp" />
        {profile && <span className="pshell-user">{profile.name || profile.name2}</span>}
      </div>

      <article className="pdoc">
        <header className="pdoc-h">
          <h1>データの取り出し方</h1>
          <p className="pdoc-lead">
            この画面のデータを、分析ツールや AI に読ませるための入口です。
            鍵を渡せば、進捗の報告や商談の分析をさせられます。
            <b>読むことしかできません。</b>この鍵でデータが書き換わることはありません。
          </p>
        </header>

        <section>
          <h2>1. 鍵</h2>
          {token
            ? <CopyToken token={token} />
            : <p className="pdoc-note">この環境では鍵が設定されていません（本番の画面で開いてください）。</p>}
          <p className="pdoc-note">
            読み取り専用です。これで取れるのは、あなたがこの画面で見られるデータと同じものだけです。
          </p>
          <div className="pdoc-warn">
            <b>公開リポジトリや社外のチャットに貼らないでください。</b>
            このページは社内のログインの中にあるので安全ですが、
            外に出ると誰でも顧客名・商談・障壁まで読めてしまいます。
            漏れたと思ったら Kubotie に言ってください。作り直せます。
          </div>
        </section>

        <section>
          <h2>2. 読めるのはこの 3 つだけ</h2>
          <p>
            これ以外のパスは、正しい鍵を付けても <b>401</b> になります。
            間違えたときは、返ってくる JSON の <code>endpoints</code> に正しい行き先が入っています。
          </p>
          <table className="pdoc-tbl">
            <tbody>
              <tr>
                <th><code>GET /api/ptai/export</code></th>
                <td>会社・商談・障壁・ニーズ・ネクストアクション・経過ログ・進捗・失注。
                    <b>いちばん情報量が多い</b></td>
              </tr>
              <tr>
                <th><code>GET /api/ptai/kpi</code></th>
                <td>上部 8 指標の日ごとの推移と、前の日からの増減</td>
              </tr>
              <tr>
                <th><code>GET /api/ptai/kpi?live=1</code></th>
                <td>上部 8 指標のいまの値</td>
              </tr>
            </tbody>
          </table>
          <pre className="pdoc-pre">{`curl -H "Authorization: Bearer <鍵>" \\
  "https://cxmx.vercel.app/api/ptai/export?include=all"`}</pre>
        </section>

        <section>
          <h2>3. 絞り込み</h2>
          <table className="pdoc-tbl">
            <tbody>
              <tr><th><code>include</code></th><td>既定は <code>deals,kpi</code>。<code>all</code> で全部（議事録や組織図まで）</td></tr>
              <tr><th><code>owner</code></th><td>担当者で絞る</td></tr>
              <tr><th><code>stage</code></th><td>そのフェーズの商談を持つ会社だけ</td></tr>
              <tr><th><code>q</code></th><td>社名の部分一致</td></tr>
              <tr><th><code>withDeals=1</code></th><td>商談のある会社だけ</td></tr>
              <tr><th><code>scope</code> / <code>days</code></th><td>KPI 用。対象（チーム／担当者／全部）と期間</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>4. 渡すときに一緒に伝えること</h2>
          <p>そのまま読ませると、読み違えます。次の 4 つは必ず添えてください。</p>
          <dl className="pdoc-faq">
            <dt>「稼働」は測れません</dt>
            <dd>
              取れるのは、この画面と Salesforce に<b>記録が残った回数</b>だけです。
              面談・メール・電話は入っていません。まとめて入力する人は、入力した日だけ数字が跳ねます。
            </dd>
            <dt>Salesforce 側の操作は「誰が」が分かりません</dt>
            <dd>
              Salesforce でフェーズを動かしても、実行者は記録に残りません。
              そこで会社の担当者に割り当てた<b>推定</b>として返しています。
              <code>actorKind</code> が <code>person</code> なら実測、<code>system</code> なら推定です。
            </dd>
            <dt>Salesforce 由来の日付は「気づいた日」です</dt>
            <dd>
              取り込みで検出した日時で、Salesforce で変わった日ではありません。
              同じ時刻に固まっているものは 1 回の取り込みです（<code>syncRuns</code> に切れ目が入ります）。
              とくに最初の取り込みは実態に合わせ直しただけなので、「後退 N 件」として読まないでください。
            </dd>
            <dt>503 が返ったら、数字を使わないでください</dt>
            <dd>
              短い間に叩きすぎると取得元の制限に当たります。そのとき一部が空になり、
              そのまま計算すると「商談ゼロ」に見えてしまうので、わざと 503 にしています。
              少し待って取り直してください。
            </dd>
          </dl>
        </section>

        <section>
          <h2>5. くわしい仕様</h2>
          <p>
            項目の一覧や返ってくる形は、こちらにまとめてあります（鍵は載っていません）。
          </p>
          <p>
            <a href={DOC_URL} target="_blank" rel="noreferrer">手引き（GitHub）↗</a>
            {"　"}
            <a href={RAW_URL} target="_blank" rel="noreferrer">AI に読ませる用の URL ↗</a>
          </p>
          <p className="pdoc-note">
            AI に渡すときは、この URL と鍵を<b>別々に</b>送ってください。
          </p>
        </section>

        <div className="pdoc-cta">
          <h2>うまくいかないとき</h2>
          <p>
            401 が返るなら、まずパスを疑ってください。鍵が正しくても、
            上の 3 つ以外はすべて 401 になります。
          </p>
          <p className="pdoc-note">
            それでも駄目なら Kubotie に言ってください。鍵は作り直せます。
          </p>
          <Link className="pdoc-btn" href="/ptai-pipeline">パイプラインに戻る</Link>
        </div>
      </article>
    </>
  );
}
