// ─── PtAI Pipeline: 保存内容の検査（サーバー専用）────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §4-2
//
// ═══════════════════════════════════════════════════════════════════════════
//  **承認が要る変更を、サーバー側でも止める。**
//
//  §4-2 の注記:「現行は画面側だけのチェックです。Vercel 版ではサーバー
//  （API ルート）で承認者を確認してください。」
//
//  止めるのは 1 種類だけ:
//    フェーズ「契約締結済み（CLOSED_WON）」への**出入り**を、承認者でない人が
//    直接 `phase` に書くこと。
//
//  承認者でない人は、画面が `pendingPhase` / `pendingEdit` / `pendingDelete` に
//  積むので、正しい使い方なら弾かれない。弾かれるのは API を直接叩いた場合。
// ═══════════════════════════════════════════════════════════════════════════
//
// フェーズの定義は src/lib/ptai/twenty-test/schema.ts が正本。
// ここは「保存前の JSON」を見るので、旧キーの読み替えも通す。

import { normalizeStage, needsApproval, type Stage } from './twenty-test/schema';

const WON: Stage = 'CLOSED_WON';

export interface StageVerdict {
  ok: boolean;
  /** 拒否の理由。利用者に返してよい粒度まで */
  reason?: 'won_in' | 'won_out';
  /** 対象の商談キー（main / 追加商談の key）。**顧客名や本文は入れない** */
  deals?: string[];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** edits ドキュメントから「商談キー → フェーズ」を取り出す */
function stagesOf(doc: unknown): Map<string, Stage | null> {
  const out = new Map<string, Stage | null>();
  const d = asRecord(doc);
  if (!d) return out;

  const opp = asRecord(d.opp);
  if (opp) out.set('main', normalizeStage(opp.phase));

  const deals = Array.isArray(d.deals) ? d.deals : [];
  for (const raw of deals) {
    const x = asRecord(raw);
    if (!x || typeof x.key !== 'string') continue;
    out.set(x.key, normalizeStage(x.phase));
  }
  return out;
}

/**
 * 保存してよいかを判定する。
 *
 * @param before     保存前の edits ドキュメント（無ければ null）
 * @param after      これから保存する内容
 * @param isApprover 承認者かどうか
 */
export function assertStageChangeAllowed(
  before: unknown, after: unknown, isApprover: boolean,
): StageVerdict {
  if (isApprover) return { ok: true };

  const prev = stagesOf(before);
  const next = stagesOf(after);

  const inWon: string[] = [];
  const outWon: string[] = [];

  for (const [key, to] of next) {
    const from = prev.has(key) ? (prev.get(key) ?? null) : null;
    if (!needsApproval(from, to)) continue;
    if (to === WON) inWon.push(key);
    else outWon.push(key);
  }

  // 商談ごと消したうえで受注済みを外す、というすり抜けも塞ぐ
  for (const [key, from] of prev) {
    if (from === WON && !next.has(key)) outWon.push(key);
  }

  if (inWon.length)  return { ok: false, reason: 'won_in',  deals: inWon };
  if (outWon.length) return { ok: false, reason: 'won_out', deals: [...new Set(outWon)] };
  return { ok: true };
}

/** 画面に出す文言。顧客データを含まない */
export const APPROVER_REQUIRED_MESSAGE: Record<NonNullable<StageVerdict['reason']>, string> = {
  won_in:  '「契約締結済み」への変更は承認者の承認が必要です',
  won_out: '受注済みの商談の変更・削除は承認者の承認が必要です',
};
