import { z } from 'zod';

import {
  economyDataSet,
  marketCacheRateCatalog,
  marketPriceCatalog,
} from '@/data/game/economy';
import { economyCurrencyIds, marketCacheRateIds, marketPriceItemIds } from '@/data/game/economy.schema';
import { manualEffectInputCatalog } from '@/data/game/effects';
import {
  manualEffectInputIds,
  manualEffectPercentageSchema,
} from '@/data/game/effects.schema';
import { progressionLevelCatalog } from '@/data/game/progression';
import { progressionSkillIds } from '@/data/game/progression.schema';
import type { DeepReadonly } from './game-data';
import { storageNamespace } from './storage/storage';

/** Shared User Inputs 的資料結構版本；不與 Game Data dataVersion 共用。 */
export const sharedUserInputsSchemaVersion = 4 as const;

/** Shared User Inputs 的儲存格式版本；不與既有 Tool Storage 版本共用。 */
export const sharedUserInputsStorageVersion = 4 as const;

/** Shared User Inputs 的獨立儲存 key；仍位於 CCO Toolkit reset scope 內。 */
export const sharedUserInputsStorageKey =
  `${storageNamespace}:shared-inputs:v${sharedUserInputsStorageVersion}`;

export const SHARED_CRITICAL_DAMAGE_PERCENT_MIN = 20;
export const SHARED_CRITICAL_DAMAGE_PERCENT_MAX = 220;
export const SHARED_CRITICAL_DAMAGE_PERCENT_DEFAULT = SHARED_CRITICAL_DAMAGE_PERCENT_MIN;
export const SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT = 1;

const finiteNonNegativeNumberSchema = z
  .number()
  .finite()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

const finitePositiveNumberSchema = z
  .number()
  .finite()
  .gt(0)
  .max(Number.MAX_SAFE_INTEGER);

const finiteNonNegativeIntegerSchema = finiteNonNegativeNumberSchema.int();
const finitePositiveIntegerSchema = finitePositiveNumberSchema.int();

const sharedLevelSchema = z
  .number()
  .finite()
  .int()
  .min(0)
  .max(800);

const playerLevelSchema = sharedLevelSchema
  .min(1)
  .max(800);

export const sharedSkillInputSchema = z
  .object({
    id: z.enum(progressionSkillIds),
    level: sharedLevelSchema,
  })
  .strict();

export const sharedPriceInputSchema = z
  .object({
    itemId: z.enum(marketPriceItemIds),
    currencyId: z.enum(economyCurrencyIds),
    amount: finiteNonNegativeNumberSchema,
  })
  .strict();

/** 匯率等正數換算基準；具體 ID 與單位由 Game Data catalog 定義。 */
export const sharedExchangeRateInputSchema = z
  .object({
    id: z.literal('btc-per-ai'),
    value: finitePositiveIntegerSchema,
  })
  .strict();

/** 快取等級等正數換算基準；不把顯示標籤或單位重複存入使用者資料。 */
export const sharedCacheRateInputSchema = z
  .object({
    id: z.enum(marketCacheRateIds),
    value: finitePositiveIntegerSchema,
  })
  .strict();

export const sharedBuffInputSchema = z
  .object({
    id: z.enum(manualEffectInputIds),
    percentage: manualEffectPercentageSchema,
  })
  .strict();

function addDuplicateIdIssues<T extends { id: string }>(
  values: readonly T[],
  context: z.RefinementCtx,
) {
  const firstIndexById = new Map<string, number>();

  values.forEach((value, index) => {
    const firstIndex = firstIndexById.get(value.id);
    if (firstIndex !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [index, 'id'],
      });
      return;
    }

    firstIndexById.set(value.id, index);
  });
}

const sharedSkillsSchema = z
  .array(sharedSkillInputSchema)
  .superRefine(addDuplicateIdIssues);

const sharedPricesSchema = z
  .array(sharedPriceInputSchema)
  .superRefine((values, context) => {
    const firstIndexByItemId = new Map<string, number>();

    values.forEach((value, index) => {
      const firstIndex = firstIndexByItemId.get(value.itemId);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [index, 'itemId'],
        });
        return;
      }

      firstIndexByItemId.set(value.itemId, index);
    });
  });

