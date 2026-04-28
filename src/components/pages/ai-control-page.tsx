"use client";

// ─── AI コントロールページ ─────────────────────────────────────────────────────
//
// 現在稼働中の全 AI 設定をリスト表示し、編集・削除・複製を可能にする（admin 専用）。
//
// ── 定義済みキー ─────────────────────────────────────────────────────────────
//   company_summary_system_prompt    : Company サマリー生成
//   support_alert_system_prompt      : Support アラート生成
//   support_summary_system_prompt    : Support サマリー生成
//   support_triage_system_prompt     : Support トリアージ
//   unified_log_signal_system_prompt : ログシグナル抽出
//   support_draft_reply_system_prompt: 返信ドラフト作成

import { useState, useEffect, useCallback, useRef } from "react";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button }       from "@/components/ui/button";
import { Textarea }     from "@/components/ui/textarea";
import { Badge }        from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Save, RotateCcw, Trash2, Copy, Pencil,
  AlertTriangle, CheckCircle, Info, BrainCircuit,
} from "lucide-react";

// ── 定数 ──────────────────────────────────────────────────────────────────────

interface ConfigMeta {
  key:         string;
  label:       string;
  description: string;
  apiRoute:    string;
}

const PREDEFINED_CONFIGS: ConfigMeta[] = [
  {
    key:         'company_summary_system_prompt',
    label:       'Company サマリー',
    description: '企業の証跡・アラート・People を統合して CSM 向け攻略サマリーを生成する',
    apiRoute:    '/api/company/[uid]/summary/regenerate',
  },
  {
    key:         'support_alert_system_prompt',
    label:       'Support アラート',
    description: 'Support Queue の案件から CSM が優先対応すべき運用アラートを 1 件生成する',
    apiRoute:    '/api/support/[caseId]/alert',
  },
  {
    key:         'support_summary_system_prompt',
    label:       'Support サマリー',
    description: 'Support 案件を構造化サマリー（ゴール・ペイン・リスク）に変換する',
    apiRoute:    '/api/support/[caseId]/summary',
  },
  {
    key:         'support_triage_system_prompt',
    label:       'Support トリアージ',
    description: '案件の緊急度判定・担当チームへのルーティング指示を生成する',
    apiRoute:    '/api/support/[caseId]/triage',
  },
  {
    key:         'unified_log_signal_system_prompt',
    label:       'ログシグナル抽出',
    description: 'Unified Log（Chatwork/Slack/議事録）からリスク・オポチュニティシグナルを抽出する',
    apiRoute:    '/api/batch/unified-log-signals',
  },
  {
    key:         'support_draft_reply_system_prompt',
    label:       '返信ドラフト作成',
    description: '顧客サポート問い合わせへの返信ドラフトを生成する（tone/language はリクエスト時に適用）',
    apiRoute:    '/api/support/[caseId]/draft-reply',
  },
];

// ── 型 ───────────────────────────────────────────────────────────────────────

interface AiConfigRecord {
  config_key:   string;
  value:        string;
  label:        string;
  description?: string | null;
  updated_at?:  string | null;
  updated_by?:  string | null;
}

// ── 単一行コンポーネント ──────────────────────────────────────────────────────

interface ConfigRowProps {
  meta:        ConfigMeta | null;  // null = カスタムキー
  record:      AiConfigRecord | null;
  unavailable: boolean;
  onEdit:      (key: string) => void;
  onDelete:    (key: string) => void;
  onDuplicate: (key: string) => void;
}

