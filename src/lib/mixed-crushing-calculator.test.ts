import { describe, expect, it } from 'vitest';

import { resolveMarketPrices } from './market-prices';
import {
  calculateEarnings,
  EARNINGS_TIME_REDUCTION_PERCENT,
} from './earnings-calculator';
import {
  calculateManualMixedCrushing,
  calculateRecommendedMixedCrushing,
  getRecommendedElapsedMixedCrushingCounts,
  getRecommendedRateMixedCrushingCounts,
  mixedCrushingUnitSeconds,
} from './mixed-crushing-calculator';
import {
  getMixedCrushingBaseSeconds,
  getMixedCrushingBaseTimeBudget,
  getMixedCrushingDynamicMax,
  parseMixedCrushingCountInputs,
  validateMixedCrushingCounts,
  type MixedCrushingCounts,
} from './mixed-crushing-schema';
import { defaultSharedUserInputs } from './storage';

const validInputs = {
  searchLevel: 1,
  printingLevel: 1,
  miningLevel: 1,
  btcBuffPercent: 100,
  bargainPercent: 0,
} as const;

function calculateBaseEarnings(comparisonMode: 'per-minute' | 'elapsed-15' | 'elapsed-30' | 'elapsed-45' | 'elapsed-60' | 'elapsed-105' = 'per-minute') {
  return calculateEarnings(validInputs, resolveMarketPrices(), { comparisonMode })!;
}

describe('mixed crushing schema and time budget', () => {
  it('accepts both exact 32,400-second compositions and rejects all three at 1,000', () => {
    const first = { medical: 1_000, ammunition: 1_000, military: 775 };
    const second = { medical: 1_000, ammunition: 100, military: 1_000 };
    const allMaximum = { medical: 1_000, ammunition: 1_000, military: 1_000 };

    expect(getMixedCrushingBaseSeconds(first, mixedCrushingUnitSeconds)).toBe(32_400);
    expect(validateMixedCrushingCounts(first, 32_400, mixedCrushingUnitSeconds)).toBeNull();
    expect(getMixedCrushingBaseSeconds(second, mixedCrushingUnitSeconds)).toBe(32_400);
    expect(validateMixedCrushingCounts(second, 32_400, mixedCrushingUnitSeconds)).toBeNull();
    expect(getMixedCrushingBaseSeconds(allMaximum, mixedCrushingUnitSeconds)).toBe(36_000);
    expect(validateMixedCrushingCounts(allMaximum, 32_400, mixedCrushingUnitSeconds))
      .toBe('time');
  });

  it('uses exact 80% reduction boundaries for all elapsed modes, including the strict 105-minute cap', () => {
    expect(EARNINGS_TIME_REDUCTION_PERCENT).toBe(80);
    expect([15, 30, 45, 60, 105].map((minutes) =>
      getMixedCrushingBaseTimeBudget(minutes, EARNINGS_TIME_REDUCTION_PERCENT)))
      .toEqual([4_500, 9_000, 13_500, 18_000, 31_500]);
    expect(getMixedCrushingBaseTimeBudget(null, 80)).toBe(32_400);
    expect(getMixedCrushingBaseTimeBudget(540, 80)).toBe(32_400);

    const oneHundredFiveMinuteCalculation = calculateBaseEarnings('elapsed-105');
    const recommendation = calculateRecommendedMixedCrushing(oneHundredFiveMinuteCalculation)!;
    expect(recommendation.baseSeconds).toBeLessThanOrEqual(31_500);
    expect(recommendation.actualSeconds).toBeLessThanOrEqual(6_300);
    expect(validateMixedCrushingCounts(
      { medical: 1_000, ammunition: 0, military: 1_000 },
      recommendation.baseTimeBudgetSeconds,
      mixedCrushingUnitSeconds,
    )).toBe('time');
  });

  it('validates integer strings, per-type limits and dynamic maxima without trimming other counts', () => {
    expect(parseMixedCrushingCountInputs({ medical: '2', ammunition: '3', military: '4' }))
      .toEqual({ medical: 2, ammunition: 3, military: 4 });
    expect(parseMixedCrushingCountInputs({ medical: '2.5', ammunition: '3', military: '4' }))
      .toBeNull();
    expect(parseMixedCrushingCountInputs({ medical: '1001', ammunition: '0', military: '0' }))
      .toBeNull();

    const existing = { medical: 1_000, ammunition: 100, military: 1_000 };
    expect(getMixedCrushingDynamicMax(existing, 'ammunition', 32_400, mixedCrushingUnitSeconds))
      .toBe(100);
    expect(getMixedCrushingDynamicMax(existing, 'medical', 32_400, mixedCrushingUnitSeconds))
      .toBe(1_000);
    expect(getMixedCrushingDynamicMax(
      { medical: 900, ammunition: 0, military: 900 },
      'ammunition',
      31_500,
      mixedCrushingUnitSeconds,
    )).toBe(675);
    expect(validateMixedCrushingCounts(
      { medical: 1_000, ammunition: 101, military: 1_000 },
      32_400,
      mixedCrushingUnitSeconds,
    )).toBe('time');
  });
});

