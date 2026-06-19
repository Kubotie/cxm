/**
 * ptmind_deck_helpers.js
 *
 * pptxgenjs を PTmind ブランド準拠で扱うためのヘルパー関数群。
 *
 * 使い方:
 *   const pptxgen = require('pptxgenjs');
 *   const P = require('./ptmind_deck_helpers.js');
 *
 *   const pres = new pptxgen();
 *   P.setupPresentation(pres);
 *
 *   P.addCover(pres, {
 *     clientName: '◯◯株式会社',
 *     mainTitle: '貴社の顧客理解を、\nデータで加速する',
 *     subTitle: 'ご提案書',
 *     author: '株式会社ピーティーマインド'
 *   });
 *
 *   P.addSectionDivider(pres, { number: '01', title: 'Our Proposal' });
 *
 *   P.addThreeColumnFlow(pres, {
 *     title: '課題→解決→効果',
 *     columns: [
 *       { header:'課題', items:['◯◯が見えない','△△が回らない'] },
 *       { header:'解決', items:['Ptengineで可視化','CS伴走で設計'] },
 *       { header:'効果', items:['CVR +28%','工数 -40%'] }
 *     ]
 *   });
 *
 *   P.addKpiGrid(pres, { title:'今月のKPI', kpis:[...] });
 *
 *   await pres.writeFile({ fileName: 'output.pptx' });
 */

const TOKENS = {
  lime: 'C8F050',
  black: '101C1F',
  white: 'FFFFFF',
  forest: '1E4830',
  olive: '5A7133',
  green: '25AC00',
  orange: 'FF903B',
  blue: '579FF8',
  yellow: 'F7E08C',
  red: '902F5C',
  fuchsia: '7A7D9C',
  pink: 'DF62C2',
  skin: 'E3BD97',
  textMuted: '5A6568',
  divider: 'E5E8E3',
  bgSection: 'F4F6F3',
  primaryVariant2: '0EB83A',
  neutralLime: '84CF02',
  b900: '1C272A',
};

// フォント方針：日本語を Noto Sans JP に統一する。
// Noto Sans JP は Latin もカバーするため、英字・数字も同じファミリで表示でき、視覚的な混在を避けられる。
// ただし KPI の大きな数字や Period ラベル（例：Week 1-2）など、プロポーショナル幅の英字が
// 強調されたほうが読みやすい場面のために FONT_EN は別ファミリに差し替え可能にしている。
// デフォルトでは日本語フォントに合わせるため FONT_EN = FONT_JP として統一。
const FONT_JP = 'Noto Sans JP';
const FONT_EN = 'Noto Sans JP';

/**
 * プレゼン全体のセットアップ。16:9サイズを設定。
 * 参考フォーマットに合わせてマスタスライドには以下を組み込む：
 *   - 右上：Black 平行四辺形のロゴプレート（PTMINDテキスト）
 *   - 下端：水平仕切線 + CONFIDENTIAL（左）+ 著作権（中央）+ ページ番号（右）
 * タイトルバナー（左上のLime台形）は _addHeaderBanner で各スライドに個別付与する。
 *
 * @param {object} globalOpts
 *   - copyrightYear: 著作権表記の西暦（省略時は現在年）
 *   - logoText: ロゴに表示する文字列（デフォルト "PTMIND"）
 */
function setupPresentation(pres, globalOpts) {
  globalOpts = globalOpts || {};
  const year = globalOpts.copyrightYear || new Date().getFullYear();
  const logoText = globalOpts.logoText || 'PTMIND';

  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 inch
  pres.defineSlideMaster({
    title: 'PTMIND_MASTER',
    background: { color: TOKENS.white },
    objects: [
      // === 右上ロゴプレート（Black 矩形）===
      { rect: {
          x:11.2, y:0, w:2.14, h:0.7,
          fill: { color: TOKENS.black }, line: { color: TOKENS.black }
      }},
      // ロゴ先頭のLimeドット（"P"マークのプレースホルダ）
      { rect: {
          x:11.35, y:0.25, w:0.2, h:0.2,
          fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }, rectRadius:0.1
      }},
      { text: {
          text: logoText,
          options: {
            x:11.3, y:0.12, w:1.95, h:0.45,
            fontFace: FONT_JP, fontSize:14, bold:true, color: TOKENS.white,
            align:'right', valign:'middle', charSpacing:1
          }
      }},

      // === フッター水平仕切線 ===
      { line: {
          x:0.4, y:7.05, w:12.53, h:0,
          line: { color: TOKENS.divider, width:0.75 }
      }},

      // === フッター左：CONFIDENTIAL ===
      { text: {
          text: 'CONFIDENTIAL',
          options: {
            x:0.4, y:7.15, w:2.5, h:0.3,
            fontFace: FONT_JP, fontSize:9, color: TOKENS.textMuted, charSpacing:2
          }
      }},

      // === フッター中央：著作権 ===
      { text: {
          text: `© ${year} Ptmind inc.  All rights reserved.`,
          options: {
            x:4.5, y:7.15, w:4.5, h:0.3,
            fontFace: FONT_JP, fontSize:9, color: TOKENS.textMuted, align:'center'
          }
      }},
    ],
    // === フッター右：ページ番号 ===
    slideNumber: { x:12.6, y:7.15, w:0.6, h:0.3, fontFace: FONT_JP, fontSize:10, color: TOKENS.textMuted, align:'right' }
  });
  return pres;
}

/**
 * 表紙スライド追加
 * @param {object} opts
 *   - clientName: 「◯◯株式会社 御中」
 *   - mainTitle: 大見出し（改行可）
 *   - subTitle: 副題（例：ご提案書 / 運用レポート）
 *   - author: 差出人（株式会社ピーティーマインド）
 *   - date: 日付（任意）
 *   - variant: 'light' | 'dark' | 'gradient'（デフォルト:light）
 */
function addCover(pres, opts) {
  const slide = pres.addSlide();
  const variant = opts.variant || 'light';

  if (variant === 'light') {
    // 背景白、左に斜めLimeブロック
    slide.background = { color: TOKENS.white };
    slide.addShape(pres.ShapeType.rect, {
      x:0, y:0, w:6.8, h:7.5,
      fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }
    });
    slide.addShape(pres.ShapeType.rtTriangle, {
      x:5.5, y:0, w:2.5, h:7.5,
      fill: { color: TOKENS.forest }, line: { color: TOKENS.forest }
    });
    slide.addText(opts.mainTitle || 'ご提案タイトル', {
      x:0.6, y:2.4, w:6.2, h:2.2,
      fontFace: FONT_JP, fontSize:34, bold:true, color: TOKENS.black, charSpacing:-1
    });
    if (opts.subTitle) {
      slide.addText(opts.subTitle, {
        x:0.6, y:4.6, w:6.2, h:0.6,
        fontFace: FONT_JP, fontSize:18, color: TOKENS.forest
      });
    }
    if (opts.clientName) {
      slide.addText(`${opts.clientName} 御中`, {
        x:8.2, y:6.0, w:4.6, h:0.4,
        fontFace: FONT_JP, fontSize:14, color: TOKENS.black, align:'right'
      });
    }
    if (opts.author) {
      slide.addText(opts.author, {
        x:8.2, y:6.5, w:4.6, h:0.35,
        fontFace: FONT_JP, fontSize:12, color: TOKENS.textMuted, align:'right'
      });
    }
    if (opts.date) {
      slide.addText(opts.date, {
        x:8.2, y:6.9, w:4.6, h:0.3,
        fontFace: FONT_EN, fontSize:10, color: TOKENS.textMuted, align:'right'
      });
    }
  } else if (variant === 'dark') {
    slide.background = { color: TOKENS.black };
    slide.addText(opts.mainTitle || 'ご提案タイトル', {
      x:0.8, y:2.8, w:11.7, h:2.2,
      fontFace: FONT_JP, fontSize:40, bold:true, color: TOKENS.lime, charSpacing:-1
    });
    if (opts.subTitle) {
      slide.addText(opts.subTitle, {
        x:0.8, y:4.9, w:11.7, h:0.6,
        fontFace: FONT_JP, fontSize:18, color: TOKENS.white
      });
    }
    if (opts.clientName) {
      slide.addText(`${opts.clientName} 御中`, {
        x:0.8, y:6.3, w:11.7, h:0.4,
        fontFace: FONT_JP, fontSize:14, color: TOKENS.white
      });
    }
  }
  return slide;
}

/**
 * 目次スライド
 * @param {object} opts
 *   - title: ページタイトル（デフォルト「本日お話しすること」）
 *   - items: [{n:'01', title:'...', sub:'...'}, ...]
 */
function addAgenda(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || '本日お話しすること');

  const items = opts.items || [];
  const startY = 1.5;
  items.forEach((it, i) => {
    const y = startY + i * 0.95;
    slide.addShape(pres.ShapeType.ellipse, {
      x:0.6, y, w:0.7, h:0.7,
      fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }
    });
    slide.addText(it.n || String(i + 1).padStart(2, '0'), {
      x:0.6, y, w:0.7, h:0.7,
      fontFace: FONT_EN, fontSize:16, bold:true, color: TOKENS.black, align:'center', valign:'middle'
    });
    slide.addText(it.title || '', {
      x:1.5, y:y + 0.02, w:11.2, h:0.42,
      fontFace: FONT_JP, fontSize:18, bold:true, color: TOKENS.black
    });
    if (it.sub) {
      slide.addText(it.sub, {
        x:1.5, y:y + 0.45, w:11.2, h:0.3,
        fontFace: FONT_JP, fontSize:12, color: TOKENS.textMuted
      });
    }
  });
  return slide;
}

/**
 * 章扉（セクションディバイダー）
 * @param {object} opts
 *   - number: '01', '02', ...
 *   - title: 「Our Proposal」「Impact」など
 *   - subtitle: 任意
 */
function addSectionDivider(pres, opts) {
  const slide = pres.addSlide();
  slide.background = { color: TOKENS.black };
  slide.addText(opts.number || '01', {
    x:1.0, y:2.2, w:3, h:2,
    fontFace: FONT_EN, fontSize:96, bold:true, color: TOKENS.lime, charSpacing:-2
  });
  slide.addText(opts.title || 'Section', {
    x:1.0, y:4.3, w:11, h:1.2,
    fontFace: FONT_JP, fontSize:40, bold:true, color: TOKENS.white, charSpacing:-1
  });
  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x:1.0, y:5.6, w:11, h:0.5,
      fontFace: FONT_JP, fontSize:16, color: TOKENS.lime
    });
  }
  return slide;
}

/**
 * 3列カードレイアウト（課題→解決→効果、など）
 * @param {object} opts
 *   - title: スライドタイトル
 *   - columns: [{ header, items:[string], icon:'🔍'(optional), colorOverride:'C8F050'(optional) }]
 */
function addThreeColumnFlow(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || '');

  const cols = opts.columns || [];
  cols.forEach((col, i) => {
    const x = 0.55 + i * 4.27;
    slide.addShape(pres.ShapeType.roundRect, {
      x, y:1.6, w:4.05, h:5.2,
      fill: { color: TOKENS.white }, line: { color: TOKENS.divider, width:1 }, rectRadius:0.08
    });
    // アイコン円
    slide.addShape(pres.ShapeType.ellipse, {
      x: x + 1.42, y:1.95, w:1.2, h:1.2,
      fill: { color: col.colorOverride || TOKENS.lime }, line: { color: col.colorOverride || TOKENS.lime }
    });
    if (col.icon) {
      slide.addText(col.icon, {
        x: x + 1.42, y:1.95, w:1.2, h:1.2,
        fontFace: FONT_JP, fontSize:28, color: TOKENS.black, align:'center', valign:'middle'
      });
    }
    // ヘッダ
    slide.addText(col.header || '', {
      x, y:3.35, w:4.05, h:0.55,
      fontFace: FONT_JP, fontSize:22, bold:true, color: TOKENS.black, align:'center'
    });
    // 区切り
    slide.addShape(pres.ShapeType.line, {
      x: x + 1.4, y:3.95, w:1.25, h:0,
      line: { color: col.colorOverride || TOKENS.lime, width:2.5 }
    });
    // アイテム
    (col.items || []).forEach((ln, j) => {
      slide.addText('・' + ln, {
        x: x + 0.35, y:4.15 + j * 0.5, w:3.4, h:0.45,
        fontFace: FONT_JP, fontSize:14, color: TOKENS.black
      });
    });
  });
  return slide;
}

