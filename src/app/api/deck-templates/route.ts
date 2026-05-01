// ─── /api/deck-templates ──────────────────────────────────────────────────────
// GET  — 利用可能なデッキテンプレート一覧（内蔵 + Blobアップロード済み）
// POST — 新しいデッキテンプレートをアップロード
//
// 受け付けるファイル形式:
//   1. DeckTemplate JSON     {id, name, brand_tokens, ...}
//   2. Claude スキルJSON      {name, description, files:{...}}
//   3. スキルフォルダの ZIP    SKILL.md + assets/brand-tokens.json + scripts/*.js + references/*.md

import { NextRequest, NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import JSZip from 'jszip';
import { BUILTIN_TEMPLATES } from '@/lib/deck-templates';
import type { DeckTemplate } from '@/lib/deck-templates';
import type { BrandColors } from '@/lib/deck-templates/types';

const BLOB_PREFIX = 'deck-templates/';

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function stripHash(hex: string): string {
  return hex.replace(/^#/, '').toUpperCase();
}

function generateId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

// ─── brand-tokens.json からブランドトークンを抽出 ─────────────────────────────

function extractBrandTokens(rawTokens: Record<string, unknown>): {
  colors: BrandColors;
  fonts: { primary: string; secondary?: string };
} {
  const rawColors = (rawTokens.colors ?? {}) as Record<string, unknown>;
  const semantic      = (rawColors.semantic ?? {}) as Record<string, string>;
  const primaryPalette = (rawColors.primary ?? {}) as Record<string, string>;

  const darkColor   = semantic.text_primary ?? primaryPalette.black  ?? '101C1F';
  const accentColor = semantic.accent       ?? primaryPalette.lime   ?? 'C8F050';
  const bgColor     = semantic.bg_default   ?? primaryPalette.white  ?? 'FFFFFF';
  const bgSection   = semantic.bg_section;
  const textMuted   = semantic.text_muted   ?? '5A6568';

  const colors: BrandColors = {
    primary:      stripHash(darkColor),
    accent:       stripHash(accentColor),
    bg:           stripHash(bgColor),
    bg_section:   bgSection ? stripHash(bgSection) : undefined,
    text_on_dark: stripHash(semantic.text_on_dark ?? 'FFFFFF'),
    text_body:    stripHash(darkColor),
    text_muted:   stripHash(textMuted),
  };

  const typography = rawTokens.typography as Record<string, string> | undefined;
  const fonts = {
    primary:   typography?.primary_typeface ?? 'Noto Sans JP',
    secondary: typography?.secondary_typeface,
  };

  return { colors, fonts };
}

// ─── スキルファイル群 → prompt_guidance に統合 ───────────────────────────────

/**
 * SKILL.md と references/*.md を優先度順に結合して prompt_guidance を組み立てる。
 * 全ファイルを縮小なしで完全に含める。
 */

// 優先度順（先に来るほど重要）
const REF_PRIORITY = ['layouts', 'cs-report', 'proposal-deck', 'brand', 'charts', 'imagery'];

function buildPromptGuidance(files: Record<string, string>): string {
  const parts: string[] = [];

  // SKILL.md を先頭に（全文）
  if (files['SKILL.md']) {
    parts.push(files['SKILL.md']);
  }

  // references/*.md を優先度順で全文追加
  const refEntries = Object.entries(files)
    .filter(([k]) => k.startsWith('references/') && k.endsWith('.md'))
    .sort(([a], [b]) => {
      const ai = REF_PRIORITY.findIndex(p => a.includes(p));
      const bi = REF_PRIORITY.findIndex(p => b.includes(p));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  for (const [path, content] of refEntries) {
    const label = path.replace('references/', '').replace('.md', '');
    parts.push(`---\n\n## Reference: ${label}\n\n${content}`);
  }

  return parts.join('\n\n');
}

// ─── ptmind ヘルパーJS の存在を検出 ──────────────────────────────────────────

function detectLayoutEngine(files: Record<string, string>): 'ptmind-deck' | undefined {
  // scripts/ptmind_deck_helpers.js が含まれていれば ptmind エンジンを使用
  const hasPtmindHelpers = Object.keys(files).some(
    k => k.includes('ptmind_deck_helpers'),
  );
  return hasPtmindHelpers ? 'ptmind-deck' : undefined;
}

// ─── Claude スキルエクスポート JSON → DeckTemplate ───────────────────────────

function convertClaudeSkillJson(parsed: Record<string, unknown>): DeckTemplate | null {
  const rawFiles = parsed.files as Record<string, unknown> | undefined;
  if (!rawFiles) return null;

  // brand-tokens.json を探す
  const rawTokensFile = rawFiles['assets/brand-tokens.json'];
  if (!rawTokensFile || typeof rawTokensFile !== 'object') return null;

  const { colors, fonts } = extractBrandTokens(rawTokensFile as Record<string, unknown>);

  // 文字列ファイルだけを集める（JS も含む）
  const strFiles: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawFiles)) {
    if (typeof v === 'string') strFiles[k] = v;
  }

  const promptGuidance = buildPromptGuidance(strFiles) || undefined;
  const layoutEngine   = detectLayoutEngine(strFiles);

  return {
    id:              generateId(String(parsed.name ?? 'custom')),
    name:            String(parsed.name ?? 'Custom Template'),
    description:     String(parsed.description ?? ''),
    brand_tokens:    { colors, fonts },
    prompt_guidance: promptGuidance,
    layout_engine:   layoutEngine,
  };
}

// ─── スキルフォルダ ZIP → DeckTemplate ───────────────────────────────────────

async function convertSkillZip(buffer: ArrayBuffer): Promise<DeckTemplate | null> {
  const zip = await JSZip.loadAsync(buffer);

  // brand-tokens.json を必須チェック
  const tokenEntry = Object.values(zip.files).find(
    f => !f.dir && f.name.endsWith('brand-tokens.json'),
  );
  if (!tokenEntry) return null;

  const tokenJson = await tokenEntry.async('string');
  const rawTokens = JSON.parse(tokenJson) as Record<string, unknown>;
  const { colors, fonts } = extractBrandTokens(rawTokens);

  // テキストファイル（md/js）を全て読み込む
  const strFiles: Record<string, string> = {};
  const skillName = { value: 'custom' };

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    // パスのプレフィックス（zipのフォルダ名）を除去して正規化
    const normalized = path.replace(/^[^/]+\//, '');

    if (normalized === 'SKILL.md') {
      const content = await entry.async('string');
      strFiles['SKILL.md'] = content;
      // SKILL.md のフロントマターから name を取得
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      if (nameMatch) skillName.value = nameMatch[1].trim();
    } else if (normalized.startsWith('references/') && normalized.endsWith('.md')) {
      strFiles[normalized] = await entry.async('string');
    } else if (normalized.includes('ptmind_deck_helpers')) {
      // JS はファイル名だけ登録（検出用）
      strFiles[normalized] = '__detected__';
    }
  }

  const promptGuidance = buildPromptGuidance(strFiles) || undefined;
  const layoutEngine   = detectLayoutEngine(strFiles);

  return {
    id:              generateId(skillName.value),
    name:            skillName.value,
    description:     '',
    brand_tokens:    { colors, fonts },
    prompt_guidance: promptGuidance,
    layout_engine:   layoutEngine,
  };
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
  }

  // 内蔵テンプレートは削除不可
  if (BUILTIN_TEMPLATES.some(t => t.id === id)) {
    return NextResponse.json({ error: '内蔵テンプレートは削除できません' }, { status: 403 });
  }

  try {
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}.json` });
    const blob = blobs[0];
    if (!blob) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
    }
    const { del } = await import('@vercel/blob');
    await del(blob.url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `削除に失敗しました: ${message}` }, { status: 500 });
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const uploaded: DeckTemplate[] = [];

  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    const jsonBlobs = blobs.filter(b => b.pathname.endsWith('.json'));

    await Promise.all(
      jsonBlobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url);
          if (!res.ok) return;
          const template = await res.json() as DeckTemplate;
          if (BUILTIN_TEMPLATES.some(t => t.id === template.id)) return;
          uploaded.push({ ...template, is_builtin: false, blob_url: blob.url });
        } catch { /* 読み取り失敗は無視 */ }
      }),
    );
  } catch { /* Blob 未接続の場合は内蔵のみ */ }

  return NextResponse.json({ templates: [...BUILTIN_TEMPLATES, ...uploaded] });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData のパースに失敗しました' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'file が必要です' }, { status: 400 });
  }

  const isJson = file.name.endsWith('.json');
  const isZip  = file.name.endsWith('.zip');

  if (!isJson && !isZip) {
    return NextResponse.json(
      { error: '.json または .zip ファイルをアップロードしてください' },
      { status: 400 },
    );
  }

  let template: DeckTemplate;

  try {
    if (isZip) {
      // ── ZIP: スキルフォルダを解析 ───────────────────────────────────────
      const buffer = await file.arrayBuffer();
      const converted = await convertSkillZip(buffer);
      if (!converted) {
        return NextResponse.json(
          { error: 'ZIP 内に assets/brand-tokens.json が見つかりませんでした' },
          { status: 400 },
        );
      }
      template = converted;
    } else {
      // ── JSON ────────────────────────────────────────────────────────────
      const text   = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;

      if (parsed.files && !parsed.brand_tokens) {
        // Claude スキルエクスポート形式
        const converted = convertClaudeSkillJson(parsed);
        if (!converted) {
          return NextResponse.json(
            { error: 'Claude スキル形式ですが、assets/brand-tokens.json が見つかりませんでした' },
            { status: 400 },
          );
        }
        template = converted;
      } else {
        // DeckTemplate 形式そのまま
        template = parsed as unknown as DeckTemplate;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `ファイルの解析に失敗しました: ${message}` }, { status: 400 });
  }

  if (!template.id || !template.name || !template.brand_tokens) {
    return NextResponse.json(
      { error: 'id, name, brand_tokens が必要です' },
      { status: 400 },
    );
  }

  if (BUILTIN_TEMPLATES.some(t => t.id === template.id)) {
    return NextResponse.json(
      { error: `"${template.id}" は内蔵テンプレートと競合します` },
      { status: 409 },
    );
  }

  const templateJson = JSON.stringify(template, null, 2);
  const filename = `${BLOB_PREFIX}${template.id}.json`;

  try {
    const blob = await put(filename, templateJson, {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });
    return NextResponse.json({
      template: { ...template, is_builtin: false, blob_url: blob.url },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Blob への保存に失敗しました: ${message}` },
      { status: 500 },
    );
  }
}
