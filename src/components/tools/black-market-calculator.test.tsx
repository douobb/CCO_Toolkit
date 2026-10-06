import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  BlackMarketCalculator,
  BlackMarketToolProvider,
  applyBlackMarketPlayerValues,
  calculateBlackMarketTool,
  createBlackMarketValues,
  normalizeBlackMarketToolState,
  parseBlackMarketValues,
  selectBlackMarketSharedValues,
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
  it.each([
    ['zh-tw', '已達回本（Lv.${level}）'],
    ['zh-cn', '已达回本（Lv.${level}）'],
    ['en', 'Break-even reached (Lv.${level})'],
  ] as const)('黑市與挖礦共用自然等價的 %s 回本等級文案', (locale, expected) => {
    const messages = getMessages(locale);

    expect(messages.tools.blackMarket.breakEvenCurrent).toBe(expected);
    expect(messages.tools.mining.breakEvenCurrent).toBe(expected);
  });

  it('依 HEAD 的分區結構呈現等級、共用換算、BUFF 與四種快取數量', () => {
    const labels = getMessages('zh-tw').tools.blackMarket;
    const markup = renderBlackMarket(
      <BlackMarketCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('data-tool="black-market"');
    expect(markup).toContain('id="black-market-printing-level"');
    expect(markup).toContain('id="black-market-bargain-percent"');
    expect(markup).toContain('id="black-market-btc-buff-percent"');
    expect(markup).toContain('id="black-market-btc-per-ai"');
    expect(markup).toContain('id="black-market-trash-cache-rate"');
    expect(markup).toContain('id="black-market-common-cache-rate"');
    expect(markup).toContain('id="black-market-high-quality-cache-rate"');
    expect(markup).toContain('id="black-market-rare-cache-rate"');
    expect(markup).toContain('id="black-market-trash-amount"');
    expect(markup).toContain('id="black-market-common-amount"');
    expect(markup).toContain('id="black-market-high-quality-amount"');
    expect(markup).toContain('id="black-market-rare-amount"');
    expect(markup).toContain('data-tool-reset=""');
    expect(markup).toContain('data-tool-fill-player=""');
    expect(markup).not.toContain('id="black-market-exp-buff-percent"');
    expect(markup.match(/>共用<\/span>/g)).toHaveLength(6);
    expect(markup).toContain('廢棄');
    expect(markup).toContain('普通');
    expect(markup).toContain('高級');
    expect(markup).toContain('稀有');
    expect(markup).toContain('帶入玩家等級');
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

  it('主要輸入沿用 HEAD 分區並保留快取數量順序，沒有額外設定面板欄位', () => {
    const labels = getMessages('zh-tw').tools.blackMarket;
    const markup = renderBlackMarket(
      <BlackMarketCalculator labels={labels} locale="zh-tw" />,
    );

    const fields = [
      'black-market-printing-level',
      'black-market-bargain-percent',
      'black-market-btc-buff-percent',
      'black-market-btc-per-ai',
      'black-market-trash-cache-rate',
      'black-market-trash-amount',
      'black-market-common-amount',
      'black-market-high-quality-amount',
      'black-market-rare-amount',
    ].map((id) => markup.indexOf(`id="${id}"`));
    expect(fields.every((position, index) =>
      position >= 0 && (index === 0 || position > fields[index - 1]),
    )).toBe(true);
    expect(markup).toContain('@min-[64rem]:grid-cols-4');
    expect(markup).not.toContain('data-context-id="settings"');
  });

  it('render 的共用欄位沿用設定文案與經濟資料單位', () => {
    const markup = renderBlackMarket(
      <BlackMarketCalculator labels={getMessages('zh-tw').tools.blackMarket} locale="zh-tw" />,
    );

    expect(markup).toMatch(/for="black-market-bargain-percent">[\s\S]*?討價還價[\s\S]*?共用/);
    expect(markup).toContain('id="black-market-bargain-percent-range"');
    expect(markup).toContain('>0–40</span>');
    expect(markup).toMatch(/id="black-market-bargain-percent-unit"[^>]*>%<\/span>/);
    expect(markup).toMatch(/for="black-market-btc-per-ai">[\s\S]*?AI → BTC[\s\S]*?共用/);
    expect(markup).toContain('id="black-market-btc-per-ai-range"');
    expect(markup).toContain('>大於 0</span>');
    expect(markup).toMatch(/id="black-market-btc-per-ai-unit"[^>]*>BTC\/AI<\/span>/);
    expect(markup).toMatch(/for="black-market-trash-cache-rate">[\s\S]*?廢棄[\s\S]*?共用/);
    expect(markup).toMatch(/id="black-market-trash-cache-rate-unit"[^>]*>cache\/AI<\/span>/);
  });

  it('將本地試算欄位與目前共享玩家／經濟值組合成計算輸入', () => {
    expect(
      createBlackMarketValues(
        {
          printingLevel: '500',
          btcBuffPercent: '100',
          trashAmount: '1000',
          commonAmount: '900',
          highQualityAmount: '800',
          rareAmount: '700',
        },
        {
          printingLevel: '500',
          bargainPercent: '40',
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

  it('舊狀態的 bargainPercent 會遷移丟棄，並保留工具 BUFF 與試算數量', () => {
    const missingBuff = {
      printingLevel: '1',
      bargainPercent: '17',
      trashAmount: '1000',
      commonAmount: '1000',
      highQualityAmount: '1000',
      rareAmount: '1000',
    };
    expect(normalizeBlackMarketToolState(missingBuff)?.btcBuffPercent).toBe('100');
    expect(normalizeBlackMarketToolState({ ...missingBuff, btcBuffPercent: '100' })?.btcBuffPercent)
      .toBe('100');

    const shared = selectBlackMarketSharedValues(defaultSharedUserInputs);
    const applied = applyBlackMarketPlayerValues(
      { ...normalizeBlackMarketToolState(missingBuff)!, btcBuffPercent: '40' },
      shared,
    );
    expect(applied.btcBuffPercent).toBe('40');
    expect(applied.trashAmount).toBe('1000');
    expect(applied).not.toHaveProperty('bargainPercent');
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
