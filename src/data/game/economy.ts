import rawEconomy from './economy.json';

import {
  createGameDataEnvelopeSchema,
  parseGameDataEnvelope,
} from '@/lib/game-data';
import { ccoFoundDataSource } from '@/lib/data-source';

import {
  economyPayloadSchema,
  type EconomyCurrencyDefinition,
  type EconomyCurrencyId,
  type EconomyItemDefinition,
  type MarketCacheRateDefinition,
  type MarketCacheRateId,
  type MarketPriceDefinition,
  type MarketPriceItemId,
} from './economy.schema';

const economyDataEnvelope = {
  datasetId: 'economy',
  domain: 'economy',
  schemaVersion: '1.0.0',
  dataVersion: 'cco-found-price-update-2026-10-05',
  updatedAt: '2026-10-05',
  sources: [ccoFoundDataSource],
  payload: rawEconomy,
} as const;

export const economyDataEnvelopeSchema = createGameDataEnvelopeSchema(economyPayloadSchema);

export const economyDataSet = parseGameDataEnvelope(economyDataEnvelope, economyPayloadSchema);
export type EconomyDataSet = typeof economyDataSet;

export const economyCurrencyCatalog: readonly EconomyCurrencyDefinition[] =
  economyDataSet.payload.currencies;
export const economyItemCatalog: readonly EconomyItemDefinition[] = economyDataSet.payload.items;
export const marketPriceCatalog: readonly MarketPriceDefinition[] = economyDataSet.payload.prices;
export const marketCacheRateCatalog: readonly MarketCacheRateDefinition[] =
  economyDataSet.payload.cacheRates;

const marketPriceByItemId = new Map<MarketPriceItemId, MarketPriceDefinition>(
  marketPriceCatalog.map((definition) => [definition.itemId, definition]),
);
const itemById = new Map<MarketPriceItemId, EconomyItemDefinition>(
  economyItemCatalog.map((definition) => [definition.id, definition]),
);
const cacheRateById = new Map<MarketCacheRateId, MarketCacheRateDefinition>(
  marketCacheRateCatalog.map((definition) => [definition.id, definition]),
);

export function getMarketPriceDefinition(id: MarketPriceItemId): MarketPriceDefinition {
  const definition = marketPriceByItemId.get(id);
  if (!definition) throw new Error(`未知的市場價格物品 ID: ${id}`);
  return definition;
}

export function getEconomyItemDefinition(id: MarketPriceItemId): EconomyItemDefinition {
  const definition = itemById.get(id);
  if (!definition) throw new Error(`未知的經濟物品 ID: ${id}`);
  return definition;
}

export function getMarketCacheRateDefinition(id: MarketCacheRateId): MarketCacheRateDefinition {
  const definition = cacheRateById.get(id);
  if (!definition) throw new Error(`未知的黑市快取換算 ID: ${id}`);
  return definition;
}

export function getEconomyCurrencyDefinition(id: EconomyCurrencyId): EconomyCurrencyDefinition {
  const definition = economyCurrencyCatalog.find((item) => item.id === id);
  if (!definition) throw new Error(`未知的貨幣 ID: ${id}`);
  return definition;
}

export {
  economyCurrencyIds,
  marketCacheRateIds,
  marketPriceItemIds,
  marketPriceUnitSchema,
} from './economy.schema';
export type {
  EconomyCurrencyDefinition,
  EconomyCurrencyId,
  EconomyItemDefinition,
  MarketCacheRateDefinition,
  MarketCacheRateId,
  MarketPriceDefinition,
  MarketPriceItemId,
  MarketPriceUnit,
} from './economy.schema';
