import { describe, expect, it } from 'vitest';

import rawBackpackProgression from './backpack-progression.json';
import {
  backpackMaterialCatalog,
  backpackProgressionDataEnvelopeSchema,
  backpackProgressionDataSet,
  backpackTierCatalog,
} from './backpack-progression';
import { backpackProgressionPayloadSchema } from './backpack-progression.schema';

describe('backpack-progression Game Data', () => {
  it('通過 payload 與 envelope schema，保留六階背包與八種物資', () => {
    expect(backpackProgressionPayloadSchema.safeParse(rawBackpackProgression).success).toBe(true);
    expect(backpackProgressionDataEnvelopeSchema.safeParse(backpackProgressionDataSet).success).toBe(true);
    expect(backpackTierCatalog.map((tier) => tier.id)).toEqual([
      'old-pouch',
      'fanny-pack',
      'explorer-backpack',
      'employee-office-case',
      'autonomous-storage-unit',
      'quantum-storage-unit',
    ]);
    expect(backpackMaterialCatalog).toHaveLength(8);
  });

  it('用 requirements 陣列保留目前單一需求，並允許未來擴充多項需求', () => {
    expect(backpackTierCatalog.every((tier) => tier.requirements.length >= 1)).toBe(true);
    expect(backpackTierCatalog.map((tier) => tier.requirements[0])).toEqual([
      { itemId: 'tech-scrap', quantity: 100 },
      { itemId: 'old-pouch', quantity: 10 },
      { itemId: 'fanny-pack', quantity: 15 },
      { itemId: 'explorer-backpack', quantity: 20 },
      { itemId: 'employee-office-case', quantity: 25 },
      { itemId: 'autonomous-storage-unit', quantity: 15 },
    ]);
  });

  it('拒絕未定義的需求物資與重複階段 ID', () => {
    const unknownRequirement = structuredClone(rawBackpackProgression) as {
      tiers: Array<{ requirements: Array<Record<string, unknown>> }>;
    };
    unknownRequirement.tiers[0].requirements[0].itemId = 'unknown-material';
    expect(backpackProgressionPayloadSchema.safeParse(unknownRequirement).success).toBe(false);

    const duplicateTier = structuredClone(rawBackpackProgression) as {
      tiers: Array<Record<string, unknown>>;
    };
    duplicateTier.tiers[1].id = duplicateTier.tiers[0].id;
    expect(backpackProgressionPayloadSchema.safeParse(duplicateTier).success).toBe(false);
  });

  it('不保存玩家持有數量，且解析後的資料維持唯讀', () => {
    expect(JSON.stringify(rawBackpackProgression)).not.toContain('inventoryQuantity');
    expect(JSON.stringify(rawBackpackProgression)).not.toContain('ownedQuantity');
    expect(Object.isFrozen(backpackProgressionDataSet)).toBe(true);
    expect(Object.isFrozen(backpackProgressionDataSet.payload)).toBe(true);
    expect(Object.isFrozen(backpackProgressionDataSet.payload.tiers[0])).toBe(true);
  });
});
