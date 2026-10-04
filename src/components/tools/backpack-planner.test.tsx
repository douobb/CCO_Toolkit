import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { getMessages } from '@/lib/translations';
import { createDefaultBackpackPlannerToolState } from '@/lib/backpack-planner-state';

import {
  BackpackPlannerCalculator,
  BackpackPlannerToolProvider,
  calculateBackpackPlannerTool,
  parseBackpackPlannerValues,
} from './backpack-planner';

describe('Backpack planner calculator', () => {
  it('呈現目標背包、持有數量輸入與目前物資表', () => {
    const labels = getMessages('zh-tw').tools.backpackPlanner;
    const markup = renderToStaticMarkup(
      <BackpackPlannerToolProvider>
        <BackpackPlannerCalculator labels={labels} locale="zh-tw" />
      </BackpackPlannerToolProvider>,
    );

    expect(markup).toContain('data-tool="backpack-planner"');
    expect(markup).toContain('id="backpack-planner-target-tier"');
    expect(markup).toContain('id="backpack-planner-old-pouch"');
    expect(markup).toContain('id="backpack-planner-tech-scrap"');
    expect(markup).toContain('data-result-layout="table"');
    expect(markup).toContain('升級規劃');
    expect(markup).toContain('目前進度');
    expect(markup).toContain('佔目前物資');
    expect(markup).toContain('科技碎片等值');
    expect(markup).not.toContain('目前可達背包');
    expect(markup).not.toContain('尚缺等值');
    expect(markup).not.toContain('需求數量');
  });

  it('將空白持有數量視為 0，拒絕負值與小數', () => {
    const state = createDefaultBackpackPlannerToolState();
    const blank = parseBackpackPlannerValues({
      ...state,
      quantities: { ...state.quantities, 'tech-scrap': '' },
    });
    expect(blank.inputs?.quantities['tech-scrap']).toBe(0);

    expect(parseBackpackPlannerValues({
      ...state,
      quantities: { ...state.quantities, 'tech-scrap': '-1' },
    }).inputs).toBeNull();
    expect(parseBackpackPlannerValues({
      ...state,
      quantities: { ...state.quantities, 'tech-scrap': '1.5' },
    }).inputs).toBeNull();
  });

  it('依目標背包計算目前進度與非零物品', () => {
    const state = createDefaultBackpackPlannerToolState();
    const result = calculateBackpackPlannerTool({
      ...state,
      targetTierId: 'fanny-pack',
      quantities: { ...state.quantities, 'old-pouch': '10' },
    }).result;

    expect(result?.targetTierId).toBe('fanny-pack');
    expect(result?.items.filter((item) => item.quantity > 0)).toEqual([
      {
        id: 'old-pouch',
        kind: 'tier',
        quantity: 10,
        techScrapEquivalent: 1000,
      },
    ]);
    expect(result?.ownedTechScrapEquivalent).toBe(1000);
    expect(result?.progressPercent).toBe(100);
  });
});
