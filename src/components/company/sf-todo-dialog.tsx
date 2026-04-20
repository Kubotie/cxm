"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge }    from "@/components/ui/badge";
import { Label }    from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Loader2, CheckCircle2, AlertCircle, Unplug } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createLocalSfTodo,
  SF_SYNC_STATUS_BADGE,
  type LocalSfTodo,
} from "@/lib/company/action-vm";
import type { SfTodoCreateResult } from "@/app/api/company/[companyUid]/sf-todos/route";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SfTodoDialogProps {
  open:                boolean;
  onOpenChange:        (open: boolean) => void;
  companyUid:          string;
  companyName:         string;
  prefillTitle?:       string;
  relatedSignalId?:    string;
  relatedSignalRef?:   string;
  /**
   * CXM Action ID（Action から起票した場合）。
   * 成功時に onResult.actionId として返却し、親が sfTodoStatus を更新できるようにする。
   */
  relatedActionId?:    string;
  /** SF ToDo 作成完了 / 失敗後に呼ばれる。syncResult で成否を判定する。 */
  onResult?:           (result: SfTodoCreateResult) => void;
  /** 後方互換 — LocalSfTodo を使っている既存コードのために残す */
  onCreated?:          (todo: LocalSfTodo) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SfTodoDialog({
  open,
  onOpenChange,
  companyUid,
  companyName,
  prefillTitle      = '',
  relatedSignalId,
  relatedSignalRef,
  relatedActionId,
  onResult,
  onCreated,
}: SfTodoDialogProps) {
  const [subject,      setSubject]      = useState(prefillTitle);
  const [description,  setDescription]  = useState('');
  const [dueDate,      setDueDate]      = useState('');
  const [priority,     setPriority]     = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [sfOwner,      setSfOwner]      = useState('');
  const [apiResult,    setApiResult]    = useState<SfTodoCreateResult | null>(null);
  const [syncing,      setSyncing]      = useState(false);
  /** dry-run 完了後に本実行フローに入っているか */
  const [confirming,   setConfirming]   = useState(false);

  // prefillTitle が変わったとき（再利用時）に同期
  useEffect(() => {
    if (open) {
      setSubject(prefillTitle);
      setApiResult(null);
    }
  }, [open, prefillTitle]);

  function reset() {
    setSubject(prefillTitle);
    setDescription('');
    setDueDate('');
    setPriority('Medium');
    setSfOwner('');
    setApiResult(null);
    setSyncing(false);
    setConfirming(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit(confirmCreate = false) {
    if (!subject.trim()) return;
    setSyncing(true);
    if (!confirmCreate) setApiResult(null);

    try {
      const res = await fetch(`/api/company/${companyUid}/sf-todos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject:           subject.trim(),
          description:       description.trim() || undefined,
          dueDate:           dueDate || null,
          priority,
          ownerEmail:        sfOwner.trim() || undefined,
          relatedSignalId:   relatedSignalId  ?? null,
          relatedSignalRef:  relatedSignalRef ?? null,
          actionId:          relatedActionId  ?? null,
          confirmCreate,
        }),
      });

      const data = await res.json() as SfTodoCreateResult;
      setApiResult(data);
      onResult?.(data);

      // dry-run 成功 → 本実行確認モードへ
      if (data.ok && data.mode === 'dry_run') {
        setConfirming(true);
      } else {
        setConfirming(false);
      }

      // 後方互換: onCreated があれば LocalSfTodo 形式で呼ぶ（本実行成功時のみ）
      if (confirmCreate && data.ok && onCreated) {
        const todo = createLocalSfTodo({
          companyUid,
          subject:          subject.trim(),
          description:      description.trim(),
          dueDate:          dueDate || null,
          priority,
          sfOwner:          sfOwner.trim(),
          relatedSignalId:  relatedSignalId  ?? null,
          relatedSignalRef: relatedSignalRef ?? null,
        });
        onCreated({
          ...todo,
          syncStatus: 'synced',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const fallback: SfTodoCreateResult = {
        ok:         false,
        mode:       'error',
        syncResult: 'sync_error',
        sfTodoId:   null,
        error:      errorMsg,
        actionId:   relatedActionId ?? null,
        resolved:   { sfAccountId: '', sfAccountIdSource: 'fallback', ownerId: null, ownerIdResolved: false },
        warnings:   [],
      };
      setApiResult(fallback);
      onResult?.(fallback);
      setConfirming(false);
    } finally {
      setSyncing(false);
    }
  }

  // ── 結果表示ブロック ─────────────────────────────────────────────────────────

  const ResultBanner = () => {
    if (!apiResult) return null;

    if (apiResult.ok) {
      const isDryRun = apiResult.mode === 'dry_run';
      const warnings = apiResult.warnings ?? [];
      const ownerResolved = apiResult.resolved.ownerIdResolved;
      const ownerProvided = !!sfOwner.trim();
      const sfAccountIdSource = apiResult.resolved.sfAccountIdSource;
      return (
        <div className="space-y-1.5">
          {/* メインバナー */}
          {isDryRun ? (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs border bg-slate-50 border-slate-200 text-slate-700">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 flex-shrink-0 mt-0.5">DRY-RUN</span>
              <div className="flex-1 space-y-1">
                <p className="font-medium">プレビュー確認 — 以下の内容で作成されます</p>
                <p><span className="text-slate-400">件名:</span> {subject}</p>
                {dueDate && <p><span className="text-slate-400">期日:</span> {dueDate}</p>}
                <p><span className="text-slate-400">優先度:</span> {priority}</p>
                <p><span className="text-slate-400">SF Account:</span> <code className="text-[10px] font-mono">{apiResult.resolved.sfAccountId}</code>
                  {sfAccountIdSource === 'fallback' && (
                    <span className="ml-1 text-amber-600">⚠ sf_account_id 未設定</span>
                  )}
                </p>
                {apiResult.resolved.ownerId && (
                  <p><span className="text-slate-400">SF Owner ID:</span> <code className="text-[10px] font-mono">{apiResult.resolved.ownerId}</code></p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border bg-green-50 border-green-200 text-green-700">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-medium">SF ToDo を作成しました</span>
                <span className="ml-2 text-green-600 font-mono">{apiResult.sfTodoId}</span>
              </div>
            </div>
          )}
          {/* Owner 未解決 */}
          {ownerProvided && !ownerResolved && (
            <div className="px-3 py-1.5 rounded-lg text-[10px] border bg-amber-50 border-amber-200 text-amber-700">
              ⚠ 担当者メール「{sfOwner.trim()}」に対応する SF User が見つかりませんでした。Owner は省略されます。
              {!sfOwner.includes('@') && (
                <span className="block mt-0.5">ヒント: メールアドレス形式（user@example.com）で入力してください。</span>
              )}
            </div>
          )}
          {/* その他警告 */}
          {warnings.map((w, i) => (
            <div key={i} className="px-3 py-1.5 rounded-lg text-[10px] border bg-amber-50 border-amber-200 text-amber-600">
              {w}
            </div>
          ))}
        </div>
      );
    }

    if (apiResult.syncResult === 'adapter_not_connected') {
      return (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs border bg-slate-50 border-slate-200 text-slate-600">
          <Unplug className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
          <div className="space-y-1">
            <p className="font-medium text-slate-700">Salesforce adapter 未接続</p>
            <p className="text-slate-500">
              Salesforce Connected App の設定が完了していないため、SF ToDo は作成されませんでした。
            </p>
            <p className="text-[10px] text-slate-400">
              必要な環境変数: SALESFORCE_CLIENT_ID / SALESFORCE_CLIENT_SECRET
            </p>
            <p className="text-[10px] text-slate-400">
              ※ 接続後は同じダイアログから実際の SF Task が作成されます。
            </p>
          </div>
        </div>
      );
    }

    // sync_error
    if (apiResult.syncResult !== 'sync_error') return null;
    return (
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs border bg-red-50 border-red-200 text-red-700">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">SF 連動エラー</p>
          <p className="text-red-600">{apiResult.error}</p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-sky-500" />
            Salesforce ToDo 作成
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">{companyName}</span>
            {relatedSignalRef && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 truncate max-w-[200px]" title={relatedSignalRef}>
                  {relatedSignalRef}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
        <div className="px-0.5 py-1 space-y-3">

        {/* Sync 中 */}
        {syncing && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${SF_SYNC_STATUS_BADGE.pending_sync.className}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="font-medium">Salesforce に送信中...</span>
          </div>
        )}

        {/* 結果バナー */}
        {!syncing && <ResultBanner />}

        {/* フォーム（未送信 or エラー後 or 未接続後は再送信可能） */}
        {!syncing && (!apiResult || !apiResult.ok) && (
          <div className="space-y-4 py-1">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="sf-subject" className="text-xs">件名 <span className="text-red-500">*</span></Label>
              <Input
                id="sf-subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="例: フォローアップ提案 - 拡張ライセンス検討"
                className="text-sm"
                autoFocus={!apiResult}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="sf-desc" className="text-xs">説明</Label>
              <Textarea
                id="sf-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Salesforce ToDo の説明・背景"
                className="text-sm min-h-[72px] resize-none"
              />
            </div>

            {/* Priority + Due date + Owner */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">優先度</Label>
                <Select value={priority} onValueChange={v => setPriority(v as 'High' | 'Medium' | 'Low')}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sf-due" className="text-xs">期日</Label>
                <Input id="sf-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sf-owner" className="text-xs">SF担当者（メールアドレス）</Label>
                <Input id="sf-owner" value={sfOwner} onChange={e => setSfOwner(e.target.value)} placeholder="user@example.com" className="h-8 text-xs" />
                {sfOwner.trim() && !sfOwner.includes('@') && (
                  <p className="text-[10px] text-amber-600">⚠ メールアドレス形式で入力してください</p>
                )}
              </div>
            </div>

            {/* Signal link display */}
            {relatedSignalRef && (
              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-700">
                <span className="font-medium">起票元シグナル: </span>{relatedSignalRef}
              </div>
            )}

            {/* Action link display */}
            {relatedActionId && (
              <div className="bg-sky-50 border border-sky-200 rounded px-3 py-2 text-xs text-sky-700">
                <span className="font-medium">CXM Action から起票 </span>
                <span className="font-mono text-[10px] text-sky-500">{relatedActionId.slice(0, 8)}...</span>
                <p className="text-[10px] text-sky-500 mt-0.5">
                  成功時に Action の SF連動ステータスが更新されます。
                </p>
              </div>
            )}

            {/* CXM / SF relationship note */}
            <div className="bg-slate-50 rounded px-3 py-2 text-xs text-slate-500 space-y-0.5">
              <p className="font-medium text-slate-600">CXM Action と SF ToDo の関係</p>
              <p>SF ToDo は Salesforce 側に存在するタスク。CXM Action は CXM platform 内のタスク。</p>
              <p>SF ToDo 作成後、Action の連動ステータスが自動更新されます。</p>
            </div>
          </div>
        )}

        </div>
        </ScrollArea>

        {/* Footer */}
        {!syncing && (
          <DialogFooter className="flex-col gap-2 sm:flex-row flex-shrink-0 border-t pt-3 mt-1">
            {/* 本実行完了後 */}
            {apiResult?.ok && apiResult.mode === 'created' && (
              <Button variant="outline" onClick={() => handleOpenChange(false)}>閉じる</Button>
            )}

            {/* dry-run 成功 → 本実行確認ステップ */}
            {confirming && apiResult?.ok && apiResult.mode === 'dry_run' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setConfirming(false); setApiResult(null); }}
                >
                  戻って修正
                </Button>
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={syncing}
                  className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {syncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  確認して作成
                </Button>
              </>
            )}

            {/* 初期 / エラー / adapter未接続 */}
            {!confirming && !(apiResult?.ok && apiResult.mode === 'created') && (
              <>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>キャンセル</Button>
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={!subject.trim() || syncing}
                  className="gap-1.5"
                >
                  {syncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {apiResult && !confirming ? '再プレビュー' : 'プレビュー確認'}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
