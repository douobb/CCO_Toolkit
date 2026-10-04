/**
 * 背包升級規劃的純計算核心。
 *
 * 使用者持有數量屬於工具狀態，不進入 Game Data。結果以資料集提供的
 * `techScrapEquivalent` 將不同背包與物資放在同一基準比較；背包需求仍由
 * 資料集的需求陣列計算，保留未來多物資配方的擴充能力。
 */

import {
  backpackMaterialCatalog,
  backpackTierCatalog,
  type BackpackMaterialId,
  type BackpackTierId,
} from '@/data/game/backpack-progression';

export type BackpackPlannerItemId = BackpackMaterialId | BackpackTierId;

export interface BackpackPlannerInputs {
  readonly targetTierId: string;
  readonly quantities: Readonly<Record<string, number>>;
}

export interface BackpackPlannerItemResult {
  readonly id: BackpackPlannerItemId;
  readonly kind: 'tier' | 'material';
  readonly quantity: number;
  readonly techScrapEquivalent: number;
}

export interface BackpackPlannerResult {
  readonly targetTierId: BackpackTierId;
  readonly targetTechScrapEquivalent: number;
  readonly ownedTechScrapEquivalent: number;
  readonly progressPercent: number;
  readonly items: readonly BackpackPlannerItemResult[];
}

export type BackpackPlannerInputError = 'target' | 'quantity';

const itemCatalog: readonly {
  readonly id: BackpackPlannerItemId;
  readonly kind: 'tier' | 'material';
}[] = [
  ...backpackTierCatalog.map((tier) => ({
    id: tier.id as BackpackPlannerItemId,
    kind: 'tier' as const,
  })),
  ...backpackMaterialCatalog.map((material) => ({
    id: material.id as BackpackPlannerItemId,
    kind: 'material' as const,
  })),
];

function getTier(id: string) {
  return backpackTierCatalog.find((tier) => tier.id === id);
}

function getMaterial(id: string) {
  return backpackMaterialCatalog.find((material) => material.id === id);
}

function isValidQuantity(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

function itemEquivalent(id: string, visiting = new Set<string>()): number | null {
  const material = getMaterial(id);
  if (material) return material.techScrapEquivalent;

  const tier = getTier(id);
  if (!tier || visiting.has(id)) return null;

  const nextVisiting = new Set(visiting);
  nextVisiting.add(id);
  let total = 0;
  for (const requirement of tier.requirements) {
    const equivalent = itemEquivalent(requirement.itemId, nextVisiting);
    if (equivalent === null) return null;
    total += requirement.quantity * equivalent;
  }
  return Number.isFinite(total) && total > 0 ? total : null;
}

export function getBackpackPlannerItemCatalog() {
  return itemCatalog;
}

export function validateBackpackPlannerInputs(
  inputs: Partial<BackpackPlannerInputs>,
): BackpackPlannerInputError | null {
  if (!getTier(inputs.targetTierId ?? '')) return 'target';

  for (const item of itemCatalog) {
    if (!isValidQuantity(inputs.quantities?.[item.id] ?? 0)) return 'quantity';
  }
  return null;
}

export function calculateBackpackPlanner(
  inputs: BackpackPlannerInputs,
): BackpackPlannerResult | null {
  if (validateBackpackPlannerInputs(inputs) !== null) return null;

  const targetTier = getTier(inputs.targetTierId);
  if (!targetTier) return null;

  const targetEquivalent = itemEquivalent(targetTier.id);
  if (targetEquivalent === null) return null;

  let ownedEquivalent = 0;
  const items = itemCatalog.flatMap((item) => {
    const quantity = inputs.quantities[item.id] ?? 0;
    const equivalent = itemEquivalent(item.id);
    if (equivalent === null) return [];
    ownedEquivalent += quantity * equivalent;
    return [{
      id: item.id,
      kind: item.kind,
      quantity,
      techScrapEquivalent: quantity * equivalent,
    }];
  });

  const progressPercent = Math.min(100, ownedEquivalent / targetEquivalent * 100);

  return {
    targetTierId: targetTier.id as BackpackTierId,
    targetTechScrapEquivalent: targetEquivalent,
    ownedTechScrapEquivalent: ownedEquivalent,
    progressPercent,
    items,
  };
}
