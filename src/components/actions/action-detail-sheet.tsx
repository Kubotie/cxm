"use client";

// ─── アクション詳細・編集シート ────────────────────────────────────────────────
// ActionListItem をクリックしたとき右から開くサイドパネル。
// CXM アクション（_source=cxm/both）: タイトル・期日・ステータス・メモ等を編集可能。
// SF-only（_source=sf）: 閲覧のみ（編集不可）。

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";
import {
  Building2, ExternalLink, Check, RotateCcw, Loader2, Calendar as CalendarIcon,
} from "lucide-react";
import type { ActionListItem } from "@/app/api/actions/route";
import {
  ACTION_STATUS_BADGE,
  ACTION_CREATED_FROM_LABEL,
  RESULT_BADGE,
  POC_SHORT,
} from "@/lib/company/action-vm";

// ── 選択肢定義（ActionCreateDialog と同じ） ─────────────────────────────────

const POC_OPTIONS = [
  { value: '',                               label: '--なし--' },
  { value: '経営層・役員（決裁者）',              label: '経営層・役員（決裁者）' },
  { value: '本部長・部長（承認者）',              label: '本部長・部長（承認者）' },
  { value: '課長・マネージャー（推進責任者）',       label: '課長・マネージャー（推進責任者）' },
  { value: 'リーダー・メンバー（実務担当者）',       label: 'リーダー・メンバー（実務担当者）' },
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: '',          label: '--なし--' },
  { value: 'Call',      label: 'Call（電話）' },
  { value: 'Email',     label: 'Email（メール）' },
  { value: 'Meeting',   label: 'Meeting（会議・面談）' },
  { value: 'Event',     label: 'Event（イベント）' },
  { value: 'Trainning', label: 'Trainning（研修）' },
  { value: 'Intercom',  label: 'Intercom' },
  { value: 'Chat',      label: 'Chat（Chatwork/Slack等）' },
  { value: 'Other',     label: 'Other（その他）' },
];

const RESULT_OPTIONS = [
  { value: '', label: '--なし--' },
  { value: 'S', label: 'S: 受注/合意' },
  { value: 'A', label: 'A: 前向き・好感触' },
  { value: 'B', label: 'B: 継続検討・現状維持' },
  { value: 'C', label: 'C: 懸念・リスクあり' },
  { value: 'D', label: 'D: 失注・解約懸念' },
];

const EVENT_FORMAT_OPTIONS = [
  { value: '',    label: '--なし--' },
  { value: 'Web', label: 'Web（オンライン）' },
  { value: '訪問', label: '訪問（対面）' },
];

const ACTION_PURPOSE_OPTIONS = [
  { value: '',                                                              label: '--なし--' },
  { value: 'エクスパンド提案',                                                  label: 'エクスパンド提案' },
  { value: 'アップセル提案',                                                    label: 'アップセル提案' },
  { value: 'ヒアリング',                                                       label: 'ヒアリング' },
  { value: '高度活用提案',                                                     label: '高度活用提案' },
  { value: '契約更新・リニューアル（契約手続き・交渉）',                                  label: '契約更新・リニューアル' },
  { value: 'オンボーディング支援（初期設定・KICKOFF・操作説明・振り返り会）',                  label: 'オンボーディング支援' },
  { value: '活用定着・勉強会（Q&A・カスタムフォロー）',                                  label: '活用定着・勉強会' },
  { value: '事例・インタビュー',                                                  label: '事例・インタビュー' },
  { value: 'トラブル・クレーム対応',                                               label: 'トラブル・クレーム対応' },
  { value: 'セミナー/イベント参加',                                               label: 'セミナー/イベント参加' },
  { value: '会食',                                                           label: '会食' },
  { value: '昼食',                                                           label: '昼食' },
  { value: 'その他（ゴルフなど）',                                                label: 'その他（ゴルフなど）' },
];

