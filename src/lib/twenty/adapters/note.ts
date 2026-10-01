// ─── Twenty Note → RAW 互換 ─────────────────────────────────────────────────
//
// noteTargets は実測 114 件中 22 件しか無いため、タイトル照合を暫定フォールバックにする。
// どちらでも付かないものは捨てずに unresolved として件数に残す。

import { NOTE_MATCH, type LinkMethod } from '../sync-policy';
import type { RawNote } from './types';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** bodyV2.markdown → 本文（上限あり） */
export function noteBody(v: unknown): string {
  if (typeof v !== 'object' || v === null) return '';
  const md = (v as { markdown?: unknown }).markdown;
  return str(md).slice(0, NOTE_MATCH.bodyMaxChars);
}

/** タイトル先頭の YYYY-MM-DD。無ければ createdAt の日付 */
export function noteDate(n: Record<string, unknown>): string {
  const m = str(n.title).match(NOTE_MATCH.titleDatePattern);
  if (m) return m[1];
  return str(n.createdAt).slice(0, 10);
}

export function toRawNote(n: Record<string, unknown>): RawNote {
  return { t: str(n.title), d: noteDate(n), md: noteBody(n.bodyV2) };
}

export interface NoteLink {
  companyId: string | null;
  method: LinkMethod;
}

/**
 * Note を会社へ紐付ける。
 *   1. noteTargets に company が入っていればそれ（relation）
 *   2. 無ければタイトルに正規化社名を含むか（title）
 *   3. どちらも駄目なら unresolved
 *
 * @param normalize          社名の正規化関数
 * @param companyIdByNameKey 正規化社名 → Company id
 */
export function linkNote(
  n: Record<string, unknown>,
  companyIdByNameKey: Map<string, string>,
  normalize: (s: string) => string,
): NoteLink {
  const targets = n.noteTargets;
  if (Array.isArray(targets)) {
    for (const t of targets) {
      if (typeof t !== 'object' || t === null) continue;
      const rec = t as { companyId?: unknown; company?: unknown };
      if (typeof rec.companyId === 'string' && rec.companyId) {
        return { companyId: rec.companyId, method: 'relation' };
      }
      if (typeof rec.company === 'object' && rec.company !== null) {
        const id = (rec.company as { id?: unknown }).id;
        if (typeof id === 'string' && id) return { companyId: id, method: 'relation' };
      }
    }
  }

  const titleKey = normalize(str(n.title));
  if (titleKey.length >= NOTE_MATCH.minTitleKeyLength) {
    // 長い社名から先に見て、短い社名への誤爆を避ける
    const keys = [...companyIdByNameKey.keys()].sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (k.length >= NOTE_MATCH.minTitleKeyLength && titleKey.includes(k)) {
        return { companyId: companyIdByNameKey.get(k) as string, method: 'title' };
      }
    }
  }
  return { companyId: null, method: 'unresolved' };
}
