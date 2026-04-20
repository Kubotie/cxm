"use client";

// ─── Company Mutation Logs 一覧画面 ──────────────────────────────────────────
// GET /api/ops/company-mutation-logs から company_mutation_logs を取得して表示。
// フィルタ: event_type / company_uid / date_from / date_to

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button }       from "@/components/ui/button";
import { Badge }        from "@/components/ui/badge";
import { Input }        from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea }   from "@/components/ui/scroll-area";
import {
  RefreshCw, Activity, Building, ExternalLink,
  ChevronRight, Clock, Copy, Check,
} from "lucide-react";
import type { RawMutationLogItem } from "@/app/api/ops/company-mutation-logs/route";

// ── 定数 ─────────────────────────────────────────────────────────────────────

const API_BASE    = '/api';
const BATCH_TOKEN = process.env.NEXT_PUBLIC_SUPPORT_BATCH_SECRET ?? '';

const EVENT_TYPE_OPTIONS = [
  { value: 'all',               label: '全イベント' },
  { value: 'action_created',    label: 'action_created' },
  { value: 'action_updated',    label: 'action_updated' },
  { value: 'contact_created',   label: 'contact_created' },
  { value: 'contact_updated',   label: 'contact_updated' },
  { value: 'sf_todo_created',   label: 'sf_todo_created' },
  { value: 'action_sf_pushed',  label: 'action_sf_pushed' },
  { value: 'contact_sf_pushed', label: 'contact_sf_pushed' },
];