/**
 * KPIグリッド（2x3 or 3x2）
 * @param {object} opts
 *   - title: スライドタイトル
 *   - kpis: [{ label, value, unit, delta, positive:true|false }]
 */
function addKpiGrid(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || 'KPIサマリ');
  const kpis = opts.kpis || [];
  const cols = 3;
  kpis.forEach((k, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 0.55 + col * 4.27;
    const y = 1.55 + row * 2.6;
    // カード
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w:4.05, h:2.4,
      fill: { color: TOKENS.white }, line: { color: TOKENS.divider, width:1 }, rectRadius:0.08
    });
    // ラベル
    slide.addText(k.label || '', {
      x: x + 0.25, y: y + 0.2, w:3.6, h:0.3,
      fontFace: FONT_JP, fontSize:13, color: TOKENS.textMuted
    });
    // 数値
    slide.addText(String(k.value || ''), {
      x: x + 0.25, y: y + 0.55, w:3.6, h:1.1,
      fontFace: FONT_EN, fontSize:44, bold:true, color: TOKENS.black
    });
    // 単位
    if (k.unit) {
      slide.addText(k.unit, {
        x: x + 0.25, y: y + 1.75, w:0.8, h:0.3,
        fontFace: FONT_EN, fontSize:13, color: TOKENS.textMuted
      });
    }
    // デルタ
    if (k.delta) {
      const deltaColor = k.positive === false ? TOKENS.red : TOKENS.green;
      slide.addText(k.delta, {
        x: x + 2.0, y: y + 1.75, w:1.85, h:0.35,
        fontFace: FONT_EN, fontSize:13, bold:true, color: deltaColor, align:'right'
      });
    }
  });
  return slide;
}

/**
 * 2列レイアウト（左画像/アイコン＋右テキスト）
 * @param {object} opts
 *   - title
 *   - leftType: 'image' | 'mock' | 'icon-grid'
 *   - leftContent: (imageの場合) 画像パス / (iconの場合) [{icon,title,text}]
 *   - rightBullets: [{header, body}]
 */
function addTwoColumn(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || '');

  // 左エリア
  if (opts.leftType === 'image' && opts.leftContent) {
    slide.addImage({ path: opts.leftContent, x:0.55, y:1.6, w:6.0, h:5.2, sizing:{ type:'cover', w:6.0, h:5.2 } });
  } else if (opts.leftType === 'icon-grid' && Array.isArray(opts.leftContent)) {
    const grid = opts.leftContent;
    grid.forEach((item, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.55 + col * 3.2, y = 1.6 + row * 2.5;
      slide.addShape(pres.ShapeType.roundRect, {
        x, y, w:3.0, h:2.3, fill:{ color: TOKENS.bgSection }, line:{ color: TOKENS.divider, width:1 }, rectRadius:0.06
      });
      slide.addShape(pres.ShapeType.ellipse, { x:x+0.2, y:y+0.2, w:0.8, h:0.8, fill:{ color: TOKENS.lime }, line:{ color: TOKENS.lime } });
      slide.addText(item.title || '', { x:x+0.15, y:y+1.1, w:2.7, h:0.35, fontFace: FONT_JP, fontSize:14, bold:true, color: TOKENS.black });
      slide.addText(item.text  || '', { x:x+0.15, y:y+1.5, w:2.7, h:0.7,  fontFace: FONT_JP, fontSize:11, color: TOKENS.textMuted });
    });
  }

  // 右エリア（bullets）
  const bullets = opts.rightBullets || [];
  bullets.forEach((b, i) => {
    const y = 1.7 + i * 1.4;
    slide.addShape(pres.ShapeType.rect, {
      x:7.0, y, w:0.1, h:1.1, fill:{ color: TOKENS.lime }, line:{ color: TOKENS.lime }
    });
    slide.addText(b.header || '', { x:7.3, y:y, w:5.6, h:0.4, fontFace: FONT_JP, fontSize:17, bold:true, color: TOKENS.black });
    slide.addText(b.body   || '', { x:7.3, y:y+0.42, w:5.6, h:0.7, fontFace: FONT_JP, fontSize:13, color: TOKENS.textMuted });
  });
  return slide;
}

/**
 * Before / After 2列比較
 *
 * @param {object} opts
 *   - title
 *   - beforeTitle / beforeItems
 *   - afterTitle / afterItems
 *   - arrowKeywords: ['中心 → 分散', ...] 指定時は中央矢印を大きくし、変換語を内包する（参考フォーマット準拠）
 */
function addBeforeAfter(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || '導入前後の変化');

  const hasKW = Array.isArray(opts.arrowKeywords) && opts.arrowKeywords.length > 0;
  // キーワード付きの場合は左右カードを狭め、中央矢印を大きく
  const leftW = hasKW ? 4.8 : 5.8;
  const rightW = hasKW ? 4.8 : 5.6;
  const rightX = hasKW ? 8.0 : 7.2;

  // Before カード
  slide.addShape(pres.ShapeType.roundRect, {
    x:0.55, y:1.6, w:leftW, h:5.2,
    fill: { color: TOKENS.bgSection }, line: { color: TOKENS.divider, width:1 }, rectRadius:0.08
  });
  slide.addText('BEFORE', { x:0.55, y:1.75, w:leftW, h:0.4, fontFace: FONT_EN, fontSize:12, bold:true, color: TOKENS.textMuted, align:'center', charSpacing:2 });
  slide.addText(opts.beforeTitle || '', { x:0.55, y:2.2, w:leftW, h:0.6, fontFace: FONT_JP, fontSize:18, bold:true, color: TOKENS.black, align:'center' });
  (opts.beforeItems || []).forEach((ln, i) => {
    slide.addText('・' + ln, { x:0.95, y:3.0 + i*0.5, w:leftW - 0.5, h:0.45, fontFace: FONT_JP, fontSize:13, color: TOKENS.textMuted });
  });

  // 中央矢印
  if (hasKW) {
    // Forest Green の大きい矢印 + 変換キーワード内包
    slide.addShape(pres.ShapeType.rightArrow, {
      x:5.5, y:2.5, w:2.3, h:3.0,
      fill: { color: TOKENS.forest }, line: { color: TOKENS.forest }
    });
    slide.addText(opts.arrowKeywords.join('\n'), {
      x:5.6, y:2.5, w:1.6, h:3.0,
      fontFace: FONT_JP, fontSize:14, bold:true, color: TOKENS.white,
      align:'center', valign:'middle', paraSpaceAfter:4
    });
  } else {
    // コンパクト矢印
    slide.addShape(pres.ShapeType.rightArrow, {
      x:6.45, y:3.9, w:0.7, h:0.6,
      fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }
    });
  }

  // After カード
  slide.addShape(pres.ShapeType.roundRect, {
    x:rightX, y:1.6, w:rightW, h:5.2,
    fill: { color: TOKENS.white }, line: { color: TOKENS.lime, width:2 }, rectRadius:0.08
  });
  slide.addText('AFTER', { x:rightX, y:1.75, w:rightW, h:0.4, fontFace: FONT_EN, fontSize:12, bold:true, color: TOKENS.forest, align:'center', charSpacing:2 });
  slide.addText(opts.afterTitle || '', { x:rightX, y:2.2, w:rightW, h:0.6, fontFace: FONT_JP, fontSize:18, bold:true, color: TOKENS.black, align:'center' });
  (opts.afterItems || []).forEach((ln, i) => {
    slide.addText('・' + ln, { x:rightX + 0.35, y:3.0 + i*0.5, w:rightW - 0.5, h:0.45, fontFace: FONT_JP, fontSize:13, color: TOKENS.black });
  });
  return slide;
}

/**
 * タイムライン（横型）
 * @param {object} opts
 *   - title
 *   - phases: [{ label, period, bullets:[...] }]
 */
function addTimeline(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || '導入プロセス');
  const phases = opts.phases || [];
  const n = phases.length;
  const trackY = 3.0;

  // ライン
  slide.addShape(pres.ShapeType.line, {
    x:0.9, y:trackY, w:11.5, h:0,
    line: { color: TOKENS.lime, width:3 }
  });

  phases.forEach((ph, i) => {
    const x = 0.9 + (i + 0.5) * (11.5 / n) - 0.25;
    // 円マーカー
    slide.addShape(pres.ShapeType.ellipse, {
      x, y:trackY - 0.25, w:0.5, h:0.5,
      fill: { color: TOKENS.black }, line: { color: TOKENS.lime, width:3 }
    });
    // period（上）
    slide.addText(ph.period || '', {
      x: x - 1.5, y:trackY - 1.0, w:3.5, h:0.4,
      fontFace: FONT_EN, fontSize:12, bold:true, color: TOKENS.forest, align:'center'
    });
    // label（下）
    slide.addText(ph.label || '', {
      x: x - 1.5, y:trackY + 0.45, w:3.5, h:0.45,
      fontFace: FONT_JP, fontSize:16, bold:true, color: TOKENS.black, align:'center'
    });
    // bullets
    (ph.bullets || []).slice(0, 3).forEach((b, j) => {
      slide.addText('・' + b, {
        x: x - 1.3, y:trackY + 1.1 + j * 0.35, w:3.1, h:0.3,
        fontFace: FONT_JP, fontSize:11, color: TOKENS.textMuted, align:'center'
      });
    });
  });
  return slide;
}

/**
 * ネクストステップ3段階
 */
function addNextStep(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || '次のステップ');
  const steps = opts.steps || [];
  steps.forEach((s, i) => {
    const x = 0.55 + i * 4.27;
    slide.addShape(pres.ShapeType.roundRect, {
      x, y:2.0, w:4.05, h:4.5,
      fill: { color: i === 0 ? TOKENS.lime : TOKENS.white },
      line: { color: TOKENS.lime, width:2 }, rectRadius:0.08
    });
    slide.addText(s.when || '', {
      x, y:2.2, w:4.05, h:0.5,
      fontFace: FONT_EN, fontSize:14, bold:true, color: i === 0 ? TOKENS.black : TOKENS.forest, align:'center'
    });
    slide.addText(s.title || '', {
      x, y:2.9, w:4.05, h:0.6,
      fontFace: FONT_JP, fontSize:20, bold:true, color: TOKENS.black, align:'center'
    });
    (s.items || []).forEach((it, j) => {
      slide.addText('・' + it, {
        x: x + 0.4, y:3.8 + j * 0.45, w:3.4, h:0.4,
        fontFace: FONT_JP, fontSize:13, color: TOKENS.black
      });
    });
    // 矢印（最後以外）
    if (i < steps.length - 1) {
      slide.addShape(pres.ShapeType.rightArrow, {
        x: x + 4.08, y:4.0, w:0.2, h:0.4,
        fill: { color: TOKENS.forest }, line: { color: TOKENS.forest }
      });
    }
  });
  return slide;
}

/**
 * Executive Summary（CSレポート用）- 3ブロック縦積み
 * @param {object} opts
 *   - title
 *   - achievement: 文字列 or [文字列]
 *   - challenge: 文字列 or [文字列]
 *   - nextMove: 文字列 or [文字列]
 */
