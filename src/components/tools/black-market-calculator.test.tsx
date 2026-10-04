import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  BlackMarketCalculator,
  BlackMarketSettingsPanel,
  BlackMarketToolProvider,
  applyBlackMarketSharedValues,
  calculateBlackMarketTool,
  createBlackMarketValues,
  normalizeBlackMarketToolState,
  parseBlackMarketValues,
  selectBlackMarketSharedValues,
  updateBlackMarketSharedValue,
} from './black-market-calculator';

function renderBlackMarket(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <BlackMarketToolProvider>{children}</BlackMarketToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

describe('Black market calculator presentation', () => {
  it('主要輸入呈現等級、收益加成、快取與匯率，卡片結果拆解採雙欄橫向列式', () => {
    const labels = getMessages('zh-tw').tools.blackMarket;
    const markup = renderBlackMarket(
      <BlackMarketCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('data-tool="black-market"');
    expect(markup).toContain('id="black-market-printing-level"');
    expect(markup).toContain('id="black-market-bargain-percent"');
    expect(markup).toContain('id="black-market-btc-buff-percent"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('id="black-market-trash-cache-rate"');
    expect(markup).toContain('id="black-market-common-cache-rate"');
    expect(markup).toContain('id="black-market-high-quality-cache-rate"');
    expect(markup).toContain('id="black-market-rare-cache-rate"');
    expect(markup).toContain('id="black-market-btc-per-ai"');
    expect(markup.indexOf('id="black-market-btc-buff-percent"')).toBeLessThan(
      markup.indexOf('id="black-market-btc-per-ai"'),
    );
    expect(markup).not.toContain('id="black-market-exp-buff-percent"');
    expect(markup).not.toContain('id="black-market-trash-amount"');
    expect(markup).not.toContain('id="black-market-common-amount"');
    expect(markup).not.toContain('id="black-market-high-quality-amount"');
    expect(markup).not.toContain('id="black-market-rare-amount"');
    expect(markup).toContain('廢棄');
    expect(markup).toContain('普通');
    expect(markup).toContain('高級');
    expect(markup).toContain('稀有');
    expect(markup).toContain('從共用設定填入');
    expect(markup).toContain('@min-[24rem]:grid-cols-2');
    expect(markup).toContain('估算淨收益');
    expect(markup).toContain('淨收益（AI）');
    expect(markup).not.toContain('淨收益（BTC）');
    expect(markup).not.toContain('每個快取出售');
    expect(markup).not.toContain('獲得經驗');
    expect(markup).toContain('data-result-layout="table"');
    expect(markup).toContain('<table');
    expect(markup).toContain('min-w-[48rem]');
    expect(markup).toContain('table-fixed');
    expect(markup).toContain('w-[15%]');
    expect(markup).toContain('w-[19%]');
    expect(markup).toContain('<tbody>');
    expect(markup.match(/<tr/g)).toHaveLength(5);
    expect(markup).not.toContain('data-result-card="black-market"');
    expect(markup).not.toContain('data-result-summary="black-market"');
    expect(markup).not.toContain('<details');
    expect(markup).toContain('快取品質');
    expect(markup).not.toContain('CCO Found');
  });

  it('設定面板提供四種快取數量，不建立逐欄位覆寫切換', () => {
    const labels = getMessages('zh-tw').tools.blackMarket;
    const markup = renderBlackMarket(
      <BlackMarketSettingsPanel
        labels={labels}
        locale="zh-tw"
        idPrefix="test-black-market-settings"
      />,
    );

    expect(markup).toContain('id="test-black-market-settings-trash-amount"');
    expect(markup).toContain('id="test-black-market-settings-common-amount"');
    expect(markup).toContain('id="test-black-market-settings-high-quality-amount"');
    expect(markup).toContain('id="test-black-market-settings-rare-amount"');
    expect(markup).not.toContain('exp-buff-percent');
    expect(markup).not.toContain('cache-rate');
    expect(markup).not.toContain('btc-per-ai');
    expect(markup).not.toContain('沿用共用值');
    expect(markup).not.toContain('本工具覆寫');
  });

  it('將本工具狀態與價格草稿組合成計算輸入', () => {
    expect(
      createBlackMarketValues(
        {
          printingLevel: '500',
          bargainPercent: '40',
          btcBuffPercent: '100',
          trashAmount: '1000',
          commonAmount: '900',
          highQualityAmount: '800',
          rareAmount: '700',
        },
        {
          trashCachePerAi: '9',
          commonCachePerAi: '8',
          highQualityCachePerAi: '6',
          rareCachePerAi: '3',
          btcPerAi: '8150',
        },
      ),
    ).toEqual({
      printingLevel: '500',
      bargainPercent: '40',
      btcBuffPercent: '100',
      trashAmount: '1000',
      commonAmount: '900',
      highQualityAmount: '800',
      rareAmount: '700',
      trashCachePerAi: '9',
      commonCachePerAi: '8',
      highQualityCachePerAi: '6',
      rareCachePerAi: '3',
      btcPerAi: '8150',
    });
  });

  it('從穩定 ID 與 resolved market model 投影共用值，但不讀取 Shared Buff', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      progression: {
        ...defaultSharedUserInputs.progression,
        player: { level: 99 },
        skills: [{ id: 'printing-rank' as const, level: 77 }],
      },
      economy: {
        ...defaultSharedUserInputs.economy,
        exchangeRates: [{ id: 'btc-per-ai' as const, value: 9000 }],
        cacheRates: [
          { id: 'trash' as const, value: 10 },
          { id: 'common' as const, value: 9 },
          { id: 'high-quality' as const, value: 7 },
          { id: 'rare' as const, value: 4 },
        ],
      },
      effects: {
        buffs: [
          { id: 'btc-buff-percent' as const, percentage: 100 as const },
          { id: 'exp-buff-percent' as const, percentage: 80 as const },
        ],
      },
      equipment: { bargainPercent: 25 },
    };

    expect(selectBlackMarketSharedValues(snapshot)).toEqual({
      printingLevel: '77',
      bargainPercent: '25',
      trashCachePerAi: '10',
      commonCachePerAi: '9',
      highQualityCachePerAi: '7',
      rareCachePerAi: '4',
      btcPerAi: '9000',
    });
  });

  it('新狀態的 Buff 預設 100，既有值保留且填入共用設定不覆蓋 Buff', () => {
    const missingBuff = {
      printingLevel: '1',
      bargainPercent: '0',
      trashAmount: '1000',
      commonAmount: '1000',
      highQualityAmount: '1000',
      rareAmount: '1000',
    };
    expect(normalizeBlackMarketToolState(missingBuff)?.btcBuffPercent).toBe('100');
    expect(normalizeBlackMarketToolState({ ...missingBuff, btcBuffPercent: '100' })?.btcBuffPercent)
      .toBe('100');

    const shared = selectBlackMarketSharedValues(defaultSharedUserInputs);
    const applied = applyBlackMarketSharedValues(
      { ...missingBuff, btcBuffPercent: '40' },
      shared,
    );
    expect(applied.btcBuffPercent).toBe('40');
  });

  it('將有效快取換算與匯率修改回寫共用庫，回到預設值時移除覆寫', () => {
    const withCacheOverride = updateBlackMarketSharedValue(
      defaultSharedUserInputs,
      'commonCachePerAi',
      10,
    );
    expect(withCacheOverride.economy.cacheRates).toEqual([
      { id: 'common', value: 10 },
    ]);

    const restoredCache = updateBlackMarketSharedValue(
      withCacheOverride,
      'commonCachePerAi',
      8,
    );
    expect(restoredCache.economy.cacheRates).toEqual([]);

    const withRateOverride = updateBlackMarketSharedValue(
      defaultSharedUserInputs,
      'btcPerAi',
      9000,
    );
    expect(withRateOverride.economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 9000 },
    ]);
  });

  it('拒絕小數、負值與超出共用限制，合法輸入才產生結果', () => {
    const validValues = {
      printingLevel: '500',
      bargainPercent: '40',
      btcBuffPercent: '100',
      trashAmount: '1000',
      commonAmount: '1000',
      highQualityAmount: '1000',
      rareAmount: '1000',
      trashCachePerAi: '9',
      commonCachePerAi: '8',
      highQualityCachePerAi: '6',
      rareCachePerAi: '3',
      btcPerAi: '8150',
    } as const;

    expect(parseBlackMarketValues({ ...validValues, printingLevel: '500.5' }).inputs).toBeNull();
    expect(parseBlackMarketValues({ ...validValues, trashAmount: '-1' }).inputs).toBeNull();
    expect(parseBlackMarketValues({ ...validValues, bargainPercent: '41' }).inputs).toBeNull();
    expect(parseBlackMarketValues({ ...validValues, rareCachePerAi: '3.5' }).inputs).toBeNull();
    expect(calculateBlackMarketTool(validValues).result).toHaveLength(4);
  });
});
