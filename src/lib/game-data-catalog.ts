import {
  backpackProgressionDataSet,
} from '@/data/game/backpack-progression';
import {
  economyDataSet,
  getMarketPriceDefinition,
} from '@/data/game/economy';
import {
  earningsActivitiesDataSet,
} from '@/data/game/earnings-activities';
import { lootBoxesDataSet } from '@/data/game/loot-boxes';
import { blackMarketDataSet } from '@/data/game/black-market';
import { dungeonDataSet } from '@/data/game/dungeon';
import { effectsDataSet } from '@/data/game/effects';
import { progressionDataSet } from '@/data/game/progression';
import { searchRewardDataSet } from '@/data/game/search-rewards';
import {
  getGameDataMetadata,
  type GameDataEnvelope,
  type GameDataMetadata,
} from './game-data';
import type { Locale } from './i18n';

export type GameCatalogLocale = Locale;
export type GameCatalogLabels = Readonly<Record<GameCatalogLocale, string>>;

/**
 * 所有可被內容引用的已發布 dataset 平面目錄。
 *
 * 這個目錄只負責以穩定 dataset ID 查找已驗證的 dataset，避免內容層知道
 * 各領域的 payload 結構；欄位與計算所需 catalog 仍由各 domain module 正式提供。
 */
export const gameDataSetCatalog = Object.freeze({
  'search-rewards': searchRewardDataSet,
  progression: progressionDataSet,
  'backpack-progression': backpackProgressionDataSet,
  economy: economyDataSet,
  effects: effectsDataSet,
  'black-market': blackMarketDataSet,
  dungeon: dungeonDataSet,
  'earnings-activities': earningsActivitiesDataSet,
  'loot-boxes': lootBoxesDataSet,
} as const);

export type GameDataSetId = keyof typeof gameDataSetCatalog;

const gameDataSetById: Readonly<Record<string, GameDataEnvelope<unknown>>> =
  gameDataSetCatalog;

export function getGameDataSet(id: string): GameDataEnvelope<unknown> | undefined {
  return Object.prototype.hasOwnProperty.call(gameDataSetById, id)
    ? gameDataSetById[id]
    : undefined;
}

export function getGameDataMetadataById(id: string): GameDataMetadata | undefined {
  const dataSet = getGameDataSet(id);
  return dataSet ? getGameDataMetadata(dataSet) : undefined;
}

/** Search Reward 的欄位到共用市場物品 ID 的唯一對應表，供 TASK-408 使用。 */
export const searchRewardPriceFieldCatalog = [
  { field: 'mt', itemId: 'medical-tech-parts' },
  { field: 'atp', itemId: 'ammunition-tech-parts' },
  { field: 'matp', itemId: 'military-ammunition-tech-parts' },
] as const;

export type SearchRewardPriceField = (typeof searchRewardPriceFieldCatalog)[number]['field'];

export function getSearchRewardPriceDefinition(field: SearchRewardPriceField) {
  const mapping = searchRewardPriceFieldCatalog.find((item) => item.field === field);
  if (!mapping) throw new Error(`未知的 Search Reward 價格欄位: ${field}`);
  return {
    ...mapping,
    definition: getMarketPriceDefinition(mapping.itemId),
  } as const;
}
