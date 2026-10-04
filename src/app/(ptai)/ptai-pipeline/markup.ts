// ─── Ptengine AI Pipeline Board — 原本の HTML 骨組み（アーティファクト Version 96）を無編集で移植 ───
// board.js が id で掴む DOM。React は触らない（dangerouslySetInnerHTML で一度だけ流し込む）。
export const BOARD_HTML = `
<div class="wrap">
  <header class="top">
    <div>
      <div class="eyebrow">Ptengine AI 拡販 ／ MRR <span id="eyebrowTgt">4,000万</span>円（<span id="eyebrowDue">2026年12月末</span>まで） パイプライン管理</div>
      <h1 id="pageTitle">Ptengine AI Pipeline Board</h1>
      <div class="meta">
        <span>データ元 <b>Twenty CRM</b>（crm.ptengine.com）</span>
        <span>取得 <b class="num" id="fetched"></b></span>
        <span>期限 <b class="num">2026-12-31</b>（制度）／ 計画期間 2026-10 → 2027-09</span>
        <!-- 【移植による変更 9/9】Salesforce の取り込みは 1 時間おきに自動で回るが、
             いま入れた商談をすぐ出したいときのために手動の入口も置く。
             以前はサクセス面の「商談」見出しの中だけで、見つけられなかった。 -->
        <button type="button" class="adddeal" data-sfsync
          title="Salesforce の PtAI 商談をいますぐ取り込みます（通常は1時間おきに自動で入ります）">⟳ Salesforce から更新</button>
      </div>
    </div>
    <nav class="views" id="views" aria-label="表示切替"></nav>
  </header>

  <!-- 【移植による変更 9/9】2026-10-02 に実態へ書き換え。
       元の文面は Twenty だけを見ていたころのもので、
       「追加MRR も受注予定日も空・確定MRR 0 件」はもう事実ではない。 -->
  <div class="banner" role="note"><div>ℹ</div><div>
    <b>商談と金額の正本は Salesforce です。</b>商談・金額・フェーズ・申込完了日・課金開始日は Salesforce から取り込んだ値で、ダッシュボードからは直せません（直すときは Salesforce で）。
    <b>障壁・ニーズ・ネクストアクションだけ双方向</b>で、ここで保存すると Salesforce にも書き込みます。
    現在MRR は毎朝 8 時に Company Database（Salesforce 連動）から同期しています。かっこ内は期初MRR からの増減です。
    フェーズの推定はしません。
    <!-- 【移植による変更 9/9】メンバー向けの案内と更新履歴への導線（2026-10-02）。
         CTA はフィードバックのボタンを開く（左下のボタンを押すのと同じ）。 -->
    <div class="bnav">
      <a class="bnav-l" href="/ptai-pipeline/guide">📘 使い方を見る</a>
      <a class="bnav-l" href="/ptai-pipeline/updates">🆕 今日の更新履歴</a>
      <button type="button" class="bnav-cta" data-fbopen>💬 気づいたことを送る</button>
      <a class="bnav-s" href="#gapsSec" onclick="document.getElementById('gapsSec').open=true">いま埋まっていない項目 ↓</a>
    </div></div></div>

  <div id="memberHead" hidden></div>

  <section aria-label="主要指標">
    <div class="grid g-kpi" id="kpis"></div>
  </section>

  <section class="card editor" id="targetEditor" hidden aria-labelledby="edH">
    <div class="card-h"><h2 id="edH">目標の設定</h2><span class="sub" id="edSaveInfo"></span></div>
    <form id="edForm" novalidate>
      <div class="edgrid">
        <label class="edtotal" for="tgtTotal"><span>全体目標（合算MRR）</span><span class="inwrap"><input id="tgtTotal" type="number" min="0" step="10" inputmode="numeric"><em>万円</em></span></label>
        <label class="edtotal" for="tgtDue"><span>達成期限（この月の末まで）</span><input id="tgtDue" type="month"></label>
        <div class="edmembers" id="edMembers"></div>
      </div>
      <div class="edsum" id="edSum" aria-live="polite"></div>
      <div class="edrules" id="edRules"></div>
      <div class="edact">
        <span class="sub" id="edMsg" role="status"></span>
        <button type="button" class="btn ghost" id="edCancel">キャンセル</button>
        <button type="submit" class="btn" id="edSave">保存</button>
      </div>
    </form>
  </section>

  <section class="card" aria-labelledby="stageH">
    <div class="card-h">
      <h2 id="stageH">目標到達ステージ（合算MRR）</h2>
      <span class="sub" id="stageSub"></span>
    </div>
    <div class="stagebar" id="stagebar"></div>
    <div class="legend"><span><i class="dot" style="background:var(--gold)"></i>契約締結済み（フェーズ＝契約締結済み）</span><span><i class="dot" style="background:var(--accent);opacity:.55"></i>期待値（商談の金額 × フェーズの係数）</span><span>▍ステージ境界 = 支給率 0 / 50 / 75 / 100%</span></div>
  </section>

  <section class="grid g-2">
    <div class="card">
      <div class="card-h"><h2>メンバー別 目標配分と進捗</h2><span class="sub">名前クリックで個人ビュー。共同担当は均等按分</span><button type="button" class="linkbtn" data-edit>目標を編集</button></div>
      <div id="allocAlert"></div>
      <div id="members"></div>
      <!-- 【移植による変更 9/9】計画の積み上げと同じ内訳に揃えた（2026-10-04） -->
      <div class="legend" style="margin-top:12px"><span><i class="dot" style="background:color-mix(in oklab,var(--ink) 35%,transparent)"></i>既契約（期初MRR）</span><span><i class="dot" style="background:var(--gold)"></i>受注</span><span><i class="dot" style="background:var(--accent)"></i>商談中</span><span><i class="dot" style="background:color-mix(in oklab,var(--accent) 40%,transparent)"></i>まだ商談なし</span><span>▎目標</span></div>
    </div>
    <div class="card">
      <div class="card-h"><h2 id="fcTitle">申込完了予定月別 パイプライン</h2>
        <div class="fcctl"><div class="seg2" role="group" aria-label="集計の基準日"><button type="button" data-fb="apply" aria-pressed="true">申込完了日</button><button type="button" data-fb="bill" aria-pressed="false">課金開始日</button></div><div class="seg2" role="group" aria-label="金額の種類"><button type="button" data-fm="exp" aria-pressed="true">期待値</button><button type="button" data-fm="tot" aria-pressed="false">想定（合算MRR）</button></div>
        <label class="sub"><input type="checkbox" id="fcCum" checked> 累積と目標ライン</label></div></div>
      <div id="forecast"></div>
      <div class="fclegend" id="fcLegend"></div>
      <div id="fcMissing"></div>
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h2>フェーズ別パイプライン</h2><span class="sub">7段階＋失注。クリックで該当企業を表示</span></div>
    <div class="funnel f9" id="funnel"></div>
    <div class="ppanel" id="phasePanel" hidden></div>
  </section>

  <section class="card">
    <div class="card-h"><h2>担当者へのお知らせ</h2><span class="sub" id="alertSub"></span></div>
    <div class="acats" id="alertCats" role="group" aria-label="お知らせの種類"></div>
    <div class="alist grid g-3" id="alerts"></div>
    <div class="amore"><button type="button" class="btn ghost sm" id="alertMore" hidden></button></div>
  </section>

  <section class="card" id="feedSec">
    <div class="card-h"><h2>新着・更新</h2><span class="sub" id="feedSub">直近14日の商談の追加・フェーズ・金額・日付・ネクストアクション の変更</span></div>
    <ol class="feed" id="feed"></ol>
    <div class="amore"><button type="button" class="btn ghost sm" id="feedMore" hidden></button></div>
  </section>


  <section class="card" id="planSec" hidden>
    <div class="card-h"><h2>1年間プランニング（中間ゴール／Todo）</h2><span class="sub">案件の行をクリックするとプランニングタブを開きます</span><button type="button" class="btn ghost sm" id="gOpen">＋ゴールを追加</button></div>
    <div class="plkpis" id="plKpis"></div>
    <form id="goalForm" class="goalform" hidden novalidate>
      <label for="gTitle">ゴール名<input id="gTitle" type="text" placeholder="例：紹介MTG 5社"></label>
      <label for="gOwner">担当<select id="gOwner"></select></label>
      <label for="gStart">開始月<input id="gStart" type="month"></label>
      <label for="gDue">期日<input id="gDue" type="date"></label>
      <label for="gKpiT">目標数<input id="gKpiT" type="number" min="0" placeholder="任意"></label>
      <label for="gKpiA">実績数<input id="gKpiA" type="number" min="0" placeholder="任意"></label>
      <div class="gact"><span class="sub" id="gMsg" role="status"></span><button type="button" class="btn ghost" id="gCancel">キャンセル</button><button type="submit" class="btn">追加</button></div>
    </form>
    <div class="plan" id="plan"></div>
  </section>

  <section class="card" id="issueSec" hidden>
    <div class="card-h"><h2>イシュー・確認事項（全案件）</h2><span class="sub" id="isSub"></span><label class="sub" style="margin-left:auto"><input type="checkbox" id="isAll"> 解決済みも表示</label></div>
    <div id="issues"></div>
  </section>

  <section class="card">
    <div class="card-h">
      <h2>企業一覧 <span class="sub" style="font-weight:400">行クリックで詳細（要約／行動履歴／議事録）</span></h2>
      <button type="button" class="btn sm" id="ncOpen">＋企業を追加</button>
      <div class="filters">
        <details class="msel" id="ms-owner"><summary></summary><div class="mpop"></div></details>
        <details class="msel" id="ms-phase"><summary></summary><div class="mpop"></div></details>
        <details class="msel" id="ms-tier"><summary></summary><div class="mpop"></div></details>
        <select id="fOwner" hidden aria-hidden="true"><option value="">全員</option></select><select id="fPhase" hidden aria-hidden="true"><option value="">すべて</option></select><select id="fTier" hidden aria-hidden="true"><option value="">すべて</option></select>
        <select id="fStatus" hidden aria-hidden="true"><option value="">すべて</option></select>
        <label><input type="checkbox" id="fDeals"> 商談をすべて開く</label>
        <label><input type="checkbox" id="fMissing"> 予定月・追加MRR 未入力のみ</label>
        <input id="fQ" type="search" placeholder="企業名で検索" style="width:170px" aria-label="企業名で検索">
      </div>
    </div>
 <form class="ncform" id="ncForm" hidden novalidate>
      <div class="nch"><b>企業を追加</b><span class="sub">新規問い合わせなど。保存するとダッシュボードに追加し、Notion 顧客DB にも作成します</span></div>
      <div class="ncg">
        <label><span>会社名<em>*</em></span><input id="ncName" type="text" required placeholder="例：株式会社サンプル"></label>
        <label>ドメイン<input id="ncDom" type="text" placeholder="例：sample.co.jp"></label>
        <label>業種<select id="ncInd"></select></label>
        <label>Tier<select id="ncTier"><option value="">未顧客</option><option>TIER1</option><option>TIER2</option><option>TIER3</option><option>TIER5</option></select></label>
        <label>きっかけ<select id="ncSrc"><option>新規問い合わせ</option><option>紹介</option><option>イベント・セミナー</option><option>アウトバウンド</option><option>既存顧客の別部署</option><option>その他</option></select></label>
        <fieldset class="ncown"><legend>担当</legend><div id="ncOwners"></div></fieldset>
        <label class="wide">メモ<textarea id="ncMemo" rows="2" placeholder="問い合わせ内容・窓口の方など"></textarea></label>
      </div>
      <div class="ncmsg" id="ncMsg" role="status"></div>
      <div class="ncact"><button type="button" class="btn ghost sm" id="ncCancel">キャンセル</button><button type="submit" class="btn sm" id="ncSave">追加する</button></div>
    </form>
    <div class="gsum" id="goalSum" role="button" tabindex="0" title="クリックで（目標）追加MRR の大きい順に並べ、目標に届く行に線を引きます"></div>
    <div class="tblwrap"><table class="deals" id="deals"></table></div>
    <nav class="pager" id="pager" aria-label="企業一覧のページ">
      <label for="pgSize">表示件数 <select id="pgSize"><option value="10">10件</option><option value="20" selected>20件</option><option value="30">30件</option><option value="40">40件</option></select></label>
      <span class="pginfo num" id="pgInfo"></span>
      <div class="pgbtns"><button type="button" class="pgb" id="pgPrev" aria-label="前のページ">‹ 前へ</button><span id="pgNums"></span><button type="button" class="pgb" id="pgNext" aria-label="次のページ">次へ ›</button></div>
    </nav>
  </section>

  <details class="card devsec" id="gapsSec">
    <summary class="card-h"><h2>いま埋まっていない項目</h2><span class="sub">まだ出せていないもの・人が入れないと埋まらないもの（2026-10-02 時点）</span></summary>
    <div class="gaps" id="gaps"></div>
  </details>

  <footer>
    <b>データは Twenty CRM の実データ（取得時点のスナップショット）です。</b> 対象は Ptengine AI ステータスが入っている、または顧客ソースが PGA_TARGET の企業（Company）。案件（Opportunity）は名称「Ptengine AI - 企業名」と企業名で照合、議事録（Note）はタイトルの企業名で照合しています。
    ネクストアクションは商談管理タブで入力した値だけを使います。Company「Next Action」欄は行動履歴タブで参照するだけです。
    担当は Notion 顧客DB の「担当3」（2026-09-28 時点）を主担当として使用。担当3が空の14社は Twenty の Ptengine AI担当（SHINICHI_NAGAI→Paul、BB→Baba 等）で、共同の場合は均等に按分しています。Perry の担当はありません。
    目標（全体・担当者別）はページ上で編集でき、保存すると閲覧者全員に共有されます（初期値：全体4,000万／Paul 1,200・Baba 1,000・Eri 800・Kubotie 600・Ava 400万円）。支給率ステージの境界は全体目標の25／50／75／100%。フェーズは Salesforce の商談フェーズに合わせています。フェーズ確率（初回アポ実施前0・初回アポ実施済み10・トライアル開始済み30・最終見積もり提示済み55・口頭合意獲得済み80・申込用紙回収済み95・契約締結済み100・失注0%）は暫定値です。フェーズは Twenty の stage に同じ値があればそれを使い、無ければ Ptengine AI ステータスと案件ステージから暫定判定しています。
  </footer>
</div>
<div class="tip" id="tip" role="status" aria-live="polite"></div>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle" aria-hidden="true">
  <div class="dresize" id="dResize" role="separator" aria-orientation="vertical" aria-label="パネルの幅を変更（ドラッグ、または左右キー。ダブルクリックで元の幅）" tabindex="0"></div>
  <div class="dh" id="dHead"></div>
  <div class="db" id="dBody"></div>
</aside>
`;
