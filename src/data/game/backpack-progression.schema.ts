import { z } from 'zod';

import {
  catalogVerificationSchema,
  localizedGameLabelSchema,
} from './catalog.schema';

/** 目前背包升級鏈上的穩定 ID；資料格式本身允許未來新增階段。 */
export const backpackTierIds = [
  'old-pouch',
  'fanny-pack',
  'explorer-backpack',
  'employee-office-case',
  'autonomous-storage-unit',
  'quantum-storage-unit',
] as const;
export type BackpackTierId = (typeof backpackTierIds)[number];

/** 背包規劃目前可換算為科技碎片等值的物資 ID。 */
export const backpackMaterialIds = [
  'tech-scrap',
  'tech-scrap-cluster',
  'medical-tech-parts',
  'medical-tech-cluster',
  'military-ammunition-tech-parts',
  'military-ammunition-tech-parts-cluster',
  'ammunition-tech-parts',
  'ammunition-tech-parts-cluster',
] as const;
export type BackpackMaterialId = (typeof backpackMaterialIds)[number];

const stableIdentifierSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, '穩定 ID 只能使用小寫英數字與連字號');
const positiveIntegerSchema = z.number().int().positive();
const positiveFiniteSchema = z.number().finite().positive();

/** 使用陣列表達需求，保留未來一個階段需要多種物資的擴充空間。 */
export const backpackRequirementSchema = z
  .object({
    itemId: stableIdentifierSchema,
    quantity: positiveIntegerSchema,
  })
  .strict();

export const backpackTierSchema = z
  .object({
    id: stableIdentifierSchema,
    labels: localizedGameLabelSchema,
    requirements: z.array(backpackRequirementSchema).min(1),
    verification: catalogVerificationSchema,
  })
  .strict()
  .superRefine((tier, context) => {
    const itemIds = tier.requirements.map((requirement) => requirement.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['requirements'],
        message: '同一背包階段不可重複指定相同需求物資',
      });
    }
  });

export const backpackMaterialSchema = z
  .object({
    id: stableIdentifierSchema,
    labels: localizedGameLabelSchema,
    techScrapEquivalent: positiveFiniteSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const backpackProgressionPayloadSchema = z
  .object({
    tiers: z.array(backpackTierSchema).min(1),
    materials: z.array(backpackMaterialSchema).min(1),
  })
  .strict()
  .superRefine((payload, context) => {
    const tierIds = payload.tiers.map((tier) => tier.id);
    const materialIds = payload.materials.map((material) => material.id);
    const allItemIds = [...tierIds, ...materialIds];

    if (new Set(tierIds).size !== tierIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: '背包階段 ID 不可重複',
      });
    }
    if (new Set(materialIds).size !== materialIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['materials'],
        message: '背包物資 ID 不可重複',
      });
    }
    if (new Set(allItemIds).size !== allItemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['materials'],
        message: '背包階段與物資不可共用相同 ID',
      });
    }

    payload.tiers.forEach((tier, tierIndex) => {
      tier.requirements.forEach((requirement, requirementIndex) => {
        if (!allItemIds.includes(requirement.itemId)) {
          context.addIssue({
            code: 'custom',
            path: ['tiers', tierIndex, 'requirements', requirementIndex, 'itemId'],
            message: `背包需求物資 ID 未在階段或物資目錄中定義：${requirement.itemId}`,
          });
        }
      });
    });
  });

export type BackpackRequirement = z.infer<typeof backpackRequirementSchema>;
export type BackpackTierDefinition = z.infer<typeof backpackTierSchema>;
export type BackpackMaterialDefinition = z.infer<typeof backpackMaterialSchema>;
export type BackpackProgressionPayload = z.infer<typeof backpackProgressionPayloadSchema>;
