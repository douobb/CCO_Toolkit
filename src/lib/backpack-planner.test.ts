import { describe, expect, it } from 'vitest';

import {
  calculateBackpackPlanner,
  getBackpackPlannerItemCatalog,
  validateBackpackPlannerInputs,
} from './backpack-planner';

describe('backpack planner', () => {
  it('計算目標背包的目前進度與持有物品等值', () => {
    const result = calculateBackpackPlanner({
      targetTierId: 'fanny-pack',
      quantities: {
        'old-pouch': 5,
        'tech-scrap': 500,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.targetTechScrapEquivalent).toBe(1000);
    expect(result?.ownedTechScrapEquivalent).toBe(1000);
    expect(result?.progressPercent).toBe(100);
    expect(result?.items.filter((item) => item.quantity > 0)).toEqual([
      { id: 'old-pouch', kind: 'tier', quantity: 5, techScrapEquivalent: 500 },
      { id: 'tech-scrap', kind: 'material', quantity: 500, techScrapEquivalent: 500 },
    ]);
  });

  it('保留所有可輸入物資且預設數量視為 0', () => {
    const result = calculateBackpackPlanner({
      targetTierId: 'old-pouch',
      quantities: {},
    });

    expect(result?.items).toHaveLength(getBackpackPlannerItemCatalog().length);
    expect(result?.ownedTechScrapEquivalent).toBe(0);
    expect(result?.progressPercent).toBe(0);
  });

  it('拒絕未知目標與負數或小數持有數量', () => {
    expect(validateBackpackPlannerInputs({ targetTierId: 'unknown', quantities: {} })).toBe('target');
    expect(validateBackpackPlannerInputs({
      targetTierId: 'old-pouch',
      quantities: { 'tech-scrap': -1 },
    })).toBe('quantity');
    expect(validateBackpackPlannerInputs({
      targetTierId: 'old-pouch',
      quantities: { 'tech-scrap': 1.5 },
    })).toBe('quantity');
  });
});
