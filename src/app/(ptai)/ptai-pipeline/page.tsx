// ─── /ptai-pipeline ───────────────────────────────────────────────────────────
//
// アーティファクト「Ptengine AI Pipeline Board」**Version 96** の移植。
// HANDOVER 12-1: UI・UX・挙動・計算結果は完全に引き継ぐ。リファクタはしない。
//   - 原本の HTML 骨組み  → markup.ts（無編集）
//   - 原本の CSS          → ../board.css（無編集）
//   - 原本の JS           → /public/ptai-pipeline/board.js（RAW の分離・Twenty の
//                           エラーコード読み替えの 2 箇所だけ）
//   - window.claude       → /public/ptai-pipeline/claude-shim.js が /api/ptai/* に接続
//
// 2026-10-01 にアーティファクトと突き合わせ、上記 3 ファイルは一致を確認済み。
// React は骨組みを一度流し込むだけで、以後の DOM は board.js が持つ。

import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { getPtaiDataSource } from "@/lib/twenty/data-source";
import { BOARD_HTML } from "./markup";
import { BoardScripts } from "./board-scripts";

export const dynamic = "force-dynamic";

export default async function PtaiPipelinePage() {
  const profile = await getCurrentUserProfile();
  // 移行元スナップショットを読んでいる環境だけ、その旨を出す。
  // twenty（本番）では告知を出さない — 業務で使える状態になったため（2026-10-01）。
  const live = getPtaiDataSource() === "twenty";

  return (
    <>
      <div className="pshell">
        <Link href="/apps">アプリ一覧</Link>
        <span className="pshell-here">Ptengine AI パイプライン</span>
        {!live && <span className="pshell-wip">移行元スナップショット</span>}
        <Link href="/v2">CXM</Link>
        <span className="pshell-sp" />
        {profile && <span className="pshell-user">{profile.name || profile.name2}</span>}
      </div>

      {/* 移行元スナップショットを読んでいる環境だけ注意書きを出す。
          本番（twenty）では出さない。 */}
      {!live && (
        <div className="pwip" role="note">
          <b>この画面は移行元のスナップショットを読んでいます。</b>
          <span>
            Twenty CRM とは未接続です。入力した内容はこの画面の中だけに保存され、
            Twenty にも Notion にも反映されません。
          </span>
        </div>
      )}

      {/* 原本の DOM。board.js が id で掴むので React からは触らない */}
      <div dangerouslySetInnerHTML={{ __html: BOARD_HTML }} />

      <BoardScripts />
    </>
  );
}
