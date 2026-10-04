/**
 * Game Data 預設值與 Shared User Inputs sparse overrides 的純市場價格 adapter。
 *
 * 本模組不保存資料、不讀取 React／DOM／storage，也不帶 persistence metadata；
 * 它只產生計算需要的 resolved market price model。
 */

import {
  economyDataSet,
  marketCacheRateCatalog,
  marketPriceCatalog,
  type EconomyCurrencyId,
  type MarketCacheRateId,
  type MarketPriceItemId,
} from '@/data/game/economy';
import type { SharedUserInputs } from './shared-user-inputs';

export type MarketCurrency = EconomyCurrencyId;
export type MarketDualPriceId = MarketPriceItemId;
export type MarketCachePriceId = MarketCacheRateId;

export interface MarketDualPriceEntry {
  readonly basisCurrency: MarketCurrency;
  readonly basisValue: number;
}

export interface MarketCachePriceEntry {
  readonly value: number;
}

/** 由 Game Data 與 sparse Shared User Inputs 解出的唯讀計算模型。 */
export interface ResolvedMarketPrices {
  readonly btcPerAi: number;
  readonly assets: Readonly<Record<MarketDualPriceId, MarketDualPriceEntry>>;
  readonly caches: Readonly<Record<MarketCachePriceId, MarketCachePriceEntry>>;
}

export const defaultBtcPerAi = economyDataSet.payload.exchangeRates[0]?.defaultValue;

if (defaultBtcPerAi === undefined) {
  throw new Error('Economy dataset 必須至少包含一個 BTC/AI 匯率');
}

const emptyEconomyInputs: Pick<SharedUserInputs, 'economy'>['economy'] = {
  prices: [],
  exchangeRates: [],
  cacheRates: [],
};

function isMarketCurrency(value: unknown): value is MarketCurrency {
  return value === 'ai' || value === 'btc';
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFinitePositive(value: unknown): value is number {
  return isFiniteNonNegative(value) && value > 0;
}

/**
 * 將 Shared User Inputs 的 sparse economy overrides 與 Game Data defaults 合併。
 * 未提供或不符合純數值條件的 override 會安全回到對應 catalog default。
 */
export function resolveMarketPrices(
  inputs: Pick<SharedUserInputs, 'economy'> = { economy: emptyEconomyInputs },
): ResolvedMarketPrices {
  const economy = inputs.economy;
  const exchangeRateOverride = economy.exchangeRates.find((rate) => rate.id === 'btc-per-ai');
  const btcPerAi = isFinitePositive(exchangeRateOverride?.value)
    ? exchangeRateOverride.value
    : defaultBtcPerAi;
  const assets = Object.fromEntries(
    marketPriceCatalog.map((definition) => {
      const override = economy.prices.find((price) => price.itemId === definition.itemId);
      return [
        definition.itemId,
        {
          basisCurrency: isMarketCurrency(override?.currencyId)
            ? override.currencyId
            : definition.defaultBasisCurrencyId,
          basisValue: isFiniteNonNegative(override?.amount)
            ? override.amount
            : definition.defaultBasisValue,
        },
      ];
    }),
  ) as Record<MarketDualPriceId, MarketDualPriceEntry>;
  const caches = Object.fromEntries(
    marketCacheRateCatalog.map((definition) => {
      const override = economy.cacheRates.find((rate) => rate.id === definition.id);
      return [
        definition.id,
        {
          value: isFinitePositive(override?.value)
            ? override.value
            : definition.defaultValue,
        },
      ];
    }),
  ) as Record<MarketCachePriceId, MarketCachePriceEntry>;

  return Object.freeze({
    btcPerAi,
    assets: Object.freeze(assets),
    caches: Object.freeze(caches),
  });
}

export function getDualPrice(
  prices: ResolvedMarketPrices,
  id: MarketDualPriceId,
  currency: MarketCurrency,
): number {
  const entry = prices.assets[id];
  return convertMarketPriceAmount(
    entry.basisValue,
    entry.basisCurrency,
    currency,
    prices.btcPerAi,
  );
}

/**
 * 將單筆價格由保存基準貨幣轉成目前顯示貨幣。
 *
 * 這個函式只回傳換算結果，不會修改傳入的價格或任何 persistence state，
 * 讓 UI 可以在每次 render 依原始 draft 重新計算，避免切換貨幣造成精度漂移。
 */
export function convertMarketPriceAmount(
  amount: number,
  basisCurrency: MarketCurrency,
  displayCurrency: MarketCurrency,
  btcPerAi: number,
): number {
  if (basisCurrency === displayCurrency) return amount;

  return displayCurrency === 'btc'
    ? amount * btcPerAi
    : amount / btcPerAi;
}

/**
 * 產生可直接放入 number input 的價格文字。
 *
 * 使用有效位數而不是固定小數位，讓 BTC 下的小額材料價格不會被格式化成
 * 0；同時不加入千分位，避免 HTML number input 將其視為無效值。
 */
export function formatMarketPriceAmount(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Object.is(value, -0)) return '0';

  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumSignificantDigits: 15,
  }).format(value);
}
