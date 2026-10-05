import { describe, expect, it } from 'vitest';

import {
  BLACK_MARKET_LEVEL_MAX,
  calculateBlackMarket,
} from './black-market-calculator';

const defaultCacheAmounts = {
  trash: 1_000,
  common: 1_000,
  'high-quality': 1_000,
  rare: 1_000,
} as const;

const defaultCacheRates = {
  trash: 9,
  common: 8,
  'high-quality': 6,
  rare: 3,
} as const;

describe('黑市收益計算核心', () => {
  it('依資料集公式逐段無條件進位並計算四種品質快取', () => {
    const results = calculateBlackMarket({
      printingLevel: 500,
      cacheAmounts: defaultCacheAmounts,
      btcBuffPercent: 100,
      bargainPercent: 40,
      aiPriceInBtc: 8_450,
      cachePerAi: defaultCacheRates,
    });

    expect(results).toHaveLength(4);
    expect(results?.[0]).toMatchObject({
      id: 'trash',
      cacheAmount: 1_000,
      saleBtcPerCache: 1_176,
      soldBtc: 1_176_000,
      costAi: 111.11,
      profitBtc: 237_120.5,
      profitAi: 28.06,
      breakEvenLevel: 380,
    });
    expect(results?.map((result) => result.breakEvenLevel)).toEqual([
      380,
      372,
      403,
      739,
    ]);
  });

  it('數量為零時仍提供單位收益與回本等級，但總額為零', () => {
    const results = calculateBlackMarket({
      printingLevel: 500,
      cacheAmounts: {
        trash: 0,
        common: 0,
        'high-quality': 0,
        rare: 0,
      },
      btcBuffPercent: 0,
      bargainPercent: 0,
      aiPriceInBtc: 8_450,
      cachePerAi: defaultCacheRates,
    });

    expect(results?.every((result) =>
      result.soldBtc === 0 &&
      result.costAi === 0 &&
      result.saleBtcPerCache > 0,
    )).toBe(true);
  });

  it('Lv.800 內無法回本時回傳 null break-even', () => {
    const results = calculateBlackMarket({
      printingLevel: 1,
      cacheAmounts: {
        trash: 1_000,
        common: 2_000,
        'high-quality': 3_000,
        rare: 4_000,
      },
      btcBuffPercent: 0,
      bargainPercent: 0,
      aiPriceInBtc: 1_000_000,
      cachePerAi: {
        trash: 1,
        common: 1,
        'high-quality': 1,
        rare: 1,
      },
    });

    expect(results?.every((result) => result.breakEvenLevel === null)).toBe(true);
  });

  it('拒絕超出資料集範圍或共用輸入限制的數值', () => {
    expect(calculateBlackMarket({
      printingLevel: BLACK_MARKET_LEVEL_MAX + 1,
      cacheAmounts: defaultCacheAmounts,
      btcBuffPercent: 0,
      bargainPercent: 0,
      aiPriceInBtc: 8_450,
      cachePerAi: defaultCacheRates,
    })).toBeNull();

    expect(calculateBlackMarket({
      printingLevel: 500,
      cacheAmounts: defaultCacheAmounts,
      btcBuffPercent: 0,
      bargainPercent: 41,
      aiPriceInBtc: 8_450,
      cachePerAi: defaultCacheRates,
    })).toBeNull();
  });
});
