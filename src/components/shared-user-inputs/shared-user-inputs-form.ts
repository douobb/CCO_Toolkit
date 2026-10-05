import {
  normalizeSharedUserInputs,
  sharedUserInputsSchema,
  type SharedUserInputs,
} from '@/lib/storage';
import {
  economyDataSet,
  marketCacheRateCatalog,
  marketPriceCatalog,
  type MarketCacheRateId,
  type MarketPriceItemId,
} from '@/data/game/economy';
import {
  progressionLevelCatalog,
  type ProgressionLevelId,
} from '@/data/game/progression';
import {
  manualEffectInputCatalog,
  type ManualEffectInputId,
} from '@/data/game/effects';
import {
  SHARED_CRITICAL_DAMAGE_PERCENT_DEFAULT,
  SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT,
} from '@/lib/shared-user-inputs';

export interface SharedLevelDraft {
  readonly id: ProgressionLevelId;
  value: string;
}

export interface SharedPriceDraft {
  readonly itemId: MarketPriceItemId;
  readonly currencyId: string;
  amount: string;
}

export interface SharedExchangeRateDraft {
  readonly id: string;
  value: string;
}

export interface SharedCacheRateDraft {
  readonly id: MarketCacheRateId;
  value: string;
}

export interface SharedManualEffectDraft {
  readonly id: ManualEffectInputId;
  percentage: string;
}

/** 裝備與戰鬥共用輸入的可編輯 draft；可留白表示尚未設定。 */
export interface SharedEquipmentDraft {
  bargainPercent: string;
  maxHealth: string;
  armor: string;
  destructiveWeaponDamage: string;
  criticalDamagePercent: string;
  damageReductionPercent: string;
}

/**
 * 玩家可見的固定欄位 draft。
 *
 * draft 仍使用字串保存輸入中的空值與不完整數字；只有通過 schema 後才
 * 轉成 Shared User Inputs，避免無效輸入污染 store。
 */
export interface SharedUserInputsDraft {
  levels: SharedLevelDraft[];
  prices: SharedPriceDraft[];
  exchangeRates: SharedExchangeRateDraft[];
  cacheRates: SharedCacheRateDraft[];
  manualEffects: SharedManualEffectDraft[];
  equipment: SharedEquipmentDraft;
}

export type SharedMarketDrafts = Pick<
  SharedUserInputsDraft,
  'prices' | 'exchangeRates' | 'cacheRates'
>;

/** 只保存錯誤路徑；使用者提示由目前語系的 UI 統一提供。 */
export type SharedUserInputsDraftErrors = Readonly<Record<string, true>>;

