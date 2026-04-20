// ─── POST /api/company/[companyUid]/contact-candidates ───────────────────────
//
// ログ（Chatwork / Slack / Notion議事録）に登場する送信者・参加者名を抽出し、
// 既存 company_people レコードと照合して「連絡先候補」リストを返す。
//
// ── ソース別の抽出精度 ────────────────────────────────────────────────────────
//   Chatwork (★★★):
//     実カラム account_name → senderName にマッピング済み。
//     社内ユーザーは "PT_..." プレフィックスで識別してスキップ。
//     is_outbound カラムは存在しないため全メッセージを対象にするが、
//     PT_ フィルタで社内ユーザーはほぼ除外できる。
//
//   Slack (★★):
//     実カラム account_name → userName にマッピング済み。
//     社内ユーザーは "/Ptmind" or "/ptmind" サフィックスで識別してスキップ。
//     ただし "firstname.lastname" 形式（社内ユーザー名）は判別困難。
//
//   Notion (★):
//     participants カラムが実テーブルに存在しないため 0 件。
//     → weakSources に分類して UI で「構造的制約あり」として表示する。
//
// ── 照合ロジック ──────────────────────────────────────────────────────────────
//   既存 people と名前の類似度スコアを算出:
//     1.0 = 完全一致 / 0.8 = 片方が片方を含む / 0 = 一致なし
//
// ── テーブル未設定の場合 ──────────────────────────────────────────────────────
//   TABLE_IDS が空のソースは skippedSources に返し、処理をスキップする。
//   テーブルIDが設定されていてもデータが0件なら emptySources に返す。
//   データがあるが候補抽出に不向きなソースは weakSources に返す。

import { NextResponse } from 'next/server';
import { TABLE_IDS } from '@/lib/nocodb/client';
import {
  fetchChatworkLogs,
  fetchSlackLogs,
  fetchNotionMinutes,
} from '@/lib/nocodb/communication-logs';
import { fetchPeople } from '@/lib/nocodb/people';
import type {
  ContactCandidate,
  ContactCandidateSource,
  ContactCandidatesResult,
} from '@/lib/company/contact-candidate';

// ── 名前類似度スコア ──────────────────────────────────────────────────────────

function nameSimilarity(a: string, b: string): number {
  const na = a.trim().toLowerCase().replace(/\s+/g, '');
  const nb = b.trim().toLowerCase().replace(/\s+/g, '');
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  return 0;
}

// ── システム名・ボット名・社内ユーザーフィルタ ────────────────────────────────
//
// 社内ユーザーの識別パターン（実テーブルから確認済み）:
//   Chatwork: "PT_" プレフィックス（例: "PT_笠原吾郎/Goro Kasahara"）
//   Slack:    "/Ptmind" サフィックス（例: "窪田/Ptmind"）
//             "ptmind" を名前に含む
//             "firstname.lastnameNNN" 形式（番号付きユーザー名）は判別困難 → そのまま

const SKIP_NAMES = new Set([
  'bot', 'system', 'システム', 'admin', 'アドミン', 'サポート', 'support',
  'ptengine', 'ptmind', '自動', 'auto', 'notification', '通知',
]);

function isValidName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  const lower = name.trim().toLowerCase();
  if (SKIP_NAMES.has(lower)) return false;
  // メールアドレスっぽい文字列はスキップ
  if (lower.includes('@')) return false;
  // Chatwork 社内ユーザー: "PT_" プレフィックス
  if (name.trimStart().startsWith('PT_') || name.trimStart().startsWith('pt_')) return false;
  // Slack 社内ユーザー: "/Ptmind" or "/ptmind" サフィックス
  if (lower.endsWith('/ptmind')) return false;
  // ptmind を名前に含む
  if (lower.includes('ptmind')) return false;
  return true;
}

// ── 信頼度計算 ────────────────────────────────────────────────────────────────
//
// 名前文字列から「実名らしさ」を推定する。
// 完全な NLP は不要 — 以下の簡易ルールで十分な精度が得られる:
//   high   — 日本語文字列 / 英語フルネーム（スペース区切り2語以上）
//   low    — ユーザー名形式: 英数字+ドット+2桁以上の数字で終わる（"kiichi.fukuyama383"）
//   medium — その他

function calcConfidence(name: string): 'high' | 'medium' | 'low' {
  const trimmed = name.trim();
  // ユーザー名形式 (e.g. "kiichi.fukuyama383") → low
  if (/^[a-z][a-z0-9._-]+\d{2,}$/i.test(trimmed)) return 'low';
  // 日本語（ひらがな/カタカナ/漢字）を含む → high
  if (/[\u3040-\u9fff]/.test(trimmed)) return 'high';
  // 英語フルネーム（スペース区切り2語以上、英字のみ）→ high
  if (/^[A-Za-z]+\s+[A-Za-z]+/.test(trimmed)) return 'high';
  return 'medium';
}

