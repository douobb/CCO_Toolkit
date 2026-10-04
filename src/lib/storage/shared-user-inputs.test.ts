import { describe, expect, it } from 'vitest';

import {
  defaultSharedUserInputs,
  normalizeSharedUserInputs,
  sharedUserInputsSchema,
  sharedUserInputsSchemaVersion,
  sharedUserInputsStorageKey,
  sharedUserInputsStorageVersion,
  type SharedUserInputs,
} from '../shared-user-inputs';
import {
  economyDataSet,
  marketCacheRateCatalog,
  marketPriceCatalog,
} from '@/data/game/economy';
import { manualEffectInputCatalog } from '@/data/game/effects';
import { progressionLevelCatalog } from '@/data/game/progression';
import {
  clearSharedUserInputs,
  createSharedUserInputsStore,
  loadSharedUserInputs,
  parseSharedUserInputsStorageRecord,
  resetAllStorage,
  savePreferences,
  saveSharedUserInputs,
  saveToolState,
  serializeSharedUserInputsStorageRecord,
  type SharedUserInputsStorageEventTarget,
  type StorageLike,
} from './index';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class ThrowingStorage implements StorageLike {
  get length(): number {
    throw new Error('storage length failed');
  }

  key(_index: number): string | null {
    throw new Error('storage key failed');
  }

  getItem(_key: string): string | null {
    throw new Error('storage get failed');
  }

  setItem(_key: string, _value: string): void {
    throw new Error('storage set failed');
  }

  removeItem(_key: string): void {
    throw new Error('storage remove failed');
  }
}

class StorageEventTarget implements SharedUserInputsStorageEventTarget {
  private readonly listeners = new Set<(event: StorageEvent) => void>();

  addEventListener(
    _type: 'storage',
    listener: (event: StorageEvent) => void,
  ) {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: 'storage',
    listener: (event: StorageEvent) => void,
  ) {
    this.listeners.delete(listener);
  }

