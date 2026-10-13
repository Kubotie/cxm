"use client";

import { useState } from "react";

/**
 * 鍵のコピーボタン。
 * 既定では伏せ字で、押したときだけクリップボードへ入れる。
 * 画面共有や肩越しにそのまま映らないようにするため（見せる操作は本人が選ぶ）。
 */
export function CopyToken({ token }: { token: string }) {
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // クリップボードが使えない環境では、見せて手で選んでもらう
      setShown(true);
    }
  };

  const masked = `${token.slice(0, 8)}${"•".repeat(Math.max(0, token.length - 8))}`;

  return (
    <div className="ptok">
      <code className="ptok-v">{shown ? token : masked}</code>
      <button type="button" className="ptok-b" onClick={copy}>
        {done ? "コピーしました" : "コピー"}
      </button>
      <button type="button" className="ptok-b ghost" onClick={() => setShown(v => !v)}>
        {shown ? "隠す" : "表示"}
      </button>
    </div>
  );
}
