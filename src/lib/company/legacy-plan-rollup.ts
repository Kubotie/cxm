// ─── 旧プランの複数プロジェクト集約 ──────────────────────────────────────────
//
// 1社で有料プロジェクトが5件以上あるのは、旧プラン（1契約で複数プロジェクトを
// 持てた）の顧客だけである。新プランは1契約＝1プロジェクトなので、この形には
// ならない。
//
// 旧プランの顧客を1プロジェクトずつ数えると、実際には1つのプロジェクトで運用
// していても残りが「休眠」として並び、休眠件数が実態より大きく出る。
// そこで有料5件以上の会社は **代表プロジェクト1件だけを判定に数え**、残りは
// 同じ会社の配下として畳む（画面ではトグルで開く）。
//
// 代表は「最も使われているプロジェクト」を選ぶ。契約が1つなら、顧客が実際に
// 触っているプロジェクトがその契約の実態を表すため。
// （最も使われていない方を代表にすると、旧プラン顧客が常に休眠に見える）

/** これ以上の有料プロジェクトを持つ会社は旧プランと判断する */
export const LEGACY_MULTI_PROJECT_THRESHOLD = 5;

export interface RollupInput {
  projectId: string;
  /** 会社の識別子。null（会社未紐付け）は集約しない */
  companyKey: string | null;
  /** 有料プロジェクトか。無料は契約の件数に数えない */
  paid: boolean;
  activePv: number;
  activeModuleCount: number;
  l30Active: number;
}

export interface RollupMark {
  /** 旧プランと判断した会社（有料5件以上）のプロジェクトか */
  legacyGroup: boolean;
  /** 同じ会社の有料プロジェクト数 */
  groupSize: number;
  /** 判定に数えず代表プロジェクトの配下に畳むか */
  rolledUp: boolean;
  /** 集約先の代表プロジェクトID（自分が代表なら自分のID） */
  representativeId: string | null;
}

/** 使われている順。実態を代表させたいので PV → 機能数 → L30 の順で見る */
function usageRank(a: RollupInput, b: RollupInput): number {
  return b.activePv - a.activePv
    || b.activeModuleCount - a.activeModuleCount
    || b.l30Active - a.l30Active
    || a.projectId.localeCompare(b.projectId);
}

/** projectId → 集約の扱い。会社ごとの有料プロジェクト数から決める */
export function markLegacyRollup(
  rows: RollupInput[],
  threshold = LEGACY_MULTI_PROJECT_THRESHOLD,
): Map<string, RollupMark> {
  const byCompany = new Map<string, RollupInput[]>();
  for (const r of rows) {
    if (!r.paid || !r.companyKey) continue;
    const g = byCompany.get(r.companyKey) ?? [];
    g.push(r);
    byCompany.set(r.companyKey, g);
  }

  const marks = new Map<string, RollupMark>();
  for (const r of rows) {
    marks.set(r.projectId, {
      legacyGroup: false, groupSize: r.companyKey ? 0 : 1, rolledUp: false, representativeId: null,
    });
  }

  for (const group of byCompany.values()) {
    const legacy = group.length >= threshold;
    const sorted = legacy ? [...group].sort(usageRank) : group;
    const repId = legacy ? sorted[0].projectId : null;
    for (const r of group) {
      marks.set(r.projectId, {
        legacyGroup: legacy,
        groupSize: group.length,
        rolledUp: legacy && r.projectId !== repId,
        representativeId: legacy ? repId : null,
      });
    }
  }
  return marks;
}