  dispatch(event: Pick<StorageEvent, 'key' | 'newValue' | 'storageArea'>) {
    for (const listener of [...this.listeners]) {
      listener(event as StorageEvent);
    }
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

function createValidInputs(): Record<string, unknown> {
  return {
    progression: {
      player: { level: 100 },
      skills: [{ id: 'printing-rank', level: 20 }],
    },
    economy: {
      prices: [
        { itemId: 'medical-tech-parts', currencyId: 'ai', amount: 1_000 },
      ],
      exchangeRates: [],
      cacheRates: [],
    },
    effects: {
      buffs: [
        {
          id: 'btc-buff-percent',
          percentage: 40,
        },
      ],
    },
    equipment: {
      bargainPercent: 20,
      maxHealth: 1_000,
      armor: 500,
      destructiveWeaponDamage: 100,
      criticalDamagePercent: 150,
      damageReductionPercent: 20,
    },
  };
}

function createExpandedCatalogDefaults(): Record<string, unknown> {
  return {
    progression: {
      player: { level: 1 },
      skills: progressionLevelCatalog
        .filter((definition) => definition.id !== 'level')
        .map((definition) => ({ id: definition.id, level: definition.defaultValue })),
    },
    economy: {
      prices: marketPriceCatalog.map((definition) => ({
        itemId: definition.itemId,
        currencyId: definition.defaultBasisCurrencyId,
        amount: definition.defaultBasisValue,
      })),
      exchangeRates: economyDataSet.payload.exchangeRates.map((definition) => ({
        id: definition.id,
        value: definition.defaultValue,
      })),
      cacheRates: marketCacheRateCatalog.map((definition) => ({
        id: definition.id,
        value: definition.defaultValue,
      })),
    },
    effects: {
      buffs: manualEffectInputCatalog.map((definition) => {
        const percentage = definition.defaultValue ?? definition.observedFallbackValue;
        return {
          id: definition.id,
          percentage,
        };
      }),
    },
    equipment: {
      bargainPercent: 0,
      maxHealth: 0,
      armor: 0,
      destructiveWeaponDamage: 1,
      criticalDamagePercent: 20,
      damageReductionPercent: 0,
    },
  };
}

function asSharedUserInputs(value: unknown) {
  return value as SharedUserInputs;
}

function createStorageEvent(
  key: string | null,
  newValue: string | null,
  storageArea?: StorageLike,
) {
  return {
    key,
    newValue,
    storageArea: storageArea as Storage | null | undefined,
  } as Pick<StorageEvent, 'key' | 'newValue' | 'storageArea'>;
}

describe('Shared User Inputs schema', () => {
  it('accepts grouped player, skill, price, BUFF and equipment values', () => {
    const result = sharedUserInputsSchema.safeParse(createValidInputs());

    expect(result.success).toBe(true);
  });

  it('rejects a skill level above the player level and locates the skill field', () => {
    const value = createValidInputs();
    const progression = value.progression as Record<string, unknown>;
    progression.player = { level: 20 };
    progression.skills = [{ id: 'printing-rank', level: 21 }];

    const result = sharedUserInputsSchema.safeParse(value);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toContainEqual(expect.objectContaining({
      path: ['progression', 'skills', 0, 'level'],
    }));
  });

  it('accepts positive exchange and cache conversion values', () => {
    const value = createValidInputs();
    const economy = value.economy as Record<string, unknown>;
    economy.exchangeRates = [{ id: 'btc-per-ai', value: 8_150 }];
    economy.cacheRates = [{ id: 'rare', value: 3 }];

    expect(sharedUserInputsSchema.safeParse(value).success).toBe(true);

    economy.exchangeRates = [{ id: 'btc-per-ai', value: 0 }];
    expect(sharedUserInputsSchema.safeParse(value).success).toBe(false);
  });

  it('accepts the current equipment upper bounds', () => {
    const value = createValidInputs();
    const equipment = value.equipment as Record<string, unknown>;
    equipment.bargainPercent = 40;
    equipment.criticalDamagePercent = 220;

    expect(sharedUserInputsSchema.safeParse(value).success).toBe(true);
  });

  it('accepts decimal market prices but rejects decimals in other shared values', () => {
    const value = createValidInputs();
    const economy = value.economy as Record<string, unknown>;
    const effects = value.effects as Record<string, unknown>;
    const equipment = value.equipment as Record<string, unknown>;

    economy.prices = [
      { itemId: 'medical-tech-parts', currencyId: 'ai', amount: 1_000.5 },
    ];
    expect(sharedUserInputsSchema.safeParse(value).success).toBe(true);

    economy.exchangeRates = [{ id: 'btc-per-ai', value: 8_150.5 }];
    expect(sharedUserInputsSchema.safeParse(value).success).toBe(false);

    economy.exchangeRates = [];
    economy.cacheRates = [{ id: 'rare', value: 3.5 }];
    expect(sharedUserInputsSchema.safeParse(value).success).toBe(false);

    economy.cacheRates = [];
    effects.buffs = [{ id: 'btc-buff-percent', percentage: 25.5 }];
    expect(sharedUserInputsSchema.safeParse(value).success).toBe(false);

    effects.buffs = [];
    equipment.maxHealth = 1_000.5;
    expect(sharedUserInputsSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    ['player level below the lower bound', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).player = { level: 0 };
    }],
    ['player level above the upper bound', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).player = { level: 801 };
    }],
    ['player level NaN', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).player = { level: Number.NaN };
    }],
    ['player level Infinity', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).player = {
        level: Number.POSITIVE_INFINITY,
      };
    }],
    ['player level decimal', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).player = { level: 100.5 };
    }],
    ['skill level negative', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).skills = [
        { id: 'hacking', level: -1 },
      ];
    }],
    ['skill level decimal', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).skills = [
        { id: 'hacking', level: 20.5 },
      ];
    }],
    ['skill ID invalid', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).skills = [
        { id: 'Hacking Skill', level: 20 },
      ];
    }],
    ['skill ID not in catalog', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).skills = [
        { id: 'unknown-skill', level: 20 },
      ];
    }],
    ['skill ID duplicated', (value: Record<string, unknown>) => {
      (value.progression as Record<string, unknown>).skills = [
        { id: 'printing-rank', level: 20 },
        { id: 'printing-rank', level: 21 },
      ];
    }],
    ['price negative', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).prices = [
        { itemId: 'medical-tech-parts', currencyId: 'ai', amount: -1 },
      ];
    }],
    ['price NaN', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).prices = [
        { itemId: 'medical-tech-parts', currencyId: 'ai', amount: Number.NaN },
      ];
    }],
    ['price Infinity', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).prices = [
        {
          itemId: 'medical-tech-parts',
          currencyId: 'ai',
          amount: Number.POSITIVE_INFINITY,
        },
      ];
    }],
    ['price item ID duplicated', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).prices = [
        { itemId: 'medical-tech-parts', currencyId: 'ai', amount: 1_000 },
        { itemId: 'medical-tech-parts', currencyId: 'btc', amount: 2_000 },
      ];
    }],
    ['price item ID not in catalog', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).prices = [
        { itemId: 'unknown-item', currencyId: 'ai', amount: 1_000 },
      ];
    }],
    ['price currency ID not in catalog', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).prices = [
        { itemId: 'medical-tech-parts', currencyId: 'credits', amount: 1_000 },
      ];
    }],
    ['exchange rate ID not in catalog', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).exchangeRates = [
        { id: 'unknown-rate', value: 2 },
      ];
    }],
    ['exchange rate negative', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).exchangeRates = [
        { id: 'btc-per-ai', value: -1 },
      ];
    }],
    ['cache rate ID not in catalog', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).cacheRates = [
        { id: 'unknown-cache', value: 2 },
      ];
    }],
    ['cache rate negative', (value: Record<string, unknown>) => {
      (value.economy as Record<string, unknown>).cacheRates = [
        { id: 'rare', value: -1 },
      ];
    }],
    ['BUFF legacy status field is rejected', (value: Record<string, unknown>) => {
      (value.effects as Record<string, unknown>).buffs = [
        { id: 'btc-buff-percent', percentage: 40, status: 'active' },
      ];
    }],
    ['BUFF legacy stacks field is rejected', (value: Record<string, unknown>) => {
      (value.effects as Record<string, unknown>).buffs = [
        { id: 'btc-buff-percent', percentage: 40, stacks: 1 },
      ];
    }],
    ['BUFF percentage negative', (value: Record<string, unknown>) => {
      (value.effects as Record<string, unknown>).buffs = [
        { id: 'btc-buff-percent', percentage: -1 },
      ];
    }],
    ['BUFF percentage above the current range', (value: Record<string, unknown>) => {
      (value.effects as Record<string, unknown>).buffs = [
        { id: 'btc-buff-percent', percentage: 101 },
      ];
    }],
    ['BUFF ID not in catalog', (value: Record<string, unknown>) => {
      (value.effects as Record<string, unknown>).buffs = [
        { id: 'unknown-buff', percentage: 40 },
      ];
    }],
    ['BUFF ID duplicated', (value: Record<string, unknown>) => {
      (value.effects as Record<string, unknown>).buffs = [
        { id: 'btc-buff-percent', percentage: 40 },
        { id: 'btc-buff-percent', percentage: 80 },
      ];
    }],
    ['legacy statuses collection is rejected', (value: Record<string, unknown>) => {
      (value.effects as Record<string, unknown>).statuses = [
        { id: 'btcBonus', status: 'inactive' },
      ];
    }],
    ['bargain above the current profile limit', (value: Record<string, unknown>) => {
      (value.equipment as Record<string, unknown>).bargainPercent = 41;
    }],
    ['critical damage above the current profile limit', (value: Record<string, unknown>) => {
      (value.equipment as Record<string, unknown>).criticalDamagePercent = 221;
    }],
    ['critical damage below the current profile limit', (value: Record<string, unknown>) => {
      (value.equipment as Record<string, unknown>).criticalDamagePercent = 19;
    }],
    ['destructive weapon damage below the current profile limit', (value: Record<string, unknown>) => {
      (value.equipment as Record<string, unknown>).destructiveWeaponDamage = 0;
    }],
    ['damage reduction above the valid range', (value: Record<string, unknown>) => {
      (value.equipment as Record<string, unknown>).damageReductionPercent = 101;
    }],
    ['equipment value negative', (value: Record<string, unknown>) => {
      (value.equipment as Record<string, unknown>).maxHealth = -1;
    }],
    ['unknown top-level field', (value: Record<string, unknown>) => {
      value.calculationResult = { value: 123 };
    }],
    ['unknown nested field', (value: Record<string, unknown>) => {
      const progression = value.progression as Record<string, unknown>;
      progression.player = { level: 100, displayMode: 'compact' };
    }],
  ])('rejects %s', (_description, mutate) => {
    const value = createValidInputs();
    mutate(value);

    expect(sharedUserInputsSchema.safeParse(value).success).toBe(false);
  });

  it('keeps defaults separate from Game Data, Tool state and derived results', () => {
    expect(defaultSharedUserInputs).toEqual({
      progression: { player: { level: 1 }, skills: [] },
      economy: { prices: [], exchangeRates: [], cacheRates: [] },
      effects: { buffs: [] },
      equipment: {},
    });
    expect(defaultSharedUserInputs).not.toHaveProperty('dataVersion');
    expect(defaultSharedUserInputs).not.toHaveProperty('searchCount');
    expect(defaultSharedUserInputs).not.toHaveProperty('result');
  });

  it('returns a deeply frozen sparse normalizer result', () => {
    const normalized = normalizeSharedUserInputs(asSharedUserInputs(createValidInputs()));

    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.progression)).toBe(true);
    expect(Object.isFrozen(normalized.progression.player)).toBe(true);
    expect(Object.isFrozen(normalized.progression.skills)).toBe(true);
    expect(Object.isFrozen(normalized.economy)).toBe(true);
    expect(Object.isFrozen(normalized.effects)).toBe(true);
    expect(Object.isFrozen(normalized.equipment)).toBe(true);
  });
});

