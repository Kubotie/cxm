// ─── PPTX生成ライブラリ（サーバーサイド専用）────────────────────────────────
// ptmind-deck テンプレート: ptmind_deck_helpers.js を全面的に使用。
// その他テンプレート: ブランドトークンに基づく汎用レイアウト。

import PptxGenJS from 'pptxgenjs';
import type { SlideStructure, SlideContent } from '@/lib/prompts/document-generate';
import type { BrandTokens } from '@/lib/deck-templates/types';
import { PTMIND_DECK_TEMPLATE } from '@/lib/deck-templates/ptmind';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const P = require('./ptmind_deck_helpers.js') as {
  setupPresentation: (pres: PptxGenJS, opts?: { copyrightYear?: number; logoText?: string }) => void;
  addSlideTitle: (slide: unknown, titleOrOpts: string | { title?: string; eyebrow?: string }) => void;
  addCover: (pres: PptxGenJS, opts: {
    mainTitle?: string; subTitle?: string; clientName?: string;
    author?: string; date?: string; variant?: 'light' | 'dark';
  }) => void;
  addAgenda: (pres: PptxGenJS, opts: { title?: string; items: { n?: string; title: string; sub?: string }[] }) => void;
  addSectionDivider: (pres: PptxGenJS, opts: { number?: string; title?: string; subtitle?: string }) => void;
  addThreeColumnFlow: (pres: PptxGenJS, opts: {
    title?: string;
    columns: { header: string; icon?: string; items: string[]; colorOverride?: string }[];
  }) => void;
  addKpiGrid: (pres: PptxGenJS, opts: {
    title?: string;
    kpis: { label: string; value: string; unit?: string; delta?: string; positive?: boolean }[];
  }) => void;
  addTwoColumn: (pres: PptxGenJS, opts: {
    title?: string; leftType?: string; leftContent?: unknown;
    rightBullets?: { header: string; body: string }[];
  }) => void;
  addBeforeAfter: (pres: PptxGenJS, opts: {
    title?: string; beforeTitle?: string; beforeItems?: string[];
    afterTitle?: string; afterItems?: string[]; arrowKeywords?: string[];
  }) => void;
  addTimeline: (pres: PptxGenJS, opts: {
    title?: string;
    phases: { label: string; period?: string; bullets?: string[] }[];
  }) => void;
  addNextStep: (pres: PptxGenJS, opts: {
    title?: string;
    steps: { when: string; title: string; items: string[] }[];
  }) => void;
  addExecSummary: (pres: PptxGenJS, opts: {
    title?: string;
    achievement?: string | string[]; challenge?: string | string[]; nextMove?: string | string[];
  }) => void;
  addClosing: (pres: PptxGenJS, opts?: { title?: string; message?: string; submessage?: string }) => void;
  addFourGrid: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    cards: { number?: string; title: string; body?: string; result?: string; result_color?: string; color?: string }[];
    footer?: string;
  }) => void;
  addFormulaFlow: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    left_title?: string; left_body?: string;
    variables: { n?: string; label: string; color?: string }[];
    denominator?: { n?: string; label: string; color?: string };
    note?: { bold: string; body?: string };
  }) => void;
  addDecompositionGrid: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    cells: { number?: string; label: string; formula?: string; body?: string; color?: string; is_hypothesis?: boolean }[];
  }) => void;
  addRiskCountermeasure: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    rows: { id?: string; label: string; why: string; countermeasure: string }[];
  }) => void;
  addTrackComparison: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    tracks: { label: string; color?: string; rows: { key?: string; value: string }[] }[];
  }) => void;
  addPhaseProgression: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    phase1?: { label: string; items?: string[] };
    trigger?: string;
    phase2?: { label: string; items?: string[] };
  }) => void;
  addMobilityTable: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    rows: { from: string; to: string; description?: string }[];
  }) => void;
  addNgOkComparison: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    ng_items?: string[]; ok_items?: string[]; statement?: string;
  }) => void;
  addFunctionTable: (pres: PptxGenJS, opts: {
    title?: string; eyebrow?: string;
    columns?: string[];
    rows?: { role: string; cells: string[] }[];
  }) => void;
  TOKENS: Record<string, string>;
  FONT_JP: string;
};

// ─── PTmind デッキ用 ───────────────────────────────────────────────────────────

