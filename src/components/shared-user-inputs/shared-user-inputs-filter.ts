import {
  marketCacheRateCatalog,
  marketPriceCatalog,
  type MarketCacheRateId,
  type MarketPriceItemId,
} from '@/data/game/economy';
import { progressionLevelCatalog, type ProgressionLevelId } from '@/data/game/progression';
import { isLocale } from '@/lib/i18n';
import { getToolDefinitionByPath } from '@/lib/tools';
import type { SharedUserInputs } from '@/lib/shared-user-inputs';
import type { ToolDefinition } from '@/lib/tools/metadata';

export type SharedEquipmentField = keyof SharedUserInputs['equipment'];
export type SharedExchangeRateId =
  SharedUserInputs['economy']['exchangeRates'][number]['id'];

/** 限制 manager 顯示的欄位；未提供 filter 時 manager 顯示完整設定。 */
export interface SharedUserInputsFilter {
  readonly progression: readonly ProgressionLevelId[];
  readonly equipment: readonly SharedEquipmentField[];
  readonly prices: readonly MarketPriceItemId[];
  readonly exchangeRates: readonly SharedExchangeRateId[];
  readonly cacheRates: readonly MarketCacheRateId[];
}

export interface ToolPlayerSettingsPathContext {
  readonly defaultView: 'related' | 'all';
  readonly relatedFilter: SharedUserInputsFilter;
}

const noFields: readonly never[] = [];

function createFilter(
  fields: Partial<SharedUserInputsFilter>,
): SharedUserInputsFilter {
  return {
    progression: noFields,
    equipment: noFields,
    prices: noFields,
    exchangeRates: noFields,
    cacheRates: noFields,
    ...fields,
  };
}

const noRelatedSettings = createFilter({});
const allProgressionFields = progressionLevelCatalog.map(({ id }) => id);
const allMarketPriceFields = marketPriceCatalog.map(({ itemId }) => itemId);
const allCacheRateFields = marketCacheRateCatalog.map(({ id }) => id);

const relatedSettingsByTool = {
  'search-reward': createFilter({
    progression: ['level', 'scavenge-skill'],
    prices: [
      'medical-tech-parts',
      'ammunition-tech-parts',
      'military-ammunition-tech-parts',
    ],
    exchangeRates: ['btc-per-ai'],
  }),
  mining: createFilter({
    progression: ['level', 'mining-skill'],
    prices: ['hash', 'tech-scrap'],
    exchangeRates: ['btc-per-ai'],
  }),
  'level-conversion': createFilter({
    progression: allProgressionFields,
    prices: [
      'hash',
      'tech-scrap',
      'medical-tech-parts',
      'ammunition-tech-parts',
      'military-ammunition-tech-parts',
    ],
    exchangeRates: ['btc-per-ai'],
    cacheRates: ['trash'],
  }),
  'black-market': createFilter({
    progression: ['level', 'printing-rank'],
    equipment: ['bargainPercent'],
    exchangeRates: ['btc-per-ai'],
    cacheRates: allCacheRateFields,
  }),
  dungeon: createFilter({
    equipment: [
      'maxHealth',
      'armor',
      'destructiveWeaponDamage',
      'criticalDamagePercent',
      'damageReductionPercent',
    ],
  }),
  'earnings-overview': createFilter({
    progression: ['level', 'printing-rank', 'mining-skill'],
    equipment: ['bargainPercent'],
    prices: allMarketPriceFields,
    exchangeRates: ['btc-per-ai'],
    cacheRates: allCacheRateFields,
  }),
  'backpack-planner': noRelatedSettings,
  'loot-box-analysis': createFilter({
    prices: [
      'hash',
      'tech-scrap',
      'supply-crate-gang',
      'old-pouch',
      'locked-container',
      'locked-rare-container',
      'locked-legendary-container',
    ],
    exchangeRates: ['btc-per-ai'],
  }),
} satisfies Record<ToolDefinition['id'], SharedUserInputsFilter>;

export function hasSharedUserInputsFilterFields(
  filter: SharedUserInputsFilter,
): boolean {
  return (
    filter.progression.length > 0
    || filter.equipment.length > 0
    || filter.prices.length > 0
    || filter.exchangeRates.length > 0
    || filter.cacheRates.length > 0
  );
}

/** 由 locale-aware pathname 與工具 registry 決定 overlay 預設檢視及欄位範圍。 */
export function getToolPlayerSettingsPathContext(
  pathname: string,
): ToolPlayerSettingsPathContext | null {
  const segments = pathname.split('/').filter(Boolean);
  const localeIndex = segments.findIndex(isLocale);
  if (localeIndex < 0) return null;

  const toolsIndex = localeIndex + 1;
  if (segments[toolsIndex] !== 'tools') return null;

  const toolPath = segments.slice(toolsIndex).join('/');
  if (toolPath === 'tools') {
    return { defaultView: 'all', relatedFilter: noRelatedSettings };
  }

  const tool = getToolDefinitionByPath(toolPath);
  if (!tool) return null;
  const relatedFilter = Object.entries(relatedSettingsByTool)
    .find(([toolId]) => toolId === tool.id)?.[1] ?? noRelatedSettings;

  return {
    defaultView: 'related',
    relatedFilter,
  };
}
