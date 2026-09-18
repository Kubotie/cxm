// ─── Tier 3 管理レポートの中身 ────────────────────────────────────────────────
//
// 画面（/v2/tier3）の絞り込み・並び順をそのまま持ち出すためのレポート定義。
// Excel（.xlsx）と Markdown（.md）で同じ列・同じ値を使う。片方だけ項目が増える
// と「どちらが正か」が分からなくなるため、列定義は1か所（COLUMNS）に置く。
//
// 出力するのは画面が取得済みのデータだけで、企業ごとの追加取得はしない。
// レポートのために数十本のAPIを叩くと、押した人が待たされるうえ、
// 画面に出ている数字とレポートの数字がずれる（取得時点が違う）ため。

import type {
  DashboardItem, Tier3DashboardResponse, AlarmType, Severity,
} from "@/app/api/companies/tier3-dashboard/route";
import type { ActionListItem } from "@/app/api/actions/route";
import type { SheetSpec, CellValue } from "@/lib/report/xlsx";

// ── ラベル ────────────────────────────────────────────────────────────────────

export const ALARM_LABEL: Record<AlarmType, string> = {
  pv_over:      "PV 超過・超過予測",
  renewal_soon: "更新 60 日以内",
  ops_drop:     "操作数 急減（前週比 −50%↓）",
  inactive_30:  "30 日以上 無活動 / 休眠",
  upsell:       "アップセル機会",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  red: "緊急", amber: "要対応", blue: "提案", green: "異常なし",
};

const PLAN_LABEL: Record<string, string> = {
  bundle: "Bundle", insight: "Insight", experience: "Experience",
};

const CONTRACT_STATUS_LABEL: Record<DashboardItem["contractStatus"], string> = {
  active: "契約中", trial: "トライアル", churned: "解約", unknown: "不明",
};

// ── 出力の前提（どの条件で切り出したか）──────────────────────────────────────

export interface Tier3ReportMeta {
  generatedAt: Date;
  /** データの最終更新（API の updatedAt） */
  updatedAt: string | null;
  snapshotDate: string | null;
  /** 適用中の絞り込みを人が読める形にしたもの */
  filterLabel: string;
  sortLabel: string;
  /** 絞り込み前の全件数 */
  totalCount: number;
  summary: Tier3DashboardResponse["summary"];
  counts: Tier3DashboardResponse["counts"];
  /** 企業リンクの起点（例: https://cxmx.vercel.app） */
  baseUrl: string;
}

// ── 列定義 ────────────────────────────────────────────────────────────────────

interface ReportColumn {
  header: string;
  width: number;
  value: (it: DashboardItem, meta: Tier3ReportMeta) => CellValue;
  /** Markdown の一覧表にも出す列か（全列を並べると横に読めなくなる） */
  inTable?: boolean;
}

const yesNo = (v: boolean): string => (v ? "○" : "—");

export const COLUMNS: ReportColumn[] = [
  { header: "企業名",         width: 28, inTable: true,  value: it => it.canonicalName },
  { header: "担当",           width: 12, inTable: true,  value: it => (it.owner === "—" ? "担当なし" : it.owner) },
  { header: "Tier",           width: 6,                  value: it => it.tier },
  { header: "重大度",         width: 9,  inTable: true,  value: it => SEVERITY_LABEL[it.severity] },
  { header: "アラーム",       width: 34, inTable: true,  value: it => it.alarms.map(a => ALARM_LABEL[a]).join(" / ") },
  { header: "主要理由",       width: 40,                 value: it => it.primaryReason },
  { header: "MRR",            width: 12, inTable: true,  value: it => it.mrr },
  { header: "プラン",         width: 11, inTable: true,  value: it => (it.plan ? PLAN_LABEL[it.plan] ?? it.plan : "—") },
  { header: "契約状態",       width: 11, inTable: true,  value: it => CONTRACT_STATUS_LABEL[it.contractStatus] },
  { header: "有料PJ数",       width: 10,                 value: it => it.paidProjectCount },
  { header: "PJ数",           width: 8,                  value: it => it.projectCount },
  { header: "契約更新日",     width: 12,                 value: it => it.renewalDate },
  { header: "更新区分",       width: 14,                 value: it => it.renewalBucket },
  { header: "オープンSupport", width: 14,                value: it => it.openSupportCount },
  { header: "PV消費率(%)",    width: 12, inTable: true,  value: it => it.pvRate },
  { header: "PV超過",         width: 9,                  value: it => yesNo(it.pvOver) },
  { header: "L30",            width: 8,  inTable: true,  value: it => it.l30Total },
  { header: "L7(今週)",       width: 10, inTable: true,  value: it => it.l7ThisWeek },
  { header: "L7(前週)",       width: 10,                 value: it => it.l7PrevWeek },
  { header: "前週比(%)",      width: 11, inTable: true,  value: it => it.wowPct },
  { header: "最終活動日",     width: 12, inTable: true,  value: it => it.lastActiveDate },
  { header: "無活動日数",     width: 11,                 value: it => it.daysSinceActive },
  { header: "持続休眠",       width: 10,                 value: it => yesNo(it.isChronicSilent) },
  { header: "休眠判定時L30",  width: 13,                 value: it => it.chronicSilentL30 },
  { header: "優先度スコア",   width: 12,                 value: it => it.priorityScore },
  { header: "有料ウォッチ",   width: 12,                 value: it => yesNo(it.isPaidWatched) },
  { header: "企業UID",        width: 20,                 value: it => it.companyUid },
  { header: "CXMリンク",      width: 46,                 value: (it, m) => `${m.baseUrl}/v2/companies/${it.companyUid}` },
];

