import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  calculateLevelConversionTool,
  applyLevelConversionSharedValues,
  createLevelConversionValues,
  LevelConversionCalculator,
  LevelConversionSettingsPanel,
  LevelConversionToolProvider,
  normalizeLevelConversionToolState,
  selectLevelConversionSharedValues,
  updateLevelConversionSharedValue,
  type LevelConversionToolState,
} from './level-conversion-calculator';

function renderLevelConversion(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <LevelConversionToolProvider>{children}</LevelConversionToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

function defaultToolState(): LevelConversionToolState {
  return {
    levelType: 'printing-rank',
    currentLevel: '350',
    targetLevel: '400',
    cortexBonusPercent: '80',
  };
}

function defaultPrices() {
  return {
    aiPerHash: '1.85',
    aiPerTechScrap: '110',
    aiPerMedicalTechParts: '50',
    aiPerAmmunitionTechParts: '100',
    aiPerMilitaryAmmunitionTechParts: '100',
    trashCachePerAi: '9',
    btcPerAi: '8450',
  } as const;
}

describe('Level conversion calculator presentation', () => {
  it('使用共用 Tool UI 呈現等級選擇、主要輸入與升級方式比較表', () => {
    const labels = getMessages('zh-tw').tools.levelConversion;
    const markup = renderLevelConversion(
      <LevelConversionCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('data-tool="level-conversion"');
    expect(markup).toContain('id="level-conversion-type"');
    expect(markup).toContain('id="level-conversion-current-level"');
    expect(markup).toContain('id="level-conversion-target-level"');
    expect(markup).toContain('從共用設定填入');
    expect(markup).toContain('換算結果');
    expect(markup).toContain('分子列印等級');
    expect(markup).toContain('data-result-layout="table"');
    expect(markup).toContain('<table');
    expect(markup).toContain('min-w-[40rem]');
    expect(markup).toContain('table-fixed');
    expect(markup).toContain('<tbody>');
    expect(markup).toContain('list-none');
    expect(markup).toContain('方式');
    expect(markup).not.toContain('資源價值（BTC）');
    expect(markup).not.toContain('data-breakdown-layout');
    expect(markup).not.toContain('level-conversion-ai-result-title');
    expect(markup).toContain('@min-[24rem]:grid-cols-2');
    expect(markup).toContain('@min-[48rem]:grid-cols-3');
    expect(markup).not.toContain('CCO Found');
    expect(markup).not.toContain('資料版本');
  });

  it('設定面板提供等級換算需要的完整經濟欄位與經驗值加成', () => {
    const labels = getMessages('zh-tw').tools.levelConversion;
    const markup = renderLevelConversion(
      <LevelConversionSettingsPanel
        labels={labels}
        locale="zh-tw"
        idPrefix="test-level-settings"
      />,
    );

    expect(markup).toContain('id="test-level-settings-hash-price"');
    expect(markup).toContain('id="test-level-settings-tech-scrap-price"');
    expect(markup).toContain('id="test-level-settings-medical-tech-parts-price"');
    expect(markup).toContain('id="test-level-settings-ammunition-tech-parts-price"');
    expect(markup).toContain('id="test-level-settings-military-ammunition-tech-parts-price"');
    expect(markup).toContain('id="test-level-settings-trash-cache-rate"');
    expect(markup).toContain('id="test-level-settings-btc-per-ai"');
    expect(markup).toContain('id="test-level-settings-cortex-bonus"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).not.toContain('沿用共用值');
    expect(markup).not.toContain('本工具覆寫');
  });

  it('將工具本地狀態與經濟設定草稿組合成計算輸入', () => {
    expect(createLevelConversionValues(defaultToolState(), defaultPrices())).toEqual({
      levelType: 'printing-rank',
      currentLevel: '350',
      targetLevel: '400',
      cortexBonusPercent: '80',
      ...defaultPrices(),
    });
  });

  it('依穩定 progression／effect ID 與 resolved market model 投影共用值', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      progression: {
        ...defaultSharedUserInputs.progression,
        player: { level: 99 },
        skills: [{ id: 'printing-rank' as const, level: 77 }],
      },
      economy: {
        ...defaultSharedUserInputs.economy,
        prices: [
          { itemId: 'hash' as const, currencyId: 'btc' as const, amount: 2 },
          { itemId: 'medical-tech-parts' as const, currencyId: 'ai' as const, amount: 72 },
        ],
        exchangeRates: [{ id: 'btc-per-ai' as const, value: 9000 }],
        cacheRates: [{ id: 'trash' as const, value: 12 }],
      },
      effects: {
        buffs: [{ id: 'exp-buff-percent' as const, percentage: 80 as const }],
      },
    };

    expect(selectLevelConversionSharedValues(snapshot, 'printing-rank')).toMatchObject({
      levelType: 'printing-rank',
      currentLevel: '77',
      targetLevel: '99',
      aiPerHash: String(2 / 9000),
      aiPerMedicalTechParts: '72',
      trashCachePerAi: '12',
      btcPerAi: '9000',
    });
  });

  it('缺少 Buff 欄位時預設 100，既有值保留且填入共用設定不覆蓋 Buff', () => {
    const missingBuff = {
      levelType: 'level',
      currentLevel: '1',
      targetLevel: '1',
    };
    expect(normalizeLevelConversionToolState(missingBuff)?.cortexBonusPercent).toBe('100');
    expect(normalizeLevelConversionToolState({ ...missingBuff, cortexBonusPercent: '100' })?.cortexBonusPercent)
      .toBe('100');

    const applied = applyLevelConversionSharedValues(
      { ...missingBuff, cortexBonusPercent: '40' },
      selectLevelConversionSharedValues(defaultSharedUserInputs),
    );
    expect(applied.cortexBonusPercent).toBe('40');
  });

  it('將有效物價、快取換算與匯率回寫共用庫，回到預設值時移除覆寫', () => {
    const withHashOverride = updateLevelConversionSharedValue(
      defaultSharedUserInputs,
      'aiPerHash',
      2,
    );
    expect(withHashOverride.economy.prices).toEqual([
      { itemId: 'hash', currencyId: 'ai', amount: 2 },
    ]);

    const restoredHash = updateLevelConversionSharedValue(withHashOverride, 'aiPerHash', 1.85);
    expect(restoredHash.economy.prices).toEqual([]);

    const withCacheOverride = updateLevelConversionSharedValue(
      defaultSharedUserInputs,
      'trashCachePerAi',
      12,
    );
    expect(withCacheOverride.economy.cacheRates).toEqual([
      { id: 'trash', value: 12 },
    ]);

    const restoredCache = updateLevelConversionSharedValue(
      withCacheOverride,
      'trashCachePerAi',
      9,
    );
    expect(restoredCache.economy.cacheRates).toEqual([]);
  });

  it('拒絕小數等級、反向目標與非整數換算率', () => {
    const decimalLevel = calculateLevelConversionTool(
      createLevelConversionValues(
        { ...defaultToolState(), currentLevel: '350.5' },
        defaultPrices(),
      ),
    );
    expect(decimalLevel.inputs).toBeNull();
    expect(decimalLevel.result).toBeNull();
    expect(decimalLevel.errors.currentLevel).toBe('level');

    const reversedLevel = calculateLevelConversionTool(
      createLevelConversionValues(
        { ...defaultToolState(), currentLevel: '400', targetLevel: '350' },
        defaultPrices(),
      ),
    );
    expect(reversedLevel.inputs).toBeNull();
    expect(reversedLevel.errors.targetLevel).toBe('target');

    const invalidCacheRate = calculateLevelConversionTool(
      createLevelConversionValues(
        defaultToolState(),
        { ...defaultPrices(), trashCachePerAi: '9.5' },
      ),
    );
    expect(invalidCacheRate.inputs).toBeNull();
    expect(invalidCacheRate.errors.trashCachePerAi).toBe('rate');
  });

  it('以 progression methods 產生每個方法的換算結果', () => {
    const calculation = calculateLevelConversionTool(
      createLevelConversionValues(defaultToolState(), defaultPrices()),
    );

    expect(calculation.inputs).toEqual({
      levelType: 'printing-rank',
      currentLevel: 350,
      targetLevel: 400,
      cortexBonusPercent: 80,
    });
    expect(calculation.result?.methods.map((method) => method.id)).toEqual([
      'black-market',
      'printing-job',
      'reverse-engineering',
    ]);
    expect(calculation.result?.methods.every((method) => method.neededTimes > 0)).toBe(true);
  });
});
