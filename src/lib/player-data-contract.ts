import { z } from 'zod';

import {
  backpackMaterialIds,
  backpackTierIds,
} from '@/data/game/backpack-progression.schema';
import {
  getLootBoxDropIdsForBox,
  lootBoxDropIds,
} from '@/data/game/loot-box-drops';
import {
  getLootBoxDefinition,
  lootBoxIds,
} from '@/data/game/loot-boxes';
import { progressionLevelIds } from '@/data/game/progression.schema';

/** 玩家資料交換格式的固定識別字；不等同任何內部 storage key。 */
export const playerDataFormat = 'cco-player-data' as const;
export const playerDataFormatVersion = 1 as const;

export const playerDataSectionIds = [
  'progression',
  'player-attributes',
  'inventory',
  'loot-box-history',
] as const;
export type PlayerDataSectionId = (typeof playerDataSectionIds)[number];

export const playerDataAttributeIds = [
  'max-health',
  'armor',
  'destructive-weapon-damage',
  'critical-damage-percent',
  'bargain-percent',
  'damage-reduction-percent',
] as const;
export type PlayerDataAttributeId = (typeof playerDataAttributeIds)[number];

/** 第一版 inventory 目錄只包含目前網站正式保存的背包與升級物資。 */
export const playerDataInventoryItemIds = [
  ...backpackTierIds,
  ...backpackMaterialIds,
] as const;
export type PlayerDataInventoryItemId = (typeof playerDataInventoryItemIds)[number];

export const playerDataContractLimits = Object.freeze({
  maxSections: 32,
  maxLevels: 128,
  maxAttributes: 128,
  maxInventoryItems: 10_000,
  maxLootBoxRecords: 2_000,
  maxLootBoxRollups: 256,
  maxDropsPerLootBoxEntry: 64,
  maxPortableIdLength: 128,
  maxProducerFieldLength: 64,
  maxFileBytes: 5 * 1024 * 1024,
});

const safeNonNegativeIntegerSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
const safePositiveIntegerSchema = safeNonNegativeIntegerSchema.min(1);
const stableIdentifierSchema = z
  .string()
  .min(1)
  .max(playerDataContractLimits.maxPortableIdLength)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const portableRecordIdSchema = z
  .string()
  .min(1)
  .max(playerDataContractLimits.maxPortableIdLength)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const isoDateTimeSchema = z.iso.datetime({ offset: true });

function addDuplicateIssues<T>(
  values: readonly T[],
  getId: (value: T) => string,
  pathPrefix: readonly (string | number)[],
  pathKey: string,
  context: z.RefinementCtx,
) {
  const firstIndexById = new Map<string, number>();

  values.forEach((value, index) => {
    const id = getId(value);
    if (firstIndexById.has(id)) {
      context.addIssue({
        code: 'custom',
        path: [...pathPrefix, index, pathKey],
        message: `ID 不可重複：${id}`,
      });
      return;
    }
    firstIndexById.set(id, index);
  });
}

const progressionLevelValueSchema = z
  .object({
    id: z.enum(progressionLevelIds),
    value: safePositiveIntegerSchema.max(800),
  })
  .strict();

const progressionDataV1Schema = z
  .object({
    levels: z
      .array(progressionLevelValueSchema)
      .min(1)
      .max(playerDataContractLimits.maxLevels),
  })
  .strict()
  .superRefine((data, context) => {
    addDuplicateIssues(data.levels, (level) => level.id, ['levels'], 'id', context);

    const playerLevel = data.levels.find((level) => level.id === 'level')?.value;
    if (playerLevel === undefined) return;

    data.levels.forEach((level, index) => {
      if (level.id !== 'level' && level.value > playerLevel) {
        context.addIssue({
          code: 'custom',
          path: ['levels', index, 'value'],
          message: '技能等級不可超過玩家主等級',
        });
      }
    });
  });

const attributeValueSchemas = {
  'max-health': safeNonNegativeIntegerSchema,
  armor: safeNonNegativeIntegerSchema,
  'destructive-weapon-damage': safePositiveIntegerSchema,
  'critical-damage-percent': safeNonNegativeIntegerSchema.min(20).max(220),
  'bargain-percent': safeNonNegativeIntegerSchema.max(40),
  'damage-reduction-percent': safeNonNegativeIntegerSchema.max(100),
} satisfies Record<PlayerDataAttributeId, z.ZodType<number>>;

const playerAttributeValueSchema = z
  .object({
    id: z.enum(playerDataAttributeIds),
    value: safeNonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((attribute, context) => {
    const schema = attributeValueSchemas[attribute.id];
    if (!schema.safeParse(attribute.value).success) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: `玩家屬性 ${attribute.id} 超出允許範圍`,
      });
    }
  });

