import { z } from 'zod';

import {
  lootBoxCatalog,
  type LootBoxEntry,
  type LootBoxId,
  type LootBoxRarityId,
} from './loot-boxes';
import { localizedGameLabelSchema } from './catalog.schema';

/**
 * 箱子分析使用的掉落顯示目錄。
 *
 * 顯示名稱依 CCO_Helper_v3 的 game-items 與開箱面板語系資料整理；這是
 * UI／使用者紀錄所需的名稱目錄，不複製箱子權重或市場數值。
 */
const stableDropIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, '掉落 ID 只能使用小寫英數字與連字號');

const itemDropDefinitionSchema = z
  .object({
    id: stableDropIdSchema,
    kind: z.literal('item'),
    itemId: stableDropIdSchema,
    labels: localizedGameLabelSchema,
  })
  .strict();

const equipmentDropDefinitionSchema = z
  .object({
    id: stableDropIdSchema,
    kind: z.literal('equipment'),
    rarity: z.enum(['yellow', 'purple', 'red']),
    labels: localizedGameLabelSchema,
  })
  .strict();

export const lootBoxDropDefinitionSchema = z.discriminatedUnion('kind', [
  itemDropDefinitionSchema,
  equipmentDropDefinitionSchema,
]);

const rawLootBoxDropCatalog = [
  { id: 'item-hash', kind: 'item', itemId: 'hash', labels: { 'zh-tw': '雜湊處理器', 'zh-cn': '哈希处理器', en: 'Hash Processor' } },
  { id: 'item-tech-scrap', kind: 'item', itemId: 'tech-scrap', labels: { 'zh-tw': '科技碎片', 'zh-cn': '科技碎片', en: 'Tech Scrap' } },
  { id: 'item-supply-crate-gang', kind: 'item', itemId: 'supply-crate-gang', labels: { 'zh-tw': '補給箱[公會]', 'zh-cn': '补给箱[帮派]', en: 'Supply Crate [Gang]' } },
  { id: 'item-protocol-breach-shard', kind: 'item', itemId: 'protocol-breach-shard', labels: { 'zh-tw': '協議漏洞碎片', 'zh-cn': '协议漏洞碎片', en: 'Protocol Breach Shard' } },
  { id: 'item-ai-core', kind: 'item', itemId: 'ai-core', labels: { 'zh-tw': 'AI核心', 'zh-cn': 'AI芯片', en: 'AI Core' } },
  { id: 'item-old-pouch', kind: 'item', itemId: 'old-pouch', labels: { 'zh-tw': '老舊袋子', 'zh-cn': '老旧袋子', en: 'Old Pouch' } },
  { id: 'item-cybertunnel-vpn', kind: 'item', itemId: 'cybertunnel-vpn', labels: { 'zh-tw': '網路隧道 VPN', 'zh-cn': '网络隧道代理', en: 'CyberTunnel VPN' } },
  { id: 'item-reward-booster-shard', kind: 'item', itemId: 'reward-booster-shard', labels: { 'zh-tw': '獎勵助推碎片', 'zh-cn': '奖励助推碎片', en: 'Reward Booster Shard' } },
  { id: 'item-dungeon-token', kind: 'item', itemId: 'dungeon-token', labels: { 'zh-tw': '地城代幣', 'zh-cn': '地牢令牌', en: 'Dungeon Token' } },
  { id: 'equipment-yellow', kind: 'equipment', rarity: 'yellow', labels: { 'zh-tw': '黃裝', 'zh-cn': '黄装', en: 'Yellow Gear' } },
  { id: 'equipment-purple', kind: 'equipment', rarity: 'purple', labels: { 'zh-tw': '紫裝', 'zh-cn': '紫装', en: 'Purple Gear' } },
  { id: 'equipment-red', kind: 'equipment', rarity: 'red', labels: { 'zh-tw': '紅裝', 'zh-cn': '红装', en: 'Red Gear' } },
] as const;

export const lootBoxDropCatalog = Object.freeze(
  z.array(lootBoxDropDefinitionSchema).parse(rawLootBoxDropCatalog),
);

export type LootBoxDropDefinition = (typeof lootBoxDropCatalog)[number];
export type LootBoxDropId = LootBoxDropDefinition['id'];

const lootBoxDropById = new Map<string, LootBoxDropDefinition>(
  lootBoxDropCatalog.map((drop) => [drop.id, drop]),
);

export const lootBoxDropIds = lootBoxDropCatalog.map((drop) => drop.id) as readonly LootBoxDropId[];

export function getLootBoxDropDefinition(id: LootBoxDropId | string): LootBoxDropDefinition {
  const definition = lootBoxDropById.get(id);
  if (!definition) throw new Error(`未知的箱子掉落 ID: ${id}`);
  return definition;
}

/** 將 Game Data 的 entry 對應到使用者紀錄共用的聚合掉落 key。 */
export function getLootBoxDropId(entry: LootBoxEntry): LootBoxDropId {
  const id = 'category' in entry
    ? `equipment-${entry.rarity}`
    : `item-${entry.itemId}`;

  if (!lootBoxDropById.has(id)) {
    throw new Error(`箱子掉落缺少顯示名稱目錄：${id}`);
  }

  return id as LootBoxDropId;
}

/** 取得目前箱子實際會出現的聚合掉落選項，順序依名稱目錄固定。 */
export function getLootBoxDropIdsForBox(boxId: LootBoxId): readonly LootBoxDropId[] {
  const entryIds = new Set(lootBoxCatalog.find((box) => box.id === boxId)?.entries.map(getLootBoxDropId));
  return lootBoxDropCatalog
    .filter((drop) => entryIds.has(drop.id))
    .map((drop) => drop.id);
}
