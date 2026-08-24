// ─── Next.js Instrumentation ─────────────────────────────────────────────────
// サーバー起動時に1回だけ実行される。
// 重い Metabase CSV をプリフェッチしてプロセスキャッシュを温める。
// これにより最初のリクエストでの「コールドスタート遅延」を解消する。

export async function register() {
  // Edge runtime では不要（このアプリは Node.js のみ）
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // 起動直後にバックグラウンドで CSV を先読み
  // エラーは無視（取得失敗してもサーバー起動は継続）
  void warmMetabaseCaches();
}

async function warmMetabaseCaches() {
  try {
    const tasks: [string, Promise<unknown>][] = [
      // Metabase CSV（大容量 → プロセスキャッシュに先読み）
      // ⚠ signals は会社詳細 /usage の主データ源。暖め忘れると初回リクエストが数秒ブロックする。
      ['signals',  import('@/lib/metabase/project-signals').then(m => m.fetchProjectSignalMap())],
      ['activity', import('@/lib/metabase/project-user-activity').then(m => m.fetchProjectUserActivityMap())],
      // mrr は unstable_cache 依存のため request 文脈外でも安全な warmMrrCache を使う
      ['mrr',      import('@/lib/metabase/mrr').then(m => m.warmMrrCache())],
      ['pkgEvents', import('@/lib/metabase/package-events').then(m => m.fetchPackageEventSummary())],
      // NocoDB 重量クエリ（2MB超でNext.jsキャッシュ不可 → プロセスキャッシュに先読み）
      ['peopleSignals', import('@/lib/nocodb/people').then(m => m.fetchPeopleSignalsByUids(['_warmup_dummy_']))],
      ['staleDm',       import('@/lib/nocodb/people').then(m => m.fetchStaleDmSignalsByUids(['_warmup_dummy_']))],
    ];
    const settled = await Promise.allSettled(tasks.map(([, p]) => p));
    const summary = settled
      .map((r, i) => `${tasks[i][0]}=${r.status === 'fulfilled' ? 'ok' : 'err'}`)
      .join(', ');
    console.log('[instrumentation] cache warmup:', summary);
  } catch (e) {
    console.warn('[instrumentation] warmup failed (non-critical):', e);
  }
}
