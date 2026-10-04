/**
 * 活動收益總覽的純計算核心。
 *
 * 活動 metadata、箱子掉落與既有工具公式分開維護；這裡只負責把已驗證的
 * 輸入與 resolved market prices 投影成可比較的「每批」及「每分鐘」收益。
 */

import {
  earningsActivityCatalog,
  type EarningsActivityDefinition,
  type EarningsActivityId,
} from '@/data/game/earnings-activities';
import { blackMarketQualityCatalog, type BlackMarketQualityId } from '@/data/game/black-market';
import { marketPriceCatalog, type MarketPriceItemId } from '@/data/game/economy';
import { isBuffPercent } from './buff-percent';
import { defaultSearchRewards } from './search-reward';
import { computeOptimalSearchArea } from './search-reward-calculator';
import { calculateBlackMarket } from './black-market-calculator';
import { calculateMining, type MiningCalculation } from './mining-calculator';
import { getDualPrice, type ResolvedMarketPrices } from './market-prices';
import { expectedLootBoxNetAi } from './loot-box-calculator';

export const EARNINGS_LEVEL_MIN = 1;
export const EARNINGS_LEVEL_MAX = 800;
/** Helper 的兩層 40% 減時效果是計算假設，不是活動資料本身。 */
export const EARNINGS_TIME_REDUCTION_PERCENT = 80;
export const EARNINGS_ELAPSED_MINUTES = [15, 30, 45, 60, 105] as const;
export const EARNINGS_COMPARISON_MODES = [
  'per-minute',
  'elapsed-15',
  'elapsed-30',
  'elapsed-45',
  'elapsed-60',
  'elapsed-105',
] as const;

export type EarningsElapsedMinutes = (typeof EARNINGS_ELAPSED_MINUTES)[number];
export type EarningsComparisonMode = (typeof EARNINGS_COMPARISON_MODES)[number];

export interface EarningsInputs {
  readonly searchLevel: number;
  readonly printingLevel: number;
  readonly miningLevel: number;
  readonly btcBuffPercent: number;
  readonly bargainPercent: number;
}

export type EarningsInputError =
  | 'search-level'
  | 'printing-level'
  | 'mining-level'
  | 'btc-buff'
  | 'bargain';

export interface EarningsCalculationOptions {
  /** 預設沿用已確認的 80% 作業時間縮減；日後可接到明確的計算設定。 */
  readonly timeReductionPercent?: number;
  /** 預設以每分鐘淨收益比較；飛逝模式則比較指定期間內的總淨收益。 */
  readonly comparisonMode?: EarningsComparisonMode;
  /** 與 comparisonMode 等價的測試／純計算入口；未提供時沿用每分鐘模式。 */
  readonly elapsedMinutes?: number;
}

export interface EarningsElapsedActivityResult {
  /** 在指定飛逝期間內可完成的活動次數。 */
  readonly count: number;
  /** 實際執行這些次數所需的有效秒數。 */
  readonly usedSeconds: number;
  /** 指定飛逝期間內的總淨 AI 收益；無法完成一次或缺少物價時為 null。 */
  readonly totalNetAi: number | null;
  /** 實際使用時間占指定飛逝時間的百分比。 */
  readonly timeUtilizationPercent: number;
}

export interface EarningsActivityResult {
  readonly id: EarningsActivityId;
  readonly batchSize: number;
  readonly effectiveBatchMinutes: number;
  /** 單次操作的淨 AI 收益；缺少必要物價時為 null。 */
  readonly unitNetAi: number | null;
  /** 該批次的淨 AI 收益；缺少必要物價時為 null。 */
  readonly batchNetAi: number | null;
  /** 每分鐘淨 AI 收益；缺少必要物價時為 null。 */
  readonly aiPerMinute: number | null;
  /** 飛逝模式的活動摘要；每分鐘模式時為 null。 */
  readonly elapsed: EarningsElapsedActivityResult | null;
}

