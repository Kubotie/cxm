// POST /api/outbound/send
// 指定企業に対して Slack / Chatwork / Mail へ複数チャンネル同時送信する。
// Chatwork 送信時は Slack 記法を自動変換する。
// Mail 送信時は Intercom API を使用し、プレーンテキストに変換する。
//
// Body: {
//   companyUids:  string[];
//   channels:     ('slack' | 'chatwork' | 'mail')[];
//   message:      string;           // Slack 形式で入力（本文）
//   subject?:     string;           // 件名（Mail: そのまま使用 / Slack・Chatwork: 先頭行に付加）
//   mailTargets?: { companyUid: string; email: string }[]; // Mail 宛先（コンタクト選択結果）
// }
// Response: {
//   results: {
//     companyUid:  string;
//     companyName: string;
//     channels: { type: 'slack'|'chatwork'|'mail'; status: 'sent'|'failed'|'no_channel'; error?: string }[];
//   }[]
//   sentCount:    number;
//   failedCount:  number;
//   skippedCount: number;
// }

import { NextResponse }                    from 'next/server';
import { getCurrentUserProfile }           from '@/lib/auth/session';
import { fetchChannelsByCompanyUids, groupChannelsByType, fetchSlackWorkspaceTokens } from '@/lib/nocodb/company-channels';
import { fetchAllCompanies }               from '@/lib/nocodb/companies';
import { sendSlackMessage }                from '@/lib/outbound/slack-sender';
import { sendChatworkMessage }             from '@/lib/outbound/chatwork-sender';
import { sendIntercomMail }                from '@/lib/outbound/intercom-sender';
import {
  htmlToSlack,
  htmlToChatwork,
  htmlToPlainText,
  addSubjectToSlack,
  addSubjectToChatwork,
  applyVariables,
} from '@/lib/outbound/format-converter';

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

