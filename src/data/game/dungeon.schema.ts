import { z } from 'zod';

export const dungeonPrefixIds = [
  'x',
  'angry',
  'tough',
  'shielded',
  'agile',
  'mad',
  'crit',
  'berserker',
] as const;
export type DungeonPrefixId = (typeof dungeonPrefixIds)[number];

export const dungeonSummaryPrefixIds = [
  'angry',
  'tough',
  'shielded',
  'agile',
  'mad',
  'crit',
  'berserker',
] as const;
export type DungeonSummaryPrefixId = (typeof dungeonSummaryPrefixIds)[number];

export const dungeonEnemyKindIds = ['small', 'boss'] as const;
export type DungeonEnemyKindId = (typeof dungeonEnemyKindIds)[number];

export const dungeonInvasionTierIds = ['base', 'level100', 'level500'] as const;
export type DungeonInvasionTierId = (typeof dungeonInvasionTierIds)[number];

export const dungeonBaseStatIds = ['hp', 'shield', 'attack', 'experience', 'btc'] as const;
export type DungeonBaseStatId = (typeof dungeonBaseStatIds)[number];

const finiteNumberSchema = z.number().finite();
const positiveFiniteSchema = finiteNumberSchema.positive();
const nonNegativeIntegerSchema = z.number().int().min(0);
const positiveIntegerSchema = z.number().int().positive();

const dungeonLevelRangeSchema = z
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
        message: '地城等級範圍上限不可小於下限',
      });
    }
  });

const dungeonBaseFormulaSchema = z
  .object({
    power: positiveFiniteSchema,
    base: finiteNumberSchema.min(0),
    multiplier: positiveFiniteSchema,
  })
  .strict();

