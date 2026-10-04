import { describe, expect, it } from 'vitest';

import {
  BUFF_PERCENT_VALUES,
  normalizeLegacyBuffPercent,
  parseBuffPercent,
} from './buff-percent';

describe('Buff percentage rules', () => {
  it('only exposes the four discrete slider values', () => {
    expect(BUFF_PERCENT_VALUES).toEqual([0, 40, 80, 100]);
    expect(parseBuffPercent('0')).toBe(0);
    expect(parseBuffPercent('40')).toBe(40);
    expect(parseBuffPercent('80')).toBe(80);
    expect(parseBuffPercent('100')).toBe(100);
    expect(parseBuffPercent('20')).toBeNull();
    expect(parseBuffPercent('60')).toBeNull();
  });

  it('maps legacy values to the nearest supported value without exceeding 100%', () => {
    expect(normalizeLegacyBuffPercent(0)).toBe(0);
    expect(normalizeLegacyBuffPercent(25)).toBe(40);
    expect(normalizeLegacyBuffPercent(50)).toBe(40);
    expect(normalizeLegacyBuffPercent(75)).toBe(80);
    expect(normalizeLegacyBuffPercent(100)).toBe(100);
    expect(normalizeLegacyBuffPercent(-1)).toBeUndefined();
    expect(normalizeLegacyBuffPercent('not-a-number')).toBeUndefined();
  });
});
