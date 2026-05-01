// ─── デッキテンプレート型定義 ─────────────────────────────────────────────────

export interface BrandColors {
  /** スライドタイトルバー・濃背景色（hex、#なし） */
  primary: string;
  /** アクセントカラー・ハイライト（hex、#なし） */
  accent: string;
  /** 本文スライドの背景色（hex、#なし） */
  bg: string;
  /** セクション背景 (省略時は bg を使用) */
  bg_section?: string;
  /** ダーク背景上のテキスト色（省略時: FFFFFF） */
  text_on_dark?: string;
  /** 本文テキスト色（省略時: primary） */
  text_body?: string;
  /** ミュートテキスト色（省略時: 5A6568） */
  text_muted?: string;
}

export interface BrandFonts {
  /** 日本語見出し・本文フォント */
  primary: string;
  /** 英数字・サブフォント (省略可) */
  secondary?: string;
}

export interface BrandTokens {
  colors: BrandColors;
  fonts?: BrandFonts;
}

/**
 * デッキテンプレート定義。
 * - 内蔵テンプレートはコードに直接定義。
 * - アップロードテンプレートは Vercel Blob に JSON で保存し、このインターフェースに準拠する。
 */
export interface DeckTemplate {
  /** 一意ID (内蔵テンプレートはケバブケース固定) */
  id: string;
  /** UI 表示名 */
  name: string;
  /** 説明文 */
  description: string;
  /** ブランドトークン */
  brand_tokens: BrandTokens;
  /**
   * Claudeへのスライド生成指示。Markdown で記述。
   * 省略時はデフォルトの汎用プロンプトを使用。
   */
  prompt_guidance?: string;
  /**
   * PPTX 生成エンジン。
   * - 'ptmind-deck' → ptmind_deck_helpers.js の rich レイアウトを使用
   * - 省略 / その他 → 汎用エンジン（brand_tokens のカラーでレンダリング）
   */
  layout_engine?: 'ptmind-deck' | string;
  /** true = コードに内蔵, false/undefined = Blobから取得 */
  is_builtin?: boolean;
  /** アップロード時の Blob URL */
  blob_url?: string;
}