function numberFromDraft(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function optionalNumberFromDraft(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

/** 建立完整市場資料目錄預設 draft，供初始化與批次恢復共用。 */
export function createDefaultSharedMarketDrafts(): SharedMarketDrafts {
  return {
    prices: marketPriceCatalog.map((definition) => ({
      itemId: definition.itemId,
      currencyId: definition.defaultBasisCurrencyId,
      amount: String(definition.defaultBasisValue),
    })),
    exchangeRates: economyDataSet.payload.exchangeRates.map((definition) => ({
      id: definition.id,
      value: String(definition.defaultValue),
    })),
    cacheRates: marketCacheRateCatalog.map((definition) => ({
      id: definition.id,
      value: String(definition.defaultValue),
    })),
  };
}

/** 建立所有市場價格的資料目錄預設 draft。 */
export function createDefaultSharedPriceDrafts(): SharedPriceDraft[] {
  return createDefaultSharedMarketDrafts().prices;
}

/** 建立裝備與戰鬥共用輸入的安全預設 draft。 */
export function createDefaultSharedEquipmentDraft(): SharedEquipmentDraft {
  return {
    bargainPercent: '0',
    maxHealth: '0',
    armor: '0',
    destructiveWeaponDamage: String(SHARED_DESTRUCTIVE_WEAPON_DAMAGE_DEFAULT),
    criticalDamagePercent: String(SHARED_CRITICAL_DAMAGE_PERCENT_DEFAULT),
    damageReductionPercent: '0',
  };
}

/** 依目前 draft 的主等級，計算技能欄位可接受的最大值。 */
export function getSharedLevelInputMaximum(
  draft: SharedUserInputsDraft,
  levelId: ProgressionLevelId,
): number {
  const definition = progressionLevelCatalog.find((item) => item.id === levelId);
  if (!definition || levelId === 'level') return definition?.range.max ?? 0;

  const playerLevel = draft.levels.find((level) => level.id === 'level');
  const parsedPlayerLevel = numberFromDraft(playerLevel?.value ?? '');
  if (!Number.isInteger(parsedPlayerLevel) || parsedPlayerLevel < 1) {
    return definition.range.max;
  }

  return Math.min(definition.range.max, parsedPlayerLevel);
}

function getDefaultManualPercentage(
  defaultValue: number | null,
  observedFallbackValue: number,
): number {
  return defaultValue ?? observedFallbackValue;
}

/** 從 snapshot 建立由 Game Data catalog 對齊的固定欄位。 */
export function createSharedUserInputsDraft(
  snapshot: SharedUserInputs,
): SharedUserInputsDraft {
  const storedSkills = snapshot.progression.skills;
  const storedPrices = snapshot.economy.prices;
  const storedExchangeRates = snapshot.economy.exchangeRates;
  const storedCacheRates = snapshot.economy.cacheRates;
  const storedManualEffects = snapshot.effects.buffs;
  const storedEquipment = snapshot.equipment;
  const defaultMarketDrafts = createDefaultSharedMarketDrafts();
  const defaultEquipment = createDefaultSharedEquipmentDraft();

  return {
    levels: progressionLevelCatalog.map((definition) => {
      if (definition.id === 'level') {
        return {
          id: definition.id,
          value: String(snapshot.progression.player.level),
        };
      }

      const stored = storedSkills.find((skill) => skill.id === definition.id);
      return {
        id: definition.id,
        value: String(stored?.level ?? definition.defaultValue),
      };
    }),
    prices: defaultMarketDrafts.prices.map((defaultPrice) => {
      const stored = storedPrices.find((price) => price.itemId === defaultPrice.itemId);
      return {
        itemId: defaultPrice.itemId,
        currencyId: stored?.currencyId ?? defaultPrice.currencyId,
        amount: String(stored?.amount ?? defaultPrice.amount),
      };
    }),
    exchangeRates: defaultMarketDrafts.exchangeRates.map((defaultRate) => {
      const stored = storedExchangeRates.find((rate) => rate.id === defaultRate.id);
      return {
        id: defaultRate.id,
        value: String(stored?.value ?? defaultRate.value),
      };
    }),
    cacheRates: defaultMarketDrafts.cacheRates.map((defaultRate) => {
      const stored = storedCacheRates.find((rate) => rate.id === defaultRate.id);
      return {
        id: defaultRate.id,
        value: String(stored?.value ?? defaultRate.value),
      };
    }),
    manualEffects: manualEffectInputCatalog.map((definition) => {
      const stored = storedManualEffects.find((effect) => effect.id === definition.id);
      return {
        id: definition.id,
        percentage: String(
          stored
            ? stored.percentage
            : getDefaultManualPercentage(
                definition.defaultValue,
                definition.observedFallbackValue,
              ),
        ),
      };
    }),
    equipment: {
      bargainPercent: String(
        storedEquipment.bargainPercent ?? defaultEquipment.bargainPercent,
      ),
      maxHealth: String(storedEquipment.maxHealth ?? defaultEquipment.maxHealth),
      armor: String(storedEquipment.armor ?? defaultEquipment.armor),
      destructiveWeaponDamage: String(
        storedEquipment.destructiveWeaponDamage ?? defaultEquipment.destructiveWeaponDamage,
      ),
      criticalDamagePercent: String(
        storedEquipment.criticalDamagePercent
          ?? defaultEquipment.criticalDamagePercent,
      ),
      damageReductionPercent: String(
        storedEquipment.damageReductionPercent ?? defaultEquipment.damageReductionPercent,
      ),
    },
  };
}

/** 驗證固定欄位 draft，只產生目前 catalog 定義的共用輸入。 */
export function validateSharedUserInputsDraft(
  draft: SharedUserInputsDraft,
):
  | { readonly success: true; readonly value: SharedUserInputs }
  | { readonly success: false; readonly errors: SharedUserInputsDraftErrors } {
  const playerLevel = draft.levels.find((level) => level.id === 'level');
  const fixedSkills = draft.levels
    .filter((level) => level.id !== 'level')
    .map(({ id, value }) => ({ id, level: numberFromDraft(value) }));

  const fixedPrices = draft.prices.map(({ itemId, currencyId, amount }) => ({
    itemId,
    currencyId,
    amount: numberFromDraft(amount),
  }));

  const fixedExchangeRates = draft.exchangeRates.map(({ id, value }) => ({
    id,
    value: numberFromDraft(value),
  }));

  const fixedCacheRates = draft.cacheRates.map(({ id, value }) => ({
    id,
    value: numberFromDraft(value),
  }));

  const fixedManualEffects = draft.manualEffects.map(({ id, percentage }) => ({
    id,
    percentage: numberFromDraft(percentage),
  }));

  const fixedEquipment = {
    bargainPercent: numberFromDraft(draft.equipment.bargainPercent),
    maxHealth: numberFromDraft(draft.equipment.maxHealth),
    armor: numberFromDraft(draft.equipment.armor),
    destructiveWeaponDamage: optionalNumberFromDraft(draft.equipment.destructiveWeaponDamage),
    criticalDamagePercent: optionalNumberFromDraft(draft.equipment.criticalDamagePercent),
    damageReductionPercent: numberFromDraft(draft.equipment.damageReductionPercent),
  };

  const result = sharedUserInputsSchema.safeParse({
    progression: {
      player: { level: numberFromDraft(playerLevel?.value ?? '') },
      skills: fixedSkills,
    },
    economy: {
      prices: fixedPrices,
      exchangeRates: fixedExchangeRates,
      cacheRates: fixedCacheRates,
    },
    effects: {
      buffs: fixedManualEffects,
    },
    equipment: fixedEquipment,
  });

  if (result.success) {
    return {
      success: true,
      value: normalizeSharedUserInputs(result.data),
    };
  }

  const errors: Record<string, true> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path] = true;
  }
  return { success: false, errors };
}
