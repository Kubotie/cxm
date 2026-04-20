// ─── Contact Candidate — ログから抽出した連絡先候補の型定義 ──────────────────
//
// ログ（Chatwork / Slack / Notion議事録）のメッセージ送信者・参加者から
// 会社連絡先の候補を抽出し、CSM が確認して company_people へ反映する仕組み。

export type ContactCandidateSource = 'chatwork' | 'slack' | 'notion_minutes';

/** ログから抽出した単一の連絡先候補 */
export interface ContactCandidate {
  /** クライアント側で生成した一意 ID */
  id: string;
  /** 抽出した氏名 */
  name: string;
  /** 抽出したメールアドレス（ログに含まれる場合のみ） */
  email?: string;
  /** 所属・部署らしき文字列（ログに含まれる場合のみ） */
  department?: string;
  /** 抽出元ログソース */
  source: ContactCandidateSource;
  /** ログのタイトルや日付などのコンテキスト（例: "2024-04-15 議事録" or "Chatwork 2024-04-10"） */
  sourceRef: string;
  /** 抽出根拠テキスト（stakeholderNote に保存される） */
  excerpt?: string;
  /**
   * 名前の信頼度（実名らしさの推定）。
   *   high   — 日本語氏名 / 英語フルネーム（スペース区切り）
   *   medium — 英語名だが1語 / 判定困難
   *   low    — ユーザー名形式（"firstname.lastname123" など）
   */
  confidence: 'high' | 'medium' | 'low';
  /**
   * 抽出根拠の説明（担当者が判断材料として参照する）。
   * 例: "Chatwork 送信者名（社内PT_ユーザー除外済み）"
   */
  whyPicked: string;
  /** 既存 people レコードとの照合結果 */
  existingMatch?: {
    id:         string;
    name:       string;
    similarity: number; // 0–1（1 = 完全一致）
  };
}

/** API レスポンス */
export interface ContactCandidatesResult {
  candidates:     ContactCandidate[];
  /** 設定済みだがデータがなかったソース */
  emptySources:   ContactCandidateSource[];
  /** テーブルID未設定でスキップしたソース */
  skippedSources: ContactCandidateSource[];
  /**
   * データはあるが候補抽出に不向きなソース（カラム欠如など構造的制約）。
   * 現状: notion_minutes は participants カラムが存在しないため常にここに入る。
   */
  weakSources:    ContactCandidateSource[];
}

/** 候補に対するユーザーアクション */
export type ContactCandidateAction = 'add' | 'link' | 'ignore';

/** 確認ダイアログで各候補に割り当てるアクション */
export interface ContactCandidateDecision {
  candidateId: string;
  action:      ContactCandidateAction;
  /** action = 'link' の場合にリンク先の既存 person ID */
  linkToId?:   string;
}
