/**
 * 等級需求換算的純計算核心。
 *
 * 方法的批次、時間與資源 metadata 由 progression Game Data 提供；
 * 本模組只以白名單 formula ID 執行公式，不讀取 DOM、儲存或遊戲事件。
 */

import {
  getProgressionMethods,
  progressionLevelIds,
  type ProgressionFormulaId,
  type ProgressionLevelId,
  type ProgressionMethodDefinition as CatalogMethodDefinition,
  type ProgressionMethodId,
  type ProgressionResourceId,
} from '@/data/game/progression';

import {
  getDualPrice,
  type ResolvedMarketPrices,
} from './market-prices';
import { isBuffPercent } from './buff-percent';

export {
  progressionFormulaIds as levelFormulaIds,
  progressionLevelIds as levelTypeIds,
  progressionMethodIds as levelMethodIds,
  progressionResourceIds as levelResourceIds,
} from '@/data/game/progression';
export type {
  ProgressionFormulaId as LevelFormulaId,
  ProgressionLevelId as LevelTypeId,
  ProgressionMethodId as LevelMethodId,
  ProgressionResourceId as LevelResourceId,
} from '@/data/game/progression';

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 800;

export type LevelMethodDefinition = CatalogMethodDefinition;

export interface LevelTypeDefinition {
  readonly id: ProgressionLevelId;
  readonly methods: readonly LevelMethodDefinition[];
}

export interface LevelCalculationInputs {
  readonly levelType: ProgressionLevelId;
  readonly currentLevel: number;
  readonly targetLevel: number;
  readonly cortexBonusPercent: number;
}

export interface LevelResourceResult {
  readonly id: ProgressionResourceId;
  readonly amount: number;
  readonly totalValueAi: number | null;
}

export interface LevelMethodResult extends LevelMethodDefinition {
  readonly neededTimes: number;
  readonly resourceResults: readonly LevelResourceResult[];
  readonly totalMinutes: number | null;
  readonly totalValueAi: number | null;
}

export interface LevelCalculation {
  readonly inputs: LevelCalculationInputs;
  readonly cortexMultiplier: number;
  readonly methods: readonly LevelMethodResult[];
}

export type LevelInputError =
  | 'invalid-type'
  | 'invalid-current'
  | 'invalid-target'
  | 'invalid-buff'
  | 'target-before-current';

const levelMethodsByType = Object.fromEntries(
  progressionLevelIds.map((levelType) => [levelType, getProgressionMethods(levelType)]),
);

export const levelTypeCatalog: readonly LevelTypeDefinition[] = progressionLevelIds.map((id) => ({
  id,
  methods: levelMethodsByType[id],
}));

export function isLevelTypeId(value: unknown): value is ProgressionLevelId {
  return typeof value === 'string' && progressionLevelIds.includes(value as ProgressionLevelId);
}

export function levelMethodsForType(
  levelType: ProgressionLevelId,
): readonly LevelMethodDefinition[] {
  return levelMethodsByType[levelType];
}

/** 每級所需 EXP；主等級與其他技能使用不同指數。 */
export function requiredLevelExperience(levelType: ProgressionLevelId, level: number): number {
  return Math.ceil(8 * level ** (levelType === 'level' ? 3.1 : 3.02));
}

/** 額葉皮質增強的實際 EXP 倍率。 */
export function cortexMultiplier(cortexBonusPercent: number): number {
  return 1 + cortexBonusPercent / 100;
}

type ExperienceFormula = (level: number) => number;

const formulaById: Readonly<Record<ProgressionFormulaId, ExperienceFormula>> = {
  'level-ai': (level) => Math.ceil((level ** 1.8 + 16) * 1.1 * 12),
  'printing-black-market': (level) => Math.ceil(level ** 2 + 24),
  'printing-job': (level) => level ** 2 + 24,
  'printing-reverse-engineering': (level) => (level ** 2 + 16) * 1.5,
  'medical-scrap': (level) => Math.ceil(level ** 2 + 16),
  'medical-job': (level) => (level ** 2 + 16) * 15,
  'ammo-energy-cell': (level) => Math.ceil(level ** 2 + 16),
  'ammo-anti-matter-charge': (level) => Math.ceil(level ** 2 + 16),
  'ammo-job': (level) => (level ** 2 + 16) * 15,
  scavenge: (level) => (level ** 2 + 16) * 9,
  mining: (level) => Math.ceil((level ** 2 + 16) * 6),
  'mining-ai-crafting': (level) => level ** 2 + 16,
};

function findMethod(method: ProgressionMethodId): LevelMethodDefinition | undefined {
  for (const levelType of progressionLevelIds) {
    const definition = levelMethodsByType[levelType].find((candidate) => candidate.id === method);
    if (definition) return definition;
  }
  return undefined;
}

