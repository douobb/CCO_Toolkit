import { z } from 'zod';

import {
  catalogVerificationSchema,
  localizedGameLabelSchema,
} from './catalog.schema';

/** 箱子類型穩定 ID；新增箱子時可擴充資料與必要的計算 adapter。 */
export const lootBoxIds = ['white', 'yellow', 'purple'] as const;
export type LootBoxId = (typeof lootBoxIds)[number];

export const lootBoxRarityIds = ['yellow', 'purple', 'red'] as const;
export type LootBoxRarityId = (typeof lootBoxRarityIds)[number];

const stableIdentifierSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, '穩定 ID 只能使用小寫英數字與連字號');
const positiveIntegerSchema = z.number().int().positive();
const positiveFiniteSchema = z.number().finite().positive();

const itemEntrySchema = z
  .object({
    id: stableIdentifierSchema,
    itemId: stableIdentifierSchema,
    quantity: positiveFiniteSchema,
    weight: positiveFiniteSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

const equipmentEntrySchema = z
  .object({
    id: stableIdentifierSchema,
    category: z.literal('equipment'),
    rarity: z.enum(lootBoxRarityIds),
    quantity: positiveFiniteSchema,
    weight: positiveFiniteSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const lootBoxEntrySchema = z.union([itemEntrySchema, equipmentEntrySchema]);

export const lootBoxDefinitionSchema = z
  .object({
    id: z.enum(lootBoxIds),
    labels: localizedGameLabelSchema,
    batchSize: positiveIntegerSchema,
    containerItemId: stableIdentifierSchema,
    techScrapCost: positiveIntegerSchema,
    entries: z.array(lootBoxEntrySchema).min(1),
    verification: catalogVerificationSchema,
  })
  .strict()
  .superRefine((box, context) => {
    const entryIds = box.entries.map((entry) => entry.id);
    if (new Set(entryIds).size !== entryIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['entries'],
        message: '同一箱子的掉落 entry ID 不可重複',
      });
    }
    if (box.entries.reduce((sum, entry) => sum + entry.weight, 0) <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['entries'],
        message: '箱子掉落權重總和必須大於 0',
      });
    }
  });

export const lootBoxesPayloadSchema = z
  .object({
    /** 來源掉落表版本，不取代 Toolkit envelope 的 dataVersion。 */
    sourceTableVersion: z.string().trim().min(1).max(40),
    boxes: z.array(lootBoxDefinitionSchema).length(lootBoxIds.length),
  })
  .strict()
  .superRefine((payload, context) => {
    const ids = payload.boxes.map((box) => box.id);
    if (
      new Set(ids).size !== ids.length
      || lootBoxIds.some((id) => !ids.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['boxes'],
        message: '箱子目錄必須完整包含不重複的穩定 ID',
      });
    }
  });

export type LootBoxEntry = z.infer<typeof lootBoxEntrySchema>;
export type LootBoxDefinition = z.infer<typeof lootBoxDefinitionSchema>;
export type LootBoxesPayload = z.infer<typeof lootBoxesPayloadSchema>;
