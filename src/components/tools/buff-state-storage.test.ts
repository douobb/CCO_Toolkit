import { describe, expect, it } from 'vitest';

import {
  loadToolState,
  saveToolState,
  type StorageLike,
} from '@/lib/storage';

import { normalizeBlackMarketToolState } from './black-market-calculator';
import { normalizeEarningsOverviewToolState } from './earnings-overview';
import { normalizeLevelConversionToolState } from './level-conversion-calculator';
import { normalizeMiningToolState } from './mining-calculator';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('工具 Buff 狀態 storage', () => {
  it('保存與重載 100% Buff 時維持滿值', () => {
    const storage = new MemoryStorage();
    function expectStored<T extends object>(
      toolId: string,
      state: T,
      normalize: (value: unknown) => T | undefined,
      buff: keyof T,
    ) {
      expect(saveToolState(toolId, state, { storage })).toBe(true);
      const loaded = loadToolState<T>(toolId, {
        storage,
        normalize,
      });
      expect(loaded).toMatchObject({ [String(buff)]: '100' });
    }

    expectStored('black-market', {
      printingLevel: '1',
      btcBuffPercent: '100',
      trashAmount: '1000',
      commonAmount: '1000',
      highQualityAmount: '1000',
      rareAmount: '1000',
    }, normalizeBlackMarketToolState, 'btcBuffPercent');
    expectStored('earnings-overview', {
      searchLevel: '1',
      printingLevel: '1',
      miningLevel: '1',
      btcBuffPercent: '100',
      comparisonMode: 'per-minute',
      mixedCrushingMode: 'recommended',
      mixedMedicalCount: '0',
      mixedAmmunitionCount: '0',
      mixedMilitaryCount: '0',
    }, normalizeEarningsOverviewToolState, 'btcBuffPercent');
    expectStored('level-conversion', {
      levelType: 'level',
      currentLevel: '1',
      targetLevel: '1',
      cortexBonusPercent: '100',
    }, normalizeLevelConversionToolState, 'cortexBonusPercent');
    expectStored('mining', {
      miningLevel: '1',
      cortexBonusPercent: '100',
      tradeExploitPercent: '100',
    }, normalizeMiningToolState, 'cortexBonusPercent');
  });

  it('不同工具的 Buff 使用各自的 storage key', () => {
    const storage = new MemoryStorage();
    const blackMarketState = {
      printingLevel: '1',
      btcBuffPercent: '40',
      trashAmount: '1000',
      commonAmount: '1000',
      highQualityAmount: '1000',
      rareAmount: '1000',
    };
    const earningsState = {
      searchLevel: '1',
      printingLevel: '1',
      miningLevel: '1',
      btcBuffPercent: '80',
      comparisonMode: 'per-minute',
    };

    expect(saveToolState('black-market', blackMarketState, { storage })).toBe(true);
    expect(saveToolState('earnings-overview', earningsState, { storage })).toBe(true);
    expect(loadToolState('black-market', {
      storage,
      normalize: normalizeBlackMarketToolState,
    })?.btcBuffPercent).toBe('40');
    expect(loadToolState('earnings-overview', {
      storage,
      normalize: normalizeEarningsOverviewToolState,
    })?.btcBuffPercent).toBe('80');
  });
});
