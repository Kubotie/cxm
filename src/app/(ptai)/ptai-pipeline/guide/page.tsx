// ─── /ptai-pipeline/guide ─────────────────────────────────────────────────────
//
// 使う人（PtAI の担当メンバー）向けの案内。裏側の作りは書かない。
// 「何ができて、どこを触ればよくて、どこは触れないか」だけに絞る。
//
// ⚠ 仕様を変えたらここも直すこと。画面の注意書き（markup.ts）からリンクしている。

import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "使い方 — Ptengine AI Pipeline Board" };

export default async function GuidePage() {
  const profile = await getCurrentUserProfile();
  return (
    <>
      <div className="pshell">
        <Link href="/apps">アプリ一覧</Link>
        <Link href="/ptai-pipeline">パイプライン</Link>
        <span className="pshell-here">使い方</span>
        <Link href="/ptai-pipeline/updates">更新履歴</Link>
        <span className="pshell-sp" />
        {profile && <span className="pshell-user">{profile.name || profile.name2}</span>}
      </div>

      <article className="pdoc">
        <header className="pdoc-h">
          <h1>このダッシュボードの使い方</h1>
          <p className="pdoc-lead">
            Ptengine AI の商談とアカウントを、1 枚で見て動かすための画面です。
            ここを読めば、どこを触ればよくて、どこは Salesforce でやるのかが分かります。
          </p>
        </header>

        <section>
          <h2>まず、いちばん大事なこと</h2>
          <div className="pdoc-two">
            <div className="pdoc-card ok">
              <h3>この画面で入れるもの</h3>
              <ul>
                <li><b>障壁</b>・<b>ニーズ</b>・<b>ネクストアクション</b></li>
                <li><b>（目標）追加MRR</b>（この会社でいくら増やしたいか）</li>
                <li><b>到達予定</b>（各フェーズにいつ届くか）</li>
                <li>サクセスの計画・Todo、組織図、議事録のメモ</li>
              </ul>
            </div>
            <div className="pdoc-card lock">
              <h3>Salesforce でしか入れられないもの</h3>
              <ul>
                <li>商談そのもの（新規作成）</li>
                <li><b>金額</b>・見積もり</li>
                <li><b>フェーズ</b></li>
                <li><b>申込完了日</b>・<b>課金開始日</b>・契約期間</li>
              </ul>
              <p className="pdoc-note">
                商談の行から「Salesforce ↗」で、その会社のページへ飛べます。
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2>やること 3 つ</h2>
          <ol className="pdoc-steps">
            <li>
              <b>目標を入れる</b>
              <p>
                企業一覧の「① （目標）追加MRR」をクリックして、万円で入れます。
                これが「計画」のカードとバーに積み上がります。
              </p>
            </li>
            <li>
              <b>商談を Salesforce で作る</b>
              <p>
                商談名に <code>PtAI</code> / <code>Ptengine AI</code> / <code>PtengineAI</code> の
                どれかを入れてください。<b>これが入っていない商談はこの画面に出てきません。</b>
                大文字小文字は区別しません。
              </p>
            </li>
            <li>
              <b>商談を開いて、次の一手を書く</b>
              <p>
                「商談管理」タブで商談を開き、<b>障壁・ニーズ・ネクストアクション</b>を書きます。
                保存すると Salesforce にも書き込まれるので、二重入力は要りません。
              </p>
            </li>
          </ol>
        </section>

        <section>
          <h2>画面の見方</h2>

          <h3>上の 8 枚のカード</h3>
          <table className="pdoc-tbl">
            <tbody>
              <tr><th>目標 合算MRR</th><td>チーム全体の目標。担当ごとの配分もここで編集します</td></tr>
              <tr><th>計画</th><td>みんなが入れた<b>（目標）追加MRR の合計</b>。いまの計画で目標に届くかを見る値です</td></tr>
              <tr><th>期待値（参考）</th><td>商談の金額にフェーズごとの係数を掛けて足したもの</td></tr>
              <tr><th>ネクストアクション期限超過</th><td>期日を過ぎた次の一手の件数</td></tr>
              <tr><th>確定</th><td>受注した商談の金額</td></tr>
              <tr><th>コミット</th><td>Probable 以上の商談の金額</td></tr>
              <tr><th>チャレンジ</th><td>Qualified Champion 以上の商談の金額</td></tr>
              <tr><th>パイプライン</th><td>商談がある会社の、商談金額 ＋ 現在MRR −受注ぶん</td></tr>
            </tbody>
          </table>
          <p className="pdoc-note">
            下の 4 枚は「確定 ⊆ コミット ⊆ チャレンジ ⊆ パイプライン」の入れ子です。
            右へ行くほど幅広く、左へ行くほど確かな数字になります。
          </p>

          <h3>企業一覧の 4 つの金額</h3>
          <table className="pdoc-tbl">
            <tbody>
              <tr><th>⑥ 現在MRR</th><td>いまもらっている額。<b>毎朝 8 時に自動更新</b>。かっこ内は期初（10/1）からの増減</td></tr>
              <tr><th>① （目標）追加MRR</th><td>この会社でいくら増やしたいか。<b>ここだけ手で入れます</b></td></tr>
              <tr><th>② （商談）追加MRR</th><td>商談の金額の合計（失注は除く）</td></tr>
              <tr><th>③ （見込）追加MRR</th><td>② にフェーズの係数を掛けたもの</td></tr>
            </tbody>
          </table>

          <h3>フェーズと社内の言い方</h3>
          <p>フェーズは Salesforce に揃えてあります。英語名の下に社内の言い方を小さく出しています。</p>
          <table className="pdoc-tbl pdoc-ph">
            <thead><tr><th>フェーズ</th><th>社内の言い方</th><th>③ の係数</th></tr></thead>
            <tbody>
              <tr><td>Active</td><td>初回アポ実施前</td><td>—</td></tr>
              <tr><td>Goal Shared</td><td>初回アポ実施済み</td><td>30%</td></tr>
              <tr><td>Qualified Champion</td><td>トライアル開始済み</td><td>50%</td></tr>
              <tr><td>Evaluating</td><td>トライアル運用評価段階</td><td>70%</td></tr>
              <tr><td>Probable</td><td>最終見積もり提示済み</td><td>90%</td></tr>
              <tr><td>Verbal</td><td>口頭合意獲得済み</td><td>90%</td></tr>
              <tr><td>Won</td><td>申込用紙回収済み</td><td>100%</td></tr>
              <tr><td>受注 (Closed Won)</td><td>契約締結済み</td><td>100%</td></tr>
              <tr><td>Close Lost</td><td>失注</td><td>—</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>うまくいかないとき</h2>
          <dl className="pdoc-faq">
            <dt>作った商談が出てこない</dt>
            <dd>
              商談名に <code>PtAI</code> / <code>Ptengine AI</code> / <code>PtengineAI</code> が
              入っているか確かめてください。入れたばかりなら、商談一覧の
              「⟳ 新しい商談を Salesforce から読み込む」を押すとすぐ入ります
              （押さなくても、画面を開いたときに 1 時間に 1 回まで自動で取り込みます）。
            </dd>

            <dt>金額やフェーズを直したい</dt>
            <dd>Salesforce で直してください。この画面からは変えられません。直したあとは上のボタンで取り込めます。</dd>

            <dt>現在MRR が実際と違う</dt>
            <dd>
              毎朝 8 時に自動で入れ替わります。それでも合わないときは、
              会社の Salesforce 取引先が紐付いていない可能性があります。フィードバックで教えてください。
            </dd>

            <dt>「未送信あり」と出ている</dt>
            <dd>
              障壁・ニーズ・ネクストアクションを Salesforce へ送れなかったときに出ます。
              商談の「↗ Salesforce へ送信」をもう一度押してください。
            </dd>

            <dt>到達予定が点線になっている</dt>
            <dd>
              申込完了日から逆算した<b>自動の目安</b>で、まだ保存されていません。
              そのままでよければ商談を保存すると確定します。
            </dd>
          </dl>
        </section>

        <section className="pdoc-cta">
          <h2>困ったこと・直してほしいことがあれば</h2>
          <p>
            画面の左下にフィードバックのボタンがあります。
            「画面の要素を選ぶ」で該当箇所をクリックすると、どこの話かが一緒に送られます。
            送られたものは平日 9〜21 時に確認して、直したものは更新履歴に出します。
          </p>
          <Link className="pdoc-btn" href="/ptai-pipeline">パイプラインに戻る</Link>
        </section>
      </article>
    </>
  );
}