/** スライドをレイアウトに応じて適切なヘルパーで描画 */
function addPtmindSlide(pres: PptxGenJS, slide: SlideContent) {
  switch (slide.layout) {

    case 'section_divider':
      P.addSectionDivider(pres, {
        number:   slide.section_number ?? '—',
        title:    slide.title,
        subtitle: slide.content[0] ?? undefined,
      });
      return;

    case 'three_column':
      if (slide.columns && slide.columns.length > 0) {
        P.addThreeColumnFlow(pres, { title: slide.title, columns: slide.columns });
        return;
      }
      break;

    case 'kpi_grid':
      if (slide.kpis && slide.kpis.length > 0) {
        P.addKpiGrid(pres, { title: slide.title, kpis: slide.kpis });
        return;
      }
      break;

    case 'before_after':
      if (slide.before_title || (slide.before_items && slide.before_items.length > 0)) {
        P.addBeforeAfter(pres, {
          title:        slide.title,
          beforeTitle:  slide.before_title,
          beforeItems:  slide.before_items ?? [],
          afterTitle:   slide.after_title,
          afterItems:   slide.after_items ?? [],
          arrowKeywords: slide.arrow_keywords,
        });
        return;
      }
      break;

    case 'timeline':
      if (slide.phases && slide.phases.length > 0) {
        P.addTimeline(pres, { title: slide.title, phases: slide.phases });
        return;
      }
      break;

    case 'next_steps':
      if (slide.steps && slide.steps.length > 0) {
        P.addNextStep(pres, { title: slide.title, steps: slide.steps });
        return;
      }
      break;

    case 'exec_summary':
      if (slide.achievement || slide.challenge || slide.next_move) {
        P.addExecSummary(pres, {
          title:       slide.title,
          achievement: slide.achievement ?? [],
          challenge:   slide.challenge ?? [],
          nextMove:    slide.next_move ?? [],
        });
        return;
      }
      break;

    case 'four_grid':
      if (slide.cards && slide.cards.length > 0) {
        P.addFourGrid(pres, {
          title:   slide.title,
          eyebrow: slide.eyebrow,
          cards:   slide.cards,
          footer:  slide.footer,
        });
        return;
      }
      break;

    case 'formula_flow':
      if (slide.variables && slide.variables.length > 0) {
        P.addFormulaFlow(pres, {
          title:       slide.title,
          eyebrow:     slide.eyebrow,
          left_title:  slide.left_title,
          left_body:   slide.left_body,
          variables:   slide.variables,
          denominator: slide.denominator,
          note:        slide.note,
        });
        return;
      }
      break;

    case 'decomposition_grid':
      if (slide.cells && slide.cells.length > 0) {
        P.addDecompositionGrid(pres, {
          title:   slide.title,
          eyebrow: slide.eyebrow,
          cells:   slide.cells,
        });
        return;
      }
      break;

    case 'risk_countermeasure':
      if (slide.risk_rows && slide.risk_rows.length > 0) {
        P.addRiskCountermeasure(pres, {
          title:   slide.title,
          eyebrow: slide.eyebrow,
          rows:    slide.risk_rows,
        });
        return;
      }
      break;

    case 'track_comparison':
      if (slide.tracks && slide.tracks.length > 0) {
        P.addTrackComparison(pres, {
          title:   slide.title,
          eyebrow: slide.eyebrow,
          tracks:  slide.tracks,
        });
        return;
      }
      break;

    case 'phase_progression':
      if (slide.phase1 || slide.phase2) {
        P.addPhaseProgression(pres, {
          title:   slide.title,
          eyebrow: slide.eyebrow,
          phase1:  slide.phase1,
          trigger: slide.trigger,
          phase2:  slide.phase2,
        });
        return;
      }
      break;

    case 'mobility_table':
      if (slide.mobility_rows && slide.mobility_rows.length > 0) {
        P.addMobilityTable(pres, {
          title:   slide.title,
          eyebrow: slide.eyebrow,
          rows:    slide.mobility_rows,
        });
        return;
      }
      break;

    case 'ng_ok_comparison':
      if ((slide.ng_items && slide.ng_items.length > 0) || (slide.ok_items && slide.ok_items.length > 0)) {
        P.addNgOkComparison(pres, {
          title:     slide.title,
          eyebrow:   slide.eyebrow,
          ng_items:  slide.ng_items,
          ok_items:  slide.ok_items,
          statement: slide.statement,
        });
        return;
      }
      break;

    case 'function_table':
      if (slide.func_rows && slide.func_rows.length > 0) {
        P.addFunctionTable(pres, {
          title:   slide.title,
          eyebrow: slide.eyebrow,
          columns: slide.func_columns,
          rows:    slide.func_rows,
        });
        return;
      }
      break;
  }

  // フォールバック: bullets
  addPtmindBulletsSlide(pres, slide);
}

/**
 * 箇条書きスライド。
 * ヘッダーは helpers の addSlideTitle を直接呼び出し、他レイアウトと完全に一致させる。
 */
function addPtmindBulletsSlide(pres: PptxGenJS, slide: SlideContent) {
  const { TOKENS, FONT_JP } = P;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (pres as any).addSlide({ masterName: 'PTMIND_MASTER' });

  // helpers の _addSlideTitle を使用（他レイアウトと完全に同一実装）
  P.addSlideTitle(s, slide.eyebrow ? { eyebrow: slide.eyebrow, title: slide.title } : slide.title);

  // 本文 y 座標: eyebrow ありは少し下げる
  const bodyY = slide.eyebrow ? 1.1 : 1.05;

  const bullets = slide.content.map(line => ({
    text: line,
    options: { bullet: { type: 'bullet' as const }, breakLine: true },
  }));

  s.addText(bullets, {
    x: 0.55, y: bodyY, w: '86%', h: 6.7 - bodyY,
    fontFace: FONT_JP, fontSize: 18,
    color: TOKENS.black,
    lineSpacingMultiple: 1.5,
    valign: 'top',
    paraSpaceAfter: 5,
  });

  if (slide.speaker_note) s.addNotes(slide.speaker_note);
}