const playerAttributesDataV1Schema = z
  .object({
    values: z
      .array(playerAttributeValueSchema)
      .max(playerDataContractLimits.maxAttributes),
  })
  .strict()
  .superRefine((data, context) => {
    addDuplicateIssues(data.values, (attribute) => attribute.id, ['values'], 'id', context);
  });

const inventoryItemSchema = z
  .object({
    itemId: z.enum(playerDataInventoryItemIds),
    quantity: safeNonNegativeIntegerSchema,
  })
  .strict();

const inventoryDataV1Schema = z
  .object({
    completeness: z.enum(['complete', 'partial', 'manual']),
    items: z
      .array(inventoryItemSchema)
      .max(playerDataContractLimits.maxInventoryItems),
  })
  .strict()
  .superRefine((data, context) => {
    addDuplicateIssues(data.items, (item) => item.itemId, ['items'], 'itemId', context);
  });

const lootBoxDropSchema = z
  .object({
    dropId: z.enum(lootBoxDropIds),
    quantity: safePositiveIntegerSchema,
  })
  .strict();

function validateLootBoxDrops(
  boxType: (typeof lootBoxIds)[number],
  drops: readonly z.infer<typeof lootBoxDropSchema>[],
  context: z.RefinementCtx,
) {
  addDuplicateIssues(drops, (drop) => drop.dropId, ['drops'], 'dropId', context);
  const allowedDropIds = new Set(getLootBoxDropIdsForBox(boxType));
  drops.forEach((drop, index) => {
    if (!allowedDropIds.has(drop.dropId)) {
      context.addIssue({
        code: 'custom',
        path: ['drops', index, 'dropId'],
        message: `掉落 ${drop.dropId} 不屬於 ${boxType} 箱`,
      });
    }
  });
}

const lootBoxRecordSchema = z
  .object({
    id: portableRecordIdSchema,
    recordedAt: isoDateTimeSchema,
    boxType: z.enum(lootBoxIds),
    openings: safePositiveIntegerSchema,
    drops: z
      .array(lootBoxDropSchema)
      .min(1)
      .max(playerDataContractLimits.maxDropsPerLootBoxEntry),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.openings > getLootBoxDefinition(record.boxType).batchSize) {
      context.addIssue({
        code: 'custom',
        path: ['openings'],
        message: '單筆開箱數不可超過該箱型 batchSize',
      });
    }
    validateLootBoxDrops(record.boxType, record.drops, context);
  });

const lootBoxRollupSchema = z
  .object({
    id: portableRecordIdSchema,
    boxType: z.enum(lootBoxIds),
    recordCount: safePositiveIntegerSchema,
    openings: safePositiveIntegerSchema,
    drops: z
      .array(lootBoxDropSchema)
      .min(1)
      .max(playerDataContractLimits.maxDropsPerLootBoxEntry),
  })
  .strict()
  .superRefine((rollup, context) => {
    validateLootBoxDrops(rollup.boxType, rollup.drops, context);
  });

const lootBoxHistoryDataV1Schema = z
  .object({
    records: z
      .array(lootBoxRecordSchema)
      .max(playerDataContractLimits.maxLootBoxRecords),
    rollups: z
      .array(lootBoxRollupSchema)
      .max(playerDataContractLimits.maxLootBoxRollups),
  })
  .strict()
  .superRefine((data, context) => {
    addDuplicateIssues(data.records, (record) => record.id, ['records'], 'id', context);
    addDuplicateIssues(data.rollups, (rollup) => rollup.id, ['rollups'], 'id', context);

    const recordIds = new Set(data.records.map((record) => record.id));
    data.rollups.forEach((rollup, index) => {
      if (recordIds.has(rollup.id)) {
        context.addIssue({
          code: 'custom',
          path: ['rollups', index, 'id'],
          message: `開箱明細與彙總不可共用 ID：${rollup.id}`,
        });
      }
    });
  });

export const progressionSectionV1Schema = z
  .object({
    id: z.literal('progression'),
    schemaVersion: z.literal(1),
    data: progressionDataV1Schema,
  })
  .strict();

export const playerAttributesSectionV1Schema = z
  .object({
    id: z.literal('player-attributes'),
    schemaVersion: z.literal(1),
    data: playerAttributesDataV1Schema,
  })
  .strict();

export const inventorySectionV1Schema = z
  .object({
    id: z.literal('inventory'),
    schemaVersion: z.literal(1),
    data: inventoryDataV1Schema,
  })
  .strict();

export const lootBoxHistorySectionV1Schema = z
  .object({
    id: z.literal('loot-box-history'),
    schemaVersion: z.literal(1),
    data: lootBoxHistoryDataV1Schema,
  })
  .strict();