function addExecSummary(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.title || 'エグゼクティブサマリー');

  const blocks = [
    { label:'成果',      items: _arr(opts.achievement), color: TOKENS.lime,   textColor: TOKENS.black },
    { label:'伸びしろ',  items: _arr(opts.challenge),   color: TOKENS.orange, textColor: TOKENS.black },
    { label:'次の一手',  items: _arr(opts.nextMove),    color: TOKENS.black,  textColor: TOKENS.white },
  ];
  blocks.forEach((b, i) => {
    const y = 1.6 + i * 1.75;
    slide.addShape(pres.ShapeType.rect, {
      x:0.55, y, w:1.5, h:1.5,
      fill: { color: b.color }, line: { color: b.color }
    });
    slide.addText(b.label, {
      x:0.55, y, w:1.5, h:1.5,
      fontFace: FONT_JP, fontSize:16, bold:true, color: b.textColor, align:'center', valign:'middle'
    });
    (b.items || []).slice(0, 3).forEach((it, j) => {
      slide.addText('・' + it, {
        x:2.3, y:y + 0.15 + j * 0.5, w:10.5, h:0.45,
        fontFace: FONT_JP, fontSize:14, color: TOKENS.black
      });
    });
  });
  return slide;
}

/**
 * ステートメント + 比較スライド（参考フォーマット：AI-Ready / GDP成長）
 * 中央に赤強調を含むステートメント文を置き、下段に左右2つの事例/状態を並べ、
 * 中央に Forest Green の矢印（内部に変換キーワードを書ける）で接続する。
 *
 * @param {object} opts
 *   - eyebrow: 章タイトル（小見出し、任意）
 *   - title: メインタイトル
 *   - categoryTag: { label, icon } （任意：カテゴリタブを上部中央に表示）
 *   - statement: 文字列 or richText配列（本文：赤強調インライン可）
 *   - left:  { headline, body, image?, subBullets?:[...] }
 *   - right: { headline, body, image?, subBullets?:[...] }
 *   - arrowKeywords: ['中心 → 分散', '固定 → 柔軟', '管理 → 自律'] （矢印内の変換語、任意）
 */
function addStatementSlide(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, { eyebrow: opts.eyebrow, title: opts.title || '' });

  if (opts.categoryTag) {
    addCategoryTag(slide, pres, opts.categoryTag);
  }

  // === ステートメント本文 ===
  const stY = opts.categoryTag ? 1.7 : 1.3;
  const stText = Array.isArray(opts.statement)
    ? richText(opts.statement, { fontSize:16 })
    : (typeof opts.statement === 'string'
        ? [{ text: opts.statement, options: { fontFace: FONT_JP, fontSize:16, color: TOKENS.black } }]
        : null);
  if (stText) {
    slide.addText(stText, {
      x:0.8, y:stY, w:11.8, h:1.2,
      align:'center', valign:'middle', paraSpaceAfter:6
    });
  }

  // === 左右比較 ===
  // フッター(y=7.05)とぶつからないよう、カード高を絞って bullets を収める
  const cardY = 3.0;
  const cardH = 2.0;
  const leftX = 0.55, rightX = 8.5;
  const cardW = 4.3;
  const bulletStartY = cardY + cardH + 0.55; // headline(0.4) + gap(0.15)
  const bulletStep = 0.3;

  // 左カード
  if (opts.left) {
    if (opts.left.image) {
      slide.addImage({ path: opts.left.image, x:leftX, y:cardY, w:cardW, h:cardH, sizing:{ type:'cover', w:cardW, h:cardH } });
    } else {
      slide.addShape(pres.ShapeType.roundRect, {
        x:leftX, y:cardY, w:cardW, h:cardH,
        fill: { color: TOKENS.bgSection }, line: { color: TOKENS.divider, width:1 }, rectRadius:0.06
      });
    }
    if (opts.left.headline) {
      slide.addText(opts.left.headline, {
        x:leftX, y:cardY + cardH + 0.1, w:cardW, h:0.4,
        fontFace: FONT_JP, fontSize:13, bold:true, color: TOKENS.black, align:'center'
      });
    }
    (opts.left.subBullets || []).slice(0, 3).forEach((ln, i) => {
      slide.addText(ln, {
        x:leftX + 0.05, y:bulletStartY + i * bulletStep, w:cardW - 0.1, h:0.28,
        fontFace: FONT_JP, fontSize:10, color: TOKENS.textMuted, align:'left'
      });
    });
  }

  // 右カード
  if (opts.right) {
    if (opts.right.image) {
      slide.addImage({ path: opts.right.image, x:rightX, y:cardY, w:cardW, h:cardH, sizing:{ type:'cover', w:cardW, h:cardH } });
    } else {
      slide.addShape(pres.ShapeType.roundRect, {
        x:rightX, y:cardY, w:cardW, h:cardH,
        fill: { color: TOKENS.bgSection }, line: { color: TOKENS.lime, width:2 }, rectRadius:0.06
      });
    }
    if (opts.right.headline) {
      slide.addText(opts.right.headline, {
        x:rightX, y:cardY + cardH + 0.1, w:cardW, h:0.4,
        fontFace: FONT_JP, fontSize:13, bold:true, color: TOKENS.black, align:'center'
      });
    }
    (opts.right.subBullets || []).slice(0, 3).forEach((ln, i) => {
      slide.addText(ln, {
        x:rightX + 0.05, y:bulletStartY + i * bulletStep, w:cardW - 0.1, h:0.28,
        fontFace: FONT_JP, fontSize:10, color: TOKENS.textMuted, align:'left'
      });
    });
  }

  // === 中央：Forest Green 矢印（内部に変換キーワード）===
  const arrowX = 5.0, arrowY = cardY + 0.15, arrowW = 3.3, arrowH = 1.7;
  slide.addShape(pres.ShapeType.rightArrow, {
    x:arrowX, y:arrowY, w:arrowW, h:arrowH,
    fill: { color: TOKENS.forest }, line: { color: TOKENS.forest }
  });
  if (opts.arrowKeywords && opts.arrowKeywords.length) {
    const kwText = opts.arrowKeywords.join('\n');
    slide.addText(kwText, {
      x:arrowX + 0.1, y:arrowY, w:arrowW - 0.9, h:arrowH,
      fontFace: FONT_JP, fontSize:14, bold:true, color: TOKENS.white,
      align:'center', valign:'middle', paraSpaceAfter:4
    });
  }
  return slide;
}

/**
 * 比較 + ケーススタディサイドカード（参考フォーマット：組織転換スライド）
 * 左側：Before の図・説明、中央：矢印（▶）、右中央：After の図・説明、
 * 右端：ケーススタディカード（薄グレー角丸、緑見出し、箇条書き）
 *
 * @param {object} opts
 *   - eyebrow, title, categoryTag, statement : addStatementSlide と同様
 *   - before: { headline, body, image?, caption? }
 *   - after:  { headline, body, image?, caption? }
 *   - caseCard: { title, bullets:[string], highlightColor? }
 */
function addComparisonWithCase(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, { eyebrow: opts.eyebrow, title: opts.title || '' });

  if (opts.categoryTag) {
    addCategoryTag(slide, pres, opts.categoryTag);
  }

  // === ステートメント ===
  const stY = opts.categoryTag ? 1.7 : 1.3;
  if (opts.statement) {
    const stText = Array.isArray(opts.statement)
      ? richText(opts.statement, { fontSize:15 })
      : [{ text: opts.statement, options: { fontFace: FONT_JP, fontSize:15, color: TOKENS.black } }];
    slide.addText(stText, {
      x:0.8, y:stY, w:11.8, h:1.2,
      align:'center', valign:'middle', paraSpaceAfter:5
    });
  }

  // === Before / After 図エリア（左側8inch） ===
  const baseY = 3.3;
  const figH = 2.8;

  // Before (左)
  if (opts.before) {
    if (opts.before.headline) {
      slide.addShape(pres.ShapeType.roundRect, {
        x:0.55, y:baseY - 0.05, w:3.2, h:0.5,
        fill: { color: TOKENS.white }, line: { color: TOKENS.black, width:1 }, rectRadius:0.2
      });
      slide.addText(opts.before.headline, {
        x:0.55, y:baseY - 0.05, w:3.2, h:0.5,
        fontFace: FONT_JP, fontSize:13, bold:true, color: TOKENS.black, align:'center', valign:'middle'
      });
    }
    if (opts.before.image) {
      slide.addImage({ path: opts.before.image, x:0.6, y:baseY + 0.6, w:3.1, h:figH - 0.4 });
    }
    if (opts.before.caption) {
      slide.addText(opts.before.caption, {
        x:0.55, y:baseY + figH + 0.3, w:3.2, h:0.4,
        fontFace: FONT_JP, fontSize:11, color: TOKENS.textMuted, align:'center'
      });
    }
  }

  // 中央：矢印（▶）
  slide.addShape(pres.ShapeType.rightArrow, {
    x:3.95, y:baseY + figH / 2 - 0.25, w:0.6, h:0.5,
    fill: { color: TOKENS.black }, line: { color: TOKENS.black }
  });

  // After (中央)
  if (opts.after) {
    if (opts.after.headline) {
      slide.addShape(pres.ShapeType.roundRect, {
        x:4.8, y:baseY - 0.05, w:3.3, h:0.5,
        fill: { color: TOKENS.black }, line: { color: TOKENS.black }, rectRadius:0.2
      });
      slide.addText(opts.after.headline, {
        x:4.8, y:baseY - 0.05, w:3.3, h:0.5,
        fontFace: FONT_JP, fontSize:13, bold:true, color: TOKENS.white, align:'center', valign:'middle'
      });
    }
    if (opts.after.image) {
      slide.addImage({ path: opts.after.image, x:4.85, y:baseY + 0.6, w:3.2, h:figH - 0.4 });
    }
    if (opts.after.caption) {
      slide.addText(opts.after.caption, {
        x:4.8, y:baseY + figH + 0.3, w:3.3, h:0.4,
        fontFace: FONT_JP, fontSize:11, color: TOKENS.textMuted, align:'center'
      });
    }
  }

  // === ケーススタディカード（右端） ===
  if (opts.caseCard) {
    const cx = 8.5, cy = baseY - 0.2, cw = 4.4, ch = figH + 1.0;
    slide.addShape(pres.ShapeType.roundRect, {
      x:cx, y:cy, w:cw, h:ch,
      fill: { color: TOKENS.bgSection }, line: { color: TOKENS.divider, width:1 }, rectRadius:0.08
    });
    slide.addText(opts.caseCard.title || '', {
      x:cx + 0.25, y:cy + 0.35, w:cw - 0.5, h:0.5,
      fontFace: FONT_JP, fontSize:16, bold:true,
      color: opts.caseCard.highlightColor || TOKENS.forest,
      align:'center'
    });
    // 区切り線
    slide.addShape(pres.ShapeType.line, {
      x:cx + 0.8, y:cy + 1.0, w:cw - 1.6, h:0,
      line: { color: TOKENS.lime, width:2 }
    });
    (opts.caseCard.bullets || []).forEach((b, i) => {
      slide.addText(b, {
        x:cx + 0.35, y:cy + 1.3 + i * 0.6, w:cw - 0.7, h:0.5,
        fontFace: FONT_JP, fontSize:13, color: TOKENS.black, align:'center', valign:'middle'
      });
    });
  }

  return slide;
}

/**
 * クロージング / Thank you
 */
function addClosing(pres, opts) {
  const slide = pres.addSlide();
  slide.background = { color: TOKENS.black };
  slide.addText(opts.message || 'Be your best self.', {
    x:1, y:2.8, w:11.3, h:1.5,
    fontFace: FONT_JP, fontSize:44, bold:true, color: TOKENS.lime, align:'center', charSpacing:-1
  });
  if (opts.submessage) {
    slide.addText(opts.submessage, {
      x:1, y:4.3, w:11.3, h:0.6,
      fontFace: FONT_JP, fontSize:18, color: TOKENS.white, align:'center'
    });
  }
  slide.addText('© Ptmind, Inc.', {
    x:1, y:6.8, w:11.3, h:0.3,
    fontFace: FONT_EN, fontSize:10, color: TOKENS.textMuted, align:'center'
  });
  return slide;
}

