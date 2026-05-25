"use client";

// ─── Outbound 一斉送信画面 ────────────────────────────────────────────────────
// CSMが複数顧客に Slack / Chatwork / Mail を一括送信する画面。
// 左パネル: 企業選択（複数チェックボックス、チャンネル可用性バッジ）
// 右パネル: チャンネル選択、件名・本文編集、送信先プレビュー、送信ボタン
// Mail 送信時: 送信前にコンタクト選択ダイアログを表示

import { useState, useEffect, useMemo, useCallback } from "react";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import {
  Search, Check, AlertCircle, Loader2, RefreshCw,
  Send, Hash, MessageCircle, Building2, X, CheckCircle2,
  Users, Mail, Eye, Plus, FileText, Copy, Trash2, ChevronLeft,
  Clock, CheckCheck, Pencil,
} from "lucide-react";
import { RichMessageEditor } from "@/components/outbound/rich-message-editor";
import {
  htmlToSlack, htmlToChatwork,
  addSubjectToSlack, addSubjectToChatwork,
  applyMentionAll,
} from "@/lib/outbound/format-converter";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";
import type { AppCompany } from "@/lib/nocodb/types";
import type { OutboundChannelsResponse, MailContactInfo } from "@/app/api/outbound/channels/route";
import type { AppUserProfile } from "@/lib/nocodb/user-profile";
import type { OutboundCampaign } from "@/app/api/outbound/campaigns/route";
import type { OutboundAudience } from "@/app/api/outbound/audiences/route";

// ── 型 ────────────────────────────────────────────────────────────────────────

type OutboundChannel = 'slack' | 'chatwork' | 'mail';

// 企業ごとのチャンネル選択エントリ（特定チャンネルIDを指定できる）
type PerCompanyChannelEntry =
  | { type: 'slack';    channelId: string; channelName: string | null }
  | { type: 'chatwork'; channelId: string; channelName: string | null }
  | { type: 'mail' };

interface ChannelResult {
  type:    OutboundChannel;
  status:  'sent' | 'failed' | 'no_channel';
  error?:  string;
}

interface SendResult {
  companyUid:  string;
  companyName: string;
  channels:    ChannelResult[];
}

interface SendSummary {
  results:      SendResult[];
  sentCount:    number;
  failedCount:  number;
  skippedCount: number;
}

// プレビューの per-channel エントリ（mail は contacts 構造）
type PerChannelEntry =
  | { type: 'slack' | 'chatwork'; ch: { channelId: string; channelName: string | null } | undefined }
  | { type: 'mail';               ch: { contacts: MailContactInfo[] } | undefined };

interface PreviewEntry {
  company:    AppCompany;
  perChannel: PerChannelEntry[];
}

// ── Mail 宛先型 ───────────────────────────────────────────────────────────────

interface MailTarget {
  to: { email: string; name: string }[];  // 宛先（複数可、最低1名）
}

// 社内確認用アドレス（TO に追加して送信内容を確認できる）
const INTERNAL_ADDRESSES: { name: string; email: string }[] = [
  { name: 'JP Market', email: 'jp.market@ptmind.com' },
  { name: 'CS',        email: 'cs@ptmind.co.jp' },
  { name: 'Billing',   email: 'billing@ptmind.co.jp' },
];

// ── チャンネルメタ ────────────────────────────────────────────────────────────

const CHANNEL_META: Record<OutboundChannel, { label: string; icon: React.ReactNode; color: string }> = {
  slack:    { label: 'Slack',    icon: <Hash          className="w-3.5 h-3.5" />, color: 'text-purple-600' },
  chatwork: { label: 'Chatwork', icon: <MessageCircle className="w-3.5 h-3.5" />, color: 'text-green-600'  },
  mail:     { label: 'Mail',     icon: <Mail          className="w-3.5 h-3.5" />, color: 'text-blue-600'   },
};

const ALL_CHANNELS: OutboundChannel[] = ['slack', 'chatwork', 'mail'];

// ── チャンネルバッジ ──────────────────────────────────────────────────────────

function ChannelBadge({
  type, has, isActive,
}: {
  type:     OutboundChannel;
  has:      boolean;
  isActive: boolean;
}) {
  const meta = CHANNEL_META[type];
  const cls = has && isActive
    ? 'bg-green-500 text-white border border-green-600 font-semibold'
    : has
    ? 'bg-green-50 text-green-600 border border-green-200'
    : 'bg-slate-50 text-slate-300 border border-slate-100';

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded ${cls}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ── 企業行 ────────────────────────────────────────────────────────────────────

function CompanyRow({
  company, selected, onToggle, channels, activeChannels,
}: {
  company:        AppCompany;
  selected:       boolean;
  onToggle:       () => void;
  channels:       OutboundChannelsResponse[string] | undefined;
  activeChannels: Set<OutboundChannel>;
}) {
  const hasChannel = (ch: OutboundChannel) =>
    ch === 'mail'
      ? !!(channels?.mail?.contacts?.length)
      : (channels?.[ch]?.length ?? 0) > 0;

  const hasActiveChannel = ALL_CHANNELS.some(
    ch => activeChannels.has(ch) && hasChannel(ch),
  );

  return (
    <label className={[
      'flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors rounded-lg',
      selected && hasActiveChannel
        ? 'bg-slate-900 text-white'
        : selected && !hasActiveChannel
        ? 'bg-slate-700 text-slate-300'
        : hasActiveChannel
        ? 'hover:bg-slate-100'
        : 'opacity-40 hover:bg-slate-50',
    ].join(' ')}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="sr-only" />
      <div className={[
        'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center mt-0.5',
        selected ? 'bg-white border-white' : 'border-slate-300 bg-white',
      ].join(' ')}>
        {selected && <Check className="w-3 h-3 text-slate-900" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate leading-snug ${selected ? 'text-white' : 'text-slate-800'}`}>
          {company.name}
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {ALL_CHANNELS.map(t => (
            <ChannelBadge key={t} type={t} has={hasChannel(t)} isActive={activeChannels.has(t)} />
          ))}
        </div>
        {/* チャンネル名を表示（同名企業を区別するため） */}
        {((channels?.slack?.length ?? 0) > 0 || (channels?.chatwork?.length ?? 0) > 0) && (
          <div className={`text-xs mt-0.5 truncate ${selected ? 'text-slate-300' : 'text-slate-400'}`}>
            {[
              ...(channels?.slack?.map(c => `# ${c.channelName ?? c.channelId}`) ?? []),
              ...(channels?.chatwork?.map(c => `💬 ${c.channelName ?? c.channelId}`) ?? []),
            ].join('  ')}
          </div>
        )}
      </div>
    </label>
  );
}

// ── コンタクト選択ダイアログ ──────────────────────────────────────────────────

