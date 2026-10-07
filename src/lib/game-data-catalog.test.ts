import { describe, expect, it } from 'vitest';

import {
  backpackMaterialCatalog,
  backpackProgressionDataSet,
  backpackTierCatalog,
} from '@/data/game/backpack-progression';
import {
  economyDataSet,
  economyItemCatalog,
  marketPriceCatalog,
} from '@/data/game/economy';
import {
  earningsActivitiesDataSet,
  earningsActivityCatalog,
} from '@/data/game/earnings-activities';
import { lootBoxCatalog, lootBoxesDataSet } from '@/data/game/loot-boxes';
import { blackMarketDataSet, blackMarketQualityCatalog } from '@/data/game/black-market';
import { dungeonDataSet, dungeonPrefixCatalog, dungeonSummaryPrefixCatalog } from '@/data/game/dungeon';
import {
  effectsDataSet,
  manualEffectInputCatalog,
  statusEffectCatalog,
} from '@/data/game/effects';
import {
  progressionDataSet,
  progressionLevelCatalog,
  progressionMethodCatalog,
} from '@/data/game/progression';

import {
  gameDataSetCatalog,
  getGameDataMetadataById,
  getGameDataSet,
  getSearchRewardPriceDefinition,
  searchRewardPriceFieldCatalog,
} from './game-data-catalog';