// -------- internal --------

/**
 * スライドのヘッダーバナーを描画する。
 * 参考フォーマット（AI-Ready / 組織転換スライド）に準拠：
 *   - 左上：Lime の台形バナー（背景）
 *   - 上段：eyebrow（小見出し、任意）
 *   - 下段：メインタイトル（大きめ）
 *
 * 引数は「文字列」または { eyebrow, title } のオブジェクトを受け付ける。
 */
function _addSlideTitle(slide, titleOrOpts) {
  if (!titleOrOpts) return;
  const opts = (typeof titleOrOpts === 'string') ? { title: titleOrOpts } : titleOrOpts;
  if (!opts.title && !opts.eyebrow) return;

  // Lime の台形バナー（左上）
  slide.addShape('rect', {
    x:0, y:0, w:9.2, h:0.9,
    fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }
  });
  // 右端の斜めカット（Lime -> White への台形演出）
  slide.addShape('rtTriangle', {
    x:9.2, y:0, w:0.9, h:0.9,
    fill: { color: TOKENS.lime }, line: { color: TOKENS.lime },
    flipV: true
  });

  if (opts.eyebrow) {
    slide.addText(opts.eyebrow, {
      x:0.4, y:0.08, w:8.5, h:0.32,
      fontFace: FONT_JP, fontSize:12, color: TOKENS.black, charSpacing:1
    });
    slide.addText(opts.title || '', {
      x:0.4, y:0.38, w:8.5, h:0.5,
      fontFace: FONT_JP, fontSize:20, bold:true, color: TOKENS.black, charSpacing:-1
    });
  } else {
    slide.addText(opts.title || '', {
      x:0.4, y:0.15, w:8.5, h:0.6,
      fontFace: FONT_JP, fontSize:22, bold:true, color: TOKENS.black, charSpacing:-1, valign:'middle'
    });
  }
}

/**
 * カテゴリタグ（Forest Green 角丸矩形 + 小アイコン + ラベル）を任意位置に配置。
 * 参考フォーマットの「組織」タブのような見せ方。
 *
 * @param {object} slide
 * @param {object} pres  - ShapeType 参照用
 * @param {object} opts  - { label, icon?, x?, y?, w? }
 */
function addCategoryTag(slide, pres, opts) {
  const x = (opts.x !== undefined) ? opts.x : 5.8;
  const y = (opts.y !== undefined) ? opts.y : 1.05;
  const w = opts.w || 2.0;

  // アイコン部分（Lime角丸、小さい記号）
  if (opts.icon) {
    slide.addShape(pres.ShapeType.roundRect, {
      x: x - 0.5, y, w:0.45, h:0.45,
      fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }, rectRadius:0.08
    });
    slide.addText(opts.icon, {
      x: x - 0.5, y, w:0.45, h:0.45,
      fontFace: FONT_JP, fontSize:14, bold:true, color: TOKENS.black, align:'center', valign:'middle'
    });
  }

  // ラベルタブ（Forest Green）
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h:0.45,
    fill: { color: TOKENS.forest }, line: { color: TOKENS.forest }, rectRadius:0.04
  });
  slide.addText(opts.label || '', {
    x, y, w, h:0.45,
    fontFace: FONT_JP, fontSize:13, bold:true, color: TOKENS.white, align:'center', valign:'middle'
  });
}

/**
 * リッチテキスト（インラインの赤強調）を組み立てる。
 * 参考フォーマットでは「技術の本質に合わせて、仕組みやプロセス全体を見直すこと」のように
 * 本文中のキーフレーズを赤太字で強調する。pptxgenjs の配列形式のテキストランに変換する。
 *
 * 使い方:
 *   richText([
 *     '新しい技術は「ただ置き換えて導入するだけ」では本来の価値を発揮することができません。\n',
 *     { text:'技術の本質に合わせて、仕組みやプロセス全体を見直すこと', emphasis:true },
 *     'が変革の鍵です。'
 *   ])
 *
 * @param {Array<string|{text:string, emphasis?:boolean, bold?:boolean, color?:string}>} parts
 * @param {object} baseOpts - 共通スタイル（省略可）
 * @returns {Array} pptxgenjs addText 用のランリスト
 */
function richText(parts, baseOpts) {
  baseOpts = baseOpts || {};
  return parts.map(p => {
    if (typeof p === 'string') {
      return { text: p, options: { fontFace: FONT_JP, color: TOKENS.black, ...baseOpts } };
    }
    const runOpts = { fontFace: FONT_JP, color: TOKENS.black, ...baseOpts };
    if (p.emphasis) {
      runOpts.color = TOKENS.red;
      runOpts.bold = true;
    }
    if (p.bold !== undefined) runOpts.bold = p.bold;
    if (p.color) runOpts.color = p.color;
    if (p.fontSize) runOpts.fontSize = p.fontSize;
    return { text: p.text, options: runOpts };
  });
}

function _arr(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  return [x];
}

// ====================================================================
// === チャート系ヘルパー ==============================================
// ====================================================================
// デジタル庁「ダッシュボードのデザインガイドブック」（2026年版）の Chapter 4 に基づく。
// 配色のみ PTmind の Lime / Black / Forest 軸へ置換している。詳細は references/charts.md。
// 原則：
//   - 棒グラフの原点は必ず 0（valAxisMinVal: 0）
//   - 装飾は最小限（shadow なし / border なし / 3Dなし）
//   - 凡例・軸ラベルは Noto Sans JP に統一
//   - 注目系列のみ black/lime、その他は muted に落として「色数を絞る」

/**
 * すべてのチャート共通のベースオプション。
 * pptxgenjs の addChart(opts) に展開される。
 */
function _chartBaseOpts(overrides) {
  const base = {
    catAxisLabelFontFace: FONT_JP,
    catAxisLabelFontSize: 10,
    catAxisLabelColor: TOKENS.textMuted,
    valAxisLabelFontFace: FONT_JP,
    valAxisLabelFontSize: 10,
    valAxisLabelColor: TOKENS.textMuted,
    valGridLine: { style: 'solid', size: 0.5, color: TOKENS.divider },
    catGridLine: { style: 'none' },
    showTitle: false,                        // タイトルは自前でスライドに描画する
    showLegend: true,
    legendPos: 'b',
    legendFontFace: FONT_JP,
    legendFontSize: 10,
    legendColor: TOKENS.textMuted,
    dataLabelFontFace: FONT_JP,
    dataLabelFontSize: 10,
    dataLabelColor: TOKENS.black,
    border: { pt: 0, color: TOKENS.white },
    chartColorsOpacity: 100,
  };
  return Object.assign(base, overrides || {});
}

/** role 名 → Hex 色。references/charts.md の役割マッピングに沿う。 */
function _roleColor(role) {
  switch ((role || 'primary').toLowerCase()) {
    case 'highlight':  return TOKENS.lime;
    case 'secondary':  return TOKENS.forest;
    case 'secondary2': return TOKENS.olive;
    case 'reference':  return TOKENS.blue;
    case 'muted':      return TOKENS.textMuted;
    case 'positive':   return TOKENS.green;
    case 'negative':   return TOKENS.red;
    case 'neutral':    return TOKENS.fuchsia;
    case 'primary':
    default:           return TOKENS.black;
  }
}

/** series配列 → pptxgenjs のチャートデータ形式に変換 */
function _seriesToChartData(categories, series) {
  return series.map(s => ({
    name: s.name || 'series',
    labels: categories,
    values: s.values || []
  }));
}

/** series配列 → chartColors（Hex配列） */
function _seriesToChartColors(series) {
  return series.map(s => _roleColor(s.role));
}

/**
 * チャートスライドの枠組み（タイトル・サブタイトル・キャプション）を描画し、
 * グラフ本体を描くための領域 { x, y, w, h } を返す。
 */
function _drawChartFrame(slide, opts) {
  _addSlideTitle(slide, { eyebrow: opts.eyebrow, title: opts.title || '' });
  let topY = 1.25;
  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x: 0.5, y: 1.15, w: 12.3, h: 0.35,
      fontFace: FONT_JP, fontSize: 12, color: TOKENS.textMuted
    });
    topY = 1.6;
  }
  let bottomY = 6.85;
  if (opts.caption) {
    slide.addText(opts.caption, {
      x: 0.5, y: 6.65, w: 12.3, h: 0.3,
      fontFace: FONT_JP, fontSize: 10, color: TOKENS.textMuted, italic: true
    });
    bottomY = 6.55;
  }
  return { x: 0.5, y: topY, w: 12.3, h: bottomY - topY };
}

/**
 * 折れ線グラフスライド
 * @param {object} opts
 *   - eyebrow, title, subtitle, caption
 *   - categories: ['1月','2月',...]
 *   - series: [{ name, values, role }]
 *   - highlightIndex: 末尾などに注目ラベルを貼る位置（0-index、省略可）
 *   - valueFormat: '#,##0' / '0.0%' 等（既定 '#,##0'）
 */
function addLineChartSlide(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  const frame = _drawChartFrame(slide, opts);

  const categories = opts.categories || [];
  const series = opts.series || [];
  const data = _seriesToChartData(categories, series);
  const chartColors = _seriesToChartColors(series);

  const chartOpts = _chartBaseOpts({
    x: frame.x, y: frame.y, w: frame.w, h: frame.h,
    chartColors,
    lineSize: 2.25,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 6,
    lineDataSymbolLineSize: 1,
    lineDataSymbolLineColor: TOKENS.white,
    valAxisMinVal: 0,
    dataLabelFormatCode: opts.valueFormat || '#,##0',
    showLegend: series.length > 1,
  });
  slide.addChart(pres.ChartType.line, data, chartOpts);

  // Do-8「グラフと凡例を隣接」→ 最新値をハイライトラベルとして主系列に添える
  if (typeof opts.highlightIndex === 'number' && series[0]) {
    const idx = opts.highlightIndex;
    const v = (series[0].values || [])[idx];
    if (v !== undefined) {
      const labelX = frame.x + frame.w - 1.7;
      const labelY = frame.y + 0.05;
      slide.addShape(pres.ShapeType.roundRect, {
        x: labelX, y: labelY, w: 1.55, h: 0.5,
        fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }, rectRadius: 0.06
      });
      slide.addText(`${categories[idx]}：${v.toLocaleString('en-US')}`, {
        x: labelX, y: labelY, w: 1.55, h: 0.5,
        fontFace: FONT_JP, fontSize: 11, bold: true, color: TOKENS.black,
        align: 'center', valign: 'middle'
      });
    }
  }
  return slide;
}

/**
 * 棒グラフスライド
 * @param {object} opts
 *   - eyebrow, title, subtitle, caption
 *   - categories: カテゴリ名配列
 *   - series: [{ name, values, role }]
 *   - orientation: 'vertical'|'horizontal'（既定 'vertical'）
 *   - stacked: true で積み上げ
 *   - sortBy: 'value-desc'|'value-asc'（単一系列のみ対応、Do-2）
 *   - valueFormat: データラベル書式（既定 '#,##0'）
 */