const sharedExchangeRatesSchema = z
  .array(sharedExchangeRateInputSchema)
  .superRefine(addDuplicateIdIssues);

const sharedCacheRatesSchema = z
  .array(sharedCacheRateInputSchema)
  .superRefine(addDuplicateIdIssues);

const sharedBuffsSchema = z
  .array(sharedBuffInputSchema)
  .superRefine(addDuplicateIdIssues);

export const sharedPlayerInputsSchema = z
  .object({
    level: playerLevelSchema,
  })
  .strict();

export const sharedProgressionInputsSchema = z
  .object({
    player: sharedPlayerInputsSchema,
    skills: sharedSkillsSchema,
  })
  .strict()
  .superRefine((progression, context) => {
    progression.skills.forEach((skill, index) => {
      if (skill.level > progression.player.level) {
        context.addIssue({
          code: 'custom',
          path: ['skills', index, 'level'],
        });
      }
    });
  });

export const sharedEconomyInputsSchema = z
  .object({
    prices: sharedPricesSchema,
    exchangeRates: sharedExchangeRatesSchema,
    cacheRates: sharedCacheRatesSchema,
  })
  .strict();

export const sharedEffectsInputsSchema = z
  .object({
    buffs: sharedBuffsSchema,
  })
  .strict();

/**
 * 可被多個工具沿用的裝備與戰鬥原始輸入。
 *
 * 這裡只保存使用者直接輸入的值；地城敵人等級、副本類型，以及由武器
 * 傷害和爆擊傷害百分比推導出的「實際爆擊傷害」都留在各工具／計算 adapter。
 * 可為零的欄位以 0 表示未設定；正值欄位未設定時則省略，正規化時一律維持 sparse snapshot。
 */
export const sharedEquipmentInputsSchema = z
  .object({
    bargainPercent: finiteNonNegativeIntegerSchema.max(40).optional(),
    maxHealth: finiteNonNegativeIntegerSchema.optional(),
    armor: finiteNonNegativeIntegerSchema.optional(),
    destructiveWeaponDamage: finitePositiveIntegerSchema.optional(),
    criticalDamagePercent: finiteNonNegativeIntegerSchema
      .min(SHARED_CRITICAL_DAMAGE_PERCENT_MIN)
      .max(SHARED_CRITICAL_DAMAGE_PERCENT_MAX)
      .optional(),
    damageReductionPercent: finiteNonNegativeIntegerSchema.max(100).optional(),
  })
  .strict();

/**
 * Shared User Inputs 的 domain schema。
 *
 * 只保存可能被多個工具使用的原始輸入；Tool-specific state 與計算結果
 * 必須留在各自工具或純計算模組，不得塞進這個 schema。
 */
export const sharedUserInputsSchema = z
  .object({
    progression: sharedProgressionInputsSchema,
    economy: sharedEconomyInputsSchema,
    effects: sharedEffectsInputsSchema,
    equipment: sharedEquipmentInputsSchema,
  })
  .strict();

export type SharedSkillInput = z.infer<typeof sharedSkillInputSchema>;
export type SharedPriceInput = z.infer<typeof sharedPriceInputSchema>;
export type SharedExchangeRateInput = z.infer<typeof sharedExchangeRateInputSchema>;
export type SharedCacheRateInput = z.infer<typeof sharedCacheRateInputSchema>;
export type SharedBuffInput = z.infer<typeof sharedBuffInputSchema>;
export type SharedPlayerInputs = z.infer<typeof sharedPlayerInputsSchema>;
export type SharedProgressionInputs = z.infer<typeof sharedProgressionInputsSchema>;
export type SharedEconomyInputs = z.infer<typeof sharedEconomyInputsSchema>;
export type SharedEffectsInputs = z.infer<typeof sharedEffectsInputsSchema>;
export type SharedEquipmentInputs = z.infer<typeof sharedEquipmentInputsSchema>;
export type SharedUserInputs = DeepReadonly<z.infer<typeof sharedUserInputsSchema>>;

