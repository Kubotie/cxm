// ─── POST /api/ops/company-people/deduplicate ────────────────────────────────
// company_people テーブルの重複行（同一 email + 同一 name）を削除する。
//
// デフォルトはドライラン（確認のみ）。実際に削除するには ?confirm=true を付ける。
//
// 残すレコードの選択基準:
//   1. 非 null / 非空フィールドが最も多い行
//   2. 同数の場合は Id が最小（最も古い）行
//
// レスポンス:
//   { dryRun, groups, willDeleteCount, deletedCount?, errors? }

import { NextResponse } from 'next/server';
import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoDelete } from '@/lib/nocodb/write';
import type { RawCompanyPerson } from '@/lib/nocodb/types';

const FIELDS_TO_SCORE: (keyof RawCompanyPerson)[] = [
  'role', 'title', 'department', 'phone',
  'decision_influence', 'contact_status', 'status',
  'last_touchpoint', 'manager_id', 'owner', 'sf_id',
  'sync_status', 'layer_role', 'reports_to_person_id',
  'works_with_person_ids', 'display_group', 'stakeholder_note',
];

function scoreRow(row: RawCompanyPerson): number {
  return FIELDS_TO_SCORE.filter(f => row[f] != null && row[f] !== '').length;
}

/** 全件取得（100 件ずつページング） */
async function fetchAllCompanyPeople(): Promise<RawCompanyPerson[]> {
  const tableId = TABLE_IDS.company_people;
  if (!tableId) throw new Error('NOCODB_COMPANY_PEOPLE_TABLE_ID が未設定です');

  const all: RawCompanyPerson[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const page = await nocoFetch<RawCompanyPerson>(tableId, {
      limit:  String(pageSize),
      offset: String(offset),
      sort:   'Id',
    }, false);
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export async function POST(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get('confirm') !== 'true';

  try {
    const rows = await fetchAllCompanyPeople();

    // email + name（大文字小文字無視）でグループ化
    // email が空/null の行は対象外
    const groups = new Map<string, RawCompanyPerson[]>();
    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      const name  = row.name?.trim().toLowerCase();
      if (!email || !name) continue;
      const key = `${email}||${name}`;
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }

    // 重複グループのみ抽出
    const duplicateGroups = [...groups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => {
        const [email, name] = key.split('||');
        // スコアが最大、同スコアなら Id 最小の行を残す
        const sorted = [...rows].sort((a, b) => {
          const sd = scoreRow(b) - scoreRow(a);
          return sd !== 0 ? sd : a.Id - b.Id;
        });
        const keep   = sorted[0];
        const remove = sorted.slice(1);
        return { email, name, keep, remove };
      });

    const willDeleteCount = duplicateGroups.reduce((s, g) => s + g.remove.length, 0);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        groupCount: duplicateGroups.length,
        willDeleteCount,
        groups: duplicateGroups.map(g => ({
          email:     g.email,
          name:      g.name,
          keepId:    g.keep.Id,
          keepScore: scoreRow(g.keep),
          removeIds: g.remove.map(r => r.Id),
        })),
      });
    }

    // 実削除
    const errors: string[] = [];
    let deletedCount = 0;
    for (const group of duplicateGroups) {
      for (const row of group.remove) {
        try {
          await nocoDelete(TABLE_IDS.company_people!, row.Id);
          deletedCount++;
        } catch (e) {
          errors.push(`Id=${row.Id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    return NextResponse.json({
      dryRun: false,
      groupCount: duplicateGroups.length,
      willDeleteCount,
      deletedCount,
      ...(errors.length > 0 ? { errors } : {}),
    });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