export const playerDataSectionRegistry = Object.freeze([
  Object.freeze({ id: 'progression', supportedVersions: Object.freeze([1] as const) }),
  Object.freeze({ id: 'player-attributes', supportedVersions: Object.freeze([1] as const) }),
  Object.freeze({ id: 'inventory', supportedVersions: Object.freeze([1] as const) }),
  Object.freeze({ id: 'loot-box-history', supportedVersions: Object.freeze([1] as const) }),
] as const);

const rawPlayerDataSectionSchema = z
  .object({
    id: stableIdentifierSchema,
    schemaVersion: safePositiveIntegerSchema,
    data: z.unknown(),
  })
  .strict();

const playerDataEnvelopeV1Schema = z
  .object({
    format: z.literal(playerDataFormat),
    formatVersion: z.literal(playerDataFormatVersion),
    exportedAt: isoDateTimeSchema,
    producer: z
      .object({
        app: stableIdentifierSchema.max(playerDataContractLimits.maxProducerFieldLength),
        appVersion: z.string().trim().min(1).max(playerDataContractLimits.maxProducerFieldLength),
      })
      .strict(),
    sections: z
      .array(rawPlayerDataSectionSchema)
      .min(1)
      .max(playerDataContractLimits.maxSections),
  })
  .strict()
  .superRefine((envelope, context) => {
    addDuplicateIssues(envelope.sections, (section) => section.id, ['sections'], 'id', context);
  });

function getKnownSectionSchema(sectionId: string, schemaVersion: number) {
  if (schemaVersion !== 1) return undefined;
  switch (sectionId) {
    case 'progression': return progressionSectionV1Schema;
    case 'player-attributes': return playerAttributesSectionV1Schema;
    case 'inventory': return inventorySectionV1Schema;
    case 'loot-box-history': return lootBoxHistorySectionV1Schema;
    default: return undefined;
  }
}

/**
 * 完整交換檔 runtime schema。
 *
 * 未知 section 與已知 section 的未知版本保留給預覽層分類；已知版本若
 * 結構錯誤則整份驗證失敗，避免略過其錯誤後造成使用者誤判。
 */
export const playerDataFileSchema = playerDataEnvelopeV1Schema.superRefine(
  (envelope, context) => {
    envelope.sections.forEach((section, sectionIndex) => {
      const sectionSchema = getKnownSectionSchema(section.id, section.schemaVersion);
      if (!sectionSchema) return;

      const result = sectionSchema.safeParse(section);
      if (result.success) return;

      result.error.issues.forEach((issue) => {
        context.addIssue({
          code: 'custom',
          path: ['sections', sectionIndex, ...issue.path],
          message: issue.message,
        });
      });
    });
  },
);

export type PlayerDataEnvelope = z.infer<typeof playerDataFileSchema>;
export type PlayerDataKnownSection =
  | z.infer<typeof progressionSectionV1Schema>
  | z.infer<typeof playerAttributesSectionV1Schema>
  | z.infer<typeof inventorySectionV1Schema>
  | z.infer<typeof lootBoxHistorySectionV1Schema>;

export interface UnsupportedPlayerDataSection {
  readonly id: string;
  readonly schemaVersion: number;
  readonly reason: 'unknown-section' | 'unsupported-version';
}

export type PlayerDataInspectionResult =
  | {
      readonly success: false;
      readonly error: z.ZodError;
    }
  | {
      readonly success: true;
      readonly envelope: PlayerDataEnvelope;
      readonly supportedSections: readonly PlayerDataKnownSection[];
      readonly unsupportedSections: readonly UnsupportedPlayerDataSection[];
    };

function isKnownSectionId(value: string): value is PlayerDataSectionId {
  return (playerDataSectionIds as readonly string[]).includes(value);
}

/** 驗證交換檔並分類可處理及不支援 section；不執行任何 store 寫入。 */
export function inspectPlayerDataFile(value: unknown): PlayerDataInspectionResult {
  const result = playerDataFileSchema.safeParse(value);
  if (!result.success) return { success: false, error: result.error };

  const supportedSections: PlayerDataKnownSection[] = [];
  const unsupportedSections: UnsupportedPlayerDataSection[] = [];

  result.data.sections.forEach((section) => {
    const schema = getKnownSectionSchema(section.id, section.schemaVersion);
    if (!schema) {
      unsupportedSections.push({
        id: section.id,
        schemaVersion: section.schemaVersion,
        reason: isKnownSectionId(section.id) ? 'unsupported-version' : 'unknown-section',
      });
      return;
    }

    supportedSections.push(schema.parse(section) as PlayerDataKnownSection);
  });

  return {
    success: true,
    envelope: result.data,
    supportedSections,
    unsupportedSections,
  };
}
