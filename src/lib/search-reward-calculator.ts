export interface SearchRewardEntry {
  readonly level: number;
  readonly mt: number;
  readonly mt_p: number;
  readonly atp: number;
  readonly atp_p: number;
  readonly matp: number;
  readonly matp_p: number;
}

export interface SearchPrices {
  /** 醫療科技零件、彈藥零件與軍用彈藥零件的 AI/k 價格。 */
  readonly mt: number;
  readonly atp: number;
  readonly matp: number;
}

export interface SearchRewardFormValues {
  readonly playerLevel: string;
  readonly searchCount: string;
  readonly mtPrice: string;
  readonly atpPrice: string;
  readonly matpPrice: string;
}

export type SearchRewardField = keyof SearchRewardFormValues;
export type SearchRewardError = 'level' | 'count' | 'price';
export type SearchRewardErrors = Partial<Record<SearchRewardField, SearchRewardError>>;

export interface SearchRewardInputs {
  readonly playerLevel: number;
  readonly searchCount: number;
  readonly prices: SearchPrices;
}

export interface SearchAreaReward {
  readonly level: number;
  readonly expectedMtQty: number;
  readonly expectedAtpQty: number;
  readonly expectedMatpQty: number;
  readonly totalExpectedValue: number;
}

export interface SearchLadderEntry {
  readonly level: number;
  readonly expectedValue: number;
  readonly isCurrentOptimal: boolean;
}

export interface OptimalSearchResult {
  readonly optimalArea: SearchAreaReward | null;
  readonly ladder: readonly SearchLadderEntry[];
}

export interface SearchRewardCalculation {
  readonly errors: SearchRewardErrors;
  readonly inputs: SearchRewardInputs | null;
  readonly result: OptimalSearchResult | null;
}

export const searchRewardInputLimits = {
  playerLevel: { min: 1, max: 800 },
  searchCount: { min: 1, max: 12 },
} as const;

function parseInteger(value: string, min: number, max: number): number | null {
  const normalized = value.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;

  return parsed;
}

export function parseSearchRewardPrice(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

/**
 * 將表單字串解析為計算輸入；任何欄位無效時都不產生部分計算資料。
 * 此函式不依賴 React、DOM、儲存或任何瀏覽器 API。
 */
export function parseSearchRewardValues(values: SearchRewardFormValues): {
  readonly errors: SearchRewardErrors;
  readonly inputs: SearchRewardInputs | null;
} {
  const playerLevel = parseInteger(
    values.playerLevel,
    searchRewardInputLimits.playerLevel.min,
    searchRewardInputLimits.playerLevel.max,
  );
  const searchCount = parseInteger(
    values.searchCount,
    searchRewardInputLimits.searchCount.min,
    searchRewardInputLimits.searchCount.max,
  );
  const mtPrice = parseSearchRewardPrice(values.mtPrice);
  const atpPrice = parseSearchRewardPrice(values.atpPrice);
  const matpPrice = parseSearchRewardPrice(values.matpPrice);
  const errors: SearchRewardErrors = {};

  if (playerLevel === null) errors.playerLevel = 'level';
  if (searchCount === null) errors.searchCount = 'count';
  if (mtPrice === null) errors.mtPrice = 'price';
  if (atpPrice === null) errors.atpPrice = 'price';
  if (matpPrice === null) errors.matpPrice = 'price';

  if (Object.keys(errors).length > 0 || playerLevel === null || searchCount === null) {
    return { errors, inputs: null };
  }

  return {
    errors,
    inputs: {
      playerLevel,
      searchCount,
      prices: {
        mt: mtPrice ?? 0,
        atp: atpPrice ?? 0,
        matp: matpPrice ?? 0,
      },
    },
  };
}

export function calculateAreaReward(
  entry: SearchRewardEntry,
  prices: SearchPrices,
  searchCount: number,
): SearchAreaReward {
  const count = Math.max(
    searchRewardInputLimits.searchCount.min,
    Math.min(searchRewardInputLimits.searchCount.max, Math.floor(searchCount)),
  );
  const mtPrice = Math.max(0, prices.mt) / 1_000;
  const atpPrice = Math.max(0, prices.atp) / 1_000;
  const matpPrice = Math.max(0, prices.matp) / 1_000;

  const expectedMtQty = entry.mt * entry.mt_p * count;
  const expectedAtpQty = entry.atp * entry.atp_p * count;
  const expectedMatpQty = entry.matp * entry.matp_p * count;

  const totalExpectedValue =
    expectedMtQty * mtPrice +
    expectedAtpQty * atpPrice +
    expectedMatpQty * matpPrice;

  return {
    level: entry.level,
    expectedMtQty,
    expectedAtpQty,
    expectedMatpQty,
    totalExpectedValue,
  };
}

export function computeOptimalSearchArea(
  rewards: readonly SearchRewardEntry[],
  playerLevel: number | null,
  prices: SearchPrices,
  searchCount: number,
): OptimalSearchResult {
  const sorted = [...rewards].sort((a, b) => a.level - b.level);

  let currentMax = -1;
  const ladderList: Array<{ level: number; expectedValue: number }> = [];

  let optimalArea: SearchAreaReward | null = null;
  let maxAccessibleValue = -1;

  for (const entry of sorted) {
    const reward = calculateAreaReward(entry, prices, searchCount);

    if (reward.totalExpectedValue > currentMax) {
      currentMax = reward.totalExpectedValue;
      ladderList.push({ level: entry.level, expectedValue: reward.totalExpectedValue });
    }

    if (playerLevel !== null && entry.level <= playerLevel) {
      if (reward.totalExpectedValue >= maxAccessibleValue) {
        maxAccessibleValue = reward.totalExpectedValue;
        optimalArea = reward;
      }
    }
  }

  const ladder: SearchLadderEntry[] = ladderList.map((item) => ({
    level: item.level,
    expectedValue: item.expectedValue,
    isCurrentOptimal: optimalArea !== null && item.level === optimalArea.level,
  }));

  return { optimalArea, ladder };
}

/**
 * 純計算入口：完成表單解析、輸入驗證與結果計算，方便 UI 之外的測試或工具重用。
 */
export function calculateSearchReward(
  rewards: readonly SearchRewardEntry[],
  values: SearchRewardFormValues,
): SearchRewardCalculation {
  const parsed = parseSearchRewardValues(values);

  return {
    errors: parsed.errors,
    inputs: parsed.inputs,
    result: parsed.inputs
      ? computeOptimalSearchArea(
          rewards,
          parsed.inputs.playerLevel,
          parsed.inputs.prices,
          parsed.inputs.searchCount,
        )
      : null,
  };
}
