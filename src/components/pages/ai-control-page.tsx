"use client";

// ─── AI コントロールページ ─────────────────────────────────────────────────────
//
// AI 系のシステムプロンプトを NocoDB 経由で UI から管理する（admin 専用）。
//
// ── キー一覧 ─────────────────────────────────────────────────────────────────
//   company_summary_system_prompt  : Company サマリー生成のベースプロンプト
//   （将来: support_summary_system_prompt, support_alert_system_prompt など）
//
// ── NocoDB テーブル未設定時 ───────────────────────────────────────────────────
//   バナーを表示し、コードデフォルトを使用中である旨を通知する。

import { useState, useEffect, useCallback } from "react";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button }       from "@/components/ui/button";
import { Textarea }     from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge }        from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, AlertTriangle, CheckCircle, Info } from "lucide-react";

// ── AI_CONFIG_KEY 定数 ────────────────────────────────────────────────────────

const CONFIG_KEY_COMPANY_SUMMARY = 'company_summary_system_prompt';

// ── 型 ───────────────────────────────────────────────────────────────────────

interface AiConfigRecord {
  config_key:   string;
  value:        string;
  label:        string;
  description?: string | null;
  updated_at?:  string | null;
  updated_by?:  string | null;
}

interface PromptCardState {
  value:       string;
  savedValue:  string;
  isLoading:   boolean;
  isSaving:    boolean;
  isResetting: boolean;
  updatedAt:   string | null;
  updatedBy:   string | null;
  saveMsg:     { type: 'success' | 'error'; text: string } | null;
}

// ── PromptCard コンポーネント ─────────────────────────────────────────────────

interface PromptCardProps {
  configKey:    string;
  label:        string;
  description:  string;
  record:       AiConfigRecord | null;
  isLoading:    boolean;
  unavailable:  boolean;
  onSave:       (key: string, value: string) => Promise<void>;
  onReset:      (key: string) => Promise<void>;
}

