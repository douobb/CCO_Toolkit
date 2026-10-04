import { z } from 'zod';

import {
  catalogVerificationSchema,
  localizedGameLabelSchema,
} from './catalog.schema';

/** 黑市快取品質的穩定 ID；與 economy 的 cache rate ID 保持一致。 */
export const blackMarketQualityIds = [
  'trash',
  'common',
  'high-quality',
  'rare',
] as const;
export type BlackMarketQualityId = (typeof blackMarketQualityIds)[number];

/** 黑市公式 ID 只描述要使用的公式，不把計算程式碼塞進資料檔。 */
export const blackMarketFormulaIds = [
  'printing-level-cache-sale',
] as const;
export type BlackMarketFormulaId = (typeof blackMarketFormulaIds)[number];

const positiveFiniteSchema = z.number().finite().positive();
const finiteSchema = z.number().finite();
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
        message: '黑市等級範圍上限不可小於下限',
      });
    }
  });

export const blackMarketQualitySchema = z
  .object({
    id: z.enum(blackMarketQualityIds),
    labels: localizedGameLabelSchema,
    saleMultiplier: positiveFiniteSchema,
    verification: catalogVerificationSchema,
  })
  .strict();

export const blackMarketSaleFormulaSchema = z
  .object({
    formulaId: z.literal('printing-level-cache-sale'),
    levelMultiplier: positiveFiniteSchema,
    levelOffset: finiteSchema,
    rounding: z.literal('ceil'),
  })
  .strict();

export const blackMarketPayloadSchema = z
  .object({
    qualities: z.array(blackMarketQualitySchema).length(blackMarketQualityIds.length),
    levelRange: levelRangeSchema,
    saleFormula: blackMarketSaleFormulaSchema,
    resultDecimalPlaces: z.number().int().min(0).max(6),
  })
  .strict()
  .superRefine((payload, context) => {
    const qualityIds = payload.qualities.map((quality) => quality.id);
    if (
      new Set(qualityIds).size !== qualityIds.length ||
      blackMarketQualityIds.some((id) => !qualityIds.includes(id))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['qualities'],
        message: '黑市品質目錄必須完整包含已知且不重複的穩定 ID',
      });
    }
  });

export type BlackMarketQualityDefinition = z.infer<typeof blackMarketQualitySchema>;
export type BlackMarketSaleFormula = z.infer<typeof blackMarketSaleFormulaSchema>;
export type BlackMarketPayload = z.infer<typeof blackMarketPayloadSchema>;
