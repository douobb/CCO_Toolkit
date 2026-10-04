import {
  calculateAreaReward,
  computeOptimalSearchArea,
  type SearchPrices,
  type SearchRewardEntry,
} from './search-reward-calculator';

/** 圖表支援的縱軸；收益與物品產量分開顯示，避免不同量級互相遮蔽。 */
export const searchRewardChartMetrics = ['quantity', 'value'] as const;
export type SearchRewardChartMetric = (typeof searchRewardChartMetrics)[number];

export interface SearchRewardChartPoint {
  /** 資料集中的實際搜索地區等級。 */
  readonly level: number;
  /** 圖表提示使用的地區等級；對搜索收益資料而言與 level 相同。 */
  readonly areaLevel: number;
  readonly expectedMtQty: number;
  readonly expectedAtpQty: number;
  readonly expectedMatpQty: number;
  readonly totalExpectedValue: number;
  /** 依資料順序，收益創下截至當時新高的收益階梯點。 */
  readonly isLadderPoint: boolean;
}

export interface SearchRewardChartData {
  /** 只包含資料集中的實際地區等級，不補齊不存在的等級。 */
  readonly points: readonly SearchRewardChartPoint[];
  readonly minLevel: number;
  readonly maxLevel: number;
}

/**
 * 由正式 Search Reward 單一地區計算邏輯衍生圖表資料。
 *
 * 每個 X 點直接使用資料集該地區的 calculateAreaReward 結果；收益階梯點
 * 則沿用 computeOptimalSearchArea 的正式 ladder 定義，不重複任何收益公式。
 */
export function deriveSearchRewardChartData(
  rewards: readonly SearchRewardEntry[],
  prices: SearchPrices,
  searchCount: number,
): SearchRewardChartData {
  const sortedRewards = [...rewards].sort((a, b) => a.level - b.level);
  const calculatedRewards = sortedRewards.map((entry) => calculateAreaReward(entry, prices, searchCount));
  const ladderLevels = new Set(
    computeOptimalSearchArea(sortedRewards, null, prices, searchCount).ladder.map(
      (entry) => entry.level,
    ),
  );
  const points = calculatedRewards.map((reward) => ({
    ...reward,
    areaLevel: reward.level,
    isLadderPoint: ladderLevels.has(reward.level),
  }));

  return {
    points,
    minLevel: points[0]?.level ?? 0,
    maxLevel: points.at(-1)?.level ?? 0,
  };
}
