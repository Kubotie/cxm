// ─── AI チャットが読める内部データ源のカタログ（サーバーサイド専用）───────────
//
// AI が「画面の裏側にあるデータ」に自分で降りていけるようにするための許可リスト。
// ここに載っている GET エンドポイントだけを叩ける。
//
// ── 明示的な allowlist にしている理由 ────────────────────────────────────────
//   /api/** を GET 限定で全部許すと、副作用のある GET を巻き込む。
//   実例: /api/batch/tier-sync, /api/batch/paid-watched-sync などは GET でも
//   バッチ本体が走る（Vercel Cron からの GET を受けるため）。
//   「GET だから安全」は この API 群では成り立たない。
//
// カタログはそのままシステムプロンプトに流し込む。
// つまりここに書いた説明文が AI のツール選択の判断材料になる。

/** 1エンドポイントの仕様 */
export interface DataSourceSpec {
  /** パステンプレート。{param} がパスパラメータ */
  path:        string;
  /** 何が返るか。AI がこれを読んでツールを選ぶ */
  description: string;
  /** 使えるクエリパラメータ（説明付き） */
  query?:      Record<string, string>;
  /** 一覧系で件数が多いもの。プロンプトで注意を促す */
  heavy?:      boolean;
}

// ── カタログ ──────────────────────────────────────────────────────────────────

