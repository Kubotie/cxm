// ─── AI Config — NocoDB キーバリューストア ────────────────────────────────────
//
// システムプロンプトなど AI 設定を NocoDB の ai_config テーブルで管理する。
//
// テーブル設計（NocoDB 側で作成が必要）:
//   config_key  : Text (unique) — 識別キー e.g. "company_summary_system_prompt"
//   value       : Long Text     — プロンプト本文など
//   label       : Text          — UI 表示名
//   description : Text          — 用途説明
//   updated_at  : DateTime      — 最終更新日時
//   updated_by  : Text          — 最終更新者
//
// 環境変数: NOCODB_AI_CONFIG_TABLE_ID
//
// 未設定時: getAiConfig() は null を返し、呼び出し元でデフォルト値にフォールバック。

import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface AiConfigRecord {
  Id?:          number;
  config_key:   string;
  value:        string;
  label:        string;
  description?: string | null;
  updated_at?:  string | null;
  updated_by?:  string | null;
}

// ── プロセスメモリキャッシュ（5分 TTL）────────────────────────────────────────

let _cache: Map<string, AiConfigRecord> | null = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheValid(): boolean {
  return _cache !== null && Date.now() - _cacheAt < CACHE_TTL_MS;
}

function invalidateCache(): void {
  _cache = null;
  _cacheAt = 0;
}

// ── 全件取得（キャッシュ付き）──────────────────────────────────────────────────

export async function listAiConfigs(): Promise<AiConfigRecord[]> {
  const tableId = TABLE_IDS.ai_config;
  if (!tableId) return [];

  if (isCacheValid()) {
    return Array.from(_cache!.values());
  }

  const records = await nocoFetch<AiConfigRecord>(tableId, { sort: 'config_key' }, false);
  _cache = new Map(records.map(r => [r.config_key, r]));
  _cacheAt = Date.now();
  return records;
}

// ── 単一キー取得 ──────────────────────────────────────────────────────────────

export async function getAiConfig(key: string): Promise<string | null> {
  const tableId = TABLE_IDS.ai_config;
  if (!tableId) return null;

  try {
    if (isCacheValid()) {
      return _cache!.get(key)?.value ?? null;
    }
    await listAiConfigs(); // キャッシュ更新
    return _cache?.get(key)?.value ?? null;
  } catch (e) {
    console.warn(`[ai-config] getAiConfig(${key}) failed:`, e);
    return null;
  }
}

// ── 書き込み（upsert）─────────────────────────────────────────────────────────

export async function upsertAiConfig(
  key:       string,
  value:     string,
  label:     string,
  updatedBy: string,
  description?: string,
): Promise<void> {
  const tableId = TABLE_IDS.ai_config;
  if (!tableId) throw new Error('NOCODB_AI_CONFIG_TABLE_ID が未設定です');

  invalidateCache();

  // 既存レコード検索
  const existing = await nocoFetch<AiConfigRecord>(
    tableId,
    { where: `(config_key,eq,${key})`, limit: '1' },
    false,
  );

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (existing.length > 0 && existing[0].Id != null) {
    await nocoUpdate(tableId, existing[0].Id, {
      value,
      label,
      description: description ?? null,
      updated_at:  now,
      updated_by:  updatedBy,
    });
  } else {
    await nocoCreate(tableId, {
      config_key:  key,
      value,
      label,
      description: description ?? null,
      updated_at:  now,
      updated_by:  updatedBy,
    });
  }
}
