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
} from "@/lib/outbound/format-converter";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";
import type { AppCompany } from "@/lib/nocodb/types";
import type { OutboundChannelsResponse, MailContactInfo } from "@/app/api/outbound/channels/route";
import type { AppUserProfile } from "@/lib/nocodb/user-profile";
import type { OutboundCampaign } from "@/app/api/outbound/campaigns/route";

// ── 型 ────────────────────────────────────────────────────────────────────────

type OutboundChannel = 'slack' | 'chatwork' | 'mail';

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
  cc: string[];                           // CC（複数可、任意）
}

// 社内アドレス（CC 候補として常に表示）
const INTERNAL_CC: { name: string; email: string }[] = [
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
      : !!(channels?.[ch]);

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
        <div className="flex gap-1 mt-1">
          {ALL_CHANNELS.map(t => (
            <ChannelBadge key={t} type={t} has={hasChannel(t)} isActive={activeChannels.has(t)} />
          ))}
        </div>
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
}: {
  companies:       AppCompany[];
  channelMap:      OutboundChannelsResponse;
  mailTargets:     Map<string, MailTarget>;
  sendMode:        'per_company' | 'per_person';
  onChangeTargets: (companyUid: string, target: MailTarget) => void;
  onConfirm:       () => void;
  onCancel:        () => void;
  sending:         boolean;
}) {
  const companiesWithMail = companies.filter(
    c => (channelMap[c.id]?.mail?.contacts?.length ?? 0) > 0,
  );

  function toggleTo(uid: string, email: string, name: string) {
    const cur = mailTargets.get(uid) ?? { to: [], cc: [] };
    const newTo = cur.to.some(t => t.email === email)
      ? cur.to.filter(t => t.email !== email)
      : [...cur.to, { email, name }];
    onChangeTargets(uid, { ...cur, to: newTo });
  }

  function toggleCc(uid: string, email: string) {
    const cur = mailTargets.get(uid) ?? { to: [], cc: [] };
    const newCc = cur.cc.includes(email)
      ? cur.cc.filter(e => e !== email)
      : [...cur.cc, email];
    onChangeTargets(uid, { ...cur, cc: newCc });
  }

  const isValid = sendMode === 'per_person'
    ? companiesWithMail.some(c => (mailTargets.get(c.id)?.to?.length ?? 0) > 0)
    : companiesWithMail.every(c => (mailTargets.get(c.id)?.to?.length ?? 0) > 0);

  const subtitle = sendMode === 'per_person'
    ? '各コンタクトに個別でメールが届きます（{{name}} が名前に置換されます）'
    : 'To（必須・複数可）と CC（任意・複数可）を設定してください';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">送信先コンタクトを選択</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {companiesWithMail.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">メール連絡先のある企業がありません</p>
          ) : sendMode === 'per_person' ? (
            // ── 1人1通モード: 企業ごとに平リスト ─────────────────────────────
            companiesWithMail.map(company => {
              const contacts = channelMap[company.id]?.mail?.contacts ?? [];
              const target   = mailTargets.get(company.id) ?? { to: [], cc: [] };
              return (
                <div key={company.id} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-slate-700 truncate">{company.name}</p>
                  </div>
                  <div className="p-3 space-y-1">
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
                  </div>
                </div>
              );
            })
          ) : (
            // ── 1社1通モード: To / CC 選択 ───────────────────────────────────
            companiesWithMail.map(company => {
              const contacts = channelMap[company.id]?.mail?.contacts ?? [];
              const target   = mailTargets.get(company.id) ?? { to: [], cc: [] };

              return (
                <div key={company.id} className="border border-slate-100 rounded-xl overflow-hidden">
                  {/* 企業ヘッダー */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-slate-700 truncate">{company.name}</p>
                    {target.to.length === 0 && (
                      <span className="ml-auto text-[10px] text-red-500 flex-shrink-0">To を1名以上選択</span>
                    )}
                  </div>

                  <div className="p-3 space-y-4">
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
                      </div>
                    </div>

                    {/* CC セクション */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">CC</p>
                      <div className="space-y-1">
                        {/* 顧客コンタクト */}
                        {contacts.map(contact => {
                          const checked = target.cc.includes(contact.email);
                          return (
                            <label
                              key={contact.email}
                              className={[
                                'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                                checked ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                              ].join(' ')}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCc(company.id, contact.email)}
                                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">{contact.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {contact.email}
                                  {contact.role && <span className="ml-1.5 text-slate-400">· {contact.role}</span>}
                                </p>
                              </div>
                            </label>
                          );
                        })}

                        {/* 社内アドレス区切り */}
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex-1 h-px bg-slate-100" />
                          <span className="text-[9px] text-slate-400 flex-shrink-0">社内アドレス</span>
                          <div className="flex-1 h-px bg-slate-100" />
                        </div>

                        {/* 社内アドレス */}
                        {INTERNAL_CC.map(internal => {
                          const checked = target.cc.includes(internal.email);
                          return (
                            <label
                              key={internal.email}
                              className={[
                                'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                                checked ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50',
                              ].join(' ')}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCc(company.id, internal.email)}
                                className="accent-blue-600 w-3.5 h-3.5 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">{internal.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{internal.email}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t flex-shrink-0">
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
  );
}

// ── プレビュー & テスト送信ダイアログ ────────────────────────────────────────

function PreviewAndTestDialog({
  selectedChannels,
  message,
  subject,
  testChannels,
  showActualSend,
  testMailEmail,
  setTestMailEmail,
  onTestSend,
  onActualSend,
  onClose,
  testSending,
  testResult,
}: {
  selectedChannels: Set<OutboundChannel>;
  message:          string;
  subject:          string;
  testChannels:     OutboundChannelsResponse;
  showActualSend:   boolean;
  testMailEmail:    string;
  setTestMailEmail: (v: string) => void;
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
    return subject.trim() ? addSubjectToSlack(subject.trim(), body) : body;
  }, [message, subject]);

  const chatworkPreview = useMemo(() => {
    const body = htmlToChatwork(message);
    return subject.trim() ? addSubjectToChatwork(subject.trim(), body) : body;
  }, [message, subject]);

  const testSlackChannels = useMemo(() =>
    Object.entries(testChannels)
      .filter(([, ch]) => ch.slack)
      .map(([uid, ch]) => ({ uid, ...ch.slack! })),
    [testChannels]);

  const testChatworkChannels = useMemo(() =>
    Object.entries(testChannels)
      .filter(([, ch]) => ch.chatwork)
      .map(([uid, ch]) => ({ uid, ...ch.chatwork! })),
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
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={testMailEmail}
                  onChange={e => setTestMailEmail(e.target.value)}
                  placeholder="テスト送信先メールアドレス（自分のアドレス）"
                  className="text-sm h-9 flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTestSend('mail')}
                  disabled={testSending || !testMailEmail.trim()}
                  className="gap-1.5 flex-shrink-0"
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
  const [campaigns,  setCampaigns]  = useState<OutboundCampaign[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
      await fetch(`/api/outbound/campaigns/${c.Id}`, { method: 'DELETE' });
      void load();
    } finally {
      setDeletingId(null);
    }
  }

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ops';
  const mine    = currentUser?.name2;

  // admin は全件、csm は自分が作成したもののみ
  const visible = isAdmin ? campaigns : campaigns.filter(c => c.created_by === mine);

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
                  key={c.Id ?? idx}
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

  const [sending,          setSending]          = useState(false);
  const [summary,          setSummary]          = useState<SendSummary | null>(null);
  const [currentUser,      setCurrentUser]      = useState<AppUserProfile | null>(null);
  const [showAll,          setShowAll]          = useState(false);

  // Mail コンタクト選択ダイアログ
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [mailTargets,       setMailTargets]       = useState<Map<string, MailTarget>>(new Map());
  const [sendMode,          setSendMode]          = useState<'per_company' | 'per_person'>('per_company');

  // プレビュー & テスト送信ダイアログ
  const [showPreview,      setShowPreview]      = useState(false);
  const [savedMailTargets, setSavedMailTargets] = useState<Map<string, MailTarget>>(new Map());
  const [testChannels,     setTestChannels]     = useState<OutboundChannelsResponse>({});
  const [testMailEmail,    setTestMailEmail]    = useState('');
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
    setSelectedUids(new Set());
    setSelectedChannels(new Set(['slack']));
    setSubject('');
    setMessage('');
    setSummary(null);
    setView('editor');
  }

  function openEdit(campaign: OutboundCampaign) {
    setEditingCampaign(campaign);
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
      title:        patch.title ?? editingCampaign?.title ?? '（無題）',
      channels:     JSON.stringify([...selectedChannels]),
      subject:      subject.trim(),
      message,
      company_uids: JSON.stringify([...selectedUids]),
      ...patch,
    };
    if (editingCampaign) {
      await fetch(`/api/outbound/campaigns/${editingCampaign.Id}`, {
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
      const params = new URLSearchParams({ limit: '500' });
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
            return { type: t as 'slack' | 'chatwork', ch: channelMap[uid]?.[t] };
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
            cc: t.cc,
          }));

      const res = await fetch('/api/outbound/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          companyUids:  [...selectedUids],
          channels:     [...selectedChannels],
          message,                            // HTML (Tiptap 出力)
          subject:      subject.trim() || undefined,
          mailTargets:  mailTargetsArr,
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

    if (selectedChannels.has('mail')) {
      // コンタクト選択ダイアログを開く（各企業の第1候補をデフォルト To 選択）
      const initTargets = new Map<string, MailTarget>();
      for (const uid of selectedUids) {
        const contacts = channelMap[uid]?.mail?.contacts;
        if (contacts && contacts.length > 0) {
          initTargets.set(uid, {
            to: [{ email: contacts[0].email, name: contacts[0].name }],
            cc: [],
          });
        }
      }
      setMailTargets(initTargets);
      setShowContactPicker(true);
      return;
    }

    await doSend(new Map());
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
        if (!testMailEmail.trim()) {
          setTestResult('❌ メールアドレスを入力してください');
          return;
        }
        body = {
          companyUids:             ['__test__'],
          channels:                ['mail'],
          message,
          subject:                 subject.trim() || undefined,
          mailTargets:             [{ companyUid: '__test__', to: [{ email: testMailEmail.trim(), name: '担当者' }], cc: [] }],
          _testCompanyNameOverride: previewCompanyName,
        };
      } else {
        const testUids = Object.entries(testChannels)
          .filter(([, ch]) => !!(ch as Record<string, unknown>)[channel])
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

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-hidden flex flex-col">

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
                  <h1 className="text-base font-semibold text-slate-900">
                    {editingCampaign?.title || '新規キャンペーン'}
                  </h1>
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
          <div className="flex flex-1 overflow-hidden">

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
                        {sendMode === 'per_person' ? '各コンタクトに個別送信' : 'To/CC 設定で1社に1通'}
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

                {/* 送信ボタン */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {selectedUids.size === 0 && (
                    <p className="text-xs text-slate-400 flex-1">左パネルから送信先企業を選択してください</p>
                  )}
                  {totalSendableChannels === 0 && selectedUids.size > 0 && (
                    <p className="text-xs text-amber-600 flex-1">
                      選択中の企業に設定済みチャンネルがありません
                    </p>
                  )}
                  {/* テスト送信ボタン（メッセージがあれば常に表示） */}
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
                      : selectedChannels.has('mail')
                      ? `宛先を選択してプレビュー（${canSendCount}社）`
                      : `送信する（${canSendCount}社 / ${totalSendableChannels}件）`}
                  </Button>
                </div>

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
        />
      )}

      {showPreview && (
        <PreviewAndTestDialog
          selectedChannels={selectedChannels}
          message={message}
          subject={subject}
          testChannels={testChannels}
          showActualSend={previewForActualSend}
          testMailEmail={testMailEmail}
          setTestMailEmail={setTestMailEmail}
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