describe('Shared User Inputs storage and store', () => {
  it('uses an independent key and schema/storage versions', () => {
    expect(sharedUserInputsStorageKey).toBe('cco-toolkit:shared-inputs:v4');
    expect(sharedUserInputsStorageVersion).toBe(4);
    expect(sharedUserInputsSchemaVersion).toBe(4);
    expect(sharedUserInputsStorageKey).not.toBe('cco-toolkit:v1:preferences');
  });

  it('局部正規化舊 Buff 值並保留既有 100% 與其他共用資料', () => {
    const storage = new MemoryStorage();
    const legacyValue = createValidInputs();
    (legacyValue.effects as Record<string, unknown>).buffs = [
      { id: 'btc-buff-percent', percentage: 25 },
      { id: 'exp-buff-percent', percentage: 100 },
    ];
    storage.setItem(sharedUserInputsStorageKey, JSON.stringify({
      storageVersion: sharedUserInputsStorageVersion,
      schemaVersion: sharedUserInputsSchemaVersion,
      value: legacyValue,
    }));

    const parsed = parseSharedUserInputsStorageRecord(
      JSON.parse(storage.getItem(sharedUserInputsStorageKey) ?? ''),
    );
    if (parsed.status !== 'valid') return;
    expect(parsed.migrated).toBe(true);
    expect(parsed.value.effects.buffs).toEqual([
      { id: 'btc-buff-percent', percentage: 40 },
      { id: 'exp-buff-percent', percentage: 100 },
    ]);

    const loaded = loadSharedUserInputs({ storage });
    expect(loaded.status).toBe('valid');
    if (loaded.status !== 'valid') return;
    expect(loaded.value.effects.buffs).toEqual(parsed.value.effects.buffs);
    expect(loaded.value.progression.player.level).toBe(100);
    expect(loaded.value.equipment.maxHealth).toBe(1_000);

    const persisted = JSON.parse(storage.getItem(sharedUserInputsStorageKey) ?? '') as {
      value: { effects: { buffs: unknown }; equipment: { maxHealth: number } };
    };
    expect(persisted.value.effects.buffs).toEqual(parsed.value.effects.buffs);
    expect(persisted.value.equipment.maxHealth).toBe(1_000);
  });

  it('將完整 catalog fallback 壓縮為 sparse overrides 後保存', () => {
    const storage = new MemoryStorage();
    const store = createSharedUserInputsStore({ storage });

    expect(store.replace(asSharedUserInputs(createExpandedCatalogDefaults()))).toBe(true);
    const rawRecord = JSON.parse(
      storage.getItem(sharedUserInputsStorageKey) ?? '',
    ) as Record<string, unknown>;

    expect(rawRecord.value).toEqual(defaultSharedUserInputs);
    expect(store.getSnapshot()).toBe(defaultSharedUserInputs);
    store.dispose();
  });

  it('notifies two subscribers with the same snapshot and supports unsubscribe', () => {
    const storage = new MemoryStorage();
    const store = createSharedUserInputsStore({ storage });
    const firstSnapshots: SharedUserInputs[] = [];
    const secondSnapshots: SharedUserInputs[] = [];
    const unsubscribeFirst = store.subscribe(() => {
      firstSnapshots.push(store.getSnapshot());
    });
    const unsubscribeSecond = store.subscribe(() => {
      secondSnapshots.push(store.getSnapshot());
    });

    expect(
      store.update((current) => ({
        ...current,
        progression: {
          ...current.progression,
          player: { level: 200 },
        },
      })),
    ).toBe(true);
    expect(firstSnapshots).toHaveLength(1);
    expect(secondSnapshots).toHaveLength(1);
    expect(firstSnapshots[0]).toEqual(secondSnapshots[0]);
    expect(firstSnapshots[0]).toBe(secondSnapshots[0]);

    unsubscribeFirst();
    expect(
      store.update((current) => ({
        ...current,
        progression: {
          ...current.progression,
          player: { level: 300 },
        },
      })),
    ).toBe(true);
    expect(firstSnapshots).toHaveLength(1);
    expect(secondSnapshots).toHaveLength(2);

    unsubscribeSecond();
    store.dispose();
  });

  it('persists, recreates, clears and resets without storing derived results', () => {
    const storage = new MemoryStorage();
    const firstStore = createSharedUserInputsStore({ storage });
    const value = asSharedUserInputs(createValidInputs());

    expect(firstStore.replace(value)).toBe(true);
    const rawRecord = JSON.parse(
      storage.getItem(sharedUserInputsStorageKey) ?? '',
    ) as Record<string, unknown>;
    expect(rawRecord).toEqual({
      storageVersion: sharedUserInputsStorageVersion,
      schemaVersion: sharedUserInputsSchemaVersion,
      value,
    });
    expect(JSON.stringify(rawRecord)).not.toContain('result');

    firstStore.dispose();
    const secondStore = createSharedUserInputsStore({ storage });
    expect(secondStore.getSnapshot()).toEqual(value);

    let notifications = 0;
    secondStore.subscribe(() => {
      notifications += 1;
    });
    expect(secondStore.clear()).toBe(true);
    expect(secondStore.getSnapshot()).toBe(defaultSharedUserInputs);
    expect(storage.getItem(sharedUserInputsStorageKey)).toBeNull();
    expect(notifications).toBe(1);
    expect(secondStore.reset()).toBe(true);
    expect(notifications).toBe(1);

    secondStore.dispose();
  });

  it('supports deferred hydration without duplicate listeners or notifications', () => {
    const storage = new MemoryStorage();
    const eventTarget = new StorageEventTarget();
    saveSharedUserInputs(asSharedUserInputs(createValidInputs()), { storage });
    const store = createSharedUserInputsStore({
      storage,
      eventTarget,
      autoHydrate: false,
    });
    let notifications = 0;
    store.subscribe(() => { notifications += 1; });

    expect(store.getSnapshot()).toBe(defaultSharedUserInputs);
    expect(eventTarget.listenerCount).toBe(0);
    expect(store.hydrate()).toBe(true);
    expect(store.getSnapshot().progression.player.level).toBe(100);
    expect(notifications).toBe(1);
    expect(eventTarget.listenerCount).toBe(1);
    expect(store.hydrate()).toBe(false);
    expect(notifications).toBe(1);
    expect(eventTarget.listenerCount).toBe(1);

    store.dispose();
    expect(eventTarget.listenerCount).toBe(0);
  });

  it('falls back to memory when SSR/storage is unavailable or throws', () => {
    const unavailableStore = createSharedUserInputsStore({ storage: null });
    expect(unavailableStore.getSnapshot()).toBe(defaultSharedUserInputs);
    expect(unavailableStore.replace(asSharedUserInputs(createValidInputs()))).toBe(true);
    expect(unavailableStore.getSnapshot().progression.player.level).toBe(100);
    expect(unavailableStore.clear()).toBe(true);
    unavailableStore.dispose();

    const throwingStorage = new ThrowingStorage();
    const throwingStore = createSharedUserInputsStore({ storage: throwingStorage });
    expect(throwingStore.getSnapshot()).toBe(defaultSharedUserInputs);
    expect(throwingStore.replace(asSharedUserInputs(createValidInputs()))).toBe(true);
    expect(throwingStore.getSnapshot().progression.player.level).toBe(100);
    expect(throwingStore.clear()).toBe(true);
    expect(throwingStore.getSnapshot()).toBe(defaultSharedUserInputs);
    throwingStore.dispose();
  });

  it('handles corrupted, invalid and unsupported records safely', () => {
    const corruptedStorage = new MemoryStorage();
    corruptedStorage.setItem(sharedUserInputsStorageKey, '{broken');
    expect(loadSharedUserInputs({ storage: corruptedStorage })).toMatchObject({
      status: 'invalid',
      value: defaultSharedUserInputs,
    });
    expect(corruptedStorage.getItem(sharedUserInputsStorageKey)).toBeNull();

    const invalidStorage = new MemoryStorage();
    invalidStorage.setItem(
      sharedUserInputsStorageKey,
      JSON.stringify({
        storageVersion: sharedUserInputsStorageVersion,
        schemaVersion: sharedUserInputsSchemaVersion,
        value: { progression: {} },
      }),
    );
    expect(loadSharedUserInputs({ storage: invalidStorage }).status).toBe('invalid');
    expect(invalidStorage.getItem(sharedUserInputsStorageKey)).toBeNull();

    const futureStorage = new MemoryStorage();
    const futureRecord = {
      storageVersion: sharedUserInputsStorageVersion + 1,
      schemaVersion: sharedUserInputsSchemaVersion + 1,
      value: createValidInputs(),
    };
    futureStorage.setItem(sharedUserInputsStorageKey, JSON.stringify(futureRecord));
    expect(loadSharedUserInputs({ storage: futureStorage }).status).toBe('unsupported');
    expect(futureStorage.getItem(sharedUserInputsStorageKey)).toBe(
      JSON.stringify(futureRecord),
    );
    expect(parseSharedUserInputsStorageRecord(futureRecord).status).toBe('unsupported');
  });

  it('accepts only valid external events, handles clear and does not echo them', () => {
    const storage = new MemoryStorage();
    const eventTarget = new StorageEventTarget();
    const store = createSharedUserInputsStore({ storage, eventTarget });
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });
    const externalValue = asSharedUserInputs(createValidInputs());
    const serialized = serializeSharedUserInputsStorageRecord(externalValue);
    if (serialized === undefined) {
      throw new Error('測試 fixture 必須能序列化');
    }

    expect(eventTarget.listenerCount).toBe(1);
    eventTarget.dispatch(
      createStorageEvent(sharedUserInputsStorageKey, serialized),
    );
    expect(store.getSnapshot()).toEqual(externalValue);
    expect(notifications).toBe(1);
    expect(storage.getItem(sharedUserInputsStorageKey)).toBeNull();

    eventTarget.dispatch(
      createStorageEvent(sharedUserInputsStorageKey, serialized),
    );
    expect(notifications).toBe(1);

    eventTarget.dispatch(createStorageEvent(sharedUserInputsStorageKey, '{bad'));
    eventTarget.dispatch(
      createStorageEvent(
        sharedUserInputsStorageKey,
        JSON.stringify({
          storageVersion: sharedUserInputsStorageVersion,
          schemaVersion: sharedUserInputsSchemaVersion,
          value: { progression: {} },
        }),
      ),
    );
    eventTarget.dispatch(createStorageEvent('other-app:data', serialized));
    eventTarget.dispatch(
      createStorageEvent(
        sharedUserInputsStorageKey,
        JSON.stringify({
          storageVersion: sharedUserInputsStorageVersion + 1,
          schemaVersion: sharedUserInputsSchemaVersion + 1,
          value: externalValue,
        }),
      ),
    );
    expect(notifications).toBe(1);
    expect(store.getSnapshot()).toEqual(externalValue);

    const otherStorage = new MemoryStorage();
    eventTarget.dispatch(
      createStorageEvent(sharedUserInputsStorageKey, serialized, otherStorage),
    );
    expect(notifications).toBe(1);

    eventTarget.dispatch(createStorageEvent(sharedUserInputsStorageKey, null));
    expect(store.getSnapshot()).toBe(defaultSharedUserInputs);
    expect(notifications).toBe(2);

    eventTarget.dispatch(createStorageEvent(null, null));
    expect(notifications).toBe(2);

    store.dispose();
    expect(eventTarget.listenerCount).toBe(0);
    eventTarget.dispatch(
      createStorageEvent(sharedUserInputsStorageKey, serialized),
    );
    expect(notifications).toBe(2);
  });

  it('keeps snapshots and nested data immutable after input objects change', () => {
    const storage = new MemoryStorage();
    const store = createSharedUserInputsStore({ storage });
    const input = createValidInputs();

    expect(store.replace(input)).toBe(true);
    const snapshot = store.getSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.progression)).toBe(true);
    expect(Object.isFrozen(snapshot.progression.player)).toBe(true);
    expect(Object.isFrozen(snapshot.progression.skills)).toBe(true);

    const inputProgression = input.progression as Record<string, unknown>;
    (inputProgression.player as Record<string, unknown>).level = 500;
    expect(store.getSnapshot().progression.player.level).toBe(100);
    expect(() => {
      Object.assign(
        (snapshot as unknown as { progression: { player: { level: number } } })
          .progression.player,
        { level: 500 },
      );
    }).toThrow();
    expect(store.getSnapshot().progression.player.level).toBe(100);

    store.dispose();
  });

  it('keeps resetAllStorage scoped to CCO Toolkit keys', () => {
    const storage = new MemoryStorage();
    saveSharedUserInputs(asSharedUserInputs(createValidInputs()), { storage });
    saveToolState('search-reward', { searchCount: 10 }, { storage });
    savePreferences({ theme: 'dark' }, { storage });
    storage.setItem('other-app:data', JSON.stringify({ keep: true }));

    expect(resetAllStorage({ storage })).toBe(3);
    expect(storage.getItem(sharedUserInputsStorageKey)).toBeNull();
    expect(storage.getItem('cco-toolkit:v1:tool:search-reward')).toBeNull();
    expect(storage.getItem('cco-toolkit:v1:preferences')).toBeNull();
    expect(storage.getItem('other-app:data')).not.toBeNull();
    expect(clearSharedUserInputs({ storage })).toBe(true);
  });
});
