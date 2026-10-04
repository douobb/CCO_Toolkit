import {
  getBackpackPlannerItemCatalog,
} from './backpack-planner';
import { backpackTierCatalog } from '@/data/game/backpack-progression';

export interface BackpackPlannerToolState {
  readonly targetTierId: string;
  readonly quantities: Readonly<Record<string, string>>;
}

const backpackPlannerItemIds = getBackpackPlannerItemCatalog().map((item) => item.id);

function createDefaultQuantities(): Record<string, string> {
  return Object.fromEntries(backpackPlannerItemIds.map((id) => [id, '0']));
}

export function createDefaultBackpackPlannerToolState(): BackpackPlannerToolState {
  return {
    targetTierId: backpackTierCatalog[0]?.id ?? '',
    quantities: createDefaultQuantities(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 背包規劃目前版本的工具狀態契約；不接受缺漏或額外物品 ID。 */
export function isBackpackPlannerToolState(
  value: unknown,
): value is BackpackPlannerToolState {
  if (!isRecord(value) || typeof value.targetTierId !== 'string') return false;
  const quantities = value.quantities;
  if (!isRecord(quantities)) return false;

  const quantityKeys = Object.keys(quantities);
  return quantityKeys.length === backpackPlannerItemIds.length
    && backpackPlannerItemIds.every((id) => typeof quantities[id] === 'string');
}