function addBarChartSlide(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  const frame = _drawChartFrame(slide, opts);

  let categories = [...(opts.categories || [])];
  let series = (opts.series || []).map(s => Object.assign({}, s, {
    values: [...(s.values || [])]
  }));

  // Do-2: 並び順に意味を持たせる（単一系列のみ）
  if (opts.sortBy && series.length === 1) {
    const pairs = categories.map((c, i) => ({ c, v: series[0].values[i] }));
    if (opts.sortBy === 'value-desc') pairs.sort((a, b) => b.v - a.v);
    else if (opts.sortBy === 'value-asc') pairs.sort((a, b) => a.v - b.v);
    categories = pairs.map(p => p.c);
    series[0].values = pairs.map(p => p.v);
  }

  const isHorizontal = (opts.orientation === 'horizontal');

  // 水平棒はPPTの既定だと「1番目のカテゴリが下」に描画されるため、
  // 読み手の期待（1番上が最大）を満たすためにデータ順を反転しておく。
  // （chartOpts.catAxisOrderReverse も設定するが、libreoffice や一部ビューアで
  // 尊重されないケースがあるので、データ側で確定させる）
  if (isHorizontal) {
    categories = [...categories].reverse();
    series = series.map(s => Object.assign({}, s, { values: [...(s.values || [])].reverse() }));
  }

  const data = _seriesToChartData(categories, series);
  const chartColors = _seriesToChartColors(series);

  const chartOpts = _chartBaseOpts({
    x: frame.x, y: frame.y, w: frame.w, h: frame.h,
    chartColors,
    barDir: isHorizontal ? 'bar' : 'col',           // bar=水平, col=垂直
    barGrouping: opts.stacked ? 'stacked' : 'clustered',
    valAxisMinVal: 0,                               // Do-9: 原点は必ず 0
    showLegend: series.length > 1,
  });

  // 単一系列で非積み上げのときは値ラベルを出す（視認性向上）
  if (series.length === 1 && !opts.stacked) {
    chartOpts.showValue = true;
    chartOpts.dataLabelFormatCode = opts.valueFormat || '#,##0';
    chartOpts.dataLabelPosition = 'outEnd';
  }

  slide.addChart(pres.ChartType.bar, data, chartOpts);
  return slide;
}

/**
 * 面グラフスライド（時系列×構成比向け）
 * @param {object} opts
 *   - eyebrow, title, subtitle, caption
 *   - categories, series（role付き）
 *   - stacked: true で積み上げ面
 */
function addAreaChartSlide(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  const frame = _drawChartFrame(slide, opts);

  const categories = opts.categories || [];
  const series = opts.series || [];
  const data = _seriesToChartData(categories, series);
  const chartColors = _seriesToChartColors(series);

  const chartOpts = _chartBaseOpts({
    x: frame.x, y: frame.y, w: frame.w, h: frame.h,
    chartColors,
    chartColorsOpacity: 65,                         // 面グラフは透過で重なりを見せる
    barGrouping: opts.stacked ? 'stacked' : 'standard',
    valAxisMinVal: 0,
    showLegend: series.length > 1,
  });
  slide.addChart(pres.ChartType.area, data, chartOpts);
  return slide;
}

/**
 * ドーナツグラフスライド（円グラフの推奨代替）
 * @param {object} opts
 *   - eyebrow, title, subtitle, caption
 *   - items: [{ label, value, role? }]（3-5個まで推奨）
 *   - centerLabel: 中央の小見出し（例：「全体」）
 *   - centerValue: 中央の大数値（例：'4,000'）
 *   - centerUnit:  単位（例：'名'）
 */
function addDonutSlide(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  const frame = _drawChartFrame(slide, opts);

  const items = opts.items || [];
  // 既定色：0=Lime（最も注目）/ 1=Black / 2=Forest / 3=Olive / それ以降 textMuted
  const defaultColors = [TOKENS.lime, TOKENS.black, TOKENS.forest, TOKENS.olive, TOKENS.textMuted];
  const chartColors = items.map((it, i) =>
    it.role ? _roleColor(it.role) : (defaultColors[i] || TOKENS.textMuted)
  );

  const data = [{
    name: opts.name || 'donut',
    labels: items.map(it => it.label),
    values: items.map(it => it.value)
  }];

  // ドーナツを左寄せで正方形に、右側に凡例＋中央に合計値
  const donutSize = Math.min(frame.h, 5.2);
  const donutX = frame.x + 0.3;
  const donutY = frame.y + (frame.h - donutSize) / 2;

  const chartOpts = _chartBaseOpts({
    x: donutX, y: donutY, w: donutSize, h: donutSize,
    chartColors,
    holeSize: 60,
    showLegend: false,
    showPercent: false,
    showValue: false,
  });
  slide.addChart(pres.ChartType.doughnut, data, chartOpts);

  // 中央ラベル（Do-1: 全体合計を最も目立つ位置に）
  if (opts.centerValue || opts.centerLabel) {
    if (opts.centerLabel) {
      slide.addText(opts.centerLabel, {
        x: donutX, y: donutY + donutSize / 2 - 0.55, w: donutSize, h: 0.3,
        fontFace: FONT_JP, fontSize: 11, color: TOKENS.textMuted, align: 'center'
      });
    }
    if (opts.centerValue) {
      slide.addText(
        String(opts.centerValue) + (opts.centerUnit ? ` ${opts.centerUnit}` : ''),
        {
          x: donutX, y: donutY + donutSize / 2 - 0.2, w: donutSize, h: 0.7,
          fontFace: FONT_EN, fontSize: 32, bold: true, color: TOKENS.black,
          align: 'center', charSpacing: -1
        }
      );
    }
  }

  // 右側の凡例（色面＋ラベル＋数値＋%、Do-8: グラフと凡例を隣接）
  const legendX = donutX + donutSize + 0.4;
  const legendW = (frame.x + frame.w) - legendX;
  const legendTopY = donutY + 0.2;
  const lineH = Math.min(0.6, (donutSize - 0.4) / Math.max(items.length, 1));
  const total = items.reduce((s, it) => s + (Number(it.value) || 0), 0);
  items.forEach((it, i) => {
    const y = legendTopY + i * lineH;
    slide.addShape(pres.ShapeType.ellipse, {
      x: legendX, y: y + 0.08, w: 0.25, h: 0.25,
      fill: { color: chartColors[i] }, line: { color: chartColors[i] }
    });
    slide.addText(it.label, {
      x: legendX + 0.35, y: y, w: legendW - 0.35, h: 0.3,
      fontFace: FONT_JP, fontSize: 12, bold: true, color: TOKENS.black
    });
    const pct = total > 0 ? ((it.value / total) * 100).toFixed(1) : '0.0';
    slide.addText(
      `${Number(it.value).toLocaleString('en-US')}  （${pct}%）`,
      {
        x: legendX + 0.35, y: y + 0.26, w: legendW - 0.35, h: 0.3,
        fontFace: FONT_EN, fontSize: 11, color: TOKENS.textMuted
      }
    );
  });

  return slide;
}

/**
 * KPIカード + チャートの複合スライド（Do-1「全体指標と詳細グラフを同時に表示」）
 * @param {object} opts
 *   - eyebrow, title, subtitle, caption
 *   - kpi: { label, value, unit?, delta?, positive?, sub? }
 *   - chart: { type:'line'|'bar'|'area', categories, series }
 */
function addKpiWithChart(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, { eyebrow: opts.eyebrow, title: opts.title || '' });

  let topY = 1.25;
  if (opts.subtitle) {
    slide.addText(opts.subtitle, {
      x: 0.5, y: 1.15, w: 12.3, h: 0.35,
      fontFace: FONT_JP, fontSize: 12, color: TOKENS.textMuted
    });
    topY = 1.6;
  }

  // 左：KPIカード（Lime 面）
  const kpi = opts.kpi || {};
  const cardX = 0.5, cardY = topY + 0.1, cardW = 3.6, cardH = 4.3;
  slide.addShape(pres.ShapeType.roundRect, {
    x: cardX, y: cardY, w: cardW, h: cardH,
    fill: { color: TOKENS.lime }, line: { color: TOKENS.lime }, rectRadius: 0.12
  });
  slide.addText(kpi.label || '', {
    x: cardX + 0.3, y: cardY + 0.3, w: cardW - 0.6, h: 0.5,
    fontFace: FONT_JP, fontSize: 13, color: TOKENS.black
  });
  // 長い数値（例：2,345,000）は54ptだと改行するため、文字数に応じて自動縮小
  const kpiStr = String(kpi.value || '--');
  const kpiFontSize = kpiStr.length >= 8 ? 36 : (kpiStr.length >= 6 ? 44 : 54);
  slide.addText(kpiStr, {
    x: cardX + 0.3, y: cardY + 0.9, w: cardW - 0.6, h: 1.8,
    fontFace: FONT_EN, fontSize: kpiFontSize, bold: true, color: TOKENS.black,
    align: 'left', charSpacing: -1
  });
  if (kpi.unit) {
    slide.addText(kpi.unit, {
      x: cardX + 0.3, y: cardY + 2.65, w: cardW - 0.6, h: 0.4,
      fontFace: FONT_JP, fontSize: 14, color: TOKENS.black
    });
  }
  if (kpi.delta) {
    const deltaColor = kpi.positive ? TOKENS.forest : TOKENS.red;
    slide.addText(kpi.delta, {
      x: cardX + 0.3, y: cardY + 3.15, w: cardW - 0.6, h: 0.5,
      fontFace: FONT_EN, fontSize: 20, bold: true, color: deltaColor
    });
  }
  if (kpi.sub) {
    slide.addText(kpi.sub, {
      x: cardX + 0.3, y: cardY + 3.7, w: cardW - 0.6, h: 0.4,
      fontFace: FONT_JP, fontSize: 11, color: TOKENS.black
    });
  }

  // 右：チャート
  const chartCfg = opts.chart || {};
  const chartX = cardX + cardW + 0.3;
  const chartY = cardY;
  const chartW = 13.33 - chartX - 0.5;
  const chartH = cardH;

  const categories = chartCfg.categories || [];
  const series = chartCfg.series || [];
  const data = _seriesToChartData(categories, series);
  const chartColors = _seriesToChartColors(series);
  const type = chartCfg.type || 'line';

  let pptxType = pres.ChartType.line;
  if (type === 'bar')  pptxType = pres.ChartType.bar;
  if (type === 'area') pptxType = pres.ChartType.area;

  const chartOpts = _chartBaseOpts({
    x: chartX, y: chartY, w: chartW, h: chartH,
    chartColors,
    valAxisMinVal: 0,
    barDir: type === 'bar' ? 'col' : undefined,
    barGrouping: type === 'bar' ? 'clustered' : undefined,
    lineSize: type === 'line' ? 2.5 : undefined,
    lineDataSymbol: type === 'line' ? 'circle' : undefined,
    lineDataSymbolSize: type === 'line' ? 6 : undefined,
    chartColorsOpacity: type === 'area' ? 65 : 100,
    showLegend: series.length > 1,
  });
  slide.addChart(pptxType, data, chartOpts);

  // キャプション
  if (opts.caption) {
    slide.addText(opts.caption, {
      x: 0.5, y: 6.65, w: 12.3, h: 0.3,
      fontFace: FONT_JP, fontSize: 10, color: TOKENS.textMuted, italic: true
    });
  }
  return slide;
}

// ─── 追加レイアウト ────────────────────────────────────────────────────────────

const _colorMap = {
  lime:   'C8F050',
  forest: '1E4830',
  orange: 'FF903B',
  red:    '902F5C',
  black:  '101C1F',
  blue:   '579FF8',
  olive:  '5A7133',
};
function _resolveColor(c) { return _colorMap[c] || c || TOKENS.orange; }
function _textOnBg(c) {
  const dark = ['forest','red','black','olive','101C1F','1E4830','902F5C','5A7133'];
  return dark.some(d => (c || '').includes(d) || d === c) ? TOKENS.white : TOKENS.black;
}

/**
 * 4分割グリッド（2×2）— 課題・特徴・機能紹介などに
 * opts:
 *   title, eyebrow
 *   cards: [{ number?, title, body?, result?, color? }]  最大4件
 *     color: 'orange'|'lime'|'forest'|'black'|'red'|'blue'
 *   footer?: string  底部バナーテキスト（Black背景）
 */
