/**
 * 挖礦與製作 AI 的純計算核心。
 *
 * 這個模組只接受數值，不讀取 DOM、持久化儲存或遊戲事件，方便以固定
 * 公式測試並在不同介面重用。價格預設值由 economy Game Data 提供，
 * 計算函式本身仍可接受工具或使用者整合後的明確輸入。
 */

import { isBuffPercent } from './buff-percent';
import { getDualPrice, resolveMarketPrices } from './market-prices';

export interface MiningInputs {
  readonly miningLevel: number;
  readonly aiPerHash: number;
  readonly btcPerAi: number;
  readonly aiPerThousandTechScrap: number;
  readonly cortexBonusPercent: number;
  readonly tradeExploitPercent: number;
}

export interface MiningBtcResult {
  readonly miningLevel: number;
  readonly miningBaseExp: number;
  readonly miningExpPerAction: number;
  readonly miningBtcBase: number;
  readonly miningBtcPerAction: number;
  readonly hashConsumption: number;
  readonly hashCostAi: number;
  readonly btcCost: number;
  readonly profitBtc: number;
  readonly roiPercent: number | null;
  readonly breakEvenLevel: number | null;
  readonly levelsToBreakEven: number;
  readonly neededHashToProfit: number | null;
  readonly upgradeCostAi: number | null;
  readonly upgradeCostBtc: number | null;
}

export interface AiCraftResult {
  readonly miningLevel: number;
  readonly aiPerGroup: number;
  readonly groupsPerAction: number;
  readonly aiPerAction: number;
  readonly hashConsumption: number;
  readonly techScrapConsumption: number;
  readonly hashCostAi: number;
  readonly techScrapCostAi: number;
  readonly totalCostAi: number;
  readonly revenueAi: number;
  readonly profitAi: number;
  readonly roiPercent: number | null;
  readonly breakEvenLevel: number | null;
  readonly levelsToBreakEven: number;
  readonly neededHashToProfit: number | null;
  readonly upgradeCostAi: number | null;
}

export interface MiningCalculation {
  readonly btc: MiningBtcResult;
  readonly aiCraft: AiCraftResult;
}

export const MINING_LEVEL_SEARCH_MAX = 800;
export const MINING_LEVEL_MIN = 1;
export const MINING_LEVEL_MAX = MINING_LEVEL_SEARCH_MAX;
export const MINING_HASH_PER_ACTION = 8;
export const AI_GROUPS_PER_ACTION = 100;
export const AI_HASH_PER_GROUP = 20;
export const TECH_SCRAP_PER_GROUP = 10;
export const AI_CRAFT_HASH_COST = AI_HASH_PER_GROUP * AI_GROUPS_PER_ACTION;
export const AI_CRAFT_TECH_SCRAP_COST = TECH_SCRAP_PER_GROUP * AI_GROUPS_PER_ACTION;

const defaultMiningMarketPrices = resolveMarketPrices();

/** 由 economy catalog 的預設物價投影出的 Mining 初始輸入。 */
export const miningDefaults = {
  aiPerHash: getDualPrice(defaultMiningMarketPrices, 'hash', 'ai'),
  btcPerAi: defaultMiningMarketPrices.btcPerAi,
  aiPerThousandTechScrap: getDualPrice(defaultMiningMarketPrices, 'tech-scrap', 'ai'),
  cortexBonusPercent: 0,
  tradeExploitPercent: 0,
} as const;

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isValidInputs(inputs: MiningInputs): boolean {
  return Number.isSafeInteger(inputs.miningLevel)
    && inputs.miningLevel >= MINING_LEVEL_MIN
    && inputs.miningLevel <= MINING_LEVEL_MAX
    && isFiniteNonNegative(inputs.aiPerHash)
    && isFiniteNonNegative(inputs.btcPerAi)
    && isFiniteNonNegative(inputs.aiPerThousandTechScrap)
    && isBuffPercent(inputs.cortexBonusPercent)
    && isBuffPercent(inputs.tradeExploitPercent);
}

/** ceil[(L² + 16) × 6] */
export function miningBaseExp(level: number): number {
  return Math.ceil((level ** 2 + 16) * 6);
}

/** ceil(8 × L^3.02) */
export function requiredMiningExp(level: number): number {
  return Math.ceil(8 * level ** 3.02);
}

/** ceil[(L^1.01 + 89.6) × 20] */
export function miningBtcBase(level: number): number {
  return Math.ceil((level ** 1.01 + 89.6) * 20);
}

/** min(ceil(L / 10), 40) */
export function aiOutputPerGroup(level: number): number {
  return Math.min(Math.ceil(level / 10), 40);
}

export function miningExpPerAction(level: number, cortexBonusPercent: number): number {
  return miningBaseExp(level)
    * MINING_HASH_PER_ACTION
    * (1 + cortexBonusPercent / 100);
}

export function miningBtcPerAction(level: number, tradeExploitPercent: number): number {
  return miningBtcBase(level)
    * MINING_HASH_PER_ACTION
    * (1 + tradeExploitPercent / 100);
}

