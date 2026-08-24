// ─── 画面コンテキストの型（クライアント / サーバー共用）───────────────────────
//
// 各画面が「自分が今表示しているデータ」と「そのデータの取得元」を
// AI パネルに申告するための共通形。
//
// 設計の要点:
//   snapshot = 画面が **すでに fetch 済みのデータそのもの**。
//     AI に再取得させないため、画面が見ているものと AI が見るものを一致させる。
//   sources  = そのデータの取得元 API。
//     AI は snapshot が丸められていたり、別の切り口が必要になったときに
//     ここから元データへ降りていける（深掘り）。

export interface AiDataSourceRef {
  /** UI 表示用のラベル（例: 提案準備ボード） */
  label:       string;
  /** 内部 API パス。data-sources.ts のカタログに載っているものを指す */
  endpoint:    string;
  /** 何が取れるか（AI へのヒント） */
  description?: string;
  /**
   * このソースが **snapshot に含まれているか**。
   *
   * タブ遅延読み込みの画面（個社ページなど）は、開いていないタブのデータを持っていない。
   * false を申告すると、AI 側で「未取得。総合判断の前に取得すべきもの」として扱われる。
   * 省略時は true（取得済み）とみなす。
   */
  loaded?:     boolean;
}

export interface AiPageContext {
  /** 画面の識別子（例: v2-readiness）。履歴のグルーピングに使う */
  pageId:      string;
  /** 画面名（人が読む用） */
  title:       string;
  /** この画面が何をする画面かの説明。AI がユーザーの意図を解釈する土台になる */
  description: string;
  /** 画面が今表示しているデータ。JSON 化できる形にすること */
  snapshot?:   unknown;
  /** データ取得元 */
  sources:     AiDataSourceRef[];
  /** 画面固有の補足（絞り込み条件・選択中の企業など） */
  hints?:      Record<string, unknown>;
}

/** パネルから API へ送る最小形（title/description はサーバーでも使う） */
export interface AiChatRequestContext extends AiPageContext {
  /** ブラウザの現在パス */
  pathname: string;
}