function ContactPickerDialog({
  companies,
  channelMap,
  mailTargets,
  sendMode,
  onChangeTargets,
  onConfirm,
  onCancel,
  sending,
  selectedChannels,
  perCompanyChannels,
  onChangePerCompanyChannels,
  savedAudiences,
  onSaveAudience,
  onLoadAudience,
}: {
  companies:                  AppCompany[];
  channelMap:                 OutboundChannelsResponse;
  mailTargets:                Map<string, MailTarget>;
  sendMode:                   'per_company' | 'per_person';
  onChangeTargets:            (companyUid: string, target: MailTarget) => void;
  onConfirm:                  () => void;
  onCancel:                   () => void;
  sending:                    boolean;
  selectedChannels:           Set<OutboundChannel>;
  perCompanyChannels:         Map<string, PerCompanyChannelEntry[]>;
  onChangePerCompanyChannels: (uid: string, entries: PerCompanyChannelEntry[]) => void;
  savedAudiences:             OutboundAudience[];
  onSaveAudience:             (name: string) => Promise<void>;
  onLoadAudience:             (a: OutboundAudience) => void;
}) {
  const [saving, setSaving] = useState(false);

  const companiesWithMail = companies.filter(
    c => (channelMap[c.id]?.mail?.contacts?.length ?? 0) > 0,
  );

  /** 企業の全チャンネルエントリを列挙 */
  function getAllEntries(uid: string): PerCompanyChannelEntry[] {
    const ch = channelMap[uid];
    return [
      ...(ch?.slack?.map(c => ({ type: 'slack' as const, channelId: c.channelId, channelName: c.channelName })) ?? []),
      ...(ch?.chatwork?.map(c => ({ type: 'chatwork' as const, channelId: c.channelId, channelName: c.channelName })) ?? []),
      ...(ch?.mail ? [{ type: 'mail' as const }] : []),
    ];
  }

  /** デフォルト選択: グローバル selectedChannels に含まれる種別のエントリをすべて選択 */
  function getDefaultEntries(uid: string): PerCompanyChannelEntry[] {
    return getAllEntries(uid).filter(e => selectedChannels.has(e.type));
  }

  function getEffectiveEntries(uid: string): PerCompanyChannelEntry[] {
    return perCompanyChannels.get(uid) ?? getDefaultEntries(uid);
  }

  function isEntryChecked(uid: string, entry: PerCompanyChannelEntry): boolean {
    const selected = getEffectiveEntries(uid);
    if (entry.type === 'mail') return selected.some(e => e.type === 'mail');
    const entryId = entry.channelId;
    return selected.some(e =>
      e.type === entry.type &&
      (e as { channelId?: string }).channelId === entryId,
    );
  }

  function toggleEntry(uid: string, entry: PerCompanyChannelEntry) {
    const current = getEffectiveEntries(uid);
    const checked = isEntryChecked(uid, entry);
    let next: PerCompanyChannelEntry[];
    if (checked) {
      if (entry.type === 'mail') {
        next = current.filter(e => e.type !== 'mail');
      } else {
        const entryId = entry.channelId;
        next = current.filter(e =>
          !(e.type === entry.type && (e as { channelId?: string }).channelId === entryId),
        );
      }
    } else {
      next = [...current, entry];
    }
    // 全解除は許可しない（少なくとも1エントリ残す）
    onChangePerCompanyChannels(uid, next.length > 0 ? next : current);
  }

  // Mail がオンの企業（effective エントリに mail が含まれ、contacts がある）
  function isMailOn(uid: string): boolean {
    return getEffectiveEntries(uid).some(e => e.type === 'mail');
  }

  async function handleSave() {
    const name = window.prompt('オーディエンス名を入力してください');
    if (!name?.trim()) return;
    setSaving(true);
    try {
      await onSaveAudience(name.trim());
    } finally {
      setSaving(false);
    }
  }

  function toggleTo(uid: string, email: string, name: string) {
    const cur = mailTargets.get(uid) ?? { to: [] };
    const newTo = cur.to.some(t => t.email === email)
      ? cur.to.filter(t => t.email !== email)
      : [...cur.to, { email, name }];
    onChangeTargets(uid, { ...cur, to: newTo });
  }

  const mailOnCompanies = companies.filter(c =>
    isMailOn(c.id) && (channelMap[c.id]?.mail?.contacts?.length ?? 0) > 0,
  );

  const isValid = sendMode === 'per_person'
    ? (mailOnCompanies.length === 0 || mailOnCompanies.some(c => (mailTargets.get(c.id)?.to?.length ?? 0) > 0))
    : (mailOnCompanies.length === 0 || mailOnCompanies.every(c => (mailTargets.get(c.id)?.to?.length ?? 0) > 0));

  const subtitle = !selectedChannels.has('mail')
    ? '各企業の送信チャンネルを確認・選択してください'
    : sendMode === 'per_person'
    ? '各コンタクトに個別でメールが届きます（{{name}} が名前に置換されます）'
    : '宛先（TO）を選択してください（複数選択可）';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">送信先・チャンネルを選択</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {savedAudiences.length > 0 && (
              <select
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 bg-white hover:border-slate-300 transition-colors max-w-[180px]"
                defaultValue=""
                onChange={e => {
                  const found = savedAudiences.find(a => a.audience_id === e.target.value);
                  if (found) onLoadAudience(found);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>保存済みを読み込む</option>
                {savedAudiences.map(a => (
                  <option key={a.audience_id} value={a.audience_id}>{a.name}</option>
                ))}
              </select>
            )}
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {companies.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">企業が選択されていません</p>
          ) : (
            companies.map(company => {
              const mailOn     = isMailOn(company.id);
              const contacts   = channelMap[company.id]?.mail?.contacts ?? [];
              const hasContacts = contacts.length > 0;
              const target     = mailTargets.get(company.id) ?? { to: [] };
              const allEntries = getAllEntries(company.id);

              return (
                <div key={company.id} className="border border-slate-100 rounded-xl overflow-hidden">
                  {/* 企業ヘッダー */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-slate-700 truncate flex-1">{company.name}</p>
                    {mailOn && hasContacts && sendMode === 'per_company' && target.to.length === 0 && (
                      <span className="text-[10px] text-red-500 flex-shrink-0">To を1名以上選択</span>
                    )}
                  </div>

                  {/* チャンネル個別チェックボックス */}
                  {allEntries.length > 0 && (
                    <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100">
                      {allEntries.map((entry, i) => {
                        const checked = isEntryChecked(company.id, entry);
                        return (
                          <label key={i} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEntry(company.id, entry)}
                              className="w-3.5 h-3.5 accent-slate-800"
                            />
                            {entry.type === 'slack'    && <span className="text-purple-600 flex items-center gap-0.5"><Hash className="w-3 h-3" />{entry.channelName ?? entry.channelId}</span>}
                            {entry.type === 'chatwork' && <span className="text-green-600 flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{entry.channelName ?? entry.channelId}</span>}
                            {entry.type === 'mail'     && <span className="text-blue-600 flex items-center gap-0.5"><Mail className="w-3 h-3" />Mail</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Mail コンタクト選択（Mail がオンで contacts がある場合のみ） */}
                  {mailOn && hasContacts && (
                    <div className="p-3 space-y-4">
                      {sendMode === 'per_person' ? (
                        // ── 1人1通モード ──────────────────────────────────────
                        <div className="space-y-1">
                          {contacts.map(contact => {
                            const checked = target.to.some(t => t.email === contact.email);
                            return (
                              <label
                                key={contact.email}
                                className={[
                                  'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                                  checked
                                    ? 'border-slate-800 bg-slate-900 text-white'
                                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                                ].join(' ')}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTo(company.id, contact.email, contact.name)}
                                  className="accent-white w-3.5 h-3.5 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium truncate ${checked ? 'text-white' : 'text-slate-800'}`}>
                                    {contact.name}
                                  </p>
                                  <p className={`text-[10px] truncate ${checked ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {contact.email}
                                    {contact.role && <span className="ml-1.5">· {contact.role}</span>}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                          <div className="flex items-center gap-2 py-1">
                            <div className="flex-1 h-px bg-slate-100" />
                            <span className="text-[9px] text-slate-400 flex-shrink-0">社内確認用</span>
                            <div className="flex-1 h-px bg-slate-100" />
                          </div>
                          {INTERNAL_ADDRESSES.map(addr => {
                            const checked = target.to.some(t => t.email === addr.email);
                            return (
                              <label
                                key={addr.email}
                                className={[
                                  'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                                  checked
                                    ? 'border-slate-800 bg-slate-900 text-white'
                                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                                ].join(' ')}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTo(company.id, addr.email, addr.name)}
                                  className="accent-white w-3.5 h-3.5 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium truncate ${checked ? 'text-white' : 'text-slate-800'}`}>{addr.name}</p>
                                  <p className={`text-[10px] truncate ${checked ? 'text-slate-300' : 'text-slate-500'}`}>{addr.email}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        // ── 1社1通モード: To / CC 選択 ────────────────────────
                        <>
                          {/* To セクション */}
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                              宛先 (To) <span className="text-red-400 normal-case font-normal">必須</span>
                            </p>
                            <div className="space-y-1">
                              {contacts.map(contact => {
                                const checked = target.to.some(t => t.email === contact.email);
                                return (
                                  <label
                                    key={contact.email}
                                    className={[
                                      'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                                      checked
                                        ? 'border-slate-800 bg-slate-900 text-white'
                                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                                    ].join(' ')}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleTo(company.id, contact.email, contact.name)}
                                      className="accent-white w-3.5 h-3.5 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-medium truncate ${checked ? 'text-white' : 'text-slate-800'}`}>
                                        {contact.name}
                                      </p>
                                      <p className={`text-[10px] truncate ${checked ? 'text-slate-300' : 'text-slate-500'}`}>
                                        {contact.email}
                                        {contact.role && <span className="ml-1.5">· {contact.role}</span>}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                              <div className="flex items-center gap-2 py-1">
                                <div className="flex-1 h-px bg-slate-100" />
                                <span className="text-[9px] text-slate-400 flex-shrink-0">社内確認用</span>
                                <div className="flex-1 h-px bg-slate-100" />
                              </div>
                              {INTERNAL_ADDRESSES.map(addr => {
                                const checked = target.to.some(t => t.email === addr.email);
                                return (
                                  <label
                                    key={addr.email}
                                    className={[
                                      'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                                      checked
                                        ? 'border-slate-800 bg-slate-900 text-white'
                                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                                    ].join(' ')}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleTo(company.id, addr.email, addr.name)}
                                      className="accent-white w-3.5 h-3.5 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-medium truncate ${checked ? 'text-white' : 'text-slate-800'}`}>{addr.name}</p>
                                      <p className={`text-[10px] truncate ${checked ? 'text-slate-300' : 'text-slate-500'}`}>{addr.email}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            オーディエンスを保存
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-sm text-slate-600 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
            <Button onClick={onConfirm} disabled={!isValid} className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              この宛先でプレビューする
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── プレビュー & テスト送信ダイアログ ────────────────────────────────────────

function PreviewAndTestDialog({
  selectedChannels,
  message,
  subject,
  mentionAll,
  testChannels,
  showActualSend,
  testMailTo,
  setTestMailTo,
  onTestSend,
  onActualSend,
  onClose,
  testSending,
  testResult,
}: {
  selectedChannels: Set<OutboundChannel>;
  message:          string;
  subject:          string;
  mentionAll:       boolean;
  testChannels:     OutboundChannelsResponse;
  showActualSend:   boolean;
  testMailTo:          string;
  setTestMailTo:       (v: string) => void;
  onTestSend:       (ch: OutboundChannel) => void;
  onActualSend:     () => void;
  onClose:          () => void;
  testSending:      boolean;
  testResult:       string | null;
}) {
  const channels = ALL_CHANNELS.filter(ch => selectedChannels.has(ch));
  const [activeTab, setActiveTab] = useState<OutboundChannel>(channels[0] ?? 'slack');

  const slackPreview = useMemo(() => {
    const body = htmlToSlack(message);
    const text = subject.trim() ? addSubjectToSlack(subject.trim(), body) : body;
    return mentionAll ? applyMentionAll(text, 'slack') : text;
  }, [message, subject, mentionAll]);

  const chatworkPreview = useMemo(() => {
    const body = htmlToChatwork(message);
    const text = subject.trim() ? addSubjectToChatwork(subject.trim(), body) : body;
    return mentionAll ? applyMentionAll(text, 'chatwork') : text;
  }, [message, subject, mentionAll]);

  const testSlackChannels = useMemo(() =>
    Object.entries(testChannels)
      .flatMap(([uid, ch]) => (ch.slack ?? []).map(c => ({ uid, ...c }))),
    [testChannels]);

  const testChatworkChannels = useMemo(() =>
    Object.entries(testChannels)
      .flatMap(([uid, ch]) => (ch.chatwork ?? []).map(c => ({ uid, ...c }))),
    [testChannels]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">プレビュー & テスト送信</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {showActualSend
                ? '内容を確認してテスト送信または本送信してください'
                : '実際の送信前にテスト送信で表示を確認できます'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* チャンネルタブ */}
        <div className="flex border-b flex-shrink-0 px-5">
          {channels.map(ch => {
            const meta   = CHANNEL_META[ch];
            const active = activeTab === ch;
            return (
              <button
                key={ch}
                onClick={() => setActiveTab(ch)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 -mb-px transition-colors',
                  active
                    ? 'border-slate-900 text-slate-900 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* メッセージプレビュー */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">プレビュー</p>
            {activeTab === 'slack' && (
              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-800 max-h-56 overflow-y-auto">
                {slackPreview || '（メッセージが空です）'}
              </pre>
            )}
            {activeTab === 'chatwork' && (
              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-800 max-h-56 overflow-y-auto">
                {chatworkPreview || '（メッセージが空です）'}
              </pre>
            )}
            {activeTab === 'mail' && (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                {subject.trim() && (
                  <div className="px-4 py-2.5 bg-slate-50 border-b text-xs">
                    <span className="text-slate-400">件名:</span>
                    <span className="ml-2 font-medium text-slate-800">{subject}</span>
                  </div>
                )}
                <div
                  className="prose prose-sm max-w-none px-4 py-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: message }}
                />
              </div>
            )}
          </div>

          {/* テスト送信 */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">テスト送信</p>

            {activeTab === 'slack' && (
              <div className="space-y-2">
                {testSlackChannels.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {testSlackChannels.map(ch => (
                        <span key={ch.uid} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
                          <Hash className="w-3 h-3" />
                          {ch.channelName ?? ch.channelId}
                          <span className="text-purple-400">({ch.uid})</span>
                        </span>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onTestSend('slack')} disabled={testSending} className="gap-1.5">
                      {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hash className="w-3 h-3" />}
                      Slack にテスト送信
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">テストチャンネルが設定されていません（NocoDB: company_uid = test1 / test2）</p>
                )}
              </div>
            )}

            {activeTab === 'chatwork' && (
              <div className="space-y-2">
                {testChatworkChannels.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {testChatworkChannels.map(ch => (
                        <span key={ch.uid} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md">
                          <MessageCircle className="w-3 h-3" />
                          {ch.channelName ?? ch.channelId}
                          <span className="text-green-400">({ch.uid})</span>
                        </span>
                      ))}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onTestSend('chatwork')} disabled={testSending} className="gap-1.5">
                      {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
                      Chatwork にテスト送信
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">テストチャンネルが設定されていません（NocoDB: company_uid = test1 / test2）</p>
                )}
              </div>
            )}

            {activeTab === 'mail' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-6 flex-shrink-0">To</span>
                  <Input
                    type="text"
                    value={testMailTo}
                    onChange={e => setTestMailTo(e.target.value)}
                    placeholder="宛先メールアドレス（複数の場合はカンマ区切り）"
                    className="text-sm h-9 flex-1"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTestSend('mail')}
                  disabled={testSending || !testMailTo.trim()}
                  className="gap-1.5"
                >
                  {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  テスト送信
                </Button>
              </div>
            )}

            {testResult && (
              <p className={`text-xs mt-2 font-medium ${testResult.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                {testResult}
              </p>
            )}
          </div>

        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-slate-600 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            閉じる
          </button>
          {showActualSend && (
            <Button onClick={onActualSend} className="gap-1.5">
              <Send className="w-3.5 h-3.5" />
              この内容で本送信する
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── キャンペーン一覧コンポーネント ────────────────────────────────────────────

function CampaignList({
  onNew,
  onEdit,
  currentUser,
}: {
  onNew:        () => void;
  onEdit:       (campaign: OutboundCampaign) => void;
  currentUser:  AppUserProfile | null;
}) {
  const [campaigns,   setCampaigns]   = useState<OutboundCampaign[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);

  // localStorage からスコープを読む（storage イベント経由のリアルタイム変更専用）
  const getScopeFromStorage = useCallback((): 'mine' | 'team' | 'all' => {
    if (!currentUser?.name2) return 'all';
    try {
      const prefs = JSON.parse(localStorage.getItem(`cxm_prefs_${currentUser.name2}`) ?? '{}') as { default_home_scope?: string };
      const s = prefs.default_home_scope;
      if (s === 'mine' || s === 'team' || s === 'all') return s;
    } catch { /* ignore */ }
    return 'all';
  }, [currentUser]);

  const [scope, setScope] = useState<'mine' | 'team' | 'all'>('all');

  // currentUser 確定時は DB 値（default_home_scope）を優先して使用。
  // localStorage はセッション内のリアルタイム変更のみに使用し、
  // DB 値と食い違うステイル状態を防ぐ。
  useEffect(() => {
    if (!currentUser) return;
    const dbScope = currentUser.default_home_scope as 'mine' | 'team' | 'all' | undefined;
    if (dbScope === 'mine' || dbScope === 'team' || dbScope === 'all') {
      setScope(dbScope);
    }
  }, [currentUser]);

  // グローバルヘッダーのリアルタイムスコープ変更を検知（同一タブ含む）
  useEffect(() => {
    const handler = () => { if (currentUser) setScope(getScopeFromStorage()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [currentUser, getScopeFromStorage]);

  // scope='team' のときチームメンバー一覧を取得
  useEffect(() => {
    if (scope !== 'team' || !currentUser?.team) { setTeamMembers([]); return; }
    fetch('/api/users')
      .then(r => r.json())
      .then((profiles: AppUserProfile[]) => {
        const members = profiles
          .filter(p => p.team === currentUser.team && p.name2)
          .map(p => p.name2);
        setTeamMembers(members);
      })
      .catch(() => setTeamMembers([]));
  }, [scope, currentUser?.team]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/outbound/campaigns');
      const data = await res.json() as OutboundCampaign[];
      setCampaigns(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDuplicate(c: OutboundCampaign) {
    await fetch('/api/outbound/campaigns', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:        `${c.title}（コピー）`,
        channels:     c.channels,
        subject:      c.subject,
        message:      c.message,
        company_uids: c.company_uids,
      }),
    });
    void load();
  }

  async function handleDelete(c: OutboundCampaign) {
    if (!window.confirm(`「${c.title}」を削除しますか？`)) return;
    setDeletingId(c.Id);
    try {
      // campaign_id が設定済みなら UUID で、なければ row Id（数値）でルーティング
      const key = c.campaign_id || c.Id;
      await fetch(`/api/outbound/campaigns/${key}`, { method: 'DELETE' });
      void load();
    } finally {
      setDeletingId(null);
    }
  }

  const mine = currentUser?.name2;

  const visible = useMemo(() => {
    const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'ops';
    // admin/ops は全件、scope=all は全件
    if (isAdminUser || scope === 'all') return campaigns;
    // mine が未設定（ログイン直後など）は全件
    if (!mine) return campaigns;
    if (scope === 'mine') return campaigns.filter(c => c.created_by === mine);
    if (scope === 'team') {
      if (teamMembers.length === 0) return campaigns; // チーム未設定時は全件
      return campaigns.filter(c => c.created_by && teamMembers.includes(c.created_by));
    }
    return campaigns;
  }, [campaigns, scope, mine, teamMembers, currentUser]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-900">アウトバウンド</h1>
            <p className="text-xs text-slate-500 mt-0.5">キャンペーン管理</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              更新
            </button>
            <Button onClick={onNew} className="gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" />
              新規作成
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 justify-center py-16">
            <Loader2 className="w-4 h-4 animate-spin" />
            読み込み中…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-10 h-10 text-slate-200" />
            <p className="text-sm text-slate-400">キャンペーンがありません</p>
            <Button onClick={onNew} variant="outline" className="gap-1.5 text-xs h-8">
              <Plus className="w-3.5 h-3.5" />
              最初のキャンペーンを作成
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {visible.map((c, idx) => {
              const channelList: string[] = (() => {
                try {
                  const parsed = JSON.parse(c.channels) as unknown;
                  return Array.isArray(parsed) ? [...new Set(parsed as string[])] : [];
                } catch { return []; }
              })();
              const companyCount: number = (() => {
                try { return (JSON.parse(c.company_uids) as unknown[]).length; } catch { return 0; }
              })();
              const isDraft = c.status === 'draft';

              return (
                <div
                  key={c.Id ?? c.campaign_id ?? idx}
                  className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-slate-300 transition-colors group"
                >
                  {/* ステータスアイコン */}
                  <div className={[
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    isDraft ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-600',
                  ].join(' ')}>
                    {isDraft ? <Clock className="w-4 h-4" /> : <CheckCheck className="w-4 h-4" />}
                  </div>

                  {/* メイン情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{c.title || '（無題）'}</span>
                      <span className={[
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                        isDraft ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                      ].join(' ')}>
                        {isDraft ? '下書き' : '送信済'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1">
                        {channelList.map(ch => {
                          const meta = CHANNEL_META[ch as OutboundChannel];
                          return meta ? (
                            <span key={ch} className={`${meta.color} text-[11px] flex items-center gap-0.5`}>
                              {meta.icon}{meta.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                      {companyCount > 0 && (
                        <>
                          <span className="text-slate-200 text-xs">·</span>
                          <span className="text-[11px] text-slate-400">{companyCount}社</span>
                        </>
                      )}
                      {c.subject && (
                        <>
                          <span className="text-slate-200 text-xs">·</span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[200px]">件名: {c.subject}</span>
                        </>
                      )}
                      {c.sent_at && (
                        <>
                          <span className="text-slate-200 text-xs">·</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(c.sent_at).toLocaleDateString('ja-JP')} 送信
                            {c.send_count != null ? `（${c.send_count}件）` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(c)}
                      title="編集・送信"
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      {isDraft ? '編集' : '再送信'}
                    </button>
                    <button
                      onClick={() => handleDuplicate(c)}
                      title="複製"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      title="削除"
                      disabled={deletingId === c.Id}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      {deletingId === c.Id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────────────────

export function OutboundPage() {
  // ── ビュー管理 ─────────────────────────────────────────────────────────────
  type View = 'list' | 'editor';
  const [view,             setView]             = useState<View>('list');
  const [editingCampaign,  setEditingCampaign]  = useState<OutboundCampaign | null>(null);

  // ── エディタ状態 ──────────────────────────────────────────────────────────
  const [companies,        setCompanies]        = useState<AppCompany[]>([]);
  const [channelMap,       setChannelMap]       = useState<OutboundChannelsResponse>({});
  const [loadingCo,        setLoadingCo]        = useState(true);
  const [loadingCh,        setLoadingCh]        = useState(false);
  const [selectedUids,     setSelectedUids]     = useState<Set<string>>(new Set());
  const [search,           setSearch]           = useState('');
  const [selectedChannels, setSelectedChannels] = useState<Set<OutboundChannel>>(new Set(['slack']));
  const [subject,          setSubject]          = useState('');
  const [message,          setMessage]          = useState('');

  const [campaignTitle,    setCampaignTitle]    = useState('');
  const [sending,          setSending]          = useState(false);
  const [summary,          setSummary]          = useState<SendSummary | null>(null);
  const [currentUser,      setCurrentUser]      = useState<AppUserProfile | null>(null);
  const [showAll,          setShowAll]          = useState(false);

  // Mail コンタクト選択ダイアログ
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [mailTargets,       setMailTargets]       = useState<Map<string, MailTarget>>(new Map());
  const [sendMode,          setSendMode]          = useState<'per_company' | 'per_person'>('per_company');

  // 企業ごとのチャンネル設定 / オーディエンス
  const [perCompanyChannels, setPerCompanyChannels] = useState<Map<string, PerCompanyChannelEntry[]>>(new Map());
  const [savedAudiences,     setSavedAudiences]     = useState<OutboundAudience[]>([]);

  // プレビュー & テスト送信ダイアログ
  const [showPreview,      setShowPreview]      = useState(false);
  const [savedMailTargets, setSavedMailTargets] = useState<Map<string, MailTarget>>(new Map());
  const [testChannels,     setTestChannels]     = useState<OutboundChannelsResponse>({});
  const [testMailTo,       setTestMailTo]       = useState('');
  const [mentionAll,       setMentionAll]       = useState(false);
  const [testSending,      setTestSending]      = useState(false);
  const [testResult,       setTestResult]       = useState<string | null>(null);
  const [previewForActualSend, setPreviewForActualSend] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ops';

  // ── ユーザープロファイル取得 ───────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.ok ? r.json() as Promise<AppUserProfile> : null)
      .then(p => setCurrentUser(p))
      .catch(() => {});
  }, []);

  // ── ビュー切り替えヘルパー ─────────────────────────────────────────────────

  function openNew() {
    setEditingCampaign(null);
    setCampaignTitle('');
    setSelectedUids(new Set());
    setSelectedChannels(new Set(['slack']));
    setSubject('');
    setMessage('');
    setSummary(null);
    setView('editor');
  }

  function openEdit(campaign: OutboundCampaign) {
    setEditingCampaign(campaign);
    setCampaignTitle(campaign.title ?? '');
    // キャンペーンからエディタ状態を復元
    try {
      const chList = JSON.parse(campaign.channels) as string[];
      setSelectedChannels(new Set(chList as OutboundChannel[]));
    } catch { setSelectedChannels(new Set(['slack'])); }
    try {
      const uids = JSON.parse(campaign.company_uids) as string[];
      setSelectedUids(new Set(uids));
    } catch { setSelectedUids(new Set()); }
    setSubject(campaign.subject ?? '');
    setMessage(campaign.message ?? '');
    setSummary(null);
    setView('editor');
  }

  // キャンペーンを保存（下書き更新 or 新規作成）
  async function saveCampaign(patch: Partial<OutboundCampaign> = {}) {
    const payload = {
      title:        patch.title ?? (campaignTitle.trim() || '（無題）'),
      channels:     JSON.stringify([...selectedChannels]),
      subject:      subject.trim(),
      message,
      company_uids: JSON.stringify([...selectedUids]),
      ...patch,
    };
    if (editingCampaign) {
      const key = editingCampaign.campaign_id || editingCampaign.Id;
      await fetch(`/api/outbound/campaigns/${key}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } else {
      const res = await fetch('/api/outbound/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const created = await res.json() as OutboundCampaign;
      setEditingCampaign(created);
    }
  }

  // ── 企業一覧ロード + チャンネル情報を一括取得 ─────────────────────────────

  const loadCompanies = useCallback(async (owner?: string) => {
    setLoadingCo(true);
    setChannelMap({});
    try {
      const params = new URLSearchParams({ limit: '500', outbound: 'true' });
      if (owner) params.set('owner', owner);
      const res  = await fetch(`/api/nocodb/companies?${params.toString()}`);
      const data = await res.json() as { id: string; name: string }[];
      if (Array.isArray(data)) {
        const list = data.map(c => ({
          id:                  c.id,
          name:                c.name,
          phaseLabel:          '',
          riskLevel:           'none' as const,
          owner:               '',
          lastContact:         '',
          openAlerts:          0,
          openActions:         0,
          unprocessedMinutes:  0,
          priority:            'normal' as const,
          reason:              '',
          updatedAt:           null,
          sfAccountId:         null,
        }));
        setCompanies(list);

        // 企業リスト確定後、全社のチャンネル情報を一括取得（選択前から緑バッジを表示）
        const uids = list.map(c => c.id);
        if (uids.length > 0) {
          setLoadingCh(true);
          fetch(`/api/outbound/channels?company_uids=${uids.join(',')}`)
            .then(r => r.json() as Promise<OutboundChannelsResponse>)
            .then(d => setChannelMap(d))
            .catch(() => {})
            .finally(() => setLoadingCh(false));
        }
      }
    } catch { /* ignore */ } finally {
      setLoadingCo(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser === null) return;
    // admin/ops は常に全社表示（showAll フラグ不要）
    const isAdminUser = currentUser.role === 'admin' || currentUser.role === 'ops';
    const owner = (isAdminUser || showAll || !currentUser.name2) ? undefined : currentUser.name2;
    void loadCompanies(owner);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, showAll]);

  // ── フィルタ ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter(c => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  // ── 選択ユーティリティ ─────────────────────────────────────────────────────

  function toggleCompany(uid: string) {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
    setSummary(null);
  }

  function selectAll() {
    setSelectedUids(new Set(filtered.map(c => c.id)));
    setSummary(null);
  }

  function clearAll() {
    setSelectedUids(new Set());
    setSummary(null);
  }

  // ── 送信先プレビュー ─────────────────────────────────────────────────────

  const previewTargets = useMemo<PreviewEntry[]>(() => {
    return [...selectedUids]
      .map(uid => {
        const company = companies.find(c => c.id === uid);
        if (!company) return null;
        const perChannel: PerChannelEntry[] = ALL_CHANNELS
          .filter(t => selectedChannels.has(t))
          .map(t => {
            if (t === 'mail') {
              return { type: 'mail' as const, ch: channelMap[uid]?.mail };
            }
            // 配列の先頭を代表値として使用（バッジ表示用）
            const arr = channelMap[uid]?.[t];
            return { type: t as 'slack' | 'chatwork', ch: arr?.[0] };
          });
        return { company, perChannel };
      })
      .filter((x): x is PreviewEntry => x !== null);
  }, [selectedUids, companies, channelMap, selectedChannels]);

  // 少なくとも1チャンネルで送信できる企業数
  const canSendCount = previewTargets.filter(t =>
    t.perChannel.some(p =>
      p.type === 'mail'
        ? !!(p.ch?.contacts?.length)
        : !!p.ch,
    ),
  ).length;

  // 総送信可能チャンネル数（企業×チャンネル）
  const totalSendableChannels = previewTargets
    .flatMap(t => t.perChannel)
    .filter(p => p.type === 'mail' ? !!(p.ch?.contacts?.length) : !!p.ch)
    .length;

  // ── 実際の送信処理 ────────────────────────────────────────────────────────

  async function doSend(targets: Map<string, MailTarget>) {
    setSending(true);
    setSummary(null);
    try {
      // per_person モード: 1人1エントリに展開（各人が個別メールを受け取る）
      const mailTargetsArr = sendMode === 'per_person'
        ? [...targets.entries()].flatMap(([companyUid, t]) =>
            t.to.map(person => ({ companyUid, to: [person], cc: [] }))
          )
        : [...targets.entries()].map(([companyUid, t]) => ({
            companyUid,
            to: t.to,
            cc: [],
          }));

      const res = await fetch('/api/outbound/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          companyUids:         [...selectedUids],
          channels:            [...selectedChannels],
          message,
          subject:             subject.trim() || undefined,
          mailTargets:         mailTargetsArr,
          mentionAll:          mentionAll || undefined,
          perCompanyChannels:  Object.fromEntries([...perCompanyChannels.entries()]) as Record<string, Array<{ type: string; channelId?: string }>>,
        }),
      });
      const data = await res.json() as SendSummary;
      setSummary(data);
      // 送信成功時にキャンペーンを「送信済」に更新
      if (data.sentCount > 0) {
        await saveCampaign({
          status:     'sent',
          sent_at:    new Date().toISOString(),
          send_count: data.sentCount,
        }).catch(() => {});
      }
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  }

  // ── 送信ボタン押下 ────────────────────────────────────────────────────────

  const isMessageEmpty = !message || message.replace(/<[^>]*>/g, '').trim() === '';

  async function handleSend() {
    if (isMessageEmpty || totalSendableChannels === 0) return;

    // Mail チャンネルがある場合は第1候補をデフォルト To として初期化
    if (selectedChannels.has('mail')) {
      const initTargets = new Map<string, MailTarget>();
      for (const uid of selectedUids) {
        const contacts = channelMap[uid]?.mail?.contacts;
        if (contacts && contacts.length > 0) {
          initTargets.set(uid, {
            to: [{ email: contacts[0].email, name: contacts[0].name }],
          });
        }
      }
      setMailTargets(initTargets);
    }

    // 常に宛先確認ダイアログを経由する（Slack チャンネル選択も含む）
    fetch('/api/outbound/audiences')
      .then(r => r.ok ? r.json() as Promise<OutboundAudience[]> : [])
      .then(data => setSavedAudiences(Array.isArray(data) ? data : []))
      .catch(() => {});
    setShowContactPicker(true);
  }

  // テストチャンネルを読み込む（company_uid=test1/test2）
  async function loadTestChannels() {
    try {
      const res = await fetch('/api/outbound/channels?company_uids=test1,test2');
      const data = await res.json() as OutboundChannelsResponse;
      setTestChannels(data);
    } catch { /* ignore */ }
  }

  // ContactPickerDialog 確定 → プレビューダイアログへ（Mail フロー）
  async function handleConfirmSend() {
    setShowContactPicker(false);
    setSavedMailTargets(new Map(mailTargets));
    await loadTestChannels();
    setTestResult(null);
    setPreviewForActualSend(true);
    setShowPreview(true);
  }

  // テスト送信ボタン（プレビューなし・全チャンネル対応）
  async function handleOpenTestSend() {
    if (isMessageEmpty) return;
    await loadTestChannels();
    setTestResult(null);
    setPreviewForActualSend(false);
    setShowPreview(true);
  }

  // プレビューダイアログからのテスト送信
  async function handleTestSend(channel: OutboundChannel) {
    setTestSending(true);
    setTestResult(null);
    try {
      // 変数プレビュー用: 選択中の最初の企業名を使う（未選択時はダミー）
      const firstSelectedUid = [...selectedUids][0];
      const firstCompany = companies.find(c => c.id === firstSelectedUid);
      const previewCompanyName = firstCompany?.name ?? '〇〇株式会社';

      let body: Record<string, unknown>;
      if (channel === 'mail') {
        const toEmails = testMailTo.split(',').map(s => s.trim()).filter(Boolean);
        if (toEmails.length === 0) {
          setTestResult('❌ 宛先（To）を入力してください');
          return;
        }
        body = {
          companyUids:             ['__test__'],
          channels:                ['mail'],
          message,
          subject:                 subject.trim() || undefined,
          mailTargets:             [{ companyUid: '__test__', to: toEmails.map(email => ({ email, name: '担当者' })), cc: [] }],
          _testCompanyNameOverride: previewCompanyName,
        };
      } else {
        const testUids = Object.entries(testChannels)
          .filter(([, ch]) => {
            const arr = (ch as Record<string, unknown[]>)[channel];
            return Array.isArray(arr) ? arr.length > 0 : !!(ch as Record<string, unknown>)[channel];
          })
          .map(([uid]) => uid);
        if (testUids.length === 0) {
          setTestResult('❌ テストチャンネルが設定されていません（NocoDB: company_uid = test1 / test2）');
          return;
        }
        body = {
          companyUids: testUids,
          channels:    [channel],
          message,
          subject:     subject.trim() || undefined,
          mailTargets: [],
          // テスト時の企業名上書き: test1/test2 → 選択中の企業名
          _testCompanyNameOverride: previewCompanyName,
          mentionAll:  mentionAll || undefined,
        };
      }
      const res  = await fetch('/api/outbound/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as SendSummary;
      if (data.sentCount > 0) {
        setTestResult(`✅ テスト送信成功（${data.sentCount}件）`);
      } else {
        // 失敗の詳細エラーを取得して表示
        const errors = (data.results ?? [])
          .flatMap(r => r.channels.filter(ch => ch.status === 'failed').map(ch => ch.error ?? ''))
          .filter(Boolean);
        const errMsg = errors.length > 0 ? errors[0] : '不明なエラー';
        setTestResult(`❌ 送信失敗: ${errMsg}`);
      }
    } catch {
      setTestResult('❌ エラーが発生しました');
    } finally {
      setTestSending(false);
    }
  }

  // プレビューダイアログからの本送信
  async function handleActualSendFromPreview() {
    setShowPreview(false);
    await doSend(savedMailTargets);
  }

  function handleChangeTargets(uid: string, target: MailTarget) {
    setMailTargets(prev => new Map(prev).set(uid, target));
  }

  function handleChangePerCompanyChannels(uid: string, entries: PerCompanyChannelEntry[]) {
    setPerCompanyChannels(prev => new Map(prev).set(uid, entries));
  }

  async function handleSaveAudience(name: string) {
    const mailTargetsRecord: Record<string, { to: { email: string; name: string }[] }> = {};
    for (const [uid, t] of mailTargets.entries()) {
      mailTargetsRecord[uid] = t;
    }
    await fetch('/api/outbound/audiences', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        company_uids:         JSON.stringify([...selectedUids]),
        per_company_channels: JSON.stringify(Object.fromEntries([...perCompanyChannels.entries()])),
        mail_targets:         JSON.stringify(mailTargetsRecord),
      }),
    });
    // 保存後に一覧を再取得
    fetch('/api/outbound/audiences')
      .then(r => r.ok ? r.json() as Promise<OutboundAudience[]> : [])
      .then(data => setSavedAudiences(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  function handleLoadAudience(a: OutboundAudience) {
    try {
      const uids: string[] = JSON.parse(a.company_uids);
      setSelectedUids(new Set(uids));
    } catch { /* ignore */ }
    try {
      const pcc = JSON.parse(a.per_company_channels) as Record<string, PerCompanyChannelEntry[]>;
      const map = new Map<string, PerCompanyChannelEntry[]>();
      for (const [uid, entries] of Object.entries(pcc)) {
        map.set(uid, entries as PerCompanyChannelEntry[]);
      }
      setPerCompanyChannels(map);
    } catch { /* ignore */ }
    try {
      const mt = JSON.parse(a.mail_targets) as Record<string, { to: { email: string; name: string }[] }>;
      const map = new Map<string, MailTarget>();
      for (const [uid, t] of Object.entries(mt)) {
        map.set(uid, t);
      }
      setMailTargets(map);
    } catch { /* ignore */ }
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        <GlobalHeader />
        <main className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* ── キャンペーン一覧ビュー ── */}
          {view === 'list' && (
            <CampaignList
              onNew={openNew}
              onEdit={openEdit}
              currentUser={currentUser}
            />
          )}

          {/* ── エディタビュー ── */}
          {view === 'editor' && (<>

          {/* ヘッダー */}
          <div className="border-b bg-white px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView('list')}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  一覧に戻る
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <div>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={e => setCampaignTitle(e.target.value)}
                    placeholder="キャンペーン名を入力..."
                    className="text-base font-semibold text-slate-900 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:outline-none w-64 pb-0.5 placeholder:text-slate-300 placeholder:font-normal"
                  />
                  <p className="text-xs text-slate-500 mt-0.5">複数顧客への一斉送信</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveCampaign().then(() => setView('list')).catch(() => {})}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
                >
                  下書き保存
                </button>
                {isAdmin && (
                  <button
                    onClick={() => { setShowAll(v => !v); setSelectedUids(new Set()); setSummary(null); }}
                    className={[
                      'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                      showAll
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {showAll ? '全社' : '自分担当'}
                  </button>
                )}
                <button
                  onClick={() => {
                    const owner = (!showAll && currentUser?.name2) ? currentUser.name2 : undefined;
                    void loadCompanies(owner);
                  }}
                  disabled={loadingCo}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCo ? 'animate-spin' : ''}`} />
                  更新
                </button>
              </div>
            </div>
          </div>

          {/* 2カラムレイアウト */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* 左パネル: 企業選択 */}
            <div className="w-80 flex-shrink-0 border-r bg-white flex flex-col overflow-hidden">
              <div className="p-3 border-b space-y-2 flex-shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="企業名で絞り込み..."
                    className="pl-8 text-sm h-8"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="text-[10px] text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
                    >
                      全選択
                    </button>
                    <span className="text-slate-200">|</span>
                    <button
                      onClick={clearAll}
                      className="text-[10px] text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
                    >
                      解除
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {selectedUids.size > 0 ? `${selectedUids.size}件選択中` : `${filtered.length}件`}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {loadingCo ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    読み込み中…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">該当なし</p>
                ) : (
                  filtered.map(company => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      selected={selectedUids.has(company.id)}
                      onToggle={() => toggleCompany(company.id)}
                      channels={channelMap[company.id]}
                      activeChannels={selectedChannels}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 右パネル: メッセージ作成・送信 */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-5">

                {/* チャンネル選択（複数選択可） */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">送信チャンネル <span className="text-slate-400 font-normal">（複数選択可）</span></Label>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ALL_CHANNELS.map(ch => {
                      const meta     = CHANNEL_META[ch];
                      const isActive = selectedChannels.has(ch);
                      return (
                        <button
                          key={ch}
                          onClick={() => {
                            setSelectedChannels(prev => {
                              const next = new Set(prev);
                              if (next.has(ch)) {
                                if (next.size === 1) return prev;
                                next.delete(ch);
                              } else {
                                next.add(ch);
                              }
                              return next;
                            });
                            setSummary(null);
                          }}
                          className={[
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors',
                            isActive
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {meta.icon}
                          {meta.label}
                        </button>
                      );
                    })}
                    {selectedChannels.has('chatwork') && (
                      <span className="text-[10px] text-slate-400 ml-1">
                        Chatworkは自動変換
                      </span>
                    )}
                  </div>
                  {/* 全員メンション */}
                  {(selectedChannels.has('slack') || selectedChannels.has('chatwork')) && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setMentionAll(v => !v)}
                        className={[
                          'flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border transition-colors',
                          mentionAll
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        <span className="font-mono text-[10px]">@</span>
                        全員にメンション
                      </button>
                      {mentionAll && (
                        <span className="text-[10px] text-slate-400">
                          {selectedChannels.has('slack') && <span className="mr-1">{'Slack: <!channel>'}</span>}
                          {selectedChannels.has('chatwork') && <span>{'Chatwork: [toall]'}</span>}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Mail 送信モード */}
                  {selectedChannels.has('mail') && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-slate-500">Mail 送信モード:</span>
                      {(['per_company', 'per_person'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setSendMode(mode)}
                          className={[
                            'text-[11px] px-2.5 py-1 rounded border transition-colors',
                            sendMode === mode
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          {mode === 'per_company' ? '1社1通' : '1人1通'}
                        </button>
                      ))}
                      <span className="text-[10px] text-slate-400">
                        {sendMode === 'per_person' ? '各コンタクトに個別送信' : '宛先選択で1社に1通'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 件名（常に表示） */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">件名</Label>
                    <span className="text-[10px] text-slate-400">
                      {selectedChannels.has('mail') ? 'Mail 件名 / Slack・Chatwork は先頭行に付加' : 'Slack・Chatwork は先頭行に付加'}
                    </span>
                  </div>
                  <Input
                    value={subject}
                    onChange={e => { setSubject(e.target.value); setSummary(null); }}
                    placeholder="件名を入力（省略可）"
                    className="text-sm h-9"
                  />
                </div>

                {/* 本文 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      本文 <span className="text-red-500">*</span>
                    </Label>
                    <span className="text-[10px] text-slate-400">
                      変数: <code className="bg-slate-100 px-1 rounded text-[10px]">{'{{company_name}}'}</code>
                      {' '}<code className="bg-slate-100 px-1 rounded text-[10px]">{'{{name}}'}</code>
                    </span>
                  </div>
                  <RichMessageEditor
                    value={message}
                    onChange={html => { setMessage(html); setSummary(null); }}
                    placeholder="メッセージを入力..."
                    minHeight={140}
                  />
                  <p className="text-[10px] text-slate-400">
                    {message.replace(/<[^>]*>/g, '').trim().length} 文字
                  </p>
                </div>

                {/* 送信先プレビュー */}
                {selectedUids.size > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">送信先プレビュー</Label>
                      {loadingCh && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          チャンネル確認中…
                        </span>
                      )}
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                      {previewTargets.length === 0 ? (
                        <p className="text-xs text-slate-400 px-4 py-3 text-center">選択中の企業を読み込み中...</p>
                      ) : (
                        previewTargets.map(({ company, perChannel }) => (
                          <div key={company.id} className="flex items-center gap-3 px-4 py-2.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-sm text-slate-700 flex-1 truncate">{company.name}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {perChannel.map((entry) => {
                                const meta      = CHANNEL_META[entry.type];
                                const available = entry.type === 'mail'
                                  ? !!(entry.ch?.contacts?.length)
                                  : !!entry.ch;
                                return available ? (
                                  <span key={entry.type} className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                    <Check className="w-2.5 h-2.5" />
                                    {meta.label}
                                    {entry.type === 'mail' && entry.ch && (
                                      <span className="ml-0.5 text-green-400">{entry.ch.contacts.length}名</span>
                                    )}
                                  </span>
                                ) : (
                                  <span key={entry.type} className="flex items-center gap-0.5 text-[10px] text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    {meta.label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {totalSendableChannels > 0 && (
                      <p className="text-[10px] text-slate-500">
                        送信可能: <span className="font-semibold text-slate-700">{canSendCount}</span> 社
                        {selectedChannels.size > 1 && (
                          <span className="ml-1 text-slate-400">/ {totalSendableChannels} 件</span>
                        )}
                        {selectedUids.size - canSendCount > 0 && (
                          <span className="ml-2 text-slate-400">スキップ: {selectedUids.size - canSendCount} 社</span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* 送信結果サマリー */}
                {summary && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-slate-700">送信完了</span>
                      <div className="flex items-center gap-3 ml-auto text-xs">
                        <span className="text-green-600">送信成功: {summary.sentCount}</span>
                        {summary.failedCount > 0 && (
                          <span className="text-red-500">失敗: {summary.failedCount}</span>
                        )}
                        {summary.skippedCount > 0 && (
                          <span className="text-slate-400">スキップ: {summary.skippedCount}</span>
                        )}
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {summary.results.map(r => (
                        <div key={r.companyUid} className="flex items-center gap-3 px-4 py-2">
                          <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-700 flex-1 truncate">{r.companyName}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            {r.channels.map(ch => {
                              const meta = CHANNEL_META[ch.type];
                              return ch.status === 'sent' ? (
                                <Badge key={ch.type} variant="outline" className="text-[10px] py-0 text-green-600 border-green-200 gap-0.5">
                                  {meta.icon} {meta.label}
                                </Badge>
                              ) : ch.status === 'failed' ? (
                                <Badge key={ch.type} variant="outline" className="text-[10px] py-0 text-red-500 border-red-200 gap-0.5" title={ch.error}>
                                  {meta.icon} 失敗
                                </Badge>
                              ) : null;
                            })}
                            {r.channels.every(ch => ch.status === 'no_channel') && (
                              <Badge variant="outline" className="text-[10px] py-0 text-slate-400">スキップ</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </div>

              {/* 固定フッター: 送信ボタン */}
              <div className="border-t bg-white px-6 py-3 flex-shrink-0">
                <div className="max-w-2xl mx-auto flex items-center justify-end gap-3">
                  {selectedUids.size === 0 && (
                    <p className="text-xs text-slate-400 flex-1">左パネルから送信先企業を選択してください</p>
                  )}
                  {totalSendableChannels === 0 && selectedUids.size > 0 && (
                    <p className="text-xs text-amber-600 flex-1">
                      選択中の企業に設定済みチャンネルがありません
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleOpenTestSend}
                    disabled={isMessageEmpty}
                    className="gap-1.5 text-slate-600"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    テスト送信
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={sending || isMessageEmpty || totalSendableChannels === 0}
                    className="gap-1.5"
                  >
                    {sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {sending
                      ? '送信中...'
                      : `宛先確認・プレビュー（${canSendCount}社）`}
                  </Button>
                </div>
              </div>
            </div>

          </div>
          </>)}
        </main>
      </div>

      {/* コンタクト選択ダイアログ（Mail チャンネル選択時） */}
      {showContactPicker && (
        <ContactPickerDialog
          companies={companies.filter(c => selectedUids.has(c.id))}
          channelMap={channelMap}
          mailTargets={mailTargets}
          sendMode={sendMode}
          onChangeTargets={handleChangeTargets}
          onConfirm={handleConfirmSend}
          onCancel={() => setShowContactPicker(false)}
          sending={sending}
          selectedChannels={selectedChannels}
          perCompanyChannels={perCompanyChannels}
          onChangePerCompanyChannels={handleChangePerCompanyChannels}
          savedAudiences={savedAudiences}
          onSaveAudience={handleSaveAudience}
          onLoadAudience={handleLoadAudience}
        />
      )}

      {showPreview && (
        <PreviewAndTestDialog
          selectedChannels={selectedChannels}
          message={message}
          subject={subject}
          testChannels={testChannels}
          showActualSend={previewForActualSend}
          mentionAll={mentionAll}
          testMailTo={testMailTo}
          setTestMailTo={setTestMailTo}
          onTestSend={handleTestSend}
          onActualSend={handleActualSendFromPreview}
          onClose={() => { setShowPreview(false); setTestResult(null); }}
          testSending={testSending}
          testResult={testResult}
        />
      )}
    </div>
  );
}
