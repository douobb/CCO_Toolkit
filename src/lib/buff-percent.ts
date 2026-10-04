import {
  MANUAL_EFFECT_PERCENT_MAX,
  MANUAL_EFFECT_PERCENT_MIN,
  MANUAL_EFFECT_PERCENT_STEP,
  manualEffectPercentValues,
  type ManualEffectPercent,
} from '@/data/game/effects.schema';

/** 真正 Buff 可用的離散百分比；裝備百分比不使用這組規則。 */
export const BUFF_PERCENT_VALUES = manualEffectPercentValues;
export const BUFF_PERCENT_MIN = MANUAL_EFFECT_PERCENT_MIN;
export const BUFF_PERCENT_MAX = MANUAL_EFFECT_PERCENT_MAX;
export const BUFF_PERCENT_STEP = MANUAL_EFFECT_PERCENT_STEP;
export const BUFF_PERCENT_DEFAULT = BUFF_PERCENT_MAX;
export const BUFF_PERCENT_DEFAULT_STRING = String(BUFF_PERCENT_DEFAULT);
export type BuffPercent = ManualEffectPercent;

export function isBuffPercent(value: unknown): value is BuffPercent {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && BUFF_PERCENT_VALUES.includes(value as BuffPercent);
}

/** 只接受目前離散格，供表單／計算驗證使用。 */
export function parseBuffPercent(value: string): BuffPercent | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return isBuffPercent(parsed) ? parsed : null;
}

/**
 * 將舊版 0–100 整數轉成目前的離散格。
 * 只供 storage/tool-state migration 使用；新輸入仍由 parseBuffPercent 嚴格驗證。
 */
export function normalizeLegacyBuffPercent(value: unknown): BuffPercent | undefined {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < BUFF_PERCENT_MIN || parsed > BUFF_PERCENT_MAX) {
    return undefined;
  }

  return BUFF_PERCENT_VALUES.reduce((closest, candidate) => {
    const currentDistance = Math.abs(closest - parsed);
    const candidateDistance = Math.abs(candidate - parsed);
    return candidateDistance <= currentDistance ? candidate : closest;
  }, BUFF_PERCENT_VALUES[0]);
}

export function normalizeLegacyBuffPercentString(value: unknown): string | undefined {
  const normalized = normalizeLegacyBuffPercent(value);
  return normalized === undefined ? undefined : String(normalized);
}
