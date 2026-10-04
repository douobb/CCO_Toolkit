import { describe, expect, it } from 'vitest';

import {
  baseExperiencePerBatch,
  calculateLevelRequirements,
  LEVEL_MAX,
  levelMethodsForType,
  requiredLevelExperience,
  validateLevelInputs,
} from './level-calculator';
import { resolveMarketPrices } from './market-prices';

describe('level calculator', () => {
  it('依規格套用主等級／技能等級 EXP 公式與來源批次', () => {
    expect(requiredLevelExperience('level', 400)).toBe(Math.ceil(8 * 400 ** 3.1));
    expect(requiredLevelExperience('printing-rank', 400)).toBe(Math.ceil(8 * 400 ** 3.02));
    expect(baseExperiencePerBatch('ai', 400)).toBe(
      Math.ceil((400 ** 1.8 + 16) * 1.1 * 12) * 8,
    );
    expect(baseExperiencePerBatch('medical-scrap', 400)).toBe(Math.ceil(400 ** 2 + 16) * 100);
    expect(baseExperiencePerBatch('scavenge', 400)).toBe((400 ** 2 + 16) * 9 * 10);
    expect(baseExperiencePerBatch('anti-matter-charge', 400)).toBe(Math.ceil(400 ** 2 + 16) * 100);
    expect(baseExperiencePerBatch('ai-crafting', 400)).toBe((400 ** 2 + 16) * 100);
    expect(levelMethodsForType('printing-rank').map((method) => method.id)).toEqual([
      'black-market',
      'printing-job',
      'reverse-engineering',
    ]);
  });

  it('符合 Helper 已有 Lv.350 到 Lv.400、Buff 80% 的黃金資料', () => {
    const common = { currentLevel: 350, targetLevel: 400, cortexBonusPercent: 80 } as const;
    expect(calculateLevelRequirements({ ...common, levelType: 'level' })?.methods).toEqual([
      expect.objectContaining({
        id: 'ai',
        neededTimes: 4_679,
        resourceResults: [expect.objectContaining({ id: 'ai', amount: 37_432 })],
      }),
    ]);
    const mining = calculateLevelRequirements({ ...common, levelType: 'mining-skill' });
    expect(mining?.methods[0]).toEqual(
      expect.objectContaining({
        id: 'mining',
        neededTimes: 1_958,
        resourceResults: [expect.objectContaining({ id: 'hash', amount: 15_664 })],
      }),
    );
    expect(mining?.methods[1]).toEqual(
      expect.objectContaining({
        id: 'ai-crafting',
        neededTimes: 940,
        resourceResults: [
          expect.objectContaining({ id: 'hash', amount: 1_880_000 }),
          expect.objectContaining({ id: 'tech-scrap', amount: 940_000 }),
        ],
      }),
    );
    expect(calculateLevelRequirements({ ...common, levelType: 'printing-rank' })?.methods[0])
      .toEqual(expect.objectContaining({
        id: 'black-market',
        neededTimes: 94,
        resourceResults: [expect.objectContaining({ id: 'cache', amount: 94_000 })],
      }));
    expect(calculateLevelRequirements({ ...common, levelType: 'medical-science' })?.methods[0])
      .toEqual(expect.objectContaining({
        id: 'medical-scrap',
        neededTimes: 470,
        resourceResults: [expect.objectContaining({ id: 'medical-tech-parts', amount: 47_000 })],
      }));
    expect(calculateLevelRequirements({ ...common, levelType: 'ammo-crafting' })?.methods[0])
      .toEqual(expect.objectContaining({
        id: 'energy-cell',
        neededTimes: 940,
        resourceResults: [expect.objectContaining({
          id: 'ammunition-tech-parts',
          amount: 94_000,
        })],
      }));
  });

  it('醫學返還先取整後除以二，並由市場 catalog 提供資源價值', () => {
    const result = calculateLevelRequirements({
      levelType: 'medical-science',
      currentLevel: 1,
      targetLevel: 2,
      cortexBonusPercent: 0,
    });
    expect(result?.methods.find((item) => item.id === 'medical-scrap')).toEqual(
      expect.objectContaining({
        neededTimes: 0.5,
        resourceResults: [expect.objectContaining({ id: 'medical-tech-parts', amount: 50 })],
        totalMinutes: null,
      }),
    );

    const prices = resolveMarketPrices();
    const mining = calculateLevelRequirements({
      levelType: 'mining-skill',
      currentLevel: 1,
      targetLevel: 2,
      cortexBonusPercent: 0,
    }, prices);
    const craft = mining?.methods.find((item) => item.id === 'ai-crafting');
    expect(craft).toEqual(expect.objectContaining({
      neededTimes: 1,
      totalMinutes: 100,
      totalValueAi: 3_810,
    }));
    expect(craft?.resourceResults).toEqual([
      expect.objectContaining({ id: 'hash', amount: 2_000 }),
      expect.objectContaining({ id: 'tech-scrap', amount: 1_000 }),
    ]);
  });

  it('物價換算溢位時保留操作與資源結果，但不輸出無限大價值', () => {
    const prices = resolveMarketPrices();
    const overflowPrices = {
      ...prices,
      assets: {
        ...prices.assets,
        hash: { basisCurrency: 'ai' as const, basisValue: Number.MAX_VALUE, updatedAt: 1_000 },
      },
    };
    const result = calculateLevelRequirements({
      levelType: 'mining-skill',
      currentLevel: 1,
      targetLevel: 2,
      cortexBonusPercent: 0,
    }, overflowPrices);
    const craft = result?.methods.find((method) => method.id === 'ai-crafting');
    expect(craft).toEqual(expect.objectContaining({
      neededTimes: 1,
      totalValueAi: null,
    }));
  });

  it('目前等級等於目標時為零，且拒絕倒置與越界輸入', () => {
    const result = calculateLevelRequirements({
      levelType: 'scavenge-skill',
      currentLevel: 800,
      targetLevel: 800,
      cortexBonusPercent: 100,
    });
    expect(result?.methods[0]).toEqual(expect.objectContaining({
      neededTimes: 0,
      resourceResults: [],
    }));
    expect(LEVEL_MAX).toBe(800);
    expect(validateLevelInputs({
      levelType: 'level',
      currentLevel: 10,
      targetLevel: 9,
      cortexBonusPercent: 0,
    })).toBe('target-before-current');
    expect(validateLevelInputs({
      levelType: 'level',
      currentLevel: 0,
      targetLevel: 10,
      cortexBonusPercent: 0,
    })).toBe('invalid-current');
    expect(validateLevelInputs({
      levelType: 'level',
      currentLevel: 1,
      targetLevel: 10,
      cortexBonusPercent: 101,
    })).toBe('invalid-buff');
  });
});
