import type {
  EconomyCurrencyId,
  MarketCacheRateId,
  MarketPriceItemId,
} from '@/data/game/economy';
import type { SharedUserInputs } from '@/lib/storage';

export type SharedEquipmentNumberField =
  | 'bargainPercent'
  | 'maxHealth'
  | 'armor'
  | 'destructiveWeaponDamage'
  | 'criticalDamagePercent'
  | 'damageReductionPercent';

export function updateSharedEquipmentNumber(
  snapshot: SharedUserInputs,
  field: SharedEquipmentNumberField,
  value: number,
): SharedUserInputs {
  return {
    ...snapshot,
    equipment: { ...snapshot.equipment, [field]: value },
  };
}

export function updateSharedExchangeRate(
  snapshot: SharedUserInputs,
  value: number,
): SharedUserInputs {
  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      exchangeRates: [
        ...snapshot.economy.exchangeRates.filter((rate) => rate.id !== 'btc-per-ai'),
        { id: 'btc-per-ai', value },
      ],
    },
  };
}

export function updateSharedCacheRate(
  snapshot: SharedUserInputs,
  id: MarketCacheRateId,
  value: number,
): SharedUserInputs {
  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      cacheRates: [
        ...snapshot.economy.cacheRates.filter((rate) => rate.id !== id),
        { id, value },
      ],
    },
  };
}

export function updateSharedMarketPrice(
  snapshot: SharedUserInputs,
  itemId: MarketPriceItemId,
  currencyId: EconomyCurrencyId,
  amount: number,
): SharedUserInputs {
  return {
    ...snapshot,
    economy: {
      ...snapshot.economy,
      prices: [
        ...snapshot.economy.prices.filter((price) => price.itemId !== itemId),
        { itemId, currencyId, amount },
      ],
    },
  };
}
