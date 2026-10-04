import { z } from 'zod';

import {
  catalogVerificationSchema,
  localizedGameLabelSchema,
} from './catalog.schema';

/** Helper 已有資料字典中的狀態效果 ID；不包含 DOM 解析或通知分組。 */
export const statusEffectIds = [
  'UwU',
  'afkRewardBoost',
  'aiConnect',
  'autoCali1',
  'autoCali2',
  'btcBonus',
  'chatExploitProtect',
  'equipmentExchangeAccess',
  'expBonus',
  'globalParty',
  'leet',
  'love',
  'petDraw',
  'petRevive',
  'pirate',
  'posh',
  'rngInterferer',
  'synapticAccelerationRare',
  'synapticAccelerationSmall',
  'upgradeChance',
  'upgradeChance1',
  'upgradeChance2',
  'upgradeChance3',
  'upgradeChance4',
  'upgradeChance5',
  'upgradeNoBreak',
] as const;
export type StatusEffectId = (typeof statusEffectIds)[number];

export const manualEffectInputIds = ['btc-buff-percent', 'exp-buff-percent'] as const;
export type ManualEffectInputId = (typeof manualEffectInputIds)[number];

const positiveIntegerSchema = z.number().int().positive();
export const MANUAL_EFFECT_PERCENT_MIN = 0 as const;
export const MANUAL_EFFECT_PERCENT_MAX = 100 as const;
export const MANUAL_EFFECT_PERCENT_STEP = 40 as const;
export const manualEffectPercentValues = [0, 40, 80, 100] as const;
export type ManualEffectPercent = (typeof manualEffectPercentValues)[number];

export function isManualEffectPercent(value: number): value is ManualEffectPercent {
  return Number.isSafeInteger(value)
    && manualEffectPercentValues.includes(value as ManualEffectPercent);
}

export const manualEffectPercentageSchema = z
  .number()
  .int()
  .min(MANUAL_EFFECT_PERCENT_MIN)
  .max(MANUAL_EFFECT_PERCENT_MAX)
  .refine(isManualEffectPercent);

export const statusEffectDefinitionSchema = z
  .object({
    id: z.enum(statusEffectIds),
    labels: localizedGameLabelSchema,
    maxDurationSeconds: positiveIntegerSchema,
    sourceKind: z.literal('plugin-observed'),
    verification: catalogVerificationSchema,
  })
  .strict();

export const manualEffectInputSchema = z
  .object({
    id: z.enum(manualEffectInputIds),
    labels: localizedGameLabelSchema,
    kind: z.literal('manual-calculation-assumption'),
    control: z.literal('percentage'),
    unit: z.literal('%'),
    range: z
      .object({
        min: z.literal(MANUAL_EFFECT_PERCENT_MIN),
        max: z.literal(MANUAL_EFFECT_PERCENT_MAX),
        step: z.literal(MANUAL_EFFECT_PERCENT_STEP),
      })
      .strict(),
    /** null 代表沿用工具取得的觀察值，不代表把觀察值寫入共用設定。 */
    defaultValue: manualEffectPercentageSchema.nullable(),
    observedFallbackValue: manualEffectPercentageSchema,
    relatedEffectIds: z.array(z.enum(statusEffectIds)).min(1),
    verification: catalogVerificationSchema,
  })
  .strict()
  .superRefine((input, context) => {
    const effectIds = input.relatedEffectIds;
    if (new Set(effectIds).size !== effectIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['relatedEffectIds'],
        message: '手動計算假設不可重複關聯相同效果 ID',
      });
    }
  });

export const effectsPayloadSchema = z
  .object({
    statusEffects: z.array(statusEffectDefinitionSchema).length(statusEffectIds.length),
    manualInputs: z.array(manualEffectInputSchema).length(manualEffectInputIds.length),
  })
  .strict()
  .superRefine((payload, context) => {
    const statusIds = payload.statusEffects.map((effect) => effect.id);
    const manualIds = payload.manualInputs.map((input) => input.id);
    if (
      new Set(statusIds).size !== statusIds.length ||
      statusEffectIds.some((id) => !statusIds.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['statusEffects'],
        message: '效果目錄必須完整包含已知且不重複的狀態效果 ID',
      });
    }
    if (
      new Set(manualIds).size !== manualIds.length ||
      manualEffectInputIds.some((id) => !manualIds.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['manualInputs'],
        message: '手動計算假設目錄必須完整且不可重複',
      });
    }
  });

export type StatusEffectDefinition = z.infer<typeof statusEffectDefinitionSchema>;
export type ManualEffectInputDefinition = z.infer<typeof manualEffectInputSchema>;
export type EffectsPayload = z.infer<typeof effectsPayloadSchema>;
