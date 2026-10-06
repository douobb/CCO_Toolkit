// @vitest-environment happy-dom

import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { backpackTierCatalog } from '@/data/game/backpack-progression';
import { getMessages } from '@/lib/translations';
import {
  createDefaultBackpackPlannerToolState,
  type BackpackPlannerToolState,
} from '@/lib/backpack-planner-state';
import { loadToolState, saveToolState } from '@/lib/storage';

import {
  BackpackPlannerCalculator,
  BackpackPlannerToolProvider,
  calculateBackpackPlannerTool,
  parseBackpackPlannerValues,
} from './backpack-planner';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface MountedBackpack {
  readonly container: HTMLDivElement;
  readonly root: Root;
}

const mountedBackpacks: MountedBackpack[] = [];

async function mountBackpack(): Promise<MountedBackpack> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const mounted = { container, root };
  mountedBackpacks.push(mounted);

  await act(async () => {
    root.render(
      <BackpackPlannerToolProvider>
        <BackpackPlannerCalculator
          labels={getMessages('zh-tw').tools.backpackPlanner}
          locale="zh-tw"
        />
      </BackpackPlannerToolProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return mounted;
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 select value setter');
  setter.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(async () => {
  for (const mounted of mountedBackpacks.splice(0)) {
    await act(async () => mounted.root.unmount());
    mounted.container.remove();
  }
  window.localStorage.clear();
  document.body.replaceChildren();
});

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

  it('重設目標時保留共用背包庫存並保存原數量', async () => {
    window.localStorage.clear();
    const defaults = createDefaultBackpackPlannerToolState();
    const quantities = {
      ...defaults.quantities,
      'old-pouch': '10',
      'tech-scrap': '27',
    };
    const storedState: BackpackPlannerToolState = {
      targetTierId: backpackTierCatalog.at(-1)!.id,
      quantities,
    };
    saveToolState('backpack-planner', storedState);
    const mounted = await mountBackpack();

    const target = mounted.container.querySelector<HTMLSelectElement>(
      '#backpack-planner-target-tier',
    )!;
    expect(target.value).toBe(storedState.targetTierId);

    await act(async () => {
      setSelectValue(target, defaults.targetTierId);
      await Promise.resolve();
    });
    await act(async () => {
      mounted.container.querySelector<HTMLButtonElement>('[data-tool-reset=""]')?.click();
      await Promise.resolve();
    });

    expect(target.value).toBe(defaults.targetTierId);
    expect(mounted.container.querySelector<HTMLInputElement>(
      '#backpack-planner-old-pouch',
    )?.value).toBe('10');
    expect(mounted.container.querySelector<HTMLInputElement>(
      '#backpack-planner-tech-scrap',
    )?.value).toBe('27');
    expect(loadToolState<BackpackPlannerToolState>('backpack-planner'))
      .toEqual({ targetTierId: defaults.targetTierId, quantities });
  });
});