function ConfigRow({ meta, record, unavailable, onEdit, onDelete, onDuplicate }: ConfigRowProps) {
  const key   = meta?.key ?? record?.config_key ?? '';
  const label = meta?.label ?? record?.label ?? key;
  const desc  = meta?.description ?? record?.description ?? '';

  const isNocoDB  = !!record;
  const isDefault = !record && !unavailable;

  return (
    <div className="flex items-start gap-4 py-4">
      {/* アイコン */}
      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <BrainCircuit className="w-4 h-4 text-slate-500" />
      </div>

      {/* 情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{label}</span>
          {isNocoDB && (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-[11px] py-0">
              NocoDB 管理
            </Badge>
          )}
          {isDefault && (
            <Badge variant="outline" className="text-slate-500 border-slate-200 bg-slate-50 text-[11px] py-0">
              コードデフォルト
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
        <div className="flex items-center gap-3 mt-1">
          <code className="text-[10px] text-slate-400 font-mono">{key}</code>
          {meta?.apiRoute && (
            <span className="text-[10px] text-slate-400">{meta.apiRoute}</span>
          )}
          {record?.updated_at && (
            <span className="text-[10px] text-slate-400">
              更新: {new Date(record.updated_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {record.updated_by ? ` (${record.updated_by})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs text-slate-600"
          onClick={() => onEdit(key)}
          disabled={unavailable}
          title="編集"
        >
          <Pencil className="w-3.5 h-3.5 mr-1" />
          編集
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs text-slate-600"
          onClick={() => onDuplicate(key)}
          disabled={unavailable}
          title="複製（バックアップ用コピーを作成）"
        >
          <Copy className="w-3.5 h-3.5 mr-1" />
          複製
        </Button>
        {isNocoDB && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDelete(key)}
            title="NocoDB レコードを削除（コードデフォルトに戻る）"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            削除
          </Button>
        )}
      </div>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export function AiControlPage() {
  const [records, setRecords]         = useState<AiConfigRecord[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // 編集 Sheet
  const [editKey, setEditKey]         = useState<string | null>(null);
  const [editValue, setEditValue]     = useState('');
  const [editSaved, setEditSaved]     = useState('');
  const [isSaving, setIsSaving]       = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saveMsg, setSaveMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 削除確認 Dialog
  const [deleteKey, setDeleteKey]     = useState<string | null>(null);
  const [isDeleting, setIsDeleting]   = useState(false);

  // 複製メッセージ
  const [dupMsg, setDupMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dupMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await fetch('/api/ops/ai-config');
      const json = await res.json() as { records?: AiConfigRecord[]; error?: string };
      if (json.error?.includes('未設定')) {
        setUnavailable(true);
      } else {
        setRecords(json.records ?? []);
      }
    } catch {
      // degraded
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const getRecord = (key: string) => records.find(r => r.config_key === key) ?? null;

  // カスタムキー（定義済み以外）
  const predefinedKeys = new Set(PREDEFINED_CONFIGS.map(c => c.key));
  const customRecords  = records.filter(r => !predefinedKeys.has(r.config_key));

  // ── 編集 Sheet を開く ─────────────────────────────────────────────────────
  async function handleEdit(key: string) {
    const rec = getRecord(key);
    if (rec) {
      setEditValue(rec.value);
      setEditSaved(rec.value);
      setEditKey(key);
      setSaveMsg(null);
    } else {
      // NocoDB に未登録 → デフォルト値を取得してから開く
      try {
        const res  = await fetch(`/api/ops/ai-config/default?key=${encodeURIComponent(key)}`);
        const json = await res.json() as { value?: string };
        setEditValue(json.value ?? '');
        setEditSaved(json.value ?? '');
      } catch {
        setEditValue('');
        setEditSaved('');
      }
      setEditKey(key);
      setSaveMsg(null);
    }
  }

  // ── 保存 ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!editKey) return;
    const meta  = PREDEFINED_CONFIGS.find(c => c.key === editKey);
    const label = meta?.label ?? editKey;
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/ops/ai-config', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config_key: editKey, value: editValue, label }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? '保存失敗');
      }
      setEditSaved(editValue);
      setSaveMsg({ type: 'success', text: '保存しました' });
      // ローカルキャッシュ更新
      setRecords(prev => {
        const idx = prev.findIndex(r => r.config_key === editKey);
        const upd: AiConfigRecord = {
          ...(prev[idx] ?? { config_key: editKey, label }),
          value:      editValue,
          updated_at: new Date().toISOString(),
        };
        if (idx >= 0) { const n = [...prev]; n[idx] = upd; return n; }
        return [...prev, upd];
      });
    } catch (e) {
      setSaveMsg({ type: 'error', text: e instanceof Error ? e.message : '保存失敗' });
    } finally {
      setIsSaving(false);
    }
  }

  // ── デフォルトに戻す ──────────────────────────────────────────────────────
  async function handleReset() {
    if (!editKey) return;
    setIsResetting(true);
    setSaveMsg(null);
    try {
      const res  = await fetch(`/api/ops/ai-config/default?key=${encodeURIComponent(editKey)}`);
      if (!res.ok) throw new Error('デフォルト値取得失敗');
      const json = await res.json() as { value: string };
      setEditValue(json.value);
      setSaveMsg({ type: 'success', text: 'デフォルト値を読み込みました。「保存」で NocoDB に反映されます。' });
    } catch (e) {
      setSaveMsg({ type: 'error', text: e instanceof Error ? e.message : 'リセット失敗' });
    } finally {
      setIsResetting(false);
    }
  }

  // ── 削除 ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteKey) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/ops/ai-config?key=${encodeURIComponent(deleteKey)}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? '削除失敗');
      }
      setRecords(prev => prev.filter(r => r.config_key !== deleteKey));
      setDeleteKey(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  }

  // ── 複製 ─────────────────────────────────────────────────────────────────
  async function handleDuplicate(key: string) {
    if (dupMsgTimer.current) clearTimeout(dupMsgTimer.current);
    const rec = getRecord(key);
    let value = rec?.value ?? '';
    if (!value) {
      try {
        const res  = await fetch(`/api/ops/ai-config/default?key=${encodeURIComponent(key)}`);
        const json = await res.json() as { value?: string };
        value = json.value ?? '';
      } catch { /* ignore */ }
    }
    const suffix    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const copyKey   = `${key}_copy_${suffix}`;
    const meta      = PREDEFINED_CONFIGS.find(c => c.key === key);
    const copyLabel = `${meta?.label ?? key} (コピー)`;
    try {
      const res = await fetch('/api/ops/ai-config', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config_key: copyKey, value, label: copyLabel }),
      });
      if (!res.ok) throw new Error('複製失敗');
      await fetchRecords(); // リスト更新
      setDupMsg({ type: 'success', text: `複製しました: ${copyKey}` });
    } catch (e) {
      setDupMsg({ type: 'error', text: e instanceof Error ? e.message : '複製失敗' });
    }
    dupMsgTimer.current = setTimeout(() => setDupMsg(null), 4000);
  }

  const editIsDirty = editValue !== editSaved;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* ページタイトル */}
            <div>
              <h1 className="text-lg font-semibold text-slate-900">AI Control</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                稼働中の AI システムプロンプトを管理します。NocoDB に保存した値がコードデフォルトより優先されます。
              </p>
            </div>

            {/* 通知バナー */}
            {unavailable && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 space-y-1">
                  <p className="font-medium">NocoDB テーブルが未設定です</p>
                  <p>
                    <code className="font-mono text-xs bg-amber-100 px-1 rounded">NOCODB_AI_CONFIG_TABLE_ID</code> が設定されていないため、
                    コード内のデフォルトプロンプトを使用しています。
                  </p>
                </div>
              </div>
            )}

            {dupMsg && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
                dupMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {dupMsg.type === 'success'
                  ? <CheckCircle className="w-4 h-4 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 shrink-0" />
                }
                {dupMsg.text}
              </div>
            )}

            {/* 定義済み AI リスト */}
            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">稼働中 ({PREDEFINED_CONFIGS.length})</span>
              </div>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-md bg-slate-100 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-40 bg-slate-100 rounded animate-pulse" />
                        <div className="h-3 w-72 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))
                : PREDEFINED_CONFIGS.map(meta => (
                    <div key={meta.key} className="px-4">
                      <ConfigRow
                        meta={meta}
                        record={getRecord(meta.key)}
                        unavailable={unavailable}
                        onEdit={handleEdit}
                        onDelete={setDeleteKey}
                        onDuplicate={handleDuplicate}
                      />
                    </div>
                  ))
              }
            </div>

            {/* カスタムキー（複製などで作成したもの） */}
            {customRecords.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                <div className="px-4 py-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    カスタム ({customRecords.length})
                  </span>
                </div>
                {customRecords.map(rec => (
                  <div key={rec.config_key} className="px-4">
                    <ConfigRow
                      meta={null}
                      record={rec}
                      unavailable={unavailable}
                      onEdit={handleEdit}
                      onDelete={setDeleteKey}
                      onDuplicate={handleDuplicate}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 使い方メモ */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>複製</strong>はカスタムセクションにコピーを作成します（バックアップ・実験用）。
                <strong>削除</strong>は NocoDB レコードを削除し、コードデフォルトに戻します。
                保存した変更は次回の AI 生成から即座に反映されます（デプロイ不要）。
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* 編集 Dialog（大型モーダル） */}
      <Dialog open={editKey !== null} onOpenChange={open => { if (!open) { setEditKey(null); setSaveMsg(null); } }}>
        <DialogContent className="max-w-4xl w-full flex flex-col p-0 gap-0 max-h-[90vh]">
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <DialogTitle className="text-base">
              {PREDEFINED_CONFIGS.find(c => c.key === editKey)?.label ?? editKey}
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-slate-400 mt-0.5">
              {editKey}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
            <Textarea
              value={editValue}
              onChange={e => { setEditValue(e.target.value); setSaveMsg(null); }}
              className="min-h-[480px] font-mono text-xs leading-relaxed resize-none"
              placeholder="プロンプトを入力..."
              style={{ height: 'clamp(480px, 60vh, 700px)' }}
            />

            {saveMsg && (
              <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                saveMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {saveMsg.type === 'success'
                  ? <CheckCircle className="w-4 h-4 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 shrink-0" />
                }
                {saveMsg.text}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-6 py-4 border-t bg-white shrink-0">
            <Button
              onClick={handleSave}
              disabled={!editIsDirty || isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              保存
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isResetting}
              title="コードのデフォルト値を読み込む"
            >
              {isResetting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}
              デフォルトに戻す
            </Button>
            {editIsDirty && (
              <span className="text-sm text-amber-600 ml-1">未保存の変更あり</span>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認 Dialog */}
      <Dialog open={deleteKey !== null} onOpenChange={open => { if (!open) setDeleteKey(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>NocoDB レコードを削除しますか？</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 mt-2">
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{deleteKey}</code>
              の NocoDB レコードを削除します。
              削除後はコードのデフォルト値が使用されます。
              この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteKey(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
