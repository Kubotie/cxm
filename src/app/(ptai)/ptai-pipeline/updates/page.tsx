// ─── /ptai-pipeline/updates ───────────────────────────────────────────────────
//
// 使う人向けの更新履歴。**画面から見て何が変わったか**だけを書く。
// 内部の作り（どのテーブル・どの API）は書かない。
//
// ⚠ リリースのたびに先頭へ 1 日ぶん足すこと。画面の注意書きからリンクしている。

import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "更新履歴 — Ptengine AI Pipeline Board" };

type Item = { kind: "new" | "fix" | "change"; title: string; body: string };
type Release = { date: string; label?: string; items: Item[] };

const KIND_JP: Record<Item["kind"], string> = {
  new: "新しくできること", fix: "直したこと", change: "変えたこと",
};

const RELEASES: Release[] = [
  {
    date: "2026-10-07",
    items: [
      {
        kind: "new",
        title: "企業一覧からネクストアクションを直接書けるようにしました",
        body:
          "表の「ネクストアクション」をクリックすると、その場で本文と期日を入力できます。" +
          "Enter で保存、Esc で取り消し。保存すると Salesforce にも書き込まれます。" +
          "商談が複数ある会社は、どれに書くか決められないので企業詳細が開きます。",
      },
      {
        kind: "fix",
        title: "ネクストアクションが編集できないように見えていました",
        body:
          "商談の要約に「未設定です。商談の入力で次の一手を入れてください」と出ていても、" +
          "商談のタイトル行を押さないと入力欄が出てきませんでした。要約の" +
          "「ネクストアクション」「障壁」の行をクリックすれば、その欄に直接カーソルが入ります。",
      },
      {
        kind: "fix",
        title: "「最終入力 Invalid Date」と出ていました",
        body: "まだ一度も入力していない商談で出ていた表示です。何も出さないようにしました。",
      },
    ],
  },
  {
    date: "2026-10-05",
    items: [
      {
        kind: "change",
        title: "確定・コミット・チャレンジ・パイプラインを合算MRR に揃えました",
        body:
          "これまで商談の金額だけで出していたため、目標 4,000万（合算MRR）と土台が違い、" +
          "「確定 27万・あと 3,973万」のような比べられない数字になっていました。" +
          "4 枚とも「期初MRR ＋ 追加分」で測るようにしたので、計画・メンバー別と同じ土台になり、" +
          "確定 ≦ コミット ≦ チャレンジ ≦ パイプライン と順に積み上がります。",
      },
      {
        kind: "fix",
        title: "「確定」の数字が 2 種類ありました",
        body:
          "カードとステージバーで別の計算をしていて、同じ「確定」が 27万 と 100万 で" +
          "出ていました。1 つに揃えました。",
      },
    ],
  },
  {
    date: "2026-10-04",
    items: [
      {
        kind: "fix",
        title: "期待値が実態と合っていませんでした",
        body:
          "画面の中に「期待値」が 2 種類あり、フェーズ別パイプラインのものは " +
          "（現在MRR ＋ 追加MRR）× Salesforce の確率 で出していました。もう貰っている現在MRR まで" +
          "確率で割り引いていたうえ、追加MRR が 10 万円未満だと 0 になる足切りも残っていました。" +
          "企業一覧の「③ （見込）追加MRR」と同じ計算（商談の金額 × フェーズの係数）に統一しました。" +
          "表示する確率も運用で決めた係数（Goal Shared 30% など）に揃えています。",
      },
      {
        kind: "new",
        title: "期待値が 0 の理由が分かるようにしました",
        body:
          "商談の金額が入っていないと期待値は 0 になります。フェーズ別パイプラインの" +
          "カードに「金額未入力 ◯社」と出すようにしました。金額は Salesforce で入れてください。",
      },
      {
        kind: "fix",
        title: "メンバー別の進捗が上のカードと食い違っていました",
        body:
          "「確定」が担当者ごとの表だけ古い計算（現在MRR ＋ 受注商談）のままで、" +
          "上のカードの「確定」と別の数字が出ていました。さらに「パイプライン残」が" +
          "商談のある会社しか見ておらず、商談ゼロの担当はバーが空になっていました。" +
          "「計画」の積み上げを担当者ごとに割った形に揃えたので、全員ぶん足すと" +
          "計画バーと一致します。内訳も 既契約／受注／商談中／まだ商談なし で同じです。",
      },
      {
        kind: "fix",
        title: "画面上部の「Salesforce から更新」が効いていませんでした",
        body:
          "押しても何も起きない状態でした。いまは押すとその場で取り込みます。" +
          "企業詳細の中にある同じボタンは元から動いていたので、そちらを使えていた方は変わりません。",
      },
    ],
  },
  {
    date: "2026-10-02",
    label: "Salesforce との連携まわりを大きく入れ替えました",
    items: [
      {
        kind: "change",
        title: "商談は Salesforce で作るものだけになりました",
        body:
          "ダッシュボードから商談を作るボタンを外しました。商談名に PtAI / Ptengine AI / PtengineAI を" +
          "入れて Salesforce で作ると、この画面に出てきます。商談一覧の「⟳ 新しい商談を Salesforce から" +
          "読み込む」ですぐ取り込めます。",
      },
      {
        kind: "new",
        title: "障壁・ニーズ・ネクストアクションが Salesforce と双方向になりました",
        body:
          "この画面で保存すると、そのまま Salesforce にも書き込まれます。二重入力は要りません。" +
          "商談の中に「⟳ Salesforce から読み込む」「↗ Salesforce へ送信」のボタンを置いています。",
      },
      {
        kind: "fix",
        title: "商談に入力しても保存されていなかったのを直しました",
        body:
          "Salesforce から取り込んだ商談に障壁やニーズを書いても、「Twenty 未反映」のまま" +
          "保存されていませんでした。いまは保存されます。",
      },
      {
        kind: "fix",
        title: "到達予定が「道のり」に出なかったのを直しました",
        body:
          "入力欄に日付が並んでいるのに、道のりはスタートとゴールしか出ていませんでした。" +
          "保存済みの日付が表示されるようになり、まだ保存していない自動の目安は点線で区別します。",
      },
      {
        kind: "new",
        title: "現在MRR が毎朝 8 時に自動更新されるようになりました",
        body:
          "Salesforce と連動した社内のデータベースから取り込みます。かっこ内は期初（10/1）からの増減です。" +
          "これまで使っていた手入力の値は、127 社中 51 社で実態とずれていました。",
      },
      {
        kind: "fix",
        title: "一部の会社で現在MRR が二重に数えられていたのを直しました",
        body:
          "1 社を複数行に分けている会社（ビズリーチ ToB/ToC、マネーフォワード アカウント1/2）で、" +
          "同じ金額が両方の行に入っていました。いまはアカウントごとに正しく分かれ、合計も合います。",
      },
      {
        kind: "change",
        title: "フェーズを Salesforce に合わせ、社内の言い方を併記しました",
        body:
          "英語名の下に「初回アポ実施前」「トライアル開始済み」などを小さく出しています。" +
          "どのフェーズがどれに当たるかは使い方ページの対応表を見てください。",
      },
      {
        kind: "change",
        title: "企業一覧の金額を ⑥①②③ の 4 つに整理しました",
        body:
          "⑥ 現在MRR ／ ① （目標）追加MRR ／ ② （商談）追加MRR ／ ③ （見込）追加MRR。" +
          "合算MRR と期待値MRR の列は外しました。",
      },
      {
        kind: "new",
        title: "積み上げカードを足しました",
        body:
          "確定・コミット・チャレンジ・パイプラインの 4 枚です。右へ行くほど幅広く、" +
          "左へ行くほど確かな数字になります。「計画」のバーもこのカードと同じ数字に揃えました。",
      },
      {
        kind: "change",
        title: "小さく出している金額を小数第1位まで出すようにしました",
        body: "万円に丸めると別の額が同じに見えてしまうためです。大きく出す数字は従来どおり整数です。",
      },
      {
        kind: "new",
        title: "フィードバックのボタンを置きました",
        body:
          "画面の左下です。「画面の要素を選ぶ」で該当箇所をクリックすると、どこの話かが一緒に送られます。" +
          "平日 9〜21 時に確認しています。",
      },
      {
        kind: "fix",
        title: "議事録がマークダウンのまま表示されていたのを直しました",
        body: "見出しや箇条書きが整形されて出るようになりました。Notion の議事録も読み込んでいます。",
      },
    ],
  },
];

