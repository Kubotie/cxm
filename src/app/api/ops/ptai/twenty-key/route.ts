// ─── /api/ops/ptai/twenty-key ─────────────────────────────────────────────────
//
// Twenty の API キーを管理画面から設定する（2026-10-01 の判断）。
//
// ═══════════════════════════════════════════════════════════════════════════
//  GET    状態だけ返す。**キーそのものは絶対に返さない**
//  PUT    キーを保存する（AES-256-GCM で暗号化して ptai_settings へ）
//  DELETE 保存を消す（環境変数へのフォールバックに戻る）
//
//  認可: **admin / ops のみ**。他のロールは 403。
//  置き場所は PtAI 専用の `ptai_settings`。**`staff_identify` には書かない。**
// ═══════════════════════════════════════════════════════════════════════════
//
// ログ: 操作者と結果だけ。**キーの値・長さ・先頭は出さない。**

import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/auth/guard';
import {
  getSettingStatus, setSetting, clearSetting, invalidateSecretCache,
  isSettingsStoreConfigured, SETTING_TWENTY_API_KEY,
} from '@/lib/ptai/settings-store';
import { SecretError } from '@/lib/ptai/secret';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } };

function notConfigured() {
  return NextResponse.json({
    error: 'settings_store_not_configured',
    message: 'NOCODB_PTAI_SETTINGS_TABLE_ID が未設定です。scripts/ptai-settings-table.mjs --apply で作成してください',
  }, { status: 503, ...noStore });
}

export async function GET() {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;
  if (!isSettingsStoreConfigured()) return notConfigured();

  try {
    const status = await getSettingStatus(SETTING_TWENTY_API_KEY, process.env.TWENTY_API_KEY);
    return NextResponse.json(status, noStore);
  } catch {
    return NextResponse.json({ error: 'store_unavailable' }, { status: 502, ...noStore });
  }
}

export async function PUT(req: NextRequest) {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;
  if (!isSettingsStoreConfigured()) return notConfigured();

  const body = await req.json().catch(() => ({})) as { key?: unknown };
  const key = typeof body.key === 'string' ? body.key.trim() : '';

  // 形だけ見る。**値はログにも応答にも出さない**
  if (key.length < 20 || /\s/.test(key)) {
    return NextResponse.json(
      { error: 'invalid_key', message: 'キーの形式が不正です（20 文字以上・空白を含まない）' },
      { status: 400, ...noStore },
    );
  }

  try {
    const status = await setSetting(SETTING_TWENTY_API_KEY, key, gate.profile.name2);
    invalidateSecretCache(SETTING_TWENTY_API_KEY);
    console.info('[ops/ptai/twenty-key] 保存', JSON.stringify({ actor: gate.profile.name2 }));
    return NextResponse.json(status, noStore);
  } catch (e) {
    if (e instanceof SecretError) {
      return NextResponse.json(
        { error: e.kind, message: e.message }, { status: 503, ...noStore },
      );
    }
    console.error('[ops/ptai/twenty-key] 保存に失敗');
    return NextResponse.json({ error: 'store_unavailable' }, { status: 502, ...noStore });
  }
}

export async function DELETE() {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;
  if (!isSettingsStoreConfigured()) return notConfigured();

  try {
    await clearSetting(SETTING_TWENTY_API_KEY);
    invalidateSecretCache(SETTING_TWENTY_API_KEY);
    console.info('[ops/ptai/twenty-key] 削除', JSON.stringify({ actor: gate.profile.name2 }));
    const status = await getSettingStatus(SETTING_TWENTY_API_KEY, process.env.TWENTY_API_KEY);
    return NextResponse.json(status, noStore);
  } catch {
    return NextResponse.json({ error: 'store_unavailable' }, { status: 502, ...noStore });
  }
}