function SelectField({
  label, value, onChange, options, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ActionDetailSheetProps {
  action:        ActionListItem | null;
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  onUpdated:     (updated: Partial<ActionListItem> & { id: string }) => void;
  onDone:        (action: ActionListItem) => void;
  onReopen:      (action: ActionListItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ActionDetailSheet({
  action, open, onOpenChange, onUpdated, onDone, onReopen,
}: ActionDetailSheetProps) {
  const [title,         setTitle]         = useState('');
  const [body,          setBody]          = useState('');
  const [dueDate,       setDueDate]       = useState('');
  const [poc,           setPoc]           = useState('');
  const [activityType,  setActivityType]  = useState('');
  const [result,        setResult]        = useState('');
  const [eventFormat,   setEventFormat]   = useState('');
  const [actionPurpose, setActionPurpose] = useState('');
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  const isReadOnly = action?._source === 'sf';

  // action が変わったらフォームを同期
  useEffect(() => {
    if (!action) return;
    setTitle(action.title ?? '');
    setBody(action.body ?? '');
    setDueDate(action.dueDate ?? '');
    setPoc(action.poc ?? '');
    setActivityType(action.activityType ?? '');
    setResult(action.result ?? '');
    setEventFormat(action.eventFormat ?? '');
    setActionPurpose(action.actionPurpose ?? '');
    setSaved(false);
  }, [action?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!action || isReadOnly || !action.companyUid || !action.rowId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/company/${action.companyUid}/actions/${action.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowId:          action.rowId,
            title:          title.trim(),
            description:    body.trim(),
            due_date:       dueDate || null,
            poc:            poc || null,
            activity_type:  activityType || null,
            result:         result || null,
            event_format:   eventFormat || null,
            action_purpose: actionPurpose || null,
          }),
        },
      );
      if (res.ok) {
        onUpdated({
          id:            action.id,
          title:         title.trim(),
          body:          body.trim(),
          dueDate:       dueDate || null,
          poc:           poc || null,
          activityType:  activityType || null,
          result:        result || null,
          eventFormat:   eventFormat || null,
          actionPurpose: actionPurpose || null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!action) return null;

  const statusBadge  = ACTION_STATUS_BADGE[action.status];
  const contextLabel = ACTION_CREATED_FROM_LABEL[action.createdFrom];
  const isDone       = action.status === 'done' || action.status === 'cancelled';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto p-0">
        {/* ヘッダー */}
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
            {action._source === 'sf' && (
              <Badge variant="outline" className="text-[10px] py-0 text-blue-600 border-blue-200">
                SF行動
              </Badge>
            )}
            {action.result && RESULT_BADGE[action.result] && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${RESULT_BADGE[action.result].cls}`}>
                {action.result}
              </span>
            )}
          </div>
          <SheetTitle className="text-base leading-snug mt-1">
            {isReadOnly ? action.title : title || '（タイトルなし）'}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              {action.companyUid && (
                <Link
                  href={`/companies/${action.companyUid}`}
                  className="flex items-center gap-1 hover:text-slate-800 transition-colors"
                  onClick={() => onOpenChange(false)}
                >
                  <Building2 className="w-3 h-3" />
                  {action.companyName || action.companyUid}
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              )}
              <span className="text-slate-300">·</span>
              <span>{contextLabel}</span>
              {action.owner && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{action.owner}</span>
                </>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        {/* フォーム */}
        <div className="px-5 py-4 space-y-4">

          {/* 件名 */}
          {!isReadOnly && (
            <div className="space-y-1.5">
              <Label className="text-xs">件名</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          {/* 期日 */}
          <div className="space-y-1.5">
            <Label className="text-xs">日付</Label>
            {isReadOnly ? (
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                {action.dueDate ?? '未設定'}
              </div>
            ) : (
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="text-sm"
              />
            )}
          </div>

          {/* 行動目的 */}
          <SelectField
            label="行動目的・内容"
            value={actionPurpose}
            onChange={setActionPurpose}
            options={ACTION_PURPOSE_OPTIONS}
            disabled={isReadOnly}
          />

          {/* 形式 + 活動形式 */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="形式"
              value={activityType}
              onChange={setActivityType}
              options={ACTIVITY_TYPE_OPTIONS}
              disabled={isReadOnly}
            />
            <SelectField
              label="活動形式"
              value={eventFormat}
              onChange={setEventFormat}
              options={EVENT_FORMAT_OPTIONS}
              disabled={isReadOnly}
            />
          </div>

          {/* 結果 + 接点者 */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="結果"
              value={result}
              onChange={setResult}
              options={RESULT_OPTIONS}
              disabled={isReadOnly}
            />
            <SelectField
              label="接点者"
              value={poc}
              onChange={setPoc}
              options={POC_OPTIONS}
              disabled={isReadOnly}
            />
          </div>

          {/* メモ */}
          <div className="space-y-1.5">
            <Label className="text-xs">説明・メモ</Label>
            {isReadOnly ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap min-h-[60px] p-2 bg-slate-50 rounded-md border border-slate-100">
                {action.body || <span className="text-slate-400">なし</span>}
              </p>
            ) : (
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className="text-sm min-h-[80px] resize-none"
                placeholder="対応内容の詳細や背景"
              />
            )}
          </div>

          {/* メタ情報 */}
          <div className="text-[10px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-100">
            <div>起票: {new Date(action.createdAt).toLocaleDateString('ja-JP')}</div>
            {action.sfTodoId && (
              <div className="flex items-center gap-1">
                <span>SF Task ID:</span>
                <span className="font-mono">{action.sfTodoId}</span>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="border-t px-5 py-4 flex items-center gap-2 flex-wrap bg-white sticky bottom-0">
          {!isDone ? (
            <Button
              size="sm"
              variant="outline"
              className="text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => { onDone(action); onOpenChange(false); }}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              実施済みにする
            </Button>
          ) : !isReadOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onReopen(action); onOpenChange(false); }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              再開する
            </Button>
          )}

          {!isReadOnly && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="ml-auto"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : saved ? (
                <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
              ) : null}
              {saved ? '保存しました' : '保存'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
