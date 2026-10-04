import { z } from 'zod';

import {
  catalogVerificationSchema,
  localizedGameLabelSchema,
} from './catalog.schema';
import { blackMarketQualityIds } from './black-market.schema';

/** 目前已整理的活動穩定 ID；新增同類活動時只需擴充資料與必要的計算 adapter。 */
export const earningsActivityIds = [
  'search',
  'black-market-trash',
  'black-market-common',
  'black-market-high-quality',
  'black-market-rare',
  'mining',
  'ai-crafting',
  'white-box',
  'yellow-box',
  'crush-medical',
  'crush-ammunition',
  'crush-military-ammunition',
  'pack-old-pouch',
  'pack-fanny-pack',
  'pack-explorer-backpack',
  'pack-employee-office-case',
] as const;
export type EarningsActivityId = (typeof earningsActivityIds)[number];

export const earningsActivityKindIds = [
  'search',
  'black-market',
  'mining',
  'ai-crafting',
  'loot-box',
  'crush',
  'pack',
] as const;
export type EarningsActivityKind = (typeof earningsActivityKindIds)[number];

const stableIdentifierSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, '穩定 ID 只能使用小寫英數字與連字號');
const positiveIntegerSchema = z.number().int().positive();
const positiveFiniteSchema = z.number().finite().positive();

const activityBaseShape = {
  id: stableIdentifierSchema,
  labels: localizedGameLabelSchema,
  batchSize: positiveIntegerSchema,
  /** 一個操作單位的基準秒數；不包含任何工具或玩家的減時假設。 */
  baseUnitSeconds: positiveFiniteSchema,
  verification: catalogVerificationSchema,
} as const;

const searchActivitySchema = z
  .object({ ...activityBaseShape, kind: z.literal('search') })
  .strict();

const blackMarketActivitySchema = z
  .object({
    ...activityBaseShape,
    kind: z.literal('black-market'),
    quality: z.enum(blackMarketQualityIds),
  })
  .strict();

const miningActivitySchema = z
  .object({ ...activityBaseShape, kind: z.literal('mining') })
  .strict();

const aiCraftingActivitySchema = z
  .object({ ...activityBaseShape, kind: z.literal('ai-crafting') })
  .strict();

const lootBoxActivitySchema = z
  .object({
    ...activityBaseShape,
    kind: z.literal('loot-box'),
    boxType: z.enum(['white', 'yellow']),
  })
  .strict();

const conversionActivitySchema = z
  .object({
    ...activityBaseShape,
    kind: z.enum(['crush', 'pack']),
    inputItemId: stableIdentifierSchema,
    inputQuantity: positiveFiniteSchema,
    outputItemId: stableIdentifierSchema,
    outputQuantity: positiveFiniteSchema,
  })
  .strict();

/** 活動資料的 payload schema；依 kind 驗證必要欄位，但不限制未來只能有目前 16 筆。 */
export const earningsActivityDefinitionSchema = z.union([
  searchActivitySchema,
  blackMarketActivitySchema,
  miningActivitySchema,
  aiCraftingActivitySchema,
  lootBoxActivitySchema,
  conversionActivitySchema,
]);

export const earningsActivitiesPayloadSchema = z
  .object({
    activities: z.array(earningsActivityDefinitionSchema).min(1),
  })
  .strict()
  .superRefine((payload, context) => {
    const firstIndexById = new Map<string, number>();

    payload.activities.forEach((activity, index) => {
      const firstIndex = firstIndexById.get(activity.id);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['activities', index, 'id'],
          message: `活動 ID ${activity.id} 重複（已出現在第 ${firstIndex + 1} 筆）`,
        });
        return;
      }
      firstIndexById.set(activity.id, index);
    });
  });

export type EarningsActivityDefinition = z.infer<typeof earningsActivityDefinitionSchema>;
export type EarningsActivitiesPayload = z.infer<typeof earningsActivitiesPayloadSchema>;
