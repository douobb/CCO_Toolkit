import { describe, expect, it } from 'vitest';

import { searchRewardDataSet } from '@/data/game/search-rewards';

import {
  calculateAreaReward,
  computeOptimalSearchArea,
  defaultSearchRewards,
} from './search-reward';

describe('Search Reward calculator', () => {
  it('直接使用已驗證的 Search Reward payload', () => {
    expect(defaultSearchRewards).toBe(searchRewardDataSet.payload);
    expect(defaultSearchRewards).toHaveLength(240);
    expect(Math.min(...defaultSearchRewards.map((entry) => entry.level))).toBe(1);
    expect(Math.max(...defaultSearchRewards.map((entry) => entry.level))).toBe(797);
  });

  it('calculates expected material quantities and AI value', () => {
    const result = calculateAreaReward(
      {
        level: 10,
        mt: 4,
        mt_p: 0.5,
        atp: 2,
        atp_p: 0.25,
        matp: 1,
        matp_p: 0.2,
      },
      { mt: 1_000, atp: 2_000, matp: 5_000 },
      2,
    );

    expect(result).toEqual({
      level: 10,
      expectedMtQty: 4,
      expectedAtpQty: 1,
      expectedMatpQty: 0.4,
      totalExpectedValue: 8,
    });
  });

  it('selects the highest-value accessible area and exposes new ladder records', () => {
    const result = computeOptimalSearchArea(
      [
        { level: 1, mt: 1, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
        { level: 4, mt: 2, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
        { level: 7, mt: 1, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
        { level: 11, mt: 3, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
      ],
      7,
      { mt: 1_000, atp: 0, matp: 0 },
      1,
    );

    expect(result.optimalArea?.level).toBe(4);
    expect(result.ladder).toEqual([
      { level: 1, expectedValue: 1, isCurrentOptimal: false },
      { level: 4, expectedValue: 2, isCurrentOptimal: true },
      { level: 11, expectedValue: 3, isCurrentOptimal: false },
    ]);
  });

  it('returns no optimal area when no area is accessible', () => {
    const result = computeOptimalSearchArea(
      defaultSearchRewards,
      null,
      { mt: 0, atp: 0, matp: 0 },
      10,
    );

    expect(result.optimalArea).toBeNull();
    expect(result.ladder.length).toBeGreaterThan(0);
  });
});