export const DATA_SOURCES: DataSourceSpec[] = [
  // ── 横断一覧 ────────────────────────────────────────────────────────────────
  {
    path: '/api/companies/proposal-board',
    description: '提案準備ボード。担当顧客を「更新確保 / 提案できる / 条件付き / 足元を戻す」の4レーンに分類し、提案準備度スコア・阻害要因・利用指標つきで返す。',
    query: { owner: '担当者の name2。既定はログインユーザー', opportunity: '機会タイプで絞る' },
    heavy: true,
  },
  {
    path: '/api/companies/tier3-dashboard',
    description: 'Tier 3 企業の拡張シグナル一覧（ダッシュボード用）。',
    query: { limit: '最大件数（既定2000）' },
    heavy: true,
  },
  {
    path: '/api/companies/light-watch',
    description: 'Tier 3 かつ is_paid_watched=true の企業一覧。最新スナップショットつき。',
    query: { limit: '最大件数' },
    heavy: true,
  },
  {
    path: '/api/company-summary-list',
    description: '企業一覧（CompanyListItemVM）。AI サマリの鮮度・レビュー状態つき。',
    query: {
      owner: '担当者 name2', limit: '最大件数', sort: '並び順',
      summary_type: 'サマリ種別', freshness: '鮮度で絞る', review: 'レビュー状態で絞る',
      company_uids: 'カンマ区切りの company_uid で絞る',
    },
    heavy: true,
  },
  {
    path: '/api/nocodb/companies',
    description: 'companies テーブルの生データ。company_uid・社名・担当・Tier・契約情報などの原本。',
    query: { uid: 'company_uid で1社に絞る', owner: '担当者 name2', limit: '最大件数', outbound: 'Outbound 用フィールドを含める' },
    heavy: true,
  },
  {
    path: '/api/actions',
    description: 'ログインユーザーのアクション（ToDo）一覧を優先順で返す。',
    query: { include_done: '1 で完了済みも含む' },
  },

  // ── 個社 ────────────────────────────────────────────────────────────────────
  {
    path: '/api/company/{companyUid}',
    description: '1社の全体情報を集約したデータ（基本情報・Phase・Evidence・Alerts・People など）。',
  },
  {
    path: '/api/company/{companyUid}/core',
    description: '1社のヘッダー最小情報（基本情報 + Phase + サマリ状態）。軽い。',
  },
  {
    path: '/api/company/{companyUid}/profile',
    description: '顧客理解プロファイル。「この顧客に何が起きているか」を商談前に読む形に整えたもの。',
    query: { industry: '業界を指定して業界インテリジェンスを含める' },
  },
  {
    path: '/api/company/{companyUid}/readiness',
    description: '提案準備度。今提案を持ち込んでよいか、阻害要因は何かの判定内訳。',
    query: { opportunity: '機会タイプ' },
  },
  {
    path: '/api/company/{companyUid}/usage',
    description: '現在の利用状況（プロジェクト別・モジュール別の利用実績集約）。',
  },
  {
    path: '/api/company/{companyUid}/timeseries',
    description: '日次スナップショット履歴（時系列）。増減の根拠を出すときに使う。',
    query: { days: '遡る日数（既定90）' },
  },
  {
    path: '/api/company/{companyUid}/communications',
    description: 'コミュニケーション/サポート会話の統一リスト（Slack・Chatwork・Intercom・議事録・CSEチケット）。',
  },
  {
    path: '/api/companies/{companyUid}/log',
    description: 'Unified Log。個社の横断イベント時系列。',
  },
  {
    path: '/api/company/{companyUid}/summary',
    description: '保存済み AI サマリ（生成はしない）。',
  },
  {
    path: '/api/company/{companyUid}/people',
    description: 'CXM マネージド連絡先一覧（担当者・役職・関係性）。',
  },
  {
    path: '/api/company/{companyUid}/actions',
    description: 'その企業に紐づくアクション一覧。',
  },
  {
    path: '/api/company/{companyUid}/external-intel',
    description: '外部WHO情報（IR・組織・求人・競合など「今提案する理由」の外部根拠）。',
  },
  {
    path: '/api/company/{companyUid}/proposal-intents',
    description: '提案骨子フローの入口。「何をしたいか」の候補カード。',
  },
  {
    path: '/api/company/{companyUid}/proposal-records',
    description: '保存済みの提案骨子レコード。',
    query: { id: '特定レコードID' },
  },

  // ── プロジェクト ────────────────────────────────────────────────────────────
  {
    path: '/api/projects/module-usage',
    description: 'プロジェクト分析ダッシュボードのデータ源。プロジェクト単位のモジュール利用状況（直近30日）。',
    query: { includeFree: '1 で無料プロジェクトも含む' },
    heavy: true,
  },
  {
    path: '/api/projects/{projectId}',
    description: 'プロジェクト1件の詳細。機能ごとの内訳・種別構成・契約との差分。',
  },
  {
    path: '/api/home/project-signals',
    description: '有料プロジェクト単位のシグナル（利用停止・活動低下）。',
    heavy: true,
  },
  {
    path: '/api/package-events-summary',
    description: 'パッケージ変動イベントの集計（アップ/ダウングレードの分布）。',
  },

  // ── サポート ────────────────────────────────────────────────────────────────
  {
    path: '/api/support/ai-states',
    description: 'サポートケースの AI 判定状態一覧。',
    query: { source_queue: 'キュー種別', limit: '最大件数' },
    heavy: true,
  },
  { path: '/api/support/cases/{caseId}/ai-state', description: 'サポートケース1件の AI 判定状態。' },
  { path: '/api/support/cases/{caseId}/state',    description: 'サポートケース1件の運用状態。' },
  { path: '/api/nocodb/support-queue',   description: 'サポートキュー（Intercom 由来）の生データ。', heavy: true },
  { path: '/api/nocodb/inquiry-queue',   description: '問い合わせキューの生データ。', heavy: true },
  { path: '/api/nocodb/cseticket-queue', description: 'CSE チケットキューの生データ。1チケット複数行になり得る点に注意（source_record_id で畳む）。', heavy: true },
  { path: '/api/nocodb/support-alerts',  description: 'サポートアラート一覧。' },
  { path: '/api/nocodb/alerts',          description: 'CSM アラート一覧。' },
  { path: '/api/nocodb/evidence',        description: 'Evidence（根拠）レコード一覧。' },
  { path: '/api/nocodb/people',          description: 'people テーブルの生データ。' },

  // ── 資産・ドキュメント・Outbound ────────────────────────────────────────────
  {
    path: '/api/assets',
    description: 'CSM アセット（資料・MD）一覧。',
    query: { q: '全文検索', category: 'カテゴリ', tag: 'タグ', author: '作成者', limit: '最大件数', offset: 'オフセット', sort_by: '並び替えキー', sort_dir: 'asc/desc' },
  },
  { path: '/api/assets/tags',        description: 'アセットのタグ一覧。' },
  { path: '/api/documents',          description: 'ログインユーザーが作成したドキュメント一覧。' },
  { path: '/api/outbound/campaigns', description: 'Outbound キャンペーン一覧（下書き・送信済み）。' },
  { path: '/api/outbound/audiences', description: 'Outbound オーディエンス一覧。' },
  { path: '/api/outbound/channels',  description: '企業別の連絡チャンネル設定。' },

  // ── 解約分析 / 運用参照 ─────────────────────────────────────────────────────
  { path: '/api/ops/churn-reports',            description: '週次の解約遡及分析レポート一覧。' },
  { path: '/api/ops/churn-reports/{reportId}', description: '解約遡及分析レポート1件の本文。' },
  { path: '/api/ops/churn-retrospective',      description: '解約遡及分析の集計データ。', heavy: true },

  // ── ユーザー ────────────────────────────────────────────────────────────────
  { path: '/api/user/profile', description: 'ログイン中ユーザーのプロファイル（担当・ロール・重点領域）。' },
  { path: '/api/users',        description: 'スタッフ一覧（担当者名の解決に使う）。' },
];