/** 由目前等級升到目標等級的操作次數；各級分數先累加，最後才 ceil。 */
export function neededMiningActions(
  currentLevel: number,
  targetLevel: number,
  cortexBonusPercent: number,
): number {
  if (targetLevel <= currentLevel) return 0;
  let rawActions = 0;
  for (let level = currentLevel + 1; level <= targetLevel; level += 1) {
    rawActions += requiredMiningExp(level) / miningExpPerAction(level, cortexBonusPercent);
  }
  return Math.ceil(rawActions);
}

function findFirstPositiveLevel(
  profitForLevel: (level: number) => number,
): number | null {
  for (let level = 1; level <= MINING_LEVEL_SEARCH_MAX; level += 1) {
    if (profitForLevel(level) > 0) return level;
  }
  return null;
}

function roiPercent(profit: number, cost: number): number | null {
  return cost === 0 ? null : (profit / cost) * 100;
}

function areFiniteResultValues(result: object): boolean {
  return Object.values(result).every((value) =>
    value === null || (typeof value === 'number' && Number.isFinite(value)),
  );
}

function createBtcResult(inputs: MiningInputs): MiningBtcResult | null {
  const hashConsumption = MINING_HASH_PER_ACTION;
  const hashCostAi = hashConsumption * inputs.aiPerHash;
  const btcCost = hashCostAi * inputs.btcPerAi;
  const miningBaseExpValue = miningBaseExp(inputs.miningLevel);
  const miningBtcBaseValue = miningBtcBase(inputs.miningLevel);
  const miningBtcPerActionValue = miningBtcPerAction(
    inputs.miningLevel,
    inputs.tradeExploitPercent,
  );
  const profitBtc = miningBtcPerActionValue - btcCost;
  const breakEvenLevel = findFirstPositiveLevel((level) =>
    miningBtcPerAction(level, inputs.tradeExploitPercent) - btcCost,
  );
  const neededHashToProfit = breakEvenLevel === null
    ? null
    : neededMiningActions(inputs.miningLevel, breakEvenLevel, inputs.cortexBonusPercent)
      * MINING_HASH_PER_ACTION;
  const result = {
    miningLevel: inputs.miningLevel,
    miningBaseExp: miningBaseExpValue,
    miningExpPerAction: miningExpPerAction(inputs.miningLevel, inputs.cortexBonusPercent),
    miningBtcBase: miningBtcBaseValue,
    miningBtcPerAction: miningBtcPerActionValue,
    hashConsumption,
    hashCostAi,
    btcCost,
    profitBtc,
    roiPercent: roiPercent(profitBtc, btcCost),
    breakEvenLevel,
    levelsToBreakEven: breakEvenLevel === null
      ? 0
      : Math.max(0, breakEvenLevel - inputs.miningLevel),
    neededHashToProfit,
    upgradeCostAi: neededHashToProfit === null
      ? null
      : neededHashToProfit * inputs.aiPerHash,
    upgradeCostBtc: neededHashToProfit === null
      ? null
      : neededHashToProfit * inputs.aiPerHash * inputs.btcPerAi,
  };
  return areFiniteResultValues(result) ? result : null;
}

function createAiCraftResult(inputs: MiningInputs): AiCraftResult | null {
  const hashConsumption = AI_CRAFT_HASH_COST;
  const techScrapConsumption = AI_CRAFT_TECH_SCRAP_COST;
  const hashCostAi = hashConsumption * inputs.aiPerHash;
  const techScrapCostAi = inputs.aiPerThousandTechScrap;
  const totalCostAi = hashCostAi + techScrapCostAi;
  const groupsPerAction = aiOutputPerGroup(inputs.miningLevel);
  const aiPerAction = groupsPerAction * AI_GROUPS_PER_ACTION;
  const profitAi = aiPerAction - totalCostAi;
  const breakEvenLevel = totalCostAi >= AI_GROUPS_PER_ACTION * 40
    ? null
    : findFirstPositiveLevel((level) =>
      aiOutputPerGroup(level) * AI_GROUPS_PER_ACTION - totalCostAi,
    );
  const neededHashToProfit = breakEvenLevel === null
    ? null
    : neededMiningActions(inputs.miningLevel, breakEvenLevel, inputs.cortexBonusPercent)
      * MINING_HASH_PER_ACTION;
  const result = {
    miningLevel: inputs.miningLevel,
    aiPerGroup: groupsPerAction,
    groupsPerAction: AI_GROUPS_PER_ACTION,
    aiPerAction,
    hashConsumption,
    techScrapConsumption,
    hashCostAi,
    techScrapCostAi,
    totalCostAi,
    revenueAi: aiPerAction,
    profitAi,
    roiPercent: roiPercent(profitAi, totalCostAi),
    breakEvenLevel,
    levelsToBreakEven: breakEvenLevel === null
      ? 0
      : Math.max(0, breakEvenLevel - inputs.miningLevel),
    neededHashToProfit,
    upgradeCostAi: neededHashToProfit === null
      ? null
      : neededHashToProfit * inputs.aiPerHash,
  };
  return areFiniteResultValues(result) ? result : null;
}

export function calculateMining(inputs: MiningInputs): MiningCalculation | null {
  if (!isValidInputs(inputs)) return null;
  const btc = createBtcResult(inputs);
  const aiCraft = createAiCraftResult(inputs);
  if (btc === null || aiCraft === null) return null;
  return { btc, aiCraft };
}
