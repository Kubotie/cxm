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
    const [mrr, activity, pkgEvents, peopleSignals, staleDm] = await Promise.allSettled([
      // Metabase CSV（大容量 → プロセスキャッシュに先読み）
      import('@/lib/metabase/mrr').then(m => m.fetchProjectMrrMap()),
      import('@/lib/metabase/project-user-activity').then(m => m.fetchProjectUserActivityMap()),
      import('@/lib/metabase/package-events').then(m => m.fetchPackageEventSummary()),
      // NocoDB 重量クエリ（2MB超でNext.jsキャッシュ不可 → プロセスキャッシュに先読み）
      import('@/lib/nocodb/people').then(m => m.fetchPeopleSignalsByUids(['_warmup_dummy_'])),
      import('@/lib/nocodb/people').then(m => m.fetchStaleDmSignalsByUids(['_warmup_dummy_'])),
    ]);
    const results = [mrr, activity, pkgEvents, peopleSignals, staleDm]
      .map(r => r.status === 'fulfilled' ? 'ok' : 'err');
    console.log('[instrumentation] cache warmup:', results.join(', '));
  } catch (e) {
    console.warn('[instrumentation] warmup failed (non-critical):', e);
  }
}
