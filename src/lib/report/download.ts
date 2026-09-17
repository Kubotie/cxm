// ─── ブラウザからのファイル保存 ──────────────────────────────────────────────

/** Blob を名前付きでダウンロードさせる */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 即座に revoke すると Safari でダウンロードが落ちるため遅らせる
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