const dungeonRulesSchema = z
  .object({
    minimumRandomMultiplier: positiveFiniteSchema,
    maximumRandomMultiplier: positiveFiniteSchema,
    attackMaximumMultiplier: positiveFiniteSchema,
    critMaximumMultiplier: positiveFiniteSchema,
    normalExperienceExtraMultiplier: positiveFiniteSchema,
    invasionExperienceExtraMultiplier: positiveFiniteSchema,
    destructiveWeaponEffectiveMultiplier: positiveFiniteSchema.max(1),
    critProbabilityFactor: positiveFiniteSchema,
    safetyRoomEnemyOffset: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((rules, context) => {
    if (rules.maximumRandomMultiplier < rules.minimumRandomMultiplier) {
      context.addIssue({
        code: 'custom',
        path: ['maximumRandomMultiplier'],
        message: '隨機倍率上限不可小於下限',
      });
    }
  });

const dungeonPrefixModifierSchema = z
  .object({
    hp: finiteNumberSchema,
    shield: finiteNumberSchema,
    attack: finiteNumberSchema,
    experience: positiveFiniteSchema,
    btc: positiveFiniteSchema,
    damageMultiplier: positiveFiniteSchema,
  })
  .strict();

const dungeonEnemyTypeModifierSchema = z
  .object({
    hp: finiteNumberSchema,
    shield: finiteNumberSchema,
    attack: finiteNumberSchema,
    experience: positiveFiniteSchema,
    btc: positiveFiniteSchema,
  })
  .strict();

const dungeonEnemyModifierTableSchema = z
  .object({
    small: dungeonEnemyTypeModifierSchema,
    boss: dungeonEnemyTypeModifierSchema,
  })
  .strict();

const prefixModifierShape = {
  x: dungeonPrefixModifierSchema,
  angry: dungeonPrefixModifierSchema,
  tough: dungeonPrefixModifierSchema,
  shielded: dungeonPrefixModifierSchema,
  agile: dungeonPrefixModifierSchema,
  mad: dungeonPrefixModifierSchema,
  crit: dungeonPrefixModifierSchema,
  berserker: dungeonPrefixModifierSchema,
} as const;

const dungeonInvasionTierSchema = z
  .object({
    id: z.enum(dungeonInvasionTierIds),
    levelRange: dungeonLevelRangeSchema,
    small: dungeonEnemyTypeModifierSchema,
    boss: dungeonEnemyTypeModifierSchema,
  })
  .strict();

export const dungeonPayloadSchema = z
  .object({
    levelRange: dungeonLevelRangeSchema,
    rounding: z.literal('ceil'),
    rules: dungeonRulesSchema,
    baseFormulas: z
      .object({
        hp: dungeonBaseFormulaSchema,
        shield: dungeonBaseFormulaSchema,
        attack: dungeonBaseFormulaSchema,
        experience: dungeonBaseFormulaSchema,
        btc: dungeonBaseFormulaSchema,
      })
      .strict(),
    prefixes: z.array(z.enum(dungeonPrefixIds)).length(dungeonPrefixIds.length),
    summaryPrefixes: z
      .array(z.enum(dungeonPrefixIds))
      .length(dungeonSummaryPrefixIds.length),
    prefixModifiers: z.object(prefixModifierShape).strict(),
    enemyTypeModifiers: z
      .object({
        normal: dungeonEnemyModifierTableSchema,
        invasion: z
          .object({
            tiers: z.array(dungeonInvasionTierSchema).length(dungeonInvasionTierIds.length),
          })
          .strict(),
      })
      .strict(),
    roomOffsets: z.array(nonNegativeIntegerSchema.max(9)).min(1),
  })
  .strict()
  .superRefine((payload, context) => {
    const prefixIds = payload.prefixes;
    if (
      new Set(prefixIds).size !== prefixIds.length ||
      dungeonPrefixIds.some((id) => !prefixIds.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['prefixes'],
        message: '地城前綴目錄必須完整包含不重複的穩定 ID',
      });
    }

    const summaryPrefixIds = payload.summaryPrefixes;
    if (
      new Set(summaryPrefixIds).size !== summaryPrefixIds.length ||
      dungeonSummaryPrefixIds.some((id) => !summaryPrefixIds.includes(id)) ||
      summaryPrefixIds.includes('x')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['summaryPrefixes'],
        message: '地城摘要前綴必須完整包含不重複且不含 X 的穩定 ID',
      });
    }

    const roomOffsets = payload.roomOffsets;
    if (new Set(roomOffsets).size !== roomOffsets.length) {
      context.addIssue({
        code: 'custom',
        path: ['roomOffsets'],
        message: '地城房間尾數不可重複',
      });
    }

    const tiers = [...payload.enemyTypeModifiers.invasion.tiers].sort(
      (left, right) => left.levelRange.min - right.levelRange.min,
    );
    const tierIds = tiers.map((tier) => tier.id);
    if (
      new Set(tierIds).size !== tierIds.length ||
      dungeonInvasionTierIds.some((id) => !tierIds.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['enemyTypeModifiers', 'invasion', 'tiers'],
        message: '入侵地城等級區段必須完整包含不重複的穩定 ID',
      });
    }

    if (tiers[0]?.levelRange.min !== payload.levelRange.min) {
      context.addIssue({
        code: 'custom',
        path: ['enemyTypeModifiers', 'invasion', 'tiers'],
        message: '入侵地城等級區段必須從資料集下限開始',
      });
    }
    tiers.forEach((tier, index) => {
      const previous = tiers[index - 1];
      if (previous && tier.levelRange.min !== previous.levelRange.max + 1) {
        context.addIssue({
          code: 'custom',
          path: ['enemyTypeModifiers', 'invasion', 'tiers', index, 'levelRange'],
          message: '入侵地城等級區段不可有重疊或缺口',
        });
      }
    });
    if (tiers.at(-1)?.levelRange.max !== payload.levelRange.max) {
      context.addIssue({
        code: 'custom',
        path: ['enemyTypeModifiers', 'invasion', 'tiers'],
        message: '入侵地城等級區段必須涵蓋到資料集上限',
      });
    }
  });

export type DungeonBaseFormula = z.infer<typeof dungeonBaseFormulaSchema>;
export type DungeonRules = z.infer<typeof dungeonRulesSchema>;
export type DungeonPrefixModifier = z.infer<typeof dungeonPrefixModifierSchema>;
export type DungeonEnemyTypeModifier = z.infer<typeof dungeonEnemyTypeModifierSchema>;
export type DungeonEnemyModifierTable = z.infer<typeof dungeonEnemyModifierTableSchema>;
export type DungeonInvasionTier = z.infer<typeof dungeonInvasionTierSchema>;
export type DungeonPayload = z.infer<typeof dungeonPayloadSchema>;