describe('TASK-403 Game Data catalog', () => {
  it('提供六個固定等級欄位與有效範圍', () => {
    expect(progressionLevelCatalog.map((item) => item.id)).toEqual([
      'level',
      'printing-rank',
      'medical-science',
      'ammo-crafting',
      'scavenge-skill',
      'mining-skill',
    ]);
    expect(progressionLevelCatalog.every((item) =>
      item.range.min === 1 && item.range.max === 800 && item.defaultValue === 1,
    )).toBe(true);
    expect(progressionLevelCatalog.map((item) => item.labels['zh-tw'])).toEqual([
      '等級',
      '分子列印等級',
      '醫學等級',
      '彈藥製作等級',
      '搜索等級',
      '挖礦等級',
    ]);
    expect(progressionLevelCatalog.map((item) => item.labels['zh-cn'])).toEqual([
      '人物等级',
      '打印等级',
      '医学等级',
      '弹药制作等级',
      '探索等级',
      '挖矿等级',
    ]);
    expect(progressionMethodCatalog['mining-skill']).toHaveLength(2);
  });

  it('提供市場物品、貨幣、單位、預設值與匯率基準', () => {
    expect(economyItemCatalog).toHaveLength(13);
    expect(marketPriceCatalog).toHaveLength(13);
    expect(marketPriceCatalog.find((item) => item.itemId === 'medical-tech-parts')).toMatchObject({
      unit: 'AI/k',
      defaultBasisCurrencyId: 'ai',
      defaultBasisValue: 50,
      verification: 'confirmed',
    });
    expect(economyDataSet.payload.exchangeRates[0]).toMatchObject({
      baseCurrencyId: 'ai',
      quoteCurrencyId: 'btc',
      unit: 'BTC/AI',
      defaultValue: 8450,
    });
  });

  it('只把計算假設列入手動輸入，觀察效果維持獨立目錄', () => {
    expect(statusEffectCatalog).toHaveLength(26);
    expect(statusEffectCatalog.every((effect) => effect.sourceKind === 'plugin-observed')).toBe(true);
    expect(manualEffectInputCatalog.map((input) => input.id)).toEqual([
      'btc-buff-percent',
      'exp-buff-percent',
    ]);
    expect(manualEffectInputCatalog.every((input) =>
      input.kind === 'manual-calculation-assumption'
      && input.range.min === 0
      && input.range.max === 100
      && input.range.step === 40
      && input.defaultValue === null,
    )).toBe(true);
  });

  it('提供黑市品質目錄與可供計算器消費的規則資料', () => {
    expect(blackMarketQualityCatalog.map((quality) => quality.id)).toEqual([
      'trash',
      'common',
      'high-quality',
      'rare',
    ]);
    expect(blackMarketQualityCatalog.map((quality) => quality.saleMultiplier)).toEqual([
      0.7,
      0.8,
      1,
      1.2,
    ]);
    expect(blackMarketDataSet.payload.levelRange).toEqual({ min: 1, max: 800, step: 1 });
    expect(blackMarketDataSet.payload.saleFormula).toMatchObject({
      formulaId: 'printing-level-cache-sale',
      levelOffset: 100,
      rounding: 'ceil',
    });
  });

  it('提供地城固定規則、前綴修正與入侵等級區段', () => {
    expect(dungeonPrefixCatalog).toEqual([
      'x',
      'angry',
      'tough',
      'shielded',
      'agile',
      'mad',
      'crit',
      'berserker',
    ]);
    expect(dungeonSummaryPrefixCatalog).not.toContain('x');
    expect(dungeonDataSet.payload.levelRange).toEqual({ min: 1, max: 600, step: 1 });
    expect(dungeonDataSet.payload.baseFormulas.experience).toEqual({
      power: 1.8,
      base: 16,
      multiplier: 1.1,
    });
    expect(dungeonDataSet.payload.enemyTypeModifiers.invasion.tiers.map((tier) => tier.levelRange)).toEqual([
      { min: 1, max: 102, step: 1 },
      { min: 103, max: 502, step: 1 },
      { min: 503, max: 600, step: 1 },
    ]);
  });

  it('提供活動收益目錄與背包升級資料，且不包含玩家持有數量', () => {
    expect(earningsActivityCatalog).toHaveLength(16);
    expect(new Set(earningsActivityCatalog.map((activity) => activity.id)).size).toBe(16);
    expect(earningsActivityCatalog.find((activity) => activity.id === 'crush-medical')).toMatchObject({
      kind: 'crush',
      inputItemId: 'medical-tech-parts',
      outputItemId: 'tech-scrap',
      inputQuantity: 1,
      outputQuantity: 1.2,
      unitBtcCost: 0,
    });
    expect(earningsActivityCatalog
      .filter((activity) => activity.kind === 'pack')
      .map((activity) => [
        activity.id,
        activity.kind === 'pack' ? activity.unitBtcCost : null,
      ])).toEqual([
      ['pack-old-pouch', 500],
      ['pack-fanny-pack', 5_000],
      ['pack-explorer-backpack', 5_000],
      ['pack-employee-office-case', 50_000],
    ]);
    expect(earningsActivityCatalog.every((activity) =>
      !Object.prototype.hasOwnProperty.call(activity, 'referenceTimeReductionPercent'),
    )).toBe(true);

    expect(backpackTierCatalog).toHaveLength(6);
    expect(backpackMaterialCatalog).toHaveLength(8);
    expect(backpackTierCatalog[0]?.requirements).toEqual([
      { itemId: 'tech-scrap', quantity: 100 },
    ]);
    expect(backpackTierCatalog.every((tier) =>
      !Object.prototype.hasOwnProperty.call(tier, 'inventoryQuantity')
      && !Object.prototype.hasOwnProperty.call(tier, 'ownedQuantity'),
    )).toBe(true);
    expect(backpackProgressionDataSet.payload.materials.find((material) =>
      material.id === 'medical-tech-parts',
    )?.techScrapEquivalent).toBe(1.2);

    expect(lootBoxCatalog).toHaveLength(3);
    expect(lootBoxCatalog.map((box) => box.id)).toEqual(['white', 'yellow', 'purple']);
    expect(lootBoxesDataSet.payload.sourceTableVersion).toBe('0.1866');
  });

  it('透過 adapter 將 Search Reward 價格欄位對到市場物品，而不複製價格', () => {
    expect(searchRewardPriceFieldCatalog).toEqual([
      { field: 'mt', itemId: 'medical-tech-parts' },
      { field: 'atp', itemId: 'ammunition-tech-parts' },
      { field: 'matp', itemId: 'military-ammunition-tech-parts' },
    ]);
    expect(getSearchRewardPriceDefinition('matp').definition.defaultBasisValue).toBe(100);
    expect(economyItemCatalog.find((item) => item.id === 'medical-tech-parts')?.labels['zh-tw'])
      .toBe('醫療科技零件');
    expect(economyItemCatalog.find((item) => item.id === 'medical-tech-parts')?.labels['zh-cn'])
      .toBe('医疗科技零件');
  });

  it('所有目前資料集保留 CCO Found 來源與登錄的 metadata', () => {
    for (const dataSet of [
      progressionDataSet,
      backpackProgressionDataSet,
      economyDataSet,
      effectsDataSet,
      blackMarketDataSet,
      dungeonDataSet,
      earningsActivitiesDataSet,
      lootBoxesDataSet,
    ]) {
      expect(dataSet.sources[0]).toEqual({
        name: 'CCO Found',
        url: 'https://docs.google.com/spreadsheets/d/1wJLuZhZg_Xs1ouyjh6chntY8p3lcgNTuRU3-9JwKxQ4',
      });
      if (dataSet.datasetId === 'economy') {
        expect(dataSet.dataVersion).toBe('cco-found-price-update-2026-10-05');
        expect(dataSet.updatedAt).toBe('2026-10-05');
      } else if (dataSet.datasetId === 'earnings-activities') {
        expect(dataSet.schemaVersion).toBe('1.1.0');
        expect(dataSet.dataVersion).toBe('cco-found-black-market-batch-size-update-2026-10-07');
        expect(dataSet.updatedAt).toBe('2026-10-07');
      } else {
        expect(dataSet.dataVersion).toBe('cco-found-initial-snapshot');
        expect(['2026-08-28', '2026-08-29', '2026-09-19']).toContain(dataSet.updatedAt);
      }
      expect(Object.isFrozen(dataSet)).toBe(true);
      expect(Object.isFrozen(dataSet.payload)).toBe(true);
    }
    expect(Object.keys(gameDataSetCatalog)).toEqual([
      'search-rewards',
      'progression',
      'backpack-progression',
      'economy',
      'effects',
      'black-market',
      'dungeon',
      'earnings-activities',
      'loot-boxes',
    ]);
    expect(getGameDataSet('search-rewards')).toBeDefined();
    expect(getGameDataSet('not-published')).toBeUndefined();
    expect(getGameDataSet('constructor')).toBeUndefined();
    expect(getGameDataMetadataById('search-rewards')).toMatchObject({
      datasetId: 'search-rewards',
      dataVersion: 'cco-found-initial-snapshot',
      updatedAt: '2026-08-27',
    });
  });
});