const EVENT_TYPE_BADGE: Record<string, string> = {
  action_created:    'bg-green-100  border-green-300  text-green-700',
  action_updated:    'bg-sky-100    border-sky-300    text-sky-700',
  contact_created:   'bg-violet-100 border-violet-300 text-violet-700',
  contact_updated:   'bg-indigo-100 border-indigo-300 text-indigo-700',
  sf_todo_created:   'bg-amber-100  border-amber-300  text-amber-700',
  action_sf_pushed:  'bg-orange-100 border-orange-300 text-orange-700',
  contact_sf_pushed: 'bg-rose-100   border-rose-300   text-rose-700',
};

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function apiFetch(path: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: BATCH_TOKEN ? { 'Authorization': `Bearer ${BATCH_TOKEN}` } : {},
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function payloadExcerpt(json: string | null | undefined): string {
  if (!json) return '—';
  try {
    const obj = JSON.parse(json);
    // 主要フィールドを簡易表示
    const parts: string[] = [];
    if (obj.title)   parts.push(`title: "${String(obj.title).slice(0, 30)}"`);
    if (obj.subject) parts.push(`subject: "${String(obj.subject).slice(0, 30)}"`);
    if (obj.name)    parts.push(`name: "${obj.name}"`);
    if (obj.after?.status) parts.push(`status → ${obj.after.status}`);
    if (obj.syncResult) parts.push(`syncResult: ${obj.syncResult}`);
    return parts.length > 0 ? parts.join(' | ') : json.slice(0, 80);
  } catch { return json.slice(0, 80); }
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CompanyMutationLogsPage() {
  const [items, setItems]         = useState<RawMutationLogItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  // フィルタ
  const [eventType,  setEventType]  = useState('all');
  const [companyUid, setCompanyUid] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [limit,      setLimit]      = useState(50);

  // 詳細ダイアログ
  const [selectedItem, setSelectedItem] = useState<RawMutationLogItem | null>(null);
  const [copied,       setCopied]       = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (eventType  !== 'all') params.set('event_type',  eventType);
      if (companyUid.trim())    params.set('company_uid', companyUid.trim());
      if (dateFrom)             params.set('date_from',   dateFrom);
      if (dateTo)               params.set('date_to',     dateTo);
      params.set('limit', String(limit));

      const res = await apiFetch(`/ops/company-mutation-logs?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { available: boolean; items?: RawMutationLogItem[]; reason?: string };
      setAvailable(data.available);
      if (data.available && data.items) {
        setItems(data.items);
      } else {
        setItems([]);
        if (!data.available) setError(data.reason ?? 'テーブル未設定');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [eventType, companyUid, dateFrom, dateTo, limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function handleCopyPayload(json: string) {
    navigator.clipboard.writeText(JSON.stringify(JSON.parse(json), null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  // ── 詳細ダイアログ content ─────────────────────────────────────────────────

  function renderDetailSection(item: RawMutationLogItem) {
    let parsed: Record<string, unknown> | null = null;
    try { parsed = item.payload_json ? JSON.parse(item.payload_json) : null; } catch { /* noop */ }

    const entityLabel = item.event_type === 'action_sf_pushed'  ? 'SF Task ID'
                      : item.event_type === 'contact_sf_pushed' ? 'SF Contact ID'
                      : item.event_type.startsWith('action')    ? 'Action ID'
                      : item.event_type.startsWith('contact')   ? 'Person ID'
                      : item.event_type === 'sf_todo_created'   ? 'SF Todo ID'
                      : 'Entity ID';

    return (
      <div className="space-y-4 text-sm">
        {/* メタ情報 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div><span className="text-slate-400">Event Type</span></div>
          <div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium ${EVENT_TYPE_BADGE[item.event_type] ?? 'bg-slate-100 border-slate-300 text-slate-600'}`}>
              {item.event_type}
            </span>
          </div>
          <div><span className="text-slate-400">Timestamp</span></div>
          <div className="text-slate-700 font-mono">{fmtDate(item.timestamp)}</div>
          <div><span className="text-slate-400">Company UID</span></div>
          <div className="flex items-center gap-1">
            <span className="text-slate-700 font-mono text-[11px]">{item.company_uid || '—'}</span>
            {item.company_uid && (
              <Link href={`/companies/${item.company_uid}`} className="text-blue-500 hover:text-blue-700" target="_blank">
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div><span className="text-slate-400">{entityLabel}</span></div>
          <div className="text-slate-700 font-mono text-[11px]">{item.entity_id || '—'}</div>
          <div><span className="text-slate-400">Actor</span></div>
          <div className="text-slate-600">{item.actor_source}{item.actor_user_name ? ` / ${item.actor_user_name}` : ''}</div>
        </div>

        {/* payload_json */}
        {parsed && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-600">payload_json</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 text-slate-400 hover:text-slate-600"
                onClick={() => item.payload_json && handleCopyPayload(item.payload_json)}
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="bg-slate-50 border border-slate-200 rounded p-3 text-[10px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        )}

        {/* 関連リンク */}
        <div className="space-y-1.5">
          {item.company_uid && (
            <Link
              href={`/companies/${item.company_uid}`}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              <Building className="w-3.5 h-3.5" />
              Company Detail: {item.company_uid}
            </Link>
          )}
          {item.event_type.startsWith('action') && item.entity_id && item.company_uid && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ChevronRight className="w-3 h-3" />
              Action: {item.entity_id}（Company Detail &gt; Actions タブで確認）
            </p>
          )}
          {item.event_type.startsWith('contact') && item.entity_id && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ChevronRight className="w-3 h-3" />
              Contact: {item.entity_id}（Company Detail &gt; People タブで確認）
            </p>
          )}
          {item.event_type === 'sf_todo_created' && item.entity_id && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ChevronRight className="w-3 h-3" />
              SF Task ID: {item.entity_id}（Salesforce で確認）
            </p>
          )}
          {(item.event_type === 'action_sf_pushed' || item.event_type === 'contact_sf_pushed') && item.entity_id && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <ChevronRight className="w-3 h-3" />
              {item.event_type === 'action_sf_pushed' ? 'SF Task' : 'SF Contact'} ID: {item.entity_id}（Salesforce で確認）
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── レンダリング ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-white">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-4">

            {/* ヘッダー */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-500" />
                  Company Mutation Logs
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Action / Contact / SF ToDo の UI/API 操作履歴
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </div>

            {/* フィルタ */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Event Type</label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Company UID</label>
                    <Input
                      value={companyUid}
                      onChange={e => setCompanyUid(e.target.value)}
                      placeholder="例: ptmind_jp"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">From</label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">To</label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
                    <SelectTrigger className="h-7 text-xs w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[20, 50, 100, 200].map(n => (
                        <SelectItem key={n} value={String(n)} className="text-xs">{n}件</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={fetchLogs} disabled={loading} className="h-7 text-xs">
                    検索
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400"
                    onClick={() => { setEventType('all'); setCompanyUid(''); setDateFrom(''); setDateTo(''); }}>
                    クリア
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* テーブル未設定 / エラー */}
            {available === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                <p className="font-medium">テーブル未設定またはエラー</p>
                <p className="text-xs mt-1 text-amber-600">{error}</p>
                <p className="text-xs mt-1 text-amber-500">
                  環境変数 NOCODB_COMPANY_MUTATION_LOGS_TABLE_ID を設定してください。
                </p>
              </div>
            )}

            {/* ログ一覧 */}
            {available !== false && (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">{items.length}件</p>
                {loading && items.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
                )}
                {!loading && items.length === 0 && available === true && (
                  <div className="text-center py-12 text-slate-400 text-sm">ログがありません</div>
                )}
                {items.map(item => (
                  <div
                    key={item.Id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedItem(item)}
                  >
                    {/* Event type badge */}
                    <div className="flex-shrink-0 pt-0.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${EVENT_TYPE_BADGE[item.event_type] ?? 'bg-slate-100 border-slate-300 text-slate-600'}`}>
                        {item.event_type}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {item.company_uid && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            <Link
                              href={`/companies/${item.company_uid}`}
                              className="text-blue-600 hover:underline font-medium"
                              onClick={e => e.stopPropagation()}
                            >
                              {item.company_uid}
                            </Link>
                          </span>
                        )}
                        {item.entity_id && (
                          <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                            {item.entity_id}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate">{payloadExcerpt(item.payload_json)}</p>
                    </div>

                    {/* Right: actor + timestamp */}
                    <div className="flex-shrink-0 text-right text-[10px] text-slate-400 space-y-0.5">
                      <div>{item.actor_source}{item.actor_user_name ? ` / ${item.actor_user_name}` : ''}</div>
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-2.5 h-2.5" />
                        {fmtDate(item.timestamp)}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 self-center" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 詳細ダイアログ */}
      <Dialog open={!!selectedItem} onOpenChange={open => { if (!open) setSelectedItem(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-slate-500" />
              Mutation Log 詳細
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedItem?.event_type} — {fmtDate(selectedItem?.timestamp)}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="pr-1">
              {selectedItem && renderDetailSection(selectedItem)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
