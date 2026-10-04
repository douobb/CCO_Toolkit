/**
 * 黑市收益的純計算核心。
 *
 * 本模組只接受已整理好的數值與黑市資料集，不讀取 React、瀏覽器儲存、
 * CCO Helper 狀態或 UI label。品質倍率、公式參數與等級範圍皆由 Game Data
 * 提供，工具 adapter 再負責把共用輸入投影成這個模型。
 */

import {
  blackMarketDataSet,
  blackMarketQualityCatalog,
  type BlackMarketQualityId,
} from '@/data/game/black-market';
import { isBuffPercent } from './buff-percent';

export const BLACK_MARKET_LEVEL_MIN = blackMarketDataSet.payload.levelRange.min;
export const BLACK_MARKET_LEVEL_MAX = blackMarketDataSet.payload.levelRange.max;

export interface BlackMarketInputs {
  readonly printingLevel: number;
  readonly cacheAmounts: Readonly<Record<BlackMarketQualityId, number>>;
  readonly btcBuffPercent: number;
  readonly bargainPercent: number;
  readonly aiPriceInBtc: number;
  readonly cachePerAi: Readonly<Record<BlackMarketQualityId, number>>;
}

export interface BlackMarketQualityResult {
  readonly id: BlackMarketQualityId;
  readonly cacheAmount: number;
  readonly saleBtcPerCache: number;
  readonly soldBtc: number;
  readonly costAi: number;
  readonly profitBtc: number;
  readonly profitAi: number;
  readonly breakEvenLevel: number | null;
}

const blackMarketPayload = blackMarketDataSet.payload;
const resultDecimalPlaces = blackMarketPayload.resultDecimalPlaces;

function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function roundToResultPrecision(value: number): number {
  const factor = 10 ** resultDecimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isValidInputs(inputs: BlackMarketInputs): boolean {
  if (
    !isSafePositiveInteger(inputs.printingLevel) ||
    inputs.printingLevel < BLACK_MARKET_LEVEL_MIN ||
    inputs.printingLevel > BLACK_MARKET_LEVEL_MAX ||
    !isBuffPercent(inputs.btcBuffPercent) ||
    !isSafeNonNegativeInteger(inputs.bargainPercent) ||
    inputs.bargainPercent > 40 ||
    !isSafePositiveInteger(inputs.aiPriceInBtc)
  ) {
    return false;
  }

  return blackMarketQualityCatalog.every((quality) =>
    isSafeNonNegativeInteger(inputs.cacheAmounts[quality.id]) &&
    isSafePositiveInteger(inputs.cachePerAi[quality.id]),
  );
}

function salePerCacheBeforeRounding(
  level: number,
  qualityMultiplier: number,
  btcMultiplier: number,
  bargainMultiplier: number,
): number {
  const { levelMultiplier, levelOffset } = blackMarketPayload.saleFormula;
  return (
    (level * levelMultiplier + levelOffset) *
    qualityMultiplier *
    btcMultiplier *
    bargainMultiplier
  );
}

function findBreakEvenLevel(
  qualityMultiplier: number,
  btcMultiplier: number,
  bargainMultiplier: number,
  requiredSalePerCache: number,
): number | null {
  for (
    let level = BLACK_MARKET_LEVEL_MIN;
    level <= BLACK_MARKET_LEVEL_MAX;
    level += 1
  ) {
    if (
      salePerCacheBeforeRounding(
        level,
        qualityMultiplier,
        btcMultiplier,
        bargainMultiplier,
      ) >= requiredSalePerCache
    ) {
      return level;
    }
  }

  return null;
}

/**
 * 依黑市 Game Data 與輸入計算四種品質快取的收益。
 * 無效輸入回傳 null，避免 UI 在欄位尚未完成輸入時顯示部分結果。
 */
export function calculateBlackMarket(
  inputs: BlackMarketInputs,
): readonly BlackMarketQualityResult[] | null {
  if (!isValidInputs(inputs)) return null;

  const { saleFormula } = blackMarketPayload;
  const btcMultiplier = 1 + inputs.btcBuffPercent / 100;
  const bargainMultiplier = 1 + inputs.bargainPercent / 100;

  const results = blackMarketQualityCatalog.map((quality) => {
    const cacheAmount = inputs.cacheAmounts[quality.id];
    const baseSale = Math.ceil(
      (inputs.printingLevel * saleFormula.levelMultiplier + saleFormula.levelOffset) *
      quality.saleMultiplier,
    );
    const buffedSale = Math.ceil(baseSale * btcMultiplier);
    const saleBtcPerCache = Math.ceil(buffedSale * bargainMultiplier);
    const soldBtc = saleBtcPerCache * cacheAmount;
    const costAi = roundToResultPrecision(cacheAmount / inputs.cachePerAi[quality.id]);
    const profitBtc = roundToResultPrecision(
      soldBtc - costAi * inputs.aiPriceInBtc,
    );
    const profitAi = roundToResultPrecision(profitBtc / inputs.aiPriceInBtc);
    const breakEvenLevel = findBreakEvenLevel(
      quality.saleMultiplier,
      btcMultiplier,
      bargainMultiplier,
      inputs.aiPriceInBtc / inputs.cachePerAi[quality.id],
    );

    return {
      id: quality.id,
      cacheAmount,
      saleBtcPerCache,
      soldBtc,
      costAi,
      profitBtc,
      profitAi,
      breakEvenLevel,
    } satisfies BlackMarketQualityResult;
  });

  const hasFiniteValues = results.every((result) => [
    result.cacheAmount,
    result.saleBtcPerCache,
    result.soldBtc,
    result.costAi,
    result.profitBtc,
    result.profitAi,
    result.breakEvenLevel,
  ].every((value) => value === null || Number.isFinite(value)));

  return hasFiniteValues ? results : null;
}
