import { describe, expect, it } from 'vitest';

import {
  defaultSharedUserInputs,
} from '@/lib/storage';
import {
  economyDataSet,
  marketCacheRateCatalog,
  marketPriceCatalog,
} from '@/data/game/economy';
import { manualEffectInputCatalog } from '@/data/game/effects';
import { progressionLevelCatalog } from '@/data/game/progression';
import {
  createDefaultSharedMarketDrafts,
  createDefaultSharedPriceDrafts,
  createSharedUserInputsDraft,
  getSharedLevelInputMaximum,
  validateSharedUserInputsDraft,
} from './shared-user-inputs-form';

describe('固定欄位 Shared User Inputs draft', () => {
  it('以目前 catalog 建立完整市場預設 drafts', () => {
    const drafts = createDefaultSharedMarketDrafts();

    expect(drafts.prices).toHaveLength(marketPriceCatalog.length);
    expect(drafts.exchangeRates).toEqual([{ id: 'btc-per-ai', value: '8450' }]);
    expect(drafts.cacheRates).toEqual(marketCacheRateCatalog.map((definition) => ({
      id: definition.id,
      value: String(definition.defaultValue),
    })));
  });

  it('依 catalog 建立六個等級、已知物價、換算基準與手動效果欄位', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);

    expect(draft.levels.map((level) => level.id)).toEqual(
      progressionLevelCatalog.map((definition) => definition.id),
    );
    expect(draft.prices).toHaveLength(marketPriceCatalog.length);
    expect(draft.exchangeRates).toHaveLength(economyDataSet.payload.exchangeRates.length);
    expect(draft.cacheRates).toHaveLength(marketCacheRateCatalog.length);
    expect(draft.manualEffects).toHaveLength(manualEffectInputCatalog.length);
    expect(draft.equipment).toEqual({
      bargainPercent: '0',
      maxHealth: '0',
      armor: '0',
      destructiveWeaponDamage: '1',
      criticalDamagePercent: '20',
      damageReductionPercent: '0',
    });
    expect(draft.levels.find((level) => level.id === 'printing-rank')?.value).toBe('1');
    expect(
      draft.prices.find((price) => price.itemId === 'medical-tech-parts')?.amount,
    ).toBe('50');
  });

  it('將玩家輸入轉為共用 snapshot，並以百分比保存手動效果', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const playerLevel = draft.levels.find((level) => level.id === 'level');
    const medicalPrice = draft.prices.find(
      (price) => price.itemId === 'medical-tech-parts',
    );
    const exchangeRate = draft.exchangeRates[0];
    const btcBonus = draft.manualEffects.find((effect) => effect.id === 'btc-buff-percent');

    if (!playerLevel || !medicalPrice || !exchangeRate || !btcBonus) {
      throw new Error('固定欄位 fixture 不完整');
    }

    playerLevel.value = '120';
    medicalPrice.amount = '1234';
    exchangeRate.value = '8200';
    btcBonus.percentage = '40';
    draft.equipment.maxHealth = '100000';
    draft.equipment.armor = '50000';
    draft.equipment.destructiveWeaponDamage = '120';
    draft.equipment.criticalDamagePercent = '150';
    draft.equipment.bargainPercent = '20';
    draft.equipment.damageReductionPercent = '15';

    const result = validateSharedUserInputsDraft(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.progression.player.level).toBe(120);
    expect(result.value.progression.skills).toEqual([]);
    expect(result.value.economy.prices).toEqual([
      { itemId: 'medical-tech-parts', currencyId: 'ai', amount: 1234 },
    ]);
    expect(result.value.economy.exchangeRates).toEqual([
      { id: 'btc-per-ai', value: 8200 },
    ]);
    expect(result.value.economy.cacheRates).toEqual([]);
    expect(result.value.effects.buffs).toEqual([{
      id: 'btc-buff-percent',
      percentage: 40,
    }]);
    expect(result.value.equipment).toEqual({
      bargainPercent: 20,
      maxHealth: 100000,
      armor: 50000,
      destructiveWeaponDamage: 120,
      criticalDamagePercent: 150,
      damageReductionPercent: 15,
    });
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.progression)).toBe(true);
  });

  it('以 0 表示不套用手動效果', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const btcBonus = draft.manualEffects.find((effect) => effect.id === 'btc-buff-percent');

    if (!btcBonus) throw new Error('固定欄位 fixture 缺少 BTC 效果');

    btcBonus.percentage = '0';

    const result = validateSharedUserInputsDraft(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.effects.buffs).toEqual([]);
  });

  it('手動 Buff 只接受 0、40、80、100 的離散值', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const btcBonus = draft.manualEffects.find((effect) => effect.id === 'btc-buff-percent');

    if (!btcBonus) throw new Error('固定欄位 fixture 缺少 BTC 效果');

    btcBonus.percentage = '20';
    expect(validateSharedUserInputsDraft(draft).success).toBe(false);

    btcBonus.percentage = '60';
    expect(validateSharedUserInputsDraft(draft).success).toBe(false);

    btcBonus.percentage = '100';
    expect(validateSharedUserInputsDraft(draft).success).toBe(true);

    btcBonus.percentage = '80';
    expect(validateSharedUserInputsDraft(draft).success).toBe(true);
  });

  it('以空白或預設值表示未設定的裝備與戰鬥值，且不保存 override', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const result = validateSharedUserInputsDraft(draft);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.equipment).toEqual({});
  });

  it('套用破壞性武器傷害與爆擊傷害的新下限', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);

    draft.equipment.destructiveWeaponDamage = '0';
    expect(validateSharedUserInputsDraft(draft).success).toBe(false);

    draft.equipment.destructiveWeaponDamage = '1';
    draft.equipment.criticalDamagePercent = '19';
    expect(validateSharedUserInputsDraft(draft).success).toBe(false);

    draft.equipment.criticalDamagePercent = '20';
    expect(validateSharedUserInputsDraft(draft).success).toBe(true);
  });

  it('允許物價小數，但拒絕其他共用數值的小數', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const firstPrice = draft.prices[0];
    if (!firstPrice) throw new Error('固定欄位 fixture 缺少價格');

    firstPrice.amount = '1.5';
    expect(validateSharedUserInputsDraft(draft).success).toBe(true);

    draft.equipment.maxHealth = '1000.5';
    const result = validateSharedUserInputsDraft(draft);
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors).toHaveProperty('equipment.maxHealth');
  });

  it('依主等級限制技能欄位最大值，主等級無效時保留資料目錄上限', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const playerLevel = draft.levels.find((level) => level.id === 'level');

    if (!playerLevel) throw new Error('固定欄位 fixture 缺少主等級');

    playerLevel.value = '120';
    expect(getSharedLevelInputMaximum(draft, 'printing-rank')).toBe(120);
    expect(getSharedLevelInputMaximum(draft, 'mining-skill')).toBe(120);

    playerLevel.value = '';
    expect(getSharedLevelInputMaximum(draft, 'printing-rank')).toBe(800);
  });

  it('拒絕技能等級高於主等級的 draft', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const playerLevel = draft.levels.find((level) => level.id === 'level');
    const printingLevel = draft.levels.find((level) => level.id === 'printing-rank');

    if (!playerLevel || !printingLevel) throw new Error('固定欄位 fixture 不完整');

    playerLevel.value = '100';
    printingLevel.value = '101';

    const result = validateSharedUserInputsDraft(draft);
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors).toHaveProperty('progression.skills.0.level');
  });

  it('只保存非預設的 catalog override，不保留完整 fallback 欄位', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const result = validateSharedUserInputsDraft(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.value.progression).toEqual({ player: { level: 1 }, skills: [] });
    expect(result.value.economy).toEqual({
      prices: [],
      exchangeRates: [],
      cacheRates: [],
    });
    expect(result.value.effects.buffs).toEqual([]);
    expect(result.value.equipment).toEqual({});
  });

  it('只改一個價格欄位只保存一筆 override，回到 default 會移除 override', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const firstPrice = draft.prices[0];
    if (!firstPrice) throw new Error('固定欄位 fixture 缺少價格');

    firstPrice.amount = '111';
    const changed = validateSharedUserInputsDraft(draft);
    expect(changed.success).toBe(true);
    if (!changed.success) return;
    expect(changed.value.economy.prices).toEqual([
      { itemId: 'tech-scrap', currencyId: 'ai', amount: 111 },
    ]);
    expect(changed.value.economy.exchangeRates).toEqual([]);
    expect(changed.value.economy.cacheRates).toEqual([]);
    expect(changed.value.effects.buffs).toEqual([]);

    draft.prices = createDefaultSharedPriceDrafts();
    const restored = validateSharedUserInputsDraft(draft);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.value.economy.prices).toEqual([]);
  });

  it('拒絕無效數值，且不會產生可保存的 snapshot', () => {
    const draft = createSharedUserInputsDraft(defaultSharedUserInputs);
    const playerLevel = draft.levels.find((level) => level.id === 'level');
    const firstPrice = draft.prices[0];
    const firstExchangeRate = draft.exchangeRates[0];
    const firstEffect = draft.manualEffects[0];

    if (!playerLevel || !firstPrice || !firstExchangeRate || !firstEffect) {
      throw new Error('固定欄位 fixture 不完整');
    }

    playerLevel.value = 'Infinity';
    firstPrice.amount = '-1';
    firstExchangeRate.value = '0';
    firstEffect.percentage = '101';

    const result = validateSharedUserInputsDraft(draft);
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors).toHaveProperty('progression.player.level');
    expect(result.errors).toHaveProperty('economy.prices.0.amount');
    expect(result.errors).toHaveProperty('economy.exchangeRates.0.value');
    expect(result.errors).toHaveProperty('effects.buffs.0.percentage');
  });
});