export async function POST(req: Request) {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    companyUids?:              string[];
    channels?:                 string[];
    message?:                  string;   // HTML (Tiptap 出力)
    subject?:                  string;
    mailTargets?:              { companyUid: string; to: { email: string; name?: string }[]; cc: string[] }[];
    /** テスト送信時: 企業名変数を置き換えるための上書き値 */
    _testCompanyNameOverride?: string;
  };

  const { companyUids, channels, message, subject, mailTargets, _testCompanyNameOverride } = body;

  if (!companyUids?.length || !channels?.length || !message) {
    return NextResponse.json({ error: 'companyUids, channels, message は必須です' }, { status: 400 });
  }

  const validChannels: OutboundChannel[] = ['slack', 'chatwork', 'mail'];
  const targetChannels = channels.filter((c): c is OutboundChannel => validChannels.includes(c as OutboundChannel));
  if (targetChannels.length === 0) {
    return NextResponse.json({ error: 'channels は slack / chatwork / mail のいずれかを含む必要があります' }, { status: 400 });
  }

  // HTML → 各チャンネル形式に変換（変数適用前のベース）
  const slackBodyBase    = htmlToSlack(message);
  const chatworkBodyBase = htmlToChatwork(message);
  const plainBase        = htmlToPlainText(message);
  const mailSubjectBase  = subject ?? '';
  const intercomAdminId  = profile.intercom_admin_id ?? null;

  // Mail 宛先を companyUid → entries[] でグループ化（per_person は1人1エントリ）
  const mailTargetsByCompany = new Map<string, { to: { email: string; name?: string }[]; cc: string[] }[]>();
  for (const entry of mailTargets ?? []) {
    const arr = mailTargetsByCompany.get(entry.companyUid) ?? [];
    arr.push(entry);
    mailTargetsByCompany.set(entry.companyUid, arr);
  }

  // 企業名を解決（表示用）
  const allCompanies = await fetchAllCompanies(1000).catch(() => []);
  const companyNameMap = new Map<string, string>(
    allCompanies.map(c => [c.id, c.name] as [string, string]),
  );
  // テスト送信時: __test__ や test1/test2 などの企業名を上書き
  if (_testCompanyNameOverride) {
    for (const uid of companyUids) {
      if (!companyNameMap.has(uid) || uid.startsWith('test') || uid === '__test__') {
        companyNameMap.set(uid, _testCompanyNameOverride);
      }
    }
  }

  // チャンネル情報を取得（slack / chatwork のみ）
  const hasSlackOrChatwork = targetChannels.some(ch => ch !== 'mail');
  const channelMap = hasSlackOrChatwork
    ? await fetchChannelsByCompanyUids(companyUids).catch(() => new Map())
    : new Map();

  // 外部 Slack ワークスペース用 bot_token を事前取得
  const allChannels = [...channelMap.values()].flat();
  const extTeamIds = [...new Set(
    allChannels
      .filter(ch => ch.type === 'slack' && ch.extSlackWorkspace && ch.slackTeamId)
      .map(ch => ch.slackTeamId as string),
  )];
  const workspaceTokenMap = await fetchSlackWorkspaceTokens(extTeamIds).catch(() => new Map<string, string>());

  // 各企業へ並列送信
  const sendTasks = companyUids.map(async (uid): Promise<SendResult> => {
    const name            = companyNameMap.get(uid) ?? uid;
    const companyChannels = channelMap.get(uid) ?? [];
    const grouped         = groupChannelsByType(companyChannels);

    // Slack / Chatwork: 企業名変数を適用
    const slackMsg    = subject
      ? addSubjectToSlack(applyVariables(subject, name), applyVariables(slackBodyBase, name))
      : applyVariables(slackBodyBase, name);
    const chatworkMsg = subject
      ? addSubjectToChatwork(applyVariables(subject, name), applyVariables(chatworkBodyBase, name))
      : applyVariables(chatworkBodyBase, name);

    const channelResults = await Promise.all(
      targetChannels.map(async (ch): Promise<ChannelResult> => {
        if (ch === 'mail') {
          const entries = mailTargetsByCompany.get(uid) ?? [];
          if (entries.length === 0) return { type: 'mail', status: 'no_channel' };

          // 各エントリ（per_company=1社1通 / per_person=1人1通）を並列送信
          const sendResults = await Promise.all(
            entries.flatMap(entry => {
              const recipientName  = entry.to[0]?.name ?? '';
              const personalBody   = applyVariables(plainBase, name, recipientName);
              const personalSubject = applyVariables(mailSubjectBase, name, recipientName);
              const allEmails = [...new Set([
                ...(entry.to ?? []).map(t => t.email),
                ...(entry.cc ?? []),
              ])];
              return allEmails.map(email =>
                sendIntercomMail({ email }, personalSubject, personalBody, intercomAdminId),
              );
            }),
          );

          const failures = sendResults.filter(r => !r.ok);
          if (failures.length === 0) return { type: 'mail', status: 'sent' };
          if (failures.length === sendResults.length) {
            return { type: 'mail', status: 'failed', error: failures.map(r => r.error).join('; ') };
          }
          return {
            type: 'mail', status: 'sent',
            error: `${failures.length}件失敗: ${failures.map(r => r.error).join('; ')}`,
          };
        }

        const info = grouped[ch];
        if (!info) return { type: ch, status: 'no_channel' };

        // 外部ワークスペースの場合は専用 bot_token を使用
        const slackBotToken = (ch === 'slack' && info.extSlackWorkspace && info.slackTeamId)
          ? (workspaceTokenMap.get(info.slackTeamId) ?? null)
          : null;

        const sendResult = ch === 'slack'
          ? await sendSlackMessage(info.channelId, slackMsg, slackBotToken)
          : await sendChatworkMessage(info.channelId, chatworkMsg);

        return sendResult.ok
          ? { type: ch, status: 'sent' }
          : { type: ch, status: 'failed', error: sendResult.error };
      }),
    );

    return { companyUid: uid, companyName: name, channels: channelResults };
  });

  const results = await Promise.all(sendTasks);

  // 集計（企業×チャンネル単位）
  const allChannelResults = results.flatMap(r => r.channels);
  const sentCount    = allChannelResults.filter(r => r.status === 'sent').length;
  const failedCount  = allChannelResults.filter(r => r.status === 'failed').length;
  const skippedCount = allChannelResults.filter(r => r.status === 'no_channel').length;

  return NextResponse.json({ results, sentCount, failedCount, skippedCount });
}
