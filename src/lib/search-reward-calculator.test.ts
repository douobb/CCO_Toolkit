import { describe, expect, it } from 'vitest';

import {
  calculateSearchReward,
  parseSearchRewardValues,
  type SearchRewardEntry,
  type SearchRewardFormValues,
} from './search-reward-calculator';

const sampleRewards: readonly SearchRewardEntry[] = [
  { level: 1, mt: 1, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
  { level: 10, mt: 2, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
  { level: 20, mt: 3, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
];

const validValues: SearchRewardFormValues = {
  playerLevel: '1',
  searchCount: '1',
  mtPrice: '0',
  atpPrice: '1.5',
  matpPrice: '2',
};

describe('Search Reward calculator pure module', () => {
  it('accepts the input boundaries and parses prices independently', () => {
    const parsed = parseSearchRewardValues({
      ...validValues,
      playerLevel: '800',
      searchCount: '12',
    });

    expect(parsed.errors).toEqual({});
    expect(parsed.inputs).toEqual({
      playerLevel: 800,
      searchCount: 12,
      prices: { mt: 0, atp: 1.5, matp: 2 },
    });
  });

  it('rejects empty, out-of-range, non-integer, negative and non-finite inputs', () => {
    const parsed = parseSearchRewardValues({
      playerLevel: '0',
      searchCount: '13',
      mtPrice: '-1',
      atpPrice: 'Infinity',
      matpPrice: '',
    });

    expect(parsed.errors).toEqual({
      playerLevel: 'level',
      searchCount: 'count',
      mtPrice: 'price',
      atpPrice: 'price',
      matpPrice: 'price',
    });
    expect(parsed.inputs).toBeNull();
  });

  it('does not accept decimal or exponent notation for integer fields', () => {
    const parsed = parseSearchRewardValues({
      ...validValues,
      playerLevel: '1.5',
      searchCount: '1e2',
    });

    expect(parsed.errors).toEqual({ playerLevel: 'level', searchCount: 'count' });
    expect(parsed.inputs).toBeNull();
  });

  it('combines validation and calculation without mutating the supplied data', () => {
    const rewards = [...sampleRewards];
    const calculation = calculateSearchReward(rewards, {
      ...validValues,
      playerLevel: '20',
      searchCount: '2',
      mtPrice: '1000',
    });

    expect(calculation.errors).toEqual({});
    expect(calculation.inputs?.playerLevel).toBe(20);
    expect(calculation.result?.optimalArea?.level).toBe(20);
    expect(rewards.map((entry) => entry.level)).toEqual([1, 10, 20]);
  });

  it('skips calculation when any input is invalid', () => {
    const calculation = calculateSearchReward(sampleRewards, {
      ...validValues,
      playerLevel: 'not-a-level',
    });

    expect(calculation.errors).toEqual({ playerLevel: 'level' });
    expect(calculation.inputs).toBeNull();
    expect(calculation.result).toBeNull();
  });
});
