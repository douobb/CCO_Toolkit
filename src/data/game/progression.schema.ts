import { z } from 'zod';

import {
  catalogVerificationSchema,
  localizedGameLabelSchema,
} from './catalog.schema';

export { catalogVerificationSchema, localizedGameLabelSchema } from './catalog.schema';
export type { CatalogVerification } from './catalog.schema';

/** 供玩家設定及純計算模組共用的五種技能等級穩定 ID。 */
export const progressionSkillIds = [
  'printing-rank',
  'medical-science',
  'ammo-crafting',
  'scavenge-skill',
  'mining-skill',
] as const;
export type ProgressionSkillId = (typeof progressionSkillIds)[number];

/** 供玩家設定及純計算模組共用的六種等級穩定 ID。 */
export const progressionLevelIds = ['level', ...progressionSkillIds] as const;
export type ProgressionLevelId = (typeof progressionLevelIds)[number];

export const progressionMethodIds = [
  'ai',
  'black-market',
  'printing-job',
  'reverse-engineering',
  'medical-scrap',
  'medical-job',
  'energy-cell',
  'anti-matter-charge',
  'ammo-job',
  'scavenge',
  'mining',
  'ai-crafting',
] as const;
export type ProgressionMethodId = (typeof progressionMethodIds)[number];

export const progressionFormulaIds = [
  'level-ai',
  'printing-black-market',
  'printing-job',
  'printing-reverse-engineering',
  'medical-scrap',
  'medical-job',
  'ammo-energy-cell',
  'ammo-anti-matter-charge',
  'ammo-job',
  'scavenge',
  'mining',
  'mining-ai-crafting',
] as const;
export type ProgressionFormulaId = (typeof progressionFormulaIds)[number];

export const progressionResourceIds = [
  'ai',
  'cache',
  'tech-scrap',
  'medical-tech-parts',
  'ammunition-tech-parts',
  'military-ammunition-tech-parts',
  'hash',
] as const;
export type ProgressionResourceId = (typeof progressionResourceIds)[number];

const positiveIntegerSchema = z.number().int().positive();
const levelRangeSchema = z
  .object({
    min: positiveIntegerSchema,
    max: positiveIntegerSchema,
    step: z.literal(1),
  })
  .strict()
  .superRefine((range, context) => {
    if (range.max < range.min) {
      context.addIssue({
        code: 'custom',
        path: ['max'],
        message: '等級範圍上限不可小於下限',
      });
    }
  });

export const progressionLevelDefinitionSchema = z
  .object({
    id: z.enum(progressionLevelIds),
    kind: z.enum(['player-level', 'skill-level']),
    labels: localizedGameLabelSchema,
    range: levelRangeSchema,
    defaultValue: positiveIntegerSchema,
    control: z.literal('integer'),
    verification: catalogVerificationSchema,
  })
  .strict()
  .superRefine((definition, context) => {
    if (
      definition.defaultValue < definition.range.min ||
      definition.defaultValue > definition.range.max
    ) {
      context.addIssue({
        code: 'custom',
        path: ['defaultValue'],
        message: '預設等級必須落在有效範圍內',
      });
    }
  });

const positiveFiniteSchema = z.number().finite().positive();

export const progressionResourceSchema = z
  .object({
    id: z.enum(progressionResourceIds),
    perUnit: positiveFiniteSchema,
  })
  .strict();

export const progressionMethodSchema = z
  .object({
    id: z.enum(progressionMethodIds),
    formulaId: z.enum(progressionFormulaIds),
    batchSize: positiveIntegerSchema,
    unitMinutes: positiveFiniteSchema.nullable(),
    resourceRecovery: positiveFiniteSchema.max(1).default(1),
    resources: z.array(progressionResourceSchema),
    verification: catalogVerificationSchema,
  })
  .strict()
  .superRefine((method, context) => {
    const resourceIds = method.resources.map((resource) => resource.id);
    if (new Set(resourceIds).size !== resourceIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['resources'],
        message: '同一等級方法不可重複使用相同資源 ID',
      });
    }
  });

const progressionMethodsSchema = z.record(z.string(), z.array(progressionMethodSchema));

export const progressionPayloadSchema = z
  .object({
    levels: z.array(progressionLevelDefinitionSchema).length(progressionLevelIds.length),
    methods: progressionMethodsSchema,
  })
  .strict()
  .superRefine((payload, context) => {
    const levelIds = payload.levels.map((level) => level.id);
    if (
      new Set(levelIds).size !== levelIds.length ||
      levelIds.some((id) => !progressionLevelIds.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['levels'],
        message: '等級目錄必須包含六個不重複的穩定 ID',
      });
    }

    const actualTypeIds = Object.keys(payload.methods);
    if (
      actualTypeIds.length !== progressionLevelIds.length ||
      progressionLevelIds.some((id) => !actualTypeIds.includes(id)) ||
      actualTypeIds.some((id) => !progressionLevelIds.includes(id as ProgressionLevelId))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['methods'],
        message: '等級方法必須為六個已知等級各自提供資料',
      });
    }

    const methods = Object.values(payload.methods).flat();
    const methodIds = methods.map((method) => method.id);
    const formulaIds = methods.map((method) => method.formulaId);
    if (
      new Set(methodIds).size !== methodIds.length ||
      new Set(formulaIds).size !== formulaIds.length ||
      methodIds.length !== progressionMethodIds.length ||
      formulaIds.length !== progressionFormulaIds.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['methods'],
        message: '等級方法與公式 ID 必須完整且不可重複',
      });
    }
  });

export type ProgressionLevelDefinition = z.infer<typeof progressionLevelDefinitionSchema>;
export type ProgressionResourceDefinition = z.infer<typeof progressionResourceSchema>;
export type ProgressionMethodDefinition = z.infer<typeof progressionMethodSchema>;
export type ProgressionPayload = z.infer<typeof progressionPayloadSchema>;
