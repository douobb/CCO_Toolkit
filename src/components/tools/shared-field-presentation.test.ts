import { describe, expect, it } from 'vitest';

import {
  economyDataSet,
  getEconomyCurrencyDefinition,
  marketCacheRateCatalog,
} from '@/data/game/economy';
import { getMessages } from '@/lib/translations';

import { getSharedFieldPresentation } from './shared-field-presentation';

const locales = ['zh-tw', 'zh-cn', 'en'] as const;

describe('共用工具欄位文案', () => {
  it.each(locales)('%s 使用共用設定的標籤、範圍與單位', (locale) => {
    const settings = getMessages(locale).settingsPage;
    const presentation = getSharedFieldPresentation(locale);
    const range = (min: number, max: number) =>
      settings.rangeHint.replace('${min}', String(min)).replace('${max}', String(max));
    const exchangeRate = economyDataSet.payload.exchangeRates.find(
      (item) => item.id === 'btc-per-ai',
    );

    if (!exchangeRate) throw new Error('缺少 BTC/AI 共用匯率定義');

    expect(presentation.sharedLabel).toBe(settings.sharedValueLabel);
    expect(presentation.invalidValueMessage).toBe(settings.sharedValueError);
    expect(presentation.bargain).toEqual({
      label: settings.bargainPercent,
      range: range(0, 40),
      unit: settings.percentUnit,
    });
    expect(presentation.exchangeRate).toEqual({
      label: `${getEconomyCurrencyDefinition('ai').code} → ${getEconomyCurrencyDefinition('btc').code}`,
      range: settings.positiveRange,
      unit: exchangeRate.unit,
    });
    expect(presentation.priceRange).toBe(settings.priceRange);

    for (const definition of marketCacheRateCatalog) {
      expect(presentation.cacheRate(definition.id)).toEqual({
        label: definition.labels[locale],
        range: settings.positiveRange,
        unit: definition.unit,
      });
    }

    expect(presentation.equipment).toEqual({
      maxHealth: {
        label: settings.maxHealth,
        range: settings.nonNegativeRange,
        unit: settings.healthUnit,
      },
      armor: {
        label: settings.armor,
        range: settings.nonNegativeRange,
        unit: settings.armorUnit,
      },
      destructiveWeaponDamage: {
        label: settings.destructiveWeaponDamage,
        range: settings.positiveRange,
        unit: settings.damageUnit,
      },
      criticalDamagePercent: {
        label: settings.criticalDamagePercent,
        range: range(20, 220),
        unit: settings.percentUnit,
      },
      damageReductionPercent: {
        label: settings.damageReductionPercent,
        range: range(0, 100),
        unit: settings.percentUnit,
      },
    });

    const mining = getMessages(locale).tools.mining;
    expect(mining.hashPrice).toBeTruthy();
    expect(mining.hashPriceUnit).toBe({
      'zh-tw': 'AI／hash',
      'zh-cn': 'AI/hash',
      en: 'AI / hash',
    }[locale]);
  });
});
