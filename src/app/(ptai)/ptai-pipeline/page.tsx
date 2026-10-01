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
  // ⚠ 告知の文面を環境で切り替える。**嘘を出さないため。**
  //    twenty のときは実際に Twenty と Notion へ書き込むので、
  //    「この画面の中だけに保存されます」は誤り。
  const live = getPtaiDataSource() === "twenty";

  return (
    <>
      <div className="pshell">
        <Link href="/apps">アプリ一覧</Link>
        <span className="pshell-here">Ptengine AI パイプライン</span>
        <span className="pshell-wip">{live ? "整備中・本番データ" : "整備中・使用不可"}</span>
        <Link href="/v2">CXM</Link>
        <span className="pshell-sp" />
        {profile && <span className="pshell-user">{profile.name || profile.name2}</span>}
      </div>

      {/* 整備中であることを画面の先頭で明示する。
          board.css のトークンを使うので、原本の見た目から浮かない。
          使えるようになったらこのブロックごと消す。 */}
      <div className="pwip" role="note">
        <b>この画面は整備中です。業務の判断には使わないでください。</b>
        {live ? (
          <span>
            データは Twenty CRM と Notion から取得しており、
            <b>入力した内容は Twenty と Notion に実際に書き込まれます。</b>
            商談・アクション・組織図は Twenty の test* オブジェクト、
            会社情報とキー日程・目標は Notion が正本です。
          </span>
        ) : (
          <span>
            データは移行元の固定スナップショットで、Twenty CRM とは未接続です。
            入力した内容はこの画面の中だけに保存され、Twenty にも Notion にも反映されません。
            動作確認・レビュー目的でのみ開いてください。
          </span>
        )}
      </div>

      {/* 原本の DOM。board.js が id で掴むので React からは触らない */}
      <div dangerouslySetInnerHTML={{ __html: BOARD_HTML }} />

      <BoardScripts />
    </>
  );
}