function addFourGrid(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const cards = (opts.cards || []).slice(0, 4);
  const hasFooter = !!opts.footer;
  const totalH = hasFooter ? 3.8 : 5.3;
  const cardH = (totalH - 0.1) / 2;
  const cardW = 6.11;
  const startY = 1.3;

  cards.forEach((card, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.55 + col * (cardW + 0.16);
    const y = startY + row * (cardH + 0.12);
    const hdrColor = _resolveColor(card.color || 'orange');
    const txtColor = _textOnBg(card.color || 'orange');

    // カード枠
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w: cardW, h: cardH,
      fill: { color: TOKENS.white }, line: { color: TOKENS.divider, width: 1 }, rectRadius: 0.07,
    });
    // ヘッダーバー
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w: cardW, h: 0.5,
      fill: { color: hdrColor }, line: { color: hdrColor }, rectRadius: 0.07,
    });
    slide.addShape(pres.ShapeType.rect, {
      x, y: y + 0.28, w: cardW, h: 0.22,
      fill: { color: hdrColor }, line: { color: hdrColor },
    });
    // 番号
    if (card.number) {
      slide.addText(String(card.number).padStart(2, '0'), {
        x: x + 0.2, y: y + 0.07, w: 0.55, h: 0.36,
        fontFace: FONT_EN, fontSize: 14, bold: true, color: txtColor,
      });
    }
    // タイトル
    slide.addText(card.title || '', {
      x: x + (card.number ? 0.82 : 0.25), y: y + 0.08, w: cardW - 1.1, h: 0.36,
      fontFace: FONT_JP, fontSize: 16, bold: true, color: txtColor, valign: 'middle',
    });
    // 本文
    if (card.body) {
      slide.addText(card.body, {
        x: x + 0.28, y: y + 0.62, w: cardW - 0.56, h: cardH - (card.result ? 1.15 : 0.75),
        fontFace: FONT_JP, fontSize: 13, color: TOKENS.black, valign: 'top', wrap: true,
      });
    }
    // 結果ライン
    if (card.result) {
      const rc = _resolveColor(card.result_color || 'red');
      slide.addText('結果：' + card.result, {
        x: x + 0.28, y: y + cardH - 0.42, w: cardW - 0.56, h: 0.35,
        fontFace: FONT_JP, fontSize: 13, bold: true, color: rc,
      });
    }
  });

  // フッターバナー
  if (hasFooter) {
    const bannerY = startY + totalH + 0.1;
    slide.addShape(pres.ShapeType.roundRect, {
      x: 0.55, y: bannerY, w: 12.23, h: 0.62,
      fill: { color: TOKENS.black }, line: { color: TOKENS.black }, rectRadius: 0.07,
    });
    slide.addText(opts.footer, {
      x: 0.85, y: bannerY + 0.08, w: 11.9, h: 0.48,
      fontFace: FONT_JP, fontSize: 13, color: TOKENS.white, align: 'center', valign: 'middle',
    });
  }
  return slide;
}

/**
 * 変数式フロー（Formula × 演算子付き）
 * opts:
 *   title, eyebrow
 *   left_title:   左ブロックの見出し（例："ブランド成長"）
 *   left_body:    左ブロックの副題（例："LTV × 顧客数"）
 *   variables:    [{ n, label, color? }]  上段ボックス群（×でつなぐ）
 *   denominator:  { n, label, color? }    下段の別変数（省略可）
 *   note:         { bold, body? }          底部ノートボックス（省略可）
 */
function addFormulaFlow(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const vars  = opts.variables   || [];
  const denom = opts.denominator || null;
  const hasNote = !!(opts.note && opts.note.bold);
  const hasBottom = !!denom;

  // 左ブロック（黒背景）
  const leftX = 0.55, leftY = 1.35, leftW = 2.9;
  const leftH = hasBottom ? 3.8 : 3.1;
  slide.addShape(pres.ShapeType.roundRect, {
    x: leftX, y: leftY, w: leftW, h: leftH,
    fill: { color: TOKENS.black }, line: { color: TOKENS.black }, rectRadius: 0.1,
  });
  slide.addText(opts.left_title || '', {
    x: leftX + 0.15, y: leftY + 0.4, w: leftW - 0.3, h: 0.6,
    fontFace: FONT_JP, fontSize: 20, bold: true, color: TOKENS.lime, align: 'center',
  });
  if (opts.left_body) {
    slide.addText(opts.left_body, {
      x: leftX + 0.15, y: leftY + 1.05, w: leftW - 0.3, h: 0.45,
      fontFace: FONT_JP, fontSize: 13, color: TOKENS.white, align: 'center',
    });
  }
  // = 記号
  slide.addText('＝', {
    x: leftX + 0.6, y: leftY + leftH - 0.9, w: leftW - 1.2, h: 0.65,
    fontFace: FONT_EN, fontSize: 32, bold: true, color: TOKENS.lime, align: 'center',
  });

  // 上段変数ボックス
  const areaX = leftX + leftW + 0.3;
  const areaW = 13.333 - areaX - 0.55;
  const nv = vars.length;
  const gapX = 0.38;
  const bw = nv > 0 ? (areaW - (nv - 1) * gapX) / nv : areaW;
  const bh = 1.55, topY = 1.5;

  vars.forEach((v, i) => {
    const bx = areaX + i * (bw + gapX);
    const bc = _resolveColor(v.color || 'lime');
    slide.addShape(pres.ShapeType.roundRect, {
      x: bx, y: topY, w: bw, h: bh,
      fill: { color: TOKENS.white }, line: { color: bc, width: 2 }, rectRadius: 0.08,
    });
    if (v.n) {
      slide.addText(String(v.n).padStart(2, '0'), {
        x: bx + 0.18, y: topY + 0.12, w: bw - 0.36, h: 0.3,
        fontFace: FONT_EN, fontSize: 12, bold: true, color: bc,
      });
    }
    slide.addText(v.label || '', {
      x: bx + 0.1, y: topY + 0.52, w: bw - 0.2, h: 0.85,
      fontFace: FONT_JP, fontSize: 14, bold: true, color: TOKENS.black, align: 'center', wrap: true,
    });
    // × 記号（最後以外）
    if (i < nv - 1) {
      slide.addText('×', {
        x: bx + bw + 0.06, y: topY + 0.5, w: 0.26, h: 0.5,
        fontFace: FONT_EN, fontSize: 17, bold: true, color: TOKENS.textMuted, align: 'center',
      });
    }
  });

  // 仕切り線 + 下段変数
  if (hasBottom) {
    slide.addShape(pres.ShapeType.line, {
      x: areaX, y: topY + bh + 0.3, w: areaW, h: 0,
      line: { color: TOKENS.black, width: 1.2 },
    });
    const dc = _resolveColor(denom.color || 'red');
    const dw = Math.min(bw * 1.5, areaW * 0.45);
    const dx = areaX + (areaW - dw) / 2;
    const dy = topY + bh + 0.5;
    slide.addShape(pres.ShapeType.roundRect, {
      x: dx, y: dy, w: dw, h: bh,
      fill: { color: TOKENS.white }, line: { color: dc, width: 2.5 }, rectRadius: 0.08,
    });
    if (denom.n) {
      slide.addText(String(denom.n).padStart(2, '0'), {
        x: dx + 0.18, y: dy + 0.12, w: dw - 0.36, h: 0.3,
        fontFace: FONT_EN, fontSize: 12, bold: true, color: dc,
      });
    }
    slide.addText(denom.label || '', {
      x: dx + 0.1, y: dy + 0.52, w: dw - 0.2, h: 0.85,
      fontFace: FONT_JP, fontSize: 14, bold: true, color: TOKENS.black, align: 'center', wrap: true,
    });
  }

  // 底部ノートボックス
  if (hasNote) {
    const ny = hasBottom ? 5.2 : 4.65;
    slide.addShape(pres.ShapeType.roundRect, {
      x: 0.55, y: ny, w: 12.23, h: 1.1,
      fill: { color: TOKENS.bgSection }, line: { color: TOKENS.lime, width: 2 }, rectRadius: 0.07,
    });
    slide.addText(opts.note.bold, {
      x: 0.9, y: ny + 0.1, w: 11.5, h: 0.4,
      fontFace: FONT_JP, fontSize: 14, bold: true, color: TOKENS.black,
    });
    if (opts.note.body) {
      slide.addText(opts.note.body, {
        x: 0.9, y: ny + 0.56, w: 11.5, h: 0.35,
        fontFace: FONT_JP, fontSize: 13, color: TOKENS.textMuted,
      });
    }
  }
  return slide;
}

/**
 * 変数分解グリッド（Decomposition）— 2×N グリッド、変数ごとに式と説明
 * opts:
 *   title, eyebrow
 *   cells: [{
 *     number,   label,   formula,   body,
 *     color?:   'black'|'lime'|'forest'|'red'|'orange'  // ヘッダー背景色
 *     is_hypothesis?: true  // 右下固定の仮説カード
 *   }]  最大6件（3列×2行）
 */
function addDecompositionGrid(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const cells = (opts.cells || []).slice(0, 6);
  const cols  = 3;
  const rows  = Math.ceil(cells.length / cols);
  const cw    = (13.333 - 0.55 - 0.55 - (cols - 1) * 0.12) / cols;  // ≈4.17"
  const ch    = rows > 1 ? (5.3 - (rows - 1) * 0.15) / rows : 5.3;
  const startY = 1.3;

  cells.forEach((cell, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 0.55 + col * (cw + 0.12);
    const y = startY + row * (ch + 0.15);

    if (cell.is_hypothesis) {
      // 仮説カード（白背景+Lime枠）
      slide.addShape(pres.ShapeType.roundRect, {
        x, y, w: cw, h: ch,
        fill: { color: TOKENS.white }, line: { color: TOKENS.lime, width: 2 }, rectRadius: 0.08,
      });
      slide.addText('Hypothesis', {
        x: x + 0.25, y: y + 0.18, w: cw - 0.5, h: 0.35,
        fontFace: FONT_EN, fontSize: 13, bold: true, color: TOKENS.textMuted,
      });
      // Lime 仕切り線
      slide.addShape(pres.ShapeType.line, {
        x: x + 0.25, y: y + 0.6, w: cw * 0.35, h: 0,
        line: { color: TOKENS.lime, width: 2.5 },
      });
      if (cell.label) {
        slide.addText(cell.label, {
          x: x + 0.2, y: y + 0.78, w: cw - 0.4, h: 0.55,
          fontFace: FONT_JP, fontSize: 16, bold: true, color: TOKENS.black, wrap: true,
        });
      }
      if (cell.body) {
        slide.addText(cell.body, {
          x: x + 0.2, y: y + 1.45, w: cw - 0.4, h: ch - 1.65,
          fontFace: FONT_JP, fontSize: 12, color: TOKENS.textMuted, wrap: true,
        });
      }
      return;
    }

    const hdrColor = _resolveColor(cell.color || 'black');
    const hdrTxt   = _textOnBg(cell.color || 'black');

    // カード枠
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w: cw, h: ch,
      fill: { color: TOKENS.bgSection }, line: { color: TOKENS.divider, width: 1 }, rectRadius: 0.08,
    });
    // ヘッダーバー
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w: cw, h: 0.45,
      fill: { color: hdrColor }, line: { color: hdrColor }, rectRadius: 0.08,
    });
    slide.addShape(pres.ShapeType.rect, {
      x, y: y + 0.25, w: cw, h: 0.2,
      fill: { color: hdrColor }, line: { color: hdrColor },
    });
    // 番号+ラベル
    const numStr = cell.number ? String(cell.number).padStart(2, '0') + '  ' : '';
    slide.addText(numStr + (cell.label || ''), {
      x: x + 0.2, y: y + 0.07, w: cw - 0.4, h: 0.34,
      fontFace: FONT_JP, fontSize: 14, bold: true, color: hdrTxt, valign: 'middle',
    });
    // ＝ 記号
    slide.addText('＝', {
      x: x + 0.2, y: y + 0.56, w: 0.4, h: 0.35,
      fontFace: FONT_EN, fontSize: 16, bold: true, color: hdrColor,
    });
    // 式
    if (cell.formula) {
      slide.addText(cell.formula, {
        x: x + 0.2, y: y + 0.95, w: cw - 0.4, h: 0.8,
        fontFace: FONT_JP, fontSize: 12, bold: true, color: TOKENS.black, wrap: true, valign: 'top',
      });
    }
    // 説明
    if (cell.body) {
      slide.addText(cell.body, {
        x: x + 0.2, y: y + 1.9, w: cw - 0.4, h: ch - 2.1,
        fontFace: FONT_JP, fontSize: 11, color: TOKENS.textMuted, wrap: true, valign: 'top',
      });
    }
  });
  return slide;
}

