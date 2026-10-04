import { describe, expect, it } from 'vitest';

import { defaultSharedUserInputs } from '@/lib/storage';

import {
  convertMarketPriceAmount,
  defaultBtcPerAi,
  formatMarketPriceAmount,
  getDualPrice,
  resolveMarketPrices,
} from './market-prices';

describe('resolved market price model', () => {
  it('由 Game Data defaults 建立完整的純計算模型', () => {
    const prices = resolveMarketPrices();

    expect(defaultBtcPerAi).toBe(8_150);
    expect(prices).not.toHaveProperty('schemaVersion');
    expect(prices).not.toHaveProperty('btcPerAiUpdatedAt');
    expect(prices.btcPerAi).toBe(8_150);
    expect(prices.assets['tech-scrap']).toEqual({
      basisCurrency: 'ai',
      basisValue: 110,
    });
    expect(prices.assets['locked-container']).toEqual({
      basisCurrency: 'btc',
      basisValue: 3_000,
    });
    expect(prices.assets['supply-crate-gang']).toEqual({
      basisCurrency: 'ai',
      basisValue: 0.33,
    });
    expect(prices.assets['old-pouch']).toEqual({
      basisCurrency: 'ai',
      basisValue: 12.5,
    });
    expect(prices.assets['fanny-pack']).toEqual({
      basisCurrency: 'ai',
      basisValue: 130,
    });
    expect(prices.assets['explorer-backpack']).toEqual({
      basisCurrency: 'ai',
      basisValue: 2_050,
    });
    expect(prices.assets['employee-office-case']).toEqual({
      basisCurrency: 'ai',
      basisValue: 41_000,
    });
    expect(prices.caches).toEqual({
      trash: { value: 9 },
      common: { value: 8 },
      'high-quality': { value: 6 },
      rare: { value: 3 },
    });
  });

  it('只套用指定的單項 sparse price override，其他項目仍使用 defaults', () => {
    const prices = resolveMarketPrices({
      ...defaultSharedUserInputs,
      economy: {
        ...defaultSharedUserInputs.economy,
        prices: [
          { itemId: 'tech-scrap', currencyId: 'btc', amount: 1 },
        ],
      },
    });

    expect(prices.assets['tech-scrap']).toEqual({
      basisCurrency: 'btc',
      basisValue: 1,
    });
    expect(prices.assets['medical-tech-parts']).toEqual({
      basisCurrency: 'ai',
      basisValue: 50,
    });
    expect(getDualPrice(prices, 'tech-scrap', 'ai')).toBe(1 / 8_150);
    expect(getDualPrice(prices, 'tech-scrap', 'btc')).toBe(1);
  });

  it('套用 sparse 匯率與 cache override，並保留未覆寫 defaults', () => {
    const prices = resolveMarketPrices({
      ...defaultSharedUserInputs,
      economy: {
        ...defaultSharedUserInputs.economy,
        exchangeRates: [{ id: 'btc-per-ai', value: 10_000 }],
        cacheRates: [{ id: 'rare', value: 4 }],
      },
    });

    expect(prices.btcPerAi).toBe(10_000);
    expect(prices.caches.rare).toEqual({ value: 4 });
    expect(prices.caches.trash).toEqual({ value: 9 });
    expect(getDualPrice(prices, 'locked-container', 'ai')).toBe(0.3);
  });

  it('依保存基準貨幣進行 AI／BTC conversion', () => {
    const prices = resolveMarketPrices({
      ...defaultSharedUserInputs,
      economy: {
        ...defaultSharedUserInputs.economy,
        prices: [{ itemId: 'old-pouch', currencyId: 'btc', amount: 1 }],
        exchangeRates: [{ id: 'btc-per-ai', value: 10_000 }],
      },
    });

    expect(getDualPrice(prices, 'old-pouch', 'btc')).toBe(1);
    expect(getDualPrice(prices, 'old-pouch', 'ai')).toBe(0.0001);
    expect(getDualPrice(prices, 'tech-scrap', 'btc')).toBe(1_100_000);
  });

  it('純換算輔助依保存基準貨幣轉換，並保留小額輸入精度', () => {
    expect(convertMarketPriceAmount(2, 'ai', 'btc', 100)).toBe(200);
    expect(convertMarketPriceAmount(200, 'btc', 'ai', 100)).toBe(2);
    expect(formatMarketPriceAmount(0.33 / 8_150)).toBe('0.0000404907975460123');
    expect(formatMarketPriceAmount(24_450_000)).toBe('24450000');
  });
});
