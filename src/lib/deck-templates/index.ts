// ─── デッキテンプレートレジストリ ───────────────────────────────────────────

export type { DeckTemplate, BrandTokens, BrandColors, BrandFonts } from './types';
export { PTMIND_DECK_TEMPLATE } from './ptmind';
import { PTMIND_DECK_TEMPLATE } from './ptmind';
import type { DeckTemplate } from './types';

/** 内蔵テンプレート一覧 */
export const BUILTIN_TEMPLATES: DeckTemplate[] = [
  PTMIND_DECK_TEMPLATE,
];

/** IDで内蔵テンプレートを検索 */
export function getBuiltinTemplate(id: string): DeckTemplate | null {
  return BUILTIN_TEMPLATES.find(t => t.id === id) ?? null;
}
