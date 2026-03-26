// ─── Write API: Support Case 更新 ─────────────────────────────────────────────
// TODO: OpenAI 連携フェーズで実装する
//
// PATCH /api/support/cases/{caseId}
//   body: { routingStatus?, assignedTeam?, ownerName?, severity? }
//   → NocoDB support_queue を更新
//   → support_case_ai_state を再生成（OpenAI）
//
// POST /api/support/cases/{caseId}/triage
//   body: { assignTo: "CSM" | "Support" | "CSE" }
//   → routing_status を "assigned" に変更
//
// ここにだけ write logic を置く。
// read は /api/nocodb/support-queue を使い続ける。

export async function PATCH() {
  return Response.json({ error: 'Not implemented' }, { status: 501 });
}
