import { describe, expect, it } from 'vitest';

import rawLootBoxes from './loot-boxes.json';
import {
  lootBoxCatalog,
  lootBoxesDataEnvelopeSchema,
  lootBoxesDataSet,
} from './loot-boxes';
import { lootBoxesPayloadSchema } from './loot-boxes.schema';

describe('loot-boxes Game Data', () => {
  it('通過 payload 與 envelope schema，保留三種箱子與來源表版本', () => {
    expect(lootBoxesPayloadSchema.safeParse(rawLootBoxes).success).toBe(true);
    expect(lootBoxesDataEnvelopeSchema.safeParse(lootBoxesDataSet).success).toBe(true);
    expect(lootBoxesDataSet.payload.sourceTableVersion).toBe('0.1866');
    expect(lootBoxCatalog.map((box) => box.id)).toEqual(['white', 'yellow', 'purple']);
  });

  it('保留可計算期望值所需的批次、成本、掉落數量與權重', () => {
    expect(lootBoxCatalog.map((box) => [
      box.id,
      box.batchSize,
      box.containerItemId,
      box.techScrapCost,
      box.entries.reduce((sum, entry) => sum + entry.weight, 0),
    ])).toEqual([
      ['white', 12, 'locked-container', 32, 590],
      ['yellow', 8, 'locked-rare-container', 64, 5703],
      ['purple', 4, 'locked-legendary-container', 128, 1606],
    ]);
    expect(lootBoxCatalog.flatMap((box) => box.entries).some((entry) =>
      'category' in entry && entry.category === 'equipment' && entry.rarity === 'red',
    )).toBe(true);
  });

  it('拒絕重複 entry ID 與同時含有物品及裝備欄位的錯誤資料', () => {
    const duplicateEntry = structuredClone(rawLootBoxes) as {
      boxes: Array<{ entries: Array<Record<string, unknown>> }>;
    };
    duplicateEntry.boxes[0].entries[1].id = duplicateEntry.boxes[0].entries[0].id;
    expect(lootBoxesPayloadSchema.safeParse(duplicateEntry).success).toBe(false);

    const mixedDrop = structuredClone(rawLootBoxes) as {
      boxes: Array<{ entries: Array<Record<string, unknown>> }>;
    };
    mixedDrop.boxes[0].entries[0].category = 'equipment';
    mixedDrop.boxes[0].entries[0].rarity = 'yellow';
    expect(lootBoxesPayloadSchema.safeParse(mixedDrop).success).toBe(false);
  });

  it('解析後的 envelope、箱子與掉落 entries 維持唯讀', () => {
    expect(Object.isFrozen(lootBoxesDataSet)).toBe(true);
    expect(Object.isFrozen(lootBoxesDataSet.payload)).toBe(true);
    expect(Object.isFrozen(lootBoxesDataSet.payload.boxes[0])).toBe(true);
    expect(Object.isFrozen(lootBoxesDataSet.payload.boxes[0]?.entries[0])).toBe(true);
  });
});