function PromptCard({
  configKey, label, description, record, isLoading, unavailable,
  onSave, onReset,
}: PromptCardProps) {
  const [state, setState] = useState<PromptCardState>({
    value:       record?.value ?? '',
    savedValue:  record?.value ?? '',
    isLoading:   false,
    isSaving:    false,
    isResetting: false,
    updatedAt:   record?.updated_at ?? null,
    updatedBy:   record?.updated_by ?? null,
    saveMsg:     null,
  });

  // record が取得されたらローカル状態を同期
  useEffect(() => {
    if (record) {
      setState(s => ({
        ...s,
        value:      record.value,
        savedValue: record.value,
        updatedAt:  record.updated_at ?? null,
        updatedBy:  record.updated_by ?? null,
      }));
    }
  }, [record]);

  const isDirty = state.value !== state.savedValue;

  async function handleSave() {
    setState(s => ({ ...s, isSaving: true, saveMsg: null }));
    try {
      await onSave(configKey, state.value);
      setState(s => ({
        ...s,
        isSaving:   false,
        savedValue: s.value,
        saveMsg: { type: 'success', text: '保存しました' },
        updatedAt:  new Date().toISOString(),
      }));
    } catch (e) {
      setState(s => ({
        ...s,
        isSaving: false,
        saveMsg: { type: 'error', text: e instanceof Error ? e.message : '保存失敗' },
      }));
    }
  }

  async function handleReset() {
    setState(s => ({ ...s, isResetting: true, saveMsg: null }));
    try {
      await onReset(configKey);
      setState(s => ({
        ...s,
        isResetting: false,
        saveMsg: { type: 'success', text: 'デフォルトに戻しました' },
      }));
    } catch (e) {
      setState(s => ({
        ...s,
        isResetting: false,
        saveMsg: { type: 'error', text: e instanceof Error ? e.message : 'リセット失敗' },
      }));
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <CardDescription className="mt-1 text-xs text-slate-500">{description}</CardDescription>
          </div>
          {unavailable && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs shrink-0">
              テーブル未設定
            </Badge>
          )}
          {!unavailable && !record && !isLoading && (
            <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 text-xs shrink-0">
              コードデフォルト使用中
            </Badge>
          )}
          {record && (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs shrink-0">
              NocoDB 管理
            </Badge>
          )}
        </div>
        {(state.updatedAt || state.updatedBy) && (
          <p className="text-[11px] text-slate-400 mt-2">
            最終更新: {state.updatedAt ? new Date(state.updatedAt).toLocaleString('ja-JP') : '—'}
            {state.updatedBy ? ` (${state.updatedBy})` : ''}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-64 rounded-md bg-slate-50 border animate-pulse" />
        ) : (
          <Textarea
            value={state.value}
            onChange={e => setState(s => ({ ...s, value: e.target.value, saveMsg: null }))}
            className="min-h-64 font-mono text-xs leading-relaxed resize-y"
            placeholder={unavailable ? 'NocoDB テーブルが未設定のため編集できません' : 'プロンプトを入力...'}
            disabled={unavailable}
          />
        )}

        {state.saveMsg && (
          <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
            state.saveMsg.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {state.saveMsg.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />
            }
            {state.saveMsg.text}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || state.isSaving || unavailable || isLoading}
          >
            {state.isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            保存
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={state.isResetting || unavailable || isLoading}
            title="コードのデフォルト値を NocoDB に書き込む（初期化）"
          >
            {state.isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
            デフォルトに戻す
          </Button>
          {isDirty && (
            <span className="text-xs text-amber-600 ml-1">未保存の変更あり</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export function AiControlPage() {
  const [records, setRecords]         = useState<AiConfigRecord[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ops/ai-config');
      if (res.status === 200) {
        const json = await res.json() as { records?: AiConfigRecord[]; error?: string };
        if (json.error?.includes('未設定')) {
          setUnavailable(true);
        } else {
          setRecords(json.records ?? []);
        }
      }
    } catch {
      // network error — degraded mode
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const getRecord = (key: string) => records.find(r => r.config_key === key) ?? null;

  async function handleSave(key: string, value: string) {
    // label は固定マッピング
    const LABELS: Record<string, string> = {
      [CONFIG_KEY_COMPANY_SUMMARY]: 'Company サマリー システムプロンプト',
    };
    const res = await fetch('/api/ops/ai-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_key: key, value, label: LABELS[key] ?? key }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? '保存に失敗しました');
    }
    // ローカルキャッシュを更新
    setRecords(prev => {
      const idx = prev.findIndex(r => r.config_key === key);
      const updated: AiConfigRecord = {
        ...(prev[idx] ?? { config_key: key, label: key }),
        value,
        updated_at: new Date().toISOString(),
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  }

  async function handleReset(key: string) {
    // デフォルト値を API から取得（クライアントにコード定数を持ち込まない）
    const res = await fetch(`/api/ops/ai-config/default?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('デフォルト値の取得に失敗しました');
    const json = await res.json() as { value: string };
    await handleSave(key, json.value);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* ヘッダー説明 */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                AI システムプロンプトを UI から直接編集・保存できます。
                保存した内容は即座に次回の AI 生成に反映されます（デプロイ不要）。
                「デフォルトに戻す」でコード定数の内容を NocoDB に書き込み、初期化できます。
              </p>
            </div>

            {unavailable && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 space-y-1">
                  <p className="font-medium">NocoDB テーブルが未設定です</p>
                  <p>
                    <code className="font-mono text-xs bg-amber-100 px-1 rounded">NOCODB_AI_CONFIG_TABLE_ID</code> が設定されていないため、
                    コード内のデフォルトプロンプトを使用しています。
                    NocoDB で <code className="font-mono text-xs bg-amber-100 px-1 rounded">ai_config</code> テーブルを作成し、
                    環境変数を設定してください。
                  </p>
                </div>
              </div>
            )}

            {/* Company サマリー プロンプト */}
            <PromptCard
              configKey={CONFIG_KEY_COMPANY_SUMMARY}
              label="Company サマリー — システムプロンプト"
              description="企業サマリー生成時の AI ベースプロンプト。/api/company/[uid]/summary/regenerate で使用されます。"
              record={getRecord(CONFIG_KEY_COMPANY_SUMMARY)}
              isLoading={isLoading}
              unavailable={unavailable}
              onSave={handleSave}
              onReset={handleReset}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