// ─── 新レイアウト群 ────────────────────────────────────────────────────────────

/**
 * リスク＆対策表（risk_countermeasure）
 * 3列レイアウト: リスクID/名称（左）| なぜ起きるか（中）| 対策（右）
 * @param {object} opts
 *   - title / eyebrow
 *   - rows: [{ id, label, why, countermeasure }]
 */
function addRiskCountermeasure(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || 'リスクと対策'));

  const rows = opts.rows || [];
  const n = Math.max(rows.length, 1);

  const C1X = 0.55, C1W = 2.5;
  const C2X = 3.15, C2W = 4.3;
  const C3X = 7.55, C3W = 5.1;
  const HDR_Y = 1.12, HDR_H = 0.46;
  const RISK_COLOR = TOKENS.fuchsia;

  // ヘッダー行
  slide.addShape(pres.ShapeType.rect, { x: C1X, y: HDR_Y, w: C1W, h: HDR_H, fill: { color: RISK_COLOR }, line: { color: RISK_COLOR } });
  slide.addText('リスク', { x: C1X, y: HDR_Y, w: C1W, h: HDR_H, fontFace: FONT_JP, fontSize: 13, bold: true, color: TOKENS.white, align: 'center', valign: 'middle' });

  slide.addShape(pres.ShapeType.rect, { x: C2X, y: HDR_Y, w: C2W, h: HDR_H, fill: { color: TOKENS.textMuted }, line: { color: TOKENS.textMuted } });
  slide.addText('なぜ起きるか', { x: C2X, y: HDR_Y, w: C2W, h: HDR_H, fontFace: FONT_JP, fontSize: 13, bold: true, color: TOKENS.white, align: 'center', valign: 'middle' });

  slide.addShape(pres.ShapeType.rect, { x: C3X, y: HDR_Y, w: C3W, h: HDR_H, fill: { color: TOKENS.forest }, line: { color: TOKENS.forest } });
  slide.addText('対策', { x: C3X, y: HDR_Y, w: C3W, h: HDR_H, fontFace: FONT_JP, fontSize: 13, bold: true, color: TOKENS.lime, align: 'center', valign: 'middle' });

  // データ行
  const AVAIL_H = 5.95 - HDR_H;
  const ROW_H = Math.min(1.35, (AVAIL_H - 0.06 * n) / n);
  const ROW_START_Y = HDR_Y + HDR_H + 0.06;

  rows.forEach(function(row, i) {
    const y = ROW_START_Y + i * (ROW_H + 0.06);
    const isEven = i % 2 === 0;
    const rowBg = isEven ? TOKENS.bgSection : TOKENS.white;

    slide.addShape(pres.ShapeType.rect, { x: C1X, y: y, w: C1W, h: ROW_H, fill: { color: isEven ? 'EEE8F5' : 'F8F4FC' }, line: { color: TOKENS.divider, width: 1 } });
    if (row.id) {
      slide.addText(row.id, { x: C1X + 0.12, y: y + 0.06, w: 0.65, h: 0.32, fontFace: FONT_EN, fontSize: 13, bold: true, color: RISK_COLOR });
    }
    slide.addText(row.label || '', {
      x: C1X + 0.12, y: y + (row.id ? 0.38 : 0.1), w: C1W - 0.24, h: ROW_H - (row.id ? 0.48 : 0.2),
      fontFace: FONT_JP, fontSize: 12, bold: true, color: TOKENS.black, wrap: true, valign: 'top',
    });

    slide.addShape(pres.ShapeType.rect, { x: C2X, y: y, w: C2W, h: ROW_H, fill: { color: rowBg }, line: { color: TOKENS.divider, width: 1 } });
    slide.addText(row.why || '', { x: C2X + 0.15, y: y + 0.1, w: C2W - 0.3, h: ROW_H - 0.2, fontFace: FONT_JP, fontSize: 12, color: TOKENS.black, wrap: true, valign: 'middle' });

    slide.addShape(pres.ShapeType.rect, { x: C3X, y: y, w: C3W, h: ROW_H, fill: { color: isEven ? 'E8F0EC' : TOKENS.white }, line: { color: TOKENS.divider, width: 1 } });
    slide.addText(row.countermeasure || '', { x: C3X + 0.15, y: y + 0.1, w: C3W - 0.3, h: ROW_H - 0.2, fontFace: FONT_JP, fontSize: 12, color: TOKENS.black, wrap: true, valign: 'middle' });
  });
  return slide;
}

/**
 * トラック比較表（track_comparison）
 * N列（2〜4）の並列比較。各列にヘッダーと行アイテム。
 * @param {object} opts
 *   - title / eyebrow
 *   - tracks: [{ label, color?, rows: [{ key?, value }] }]
 */
function addTrackComparison(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const tracks = opts.tracks || [];
  const n = Math.max(tracks.length, 1);
  const TOTAL_W = 12.2, START_X = 0.55, GAP = 0.12;
  const colW = (TOTAL_W - GAP * (n - 1)) / n;
  const HDR_Y = 1.12, HDR_H = 0.52;

  const COLOR_MAP = {
    lime:   { bg: TOKENS.lime,   txt: TOKENS.black  },
    forest: { bg: TOKENS.forest, txt: TOKENS.white  },
    orange: { bg: TOKENS.orange, txt: TOKENS.white  },
    black:  { bg: TOKENS.black,  txt: TOKENS.white  },
    red:    { bg: TOKENS.red,    txt: TOKENS.white  },
    blue:   { bg: TOKENS.blue,   txt: TOKENS.white  },
  };
  const DEFAULT_ORDER = ['lime', 'forest', 'orange', 'black', 'red'];

  const maxRows = tracks.reduce(function(m, t) { return Math.max(m, (t.rows || []).length); }, 0);
  const AVAIL_H = 5.85 - HDR_H;
  const rowH = Math.min(1.05, (AVAIL_H - 0.06 * maxRows) / Math.max(maxRows, 1));
  const ROW_START_Y = HDR_Y + HDR_H + 0.08;

  tracks.forEach(function(track, ti) {
    const x = START_X + ti * (colW + GAP);
    const ck = track.color || DEFAULT_ORDER[ti % DEFAULT_ORDER.length];
    const c = COLOR_MAP[ck] || { bg: TOKENS.forest, txt: TOKENS.white };

    slide.addShape(pres.ShapeType.rect, { x: x, y: HDR_Y, w: colW, h: HDR_H, fill: { color: c.bg }, line: { color: c.bg } });
    slide.addText(track.label || '', { x: x + 0.1, y: HDR_Y, w: colW - 0.2, h: HDR_H, fontFace: FONT_JP, fontSize: 14, bold: true, color: c.txt, align: 'center', valign: 'middle' });

    (track.rows || []).forEach(function(row, ri) {
      const ry = ROW_START_Y + ri * (rowH + 0.06);
      const isEven = ri % 2 === 0;
      slide.addShape(pres.ShapeType.rect, { x: x, y: ry, w: colW, h: rowH, fill: { color: isEven ? TOKENS.bgSection : TOKENS.white }, line: { color: TOKENS.divider, width: 1 } });
      if (row.key) {
        slide.addText(row.key, { x: x + 0.12, y: ry + 0.05, w: colW - 0.24, h: 0.28, fontFace: FONT_JP, fontSize: 10, color: TOKENS.textMuted });
        slide.addText(row.value || '', { x: x + 0.12, y: ry + 0.32, w: colW - 0.24, h: rowH - 0.42, fontFace: FONT_JP, fontSize: 12, bold: true, color: TOKENS.black, wrap: true, valign: 'top' });
      } else {
        slide.addText(row.value || '', { x: x + 0.12, y: ry + 0.1, w: colW - 0.24, h: rowH - 0.2, fontFace: FONT_JP, fontSize: 12, color: TOKENS.black, wrap: true, valign: 'middle' });
      }
    });
  });
  return slide;
}

/**
 * フェーズ移行（phase_progression）
 * Phase1ボックス → 矢印（トリガー）→ Phase2ボックス の横並び
 * @param {object} opts
 *   - title / eyebrow
 *   - phase1: { label, items }
 *   - trigger: string
 *   - phase2: { label, items }
 */
function addPhaseProgression(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const ph1 = opts.phase1 || {};
  const ph2 = opts.phase2 || {};
  const trigger = opts.trigger || '';

  const CARD_Y = 1.5, CARD_H = 5.2, CARD_W = 5.0;
  const PH1_X = 0.55, ARROW_X = 5.7, ARROW_W = 2.0, PH2_X = 7.85;

  // Phase 1
  slide.addShape(pres.ShapeType.rect, { x: PH1_X, y: CARD_Y, w: CARD_W, h: CARD_H, fill: { color: TOKENS.bgSection }, line: { color: TOKENS.divider, width: 1 } });
  slide.addShape(pres.ShapeType.rect, { x: PH1_X, y: CARD_Y, w: CARD_W, h: 0.52, fill: { color: TOKENS.forest }, line: { color: TOKENS.forest } });
  slide.addText('PHASE 1', { x: PH1_X, y: CARD_Y, w: CARD_W, h: 0.52, fontFace: FONT_EN, fontSize: 12, bold: true, color: TOKENS.lime, align: 'center', valign: 'middle', charSpacing: 2 });
  slide.addText(ph1.label || '', { x: PH1_X + 0.2, y: CARD_Y + 0.62, w: CARD_W - 0.4, h: 0.65, fontFace: FONT_JP, fontSize: 18, bold: true, color: TOKENS.black, align: 'center', valign: 'middle' });
  (ph1.items || []).forEach(function(item, i) {
    slide.addText('・' + item, { x: PH1_X + 0.25, y: CARD_Y + 1.4 + i * 0.55, w: CARD_W - 0.5, h: 0.5, fontFace: FONT_JP, fontSize: 13, color: TOKENS.black, wrap: true });
  });

  // 矢印
  slide.addShape(pres.ShapeType.rightArrow, { x: ARROW_X, y: CARD_Y + CARD_H * 0.3, w: ARROW_W, h: CARD_H * 0.4, fill: { color: TOKENS.lime }, line: { color: TOKENS.lime } });
  if (trigger) {
    slide.addText(trigger, { x: ARROW_X, y: CARD_Y + CARD_H * 0.73, w: ARROW_W, h: 0.45, fontFace: FONT_JP, fontSize: 10, color: TOKENS.textMuted, align: 'center' });
  }

  // Phase 2
  slide.addShape(pres.ShapeType.rect, { x: PH2_X, y: CARD_Y, w: CARD_W, h: CARD_H, fill: { color: TOKENS.white }, line: { color: TOKENS.lime, width: 2 } });
  slide.addShape(pres.ShapeType.rect, { x: PH2_X, y: CARD_Y, w: CARD_W, h: 0.52, fill: { color: TOKENS.black }, line: { color: TOKENS.black } });
  slide.addText('PHASE 2', { x: PH2_X, y: CARD_Y, w: CARD_W, h: 0.52, fontFace: FONT_EN, fontSize: 12, bold: true, color: TOKENS.lime, align: 'center', valign: 'middle', charSpacing: 2 });
  slide.addText(ph2.label || '', { x: PH2_X + 0.2, y: CARD_Y + 0.62, w: CARD_W - 0.4, h: 0.65, fontFace: FONT_JP, fontSize: 18, bold: true, color: TOKENS.black, align: 'center', valign: 'middle' });
  (ph2.items || []).forEach(function(item, i) {
    slide.addText('・' + item, { x: PH2_X + 0.25, y: CARD_Y + 1.4 + i * 0.55, w: CARD_W - 0.5, h: 0.5, fontFace: FONT_JP, fontSize: 13, color: TOKENS.black, wrap: true });
  });
  return slide;
}

