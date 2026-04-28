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
import { CheckCircle2, Zap, Sparkles, User, Users, X } from "lucide-react";
import {
  createLocalAction,
  type LocalAction,
  type ActionSourceType,
  type ActionCreatedFrom,
} from "@/lib/company/action-vm";

// ── 選択肢定義 ────────────────────────────────────────────────────────────────

const POC_OPTIONS = [
  { value: '',                       label: '--なし--' },
  { value: '経営層・役員（決裁者）',     label: '経営層・役員（決裁者）' },
  { value: '本部長・部長（承認者）',     label: '本部長・部長（承認者）' },
  { value: '課長・マネージャー（推進責任者）', label: '課長・マネージャー（推進責任者）' },
  { value: 'リーダー・メンバー（実務担当者）', label: 'リーダー・メンバー（実務担当者）' },
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: '',         label: '--なし--' },
  { value: 'Call',     label: 'Call（電話）' },
  { value: 'Email',    label: 'Email（メール）' },
  { value: 'Meeting',  label: 'Meeting（会議・面談）' },
  { value: 'Event',    label: 'Event（イベント）' },
  { value: 'Trainning', label: 'Trainning（研修）' },
  { value: 'Intercom', label: 'Intercom' },
  { value: 'Chat',     label: 'Chat（Chatwork/Slack等）' },
  { value: 'Other',    label: 'Other（その他）' },
];

const RESULT_OPTIONS = [
  { value: '',  label: '--なし--' },
  { value: 'S', label: 'S: 受注/合意（次のステップへ）' },
  { value: 'A', label: 'A: 前向き・好感触（キーマン承諾）' },
  { value: 'B', label: 'B: 継続検討・現状維持（宿題あり）' },
  { value: 'C', label: 'C: 懸念・リスクあり（要フォロー）' },
  { value: 'D', label: 'D: 失注・解約懸念（アラート）' },
];

const EVENT_FORMAT_OPTIONS = [
  { value: '',   label: '--なし--' },
  { value: 'Web', label: 'Web（オンライン）' },
  { value: '訪問', label: '訪問（対面）' },
];