/** 依白名單公式計算每一個基礎單位的 EXP。 */
export function baseExperiencePerUnit(method: ProgressionMethodId, level: number): number {
  const definition = findMethod(method);
  if (!definition) return Number.NaN;
  return formulaById[definition.formulaId](level);
}

/** 依規格計算每批基礎 EXP；批次數由 metadata 的 batchSize 定義。 */
export function baseExperiencePerBatch(method: ProgressionMethodId, level: number): number {
  const definition = findMethod(method);
  if (!definition) return Number.NaN;
  return baseExperiencePerUnit(method, level) * definition.batchSize;
}

function isValidLevel(value: number): boolean {
  return Number.isSafeInteger(value) && value >= LEVEL_MIN && value <= LEVEL_MAX;
}

function isValidBonus(value: number): boolean {
  return isBuffPercent(value);
}

export function validateLevelInputs(inputs: LevelCalculationInputs): LevelInputError | null {
  if (!isLevelTypeId(inputs.levelType)) return 'invalid-type';
  if (!isValidLevel(inputs.currentLevel)) return 'invalid-current';
  if (!isValidLevel(inputs.targetLevel)) return 'invalid-target';
  if (!isValidBonus(inputs.cortexBonusPercent)) return 'invalid-buff';
  if (inputs.targetLevel < inputs.currentLevel) return 'target-before-current';
  return null;
}

function isFiniteResult(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function resourceValueAi(
  resource: ProgressionResourceId,
  amount: number,
  prices: ResolvedMarketPrices,
): number {
  switch (resource) {
    case 'ai':
      return amount;
    case 'cache':
      // 黑市採預設廢棄快取，cache/AI 代表每 1 AI 可換得的快取數。
      return amount / prices.caches.trash.value;
    case 'hash':
      return amount * getDualPrice(prices, 'hash', 'ai');
    case 'tech-scrap':
    case 'medical-tech-parts':
    case 'ammunition-tech-parts':
    case 'military-ammunition-tech-parts':
      return (amount / 1_000) * getDualPrice(prices, resource, 'ai');
  }
}

function calculateResourceResults(
  definition: LevelMethodDefinition,
  neededTimes: number,
  prices: ResolvedMarketPrices | undefined,
): readonly LevelResourceResult[] {
  return definition.resources.map((resource) => {
    const amount = neededTimes * definition.batchSize * resource.perUnit;
    const rawValueAi = prices ? resourceValueAi(resource.id, amount, prices) : null;
    const totalValueAi = rawValueAi !== null && isFiniteResult(rawValueAi)
      ? rawValueAi
      : null;
    return {
      id: resource.id,
      amount,
      totalValueAi,
    };
  });
}

/**
 * 計算從目前等級到目標等級的所有可用方法。
 * 不把目前等級已累積的部分 EXP 納入，target=current 時各結果為 0。
 * `priceState` 僅用於顯示資源價值，不影響 EXP、操作次數或資源數量。
 */
export function calculateLevelRequirements(
  inputs: LevelCalculationInputs,
  priceState?: ResolvedMarketPrices,
): LevelCalculation | null {
  if (validateLevelInputs(inputs) !== null) return null;
  const multiplier = cortexMultiplier(inputs.cortexBonusPercent);
  const methods = levelMethodsForType(inputs.levelType).map((definition) => {
    let rawTimes = 0;
    for (let level = inputs.currentLevel + 1; level <= inputs.targetLevel; level += 1) {
      const required = requiredLevelExperience(inputs.levelType, level);
      const actual = baseExperiencePerUnit(definition.id, level) * definition.batchSize * multiplier;
      rawTimes += required / actual;
    }
    const grossTimes = Math.ceil(rawTimes);
    const neededTimes = grossTimes * definition.resourceRecovery;
    const resourceResults = calculateResourceResults(definition, neededTimes, priceState);
    const resourceValuesAvailable = priceState !== undefined
      && resourceResults.length > 0
      && resourceResults.every((resource) => resource.totalValueAi !== null);
    const rawTotalValueAi = resourceValuesAvailable
      ? resourceResults.reduce((total, resource) => total + (resource.totalValueAi ?? 0), 0)
      : null;
    const totalValueAi = rawTotalValueAi !== null && isFiniteResult(rawTotalValueAi)
      ? rawTotalValueAi
      : null;
    return {
      ...definition,
      neededTimes,
      resourceResults,
      totalMinutes: definition.unitMinutes === null
        ? null
        : neededTimes * definition.batchSize * definition.unitMinutes,
      totalValueAi,
    };
  });
  if (!methods.every((method) =>
    isFiniteResult(method.neededTimes)
    && (method.totalMinutes === null || isFiniteResult(method.totalMinutes))
    && method.resourceResults.every((resource) => isFiniteResult(resource.amount)),
  )) return null;
  return {
    inputs,
    cortexMultiplier: multiplier,
    methods,
  };
}