/**
 * 移行テーブル（mobility_table）
 * 各行: from（左）→ 矢印 → to（右）+ description（右端）
 * @param {object} opts
 *   - title / eyebrow
 *   - rows: [{ from, to, description }]
 */
function addMobilityTable(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const rows = opts.rows || [];
  const n = Math.max(rows.length, 1);
  const START_Y = 1.15;
  const AVAIL_H = 5.9;
  const ROW_H = Math.min(1.1, (AVAIL_H - 0.08 * n) / n);
  const GAP = 0.1;

  const FROM_X = 0.55, FROM_W = 3.0;
  const ARR_X  = 3.65,  ARR_W  = 0.85;
  const TO_X   = 4.6,   TO_W   = 3.0;
  const DESC_X = 7.75,  DESC_W = 4.9;

  rows.forEach(function(row, i) {
    const y = START_Y + i * (ROW_H + GAP);

    slide.addShape(pres.ShapeType.roundRect, { x: FROM_X, y: y + 0.08, w: FROM_W, h: ROW_H - 0.16, fill: { color: TOKENS.bgSection }, line: { color: TOKENS.divider, width: 1 }, rectRadius: 0.06 });
    slide.addText(row.from || '', { x: FROM_X + 0.12, y: y + 0.08, w: FROM_W - 0.24, h: ROW_H - 0.16, fontFace: FONT_JP, fontSize: 13, bold: true, color: TOKENS.black, align: 'center', valign: 'middle', wrap: true });

    slide.addShape(pres.ShapeType.rightArrow, { x: ARR_X, y: y + ROW_H * 0.25, w: ARR_W, h: ROW_H * 0.5, fill: { color: TOKENS.lime }, line: { color: TOKENS.lime } });

    slide.addShape(pres.ShapeType.roundRect, { x: TO_X, y: y + 0.08, w: TO_W, h: ROW_H - 0.16, fill: { color: TOKENS.black }, line: { color: TOKENS.black }, rectRadius: 0.06 });
    slide.addText(row.to || '', { x: TO_X + 0.12, y: y + 0.08, w: TO_W - 0.24, h: ROW_H - 0.16, fontFace: FONT_JP, fontSize: 13, bold: true, color: TOKENS.white, align: 'center', valign: 'middle', wrap: true });

    if (row.description) {
      slide.addText(row.description, { x: DESC_X, y: y + 0.1, w: DESC_W, h: ROW_H - 0.2, fontFace: FONT_JP, fontSize: 12, color: TOKENS.black, wrap: true, valign: 'middle' });
    }

    if (i < rows.length - 1) {
      slide.addShape(pres.ShapeType.line, { x: 0.55, y: y + ROW_H + GAP * 0.5, w: 12.2, h: 0, line: { color: TOKENS.divider, width: 1 } });
    }
  });
  return slide;
}

/**
 * NG/OK比較（ng_ok_comparison）
 * 左：NG（薄地＋赤枠）、右：OK（濃地）、底部：Limeハイライトまとめ
 * @param {object} opts
 *   - title / eyebrow
 *   - ng_items: string[]
 *   - ok_items: string[]
 *   - statement: string（底部まとめ）
 */
function addNgOkComparison(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const ngItems = opts.ng_items || [];
  const okItems = opts.ok_items || [];
  const stmt = opts.statement || '';

  const CARD_Y = 1.4;
  const CARD_H = stmt ? 4.45 : 5.5;
  const NG_X = 0.55, NG_W = 5.85;
  const OK_X = 6.95, OK_W = 5.85;

  // NG
  slide.addShape(pres.ShapeType.rect, { x: NG_X, y: CARD_Y, w: NG_W, h: CARD_H, fill: { color: 'FFF5F8' }, line: { color: TOKENS.red, width: 2 } });
  slide.addShape(pres.ShapeType.rect, { x: NG_X, y: CARD_Y, w: NG_W, h: 0.5, fill: { color: TOKENS.red }, line: { color: TOKENS.red } });
  slide.addText('NG', { x: NG_X, y: CARD_Y, w: NG_W, h: 0.5, fontFace: FONT_EN, fontSize: 16, bold: true, color: TOKENS.white, align: 'center', valign: 'middle', charSpacing: 3 });
  ngItems.forEach(function(item, i) {
    slide.addText('✕ ' + item, { x: NG_X + 0.3, y: CARD_Y + 0.7 + i * 0.55, w: NG_W - 0.5, h: 0.5, fontFace: FONT_JP, fontSize: 13, color: TOKENS.black, wrap: true });
  });

  // OK
  slide.addShape(pres.ShapeType.rect, { x: OK_X, y: CARD_Y, w: OK_W, h: CARD_H, fill: { color: TOKENS.forest }, line: { color: TOKENS.forest } });
  slide.addShape(pres.ShapeType.rect, { x: OK_X, y: CARD_Y, w: OK_W, h: 0.5, fill: { color: TOKENS.lime }, line: { color: TOKENS.lime } });
  slide.addText('OK', { x: OK_X, y: CARD_Y, w: OK_W, h: 0.5, fontFace: FONT_EN, fontSize: 16, bold: true, color: TOKENS.black, align: 'center', valign: 'middle', charSpacing: 3 });
  okItems.forEach(function(item, i) {
    slide.addText('✓ ' + item, { x: OK_X + 0.3, y: CARD_Y + 0.7 + i * 0.55, w: OK_W - 0.5, h: 0.5, fontFace: FONT_JP, fontSize: 13, color: TOKENS.white, wrap: true });
  });

  // 底部まとめ
  if (stmt) {
    const STMT_Y = CARD_Y + CARD_H + 0.2;
    slide.addShape(pres.ShapeType.rect, { x: 0.55, y: STMT_Y, w: 12.2, h: 0.8, fill: { color: TOKENS.lime }, line: { color: TOKENS.lime } });
    slide.addText(stmt, { x: 0.75, y: STMT_Y, w: 11.8, h: 0.8, fontFace: FONT_JP, fontSize: 15, bold: true, color: TOKENS.black, valign: 'middle', wrap: true });
  }
  return slide;
}

/**
 * 機能・役割テーブル（function_table）
 * 行=役割/機能名（濃色背景）、列=レベル/カテゴリ（交互背景）
 * @param {object} opts
 *   - title / eyebrow
 *   - columns: string[]（役割列の右に並ぶ列ヘッダー）
 *   - rows: [{ role, cells: string[] }]
 */
function addFunctionTable(pres, opts) {
  const slide = pres.addSlide({ masterName: 'PTMIND_MASTER' });
  _addSlideTitle(slide, opts.eyebrow ? { eyebrow: opts.eyebrow, title: opts.title || '' } : (opts.title || ''));

  const colHeaders = opts.columns || [];
  const rows = opts.rows || [];
  const nRows = Math.max(rows.length, 1);

  const START_X = 0.55, TOTAL_W = 12.2, START_Y = 1.1;
  const ROLE_W = 2.4;
  const OTHER_W = colHeaders.length > 0 ? (TOTAL_W - ROLE_W) / colHeaders.length : TOTAL_W - ROLE_W;
  const HDR_H = 0.5;
  const ROW_H = Math.min(0.95, (5.95 - HDR_H - 0.05 * nRows) / nRows);
  const ROW_GAP = 0.05;
  const HDR_COLORS = [TOKENS.forest, TOKENS.olive, TOKENS.lime, TOKENS.black, TOKENS.orange];

  // 左上空セル
  slide.addShape(pres.ShapeType.rect, { x: START_X, y: START_Y, w: ROLE_W, h: HDR_H, fill: { color: TOKENS.black }, line: { color: TOKENS.black } });

  // 列ヘッダー
  colHeaders.forEach(function(col, ci) {
    const x = START_X + ROLE_W + ci * OTHER_W;
    const hdrBg = HDR_COLORS[ci % HDR_COLORS.length];
    const hdrTxt = hdrBg === TOKENS.lime ? TOKENS.black : TOKENS.white;
    slide.addShape(pres.ShapeType.rect, { x: x, y: START_Y, w: OTHER_W, h: HDR_H, fill: { color: hdrBg }, line: { color: hdrBg } });
    slide.addText(col, { x: x + 0.08, y: START_Y, w: OTHER_W - 0.16, h: HDR_H, fontFace: FONT_JP, fontSize: 12, bold: true, color: hdrTxt, align: 'center', valign: 'middle' });
  });

  // データ行
  rows.forEach(function(row, ri) {
    const y = START_Y + HDR_H + ri * (ROW_H + ROW_GAP);
    const isEven = ri % 2 === 0;
    const roleBg = isEven ? TOKENS.forest : '2A5E40';

    slide.addShape(pres.ShapeType.rect, { x: START_X, y: y, w: ROLE_W, h: ROW_H, fill: { color: roleBg }, line: { color: TOKENS.divider, width: 1 } });
    slide.addText(row.role || '', { x: START_X + 0.1, y: y, w: ROLE_W - 0.2, h: ROW_H, fontFace: FONT_JP, fontSize: 12, bold: true, color: TOKENS.white, valign: 'middle', wrap: true });

    (row.cells || []).forEach(function(cell, ci) {
      const x = START_X + ROLE_W + ci * OTHER_W;
      slide.addShape(pres.ShapeType.rect, { x: x, y: y, w: OTHER_W, h: ROW_H, fill: { color: isEven ? TOKENS.bgSection : TOKENS.white }, line: { color: TOKENS.divider, width: 1 } });
      slide.addText(cell || '', { x: x + 0.1, y: y + 0.05, w: OTHER_W - 0.2, h: ROW_H - 0.1, fontFace: FONT_JP, fontSize: 11, color: TOKENS.black, wrap: true, valign: 'middle' });
    });
  });
  return slide;
}

module.exports = {
  TOKENS,
  FONT_JP,
  FONT_EN,
  addSlideTitle: _addSlideTitle,   // 外部から再利用できるよう公開
  setupPresentation,
  addCover,
  addAgenda,
  addSectionDivider,
  addThreeColumnFlow,
  addKpiGrid,
  addTwoColumn,
  addBeforeAfter,
  addTimeline,
  addNextStep,
  addExecSummary,
  addClosing,
  // === 新フォーマット対応ヘルパー ===
  addStatementSlide,
  addComparisonWithCase,
  addCategoryTag,
  richText,
  // === 追加レイアウト ===
  addFourGrid,
  addFormulaFlow,
  addDecompositionGrid,
  // === 表/比較系レイアウト ===
  addRiskCountermeasure,
  addTrackComparison,
  addPhaseProgression,
  addMobilityTable,
  addNgOkComparison,
  addFunctionTable,
  // === チャート系（references/charts.md 準拠）===
  addLineChartSlide,
  addBarChartSlide,
  addAreaChartSlide,
  addDonutSlide,
  addKpiWithChart,
};
