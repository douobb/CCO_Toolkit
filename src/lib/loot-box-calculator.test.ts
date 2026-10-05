import { describe, expect, it } from 'vitest';

import { resolveMarketPrices } from './market-prices';
import {
  expectedLootBoxNetAi,
  expectedLootBoxValueAi,
  lootBoxCostAi,
} from './loot-box-calculator';

describe('loot box calculator', () => {
  it('以箱子權重與市場價格計算 gross、成本與淨收益', () => {
    const prices = resolveMarketPrices();
    const gross = expectedLootBoxValueAi('white', prices);
    const cost = lootBoxCostAi('white', prices);
    const net = expectedLootBoxNetAi('white', prices);

    expect(gross).toBeTypeOf('number');
    expect(cost).toBe(3000 / 8450 + 32 * 110 / 1000);
    expect(net).toBe(gross! - cost!);
  });

  it('市場價格被覆寫時會反映在箱子期望收益', () => {
    const prices = resolveMarketPrices({
      economy: {
        prices: [{ itemId: 'hash', currencyId: 'ai', amount: 5 }],
        exchangeRates: [],
        cacheRates: [],
      },
    });
    const defaultValue = expectedLootBoxValueAi('white', resolveMarketPrices());
    const changedValue = expectedLootBoxValueAi('white', prices);

    expect(changedValue).not.toBe(defaultValue);
  });
});
