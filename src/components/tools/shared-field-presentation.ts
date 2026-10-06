import {
  economyDataSet,
  getEconomyCurrencyDefinition,
  getMarketCacheRateDefinition,
} from '@/data/game/economy';
import type { MarketCacheRateId } from '@/data/game/economy';
import type { Locale } from '@/lib/i18n';
import {
  SHARED_CRITICAL_DAMAGE_PERCENT_MAX,
  SHARED_CRITICAL_DAMAGE_PERCENT_MIN,
} from '@/lib/shared-user-inputs';
import { getMessages } from '@/lib/translations';

function formatRange(template: string, min: number, max: number): string {
  return template
    .replaceAll('${min}', String(min))
    .replaceAll('${max}', String(max));
}

/** 從共用設定文案與資料目錄集中產生工具內共用欄位的標籤、範圍及單位。 */
export function getSharedFieldPresentation(locale: Locale) {
  const labels = getMessages(locale).settingsPage;
  const exchangeRate = economyDataSet.payload.exchangeRates.find(
    (rate) => rate.id === 'btc-per-ai',
  );
  if (!exchangeRate) throw new Error('缺少 BTC/AI 共用匯率定義');
  const baseCurrency = getEconomyCurrencyDefinition(exchangeRate.baseCurrencyId);
  const quoteCurrency = getEconomyCurrencyDefinition(exchangeRate.quoteCurrencyId);

  return {
    sharedLabel: labels.sharedValueLabel,
    invalidValueMessage: labels.sharedValueError,
    priceRange: labels.priceRange,
    bargain: {
      label: labels.bargainPercent,
      range: formatRange(labels.rangeHint, 0, 40),
      unit: labels.percentUnit,
    },
    exchangeRate: {
      label: `${baseCurrency.code} → ${quoteCurrency.code}`,
      range: labels.positiveRange,
      unit: exchangeRate.unit,
    },
    cacheRate: (id: MarketCacheRateId) => {
      const definition = getMarketCacheRateDefinition(id);
      return {
        label: definition.labels[locale],
        range: labels.positiveRange,
        unit: definition.unit,
      };
    },
    equipment: {
      maxHealth: {
        label: labels.maxHealth,
        range: labels.nonNegativeRange,
        unit: labels.healthUnit,
      },
      armor: {
        label: labels.armor,
        range: labels.nonNegativeRange,
        unit: labels.armorUnit,
      },
      destructiveWeaponDamage: {
        label: labels.destructiveWeaponDamage,
        range: labels.positiveRange,
        unit: labels.damageUnit,
      },
      criticalDamagePercent: {
        label: labels.criticalDamagePercent,
        range: formatRange(
          labels.rangeHint,
          SHARED_CRITICAL_DAMAGE_PERCENT_MIN,
          SHARED_CRITICAL_DAMAGE_PERCENT_MAX,
        ),
        unit: labels.percentUnit,
      },
      damageReductionPercent: {
        label: labels.damageReductionPercent,
        range: formatRange(labels.rangeHint, 0, 100),
        unit: labels.percentUnit,
      },
    },
  };
}
