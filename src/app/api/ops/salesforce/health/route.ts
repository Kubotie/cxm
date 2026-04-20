// ─── GET /api/ops/salesforce/health ───────────────────────────────────────────
//
// Salesforce 接続状態の診断エンドポイント。
// 環境変数チェック → Client Credentials 認証 → SOQL 疎通確認 の3ステップを実行する。
//
// ── レスポンス型 ────────────────────────────────────────────────────────────
//   {
//     checkedAt: string,
//     config:    { status, missing, loginUrl, apiVersion },
//     auth:      { status, instanceUrl?, error? },
//     query:     { status, soql, resultCount?, error? },
//     overall:   'ok' | 'partial' | 'error',
//   }

import { NextResponse } from 'next/server';
import {
  getSalesforceConfigStatus,
  isSalesforceConfigured,
  sfQuery,
  sfFetch,
  SF_API_VERSION,
} from '@/lib/salesforce/client';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

type StepStatus = 'ok' | 'error' | 'skipped';

export interface SalesforceHealthResult {
  checkedAt: string;
  config: {
    status:     'ok' | 'missing';
    missing:    string[];
    warnings:   string[];
    loginUrl:   string;
    apiVersion: string;
  };
  auth: {
    status:      StepStatus;
    instanceUrl?: string;
    error?:      string;
  };
  query: {
    status:       StepStatus;
    soql:         string;
    resultCount?: number;
    error?:       string;
  };
  overall: 'ok' | 'partial' | 'error';
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<SalesforceHealthResult>> {
  const checkedAt = new Date().toISOString();
  const cfgStatus = getSalesforceConfigStatus();

  // ─ Step 1: config check ──────────────────────────────────────────────────
  const config: SalesforceHealthResult['config'] = {
    status:     cfgStatus.configured ? 'ok' : 'missing',
    missing:    cfgStatus.missing,
    warnings:   cfgStatus.warnings,
    loginUrl:   cfgStatus.loginUrl,
    apiVersion: cfgStatus.apiVersion,
  };

  // ─ Step 2: auth check（Client Credentials Grant）─────────────────────────
  // sfFetch で最小 REST API を叩き、token 取得 + instanceUrl 疎通を同時確認する。
  // /services/data を GET すると利用可能な API バージョン一覧が返る（認証のみで疎通確認に最適）。

  let auth: SalesforceHealthResult['auth'];
  let resolvedInstanceUrl: string | undefined;

  if (!isSalesforceConfigured()) {
    auth = { status: 'skipped' };
  } else {
    try {
      // /services/data は認証済みであれば常に返る最小コストのエンドポイント
      type VersionEntry = { version: string; url: string };
      const versions = await sfFetch<VersionEntry[]>('GET', '/services/data');
      // versions は配列。instanceUrl の確認として使う
      void versions;
      // 取得成功 → instanceUrl は token キャッシュから取得できないため LOGIN_URL を表示
      resolvedInstanceUrl = cfgStatus.loginUrl;
      auth = { status: 'ok', instanceUrl: resolvedInstanceUrl };
    } catch (err) {
      auth = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─ Step 3: SOQL query check ───────────────────────────────────────────────
  const HEALTH_SOQL = `SELECT Id,Name FROM User WHERE IsActive=true LIMIT 3`;
  let query: SalesforceHealthResult['query'];

  if (!isSalesforceConfigured() || auth.status === 'error') {
    query = { status: 'skipped', soql: HEALTH_SOQL };
  } else {
    try {
      const rows = await sfQuery<{ Id: string; Name: string }>(HEALTH_SOQL);
      query = { status: 'ok', soql: HEALTH_SOQL, resultCount: rows.length };
    } catch (err) {
      query = {
        status: 'error',
        soql:   HEALTH_SOQL,
        error:  err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ─ overall status ─────────────────────────────────────────────────────────
  const overall: SalesforceHealthResult['overall'] =
    config.status === 'ok' && auth.status === 'ok' && query.status === 'ok'
      ? 'ok'
      : config.status === 'missing'
        ? 'error'
        : auth.status === 'error' || query.status === 'error'
          ? 'partial'
          : 'partial';

  const result: SalesforceHealthResult = {
    checkedAt,
    config,
    auth,
    query,
    overall,
  };

  const httpStatus = overall === 'ok' ? 200 : overall === 'partial' ? 207 : 503;
  return NextResponse.json(result, { status: httpStatus });
}
