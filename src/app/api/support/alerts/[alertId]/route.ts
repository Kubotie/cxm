// ─── Write API: Support Alert 更新 ────────────────────────────────────────────
// TODO: OpenAI 連携フェーズで実装する
//
// PATCH /api/support/alerts/{alertId}
//   body: { status: "In Progress" | "Resolved" | "Dismissed" }
//   → NocoDB support_alerts を更新
//
// POST /api/support/alerts/{alertId}/dismiss
//   → status を "Dismissed" に変更
//
// POST /api/support/alerts (内部 AI 生成用)
//   body: { sourceId, sourceTable, generatedBy: "openai" }
//   → support_alerts に新規レコード挿入
//   → これは DolphinScheduler または AI pipeline から呼ばれる予定

export async function PATCH() {
  return Response.json({ error: 'Not implemented' }, { status: 501 });
}