/** PTmind デッキ用 PPTX 生成 */
async function generatePtmindPptx(structure: SlideStructure): Promise<Buffer> {
  const pres = new PptxGenJS();
  P.setupPresentation(pres, { copyrightYear: new Date().getFullYear() });

  // 表紙
  P.addCover(pres, {
    mainTitle: structure.title,
    subTitle:  structure.subtitle ?? undefined,
    author:    '株式会社ピーティーマインド',
    variant:   'light',
  });

  const slides = structure.slides;

  // 最初のスライドがアジェンダ系 → addAgenda を使用
  let startIndex = 0;
  const firstSlide = slides[0];
  if (
    firstSlide &&
    /アジェンダ|目次|本日|agenda/i.test(firstSlide.title) &&
    firstSlide.content.length >= 2
  ) {
    P.addAgenda(pres, {
      title: firstSlide.title,
      items: firstSlide.content.map((c, i) => ({
        n:     String(i + 1).padStart(2, '0'),
        title: c,
      })),
    });
    startIndex = 1;
  }

  // 最後のスライドがクロージング系かチェック
  const lastSlide = slides[slides.length - 1];
  const isLastClosing = lastSlide && /まとめ|クロージング|次のステップ|ネクスト|締め/i.test(lastSlide.title);
  const endIndex = isLastClosing ? slides.length - 1 : slides.length;

  // 本編スライド
  for (let i = startIndex; i < endIndex; i++) {
    addPtmindSlide(pres, slides[i]);
  }

  // クロージング
  if (isLastClosing && lastSlide) {
    P.addClosing(pres, {
      message: lastSlide.content.join('\n') || lastSlide.title,
    });
  } else {
    P.addClosing(pres, { message: 'ありがとうございました' });
  }

  const output = await pres.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}

// ─── 汎用テンプレート用 ────────────────────────────────────────────────────────

function hex(v: string): string { return v.replace(/^#/, '').toUpperCase(); }

async function generateGenericPptx(structure: SlideStructure, brandTokens: BrandTokens): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const c = brandTokens.colors;
  const fonts = brandTokens.fonts;

  const primary    = hex(c.primary);
  const accent     = hex(c.accent);
  const bg         = hex(c.bg);
  const textOnDark = hex(c.text_on_dark ?? 'FFFFFF');
  const textBody   = hex(c.text_body ?? c.primary);
  const textMuted  = hex(c.text_muted ?? '5A6568');
  const fontMain   = fonts?.primary ?? 'Noto Sans JP';

  pptx.layout = 'LAYOUT_WIDE';

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: primary };
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.25, h: '100%',
    fill: { color: accent }, line: { color: accent },
  });
  titleSlide.addText(structure.title, {
    x: 0.8, y: 2.0, w: '75%', h: 1.4,
    fontSize: 34, bold: true, color: textOnDark, fontFace: fontMain, align: 'left', wrap: true,
  });
  if (structure.subtitle) {
    titleSlide.addText(structure.subtitle, {
      x: 0.8, y: 3.6, w: '75%', h: 0.5,
      fontSize: 16, color: textMuted, fontFace: fontMain, align: 'left',
    });
  }

  for (const slide of structure.slides) {
    const s = pptx.addSlide();
    s.background = { color: bg };
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.85,
      fill: { color: primary }, line: { color: primary },
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.18, h: 0.85,
      fill: { color: accent }, line: { color: accent },
    });
    s.addText(slide.title, {
      x: 0.4, y: 0.1, w: '88%', h: 0.65,
      fontSize: 22, bold: true, color: textOnDark, fontFace: fontMain, valign: 'middle',
    });
    s.addText(slide.content.map(l => ({ text: l, options: { bullet: { type: 'bullet' as const }, breakLine: true } })), {
      x: 0.55, y: 1.1, w: '90%', h: 5.8,
      fontSize: 18, color: textBody, fontFace: fontMain,
      lineSpacingMultiple: 1.5, valign: 'top', paraSpaceAfter: 6,
    });
    if (slide.speaker_note) s.addNotes(slide.speaker_note);
  }

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}

// ─── エクスポート ─────────────────────────────────────────────────────────────

export async function generatePptx(
  structure: SlideStructure,
  brandTokens: BrandTokens = PTMIND_DECK_TEMPLATE.brand_tokens,
  templateId?: string,
  layoutEngine?: string,
): Promise<Buffer> {
  const usePtmind =
    templateId === 'ptmind-deck' ||
    layoutEngine === 'ptmind-deck' ||
    (!templateId && brandTokens === PTMIND_DECK_TEMPLATE.brand_tokens);

  if (usePtmind) {
    return generatePtmindPptx(structure);
  }
  return generateGenericPptx(structure, brandTokens);
}
