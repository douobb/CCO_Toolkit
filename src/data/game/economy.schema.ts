import { z } from 'zod';

import {
  catalogVerificationSchema,
  localizedGameLabelSchema,
} from './catalog.schema';

export const economyCurrencyIds = ['ai', 'btc'] as const;
export type EconomyCurrencyId = (typeof economyCurrencyIds)[number];

/** 第一批可由多個工具引用的市場價格物品。 */
export const marketPriceItemIds = [
  'tech-scrap',
  'medical-tech-parts',
  'ammunition-tech-parts',
  'military-ammunition-tech-parts',
  'hash',
  'locked-container',
  'locked-rare-container',
  'locked-legendary-container',
  'supply-crate-gang',
  'old-pouch',
  'fanny-pack',
  'explorer-backpack',
  'employee-office-case',
] as const;
export type MarketPriceItemId = (typeof marketPriceItemIds)[number];

export const marketCacheRateIds = ['trash', 'common', 'high-quality', 'rare'] as const;
export type MarketCacheRateId = (typeof marketCacheRateIds)[number];

export const marketPriceUnitSchema = z.enum(['AI/k', 'AI/item', 'BTC/item']);
export type MarketPriceUnit = z.infer<typeof marketPriceUnitSchema>;

const positiveFiniteSchema = z.number().finite().positive();

export const economyCurrencySchema = z
  .object({
    id: z.enum(economyCurrencyIds),
    code: z.enum(['AI', 'BTC']),
    labels: localizedGameLabelSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const economyItemSchema = z
  .object({
    id: z.enum(marketPriceItemIds),
    category: z.enum(['material', 'resource', 'container', 'backpack']),
    labels: localizedGameLabelSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const marketPriceDefinitionSchema = z
  .object({
    itemId: z.enum(marketPriceItemIds),
    unit: marketPriceUnitSchema,
    defaultBasisCurrencyId: z.enum(economyCurrencyIds),
    defaultBasisValue: positiveFiniteSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const marketExchangeRateSchema = z
  .object({
    id: z.literal('btc-per-ai'),
    baseCurrencyId: z.literal('ai'),
    quoteCurrencyId: z.literal('btc'),
    unit: z.literal('BTC/AI'),
    defaultValue: positiveFiniteSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const marketCacheRateSchema = z
  .object({
    id: z.enum(marketCacheRateIds),
    labels: localizedGameLabelSchema,
    unit: z.literal('cache/AI'),
    defaultValue: positiveFiniteSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const economyPayloadSchema = z
  .object({
    currencies: z.array(economyCurrencySchema).length(economyCurrencyIds.length),
    items: z.array(economyItemSchema).min(1),
    prices: z.array(marketPriceDefinitionSchema).min(1),
    exchangeRates: z.array(marketExchangeRateSchema).length(1),
    cacheRates: z.array(marketCacheRateSchema).length(marketCacheRateIds.length),
  })
  .strict()
  .superRefine((payload, context) => {
    const currencyIds = payload.currencies.map((currency) => currency.id);
    const itemIds = payload.items.map((item) => item.id);
    const priceIds = payload.prices.map((price) => price.itemId);
    const cacheIds = payload.cacheRates.map((rate) => rate.id);

    if (
      new Set(currencyIds).size !== currencyIds.length ||
      economyCurrencyIds.some((id) => !currencyIds.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['currencies'],
        message: '貨幣目錄必須包含 AI 與 BTC，且 ID 不可重複',
      });
    }
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: '物品 ID 不可重複',
      });
    }
    if (new Set(priceIds).size !== priceIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['prices'],
        message: '市場價格項目的物品 ID 不可重複',
      });
    }
    if (priceIds.some((id) => !itemIds.includes(id))) {
      context.addIssue({
        code: 'custom',
        path: ['prices'],
        message: '每個市場價格項目都必須對應物品目錄',
      });
    }
    if (new Set(cacheIds).size !== cacheIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['cacheRates'],
        message: '黑市快取換算 ID 不可重複',
      });
    }
  });

export type EconomyCurrencyDefinition = z.infer<typeof economyCurrencySchema>;
export type EconomyItemDefinition = z.infer<typeof economyItemSchema>;
export type MarketPriceDefinition = z.infer<typeof marketPriceDefinitionSchema>;
export type MarketExchangeRate = z.infer<typeof marketExchangeRateSchema>;
export type MarketCacheRateDefinition = z.infer<typeof marketCacheRateSchema>;
export type EconomyPayload = z.infer<typeof economyPayloadSchema>;
