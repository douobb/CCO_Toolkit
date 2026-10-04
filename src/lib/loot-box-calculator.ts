/**
 * 箱子期望收益的純計算核心。
 *
 * 掉落資料來自 Game Data，價格由呼叫端傳入已解析的 market model；本模組
 * 不讀取 React、storage 或插件狀態。無法從共用物價估值的掉落會回傳 null，
 * 避免把未知資料誤當成零收益。
 */

import { lootBoxCatalog, type LootBoxEntry, type LootBoxId } from '@/data/game/loot-boxes';
import {
  getLootBoxDropDefinition,
  getLootBoxDropId,
  type LootBoxDropId,
} from '@/data/game/loot-box-drops';
import { marketPriceCatalog, type MarketPriceItemId } from '@/data/game/economy';
import { getDualPrice, type ResolvedMarketPrices } from './market-prices';

const fixedZeroValueItemIds = new Set([
  'protocol-breach-shard',
  'cybertunnel-vpn',
  'reward-booster-shard',
  'dungeon-token',
]);

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function getMarketItemId(value: string): MarketPriceItemId | null {
  return marketPriceCatalog.some((item) => item.itemId === value)
    ? value as MarketPriceItemId
    : null;
}

/** 依目前市場價格計算聚合掉落的 AI 等值。 */
export function valueOfLootBoxDrop(
  dropId: LootBoxDropId,
  quantity: number,
  prices: ResolvedMarketPrices,
): number | null {
  if (!isFiniteNonNegative(quantity)) return null;

  const definition = getLootBoxDropDefinition(dropId);
  if (definition.kind === 'equipment') return 0;

  const itemId = definition.itemId;
  if (itemId === 'ai-core') return quantity;
  if (fixedZeroValueItemIds.has(itemId)) return 0;

  const marketItemId = getMarketItemId(itemId);
  if (!marketItemId) return null;

  const unitValue = getDualPrice(prices, marketItemId, 'ai');
  const scale = itemId === 'tech-scrap' ? 1 / 1_000 : 1;
  const value = quantity * unitValue * scale;
  return isFiniteNonNegative(value) ? value : null;
}

/** 依目前市場價格計算單一掉落 entry 的 AI 等值。 */
export function valueOfLootBoxEntry(
  entry: LootBoxEntry,
  prices: ResolvedMarketPrices,
): number | null {
  return valueOfLootBoxDrop(getLootBoxDropId(entry), entry.quantity, prices);
}

/** 單箱容器與製作科技碎片的 AI 成本。 */
export function lootBoxCostAi(
  boxId: LootBoxId,
  prices: ResolvedMarketPrices,
): number | null {
  const box = lootBoxCatalog.find((candidate) => candidate.id === boxId);
  if (!box) return null;

  const containerId = getMarketItemId(box.containerItemId);
  if (!containerId) return null;

  const containerCost = getDualPrice(prices, containerId, 'ai');
  const techScrapCost = box.techScrapCost
    * getDualPrice(prices, 'tech-scrap', 'ai')
    / 1_000;
  const cost = containerCost + techScrapCost;
  return isFiniteNonNegative(cost) ? cost : null;
}

/** 單箱掉落的加權期望 AI 等值。 */
export function expectedLootBoxValueAi(
  boxId: LootBoxId,
  prices: ResolvedMarketPrices,
): number | null {
  const box = lootBoxCatalog.find((candidate) => candidate.id === boxId);
  if (!box) return null;

  const totalWeight = box.entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return null;

  let value = 0;
  for (const entry of box.entries) {
    const entryValue = valueOfLootBoxEntry(entry, prices);
    if (entryValue === null) return null;
    value += entry.weight / totalWeight * entryValue;
  }

  return isFiniteNonNegative(value) ? value : null;
}

/** 單箱期望淨收益；不含批次與作業時間。 */
export function expectedLootBoxNetAi(
  boxId: LootBoxId,
  prices: ResolvedMarketPrices,
): number | null {
  const gross = expectedLootBoxValueAi(boxId, prices);
  const cost = lootBoxCostAi(boxId, prices);
  if (gross === null || cost === null) return null;

  const net = gross - cost;
  return Number.isFinite(net) ? net : null;
}
