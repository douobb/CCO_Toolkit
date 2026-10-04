import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  SearchRewardCalculator,
  SearchRewardSettingsPanel,
  SearchRewardToolProvider,
  createSearchRewardValues,
  selectSearchRewardSharedValues,
  updateSearchRewardSharedPrice,
} from './search-reward-calculator';

function renderSearchReward(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <SearchRewardToolProvider>{children}</SearchRewardToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

describe('Search Reward calculator presentation', () => {
  it('不在計算器本體重複呈現資料版本與來源表格', () => {
    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      const labels = getMessages(locale).tools.searchReward;
      const markup = renderSearchReward(
        <SearchRewardCalculator labels={labels} locale={locale} />,
      );

      expect(markup).not.toContain('CCO Found');
      expect(markup).not.toContain('data-game-dataset-id');
      expect(markup).not.toContain('資料資訊');
      expect(markup).not.toContain('Data information');
      expect(markup).not.toContain('次搜索估算');
      expect(markup).not.toContain('Estimated from Lv.');
    }
  });

  it('使用目前 locale 建立預設 formatter，也允許工具注入 formatter', () => {
    const numberFormatter = vi.fn((value: number) => `formatted:${value}`);
    const labels = getMessages('zh-tw').tools.searchReward;

    const markup = renderSearchReward(
      <SearchRewardCalculator
        labels={labels}
        locale="en"
        numberFormatter={numberFormatter}
      />,
    );

    expect(numberFormatter).toHaveBeenCalled();
    expect(markup).toContain('formatted:');
  });

  it('提供工具層級的共用設定帶入按鈕，且欄位不再顯示逐欄位覆寫選項', () => {
    const labels = getMessages('zh-tw').tools.searchReward;
    const markup = renderSearchReward(
      <>
        <SearchRewardCalculator labels={labels} locale="zh-tw" />
        <SearchRewardSettingsPanel labels={labels} idPrefix="test-settings" />
      </>,
    );

    expect(markup).toContain('從共用設定填入');
    expect(markup).not.toContain('沿用共用值');
    expect(markup).not.toContain('本工具覆寫');
    expect(markup).toContain('id="search-reward-player-level"');
    expect(markup).toContain('value="1"');
    expect(markup).toContain('id="test-settings-mt-price"');
    expect(markup).toContain('id="test-settings-atp-price"');
    expect(markup).toContain('id="test-settings-matp-price"');
    expect(markup).toContain('data-breakdown-layout="rows"');
    expect(markup).toContain('@container');
    expect(markup).toContain('@min-[24rem]:grid-cols-2');
    expect(markup).toContain('@min-[48rem]:grid-cols-2');
    expect(markup).toContain('@min-[48rem]:absolute');
    expect(markup).toContain('@min-[48rem]:inset-0');
    expect(markup).toContain('overflow-y-auto');
    expect(markup).not.toContain('2xl:grid-cols-2');
    expect(markup).toContain('overflow-x-hidden');
    expect(markup).toContain('flex min-h-0 flex-1 flex-col');
    expect(markup).toContain('min-w-0');
    expect(markup).toContain('bg-primary/10');
    expect(markup).not.toContain('text-right font-medium">目前最佳</th>');
  });

  it('將工具本地狀態與物價草稿組合成計算輸入', () => {
    expect(
      createSearchRewardValues(
        {
          searchCount: '4',
          playerLevel: '60',
        },
        {
          mtPrice: '999',
          atpPrice: '100',
          matpPrice: '777',
        },
      ),
    ).toEqual({
      playerLevel: '60',
      searchCount: '4',
      mtPrice: '999',
      atpPrice: '100',
      matpPrice: '777',
    });
  });

  it('將 Search Reward 等級 selector 對應到搜索技能，而非一般玩家等級', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      progression: {
        ...defaultSharedUserInputs.progression,
        player: { level: 99 },
        skills: [{ id: 'scavenge-skill' as const, level: 77 }],
      },
      economy: {
        ...defaultSharedUserInputs.economy,
        exchangeRates: [
          { id: 'btc-per-ai' as const, value: 2 },
        ],
        prices: [
          { itemId: 'medical-tech-parts' as const, currencyId: 'ai' as const, amount: 72 },
          { itemId: 'ammunition-tech-parts' as const, currencyId: 'ai' as const, amount: 144 },
          { itemId: 'military-ammunition-tech-parts' as const, currencyId: 'btc' as const, amount: 3 },
        ],
      },
    };

    expect(selectSearchRewardSharedValues(snapshot)).toEqual({
      playerLevel: '77',
      mtPrice: '72',
      atpPrice: '144',
      matpPrice: '1.5',
    });
  });

  it('將工具修改的價格以對應物品寫回共用庫', () => {
    const next = updateSearchRewardSharedPrice(
      defaultSharedUserInputs,
      'mtPrice',
      72,
    );

    expect(next.economy.prices).toEqual([
      { itemId: 'medical-tech-parts', currencyId: 'ai', amount: 72 },
    ]);

    const restored = updateSearchRewardSharedPrice(next, 'mtPrice', 50);
    expect(restored.economy.prices).toEqual([]);
  });
});
