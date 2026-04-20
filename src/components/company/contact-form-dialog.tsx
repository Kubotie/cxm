"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, UserPlus, UserCog, Loader2, AlertTriangle, Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppPerson } from "@/lib/nocodb/types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ContactFormDialogProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  companyUid:   string;
  companyName:  string;
  /** 編集モード: 既存 person を渡すと編集、undefined で新規追加 */
  person?:      AppPerson;
  /**
   * 同一企業の全連絡先リスト（reports_to / works_with 選択用）。
   * 未指定時は関係性選択フォームを非表示にする。
   */
  persons?:     AppPerson[];
  /**
   * 保存完了後に呼ばれる。
   * API が成功した場合は rowId が含まれた person が渡される。
   * NOCODB_COMPANY_PEOPLE_TABLE_ID 未設定など API 失敗時も optimistic な person が渡される
   * （NOTE: その場合は rowId が undefined のため永続化されていない）。
   */
  onSaved?:     (person: AppPerson) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactFormDialog({
  open,
  onOpenChange,
  companyUid,
  companyName,
  person,
  persons,
  onSaved,
}: ContactFormDialogProps) {
  const isEdit = !!person;

  const [name,              setName]              = useState(person?.name              ?? '');
  const [role,              setRole]              = useState(person?.role              ?? '');
  const [title,             setTitle]             = useState(person?.title             ?? '');
  const [department,        setDepartment]        = useState(person?.department        ?? '');
  const [email,             setEmail]             = useState(person?.email             ?? '');
  const [phone,             setPhone]             = useState(person?.phone             ?? '');
  const [decisionInfluence, setDecisionInfluence] = useState<AppPerson['decisionInfluence']>(
    person?.decisionInfluence ?? 'unknown',
  );
  const [contactStatus, setContactStatus] = useState<AppPerson['contactStatus']>(
    person?.contactStatus ?? 'not contacted',
  );
  const [layerRole,      setLayerRole]      = useState<string>(person?.layerRole      ?? '');
  const [displayGroup,   setDisplayGroup]   = useState(person?.displayGroup   ?? '');
  const [stakeholderNote,setStakeholderNote]= useState(person?.stakeholderNote ?? '');
  const [reportsToPersonId,  setReportsToPersonId]  = useState<string>(person?.reportsToPersonId ?? '');
  const [worksWithPersonIds, setWorksWithPersonIds] = useState<string[]>(
    Array.isArray(person?.worksWithPersonIds) ? person.worksWithPersonIds : [],
  );
  const [saving,              setSaving]              = useState(false);
  const [done,                setDone]                = useState(false);
  const [apiErr,              setApiErr]              = useState<string | null>(null);
  /** 保存後に表示する relation 変更サマリー */
  const [savedRelationSummary, setSavedRelationSummary] = useState<string[]>([]);
  const [sfPushState, setSfPushState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sfPushError, setSfPushError] = useState('');

  // person が変わったとき（再利用される場合）に同期
  useEffect(() => {
    if (open) {
      setName(person?.name              ?? '');
      setRole(person?.role              ?? '');
      setTitle(person?.title            ?? '');
      setDepartment(person?.department  ?? '');
      setEmail(person?.email            ?? '');
      setPhone(person?.phone            ?? '');
      setDecisionInfluence(person?.decisionInfluence ?? 'unknown');
      setContactStatus(person?.contactStatus ?? 'not contacted');
      setLayerRole(person?.layerRole      ?? '');
      setDisplayGroup(person?.displayGroup   ?? '');
      setStakeholderNote(person?.stakeholderNote ?? '');
      setReportsToPersonId(person?.reportsToPersonId ?? '');
      setWorksWithPersonIds(
        Array.isArray(person?.worksWithPersonIds) ? person.worksWithPersonIds : [],
      );
      setDone(false);
      setApiErr(null);
      setSavedRelationSummary([]);
      setSfPushState('idle');
      setSfPushError('');
    }
  }, [open, person]);

  function reset() {
    setName(''); setRole(''); setTitle(''); setDepartment('');
    setEmail(''); setPhone('');
    setDecisionInfluence('unknown');
    setContactStatus('not contacted');
    setLayerRole(''); setDisplayGroup(''); setStakeholderNote('');
    setReportsToPersonId(''); setWorksWithPersonIds([]);
    setDone(false); setApiErr(null); setSavedRelationSummary([]);
    setSfPushState('idle'); setSfPushError('');
  }

  async function handleSfPush() {
    if (!person?.sfId || sfPushState === 'loading') return;
    setSfPushState('loading');
    setSfPushError('');
    try {
      const res = await fetch(
        `/api/company/${companyUid}/people/${person.id}/sf-push`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sfContactId: person.sfId,
            Title:       title.trim()      || undefined,
            Department:  department.trim() || undefined,
            Email:       email.trim()      || undefined,
            Phone:       phone.trim()      || undefined,
          }),
        },
      );
      if (res.ok) {
        setSfPushState('success');
        setTimeout(() => setSfPushState('idle'), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSfPushError(data.error ?? 'SF push 失敗');
        setSfPushState('error');
      }
    } catch {
      setSfPushError('ネットワークエラー');
      setSfPushState('error');
    }
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true); setApiErr(null);

    // Optimistic person — edit 時は既存 person を spread してフォーム変更分だけ上書き。
    // ⚠️ 新規作成 / 編集で分岐する理由:
    //   NocoDB PATCH は更新フィールドのみ返す（フルレコードではない）。
    //   二重 onSaved で partial API レスポンスを上書きすると name 等が消えるため、
    //   edit 時は existing person の全フィールドをベースにする。
    const optimistic: AppPerson = isEdit && person
      ? {
          // 既存の全フィールドを保持（ここに含まれないフィールドが上書き消失するのを防ぐ）
          ...person,
          // フォームで変更された項目のみ上書き
          name:              name.trim(),
          role:              role.trim(),
          title:             title.trim()      || undefined,
          department:        department.trim() || undefined,
          email:             email.trim()      || undefined,
          phone:             phone.trim()      || undefined,
          decisionInfluence,
          contactStatus,
          layerRole:            layerRole         || null,
          displayGroup:         displayGroup.trim()    || null,
          stakeholderNote:      stakeholderNote.trim() || null,
          reportsToPersonId:    reportsToPersonId  || null,
          worksWithPersonIds:   worksWithPersonIds,
        }
      : {
          // 新規作成: person がないのでゼロから構築
          id:                crypto.randomUUID(),
          rowId:             undefined,
          company:           companyUid,
          name:              name.trim(),
          role:              role.trim(),
          title:             title.trim()      || undefined,
          department:        department.trim() || undefined,
          email:             email.trim()      || undefined,
          phone:             phone.trim()      || undefined,
          roleType:          '',
          decisionInfluence,
          contactStatus,
          layerRole:         layerRole         || null,
          displayGroup:         displayGroup.trim()    || undefined,
          stakeholderNote:      stakeholderNote.trim() || undefined,
          reportsToPersonId:    reportsToPersonId  || null,
          worksWithPersonIds:   worksWithPersonIds,
          status:            'proposed',
          evidenceCount:     0,
          lastTouchpoint:    null,
          linkedProjects:    [],
          owner:             undefined,
          source:            'cxm',
          sfId:              null,
          syncStatus:        null,
          sfLastSyncedAt:    null,
          managerId:         null,
        };

    // 保存後サマリー（関係性の変化を CSM に分かりやすく伝える）
    const summary: string[] = [];
    if (reportsToPersonId) {
      const parent = persons?.find(p => p.id === reportsToPersonId);
      if (parent) summary.push(`上長: ${parent.name} に設定`);
    } else if (isEdit && person?.reportsToPersonId && !reportsToPersonId) {
      summary.push('上長: 解除');
    }
    if (worksWithPersonIds.length > 0) {
      summary.push(`横断協働: ${worksWithPersonIds.length}名`);
    } else if (isEdit && Array.isArray(person?.worksWithPersonIds) && person.worksWithPersonIds.length > 0 && worksWithPersonIds.length === 0) {
      summary.push('横断協働: 解除');
    }
    setSavedRelationSummary(summary);

    // onSaved を先に呼んで optimistic に UI へ反映
    onSaved?.(optimistic);
    setDone(true);

    // ── API 永続化 ────────────────────────────────────────────────────────────
    try {
      if (isEdit && person?.rowId) {
        // PATCH — rowId が取れている場合のみ永続化
        //
        // ⚠️ 注意: 変更されたフィールドのみ送信すること。
        // 全フィールドを送ると「未入力 → undefined → null」変換により
        // NocoDB の既存値が null で上書きされる不具合が発生する。
        // （例: title を変更せずに保存 → title が null で上書き）
        const patch: Record<string, unknown> = { rowId: person.rowId };

        // 必須フィールド（常に送信）
        if (optimistic.name !== (person.name ?? ''))
          patch.name = optimistic.name;
        if (optimistic.role !== (person.role ?? ''))
          patch.role = optimistic.role;

        // 任意フィールド（変更時のみ送信）
        // 空文字列クリア = null 送信（意図的な削除）、未変更 = 送信しない
        const titleVal       = optimistic.title       ?? null;
        const departmentVal  = optimistic.department  ?? null;
        const emailVal       = optimistic.email       ?? null;
        const phoneVal       = optimistic.phone       ?? null;
        if (titleVal      !== (person.title      ?? null)) patch.title      = titleVal;
        if (departmentVal !== (person.department ?? null)) patch.department = departmentVal;
        if (emailVal      !== (person.email      ?? null)) patch.email      = emailVal;
        if (phoneVal      !== (person.phone      ?? null)) patch.phone      = phoneVal;

        // Select フィールド（変更時のみ送信）
        if (optimistic.decisionInfluence !== person.decisionInfluence)
          patch.decision_influence = optimistic.decisionInfluence;
        if (optimistic.contactStatus !== person.contactStatus)
          patch.contact_status = optimistic.contactStatus;

        // Org chart 拡張フィールド（変更時のみ送信）
        const layerRoleVal      = optimistic.layerRole      ?? null;
        const displayGroupVal   = optimistic.displayGroup   ?? null;
        const stakeholderNoteVal= optimistic.stakeholderNote ?? null;
        if (layerRoleVal      !== (person.layerRole      ?? null)) patch.layer_role      = layerRoleVal;
        if (displayGroupVal   !== (person.displayGroup   ?? null)) patch.display_group   = displayGroupVal;
        if (stakeholderNoteVal!== (person.stakeholderNote ?? null)) patch.stakeholder_note = stakeholderNoteVal;

        // 関係性フィールド（変更時のみ送信）
        const reportsToVal = reportsToPersonId || null;
        if (reportsToVal !== (person.reportsToPersonId ?? null))
          patch.reports_to_person_id = reportsToVal;

        // works_with: JSON 文字列化して差分送信
        const worksWithVal  = worksWithPersonIds.length > 0 ? JSON.stringify(worksWithPersonIds) : null;
        const prevWorksWithVal = Array.isArray(person.worksWithPersonIds) && person.worksWithPersonIds.length > 0
          ? JSON.stringify([...person.worksWithPersonIds].sort())
          : null;
        const nextWorksWithSorted = worksWithPersonIds.length > 0
          ? JSON.stringify([...worksWithPersonIds].sort())
          : null;
        if (nextWorksWithSorted !== prevWorksWithVal)
          patch.works_with_person_ids = worksWithVal;

        const res = await fetch(
          `/api/company/${companyUid}/people/${person.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          },
        );
        if (res.ok) {
          // ⚠️ ここで onSaved(data.person) を再コールしない。
          // 理由: NocoDB PATCH は更新フィールドのみ返す。partial API レスポンスを
          //       localContacts に上書きすると name 等の未変更フィールドが消滅する。
          // optimistic（= existing person spread + form changes）が正確なので初回コールで十分。
        }
        // NOTE: PATCH 失敗時は optimistic のまま残る（rowId なしで PATCH 不可）
      } else if (!isEdit) {
        // POST — 新規作成
        const res = await fetch(
          `/api/company/${companyUid}/people`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              person_id:          optimistic.id,
              name:               optimistic.name,
              role:               optimistic.role,
              title:              optimistic.title ?? null,
              department:         optimistic.department ?? null,
              email:              optimistic.email ?? null,
              phone:              optimistic.phone ?? null,
              decision_influence: optimistic.decisionInfluence,
              contact_status:     optimistic.contactStatus,
              status:             optimistic.status,
              source:             'cxm',
              layer_role:             optimistic.layerRole      ?? null,
              display_group:          optimistic.displayGroup   ?? null,
              stakeholder_note:       optimistic.stakeholderNote ?? null,
              reports_to_person_id:   optimistic.reportsToPersonId ?? null,
              works_with_person_ids:  optimistic.worksWithPersonIds?.length
                ? JSON.stringify(optimistic.worksWithPersonIds)
                : null,
            }),
          },
        );
        if (res.ok) {
          const data = await res.json() as { person: AppPerson };
          // rowId 確定版（永続化済み）で onSaved を再コール → ID を更新
          onSaved?.(data.person);
        }
        // NOTE: POST 失敗時（NOCODB_COMPANY_PEOPLE_TABLE_ID 未設定等）は
        //       optimistic のまま UI に残るが、rowId が undefined のため再読込後には消える。
      }
    } catch {
      // silent — optimistic update は保持される
    }

    setSaving(false);
    setTimeout(() => handleOpenChange(false), 900);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isEdit
              ? <UserCog  className="w-4 h-4 text-slate-500" />
              : <UserPlus className="w-4 h-4 text-sky-500" />
            }
            {isEdit ? '連絡先を編集' : '連絡先を追加'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {companyName}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center py-8 gap-3 text-green-600">
            <CheckCircle2 className="w-10 h-10" />
            <p className="text-sm font-medium">
              {isEdit ? '連絡先を更新しました' : '連絡先を追加しました'}
            </p>
            {savedRelationSummary.length > 0 ? (
              <div className="flex flex-col items-center gap-1 mt-1">
                {savedRelationSummary.map((line, i) => (
                  <p key={i} className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2.5 py-1">
                    ✓ {line}
                  </p>
                ))}
                <p className="text-[10px] text-slate-400 mt-1">Org Chart に反映されました</p>
              </div>
            ) : isEdit && persons && persons.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-1">関係性は変更されませんでした</p>
            )}
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 py-2 px-0.5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="contact-name" className="text-xs">
                氏名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例: 山田 太郎"
                className="text-sm"
                autoFocus
              />
            </div>

            {/* Role + Title */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact-role" className="text-xs">役割</Label>
                <Input
                  id="contact-role"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="例: Champion"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-title" className="text-xs">
                  役職
                  {isEdit && person?.sfId && <span className="ml-1 text-[9px] text-sky-500 font-normal">↑SF push</span>}
                </Label>
                <Input
                  id="contact-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="例: プロダクトマネージャー"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label htmlFor="contact-dept" className="text-xs">
                部署
                {isEdit && person?.sfId && <span className="ml-1 text-[9px] text-sky-500 font-normal">↑SF push</span>}
              </Label>
              <Input
                id="contact-dept"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="例: マーケティング部"
                className="text-sm"
              />
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email" className="text-xs">
                  メール
                  {isEdit && person?.sfId && <span className="ml-1 text-[9px] text-sky-500 font-normal">↑SF push</span>}
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone" className="text-xs">
                  電話
                  {isEdit && person?.sfId && <span className="ml-1 text-[9px] text-sky-500 font-normal">↑SF push</span>}
                </Label>
                <Input
                  id="contact-phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="03-xxxx-xxxx"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Layer Role + Display Group */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">レイヤー</Label>
                <Select
                  value={layerRole || '_none'}
                  onValueChange={v => setLayerRole(v === '_none' ? '' : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="未設定" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">未設定</SelectItem>
                    <SelectItem value="executive">経営層</SelectItem>
                    <SelectItem value="department_head">部署長</SelectItem>
                    <SelectItem value="manager">マネージャー</SelectItem>
                    <SelectItem value="operator">担当者</SelectItem>
                    <SelectItem value="unclassified">未分類</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-display-group" className="text-xs">表示グループ</Label>
                <Input
                  id="contact-display-group"
                  value={displayGroup}
                  onChange={e => setDisplayGroup(e.target.value)}
                  placeholder="例: 営業部門"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Stakeholder Note */}
            <div className="space-y-1.5">
              <Label htmlFor="contact-stakeholder-note" className="text-xs">CSMメモ</Label>
              <textarea
                id="contact-stakeholder-note"
                value={stakeholderNote}
                onChange={e => setStakeholderNote(e.target.value)}
                placeholder="アプローチ方針やキーパーソン情報など"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                rows={2}
              />
            </div>

            {/* 関係性（reports_to / works_with） — persons リストがある場合のみ表示 */}
            {persons && persons.length > 0 && (
              <div className="space-y-2 border border-slate-100 rounded-md px-3 py-2 bg-slate-50/50">
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  組織上の関係性 <span className="font-normal text-slate-400">（CXM 専用・SF 非同期）</span>
                </p>

                {/* reports_to_person_id */}
                <div className="space-y-1">
                  <Label className="text-xs">上長 (reports_to)</Label>
                  <Select
                    value={reportsToPersonId || '_none'}
                    onValueChange={v => setReportsToPersonId(v === '_none' ? '' : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="未設定" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">未設定</SelectItem>
                      {persons
                        .filter(p => p.id !== person?.id)
                        .map(p => {
                          const sub = [p.title || p.role, p.department].filter(Boolean).join(' / ');
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="font-medium">{p.name}</span>
                              {sub && <span className="text-slate-400 ml-1 font-normal">— {sub}</span>}
                            </SelectItem>
                          );
                        })
                      }
                    </SelectContent>
                  </Select>
                </div>

                {/* works_with_person_ids — チェックリスト（native scroll なし・親 ScrollArea に委ねる） */}
                <div className="space-y-1">
                  <Label className="text-xs">
                    横断協働 (works_with)
                    {worksWithPersonIds.length > 0 && (
                      <span className="ml-1.5 text-[9px] text-indigo-500">{worksWithPersonIds.length}名選択中</span>
                    )}
                  </Label>
                  <div className="space-y-px rounded border border-slate-200 bg-white px-2 py-1">
                    {persons
                      .filter(p => p.id !== person?.id)
                      .map(p => {
                        const checked = worksWithPersonIds.includes(p.id);
                        const sub = [p.title || p.role, p.department].filter(Boolean).join(' / ');
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 cursor-pointer py-px rounded px-1 text-xs ${
                              checked ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                setWorksWithPersonIds(prev =>
                                  e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id),
                                );
                              }}
                              className="accent-indigo-500 flex-shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{p.name}</span>
                              {sub && <span className="text-[9px] text-slate-400 ml-1">{sub}</span>}
                            </span>
                          </label>
                        );
                      })
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Decision Influence + Contact Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">意思決定影響度</Label>
                <Select
                  value={decisionInfluence}
                  onValueChange={v => setDecisionInfluence(v as AppPerson['decisionInfluence'])}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">コンタクト状況</Label>
                <Select
                  value={contactStatus}
                  onValueChange={v => setContactStatus(v as AppPerson['contactStatus'])}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="not contacted">Not Contacted</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* API error (non-blocking) */}
            {apiErr && (
              <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                {apiErr}
              </p>
            )}

            {/* SF push パネル（編集 + sfId がある場合のみ） */}
            {isEdit && person?.sfId && (
              <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">
                    SF Contact 連動 ({person.sfId.slice(0, 8)}...)
                  </span>
                  {person.syncStatus === 'synced' && (
                    <span className="text-[10px] text-green-600">連動済</span>
                  )}
                </div>
                <div className="text-[9px] text-sky-600">
                  push 対象: 役職 / 部署 / メール / 電話（CXM → SF）
                </div>
                <div className="text-[9px] text-slate-400">
                  非push（CXM専用）: 役割 / レイヤー / influence / コンタクト状況
                </div>
                {sfPushState === 'loading' ? (
                  <span className="text-[10px] text-sky-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />SF push 中...
                  </span>
                ) : sfPushState === 'success' ? (
                  <span className="text-[10px] text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />SF Contact を更新しました
                  </span>
                ) : sfPushState === 'error' ? (
                  <div className="flex items-center gap-1 text-[10px] text-red-500">
                    <AlertTriangle className="w-3 h-3" />
                    <span title={sfPushError}>SF push エラー</span>
                    <button className="underline hover:text-red-700" onClick={handleSfPush}>再push</button>
                  </div>
                ) : (
                  <button
                    className="text-[10px] text-sky-600 hover:text-sky-800 flex items-center gap-1"
                    onClick={handleSfPush}
                    title="現在のフォーム値（役職/部署/Email/Phone）を SF Contact に push する"
                  >
                    <Upload className="w-3 h-3" />SF Contact に push
                  </button>
                )}
              </div>
            )}

          </div>
          </ScrollArea>
        )}

        {!done && (
          <DialogFooter className="flex-shrink-0 border-t pt-3 mt-1">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || saving}>
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />保存中...</>
                : isEdit ? '更新する' : '追加する'
              }
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
