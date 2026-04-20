// ─── Support Queue 共通ラベル・カラーマップ ─────────────────────────────────
// routing_status / source_status / severity の日本語ラベルと Badge スタイルを
// 一覧・詳細ページで共有する。

// ── Routing Status ────────────────────────────────────────────────────────────

export const ROUTING_STATUS_LABEL: Record<string, string> = {
  unassigned:           'unassigned',
  triaged:              'triaged',
  assigned:             'assigned',
  'in progress':        'in progress',
  'waiting on customer':'waiting on customer',
  'waiting on CSE':     'waiting on CSE',
  resolved_like:        'resolved',
};

/** Badge の className（variant="outline" と組み合わせて使う） */
export const ROUTING_STATUS_COLOR: Record<string, string> = {
  unassigned:            'bg-slate-100 text-slate-600 border-slate-200',
  triaged:               'bg-blue-50 text-blue-700 border-blue-200',
  assigned:              'bg-purple-50 text-purple-700 border-purple-200',
  'in progress':         'bg-green-50 text-green-700 border-green-200',
  'waiting on customer': 'bg-amber-50 text-amber-700 border-amber-200',
  'waiting on CSE':      'bg-orange-50 text-orange-700 border-orange-200',
  resolved_like:         'bg-slate-50 text-slate-500 border-slate-200',
};

export function routingLabel(status: string): string {
  return ROUTING_STATUS_LABEL[status] ?? status;
}

export function routingColor(status: string): string {
  return ROUTING_STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-700';
}

// ── Source Status ─────────────────────────────────────────────────────────────

export const SOURCE_STATUS_LABEL: Record<string, string> = {
  open:        '受付中',
  'in progress': '対応中',
  pending:     '保留',
  resolved:    '解決済み',
  closed:      '完了',
  reopened:    '再受付',
};

export const SOURCE_STATUS_COLOR: Record<string, string> = {
  open:          'bg-sky-50 text-sky-700 border-sky-200',
  'in progress': 'bg-green-50 text-green-700 border-green-200',
  pending:       'bg-amber-50 text-amber-700 border-amber-200',
  resolved:      'bg-slate-50 text-slate-500 border-slate-200',
  closed:        'bg-slate-50 text-slate-500 border-slate-200',
  reopened:      'bg-orange-50 text-orange-700 border-orange-200',
};

export function sourceStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return SOURCE_STATUS_LABEL[status] ?? status;
}

export function sourceStatusColor(status: string | null | undefined): string {
  if (!status) return 'bg-slate-100 text-slate-500 border-slate-200';
  return SOURCE_STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

// ── Severity ──────────────────────────────────────────────────────────────────

export const SEVERITY_LABEL: Record<string, string> = {
  high:   '高',
  medium: '中',
  low:    '低',
};

/** 塗りつぶし Badge 用（text-white と組み合わせる） */
export const SEVERITY_BG: Record<string, string> = {
  high:   'bg-red-600',
  medium: 'bg-amber-500',
  low:    'bg-slate-500',
};

export function severityLabel(severity: string): string {
  return SEVERITY_LABEL[severity] ?? severity;
}

export function severityBg(severity: string): string {
  return SEVERITY_BG[severity] ?? 'bg-slate-400';
}