const ACTION_PURPOSE_OPTIONS = [
  { value: '',                label: '--なし--' },
  { value: 'エクスパンド提案',          label: 'エクスパンド提案' },
  { value: 'アップセル提案',            label: 'アップセル提案' },
  { value: 'ヒアリング',               label: 'ヒアリング' },
  { value: '高度活用提案',             label: '高度活用提案' },
  { value: '契約更新・リニューアル（契約手続き・交渉）', label: '契約更新・リニューアル' },
  { value: 'オンボーディング支援（初期設定・KICKOFF・操作説明・振り返り会）', label: 'オンボーディング支援' },
  { value: '活用定着・勉強会（Q&A・カスタムフォロー）', label: '活用定着・勉強会' },
  { value: '事例・インタビュー',         label: '事例・インタビュー' },
  { value: 'トラブル・クレーム対応',     label: 'トラブル・クレーム対応' },
  { value: 'セミナー/イベント参加',      label: 'セミナー/イベント参加' },
  { value: '会食',                    label: '会食' },
  { value: '昼食',                    label: '昼食' },
  { value: 'その他（ゴルフなど）',       label: 'その他（ゴルフなど）' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ActionCreateDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  companyUid?:   string;   // 省略時は企業ピッカーを表示
  companyName?:  string;   // 省略時は企業ピッカーで入力
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

function SelectField({
  label, value, onChange, options, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
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
  const [title,         setTitle]         = useState(prefillTitle);
  const [body,          setBody]          = useState(prefillBody);
  const [owner,         setOwner]         = useState('');
  const [ownerName,     setOwnerName]     = useState('');
  const [ownerSfId,     setOwnerSfId]     = useState<string | null>(null);
  const [dueDate,       setDueDate]       = useState('');
  const [poc,           setPoc]           = useState('');
  const [activityType,  setActivityType]  = useState('');
  const [result,        setResult]        = useState('');
  const [eventFormat,   setEventFormat]   = useState('');
  const [actionPurpose, setActionPurpose] = useState('');
  const [done,          setDone]          = useState(false);

  // 企業ピッカー（companyUid が渡されていない場合のみ使用）
  const needCompanyPicker = !companyUid;
  const [companyList,      setCompanyList]      = useState<{ uid: string; name: string }[]>([]);
  const [companySearch,    setCompanySearch]    = useState('');
  const [pickedCompanyUid, setPickedCompanyUid] = useState('');
  const [pickedCompanyName,setPickedCompanyName]= useState('');

  // 複数選択モード（companyUid が渡されていない場合のみ有効）
  const [multiMode,        setMultiMode]        = useState(false);
  const [pickedCompanies,  setPickedCompanies]  = useState<{ uid: string; name: string }[]>([]);
  const [bulkDone,         setBulkDone]         = useState(false);
  const [bulkCount,        setBulkCount]        = useState(0);

  const effectiveUid  = companyUid  ?? pickedCompanyUid;
  const effectiveName = companyName ?? pickedCompanyName;

  const filteredCompanies = needCompanyPicker && companySearch && (multiMode ? true : !pickedCompanyUid)
    ? companyList
        .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
        .filter(c => multiMode ? !pickedCompanies.some(p => p.uid === c.uid) : true)
        .slice(0, 8)
    : [];

  // ログイン中ユーザーを自動セット
  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.ok ? r.json() : null)
      .then((p: { name2?: string; name?: string; sf_account_id?: string | null } | null) => {
        if (p) {
          setOwner(p.name2 ?? '');
          setOwnerName(p.name ?? p.name2 ?? '');
          setOwnerSfId(p.sf_account_id ?? null);
        }
      })
      .catch(() => {});
  }, []);

  // 企業一覧をロード（ピッカーが必要な場合のみ、初回 open 時）
  useEffect(() => {
    if (!needCompanyPicker || !open || companyList.length > 0) return;
    fetch('/api/nocodb/companies?limit=300')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => {
        if (Array.isArray(data)) {
          setCompanyList(data.map(c => ({ uid: c.id, name: c.name })));
        }
      })
      .catch(() => {});
  }, [open, needCompanyPicker, companyList.length]);

  // ダイアログが新しい内容で再利用されるときに同期
  useEffect(() => {
    if (open) {
      setTitle(prefillTitle);
      setBody(prefillBody);
      setDone(false);
      if (needCompanyPicker) {
        setCompanySearch('');
        setPickedCompanyUid('');
        setPickedCompanyName('');
      }
    }
  }, [open, prefillTitle, prefillBody, needCompanyPicker]);

  const displaySourceType = resolveSourceType(createdFrom, sourceType);
  const resolvedCreatedFrom: ActionCreatedFrom = createdFrom ?? 'manual';

  function reset() {
    setTitle(prefillTitle);
    setBody(prefillBody);
    setDueDate('');
    setPoc('');
    setActivityType('');
    setResult('');
    setEventFormat('');
    setActionPurpose('');
    setDone(false);
    setBulkDone(false);
    setBulkCount(0);
    if (needCompanyPicker) {
      setCompanySearch('');
      setPickedCompanyUid('');
      setPickedCompanyName('');
      setMultiMode(false);
      setPickedCompanies([]);
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleSubmit() {
    if (!title.trim()) return;

    // 複数選択モード
    if (multiMode && needCompanyPicker) {
      if (pickedCompanies.length === 0) return;
        // 各企業へ個別にコールバック
      for (const co of pickedCompanies) {
        const action = createLocalAction({
          companyUid:         co.uid,
          companyName:        co.name,
          title:              title.trim(),
          body:               body.trim(),
          owner:              owner.trim(),
          ownerSfId,
          dueDate:            dueDate || null,
          createdFrom:        resolvedCreatedFrom,
          sourceRef:          sourceRef ?? null,
          personRef:          personRef ?? null,
          urgency:            'medium',
          recommendedChannel: null,
          sfTodoStatus:       null,
          sfTodoId:           null,
          poc:                poc           || null,
          activityType:       activityType  || null,
          result:             result        || null,
          eventFormat:        eventFormat   || null,
          actionPurpose:      actionPurpose || null,
        });
        onCreated?.(action);
      }
      setBulkCount(pickedCompanies.length);
      setBulkDone(true);
      setTimeout(() => handleOpenChange(false), 1800);
      return;
    }

    // 単一選択モード（従来動作）
    if (!effectiveUid) return;
    const action = createLocalAction({
      companyUid:         effectiveUid,
      companyName:        effectiveName || undefined,
      title:              title.trim(),
      body:               body.trim(),
      owner:              owner.trim(),
      ownerSfId,
      dueDate:            dueDate || null,
      createdFrom:        resolvedCreatedFrom,
      sourceRef:          sourceRef ?? null,
      personRef:          personRef ?? null,
      urgency:            'medium',
      recommendedChannel: null,
      sfTodoStatus:       null,
      sfTodoId:           null,
      poc:                poc           || null,
      activityType:       activityType  || null,
      result:             result        || null,
      eventFormat:        eventFormat   || null,
      actionPurpose:      actionPurpose || null,
    });
    onCreated?.(action);
    setDone(true);
    setTimeout(() => handleOpenChange(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {SOURCE_ICON[displaySourceType]}
            行動を記録
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs flex-wrap">
            {effectiveName && <span className="text-slate-500">{effectiveName}</span>}
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

        {(done || bulkDone) ? (
          <div className="flex flex-col items-center py-8 gap-3 text-green-600">
            <CheckCircle2 className="w-10 h-10" />
            <p className="text-sm font-medium">
              {bulkDone ? `${bulkCount}社に行動を記録しました` : '行動を記録しました'}
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 py-2 px-0.5">

                {/* 企業選択（companyUid が渡されていない場合のみ） */}
                {needCompanyPicker && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">
                        企業 <span className="text-red-500">*</span>
                      </Label>
                      {/* 複数選択トグル */}
                      <button
                        type="button"
                        onClick={() => {
                          setMultiMode(m => !m);
                          setPickedCompanies([]);
                          setPickedCompanyUid('');
                          setPickedCompanyName('');
                          setCompanySearch('');
                        }}
                        className={[
                          'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                          multiMode
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'text-slate-500 border-slate-300 hover:border-slate-500',
                        ].join(' ')}
                      >
                        {multiMode ? '複数選択中' : '複数選択'}
                      </button>
                    </div>

                    {/* 複数選択: 選択済みチップ表示 */}
                    {multiMode && pickedCompanies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-md bg-slate-50 min-h-[36px]">
                        {pickedCompanies.map(c => (
                          <span
                            key={c.uid}
                            className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700"
                          >
                            {c.name}
                            <button
                              type="button"
                              onClick={() => setPickedCompanies(prev => prev.filter(p => p.uid !== c.uid))}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 検索入力 */}
                    <div className="relative">
                      <Input
                        value={multiMode ? companySearch : (pickedCompanyUid ? pickedCompanyName : companySearch)}
                        onChange={e => {
                          setCompanySearch(e.target.value);
                          if (!multiMode) {
                            setPickedCompanyUid('');
                            setPickedCompanyName('');
                          }
                        }}
                        placeholder={multiMode ? `会社名で追加（${pickedCompanies.length}社選択中）` : '会社名で検索...'}
                        className="text-sm"
                        autoComplete="off"
                      />
                      {filteredCompanies.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-md shadow-md max-h-48 overflow-auto">
                          {filteredCompanies.map(c => (
                            <button
                              key={c.uid}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                              onClick={() => {
                                if (multiMode) {
                                  if (pickedCompanies.length < 20) {
                                    setPickedCompanies(prev => [...prev, c]);
                                  }
                                  setCompanySearch('');
                                } else {
                                  setPickedCompanyUid(c.uid);
                                  setPickedCompanyName(c.name);
                                  setCompanySearch('');
                                }
                              }}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="action-title" className="text-xs">
                    件名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="action-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="例: フォローアップMTGのアレンジ"
                    className="text-sm"
                    autoFocus
                  />
                </div>

                {/* Owner + Due date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">割り当て先</Label>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-600 min-h-[36px]">
                      {ownerName || owner || (
                        <span className="text-slate-400 text-xs">ユーザー未選択</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="action-due" className="text-xs">日付</Label>
                    <Input
                      id="action-due"
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* 行動目的・内容 (full width) */}
                <SelectField
                  label="行動目的・内容"
                  value={actionPurpose}
                  onChange={setActionPurpose}
                  options={ACTION_PURPOSE_OPTIONS}
                />

                {/* 形式 + 活動形式 */}
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="形式"
                    value={activityType}
                    onChange={setActivityType}
                    options={ACTIVITY_TYPE_OPTIONS}
                  />
                  <SelectField
                    label="活動形式"
                    value={eventFormat}
                    onChange={setEventFormat}
                    options={EVENT_FORMAT_OPTIONS}
                  />
                </div>

                {/* 結果 + 接点者 */}
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="結果"
                    value={result}
                    onChange={setResult}
                    options={RESULT_OPTIONS}
                  />
                  <SelectField
                    label="接点者"
                    value={poc}
                    onChange={setPoc}
                    options={POC_OPTIONS}
                  />
                </div>

                {/* 説明・メモ */}
                <div className="space-y-1.5">
                  <Label htmlFor="action-body" className="text-xs">説明・メモ</Label>
                  <Textarea
                    id="action-body"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="対応内容の詳細や背景を入力してください"
                    className="text-sm min-h-[70px] resize-none"
                  />
                </div>

              </div>
            </ScrollArea>

            <DialogFooter className="flex-shrink-0 border-t pt-3 mt-1">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>キャンセル</Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !title.trim() ||
                  (multiMode ? pickedCompanies.length === 0 : !effectiveUid)
                }
              >
                {multiMode && pickedCompanies.length > 0
                  ? `${pickedCompanies.length}社に記録する`
                  : '記録する'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
