// ─── 選択できるモデルのカタログ（サーバーサイド専用）──────────────────────────
//
// モデル名をコードに直書きしないのは、OpenRouter のスラッグが増減するため。
// 存在しない ID を選ばせると実行時に 400 になるので、OpenRouter の /models を
// 引いて「Claude 系 かつ tools 対応」だけを候補にする。
//
// ここは失敗しても機能を止めない: カタログが取れなければ候補は既定モデル1件だけに
// なり、設定画面には「候補を取得できなかった」状態として出る。

const CATALOG_URL = 'https://openrouter.ai/api/v1/models';
/** カタログのメモリキャッシュ保持時間 */
const TTL_MS = 60 * 60 * 1000;

export interface ModelChoice {
  id:    string;
  label: string;
  /** 1M トークンあたりの入力単価（USD）。取れなければ null */
  inputPricePerM: number | null;
}

interface RawModel {
  id?: string;
  name?: string;
  supported_parameters?: string[];
  pricing?: { prompt?: string };
}

let cache: { at: number; models: ModelChoice[] } | null = null;

export async function fetchModelChoices(): Promise<ModelChoice[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.models;

  try {
    const res = await fetch(CATALOG_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`OpenRouter /models が ${res.status}`);
    const json = await res.json() as { data?: RawModel[] };

    const models = (json.data ?? [])
      .filter(m => {
        if (!m.id?.startsWith('anthropic/')) return false;
        // このアシスタントはツール呼び出し必須。tools 非対応モデルは選ばせない
        if (!m.supported_parameters?.includes('tools')) return false;
        // ":batch" / ":online" などの variant を除く。特に :batch は非同期バッチ用で
        // ストリーミングの対話には使えない（選べると壊れる）
        if (m.id.includes(':')) return false;
        return true;
      })
      .map<ModelChoice>(m => {
        const prompt = Number(m.pricing?.prompt);
        return {
          id:    m.id as string,
          label: (m.name ?? m.id) as string,
          inputPricePerM: Number.isFinite(prompt) ? prompt * 1_000_000 : null,
        };
      })
      // 安い順 = おおむね速い順。単価不明は末尾
      .sort((a, b) => (a.inputPricePerM ?? Infinity) - (b.inputPricePerM ?? Infinity));

    cache = { at: Date.now(), models };
    return models;
  } catch (err) {
    console.error('[openrouter-models] カタログ取得に失敗', err);
    return [];
  }
}

/** 指定 ID が候補に含まれるか。カタログが空（取得失敗）のときは検証しない */
export async function isSelectableModel(id: string): Promise<boolean> {
  if (!id) return true; // 空 = 既定モデル
  const models = await fetchModelChoices();
  if (models.length === 0) return true;
  return models.some(m => m.id === id);
}
