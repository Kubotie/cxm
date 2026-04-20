"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button }     from "@/components/ui/button";
import { Input }      from "@/components/ui/input";
import { Textarea }   from "@/components/ui/textarea";
import { Badge }      from "@/components/ui/badge";
import { Label }      from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Zap, Sparkles, User, Users } from "lucide-react";
import {
  createLocalAction,
  type LocalAction,
  type ActionSourceType,
  type ActionCreatedFrom,
} from "@/lib/company/action-vm";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ActionCreateDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  companyUid:    string;
  companyName:   string;
  prefillTitle?: string;
  prefillBody?:  string;
  /** Dialog icon / context label 用（display only） */
  sourceType?:   ActionSourceType;
  sourceRef?:    string;
  /** LocalAction.createdFrom に格納する分類（未指定時は sourceType から推定） */
  createdFrom?:  ActionCreatedFrom;
  /** Org Chart 起票時の person 名 */
  personRef?:    string;
  onCreated?:    (action: LocalAction) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<ActionSourceType, React.ReactNode> = {
  header:  <User    className="w-3.5 h-3.5 text-slate-500" />,
  signal:  <Zap     className="w-3.5 h-3.5 text-amber-500" />,
  summary: <Sparkles className="w-3.5 h-3.5 text-violet-500" />,
  people:  <Users   className="w-3.5 h-3.5 text-sky-500" />,
};

const SOURCE_LABEL: Record<ActionSourceType, string> = {
  header:  'Company 起票',
  signal:  'シグナル起票',
  summary: 'AI Summary 起票',
  people:  'People 起票',
};

/** ActionCreatedFrom → ActionSourceType（display 用） */
function resolveSourceType(
  createdFrom: ActionCreatedFrom | undefined,
  sourceType:  ActionSourceType  | undefined,
): ActionSourceType {
  if (sourceType) return sourceType;
  if (!createdFrom) return 'header';
  if (createdFrom === 'people_risk')        return 'people';
  if (createdFrom === 'risk_signal')        return 'signal';
  if (createdFrom === 'opportunity_signal') return 'signal';
  if (createdFrom === 'support_case')       return 'signal';
  return 'header';
}

export function ActionCreateDialog({
  open,
  onOpenChange,
  companyUid,
  companyName,
  prefillTitle  = '',
  prefillBody   = '',
  sourceType,
  sourceRef,
  createdFrom,
  personRef,
  onCreated,
}: ActionCreateDialogProps) {
  const [title,   setTitle]   = useState(prefillTitle);
  const [body,    setBody]    = useState(prefillBody);
  const [owner,   setOwner]   = useState('');
  const [dueDate, setDueDate] = useState('');
  const [done,    setDone]    = useState(false);

  // prefill が変わったとき（ダイアログが新しい起票源で再利用される場合）に同期
  useEffect(() => {
    if (open) {
      setTitle(prefillTitle);
      setBody(prefillBody);
    }
  }, [open, prefillTitle, prefillBody]);

  const displaySourceType = resolveSourceType(createdFrom, sourceType);
  const resolvedCreatedFrom: ActionCreatedFrom = createdFrom ?? 'manual';

  function reset() {
    setTitle(prefillTitle);
    setBody(prefillBody);
    setOwner('');
    setDueDate('');
    setDone(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleSubmit() {
    if (!title.trim()) return;
    const action = createLocalAction({
      companyUid,
      title:        title.trim(),
      body:         body.trim(),
      owner:        owner.trim(),
      dueDate:      dueDate || null,
      createdFrom:  resolvedCreatedFrom,
      sourceRef:    sourceRef ?? null,
      personRef:    personRef ?? null,
      sfTodoStatus: null,
      sfTodoId:     null,
    });
    onCreated?.(action);
    setDone(true);
    setTimeout(() => handleOpenChange(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {SOURCE_ICON[displaySourceType]}
            Action 作成
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="text-slate-500">{companyName}</span>
            <span className="text-slate-300">·</span>
            <Badge variant="outline" className="text-[10px] py-0">
              {SOURCE_LABEL[displaySourceType]}
            </Badge>
            {personRef && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sky-600 font-medium truncate max-w-[140px]" title={personRef}>
                  {personRef}
                </span>
              </>
            )}
            {sourceRef && !personRef && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 truncate max-w-[160px]" title={sourceRef}>{sourceRef}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center py-8 gap-3 text-green-600">
            <CheckCircle2 className="w-10 h-10" />
            <p className="text-sm font-medium">Action を作成しました</p>
            <p className="text-xs text-slate-400">※ 現在はローカル状態のみ（DB保存は将来実装）</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 py-2 px-0.5">
                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="action-title" className="text-xs">タイトル <span className="text-red-500">*</span></Label>
                  <Input
                    id="action-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="例: フォローアップMTGのアレンジ"
                    className="text-sm"
                    autoFocus
                  />
                </div>

                {/* Body */}
                <div className="space-y-1.5">
                  <Label htmlFor="action-body" className="text-xs">詳細・メモ</Label>
                  <Textarea
                    id="action-body"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="対応内容の詳細や背景を入力してください"
                    className="text-sm min-h-[80px] resize-none"
                  />
                </div>

                {/* Owner + Due date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="action-owner" className="text-xs">担当者</Label>
                    <Input
                      id="action-owner"
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                      placeholder="担当者名"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="action-due" className="text-xs">期日</Label>
                    <Input
                      id="action-due"
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* TODO placeholder note */}
                <p className="text-[10px] text-slate-400 bg-slate-50 rounded px-2 py-1">
                  TODO: POST /api/company/[companyUid]/actions — NocoDB actions テーブル実装後に保存
                </p>
              </div>
            </ScrollArea>

            <DialogFooter className="flex-shrink-0 border-t pt-3 mt-1">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>キャンセル</Button>
              <Button onClick={handleSubmit} disabled={!title.trim()}>
                Action を作成
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
