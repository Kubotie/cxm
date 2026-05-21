// GET /api/outbound/channels?company_uids=uid1,uid2,...
// 指定した企業のチャンネル設定（Slack/Chatwork）と Mail コンタクト一覧を返す。

import { NextResponse }                    from 'next/server';
import { fetchChannelsByCompanyUids } from '@/lib/nocodb/company-channels';
import { fetchContactsByCompanyUids }      from '@/lib/nocodb/people';

export interface MailContactInfo {
  name:  string;
  email: string;
  role:  string | null;
}

export type OutboundChannelsResponse = Record<string, {
  slack?:    { channelId: string; channelName: string | null }[];
  chatwork?: { channelId: string; channelName: string | null }[];
  mail?:     { contacts: MailContactInfo[] };
}>;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uidsParam = searchParams.get('company_uids') ?? '';
  const uids = uidsParam
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

  if (uids.length === 0) {
    return NextResponse.json({} as OutboundChannelsResponse);
  }

  // Slack/Chatwork と Mail (company_people) を並行取得
  const [channelMap, contactMap] = await Promise.all([
    fetchChannelsByCompanyUids(uids).catch(() => new Map()),
    fetchContactsByCompanyUids(uids).catch(() => new Map()),
  ]);

  const result: OutboundChannelsResponse = {};
  for (const uid of uids) {
    const channels        = channelMap.get(uid) ?? [];
    const slackChannels   = channels.filter(c => c.type === 'slack');
    const chatworkChannels = channels.filter(c => c.type === 'chatwork');
    const contacts        = contactMap.get(uid) ?? [];
    result[uid] = {
      ...(slackChannels.length    > 0 && { slack:    slackChannels.map(c => ({ channelId: c.channelId, channelName: c.channelName })) }),
      ...(chatworkChannels.length > 0 && { chatwork: chatworkChannels.map(c => ({ channelId: c.channelId, channelName: c.channelName })) }),
      ...(contacts.length         > 0 && { mail: { contacts } }),
    };
  }

  return NextResponse.json(result);
}