export default async function UpdatesPage() {
  const profile = await getCurrentUserProfile();
  return (
    <>
      <div className="pshell">
        <Link href="/apps">アプリ一覧</Link>
        <Link href="/ptai-pipeline">パイプライン</Link>
        <Link href="/ptai-pipeline/guide">使い方</Link>
        <span className="pshell-here">更新履歴</span>
        <span className="pshell-sp" />
        {profile && <span className="pshell-user">{profile.name || profile.name2}</span>}
      </div>

      <article className="pdoc">
        <header className="pdoc-h">
          <h1>更新履歴</h1>
          <p className="pdoc-lead">
            画面から見て変わったところだけを書いています。
            うまく動かないところがあれば、左下のフィードバックから教えてください。
          </p>
        </header>

        {RELEASES.map(r => (
          <section key={r.date} className="pdoc-rel">
            <div className="pdoc-rel-h">
              <time dateTime={r.date}>{r.date.replace(/-/g, "/")}</time>
              {r.label && <span className="pdoc-rel-l">{r.label}</span>}
            </div>
            <ul className="pdoc-rel-list">
              {r.items.map((it, i) => (
                <li key={i}>
                  <span className={`pdoc-kind k-${it.kind}`}>{KIND_JP[it.kind]}</span>
                  <b>{it.title}</b>
                  <p>{it.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="pdoc-cta">
          <h2>気づいたことを教えてください</h2>
          <p>
            直してほしいところ、分かりにくいところ、数字が合わないところ。どれでも構いません。
            画面の左下のボタンから送れます。
          </p>
          <Link className="pdoc-btn" href="/ptai-pipeline">パイプラインに戻る</Link>
        </section>
      </article>
    </>
  );
}