export interface EarningsCalculation {
  readonly timeReductionPercent: number;
  readonly comparisonMode: EarningsComparisonMode;
  readonly elapsedMinutes: number | null;
  readonly activities: readonly EarningsActivityResult[];
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function finiteResult(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function isValidLevel(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= EARNINGS_LEVEL_MIN
    && value <= EARNINGS_LEVEL_MAX;
}

function isValidPercent(value: unknown, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximum;
}

export function validateEarningsInputs(
  inputs: Partial<EarningsInputs>,
): EarningsInputError | null {
  if (!isValidLevel(inputs.searchLevel)) return 'search-level';
  if (!isValidLevel(inputs.printingLevel)) return 'printing-level';
  if (!isValidLevel(inputs.miningLevel)) return 'mining-level';
  if (!isBuffPercent(inputs.btcBuffPercent)) return 'btc-buff';
  if (!isValidPercent(inputs.bargainPercent, 40)) return 'bargain';
  return null;
}

function getEffectiveUnitSeconds(
  activity: EarningsActivityDefinition,
  timeReductionPercent: number,
): number {
  const seconds = activity.baseUnitSeconds * (100 - timeReductionPercent) / 100;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function getEffectiveBatchMinutes(
  activity: EarningsActivityDefinition,
  timeReductionPercent: number,
): number {
  const minutes = getEffectiveUnitSeconds(activity, timeReductionPercent)
    * activity.batchSize
    / 60;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function getElapsedActivityCount(
  activity: EarningsActivityDefinition,
  elapsedMinutes: number,
  timeReductionPercent: number,
): number {
  const elapsedSeconds = elapsedMinutes * 60;
  const reductionBasis = 100 - timeReductionPercent;
  const denominator = activity.baseUnitSeconds * reductionBasis;

  // 以整數比例計算 floor(可用秒數／有效單次秒數)，避免先算小數秒數造成邊界誤差。
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  const possibleCount = Math.floor((elapsedSeconds * 100) / denominator);
  return Math.max(0, Math.min(activity.batchSize, possibleCount));
}

function multiplyNet(value: number | null, count: number): number | null {
  return value === null ? null : finiteResult(value * count);
}

function getElapsedMinutesForMode(mode: EarningsComparisonMode): number | null {
  if (mode === 'per-minute') return null;
  return Number(mode.slice('elapsed-'.length));
}

function isComparisonMode(value: unknown): value is EarningsComparisonMode {
  return typeof value === 'string'
    && EARNINGS_COMPARISON_MODES.includes(value as EarningsComparisonMode);
}

function getComparisonMode(options: EarningsCalculationOptions): {
  readonly mode: EarningsComparisonMode;
  readonly elapsedMinutes: number | null;
} | null {
  if (options.comparisonMode !== undefined) {
    if (!isComparisonMode(options.comparisonMode)) return null;
    const elapsedMinutes = getElapsedMinutesForMode(options.comparisonMode);
    return {
      mode: options.comparisonMode,
      elapsedMinutes,
    };
  }

  if (options.elapsedMinutes !== undefined) {
    if (!EARNINGS_ELAPSED_MINUTES.includes(options.elapsedMinutes as EarningsElapsedMinutes)) {
      return null;
    }
    const elapsedMinutes = options.elapsedMinutes as EarningsElapsedMinutes;
    return {
      mode: `elapsed-${elapsedMinutes}` as EarningsComparisonMode,
      elapsedMinutes,
    };
  }

  return { mode: 'per-minute', elapsedMinutes: null };
}

function activityResult(
  activity: EarningsActivityDefinition,
  unitNetAi: number | null,
  batchNetAi: number | null,
  comparisonCount: number,
  timeReductionPercent: number,
  elapsedMinutes: number | null,
  elapsedNetAi?: number | null,
): EarningsActivityResult {
  const minutes = getEffectiveBatchMinutes(activity, timeReductionPercent);
  const effectiveUnitSeconds = getEffectiveUnitSeconds(activity, timeReductionPercent);
  const safeNet = finiteResult(batchNetAi);
  const safeUnitNet = finiteResult(unitNetAi);
  const elapsed = elapsedMinutes === null
    ? null
    : (() => {
      const elapsedDurationSeconds = elapsedMinutes * 60;
      const usedSeconds = Number.isFinite(effectiveUnitSeconds * comparisonCount)
        ? effectiveUnitSeconds * comparisonCount
        : 0;
      const totalNetAi = comparisonCount > 0
        ? elapsedNetAi === undefined
          ? multiplyNet(safeUnitNet, comparisonCount)
          : finiteResult(elapsedNetAi)
        : null;
      const timeUtilizationPercent = elapsedDurationSeconds > 0
        ? Math.min(100, Math.max(0, usedSeconds / elapsedDurationSeconds * 100))
        : 0;

      return {
        count: comparisonCount,
        usedSeconds,
        totalNetAi,
        timeUtilizationPercent: Number.isFinite(timeUtilizationPercent)
          ? timeUtilizationPercent
          : 0,
      } satisfies EarningsElapsedActivityResult;
    })();

  return {
    id: activity.id as EarningsActivityId,
    batchSize: activity.batchSize,
    effectiveBatchMinutes: minutes,
    unitNetAi: safeUnitNet,
    batchNetAi: safeNet,
    aiPerMinute: safeNet === null || minutes <= 0
      ? null
      : finiteResult(safeNet / minutes),
    elapsed,
  };
}

function getMarketItemId(value: string): MarketPriceItemId | null {
  return marketPriceCatalog.some((item) => item.itemId === value)
    ? value as MarketPriceItemId
    : null;
}

function itemPriceAi(id: string, prices: ResolvedMarketPrices): number | null {
  const marketItemId = getMarketItemId(id);
  if (!marketItemId) return null;

  const value = getDualPrice(prices, marketItemId, 'ai');
  const normalized = id === 'tech-scrap'
    || id === 'medical-tech-parts'
    || id === 'ammunition-tech-parts'
    || id === 'military-ammunition-tech-parts'
    ? value / 1_000
    : value;
  return isFiniteNonNegative(normalized) ? normalized : null;
}

function calculateSearchActivity(
  activity: Extract<EarningsActivityDefinition, { kind: 'search' }>,
  inputs: EarningsInputs,
  prices: ResolvedMarketPrices,
  timeReductionPercent: number,
  comparisonCount: number,
  elapsedMinutes: number | null,
): EarningsActivityResult {
  const getSearchNet = (count: number) => {
    if (count < 1) return null;
    const optimal = computeOptimalSearchArea(
    defaultSearchRewards,
    inputs.searchLevel,
    {
      mt: getDualPrice(prices, 'medical-tech-parts', 'ai'),
      atp: getDualPrice(prices, 'ammunition-tech-parts', 'ai'),
      matp: getDualPrice(prices, 'military-ammunition-tech-parts', 'ai'),
    },
      count,
    ).optimalArea;
    return finiteResult(optimal?.totalExpectedValue ?? null);
  };

  const unitNet = getSearchNet(1);
  const batchNet = getSearchNet(activity.batchSize);
  // 搜索的最佳區域與總收益必須以實際 count 重新執行既有搜索計算。
  const comparisonNet = elapsedMinutes === null ? batchNet : getSearchNet(comparisonCount);

  return activityResult(
    activity,
    comparisonNet === null ? unitNet : comparisonNet / comparisonCount,
    batchNet,
    comparisonCount,
    timeReductionPercent,
    elapsedMinutes,
    elapsedMinutes === null ? undefined : comparisonNet,
  );
}

function calculateBlackMarketActivity(
  activity: Extract<EarningsActivityDefinition, { kind: 'black-market' }>,
  inputs: EarningsInputs,
  prices: ResolvedMarketPrices,
  timeReductionPercent: number,
  comparisonCount: number,
  elapsedMinutes: number | null,
): EarningsActivityResult {
  const cacheAmounts = Object.fromEntries(
    blackMarketQualityCatalog.map((quality) => [quality.id, 1]),
  ) as Record<BlackMarketQualityId, number>;
  const cachePerAi = Object.fromEntries(
    blackMarketQualityCatalog.map((quality) => [quality.id, prices.caches[quality.id].value]),
  ) as Record<BlackMarketQualityId, number>;
  const blackMarketResults = calculateBlackMarket({
    printingLevel: inputs.printingLevel,
    cacheAmounts,
    btcBuffPercent: inputs.btcBuffPercent,
    bargainPercent: inputs.bargainPercent,
    aiPriceInBtc: prices.btcPerAi,
    cachePerAi,
  });
  const result = blackMarketResults?.find((entry) => entry.id === activity.quality);
  const unitNet = finiteResult(result?.profitAi ?? null);

  return activityResult(
    activity,
    unitNet,
    multiplyNet(unitNet, activity.batchSize),
    comparisonCount,
    timeReductionPercent,
    elapsedMinutes,
  );
}

function calculateMiningActivity(
  activity: Extract<EarningsActivityDefinition, { kind: 'mining' | 'ai-crafting' }>,
  inputs: EarningsInputs,
  prices: ResolvedMarketPrices,
  timeReductionPercent: number,
  comparisonCount: number,
  elapsedMinutes: number | null,
): EarningsActivityResult {
  const calculation: MiningCalculation | null = calculateMining({
    miningLevel: inputs.miningLevel,
    aiPerHash: getDualPrice(prices, 'hash', 'ai'),
    btcPerAi: prices.btcPerAi,
    aiPerThousandTechScrap: getDualPrice(prices, 'tech-scrap', 'ai'),
    cortexBonusPercent: 0,
    tradeExploitPercent: inputs.btcBuffPercent,
  });
  if (!calculation) {
    return activityResult(
      activity,
      null,
      null,
      comparisonCount,
      timeReductionPercent,
      elapsedMinutes,
    );
  }

  // 核心 AI 製作利潤涵蓋 groupsPerAction 組；收益總覽的單位則是一組。
  const unitNet = activity.kind === 'mining'
    ? finiteResult(calculation.btc.profitBtc / prices.btcPerAi)
    : finiteResult(calculation.aiCraft.profitAi / calculation.aiCraft.groupsPerAction);
  return activityResult(
    activity,
    unitNet,
    multiplyNet(unitNet, activity.batchSize),
    comparisonCount,
    timeReductionPercent,
    elapsedMinutes,
  );
}

function calculateLootBoxActivity(
  activity: Extract<EarningsActivityDefinition, { kind: 'loot-box' }>,
  prices: ResolvedMarketPrices,
  timeReductionPercent: number,
  comparisonCount: number,
  elapsedMinutes: number | null,
): EarningsActivityResult {
  const unitNet = finiteResult(expectedLootBoxNetAi(activity.boxType, prices));
  return activityResult(
    activity,
    unitNet,
    multiplyNet(unitNet, activity.batchSize),
    comparisonCount,
    timeReductionPercent,
    elapsedMinutes,
  );
}

function calculateConversionActivity(
  activity: Extract<EarningsActivityDefinition, { kind: 'crush' | 'pack' }>,
  prices: ResolvedMarketPrices,
  timeReductionPercent: number,
  comparisonCount: number,
  elapsedMinutes: number | null,
): EarningsActivityResult {
  const inputPrice = itemPriceAi(activity.inputItemId, prices);
  const outputPrice = itemPriceAi(activity.outputItemId, prices);
  const unitNet = inputPrice === null || outputPrice === null
    ? null
    : outputPrice * activity.outputQuantity - inputPrice * activity.inputQuantity;
  const safeUnitNet = finiteResult(unitNet);
  return activityResult(
    activity,
    safeUnitNet,
    multiplyNet(safeUnitNet, activity.batchSize),
    comparisonCount,
    timeReductionPercent,
    elapsedMinutes,
  );
}

function calculateActivity(
  activity: EarningsActivityDefinition,
  inputs: EarningsInputs,
  prices: ResolvedMarketPrices,
  timeReductionPercent: number,
  elapsedMinutes: number | null,
): EarningsActivityResult {
  const comparisonCount = elapsedMinutes === null
    ? activity.batchSize
    : getElapsedActivityCount(activity, elapsedMinutes, timeReductionPercent);

  switch (activity.kind) {
    case 'search':
      return calculateSearchActivity(
        activity,
        inputs,
        prices,
        timeReductionPercent,
        comparisonCount,
        elapsedMinutes,
      );
    case 'black-market':
      return calculateBlackMarketActivity(
        activity,
        inputs,
        prices,
        timeReductionPercent,
        comparisonCount,
        elapsedMinutes,
      );
    case 'mining':
    case 'ai-crafting':
      return calculateMiningActivity(
        activity,
        inputs,
        prices,
        timeReductionPercent,
        comparisonCount,
        elapsedMinutes,
      );
    case 'loot-box':
      return calculateLootBoxActivity(
        activity,
        prices,
        timeReductionPercent,
        comparisonCount,
        elapsedMinutes,
      );
    case 'crush':
    case 'pack':
      return calculateConversionActivity(
        activity,
        prices,
        timeReductionPercent,
        comparisonCount,
        elapsedMinutes,
      );
  }
}

export function calculateEarnings(
  inputs: Partial<EarningsInputs>,
  prices: ResolvedMarketPrices,
  options: EarningsCalculationOptions = {},
): EarningsCalculation | null {
  if (validateEarningsInputs(inputs) !== null) return null;

  const timeReductionPercent = options.timeReductionPercent
    ?? EARNINGS_TIME_REDUCTION_PERCENT;
  if (!Number.isFinite(timeReductionPercent) || timeReductionPercent < 0 || timeReductionPercent >= 100) {
    return null;
  }

  const comparison = getComparisonMode(options);
  if (comparison === null) return null;

  const validInputs = inputs as EarningsInputs;
  const activities = earningsActivityCatalog
    .map((activity) => calculateActivity(
      activity,
      validInputs,
      prices,
      timeReductionPercent,
      comparison.elapsedMinutes,
    ))
    .sort((left, right) => {
      const leftValue = comparison.elapsedMinutes === null
        ? left.aiPerMinute
        : left.elapsed?.totalNetAi ?? null;
      const rightValue = comparison.elapsedMinutes === null
        ? right.aiPerMinute
        : right.elapsed?.totalNetAi ?? null;
      if (leftValue === null && rightValue === null) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return rightValue - leftValue;
    });

  return {
    timeReductionPercent,
    comparisonMode: comparison.mode,
    elapsedMinutes: comparison.elapsedMinutes,
    activities,
  };
}