function calcWhyPicked(source: ContactCandidateSource, confidence: 'high' | 'medium' | 'low'): string {
  if (source === 'chatwork') {
    return 'Chatwork 送信者名（社内 PT_ ユーザー除外済み）';
  }
  if (source === 'slack') {
    if (confidence === 'low') return 'Slack ユーザー名 — ユーザー名形式のため実名でない可能性あり';
    return 'Slack 送信者名（社内 /Ptmind ユーザー除外済み）';
  }
  return 'Notion 議事録参加者';
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  // ── 既存 people を取得（照合用） ─────────────────────────────────────────────
  const existingPeople = await fetchPeople(companyUid).catch(() => []);

  // ── 各ソースからログを取得 ───────────────────────────────────────────────────
  const skippedSources: ContactCandidateSource[] = [];
  const emptySources:   ContactCandidateSource[] = [];
  const weakSources:    ContactCandidateSource[] = [];
  const rawCandidates: Array<{
    name:       string;
    source:     ContactCandidateSource;
    sourceRef:  string;
    excerpt?:   string;
    confidence: 'high' | 'medium' | 'low';
    whyPicked:  string;
  }> = [];

  // ── Chatwork (★★★) — account_name（社内 PT_ ユーザーを除外済み）─────────────
  // 実テーブルカラム: account_name（旧設計の sender_name に相当）
  // is_outbound カラムは存在しない → 全メッセージを対象に PT_ フィルタで社内除外
  if (!TABLE_IDS.log_chatwork) {
    skippedSources.push('chatwork');
  } else {
    const logs = await fetchChatworkLogs(companyUid, 200).catch(() => []);
    if (logs.length === 0) {
      emptySources.push('chatwork');
    } else {
      let added = 0;
      for (const log of logs) {
        if (log.senderName && isValidName(log.senderName)) {
          const conf = calcConfidence(log.senderName);
          rawCandidates.push({
            name:       log.senderName,
            source:     'chatwork',
            sourceRef:  `Chatwork ${log.sentAt?.slice(0, 10) ?? ''}`.trim(),
            excerpt:    log.body ? log.body.slice(0, 80) : undefined,
            confidence: conf,
            whyPicked:  calcWhyPicked('chatwork', conf),
          });
          added++;
        }
      }
      if (added === 0) emptySources.push('chatwork');
    }
  }

  // ── Slack (★★) — account_name（/Ptmind サフィックスユーザーを除外済み）────────
  // 実テーブルカラム: account_name（旧設計の user_name に相当）
  if (!TABLE_IDS.log_slack) {
    skippedSources.push('slack');
  } else {
    const logs = await fetchSlackLogs(companyUid, 200).catch(() => []);
    if (logs.length === 0) {
      emptySources.push('slack');
    } else {
      let added = 0;
      for (const log of logs) {
        if (log.userName && isValidName(log.userName)) {
          const conf = calcConfidence(log.userName);
          rawCandidates.push({
            name:       log.userName,
            source:     'slack',
            sourceRef:  `Slack ${log.channel ?? ''} ${log.sentAt?.slice(0, 10) ?? ''}`.trim(),
            excerpt:    log.text ? log.text.slice(0, 80) : undefined,
            confidence: conf,
            whyPicked:  calcWhyPicked('slack', conf),
          });
          added++;
        }
      }
      if (added === 0) emptySources.push('slack');
    }
  }

  // ── Notion (★) — participants カラムが実テーブルに存在しない ─────────────────
  // 実テーブルに participants カラムなし → log.participants は常に []
  // データがあっても候補抽出できないため weakSources に分類する
  if (!TABLE_IDS.log_notion_minutes) {
    skippedSources.push('notion_minutes');
  } else {
    const logs = await fetchNotionMinutes(companyUid, 100).catch(() => []);
    if (logs.length === 0) {
      emptySources.push('notion_minutes');
    } else {
      // participants カラムが存在しないため全 log の participants は []
      const hasAnyParticipant = logs.some(l => l.participants.length > 0);
      if (!hasAnyParticipant) {
        // データはあるが participants カラムなし → 構造的制約
        weakSources.push('notion_minutes');
      } else {
        for (const log of logs) {
          for (const participant of log.participants) {
            if (isValidName(participant)) {
              const conf = calcConfidence(participant.trim());
              rawCandidates.push({
                name:       participant.trim(),
                source:     'notion_minutes',
                sourceRef:  log.title !== '(タイトルなし)' ? log.title : `議事録 ${log.meetingDate ?? ''}`,
                excerpt:    `議事録「${log.title}」の参加者`,
                confidence: conf,
                whyPicked:  calcWhyPicked('notion_minutes', conf),
              });
            }
          }
        }
      }
    }
  }

  // ── 名前で deduplicate（同名は最初の出現を代表として使う） ───────────────────
  const seenNames = new Map<string, typeof rawCandidates[number]>();
  for (const c of rawCandidates) {
    const key = c.name.trim().toLowerCase().replace(/\s+/g, '');
    if (!seenNames.has(key)) seenNames.set(key, c);
  }

  // ── 既存 people と照合 ────────────────────────────────────────────────────────
  const candidates: ContactCandidate[] = [];

  for (const [, raw] of seenNames) {
    let bestMatch: ContactCandidate['existingMatch'] | undefined;
    for (const p of existingPeople) {
      const sim = nameSimilarity(raw.name, p.name);
      if (sim > 0 && (!bestMatch || sim > bestMatch.similarity)) {
        bestMatch = { id: p.id, name: p.name, similarity: sim };
      }
    }

    // 完全一致（sim=1.0）は既に登録済みのためスキップ
    if (bestMatch && bestMatch.similarity >= 1.0) continue;

    candidates.push({
      id:            crypto.randomUUID(),
      name:          raw.name,
      source:        raw.source,
      sourceRef:     raw.sourceRef,
      excerpt:       raw.excerpt,
      confidence:    raw.confidence,
      whyPicked:     raw.whyPicked,
      existingMatch: bestMatch,
    });
  }

  // 類似度が高い順に並べる（照合候補を上位に）
  candidates.sort((a, b) =>
    (b.existingMatch?.similarity ?? 0) - (a.existingMatch?.similarity ?? 0),
  );

  const result: ContactCandidatesResult = {
    candidates,
    emptySources,
    skippedSources,
    weakSources,
  };

  return NextResponse.json(result);
}