// ── 対応済みアクションの列 ────────────────────────────────────────────────────

const ACTIVITY_TYPE_JA: Record<string, string> = {
  Call: "電話", Email: "メール", Meeting: "商談", Event: "イベント",
  Intercom: "Intercom", Chat: "チャット", Other: "その他",
};

function actionTime(a: ActionListItem): string {
  if (!a.createdAt) return "—";
  const d = new Date(a.createdAt);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function actionSummary(a: ActionListItem): string {
  const title = (a.title ?? "").trim();
  if (title && title !== "（SF行動）") return title;
  const parts: string[] = [];
  if (a.eventFormat) parts.push(a.eventFormat);
  const purpose = (a.actionPurpose ?? "").trim();
  const body = (a.body ?? "").trim();
  if (purpose) parts.push(purpose);
  else if (body) parts.push(body);
  if (a.result) parts.push(`評価${a.result}`);
  return parts.join(" / ") || "SF行動（内容未記録）";
}

const DONE_COLUMNS: Array<{ header: string; width: number; value: (a: ActionListItem) => CellValue }> = [
  { header: "完了時刻", width: 10, value: actionTime },
  { header: "企業名",   width: 28, value: a => a.companyName },
  { header: "種別",     width: 10, value: a => (a.activityType ? ACTIVITY_TYPE_JA[a.activityType] ?? a.activityType : "—") },
  { header: "内容",     width: 60, value: actionSummary },
  { header: "実施日",   width: 12, value: a => a.dueDate ?? "—" },
  { header: "担当",     width: 12, value: a => a.owner || "—" },
];

// ── 共通のヘッダ情報 ──────────────────────────────────────────────────────────

function stamp(d: Date): string {
  return d.toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function metaPairs(items: DashboardItem[], meta: Tier3ReportMeta): Array<[string, string]> {
  return [
    ["出力日時",       stamp(meta.generatedAt)],
    ["データ更新",     meta.updatedAt ? stamp(new Date(meta.updatedAt)) : "—"],
    ["スナップショット日", meta.snapshotDate ?? "—"],
    ["絞り込み",       meta.filterLabel],
    ["並び順",         meta.sortLabel],
    ["出力件数",       `${items.length} 社（全 ${meta.totalCount} 社中）`],
  ];
}

const SUMMARY_ROWS = (meta: Tier3ReportMeta): Array<[string, number]> => [
  [ALARM_LABEL.pv_over,      meta.summary.pvOver],
  [ALARM_LABEL.renewal_soon, meta.summary.renewalSoon],
  [ALARM_LABEL.ops_drop,     meta.summary.opsDrop],
  [ALARM_LABEL.inactive_30,  meta.summary.inactive30],
  [ALARM_LABEL.upsell,       meta.summary.upsell],
];

// ── Excel ─────────────────────────────────────────────────────────────────────

export function buildTier3Sheets(
  items: DashboardItem[], done: ActionListItem[], meta: Tier3ReportMeta,
): SheetSpec[] {
  const sheets: SheetSpec[] = [
    {
      name: "企業一覧",
      columns: COLUMNS.map(c => ({ header: c.header, width: c.width })),
      rows: items.map(it => COLUMNS.map(c => c.value(it, meta))),
    },
    {
      name: "出力条件・サマリー",
      freezeHeader: false,
      columns: [{ header: "項目", width: 28 }, { header: "値", width: 46 }],
      rows: [
        ...metaPairs(items, meta).map(([k, v]) => [k, v] as CellValue[]),
        [],
        ["重大度の内訳（全件）", ""],
        ["緊急", meta.counts.urgent],
        ["要対応", meta.counts.needAction],
        ["提案", meta.counts.proposal],
        ["異常なし", meta.counts.normal],
        [],
        ["アラームサマリー（全件）", ""],
        ...SUMMARY_ROWS(meta).map(([k, v]) => [k, v] as CellValue[]),
      ],
    },
  ];

  if (done.length > 0) {
    sheets.push({
      name: "本日の対応済み",
      columns: DONE_COLUMNS.map(c => ({ header: c.header, width: c.width })),
      rows: done.map(a => DONE_COLUMNS.map(c => c.value(a))),
    });
  }
  return sheets;
}

// ── Markdown ──────────────────────────────────────────────────────────────────

/** 表のセル内で改行・パイプが崩れないようにする。数値は桁区切りで読みやすく */
function mdCell(v: CellValue): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("ja-JP");
  return String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function buildTier3Markdown(
  items: DashboardItem[], done: ActionListItem[], meta: Tier3ReportMeta,
): string {
  const L: string[] = [];

  L.push(`# Tier 3 管理レポート`, "");
  for (const [k, v] of metaPairs(items, meta)) L.push(`- **${k}**: ${v}`);
  L.push("");

  L.push(`## アラームサマリー（絞り込み前の全 ${meta.totalCount} 社）`, "");
  L.push(`| アラーム | 社数 |`, `| --- | ---: |`);
  for (const [k, v] of SUMMARY_ROWS(meta)) L.push(`| ${k} | ${v} |`);
  L.push("");
  L.push(`重大度: 緊急 ${meta.counts.urgent} / 要対応 ${meta.counts.needAction}`
    + ` / 提案 ${meta.counts.proposal} / 異常なし ${meta.counts.normal}`, "");

  const tableCols = COLUMNS.filter(c => c.inTable);
  L.push(`## 対象企業 ${items.length} 社`, "");
  if (items.length === 0) {
    L.push("該当する企業がありません。", "");
  } else {
    L.push(`| ${tableCols.map(c => c.header).join(" | ")} |`);
    L.push(`| ${tableCols.map(() => "---").join(" | ")} |`);
    for (const it of items) {
      L.push(`| ${tableCols.map(c => mdCell(c.value(it, meta))).join(" | ")} |`);
    }
    L.push("");

    L.push(`## 企業ごとの詳細`, "");
    for (const it of items) {
      L.push(`### ${it.canonicalName}`, "");
      for (const c of COLUMNS) {
        if (c.header === "企業名") continue;
        L.push(`- ${c.header}: ${mdCell(c.value(it, meta))}`);
      }
      L.push("");
    }
  }

  L.push(`## 本日の対応済み（${done.length} 件）`, "");
  if (done.length === 0) {
    L.push("対応済みアクションはありません。", "");
  } else {
    L.push(`| ${DONE_COLUMNS.map(c => c.header).join(" | ")} |`);
    L.push(`| ${DONE_COLUMNS.map(() => "---").join(" | ")} |`);
    for (const a of done) {
      L.push(`| ${DONE_COLUMNS.map(c => mdCell(c.value(a))).join(" | ")} |`);
    }
    L.push("");
  }

  L.push("---", "");
  L.push("出典: CXM /v2/tier3（PTBI 利用シグナル・NocoDB 契約スナップショット・Salesforce 行動）。"
    + "画面が取得済みのデータのみを書き出しています。", "");
  return L.join("\n");
}

// ── ファイル名 ────────────────────────────────────────────────────────────────

/** 例: tier3-report_needAction_20260917-1536.xlsx */
export function tier3ReportFileName(filterKey: string, generatedAt: Date, ext: "xlsx" | "md"): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const d = generatedAt;
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return `tier3-report_${filterKey}_${ts}.${ext}`;
}
