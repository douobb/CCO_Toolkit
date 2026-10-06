import { describe, expect, it } from 'vitest';

import { marketCacheRateCatalog } from '@/data/game/economy';
import { progressionLevelCatalog } from '@/data/game/progression';

import {
  getToolPlayerSettingsPathContext,
  hasSharedUserInputsFilterFields,
} from './shared-user-inputs-filter';

describe('tool shared settings filter', () => {
  it('工具根總覽預設全部設定，related 檢視則提供空欄位範圍', () => {
    const context = getToolPlayerSettingsPathContext('/CCO_Toolkit/zh-tw/tools/');

    expect(context?.defaultView).toBe('all');
    expect(context?.relatedFilter).toEqual({
      progression: [],
      equipment: [],
      prices: [],
      exchangeRates: [],
      cacheRates: [],
    });
    expect(hasSharedUserInputsFilterFields(context!.relatedFilter)).toBe(false);
  });

  it('依 registry tool path 只列挖礦實際使用的技能、物價與匯率', () => {
    const context = getToolPlayerSettingsPathContext('/CCO_Toolkit/en/tools/mining/');

    expect(context?.defaultView).toBe('related');
    expect(context?.relatedFilter).toEqual({
      progression: ['level', 'mining-skill'],
      equipment: [],
      prices: ['hash', 'tech-scrap'],
      exchangeRates: ['btc-per-ai'],
      cacheRates: [],
    });
  });

  it('列出工具 selector/resolver 使用的 cacheRates 與動態 progression 範圍', () => {
    const blackMarket = getToolPlayerSettingsPathContext('/zh-cn/tools/black-market');
    const levelConversion = getToolPlayerSettingsPathContext('/zh-tw/tools/level-conversion');
    const searchReward = getToolPlayerSettingsPathContext('/en/tools/search-reward');
    const lootBoxAnalysis = getToolPlayerSettingsPathContext('/en/tools/loot-box-analysis');

    expect(blackMarket?.relatedFilter.cacheRates).toEqual(
      marketCacheRateCatalog.map(({ id }) => id),
    );
    expect(levelConversion?.relatedFilter.progression).toEqual(
      progressionLevelCatalog.map(({ id }) => id),
    );
    expect(levelConversion?.relatedFilter.cacheRates).toEqual(['trash']);
    expect(searchReward?.relatedFilter.exchangeRates).toEqual(['btc-per-ai']);
    expect(lootBoxAnalysis?.relatedFilter.exchangeRates).toEqual(['btc-per-ai']);
  });

  it('對沒有共用欄位的已註冊工具回傳空 related 範圍，未知路徑不猜測', () => {
    const backpack = getToolPlayerSettingsPathContext('/en/tools/backpack-planner');

    expect(backpack?.defaultView).toBe('related');
    expect(hasSharedUserInputsFilterFields(backpack!.relatedFilter)).toBe(false);
    expect(getToolPlayerSettingsPathContext('/en/tools/not-registered')).toBeNull();
    expect(getToolPlayerSettingsPathContext('/en/guides/tools')).toBeNull();
  });
});
