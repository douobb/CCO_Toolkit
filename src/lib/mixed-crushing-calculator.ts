import {
  earningsActivityCatalog,
  type EarningsActivityId,
} from '@/data/game/earnings-activities';
import type {
  EarningsCalculation,
  EarningsComparisonMode,
} from './earnings-calculator';
import {
  defaultMixedCrushingCounts,
  MIXED_CRUSHING_MAX_BASE_SECONDS,
  getMixedCrushingBaseSeconds,
  getMixedCrushingBaseTimeBudget,
  mixedCrushingTypeKeys,
  validateMixedCrushingCounts,
  type MixedCrushingCounts,
  type MixedCrushingTypeKey,
} from './mixed-crushing-schema';

const mixedCrushingActivityIds = {
  medical: 'crush-medical',
  ammunition: 'crush-ammunition',
  military: 'crush-military-ammunition',
} as const satisfies Readonly<Record<MixedCrushingTypeKey, EarningsActivityId>>;

function getCrushingDefinition(id: EarningsActivityId) {
  const activity = earningsActivityCatalog.find((candidate) => candidate.id === id);
  if (!activity || activity.kind !== 'crush') {
    throw new Error(`缺少混合壓碎活動資料：${id}`);
  }
  return activity;
}

const crushingDefinitions = {
  medical: getCrushingDefinition(mixedCrushingActivityIds.medical),
  ammunition: getCrushingDefinition(mixedCrushingActivityIds.ammunition),
  military: getCrushingDefinition(mixedCrushingActivityIds.military),
} as const;

export const mixedCrushingUnitSeconds = {
  medical: crushingDefinitions.medical.baseUnitSeconds,
  ammunition: crushingDefinitions.ammunition.baseUnitSeconds,
  military: crushingDefinitions.military.baseUnitSeconds,
} as const;

export type MixedCrushingUnitNetAi = Readonly<Record<MixedCrushingTypeKey, number | null>>;

export interface MixedCrushingResult {
  readonly source: 'recommended' | 'manual';
  readonly comparisonMode: EarningsComparisonMode;
  readonly counts: MixedCrushingCounts;
  readonly totalCount: number;
  readonly baseTimeBudgetSeconds: number;
  readonly baseSeconds: number;
  readonly actualSeconds: number;
  readonly outputTechScrap: number;
  readonly unitNetAi: MixedCrushingUnitNetAi;
  readonly totalNetAi: number | null;
  readonly aiPerMinute: number | null;
  readonly timeUtilizationPercent: number;
  readonly isRecommended: boolean;
}

function getUnitNetAi(calculation: EarningsCalculation): MixedCrushingUnitNetAi {
  const activityById = new Map(
    calculation.activities.map((activity) => [activity.id, activity]),
  );
  return {
    medical: activityById.get(mixedCrushingActivityIds.medical)?.unitNetAi ?? null,
    ammunition: activityById.get(mixedCrushingActivityIds.ammunition)?.unitNetAi ?? null,
    military: activityById.get(mixedCrushingActivityIds.military)?.unitNetAi ?? null,
  };
}

