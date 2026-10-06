import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore, defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  calculateLevelConversionTool,
  applyLevelConversionPlayerValues,
  createLevelConversionValues,
  LevelConversionCalculator,
  LevelConversionToolProvider,
  normalizeLevelConversionToolState,
  selectLevelConversionSharedValues,
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
    levelType: 'level',
    currentLevel: '1',
    targetLevel: '1',
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
    expect(markup).toContain('id="level-conversion-cortex-bonus"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('帶入玩家等級');
    expect(markup).toContain('data-tool-reset=""');
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

  it('物價仍不重複出現在主要輸入，BUFF 與等級欄位同卡呈現', () => {
    const labels = getMessages('zh-tw').tools.levelConversion;
    const markup = renderLevelConversion(
      <LevelConversionCalculator labels={labels} locale="zh-tw" />,
    );

    expect(markup).toContain('id="level-conversion-cortex-bonus"');
    expect(markup).toContain('id="level-conversion-type"');
    expect(markup).toContain('id="level-conversion-current-level"');
    expect(markup).toContain('id="level-conversion-target-level"');
    expect(markup).not.toContain('hash-price');
    expect(markup).not.toContain('cache-rate');
    expect(markup).not.toContain('btc-per-ai');
    expect(markup).not.toContain('level-conversion-settings');
  });

  it('將本地等級試算與目前共享物價組合成計算輸入', () => {
    expect(createLevelConversionValues(defaultToolState(), defaultPrices())).toEqual({
      ...defaultPrices(),
      ...defaultToolState(),
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

  it('缺少 Buff 欄位時預設 100，帶入玩家等級不覆蓋本工具 Buff', () => {
    const missingBuff = {
      levelType: 'level',
      currentLevel: '1',
      targetLevel: '1',
    };
    expect(normalizeLevelConversionToolState(missingBuff)?.cortexBonusPercent).toBe('100');
    expect(normalizeLevelConversionToolState({ ...missingBuff, cortexBonusPercent: '100' })?.cortexBonusPercent)
      .toBe('100');

    const applied = applyLevelConversionPlayerValues(
      { ...normalizeLevelConversionToolState(missingBuff)!, cortexBonusPercent: '40' },
      selectLevelConversionSharedValues(defaultSharedUserInputs),
    );
    expect(applied.cortexBonusPercent).toBe('40');
    expect(applied.currentLevel).toBe('1');
  });

  it('拒絕小數等級與反向目標；共享價格取自提供的快照', () => {
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

    const snapshotWithCacheRate = {
      ...defaultSharedUserInputs,
      economy: {
        ...defaultSharedUserInputs.economy,
        cacheRates: [{ id: 'trash' as const, value: 12 }],
      },
    };
    const withSharedRate = calculateLevelConversionTool(
      createLevelConversionValues(defaultToolState(), selectLevelConversionSharedValues(snapshotWithCacheRate)),
      snapshotWithCacheRate,
    );
    expect(withSharedRate.inputs).not.toBeNull();
    expect(withSharedRate.result).not.toBeNull();
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