/** 獨立的 Shared User Inputs storage envelope；不沿用 Tool Storage envelope。 */
export const sharedUserInputsStorageRecordSchema = z
  .object({
    storageVersion: z.literal(sharedUserInputsStorageVersion),
    schemaVersion: z.literal(sharedUserInputsSchemaVersion),
    value: sharedUserInputsSchema,
  })
  .strict();

export type SharedUserInputsStorageRecord = DeepReadonly<
  z.infer<typeof sharedUserInputsStorageRecordSchema>
>;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return Object.freeze(value) as T;
}

/** 將 schema 解析後的資料深度凍結，供 store 及外部 consumer 安全共享。 */
export function freezeSharedUserInputs(value: SharedUserInputs): SharedUserInputs {
  return deepFreeze(value);
}

function isDefaultManualEffectInput(value: SharedBuffInput): boolean {
  const definition = manualEffectInputCatalog.find((input) => input.id === value.id);
  if (!definition) return false;

  const defaultPercentage = definition.defaultValue ?? definition.observedFallbackValue;
  return value.percentage === defaultPercentage;
}

/**
 * 將完整輸入 canonicalize 成只包含使用者覆寫的 sparse snapshot。
 * `player.level` 是 schema 必填欄位；其餘等於目前 Game Data 預設值的項目會移除。
 */
export function normalizeSharedUserInputs(value: SharedUserInputs): SharedUserInputs {
  const skills = value.progression.skills.filter((skill) => {
    const definition = progressionLevelCatalog.find((item) => item.id === skill.id);
    return !definition || skill.level !== definition.defaultValue;
  });
  const prices = value.economy.prices.filter((price) => {
    const definition = marketPriceCatalog.find((item) => item.itemId === price.itemId);
    return !definition
      || price.currencyId !== definition.defaultBasisCurrencyId
      || price.amount !== definition.defaultBasisValue;
  });
  const exchangeRates = value.economy.exchangeRates.filter((rate) => {
    const definition = economyDataSet.payload.exchangeRates.find((item) => item.id === rate.id);
    return !definition || rate.value !== definition.defaultValue;
  });
  const cacheRates = value.economy.cacheRates.filter((rate) => {
    const definition = marketCacheRateCatalog.find((item) => item.id === rate.id);
    return !definition || rate.value !== definition.defaultValue;
  });
  const buffs = value.effects.buffs.filter((buff) => !isDefaultManualEffectInput(buff));
  const equipment = Object.fromEntries(
    Object.entries(value.equipment).filter(
      ([key, currentValue]) => currentValue !== undefined &&
        currentValue !== 0 &&
        !(
          (key === 'criticalDamagePercent' &&
            currentValue === SHARED_CRITICAL_DAMAGE_PERCENT_DEFAULT) ||
          (key === 'destructiveWeaponDamage' &&
            currentValue === SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT)
        ),
    ),
  ) as SharedEquipmentInputs;

  return freezeSharedUserInputs({
    progression: {
      player: { level: value.progression.player.level },
      skills,
    },
    economy: {
      prices,
      exchangeRates,
      cacheRates,
    },
    effects: {
      buffs,
    },
    equipment,
  });
}

/** 安全解析 Shared User Inputs；失敗時回傳 undefined，不拋出 runtime exception。 */
export function parseSharedUserInputs(value: unknown): SharedUserInputs | undefined {
  const result = sharedUserInputsSchema.safeParse(value);
  return result.success ? normalizeSharedUserInputs(result.data) : undefined;
}

/** 以最小可用狀態作為 storage 損壞、不可用或未支援版本時的安全預設值。 */
export const defaultSharedUserInputs = freezeSharedUserInputs(
  sharedUserInputsSchema.parse({
    progression: {
      player: { level: 1 },
      skills: [],
    },
    economy: {
      prices: [],
      exchangeRates: [],
      cacheRates: [],
    },
    effects: {
      buffs: [],
    },
    equipment: {},
  }),
);
