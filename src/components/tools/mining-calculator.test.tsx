import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  calculateMiningTool,
  applyMiningSharedValues,
  createMiningValues,
  MiningCalculator,
  MiningSettingsPanel,
  MiningToolProvider,
  normalizeMiningToolState,
  selectMiningSharedValues,
  updateMiningSharedValue,
} from './mining-calculator';

function renderMining(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <MiningToolProvider>{children}</MiningToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

describe('Mining calculator presentation', () => {
  it('使用共用 Tool UI 呈現主要輸入與兩組收益結果', () => {
    const labels = getMessages('zh-tw').tools.mining;
    const markup = renderMining(
      <MiningCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('data-tool="mining"');
    expect(markup).toContain('id="mining-level"');
    expect(markup).toContain('id="mining-hash-price"');
    expect(markup).toContain('id="mining-btc-per-ai"');
    expect(markup).toContain('id="mining-trade-exploit"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('從共用設定填入');
    expect(markup).toContain('BTC 挖礦收益');
    expect(markup).toContain('AI 製作收益');
    expect(markup).toContain('結果拆解');
    expect(markup).toContain('@min-[24rem]:grid-cols-2');
    expect(markup).toContain('data-breakdown-layout="rows"');
    expect(markup).toContain('每次 BTC 產出');
    expect(markup).toContain('每次 AI 產出');
    expect(markup).toContain('投資報酬率');
    expect(markup).not.toContain('依 Lv.');
    expect(markup).not.toContain('每次挖礦經驗');
    expect(markup).not.toContain('總成本');
    expect(markup).not.toContain('本機瀏覽器');
    expect(markup).not.toContain('CCO Found');
    expect(markup).not.toContain('資料版本');
  });

  it('設定面板保留次要物價與 BUFF，主要調整值移至主要輸入區', () => {
    const labels = getMessages('zh-tw').tools.mining;
    const markup = renderMining(
      <MiningSettingsPanel labels={labels} idPrefix="test-mining-settings" />,
    );

    expect(markup).toContain('id="test-mining-settings-tech-scrap-price"');
    expect(markup).toContain('id="test-mining-settings-cortex-bonus"');
    expect(markup).not.toContain('id="test-mining-settings-hash-price"');
    expect(markup).not.toContain('id="test-mining-settings-btc-per-ai"');
    expect(markup).not.toContain('id="test-mining-settings-trade-exploit"');
    expect(markup).not.toContain('本機瀏覽器');
    expect(markup).not.toContain('沿用共用值');
    expect(markup).not.toContain('本工具覆寫');
  });

  it('將本工具狀態與價格草稿組合成計算輸入', () => {
    expect(
      createMiningValues(
        {
          miningLevel: '400',
          cortexBonusPercent: '80',
          tradeExploitPercent: '100',
        },
        {
          aiPerHash: '2',
          btcPerAi: '8150',
          aiPerThousandTechScrap: '120',
        },
      ),
    ).toEqual({
      miningLevel: '400',
      aiPerHash: '2',
      btcPerAi: '8150',
      aiPerThousandTechScrap: '120',
      cortexBonusPercent: '80',
      tradeExploitPercent: '100',
    });
  });

  it('缺少 Buff 欄位時預設 100，既有值保留且填入共用設定不覆蓋 Buff', () => {
    const missingBuff = { miningLevel: '1' };
    expect(normalizeMiningToolState(missingBuff)).toMatchObject({
      miningLevel: '1',
      cortexBonusPercent: '100',
      tradeExploitPercent: '100',
    });
    expect(normalizeMiningToolState({
      ...missingBuff,
      cortexBonusPercent: '100',
      tradeExploitPercent: '100',
    })).toMatchObject({ cortexBonusPercent: '100', tradeExploitPercent: '100' });

    const applied = applyMiningSharedValues(
      { ...missingBuff, cortexBonusPercent: '40', tradeExploitPercent: '80' },
      selectMiningSharedValues(defaultSharedUserInputs),
    );
    expect(applied).toMatchObject({ cortexBonusPercent: '40', tradeExploitPercent: '80' });
  });

  it('從穩定 skill／effect ID 與 resolved market model 投影共用值', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      progression: {
        ...defaultSharedUserInputs.progression,
        player: { level: 99 },
        skills: [{ id: 'mining-skill' as const, level: 77 }],
      },
      economy: {
        ...defaultSharedUserInputs.economy,
        prices: [
          { itemId: 'hash' as const, currencyId: 'btc' as const, amount: 2 },
          { itemId: 'tech-scrap' as const, currencyId: 'ai' as const, amount: 222 },
        ],
        exchangeRates: [{ id: 'btc-per-ai' as const, value: 9000 }],
      },
      effects: {
        buffs: [
          { id: 'exp-buff-percent' as const, percentage: 80 as const },
          { id: 'btc-buff-percent' as const, percentage: 100 as const },
        ],
      },
    };

    expect(selectMiningSharedValues(snapshot)).toMatchObject({
      miningLevel: '77',
      aiPerHash: String(2 / 9000),
      btcPerAi: '9000',
      aiPerThousandTechScrap: '222',
    });
  });

  it('將有效價格與匯率修改回寫共用庫，回到預設值時移除覆寫', () => {
    const withHashOverride = updateMiningSharedValue(
      defaultSharedUserInputs,
      'aiPerHash',
      2,
    );
    expect(withHashOverride.economy.prices).toEqual([
      { itemId: 'hash', currencyId: 'ai', amount: 2 },
    ]);

    const restoredHash = updateMiningSharedValue(withHashOverride, 'aiPerHash', 1.85);
    expect(restoredHash.economy.prices).toEqual([]);

    const withRateOverride = updateMiningSharedValue(
      defaultSharedUserInputs,
      'btcPerAi',
      9000,
    );
    expect(withRateOverride.economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 9000 },
    ]);

    const restoredRate = updateMiningSharedValue(withRateOverride, 'btcPerAi', 8150);
    expect(restoredRate.economy.exchangeRates).toEqual([]);
  });

  it('無效輸入不產生部分計算，且維持挖礦欄位的整數／範圍規則', () => {
    const calculation = calculateMiningTool({
      miningLevel: '400.5',
      aiPerHash: '1.85',
      btcPerAi: '8150',
      aiPerThousandTechScrap: '110',
      cortexBonusPercent: '80',
      tradeExploitPercent: '0',
    });

    expect(calculation.inputs).toBeNull();
    expect(calculation.result).toBeNull();
    expect(calculation.errors.miningLevel).toBe('level');

    expect(
      calculateMiningTool({
        miningLevel: '400',
        aiPerHash: '1.85',
        btcPerAi: '0',
        aiPerThousandTechScrap: '110',
        cortexBonusPercent: '80',
        tradeExploitPercent: '0',
      }).errors.btcPerAi,
    ).toBe('rate');
  });
});
