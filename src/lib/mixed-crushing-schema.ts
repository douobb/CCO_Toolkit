import { z } from 'zod';

export const MIXED_CRUSHING_MAX_BASE_SECONDS = 32_400;
export const MIXED_CRUSHING_MAX_COUNT = 1_000;

export const mixedCrushingTypeKeys = [
  'medical',
  'ammunition',
  'military',
] as const;

export type MixedCrushingTypeKey = (typeof mixedCrushingTypeKeys)[number];

export const mixedCrushingModes = ['recommended', 'manual'] as const;
export type MixedCrushingMode = (typeof mixedCrushingModes)[number];

const countSchema = z.number().int().min(0).max(MIXED_CRUSHING_MAX_COUNT);
const countInputSchema = z.string().regex(/^\d+$/);

export const mixedCrushingCountsSchema = z.object({
  medical: countSchema,
  ammunition: countSchema,
  military: countSchema,
}).strict();

export const mixedCrushingCountInputsSchema = z.object({
  medical: countInputSchema,
  ammunition: countInputSchema,
  military: countInputSchema,
}).strict();

export const mixedCrushingModeSchema = z.enum(mixedCrushingModes);

export type MixedCrushingCounts = z.infer<typeof mixedCrushingCountsSchema>;
export type MixedCrushingCountInputs = z.infer<typeof mixedCrushingCountInputsSchema>;

export const defaultMixedCrushingCounts: MixedCrushingCounts = {
  medical: 0,
  ammunition: 0,
  military: 0,
};

export type MixedCrushingValidationIssue = 'count' | 'time';
export type MixedCrushingUnitSeconds = Readonly<Record<MixedCrushingTypeKey, number>>;

export function parseMixedCrushingCountInputs(
  value: unknown,
): MixedCrushingCounts | null {
  const stringInputs = mixedCrushingCountInputsSchema.safeParse(value);
  if (!stringInputs.success) return null;

  const counts = Object.fromEntries(
    mixedCrushingTypeKeys.map((key) => [key, Number(stringInputs.data[key])]),
  );
  const parsedCounts = mixedCrushingCountsSchema.safeParse(counts);
  return parsedCounts.success ? parsedCounts.data : null;
}

/** 飛逝秒數依加速比例整數換算成可用基準秒數，保留嚴格整數邊界。 */
export function getMixedCrushingBaseTimeBudget(
  elapsedMinutes: number | null,
  timeReductionPercent: number,
): number {
  if (elapsedMinutes === null) return MIXED_CRUSHING_MAX_BASE_SECONDS;
  if (
    !Number.isSafeInteger(elapsedMinutes)
    || elapsedMinutes < 0
    || !Number.isSafeInteger(timeReductionPercent)
    || timeReductionPercent < 0
    || timeReductionPercent >= 100
  ) return 0;

  const availableActualSeconds = BigInt(elapsedMinutes) * 60n;
  const reductionBasis = BigInt(100 - timeReductionPercent);
  const baseSeconds = availableActualSeconds * 100n / reductionBasis;
  return Math.min(MIXED_CRUSHING_MAX_BASE_SECONDS, Number(baseSeconds));
}

export function getMixedCrushingBaseSeconds(
  counts: MixedCrushingCounts,
  unitSeconds: MixedCrushingUnitSeconds,
): number | null {
  if (!mixedCrushingCountsSchema.safeParse(counts).success) return null;

  let total = 0;
  for (const key of mixedCrushingTypeKeys) {
    const seconds = unitSeconds[key];
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
    total += counts[key] * seconds;
  }
  return Number.isSafeInteger(total) ? total : null;
}

export function validateMixedCrushingCounts(
  counts: unknown,
  baseTimeBudgetSeconds: number,
  unitSeconds: MixedCrushingUnitSeconds,
): MixedCrushingValidationIssue | null {
  const parsedCounts = mixedCrushingCountsSchema.safeParse(counts);
  if (
    !parsedCounts.success
    || !Number.isSafeInteger(baseTimeBudgetSeconds)
    || baseTimeBudgetSeconds < 0
  ) return 'count';

  const totalBaseSeconds = getMixedCrushingBaseSeconds(parsedCounts.data, unitSeconds);
  if (totalBaseSeconds === null) return 'count';
  return totalBaseSeconds <= baseTimeBudgetSeconds ? null : 'time';
}

/** 依其他兩類已輸入秒數計算 range 的即時上限，不會改動其他數量。 */
export function getMixedCrushingDynamicMax(
  counts: MixedCrushingCounts,
  type: MixedCrushingTypeKey,
  baseTimeBudgetSeconds: number,
  unitSeconds: MixedCrushingUnitSeconds,
): number {
  const seconds = unitSeconds[type];
  if (
    !mixedCrushingCountsSchema.safeParse(counts).success
    || !Number.isSafeInteger(baseTimeBudgetSeconds)
    || baseTimeBudgetSeconds < 0
    || !Number.isSafeInteger(seconds)
    || seconds <= 0
  ) return 0;

  const otherBaseSeconds = getMixedCrushingBaseSeconds(
    { ...counts, [type]: 0 },
    unitSeconds,
  );
  if (otherBaseSeconds === null) return 0;

  const available = Math.max(0, baseTimeBudgetSeconds - otherBaseSeconds);
  return Math.min(MIXED_CRUSHING_MAX_COUNT, Math.floor(available / seconds));
}
