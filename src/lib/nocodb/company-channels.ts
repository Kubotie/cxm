// ─── company_channel_identify フェッチヘルパー ─────────────────────────────────
// 各企業の Slack / Chatwork チャンネル設定を取得する。
// テーブル: company_channel_identify (TABLE_IDS.company_channel_identify)
//
// スキーマ（2026-02-20 確認）:
//   company_uid         : "sf_XXXX" 形式（companies テーブルの company_uid と同じ）
//   slack_channel_id    : Slack チャンネル ID（例: C0998HZN3V4）
//   chatwork_channel_id : Chatwork ルーム ID（例: 233877177）
//   channel_name        : チャンネル/グループの表示名
//
// ※ Intercom (Mail) 対応は当テーブルにカラムがないため現在未対応。

import { nocoFetchByUids, nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';

// ── 外部 Slack ワークスペーストークン型 ──────────────────────────────────────────

interface RawSlackWorkspaceToken {
  Id: number;
  team_id?: string | null;       // NocoDB カラム名は team_id
  bot_token?: string | null;
  [key: string]: unknown;
}
import {
  toCompanyChannelInfos,
  type RawCompanyChannel,
  type CompanyChannelInfo,
} from '@/lib/nocodb/types';

// ── 単一企業のチャンネル情報を取得 ────────────────────────────────────────────

export async function fetchChannelByCompanyUid(
  uid: string,
): Promise<CompanyChannelInfo[]> {
  const tableId = TABLE_IDS.company_channel_identify;
  if (!tableId) return [];
  const rows = await nocoFetch<RawCompanyChannel>(tableId, {
    where: `(company_uid,eq,${uid})`,
    limit: '20',
  }, false);
  return rows.flatMap(toCompanyChannelInfos);
}

// ── 複数企業のチャンネル情報を一括取得 ──────────────────────────────────────────
// 返り値: Map<companyUid, CompanyChannelInfo[]>

export async function fetchChannelsByCompanyUids(
  uids: string[],
): Promise<Map<string, CompanyChannelInfo[]>> {
  const result = new Map<string, CompanyChannelInfo[]>();
  for (const uid of uids) result.set(uid, []);

  const tableId = TABLE_IDS.company_channel_identify;
  if (!tableId || uids.length === 0) return result;

  const rawMap = await nocoFetchByUids<RawCompanyChannel>(tableId, uids, {
    limit: String(uids.length * 10),
  });

  for (const [uid, rows] of rawMap) {
    const channels = rows.flatMap(toCompanyChannelInfos);
    result.set(uid, channels);
  }
  return result;
}

// ── 外部 Slack ワークスペース bot_token を取得 ───────────────────────────────────

/**
 * slack_team_id → bot_token のマップを取得する。
 * ext_slack_workspace=true のチャンネルが存在する場合に呼び出す。
 */
export async function fetchSlackWorkspaceTokens(
  teamIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (teamIds.length === 0) return result;

  const tableId = TABLE_IDS.slack_workspace_tokens;
  if (!tableId) return result;

  // 全件取得（ワークスペース数は少ないため）
  const rows = await nocoFetch<RawSlackWorkspaceToken>(tableId, { limit: '100' }, false).catch(() => []);

  for (const row of rows) {
    const tid = row.team_id ? String(row.team_id).trim() : '';
    const token = row.bot_token ? String(row.bot_token).trim() : '';
    if (tid && token && teamIds.includes(tid)) {
      result.set(tid, token);
    }
  }
  return result;
}

// ── チャンネル情報をチャンネル種別でグループ化するユーティリティ ────────────────

export type ChannelMap = {
  slack?:    CompanyChannelInfo;
  chatwork?: CompanyChannelInfo;
};

export function groupChannelsByType(channels: CompanyChannelInfo[]): ChannelMap {
  const map: ChannelMap = {};
  for (const ch of channels) {
    if (!map[ch.type]) map[ch.type] = ch; // 先勝ち（同種複数あれば最初の1件）
  }
  return map;
}