describe('mixed crushing recommendations', () => {
  it('converts a full 32,400 base seconds to exactly 108 actual minutes at 80% reduction', () => {
    const counts = { medical: 1_000, ammunition: 1_000, military: 775 };
    const result = calculateManualMixedCrushing(calculateBaseEarnings(), counts)!;

    expect(result.baseSeconds).toBe(32_400);
    expect(result.actualSeconds).toBe(6_480);
    expect(result.actualSeconds / 60).toBe(108);
    expect(result.outputTechScrap).toBe(3_330);
  });

  it('依每種單件單位時間淨收益率貪婪填充，30 分鐘留下 8 基準秒', () => {
    const budget = getMixedCrushingBaseTimeBudget(30, 80);
    const counts = getRecommendedElapsedMixedCrushingCounts(
      { medical: 4, ammunition: 2, military: 3 },
      budget,
    );

    expect(budget).toBe(9_000);
    expect(counts).toEqual({ medical: 312, ammunition: 1_000, military: 0 });
    expect(getMixedCrushingBaseSeconds(counts, mixedCrushingUnitSeconds)).toBe(8_992);
    expect(budget - getMixedCrushingBaseSeconds(counts, mixedCrushingUnitSeconds)!)
      .toBe(8);
  });

  it('收益率排序會隨 resolved 市場淨收益改變，而不是固定優先彈藥', () => {
    const createRecommendation = (inputCosts: {
      readonly medical: number;
      readonly ammunition: number;
      readonly military: number;
    }) => {
      const prices = resolveMarketPrices({
        ...defaultSharedUserInputs,
        economy: {
          ...defaultSharedUserInputs.economy,
          prices: [
            { itemId: 'tech-scrap', currencyId: 'ai', amount: 1_000 },
            {
              itemId: 'medical-tech-parts',
              currencyId: 'ai',
              amount: inputCosts.medical,
            },
            {
              itemId: 'ammunition-tech-parts',
              currencyId: 'ai',
              amount: inputCosts.ammunition,
            },
            {
              itemId: 'military-ammunition-tech-parts',
              currencyId: 'ai',
              amount: inputCosts.military,
            },
          ],
        },
      });
      return calculateRecommendedMixedCrushing(calculateEarnings(
        validInputs,
        prices,
        { comparisonMode: 'elapsed-15' },
      )!)!;
    };

    const medicalLeads = createRecommendation({ medical: 0, ammunition: 1_000, military: 1_000 });
    const ammunitionLeads = createRecommendation({ medical: 1_000, ammunition: 0, military: 1_000 });

    expect(medicalLeads.counts).toMatchObject({ medical: 281, ammunition: 1 });
    expect(ammunitionLeads.counts).toMatchObject({ medical: 31, ammunition: 1_000 });
    expect(medicalLeads.baseSeconds).toBeLessThanOrEqual(4_500);
    expect(ammunitionLeads.baseSeconds).toBeLessThanOrEqual(4_500);
  });

  it('同收益率依固定類別順序處理，並略過負值、零值與缺價類別', () => {
    expect(getRecommendedElapsedMixedCrushingCounts(
      { medical: 1, ammunition: 0.25, military: 1 },
      16,
    )).toEqual({ medical: 1, ammunition: 0, military: 0 });

    expect(getRecommendedElapsedMixedCrushingCounts(
      { medical: -1, ammunition: null, military: 2 },
      32,
    )).toEqual({ medical: 0, ammunition: 0, military: 2 });
    expect(getRecommendedElapsedMixedCrushingCounts(
      { medical: -1, ammunition: 0, military: null },
      32_400,
    )).toEqual({ medical: 0, ammunition: 0, military: 0 });
    expect(getRecommendedElapsedMixedCrushingCounts(
      { medical: null, ammunition: null, military: null },
      32_400,
    )).toEqual({ medical: 0, ammunition: 0, military: 0 });
    expect(getRecommendedElapsedMixedCrushingCounts(
      { medical: 1, ammunition: 0.2, military: 0.5 },
      15,
    )).toEqual({ medical: 0, ammunition: 3, military: 0 });
    expect(getRecommendedElapsedMixedCrushingCounts(
      { medical: 1, ammunition: 0.2, military: 0.5 },
      3,
    )).toEqual({ medical: 0, ammunition: 0, military: 0 });
  });

  it('封頂在 32,400 基準秒與單類 1,000 次', () => {
    const counts = getRecommendedElapsedMixedCrushingCounts(
      { medical: 8, ammunition: 3, military: 4 },
      40_000,
    );

    expect(counts).toEqual({ medical: 1_000, ammunition: 1_000, military: 775 });
    expect(getMixedCrushingBaseSeconds(counts, mixedCrushingUnitSeconds)).toBe(32_400);
    expect(Object.values(counts).every((count) => count <= 1_000)).toBe(true);
  });

  it('飛逝推薦嚴守 15／30／45／60／105 分鐘 budget', () => {
    for (const minutes of [15, 30, 45, 60, 105] as const) {
      const calculation = calculateBaseEarnings(`elapsed-${minutes}`);
      const recommendation = calculateRecommendedMixedCrushing(calculation)!;
      const expectedBudget = getMixedCrushingBaseTimeBudget(minutes, 80);

      expect(recommendation.baseTimeBudgetSeconds).toBe(expectedBudget);
      expect(recommendation.baseSeconds).toBeLessThanOrEqual(expectedBudget);
      expect(recommendation.actualSeconds).toBeLessThanOrEqual(minutes * 60);
      expect(Object.values(recommendation.counts).every((count) => count <= 1_000))
        .toBe(true);
    }
  });

  it('每分鐘模式仍選最高正收益率種類並用滿該類合法次數', () => {
    const result = getRecommendedRateMixedCrushingCounts(
      { medical: 1, ammunition: 0.2, military: 1 },
      32_400,
    );
    expect(result).toEqual({ medical: 1_000, ammunition: 0, military: 0 });
    expect(getRecommendedRateMixedCrushingCounts(
      { medical: -1, ammunition: 0, military: null },
      32_400,
    )).toEqual({ medical: 0, ammunition: 0, military: 0 });
    expect(getRecommendedRateMixedCrushingCounts(
      { medical: 0.1, ammunition: 0.2, military: 0.05 },
      8,
    )).toEqual({ medical: 0, ammunition: 2, military: 0 });
  });

  it('reuses the existing normalized crush economics and preserves fractional tech-scrap yield', () => {
    const calculation = calculateBaseEarnings();
    const counts = { medical: 2, ammunition: 3, military: 4 };
    const result = calculateManualMixedCrushing(calculation, counts)!;
    const activityById = new Map(calculation.activities.map((activity) => [activity.id, activity]));
    const expectedNet = (activityById.get('crush-medical')?.unitNetAi ?? 0) * 2
      + (activityById.get('crush-ammunition')?.unitNetAi ?? 0) * 3
      + (activityById.get('crush-military-ammunition')?.unitNetAi ?? 0) * 4;

    expect(result.totalNetAi).toBeCloseTo(expectedNet, 12);
    expect(result.outputTechScrap).toBeCloseTo(10.8, 12);
    expect(result.aiPerMinute).toBeCloseTo(
      expectedNet / (result.actualSeconds / 60),
      12,
    );
  });
});