// ── 照合 ──────────────────────────────────────────────────────────────────────

/** {param} を「/ を含まない1セグメント」にした正規表現へ変換する */
function toMatcher(template: string): RegExp {
  const escaped = template
    .split('/')
    .map(seg => (/^\{.+\}$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}$`);
}

const MATCHERS = DATA_SOURCES.map(spec => ({ spec, re: toMatcher(spec.path) }));

export interface ResolveResult {
  ok:      boolean;
  /** 正規化済みの pathname + query */
  path?:   string;
  spec?:   DataSourceSpec;
  reason?: string;
}

/**
 * AI が要求したパスを検証して正規化する。
 * 相対パス（/api/... で始まる）のみ受け付け、外部 URL・親ディレクトリ参照は拒否する。
 */
export function resolveDataSourcePath(requested: string): ResolveResult {
  const raw = (requested ?? '').trim();
  if (!raw.startsWith('/api/')) {
    return { ok: false, reason: '内部 API パス（/api/... で始まる相対パス）のみ指定できます。' };
  }
  if (raw.includes('..') || raw.includes('//')) {
    return { ok: false, reason: 'パスに .. や // は使えません。' };
  }

  // クエリを分離して pathname だけ照合する
  const qIndex   = raw.indexOf('?');
  const pathname = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const search   = qIndex >= 0 ? raw.slice(qIndex)    : '';

  const hit = MATCHERS.find(m => m.re.test(pathname));
  if (!hit) {
    return {
      ok: false,
      reason: `${pathname} は参照が許可されていません。データ源カタログに載っているパスだけが使えます。`,
    };
  }

  return { ok: true, path: `${pathname}${search}`, spec: hit.spec };
}

// ── プロンプト用の整形 ────────────────────────────────────────────────────────

/** カタログをシステムプロンプトに埋める文字列にする */
export function renderDataSourceCatalog(): string {
  return DATA_SOURCES.map(spec => {
    const q = spec.query && Object.keys(spec.query).length > 0
      ? `\n    クエリ: ${Object.entries(spec.query).map(([k, v]) => `${k}(${v})`).join(', ')}`
      : '';
    const heavy = spec.heavy ? ' ※件数が多い。必要な範囲に絞って読むこと' : '';
    return `- ${spec.path}\n    ${spec.description}${heavy}${q}`;
  }).join('\n');
}