function isFiniteNet(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function getTotalNetAi(
  counts: MixedCrushingCounts,
  unitNetAi: MixedCrushingUnitNetAi,
): number | null {
  let total = 0;
  for (const key of mixedCrushingTypeKeys) {
    const count = counts[key];
    if (count === 0) continue;
    const unitNet = unitNetAi[key];
    if (!isFiniteNet(unitNet)) return null;
    total += count * unitNet;
  }
  return Number.isFinite(total) ? total : null;
}

/** 飛逝模式依單位淨收益／基準秒數排序，逐類填入正收益批次。 */
export function getRecommendedElapsedMixedCrushingCounts(
  unitNetAi: MixedCrushingUnitNetAi,
  baseTimeBudgetSeconds: number,
): MixedCrushingCounts {
  if (!Number.isSafeInteger(baseTimeBudgetSeconds) || baseTimeBudgetSeconds <= 0) {
    return { ...defaultMixedCrushingCounts };
  }

  const candidates = mixedCrushingTypeKeys.flatMap((type, order) => {
    const netAi = unitNetAi[type];
    return isFiniteNet(netAi) && netAi > 0
      ? [{ type, netAi, unitSeconds: mixedCrushingUnitSeconds[type], order }]
      : [];
  }).sort((left, right) => (
    right.netAi * left.unitSeconds - left.netAi * right.unitSeconds
  ) || left.order - right.order);

  const counts = { ...defaultMixedCrushingCounts };
  let remainingBaseSeconds = Math.min(
    MIXED_CRUSHING_MAX_BASE_SECONDS,
    baseTimeBudgetSeconds,
  );

  for (const candidate of candidates) {
    const count = Math.min(
      1_000,
      Math.floor(remainingBaseSeconds / candidate.unitSeconds),
    );
    if (count <= 0) continue;

    counts[candidate.type] = count;
    remainingBaseSeconds -= count * candidate.unitSeconds;
  }

  return counts;
}

/** 每分鐘模式選單位淨收益／秒數最高的正收益類別，數量取合法上限。 */
export function getRecommendedRateMixedCrushingCounts(
  unitNetAi: MixedCrushingUnitNetAi,
  baseTimeBudgetSeconds: number,
): MixedCrushingCounts {
  if (!Number.isSafeInteger(baseTimeBudgetSeconds) || baseTimeBudgetSeconds <= 0) {
    return { ...defaultMixedCrushingCounts };
  }

  let bestType: MixedCrushingTypeKey | null = null;
  let bestCount = 0;

  for (const type of mixedCrushingTypeKeys) {
    const netAi = unitNetAi[type];
    const count = Math.min(
      1_000,
      Math.floor(baseTimeBudgetSeconds / mixedCrushingUnitSeconds[type]),
    );
    if (!isFiniteNet(netAi) || netAi <= 0 || count <= 0) continue;

    if (bestType === null) {
      bestType = type;
      bestCount = count;
      continue;
    }

    const bestNetAi = unitNetAi[bestType];
    if (
      isFiniteNet(bestNetAi)
      && netAi * mixedCrushingUnitSeconds[bestType]
        > bestNetAi * mixedCrushingUnitSeconds[type]
    ) {
      bestType = type;
      bestCount = count;
    }
  }

  return bestType === null
    ? { ...defaultMixedCrushingCounts }
    : { ...defaultMixedCrushingCounts, [bestType]: bestCount };
}

function createMixedCrushingResult(
  calculation: EarningsCalculation,
  counts: MixedCrushingCounts,
  unitNetAi: MixedCrushingUnitNetAi,
  source: MixedCrushingResult['source'],
): MixedCrushingResult | null {
  const baseSeconds = getMixedCrushingBaseSeconds(counts, mixedCrushingUnitSeconds);
  if (baseSeconds === null) return null;

  const totalCount = mixedCrushingTypeKeys.reduce((sum, key) => sum + counts[key], 0);
  const outputTechScrap = mixedCrushingTypeKeys.reduce(
    (sum, key) => sum + counts[key] * crushingDefinitions[key].outputQuantity,
    0,
  );
  const actualSeconds = baseSeconds * (100 - calculation.timeReductionPercent) / 100;
  const totalNetAi = getTotalNetAi(counts, unitNetAi);
  const aiPerMinute = totalNetAi === null || actualSeconds <= 0
    ? null
    : totalNetAi / (actualSeconds / 60);
  const elapsedSeconds = calculation.elapsedMinutes === null
    ? 0
    : calculation.elapsedMinutes * 60;

  return {
    source,
    comparisonMode: calculation.comparisonMode,
    counts,
    totalCount,
    baseTimeBudgetSeconds: getMixedCrushingBaseTimeBudget(
      calculation.elapsedMinutes,
      calculation.timeReductionPercent,
    ),
    baseSeconds,
    actualSeconds,
    outputTechScrap,
    unitNetAi,
    totalNetAi,
    aiPerMinute,
    timeUtilizationPercent: elapsedSeconds > 0
      ? actualSeconds / elapsedSeconds * 100
      : 0,
    isRecommended: source === 'recommended' && totalNetAi !== null && totalNetAi > 0,
  };
}

export function calculateRecommendedMixedCrushing(
  calculation: EarningsCalculation,
): MixedCrushingResult | null {
  const unitNetAi = getUnitNetAi(calculation);
  const baseTimeBudgetSeconds = getMixedCrushingBaseTimeBudget(
    calculation.elapsedMinutes,
    calculation.timeReductionPercent,
  );
  const counts = calculation.comparisonMode === 'per-minute'
    ? getRecommendedRateMixedCrushingCounts(unitNetAi, baseTimeBudgetSeconds)
    : getRecommendedElapsedMixedCrushingCounts(unitNetAi, baseTimeBudgetSeconds);
  return createMixedCrushingResult(calculation, counts, unitNetAi, 'recommended');
}

export function calculateManualMixedCrushing(
  calculation: EarningsCalculation,
  counts: MixedCrushingCounts,
): MixedCrushingResult | null {
  const baseTimeBudgetSeconds = getMixedCrushingBaseTimeBudget(
    calculation.elapsedMinutes,
    calculation.timeReductionPercent,
  );
  if (
    validateMixedCrushingCounts(counts, baseTimeBudgetSeconds, mixedCrushingUnitSeconds)
    !== null
  ) return null;

  return createMixedCrushingResult(calculation, counts, getUnitNetAi(calculation), 'manual');
}

export function getMixedCrushingComparisonValue(
  result: MixedCrushingResult | null,
  comparisonMode: EarningsComparisonMode,
): number | null {
  if (!result || result.comparisonMode !== comparisonMode) return null;
  return comparisonMode === 'per-minute' ? result.aiPerMinute : result.totalNetAi;
}
