import { backpackMaterialCatalog, backpackTierCatalog } from '../backpack-progression';
import { blackMarketQualityCatalog } from '../black-market';
import { earningsActivityCatalog } from '../earnings-activities';
import {
  economyCurrencyCatalog,
  economyItemCatalog,
  marketCacheRateCatalog,
} from '../economy';
import { manualEffectInputCatalog, statusEffectCatalog } from '../effects';
import { lootBoxDropCatalog } from '../loot-box-drops';
import { lootBoxCatalog } from '../loot-boxes';
import { progressionLevelCatalog } from '../progression';

type ToolTermDefinition = Readonly<{
  labels: Readonly<{
    en: string;
    'zh-cn': string;
  }>;
}>;

/**
 * 網站工具實際使用的簡體中文遊戲術語。
 *
 * 這份目錄只從公開工具的 Game Data 組合，不載入或複製完整遊戲語系檔。
 * 新增術語時，必須先讓對應工具目錄實際使用該名稱並確認遊戲內用語。
 */
const toolTermCatalogs: readonly (readonly ToolTermDefinition[])[] = [
  economyCurrencyCatalog,
  economyItemCatalog,
  marketCacheRateCatalog,
  progressionLevelCatalog,
  statusEffectCatalog,
  manualEffectInputCatalog,
  backpackTierCatalog,
  backpackMaterialCatalog,
  earningsActivityCatalog,
  blackMarketQualityCatalog,
  lootBoxCatalog,
  lootBoxDropCatalog,
];

const entries = toolTermCatalogs
  .flatMap((catalog) => catalog.map(({ labels }) => [labels.en, labels['zh-cn']] as const))
  .sort(([left], [right]) => left.localeCompare(right, 'en'));

export const zhCnToolTermEntries = Object.freeze(entries);

export const zhCnToolTerms: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(zhCnToolTermEntries),
);
